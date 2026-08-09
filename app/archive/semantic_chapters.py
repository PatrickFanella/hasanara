from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Sequence


@dataclass(frozen=True)
class SemanticChapterProposal:
    start_ms: int
    end_ms: int
    boundary_score: float
    evidence_window_indexes: tuple[int, ...]


def _centroid(vectors: Sequence[Sequence[float]]) -> list[float]:
    width = len(vectors[0])
    return [sum(float(vector[index]) for vector in vectors) / len(vectors) for index in range(width)]


def _cosine_distance(left: Sequence[float], right: Sequence[float]) -> float:
    dot = sum(float(a) * float(b) for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(float(value) ** 2 for value in left))
    right_norm = math.sqrt(sum(float(value) ** 2 for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return max(0.0, min(1.0, 1.0 - dot / (left_norm * right_norm)))


def _validate_inputs(windows: list[dict[str, Any]], embeddings: Sequence[Sequence[float]], duration_ms: int) -> None:
    if duration_ms <= 0:
        raise ValueError("duration_ms must be positive")
    if len(windows) != len(embeddings):
        raise ValueError("each transcript window requires one embedding")
    if not windows:
        return
    dimensions = {len(vector) for vector in embeddings}
    if len(dimensions) != 1 or not next(iter(dimensions)):
        raise ValueError("embeddings must have one shared nonzero dimension")
    starts = [int(window.get("start_ms") or 0) for window in windows]
    if starts != sorted(starts):
        raise ValueError("transcript windows must be ordered by start_ms")


def propose_semantic_chapters(
    windows: list[dict[str, Any]],
    embeddings: Sequence[Sequence[float]],
    *,
    duration_ms: int,
    min_chapter_ms: int = 4 * 60 * 1000,
    max_chapter_ms: int = 18 * 60 * 1000,
    novelty_threshold: float = 0.35,
) -> list[SemanticChapterProposal]:
    """Propose full-duration chapter spans from sustained embedding changes.

    This function does not publish or name chapters. It is a deterministic,
    model-independent proposal kernel intended for benchmarked offline runs.
    """
    _validate_inputs(windows, embeddings, duration_ms)
    if not windows:
        return []
    if min_chapter_ms <= 0 or max_chapter_ms < min_chapter_ms:
        raise ValueError("chapter duration bounds are invalid")
    if not 0 <= novelty_threshold <= 1:
        raise ValueError("novelty_threshold must be between 0 and 1")

    scored_boundaries: list[tuple[int, float]] = []
    for index in range(1, len(windows)):
        start_ms = int(windows[index].get("start_ms") or 0)
        if start_ms < min_chapter_ms or duration_ms - start_ms < min_chapter_ms:
            continue
        previous = _centroid(embeddings[max(0, index - 2) : index])
        following = _centroid(embeddings[index : min(len(embeddings), index + 2)])
        score = _cosine_distance(previous, following)
        if score >= novelty_threshold:
            scored_boundaries.append((start_ms, score))

    selected: list[tuple[int, float]] = []
    for boundary in sorted(scored_boundaries, key=lambda item: (-item[1], item[0])):
        if all(abs(boundary[0] - existing[0]) >= min_chapter_ms for existing in selected):
            selected.append(boundary)
    selected.sort()

    # Long homogeneous spans are split at the latest real window boundary
    # within the configured maximum; invented timestamps are never used.
    boundary_scores = {start: score for start, score in selected}
    boundaries = [0, *(start for start, _score in selected), duration_ms]
    index = 0
    while index < len(boundaries) - 1:
        start, end = boundaries[index], boundaries[index + 1]
        if end - start <= max_chapter_ms:
            index += 1
            continue
        candidates = [
            int(window.get("start_ms") or 0)
            for window in windows
            if start + min_chapter_ms
            <= int(window.get("start_ms") or 0)
            <= min(start + max_chapter_ms, end - min_chapter_ms)
        ]
        if not candidates:
            index += 1
            continue
        split = max(candidates)
        boundaries.insert(index + 1, split)
        boundary_scores.setdefault(split, 0.0)

    proposals: list[SemanticChapterProposal] = []
    for chapter_index, (start, end) in enumerate(zip(boundaries, boundaries[1:], strict=False)):
        evidence_indexes = tuple(
            index
            for index, window in enumerate(windows)
            if int(window.get("start_ms") or 0) < end and int(window.get("end_ms") or 0) > start
        )
        proposals.append(
            SemanticChapterProposal(
                start_ms=start,
                end_ms=end,
                boundary_score=1.0 if chapter_index == 0 else round(boundary_scores.get(start, 0.0), 4),
                evidence_window_indexes=evidence_indexes,
            )
        )
    return proposals


__all__ = ["SemanticChapterProposal", "propose_semantic_chapters"]
