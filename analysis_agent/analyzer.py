from __future__ import annotations

from datetime import datetime
import math
import re
from typing import Any

from pydantic import ValidationError

from analysis_agent.config import get_settings
from analysis_agent.fallback import build_fallback_report
from analysis_agent.gemini_client import GeminiClient, GeminiClientError
from analysis_agent.retriever import SelectiveCodeRetriever
from analysis_agent.schemas import (
    AnalysisJobCreate,
    AnalysisReport,
    CodeContextItem,
    EvidenceItem,
    Hypothesis,
    ModelInfo,
    SuggestedAction,
)


class Analyzer:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.retriever = SelectiveCodeRetriever()
        self.gemini = GeminiClient()

    async def analyze(self, payload: AnalysisJobCreate) -> AnalysisReport:
        normalized_payload, evidence = self._normalize_logs(payload)
        code_context = self.retriever.retrieve(normalized_payload)
        prompt = self._build_prompt(normalized_payload, evidence, code_context)

        try:
            model_output, model_meta = await self.gemini.generate_report(prompt)
            report = self._normalize_model_output(normalized_payload, evidence, code_context, model_output, model_meta)
            return report
        except (GeminiClientError, ValidationError, ValueError) as exc:
            return build_fallback_report(normalized_payload, evidence, code_context, reason=str(exc))

    def _normalize_logs(self, payload: AnalysisJobCreate) -> tuple[AnalysisJobCreate, list[EvidenceItem]]:
        trimmed = payload.model_copy(deep=True)
        trimmed.log_snippets = trimmed.log_snippets[: self.settings.max_log_snippets]

        evidence: list[EvidenceItem] = []
        for snippet in trimmed.log_snippets:
            line = snippet.line[: self.settings.max_log_line_chars]
            evidence.append(
                EvidenceItem(
                    type="log_snippet",
                    source=snippet.source,
                    snippet=line,
                    timestamp=snippet.timestamp,
                )
            )

        return trimmed, evidence

    def _build_prompt(
        self,
        payload: AnalysisJobCreate,
        evidence: list[EvidenceItem],
        code_context: list[CodeContextItem],
    ) -> str:
        return (
            "You are a production incident triage assistant. Return only JSON with keys: "
            "incident_id,status,summary_markdown,summary_text,fallback_reason. "
            "status must be completed.\n\n"
            "The `summary_markdown` value is required and must use EXACT section headers:\n"
            "## Investigation Steps\n"
            "## Problems Found\n"
            "## Other Important Info\n"
            "## Solution Suggestions\n\n"
            "Optional: you may include `root_cause_hypotheses` and `suggested_actions`, but they are not required.\n\n"
            f"Incident ID: {payload.incident_id}\n"
            f"Service: {payload.service_name}\n"
            f"Node: {payload.device_or_node}\n"
            f"Status: {payload.uptime_status.value}\n"
            f"Detected at: {payload.detected_at.isoformat()}\n"
            f"Description: {payload.uptime_description}\n"
            f"Evidence: {[item.model_dump(mode='json') for item in evidence]}\n"
            f"Code context: {[item.model_dump(mode='json') for item in code_context]}\n"
            "Every suggested command must include safety note and must be presented as manual-only text."
        )

    def _normalize_model_output(
        self,
        payload: AnalysisJobCreate,
        evidence: list[EvidenceItem],
        code_context: list[CodeContextItem],
        output: dict[str, Any],
        model_meta: dict[str, Any],
    ) -> AnalysisReport:
        if not isinstance(output, dict):
            raise ValueError("Gemini output must be a JSON object")

        summary_markdown = _normalize_summary_markdown(output, payload.service_name)
        hypotheses_data = output.get("root_cause_hypotheses", [])
        actions_data = output.get("suggested_actions", [])

        hypotheses: list[Hypothesis] = []
        for item in _to_sequence(hypotheses_data, limit=5):
            if isinstance(item, dict):
                hypothesis_text = str(
                    item.get("hypothesis") or item.get("summary") or item.get("title") or ""
                ).strip()
                confidence = _parse_confidence(item.get("confidence"), default=0.2)
                evidence_refs = _to_string_list(item.get("evidence_refs"), limit=8)
            else:
                hypothesis_text = str(item).strip()
                confidence = 0.2
                evidence_refs = ["model:plain_hypothesis"]

            if not hypothesis_text:
                continue
            hypotheses.append(
                Hypothesis(
                    hypothesis=hypothesis_text,
                    confidence=confidence,
                    evidence_refs=evidence_refs,
                )
            )
        if not hypotheses:
            for line in _extract_section_bullets(summary_markdown, "Problems Found", limit=2):
                hypotheses.append(
                    Hypothesis(
                        hypothesis=line,
                        confidence=0.2,
                        evidence_refs=["summary_markdown:problems_found"],
                    )
                )
        if not hypotheses:
            hypotheses = [
                Hypothesis(
                    hypothesis="Model returned insufficient structured findings.",
                    confidence=0.2,
                    evidence_refs=["model:empty_hypothesis"],
                )
            ]

        actions: list[SuggestedAction] = []
        for item in _to_sequence(actions_data, limit=5):
            if isinstance(item, dict):
                title = str(item.get("title", "")).strip() or "Investigation step"
                description = str(item.get("description", "")).strip()
                suggested_command = str(item.get("suggested_command", "")).strip()
                safety_note = str(item.get("safety_note", "")).strip()
            else:
                description = str(item).strip()
                if not description:
                    continue
                title = "Investigation step"
                suggested_command = description
                safety_note = ""

            normalized_command = suggested_command or description or title

            actions.append(
                SuggestedAction(
                    title=title,
                    description=description,
                    suggested_command=normalized_command,
                    safety_note=safety_note or "Suggestion only. Do not execute automatically.",
                )
            )
        if not actions:
            for line in _extract_section_bullets(summary_markdown, "Solution Suggestions", limit=5):
                actions.append(
                    SuggestedAction(
                        title="Suggested action",
                        description=line,
                        suggested_command=line,
                        safety_note="Suggestion only. Do not execute automatically.",
                    )
                )
        if not actions:
            actions = [
                SuggestedAction(
                    title="Manual incident review",
                    description="No structured solution suggestions were returned by model.",
                    suggested_command="Inspect logs and service health manually.",
                    safety_note="Suggestion only. Do not execute automatically.",
                )
            ]

        report = AnalysisReport(
            incident_id=payload.incident_id,
            status="completed",
            root_cause_hypotheses=hypotheses,
            evidence=evidence,
            code_context=code_context,
            suggested_actions=actions,
            summary_text=summary_markdown,
            model=ModelInfo(
                provider="google-gemini",
                model_name=str(model_meta.get("model_name", self.settings.gemini_model)),
                latency_ms=int(model_meta.get("latency_ms", 0)),
                token_usage=model_meta.get("token_usage", {})
                if isinstance(model_meta.get("token_usage", {}), dict)
                else {},
            ),
            fallback_reason=_normalize_optional_string(output.get("fallback_reason")),
        )
        return report


