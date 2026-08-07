"""Secure cache-control defaults."""

from fastapi.testclient import TestClient


def test_authentication_failures_are_never_cacheable(client: TestClient):
    response = client.get("/vocabularies")
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


def test_state_changing_responses_are_never_cacheable(client: TestClient):
    response = client.post("/events", json={"type": "cache-test", "payload": {}})
    assert response.headers["cache-control"] == "no-store"


def test_health_defaults_to_private_no_store(client: TestClient):
    response = client.get("/live")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
