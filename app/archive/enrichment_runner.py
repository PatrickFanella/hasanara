from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .chapter_naming import NamedChapter
from .enrichment_predictions import generate_episode_prediction
from .labeling.benchmark import PredictionSet
from .semantic_chapters import SemanticChapterProposal
from .semantic_windows import build_semantic_windows


class TranscriptBlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    block_index: int = Field(ge=0)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=20_000)

    @model_validator(mode="after")
    def validate_range(self) -> TranscriptBlockInput:
        if self.end_ms <= self.start_ms:
            raise ValueError("transcript block end must follow its start")
        return self


class EpisodeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    video_id: str = Field(min_length=1)
    duration_ms: int = Field(gt=0)
    blocks: list[TranscriptBlockInput] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_blocks(self) -> EpisodeInput:
        starts = [block.start_ms for block in self.blocks]
        indexes = [block.block_index for block in self.blocks]
        if starts != sorted(starts):
            raise ValueError("transcript blocks must be ordered by start_ms")
        if len(indexes) != len(set(indexes)):
            raise ValueError("transcript block indexes must be unique")
        if any(block.end_ms > self.duration_ms for block in self.blocks):
            raise ValueError("transcript blocks must be within episode duration")
        return self


class EnrichmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1"]
    pipeline_version: str = Field(min_length=1, max_length=120)
    episodes: list[EpisodeInput] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_unique_videos(self) -> EnrichmentInput:
        video_ids = [episode.video_id for episode in self.episodes]
        if len(video_ids) != len(set(video_ids)):
            raise ValueError("enrichment input video IDs must be unique")
        return self


def generate_prediction_set(
    packet: EnrichmentInput,
    *,
    embedder: Callable[[list[str]], Sequence[Sequence[float]]],
    name_proposal: Callable[[SemanticChapterProposal, list[dict[str, Any]]], NamedChapter],
    window_ms: int = 120_000,
    stride_ms: int = 60_000,
    min_chapter_ms: int = 4 * 60 * 1000,
    max_chapter_ms: int = 18 * 60 * 1000,
    novelty_threshold: float = 0.35,
) -> PredictionSet:
    """Run the complete enrichment proposal pipeline without persistence."""
    prepared_episodes: list[tuple[EpisodeInput, list[dict[str, Any]], Sequence[Sequence[float]]]] = []
    for episode in packet.episodes:
        windows = build_semantic_windows(
            [block.model_dump() for block in episode.blocks],
            duration_ms=episode.duration_ms,
            window_ms=window_ms,
            stride_ms=stride_ms,
        )
        embeddings = embedder([str(window["text"]) for window in windows])
        prepared_episodes.append((episode, windows, embeddings))

    predictions = []
    for episode, windows, embeddings in prepared_episodes:
        predictions.append(
            generate_episode_prediction(
                episode.video_id,
                duration_ms=episode.duration_ms,
                windows=windows,
                embeddings=embeddings,
                name_proposal=name_proposal,
                min_chapter_ms=min_chapter_ms,
                max_chapter_ms=max_chapter_ms,
                novelty_threshold=novelty_threshold,
            )
        )
    return PredictionSet(
        schema_version=packet.schema_version,
        pipeline_version=packet.pipeline_version,
        episodes=predictions,
    )


__all__ = [
    "EnrichmentInput",
    "EpisodeInput",
    "TranscriptBlockInput",
    "generate_prediction_set",
]
