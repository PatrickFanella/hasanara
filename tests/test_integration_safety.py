"""Safety gates for destructive integration-test cleanup."""

import pytest

from tests.integration.conftest import _assert_destructive_test_database


def test_destructive_cleanup_requires_all_three_guards(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("ALLOW_DESTRUCTIVE_TEST_DB", "1")
    _assert_destructive_test_database("postgresql://localhost/hasanara_test_ci")

    for variable, value in (
        ("ENVIRONMENT", "production"),
        ("ALLOW_DESTRUCTIVE_TEST_DB", "0"),
    ):
        monkeypatch.setenv("ENVIRONMENT", "test")
        monkeypatch.setenv("ALLOW_DESTRUCTIVE_TEST_DB", "1")
        monkeypatch.setenv(variable, value)
        with pytest.raises(RuntimeError, match="Refusing destructive integration cleanup"):
            _assert_destructive_test_database("postgresql://localhost/hasanara_test_ci")


def test_destructive_cleanup_rejects_non_test_database(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("ALLOW_DESTRUCTIVE_TEST_DB", "1")
    with pytest.raises(RuntimeError, match="database name begins hasanara_test"):
        _assert_destructive_test_database("postgresql://localhost/transcripts")
