"""Shared helpers for calling NVIDIA / OpenAI-compatible completions."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)

try:
    from openai import NotFoundError
except Exception:  # pragma: no cover - compatibility across OpenAI client versions
    class NotFoundError(Exception):
        """Fallback when openai.NotFoundError is unavailable."""


def _is_not_found_error(error: Exception) -> bool:
    message = str(error).lower()
    return isinstance(error, NotFoundError) or (
        "not found" in message and "function" in message and "for account" in message
    )


def _model_candidates(primary_model: Optional[str]) -> List[str]:
    candidates: List[str] = []

    if primary_model:
        candidates.append(primary_model)

    fallback_raw = os.getenv("NVIDIA_MODEL_FALLBACKS") or os.getenv("NVIDIA_FALLBACK_MODELS")
    if fallback_raw:
        for model in fallback_raw.split(","):
            normalized = model.strip()
            if normalized and normalized not in candidates:
                candidates.append(normalized)

    legacy_alias = "nvidia/llama-3.1-nemotron-70b-instruct"
    if legacy_alias not in candidates:
        candidates.append(legacy_alias)

    return candidates


def create_chat_completion(
    client: OpenAI,
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    **kwargs: Any,
) -> Tuple[Any, str]:
    """Call chat.completions.create with automatic model fallback on 404 provider errors."""

    model_candidates = _model_candidates(model or settings.nvidia_model)
    if not model_candidates:
        raise ValueError("No NVIDIA model configured")

    last_error: Optional[Exception] = None
    request_kwargs: Dict[str, Any] = {
        "messages": messages,
        "timeout": kwargs.pop("timeout", 60),
    }
    if temperature is not None:
        request_kwargs["temperature"] = temperature
    if max_tokens is not None:
        request_kwargs["max_tokens"] = max_tokens
    request_kwargs.update(kwargs)

    for idx, model_name in enumerate(model_candidates):
        request_kwargs["model"] = model_name
        try:
            return client.chat.completions.create(**request_kwargs), model_name
        except Exception as error:  # pragma: no cover - depends on provider runtime behavior
            if _is_not_found_error(error) and idx + 1 < len(model_candidates):
                logger.warning(
                    "NVIDIA model unavailable, trying fallback. model=%s error=%s",
                    model_name,
                    error,
                )
                last_error = error
                continue
            raise

    if last_error:
        raise last_error

    raise RuntimeError("Unable to create chat completion with configured NVIDIA models")
