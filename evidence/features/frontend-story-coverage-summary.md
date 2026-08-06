# Frontend story-coverage checkpoint

Date: 2026-08-06
Status: in progress

## Completed in this checkpoint

- Restored the standard coverage command by moving generated reports to a workspace-owned ignored artifacts path.
- Added route recovery coverage for 404 and route exceptions.
- Added VOD library failure-state coverage and fixed failure being displayed as a valid empty result.
- Added idempotent anonymous-to-authenticated moment/search migration coverage and fixed saved-search duplication caused by object-key order.
- Added timeline empty/failure coverage and fixed failure being displayed as valid empty data.
- Added topic mention-map failure coverage.
- Added home blank/trimmed search and summary-fallback coverage.
- Added search filter reset, no-match guidance, timestamp copy, quote copy, and clipboard failure coverage.
- Added shell coverage for active navigation, skip links, mobile theme, mobile OAuth starts, and mobile logout.
- Added complete Home discovery-link and loading-placeholder coverage.
- Added VOD-library skeleton/no-match coverage and timeline counts, VOD links, and loading coverage.
- Added admin-event filter, summary, row/payload, and CSV-export coverage; connected each filter label to its control for accessible querying and form use.
- Added search coverage for blank/loading states, result metadata and navigation, local and remote saves, save/queue failures, suggestions, and query-preserving API failure.
- Added Explore coverage for custom weekly ranges, refresh-in-place failure, period narrative, and all topic/source/facet empty states.
- Added topic coverage for URL-backed timeline filters and states, opinion failure isolation, quote/save success and failure, authenticated saves, and empty-topic recovery.

## Current local gate

- Vitest: 40 files passed; 194 passed, 1 skipped.
- ESLint: pass.
- Prettier: pass.
- TypeScript: pass.
- Coverage thresholds: pass.
- Production build and bundle budget: pass at baseline; rerun required after the full coverage pass.
- API/OpenAPI contracts: pass at baseline; rerun required after the full coverage pass.

## Remaining

- 21 inventory rows still have an explicit automation `Gap` label, including one WebKit runner dependency.
- 44 rows have partial coverage that must be evaluated or strengthened.
- Manual/external protocols remain for real OAuth/deployment integrations, WebKit/Mobile Safari host testing, screen reader, keyboard-only research tasks, zoom/reflow, forced colors, and moderated beta evidence.
- Full Playwright matrix must be rerun after remaining browser stories are added.
