"""T013 [US2] -- the response envelope and the provenance headers.

Two claims, both at the HTTP boundary rather than at the function:

  Errors  every JSON error is `{error, code, details?}` (contract §6) and carries
          no `str(e)`, no stack frame, no credential. Today `reports.py:240`
          interpolates the exception straight into the browser response, and
          FastAPI's default handler emits `{"detail": ...}`, which is not the
          envelope anything on the other side parses.

  Headers `X-Report-Sections` and `X-Report-Generator` are always emitted, and
          `X-Report-Degraded` appears only when a section is absent (contract §3,
          A11/A12). None of the three exists today, so the orchestrator has to
          infer the outcome from the document -- which it cannot do.

The app is assembled here rather than imported from `main_agent`, which would
drag in the whole chat pipeline. Supabase is the recording stub and the model
boundary is patched, so this runs offline. The fixtures with no stored overlay
are used deliberately: an overlay would put a signed URL in front of WeasyPrint,
and this test is about headers, not storage.
"""

import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import reports
from app.services import report_generator
from helpers import FakeSupabase, REPORT_TYPES, SUPPLIED_REPORT_NUMBER

API_KEY = "a-real-configured-secret"

MODEL_ID = "meta/llama-3.3-70b-instruct"

# What a leaked exception looks like: a credential and someone else's path.
LEAKY_FAILURE = (
    "nvapi-SECRET-TOKEN-abc123 rejected while reading "
    "user_2zyxWVUtsrQPOnmlKJIhgFEd/reports/9a8b7c6d.pdf"
)

STACK_FRAME = re.compile(r"Traceback|File \"|line \d+, in ", re.IGNORECASE)

STRUCTURED_NARRATIVE = (
    '{"summary": "The leading classification for this lesion is melanoma.", '
    '"observations": "The distribution is sharply peaked.", '
    '"recommendations": ["Book a dermatology appointment within two weeks."], '
    '"limitations": "A single image cannot establish depth or margin."}'
)

PROSE_ONLY_NARRATIVE = (
    "The leading classification for this lesion is melanoma at roughly 87 percent."
)


def _client(supabase, monkeypatch, *, narrative=STRUCTURED_NARRATIVE, fail_with=None):
    """A one-router app with the Supabase dependency and the model both stubbed."""

    def _fake_completion(*_args, **_kwargs):
        if fail_with is not None:
            raise fail_with
        from types import SimpleNamespace

        message = SimpleNamespace(content=narrative)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)]), MODEL_ID

    monkeypatch.setenv("BACKEND_API_KEY", API_KEY)
    monkeypatch.setattr(report_generator, "get_nvidia_client", lambda: object())
    monkeypatch.setattr(report_generator, "create_chat_completion", _fake_completion)

    app = FastAPI()
    app.include_router(reports.router, prefix="/api/v1")
    app.dependency_overrides[reports.get_supabase] = lambda: supabase
    return TestClient(app)


def _post(client, analysis, report_type="diagnostic_summary", key=API_KEY):
    return client.post(
        "/api/v1/reports/generate",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "report_id": "b4d1e7f0-1234-4c56-89ab-cdef01234567",
            "analysis_id": analysis["id"],
            "report_type": report_type,
            "user_id": analysis["user_id"],
            "report_number": SUPPLIED_REPORT_NUMBER,
        },
    )


def _assert_envelope(response):
    """Contract §6: `{error, code, details?}` and nothing else."""
    body = response.json()
    assert isinstance(body, dict), body
    assert "error" in body, f"no `error` key in {body}"
    assert "code" in body, f"no `code` key in {body}"
    assert set(body) <= {"error", "code", "details"}, f"extra keys in {body}"
    return body


# --------------------------------------------------------------------------- #
# Error envelope
# --------------------------------------------------------------------------- #

