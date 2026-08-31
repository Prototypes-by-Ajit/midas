"""Admin Control Room API — governed actions and their shared atomic helper (T024).

Mounted at /api/v1/admin/* (main_agent.py, T037). See
`.specify/specs/003-admin-control-room/contracts/admin-control-room-contract.md`
for the full endpoint table and authority matrix.

**Auth mechanism (design decision, 2026-08-30 — see contract.md §4 row 1's own
correction note):** contract.md originally said every handler here "re-verifies
role via `auth()` + `clerkClient`" — TypeScript-only Clerk APIs, uncallable from
Python, and a copy-paste artifact from describing the BFF layer. This backend has
no JWT library and no `CLERK_SECRET_KEY` (this feature's own Standing
Prohibitions forbid adding either). The actual, user-decided mechanism:
`actor_id`/`actor_role` arrive as `X-Actor-Id`/`X-Actor-Role` headers, forwarded
by the BFF from its own real `getSessionUser()` Clerk lookup — the same trust
boundary this backend already uses for `user_id` in every other router. This
handler layer does NOT cryptographically re-verify the Clerk session; it
independently re-derives its own allow/deny decision from that forwarded value
against each route's own allowlist, rather than trusting a pre-computed
allow/deny flag from the BFF. Defense-in-depth against a BFF-layer bug, not
against a request that never went through the BFF at all.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException

from app.contracts.admin_contract import OPERATOR_ROLES

logger = logging.getLogger(__name__)

router = APIRouter()


def get_supabase():
    """A fresh service-role client per call. Constitution Principle III: this
    client bypasses RLS entirely, so every query built from it below is scoped
    in application code, never left to a database policy.

    Uses `app.config.settings` (pydantic-settings, reliably loads `.env`), not
    bare `os.getenv()` — app/api/reports.py's own get_supabase() uses the
    latter, which this feature's own tests found unreliable outside the full
    app's import chain (`os.environ` isn't guaranteed populated; `settings`
    is). Real bug found and fixed 2026-08-30 via test_admin_denials.py: the
    os.getenv() version silently raised 500 "credentials not configured" on
    every request when admin.py was imported standalone (any test importing
    only `app.api.admin`, not the full `app.main_agent` chain)."""
    from supabase import create_client
    from app.config import settings

    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured")

    return create_client(settings.supabase_url, settings.supabase_service_key)


# --------------------------------------------------------------------------- #
# §4 authority check — every handler calls this first, with its own allowlist
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Actor:
    id: str
    role: str


async def require_operator(
    x_actor_id: Optional[str] = Header(default=None),
    x_actor_role: Optional[str] = Header(default=None),
) -> Actor:
    """Every /admin/* route depends on this. Refuses (401) before any query if
    the BFF didn't forward an identity at all — a handler that cannot resolve
    an identity MUST refuse, never fall through to an unscoped query
    (Constitution Principle III)."""
    if not x_actor_id or not x_actor_role:
        raise HTTPException(status_code=401, detail="Missing actor identity")
    return Actor(id=x_actor_id, role=x_actor_role)


def require_role(actor: Actor, allowed: Tuple[str, ...], action: str, supabase=None) -> None:
    """The route's own allowlist check (contract.md §4's per-route rows).
    `allowed` is a subset of OPERATOR_ROLES — every legitimate caller of this
    function passes one. Writes a `refused` audit row and raises 403 when the
    actor's role isn't in it. `action` is the AUDIT_ACTIONS value for this
    denial (e.g. "audit.read.refused")."""
    if actor.role not in OPERATOR_ROLES or actor.role not in allowed:
        if supabase is not None:
            try:
                supabase.table("audit_events").insert({
                    "actor_id": actor.id,
                    "actor_role": actor.role,
                    "action": action,
                    "target_type": "route",
                    "target_id": action,
                    "reason": "(role not permitted)",
                    "outcome": "refused",
                }).execute()
            except Exception as e:
                logger.error(f"Failed to record read-denial audit row for {action}: {e}")
        raise HTTPException(status_code=403, detail="Forbidden")


# --------------------------------------------------------------------------- #
# T024 — run_governed_action(): the shared atomic domain-write + audit-insert
# sequence every governed action (invite, role change, offboard) uses.
#
# Clerk (the domain change) and Postgres (the audit trail) cannot share one
# transaction — this is a three-step saga, not a single atomic operation
# (plan.md Complexity Tracking; quickstart.md §4's corrected sequence
# diagram):
#   (1) write audit_events with outcome='pending' (its own trivial, always-
#       succeeds-or-the-request-never-proceeds single-insert transaction)
#   (2) call the domain function (Clerk invite / metadata write / revoke)
#   (3) call the RPC to finalize: pending -> allowed
#
# What happens when step 3 fails after step 2 succeeded differs by action:
#   - invite / role-change: a real undo exists (revoke the invitation just
#     created / no-op the metadata write) -> compensate, finalize 'refused'.
#   - offboard: revocation has no undo -> retry step 3 alone (a reliable,
#     idempotent Postgres UPDATE) rather than pretend to compensate.
# The `compensate_call` parameter selects which: pass it for invite/role-
# change, omit it (None) for offboard.
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class GovernedActionOutcome:
    outcome: str  # "allowed" | "refused" | "pending" | "duplicate"
    evt_id: Optional[str]
    error_code: Optional[str] = None


# Bounded, not unbounded (ponytail: quickstart.md's "retry until it succeeds"
# read literally would mean an open-ended loop inside an HTTP request the
# operator is waiting on). One immediate retry is consistent with the RPC
# finalize being "a reliable, idempotent Postgres UPDATE, unlikely to keep
# failing" (quickstart.md's own reasoning) — if it fails twice in a row, the
# row stays 'pending' and the real safety net is `audit_events_pending_idx`
# (a staleness scan, T063's paging) picking it up out-of-band, not a longer
# in-request retry loop. Upgrade path: a background reconciler, if the
# staleness scan alone proves insufficient in practice.
_FINALIZE_RETRY_ATTEMPTS = 2


async def run_governed_action(
    supabase,
    actor: Actor,
    action: str,
    target_type: str,
    target_id: str,
    reason: Optional[str],
    domain_call: Callable[[], Awaitable[Any]],
    rpc_call: Callable[[str], Awaitable[Tuple[str, str]]],
    compensate_call: Optional[Callable[[], Awaitable[None]]] = None,
) -> GovernedActionOutcome:
    # Step 4 of the Governed Action pattern (spec.md): empty/missing reason is
    # refused before any domain call or RPC call, same as an unauthorized-role
    # attempt — the disabled client control is a convenience, never the actual
    # enforcement.
    #
    # audit_events.reason has CHECK (length(trim(reason)) > 0) — a genuinely
    # empty reason can never be written to ANY row, including this refusal
    # itself. This sentinel is a system annotation of what happened ("no
    # reason was provided"), not a fabricated claim about what the operator
    # typed (finding, 2026-08-30 — data-model.md §1's CHECK and spec.md's
    # Governed Action pattern step 4 otherwise directly conflict).
    if not reason or not reason.strip():
        row = (
            supabase.table("audit_events")
            .insert({
                "actor_id": actor.id,
                "actor_role": actor.role,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "reason": "(no reason provided)",
                "outcome": "refused",
            })
            .execute()
        )
        evt_id = row.data[0]["id"] if row.data else None
        return GovernedActionOutcome(outcome="refused", evt_id=evt_id, error_code="EMPTY_REASON")

    # Step (1): pending row, its own trivial single-insert transaction.
    pending_row = (
        supabase.table("audit_events")
        .insert({
            "actor_id": actor.id,
            "actor_role": actor.role,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "reason": reason,
            "outcome": "pending",
        })
        .execute()
    )
    pending_evt_id = pending_row.data[0]["id"]

    # Step (2): the domain call (Clerk). If it fails outright, nothing to
    # compensate — finalize straight to refused.
    try:
        await domain_call()
    except Exception as e:
        logger.warning(f"governed action {action} domain call failed for {pending_evt_id}: {e}")
        supabase.table("audit_events").update({"outcome": "refused"}).eq(
            "id", pending_evt_id
        ).eq("outcome", "pending").execute()
        return GovernedActionOutcome(
            outcome="refused", evt_id=pending_evt_id, error_code="DOMAIN_CALL_FAILED"
        )

    # Step (3): the RPC finalize.
    try:
        evt_id, outcome = await rpc_call(pending_evt_id)
        return GovernedActionOutcome(outcome=outcome, evt_id=evt_id)
    except Exception as e:
        logger.error(f"governed action {action} RPC finalize failed for {pending_evt_id}: {e}")

        if compensate_call is not None:
            # invite / role-change: a real undo exists.
            try:
                await compensate_call()
                supabase.table("audit_events").update({"outcome": "refused"}).eq(
                    "id", pending_evt_id
                ).eq("outcome", "pending").execute()
                return GovernedActionOutcome(
                    outcome="refused", evt_id=pending_evt_id, error_code="RPC_FAILED_COMPENSATED"
                )
            except Exception as compensate_error:
                # The one gap eng review finding 1 exists to make loud instead
                # of silent: domain change stands, no compensation, row stays
                # pending. T063 pages on this log line.
                logger.error(
                    "governed_action_audit_write_failed: "
                    f"pending_evt_id={pending_evt_id} action={action} "
                    f"compensation also failed: {compensate_error}"
                )
                return GovernedActionOutcome(
                    outcome="pending", evt_id=pending_evt_id, error_code="COMPENSATION_FAILED"
                )
        else:
            # offboard: no undo for a revoked session. Retry the finalize
            # alone (bounded — see _FINALIZE_RETRY_ATTEMPTS above), never
            # compensate/undo the revocation.
            for attempt in range(1, _FINALIZE_RETRY_ATTEMPTS):
                try:
                    evt_id, outcome = await rpc_call(pending_evt_id)
                    return GovernedActionOutcome(outcome=outcome, evt_id=evt_id)
                except Exception as retry_error:
                    logger.error(
                        f"governed action {action} finalize retry {attempt} failed "
                        f"for {pending_evt_id}: {retry_error}"
                    )
            logger.error(
                "governed_action_audit_write_failed: "
                f"pending_evt_id={pending_evt_id} action={action} "
                f"all finalize retries exhausted, domain change already applied"
            )
            return GovernedActionOutcome(
                outcome="pending", evt_id=pending_evt_id, error_code="RETRY_EXHAUSTED"
            )


# =============================================================================
# Phase 7 — read-only endpoints (T026-T035, T071)
#
# Real-data feasibility, established by research before writing any of this
# (2026-08-30, five parallel investigations — see turn summary for full
# citations):
#
#   - Metrics (p50/p95/throughput/error-rate): NOT computable today. A real
#     /metrics endpoint exists (main_agent.py) but nothing scrapes it — the
#     monitoring/ Prometheus+Grafana stack is configured but absent from
#     docker-compose.yml. No PROMETHEUS_URL setting exists, no percentile
#     computation code exists anywhere in the repo. Per FR-OV-1/FR-HLT-1's own
#     explicit allowance, every metric field below renders "—" (None) until
#     that stack is actually deployed (OQ7). Not a placeholder — the honest
#     state.
#   - GET /api/v1/health is dead code (route-collision bug in main_agent.py,
#     unrelated to this feature, not fixed here) — the richer main_agent.py
#     handler never executes; document_processing.py's simpler one always
#     wins. Not fixed (Principle V — out of this feature's scope), but this
#     feature's own service-status checks below call the underlying service
#     singletons directly rather than relying on that broken route.
#   - get_chunk_index_stats() queries `chunk_index`, which nothing populates
#     (the live chunking path is an in-memory singleton that never persists
#     there) — calling it would show a real-looking but permanently-zero
#     count, which is worse than "—" (it reads as "the index is empty" when
#     it isn't). FR-RAG-3's chunk count comes from `embeddings` instead, which
#     the live ingestion path actually writes to.
# =============================================================================

from datetime import datetime, timezone  # noqa: E402 -- grouped with the block that uses them
from typing import Dict, List  # noqa: E402


# --------------------------------------------------------------------------- #
# T071 — FR-HLT-5: computed exactly once, read by both /overview and
# /health/services, never independently recomputed (the two views poll on
# different cadences -- an independently-recomputed number on each would
# silently disagree). Currently always "—" per the metrics-feasibility finding
# above; the single-function shape is what's load-bearing here, not today's
# always-None return value -- when the telemetry stack (OQ7) is deployed, only
# this function's body needs to change.
# --------------------------------------------------------------------------- #

_HLT5_TARGET_MS = 400


def compute_p95_latency() -> Optional[float]:
    """FR-HLT-5's p95 request-latency figure, in milliseconds. `None` (renders
    "—") until a queryable metrics backend exists — see module-level note."""
    return None


# --------------------------------------------------------------------------- #
# System Health's service list — the services this MVP knows how to check the
# real status of, without Prometheus. Each check is a direct Python call to
# the existing service singleton, not a new mechanism.
# --------------------------------------------------------------------------- #


async def _check_service_status(service_id: str) -> str:
    """"operational" | "degraded" | "unknown" -- never "healthy" as a guess.
    "unknown" is Constitution Principle II's own vocabulary (ServiceProbe,
    frontend/src/types/dashboard.ts) for "cannot currently measure this"."""
    try:
        if service_id == "redis":
            from app.cache.cache_manager import cache_manager
            return "operational" if cache_manager.health_check() else "degraded"
        if service_id == "supabase":
            from app.services.supabase_vector_store import supabase_vector_store
            # is_ready() is construction-only, not a live round-trip (same
            # caveat readyz's own docstring names) -- "operational" here means
            # "credentials present and client constructed", not "reachable".
            return "operational" if supabase_vector_store.is_ready() else "unknown"
        if service_id == "cnn_model":
            from app.services.cnn_model_service import cnn_model_service
            return "operational" if cnn_model_service.is_ready() else "degraded"
        if service_id == "tavily":
            from app.services.tavily_service import tavily_service
            return "operational" if tavily_service.is_configured() else "unknown"
    except Exception as e:
        logger.error(f"service status check failed for {service_id}: {e}")
        return "unknown"
    return "unknown"


SERVICES: List[Dict[str, str]] = [
    {"id": "supabase", "name": "Supabase (Postgres)"},
    {"id": "redis", "name": "Redis cache"},
    {"id": "cnn_model", "name": "CNN model (image analysis)"},
    {"id": "tavily", "name": "Tavily web search"},
]


def _na_metrics() -> Dict[str, Optional[float]]:
    """Every request-latency metric this MVP cannot source yet — one shared
    shape so no caller invents its own subset of "—" fields."""
    return {"p50_ms": None, "p95_ms": None, "throughput_rps": None, "error_rate": None}


# --------------------------------------------------------------------------- #
# T026 — GET /overview (FR-OV-1, FR-OV-2)
# --------------------------------------------------------------------------- #


@router.get("/overview")
async def get_overview(actor: Actor = Depends(require_operator)):
    supabase = get_supabase()
    require_role(actor, OPERATOR_ROLES, "overview.read.refused", supabase)

    services_operational: Optional[str] = None  # "N/M" once real per-service data exists (OQ7)
    open_incidents: Optional[int] = None  # no incident data model exists in this release (Deferred)
    abstention_rate_24h: Optional[float] = None  # no upstream source exists yet (Deferred)
    p95_latency_ms = compute_p95_latency()  # T071 -- single shared computation

    return {
        "tiles": {
            "services_operational": services_operational,
            "open_incidents": open_incidents,
            "abstention_rate_24h": abstention_rate_24h,
            "p95_latency_ms": p95_latency_ms,
        },
        "p95_target_ms": _HLT5_TARGET_MS,
    }


# --------------------------------------------------------------------------- #
# T027 — GET /health/services (FR-HLT-1)
# --------------------------------------------------------------------------- #


@router.get("/health/services")
async def get_health_services(actor: Actor = Depends(require_operator)):
    supabase = get_supabase()
    require_role(actor, OPERATOR_ROLES, "health.read.refused", supabase)

    rows = []
    for svc in SERVICES:
        status = await _check_service_status(svc["id"])
        rows.append({
            "id": svc["id"],
            "name": svc["name"],
            "status": status,
            **_na_metrics(),
        })

    return {"services": rows, "p95_target_ms": _HLT5_TARGET_MS, "p95_latency_ms": compute_p95_latency()}


# --------------------------------------------------------------------------- #
# T028 — GET /health/services/{service_id} (FR-HLT-2, drill-down)
# --------------------------------------------------------------------------- #


@router.get("/health/services/{service_id}")
async def get_health_service_detail(service_id: str, actor: Actor = Depends(require_operator)):
    supabase = get_supabase()
    require_role(actor, OPERATOR_ROLES, "health.read.refused", supabase)

    known_ids = {svc["id"] for svc in SERVICES}
    if service_id not in known_ids:
        raise HTTPException(status_code=404, detail="Unknown service")

    status = await _check_service_status(service_id)
    return {
        "id": service_id,
        "status": status,
        "series_24h": [],  # no persisted history exists yet -- "—" as an empty series, not fabricated points
        "target_ms": _HLT5_TARGET_MS,
        "recent_events": [],  # no incident/event data model exists in this release
    }


# --------------------------------------------------------------------------- #
# T029 — GET /rag/ingestion (FR-RAG-1, base half only)
# --------------------------------------------------------------------------- #


@router.get("/rag/ingestion")
async def get_rag_ingestion(actor: Actor = Depends(require_operator)):
    supabase = get_supabase()
    require_role(actor, OPERATOR_ROLES, "rag.read.refused", supabase)

    result = (
        supabase.table("documents")
        .select("id,title,file_name,status,source,lesion_class,created_at,updated_at")
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return {"documents": result.data or []}


# --------------------------------------------------------------------------- #
# T030 — GET /rag/index-health (FR-RAG-3)
#
# Reads `embeddings`, not `chunk_index` (get_chunk_index_stats()'s own table)
# -- see the module-level feasibility note. `embeddings` is what the live
# ingestion path actually writes to.
# --------------------------------------------------------------------------- #


@router.get("/rag/index-health")
async def get_rag_index_health(actor: Actor = Depends(require_operator)):
    supabase = get_supabase()
    require_role(actor, OPERATOR_ROLES, "rag.read.refused", supabase)

    chunk_count_result = supabase.table("embeddings").select("id", count="exact").limit(1).execute()
    chunk_count = chunk_count_result.count or 0

    approved_sources_result = (
        supabase.table("documents").select("id", count="exact").eq("status", "processed").limit(1).execute()
    )
    approved_sources = approved_sources_result.count or 0

    # model_version is a per-row TEXT column, not a single project-wide setting
    # -- report every distinct value actually present, honest about the case
    # where more than one model has ever produced embeddings.
    model_versions_result = supabase.table("embeddings").select("model_version").limit(1000).execute()
    distinct_models = sorted({r["model_version"] for r in (model_versions_result.data or []) if r.get("model_version")})

    return {
        "chunk_count": chunk_count,
        "embedding_models": distinct_models,
        "approved_sources": approved_sources,
        "last_rebuild_at": None,  # no schema field exists yet for this release (spec.md FR-RAG-3)
        "stale_sources": None,  # same -- "—", never a stale cached number
        "pending_approvals": None,  # no approval workflow exists in this release
    }


# --------------------------------------------------------------------------- #
# T031 — GET /audit (FR-AUD-2, cursor pagination) -- Admin only (ml_engineer/sre collapsed into admin, 2026-08-31)
# --------------------------------------------------------------------------- #


@router.get("/audit")
async def get_audit(
    actor: Actor = Depends(require_operator),
    action: Optional[str] = None,
    q: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = 50,
):
    supabase = get_supabase()
    require_role(actor, OPERATOR_ROLES, "audit.read.refused", supabase)

    query = supabase.table("audit_events").select("*").order("created_at", desc=True).order("id", desc=True)
    if action:
        query = query.eq("action", action)
    if q:
        # Free-text over actor/action/target/identifiers (FR-AUD-2). PostgREST
        # `or` with `ilike` across the columns spec.md names.
        pattern = f"%{q}%"
        query = query.or_(
            f"actor_id.ilike.{pattern},action.ilike.{pattern},target_id.ilike.{pattern},id.ilike.{pattern}"
        )
    if cursor:
        # Cursor is the last-seen created_at (R7) -- strictly-older rows only,
        # so a row inserted mid-page never gets skipped or duplicated.
        query = query.lt("created_at", cursor)

    capped_limit = min(limit, 200)
    result = query.limit(capped_limit).execute()
    rows = result.data or []
    next_cursor = rows[-1]["created_at"] if len(rows) == capped_limit else None

    # T064 -- PRD §17 analytics event, only when a filter is actually active
    # (an unfiltered page-through isn't "filtering"). Same honest-log-line
    # pattern as T065 -- no analytics sink exists in this app.
    if action or q:
        filter_type = "action" if action and not q else "q" if q and not action else "action+q"
        logger.info(f"audit_log_filtered: filter_type={filter_type} result_count={len(rows)}")

    return {"items": rows, "next_cursor": next_cursor, "result_count": len(rows)}


# --------------------------------------------------------------------------- #
# T074 (speckit-implement, Phase 10 finding) — GET /audit/policy-blocks
# (FR-AUD-4/FR-AUD-2) -- Admin only. T054's audit timeline shows
# policy-block rows interleaved with audit_events rows, visually
# distinguished but in one merged, cursor-paginated view -- the summary
# endpoint (T032, below) only returns counts, nothing lists the rows
# themselves. Same cursor semantics as /audit (created_at, strictly-older)
# so a caller can merge-sort both pages by created_at without either source
# skipping or duplicating rows (FR-AUD-2).
# --------------------------------------------------------------------------- #


@router.get("/audit/policy-blocks")
async def get_policy_blocks(
    actor: Actor = Depends(require_operator),
    cursor: Optional[str] = None,
    limit: int = 50,
):
    supabase = get_supabase()
    require_role(actor, OPERATOR_ROLES, "audit.read.refused", supabase)

    query = supabase.table("policy_block_events").select("*").order("created_at", desc=True).order("id", desc=True)
    if cursor:
        query = query.lt("created_at", cursor)

    capped_limit = min(limit, 200)
    result = query.limit(capped_limit).execute()
    rows = result.data or []
    next_cursor = rows[-1]["created_at"] if len(rows) == capped_limit else None

    return {"items": rows, "next_cursor": next_cursor, "result_count": len(rows)}


# --------------------------------------------------------------------------- #
# T032 — GET /audit/policy-blocks/summary (FR-AUD-4) -- Admin only
# --------------------------------------------------------------------------- #


@router.get("/audit/policy-blocks/summary")
async def get_policy_blocks_summary(actor: Actor = Depends(require_operator)):
    supabase = get_supabase()
    require_role(actor, OPERATOR_ROLES, "audit.read.refused", supabase)

    since = datetime.now(timezone.utc).isoformat()
    # "Recently" -- 24h, matching Overview's own abstention-rate window
    # (FR-OV-1) for a consistent reading across views. Real cutoff computed
    # server-side, never guessed client-side.
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    recent = (
        supabase.table("policy_block_events")
        .select("id", count="exact")
        .gte("created_at", cutoff)
        .limit(1)
        .execute()
    )
    escalated_unreviewed = (
        supabase.table("policy_block_events")
        .select("id", count="exact")
        .eq("escalated_to_review", True)
        .limit(1)
        .execute()
    )

    return {
        "recent_count_24h": recent.count or 0,
        # "Flagged for review" is a monitoring signal, not a workable queue --
        # OQ10 (spec.md) has no reviewer/mechanism defined yet. Never presented
        # as clearable from here.
        "escalated_and_unreviewed_count": escalated_unreviewed.count or 0,
        "as_of": since,
    }


# GET /permissions (FR-USR-6) and its PERMISSIONS_MATRIX were removed
# 2026-08-31: their whole purpose was comparing admin/ml_engineer/sre access,
# and with ml_engineer/sre collapsed into admin there is nothing left to
# differentiate. See navigation.ts's ADMIN_NAV comment for the same removal.
