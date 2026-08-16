from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from app.exceptions import NotFoundError, ValidationError


def _rows(result: Any) -> list[dict[str, Any]]:
    if hasattr(result, "mappings"):
        return [dict(row) for row in result.mappings().all()]
    return [dict(row) for row in result.all()]


def _json_list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    return [dict(item) for item in value] if isinstance(value, list) else []


def _chapter_dict(row: dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    item["evidence"] = _json_list(item.get("evidence"))
    item["confidence_score"] = float(item.get("confidence_score") or 0)
    return item


def list_chapter_candidate_sets(
    db: Any,
    *,
    status: str = "candidate",
    video_id: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> list[dict[str, Any]]:
    if status not in {"candidate", "published", "rejected", "hidden"}:
        raise ValidationError("Unsupported chapter status", field="status")
    clauses = ["c.status = :status"]
    params: dict[str, Any] = {"status": status, "limit": limit, "offset": offset}
    if video_id:
        clauses.append("c.video_id = :video_id")
        params["video_id"] = video_id
    rows = _rows(
        db.execute(
            text(f"""
                WITH selected_videos AS (
                    SELECT c.video_id, max(c.updated_at) AS latest_update
                    FROM archive_video_chapters AS c
                    WHERE {' AND '.join(clauses)}
                    GROUP BY c.video_id
                    ORDER BY latest_update DESC, c.video_id
                    LIMIT :limit OFFSET :offset
                )
                SELECT
                    c.id,
                    c.video_id,
                    v.youtube_id,
                    v.title AS video_title,
                    v.duration_seconds,
                    c.chapter_index,
                    c.start_ms,
                    c.end_ms,
                    c.title,
                    c.summary,
                    c.confidence_score,
                    c.status,
                    c.source,
                    c.evidence,
                    c.pipeline_version,
                    c.model_name,
                    c.prompt_version,
                    c.transcript_source,
                    c.run_id,
                    c.created_at,
                    c.updated_at
                FROM selected_videos AS selected
                JOIN archive_video_chapters AS c ON c.video_id = selected.video_id
                JOIN videos AS v ON v.id = c.video_id
                WHERE c.status = :status
                ORDER BY selected.latest_update DESC, c.video_id, c.chapter_index
                """),
            params,
        )
    )
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = str(row["video_id"])
        group = grouped.setdefault(
            key,
            {
                "video_id": row["video_id"],
                "youtube_id": row.get("youtube_id"),
                "video_title": row.get("video_title"),
                "duration_seconds": row.get("duration_seconds"),
                "chapters": [],
            },
        )
        group["chapters"].append(_chapter_dict(row))
    return list(grouped.values())


def _insert_feedback(
    db: Any,
    *,
    chapter_id: str,
    video_id: str,
    action: str,
    old_value: dict[str, Any],
    new_value: dict[str, Any],
    reason: str | None,
    user_id: str | None,
) -> None:
    db.execute(
        text("""
            INSERT INTO archive_chapter_feedback (
                chapter_id, video_id, action, old_value, new_value, reason, user_id, created_at
            ) VALUES (
                :chapter_id, :video_id, :action, CAST(:old_value AS jsonb),
                CAST(:new_value AS jsonb), :reason, :user_id, now()
            )
            """),
        {
            "chapter_id": chapter_id,
            "video_id": video_id,
            "action": action,
            "old_value": json.dumps(old_value),
            "new_value": json.dumps(new_value),
            "reason": reason,
            "user_id": user_id,
        },
    )


def _editable_snapshot(chapter: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(chapter["id"]),
        "chapter_index": int(chapter["chapter_index"]),
        "start_ms": int(chapter["start_ms"]),
        "end_ms": int(chapter["end_ms"]),
        "title": str(chapter.get("title") or ""),
        "summary": str(chapter.get("summary") or ""),
        "status": str(chapter["status"]),
        "source": str(chapter["source"]),
    }


def review_chapter_set(
    db: Any,
    video_id: str,
    *,
    action: str,
    edits: list[dict[str, Any]] | None = None,
    reason: str | None = None,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    if action not in {"publish", "reject"}:
        raise ValidationError("Unsupported chapter review action", field="action")
    video_rows = _rows(
        db.execute(
            text("SELECT id, duration_seconds FROM videos WHERE id = :video_id FOR UPDATE"),
            {"video_id": video_id},
        )
    )
    if not video_rows:
        raise NotFoundError(f"Video {video_id} not found", resource_type="video")
    duration_ms = int(video_rows[0].get("duration_seconds") or 0) * 1000
    if duration_ms <= 0:
        raise ValidationError("Video duration is required before chapter review", field="video_id")

    chapters = _rows(
        db.execute(
            text("""
                SELECT *
                FROM archive_video_chapters
                WHERE video_id = :video_id AND status = 'candidate'
                ORDER BY chapter_index
                FOR UPDATE
                """),
            {"video_id": video_id},
        )
    )
    if not chapters:
        raise NotFoundError(
            f"No candidate chapters found for video {video_id}",
            resource_type="archive_video_chapters",
        )

    if action == "reject":
        if not reason or not reason.strip():
            raise ValidationError(
                "A review note is required when rejecting a chapter set",
                field="reason",
            )
        for chapter in chapters:
            old_value = _editable_snapshot(chapter)
            new_value = {**old_value, "status": "rejected"}
            db.execute(
                text("""
                    UPDATE archive_video_chapters
                    SET status = 'rejected', updated_at = now()
                    WHERE id = :chapter_id
                    """),
                {"chapter_id": str(chapter["id"])},
            )
            _insert_feedback(
                db,
                chapter_id=str(chapter["id"]),
                video_id=video_id,
                action="reject",
                old_value=old_value,
                new_value=new_value,
                reason=reason.strip(),
                user_id=user_id,
            )
        return [{**_chapter_dict(chapter), "status": "rejected"} for chapter in chapters]

    edit_by_id = {str(item.get("id")): item for item in edits or []}
    chapter_ids = {str(chapter["id"]) for chapter in chapters}
    unknown_ids = sorted(set(edit_by_id) - chapter_ids)
    if unknown_ids:
        raise ValidationError(f"Unknown candidate chapter id: {unknown_ids[0]}", field="chapters")

    proposed: list[dict[str, Any]] = []
    for chapter in chapters:
        edit = edit_by_id.get(str(chapter["id"]), {})
        title = str(edit.get("title", chapter.get("title") or "")).strip()
        summary = str(edit.get("summary", chapter.get("summary") or "")).strip()
        start_ms = int(edit.get("start_ms", chapter["start_ms"]))
        if not title:
            raise ValidationError("Every published chapter needs a title", field="chapters")
        if len(title) > 100:
            raise ValidationError("Chapter titles are limited to 100 characters", field="chapters")
        if len(summary) > 500:
            raise ValidationError("Chapter summaries are limited to 500 characters", field="chapters")
        proposed.append({**chapter, "title": title, "summary": summary, "start_ms": start_ms})

    starts = [int(chapter["start_ms"]) for chapter in proposed]
    if starts[0] != 0:
        raise ValidationError("The first chapter must start at 0", field="chapters")
    if starts != sorted(set(starts)):
        raise ValidationError("Chapter starts must be unique and increasing", field="chapters")
    if starts[-1] >= duration_ms:
        raise ValidationError("The final chapter must start before the video ends", field="chapters")
    chapter_boundaries = [*starts, duration_ms]
    if any(
        next_start - start < 30_000
        for start, next_start in zip(chapter_boundaries, chapter_boundaries[1:], strict=False)
    ):
        raise ValidationError("Published chapters must be at least 30 seconds long", field="chapters")

    published: list[dict[str, Any]] = []
    for index, chapter in enumerate(proposed):
        old_value = _editable_snapshot(chapters[index])
        end_ms = starts[index + 1] if index + 1 < len(starts) else duration_ms
        changed = any(chapter[field] != chapters[index].get(field) for field in ("start_ms", "title", "summary"))
        source = "hybrid" if changed else str(chapter["source"])
        new_value = {
            **old_value,
            "chapter_index": index,
            "start_ms": int(chapter["start_ms"]),
            "end_ms": end_ms,
            "title": chapter["title"],
            "summary": chapter["summary"],
            "status": "published",
            "source": source,
        }
        db.execute(
            text("""
                UPDATE archive_video_chapters
                SET chapter_index = :chapter_index,
                    start_ms = :start_ms,
                    end_ms = :end_ms,
                    title = :title,
                    summary = :summary,
                    status = 'published',
                    source = :source,
                    updated_at = now()
                WHERE id = :chapter_id
                """),
            {
                "chapter_id": str(chapter["id"]),
                **{
                    key: new_value[key] for key in ("chapter_index", "start_ms", "end_ms", "title", "summary", "source")
                },
            },
        )
        if changed:
            feedback_action = "boundary_adjust" if int(old_value["start_ms"]) != int(new_value["start_ms"]) else "edit"
            _insert_feedback(
                db,
                chapter_id=str(chapter["id"]),
                video_id=video_id,
                action=feedback_action,
                old_value=old_value,
                new_value=new_value,
                reason=reason,
                user_id=user_id,
            )
        _insert_feedback(
            db,
            chapter_id=str(chapter["id"]),
            video_id=video_id,
            action="publish",
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            user_id=user_id,
        )
        published.append({**_chapter_dict(chapter), **new_value})
    return published


__all__ = ["list_chapter_candidate_sets", "review_chapter_set"]
