"""Query-domain helpers exposed through the intelligence repository facade."""

from .periods import (
    as_date,
    coerce_datetime,
    month_bounds,
    period_key,
    period_label,
    period_start,
    utc_now,
    week_bounds,
    within_period_range,
)
from .topics import alias_matches_text, slugify_topic

__all__ = [
    "alias_matches_text",
    "as_date",
    "coerce_datetime",
    "month_bounds",
    "period_key",
    "period_label",
    "period_start",
    "slugify_topic",
    "utc_now",
    "week_bounds",
    "within_period_range",
]
