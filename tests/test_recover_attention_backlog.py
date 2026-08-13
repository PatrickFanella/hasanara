import uuid

import pytest
from sqlalchemy import text

from app.db import SessionLocal
from scripts import recover_attention_backlog
from scripts.recover_attention_backlog import parse_args


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


def test_recovery_selects_only_single_video_jobs_and_audits_mutation(test_engine, monkeypatch):
    single_job, multi_job = uuid.uuid4(), uuid.uuid4()
    video_ids = [uuid.uuid4(), uuid.uuid4(), uuid.uuid4()]
    with test_engine.begin() as connection:
        for job_id in (single_job, multi_job):
            connection.execute(
                text("""
                    INSERT INTO jobs (id, kind, input_url, state, stage, last_failure_summary)
                    VALUES (:id, 'single', 'https://example.test/recovery', 'needs_attention',
                            'quarantined', 'boolean index did not match indexed array')
                """),
                {"id": str(job_id)},
            )
        for video_id, job_id, youtube_id in (
            (video_ids[0], single_job, "recover-one"),
            (video_ids[1], multi_job, "recover-two"),
            (video_ids[2], multi_job, "recover-tri"),
        ):
            connection.execute(
                text("""
                    INSERT INTO videos (id, job_id, youtube_id, state, caption_ingest_state)
                    VALUES (:id, :job_id, :youtube_id, 'pending', 'completed')
                """),
                {"id": str(video_id), "job_id": str(job_id), "youtube_id": youtube_id},
            )

    monkeypatch.setattr(
        recover_attention_backlog,
        "SessionLocal",
        lambda: SessionLocal(bind=test_engine),
    )
    try:
        dry_run = recover_attention_backlog.recover(cohort="alignment", limit=5, mutate=False)
        assert dry_run == [{"job_id": str(single_job), "video_id": str(video_ids[0])}]

        changed = recover_attention_backlog.recover(cohort="alignment", limit=5, mutate=True)
        assert changed == dry_run
        with test_engine.connect() as connection:
            assert (
                connection.execute(text("SELECT state FROM jobs WHERE id=:id"), {"id": str(single_job)}).scalar_one()
                == "pending"
            )
            assert (
                connection.execute(text("SELECT state FROM jobs WHERE id=:id"), {"id": str(multi_job)}).scalar_one()
                == "needs_attention"
            )
            assert (
                connection.execute(
                    text("""
                    SELECT count(*) FROM audit_logs
                    WHERE action='admin_action' AND resource_type='recovery_job' AND resource_id=:id
                """),
                    {"id": str(single_job)},
                ).scalar_one()
                == 1
            )
    finally:
        SessionLocal.remove()
        with test_engine.begin() as connection:
            connection.execute(
                text("DELETE FROM audit_logs WHERE resource_id IN (:single, :multi)"),
                {"single": str(single_job), "multi": str(multi_job)},
            )
            connection.execute(
                text("DELETE FROM videos WHERE id = ANY(CAST(:ids AS uuid[]))"),
                {"ids": [str(video_id) for video_id in video_ids]},
            )
            connection.execute(
                text("DELETE FROM jobs WHERE id IN (:single, :multi)"),
                {"single": str(single_job), "multi": str(multi_job)},
            )
