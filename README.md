# HackCanada - Analysis Agent

Read-only incident analysis backend for hackathon triage.

## What it does

- Accepts incident context (`down`/`degraded`) from teammate pipeline.
- Queues async analysis jobs in Postgres.
- Retrieves relevant code snippets from allowlisted directories.
- Calls Gemini to produce structured report JSON.
- Falls back to deterministic rule-based report on Gemini errors/timeouts.
- Exposes polling, summary, and JSON download endpoints.

## Endpoints

- `POST /api/v1/analysis/jobs`
- `GET /api/v1/analysis/jobs/{job_id}`
- `GET /api/v1/analysis/jobs/{job_id}/result`
- `GET /api/v1/analysis/jobs/{job_id}/summary`
- `GET /api/v1/analysis/jobs/{job_id}/download`

## Local run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
uvicorn analysis_agent.main:app --reload
```

## Expected intake JSON (Uptime Kuma style)

The jobs endpoint expects this core shape:

```json
{
  "monitor": "test-service",
  "status": "DOWN",
  "msg": "connection refused",
  "url": "https://example.com",
  "time": "2026-03-07T12:00:00Z"
}
```

`status` supports `DOWN/down` and `DEGRADED/degraded`.

You can optionally include teammate-provided extracted log snippets around the timestamp:

```json
{
  "monitor": "test-service",
  "status": "DOWN",
  "msg": "connection refused",
  "url": "https://example.com",
  "time": "2026-03-07T12:00:00Z",
  "log_snippets": [
    {
      "timestamp": "2026-03-07T11:59:50Z",
      "source": "service.log",
      "line": "dial tcp 10.0.0.12:443: connect: connection refused"
    }
  ],
  "metadata": {
    "device_or_node": "mac-mini-1"
  }
}
```

## Example request

```bash
curl -X POST http://127.0.0.1:8000/api/v1/analysis/jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "monitor": "bluebubbles",
    "status": "DOWN",
    "msg": "Health check endpoint timed out",
    "url": "https://example.com/health",
    "time": "2026-03-07T01:30:00Z",
    "log_snippets": [
      {"timestamp": "2026-03-07T01:29:50Z", "source": "bluebubbles.log", "line": "connection refused to upstream"}
    ],
    "metadata": {"team": "ops", "device_or_node": "mac-mini-1"}
  }'
```

## Notes

- No command execution path is implemented.
- Suggested commands are text-only output.
- Read-only code retrieval is constrained to `ALLOWED_READ_ROOTS`.
