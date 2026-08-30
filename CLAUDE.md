
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MIDAS — skin-cancer / dermoscopy analysis platform. A multi-agent RAG chat assistant (dermatology Q&A over an indexed knowledge base) plus CNN image analysis. Stack: Next.js 15 frontend (Clerk auth) → FastAPI backend → Supabase (Postgres + pgvector + Storage + Deno edge functions), NVIDIA-hosted LLM, Redis cache, Tavily web search.

## Commands

```bash
./start-services.sh     # backend :8000 + frontend :3000 (creates backend/venv, installs deps, sources .env files)
./verify-services.sh    # health checks
./stop-services.sh

# Backend manually — MUST run from backend/ (config.py loads .env files relative to CWD)
cd backend && source venv/bin/activate
python -m uvicorn app.main_agent:app --host 0.0.0.0 --port 8000 --reload

# Frontend (npm, not pnpm/yarn)
cd frontend
npm run dev / build / lint
npx tsc --noEmit        # no typecheck script exists; build does NOT run eslint (ignoreDuringBuilds: true)

# Docker: docker-compose.yml only (redis, backend :8000, frontend :3001, nginx :8080)
# "docker-compose 2.yml" and docker-compose.yml.backup are stale variants — ignore them
# scripts/{up,down,logs,rebuild}.sh are thin docker-compose wrappers

# Supabase edge functions
supabase functions deploy <name>   # functions live in supabase/functions/
```

**Tests**: there is no pytest suite or frontend test runner. Tests are standalone scripts; nearly all require the backend running on localhost:8000 plus live Supabase credentials.

- `tests/` — `test_bplus_indexing.py`, `test_react_cot.py`, `test_chat_persistence.py`, `test_complete_workflow.py`, … plus `.sh`/`.js` scripts.
- `backend/test_*.py` (7 files) — run from `backend/` with the venv active.
- ⚠️ `tests/test_bplus_indexing.py` is the only fully offline test, but it **was broken by the move into `tests/`**: it does `sys.path.insert(0, Path(__file__).parent / "backend")`, which now resolves to the nonexistent `tests/backend`. Run it as `PYTHONPATH=backend python tests/test_bplus_indexing.py` from the repo root.
- The `__tests__/` files under `frontend/src` have no runner installed and are excluded from tsconfig — don't try to run them.

**CI verifies nothing.** `.github/workflows/ci.yml` is a placeholder whose only step is `echo "CI passed"` (triggers: push to `ajit`, and PRs). Nothing builds, lints, or tests remotely — a green check means nothing. All verification is local (`npx tsc --noEmit`, `npm run lint`, `npm run build`). The only functional workflow is `daily-cleanup.yml` (cron → `session-cleanup` edge function).

Dev URLs: chat UI `http://localhost:3000/dashboard/assistant`, API docs `http://localhost:8000/docs`, health `http://localhost:8000/api/v1/health`. Backend log: `tail -f backend/backend_agent.log`.

## Architecture

### Live entry point — critical

The backend that actually runs is **`backend/app/main_agent.py`** (`app.main_agent:app`). Roughly half of `backend/app/` is a dead alternative pipeline that nothing starts — before editing any backend module, confirm it is reachable from `main_agent.py`.

**Dead** (verified by import-reachability trace from `app.main_agent`): `app/main.py`, `app/main_simple.py`, `app/api/routes.py`, `app/api/sessions.py`, `app/clara/orchestrator.py`, `app/db/`, `app/memory/`, `app/observability/`, `app/models/schemas.py`, `app/utils/guardrails.py`, `app/scripts/build_index*.py`; agents `planner_agent`, `evidence_grader`, `citation_verifier`, `guardrail_agent`, `query_guardrails_agent`, `memory_agent`, `graph`, `generator`, `grader`, `retriever`, `router`; services `hybrid_retriever`, `vector_store`, `supabase_sessions`, `web_scraper`. The `ENABLE_HYBRID_RETRIEVAL`/`ENABLE_PLANNER`/etc. flags in `app/config.py` have no effect on the live path.

