#!/usr/bin/env bash
# MIDAS deployment preflight.
#
# Read-only: no writes, no network, no container or cluster calls. Safe to run any time.
# Env checks test for PRESENCE only and never print a value.
#
#   usage: preflight.sh <compose|k8s|railway|render>
#   exit 0 = no blocking defects   exit 1 = at least one BLOCK   exit 2 = bad usage

set -uo pipefail

TARGET="${1:-}"
case "$TARGET" in
  compose|k8s|railway|render) ;;
  *) echo "usage: $(basename "$0") <compose|k8s|railway|render>" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT" || { echo "cannot cd to repo root: $ROOT" >&2; exit 2; }

if [[ -t 1 ]]; then
  R=$'\033[31m'; Y=$'\033[33m'; G=$'\033[32m'; D=$'\033[2m'; N=$'\033[0m'
else
  R=""; Y=""; G=""; D=""; N=""
fi

BLOCKS=0; WARNS=0

ok()    { printf '%s✓ ok   %s %s\n' "$G" "$N" "$1"; }
warn()  { printf '%s⚠ warn %s %s\n' "$Y" "$N" "$1"; WARNS=$((WARNS+1)); }
block() { printf '%s✗ BLOCK%s %s\n' "$R" "$N" "$1"; BLOCKS=$((BLOCKS+1)); }
note()  { printf '        %s%s%s\n' "$D" "$1" "$N"; }

# has_var FILE VAR -> 0 if VAR is set to a non-empty, non-placeholder value
has_var() {
  local f="$1" v="$2" val
  [[ -f "$f" ]] || return 1
  val="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${v}=" "$f" 2>/dev/null | tail -1 | cut -d= -f2-)"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  [[ -n "$val" ]] || return 1
  case "$val" in ""|REPLACE*|CHANGEME*|your-*|xxx*|TODO*) return 1 ;; esac
  return 0
}

printf '\n%sMIDAS preflight — target: %s%s\n' "$D" "$TARGET" "$N"
printf '%s%s%s\n\n' "$D" "$ROOT" "$N"

# ─── 1. build context bloat ────────────────────────────────────────────────────
# backend/midas/ is a 921MB virtualenv. The build context is ./backend and the
# Dockerfile does `COPY . .`, so anything not ignored ships in the runtime image.
if [[ -d backend/midas ]]; then
  if grep -qE '^[[:space:]]*midas/[[:space:]]*$' backend/.dockerignore 2>/dev/null; then
    ok "backend/.dockerignore excludes midas/"
  else
    block "backend/.dockerignore does not exclude 'midas/'"
    note  "backend/midas/ is a $(du -sh backend/midas 2>/dev/null | cut -f1) virtualenv in the build context"
    if git -C . ls-files --error-unmatch backend/midas >/dev/null 2>&1; then
      note "it is tracked in git, so EVERY build ships it — local and git-based alike"
    else
      note "untracked, so it only bloats builds from this working tree (docker build, docker-compose"
      note "build, railway up). Git-based builds (CI, GitHub-connected Railway/Render) clone fresh and"
      note "never see it — but any local build silently gains ~1GB."
    fi
    note  "fix: add a line 'midas/' to backend/.dockerignore"
  fi
else
  ok "no stray backend/midas/ virtualenv in the build context"
fi

# ─── 2. readiness deadlock ─────────────────────────────────────────────────────
# lifespan never calls supabase_vector_store.initialize(), but /readyz gates on
# is_initialized. In k8s that is a closed loop: never Ready -> no traffic ->
# never initialized.
STARTUP="$(sed -n '/^async def lifespan/,/^app = FastAPI/p' backend/app/main_agent.py 2>/dev/null)"
if grep -q 'vector_store.initialize()' <<<"$STARTUP"; then
  ok "lifespan initializes the vector store; /readyz can pass"
