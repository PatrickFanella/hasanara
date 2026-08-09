from __future__ import annotations

from app.archive.enrichment_exporter import export_enrichment_input


class _Result:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return self.rows


class _ReadOnlyDb:
    def __init__(self):
        self.calls = []

    def execute(self, statement, params=None):
        sql = str(statement)
        self.calls.append((sql, params or {}))
        if "FROM videos AS v" in sql:
            return _Result(
                [
                    {
                        "id": "video-1",
                        "title": "Election news",
                        "duration_seconds": 240,
                        "uploaded_at": "2026-08-08",
                        "category": "News",
                    }
                ]
            )
        return _Result(
            [
                {"block_index": 0, "start_ms": 0, "end_ms": 120_000, "text": "Election\x00 campaign"},
                {"block_index": 1, "start_ms": 120_000, "end_ms": 240_000, "text": "Polling analysis"},
            ]
        )

    def commit(self):
        raise AssertionError("exporter must never commit")


def test_exporter_emits_minimal_versioned_transcript_packet_without_sensitive_fields():
    db = _ReadOnlyDb()

    packet = export_enrichment_input(
        db,
        pipeline_version="semantic-qwen-v1",
        sample_size=1,
        per_stratum=1,
    )
    exported = packet.model_dump(mode="json")

    assert exported == {
        "schema_version": "1",
        "pipeline_version": "semantic-qwen-v1",
        "episodes": [
            {
                "video_id": "video-1",
                "duration_ms": 240_000,
                "blocks": [
                    {"block_index": 0, "start_ms": 0, "end_ms": 120_000, "text": "Election campaign"},
                    {"block_index": 1, "start_ms": 120_000, "end_ms": 240_000, "text": "Polling analysis"},
                ],
            }
        ],
    }
    sql = " ".join(statement for statement, _params in db.calls).casefold()
    for forbidden in ("raw_path", "wav_path", "speaker_label", "session", "users", "jobs"):
        assert forbidden not in sql


def test_exporter_supports_explicit_video_ids_for_editor_selected_golden_sets():
    db = _ReadOnlyDb()

    packet = export_enrichment_input(
        db,
        pipeline_version="semantic-qwen-v1",
        video_ids=["video-1"],
    )

    assert [episode.video_id for episode in packet.episodes] == ["video-1"]
    candidate_params = next(params for sql, params in db.calls if "FROM videos AS v" in sql)
    assert candidate_params["video_ids"] == ["video-1"]
