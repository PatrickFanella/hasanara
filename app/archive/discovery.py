"""Deterministic, citation-backed public discovery pages."""

from __future__ import annotations

import uuid

from ..feed_cursor import CursorError, FeedCursor, decode_cursor, encode_cursor, filter_fingerprint
from ..schemas import (
    ArchiveDiscoveryResponse,
    ArchiveMomentDiscoveryItem,
    ArchiveTopicCard,
    ArchiveTopicDiscoveryItem,
    PageInfo,
)

_DISCOVERY_NAMESPACE = uuid.UUID("71973fc6-6425-4cb7-a5b5-d16b2d1eb6b7")


def _stable_id(value: str) -> uuid.UUID:
    return uuid.uuid5(_DISCOVERY_NAMESPACE, value)


def build_discovery_page(
    cards: list[ArchiveTopicCard], *, kind: str, limit: int, cursor: str | None
) -> ArchiveDiscoveryResponse:
    fingerprint = filter_fingerprint({"kind": kind})
    entries: list[tuple[uuid.UUID, ArchiveTopicDiscoveryItem | ArchiveMomentDiscoveryItem]]
    if kind == "topics":
        ranked = sorted(cards, key=lambda card: (-card.trend_score, card.slug))
        entries = [(_stable_id(f"topic:{card.slug}"), ArchiveTopicDiscoveryItem(topic=card)) for card in ranked]
    else:
        moments: dict[str, ArchiveMomentDiscoveryItem] = {}
        for card in cards:
            for evidence in card.evidence:
                key = f"{evidence.video.id}:{evidence.start_ms}:{evidence.end_ms}"
                moments.setdefault(
                    key,
                    ArchiveMomentDiscoveryItem(
                        video=evidence.video,
                        start_ms=evidence.start_ms,
                        end_ms=evidence.end_ms,
                        snippet=evidence.snippet[:500],
                        topic=evidence.topic or card.label,
                    ),
                )
        ranked_moments = sorted(
            moments.items(),
            key=lambda item: (
                _effective_video_date(item[1]).isoformat() if _effective_video_date(item[1]) else "",
                str(item[1].video.id),
                -item[1].start_ms,
            ),
            reverse=True,
        )
        entries = [(_stable_id(f"moment:{key}"), item) for key, item in ranked_moments]

    start = 0
    if cursor:
        decoded = decode_cursor(cursor, expected_sort=kind, expected_fingerprint=fingerprint)
        try:
            start = next(index for index, (item_id, _) in enumerate(entries) if item_id == decoded.video_id) + 1
        except StopIteration as exc:
            raise CursorError("cursor boundary is no longer available") from exc
    page = entries[start : start + limit]
    has_next = start + len(page) < len(entries)
    next_cursor = None
    if has_next and page:
        next_cursor = encode_cursor(
            FeedCursor(sort=kind, fingerprint=fingerprint, video_id=page[-1][0], primary=start + len(page))
        )
    return ArchiveDiscoveryResponse(
        items=[item for _, item in page],
        page_info=PageInfo(
            has_next_page=has_next,
            has_previous_page=start > 0,
            next_cursor=next_cursor,
            previous_cursor=None,
            total_count=len(entries),
        ),
    )


def _effective_video_date(item: ArchiveMomentDiscoveryItem):
    return item.video.uploaded_at or item.video.created_at
