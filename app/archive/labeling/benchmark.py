from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .evaluation import evaluate_enrichment_predictions

RELEASE_GATES = {
    "tag_precision_at_5": 0.85,
    "tag_recall_at_10": 0.70,
    "junk_tag_rate_max": 0.02,
    "chapter_boundary_f1": 0.75,
    "chapter_coverage": 0.95,
    "fragment_title_rate_max": 0.02,
}


class GoldenChapter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_ms: int = Field(ge=0)
    title: str = Field(min_length=3, max_length=160)
    evidence_start_ms: int = Field(ge=0)


class GoldenEpisode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    video_id: str = Field(min_length=1)
    duration_ms: int = Field(gt=0)
    subjects: list[str] = Field(min_length=1, max_length=20)
    acceptable_keywords: list[str] = Field(default_factory=list, max_length=50)
    junk_subjects: list[str] = Field(default_factory=list, max_length=50)
    junk_keywords: list[str] = Field(default_factory=list, max_length=50)
    chapters: list[GoldenChapter] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_chapter_timeline(self) -> GoldenEpisode:
        starts = [chapter.start_ms for chapter in self.chapters]
        if starts[0] != 0:
            raise ValueError("first chapter must start at 0")
        if starts != sorted(set(starts)):
            raise ValueError("chapter starts must be unique and increasing")
        if any(start >= self.duration_ms for start in starts):
            raise ValueError("chapter starts must be within episode duration")
        if any(chapter.evidence_start_ms >= self.duration_ms for chapter in self.chapters):
            raise ValueError("chapter evidence must be within episode duration")
        return self


class GoldenSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1"]
    episodes: list[GoldenEpisode] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_unique_videos(self) -> GoldenSet:
        video_ids = [episode.video_id for episode in self.episodes]
        if len(video_ids) != len(set(video_ids)):
            raise ValueError("golden-set video IDs must be unique")
        return self


class PredictedChapter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=160)


class EpisodePrediction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    video_id: str = Field(min_length=1)
    subjects: list[str] = Field(default_factory=list, max_length=20)
    keywords: list[str] = Field(default_factory=list, max_length=50)
    chapters: list[PredictedChapter] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_chapter_timeline(self) -> EpisodePrediction:
        if self.chapters[0].start_ms != 0:
            raise ValueError("first predicted chapter must start at 0")
        for index, chapter in enumerate(self.chapters):
            if chapter.end_ms <= chapter.start_ms:
                raise ValueError("predicted chapter end must follow its start")
            if index and chapter.start_ms != self.chapters[index - 1].end_ms:
                raise ValueError("predicted chapters must be contiguous")
        return self


class PredictionSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1"]
    pipeline_version: str = Field(min_length=1, max_length=120)
    episodes: list[EpisodePrediction] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_unique_videos(self) -> PredictionSet:
        video_ids = [episode.video_id for episode in self.episodes]
        if len(video_ids) != len(set(video_ids)):
            raise ValueError("prediction video IDs must be unique")
        return self


@dataclass(frozen=True)
class BenchmarkReport:
    schema_version: str
    pipeline_version: str
    passed: bool
    gates: dict[str, float]
    aggregate: dict[str, float]
    episodes: list[dict[str, Any]]

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "pipeline_version": self.pipeline_version,
            "passed": self.passed,
            "gates": self.gates,
            "aggregate": self.aggregate,
            "episodes": self.episodes,
        }


def _normalized_set(values: list[str]) -> set[str]:
    return {" ".join(value.casefold().split()) for value in values if value.strip()}


def _precision_recall(predicted: list[str], expected: list[str], limit: int) -> tuple[float, float]:
    ranked = list(dict.fromkeys(" ".join(value.casefold().split()) for value in predicted if value.strip()))[:limit]
    expected_set = _normalized_set(expected)
    matches = sum(value in expected_set for value in ranked)
    precision = round(matches / len(ranked), 4) if ranked else 0.0
    recall = round(matches / len(expected_set), 4) if expected_set else 1.0
    return precision, recall


def _junk_rate(predicted: list[str], junk: list[str]) -> float:
    ranked = list(dict.fromkeys(" ".join(value.casefold().split()) for value in predicted if value.strip()))
    junk_set = _normalized_set(junk)
    return round(sum(value in junk_set for value in ranked) / len(ranked), 4) if ranked else 0.0


def _macro_average(rows: list[dict[str, Any]], key: str) -> float:
    return round(sum(float(row[key]) for row in rows) / len(rows), 4)


def evaluate_benchmark(golden: GoldenSet, predictions: PredictionSet) -> BenchmarkReport:
    """Evaluate one complete prediction set against editor-reviewed annotations."""
    golden_by_id = {episode.video_id: episode for episode in golden.episodes}
    predicted_by_id = {episode.video_id: episode for episode in predictions.episodes}
    if set(golden_by_id) != set(predicted_by_id):
        missing = sorted(set(golden_by_id) - set(predicted_by_id))
        extra = sorted(set(predicted_by_id) - set(golden_by_id))
        raise ValueError(f"prediction videos must match golden set; missing={missing}, extra={extra}")

    episode_rows: list[dict[str, Any]] = []
    for video_id, annotation in golden_by_id.items():
        prediction = predicted_by_id[video_id]
        base = evaluate_enrichment_predictions(
            predicted_tags=prediction.subjects,
            expected_tags=annotation.subjects,
            junk_tags=annotation.junk_subjects,
            predicted_chapters=[chapter.model_dump() for chapter in prediction.chapters],
            expected_chapter_starts_ms=[chapter.start_ms for chapter in annotation.chapters],
            duration_ms=annotation.duration_ms,
        ).as_dict()
        keyword_precision, keyword_recall = _precision_recall(prediction.keywords, annotation.acceptable_keywords, 10)
        keyword_junk_rate = _junk_rate(prediction.keywords, annotation.junk_keywords)
        episode_rows.append(
            {
                "video_id": video_id,
                **base,
                "keyword_precision_at_10": keyword_precision,
                "keyword_recall_at_10": keyword_recall,
                "keyword_junk_rate": keyword_junk_rate,
            }
        )

    metric_keys = [key for key in episode_rows[0] if key != "video_id"]
    aggregate = {key: _macro_average(episode_rows, key) for key in metric_keys}
    passed = (
        aggregate["tag_precision_at_5"] >= RELEASE_GATES["tag_precision_at_5"]
        and aggregate["tag_recall_at_10"] >= RELEASE_GATES["tag_recall_at_10"]
        and aggregate["junk_tag_rate"] < RELEASE_GATES["junk_tag_rate_max"]
        and aggregate["chapter_boundary_f1"] >= RELEASE_GATES["chapter_boundary_f1"]
        and aggregate["chapter_coverage"] >= RELEASE_GATES["chapter_coverage"]
        and aggregate["fragment_title_rate"] < RELEASE_GATES["fragment_title_rate_max"]
    )
    return BenchmarkReport(
        schema_version=golden.schema_version,
        pipeline_version=predictions.pipeline_version,
        passed=passed,
        gates=dict(RELEASE_GATES),
        aggregate=aggregate,
        episodes=episode_rows,
    )


__all__ = [
    "BenchmarkReport",
    "EpisodePrediction",
    "GoldenChapter",
    "GoldenEpisode",
    "GoldenSet",
    "PredictedChapter",
    "PredictionSet",
    "RELEASE_GATES",
    "evaluate_benchmark",
]
