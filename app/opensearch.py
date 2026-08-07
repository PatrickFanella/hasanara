"""Shared, verified OpenSearch request configuration."""

from __future__ import annotations

from typing import Any

from .settings import settings


def opensearch_request_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {}
    if settings.OPENSEARCH_USER and settings.OPENSEARCH_PASSWORD:
        kwargs["auth"] = (settings.OPENSEARCH_USER, settings.OPENSEARCH_PASSWORD)
    kwargs["verify"] = settings.OPENSEARCH_CA_BUNDLE or (
        settings.OPENSEARCH_VERIFY_SSL and settings.OPENSEARCH_TLS_VERIFY
    )
    return kwargs
