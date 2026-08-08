"""Characterization tests for worker runtime, queue, and maintenance domains."""

from worker.loop import WorkerLifecycle, pending_video_claim_sql
from worker.maintenance import requeue_for_model_upgrade, rescue_stuck_videos
from worker.queue import pending_video_claim_sql as queue_claim_sql
from worker.runtime import WorkerLifecycle as RuntimeLifecycle


class _Result:
    def fetchall(self):
        return [("video-1", "small")]


class _Connection:
    def __init__(self):
        self.calls = []

    def execute(self, statement, params):
        self.calls.append((str(statement), params))
        return _Result()


def test_loop_preserves_runtime_and_queue_facade_symbols():
    assert WorkerLifecycle is RuntimeLifecycle
    assert pending_video_claim_sql is queue_claim_sql


def test_maintenance_rescue_and_model_requeue_preserve_guards():
    connection = _Connection()

    rescue_stuck_videos(connection, after_seconds=900)
    rows = requeue_for_model_upgrade(connection, current_model="large-v3")

    rescue_sql, rescue_params = connection.calls[0]
    model_sql, model_params = connection.calls[1]
    assert "diarization_error NOT LIKE 'canary-%'" in rescue_sql
    assert rescue_params == {"secs": 900}
    assert "diarization_error NOT LIKE 'canary-%'" in model_sql
    assert model_params["completed_state"] == "completed"
    assert model_params["current_rank"] == 7
    assert rows == [("video-1", "small")]


def test_unknown_model_does_not_requeue():
    connection = _Connection()

    assert requeue_for_model_upgrade(connection, current_model="custom") == []
    assert connection.calls == []