⚠️ **The `app/api/sessions.py` trap**: it defines `APIRouter(prefix="/sessions")` and looks like it serves chat, but it is only included by `app/api/routes.py`, which only dead `app/main.py` includes. **The live chat endpoints are written inline in `main_agent.py`** — `GET`/`POST /api/v1/sessions/{session_id}/messages` (~`main_agent.py:263` / `:299`). Editing `app/api/sessions.py` changes nothing at runtime.

**Live but easy to mistake for dead**: `app/mcp/tools.py` + `app/mcp/policies.py` (tool registry + domain/safety policies, imported by `main_agent.py` and `rag_agent`), `app/services/report_generator.py`, `app/services/pdf_generator.py`, `app/utils/supabase_storage.py`, `app/models/cnn_architecture.py`.

Root `main.py`, `src/`, and `midas.ipynb` are the pre-RAG CNN-training era — also dead. The production CNN path is `backend/app/services/cnn_model_service.py` + `backend/models/midas_v1_final_best.pth`.

### Backend router wiring

`main_agent.py` mounts only three routers under `/api/v1` — `document_processing`, `reports` (`/reports`), `image_analysis` (`/image`) — and defines everything else inline: `GET`/`POST /api/v1/sessions/{id}/messages`, `POST /api/v1/documents/{id}/process`, `GET /api/v1/health`, `/healthz`, `/readyz`, `/`.

### Request flow (chat)

```
Browser
  → Next.js route handlers /api/conversations/* (BFF — src/lib/api/chat.ts calls same-origin only)
  → FastAPI POST ${BACKEND_URL}/api/v1/sessions/{id}/messages   (BACKEND_URL is server-only, default localhost:8000)
  → main_orchestrator.process_query (backend/app/main_orchestrator.py):
      chat history (services/chat_persistence) → follow-up resolver → hard domain guardrail
      (agents/dynamic_guardrails_classifier — blocks non-dermatology queries before routing)
      → router_agent → one of:
          react_cot_agent  (primary: think → retrieve → grade → iterate until confidence ≥ 0.75)
          rag_agent        (simpler fallback)
          web_scraping_agent (Tavily; triggered by URLs/link requests)
  → retrieval: services/supabase_vector_store (pgvector, all-MiniLM-L6-v2 384-dim), B+ tree chunk
    index (app/indexing/) on ingest, Redis caches (app/cache/)
  → NVIDIA LLM (services/nvidia_client; GROQ_* env vars are legacy aliases auto-mapped to NVIDIA_*)
  → response persisted to Supabase, rendered without streaming (plain JSON request/response)
```

The browser additionally calls Supabase edge functions directly (`query-preprocess` rate-limit/validation, `search-cache` 24h answer cache, `conversation-cache`) — each fails soft. If the Python backend is unreachable, the messages route handler returns a hardcoded `mode: "demo_fallback"` melanoma answer with HTTP 200 and persists it — this is intentional, not a bug.

### Request flow (image analysis, reports)

The other two backend-touching flows follow the same BFF shape — browser → Next.js route handler → `${BACKEND_URL}`:

```
Image analysis:  /dashboard/analysis → POST /api/analysis/analyze
                 → ${BACKEND_URL}/api/v1/image/analyze   (backend/app/api/image_analysis.py)
                 → services/cnn_model_service + models/midas_v1_final_best.pth
                 → medical_analyses table; history via /api/analysis/history, /api/analysis/[id]

Reports:         POST /api/reports/generate
                 → ${BACKEND_URL}/api/v1/reports/generate  (backend/app/api/reports.py)
                 → services/report_generator + services/pdf_generator
                 → generated_reports table; served via /api/reports/[id]/{download,preview}

Doc upload:      POST /api/upload-document
                 → ${BACKEND_URL}/api/v1/documents/{id}/process  (inline in main_agent.py)
                 → chunk + embed + B+ tree index
```

### Frontend (`frontend/src/`)

