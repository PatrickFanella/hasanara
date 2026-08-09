from __future__ import annotations

from app.archive.chapter_naming import NamedChapter
from app.archive.enrichment_predictions import build_episode_prediction, generate_episode_prediction


def _chapter(start_ms, end_ms, title, subjects, keywords):
    return NamedChapter(
        start_ms=start_ms,
        end_ms=end_ms,
        title=title,
        summary=f"Grounded summary for {title}.",
        subjects=subjects,
        keywords=keywords,
        evidence_ids=(f"w{start_ms}",),
        model="qwen3:8b",
    )


def test_episode_prediction_ranks_subjects_and_keywords_by_covered_duration():
    chapters = [
        _chapter(0, 100_000, "Union strike vote", ("Labor", "Michigan"), ("strike vote",)),
        _chapter(100_000, 300_000, "Election polling", ("Election",), ("polling",)),
        _chapter(300_000, 500_000, "Contract demands", ("Labor",), ("strike vote", "contract demands")),
    ]

    prediction = build_episode_prediction("video-1", duration_ms=500_000, chapters=chapters)

    assert prediction.video_id == "video-1"
    assert prediction.subjects == ["Labor", "Election", "Michigan"]
    assert prediction.keywords == ["strike vote", "polling", "contract demands"]
    assert prediction.chapters[-1].end_ms == 500_000


def test_generate_episode_prediction_connects_semantic_spans_to_grounded_naming():
    windows = [
        {"start_ms": 0, "end_ms": 120_000, "text": "Election campaign news"},
        {"start_ms": 120_000, "end_ms": 240_000, "text": "Election polling analysis"},
        {"start_ms": 240_000, "end_ms": 360_000, "text": "Union strike vote"},
        {"start_ms": 360_000, "end_ms": 480_000, "text": "Worker contract demands"},
    ]

    def name_proposal(proposal, _windows):
        is_opening = proposal.start_ms == 0
        return _chapter(
            proposal.start_ms,
            proposal.end_ms,
            "Election campaign" if is_opening else "Union strike vote",
            ("Election",) if is_opening else ("Labor",),
            ("campaign",) if is_opening else ("strike vote",),
        )

    prediction = generate_episode_prediction(
        "video-2",
        duration_ms=480_000,
        windows=windows,
        embeddings=[[1.0, 0.0], [0.95, 0.05], [0.05, 0.95], [0.0, 1.0]],
        name_proposal=name_proposal,
        min_chapter_ms=120_000,
        max_chapter_ms=600_000,
        novelty_threshold=0.5,
    )

    assert prediction.subjects == ["Election", "Labor"]
    assert [chapter.start_ms for chapter in prediction.chapters] == [0, 240_000]
