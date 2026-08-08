"""Characterization coverage for intelligence repository query facades."""

from datetime import date, datetime, timezone

from app.archive import intelligence_repository as facade
from app.archive.intelligence_queries import periods, topics


def test_topic_facade_preserves_query_domain_functions():
    assert facade.slugify_topic is topics.slugify_topic
    assert facade.alias_matches_text is topics.alias_matches_text
    assert facade.slugify_topic("New Jersey!!!") == "new-jersey"
    assert facade.alias_matches_text("ice", "anti-Semite price") is False


def test_period_facade_preserves_calendar_boundaries():
    value = date(2026, 6, 4)
    assert facade._month_bounds(value) == periods.month_bounds(value)
    assert facade._week_bounds(value) == periods.week_bounds(value)
    assert facade._period_key(datetime(2026, 6, 4, tzinfo=timezone.utc), "week") == "2026-W23"
    assert facade._within_period_range("not-a-period", "month", None, None) is True
