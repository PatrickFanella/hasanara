from __future__ import annotations

from app.archive.semantic_windows import build_semantic_windows


def test_semantic_windows_overlap_and_preserve_block_evidence():
    blocks = [
        {"block_index": 0, "start_ms": 0, "end_ms": 60_000, "text": "Election campaign news."},
        {"block_index": 1, "start_ms": 60_000, "end_ms": 120_000, "text": "Polling and voter turnout."},
        {"block_index": 2, "start_ms": 120_000, "end_ms": 180_000, "text": "Union organizers announce a strike."},
    ]

    windows = build_semantic_windows(
        blocks,
        duration_ms=180_000,
        window_ms=120_000,
        stride_ms=60_000,
    )

    assert [(window["start_ms"], window["end_ms"]) for window in windows] == [
        (0, 120_000),
        (60_000, 180_000),
        (120_000, 180_000),
    ]
    assert windows[0]["block_indexes"] == [0, 1]
    assert windows[1]["block_indexes"] == [1, 2]
    assert windows[2]["text"] == "Union organizers announce a strike."
