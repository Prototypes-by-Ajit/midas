"""T018 -- `subject_role` reaches `MainOrchestrator.process_query()` from a real
request, not just "the parameter exists" (T016) or "it's in scope" (T017).

Traces the whole chain in one test: `QueryRequest.subject_role` (T016) ->
`create_message()`'s call to `process_query()` (the wiring this file's own
`main_agent.py:388-394` needed, caught while implementing T018 -- the task list
never named this call site explicitly, only "the parameter is in scope") ->
`process_query()`'s own signature (T017). Without this last hop the whole
`subject_role` chain silently carries `None` all the way to `_record_policy_block`
regardless of what the frontend BFF sends (T018's frontend half, tested
separately -- `npx tsc --noEmit` only proves the frontend compiles, not that the
backend actually receives what it sends).
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.main_agent import QueryRequest, create_message


@pytest.mark.asyncio
async def test_subject_role_reaches_process_query():
    request = QueryRequest(query="what is melanoma", user_id="user_123", subject_role="patient")

    with patch("app.main_agent.chat_persistence.save_message", new=AsyncMock(return_value=None)), \
         patch(
             "app.main_agent.main_orchestrator.process_query",
             new=AsyncMock(return_value={"answer": "x", "citations": [], "confidence": 1.0, "route": "rag"}),
         ) as mock_process_query:
        await create_message(session_id="sess_1", request=request)

    mock_process_query.assert_awaited_once()
    _, kwargs = mock_process_query.call_args
    assert kwargs["subject_role"] == "patient", (
        "create_message() did not forward request.subject_role to "
        "process_query() -- the T016/T017 chain is wired but not connected "
        "at this call site"
    )


@pytest.mark.asyncio
async def test_missing_subject_role_stays_none_not_dropped_silently():
    """Backward compatibility (T016): an old caller that never sends
    subject_role must not crash create_message(), and must arrive at
    process_query() as None (handled by _record_policy_block's own guard),
    not some other fabricated default."""
    request = QueryRequest(query="what is melanoma", user_id="user_123")

    with patch("app.main_agent.chat_persistence.save_message", new=AsyncMock(return_value=None)), \
         patch(
             "app.main_agent.main_orchestrator.process_query",
             new=AsyncMock(return_value={"answer": "x", "citations": [], "confidence": 1.0, "route": "rag"}),
         ) as mock_process_query:
        await create_message(session_id="sess_1", request=request)

    _, kwargs = mock_process_query.call_args
    assert kwargs["subject_role"] is None
