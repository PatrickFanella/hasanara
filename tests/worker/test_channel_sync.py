from unittest.mock import Mock

import pytest
from sqlalchemy import text

from worker.channel_sync import (
    ChannelSyncScheduler,
    ChannelSyncService,
    ChannelVideo,
    SqlChannelSyncRepository,
    parse_channel_urls,
)


class MemoryChannelSyncRepository:
    def __init__(self, existing_ids=()):
        self.video_ids = set(existing_ids)
        self.enqueued = []

    def enqueue_missing(self, video):
        if video.youtube_id in self.video_ids:
            return False
        self.video_ids.add(video.youtube_id)
        self.enqueued.append(video)
        return True


def test_channel_sync_enqueues_only_globally_missing_uploads():
    repository = MemoryChannelSyncRepository(existing_ids={"already-archived"})
    service = ChannelSyncService(
        repository=repository,
        fetch_channel=lambda _url: {
            "channel": "Current VODs",
            "entries": [
                {"id": "new-upload", "title": "New upload", "duration": 120},
                {"id": "already-archived", "title": "Old upload", "duration": 90},
            ],
        },
    )

    result = service.sync(["https://youtube.com/@CurrentVODs/videos"])

    assert result.discovered == 2
    assert result.enqueued == 1
    assert [video.youtube_id for video in repository.enqueued] == ["new-upload"]


def test_channel_sync_continues_when_one_channel_is_temporarily_unavailable():
    repository = MemoryChannelSyncRepository()

    def fetch_channel(url):
        if url.endswith("broken/videos"):
            raise RuntimeError("temporary YouTube error")
        return {"entries": [{"id": "healthy-upload", "title": "Healthy upload"}]}

    result = ChannelSyncService(repository=repository, fetch_channel=fetch_channel).sync(
        ["https://youtube.com/@broken/videos", "https://youtube.com/@healthy/videos"]
    )

    assert result.failed_channels == 1
    assert result.enqueued == 1


def test_channel_sync_scheduler_runs_immediately_then_every_six_hours():
    calls = []
    scheduler = ChannelSyncScheduler(interval_seconds=6 * 60 * 60, sync=lambda: calls.append("sync"))

    assert scheduler.run_if_due(now=100) is True
    assert scheduler.run_if_due(now=101) is False
    assert scheduler.run_if_due(now=100 + (6 * 60 * 60) - 1) is False
    assert scheduler.run_if_due(now=100 + (6 * 60 * 60)) is True
    assert calls == ["sync", "sync"]


def test_channel_sync_interval_cannot_exceed_24_hours():
    with pytest.raises(ValueError, match="24 hours"):
        ChannelSyncScheduler(interval_seconds=(24 * 60 * 60) + 1, sync=lambda: None)


def test_sql_repository_creates_one_system_job_for_a_missing_video():
    conn = Mock()
    conn.execute.return_value.first.return_value = ("new-video-row",)
    repository = SqlChannelSyncRepository(conn)

    inserted = repository.enqueue_missing(
        ChannelVideo(
            youtube_id="new-upload",
            title="New upload",
            duration_seconds=120,
            channel_name="Current VODs",
        )
    )

    assert inserted is True
    sql = str(conn.execute.call_args.args[0])
    assert "NOT EXISTS" in sql
    assert "videos.youtube_id" in sql
    assert conn.execute.call_args.args[1]["youtube_id"] == "new-upload"


def test_configured_channel_urls_are_trimmed_and_empty_values_are_ignored():
    assert parse_channel_urls(" https://youtube.com/@one/videos, ,https://youtube.com/@two/videos ") == (
        "https://youtube.com/@one/videos",
        "https://youtube.com/@two/videos",
    )


def test_sql_repository_persists_a_captions_first_system_job(db_session):
    repository = SqlChannelSyncRepository(db_session.connection())
    video = ChannelVideo(
        youtube_id="channel-sync-integration",
        title="Integration upload",
        duration_seconds=180,
        channel_name="Current VODs",
    )

    assert repository.enqueue_missing(video) is True
    assert repository.enqueue_missing(video) is False

    row = (
        db_session.execute(
            text("""
            SELECT j.kind, j.state, j.meta->>'created_by' AS created_by,
                   j.meta->>'staged' AS staged, v.youtube_id
            FROM jobs j JOIN videos v ON v.job_id = j.id
            WHERE v.youtube_id = :youtube_id
        """),
            {"youtube_id": video.youtube_id},
        )
        .mappings()
        .one()
    )
    assert row == {
        "kind": "single",
        "state": "downloading",
        "created_by": "channel_sync",
        "staged": "true",
        "youtube_id": video.youtube_id,
    }
