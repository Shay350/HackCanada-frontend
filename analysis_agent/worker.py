from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from analysis_agent.analyzer import Analyzer, confidence_from_report
from analysis_agent.models import AnalysisJob, AnalysisReport, JobStatus, ReportStatus
from analysis_agent.schemas import AnalysisJobCreate

logger = logging.getLogger(__name__)


class AnalysisWorker:
    def __init__(self, session_maker: async_sessionmaker, poll_interval_sec: float = 1.5) -> None:
        self._session_maker = session_maker
        self._poll_interval_sec = poll_interval_sec
        self._stop_event = asyncio.Event()
        self._analyzer = Analyzer()

    async def run(self) -> None:
        while not self._stop_event.is_set():
            job_id = await self._claim_next_job()
            if job_id is None:
                await asyncio.sleep(self._poll_interval_sec)
                continue

            try:
                await self._process_job(job_id)
            except Exception:  # noqa: BLE001
                logger.exception("Unhandled error while processing job %s", job_id)

    async def stop(self) -> None:
        self._stop_event.set()

    async def _claim_next_job(self) -> UUID | None:
        async with self._session_maker() as session:
            async with session.begin():
                stmt = (
                    select(AnalysisJob)
                    .where(AnalysisJob.status == JobStatus.queued)
                    .order_by(AnalysisJob.created_at)
                    .with_for_update(skip_locked=True)
                    .limit(1)
                )
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()
                if job is None:
                    return None

                job.status = JobStatus.running
                job.progress = 10
                job.started_at = datetime.now(tz=timezone.utc)
                return job.id

    async def _process_job(self, job_id: UUID) -> None:
        async with self._session_maker() as session:
            result = await session.execute(select(AnalysisJob).where(AnalysisJob.id == job_id))
            job = result.scalar_one_or_none()
            if job is None:
                return

            try:
                payload = AnalysisJobCreate.model_validate(job.request_payload)
                report = await self._analyzer.analyze(payload)

                existing_report_result = await session.execute(select(AnalysisReport).where(AnalysisReport.job_id == job.id))
                db_report = existing_report_result.scalar_one_or_none()
                if db_report is None:
                    db_report = AnalysisReport(
                        job_id=job.id,
                        incident_id=payload.incident_id,
                        report_status=ReportStatus(report.status),
                        confidence=confidence_from_report(report),
                        summary_text=report.summary_text,
                        fallback_reason=report.fallback_reason,
                        model_info=report.model.model_dump(mode="json"),
                        report_json=report.model_dump(mode="json"),
                    )
                    session.add(db_report)
                else:
                    db_report.report_status = ReportStatus(report.status)
                    db_report.confidence = confidence_from_report(report)
                    db_report.summary_text = report.summary_text
                    db_report.fallback_reason = report.fallback_reason
                    db_report.model_info = report.model.model_dump(mode="json")
                    db_report.report_json = report.model_dump(mode="json")

                job.status = JobStatus.completed
                job.progress = 100
                job.error = None
                job.finished_at = datetime.now(tz=timezone.utc)
            except Exception as exc:  # noqa: BLE001
                job.status = JobStatus.failed
                job.progress = 100
                job.error = str(exc)
                job.finished_at = datetime.now(tz=timezone.utc)
                logger.exception("Job %s failed", job_id)

            await session.commit()
