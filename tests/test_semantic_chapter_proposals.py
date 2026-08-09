from __future__ import annotations

from app.archive.semantic_chapters import propose_semantic_chapters


def test_semantic_chapters_split_on_sustained_subject_change():
    windows = [
        {"start_ms": 0, "end_ms": 120_000, "text": "Election polling and campaign news"},
        {"start_ms": 120_000, "end_ms": 240_000, "text": "More election campaign analysis"},
        {"start_ms": 240_000, "end_ms": 360_000, "text": "The labor union begins its strike"},
        {"start_ms": 360_000, "end_ms": 480_000, "text": "Workers describe the strike demands"},
    ]
    embeddings = [[1.0, 0.0], [0.95, 0.05], [0.05, 0.95], [0.0, 1.0]]

    proposals = propose_semantic_chapters(
        windows,
        embeddings,
        duration_ms=480_000,
        min_chapter_ms=120_000,
        max_chapter_ms=600_000,
        novelty_threshold=0.5,
    )

    assert [(item.start_ms, item.end_ms) for item in proposals] == [(0, 240_000), (240_000, 480_000)]
    assert proposals[1].boundary_score > 0.8
    assert proposals[1].evidence_window_indexes == (2, 3)


def test_semantic_chapters_split_long_homogeneous_spans_on_real_windows():
    windows = [
        {"start_ms": start, "end_ms": start + 120_000, "text": "Continuing subject"}
        for start in range(0, 720_000, 120_000)
    ]
    embeddings = [[1.0, 0.0] for _window in windows]

    proposals = propose_semantic_chapters(
        windows,
        embeddings,
        duration_ms=720_000,
        min_chapter_ms=120_000,
        max_chapter_ms=240_000,
        novelty_threshold=0.5,
    )

    assert [(item.start_ms, item.end_ms) for item in proposals] == [
        (0, 240_000),
        (240_000, 480_000),
        (480_000, 720_000),
    ]


def test_semantic_chapters_do_not_create_short_trailing_chapter():
    windows = [
        {"start_ms": 0, "end_ms": 260_000, "text": "Continuing subject"},
        {"start_ms": 260_000, "end_ms": 520_000, "text": "Continuing subject"},
        {"start_ms": 520_000, "end_ms": 600_000, "text": "Continuing subject"},
    ]

    proposals = propose_semantic_chapters(
        windows,
        [[1.0, 0.0] for _window in windows],
        duration_ms=600_000,
        min_chapter_ms=100_000,
        max_chapter_ms=550_000,
        novelty_threshold=0.5,
    )

    assert [(item.start_ms, item.end_ms) for item in proposals] == [(0, 260_000), (260_000, 600_000)]
