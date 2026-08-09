from __future__ import annotations

from app.archive.golden_sampler import classify_video_stratum, select_representative_videos


def test_video_strata_cover_representative_archive_formats():
    examples = {
        "Hasan Reacts to the Presidential Debate": "politics_news",
        "Interview with Union Organizer Jane Doe": "interview_guest",
        "Hasan Plays Elden Ring": "gaming",
        "Watching the Wildest Jubilee Video": "react_content",
        "Chadvice Returns": "recurring_segment",
    }

    for title, expected in examples.items():
        assert classify_video_stratum({"title": title, "duration_seconds": 7_200}) == expected
    assert classify_video_stratum({"title": "HasanAbi Full Stream", "duration_seconds": 20_000}) == "long_mixed"


def test_representative_selection_balances_strata_and_is_deterministic():
    rows = [
        {"id": "politics-1", "title": "Election news", "duration_seconds": 7_200, "uploaded_at": "2026-08-08"},
        {"id": "politics-2", "title": "Trump news", "duration_seconds": 7_100, "uploaded_at": "2026-08-07"},
        {
            "id": "guest-1",
            "title": "Interview with a union organizer",
            "duration_seconds": 5_000,
            "uploaded_at": "2026-08-06",
        },
        {"id": "gaming-1", "title": "Hasan plays Elden Ring", "duration_seconds": 9_000, "uploaded_at": "2026-08-05"},
        {"id": "react-1", "title": "Watching Jubilee", "duration_seconds": 6_000, "uploaded_at": "2026-08-04"},
        {"id": "segment-1", "title": "Chadvice returns", "duration_seconds": 4_000, "uploaded_at": "2026-08-03"},
        {"id": "mixed-1", "title": "HasanAbi full stream", "duration_seconds": 20_000, "uploaded_at": "2026-08-02"},
    ]

    selected = select_representative_videos(rows, per_stratum=1, total_limit=6)

    assert [row["id"] for row in selected] == [
        "politics-1",
        "guest-1",
        "gaming-1",
        "react-1",
        "segment-1",
        "mixed-1",
    ]
    assert select_representative_videos(list(reversed(rows)), per_stratum=1, total_limit=6) == selected
