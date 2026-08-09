from __future__ import annotations

import json

import pytest

from app.archive.ollama_embeddings import EmbeddingValidationError, embed_texts


def test_embed_texts_batches_requests_and_preserves_input_order(monkeypatch):
    requests = []
    responses = [
        {"embeddings": [[1.0, 0.0], [0.5, 0.5]]},
        {"embeddings": [[0.0, 1.0]]},
    ]

    class _Response:
        def __init__(self, payload):
            self.payload = payload

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps(self.payload).encode()

    def open_request(req, timeout):
        requests.append((req.full_url, json.loads(req.data), timeout))
        return _Response(responses[len(requests) - 1])

    monkeypatch.setattr("app.archive.ollama_embeddings.request.urlopen", open_request)

    embeddings = embed_texts(
        ["election news", "polling analysis", "union strike"],
        base_url="http://ollama:11434",
        model="qwen3-embedding:0.6b",
        batch_size=2,
        timeout_seconds=30,
    )

    assert embeddings == [[1.0, 0.0], [0.5, 0.5], [0.0, 1.0]]
    assert [request[1]["input"] for request in requests] == [
        ["election news", "polling analysis"],
        ["union strike"],
    ]
    assert all(request[0] == "http://ollama:11434/api/embed" for request in requests)
    assert all(request[2] == 30 for request in requests)


def test_embed_texts_rejects_dimension_changes_between_batches(monkeypatch):
    responses = iter([{"embeddings": [[1.0, 0.0]]}, {"embeddings": [[0.0, 1.0, 0.0]]}])

    class _Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps(next(responses)).encode()

    monkeypatch.setattr("app.archive.ollama_embeddings.request.urlopen", lambda *_args, **_kwargs: _Response())

    with pytest.raises(EmbeddingValidationError, match="dimensions changed"):
        embed_texts(
            ["first", "second"],
            base_url="http://ollama:11434",
            model="qwen3-embedding:0.6b",
            batch_size=1,
        )
