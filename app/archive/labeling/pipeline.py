from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.archive.transcript_selection import select_preferred_transcript

from .extractors import extract_alias_candidates, extract_keyphrase_candidates, extract_title_alias_candidates
from .normalization import slugify_label
from .policy import classify_candidate
from .repository import (
    ASSIGNMENT_SOURCES,
    create_extraction_run,
    finish_extraction_run,
    insert_assignment,
    upsert_label_candidate,
)
from .windows import build_windows_from_segments, load_source_segments, persist_windows

_DEFAULT_POLICY: dict[str, Any] = {
    "min_publish_score": 0.90,
    "min_review_score": 0.65,
    "min_evidence_count": 2,
    "min_distinct_videos": 1,
    "require_existing_canonical": False,
    "auto_publish_enabled": True,
}


def _fetch_all_dicts(result: Any) -> list[dict]:
    if hasattr(result, "mappings"):
        return [dict(row) for row in result.mappings().all()]
    if hasattr(result, "all"):
        return [dict(row) for row in result.all()]
    first = result.first() if hasattr(result, "first") else None
    return [] if first is None else [dict(first)]


def _fetch_first_dict(result: Any) -> dict | None:
    if hasattr(result, "mappings"):
        row = result.mappings().first()
    elif hasattr(result, "first"):
        row = result.first()
    else:
        row = None
    return None if row is None else dict(row)


