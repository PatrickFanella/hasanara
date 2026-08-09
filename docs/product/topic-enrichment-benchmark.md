# Topic enrichment benchmark

The benchmark is an offline release gate. It does not write archive labels or chapters.

Run it from the repository root:

```bash
./.venv/bin/python scripts/evaluate_topic_enrichment.py golden-v1.json predictions.json
```

The command prints a JSON report and exits `0` when the release gates pass or `1` when they fail. Add `--output report.json` to retain the report as CI evidence.

## Golden-set contract

The top-level object uses `schema_version: "1"` and an `episodes` array. Each episode contains:

- `video_id` and `duration_ms`;
- editor-approved `subjects`;
- `acceptable_keywords`, `junk_subjects`, and `junk_keywords` error slices;
- ordered chapters beginning at zero, each with an editor title and an evidence timestamp.

Unknown fields, duplicate videos, unordered boundaries, out-of-duration evidence, and unsupported schema versions are rejected.

## Prediction contract

Predictions use `schema_version: "1"`, a reproducible `pipeline_version`, and exactly the same video IDs as the golden set. Every episode contains ranked `subjects`, ranked `keywords`, and contiguous full-origin chapters.

The report includes per-episode and macro-average subject precision/recall, keyword precision/recall and junk rate, chapter-boundary F1, duration coverage, and fragment-title rate. Publication remains disabled until the gated metrics in `app/archive/labeling/benchmark.py` pass on the representative golden set.

## Semantic chapter proposals

`app.archive.semantic_chapters.propose_semantic_chapters` accepts ordered transcript windows plus one embedding per window. It detects sustained cosine-distance changes, enforces chapter-duration constraints, covers the complete supplied duration, and returns evidence-window indexes. It deliberately does not name, persist, or publish chapters; grounded naming and persistence are later gated stages.
