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

## Grounded naming and episode rollups

`app.archive.chapter_naming` sends one semantic span at a time to Ollama using temperature zero, thinking disabled, and a strict JSON schema. Every result is validated after generation:

- citations must resolve to transcript windows inside the span;
- subjects and keywords must be lexically grounded in the cited evidence;
- editorial chapter titles may paraphrase only through a small explicit vocabulary;
- unsupported named terms and numbers are rejected;
- invalid output never becomes a prediction.

`app.archive.enrichment_predictions.generate_episode_prediction` joins semantic proposals to a supplied grounded naming function. Episode subjects and keywords are deduplicated and ranked by the duration of the chapters they cover, so sustained subjects outrank isolated mentions. The result uses the same `EpisodePrediction` contract consumed by the benchmark and still performs no database writes.

## Offline prediction command

Generate predictions from an exported transcript packet:

```bash
./.venv/bin/python scripts/generate_topic_enrichment_predictions.py \
  transcript-input-v1.json predictions.json \
  --ollama-url http://localhost:11434
```

The versioned input contains `pipeline_version` plus episodes with `video_id`, `duration_ms`, and ordered transcript blocks (`block_index`, `start_ms`, `end_ms`, and `text`). Unknown fields, duplicate videos or block indexes, invalid ranges, and out-of-duration blocks are rejected.

The command builds overlapping two-minute windows with a one-minute stride by default. It embeds them in ordered batches with `qwen3-embedding:0.6b`, validates response count, dimensions, numeric values, and ordering, then names semantic spans with `qwen3:8b`. Both models and segmentation thresholds are configurable. Output is directly consumable by `evaluate_topic_enrichment.py` and no application database is imported or modified.
