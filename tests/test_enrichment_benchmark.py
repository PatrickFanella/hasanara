from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.archive.labeling.benchmark import GoldenSet, PredictionSet, evaluate_benchmark
from scripts.evaluate_topic_enrichment import main as benchmark_main


def test_golden_set_contract_accepts_editor_annotations():
    golden = GoldenSet.model_validate(
        {
            "schema_version": "1",
            "episodes": [
                {
                    "video_id": "video-1",
                    "duration_ms": 600_000,
                    "subjects": ["Gaza", "US election"],
                    "acceptable_keywords": ["ceasefire"],
                    "junk_keywords": ["you know"],
                    "chapters": [
                        {"start_ms": 0, "title": "Opening news roundup", "evidence_start_ms": 12_000},
                        {"start_ms": 300_000, "title": "Ceasefire negotiations", "evidence_start_ms": 320_000},
                    ],
                }
            ],
        }
    )

    assert golden.schema_version == "1"
    assert golden.episodes[0].chapters[1].start_ms == 300_000


def test_golden_set_contract_rejects_nonzero_first_chapter():
    with pytest.raises(ValidationError, match="first chapter must start at 0"):
        GoldenSet.model_validate(
            {
                "schema_version": "1",
                "episodes": [
                    {
                        "video_id": "video-1",
                        "duration_ms": 600_000,
                        "subjects": ["Gaza"],
                        "chapters": [{"start_ms": 10_000, "title": "Late opening", "evidence_start_ms": 12_000}],
                    }
                ],
            }
        )


def test_benchmark_scores_predictions_and_passes_release_gates():
    golden = GoldenSet.model_validate(
        {
            "schema_version": "1",
            "episodes": [
                {
                    "video_id": "video-1",
                    "duration_ms": 600_000,
                    "subjects": ["Gaza", "US election"],
                    "acceptable_keywords": ["ceasefire"],
                    "junk_keywords": ["you know"],
                    "chapters": [
                        {"start_ms": 0, "title": "Opening news roundup", "evidence_start_ms": 12_000},
                        {"start_ms": 300_000, "title": "Ceasefire negotiations", "evidence_start_ms": 320_000},
                    ],
                }
            ],
        }
    )
    predictions = PredictionSet.model_validate(
        {
            "schema_version": "1",
            "pipeline_version": "semantic-v1",
            "episodes": [
                {
                    "video_id": "video-1",
                    "subjects": ["Gaza", "US election"],
                    "keywords": ["ceasefire"],
                    "chapters": [
                        {"start_ms": 0, "end_ms": 300_000, "title": "Opening news roundup"},
                        {"start_ms": 300_000, "end_ms": 600_000, "title": "Ceasefire negotiations"},
                    ],
                }
            ],
        }
    )

    report = evaluate_benchmark(golden, predictions)

    assert report.passed
    assert report.aggregate["tag_precision_at_5"] == 1.0
    assert report.aggregate["keyword_precision_at_10"] == 1.0
    assert report.aggregate["keyword_junk_rate"] == 0.0
    assert report.aggregate["chapter_boundary_f1"] == 1.0
    assert report.episodes[0]["video_id"] == "video-1"


def test_evaluation_cli_prints_json_and_uses_release_gate_exit_code(tmp_path, capsys):
    golden_path = tmp_path / "golden.json"
    predictions_path = tmp_path / "predictions.json"
    golden_path.write_text(
        json.dumps(
            {
                "schema_version": "1",
                "episodes": [
                    {
                        "video_id": "video-1",
                        "duration_ms": 100_000,
                        "subjects": ["Labor"],
                        "chapters": [{"start_ms": 0, "title": "Labor organizing", "evidence_start_ms": 5_000}],
                    }
                ],
            }
        )
    )
    predictions_path.write_text(
        json.dumps(
            {
                "schema_version": "1",
                "pipeline_version": "test-v1",
                "episodes": [
                    {
                        "video_id": "video-1",
                        "subjects": ["Labor"],
                        "chapters": [{"start_ms": 0, "end_ms": 100_000, "title": "Labor organizing"}],
                    }
                ],
            }
        )
    )

    exit_code = benchmark_main([str(golden_path), str(predictions_path)])
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert output["passed"] is True
    assert output["pipeline_version"] == "test-v1"

    failing = json.loads(predictions_path.read_text())
    failing["episodes"][0]["subjects"] = ["Unrelated filler"]
    predictions_path.write_text(json.dumps(failing))

    assert benchmark_main([str(golden_path), str(predictions_path)]) == 1
    assert json.loads(capsys.readouterr().out)["passed"] is False
