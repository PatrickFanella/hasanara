import uuid
from datetime import UTC, datetime

from app.archive.discovery import build_discovery_page
from app.schemas import ArchiveEvidenceMoment, ArchiveTopicCard, VideoInfo


def _video(index: int) -> VideoInfo:
    return VideoInfo(
        id=uuid.UUID(f"00000000-0000-0000-0000-{index:012d}"),
        youtube_id=f"video{index:06d}",
        title=f"Video {index}",
        uploaded_at=datetime(2026, 8, index, tzinfo=UTC),
    )


def _topic(index: int, score: float) -> ArchiveTopicCard:
    video = _video(index)
    return ArchiveTopicCard(
        slug=f"topic-{index}",
        label=f"Topic {index}",
        source="curated",
        status="published",
        trend_score=score,
        total_moments=1,
        total_videos=1,
        evidence=[
            ArchiveEvidenceMoment(
                video=video,
                start_ms=index * 1000,
                end_ms=index * 1000 + 900,
                snippet=f"Bounded citation {index}",
                topic=f"Topic {index}",
            )
        ],
    )


def test_topics_are_deterministic_and_cursor_pages_do_not_overlap():
    cards = [_topic(1, 2), _topic(2, 5), _topic(3, 5)]

    first = build_discovery_page(cards, kind="topics", limit=2, cursor=None)
    second = build_discovery_page(
        cards, kind="topics", limit=2, cursor=first.page_info.next_cursor
    )

    assert [item.topic.slug for item in first.items] == ["topic-2", "topic-3"]
    assert [item.topic.slug for item in second.items] == ["topic-1"]
    assert first.page_info.total_count == 3
    assert not ({item.topic.slug for item in first.items} & {item.topic.slug for item in second.items})


def test_moments_are_recent_first_and_snippets_are_bounded():
    cards = [_topic(1, 5), _topic(2, 4)]
    cards[1].evidence[0].snippet = "x" * 900

    page = build_discovery_page(cards, kind="moments", limit=12, cursor=None)

    assert [item.video.id for item in page.items] == [_video(2).id, _video(1).id]
    assert len(page.items[0].snippet) == 500
