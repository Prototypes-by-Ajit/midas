"""
Offline guard for streaming report generation.

Covers the incremental summary extractor and the sync->async bridge. No network,
no database, no model. Run from backend/ with the venv active:
    python test_report_stream.py
"""
import asyncio
import json

from app.services.report_stream import SummaryDeltas, aiter_blocking

# A realistic response: fenced, with a paragraph break, an escaped quote, an
# escaped backslash and a non-ASCII \u escape in the summary -- plus a second
# field that must never reach the reader.
PAYLOAD = (
    '```json\n'
    '{"summary": "Line one.\\n\\nShe said \\"maybe\\" today. 50\\\\50 caf\\u00e9.",'
    ' "observations": "SHOULD NOT LEAK",'
    ' "recommendations": ["a", "b"],'
    ' "limitations": "ALSO SHOULD NOT LEAK"}\n'
    '```'
)
EXPECTED = json.loads(PAYLOAD.split("```json\n")[1].rsplit("\n```", 1)[0])["summary"]


def _drain(chunks):
    extractor = SummaryDeltas()
    return "".join(extractor.feed(c) for c in chunks), extractor


def test_extractor_matches_json_loads():
    """The extractor must be equivalent to parsing, for a complete response."""
    got, _ = _drain([PAYLOAD])
    assert got == EXPECTED, repr(got)
    assert "\n\n" in got, "paragraph break must survive unescaping"
    assert '"maybe"' in got, "escaped quotes must unescape, not terminate"
    assert "50\\50" in got, "escaped backslash must unescape to one backslash"
    assert "café" in got, r"\uXXXX must decode"
    print("ok  extractor_matches_json_loads")


def test_extractor_survives_every_split_point():
    """The regression guard: a token boundary anywhere must not corrupt output.

    Providers chunk responses arbitrarily, so an escape sequence can be split
    across two deltas. Output must be identical regardless of where the cut is.
    """
    for cut in range(len(PAYLOAD) + 1):
        got, _ = _drain([PAYLOAD[:cut], PAYLOAD[cut:]])
        assert got == EXPECTED, f"split at {cut} produced {got!r}"
    print(f"ok  extractor_survives_every_split_point ({len(PAYLOAD) + 1} splits)")


def test_extractor_char_by_char():
    got, extractor = _drain(list(PAYLOAD))
    assert got == EXPECTED, repr(got)
    assert "SHOULD NOT LEAK" not in extractor.text
    assert "ALSO SHOULD NOT LEAK" not in extractor.text
    print("ok  extractor_char_by_char")


def test_extractor_stops_at_closing_quote():
    """Fields after `summary` must not leak into the streamed narrative."""
    _, extractor = _drain([PAYLOAD])
    assert extractor.feed('{"more": "later"}') == "", "must ignore input after the value"
    assert "SHOULD NOT LEAK" not in extractor.text
    print("ok  extractor_stops_at_closing_quote")


def test_extractor_truncated_midvalue():
    """finish_reason == 'length' leaves the object unclosed. Recover the prose."""
    truncated = '{"summary": "The lesion was classified as melanoma with'
    got, extractor = _drain([truncated])
    assert got == "The lesion was classified as melanoma with", repr(got)
    assert extractor.text == got
    # A trailing lone backslash is held back rather than emitted broken.
    got2, _ = _drain(['{"summary": "ends with an escape\\'])
    assert got2 == "ends with an escape", repr(got2)
    print("ok  extractor_truncated_midvalue")


def test_extractor_unfenced_and_pretty_printed():
    for raw in (
        '{"summary": "plain", "observations": "x"}',
        '{\n  "summary" : "plain",\n  "observations": "x"\n}',
        'Here you go:\n```\n{"summary":"plain"}\n```',
    ):
        got, _ = _drain([raw])
        assert got == "plain", f"{raw!r} produced {got!r}"
    print("ok  extractor_unfenced_and_pretty_printed")


def test_extractor_no_summary_key():
    """A response that never contains the key emits nothing and does not raise."""
    got, extractor = _drain(['{"observations": "no summary here"}'])
    assert got == ""
    assert extractor.text == ""
    print("ok  extractor_no_summary_key")


class _FakeStream:
    """Stands in for openai.Stream: a context-managed blocking iterator."""

    def __init__(self, items, raises=None):
        self.items = items
        self.raises = raises
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.closed = True
        return False

    def __iter__(self):
        for item in self.items:
            yield item
        if self.raises:
            raise self.raises


def test_bridge_preserves_order():
    async def run():
        stream = _FakeStream(["a", "b", "c"])
        got = [item async for item in aiter_blocking(lambda: stream, heartbeat=30)]
        return got, stream

    got, stream = asyncio.run(run())
    assert got == ["a", "b", "c"], got
    assert stream.closed, "the upstream response must be closed"
    print("ok  bridge_preserves_order")


def test_bridge_reraises_producer_error():
    async def run():
        stream = _FakeStream(["a"], raises=RuntimeError("provider exploded"))
        seen = []
        try:
            async for item in aiter_blocking(lambda: stream, heartbeat=30):
                seen.append(item)
        except RuntimeError as exc:
            return seen, str(exc)
        return seen, None

    seen, message = asyncio.run(run())
    assert seen == ["a"], seen
    assert message == "provider exploded", message
    print("ok  bridge_reraises_producer_error")


def test_bridge_reraises_open_failure():
    """A failure opening the stream must surface, not hang."""
    def boom():
        raise ValueError("NVIDIA_API_KEY is not configured")

    async def run():
        try:
            async for _ in aiter_blocking(boom, heartbeat=30):
                pass
        except ValueError as exc:
            return str(exc)
        return None

    assert asyncio.run(run()) == "NVIDIA_API_KEY is not configured"
    print("ok  bridge_reraises_open_failure")


def test_bridge_emits_heartbeat_on_silence():
    """Silence must yield None so the caller can keep the connection alive."""
    import time

    class _SlowStream(_FakeStream):
        def __iter__(self):
            time.sleep(0.25)
            yield "late"

    async def run():
        return [item async for item in aiter_blocking(lambda: _SlowStream([]), heartbeat=0.05)]

    got = asyncio.run(run())
    assert None in got, "expected at least one heartbeat during the silent gap"
    assert got[-1] == "late", got
    print(f"ok  bridge_emits_heartbeat_on_silence ({got.count(None)} pings)")


if __name__ == "__main__":
    test_extractor_matches_json_loads()
    test_extractor_survives_every_split_point()
    test_extractor_char_by_char()
    test_extractor_stops_at_closing_quote()
    test_extractor_truncated_midvalue()
    test_extractor_unfenced_and_pretty_printed()
    test_extractor_no_summary_key()
    test_bridge_preserves_order()
    test_bridge_reraises_producer_error()
    test_bridge_reraises_open_failure()
    test_bridge_emits_heartbeat_on_silence()
    print("\nAll report streaming checks passed.")
