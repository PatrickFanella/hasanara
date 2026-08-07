"""Authorization tests for vocabulary routes."""

from __future__ import annotations

import uuid
from contextlib import nullcontext
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.main import app
from app.security import get_user_required


@pytest.fixture
def vocabulary_users():
    return {
        "owner": {
            "id": str(uuid.uuid4()),
            "email": "vocabulary-owner@example.com",
            "plan": "free",
        },
        "other": {
            "id": str(uuid.uuid4()),
            "email": "vocabulary-other@example.com",
            "plan": "free",
        },
        "admin": {
            "id": str(uuid.uuid4()),
            "email": "vocabulary-admin@example.com",
            "plan": "free",
        },
    }


class FakeResult:
    def __init__(self, rows=None, rowcount=0):
        self.rows = rows or []
        self.rowcount = rowcount

    def mappings(self):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return self.rows


class VocabularyDatabase:
    def __init__(self):
        self.rows = {}

    def begin(self):
        return nullcontext()

    def commit(self):
        return None

    def execute(self, statement, params=None):
        sql = str(statement)
        params = params or {}
        if "INSERT INTO user_vocabularies" in sql:
            now = datetime.now(timezone.utc)
            self.rows[str(params["id"])] = {
                "id": uuid.UUID(str(params["id"])),
                "user_id": uuid.UUID(str(params["user_id"])),
                "name": params["name"],
                "terms": [],
                "is_global": params["is_global"],
                "created_at": now,
                "updated_at": now,
            }
            return FakeResult(rowcount=1)
        if "DELETE FROM user_vocabularies" in sql:
            row = self.rows.get(str(params["id"]))
            allowed = row and (
                params.get("is_admin")
                or (not row["is_global"] and str(row["user_id"]) == str(params.get("user_id")))
            )
            if allowed:
                del self.rows[str(params["id"])]
                return FakeResult(rowcount=1)
            return FakeResult()

        rows = list(self.rows.values())
        if "WHERE id = :id" in sql:
            rows = [row for row in rows if str(row["id"]) == str(params["id"])]
        if "is_global = true OR user_id = :user_id" in sql:
            rows = [
                row
                for row in rows
                if row["is_global"] or str(row["user_id"]) == str(params["user_id"])
            ]
        return FakeResult(rows)


@pytest.fixture
def vocabulary_client(client: TestClient, vocabulary_users, monkeypatch):
    current_user = {"value": vocabulary_users["owner"]}
    database = VocabularyDatabase()

    def override_db():
        yield database

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_user_required] = lambda: current_user["value"]
    monkeypatch.setenv("ADMIN_EMAILS", vocabulary_users["admin"]["email"])
    yield client, current_user, vocabulary_users, database
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_user_required, None)


def test_vocabulary_routes_require_authentication(client: TestClient):
    assert client.get("/vocabularies").status_code == 401
    assert client.post("/vocabularies", json={"name": "Private", "terms": []}).status_code == 401


def test_user_only_sees_globals_and_owned_vocabularies(vocabulary_client):
    client, current_user, users, database = vocabulary_client
    owner_response = client.post("/vocabularies", json={"name": "Owned", "terms": []})
    assert owner_response.status_code == 201

    current_user["value"] = users["other"]
    other_response = client.post("/vocabularies", json={"name": "Other", "terms": []})
    assert other_response.status_code == 201

    current_user["value"] = users["admin"]
    global_response = client.post(
        "/vocabularies",
        json={"name": "Global", "terms": [], "is_global": True},
    )
    assert global_response.status_code == 201

    current_user["value"] = users["owner"]
    listed = client.get("/vocabularies")
    assert listed.status_code == 200
    assert {item["name"] for item in listed.json()} == {"Owned", "Global"}

    hidden_id = other_response.json()["id"]
    assert client.get(f"/vocabularies/{hidden_id}").status_code == 404
    assert client.delete(f"/vocabularies/{hidden_id}").status_code == 404

    stored_owner = database.rows[owner_response.json()["id"]]["user_id"]
    assert str(stored_owner) == users["owner"]["id"]


def test_only_admin_can_create_or_delete_global_vocabulary(vocabulary_client):
    client, current_user, users, _database = vocabulary_client
    denied = client.post(
        "/vocabularies",
        json={"name": "Forbidden global", "terms": [], "is_global": True},
    )
    assert denied.status_code == 403

    current_user["value"] = users["admin"]
    created = client.post(
        "/vocabularies",
        json={"name": "Admin global", "terms": [], "is_global": True},
    )
    assert created.status_code == 201

    current_user["value"] = users["owner"]
    assert client.delete(f"/vocabularies/{created.json()['id']}").status_code == 404

    current_user["value"] = users["admin"]
    assert client.delete(f"/vocabularies/{created.json()['id']}").status_code == 204
