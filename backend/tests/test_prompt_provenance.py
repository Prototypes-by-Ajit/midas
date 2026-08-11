"""T012 [US5] -- only measurements reach the prompt.

Constitution II names this as a non-negotiable, and today it exists solely as the
comment at `report_generator.py:201-204`. A comment is not a guard: any future
edit to `build_user_prompt` or `build_evidence_block` can quietly widen the
evidence block, and nothing would notice.

Three row-carried sources must never reach the model (FR-033):

  `detected_features`   pipeline-generated placeholders, not measurements --
                        reading them launders a fabrication into fresh clinical
                        narrative every time an old analysis is re-reported
  free text             `recommendations` and `error_message`, both written by
                        earlier stages and neither a measurement
  `image_name`          user-supplied, and identifying

Asserted on the messages actually handed to the model, not just on
`build_user_prompt` -- the system prompt is half the prompt, and a future edit
could interpolate the row into either one. Offline: the model boundary is stubbed.
"""

import asyncio
from types import SimpleNamespace

import pytest

from app.services import report_generator
from app.services.report_generator import build_user_prompt, system_prompt_for
from helpers import REPORT_TYPES

# Sentinels a substring search cannot miss and no template can coincidentally
# produce. Each stands in for one prohibited source.
POISON = {
    "detected_features": ["ZZFEATUREASYMMETRYZZ", "ZZFEATUREBORDERZZ"],
    "recommendations": ["ZZNOTERECOMMENDZZ consult within two weeks"],
    "error_message": "ZZNOTEERRORZZ retry 3 of 5",
    "image_name": "ZZIMAGENAMEZZ-left-shoulder.jpg",
}

PROHIBITED_TOKENS = (
    "ZZFEATUREASYMMETRYZZ",
    "ZZFEATUREBORDERZZ",
    "ZZNOTERECOMMENDZZ",
    "ZZNOTEERRORZZ",
    "ZZIMAGENAMEZZ",
)


@pytest.fixture
def analysis_poisoned(analysis_complete):
    """An owned, complete row carrying a sentinel in every prohibited column."""
    return {**analysis_complete, **POISON}


def _sent_prompt(analysis, report_type, monkeypatch) -> str:
    """Every message `generate_llm_content` actually sends, concatenated."""
    captured = {}

    def _fake_completion(*_args, **kwargs):
        captured["messages"] = kwargs["messages"]
        message = SimpleNamespace(content='{"summary": "s", "observations": "o", '
                                          '"recommendations": ["r"], "limitations": "l"}')
        return SimpleNamespace(choices=[SimpleNamespace(message=message)]), "stub/model"

    monkeypatch.setattr(report_generator, "get_nvidia_client", lambda: object())
    monkeypatch.setattr(report_generator, "create_chat_completion", _fake_completion)
    asyncio.run(report_generator.generate_llm_content(analysis, report_type))

    return "\n".join(str(m.get("content", "")) for m in captured["messages"])


# --------------------------------------------------------------------------- #
# Nothing prohibited reaches the model
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_no_prohibited_source_reaches_the_sent_prompt(analysis_poisoned, report_type, monkeypatch):
    prompt = _sent_prompt(analysis_poisoned, report_type, monkeypatch)
    leaked = [token for token in PROHIBITED_TOKENS if token in prompt]
    assert not leaked, f"{report_type} sent prohibited row content to the model: {leaked}"


@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_no_prohibited_source_reaches_the_user_prompt(analysis_poisoned, report_type):
    """The same claim at the unit that assembles the per-analysis half."""
    prompt = build_user_prompt(analysis_poisoned, report_type)
    leaked = [token for token in PROHIBITED_TOKENS if token in prompt]
    assert not leaked, f"{report_type} user prompt leaked: {leaked}"


@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_system_prompt_is_row_independent(analysis_poisoned, report_type):
    """The role prompt is a constant; a row must not be interpolated into it."""
    leaked = [token for token in PROHIBITED_TOKENS if token in system_prompt_for(report_type)]
    assert not leaked, f"{report_type} system prompt leaked: {leaked}"


# --------------------------------------------------------------------------- #
# ...and the measurements that ARE permitted still do -- [protect]
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("report_type", REPORT_TYPES)
def test_permitted_evidence_still_reaches_the_prompt(analysis_poisoned, report_type):
    """Without this the suite would pass on an empty prompt.

    Contract §5 permits confidence, top2_gap, entropy and the ranked
    class_probabilities -- everything the narrative reasons from.
    """
    prompt = build_user_prompt(analysis_poisoned, report_type)
    assert "Melanoma" in prompt
    assert "87.3" in prompt, "the confidence measurement is missing from the evidence block"
    assert "Differential" in prompt, "the ranked distribution is missing from the evidence block"
