from __future__ import annotations

import json
import time
from typing import Any
from urllib import error, request

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .enrichment_runner import EpisodeInput
from .labeling.benchmark import EpisodePrediction, PredictedChapter

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
PROMPT_VERSION = "archive-episode-enrichment-v1"

EPISODE_ENRICHMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "subjects": {
            "type": "array",
            "minItems": 1,
            "maxItems": 12,
            "items": {"type": "string", "minLength": 2, "maxLength": 80},
        },
        "keywords": {
            "type": "array",
            "minItems": 1,
            "maxItems": 24,
            "items": {"type": "string", "minLength": 2, "maxLength": 100},
        },
        "chapters": {
            "type": "array",
            "minItems": 2,
            "maxItems": 40,
            "items": {
                "type": "object",
                "properties": {
                    "start_ms": {"type": "integer", "minimum": 0},
                    "title": {"type": "string", "minLength": 8, "maxLength": 100},
                    "summary": {"type": "string", "minLength": 12, "maxLength": 300},
                    "evidence_block_indexes": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 3,
                        "items": {"type": "integer", "minimum": 0},
                    },
                },
                "required": ["start_ms", "title", "summary", "evidence_block_indexes"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["subjects", "keywords", "chapters"],
    "additionalProperties": False,
}


class EpisodeChapterCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_ms: int = Field(ge=0)
    title: str = Field(min_length=8, max_length=100)
    summary: str = Field(min_length=12, max_length=300)
    evidence_block_indexes: list[int] = Field(min_length=1, max_length=3)


class EpisodeEnrichmentCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subjects: list[str] = Field(min_length=1, max_length=12)
    keywords: list[str] = Field(min_length=1, max_length=24)
    chapters: list[EpisodeChapterCandidate] = Field(min_length=2, max_length=40)

    @model_validator(mode="after")
    def validate_chapter_starts(self) -> EpisodeEnrichmentCandidate:
        starts = [chapter.start_ms for chapter in self.chapters]
        if starts[0] != 0:
            raise ValueError("first chapter must start at zero")
        if starts != sorted(set(starts)):
            raise ValueError("chapter starts must be unique and increasing")
        return self


class OpenRouterEpisodeResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    video_id: str
    model: str
    provider: str
    prompt_version: str
    candidate: EpisodeEnrichmentCandidate
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    elapsed_seconds: float

    def prediction(self, duration_ms: int) -> EpisodePrediction:
        chapters: list[PredictedChapter] = []
        for index, chapter in enumerate(self.candidate.chapters):
            end_ms = (
                self.candidate.chapters[index + 1].start_ms if index + 1 < len(self.candidate.chapters) else duration_ms
            )
            chapters.append(PredictedChapter(start_ms=chapter.start_ms, end_ms=end_ms, title=chapter.title))
        return EpisodePrediction(
            video_id=self.video_id,
            subjects=list(dict.fromkeys(self.candidate.subjects)),
            keywords=list(dict.fromkeys(self.candidate.keywords)),
            chapters=chapters,
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "video_id": self.video_id,
            "model": self.model,
            "provider": self.provider,
            "prompt_version": self.prompt_version,
            "candidate": self.candidate.model_dump(mode="json"),
            "usage": {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
                "cost_usd": self.cost_usd,
                "elapsed_seconds": round(self.elapsed_seconds, 4),
            },
        }


def _target_chapter_count(duration_ms: int) -> int:
    return max(6, min(30, round(duration_ms / (25 * 60 * 1000))))


def build_openrouter_episode_request(
    episode: EpisodeInput,
    *,
    model: str,
    allow_provider_fallbacks: bool = False,
) -> dict[str, Any]:
    target_count = _target_chapter_count(episode.duration_ms)
    transcript = [
        {
            "block_index": block.block_index,
            "start_ms": block.start_ms,
            "end_ms": block.end_ms,
            "text": block.text,
        }
        for block in episode.blocks
    ]
    system = f"""You are the senior archive editor for a HasanAbi livestream archive.
Prompt version: {PROMPT_VERSION}
Create useful navigation chapters and grounded retrieval metadata from the supplied timestamped transcript.
Use only the transcript. Do not invent people, events, claims, games, places, or outcomes.
Prefer coherent editorial sections over brief conversational shifts. Merge adjacent discussion of the same subject.
Titles must be specific, concise, safe to publish, and understandable without surrounding transcript text.
Do not reproduce slurs, insults, profanity, sponsor copy, chat filler, or sentence fragments in titles.
Subjects are the episode's sustained primary entities or issues. Keywords are specific phrases a user might search.
Every chapter must cite one to three block indexes whose text directly demonstrates its subject.
Return only JSON matching the supplied schema."""
    user = {
        "video_id": episode.video_id,
        "duration_ms": episode.duration_ms,
        "target_chapter_count": target_count,
        "chapter_guidance": {
            "preferred_duration_minutes": "15-35",
            "first_start_ms": 0,
            "maximum_chapters": 40,
            "instructions": "Choose chapter starts; the system derives each end from the next start.",
        },
        "transcript_blocks": transcript,
    }
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False, separators=(",", ":"))},
        ],
        "stream": False,
        "temperature": 0,
        "max_tokens": 8_000,
        "reasoning": {"enabled": False, "exclude": True},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "hasanara_episode_enrichment",
                "strict": True,
                "schema": EPISODE_ENRICHMENT_SCHEMA,
            },
        },
        "provider": {
            "allow_fallbacks": allow_provider_fallbacks,
            "data_collection": "deny",
            "require_parameters": True,
        },
        "usage": {"include": True},
    }


