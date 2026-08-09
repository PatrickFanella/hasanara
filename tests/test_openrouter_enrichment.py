import json
from urllib import error

import pytest

from app.archive.enrichment_runner import EpisodeInput, TranscriptBlockInput
from app.archive.openrouter_enrichment import (
    EPISODE_ENRICHMENT_SCHEMA,
    build_openrouter_episode_request,
    generate_openrouter_episode_enrichment,
)


def _episode() -> EpisodeInput:
    return EpisodeInput(
        video_id="video-1",
        duration_ms=1_200_000,
        blocks=[
            TranscriptBlockInput(
                block_index=0,
                start_ms=0,
                end_ms=600_000,
                text="The discussion covers labor organizing and a union vote.",
            ),
            TranscriptBlockInput(
                block_index=1,
                start_ms=600_000,
                end_ms=1_200_000,
                text="The conversation turns to housing costs and tenant protections.",
            ),
        ],
    )


def _response_payload() -> dict:
    content = {
        "subjects": ["Labor organizing", "Housing costs"],
        "keywords": ["union vote", "tenant protections"],
        "chapters": [
            {
                "start_ms": 0,
                "title": "Labor Organizing and the Union Vote",
                "summary": "The discussion examines labor organizing and an upcoming union vote.",
                "evidence_block_indexes": [0],
            },
            {
                "start_ms": 600_000,
                "title": "Housing Costs and Tenant Protections",
                "summary": "The conversation shifts to housing costs and protections for tenants.",
                "evidence_block_indexes": [1],
            },
        ],
    }
    return {
        "provider": "Test Provider",
        "choices": [{"message": {"content": json.dumps(content)}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50, "cost": 0.0012},
    }


class _Response:
    def __init__(self, payload: dict):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode()


def test_build_openrouter_request_uses_identical_strict_controls():
    body = build_openrouter_episode_request(_episode(), model="deepseek/deepseek-v4-pro")

    assert body["model"] == "deepseek/deepseek-v4-pro"
    assert body["temperature"] == 0
    assert body["reasoning"] == {"enabled": False, "exclude": True}
    response_schema = body["response_format"]["json_schema"]
    assert response_schema["name"] == "hasanara_episode_enrichment"
    assert response_schema["strict"] is True
    assert response_schema["schema"] is not EPISODE_ENRICHMENT_SCHEMA
    evidence_items = response_schema["schema"]["properties"]["chapters"]["items"]["properties"][
        "evidence_block_indexes"
    ]["items"]
    assert evidence_items["maximum"] == 1
    assert (
        "maximum"
        not in EPISODE_ENRICHMENT_SCHEMA["properties"]["chapters"]["items"]["properties"]["evidence_block_indexes"][
            "items"
        ]
    )
    assert body["provider"] == {
        "allow_fallbacks": False,
        "data_collection": "deny",
        "require_parameters": True,
    }
    user = json.loads(body["messages"][1]["content"])
    assert user["target_chapter_count"] == 6
    assert user["transcript_blocks"][1]["block_index"] == 1


def test_generate_openrouter_enrichment_tracks_usage_and_builds_prediction(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout):
        captured["authorization"] = req.headers["Authorization"]
        captured["timeout"] = timeout
        return _Response(_response_payload())

    monkeypatch.setattr("app.archive.openrouter_enrichment.request.urlopen", fake_urlopen)

    result = generate_openrouter_episode_enrichment(
        _episode(), api_key="secret-key", model="google/gemini-2.5-flash", timeout_seconds=12
    )

    assert captured == {"authorization": "Bearer secret-key", "timeout": 12}
    assert result.provider == "Test Provider"
    assert result.prompt_tokens == 100
    assert result.completion_tokens == 50
    assert result.cost_usd == pytest.approx(0.0012)
    assert result.first_boundary_normalized is False
    prediction = result.prediction(1_200_000)
    assert [(chapter.start_ms, chapter.end_ms) for chapter in prediction.chapters] == [
        (0, 600_000),
        (600_000, 1_200_000),
    ]


def test_generate_openrouter_enrichment_normalizes_first_boundary_to_origin(monkeypatch):
    payload = _response_payload()
    parsed = json.loads(payload["choices"][0]["message"]["content"])
    parsed["chapters"][0]["start_ms"] = 120_000
    payload["choices"][0]["message"]["content"] = json.dumps(parsed)
    monkeypatch.setattr(
        "app.archive.openrouter_enrichment.request.urlopen",
        lambda _req, timeout: _Response(payload),
    )

    result = generate_openrouter_episode_enrichment(_episode(), api_key="key", model="model")

    assert result.first_boundary_normalized is True
    assert result.candidate.chapters[0].start_ms == 0


def test_generate_openrouter_enrichment_records_nonoverlapping_evidence(monkeypatch):
    payload = _response_payload()
    parsed = json.loads(payload["choices"][0]["message"]["content"])
    parsed["chapters"][1]["evidence_block_indexes"] = [0]
    payload["choices"][0]["message"]["content"] = json.dumps(parsed)
    monkeypatch.setattr(
        "app.archive.openrouter_enrichment.request.urlopen",
        lambda _req, timeout: _Response(payload),
    )

    result = generate_openrouter_episode_enrichment(_episode(), api_key="key", model="model", max_retries=0)

    assert result.evidence_overlap_violations == 1


def test_generate_openrouter_enrichment_truncates_overlong_summaries(monkeypatch):
    payload = _response_payload()
    parsed = json.loads(payload["choices"][0]["message"]["content"])
    parsed["chapters"][0]["summary"] = "word " * 100
    payload["choices"][0]["message"]["content"] = json.dumps(parsed)
    monkeypatch.setattr(
        "app.archive.openrouter_enrichment.request.urlopen",
        lambda _req, timeout: _Response(payload),
    )

    result = generate_openrouter_episode_enrichment(_episode(), api_key="key", model="model")

    assert result.summaries_truncated == 1
    assert len(result.candidate.chapters[0].summary) <= 300


def test_generate_openrouter_enrichment_retries_transient_http_errors(monkeypatch):
    attempts = 0

    def fake_urlopen(_req, timeout):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise error.HTTPError("https://example.test", 503, "busy", {}, None)
        return _Response(_response_payload())

    monkeypatch.setattr("app.archive.openrouter_enrichment.request.urlopen", fake_urlopen)
    monkeypatch.setattr("app.archive.openrouter_enrichment.time.sleep", lambda _seconds: None)

    generate_openrouter_episode_enrichment(_episode(), api_key="key", model="model", max_retries=1)

    assert attempts == 2


def test_generate_openrouter_enrichment_requires_key():
    with pytest.raises(ValueError, match="API key"):
        generate_openrouter_episode_enrichment(_episode(), api_key="", model="model")
