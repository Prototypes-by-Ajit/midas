"""T024 -- run_governed_action()'s shared atomicity sequence, against fake
domain/RPC callables (no live database; this is the pure control-flow logic).

Six terminal states covered — T024's own Done-when names four
(allowed, refused pre-domain-call, refused post-domain-call-with-compensation,
pending-stuck-after-failed-retry); two more are real, distinct branches the
sequence diagram (quickstart.md §4) also describes and are covered here for
completeness: domain-call-itself-fails, and offboard's retry-succeeds path.
"""

import pytest

from app.api.admin import Actor, GovernedActionOutcome, run_governed_action


class FakeAuditEvents:
    """Just enough of the supabase-py chained-query shape for audit_events
    insert/update — `.table("audit_events").insert({...}).execute()` and
    `.table("audit_events").update({...}).eq(...).eq(...).execute()`."""

    def __init__(self):
        self.rows = {}
        self._next_id = 1
        self._pending_update = None
        self._pending_filters = None

    def table(self, name):
        assert name == "audit_events"
        return self

    def insert(self, values):
        evt_id = f"evt_{self._next_id}"
        self._next_id += 1
        row = {"id": evt_id, **values}
        self.rows[evt_id] = row
        self._last_op = ("insert", row)
        return self

    def update(self, values):
        self._pending_update = values
        self._pending_filters = {}
        self._last_op = ("update", values)
        return self

    def eq(self, column, value):
        self._pending_filters[column] = value
        return self

    def execute(self):
        op, payload = self._last_op
        if op == "insert":
            return _Result([payload])
        # update: apply only if every filter matches the stored row (mirrors
        # the DB's WHERE id = ... AND outcome = 'pending' guard)
        row_id = self._pending_filters.get("id")
        row = self.rows.get(row_id)
        if row and all(row.get(k) == v for k, v in self._pending_filters.items()):
            row.update(self._pending_update)
            return _Result([row])
        return _Result([])


class _Result:
    def __init__(self, data):
        self.data = data


@pytest.fixture
def supabase():
    return FakeAuditEvents()


@pytest.fixture
def actor():
    return Actor(id="user_1", role="admin")


# --------------------------------------------------------------------------- #
# 1. Empty/missing reason -- refused before any domain call, no pending row
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_empty_reason_refused_before_any_call(supabase, actor):
    domain_call_ran = False
    rpc_call_ran = False

    async def domain_call():
        nonlocal domain_call_ran
        domain_call_ran = True

    async def rpc_call(pending_evt_id):
        nonlocal rpc_call_ran
        rpc_call_ran = True
        return (pending_evt_id, "allowed")

    result = await run_governed_action(
        supabase, actor, "user.invite", "invite", "a@example.com", "  ",
        domain_call, rpc_call,
    )

    assert result.outcome == "refused"
    assert result.error_code == "EMPTY_REASON"
    assert not domain_call_ran
    assert not rpc_call_ran
    # DB CHECK (length(trim(reason)) > 0) would reject a true empty string --
    # the sentinel is what actually got written.
    assert supabase.rows[result.evt_id]["reason"] == "(no reason provided)"
    assert supabase.rows[result.evt_id]["outcome"] == "refused"


# --------------------------------------------------------------------------- #
# 2. Happy path -- allowed
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_happy_path_allowed(supabase, actor):
    async def domain_call():
        return None

    async def rpc_call(pending_evt_id):
        # Simulates what the real RPC (invite_user() etc.) does: reconciles
        # the row itself via `UPDATE ... SET outcome = 'allowed' WHERE
        # outcome = 'pending'` (data-model.md §4) — the fake must do the same
        # mutation, not just report success.
        supabase.rows[pending_evt_id]["outcome"] = "allowed"
        return (pending_evt_id, "allowed")

    result = await run_governed_action(
        supabase, actor, "user.invite", "invite", "a@example.com", "onboarding",
        domain_call, rpc_call,
    )

    assert result.outcome == "allowed"
    assert supabase.rows[result.evt_id]["outcome"] == "allowed"


