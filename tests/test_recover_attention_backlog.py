import uuid

import pytest
from sqlalchemy import text

from app.db import SessionLocal
from scripts import recover_attention_backlog
from scripts.recover_attention_backlog import parse_args
from worker.state_model import VideoState, pending_video_eligibility_sql


def test_recovery_requires_explicit_cohort_and_bounded_limit():
    args = parse_args(["--cohort", "alignment", "--limit", "5"])
    assert args.cohort == "alignment"
    assert args.limit == 5
    assert args.confirm is None

    with pytest.raises(SystemExit):
        parse_args(["--cohort", "yt-dlp", "--limit", "6"])


def test_recovery_requires_exact_confirmation_for_mutation():
    args = parse_args(["--cohort", "yt-dlp", "--limit", "1", "--confirm", "RECOVER"])
    assert args.confirm == "RECOVER"


def test_recovery_splits_multi_video_jobs_into_bounded_audited_work(test_engine, monkeypatch):
    source_job = uuid.uuid4()
    video_ids = [uuid.uuid4() for _ in range(7)]
    recovery_job_ids: list[str] = []
    with test_engine.begin() as connection:
        connection.execute(
            text("""
                INSERT INTO jobs (id, kind, input_url, state, stage, last_failure_summary)
                VALUES (:id, 'channel', 'https://example.test/recovery', 'needs_attention',
                        'quarantined', 'boolean index did not match indexed array')
            """),
            {"id": str(source_job)},
        )
        connection.execute(
            text("""
                INSERT INTO videos (id, job_id, youtube_id, state, caption_ingest_state)
                VALUES (:id, :job_id, 'already-done', 'completed', 'completed')
            """),
            {"id": str(video_ids[0]), "job_id": str(source_job)},
        )
        for index, video_id in enumerate(video_ids[1:], start=1):
            connection.execute(
                text("""
                    INSERT INTO videos (id, job_id, youtube_id, state, caption_ingest_state)
                    VALUES (:id, :job_id, :youtube_id, 'pending', 'completed')
                """),
                {"id": str(video_id), "job_id": str(source_job), "youtube_id": f"recover-{index:04d}"},
            )

    monkeypatch.setattr(
        recover_attention_backlog,
        "SessionLocal",
        lambda: SessionLocal(bind=test_engine),
    )
    try:
        dry_run = recover_attention_backlog.recover(cohort="alignment", limit=5, mutate=False)
        assert len(dry_run) == 5
        assert {row["source_job_id"] for row in dry_run} == {str(source_job)}

        changed = recover_attention_backlog.recover(cohort="alignment", limit=5, mutate=True)
        assert [{key: row[key] for key in ("source_job_id", "video_id")} for row in changed] == dry_run
        recovery_job_ids.extend(row["job_id"] for row in changed)
        with test_engine.connect() as connection:
            assert (
                connection.execute(text("SELECT state FROM jobs WHERE id=:id"), {"id": str(source_job)}).scalar_one()
                == "needs_attention"
            )
            assert (
                connection.execute(
                    text("SELECT count(*) FROM videos WHERE job_id=:id AND state='pending'"),
                    {"id": str(source_job)},
                ).scalar_one()
                == 1
            )
            assert (
                connection.execute(
                    text(f"SELECT count(*) {pending_video_eligibility_sql()}"),
                    {"pending_state": VideoState.PENDING.value},
                ).scalar_one()
                == 5
            )
            assert (
                connection.execute(
                    text("""
                    SELECT count(*) FROM audit_logs
                    WHERE action='admin_action' AND resource_type='recovery_job'
                      AND resource_id = ANY(CAST(:ids AS text[]))
                """),
                    {"ids": recovery_job_ids},
                ).scalar_one()
                == 5
            )

        with pytest.raises(RuntimeError, match="no recovery slots"):
            recover_attention_backlog.recover(cohort="alignment", limit=1, mutate=True)

        with test_engine.begin() as connection:
            connection.execute(
                text("UPDATE videos SET state='completed' WHERE job_id = ANY(CAST(:ids AS uuid[]))"),
                {"ids": recovery_job_ids},
            )
            connection.execute(
                text("UPDATE jobs SET state='completed' WHERE id = ANY(CAST(:ids AS uuid[]))"),
                {"ids": recovery_job_ids},
            )

        final = recover_attention_backlog.recover(cohort="alignment", limit=5, mutate=True)
        assert len(final) == 1
        recovery_job_ids.append(final[0]["job_id"])
        with test_engine.connect() as connection:
            assert (
                connection.execute(text("SELECT state FROM jobs WHERE id=:id"), {"id": str(source_job)}).scalar_one()
                == "completed"
            )
            assert (
                connection.execute(
                    text("SELECT count(*) FROM audit_logs WHERE resource_id = ANY(CAST(:ids AS text[]))"),
                    {"ids": recovery_job_ids},
                ).scalar_one()
                == 6
            )
    finally:
        SessionLocal.remove()
        with test_engine.begin() as connection:
            connection.execute(
                text("DELETE FROM audit_logs WHERE resource_id = ANY(CAST(:ids AS text[]))"),
                {"ids": recovery_job_ids},
            )
            connection.execute(
                text("DELETE FROM videos WHERE id = ANY(CAST(:ids AS uuid[]))"),
                {"ids": [str(video_id) for video_id in video_ids]},
            )
            connection.execute(
                text("DELETE FROM jobs WHERE id=:id OR id = ANY(CAST(:ids AS uuid[]))"),
                {"id": str(source_job), "ids": recovery_job_ids},
            )
