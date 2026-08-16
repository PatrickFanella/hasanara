from __future__ import annotations

from typing import Any

from sqlalchemy import text

from .enrichment_runner import EnrichmentInput, EpisodeInput, TranscriptBlockInput
from .golden_sampler import select_representative_videos
from .labeling.windows import build_windows_from_segments, load_source_segments
from .transcript_selection import TranscriptSource, select_preferred_transcript


def _clean_transcript_text(value: Any) -> str:
    return " ".join(str(value or "").replace("\x00", " ").split())[:20_000]


def _candidate_videos(
    db: Any,
    candidate_limit: int,
    minimum_duration_seconds: int,
    video_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    id_clause = "AND CAST(v.id AS text) = ANY(CAST(:video_ids AS text[]))" if video_ids else ""
    params: dict[str, Any] = {
        "candidate_limit": candidate_limit,
        "minimum_duration_seconds": minimum_duration_seconds,
    }
    if video_ids:
        params["video_ids"] = video_ids
    rows = (
        db.execute(
            text(f"""
                SELECT
                    CAST(v.id AS text) AS id,
                    v.title,
                    v.duration_seconds,
                    v.uploaded_at,
                    v.category
                FROM videos AS v
                WHERE COALESCE(v.duration_seconds, 0) >= :minimum_duration_seconds
                  {id_clause}
                  AND EXISTS (
                      SELECT 1
                      FROM transcript_blocks AS tb
                      WHERE tb.video_id = v.id
                      UNION ALL
                      SELECT 1
                      FROM segments AS s
                      WHERE s.video_id = v.id
                      UNION ALL
                      SELECT 1
                      FROM youtube_transcripts AS yt
                      JOIN youtube_segments AS ys ON ys.youtube_transcript_id = yt.id
                      WHERE yt.video_id = v.id
                  )
                ORDER BY v.uploaded_at DESC NULLS LAST, v.created_at DESC, v.id
                LIMIT :candidate_limit
                """),
            params,
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def _native_blocks(db: Any, video_id: str, duration_ms: int, max_blocks: int) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            text("""
                SELECT block_index, start_ms, end_ms, text
                FROM transcript_blocks
                WHERE video_id = :video_id
                ORDER BY block_index, start_ms
                LIMIT :max_blocks
                """),
            {"video_id": video_id, "max_blocks": max_blocks},
        )
        .mappings()
        .all()
    )
    if not rows:
        rows = [
            {
                "block_index": index,
                "start_ms": window.start_ms,
                "end_ms": window.end_ms,
                "text": window.text,
            }
            for index, window in enumerate(
                build_windows_from_segments(
                    load_source_segments(db, video_id, "whisper"),
                    source="whisper",
                    window_ms=120_000,
                )
            )
        ][:max_blocks]
    blocks: list[dict[str, Any]] = []
    for row in rows:
        start_ms = max(0, int(row.get("start_ms") or 0))
        end_ms = min(duration_ms, int(row.get("end_ms") or start_ms))
        cleaned = _clean_transcript_text(row.get("text"))
        if end_ms <= start_ms or not cleaned:
            continue
        blocks.append(
            {
                "id": int(row.get("block_index") or 0),
                "start_ms": start_ms,
                "end_ms": end_ms,
                "text": cleaned,
            }
        )
    return blocks


def _youtube_segments(db: Any, video_id: str) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            text("""
                SELECT ys.id, ys.start_ms, ys.end_ms, ys.text
                FROM youtube_segments AS ys
                JOIN youtube_transcripts AS yt ON yt.id = ys.youtube_transcript_id
                WHERE yt.video_id = :video_id
                ORDER BY ys.start_ms, ys.id
                """),
            {"video_id": video_id},
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def _selected_video_blocks(
    db: Any, video_id: str, duration_ms: int, max_blocks: int
) -> tuple[list[TranscriptBlockInput], TranscriptSource, float, str]:
    native = _native_blocks(db, video_id, duration_ms, max_blocks)
    youtube = _youtube_segments(db, video_id)
    selected = select_preferred_transcript(native, youtube, duration_ms=duration_ms)
    if selected.source == "whisper":
        raw_blocks = selected.segments[:max_blocks]
    else:
        raw_blocks = [
            {
                "id": index,
                "start_ms": window.start_ms,
                "end_ms": window.end_ms,
                "text": window.text,
            }
            for index, window in enumerate(
                build_windows_from_segments(selected.segments, source="youtube", window_ms=120_000)
            )
        ][:max_blocks]
    blocks: list[TranscriptBlockInput] = []
    for row in raw_blocks:
        start_ms = max(0, int(row["start_ms"]))
        end_ms = min(duration_ms, int(row["end_ms"]))
        cleaned = _clean_transcript_text(row["text"])
        if start_ms >= duration_ms or end_ms <= start_ms or not cleaned:
            continue
        blocks.append(
            TranscriptBlockInput(
                block_index=len(blocks),
                start_ms=start_ms,
                end_ms=end_ms,
                text=cleaned,
            )
        )
    return blocks, selected.source, selected.quality.coverage_ratio, selected.reason


def export_enrichment_input(
    db: Any,
    *,
    pipeline_version: str,
    sample_size: int = 30,
    per_stratum: int = 5,
    candidate_limit: int = 600,
    max_blocks_per_video: int = 20_000,
    minimum_duration_seconds: int = 30 * 60,
    video_ids: list[str] | None = None,
) -> EnrichmentInput:
    """Export a minimal, read-only transcript packet for offline evaluation."""
    if sample_size <= 0 or candidate_limit < sample_size or max_blocks_per_video <= 0 or minimum_duration_seconds <= 0:
        raise ValueError("export bounds are invalid")
    requested_ids = list(dict.fromkeys(video_ids or []))
    if len(requested_ids) > 100:
        raise ValueError("explicit exports are limited to 100 videos")
    candidates = _candidate_videos(
        db,
        max(candidate_limit, len(requested_ids)),
        1 if requested_ids else minimum_duration_seconds,
        requested_ids or None,
    )
    if requested_ids:
        candidates_by_id = {str(video["id"]): video for video in candidates}
        missing = [video_id for video_id in requested_ids if video_id not in candidates_by_id]
        if missing:
            raise ValueError(f"requested videos were unavailable for export: {', '.join(missing)}")
        selected = [candidates_by_id[video_id] for video_id in requested_ids]
    else:
        selected = select_representative_videos(candidates, per_stratum=per_stratum, total_limit=sample_size)
    episodes: list[EpisodeInput] = []
    for video in selected:
        duration_ms = int(video.get("duration_seconds") or 0) * 1000
        blocks, transcript_source, transcript_coverage, selection_reason = _selected_video_blocks(
            db, str(video["id"]), duration_ms, max_blocks_per_video
        )
        if not blocks:
            continue
        episodes.append(
            EpisodeInput(
                video_id=str(video["id"]),
                title=str(video.get("title") or "").strip() or None,
                duration_ms=duration_ms,
                transcript_source=transcript_source,
                transcript_coverage=transcript_coverage,
                transcript_selection_reason=selection_reason,
                blocks=blocks,
            )
        )
    if not episodes:
        raise ValueError("no exportable transcript blocks were found")
    return EnrichmentInput(
        schema_version="1",
        pipeline_version=pipeline_version,
        episodes=episodes,
    )


__all__ = ["export_enrichment_input"]
