"""
Live-DB concurrency check for `invite_user()`'s advisory lock (T066, FR-USR-3).

Two concurrent `invite_user()` calls for the SAME email must produce exactly
one 'allowed' + one 'duplicate' -- never two 'allowed' -- verifying the
`pg_advisory_xact_lock` T009 added actually serializes the duplicate check
(eng review Tension 4's own concern, and T068's "no row left `pending`"
guarantee: the loser's pending row is reconciled to 'refused', not stranded).

Needs live Supabase credentials (.env/.env.backend) and network access. Not
run by `python -m pytest tests/` (that command's own convention, per
`test_admin_denials.py`'s docstring, is "no live server, no live database" --
this needs both, so it lives at `backend/test_*.py`, same convention as
`test_supabase_connection.py` and friends). Leaves two permanent rows in
`audit_events` (append-only, T008) -- `p_email` is synthetic and receives no
real invitation (no Clerk call happens here at all; this exercises the RPC
directly, not the BFF's `inviteUser()`).

    cd backend && source venv/bin/activate && python test_admin_concurrency.py
"""
import sys
import threading
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.config import settings  # noqa: E402
from supabase import create_client  # noqa: E402

TEST_ACTOR_ID = "test_t066_concurrency_actor"


def _client():
    if not settings.supabase_url or not settings.supabase_service_key:
        print("SKIP: SUPABASE_URL / SUPABASE_SERVICE_KEY not configured.")
        sys.exit(0)
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _insert_pending(client, email: str) -> str:
    row = client.table("audit_events").insert({
        "actor_id": TEST_ACTOR_ID,
        "actor_role": "admin",
        "action": "user.invite",
        "target_type": "invite",
        "target_id": email,
        "reason": "T066 concurrency check",
        "outcome": "pending",
    }).execute()
    return row.data[0]["id"]


def _call_invite(email: str, pending_evt_id: str, results: list, idx: int) -> None:
    client = _client()
    resp = client.rpc("invite_user", {
        "p_actor_id": TEST_ACTOR_ID,
        "p_actor_role": "admin",
        "p_email": email,
        "p_role": "clinician",
        "p_site": None,
        "p_reason": "T066 concurrency check",
        "p_pending_evt_id": pending_evt_id,
        "p_idempotency_key": pending_evt_id,
    }).execute()
    row = resp.data[0] if isinstance(resp.data, list) else resp.data
    results[idx] = row["outcome"]


def main() -> None:
    setup_client = _client()
    email = f"t066-concurrency-{uuid.uuid4().hex[:8]}@example.invalid"

    pending_a = _insert_pending(setup_client, email)
    pending_b = _insert_pending(setup_client, email)

    results: list = [None, None]
    threads = [
        threading.Thread(target=_call_invite, args=(email, pending_a, results, 0)),
        threading.Thread(target=_call_invite, args=(email, pending_b, results, 1)),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    print(f"Results for {email}: {results}")
    allowed = results.count("allowed")
    duplicate = results.count("duplicate")
    assert allowed == 1, f"expected exactly 1 'allowed', got {allowed} ({results})"
    assert duplicate == 1, f"expected exactly 1 'duplicate', got {duplicate} ({results})"

    # T068's own guarantee, checked directly: neither pending row was left
    # stranded at 'pending' -- one is 'allowed', the other 'refused'.
    rows = (
        setup_client.table("audit_events")
        .select("id,outcome")
        .in_("id", [pending_a, pending_b])
        .execute()
    ).data
    stuck = [r for r in rows if r["outcome"] == "pending"]
    assert not stuck, f"row(s) left stuck at 'pending', audit_events_pending_idx would catch: {stuck}"

    print("PASS: exactly one allowed + one duplicate, advisory lock holds, no row left pending.")


if __name__ == "__main__":
    main()
