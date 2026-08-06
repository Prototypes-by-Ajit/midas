"""Streaming variant of report content generation.

The blocking generator in `report_generator` waits ~2 minutes for a complete
response before anything reaches the user. This module produces the same
content from the same prompts, but yields the narrative as the model writes it.

Three pieces:

* `SummaryDeltas` turns the model's raw JSON token stream into clean prose. The
  contract in `report_generator.JSON_CONTRACT` asks for a single JSON object
  whose first key is `summary`, so streaming raw tokens would show the reader
  `{"summary": "The scan sho`. This extracts only the summary value.
* `aiter_blocking` bridges the synchronous OpenAI SDK stream onto the event loop.
* `stream_llm_content` composes the two and yields typed events.

Like `generate_llm_content`, this raises on any LLM failure rather than
substituting boilerplate: a failed report must not be indistinguishable from a
real one.
"""
from __future__ import annotations

import asyncio
import logging
import re
import threading
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Tuple

from app.config import settings
from app.services.nvidia_client import create_chat_completion
from app.services.report_generator import (
    REPORT_MAX_TOKENS,
    REPORT_TEMPERATURE,
    REPORT_TOP_P,
    build_user_prompt,
    get_nvidia_client,
    normalize_llm_content,
    parse_llm_json,
    system_prompt_for,
)

logger = logging.getLogger(__name__)

# Per-chunk read timeout, unlike REPORT_LLM_TIMEOUT_SECONDS which bounds a whole
# blocking call. It must exceed the model's worst-case time-to-first-token; 60s
# is a starting point, not a measurement.
REPORT_STREAM_READ_TIMEOUT_SECONDS = 60

# Seconds of silence after which the caller should emit a keep-alive. nginx's
# `location /` has no proxy_read_timeout override, so it uses the 60s default —
# a stream with no traffic for 60s is killed mid-generation.
STREAM_HEARTBEAT_SECONDS = 10.0

_ESCAPES = {
    "n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f",
    '"': '"', "\\": "\\", "/": "/",
}


class SummaryDeltas:
    """Pull clean prose out of a streaming `{"summary": "...", ...}` object.

    Feed raw model text, get back the unescaped delta of the `summary` value
    only. Everything before the key (fences, `{`, whitespace) is discarded, and
    so is everything from the closing quote onward — `observations` and the
    other fields never leak into the reader's view.

    Deliberately a character scanner rather than an incremental JSON parser: the
    input is a prefix of a JSON document, which no JSON parser accepts, and the
    only field needed is known in advance.

    An escape sequence split across a chunk boundary is held back rather than
    emitted broken, so output is identical regardless of how the provider
    happens to chunk the response.
    """

    _KEY = re.compile(r'"summary"\s*:\s*"')

    def __init__(self) -> None:
        self._buf = ""
        self._inside = False
        self._done = False
        self.text = ""  # everything emitted so far, for truncation recovery

    def feed(self, chunk: str) -> str:
        """Consume raw model text; return the prose delta (may be empty)."""
        if self._done or not chunk:
            return ""
        self._buf += chunk

        if not self._inside:
            match = self._KEY.search(self._buf)
            if not match:
                # Key not seen yet. Bounded by max_tokens, so this cannot grow
                # without limit.
                return ""
            self._buf = self._buf[match.end():]
            self._inside = True

        out: List[str] = []
        i, n = 0, len(self._buf)
        while i < n:
            ch = self._buf[i]
            if ch == "\\":
                if i + 1 >= n:
                    break  # escape split across chunks; wait for the rest
                nxt = self._buf[i + 1]
                if nxt == "u":
                    if i + 6 > n:
                        break  # \uXXXX split across chunks
                    try:
                        out.append(chr(int(self._buf[i + 2:i + 6], 16)))
                    except ValueError:
                        out.append(self._buf[i:i + 6])  # malformed; pass through
                    i += 6
                else:
                    out.append(_ESCAPES.get(nxt, nxt))
                    i += 2
                continue
            if ch == '"':
                self._done = True
                i += 1
                break
            out.append(ch)
            i += 1

        self._buf = self._buf[i:]
        emitted = "".join(out)
        self.text += emitted
        return emitted


_DONE = object()