# --------------------------------------------------------------------------- #
# 3. Domain call itself fails -- refused, RPC never called
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_domain_call_fails_refused_no_rpc(supabase, actor):
    rpc_call_ran = False

    async def domain_call():
        raise RuntimeError("Clerk unreachable")

    async def rpc_call(pending_evt_id):
        nonlocal rpc_call_ran
        rpc_call_ran = True
        return (pending_evt_id, "allowed")

    result = await run_governed_action(
        supabase, actor, "user.invite", "invite", "a@example.com", "onboarding",
        domain_call, rpc_call,
    )

    assert result.outcome == "refused"
    assert result.error_code == "DOMAIN_CALL_FAILED"
    assert not rpc_call_ran
    assert supabase.rows[result.evt_id]["outcome"] == "refused"


# --------------------------------------------------------------------------- #
# 4. RPC finalize fails, compensation succeeds -- refused (invite/role-change)
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_rpc_fails_compensation_succeeds_refused(supabase, actor):
    compensated = False

    async def domain_call():
        return None

    async def rpc_call(pending_evt_id):
        raise RuntimeError("RPC unreachable")

    async def compensate_call():
        nonlocal compensated
        compensated = True

    result = await run_governed_action(
        supabase, actor, "user.invite", "invite", "a@example.com", "onboarding",
        domain_call, rpc_call, compensate_call=compensate_call,
    )

    assert result.outcome == "refused"
    assert result.error_code == "RPC_FAILED_COMPENSATED"
    assert compensated
    assert supabase.rows[result.evt_id]["outcome"] == "refused"


# --------------------------------------------------------------------------- #
# 5. RPC finalize fails, compensation ALSO fails -- stuck pending, loud not silent
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_rpc_and_compensation_both_fail_stays_pending(supabase, actor, caplog):
    async def domain_call():
        return None

    async def rpc_call(pending_evt_id):
        raise RuntimeError("RPC unreachable")

    async def compensate_call():
        raise RuntimeError("Clerk unreachable for compensation too")

    result = await run_governed_action(
        supabase, actor, "user.invite", "invite", "a@example.com", "onboarding",
        domain_call, rpc_call, compensate_call=compensate_call,
    )

    assert result.outcome == "pending"
    assert result.error_code == "COMPENSATION_FAILED"
    # never silently vanishes -- still pending, not deleted, not silently allowed
    assert supabase.rows[result.evt_id]["outcome"] == "pending"
    assert "governed_action_audit_write_failed" in caplog.text


# --------------------------------------------------------------------------- #
# 6. Offboard shape: no compensate_call -- retry, and the retry can succeed
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_offboard_no_compensate_retries_and_succeeds(supabase, actor):
    call_count = 0

    async def domain_call():
        return None  # session already revoked, no undo possible

    async def rpc_call(pending_evt_id):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("transient RPC failure")
        supabase.rows[pending_evt_id]["outcome"] = "allowed"
        return (pending_evt_id, "allowed")

    result = await run_governed_action(
        supabase, actor, "user.offboard", "user", "user_2", "policy violation",
        domain_call, rpc_call,  # no compensate_call -- offboard shape
    )

    assert result.outcome == "allowed"
    assert call_count == 2
    assert supabase.rows[result.evt_id]["outcome"] == "allowed"


@pytest.mark.asyncio
async def test_offboard_retries_exhausted_stays_pending_never_compensates(supabase, actor, caplog):
    """The revocation (domain_call) already succeeded and is never undone --
    this is the asymmetry eng review Tension 3 corrected. Access stays cut
    even though the audit trail hasn't caught up yet."""
    async def domain_call():
        return None

    async def rpc_call(pending_evt_id):
        raise RuntimeError("RPC persistently unreachable")

    result = await run_governed_action(
        supabase, actor, "user.offboard", "user", "user_2", "policy violation",
        domain_call, rpc_call,  # no compensate_call
    )

    assert result.outcome == "pending"
    assert result.error_code == "RETRY_EXHAUSTED"
    assert supabase.rows[result.evt_id]["outcome"] == "pending"
    assert "governed_action_audit_write_failed" in caplog.text
