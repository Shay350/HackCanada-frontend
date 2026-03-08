from __future__ import annotations

from datetime import datetime
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
            "incident_id,status,root_cause_hypotheses,evidence,code_context,suggested_actions,summary_text,fallback_reason. "
            "status must be completed.\n\n"
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
        hypotheses_data = output.get("root_cause_hypotheses", [])
        actions_data = output.get("suggested_actions", [])

        hypotheses: list[Hypothesis] = []
        for item in hypotheses_data[:5]:
            hypotheses.append(
                Hypothesis(
                    hypothesis=str(item.get("hypothesis", "Unknown hypothesis")),
                    confidence=float(item.get("confidence", 0.2)),
                    evidence_refs=[str(ref) for ref in item.get("evidence_refs", [])],
                )
            )
        if not hypotheses:
            hypotheses = [
                Hypothesis(
                    hypothesis="Model returned insufficient structured hypotheses.",
                    confidence=0.2,
                    evidence_refs=["model:empty_hypothesis"],
                )
            ]

        actions: list[SuggestedAction] = []
        for item in actions_data[:5]:
            actions.append(
                SuggestedAction(
                    title=str(item.get("title", "Investigation step")),
                    description=str(item.get("description", "")),
                    suggested_command=str(item.get("suggested_command", "# manual investigation command")),
                    safety_note=str(item.get("safety_note", "Suggestion only. Do not execute automatically.")),
                )
            )
        if not actions:
            actions = [
                SuggestedAction(
                    title="Manual incident review",
                    description="No structured actions returned by model.",
                    suggested_command="# inspect logs and service health manually",
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
            summary_text=str(output.get("summary_text", "Triage generated without concise summary.")),
            model=ModelInfo(
                provider="google-gemini",
                model_name=str(model_meta.get("model_name", self.settings.gemini_model)),
                latency_ms=int(model_meta.get("latency_ms", 0)),
                token_usage=model_meta.get("token_usage", {}),
            ),
            fallback_reason=output.get("fallback_reason"),
        )
        return report


def confidence_from_report(report: AnalysisReport) -> float:
    return max((item.confidence for item in report.root_cause_hypotheses), default=0.0)


def utcnow() -> datetime:
    return datetime.utcnow()
