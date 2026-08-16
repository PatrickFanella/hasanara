# Topic enrichment, keywords, tags, and chapters review

Implementation and current production evidence are tracked in
[`enrichment-workflow-audit-2026-08-15.md`](./enrichment-workflow-audit-2026-08-15.md).
That addendum preserves the release gates in this review while documenting the
new transcript-source policy, people-presence rules, chapter review workflow,
and read-only Almaz validation.

Date: 2026-08-08

## Executive assessment

HasanAra has the right evidence-first product shape, but its enrichment layer is not yet editorially reliable. The current system is optimized to generate and retain candidates, not to produce a small, coherent vocabulary or useful episode navigation.

The primary issue is architectural rather than a missing stop-word list:

1. Automatic topics are raw one-to-three-word transcript n-grams scored mostly by repetition.
2. Whisper and YouTube transcript windows are both processed, so equivalent speech can reinforce the same candidate twice.
3. Search queries can become public archive topics even though search intent is not a taxonomy decision.
4. Mentions, episode-level subjects, and editorial tags are treated too similarly.
5. Three partially overlapping catalogs (`archive_topics`, `archive_labels`, and `archive_video_tags`) can disagree about names, kinds, and publication state.
6. Chapter boundaries are fixed ten-minute buckets, and titles are the first sentence after each boundary.
7. There is no labeled evaluation set or production feedback history, so confidence scores are not calibrated against human judgments.

The recommended target is a hybrid pipeline: deterministic retrieval and corpus statistics propose evidence; local embeddings identify subject continuity and chapter boundaries; a local structured-output model ranks, canonicalizes, and names only grounded proposals. Nothing becomes public without policy and validation gates.

## Live-system evidence

Read-only production inspection found:

- 54,385 automatic topic labels:
  - 18,571 candidates
  - 12,222 hidden
  - 23,592 published
- Approximately 3.13 million label assignments:
  - 1,462,997 auto-published alias assignments
  - 1,035,539 candidate alias assignments
  - 630,584 keyphrase candidate/shadow assignments
- No persisted chapters for any video. Every chapter response uses the transcript fallback.
- No recorded label-review feedback, so the system has no empirical correction loop.
- 189,218 transcript windows and 1,343,319 transcript blocks across 2,955 videos.
- The available local models are `qwen3:8b`, `qwen3:4b`, `nomic-embed-text`, and `qwen3-embedding:0.6b`.

Recent automatic candidates include “Been Around For,” “Either It S,” “Correct Yeah,” and “Do Enough To.” Highly assigned published automatic labels include “All Of These,” “Considering,” “Whereas,” “How,” and “To Deal With.” A recent VOD produced 40 fixed-duration chapters, including titles such as “Again,” “Okay?”, and “Wow.”

The separate public topic catalog is smaller but still contains search-derived entries such as “000 in,” “alleged,” and “rule.” Taxonomy also drifts across kinds: for example, a person can exist as a `topic` in one catalog and as a `person` in another.

## Product functions

These are distinct jobs and should not share one generic “keyword” decision:

1. **Canonical vocabulary** — stable people, organizations, places, issues, events, games, formats, and recurring topics.
2. **Mentions** — timestamped evidence that a canonical entity or phrase occurred.
3. **Episode subjects** — the small set of subjects materially discussed in a VOD, weighted by duration and continuity rather than raw mention count.
4. **Keywords** — search-oriented phrases that help retrieve an episode but do not automatically become canonical tags.
5. **Chapters** — contiguous, navigable subject sections with meaningful titles, summaries, and citations.
6. **Editorial feedback** — approve, reject, merge, rename, and boundary-adjust actions that create evaluation data and improve later runs.

## Defaults enumerated

The obvious fixes are useful containment measures but insufficient as the target design:

- Add more stop words.
- Increase occurrence thresholds.
- Ask an LLM to generate tags from the entire transcript.
- Make fixed chapters shorter or longer.
- Manually clean the current catalog.
- Use transcript titles as tags.

These approaches remain brittle because they do not separate mentions from salience, identify semantic transitions, or measure quality.

## Design-space map

