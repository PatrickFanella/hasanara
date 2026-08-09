from __future__ import annotations

from typing import Any


def build_semantic_windows(
    blocks: list[dict[str, Any]],
    *,
    duration_ms: int,
    window_ms: int = 120_000,
    stride_ms: int = 60_000,
) -> list[dict[str, Any]]:
    """Build deterministic overlapping windows while retaining block provenance."""
    if duration_ms <= 0:
        raise ValueError("duration_ms must be positive")
    if window_ms <= 0 or stride_ms <= 0 or stride_ms > window_ms:
        raise ValueError("semantic window and stride must be positive and overlapping")

    ordered: list[tuple[int, dict[str, Any]]] = sorted(
        ((index, dict(block)) for index, block in enumerate(blocks) if " ".join(str(block.get("text") or "").split())),
        key=lambda item: (int(item[1].get("start_ms") or 0), item[0]),
    )
    windows: list[dict[str, Any]] = []
    for start_ms in range(0, duration_ms, stride_ms):
        end_ms = min(duration_ms, start_ms + window_ms)
        matching = [
            (original_index, block)
            for original_index, block in ordered
            if int(block.get("start_ms") or 0) < end_ms
            and int(block.get("end_ms") or block.get("start_ms") or 0) > start_ms
        ]
        if not matching:
            continue
        text = " ".join(" ".join(str(block.get("text") or "").split()) for _index, block in matching)
        windows.append(
            {
                "start_ms": start_ms,
                "end_ms": end_ms,
                "text": text,
                "block_indexes": [int(block.get("block_index", index)) for index, block in matching],
            }
        )
    return windows


__all__ = ["build_semantic_windows"]
