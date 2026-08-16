from app.archive.transcript_selection import assess_transcript_source, select_preferred_transcript


def test_transcript_selection_prefers_materially_more_complete_youtube_captions():
    whisper = [{"id": 1, "start_ms": 0, "end_ms": 30_000, "text": "brief native opening"}]
    youtube = [
        {"id": index, "start_ms": index * 60_000, "end_ms": (index + 1) * 60_000, "text": "caption " * 80}
        for index in range(10)
    ]

    selected = select_preferred_transcript(whisper, youtube, duration_ms=600_000)

    assert selected.source == "youtube"
    assert selected.reason == "youtube_higher_coverage_quality"
    assert selected.quality.coverage_ratio == 1.0


def test_transcript_selection_prefers_native_whisper_on_a_quality_tie():
    rows = [
        {"id": index, "start_ms": index * 60_000, "end_ms": (index + 1) * 60_000, "text": "speech " * 70}
        for index in range(3)
    ]

    selected = select_preferred_transcript(rows, rows, duration_ms=180_000)

    assert selected.source == "whisper"
    assert selected.reason == "whisper_preferred_on_quality_tie"


def test_transcript_quality_counts_time_buckets_not_duplicate_rows():
    duplicated = [
        {"id": index, "start_ms": 0, "end_ms": 10_000, "text": "same opening caption"} for index in range(100)
    ]

    _rows, quality = assess_transcript_source("youtube", duplicated, duration_ms=600_000)

    assert quality.segment_count == 100
    assert quality.coverage_ratio == 0.1
    assert quality.score < 0.25


def test_transcript_quality_ignores_segments_entirely_after_the_video_duration():
    rows = [
        {"id": 1, "start_ms": 0, "end_ms": 10_000, "text": "valid opening"},
        {"id": 2, "start_ms": 900_000, "end_ms": 910_000, "text": "bad trailing timestamp"},
    ]

    cleaned, quality = assess_transcript_source("whisper", rows, duration_ms=600_000)

    assert len(cleaned) == 1
    assert quality.coverage_ratio == 0.1
    assert quality.token_count == 2
