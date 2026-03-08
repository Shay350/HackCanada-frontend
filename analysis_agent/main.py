from __future__ import annotations

import asyncio
import json
import logging
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from analysis_agent.config import get_settings
from analysis_agent.database import SessionLocal, engine, get_db
from analysis_agent.models import AnalysisJob, AnalysisReport, Base, JobStatus
from analysis_agent.schemas import (
    IncidentView,
    JobCreatedResponse,
    JobStatusResponse,
    ProposedFixView,
    SummaryResponse,
    UptimeKumaJobCreate,
)
from analysis_agent.worker import AnalysisWorker

settings = get_settings()
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s",
)


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


for handler in logging.getLogger().handlers:
    handler.addFilter(RequestIdFilter())

logger = logging.getLogger(__name__)
app = FastAPI(title="analysis-agent", version="0.1.0")
worker_task: asyncio.Task | None = None
worker: AnalysisWorker | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def inject_request_id(request: Request, call_next):
    rid = request.headers.get("x-request-id", str(uuid.uuid4()))
    token = request_id_ctx.set(rid)
    try:
        response = await call_next(request)
    finally:
        request_id_ctx.reset(token)
    response.headers["X-Request-ID"] = rid
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"message": "Malformed payload", "detail": exc.errors()})


@app.on_event("startup")
async def on_startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    global worker, worker_task
    if settings.worker_enabled:
        worker = AnalysisWorker(SessionLocal, poll_interval_sec=settings.worker_poll_interval_sec)
        worker_task = asyncio.create_task(worker.run())
        logger.info("Worker started")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    global worker_task, worker
    if worker is not None:
        await worker.stop()
    if worker_task is not None:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/analysis/jobs", response_model=JobCreatedResponse)
