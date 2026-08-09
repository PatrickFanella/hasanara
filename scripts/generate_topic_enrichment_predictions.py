#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Sequence

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.archive.chapter_naming import generate_chapter_name
from app.archive.enrichment_runner import EnrichmentInput, generate_prediction_set
from app.archive.ollama_embeddings import embed_texts


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate offline topic, keyword, and chapter predictions from transcript blocks."
    )
    parser.add_argument("input", type=Path, help="Versioned transcript input JSON")
    parser.add_argument("output", type=Path, help="Benchmark-compatible prediction JSON")
    parser.add_argument("--ollama-url", default=os.getenv("OLLAMA_URL", "http://ollama:11434"))
    parser.add_argument("--embedding-model", default=os.getenv("ARCHIVE_EMBEDDING_MODEL", "qwen3-embedding:0.6b"))
    parser.add_argument("--naming-model", default=os.getenv("ARCHIVE_CHAPTER_MODEL", "qwen3:8b"))
    parser.add_argument("--embedding-batch-size", type=int, default=16)
    parser.add_argument("--timeout-seconds", type=float, default=180.0)
    parser.add_argument("--window-ms", type=int, default=120_000)
    parser.add_argument("--stride-ms", type=int, default=60_000)
    parser.add_argument("--min-chapter-ms", type=int, default=4 * 60 * 1000)
    parser.add_argument("--max-chapter-ms", type=int, default=18 * 60 * 1000)
    parser.add_argument("--novelty-threshold", type=float, default=0.35)
    args = parser.parse_args(argv)

    with args.input.open(encoding="utf-8") as handle:
        packet = EnrichmentInput.model_validate(json.load(handle))

    def embedder(texts: list[str]):
        return embed_texts(
            texts,
            base_url=args.ollama_url,
            model=args.embedding_model,
            batch_size=args.embedding_batch_size,
            timeout_seconds=args.timeout_seconds,
        )

    def name_proposal(proposal, windows):
        return generate_chapter_name(
            proposal,
            windows,
            base_url=args.ollama_url,
            model=args.naming_model,
            timeout_seconds=args.timeout_seconds,
        )

    predictions = generate_prediction_set(
        packet,
        embedder=embedder,
        name_proposal=name_proposal,
        window_ms=args.window_ms,
        stride_ms=args.stride_ms,
        min_chapter_ms=args.min_chapter_ms,
        max_chapter_ms=args.max_chapter_ms,
        novelty_threshold=args.novelty_threshold,
    )
    args.output.write_text(
        json.dumps(predictions.model_dump(mode="json"), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