async def aiter_blocking(
    open_stream: Callable[[], Any],
    heartbeat: float = STREAM_HEARTBEAT_SECONDS,
) -> AsyncIterator[Any]:
    """Iterate a blocking iterator on a worker thread, yielding onto the loop.

    `open_stream` is called *inside* the thread so the initial blocking HTTP POST
    also stays off the event loop. Yields `None` after every `heartbeat` seconds
    of silence so the caller can emit a keep-alive during the model's
    time-to-first-token gap.

    Exceptions raised by the producer are re-raised on the loop, never swallowed.
    When the consumer stops early (client disconnect), the stop flag is set and
    the `with` block closes the upstream response — so an abandoned generation
    stops costing tokens.
    """
    loop = asyncio.get_running_loop()
    # Unbounded is safe: at most max_tokens small items. A bounded queue would
    # give backpressure but could wedge the worker thread forever if the
    # consumer vanished.
    queue: asyncio.Queue = asyncio.Queue()
    stop = threading.Event()

    def emit(item: Any) -> None:
        # call_soon_threadsafe rather than run_coroutine_threadsafe(...).result():
        # the worker must never block on the loop.
        loop.call_soon_threadsafe(queue.put_nowait, item)

    def produce() -> None:
        try:
            with open_stream() as stream:
                for item in stream:
                    if stop.is_set():
                        break
                    emit(item)
            emit(_DONE)
        except BaseException as exc:  # noqa: BLE001 - re-raised on the loop
            emit(exc)

    loop.run_in_executor(None, produce)
    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), heartbeat)
            except asyncio.TimeoutError:
                yield None
                continue
            if item is _DONE:
                return
            if isinstance(item, BaseException):
                raise item
            yield item
    finally:
        stop.set()


async def stream_llm_content(
    analysis: Dict[str, Any],
    report_type: str,
    heartbeat: float = STREAM_HEARTBEAT_SECONDS,
) -> AsyncIterator[Tuple[str, Any]]:
    """Yield ('delta', str) and ('ping', None), then exactly one ('content', dict).

    Same prompts, model, temperature and max_tokens as `generate_llm_content`;
    only `stream=True` and the incremental extraction differ. The final
    ('content', dict) has the same keys `generate_llm_content` returns, plus
    'truncated'.

    Raises on any LLM failure, like its blocking sibling. No boilerplate fallback.
    """
    # The SDK default of max_retries=2 means a hung call can burn
    # 3 x REPORT_STREAM_READ_TIMEOUT_SECONDS before failing, which outlasts the
    # 300s nginx ceiling on /api/v1/.
    client = get_nvidia_client().with_options(max_retries=1)
    used: Dict[str, str] = {}
    finish: Dict[str, Optional[str]] = {}

    def open_stream() -> Any:
        stream, model = create_chat_completion(
            client,
            messages=[
                {"role": "system", "content": system_prompt_for(report_type)},
                {"role": "user", "content": build_user_prompt(analysis, report_type)},
            ],
            model=settings.nvidia_model,
            temperature=REPORT_TEMPERATURE,
            max_tokens=REPORT_MAX_TOKENS,
            top_p=REPORT_TOP_P,
            timeout=REPORT_STREAM_READ_TIMEOUT_SECONDS,
            stream=True,
        )
        used["model"] = model
        return stream

    extractor = SummaryDeltas()
    raw: List[str] = []

    async for chunk in aiter_blocking(open_stream, heartbeat):
        if chunk is None:
            yield ("ping", None)
            continue
        if not getattr(chunk, "choices", None):
            continue
        choice = chunk.choices[0]
        finish["reason"] = choice.finish_reason or finish.get("reason")
        piece = (getattr(choice, "delta", None) and choice.delta.content) or ""
        if not piece:
            continue
        raw.append(piece)
        delta = extractor.feed(piece)
        if delta:
            yield ("delta", delta)

    raw_text = "".join(raw)
    model_used = used.get("model", settings.nvidia_model)
    content = normalize_llm_content(parse_llm_json(raw_text), model_used)

    # parse_llm_json falls back to {"summary": <entire raw response>} when the
    # object never closed - almost always finish_reason == "length". The
    # extractor already holds valid prose for exactly that case, so use it
    # rather than rendering a raw JSON fragment into the PDF.
    if extractor.text and content["summary"] == raw_text.strip():
        logger.warning(
            "Streaming report response was not valid JSON; recovering the "
            "streamed summary (finish_reason=%s)", finish.get("reason")
        )
        content["summary"] = extractor.text.strip()

    content["truncated"] = finish.get("reason") == "length"
    yield ("content", content)
