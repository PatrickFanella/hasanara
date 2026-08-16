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
                "title": "Election news",
                "duration_ms": 240_000,
                "transcript_source": "whisper",
                "transcript_coverage": 1.0,
                "transcript_selection_reason": "whisper_preferred_on_quality_tie",
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


def test_representative_export_excludes_episodes_too_short_for_chapter_review():
    db = _ReadOnlyDb()

    export_enrichment_input(
        db,
        pipeline_version="semantic-qwen-v1",
        sample_size=1,
        per_stratum=1,
    )

    candidate_sql, candidate_params = next(call for call in db.calls if "FROM videos AS v" in call[0])
    assert "duration_seconds" in candidate_sql
    assert candidate_params["minimum_duration_seconds"] == 30 * 60


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
    assert candidate_params["minimum_duration_seconds"] == 1


class _RawWhisperOnlyDb(_ReadOnlyDb):
    def execute(self, statement, params=None):
        sql = str(statement)
        self.calls.append((sql, params or {}))
        if "FROM videos AS v" in sql:
            return _Result(
                [
                    {
                        "id": "video-1",
                        "title": "Raw Whisper only",
                        "duration_seconds": 240,
                        "uploaded_at": "2026-08-08",
                        "category": "News",
                    }
                ]
            )
        if "FROM transcript_blocks" in sql:
            return _Result([])
        if "FROM segments" in sql:
            return _Result(
                [
                    {"id": 1, "start_ms": 0, "end_ms": 60_000, "text": "Opening discussion"},
                    {"id": 2, "start_ms": 120_000, "end_ms": 180_000, "text": "Later discussion"},
                ]
            )
        if "FROM youtube_segments" in sql:
            return _Result([])
        raise AssertionError(f"Unexpected query: {sql}")


def test_exporter_falls_back_to_raw_whisper_segments_when_blocks_are_not_backfilled():
    db = _RawWhisperOnlyDb()

    packet = export_enrichment_input(
        db,
        pipeline_version="semantic-qwen-v1",
        video_ids=["video-1"],
    )

    episode = packet.episodes[0]
    assert episode.transcript_source == "whisper"
    assert [block.text for block in episode.blocks] == ["Opening discussion", "Later discussion"]
    candidate_sql = next(sql for sql, _params in db.calls if "FROM videos AS v" in sql)
    assert "FROM segments AS s" in candidate_sql
