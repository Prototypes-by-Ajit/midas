# Railway and Render

Read this when the target is a PaaS. Railway is the better-supported of the two here and is the
best current fit for MIDAS overall — see the decision gate in `SKILL.md`.

Both providers give you TLS, DNS, rollback, logs, and restart policy without operating anything.
Supabase already handles the data tier, so there is nothing left that needs a cluster.

---

## Railway

Two services, each with its own descriptor. `backend/railway.toml` is correct as committed; the
frontend one has a one-line bug.

### Backend — correct

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "uvicorn app.main_agent:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --timeout-keep-alive 75"
healthcheckPath = "/healthz"
```

The start command matches `backend/docker-entrypoint.sh` exactly. Root directory: `backend/`.

`healthcheckPath` was `/api/v1/health`, which runs two `count="exact"` Supabase queries on **every
probe** (`services/supabase_vector_store.py:352-384`) — a health check generating steady database
load. It now uses the dependency-free `/healthz`.

### Frontend — correct

```toml
startCommand = "node server.js"
healthcheckPath = "/api/health"
```

This previously read `node .next/standalone/server.js`, which made the container exit immediately:
`frontend/Dockerfile:67` copies the standalone output **to the image root**, so the entry point is
`/app/server.js`. Deleting `startCommand` entirely is equally valid and arguably better — the
Dockerfile's own `CMD ["node", "server.js"]` then runs, keeping one source of truth.

### Variables

Set in the Railway dashboard per service, not in a file.

**Backend:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NVIDIA_API_KEY`, `BACKEND_API_KEY`,
`CORS_ORIGINS`, optionally `SUPABASE_ANON_KEY` and `TAVILY_API_KEY`.

**Frontend, build-time** — these are baked into the client bundle and must be set as **build
variables** before the image is built: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BACKEND_URL`.

**Frontend, runtime:** `BACKEND_URL` (Railway's internal address for the backend service),
`CLERK_SECRET_KEY`, `SUPABASE_SERVICE_KEY` **and** `SUPABASE_SERVICE_ROLE_KEY`, `BACKEND_API_KEY`.

Setting a `NEXT_PUBLIC_*` after the build has no effect on already-compiled client code. Changing
one requires a redeploy that rebuilds.

### Two known Railway quirks

`fix-railway-runtime.sh` documents both, discovered the hard way:

- **`SUPABASE_URL` needed a trailing slash** to avoid CORS preflight 400s.
- **`CORS_ORIGINS` must list the real frontend origin**, including scheme, or every browser request
  from the frontend fails preflight.

That script also `git commit`s and `git push`es. Read it before running it; prefer setting the
variables in the dashboard yourself.

### Deploy and verify

```bash
bash .claude/skills/midas-deploy/scripts/preflight.sh railway    # must exit 0

railway up                                     # or push to the connected branch

curl -fsS https://<backend-host>/healthz       # {"status":"ok"}
curl -sS  https://<backend-host>/readyz | jq
curl -fsS https://<frontend-host>/api/health
```

Then send one real chat message and confirm the response does **not** carry
`mode: "demo_fallback"` — that means the frontend could not reach the backend and served a hardcoded
answer at HTTP 200. A PaaS deploy can look completely healthy while this is happening.

---

## Render

`render.yaml` had **three** defects. Two are fixed; the third is a deliberate choice you should
confirm.

### 1. The backend could not build — fixed

```yaml
dockerfilePath: ./backend/Dockerfile
dockerContext: ./backend
```

It previously read `dockerfilePath: Dockerfile.backend`, a file that has never existed in this repo,
so the backend service failed at build every time. It now builds the real Dockerfile with the
correct context — no fourth Dockerfile needed.

### 2. The LLM was misconfigured — fixed

`render.yaml` declared `GROQ_API_KEY` and never `NVIDIA_API_KEY`. The alias sync in
`config.py:210-221` is **one-way**, NVIDIA → GROQ. Every agent reads `settings.nvidia_api_key`, so
with a GROQ-only configuration they all silently fail to construct their LLM client — while the
startup banner and `/api/v1/health` read `groq_api_key` and report `✅ Configured`.

That produced a backend which passed its health check and could not answer anything. The key is now
`NVIDIA_API_KEY`.

### 3. `EMBEDDING_PROVIDER: hosted` is still hardcoded

That forces the remote embedding path, which then also needs `EMBEDDING_API_URL`,
`EMBEDDING_API_KEY`, and `EMBEDDING_API_MODEL`. The default local path uses the MiniLM model already
baked into the image at `backend/Dockerfile:96-98` — no extra service, no extra credentials, no
per-call latency. Unless you specifically want hosted embeddings, drop this line.

### The frontend service does build

It points at the root `Dockerfile.frontend`, which exists and is the only consumer of that file.
Note its `HEALTHCHECK` hits `/` rather than `/api/health`, unlike `frontend/Dockerfile`. Both work;
they are just different files, and `frontend/Dockerfile` is the one Compose, Railway, and CI use.

Note also that `render.yaml` sets `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BACKEND_URL` to the **same**
value ending in `/api/v1`. Verify against how the frontend composes request paths before trusting
it — a doubled `/api/v1/api/v1` prefix is the usual symptom.

```bash
bash .claude/skills/midas-deploy/scripts/preflight.sh render     # must exit 0
```

---

## What neither provider gives you

**There is no CD.** `.github/workflows/ci.yml` builds both images, pushes them to GHCR, and runs a
Trivy scan with `exit-code: '0'` — report-only, non-blocking. Nothing deploys anywhere.

Railway and Render both have their own git-push-to-deploy, which is what actually ships. The GHCR
images are for the Kubernetes path. If you want CI to gate deploys, the Trivy step needs a non-zero
exit code and a deploy job needs to exist — neither is true today.
