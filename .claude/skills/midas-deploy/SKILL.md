---
name: midas-deploy
description: >
  Deploy the MIDAS platform (FastAPI backend, Next.js frontend, Supabase, nginx) and decide between
  Docker Compose, a PaaS, and Kubernetes for this specific codebase. Use whenever the user mentions
  deploying, shipping, releasing, going live, containers, Docker, docker-compose, Kubernetes, k8s,
  kubectl, kustomize, Railway, Render, image builds, replicas, scaling the backend, health probes,
  readiness, or "how do I run this in production" — even if they never say the word "deploy". Also
  use before changing replica counts, Dockerfiles, compose files, k8s manifests, or CI image builds,
  because MIDAS has verified deployment traps (a readiness probe that can never pass, ":latest"
  pinned against imagePullPolicy IfNotPresent, a 921MB venv in the build context, and a write-only
  chunk index that breaks multi-replica the day anyone reads from it) which make the obvious moves
  quietly wrong.
---

# Deploying MIDAS

MIDAS has more deployment surface than it has working deployment paths: 4 Dockerfiles, 3 compose
files (2 dead), a Kustomize base, `render.yaml`, two `railway.toml`s, 7 Supabase edge functions, and
~19 superseded guides in `docs/_archive/`. CI builds and pushes images to GHCR, then stops — **there
is no CD anywhere**. Several committed descriptors are broken in ways that fail at deploy time.

Start every deployment task by running the preflight. It takes a second and catches the things that
otherwise waste an hour:

```bash
bash .claude/skills/midas-deploy/scripts/preflight.sh <compose|k8s|railway|render>
```

---

## Three constraints that pin the shape of any deployment

Read these before recommending anything. They are properties of this code, verified by reading it,
and they invalidate the generic "containerize it, then add Kubernetes" advice.

### 1. The chunk index is a loaded gun, not a live constraint

`backend/app/indexing/rag_chunk_index.py:358` creates a **process-local, non-persisted** B+ tree:

```python
rag_chunk_index = RagChunkBPlusIndex(order=64)   # module-level global, pure Python dicts
```

It is **written** on every ingest (`main_agent.py:476`, `api/document_processing.py:131,271`,
`services/supabase_vector_store.py:112`) and **never read**. Its two readers —
`search_with_neighbors` (`supabase_vector_store.py:403`) and `get_chunk_neighbors` (`:483`) — have
no callers anywhere in the repo. Verify before relying on either statement:

```bash
grep -rn "search_with_neighbors\|get_chunk_neighbors" --include="*.py" . | grep -v "def "
```

So **today, extra replicas are safe with respect to this index** — each pod builds its own copy of
something nothing reads. It costs memory and ingest time, nothing else.

The trap is that both readers are written and look finished. The moment anyone wires neighbour
expansion into the retrieval path, multi-replica breaks **silently**: only the pod that ingested a
document holds its index, the index dies on every restart, and retrieval just returns less context.
No exception, no 5xx, no failed probe, no alert.

Treat this as a gate on a future change, not a reason to refuse replicas now. If you are asked to
enable neighbour expansion, externalising the index to Redis or Postgres is a prerequisite, not a
follow-up.

### 2. Boot is cheap; the first request is expensive

The import chain of `main_agent` deliberately pulls in no torch and no sentence-transformers — the
CNN (`api/image_analysis.py:21-24`) and the embedding model (`services/embeddings.py:20-30`) are
imported inside functions. Startup is ~2-5s of config checks. But the first real request pays
~12s to load MiniLM, and the first image analysis pays ~5-15s to import torch/torchvision/cv2 and
load the 55 MB checkpoint.

Consequence for autoscaling: a cold pod reads near-zero CPU, then spikes hard on its first request.
**CPU utilisation is a poor HPA signal here**, and every new replica you add serves one very slow
request before it is useful.

### 3. One worker, and CPU-bound work sits on the event loop

`WORKERS=1` everywhere (`backend/docker-entrypoint.sh`, `backend/railway.toml`,
`k8s/base/backend.yaml`). `cnn_model_service.analyze_image` is `async def` but runs a synchronous
torch forward **plus a GradCAM backward pass** with no `run_in_executor`
(`services/cnn_model_service.py:200-256`). WeasyPrint PDF rendering and the image download
(`api/image_analysis.py:70`, blocking `requests.get`) do the same.

So a single image analysis blocks **every other request on that pod** for its whole duration. You
scale this app by adding replicas, not workers — which runs straight into constraint 1.

---

## The decision: Compose, PaaS, or Kubernetes

Do not answer "it depends". For this repo the call is decidable.

### Docker Compose on a single host

Choose when the deployment is a demo, thesis defence, internal pilot, or single-tenant install; you
control one machine; and nobody needs self-service deploys.

The whole stack requests roughly **900Mi memory / 300m CPU** — it fits comfortably on one small VM.
This is the lowest-effort path that actually works today.

→ Read `references/compose.md`.

### A PaaS (Railway)

Choose when you want managed TLS, DNS, rollbacks, and log aggregation without operating anything,
and Supabase already handles your data tier.

**This is the best current fit for MIDAS.** `backend/railway.toml` is correct as written; only the
frontend descriptor needs a one-line fix (preflight will show it).

→ Read `references/paas.md`.

### Kubernetes

Choose only when **two or more** of these are true:

- You genuinely need >1 backend replica for sustained real traffic — enough that a single pod's
  blocking-inference problem (constraint 3) is your actual bottleneck.
