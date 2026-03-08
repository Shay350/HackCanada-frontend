from __future__ import annotations

from analysis_agent.main import _extract_solution_steps, _normalize_step_from_action


def test_extract_solution_steps_removes_manual_prefix_and_safety_note() -> None:
    summary = (
        "## Investigation Steps\n- Checked logs.\n\n"
        "## Problems Found\n- Service unavailable.\n\n"
        "## Other Important Info\n- Possible OOM.\n\n"
        "## Solution Suggestions\n"
        "- **Investigate Memory Usage:**\n"
        "- **Manual-only text:** Connect to `example.com` via SSH.\n"
        "- **Manual-only text:** Check current and historical memory usage.\n"
        "- **Safety Note:** Be cautious when running diagnostic commands.\n"
    )

    steps = _extract_solution_steps(summary)

    assert steps == [
        "Investigate Memory Usage",
        "Connect to `example.com` via SSH.",
        "Check current and historical memory usage.",
    ]


def test_normalize_step_from_action_uses_description_when_command_is_placeholder() -> None:
    item = {
        "title": "**Investigate Memory Usage:**",
        "description": "**Manual-only text:** Check memory with `free -h` and `top`.",
        "suggested_command": "# manual investigation command",
    }

    step = _normalize_step_from_action(item)

    assert step == "Check memory with `free -h` and `top`."
