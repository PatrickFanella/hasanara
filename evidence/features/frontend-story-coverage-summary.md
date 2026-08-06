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
- Added Saved coverage for synchronized viewing/deletion, sync-failure preservation, remote form states, and cross-tab reloads; fixed local searches disappearing while synchronization was pending or failed.
- Added account coverage for role/identity metadata, unlink cancellation, session failure/empty states, and danger-zone disclosure/reset behavior.
- Added VOD coverage for exact paragraph/sentence/block navigation, all reading layouts, follow pause/resume, chapter evidence, loading, in-VOD search and wrapping navigation, sequential match playback, authenticated saves, save failure, and quote-copy success/failure.
- Added browser coverage for the `/streams` and `/favorites` compatibility routes and verified reduced-motion styles disable nonessential motion and smooth scrolling.
- Added admin coverage for opinion revisions, archive-period filters/validation/failures, metadata validation/failures, label status/kind/query filters, mutation failures, access/navigation, and accessible chart values; fixed missing label-kind filtering, unreachable announced sort validation, period live-region semantics, dashboard failure recovery, and line-chart text alternatives.
- Added coverage for lazy-route announcements, OAuth identity-conflict recovery, focus-stable async notices, local-only anonymous saves, immediate private-data removal on sign-out, hostile/Unicode content, browser history restoration, and refreshed topic/VOD deep links.
- Added fresh-profile filter sharing, keyboard-only citation and recovery, shell focus visibility, forced-colors selection, delayed-thumbnail stability with an explicit CLS ≤ 0.1 gate, 400%-equivalent reflow, and primary touch-target geometry coverage; raised undersized period, search-result, and transcript actions to the promised 44px target. The CLS gate exposed and verified a mobile shell/VOD-loading fix that prevents the footer from jumping during lazy route and data initialization.
- Updated the pinned `cryptography` dependency from 49.0.0 to 50.0.0 after the release audit found `PYSEC-2026-3552`; the follow-up Python audit reports no known vulnerabilities after the repository's documented unreachable Torch exception.

## Current local gate

- Vitest: 40 files passed; 226 passed, 1 skipped.
- ESLint: pass.
- Prettier: pass.
- TypeScript: pass.
- Coverage thresholds: pass.
- Production build and bundle budget: pass; main bundle is 106.87 KiB gzip against a 150 KiB limit and every lazy route is below its 100 KiB limit.
- API/OpenAPI contracts: pass with the repository's pinned Python 3.11 environment.
- npm security exception gate: pass after refreshing npm's reassigned source IDs for the same pinned `brace-expansion` GHSA; no critical advisory is present and all accepted high-severity paths remain version-locked, dev-only or unreachable.
- Playwright Chromium: 19 public journey tests passed.
- Playwright Firefox: 19 public journey tests passed.
- Playwright Mobile Chrome: 19 public journey tests passed, including keyboard navigation, explore, video/transcript, touch geometry, and 320px overflow stories.
- Playwright WebKit: 19 public journey tests passed in the version-matched official Playwright 1.61.1 container.
- Playwright Mobile Safari: 19 public journey tests passed in the version-matched official Playwright 1.61.1 container.
- Full repository verifier: pass on 2026-08-06 with Python 3.11 and the release-pinned Node 20.20.2 runtime (1,495 backend tests, migrations, static analysis, security audits, 226 frontend tests with 1 intentional skip, production build and bundle budgets, and 19 seeded Chromium journeys).

## Remaining

- No inventory row retains a `Gap` label. Host WebKit lacks native libraries, so desktop WebKit and Mobile Safari are run in `mcr.microsoft.com/playwright:v1.61.1-noble`, matching the installed Playwright version.
- No inventory row retains a `Partial` label.
- Manual/external protocols remain for real OAuth/deployment integrations, representative iOS hardware, screen reader, human keyboard-only and zoom/forced-colors confirmation, and moderated beta evidence.
- Every manual/external story has an executable procedure and required artifact in [the frontend manual launch matrix](frontend-manual-launch-matrix.md); blank evidence remains a release blocker.
