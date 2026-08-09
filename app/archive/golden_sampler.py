from __future__ import annotations

import re
from typing import Any

REPRESENTATIVE_STRATA = (
    "politics_news",
    "interview_guest",
    "gaming",
    "react_content",
    "recurring_segment",
    "long_mixed",
)

_POLITICS_PATTERN = re.compile(
    r"\b(?:election|president(?:ial)?|debate|trump|biden|gaza|israel|palestine|congress|senate|politics|news)\b",
    re.IGNORECASE,
)
_INTERVIEW_PATTERN = re.compile(
    r"\b(?:interview|guest|featuring|ft\.?|talks? with|conversation with)\b",
    re.IGNORECASE,
)
_GAMING_PATTERN = re.compile(
    r"\b(?:gaming|gameplay|plays?|elden ring|grand theft auto|gta|fortnite|marvel rivals)\b",
    re.IGNORECASE,
)
_REACT_PATTERN = re.compile(r"\b(?:reacts?|reaction|watching|watches)\b", re.IGNORECASE)
_RECURRING_PATTERN = re.compile(
    r"\b(?:chadvice|okbuddy|fear\s*&|leftovers|podcast|media share|po box)\b",
    re.IGNORECASE,
)


def classify_video_stratum(video: dict[str, Any]) -> str:
    title = " ".join(str(video.get("title") or "").split())
    category = " ".join(str(video.get("category") or "").split())
    if _RECURRING_PATTERN.search(title):
        return "recurring_segment"
    if _INTERVIEW_PATTERN.search(title):
        return "interview_guest"
    if _GAMING_PATTERN.search(f"{title} {category}"):
        return "gaming"
    if _POLITICS_PATTERN.search(title):
        return "politics_news"
    if _REACT_PATTERN.search(title):
        return "react_content"
    if int(video.get("duration_seconds") or 0) >= 4 * 60 * 60:
        return "long_mixed"
    return "general"


def _sort_key(video: dict[str, Any]) -> tuple[str, str]:
    uploaded_at = str(video.get("uploaded_at") or video.get("created_at") or "")
    return uploaded_at, str(video.get("id") or "")


def select_representative_videos(
    videos: list[dict[str, Any]],
    *,
    per_stratum: int = 5,
    total_limit: int = 30,
) -> list[dict[str, Any]]:
    if per_stratum <= 0 or total_limit <= 0:
        raise ValueError("sample sizes must be positive")
    ordered = sorted((dict(video) for video in videos), key=_sort_key, reverse=True)
    buckets: dict[str, list[dict[str, Any]]] = {stratum: [] for stratum in REPRESENTATIVE_STRATA}
    for video in ordered:
        stratum = classify_video_stratum(video)
        if stratum in buckets:
            buckets[stratum].append(video)

    selected: list[dict[str, Any]] = []
    selected_ids: set[str] = set()
    for stratum in REPRESENTATIVE_STRATA:
        for video in buckets[stratum][:per_stratum]:
            selected.append(video)
            selected_ids.add(str(video.get("id") or ""))
            if len(selected) == total_limit:
                return selected

    for video in ordered:
        video_id = str(video.get("id") or "")
        if video_id in selected_ids:
            continue
        selected.append(video)
        selected_ids.add(video_id)
        if len(selected) == total_limit:
            break
    return selected


__all__ = ["REPRESENTATIVE_STRATA", "classify_video_stratum", "select_representative_videos"]
