"""Platform security and observability regression tests."""

from __future__ import annotations

import uuid

import pytest
from starlette.requests import Request

from app.metrics import http_requests_total, rate_limit_backend_failures_total
from app.middleware import RateLimitMiddleware, rate_limit_backend_health
from app.opensearch import opensearch_request_kwargs
from app.settings import settings


class FakeRedis:
    def __init__(self):
        self.counts = {}

    async def eval(self, _script, _key_count, key, window):
        self.counts[key] = self.counts.get(key, 0) + 1
        return [self.counts[key], window]


@pytest.mark.asyncio
async def test_rate_limit_is_shared_and_separates_client_ips():
    redis = FakeRedis()
    first_process = RateLimitMiddleware(None, redis_client=redis, requests_limit=2, window_seconds=60)
    second_process = RateLimitMiddleware(None, redis_client=redis, requests_limit=2, window_seconds=60)

    assert await first_process._is_rate_limited("192.0.2.1") == (False, 60)
    assert await second_process._is_rate_limited("192.0.2.1") == (False, 60)
    assert await first_process._is_rate_limited("192.0.2.1") == (True, 60)
    assert await first_process._is_rate_limited("192.0.2.2") == (False, 60)


@pytest.mark.asyncio
async def test_rate_limit_fails_open_and_records_backend_failure():
    class FailingRedis:
        async def eval(self, *_args):
            raise ConnectionError("redis unavailable")

    before = rate_limit_backend_failures_total._value.get()
    limiter = RateLimitMiddleware(None, redis_client=FailingRedis())
    assert await limiter._is_rate_limited("192.0.2.1") == (False, settings.RATE_LIMIT_WINDOW_SECONDS)
    assert rate_limit_backend_failures_total._value.get() == before + 1
    assert rate_limit_backend_health() == {"status": "degraded"}


def test_rate_limit_uses_validated_client_not_forwarding_header():
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/search",
            "headers": [(b"x-forwarded-for", b"203.0.113.9")],
            "client": ("192.0.2.8", 1234),
        }
    )
    limiter = RateLimitMiddleware(None, redis_client=FakeRedis())
    assert limiter._get_client_id(request) == "192.0.2.8"


@pytest.mark.asyncio
async def test_rate_limit_reports_redis_recovery():
    limiter = RateLimitMiddleware(None, redis_client=FakeRedis())
    assert await limiter._is_rate_limited("192.0.2.1") == (False, 60)
    assert rate_limit_backend_health() == {"status": "healthy"}


def test_opensearch_https_uses_ca_bundle(monkeypatch):
    monkeypatch.setattr(settings, "OPENSEARCH_URL", "https://search.example.com")
    monkeypatch.setattr(settings, "OPENSEARCH_CA_BUNDLE", "/run/secrets/opensearch-ca.pem")
    assert opensearch_request_kwargs()["verify"] == "/run/secrets/opensearch-ca.pem"


def test_metrics_use_route_templates_and_bounded_unmatched_label(client):
    for _ in range(2):
        client.get(f"/vocabularies/{uuid.uuid4()}")
        client.get(f"/definitely-missing/{uuid.uuid4()}")

    endpoints = {
        sample.labels["endpoint"]
        for metric in http_requests_total.collect()
        for sample in metric.samples
        if sample.name == "http_requests_total"
    }
    assert "/vocabularies/{vocabulary_id}" in endpoints
    assert "unmatched" in endpoints
    assert not any("definitely-missing" in endpoint for endpoint in endpoints)


def test_large_responses_use_standard_gzip_middleware(client):
    response = client.get("/openapi.json", headers={"Accept-Encoding": "gzip"})
    assert response.status_code == 200
    assert response.headers.get("content-encoding") == "gzip"
