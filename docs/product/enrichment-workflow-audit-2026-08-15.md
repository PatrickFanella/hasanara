# Archive enrichment workflow audit — 2026-08-15

This document records the production read-only audit and the local redesign of
HasanAra's people, tags, and chapter workflow. It distinguishes current live
behavior from code that is implemented and verified locally but not deployed.

## Evidence boundary

- **READ_ONLY_LIVE:** production checkout/container inspection, internal API
  requests, and PostgreSQL queries run inside explicit read-only transactions.
- **VERIFIED_LOCAL:** code and migration behavior exercised in the local test
  environment, including the generated OpenAPI/frontend contracts.
- **NOT_DEPLOYED:** no production database migration, write, restart, image
  build, deployment, commit, or push was performed during this work.

## Code reconciliation

The local `main`, Gitea `main`, the peeled `v0.1.0-rc.10` tag, and Almaz's
production checkout all resolved to commit
`276b40818617afa7fb4e1ac5d0504f604bcabdfd`. Checksums for the labeling
pipeline, archive routes, and enrichment exporter also matched between that
checkout and the running API container. The compose working-directory name
still contains `production-rc8`, but it is a detached worktree at the rc.10
commit; the directory name is not runtime-version evidence.

Almaz also has an older dirty development checkout at `c18cb79` with
transcription vocabulary changes. The safe decoder-bias configuration was
ported locally: English language selection, VAD, and a Hasan archive initial
prompt now flow through all Whisper implementations. The proposed hard-coded
post-transcription regex replacements were not copied because they can rewrite
correct speech without evidence and need a labeled error corpus first.

The running `/version` endpoint reports unknown provenance because the current
image predates build-argument plumbing. The local Dockerfile and release jobs
now pass the exact Git commit and build date, and copy package metadata so a
future built image can identify itself.

## Production findings

At audit time, production contained:

| Inventory | Live count |
| --- | ---: |
| Videos | 2,995 |
| Videos with native Whisper transcripts | 2,009 |
| Videos with YouTube transcripts | 2,051 |
| Videos with native transcript blocks | 1,863 |
| Chapter rows | 12 candidates for one VOD; 0 published |
| Canonical labels | 54,712, including 54,393 automatic |
| Canonical assignments | 3,132,869 |
| Admin-approved canonical assignments | 0 |
| Label feedback rows | 0 |
| Published legacy people | 170 |
| Legacy video/person links | 0 |
| Published legacy tags | 169 |
| Legacy video/tag links | 4, covering one VOD |

The data demonstrated five separate workflow failures:

1. **Split public and extraction catalogs.** Extraction writes
   `archive_labels`/`archive_label_assignments`, while public video metadata
   reads the mostly empty legacy people/tag link tables. A successful extractor
   therefore still produces an empty public API response.
2. **Unsafe canonical upsert.** An automatic slug collision could rewrite a
   curated label's kind, status, and publish tier. There are 50 person-kind and
   18 tag-kind conflicts between the legacy and canonical catalogs.
3. **Ambiguous identity matching.** There are 101 active normalized aliases
   that resolve to multiple labels, but zero aliases were marked ambiguous.
   Alternate one-word nicknames such as `Austin` could also turn a place or
   ordinary word into a person match.
4. **Mention/presence conflation.** Transcript mentions and generic title
   references were able to imply that a person appeared on stream. “People in
   this VOD” must require explicit guest, host, or caller evidence; a person who
   is discussed is a subject, not an attendee.
5. **Chapter candidates had no production path.** The public API ignored the
   only persisted candidate set and generated a crude transcript fallback.
   Candidate rows discarded model citations and provenance, and there was no
   chapter review API, feedback table, or editor screen.

The raw phrase extractor also created canonical-label pressure from arbitrary
n-grams. All 4,321 current title-derived assignments were stored as transcript
windows rather than VOD evidence, preventing the title from participating in
the intended publication policy.

## Implemented local workflow

```text
video + both transcript sources
  -> measured source selection (coverage and bounded text density)
  -> deterministic canonical/title extraction
       -> ambiguous aliases excluded
       -> people classified as guest/caller or subject
       -> raw keyphrases opt-in only
  -> grounded model proposal for an editor-selected VOD
       -> review-only chapters and labels
       -> stored citations + model/prompt/pipeline/source provenance
  -> admin reviews one complete chapter outline
       -> edit titles, summaries, and boundaries
       -> atomic publish or reasoned rejection
       -> append-only chapter feedback
  -> public video metadata projection
       -> legacy manual links first
       -> approved canonical assignments second
       -> only explicit guest/host/caller evidence becomes public people
```

### Transcript selection