else
  MSG="/readyz can never return 200: lifespan does not call supabase_vector_store.initialize()"
  if [[ "$TARGET" == "k8s" ]]; then
    block "$MSG"
    note  "readinessProbe (k8s/base/backend.yaml:83-88) never passes -> Service has no endpoints"
    note  "-> no request arrives -> initialize() never runs. Pod stays NotReady forever."
    note  "fix: call supabase_vector_store.initialize() in lifespan, or probe /healthz instead"
  else
    warn "$MSG"
    note  "container will report 'unhealthy' permanently; traffic is not gated, so it still serves"
  fi
fi

# ─── 3/4. PaaS descriptors ─────────────────────────────────────────────────────
if [[ "$TARGET" == "render" ]]; then
  DF="$(grep -E '^\s*dockerfilePath:' render.yaml 2>/dev/null | head -1 | awk '{print $2}')"
  if [[ -n "$DF" && ! -f "$DF" ]]; then
    block "render.yaml references '$DF', which does not exist"
    note  "the backend service cannot build at all; use backend/Dockerfile with a backend/ context"
  else
    ok "render.yaml dockerfilePath resolves"
  fi
  if grep -q 'NVIDIA_API_KEY' render.yaml 2>/dev/null; then
    ok "render.yaml declares NVIDIA_API_KEY"
  else
    block "render.yaml declares GROQ_API_KEY but not NVIDIA_API_KEY"
    note  "the groq alias is one-way (NVIDIA->GROQ, config.py:210-221): agents read nvidia_api_key"
    note  "-> backend boots, reports '✅ Configured' at /api/v1/health, and cannot generate"
  fi
fi

if [[ "$TARGET" == "railway" ]]; then
  if grep -q 'startCommand.*\.next/standalone/server\.js' frontend/railway.toml 2>/dev/null; then
    block "frontend/railway.toml startCommand points at .next/standalone/server.js"
    note  "frontend/Dockerfile:67 copies standalone output to the image root; entry is /app/server.js"
    note  "fix: 'node server.js', or drop startCommand and let the Dockerfile CMD run"
  else
    ok "frontend/railway.toml startCommand matches the image layout"
  fi
  if grep -q 'healthcheckPath = "/api/v1/health"' backend/railway.toml 2>/dev/null; then
    warn "backend/railway.toml health-checks /api/v1/health"
    note  "that endpoint runs two exact-count Supabase queries per call; /healthz is free"
  fi
fi