def _parse_response(
    payload: dict[str, Any], episode: EpisodeInput, *, model: str, elapsed: float
) -> OpenRouterEpisodeResult:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("OpenRouter response did not contain assistant content") from exc
    if not isinstance(content, str):
        raise ValueError("OpenRouter assistant content was not text")
    try:
        candidate = EpisodeEnrichmentCandidate.model_validate_json(content)
    except ValueError as exc:
        raise ValueError("OpenRouter response was not valid episode-enrichment JSON") from exc

    if candidate.chapters[-1].start_ms >= episode.duration_ms:
        raise ValueError("final chapter starts outside the episode")
    block_by_index = {block.block_index: block for block in episode.blocks}
    for index, chapter in enumerate(candidate.chapters):
        end_ms = candidate.chapters[index + 1].start_ms if index + 1 < len(candidate.chapters) else episode.duration_ms
        if chapter.start_ms >= episode.duration_ms:
            raise ValueError("chapter starts outside the episode")
        if any(block_index not in block_by_index for block_index in chapter.evidence_block_indexes):
            raise ValueError("chapter cites an unknown transcript block")
        if not any(
            block_by_index[block_index].end_ms > chapter.start_ms and block_by_index[block_index].start_ms < end_ms
            for block_index in chapter.evidence_block_indexes
        ):
            raise ValueError("chapter evidence does not overlap its timeline")

    raw_usage = payload.get("usage")
    usage: dict[str, Any] = raw_usage if isinstance(raw_usage, dict) else {}
    return OpenRouterEpisodeResult(
        video_id=episode.video_id,
        model=model,
        provider=str(payload.get("provider") or "unknown"),
        prompt_version=PROMPT_VERSION,
        candidate=candidate,
        prompt_tokens=int(usage.get("prompt_tokens") or 0),
        completion_tokens=int(usage.get("completion_tokens") or 0),
        cost_usd=float(usage.get("cost") or 0.0),
        elapsed_seconds=elapsed,
    )


def generate_openrouter_episode_enrichment(
    episode: EpisodeInput,
    *,
    api_key: str,
    model: str,
    timeout_seconds: float = 300.0,
    allow_provider_fallbacks: bool = False,
    max_retries: int = 2,
    app_url: str = "https://hasanara.tv",
) -> OpenRouterEpisodeResult:
    if not api_key.strip():
        raise ValueError("OpenRouter API key is required")
    body = build_openrouter_episode_request(
        episode,
        model=model,
        allow_provider_fallbacks=allow_provider_fallbacks,
    )
    req = request.Request(
        OPENROUTER_CHAT_URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": app_url,
            "X-Title": "HasanAra topic enrichment bake-off",
        },
        method="POST",
    )
    started = time.monotonic()
    for attempt in range(max_retries + 1):
        try:
            with request.urlopen(req, timeout=timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return _parse_response(payload, episode, model=model, elapsed=time.monotonic() - started)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:1_000]
            retryable = exc.code == 429 or 500 <= exc.code < 600
            if not retryable or attempt >= max_retries:
                raise RuntimeError(f"OpenRouter request failed: HTTP {exc.code}: {detail}") from exc
            retry_after = exc.headers.get("Retry-After")
            delay = min(30.0, float(retry_after)) if retry_after else min(8.0, 2.0**attempt)
            time.sleep(delay)
        except (error.URLError, TimeoutError) as exc:
            if attempt >= max_retries:
                raise RuntimeError(f"OpenRouter request failed: {exc}") from exc
            time.sleep(min(8.0, 2.0**attempt))
    raise RuntimeError("OpenRouter request failed after retries")


__all__ = [
    "EPISODE_ENRICHMENT_SCHEMA",
    "OPENROUTER_CHAT_URL",
    "PROMPT_VERSION",
    "EpisodeChapterCandidate",
    "EpisodeEnrichmentCandidate",
    "OpenRouterEpisodeResult",
    "build_openrouter_episode_request",
    "generate_openrouter_episode_enrichment",
]
