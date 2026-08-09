from __future__ import annotations

import json

import pytest

from app.archive.chapter_naming import (
    PROMPT_VERSION,
    ChapterNamingValidationError,
    build_chapter_naming_request,
    generate_chapter_name,
    parse_chapter_naming_response,
)
from app.archive.semantic_chapters import SemanticChapterProposal

WINDOWS = [
    {
        "start_ms": 0,
        "end_ms": 120_000,
        "text": "Michigan auto workers announced a strike authorization vote over wages and plant conditions.",
    },
    {
        "start_ms": 120_000,
        "end_ms": 240_000,
        "text": "Union organizers explained the bargaining timeline and the workers' contract demands.",
    },
]


def test_chapter_naming_response_is_grounded_in_cited_windows():
    proposal = SemanticChapterProposal(
        start_ms=0,
        end_ms=240_000,
        boundary_score=1.0,
        evidence_window_indexes=(0, 1),
    )
    payload = {
        "message": {"content": """{
                "title": "Michigan Auto Workers Prepare for a Strike",
                "summary": "Auto workers describe their strike vote, bargaining timeline, and contract demands.",
                "subjects": ["Michigan auto workers", "union organizers"],
                "keywords": ["strike authorization vote", "contract demands"],
                "evidence_ids": ["w0", "w1"]
            }"""},
        "prompt_eval_count": 120,
        "eval_count": 48,
    }

    named = parse_chapter_naming_response(payload, proposal, WINDOWS, model="qwen3:8b")

    assert named.title == "Michigan Auto Workers Prepare for a Strike"
    assert named.subjects == ("Michigan auto workers", "union organizers")
    assert named.evidence_ids == ("w0", "w1")
    assert named.prompt_tokens == 120


def test_chapter_naming_rejects_unknown_evidence_citation():
    proposal = SemanticChapterProposal(0, 240_000, 1.0, (0, 1))
    payload = {"message": {"content": """{
                "title": "Michigan Auto Workers Prepare for a Strike",
                "summary": "Auto workers describe their strike vote and contract demands.",
                "subjects": ["Michigan auto workers"],
                "keywords": ["contract demands"],
                "evidence_ids": ["w99"]
            }"""}}

    with pytest.raises(ChapterNamingValidationError, match="unknown or missing evidence"):
        parse_chapter_naming_response(payload, proposal, WINDOWS, model="qwen3:8b")


def test_chapter_naming_rejects_unsupported_subject():
    proposal = SemanticChapterProposal(0, 240_000, 1.0, (0, 1))
    payload = {"message": {"content": """{
                "title": "Michigan Auto Workers Prepare for a Strike",
                "summary": "Auto workers describe their strike vote and contract demands.",
                "subjects": ["California governor"],
                "keywords": ["contract demands"],
                "evidence_ids": ["w0", "w1"]
            }"""}}

    with pytest.raises(ChapterNamingValidationError, match="subject is unsupported"):
        parse_chapter_naming_response(payload, proposal, WINDOWS, model="qwen3:8b")


def test_chapter_naming_rejects_unsupported_title_entities():
    proposal = SemanticChapterProposal(0, 240_000, 1.0, (0, 1))
    payload = {"message": {"content": """{
                "title": "California Governor Joins Michigan Strike",
                "summary": "Auto workers describe their strike vote and contract demands.",
                "subjects": ["Michigan auto workers"],
                "keywords": ["contract demands"],
                "evidence_ids": ["w0", "w1"]
            }"""}}

    with pytest.raises(ChapterNamingValidationError, match="title is unsupported"):
        parse_chapter_naming_response(payload, proposal, WINDOWS, model="qwen3:8b")


def test_chapter_naming_rejects_unsupported_summary_entities():
    proposal = SemanticChapterProposal(0, 240_000, 1.0, (0, 1))
    payload = {"message": {"content": """{
                "title": "Michigan Auto Workers Prepare for a Strike",
                "summary": "Auto workers say Governor Newsom joined their strike vote.",
                "subjects": ["Michigan auto workers"],
                "keywords": ["strike vote"],
                "evidence_ids": ["w0", "w1"]
            }"""}}

    with pytest.raises(ChapterNamingValidationError, match="summary introduced unsupported named terms"):
        parse_chapter_naming_response(payload, proposal, WINDOWS, model="qwen3:8b")


def test_chapter_naming_request_uses_strict_schema_and_span_evidence():
    proposal = SemanticChapterProposal(0, 240_000, 1.0, (0, 1))

    request = build_chapter_naming_request(proposal, WINDOWS, model="qwen3:8b")

    assert request["model"] == "qwen3:8b"
    assert request["think"] is False
    assert request["options"]["temperature"] == 0
    assert request["format"]["additionalProperties"] is False
    assert request["format"]["required"] == ["title", "summary", "subjects", "keywords", "evidence_ids"]
    assert PROMPT_VERSION in request["messages"][0]["content"]
    assert '"evidence_id": "w0"' in request["messages"][1]["content"]


def test_generate_chapter_name_calls_local_ollama_and_validates_response(monkeypatch):
    proposal = SemanticChapterProposal(0, 240_000, 1.0, (0, 1))
    captured = {}

    class _Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return b"""{"message":{"content":"{\\"title\\":\\"Michigan Auto Workers Prepare for a Strike\\",\\"summary\\":\\"Auto workers describe their strike vote and contract demands.\\",\\"subjects\\":[\\"Michigan auto workers\\"],\\"keywords\\":[\\"contract demands\\"],\\"evidence_ids\\":[\\"w0\\",\\"w1\\"]}"}}"""

    def open_request(req, timeout):
        captured["url"] = req.full_url
        captured["timeout"] = timeout
        return _Response()

    monkeypatch.setattr("app.archive.chapter_naming.request.urlopen", open_request)

    named = generate_chapter_name(
        proposal,
        WINDOWS,
        base_url="http://ollama:11434",
        model="qwen3:8b",
        timeout_seconds=30,
    )

    assert captured == {"url": "http://ollama:11434/api/chat", "timeout": 30}
    assert named.title == "Michigan Auto Workers Prepare for a Strike"


def test_generate_chapter_name_falls_back_to_grounded_extract_when_model_title_is_unsupported(monkeypatch):
    proposal = SemanticChapterProposal(0, 240_000, 1.0, (0, 1))

    class _Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            content = {
                "title": "California Governor Joins Michigan Strike",
                "summary": "Auto workers describe their strike vote and contract demands.",
                "subjects": ["Michigan auto workers"],
                "keywords": ["contract demands"],
                "evidence_ids": ["w0", "w1"],
            }
            return json.dumps(
                {
                    "message": {"content": json.dumps(content)},
                    "prompt_eval_count": 120,
                    "eval_count": 48,
                }
            ).encode()

    monkeypatch.setattr("app.archive.chapter_naming.request.urlopen", lambda *_args, **_kwargs: _Response())

    named = generate_chapter_name(
        proposal,
        WINDOWS,
        base_url="http://ollama:11434",
        model="qwen3:8b",
    )

    assert named.title == "Michigan auto workers announced strike authorization vote wages plant"
    assert named.summary == WINDOWS[0]["text"]
    assert named.subjects == ()
    assert named.keywords == ()
    assert named.evidence_ids == ("w0",)
    assert named.model == "qwen3:8b:extractive-fallback"
    assert named.prompt_tokens == 120
