# HackCanada Frontend

React + Vite frontend for the HackCanada self-healing dashboard.

## Requirements

- Node.js 20+
- npm 10+

## Environment

Copy `.env.example` to `.env` and set the backend URL for non-proxied environments:

```bash
cp .env.example .env
```

`VITE_API_BASE_URL` should point to the backend service base URL, for example:

- Local backend: `http://127.0.0.1:8000`
- Production backend: `https://<your-backend-domain>`

## Local development

```bash
npm install
npm run dev
```

In local development, requests to `/api/*` are proxied to `http://127.0.0.1:8000` by Vite unless `VITE_API_BASE_URL` is explicitly set.

## Build

```bash
npm run build
```

## Contract with backend

Frontend reads incidents from:

- `GET /api/v1/analysis/incidents`

The API base is resolved in this order:

1. `apiBase` query parameter
2. `VITE_API_BASE_URL`
3. Relative `/api/*` path (via local proxy)
