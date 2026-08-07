"""Dependency-neutral caption value objects and errors."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class YTSegment:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class YTCaptionTrack:
    url: str
    language: str | None
    kind: str
    ext: str


class YouTubeCaptionFetchError(RuntimeError):
    """A caption track exists, but retrieval or parsing failed."""


class YouTubeCaptionRateLimitError(YouTubeCaptionFetchError):
    """Caption retrieval hit an explicit YouTube rate limit."""
