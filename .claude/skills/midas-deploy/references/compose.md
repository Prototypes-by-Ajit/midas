# Docker Compose on a single host

Read this when the target is Compose. The whole stack requests roughly 900Mi / 300m, so one small
VM is enough.

## The only live compose file

`docker-compose.yml`. Four services, no explicit network (default bridge), two named volumes.

| Service | Container | Build / image | Published | Notes |
|---|---|---|---|---|
| `redis` | `midas_redis` | `redis:7-alpine`, `--appendonly yes` | `6379:6379` | volume `redis_data:/data`. Effectively unused — see below |
| `backend` | `midas_backend` | `./backend` | `8000:8000` | `env_file: .env.backend`, volume `backend_cache:/app/.cache` |
| `frontend` | `midas_frontend` | `./frontend` + 5 build args | **`3001:3000`** | `env_file: .env.frontend`, `BACKEND_URL=http://backend:8000` |
| `nginx` | `midas_nginx` | `./nginx` | **`8080:80`** | the real entrypoint |

**`docker-compose 2.yml` and `docker-compose.yml.backup` are dead.** Both rename the API service to
`backend-agent`, while `nginx/nginx.conf` hardcodes `proxy_pass http://backend:8000` in three
places — nginx cannot resolve its upstream. `docker-compose 2.yml` also gives Grafana port 3001,
colliding with the live frontend mapping. Never use either.

## Ports — read this before debugging a blank page

```
http://localhost:8080     ← nginx: the real entrypoint. Use this.
http://localhost:3001     ← frontend direct (compose maps 3001→3000)
http://localhost:8000     ← backend direct, /docs for OpenAPI
```

`docker-start.sh` prints `:3000` and advertises a "Document Processing" service on `:8001` that no
compose file defines. `start-services.sh` also assumes `:3000`. Both are for the **non-Docker** local
dev path (venv + `npm run dev`), which is a different thing. When running under Compose, the URLs
above are correct.

nginx routes `/_next/static/` and `/` to the frontend, and `/api/v1/`, `/docs`, `/openapi.json` to
the backend, with a 300s read timeout and rate limits of 1000 r/m global, 100 r/m on the API.

## Redis is inert

Compose starts Redis and passes `REDIS_URL`, but `main_agent` never calls `init_cache()` — only
`app/main.py` (a dead entrypoint) and `backend/init_db.py` do. So `cache_manager.client` stays
`None`, `health_check()` returns `False`, and `/readyz` always reports `redis_ready: false`.

That is expected, not a misconfiguration. The Redis container costs a few MB and does nothing. Leave
it or drop it; either is fine.

## Deploy

```bash
bash .claude/skills/midas-deploy/scripts/preflight.sh compose

# .env.backend and .env.frontend must exist at the repo root.
# The five NEXT_PUBLIC_* values are read from the shell environment at build time
# (compose interpolates them into build args), so export them or put them in .env.
scripts/up.sh          # docker-compose up -d --build
scripts/logs.sh        # docker-compose logs -f --tail=200
scripts/down.sh        # docker-compose down (keeps volumes)
scripts/rebuild.sh     # down, then build --no-cache
```

`nginx/nginx.conf` is **baked into the image** (`nginx/Dockerfile` is `FROM` + `COPY`), not
bind-mounted. Editing it requires `scripts/rebuild.sh`, not a container restart.

## Verify

```bash
docker-compose ps                                  # all four Up

curl -fsS localhost:8000/healthz                   # {"status":"ok"}
curl -sS  localhost:8000/readyz | jq               # expect ready:true once check 2 is fixed
curl -fsS localhost:3001/api/health                # frontend liveness
curl -fsS localhost:8080/ -o /dev/null -w '%{http_code}\n'   # 200 through nginx

# BFF wiring: unauthenticated conversations must be rejected, not 500
curl -sS -o /dev/null -w '%{http_code}\n' localhost:8080/api/conversations   # expect 401
```

`verify-services.sh` does the last check for the non-Docker dev path; the principle is the same. A
401 proves Clerk middleware and the route handler are both live. A 500 means the frontend booted
without its server-only env vars.

Then send one real chat message and confirm the response does **not** carry
`mode: "demo_fallback"` — that value means the frontend could not reach the backend and served a
hardcoded answer at HTTP 200.

## Expect a slow first request

`midas_backend` reports healthy within ~30s, but the first chat query pays ~12s to load MiniLM and
the first image analysis pays ~5-15s to import torch and load the checkpoint. This is normal and
one-time per container. Do not read it as a broken deploy.

## What Compose does not give you

TLS, DNS, zero-downtime rollout, rollback, log retention, and restart-on-host-reboot beyond
`restart: unless-stopped`. If you need those, the answer is a PaaS (`paas.md`), not Kubernetes —
see the decision gate in `SKILL.md`.
