"""T015 -- each `_oos()` call site in the live domain classifier now tags its
return value with a `classification` (research.md R5's four-value vocabulary),
read at the write call site in `main_orchestrator.py` (T019) for
`policy_block_events.classification`. `_oos()`'s own signature, its
`reasoning` string, and its confidence value are all untouched -- only the
dict each call site returns gains one new key.

**Sites 4 and 5 are dead code under the current control flow, discovered while
writing this test -- not assumed, not worked around.**

`classify_domain()`'s fast path (line ~102) returns early whenever
`not has_inscope and not is_referential`. Reaching the LLM-verify block
(line ~134, where sites 4 and 5 live) therefore requires `is_referential is
False` (or the `if is_referential:` block would have returned first) *and*
`has_inscope is True` (or the fast path would have fired). `has_inscope` is
computed once, at the top of the method, and never re-evaluated -- so by the
time execution reaches `if has_inscope:` inside the `None`/`except` handlers
at lines ~138 and ~148, it is always `True`. The `_oos(...)` fallback at
lines ~144-145 and ~154-155 (the two `classifier_fail_closed` sites) can
therefore never execute via a real query through the public `classify_domain()`
entry point -- the `has_inscope` guard around them is unsatisfiable given how
`has_inscope` is established upstream.

This means: `policy_block_events.classification` can currently be written as
`no_dermatology_keywords`, `referential_without_context`, or
`followup_new_topic` (sites 1-3, all real and tested below), but never as
`classifier_fail_closed` -- contradicting research.md R5's assumption that
sites 4 and 5 are live, reachable branches. The tagging edit at those two
lines is still correct (harmless, matches the documented design, and would
work immediately if the surrounding dead-code condition were ever fixed), but
FR-AUD-4's `classifier_fail_closed` value is currently unreachable in
production. Flagged here rather than silently worked around or asserted away
with a test that doesn't actually exercise the real code path -- see
`test_sites_4_and_5_are_unreachable_dead_code` below, which documents the
finding as a regression guard: if a future fix to the surrounding `if
has_inscope:` guards ever makes these sites reachable, this test starts
failing loudly instead of the discovery silently disappearing.
"""

import pytest

from app.agents.dynamic_guardrails_classifier import DynamicGuardrailsClassifier


@pytest.fixture
def classifier():
    return DynamicGuardrailsClassifier()


# --------------------------------------------------------------------------- #
# Sites 1-3: real, reachable, tested against the actual classify_domain() path
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_site_1_no_dermatology_keywords(classifier):
    """Fast path: no derm keywords, not a followup."""
    result = await classifier.classify_domain("how do I bake a chocolate cake")
    assert result["domain"] == "OUT_OF_SCOPE"
    assert result["classification"] == "no_dermatology_keywords"


@pytest.mark.asyncio
async def test_site_2_referential_without_context(classifier):
    """Referential query, no history at all -- _has_derm_context([]) is False
    by construction (dynamic_guardrails_classifier.py:210-211)."""
    result = await classifier.classify_domain("tell me more", conversation_history=[])
    assert result["domain"] == "OUT_OF_SCOPE"
    assert result["classification"] == "referential_without_context"


@pytest.mark.asyncio
async def test_site_3_followup_new_topic(classifier):
    """Referential query, derm context exists, but the residual topic (after
    stripping the referential wrapper) introduces something out of scope."""
    history = [{"content": "Melanoma is a serious skin cancer that often requires biopsy."}]
    result = await classifier.classify_domain(
        "tell me more about docker", conversation_history=history
    )
    assert result["domain"] == "OUT_OF_SCOPE"
    assert result["classification"] == "followup_new_topic"


# --------------------------------------------------------------------------- #
# Sites 4-5: dead code, documented rather than papered over
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_sites_4_and_5_are_unreachable_dead_code(classifier, monkeypatch):
    """Regression guard for the finding in this file's module docstring.

    Construct the one input shape that reaches the LLM-verify block at all
    (in-scope keyword present, not referential, no strong keyword match), then
    force `_llm_classify` to return None -- the exact trigger site 4's
    `_oos(...)` call is written to catch. If the surrounding `has_inscope`
    guard were ever satisfiable when False, this would return
    `classifier_fail_closed`. It does not: `has_inscope` is True by
    construction at this point (see module docstring), so the IN_SCOPE
    fallback fires instead, and `classification` is absent from the result
    entirely (IN_SCOPE_MEDICAL_DERM never carries one).

    If this test starts failing, sites 4/5 have become reachable -- update
    this file's docstring and this test, not just the assertion.
    """
    query = "itching and a growing mole"  # has_inscope=True (keywords), not referential

    async def fake_llm_classify_returns_none(self, q):
        return None

    monkeypatch.setattr(
        DynamicGuardrailsClassifier, "_llm_classify", fake_llm_classify_returns_none
    )

    result = await classifier.classify_domain(query)

    assert result["domain"] == "IN_SCOPE_MEDICAL_DERM", (
        "sites 4/5 are dead code under the current has_inscope guard (see module "
        "docstring); if this assertion now fails, the guard changed and "
        "classifier_fail_closed has become reachable -- that's a real change, "
        "not a test bug"
    )
    assert "classification" not in result
