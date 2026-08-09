from __future__ import annotations

import json

from app.archive.chapter_naming import NamedChapter
from scripts.generate_topic_enrichment_predictions import main


def test_prediction_cli_writes_benchmark_contract_without_database(monkeypatch, tmp_path):
    input_path = tmp_path / "input.json"
    output_path = tmp_path / "predictions.json"
    input_path.write_text(
        json.dumps(
            {
                "schema_version": "1",
                "pipeline_version": "semantic-test-v1",
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
    )
    monkeypatch.setattr(
        "scripts.generate_topic_enrichment_predictions.embed_texts",
        lambda texts, **_kwargs: [[1.0, 0.0], [0.0, 1.0]] if len(texts) == 2 else [],
    )

    def fake_name(proposal, _windows, **_kwargs):
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

    monkeypatch.setattr("scripts.generate_topic_enrichment_predictions.generate_chapter_name", fake_name)

    exit_code = main(
        [
            str(input_path),
            str(output_path),
            "--window-ms",
            "120000",
            "--stride-ms",
            "120000",
            "--min-chapter-ms",
            "120000",
            "--max-chapter-ms",
            "600000",
            "--novelty-threshold",
            "0.5",
        ]
    )
    output = json.loads(output_path.read_text())

    assert exit_code == 0
    assert output["pipeline_version"] == "semantic-test-v1"
    assert output["episodes"][0]["subjects"] == ["Election", "Labor"]