| Axis | Current default | Alternative A | Alternative B | Selected direction |
| --- | --- | --- | --- | --- |
| Actor | Frequency heuristic publishes | Human-only curation | LLM publishes directly | Retrieval proposes, model reviews, policy publishes |
| Timing | Per video, batch/manual | Corpus-wide nightly | Ingestion-time only | Ingestion candidates plus corpus-aware scheduled reconciliation |
| Scale | Millions of assignments | Tiny fixed taxonomy | Unlimited generated labels | Controlled canonical catalog plus noncanonical keywords |
| Method | N-grams and fixed time buckets | Rules only | Generative only | Hybrid lexical, embedding, and grounded structured generation |

## Cross-domain patterns applied

- **Editorial desks:** headlines name the dominant subject of a coherent section; they do not quote the first sentence mechanically.
- **Search engines:** query terms and canonical entities are different indexes with different acceptance rules.
- **Music segmentation:** boundaries are detected through sustained novelty/change, then short adjacent regions are merged.
- **Information retrieval benchmarks:** quality is measured with a labeled corpus, precision/recall, ranking metrics, and error slices rather than an invented confidence score.

## Target architecture

```text
best transcript source + title + curated catalog
  -> normalized evidence windows
  -> canonical alias/entity matches
  -> corpus-specific phrase candidates
  -> embedding continuity and change points
  -> episode subject spans
  -> grounded local-model ranking/naming
  -> schema, citation, taxonomy, and quality validation
  -> candidate assignments and candidate chapters
  -> policy/review
  -> public topic/tag/chapter projections
```

### One canonical taxonomy

Make `archive_labels` the source of truth. Treat `archive_topics` and `archive_video_tags` as compatibility projections during migration, not independent catalogs.

Every canonical label should have:

- one kind from the existing typed taxonomy;
- aliases with ambiguity flags and provenance;
- a lifecycle state and canonical/merge target;
- evidence-backed assignments;
- optional parent/related-label relationships that are not aliases;
- explicit provenance and extraction/prompt/model versions.

Search suggestions must never directly publish canonical topics. They may contribute a demand signal to an existing label or create an internal proposal with transcript evidence.

### Better episode topics and keywords

Select one preferred transcript source per video and use the other only for gap filling or corroboration. Do not count duplicate Whisper and caption text as independent evidence.

Candidate generation should combine:

- curated alias/entity matches;
- title signals, kept distinct from transcript presence;
- corpus-aware phrase scoring using document frequency and within-video coverage;
- noun/entity-shaped phrase validation;
- embedding clustering for paraphrases and continuity;
- duration, window coverage, recurrence, title support, and corpus specificity.

Raw keyphrases remain retrieval metadata. A phrase becomes a canonical label only through merge/canonicalization review. Episode tags should rank subject spans by covered duration, with diversity limits so five near-synonyms cannot occupy the top five slots.

### Better chapters

Use overlapping transcript windows and embeddings to compute a smoothed novelty curve. Candidate boundaries should combine:

- sustained embedding change;
- long transcript/silence gaps;
- explicit transition language;
- changes in dominant canonical labels/entities;
- title/stream metadata cues where present.

Then enforce editorial constraints:

- merge very short sections;
- split excessively long sections at the strongest internal boundary;
- cover the full playable duration without overlaps;
- prefer roughly 4–18 minute sections, while allowing strong evidence to override;
- cap chapter count based on VOD duration;
- cite multiple representative blocks, including blocks near the boundary.

Use `qwen3:8b` with temperature zero and a strict JSON schema to name and summarize each proposed span. Validate every named entity and evidence ID against supplied text, following the existing `smart_summaries.py` pattern. If validation fails, use an extractive noun phrase—not the first sentence—and keep the chapter as a review candidate.

### Feedback and observability

Admin review should support bulk noise rejection, canonical merge suggestions, per-video tag approval, chapter title edits, and boundary adjustments. Each action must write `archive_label_feedback` or a chapter-feedback equivalent.

Track:

- candidate and publication counts per model/prompt version;
- public labels per VOD and their duration coverage;
- rejection, merge, rename, and boundary-adjust rates;
- vocabulary growth and duplicate-cluster rate;
- chapter count/duration distributions;
- invalid structured-output and unsupported-entity rates;
- processing time and model token counts.

## Quality contract and evaluation set

