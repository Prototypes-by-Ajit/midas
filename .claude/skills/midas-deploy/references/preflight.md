# Preflight failures, environment variables, and Supabase

Read this when a `preflight.sh` check failed and you need the cause and fix, when you need the
full environment-variable matrix, or when you are deploying Supabase migrations and edge
functions — which every target needs and no target automates.

## Contents

- [The eleven checks](#the-eleven-checks)
- [Environment variables](#environment-variables)
- [Supabase: migrations and edge functions](#supabase-migrations-and-edge-functions)

---

## The eleven checks

### 1. `backend/midas/` ships in every image — BLOCK, all targets

`backend/midas/` is a **921 MB virtualenv**. `backend/.dockerignore` excludes `.venv/`, `venv/`, and
`env/` — but not `midas/`. The build context is `./backend` and `backend/Dockerfile:66` does
`COPY --chown=midas:midas . .`, so the whole thing lands in the runtime image.

Fix: add one line to `backend/.dockerignore`.

```
midas/
```

**When this actually bites.** `backend/midas/` is untracked, so the blast radius depends on where
the build runs:

| Build | Affected? |
|---|---|
| `docker build` / `docker-compose build` from this working tree | **yes** — ~1 GB added |
| `railway up` (uploads the local directory) | **yes** |
| GitHub-connected Railway/Render, or CI after `actions/checkout` | no — a fresh clone has no `midas/` |

So a CI-built image is fine today while the identical local command produces a 1 GB heavier one.
That divergence is its own problem: you cannot reproduce the CI image locally. Add the line
regardless — it costs nothing and removes a trap that fires the first time someone builds by hand.

### 2. `/readyz` deadlock — BLOCK on k8s, warn elsewhere

Covered in `SKILL.md`; the short version is that `lifespan` never calls
`supabase_vector_store.initialize()`, `/readyz` gates on `is_initialized`, and in Kubernetes that is
a closed loop. The two fixes are in `kubernetes.md`.

### 3. `render.yaml` → `Dockerfile.backend` does not exist — BLOCK on render

`render.yaml` sets `dockerfilePath: Dockerfile.backend`. No such file exists anywhere in the repo,
so the backend service fails at build. See `paas.md`.

### 4. `frontend/railway.toml` startCommand — BLOCK on railway

```toml
startCommand = "node .next/standalone/server.js"     # wrong
```

`frontend/Dockerfile:67` copies the standalone output **to the image root**, so the entry point is
`/app/server.js`. The container exits immediately. Fix: `node server.js`, or delete the line and let
the Dockerfile's own `CMD ["node", "server.js"]` run.

### 5. Kustomize placeholders — BLOCK on k8s

`OWNER` in `k8s/base/kustomization.yaml`, `midas.example.com` in `k8s/base/ingress.yaml` (twice —
`tls.hosts` and `rules.host`). See `kubernetes.md`.

### 6. Edge functions cannot reach a ClusterIP backend — BLOCK on k8s

`supabase/functions/process-document/index.ts` fetches `BACKEND_URL` from Supabase's network, but
`k8s/base/ingress.yaml` routes only `midas-frontend` and `k8s/base/backend.yaml:161-186` adds a
NetworkPolicy allowing ingress only from frontend pods and the `monitoring` namespace.

Chat, image analysis, and report generation all go through the Next.js BFF and are fine. **Document
upload is the exception** — `frontend/src/app/api/documents/upload/route.ts:130-141` calls the edge
function, which then needs to reach the backend from outside the cluster. Ingestion breaks in the
k8s topology as committed. Options in `kubernetes.md`.

### 7. Required env vars — BLOCK

See the matrix below. The script checks presence only and never prints a value.

### 8. Health-probe paths disagree — warn

Five layers, three different paths:

| Layer | Path | Cost |
|---|---|---|
| `docker-compose.yml` healthcheck | `/readyz` | cheap; gates on Supabase init flag |
| `backend/Dockerfile` HEALTHCHECK | `/readyz` | same |
| `backend/railway.toml` | `/api/v1/health` | **two `count="exact"` Supabase queries per probe** |
| `render.yaml` | `/api/v1/health` | same |
| `k8s/base/backend.yaml` | `/healthz` live, `/readyz` ready | correct split |

`/healthz` returns `{"status":"ok"}` with no dependencies (`main_agent.py:268-271`) — use it for
liveness. `/readyz` is the right readiness probe *once check 2 is fixed*. `/api/v1/health` is a
human-facing diagnostic, not a probe: `get_document_stats()` runs two exact counts plus a lesion
class scan (`services/supabase_vector_store.py:352-384`).

### 9. `SUPABASE_SERVICE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY` — warn

Both are required on the frontend. Different route handlers read one or the other with **no
cross-fallback**, so setting only one produces runtime 500s on whichever handlers read the other.
Set both to the same value.

### 10. `BACKEND_API_KEY` default — warn

The literal `test-key` is committed as the default. Change it for anything reachable from outside
your laptop.

### 11. Frontend port and dead compose files — warn

`docker-compose.yml` publishes the frontend on **3001**, while `start-services.sh` and
`docker-start.sh` both print and poll **3000**. nginx on **8080** is the real entrypoint for the
composed stack. Details in `compose.md`.

---

## Environment variables

### The build-time / runtime split

This is the one that causes confusion. All five `NEXT_PUBLIC_*` values are compiled into the client
bundle by `frontend/Dockerfile:24-43`, passed as `ARG`. They are **not** runtime config.

**One frontend image per environment.** Pointing a staging image at production URLs is a rebuild,
not an env var change. Setting a `NEXT_PUBLIC_*` at runtime has no effect on already-built client
code, which is a very quiet way to lose an afternoon.

### Backend (`.env.backend`, or the provider's secret store)

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Railway historically needed a trailing slash — see `fix-railway-runtime.sh` |
| `SUPABASE_SERVICE_KEY` | yes | |
| `NVIDIA_API_KEY` | yes | **Not** `GROQ_API_KEY` — see the footgun below |
| `BACKEND_API_KEY` | production | defaults to the committed literal `test-key` |
| `CORS_ORIGINS` | production | comma-separated; must include the real frontend origin |
| `SUPABASE_ANON_KEY` | no | |
| `TAVILY_API_KEY` | no | web-scraping agent degrades without it |
| `PORT`, `WORKERS` | no | `WORKERS` must stay 1 — see constraint 3 in `SKILL.md` |
| `REDIS_URL` | no | **inert**: `main_agent` never calls `init_cache()`, so the cache layer does nothing under the live entrypoint |

**The GROQ footgun.** `config.py:210-221` mirrors NVIDIA settings into legacy `groq_*` fields —
**one way only**, NVIDIA → GROQ. Every agent reads `settings.nvidia_api_key`
(`agents/rag_agent.py:30`, `react_cot_agent.py:42`, `web_scraping_agent.py:28`). But the startup
banner (`main_agent.py:118`) and `/api/v1/health` (`:254`) read `settings.groq_api_key`.

Set only `GROQ_API_KEY` and you get a backend that logs `✅ Configured`, reports healthy, and cannot
generate a single token. `render.yaml` is wired exactly this way today.

### Frontend

**Build-time** (`ARG` → baked into the bundle): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_BACKEND_URL`.

**Runtime** (server-only, never sent to the browser): `BACKEND_URL` (in-cluster or in-network
address of FastAPI), `CLERK_SECRET_KEY`, `SUPABASE_SERVICE_KEY` **and** `SUPABASE_SERVICE_ROLE_KEY`,
`BACKEND_API_KEY`, `BACKEND_CHAT_TIMEOUT_MS`.

Route handlers use a **service-role Supabase client that bypasses RLS**. Every handler must scope
its queries with `.eq("user_id", userId)` from Clerk `auth()`. This is an application invariant, not
a deployment one, but it is the reason `SUPABASE_SERVICE_ROLE_KEY` must never reach the client.

---

## Supabase: migrations and edge functions

Shared by every target. There is no automation for any of it — `supabase db push` is not wired into
CI, and the only scheduled job is `daily-cleanup.yml`, which curls the `session-cleanup` function.

### A partially-tracked directory

`.gitignore` contains a bare `supabase/` rule, so the directory is **partially tracked**: 12 files
committed before the rule still version, everything added since is silently ignored. `git add
supabase/...` does nothing for new migrations or edge-function code unless you force it with
`git add -f`.

**Your local `supabase/` is the ground truth; the repo copy is incomplete.** Deploy from local, and
do not assume a fresh clone can reproduce the Supabase side.

### Migrations

```bash
supabase db push                       # applies supabase/migrations/*.sql
supabase migration list                # confirm applied vs pending
```

`supabase/migrations/` is the schema ground truth for `documents`, `embeddings`, `conversations`,
`conversation_messages`, `chunk_index`, `medical_analyses`, `generated_reports`, the cache tables,
and the `search_documents()` RPC. Prose docs disagree with each other on table names — trust the
migrations.

### Edge functions

Seven functions in `supabase/functions/`. Three carry a `config.toml` with `verify_jwt = true`
(`query-preprocess`, `search-cache`, `conversation-cache`); the other four have none and default to
JWT verification on, which is wrong for them — they are called server-to-server.

```bash
supabase functions deploy query-preprocess
supabase functions deploy search-cache
supabase functions deploy conversation-cache

supabase functions deploy analyze-image     --no-verify-jwt
supabase functions deploy generate-report   --no-verify-jwt
supabase functions deploy process-document  --no-verify-jwt
supabase functions deploy session-cleanup   --no-verify-jwt

supabase secrets set BACKEND_URL=https://<your-backend-host>
```

`BACKEND_URL` must be **publicly reachable from Supabase's network**, not an in-cluster address.
That is exactly what check 6 is about: under the k8s manifests as committed there is no such
address, so `process-document` cannot work.

The browser also calls `query-preprocess`, `search-cache`, and `conversation-cache` directly. All
three **fail soft** — if they are undeployed, the app still works without rate-limiting, answer
caching, or conversation caching.

### The demo fallback

If the Python backend is unreachable, the Next.js messages route handler returns a hardcoded
melanoma answer with `mode: "demo_fallback"` at HTTP 200 and persists it. **This is intentional, not
a bug.** It also means a fully broken backend can look like a working deployment from the UI. When
verifying a deploy, check the backend health endpoints directly rather than trusting the chat UI.
