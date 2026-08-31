"""T025 -- one test per row of contract.md §4's authority table.

Written now, against `admin.router`, which exists (T024) but has zero routes
registered — Phase 7 (T026-T037) adds the actual endpoints and mounts the
router. Every test below therefore currently gets 404 (the route doesn't
exist), not the 401/403/200 it asserts — expected, per this task's own
instructions, and confirms these tests exercise something real once Phase
7-8 land, not a route that trivially returns the right code because nothing
is there to misbehave. T041 re-runs this file once Phase 7-8 are built and
turns it from red to green; nothing here should be rewritten to match
whatever wrong behavior shows up in between (checkpoint C5's own rule).

Local `FastAPI()` + `TestClient`, same shape as `test_report_headers.py` --
no live server, no live database.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import admin


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(admin.router, prefix="/api/v1/admin")
    return TestClient(app)


ADMIN_ONLY_READS = [
    ("GET", "/api/v1/admin/users"),
    ("GET", "/api/v1/admin/users/user_123"),
]
OPERATOR_READS = [  # the sole operator role: admin (ml_engineer/sre collapsed in, 2026-08-31)
    ("GET", "/api/v1/admin/overview"),
    ("GET", "/api/v1/admin/health/services"),
    ("GET", "/api/v1/admin/rag/ingestion"),
]
AUDIT_READS = [  # audit family: admin only (was admin + sre before the collapse)
    ("GET", "/api/v1/admin/audit"),
    ("GET", "/api/v1/admin/audit/policy-blocks/summary"),
    ("GET", "/api/v1/admin/audit/policy-blocks"),  # T074 -- same family, same gate
]
ADMIN_ONLY_WRITES = [
    ("POST", "/api/v1/admin/users/invite"),
    ("PATCH", "/api/v1/admin/users/user_123/role"),
    ("POST", "/api/v1/admin/users/user_123/offboard"),
]


# --------------------------------------------------------------------------- #
# "Every /admin/* request, allowed or denied" (eng review finding 2) — every
# route re-checks role, not just the ones that end up denying.
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("method,path", OPERATOR_READS + AUDIT_READS + ADMIN_ONLY_READS)
def test_missing_actor_headers_refused(client, method, path):
    """No X-Actor-Id/X-Actor-Role at all -- require_operator() refuses before
    any role-allowlist check runs. Currently 404 (route doesn't exist yet);
    once Phase 7 lands this must be 401, never a silent pass-through."""
    resp = client.request(method, path)
    assert resp.status_code in (401, 404), (
        f"{method} {path} with no actor headers returned {resp.status_code}, "
        "expected 401 (once built) or 404 (route not built yet)"
    )


# --------------------------------------------------------------------------- #
# Non-operator refused on every read route, each with its own per-route action
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "method,path,expected_action",
    [
        ("GET", "/api/v1/admin/overview", "overview.read.refused"),
        ("GET", "/api/v1/admin/health/services", "health.read.refused"),
        ("GET", "/api/v1/admin/rag/ingestion", "rag.read.refused"),
    ],
)
def test_non_operator_refused_on_every_read_route(client, method, path, expected_action):
    """A patient/clinician role (never an operator role at all) hitting an
    admin read route. Currently 404; once built, must be 403 with an
    `{expected_action}` audit row -- speckit-analyze finding F1's fix."""
    resp = client.request(method, path, headers={"X-Actor-Id": "u1", "X-Actor-Role": "patient"})
    assert resp.status_code in (403, 404)


# --------------------------------------------------------------------------- #
# Non-admin (clinician/patient — the only other roles that exist post-
# collapse) refused on every Users & Roles route individually — not just the
# directory (speckit-analyze finding C2: this used to be bucketed generically
# under "/users"). Previously parametrized over ml_engineer/sre, which no
# longer exist as roles (2026-08-31 collapse into admin).
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("method,path", ADMIN_ONLY_READS + ADMIN_ONLY_WRITES)
@pytest.mark.parametrize("role", ["clinician", "patient"])
def test_non_admin_refused_on_users_and_roles_routes(client, method, path, role):
    resp = client.request(method, path, headers={"X-Actor-Id": "u1", "X-Actor-Role": role})
    assert resp.status_code in (403, 404), f"{role} on {method} {path} -> {resp.status_code}"


# --------------------------------------------------------------------------- #
# Non-admin refused on the audit family too — same boundary as above, tested
# separately since Audit & Incidents used to have its own admin+sre gate
# (speckit-analyze finding E1) distinct from the Users & Roles gate. That
# distinction collapsed into a single admin-only gate on 2026-08-31.
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("method,path", AUDIT_READS)
@pytest.mark.parametrize("role", ["clinician", "patient"])
def test_non_admin_refused_on_audit_routes(client, method, path, role):
    resp = client.request(method, path, headers={"X-Actor-Id": "u1", "X-Actor-Role": role})
    assert resp.status_code in (403, 404)


# --------------------------------------------------------------------------- #
# A governed-action request has an empty reason — refused before any Clerk/
# RPC call, same audit shape as an unauthorized-role attempt.
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("method,path", ADMIN_ONLY_WRITES)
def test_empty_reason_refused_before_any_call(client, method, path):
    resp = client.request(
        method, path,
        headers={"X-Actor-Id": "u1", "X-Actor-Role": "admin"},
        json={"reason": ""},
    )
    assert resp.status_code in (400, 404)


# --------------------------------------------------------------------------- #
# Not yet buildable at this phase — placeholders naming what T041 must add,
# so the authority table's remaining rows aren't silently dropped from this
# file's coverage between now and Phase 8.
# --------------------------------------------------------------------------- #


@pytest.mark.skip(reason="needs Phase 8's real invite_user() RPC + Clerk mock — added at T041")
def test_last_admin_refused_with_structured_log_line():
    pass


@pytest.mark.skip(reason="needs Phase 8's real run_governed_action() call sites — added at T041")
def test_identical_retry_produces_identical_outcome():
    pass
