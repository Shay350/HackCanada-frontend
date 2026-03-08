# HackCanada

Self-healing network/service dashboard with a React frontend and a FastAPI analysis backend.

## Repo structure

- `src/`: frontend dashboard (Vite + React + TypeScript)
- `analysis_agent/`: backend incident analysis service (FastAPI + Postgres + Gemini)
- `extension/`: built extension assets

## Frontend (Vite)

```bash
npm install
npm run dev
```

Frontend expects backend API at `/api/*`.
In local dev, Vite proxies `/api` to `http://127.0.0.1:8000`.

## Backend (analysis agent)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
uvicorn analysis_agent.main:app --reload
```

### Core API endpoints

- `POST /api/v1/analysis/jobs`
- `GET /api/v1/analysis/incidents`
- `GET /api/v1/analysis/jobs/{job_id}`
- `GET /api/v1/analysis/jobs/{job_id}/result`
- `GET /api/v1/analysis/jobs/{job_id}/summary`
- `GET /api/v1/analysis/jobs/{job_id}/download`

### Intake JSON format (Uptime Kuma style)

```json
{
  "monitor": "test-service",
  "status": "DOWN",
  "msg": "connection refused",
  "url": "https://example.com",
  "time": "2026-03-07T12:00:00Z"
}
```

Supported statuses for triage: `DOWN/down`, `DEGRADED/degraded`.

Optional teammate-provided extracted logs around the timestamp:

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

## Safety constraints

- No command execution path is implemented in backend.
- Suggested commands are text-only guidance.
- Code retrieval is read-only and constrained to allowlisted roots.
