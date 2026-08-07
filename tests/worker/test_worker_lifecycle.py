"""Worker graceful-drain behavior."""

from worker.loop import WorkerLifecycle


def test_shutdown_without_active_work_stops_claiming_immediately():
    lifecycle = WorkerLifecycle()
    lifecycle.request_shutdown()

    assert lifecycle.state == "stopping"
    assert lifecycle.wait(0)


def test_shutdown_with_active_work_drains_before_stopping():
    lifecycle = WorkerLifecycle()
    lifecycle.set_active_video("video-1")
    lifecycle.request_shutdown()

    assert lifecycle.state == "draining"
    assert lifecycle.active_video_id == "video-1"

    lifecycle.set_active_video(None)
    assert lifecycle.state == "stopping"
