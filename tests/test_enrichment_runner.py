from __future__ import annotations

from app.archive.chapter_naming import NamedChapter
from app.archive.enrichment_runner import EnrichmentInput, generate_prediction_set


def test_enrichment_runner_builds_benchmark_predictions_without_database_writes():
    packet = EnrichmentInput.model_validate(
        {
            "schema_version": "1",
            "pipeline_version": "semantic-qwen-v1",
            "episodes": [
                {
                    "video_id": "video-1",
                    "duration_ms": 240_000,
                    "blocks": [
                        {"block_index": 0, "start_ms": 0, "end_ms": 120_000, "text": "Election campaign"},
                        {"block_index": 1, "start_ms": 120_000, "end_ms": 240_000, "text": "Union strike"},
                    ],
                }
            ],
        }
    )
    embedded_inputs = []

    def embedder(texts):
        embedded_inputs.extend(texts)
        return [[1.0, 0.0], [0.0, 1.0]]

    def namer(proposal, _windows):
        opening = proposal.start_ms == 0
        return NamedChapter(
            start_ms=proposal.start_ms,
            end_ms=proposal.end_ms,
            title="Election campaign" if opening else "Union strike",
            summary="A grounded chapter summary.",
            subjects=("Election",) if opening else ("Labor",),
            keywords=("campaign",) if opening else ("strike",),
            evidence_ids=("w0",),
            model="qwen3:8b",
        )

    predictions = generate_prediction_set(
        packet,
        embedder=embedder,
        name_proposal=namer,
        window_ms=120_000,
        stride_ms=120_000,
        min_chapter_ms=120_000,
        max_chapter_ms=600_000,
        novelty_threshold=0.5,
    )

    assert predictions.pipeline_version == "semantic-qwen-v1"
    assert predictions.episodes[0].subjects == ["Election", "Labor"]
    assert [chapter.start_ms for chapter in predictions.episodes[0].chapters] == [0, 120_000]
    assert embedded_inputs == ["Election campaign", "Union strike"]


def test_enrichment_runner_embeds_all_episodes_before_loading_chapter_namer():
    packet = EnrichmentInput.model_validate(
        {
            "schema_version": "1",
            "pipeline_version": "semantic-qwen-v1",
            "episodes": [
                {
                    "video_id": "video-1",
                    "duration_ms": 120_000,
                    "blocks": [{"block_index": 0, "start_ms": 0, "end_ms": 120_000, "text": "First episode"}],
                },
                {
                    "video_id": "video-2",
                    "duration_ms": 120_000,
                    "blocks": [{"block_index": 0, "start_ms": 0, "end_ms": 120_000, "text": "Second episode"}],
                },
            ],
        }
    )
    events = []

    def embedder(texts):
        events.append(("embed", texts[0]))
        return [[1.0, 0.0] for _text in texts]

    def namer(proposal, windows):
        events.append(("name", windows[0]["text"]))
        return NamedChapter(
            start_ms=proposal.start_ms,
            end_ms=proposal.end_ms,
            title=windows[0]["text"],
            summary="A grounded chapter summary.",
            subjects=(),
            keywords=(),
            evidence_ids=("w0",),
            model="qwen3:4b",
        )

    generate_prediction_set(packet, embedder=embedder, name_proposal=namer)

    assert events == [
        ("embed", "First episode"),
        ("embed", "Second episode"),
        ("name", "First episode"),
        ("name", "Second episode"),
    ]