# ─── 5/6. kubernetes-specific ──────────────────────────────────────────────────
if [[ "$TARGET" == "k8s" ]]; then
  if grep -q 'OWNER' k8s/base/kustomization.yaml 2>/dev/null; then
    block "k8s/base/kustomization.yaml still contains the literal 'OWNER' in image names"
    note  "fix: kustomize edit set image ghcr.io/OWNER/midas-backend=ghcr.io/<you>/midas-backend:sha-<commit>"
  else
    ok "kustomization.yaml image names are set"
  fi

  if grep -q 'midas\.example\.com' k8s/base/ingress.yaml 2>/dev/null; then
    block "k8s/base/ingress.yaml still uses the placeholder host midas.example.com"
    note  "fix: replace both occurrences (tls.hosts and rules.host) with your real hostname"
  else
    ok "ingress hostname is set"
  fi

  # strip comments first: ingress.yaml *mentions* midas-backend in prose explaining
  # why it is deliberately not routed, which a naive grep reads as a route rule.
  if grep -v '^[[:space:]]*#' k8s/base/ingress.yaml 2>/dev/null | grep -q 'name: midas-backend'; then
    ok "ingress routes the backend (edge functions can reach it)"
  elif grep -rq 'BACKEND_URL' supabase/functions/process-document/index.ts 2>/dev/null; then
    block "document upload will break: the process-document edge function calls the backend directly"
    note  "supabase/functions/process-document/index.ts fetches BACKEND_URL from Supabase's network,"
    note  "but k8s/base/ingress.yaml routes only midas-frontend and a NetworkPolicy locks the backend down."
    note  "fix: route /api/v1/documents through the ingress with auth in front, or move ingestion behind the BFF"
  fi

  # :latest cached on a node is never re-pulled under IfNotPresent, so the rollout
  # reports success while running the old code.
  if grep -qE '^\s*newTag:\s*latest' k8s/base/kustomization.yaml 2>/dev/null \
     && grep -qE '^\s*imagePullPolicy:\s*IfNotPresent' k8s/base/backend.yaml 2>/dev/null; then
    block "newTag: latest combined with imagePullPolicy: IfNotPresent"
    note  "a node that already cached :latest never pulls the new build — rollout succeeds, old code runs"
    note  "fix: kustomize edit set image ...:sha-<commit>  (also restores rollback)"
  else
    ok "image tag / pull policy combination is safe"
  fi

  # The chunk index only constrains replicas once something READS it. Today nothing does.
  READERS="$(grep -rn 'search_with_neighbors\|get_chunk_neighbors' --include='*.py' . 2>/dev/null \
             | grep -v 'def search_with_neighbors\|def get_chunk_neighbors' | wc -l | tr -d ' ')"
  REPLICAS="$(grep -E '^\s*replicas:' k8s/base/backend.yaml 2>/dev/null | head -1 | awk '{print $2}')"
  HPA_MAX="$(grep -E '^\s*maxReplicas:' k8s/base/backend.yaml 2>/dev/null | head -1 | awk '{print $2}')"
  SCALES_OUT=$(( ${REPLICAS:-1} > 1 || ${HPA_MAX:-1} > 1 ? 1 : 0 ))

  if [[ "$READERS" -gt 0 && "$SCALES_OUT" -eq 1 ]]; then
    block "chunk index now has $READERS reader call-site(s) and the backend can scale past 1 replica"
    note  "app/indexing/rag_chunk_index.py:358 is process-local and non-persisted; only the ingesting"
    note  "pod holds a document's index -> silently degraded retrieval. Externalize it before scaling."
  elif [[ "$READERS" -gt 0 ]]; then
    warn "chunk index has $READERS reader call-site(s) — it must be externalized before any scale-out"
  else
    ok "chunk index is write-only (no readers) — replicas are safe with respect to it"
  fi

  if [[ -n "$HPA_MAX" && "$HPA_MAX" -gt 1 ]]; then
    warn "HPA scales to $HPA_MAX on CPU, which measures warm-up rather than load here"
    note  "torch/MiniLM load lazily on first request: cold pods read ~0% CPU, then spike"
  fi

  if [[ -f .env.backend ]]; then
    ok ".env.backend present (source for: kubectl create secret --from-env-file)"
  else
    block ".env.backend not found — cannot create midas-backend-secrets"
  fi
fi

