#!/usr/bin/env python3
"""Dry-run-first, bounded recovery for reviewed needs-attention cohorts."""

from __future__ import annotations

import argparse
import json

from sqlalchemy import text

from app.audit import ACTION_ADMIN_ACTION, write_audit_event
from app.db import SessionLocal
from worker.state_model import TERMINAL_CAPTION_INGEST_STATES, VideoState, pending_video_eligibility_sql

COHORT_PATTERNS = {
    "alignment": ("%align%", "%boolean index did not match indexed array%"),
    "yt-dlp": ("%yt-dlp%", "%youtube-dl%"),
}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cohort", required=True, choices=sorted(COHORT_PATTERNS))
    parser.add_argument("--limit", required=True, type=int)
    parser.add_argument("--confirm", help="Required for mutation; must be RECOVER")
    args = parser.parse_args(argv)
    if not 1 <= args.limit <= 5:
        parser.error("--limit must be between 1 and 5")
    return args


def recover(*, cohort: str, limit: int, mutate: bool) -> list[dict[str, str]]:
    db = SessionLocal()
    try:
        if mutate:
            db.execute(text("SELECT pg_advisory_xact_lock(hashtext('hasanara-attention-recovery'))"))
        eligible = int(
            db.execute(
                text(f"SELECT COUNT(*) {pending_video_eligibility_sql()}"),
                {"pending_state": VideoState.PENDING.value},
            ).scalar_one()
        )
        available = max(0, 5 - eligible)
        if mutate and available == 0:
            raise RuntimeError(f"no recovery slots are available; {eligible} videos are already eligible")
        selection_limit = min(limit, available) if mutate else limit
        patterns = COHORT_PATTERNS[cohort]
        rows = (
            db.execute(
                text("""
                    SELECT j.id AS job_id, v.id AS video_id
                    FROM jobs j
                    JOIN videos v ON v.job_id = j.id
                    WHERE j.state = 'needs_attention'
                      AND v.state = 'pending'
                      AND v.caption_ingest_state = ANY(CAST(:terminal_states AS text[]))
                      AND EXISTS (
                          SELECT 1 FROM unnest(CAST(:patterns AS text[])) pattern
                          WHERE COALESCE(j.last_failure_summary, j.error, '') ILIKE pattern
                      )
                    ORDER BY j.updated_at, j.id, v.id
                    FOR UPDATE OF j, v SKIP LOCKED
                    LIMIT :limit
                """),
                {
                    "terminal_states": list(TERMINAL_CAPTION_INGEST_STATES),
                    "patterns": list(patterns),
                    "limit": selection_limit,
                },
            )
            .mappings()
            .all()
        )
        selected = [{"source_job_id": str(row["job_id"]), "video_id": str(row["video_id"])} for row in rows]
        if not mutate:
            db.rollback()
            return selected
        recovered: list[dict[str, str]] = []
        source_job_ids: set[str] = set()
        for row in selected:
            source_job_id = row["source_job_id"]
            source_job_ids.add(source_job_id)
            recovery_job_id = str(
                db.execute(
                    text("""
                        INSERT INTO jobs (
                            kind, input_url, priority, meta, owner_user_id,
                            state, stage, completed_units, total_units
                        )
                        SELECT
                            'single', 'https://www.youtube.com/watch?v=' || v.youtube_id,
                            j.priority,
                            (COALESCE(j.meta, '{}'::jsonb)
                                - 'normalized_url' - 'idempotency_key'
                                - 'staged' - 'batch_id' - 'batch_expected_jobs')
                                || jsonb_build_object('recovery', jsonb_build_object(
                                    'cohort', CAST(:cohort AS text),
                                    'source_job_id', j.id::text,
                                    'source_video_id', v.id::text
                                )),
                            j.owner_user_id, 'pending', 'queued', 0, 1
                        FROM jobs j
                        JOIN videos v ON v.job_id = j.id
                        WHERE j.id=:source_job_id AND j.state='needs_attention'
                          AND v.id=:video_id AND v.state='pending'
                          AND v.caption_ingest_state = ANY(CAST(:terminal_states AS text[]))
                        RETURNING id
                    """),
                    {
                        "cohort": cohort,
                        "source_job_id": source_job_id,
                        "video_id": row["video_id"],
                        "terminal_states": list(TERMINAL_CAPTION_INGEST_STATES),
                    },
                ).scalar_one()
            )
            moved = db.execute(
                text("""
                    UPDATE videos
                    SET job_id=:recovery_job_id, idx=0, error=NULL, updated_at=now()
                    WHERE id=:video_id AND job_id=:source_job_id AND state='pending'
                """),
                {
                    "recovery_job_id": recovery_job_id,
                    "video_id": row["video_id"],
                    "source_job_id": source_job_id,
                },
            )
            if moved.rowcount != 1:
                raise RuntimeError("recovery video ownership transfer did not affect exactly one row")
            write_audit_event(
                db,
                ACTION_ADMIN_ACTION,
                resource_type="recovery_job",
                resource_id=recovery_job_id,
                details={
                    "operation": "backlog_recovery",
                    "cohort": cohort,
                    "source_job_id": source_job_id,
                    "video_id": row["video_id"],
                },
            )
            recovered.append({**row, "job_id": recovery_job_id})
        for source_job_id in source_job_ids:
            db.execute(
                text("""
                    UPDATE jobs j
                    SET state='completed', stage='completed', error=NULL,
                        last_failure_summary=NULL, updated_at=now()
                    WHERE j.id=:source_job_id AND j.state='needs_attention'
                      AND NOT EXISTS (
                          SELECT 1 FROM videos v
                          WHERE v.job_id=j.id AND v.state <> 'completed'
                      )
                """),
                {"source_job_id": source_job_id},
            )
        db.commit()
        return recovered
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    mutate = args.confirm == "RECOVER"
    rows = recover(cohort=args.cohort, limit=args.limit, mutate=mutate)
    print(json.dumps({"mode": "recovery" if mutate else "dry-run", "cohort": args.cohort, "selected": rows}))
    if not mutate:
        print("Dry run only. Re-run with --confirm RECOVER to mutate exactly this bounded cohort.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
