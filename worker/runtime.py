"""Signal-safe worker runtime lifecycle state."""

from threading import Event, Lock


class WorkerLifecycle:
    """Coordinate signal-driven draining across claim and execution lanes."""

    def __init__(self) -> None:
        self.shutdown_requested = Event()
        self._lock = Lock()
        self._active_video_ids: set[str] = set()

    def request_shutdown(self) -> None:
        self.shutdown_requested.set()

    def set_active_video(self, video_id) -> None:
        with self._lock:
            self._active_video_ids = {str(video_id)} if video_id is not None else set()

    def begin_video(self, video_id) -> None:
        with self._lock:
            self._active_video_ids.add(str(video_id))

    def end_video(self, video_id) -> None:
        with self._lock:
            self._active_video_ids.discard(str(video_id))

    @property
    def active_video_id(self) -> str | None:
        with self._lock:
            return next(iter(self._active_video_ids), None)

    @property
    def active_count(self) -> int:
        with self._lock:
            return len(self._active_video_ids)

    @property
    def state(self) -> str:
        if self.shutdown_requested.is_set():
            return "draining" if self.active_count else "stopping"
        return "running"

    def wait(self, seconds: float) -> bool:
        return self.shutdown_requested.wait(seconds)
