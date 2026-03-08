from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from analysis_agent.analyzer import Analyzer
from analysis_agent.schemas import AnalysisJobCreate, UptimeStatus


def _payload() -> AnalysisJobCreate:
    return AnalysisJobCreate(
        incident_id="inc-md-format",
        service_name="api-service",
        device_or_node="api-node-1",
        uptime_status=UptimeStatus.down,
        uptime_description="connection refused",
        detected_at=datetime.now(timezone.utc),
    )


def _analyzer() -> Analyzer:
    analyzer = Analyzer.__new__(Analyzer)
    analyzer.settings = SimpleNamespace(gemini_model="gemini-2.5-flash")
    return analyzer


def test_normalize_model_output_accepts_markdown_first_shape() -> None:
    analyzer = _analyzer()
    payload = _payload()
    output = {
        "summary_markdown": (
            "## Investigation Steps\n"
            "- Reviewed API logs and monitor event timeline.\n\n"
            "## Problems Found\n"
            "- Upstream service is refusing TCP connections.\n\n"
            "## Other Important Info\n"
            "- Failure is isolated to api-node-1.\n\n"
            "## Solution Suggestions\n"
            "- Restart the upstream dependency after validating port binding."
        )
    }

    report = analyzer._normalize_model_output(payload, [], [], output, {"model_name": "gemini-2.5-flash"})

    assert "## Investigation Steps" in report.summary_text
    assert "## Solution Suggestions" in report.summary_text
    assert report.root_cause_hypotheses[0].hypothesis == "Upstream service is refusing TCP connections."
    assert report.suggested_actions[0].description == "Restart the upstream dependency after validating port binding."


def test_normalize_model_output_builds_structured_markdown_when_missing() -> None:
    analyzer = _analyzer()
    payload = _payload()
    output = {"summary_text": "API checks are failing with connection refused."}

    report = analyzer._normalize_model_output(payload, [], [], output, {})

    assert "## Investigation Steps" in report.summary_text
    assert "## Problems Found" in report.summary_text
    assert "## Other Important Info" in report.summary_text
    assert "## Solution Suggestions" in report.summary_text


def test_normalize_model_output_handles_string_hypotheses_and_actions() -> None:
    analyzer = _analyzer()
    payload = _payload()
    output = {
        "summary_markdown": (
            "## Investigation Steps\n- Checked service health.\n\n"
            "## Problems Found\n- Connection refused from upstream dependency.\n\n"
            "## Other Important Info\n- Reproduced from monitor payload.\n\n"
            "## Solution Suggestions\n- Restart upstream service after verification."
        ),
        "root_cause_hypotheses": [
            "Connection refused from upstream dependency",
            "Possible dependency process crash",
        ],
        "suggested_actions": [
            "Restart upstream service after verification",
        ],
    }

    report = analyzer._normalize_model_output(payload, [], [], output, {})

    assert report.root_cause_hypotheses[0].hypothesis == "Connection refused from upstream dependency"
    assert report.suggested_actions[0].description == "Restart upstream service after verification"
