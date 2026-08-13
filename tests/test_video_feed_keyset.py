import uuid
from datetime import UTC, datetime

from sqlalchemy import text

from app import crud


def _seed_feed(db_session, *, count: int = 5):
    job_id = crud.create_job(db_session, "single", "https://youtube.com/watch?v=feed-keyset")
    category = f"feed-test-{uuid.uuid4()}"
    uploaded_at = datetime(2026, 8, 13, 12, tzinfo=UTC)
    ids = sorted((uuid.uuid4() for _ in range(count)), reverse=True)
    for index, video_id in enumerate(ids):
        db_session.execute(
            text(
                "INSERT INTO videos (id, job_id, youtube_id, idx, title, category, uploaded_at, duration_seconds) "
                "VALUES (:id, :job, :youtube, :idx, :title, :category, :uploaded, :duration)"
            ),
            {
                "id": video_id,
                "job": job_id,
                "youtube": f"keyset{index:05d}",
                "idx": index,
                "title": f"Keyset {index}",
                "category": category,
                "uploaded": uploaded_at,
                "duration": 100 + index,
            },
        )
    db_session.commit()
    return category, ids


def test_latest_keyset_has_no_duplicates_with_equal_timestamps_and_deleted_rows(db_session):
    category, expected_ids = _seed_feed(db_session)
    first = crud.list_video_feed(db_session, limit=2, sort="latest", category=category)
    first_page = first[:2]
    assert [row["id"] for row in first_page] == expected_ids[:2]

    db_session.execute(text("DELETE FROM videos WHERE id=:id"), {"id": first_page[0]["id"]})
    db_session.commit()
    second = crud.list_video_feed(
        db_session,
        limit=3,
        sort="latest",
        category=category,
        cursor_primary=first_page[-1]["feed_primary"].isoformat(),
        cursor_id=first_page[-1]["id"],
    )

    assert [row["id"] for row in second[:3]] == expected_ids[2:]
    assert not ({row["id"] for row in first_page} & {row["id"] for row in second})


def test_longest_keyset_uses_duration_then_stable_id(db_session):
    category, _ = _seed_feed(db_session, count=4)
    first = crud.list_video_feed(db_session, limit=2, sort="longest", category=category)
    second = crud.list_video_feed(
        db_session,
        limit=2,
        sort="longest",
        category=category,
        cursor_primary=first[1]["feed_primary"],
        cursor_id=first[1]["id"],
    )

    durations = [row["duration_seconds"] for row in [*first[:2], *second[:2]]]
    assert durations == [103, 102, 101, 100]