async def create_job(payload: UptimeKumaJobCreate, db: AsyncSession = Depends(get_db)) -> JobCreatedResponse:
    normalized = payload.to_internal()
    if normalized.idempotency_key:
        existing = await db.execute(select(AnalysisJob).where(AnalysisJob.idempotency_key == normalized.idempotency_key))
        existing_job = existing.scalar_one_or_none()
        if existing_job:
            return JobCreatedResponse(job_id=existing_job.id, status=existing_job.status.value)

    job = AnalysisJob(
        incident_id=normalized.incident_id,
        idempotency_key=normalized.idempotency_key,
        status=JobStatus.queued,
        progress=0,
        request_payload=normalized.model_dump(mode="json"),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return JobCreatedResponse(job_id=job.id, status=job.status.value)


@app.get("/api/v1/analysis/incidents", response_model=list[IncidentView])
async def list_incidents(limit: int = 50, db: AsyncSession = Depends(get_db)) -> list[IncidentView]:
    safe_limit = min(max(limit, 1), 200)
    stmt = (
        select(AnalysisJob, AnalysisReport)
        .outerjoin(AnalysisReport, AnalysisReport.job_id == AnalysisJob.id)
        .order_by(AnalysisJob.created_at.desc())
        .limit(safe_limit)
    )
    rows = await db.execute(stmt)

    output: list[IncidentView] = []
    for job, report in rows.all():
        payload = job.request_payload or {}
        report_json = (report.report_json if report else {}) or {}
        metadata = payload.get("metadata", {}) if isinstance(payload, dict) else {}

        service_name = str(payload.get("service_name", "unknown-service"))
        uptime_status = str(payload.get("uptime_status", "")).lower()
        ui_status = _map_job_to_ui_status(job.status, uptime_status)
        logs = _extract_logs(payload, report_json)
        confidence = float(report.confidence) if report else 0.0
        proposed_fix = _extract_proposed_fix(report, report_json, service_name)

        output.append(
            IncidentView(
                id=job.incident_id,
                service=service_name,
                serviceType=str(metadata.get("service_type", "service")),
                status=ui_status,
                logs=logs,
                confidence=max(0.0, min(1.0, confidence)),
                proposedFix=proposed_fix,
            )
        )

    return output


@app.get("/api/v1/analysis/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db)) -> JobStatusResponse:
    result = await db.execute(select(AnalysisJob).where(AnalysisJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job.id,
        status=job.status.value,
        progress=job.progress,
        error=job.error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@app.get("/api/v1/analysis/jobs/{job_id}/result")
async def get_result(job_id: UUID, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(select(AnalysisReport).where(AnalysisReport.job_id == job_id))
    report = result.scalar_one_or_none()
    if report is None:
        job_result = await db.execute(select(AnalysisJob).where(AnalysisJob.id == job_id))
        job = job_result.scalar_one_or_none()
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        if job.status in {JobStatus.queued, JobStatus.running}:
            raise HTTPException(status_code=409, detail="Job still processing")
        raise HTTPException(status_code=404, detail="Report not found")

    return report.report_json


@app.get("/api/v1/analysis/jobs/{job_id}/summary", response_model=SummaryResponse)
async def get_summary(job_id: UUID, db: AsyncSession = Depends(get_db)) -> SummaryResponse:
    result = await db.execute(select(AnalysisReport).where(AnalysisReport.job_id == job_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    return SummaryResponse(
        incident_id=report.incident_id,
        summary_text=report.summary_text,
        confidence=report.confidence,
    )


@app.get("/api/v1/analysis/jobs/{job_id}/download")
async def download_report(job_id: UUID, db: AsyncSession = Depends(get_db)) -> Response:
    result = await db.execute(select(AnalysisReport).where(AnalysisReport.job_id == job_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    content = json.dumps(report.report_json, indent=2).encode("utf-8")
    filename = f"analysis-report-{job_id}.json"
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/")
async def root() -> dict[str, Any]:
    return {
        "service": settings.app_name,
        "time": datetime.now(tz=timezone.utc).isoformat(),
        "endpoints": [
            "POST /api/v1/analysis/jobs",
            "GET /api/v1/analysis/incidents",
            "GET /api/v1/analysis/jobs/{job_id}",
            "GET /api/v1/analysis/jobs/{job_id}/result",
            "GET /api/v1/analysis/jobs/{job_id}/summary",
            "GET /api/v1/analysis/jobs/{job_id}/download",
        ],
    }


def _map_job_to_ui_status(job_status: JobStatus, uptime_status: str) -> str:
    if job_status in {JobStatus.queued, JobStatus.running}:
        return "resolving"
    if job_status == JobStatus.failed:
        return "warning"
    if uptime_status == "degraded":
        return "warning"
    return "issue"


def _extract_logs(payload: dict[str, Any], report_json: dict[str, Any]) -> list[str]:
    evidence_items = report_json.get("evidence", [])
    if isinstance(evidence_items, list) and evidence_items:
        logs = [str(item.get("snippet", "")) for item in evidence_items if isinstance(item, dict)]
        logs = [line for line in logs if line]
        if logs:
            return logs[:12]

    raw_logs = payload.get("log_snippets", [])
    if isinstance(raw_logs, list):
        logs = [str(item.get("line", "")) for item in raw_logs if isinstance(item, dict)]
        logs = [line for line in logs if line]
        if logs:
            return logs[:12]

    description = str(payload.get("uptime_description", "No logs provided"))
    return [description]


def _extract_proposed_fix(
    report: AnalysisReport | None,
    report_json: dict[str, Any],
    service_name: str,
) -> ProposedFixView | None:
    if report is None:
        return None

    suggested_actions = report_json.get("suggested_actions", [])
    if not isinstance(suggested_actions, list) or not suggested_actions:
        return None

    steps = [
        str(item.get("suggested_command", "")).strip()
        for item in suggested_actions
        if isinstance(item, dict) and str(item.get("suggested_command", "")).strip()
    ]
    if not steps:
        return None

    summary = _select_summary_text(report.summary_text, report_json, service_name)
    return ProposedFixView(description=summary, steps=steps[:8])


def _select_summary_text(raw_summary: str, report_json: dict[str, Any], service_name: str) -> str:
    summary = str(raw_summary or "").strip()
    if _has_required_sections(summary):
        return summary
    if not _is_low_quality_summary(summary):
        return _build_summary_fallback(report_json, service_name, summary)
    return _build_summary_fallback(report_json, service_name)


def _has_required_sections(summary: str) -> bool:
    normalized = " ".join(summary.lower().split())
    required_sections = (
        "investigation steps",
        "problems found",
        "other important info",
        "solution suggestions",
    )
    return all(section in normalized for section in required_sections)


def _is_low_quality_summary(summary: str) -> bool:
    normalized = " ".join(summary.lower().split())
    if not normalized:
        return True

    weak_markers = (
        "without a structured report",
        "manual triage",
        "no structured actions",
        "triage generated without concise summary",
        "insufficient structured",
        "insufficient evidence",
        "fallback triage:",
    )
    return any(marker in normalized for marker in weak_markers)


def _build_summary_fallback(report_json: dict[str, Any], service_name: str, base_summary: str = "") -> str:
    hypotheses = _extract_top_hypotheses(report_json)
    evidence = _extract_evidence_highlights(report_json)

    lines = [
        "## Investigation Steps",
        f"- Diagnosis markdown was not provided for **{service_name}**.",
        "- Built this summary from available hypotheses and evidence in the report payload.",
        "",
        "## Problems Found",
    ]

    if base_summary:
        lines.append(f"- {_truncate_line(base_summary)}")

    if hypotheses:
        lines.extend(hypotheses)

    if evidence:
        lines.append("")
        lines.append("## Other Important Info")
        lines.append("- Evidence highlights:")
        lines.extend(evidence)
    else:
        lines.append("")
        lines.append("## Other Important Info")
        lines.append("- No additional evidence highlights were available in this report.")

    lines.append("")
    lines.append("## Solution Suggestions")
    lines.append("- Use the execution plan below to validate or rule out these hypotheses.")

    return "\n".join(lines)


def _extract_top_hypotheses(report_json: dict[str, Any]) -> list[str]:
    items = report_json.get("root_cause_hypotheses", [])
    if not isinstance(items, list):
        return []

    output: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        hypothesis = str(item.get("hypothesis", "")).strip()
        if not hypothesis:
            continue

        confidence = _parse_confidence_percent(item.get("confidence"))
        if confidence is None:
            output.append(f"- {hypothesis}")
        else:
            output.append(f"- {hypothesis} ({confidence}% confidence)")

        if len(output) >= 2:
            break

    return output


def _extract_evidence_highlights(report_json: dict[str, Any]) -> list[str]:
    items = report_json.get("evidence", [])
    if not isinstance(items, list):
        return []

    output: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        snippet = str(item.get("snippet", "")).strip()
        if not snippet:
            continue
        output.append(f"- {_truncate_line(snippet)}")
        if len(output) >= 2:
            break

    return output


def _parse_confidence_percent(value: Any) -> int | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if numeric < 0:
        numeric = 0
    if numeric <= 1:
        numeric *= 100
    if numeric > 100:
        numeric = 100
    return int(round(numeric))


def _truncate_line(text: str, max_len: int = 180) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= max_len:
        return normalized
    return f"{normalized[: max_len - 3].rstrip()}..."