# ─── 7. required env vars (presence only; values are never printed) ────────────
if [[ "$TARGET" == "compose" || "$TARGET" == "k8s" ]]; then
  MISSING=()
  for v in SUPABASE_URL SUPABASE_SERVICE_KEY NVIDIA_API_KEY; do
    has_var .env.backend "$v" || MISSING+=("$v")
  done
  if [[ ${#MISSING[@]} -eq 0 ]]; then
    ok "required backend vars present in .env.backend"
  else
    block "missing/placeholder in .env.backend: ${MISSING[*]}"
  fi

  if has_var .env.backend CORS_ORIGINS; then
    ok "CORS_ORIGINS set"
  else
    warn "CORS_ORIGINS not set in .env.backend (required for a real origin in production)"
  fi

  if [[ "$TARGET" == "compose" ]]; then
    FE_MISSING=()
    for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY \
             NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY; do
      has_var .env.frontend "$v" || FE_MISSING+=("$v")
    done
    if [[ ${#FE_MISSING[@]} -eq 0 ]]; then
      ok "required frontend vars present in .env.frontend"
    else
      block "missing/placeholder in .env.frontend: ${FE_MISSING[*]}"
      note  "NEXT_PUBLIC_* are baked at build time — a missing one is compiled into the bundle as undefined"
    fi
  fi
else
  note "env vars for $TARGET are set in the provider dashboard; not checkable from here"
fi

# ─── 8. health-probe path agreement ────────────────────────────────────────────
declare -a PATHS=()
grep -q "localhost:8000/readyz" docker-compose.yml 2>/dev/null && PATHS+=("compose:/readyz")
grep -q "/readyz" backend/Dockerfile 2>/dev/null && PATHS+=("image:/readyz")
grep -q 'healthcheckPath = "/api/v1/health"' backend/railway.toml 2>/dev/null && PATHS+=("railway:/api/v1/health")
grep -q 'healthCheckPath: /api/v1/health' render.yaml 2>/dev/null && PATHS+=("render:/api/v1/health")
grep -q 'path: /healthz' k8s/base/backend.yaml 2>/dev/null && PATHS+=("k8s-live:/healthz")
UNIQ="$(printf '%s\n' "${PATHS[@]:-}" | cut -d: -f2- | sort -u | grep -c . || true)"
if [[ "${UNIQ:-0}" -gt 1 ]]; then
  warn "backend health-probe paths disagree across layers: ${PATHS[*]}"
  note  "/healthz is free, /readyz gates on Supabase, /api/v1/health costs two Supabase count queries"
else
  ok "health-probe paths agree"
fi

# ─── 9/10. credential footguns ─────────────────────────────────────────────────
if [[ -f .env.frontend ]]; then
  if has_var .env.frontend SUPABASE_SERVICE_KEY && has_var .env.frontend SUPABASE_SERVICE_ROLE_KEY; then
    ok "both SUPABASE_SERVICE_KEY and SUPABASE_SERVICE_ROLE_KEY set for the frontend"
  else
    warn "frontend needs BOTH SUPABASE_SERVICE_KEY and SUPABASE_SERVICE_ROLE_KEY"
    note  "route handlers read one or the other with no cross-fallback; a missing one 500s at runtime"
  fi
fi

for f in .env.backend .env.frontend; do
  if [[ -f "$f" ]] && grep -qE '^[[:space:]]*BACKEND_API_KEY=["'"'"']?test-key' "$f" 2>/dev/null; then
    warn "$f still uses the committed default BACKEND_API_KEY 'test-key'"
  fi
done

# ─── 11. dead surface / port confusion ─────────────────────────────────────────
if [[ "$TARGET" == "compose" ]]; then
  if grep -q '"3001:3000"' docker-compose.yml 2>/dev/null; then
    warn "compose publishes the frontend on :3001, not :3000"
    note  "start-services.sh and docker-start.sh both assume :3000 — nginx on :8080 is the real entrypoint"
  fi
  # Historical variants named the API service `backend-agent` while nginx.conf hardcodes
  # `backend`. They are gone from the tree, but CLAUDE.md still warns about them — check
  # rather than trusting either source.
  for dead in "docker-compose 2.yml" "docker-compose.yml.backup"; do
    [[ -f "$dead" ]] && warn "'$dead' is present: it renames the service to backend-agent, which nginx.conf cannot resolve"
  done
fi

if grep -qE '^\s*#\s*prometheus-client' backend/requirements.prod.txt 2>/dev/null; then
  warn "backend/requirements.prod.txt omits prometheus-client but main_agent.py:5 imports it"
  note  "building from that file produces an image that crashes on import; use requirements.txt"
fi

# ─── summary ───────────────────────────────────────────────────────────────────
echo
if [[ $BLOCKS -gt 0 ]]; then
  printf '%s%d blocking defect(s), %d warning(s). Deploy aborted.%s\n\n' "$R" "$BLOCKS" "$WARNS" "$N"
  exit 1
fi
printf '%sNo blocking defects. %d warning(s).%s\n\n' "$G" "$WARNS" "$N"
exit 0
