# Kubernetes

Read this only after the decision gate in `SKILL.md` actually selected Kubernetes — two or more of
its criteria met. If it did not, say so and use `compose.md` or `paas.md`. A single-replica
Deployment on one node behind an unusable HPA is Compose with more YAML.

The manifests are good: securityContext hardened, NetworkPolicy, PDB, sensible probe split,
thoughtful comments. They have four blocking gaps before a first apply.

## Contents

- [Prerequisite: fix the readiness deadlock](#prerequisite-fix-the-readiness-deadlock)
- [Prerequisite: placeholders](#prerequisite-placeholders)
- [Prerequisite: document ingestion](#prerequisite-document-ingestion)
- [Secrets](#secrets)
- [Apply](#apply)
- [Verify](#verify)
- [Replicas and the HPA](#replicas-and-the-hpa)

---

## Readiness: fixed, keep it that way

`lifespan` initializes the vector store eagerly (`backend/app/main_agent.py:104-119`), so
`/readyz` returns 200 on a cold pod and the readinessProbe at `k8s/base/backend.yaml:87-92` passes.
Confirmed by boot test: cold process → 200 `{"ready": true, "supabase_ready": true}`.

Preflight check 2 guards this. **If it ever fires again, stop and fix it before applying** — with
lazy init the probe gates on a flag only a request can set, and no request arrives until the pod is
Ready, so no pod ever becomes Ready. Restore:

```python
if settings.supabase_url and settings.supabase_service_key:
    supabase_vector_store.initialize()
```

`initialize()` only constructs a Supabase client (no query) and returns `False` rather than raising,
so this is safe at startup: a Supabase outage leaves the pod up and honestly not-ready rather than
crash-looping.

Pointing `readinessProbe` at `/healthz` also clears the deadlock, but it is the worse fix — the pod
then reports Ready and takes traffic while Supabase is unreachable, and those requests fail.

## Prerequisite: placeholders

```bash
cd k8s/base

kustomize edit set image \
  ghcr.io/OWNER/midas-backend=ghcr.io/<your-org>/midas-backend:sha-<commit> \
  ghcr.io/OWNER/midas-frontend=ghcr.io/<your-org>/midas-frontend:sha-<commit>
```

CI publishes `ghcr.io/<owner>/midas-{backend,frontend}` tagged `sha-<commit>`, `<branch>`, and
`latest` on the default branch. **Pin to `sha-`.** `:latest` defeats rollback, and rollback is most
of what you are buying by running Kubernetes at all.

Both Deployments now set `imagePullPolicy: Always`, which is the correct pairing for the mutable
`:latest` tag the kustomization still carries — under `IfNotPresent` a node that already cached
`:latest` never pulls the new build, so the rollout reports success while running old code. Once you
pin to `sha-<commit>`, switch back to `IfNotPresent` to avoid a registry round-trip per pod start.

Then replace `midas.example.com` in `k8s/base/ingress.yaml` — **both occurrences**, `tls.hosts` and
`rules.host`.

Remember the frontend image is environment-specific: the five `NEXT_PUBLIC_*` values are baked at
build time. A prod cluster needs an image built with prod build args. See `preflight.md`.

## Prerequisite: document ingestion

`k8s/base/ingress.yaml` deliberately routes only `midas-frontend`, and the NetworkPolicy at
`backend.yaml:161-186` allows ingress only from frontend pods and the `monitoring` namespace. That
is a sound decision — FastAPI carries no auth of its own, and `GET /api/v1/sessions/{id}/messages`
takes `user_id` as an *optional* query param, so a public backend is an authorization hole.

But `supabase/functions/process-document/index.ts` calls the backend from Supabase's network. Chat,
image analysis, and report generation go through the BFF and are unaffected; **document upload is
not** (`frontend/src/app/api/documents/upload/route.ts:130-141`).

Three ways out, in order of preference:

1. **Route ingestion through the BFF.** Have the upload handler call
   `${BACKEND_URL}/api/v1/documents/{id}/process` directly, the way analysis and reports already do.
   Deletes the problem rather than working around it, and matches the rest of the architecture.
2. **Expose only `/api/v1/documents` through the ingress**, with authentication in front of it and
   the NetworkPolicy widened to match. More surface, more to get right.
3. **Accept that ingestion is manual** for now, and run it from inside the cluster. Fine for a
   read-only deployment over an already-populated knowledge base.

Do not simply widen the NetworkPolicy and route the whole backend publicly — that reintroduces the
authorization hole the ingress comments exist to prevent.

## Secrets

Never commit filled secrets. `k8s/base/secrets.example.yaml` is a template and is deliberately not
listed in `kustomization.yaml`.

```bash
kubectl create namespace midas

kubectl create secret generic midas-backend-secrets -n midas \
  --from-env-file=.env.backend

kubectl create secret generic midas-frontend-secrets -n midas \
  --from-literal=CLERK_SECRET_KEY=... \
  --from-literal=SUPABASE_SERVICE_KEY=... \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_KEY` **and** `SUPABASE_SERVICE_ROLE_KEY` are both required — different route
handlers read one or the other with no fallback.

Check `.env.backend` sets `NVIDIA_API_KEY`, not just `GROQ_API_KEY`. The alias is one-way and a
GROQ-only backend reports healthy while being unable to generate (`preflight.md`).

For a managed cluster prefer External Secrets Operator or the provider's secret-store CSI driver
over static Secrets.

## Apply

```bash
bash .claude/skills/midas-deploy/scripts/preflight.sh k8s     # must exit 0

kubectl kustomize k8s/base                                    # review the rendered output first
kubectl apply -k k8s/base
```

## Verify

```bash
kubectl -n midas rollout status deploy/midas-backend --timeout=5m
kubectl -n midas rollout status deploy/midas-frontend --timeout=2m

kubectl -n midas get pods -o wide
kubectl -n midas get endpoints midas-backend        # MUST list an address
```

**Empty endpoints means the readiness deadlock is still live.** That is the failure this whole
document opens with, and it is the most likely thing to go wrong.

```bash
# probe from inside the cluster — the backend is not publicly routed
kubectl -n midas run curl --rm -it --restart=Never --image=curlimages/curl -- \
  sh -c 'curl -fsS midas-backend:8000/healthz; echo; curl -sS midas-backend:8000/readyz'

kubectl -n midas get ingress midas
kubectl -n midas describe certificate midas-tls      # cert-manager, if used
curl -fsS https://<your-host>/api/health             # frontend liveness through the ingress
```

Then send one real chat message through the UI and confirm the response does **not** carry
`mode: "demo_fallback"` — that means the frontend could not reach the backend and served a hardcoded
answer at HTTP 200.

The startupProbe allows 5 minutes (30 × 10s), which is generous: boot is only ~2-5s because torch
and sentence-transformers are not imported at module scope. The cost lands on the first *request*
instead — ~12s for the first chat query, ~5-15s for the first image analysis, per pod. There is no
warm-up hook, so every new replica serves one slow request.

## Replicas and the HPA

Extra replicas are **safe today**, with one caveat you must check first.

`backend/app/indexing/rag_chunk_index.py:358` is a module-level, process-local, non-persisted B+
tree. It is written on every ingest, but **nothing reads it**: its two readers,
`search_with_neighbors` (`services/supabase_vector_store.py:403`) and `get_chunk_neighbors`
(`:483`), have no callers. Confirm before trusting either direction —

```bash
grep -rn "search_with_neighbors\|get_chunk_neighbors" --include="*.py" . | grep -v "def "
```

— empty output means each pod is building a private copy of something nothing consumes, so replicas
cost memory and ingest time and nothing else. **If that grep returns callers, stop**: multi-replica
then silently degrades retrieval, because only the ingesting pod holds a document's index and it is
lost on every restart. Externalise the index to Redis or a Postgres table alongside `chunk_index`
before scaling.

The committed HPA (`minReplicas: 1`, `maxReplicas: 4`, CPU 70%) has a separate, live problem:
**CPU is the wrong signal.** Torch and MiniLM load lazily, so a cold pod reads near-zero CPU and
then spikes hard on its first request. The metric describes warm-up, not load — it will scale up
because a pod is cold and scale down while requests are queued. Switch to a request-rate or latency
metric, or set `maxReplicas: 1` and scale manually until you have one.

What replicas genuinely fix is constraint 3: `WORKERS=1` plus synchronous torch inference on the
event loop means per-pod concurrency is effectively one. If a single image analysis is blocking
other users, more pods is a legitimate answer. The cheaper one is `asyncio.to_thread` around the
blocking calls in `services/cnn_model_service.py:200-256` — that raises per-pod concurrency without
adding any infrastructure, and is worth doing first.

Note also that `WORKERS=1` is correct and should stay: `cnn_model_service.analyze_image` runs a
synchronous torch forward plus a GradCAM backward on the event loop
(`services/cnn_model_service.py:200-256`), so one image analysis blocks every other request on that
pod. More workers would multiply the torch memory footprint against the 2Gi limit without fixing
that.

## Resource sizing

Requests `cpu 250m / memory 768Mi`, limits `cpu 1500m / memory 2Gi`.

The 768Mi request assumes a warm pod. Because everything loads lazily, an idle pod that has never
served an image request sits nearer 200-300Mi, while one that has loaded both the CNN and MiniLM and
run a forward+backward for GradCAM approaches the 2Gi limit. Concurrent first-time image analyses
are the realistic OOMKill scenario. If you see OOMKills, raise the limit before you touch replicas.

CPU inference only — the Dockerfile installs CPU-only torch wheels and no manifest requests
`nvidia.com/gpu`.

## Not in the manifests, on purpose

No PVCs (nothing writes to disk on the serving path — PDFs and heatmaps stream as bytes, uploads go
to Supabase Storage), no ConfigMaps, and no Redis (the cache layer is inert under the live
entrypoint — `main_agent` never calls `init_cache()`).