- **Auth is Clerk**, enforced in `frontend/src/middleware.ts` (`/dashboard(.*)` protected; signed-in users are also bounced off `/` and `/login`). Next.js loads the `src/` copy because a `src` dir exists — a duplicate at `frontend/middleware.ts` was silently dead and has been deleted. Supabase Auth is NOT used; only `src/lib/supabase/client.ts` exists (there is no `server.ts`).
- **`app/dashboard/layout.tsx` is a Server Component.** It resolves `auth()` and the Clerk role (`privateMetadata.role ?? publicMetadata.role ?? "patient"`) **once per request**, then hands the role down through `contexts/role-context.tsx` (`useRole()`). Pages must read the role with `useRole()` — do not reintroduce a client-side role fetch; the old `/api/user/role` endpoint has been deleted. Sidebar nav data lives in `data/dashboard/navigation.ts`. Role checks in the UI are display gating only; every role-restricted API route re-checks with `auth()` + `clerkClient`.
- Route handlers use a **service-role Supabase client, which bypasses RLS** — every handler must scope queries with `.eq("user_id", userId)` from Clerk `auth()`. Never skip this.
- Server state lives in React Query (keys `["conversations"]`, `["messages", sessionId, limit]`); `stores/chatStore.ts` (Zustand) holds persisted UI state only. Chat UI: `src/app/dashboard/assistant/page.tsx` composing `src/components/chat/*`.
- Almost every page is `"use client"`; root layout is `force-dynamic`.
- `package.json` `overrides` pins `@floating-ui/*` and pairs with a webpack alias in `next.config.ts` — change both or neither. `next.config.ts` also sets `output: "standalone"` (Docker/Railway builds depend on it), `images.unoptimized: true`, and `transpilePackages: ["framer-motion"]`.

### Supabase

`supabase/migrations/` is the **schema ground truth** (tables: `documents`, `embeddings`, `conversations`, `conversation_messages`, `chunk_index`, `medical_analyses`, `generated_reports`, caches; RPC `search_documents()` etc.). Prose docs disagree with each other on table names — trust migrations.

⚠️ `.gitignore` now contains a bare `supabase/` rule, so the directory is **partially tracked**: 12 files committed before the rule are still versioned (migrations 001, 002_add_missing_columns, 009–013, `20260125_bplus_tree_indexing`, plus three `config.toml`s and `conversation-cache/index.ts`), while everything added since is silently ignored — migrations 002_storage_policies and 003–008, and the `index.ts` of *every other* edge function. Consequence: `git add supabase/...` does nothing for new migrations or edge-function code unless forced with `-f`. Local `supabase/` is the real ground truth; the repo copy is incomplete.

Edge functions in `supabase/functions/`: `query-preprocess`, `search-cache`, `conversation-cache` (verifies Clerk JWT via JWKS), `process-document`, `analyze-image`, `generate-report`, `session-cleanup` (cron via `.github/workflows/daily-cleanup.yml`). Storage bucket: `Multiagent_Skincancer_RAG`.

### Environment

Backend reads `.env`/`.env.backend` (root and `backend/`, CWD-relative); key vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `NVIDIA_API_KEY`, `TAVILY_API_KEY`, `REDIS_URL`. Frontend: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, server-only `BACKEND_URL` + `SUPABASE_SERVICE_ROLE_KEY`. The root `.env*` files contain real secrets — never read, echo, or commit them.

## Repo gotchas