def _table_columns(db: Any, table_name: str) -> set[str]:
    try:
        result = db.execute(
            text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = :table_name
                """),
            {"table_name": table_name},
        )
        return {str(row["column_name"] if isinstance(row, dict) else row[0]) for row in _fetch_all_dicts(result)}
    except Exception:
        return set()


def _load_existing_aliases(db: Any) -> list[dict]:
    alias_columns = _table_columns(db, "archive_label_aliases")
    select_columns = [
        "l.id AS label_id",
        "l.label",
        "l.kind",
        "l.status AS label_status",
        "a.alias",
        "a.normalized_alias",
    ]
    if "status" in alias_columns:
        select_columns.append("a.status AS status")
    if "is_ambiguous" in alias_columns:
        select_columns.append("a.is_ambiguous AS is_ambiguous")

    # Only curated labels or labels with an explicit human publish decision may
    # seed future alias matches. Automatic keyphrases remain review candidates,
    # but cannot bootstrap themselves into high-confidence canonical aliases.
    where_clauses = [
        "l.status = 'published'",
        """(
            l.source IN ('admin', 'seed', 'hybrid')
            OR EXISTS (
                SELECT 1
                FROM archive_label_feedback AS f
                WHERE f.label_id = l.id
                  AND f.action IN ('approve', 'publish')
            )
        )""",
    ]
    if "status" in alias_columns:
        where_clauses.append("a.status = 'active'")
    # Treat duplicate normalized aliases as ambiguous even when an older import
    # failed to maintain the denormalized is_ambiguous flag.
    where_clauses.append("""
        NOT EXISTS (
            SELECT 1
            FROM archive_label_aliases AS competing
            WHERE competing.normalized_alias = a.normalized_alias
              AND competing.label_id <> a.label_id
              AND competing.status = 'active'
        )
    """)

    statement = text(f"""
        SELECT {', '.join(select_columns)}
        FROM archive_labels AS l
        JOIN archive_label_aliases AS a ON a.label_id = l.id
        WHERE {' AND '.join(where_clauses)}
        ORDER BY l.label, a.alias
        """)
    result = db.execute(statement)
    return _fetch_all_dicts(result)


def _load_policy(db: Any, label_kind: str, unit_type: str, extraction_tier: str) -> dict:
    statement = text("""
        SELECT *
        FROM archive_label_policies
        WHERE label_kind = :label_kind
          AND unit_type = :unit_type
          AND extraction_tier = :extraction_tier
        LIMIT 1
        """)
    result = db.execute(
        statement,
        {"label_kind": label_kind, "unit_type": unit_type, "extraction_tier": extraction_tier},
    )
    row = _fetch_first_dict(result)
    if row is None:
        return dict(_DEFAULT_POLICY)
    policy = dict(_DEFAULT_POLICY)
    policy.update(row)
    return policy


def _candidate_existing_canonical(candidate: Any) -> bool:
    evidence = getattr(candidate, "evidence", ()) or ()
    for item in evidence:
        if str(item.get("extractor") or "").lower() in {"alias", "title"}:
            return True
    return False


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def _load_video_title(db: Any, video_id: str) -> str:
    row = _fetch_first_dict(db.execute(text("SELECT title FROM videos WHERE id = :video_id"), {"video_id": video_id}))
    return str(row.get("title") or "") if row else ""


def _load_preferred_source_segments(db: Any, video_id: str) -> tuple[str, list[dict]]:
    """Load one transcript source so corroborating transcripts do not double-count evidence."""
    whisper_segments = load_source_segments(db, video_id, "whisper")
    youtube_segments = load_source_segments(db, video_id, "youtube")
    if not whisper_segments and not youtube_segments:
        return "whisper", []
    duration_row = None
    if hasattr(db, "execute"):
        duration_row = _fetch_first_dict(
            db.execute(text("SELECT duration_seconds FROM videos WHERE id = :video_id"), {"video_id": video_id})
        )
    duration_ms = int((duration_row or {}).get("duration_seconds") or 0) * 1000
    if duration_ms <= 0:
        duration_ms = max([int(row.get("end_ms") or 0) for row in [*whisper_segments, *youtube_segments]] or [1])
    selected = select_preferred_transcript(
        whisper_segments,
        youtube_segments,
        duration_ms=max(1, duration_ms),
    )
    return selected.source, selected.segments


def extract_labels_for_video(
    db: Any,
    video_id: str,
    extraction_tier: str = "cheap",
    *,
    title_only: bool = False,
    include_keyphrases: bool = False,
    run_id: str | None = None,
) -> dict:
    run_scope = "video_title" if title_only else "video"
    if run_id is None:
        run_id = create_extraction_run(
            db,
            scope=run_scope,
            extraction_tier=extraction_tier,
            video_id=video_id,
            model_name="deterministic",
        )
    metrics = {"windows": 0, "candidates": 0, "assignments": 0}

    try:
        window_dicts: list[dict] = []
        if not title_only:
            source, segments = _load_preferred_source_segments(db, video_id)
            windows = build_windows_from_segments(segments, source=source)
            persist_windows(db, video_id, windows)
            metrics["windows"] += len(windows)
            window_dicts.extend(
                {
                    "id": window.text_hash,
                    "video_id": video_id,
                    "source": source,
                    "text": window.text,
                    "start_ms": window.start_ms,
                    "end_ms": window.end_ms,
                }
                for window in windows
            )

        aliases = _load_existing_aliases(db)
        candidates = [] if title_only else extract_alias_candidates(window_dicts, aliases)
        title = _load_video_title(db, video_id)
        candidates.extend(extract_title_alias_candidates({"id": video_id, "title": title}, aliases))
        if include_keyphrases and not title_only:
            candidates.extend(extract_keyphrase_candidates(window_dicts, min_distinct_videos=1, min_occurrences=3))
        metrics["candidates"] = len(candidates)

        # Parallel workers upsert many of the same automatic labels. Sort by
        # slug so every transaction takes per-label advisory locks in the same
        # order, avoiding lock-order deadlocks across workers.
        candidates.sort(key=lambda candidate: (slugify_label(candidate.label), candidate.kind, candidate.label))

        for candidate in candidates:
            evidence = list(candidate.evidence)
            distinct_videos = len({str(item.get("video_id") or "") for item in evidence if item.get("video_id")})
            title_evidence = bool(evidence) and all(
                str(item.get("extractor") or "").lower() == "title" for item in evidence
            )
            unit_type = "vod" if title_evidence else "window"
            policy = _load_policy(db, candidate.kind, unit_type, extraction_tier)
            existing_canonical = _candidate_existing_canonical(candidate)
            if title_evidence and candidate.kind == "person":
                person_present = any(bool(item.get("person_presence")) for item in evidence)
                publish_tier, assignment_status = (
                    ("gold", "auto_published") if person_present else ("bronze", "candidate")
                )
            elif title_evidence and candidate.kind in {"category", "series", "game", "meme", "event"}:
                publish_tier, assignment_status = "gold", "auto_published"
            elif not title_evidence and candidate.kind == "person":
                # Transcript mentions are useful evidence, but never proof that
                # someone was physically or remotely present on stream.
                publish_tier, assignment_status = "bronze", "candidate"
            else:
                publish_tier, assignment_status = classify_candidate(
                    {
                        "label": candidate.label,
                        "kind": candidate.kind,
                        "unit_type": unit_type,
                        "confidence_score": candidate.confidence_score,
                        "evidence_count": len(evidence),
                        "distinct_videos": distinct_videos,
                        "source": str(evidence[0].get("extractor") or "hybrid") if evidence else "hybrid",
                    },
                    policy,
                    existing_canonical=existing_canonical,
                )

            label_status = "published" if assignment_status == "auto_published" else "candidate"
            label_id = upsert_label_candidate(
                db,
                label=candidate.label,
                kind=candidate.kind,
                aliases=list(candidate.aliases),
                confidence_score=candidate.confidence_score,
                source="automatic",
                publish_tier=publish_tier,
                status=label_status,
                run_id=run_id,
            )

            label_row = _fetch_first_dict(
                db.execute(
                    text("SELECT status, canonical_id FROM archive_labels WHERE id = :label_id"),
                    {"label_id": label_id},
                )
            )
            if label_row and str(label_row.get("status") or "").lower() in {"rejected", "merged", "hidden"}:
                continue

            for item in evidence:
                source = str(item.get("extractor") or "hybrid")
                if source not in ASSIGNMENT_SOURCES:
                    source = "hybrid"
                insert_assignment(
                    db,
                    label_id=label_id,
                    video_id=str(item.get("video_id") or video_id),
                    unit_type=unit_type,
                    status=assignment_status,
                    publish_tier=publish_tier,
                    confidence_score=candidate.confidence_score,
                    evidence=[item],
                    source=source,
                    run_id=run_id,
                    start_ms=None if unit_type == "vod" else _coerce_int(item.get("start_ms")),
                    end_ms=None if unit_type == "vod" else _coerce_int(item.get("end_ms")),
                    window_id=None,
                    chapter_id=None,
                    component_scores={
                        **dict(candidate.component_scores),
                        "source": source,
                    },
                )
                metrics["assignments"] += 1

        finish_extraction_run(db, run_id, "completed", metrics)
        return {"video_id": video_id, "extraction_tier": extraction_tier, "run_id": run_id, **metrics}
    except Exception as exc:
        # SQL errors such as deadlocks leave the current transaction aborted.
        # Roll back before attempting to persist failed-run status. For
        # externally pre-created runs, the run row was already committed by the
        # caller and can be safely updated after rollback. For internally-created
        # runs, rollback may remove the run row; the best-effort update is still
        # harmless and preserves the old API behavior for non-SQL failures.
        try:
            db.rollback()
        except Exception:
            pass
        finish_extraction_run(db, run_id, "failed", metrics, error=str(exc))
        raise


__all__ = [
    "extract_labels_for_video",
]
