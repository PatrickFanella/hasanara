"""Opaque, versioned cursors for deterministic public discovery feeds."""

from __future__ import annotations

import base64
import hashlib
import json
import uuid
from dataclasses import dataclass
from typing import Any, Mapping


class CursorError(ValueError):
    """Raised when a feed cursor is malformed or no longer matches its request."""


@dataclass(frozen=True)
class FeedCursor:
    sort: str
    fingerprint: str
    video_id: uuid.UUID
    primary: str | int | float
    secondary: str | int | float | None = None


def filter_fingerprint(filters: Mapping[str, Any]) -> str:
    """Return a short stable digest without embedding user input in cursors."""

    canonical = json.dumps(filters, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:24]


def encode_cursor(cursor: FeedCursor) -> str:
    payload = {
        "v": 1,
        "s": cursor.sort,
        "f": cursor.fingerprint,
        "id": str(cursor.video_id),
        "p": cursor.primary,
    }
    if cursor.secondary is not None:
        payload["x"] = cursor.secondary
    raw = json.dumps(payload, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(value: str, *, expected_sort: str, expected_fingerprint: str) -> FeedCursor:
    try:
        padded = value + "=" * (-len(value) % 4)
        payload = json.loads(base64.b64decode(padded.encode(), altchars=b"-_", validate=True))
        if not isinstance(payload, dict) or payload.get("v") != 1:
            raise CursorError("unsupported cursor version")
        cursor = FeedCursor(
            sort=str(payload["s"]),
            fingerprint=str(payload["f"]),
            video_id=uuid.UUID(str(payload["id"])),
            primary=payload["p"],
            secondary=payload.get("x"),
        )
    except CursorError:
        raise
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise CursorError("malformed cursor") from exc
    if cursor.sort != expected_sort:
        raise CursorError("cursor does not match the active sort")
    if cursor.fingerprint != expected_fingerprint:
        raise CursorError("cursor does not match the active filters")
    return cursor