def confidence_from_report(report: AnalysisReport) -> float:
    return max((item.confidence for item in report.root_cause_hypotheses), default=0.0)


def utcnow() -> datetime:
    return datetime.utcnow()


def _to_sequence(value: Any, *, limit: int) -> list[Any]:
    if isinstance(value, list):
        return value[:limit]
    if value is None:
        return []
    return [value][:limit]


def _to_string_list(value: Any, *, limit: int) -> list[str]:
    values = _to_sequence(value, limit=limit)
    output: list[str] = []
    for item in values:
        text = str(item).strip()
        if text:
            output.append(text)
    return output


def _parse_confidence(value: Any, *, default: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default

    if not math.isfinite(numeric):
        return default
    if numeric < 0:
        return 0.0
    if numeric > 1 and numeric <= 100:
        numeric /= 100
    if numeric > 1:
        return 1.0
    return numeric


def _normalize_summary_markdown(output: dict[str, Any], service_name: str) -> str:
    candidates = (
        output.get("summary_markdown"),
        output.get("summary_text"),
        output.get("summary"),
    )
    for candidate in candidates:
        text = str(candidate).strip() if candidate is not None else ""
        if text and _has_required_sections(text):
            return text

    fallback_text = ""
    for candidate in candidates:
        text = str(candidate).strip() if candidate is not None else ""
        if text:
            fallback_text = text
            break
    if not fallback_text:
        fallback_text = f"No concise model summary was produced for {service_name}."

    return _build_structured_summary(fallback_text, service_name)


def _has_required_sections(markdown: str) -> bool:
    normalized = " ".join(markdown.lower().split())
    required_sections = (
        "investigation steps",
        "problems found",
        "other important info",
        "solution suggestions",
    )
    return all(section in normalized for section in required_sections)


def _build_structured_summary(base_text: str, service_name: str) -> str:
    line = " ".join(base_text.split()).strip()
    return "\n".join(
        [
            "## Investigation Steps",
            f"- Reviewed model output for `{service_name}` and normalized it into required markdown sections.",
            "",
            "## Problems Found",
            f"- {line}",
            "",
            "## Other Important Info",
            "- Original model response did not include all required markdown sections.",
            "",
            "## Solution Suggestions",
            "- Validate the suggested remediation steps against live telemetry before applying changes.",
        ]
    )


def _extract_section_bullets(markdown: str, section_name: str, *, limit: int) -> list[str]:
    pattern = rf"##\s*{re.escape(section_name)}\s*(.*?)(?=\n##\s|\Z)"
    match = re.search(pattern, markdown, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return []

    body = match.group(1)
    output: list[str] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        normalized = re.sub(r"^[-*]\s+", "", line)
        normalized = re.sub(r"^\d+\.\s+", "", normalized).strip()
        if not normalized:
            continue
        output.append(normalized)
        if len(output) >= limit:
            break
    return output


def _normalize_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
