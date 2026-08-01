# MIDAS

## Multi-Modal Intelligent Dermoscopy Analysis System

An AI-powered skin cancer analysis platform combining a multi-agent RAG chat assistant for dermatology Q&A with CNN-based lesion image analysis.

## Overview

MIDAS gives patients and clinicians two ways to get dermatology insight:

- **Chat assistant** — ask dermatology questions and get answers grounded in an indexed knowledge base, with web search fallback for out-of-index queries.
- **Image analysis** — upload a lesion photo and get a CNN classification, risk assessment, and a generated PDF report.

Access is role-based (`patient`, `clinician`, `admin`), enforced server-side on every route.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), Clerk for auth, TanStack Query, Zustand
- **Backend**: FastAPI (Python 3.11)
- **Data**: Supabase — Postgres + pgvector, Storage, Deno edge functions
- **AI**: NVIDIA-hosted LLM for chat, Tavily for web search, a PyTorch CNN for lesion classification
- **Embeddings**: `all-MiniLM-L6-v2` (384-dim), with a B+ tree chunk index for retrieval

Redis is present in config and Docker but not currently wired up — nothing connects to it yet.

## Architecture

```
Browser (Next.js + Clerk)
   │
   ▼
Next.js route handlers  (BFF — same-origin API, server-only backend URL)
   │
   ▼
FastAPI backend  (backend/app/main_agent.py)
   │
   ├─▶ Supabase (Postgres + pgvector + Storage)
   ├─▶ NVIDIA-hosted LLM
   └─▶ Tavily web search
```

Chat, image analysis, and report generation each follow this same browser → Next.js → FastAPI → Supabase shape.

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11
- A Supabase project (Postgres + Storage configured)

### Start everything

```bash
./start-services.sh     # backend on :8000, frontend on :3000
./verify-services.sh    # health checks
./stop-services.sh
```

This creates the backend virtualenv, installs dependencies, and sources the `.env` files automatically.

### Or run manually

```bash
# Backend — must run from backend/ (config loads .env relative to CWD)
cd backend
source venv/bin/activate
python -m uvicorn app.main_agent:app --host 0.0.0.0 --port 8000 --reload

# Frontend (npm, not pnpm/yarn)
cd frontend
npm run dev
```

- Chat UI: `http://localhost:3000/dashboard/assistant`
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/healthz`

## Project Structure

```
MIDAS_final_work/
├── frontend/          # Next.js 15 app (App Router, Clerk auth)
│   └── src/
├── backend/           # FastAPI app
│   ├── app/           # live entry point: app/main_agent.py
│   └── models/        # trained CNN weights
├── supabase/          # migrations + edge functions
├── docs/              # architecture and reference docs
├── tests/             # standalone test scripts
└── scripts/           # docker-compose wrapper scripts
```

## Environment

The backend reads `.env` / `.env.backend` (repo root and `backend/`); the frontend reads the root `.env` plus `frontend/.env.local`. Required variables include Supabase credentials, Clerk keys, and API keys for the LLM and web search providers — see the example env files for the full list.

**Never commit real secrets.** The tracked `.env*.example` files show the expected shape only.

## Testing

There's no pytest suite or frontend test runner — tests are standalone scripts that mostly require the backend running locally plus live Supabase credentials:

- `tests/` — integration scripts (`test_bplus_indexing.py`, `test_react_cot.py`, `test_chat_persistence.py`, …)
- `backend/test_*.py` — run from `backend/` with the venv active

The CI workflow (`.github/workflows/ci.yml`) is currently a placeholder and does not build, lint, or test anything — treat a green check as informational only. Local verification (`npx tsc --noEmit`, `npm run lint`, `npm run build`, manual test scripts) is what actually validates changes.

## Docker

```bash
docker-compose up   # redis, backend (:8000), frontend (:3001), nginx (:8080)
```

`scripts/{up,down,logs,rebuild}.sh` are thin wrappers around the same compose file.

## Deployment

Railway configs are included for both services (`backend/railway.toml`, `frontend/railway.toml`), and a root `render.yaml` supports deploying to Render.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- HAM10000 and PAD-UFES-20 datasets, used to train the lesion classification model
