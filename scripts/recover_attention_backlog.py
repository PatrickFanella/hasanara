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
        eligible = int(
            db.execute(
                text(f"SELECT COUNT(*) {pending_video_eligibility_sql()}"),
                {"pending_state": VideoState.PENDING.value},
            ).scalar_one()
        )
        available = max(0, 5 - eligible)
        if mutate and limit > available:
            raise RuntimeError(f"only {available} recovery slots are available; {eligible} videos are already eligible")
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
                      AND (
                          SELECT count(*)
                          FROM videos sibling
                          WHERE sibling.job_id = j.id
                            AND sibling.state = 'pending'
                            AND sibling.caption_ingest_state = ANY(CAST(:terminal_states AS text[]))
                      ) = 1
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
                    "limit": limit,
                },
            )
            .mappings()
            .all()
        )
        selected = [{"job_id": str(row["job_id"]), "video_id": str(row["video_id"])} for row in rows]
        if not mutate:
            db.rollback()
            return selected
        for row in selected:
            db.execute(
                text("""
                    UPDATE jobs
                    SET state='pending', stage='queued', error=NULL, last_failure_summary=NULL,
                        next_attempt_at=NULL, quarantined_at=NULL, updated_at=now()
                    WHERE id=:job_id AND state='needs_attention'
                """),
                {"job_id": row["job_id"]},
            )
            write_audit_event(
                db,
                ACTION_ADMIN_ACTION,
                resource_type="recovery_job",
                resource_id=row["job_id"],
                details={"operation": "backlog_recovery", "cohort": cohort, "video_id": row["video_id"]},
            )
        db.commit()
        return selected
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
