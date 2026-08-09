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

from app.archive.labeling.benchmark import GoldenSet, PredictionSet, evaluate_benchmark


def _load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Score topic, keyword, and chapter predictions against the editor-reviewed golden set."
    )
    parser.add_argument("golden_set", type=Path, help="Versioned editor annotation JSON")
    parser.add_argument("predictions", type=Path, help="Pipeline prediction JSON")
    parser.add_argument("--output", type=Path, help="Also write the JSON report to this path")
    args = parser.parse_args(argv)

    golden = GoldenSet.model_validate(_load_json(args.golden_set))
    predictions = PredictionSet.model_validate(_load_json(args.predictions))
    report = evaluate_benchmark(golden, predictions)
    rendered = json.dumps(report.as_dict(), indent=2, sort_keys=True) + "\n"
    print(rendered, end="")
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    return 0 if report.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
