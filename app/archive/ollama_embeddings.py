from __future__ import annotations

import json
import math
from typing import Any
from urllib import error, request


class EmbeddingValidationError(ValueError):
    """Raised when an embedding service response cannot safely drive segmentation."""


def _validated_batch(payload: Any, expected_count: int, expected_dimension: int | None) -> list[list[float]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("embeddings"), list):
        raise EmbeddingValidationError("Ollama embedding response did not contain embeddings")
    raw_embeddings = payload["embeddings"]
    if len(raw_embeddings) != expected_count:
        raise EmbeddingValidationError("Ollama embedding count did not match input count")

    embeddings: list[list[float]] = []
    for raw_vector in raw_embeddings:
        if not isinstance(raw_vector, list) or not raw_vector:
            raise EmbeddingValidationError("Ollama returned an empty or invalid embedding")
        try:
            vector = [float(value) for value in raw_vector]
        except (TypeError, ValueError) as exc:
            raise EmbeddingValidationError("Ollama returned a non-numeric embedding") from exc
        if any(not math.isfinite(value) for value in vector):
            raise EmbeddingValidationError("Ollama returned a non-finite embedding")
        if expected_dimension is not None and len(vector) != expected_dimension:
            raise EmbeddingValidationError("Ollama embedding dimensions changed between batches")
        embeddings.append(vector)
    return embeddings


def embed_texts(
    texts: list[str],
    *,
    base_url: str,
    model: str,
    batch_size: int = 16,
    timeout_seconds: float = 180.0,
) -> list[list[float]]:
    """Embed text in ordered batches using Ollama's local embedding endpoint."""
    if batch_size <= 0:
        raise ValueError("embedding batch_size must be positive")
    normalized = [" ".join(text.split()) for text in texts]
    if any(not text for text in normalized):
        raise ValueError("embedding input text must not be empty")
    if not normalized:
        return []

    url = f"{base_url.rstrip('/')}/api/embed"
    embeddings: list[list[float]] = []
    dimension: int | None = None
    for offset in range(0, len(normalized), batch_size):
        batch = normalized[offset : offset + batch_size]
        body = {"model": model, "input": batch, "truncate": True, "keep_alive": "10m"}
        req = request.Request(
            url,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ollama embedding request failed: HTTP {exc.code}: {detail}") from exc
        except (error.URLError, TimeoutError) as exc:
            raise RuntimeError(f"Ollama embedding request failed: {exc}") from exc
        batch_embeddings = _validated_batch(payload, len(batch), dimension)
        if dimension is None:
            dimension = len(batch_embeddings[0])
        embeddings.extend(batch_embeddings)
    return embeddings


__all__ = ["EmbeddingValidationError", "embed_texts"]
