from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Sequence
from typing import Any

from .chapter_naming import NamedChapter
from .labeling.benchmark import EpisodePrediction, PredictedChapter
from .semantic_chapters import SemanticChapterProposal, propose_semantic_chapters


def _rank_by_covered_duration(chapters: list[NamedChapter], field: str, limit: int) -> list[str]:
    scores: dict[str, int] = defaultdict(int)
    first_seen: dict[str, int] = {}
    display: dict[str, str] = {}
    position = 0
    for chapter in chapters:
        duration = chapter.end_ms - chapter.start_ms
        for value in getattr(chapter, field):
            normalized = " ".join(value.casefold().split())
            if not normalized:
                continue
            scores[normalized] += duration
            first_seen.setdefault(normalized, position)
            display.setdefault(normalized, value)
            position += 1
    ranked = sorted(scores, key=lambda value: (-scores[value], first_seen[value], value))
    return [display[value] for value in ranked[:limit]]


def build_episode_prediction(
    video_id: str,
    *,
    duration_ms: int,
    chapters: list[NamedChapter],
) -> EpisodePrediction:
    """Aggregate grounded chapter output into ranked episode subjects and keywords."""
    if not chapters:
        raise ValueError("episode prediction requires at least one named chapter")
    if chapters[0].start_ms != 0 or chapters[-1].end_ms != duration_ms:
        raise ValueError("named chapters must cover the complete episode duration")
    for index, chapter in enumerate(chapters):
        if chapter.end_ms <= chapter.start_ms:
            raise ValueError("named chapter end must follow its start")
        if index and chapter.start_ms != chapters[index - 1].end_ms:
            raise ValueError("named chapters must be contiguous")

    return EpisodePrediction(
        video_id=video_id,
        subjects=_rank_by_covered_duration(chapters, "subjects", 20),
        keywords=_rank_by_covered_duration(chapters, "keywords", 50),
        chapters=[
            PredictedChapter(start_ms=chapter.start_ms, end_ms=chapter.end_ms, title=chapter.title)
            for chapter in chapters
        ],
    )


def generate_episode_prediction(
    video_id: str,
    *,
    duration_ms: int,
    windows: list[dict[str, Any]],
    embeddings: Sequence[Sequence[float]],
    name_proposal: Callable[[SemanticChapterProposal, list[dict[str, Any]]], NamedChapter],
    min_chapter_ms: int = 4 * 60 * 1000,
    max_chapter_ms: int = 18 * 60 * 1000,
    novelty_threshold: float = 0.35,
) -> EpisodePrediction:
    """Generate one offline prediction without persisting or publishing it."""
    proposals = propose_semantic_chapters(
        windows,
        embeddings,
        duration_ms=duration_ms,
        min_chapter_ms=min_chapter_ms,
        max_chapter_ms=max_chapter_ms,
        novelty_threshold=novelty_threshold,
    )
    named_chapters = [name_proposal(proposal, windows) for proposal in proposals]
    return build_episode_prediction(video_id, duration_ms=duration_ms, chapters=named_chapters)


__all__ = ["build_episode_prediction", "generate_episode_prediction"]
