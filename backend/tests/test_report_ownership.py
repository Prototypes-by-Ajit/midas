"""T008 [US3] -- ownership and credential refusals.

Reproduces two defects:

1. `_build_report_context` defaults `scope_user=False`, so the live endpoint
   fetches the analysis row with no owner predicate and renders another person's
   analysis (FR-005; edge case 11). The refusal must happen *before* any render.
2. `verify_api_key` falls back to the literal `"test-key"` when `BACKEND_API_KEY`
   is unset, so a credential published in the source authorises the service
   (FR-007).

Both run offline: Supabase is a recording stub, the credential cases only touch
the environment.
"""

import asyncio
import os

import pytest
from fastapi import HTTPException

from app.api.reports import GenerateReportRequest, _build_report_context, verify_api_key
from helpers import FakeSupabase


def _request(analysis, caller_user_id, report_type="diagnostic_summary"):
    return GenerateReportRequest(
        report_id="b4d1e7f0-1234-4c56-89ab-cdef01234567",
        analysis_id=analysis["id"],
        report_type=report_type,
        user_id=caller_user_id,
        report_number="MIDAS-REP-20260714-K3P9XQ",
    )


# --------------------------------------------------------------------------- #
# Ownership
# --------------------------------------------------------------------------- #

def test_foreign_owned_analysis_is_not_found(analysis_foreign_owner, analysis_complete):
    """The caller owns `analysis_complete`; they ask for someone else's row."""
    caller = analysis_complete["user_id"]
    supabase = FakeSupabase([analysis_foreign_owner])

    with pytest.raises(HTTPException) as excinfo:
        _build_report_context(_request(analysis_foreign_owner, caller), supabase)

    assert excinfo.value.status_code == 404


def test_owner_predicate_is_always_sent(analysis_complete):
    """FR-005: the service confirms ownership itself, not only its caller."""
    supabase = FakeSupabase([analysis_complete])
    _build_report_context(_request(analysis_complete, analysis_complete["user_id"]), supabase)

    assert ("user_id", analysis_complete["user_id"]) in supabase.filters, (
        f"query filtered only on {supabase.filters!r}"
    )


def test_refusal_precedes_any_render(analysis_foreign_owner, analysis_complete):
    """Nothing may be fetched, decoded, or built for a row the caller cannot have."""
    caller = analysis_complete["user_id"]
    supabase = FakeSupabase([analysis_foreign_owner])

    with pytest.raises(HTTPException):
        _build_report_context(_request(analysis_foreign_owner, caller), supabase)

    assert supabase.storage_calls == [], (
        f"touched storage before refusing: {supabase.storage_calls!r}"
    )


def test_owned_analysis_still_builds(analysis_complete):
    # [already satisfied -- protect] the golden path must survive the scoping fix.
    supabase = FakeSupabase([analysis_complete])
    context = _build_report_context(
        _request(analysis_complete, analysis_complete["user_id"]), supabase
    )
    assert context["analysis"]["id"] == analysis_complete["id"]
    assert context["report_number"] == "MIDAS-REP-20260714-K3P9XQ"


# --------------------------------------------------------------------------- #
# Credential
# --------------------------------------------------------------------------- #

def test_unconfigured_credential_refuses(monkeypatch):
    """FR-007: no default value. An unset key must refuse, not accept 'test-key'."""
    monkeypatch.delenv("BACKEND_API_KEY", raising=False)

    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(verify_api_key(authorization="Bearer test-key"))

    # T048 specifies 503: the service is misconfigured, not the caller unauthorised.
    assert excinfo.value.status_code == 503


def test_unconfigured_credential_refuses_every_token(monkeypatch):
    monkeypatch.delenv("BACKEND_API_KEY", raising=False)
    for token in ("test-key", "", "anything", "Bearer"):
        with pytest.raises(HTTPException):
            asyncio.run(verify_api_key(authorization=f"Bearer {token}"))


def test_wrong_key_refuses(monkeypatch):
    # [already satisfied -- protect]
    monkeypatch.setenv("BACKEND_API_KEY", "a-real-configured-secret")
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(verify_api_key(authorization="Bearer not-the-secret"))
    assert excinfo.value.status_code == 401


def test_correct_key_is_accepted(monkeypatch):
    # [already satisfied -- protect]
    monkeypatch.setenv("BACKEND_API_KEY", "a-real-configured-secret")
    assert asyncio.run(verify_api_key(authorization="Bearer a-real-configured-secret")) is True


def test_missing_authorization_header_refuses(monkeypatch):
    # [already satisfied -- protect]
    monkeypatch.setenv("BACKEND_API_KEY", "a-real-configured-secret")
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(verify_api_key(authorization=None))
    assert excinfo.value.status_code == 401


def test_published_default_is_absent_from_the_source():
    """The literal must not survive anywhere in the module."""
    import inspect

    from app.api import reports

    assert '"test-key"' not in inspect.getsource(reports)
    assert "'test-key'" not in inspect.getsource(reports)