- **`.gitignore` ignores `*.md`** (with a `!CLAUDE.md` negation, so this file is trackable). The ~65 markdown files in `docs/` are untracked historical working notes (fix logs, superseded plans, ~13 overlapping Docker guides), recently moved there from the repo root. Do not treat them as spec; when docs and code disagree, code and `supabase/migrations/` win. Only three docs are tracked — `README.md`, `docs/WALKTHROUGH.md`, `frontend/README.md` — and the first two describe the obsolete CNN-only system.
- **Duplicate-file hazard**: many `<name> 2.tsx` / `<name> 3.py` shadow copies exist throughout (`providers 2.tsx`, `use-mobile 2.ts`, `src/lib/utils 2.ts`, `app/scripts/build_index {2,3}.py`, `package-lock 2.json`, …), plus `frontend/src/components/hooks/` and `components/lib/` duplicating `src/hooks/` and `src/lib/`, and variants like `dashboard/assistant/page-new.tsx`, `dashboard/analysis/page_old.tsx`, `api/reports/generate/route-edge-function.ts`. Always edit the canonical unsuffixed file (`route.ts`, `page.tsx`, …).
- Committed junk to leave alone unless asked: `backend/venv/`, `backend/midas/`, `Midas_enmv/`, root `node_modules/`, `*.log` files.
- `.specify/` is Spec Kit scaffolding (the `speckit-*` commands). `.specify/memory/constitution.md` is now **ratified at v1.0.0** (2026-08-06) with six binding principles — live-path evidence, medical honesty, service-role authorization, contract consistency, surgical brownfield change, verification before completion. Cite it as policy. Note the bare `.specify/` rule in `.gitignore` means new files there need `git add -f`.
- **Roboflow MCP is dev-time only.** A local Claude Code connector (`https://mcp.roboflow.com/mcp`, OAuth), registered in `~/.claude.json` under this project — not part of any runtime path, and nothing in the repo depends on it. Never call `images_prepare_upload`, `images_prepare_upload_zip`, `annotations_save`, `autolabel_start`, or `models_train` with anything from the `AI_image_storage` bucket or the `medical_analyses` table: those are user-submitted images and Roboflow's terms §21 prohibit uploading PHI without an enterprise BAA. Public research data only (HAM10000 / ISIC archive, which `midas_v1_final_best.pth` was already trained on). Do not add a Roboflow client to `backend/app/mcp/` — despite the name, that package is an unrelated in-process registry whose tools all have `handler=None`, and the live image path (`api/image_analysis.py` → `services/cnn_model_service.py`) never touches it.

<!-- SPECKIT START -->
Active feature: **003-admin-control-room** (branch `003-admin-control-room`, current branch).
`specs/003-admin-control-room/spec.md` (clarified + CEO-scope-reviewed, HOLD SCOPE) plus
`specs/003-admin-control-room/plan.md` (Phase 0/1 complete: `research.md`, `data-model.md`,
`contracts/admin-control-room-contract.md`, `quickstart.md`) now exist; `tasks.md` does not —
`/speckit.tasks` hasn't run. The spec transcribes `docs/admin-control-room-prd.md` (v1.5, untracked) as
its sole behavioral source of truth; don't re-derive requirements, cite FR-* IDs from the PRD. The plan
adds a new FastAPI router (`backend/app/api/admin.py`, mounted like the three existing ones) and a new
migration (`016_admin_control_room.sql`) — see `plan.md`'s Complexity Tracking for the one deliberate
deviation from feature 002's own precedent (that feature stayed BFF-only; this one doesn't, and says
why).

Feature 002 (three-view-clinical-pipeline) **is implemented**, not just planned — see commits
`9df42fd`/`0f170ff` (migration 015, clinical review queue, claim/sign APIs). Its spec dir was
relocated off the standard path to `.specify/specs/002-three-view-clinical-pipeline/`, alongside
`.specify/specs/001-report-generation-integrity/` (still in flight). Root `specs/` now holds only
003. Since every `*.md` under `specs/`/`.specify/` is gitignored (only this file is negated), none of
these spec/plan/task files are tracked by git — `git log` on them shows nothing; the working tree is
the only record, and manual moves like the 002 relocation leave no history to explain them.

`.specify/feature.json` points at 003. Prefix resolution searches root `specs/` only, so running a
Spec Kit command against 001 or 002 requires
`SPECIFY_FEATURE_DIRECTORY=.specify/specs/<feature-dir>`.

Project governance is `.specify/memory/constitution.md` (v1.0.0, ratified 2026-08-06).
<!-- SPECKIT END -->