- You already operate a cluster, so the marginal cost of one more namespace is near zero.
- You run several environments and want GitOps promotion between them.
- Compliance requires pod-level network isolation or admission control.
- You need node-level scheduling — GPU nodes, spot pools, taints.

If fewer than two hold, say so plainly. **Kubernetes for MIDAS as it stands is a one-replica
Deployment on one node, behind an HPA whose CPU signal describes warm-up rather than load — that is
Docker Compose with more YAML and a worse debugging story.** Recommending it would be a downgrade
dressed as a promotion.

Check whether a cluster even exists before assuming one does:

```bash
kubectl config get-contexts     # empty output = no cluster configured
```

And if you go anyway: **fix `/readyz` first or no pod will ever become Ready** (see below).

→ Read `references/kubernetes.md`.

---

## The readiness deadlock

This is the single defect most likely to burn an afternoon, so it is here rather than in a
reference.

`lifespan` (`backend/app/main_agent.py:95-120`) prints "configured for lazy initialization" and
never calls `supabase_vector_store.initialize()`. But `/readyz` gates on it:

```python
# services/supabase_vector_store.py:399-401
def is_ready(self) -> bool:
    return self.is_initialized and self.client is not None
```

and `initialize()` is only ever called from request handlers (`main_agent.py:467`,
`api/document_processing.py:123,263`, `agents/retriever.py:30`).

In Kubernetes that closes a loop with no exit:

```
pod starts → /readyz returns 503 → readinessProbe fails → Service has no endpoints
      ↑                                                              ↓
      └────────── initialize() never runs ←──── no request ever arrives
```

`k8s/base/backend.yaml:83-88` wires readiness to `/readyz`, so **the manifests as committed cannot
bring a backend pod to Ready.** Under Compose it is less severe — nothing gates traffic on health —
but `midas_backend` will sit permanently `unhealthy`.

Two ways out, both in `references/kubernetes.md`: call `initialize()` in `lifespan`, or point
readiness at `/healthz` and accept that a pod can be Ready before Supabase is reachable.

---

## Workflow

1. **Preflight.** `bash scripts/preflight.sh <target>`. Do not skip it because the change looks
   small. It exits non-zero on blocking defects and prints the file and line for each.
2. **Pick the target** using the decision gate above. State the reasoning in one or two sentences —
   the user should be able to disagree with your call, which means they need to see it.
3. **Follow the matching reference.** Read exactly one; they do not overlap.
4. **Verify** with the commands at the end of that reference. Do not report success from a build
   log alone — hit the health endpoints.

---

## Never do these

Each has a specific, verified reason.

**Reach for replicas as the fix for slow responses.** More pods add concurrency, never per-request
speed. The latency is per-request: a 5-iteration ReAct loop, one 70B LLM call, ~12s of lazy model
loading on a cold pod, and an inert Redis cache. Diagnose before scaling — and see constraint 1
before enabling neighbour expansion.

**Ship `:latest` with `imagePullPolicy: IfNotPresent`.** `k8s/base/kustomization.yaml:28,31` set
`newTag: latest` while both Deployments set `imagePullPolicy: IfNotPresent`
(`backend.yaml:42`, `frontend.yaml:34`). A node that already has a `:latest` layer cached will never
pull your new build, so the rollout reports success and runs the old code. Pin to `sha-<commit>`,
which also restores rollback.

**Build from `backend/requirements.prod.txt`.** It comments out `prometheus-client` (line 33), but
`app/main_agent.py:5` does `from prometheus_client import Counter, Histogram, make_asgi_app` at
module scope. The image builds and then crashes on import. Nothing uses this file; the Dockerfile
installs `requirements.txt`.

**Reuse one frontend image across environments.** All five `NEXT_PUBLIC_*` values are baked into the
client bundle at build time (`frontend/Dockerfile:24-43`). One image per environment, always. A
staging image pointed at prod URLs is not a config change, it is a rebuild.

**Set `GROQ_API_KEY` and assume the LLM works.** The alias sync is one-way, NVIDIA → GROQ
(`config.py:210-221`). Set only `GROQ_API_KEY` and `nvidia_api_key` stays `None`, so every agent
(`agents/rag_agent.py:30`, `react_cot_agent.py:42`, `web_scraping_agent.py:28`) silently fails to
build its client — while the startup banner (`main_agent.py:118`) and `/api/v1/health` (`:254`) both
read `groq_api_key` and cheerfully report "✅ Configured". A backend that reports healthy and cannot
generate. `render.yaml` is currently wired exactly this way.

**Point a healthcheck at `/api/v1/health` on a tight interval.** It runs two `count="exact"` queries
against Supabase on every call (`services/supabase_vector_store.py:352-384`). Use `/healthz` for
liveness. `backend/railway.toml` and `render.yaml` both use the expensive one.

---

## References

Read one, based on the target you chose. Each is self-contained; none needs the others.

| File | Read when |
|---|---|
| `references/preflight.md` | A preflight check failed and you need the file, line, cause, and fix — or you need the full env-var matrix, or you are deploying Supabase migrations and edge functions (shared by every target). |
| `references/compose.md` | Target is Docker Compose on a single host. |
| `references/kubernetes.md` | Target is Kubernetes. Contains the mandatory `/readyz` fix, the `OWNER`/hostname placeholders, secret creation, and the ingress ↔ edge-function conflict. |
| `references/paas.md` | Target is Railway or Render. |

`references/preflight.md` also covers Supabase migrations and edge-function deployment, which every
target needs and which no target automates.
