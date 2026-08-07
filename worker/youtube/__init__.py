"""YouTube worker adapter package with cycle-safe lazy service exports."""

from importlib import import_module
from typing import Any

from .errors import YouTubeError, YouTubeErrorKind, classify_youtube_error
from .types import YouTubeCaptionFetchError, YouTubeCaptionRateLimitError, YTCaptionTrack, YTSegment
from .yt_dlp_executor import YtDlpError, YtDlpExecutionResult, YtDlpExecutor

_SERVICE_EXPORTS = {
    "YouTubeCaptionResult",
    "YouTubeService",
    "download_audio",
    "fetch_auto_captions",
    "fetch_metadata",
    "get_youtube_service",
}


def __getattr__(name: str) -> Any:
    if name not in _SERVICE_EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    service = import_module("worker.youtube.service")
    value = getattr(service, name)
    globals()[name] = value
    return value


__all__ = [
    "YouTubeError",
    "YouTubeErrorKind",
    "classify_youtube_error",
    "YtDlpError",
    "YtDlpExecutionResult",
    "YtDlpExecutor",
    "YouTubeCaptionFetchError",
    "YouTubeCaptionRateLimitError",
    "YTCaptionTrack",
    "YTSegment",
    *_SERVICE_EXPORTS,
]
