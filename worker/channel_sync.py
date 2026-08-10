"""Incremental discovery of uploads from configured YouTube channels."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Protocol

from sqlalchemy import text

from app.logging_config import get_logger
from worker.youtube.service import get_youtube_service

logger = get_logger(__name__)


@dataclass(frozen=True)
class ChannelVideo:
    youtube_id: str
    title: str
    duration_seconds: int | None
    channel_name: str | None


@dataclass(frozen=True)
class ChannelSyncResult:
    discovered: int = 0
    enqueued: int = 0
    failed_channels: int = 0


class ChannelSyncRepository(Protocol):
    def enqueue_missing(self, video: ChannelVideo) -> bool: ...


class SqlChannelSyncRepository:
    """Persist channel discoveries as independent, captions-first system jobs."""

    def __init__(self, conn: Any) -> None:
        self.conn = conn

    def enqueue_missing(self, video: ChannelVideo) -> bool:
        input_url = f"https://www.youtube.com/watch?v={video.youtube_id}"
        row = self.conn.execute(
            text("""
                WITH channel_lock AS MATERIALIZED (
                    SELECT pg_advisory_xact_lock(hashtextextended(:youtube_id, 0))
                ), missing_video AS (
                    SELECT CAST(:youtube_id AS text) AS youtube_id FROM channel_lock
                    WHERE NOT EXISTS (
                        SELECT 1 FROM videos WHERE videos.youtube_id = :youtube_id
                    )
                ), new_job AS (
                    INSERT INTO jobs (
                        kind, input_url, state, stage, meta, canonical_source, idempotency_key
                    )
                    SELECT
                        'single', :input_url, 'downloading', 'queued', CAST(:meta AS jsonb),
                        'youtube:video:' || youtube_id, 'channel-sync:' || youtube_id
                    FROM missing_video
                    RETURNING id
                )
                INSERT INTO videos (
                    job_id, youtube_id, idx, title, duration_seconds, channel_name
                )
                SELECT id, :youtube_id, 0, :title, :duration_seconds, :channel_name
                FROM new_job
                ON CONFLICT (job_id, youtube_id) DO NOTHING
                RETURNING id
            """),
            {
                "youtube_id": video.youtube_id,
                "input_url": input_url,
                "title": video.title,
                "duration_seconds": video.duration_seconds,
                "channel_name": video.channel_name,
                "meta": json.dumps({"created_by": "channel_sync", "staged": True}),
            },
        ).first()
        return row is not None


def parse_channel_urls(raw_urls: str) -> tuple[str, ...]:
    return tuple(url.strip() for url in raw_urls.split(",") if url.strip())


def sync_configured_channels(conn: Any, channel_urls: Iterable[str]) -> ChannelSyncResult:
    urls = tuple(channel_urls)
    service = get_youtube_service()
    result = ChannelSyncService(
        repository=SqlChannelSyncRepository(conn),
        fetch_channel=lambda url: service.fetch_metadata(url, flat_playlist=True),
    ).sync(urls)
    logger.info(
        "Recurring channel sync complete",
        extra={
            "channel_count": len(urls),
            "discovered": result.discovered,
            "enqueued": result.enqueued,
            "failed_channels": result.failed_channels,
        },
    )
    return result


class ChannelSyncService:
    """Discover channel uploads and enqueue each globally missing video once."""

    def __init__(
        self,
        *,
        repository: ChannelSyncRepository,
        fetch_channel: Callable[[str], dict[str, Any]],
    ) -> None:
        self.repository = repository
        self.fetch_channel = fetch_channel

    def sync(self, channel_urls: Iterable[str]) -> ChannelSyncResult:
        discovered = 0
        enqueued = 0
        failed_channels = 0
        for channel_url in channel_urls:
            try:
                metadata = self.fetch_channel(channel_url)
            except Exception as exc:
                failed_channels += 1
                logger.warning(
                    "Recurring channel discovery failed",
                    extra={"channel_url": channel_url, "error": str(exc)[:200]},
                )
                continue
            channel_name = metadata.get("channel") or metadata.get("uploader") or metadata.get("title")
            for entry in metadata.get("entries") or ():
                youtube_id = entry.get("id")
                if not youtube_id:
                    continue
                discovered += 1
                video = ChannelVideo(
                    youtube_id=str(youtube_id),
                    title=str(entry.get("title") or ""),
                    duration_seconds=entry.get("duration"),
                    channel_name=entry.get("channel") or entry.get("uploader") or channel_name,
                )
                if self.repository.enqueue_missing(video):
                    enqueued += 1
        return ChannelSyncResult(
            discovered=discovered,
            enqueued=enqueued,
            failed_channels=failed_channels,
        )


class ChannelSyncScheduler:
    """Run a channel sync immediately and then at a bounded interval."""

    MAX_INTERVAL_SECONDS = 24 * 60 * 60

    def __init__(self, *, interval_seconds: int, sync: Callable[[], object]) -> None:
        if interval_seconds <= 0 or interval_seconds > self.MAX_INTERVAL_SECONDS:
            raise ValueError("channel sync interval must be between 1 second and 24 hours")
        self.interval_seconds = interval_seconds
        self.sync = sync
        self.next_run_at = 0.0

    def run_if_due(self, *, now: float) -> bool:
        if now < self.next_run_at:
            return False
        self.next_run_at = now + self.interval_seconds
        self.sync()
        return True
