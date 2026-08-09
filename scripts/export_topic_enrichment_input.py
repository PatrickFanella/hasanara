#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.archive.enrichment_exporter import export_enrichment_input
from app.db import SessionLocal


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Export a minimal, read-only transcript packet for topic-enrichment evaluation."
    )
    parser.add_argument("output", type=Path, help="Destination JSON packet")
    parser.add_argument("--pipeline-version", required=True)
    parser.add_argument("--sample-size", type=int, default=30)
    parser.add_argument("--per-stratum", type=int, default=5)
    parser.add_argument("--candidate-limit", type=int, default=600)
    parser.add_argument("--max-blocks-per-video", type=int, default=20_000)
    parser.add_argument(
        "--minimum-duration-minutes",
        type=int,
        default=30,
        help="Minimum duration for sampled videos; explicit video IDs bypass this filter",
    )
    parser.add_argument(
        "--video-id",
        action="append",
        default=[],
        help="Export this video ID; repeat to select multiple videos instead of sampling",
    )
    args = parser.parse_args(argv)

    db = SessionLocal()
    try:
        packet = export_enrichment_input(
            db,
            pipeline_version=args.pipeline_version,
            sample_size=args.sample_size,
            per_stratum=args.per_stratum,
            candidate_limit=args.candidate_limit,
            max_blocks_per_video=args.max_blocks_per_video,
            minimum_duration_seconds=args.minimum_duration_minutes * 60,
            video_ids=args.video_id or None,
        )
        args.output.write_text(
            json.dumps(packet.model_dump(mode="json"), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
