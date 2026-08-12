from collections.abc import Sequence
from typing import TypeVar

from app.schemas import OffsetPageInfo

T = TypeVar("T")


def build_offset_page(rows: Sequence[T], *, limit: int, offset: int) -> tuple[list[T], OffsetPageInfo]:
    """Slice a limit+1 query result and describe adjacent offsets."""
    has_next_page = len(rows) > limit
    items = list(rows[:limit])
    has_previous_page = offset > 0
    return items, OffsetPageInfo(
        limit=limit,
        offset=offset,
        has_next_page=has_next_page,
        has_previous_page=has_previous_page,
        next_offset=offset + limit if has_next_page else None,
        previous_offset=max(0, offset - limit) if has_previous_page else None,
    )