The exporter now evaluates Whisper and YouTube independently for each VOD. It
measures minute-bucket timeline coverage and caps the contribution from word
density so duplicate caption fragments cannot win through row count alone.
YouTube wins when its quality score is materially better; Whisper wins a near
tie because it retains the native pipeline's timestamps and optional speaker
metadata. YouTube segments are grouped into bounded two-minute blocks before
model input. When formatted native transcript blocks have not been backfilled,
the exporter now builds bounded blocks from the raw Whisper segments instead
of declaring the VOD unusable. That read-only fallback recovered 141 live
Whisper-only records at audit time (all were shorter than the normal 30-minute
representative-sample threshold).

A local exporter run against Almaz inside `SET TRANSACTION READ ONLY` selected
12 representative VODs:

- 6 selected YouTube and 6 selected Whisper;
- 4 chose YouTube for materially higher coverage/quality;
- 2 chose YouTube because Whisper was unavailable;
- 6 chose Whisper on a quality tie;
- mean selected timeline coverage was 98.15%;
- the existing 12-chapter candidate VOD selected YouTube at 100% coverage.

This result rejects a global “always prefer Whisper” or “always prefer YouTube”
policy. Source choice is a per-VOD evidence decision and is persisted with each
chapter proposal.

### People and labels

Alias matching now recomputes collisions at runtime even before the migration
backfills `is_ambiguous`. Unsafe alternate one-word person nicknames are
excluded, while canonical one-word handles such as `YourRage` remain usable.
Evidence snippets are centered on the actual match instead of taking the first
300 transcript characters.

Known people found in transcript text remain internal candidates. A title match
is automatically eligible as “present” only when explicit grammar identifies a
guest or caller, including multi-person constructions such as `w/ A & B`.
Speech constructions such as “Jake Tapper calls Hasan antisemitic” are not
treated as phone calls. New person suggestions require the same explicit
guest/caller grammar instead of scanning every title-cased phrase.

On 500 recent production titles, the revised local code found 42 known-person
matches: 32 explicit guests and 10 subjects. Only the 32 presence matches would
be eligible for a public people projection. An expanded Austin audit resolved
only the canonical `AustinShow` handle: titles about his stream or hack remained
subjects, while `w/ AustinShow`, `AustinShow visits`, and equivalent explicit
appearances became guests.

Automatic raw keyphrase generation is disabled by default. Existing curated
labels cannot have their identity or publication state overwritten by an
automatic slug collision. Title evidence is stored at VOD scope. Public video
metadata and its people/tag filters now use the same union: legacy manual
assignments take precedence, then eligible approved canonical assignments are
projected without a brittle materialization job.

### Chapter creation and review

An administrator can explicitly generate grounded candidates for one VOD. The
model is still fail-closed and review-only: provider fallback is disabled,
reported cost is bounded, labels without lexical support in cited blocks are
discarded, and no model output can publish itself.

Candidate chapters now retain:

- cited block index, time range, and transcript text;
- selected transcript source;
- model name;
- prompt version;
- pipeline version.

The new admin queue displays a complete VOD outline, provenance, deep-linked
evidence, editable titles/summaries/start times, and recomputed visual end
times. Publishing validates a full contiguous outline beginning at zero, with
strictly increasing starts and a 30-second minimum chapter length. The complete
set publishes atomically. Rejection requires a written reason. Every edit,
boundary change, publication, and rejection is recorded in
`archive_chapter_feedback`.

The public chapter endpoint continues to show only published chapters; review
candidates remain invisible. Old published rows without stored citations retain
the previous derived-evidence fallback for compatibility.

## Release boundary and next evidence

The implementation is ready for a protected, reversible canary—not for an
automatic archive-wide backfill. Before public rollout:

1. Review and apply `20260815_chapter_review` under the normal backup and
   migration procedure. The migration adds provenance/feedback storage and
   marks existing active alias collisions ambiguous; it does not publish data.
2. Build a provenance-identifiable image and verify `/version` reports the
   expected commit before any canary generation.
3. Configure the pinned enrichment provider with publication disabled. Almaz's
   Ollama currently has `qwen3:8b` but not the embedding model required by the
   local semantic alternative, so that alternative is not yet runnable there.
4. Generate candidates for 10 diverse VODs, review them in the new admin queue,
   and preserve that human feedback.
5. Complete the versioned 30-VOD golden set and require the benchmark gates in
   `topic-enrichment-review-2026-08-08.md`. Local tests validate behavior and
   invariants; they do not establish editorial quality.
6. Verify authenticated admin generation/review and public video metadata in a
   rendered protected environment. Only then consider a 50-VOD canary and a
   controlled backfill.

The useful foundations do not need to be thrown away: transcripts, canonical
tables, strict model contracts, and benchmark primitives are sound. The broken
parts were the orchestration, evidence policy, review loop, and public
projection; those are the pieces replaced or contained here.
