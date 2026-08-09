from __future__ import annotations

import json

from app.archive.enrichment_runner import EnrichmentInput
from scripts.export_topic_enrichment_input import main


def test_export_cli_writes_versioned_packet_and_closes_read_session(monkeypatch, tmp_path):
    output = tmp_path / "transcript-input.json"
    captured = {}

    class _Db:
        closed = False

        def close(self):
            self.closed = True

    db = _Db()
    monkeypatch.setattr("scripts.export_topic_enrichment_input.SessionLocal", lambda: db)

    def export(_db, **kwargs):
        captured.update(kwargs)
        return EnrichmentInput.model_validate(
            {
                "schema_version": "1",
                "pipeline_version": kwargs["pipeline_version"],
                "episodes": [
                    {
                        "video_id": "video-1",
                        "duration_ms": 120_000,
                        "blocks": [{"block_index": 0, "start_ms": 0, "end_ms": 120_000, "text": "Election news"}],
                    }
                ],
            }
        )

    monkeypatch.setattr("scripts.export_topic_enrichment_input.export_enrichment_input", export)

    exit_code = main(
        [
            str(output),
            "--pipeline-version",
            "semantic-qwen-v1",
            "--video-id",
            "video-1",
        ]
    )

    assert exit_code == 0
    assert db.closed
    assert captured["video_ids"] == ["video-1"]
    assert json.loads(output.read_text())["schema_version"] == "1"