def test_render_failure_returns_the_contract_envelope(analysis_no_overlay, monkeypatch):
    supabase = FakeSupabase([analysis_no_overlay])
    client = _client(supabase, monkeypatch, fail_with=RuntimeError(LEAKY_FAILURE))

    response = _post(client, analysis_no_overlay)

    assert response.status_code == 500
    _assert_envelope(response)


def test_render_failure_leaks_neither_credential_nor_path(analysis_no_overlay, monkeypatch):
    """FR-034, contract §6: `details` carries no secret and no foreign path."""
    supabase = FakeSupabase([analysis_no_overlay])
    client = _client(supabase, monkeypatch, fail_with=RuntimeError(LEAKY_FAILURE))

    raw = _post(client, analysis_no_overlay).text

    assert "nvapi-" not in raw, f"credential reached the caller: {raw}"
    assert "user_2zyxWVUtsrQPOnmlKJIhgFEd" not in raw, f"foreign path reached the caller: {raw}"
    assert not STACK_FRAME.search(raw), f"stack frame reached the caller: {raw}"


def test_not_found_returns_the_contract_envelope(analysis_complete, monkeypatch):
    """An analysis the service does not hold. 404, in the envelope, saying nothing else."""
    client = _client(FakeSupabase([]), monkeypatch)

    response = _post(client, analysis_complete)

    assert response.status_code == 404
    body = _assert_envelope(response)
    # FR-009: a refusal discloses nothing about the target beyond its code.
    assert analysis_complete["image_name"] not in response.text
    assert body["code"]


def test_bad_credential_returns_the_contract_envelope(analysis_complete, monkeypatch):
    client = _client(FakeSupabase([analysis_complete]), monkeypatch)

    response = _post(client, analysis_complete, key="not-the-secret")

    assert response.status_code == 401
    _assert_envelope(response)


def test_no_error_response_echoes_the_credential(analysis_complete, monkeypatch):
    """[protect] whatever the envelope becomes, it must never contain the key."""
    client = _client(FakeSupabase([analysis_complete]), monkeypatch)
    response = _post(client, analysis_complete, key="not-the-secret")
    assert API_KEY not in response.text


# --------------------------------------------------------------------------- #
# Provenance headers
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_complete_report_emits_sections_and_generator(
    analysis_no_overlay, report_type, monkeypatch
):
    supabase = FakeSupabase([analysis_no_overlay])
    client = _client(supabase, monkeypatch)

    response = _post(client, analysis_no_overlay, report_type)

    assert response.status_code == 200, response.text
    assert response.headers.get("X-Report-Sections") == (
        "summary,observations,recommendations,limitations"
    )
    assert response.headers.get("X-Report-Generator") == MODEL_ID


def test_complete_report_omits_the_degraded_header(analysis_no_overlay, monkeypatch):
    """Omitted, not empty: an empty header reads as a reason nobody wrote.

    [protect] Passes today only because no `X-Report-*` header exists at all. It
    reproduces nothing until T039 emits the other two; its job is to stop T039
    from emitting this one unconditionally.
    """
    supabase = FakeSupabase([analysis_no_overlay])
    client = _client(supabase, monkeypatch)

    response = _post(client, analysis_no_overlay)

    assert response.status_code == 200, response.text
    assert "X-Report-Degraded" not in response.headers


def test_degraded_report_names_its_absent_sections_in_the_headers(
    analysis_no_overlay, monkeypatch
):
    supabase = FakeSupabase([analysis_no_overlay])
    client = _client(supabase, monkeypatch, narrative=PROSE_ONLY_NARRATIVE)

    response = _post(client, analysis_no_overlay)

    assert response.status_code == 200, response.text
    assert response.headers.get("X-Report-Sections") == "summary"

    reason = response.headers.get("X-Report-Degraded")
    assert reason, "a degraded report must say why, in the header the orchestrator reads"
    for absent in ("observations", "recommendations", "limitations"):
        assert absent in reason.lower(), f"{absent} is missing but unnamed in: {reason!r}"
