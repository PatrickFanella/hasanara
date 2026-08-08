"""Topic-domain normalization and alias matching."""

import re


def slugify_topic(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "topic"


def alias_matches_text(alias: str, text_value: str) -> bool:
    """Match aliases as words or phrases rather than arbitrary substrings."""
    alias_value = re.sub(r"\s+", " ", alias.strip().lower())
    normalized_text = re.sub(r"\s+", " ", text_value.lower())
    if not alias_value or not normalized_text:
        return False
    escaped = re.escape(alias_value).replace(r"\ ", r"\s+")
    return re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", normalized_text) is not None
