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

from app.archive.enrichment_service import enrich_video_candidates
from app.db import SessionLocal


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate grounded OpenRouter chapter and topic candidates for explicit archive videos."
    )
    parser.add_argument(
        "--video-id",
        action="append",
        required=True,
        help="Video UUID to enrich; repeat to process multiple videos sequentially.",
    )
    args = parser.parse_args(argv)

    db = SessionLocal()
    try:
        for video_id in dict.fromkeys(args.video_id):
            metrics = enrich_video_candidates(db, video_id)
            print(
                json.dumps(
                    {"status": "completed", "video_id": video_id, "metrics": metrics},
                    sort_keys=True,
                )
            )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
