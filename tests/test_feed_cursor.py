import uuid
from datetime import UTC, datetime

import pytest

from app.feed_cursor import CursorError, FeedCursor, decode_cursor, encode_cursor, filter_fingerprint


def test_feed_cursor_round_trips_without_exposing_filter_values():
    filters = {"q": "housing", "people": ["hasan-piker"], "sort": "latest"}
    cursor = FeedCursor(
        sort="latest",
        fingerprint=filter_fingerprint(filters),
        video_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        primary="2026-08-13T15:00:00+00:00",
    )

    encoded = encode_cursor(cursor)
    decoded = decode_cursor(encoded, expected_sort="latest", expected_fingerprint=filter_fingerprint(filters))

    assert decoded == cursor
    assert "housing" not in encoded
    assert "hasan-piker" not in encoded


@pytest.mark.parametrize("value", ["", "not-base64", "e30", "eyJ2IjoyfQ"])
def test_feed_cursor_rejects_malformed_or_unknown_versions(value):
    with pytest.raises(CursorError):
        decode_cursor(value, expected_sort="latest", expected_fingerprint="fingerprint")


def test_feed_cursor_rejects_sort_and_filter_mismatches():
    cursor = encode_cursor(
        FeedCursor(
            sort="latest",
            fingerprint="original",
            video_id=uuid.uuid4(),
            primary=datetime(2026, 8, 13, tzinfo=UTC).isoformat(),
        )
    )

    with pytest.raises(CursorError, match="active sort"):
        decode_cursor(cursor, expected_sort="longest", expected_fingerprint="original")
    with pytest.raises(CursorError, match="active filters"):
        decode_cursor(cursor, expected_sort="latest", expected_fingerprint="changed")