Create a versioned golden set of at least 30 VODs stratified across politics/news, interviews/guests, react content, recurring segments, gaming, and long mixed streams. Human annotations should include canonical episode subjects, acceptable keywords, chapter boundaries, titles, and supporting timestamps.

Initial release gates:

- topic/tag precision@5 >= 0.85;
- topic/tag recall@10 >= 0.70;
- public junk-label rate < 0.02;
- duplicate/near-synonym rate < 0.05;
- chapter boundary F1 >= 0.75 with a +/-90 second tolerance;
- >=95% duration coverage with no overlaps or gaps beyond source availability;
- fragment/filler chapter-title rate < 0.02;
- average human title score >=4/5;
- zero unsupported named entities or invalid evidence citations;
- deterministic reruns for unchanged inputs, model, prompt, and configuration.

## Staged implementation plan

### Stage 0 — Contain current noise

1. Stop direct publication from `search_suggestions`; create review proposals instead.
2. Disable publication/alias bootstrapping for unreviewed automatic keyphrases.
3. Add a protected dry-run cleanup that marks demonstrable automatic noise hidden and removes only its unreviewed assignments.
4. Keep all admin, seed, hybrid, feedback-bearing, merged, and manually approved records protected.
5. Limit public surfaces to curated/hybrid labels and explicitly reviewed automatic labels until evaluation gates pass.

### Stage 1 — Build the evaluation harness

1. Add versioned annotation JSON and schemas for VOD subjects and chapters.
2. Add deterministic scoring for precision@k, recall@k, duplicate rate, boundary F1, coverage, duration, and title-fragment rate.
3. Add a production-safe sampler/exporter for evidence packets; never include credentials or private user data.
4. Seed the first annotation set from representative production VODs and record human judgments through admin review.

### Stage 2 — Replace candidate generation

1. Select and deduplicate transcript sources.
2. Replace exhaustive n-grams with corpus-aware phrase/entity proposals.
3. Add duration/coverage salience and kind classification.
4. Add canonical merge/related-label proposals using embeddings and the local structured-output model.
5. Version configurations and make reruns replace stale automatic output from the same pipeline version.

### Stage 3 — Semantic chapter generation

1. Generate overlapping windows and local embeddings.
2. Detect, smooth, and constrain semantic boundaries.
3. Rank representative evidence for each span.
4. Generate schema-constrained titles/summaries and validate grounding.
5. Persist chapters as candidates, then enable auto-publication only after the chapter gates pass.

### Stage 4 — Product and review experience

1. Present episode subjects, searchable keywords, and chapters as distinct concepts.
2. Add bulk label review, merge suggestions, evidence coverage, and quality reasons to admin.
3. Add chapter title/boundary editing and side-by-side transcript evidence.
4. Explain related-episode recommendations with approved shared subjects rather than raw tags.

### Stage 5 — Backfill and rollout

1. Run dry-run reports against the complete catalog.
2. Canary 10 diverse VODs, then 50, then the golden set.
3. Compare old/new output without changing public data.
4. Require evaluation gates and admin sign-off before projection/publication.
5. Backfill in bounded resumable batches, observe Ollama/GPU contention, and retain previous projections for rollback.

## Orthogonality audit

- More stop words: useful containment, not a durable strategy.
- LLM-only tagging: rejected because it weakens determinism, grounding, and cost control.
- Human-only taxonomy: rejected because it cannot cover the archive or chapter boundaries at this scale.
- Fixed-duration chapters with improved titles: rejected because naming cannot repair incorrect boundaries.
- **Hybrid controlled-vocabulary plus semantic segmentation:** selected because it changes both the evidence model and the publication decision while preserving local operation and citation guarantees.

## Immediate implementation slice

The first safe slice should contain no irreversible production cleanup:

1. Change search-derived topics from published to candidate/review-only.
2. Add public-topic eligibility predicates that exclude unreviewed automatic labels.
3. Add source-deduplication and corpus-aware keyphrase interfaces behind the existing extraction facade.
4. Add the golden-set schema and evaluation CLI.
5. Add a semantic chapter proposal module with deterministic boundary tests and a structured-output naming contract.
6. Produce a production dry-run comparison report before applying or deploying any catalog rewrite.
