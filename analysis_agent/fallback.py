from __future__ import annotations

from datetime import datetime

from analysis_agent.schemas import AnalysisJobCreate, AnalysisReport, CodeContextItem, EvidenceItem, Hypothesis, ModelInfo, SuggestedAction


def _heuristic_hypotheses(payload: AnalysisJobCreate) -> list[Hypothesis]:
    text = " ".join([payload.uptime_description] + [item.line for item in payload.log_snippets]).lower()
    rules: list[tuple[str, str, float]] = [
        ("timeout", "Service likely timing out upstream/downstream.", 0.35),
        ("connection refused", "Service endpoint reachable but process likely not listening.", 0.42),
        ("dns", "DNS resolution issue likely affecting service lookup.", 0.3),
        ("permission", "Permission or credential issue likely blocking access.", 0.28),
        ("out of memory", "Resource pressure likely destabilizing the service.", 0.31),
    ]

    output: list[Hypothesis] = []
    for keyword, message, score in rules:
        if keyword in text:
            output.append(Hypothesis(hypothesis=message, confidence=score, evidence_refs=[f"keyword:{keyword}"]))

    if not output:
        output.append(
            Hypothesis(
                hypothesis="Insufficient evidence for high-confidence diagnosis; investigate recent deploy/config/network changes.",
                confidence=0.2,
                evidence_refs=["fallback:generic"],
            )
        )

    return output


def _build_summary_markdown(payload: AnalysisJobCreate, hypotheses: list[Hypothesis], evidence: list[EvidenceItem]) -> str:
    lines = [
        "## Investigation Steps",
        f"- Automated model diagnosis is unavailable for **{payload.service_name}** in this run.",
        "- Built this report from deterministic fallback heuristics and available evidence.",
        "",
        "## Problems Found",
    ]

    for item in hypotheses[:2]:
        confidence = int(round(max(0.0, min(1.0, item.confidence)) * 100))
        lines.append(f"- {item.hypothesis} ({confidence}% confidence)")

    highlights = [entry.snippet.strip() for entry in evidence if entry.snippet.strip()][:2]
    if highlights:
        lines.append("")
        lines.append("## Other Important Info")
        lines.append("- Evidence highlights from monitor/log payload:")
        lines.extend(f"- {line}" for line in highlights)
    else:
        lines.append("")
        lines.append("## Other Important Info")
        lines.append("- No additional log highlights were available in the request payload.")

    lines.append("")
    lines.append("## Solution Suggestions")
    lines.append("- Use the execution plan below to validate or rule out these hypotheses.")
    return "\n".join(lines)


def build_fallback_report(
    payload: AnalysisJobCreate,
    evidence: list[EvidenceItem],
    code_context: list[CodeContextItem],
    reason: str,
) -> AnalysisReport:
    hypotheses = _heuristic_hypotheses(payload)

    suggestions = [
        SuggestedAction(
            title="Collect service health snapshot",
            description="Capture status and recent logs around incident time.",
            suggested_command=f"# run manually\ncheck_service_health --service {payload.service_name}",
            safety_note="Suggestion only. Do not execute automatically.",
        ),
        SuggestedAction(
            title="Verify network dependencies",
            description="Confirm DNS/connectivity for required upstream endpoints.",
            suggested_command=f"# run manually\nnetwork_probe --node {payload.device_or_node} --service {payload.service_name}",
            safety_note="Suggestion only. Do not execute automatically.",
        ),
    ]

    summary = _build_summary_markdown(payload, hypotheses, evidence)

    return AnalysisReport(
        incident_id=payload.incident_id,
        status="fallback",
        root_cause_hypotheses=hypotheses,
        evidence=evidence,
        code_context=code_context,
        suggested_actions=suggestions,
        summary_text=summary,
        model=ModelInfo(
            provider="deterministic-fallback",
            model_name="rule-engine-v1",
            latency_ms=0,
            token_usage={"input": 0, "output": 0},
        ),
        fallback_reason=reason,
    )
