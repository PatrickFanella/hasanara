# Frontend story-coverage debugging log

## Coverage command permission failure

- Reproduction: `npm run test:coverage` failed before running tests with `EACCES` while unlinking `frontend/coverage/base.css`.
- Evidence: `frontend/coverage` and all report files were owned by `root:root`; the test runner executes as the workspace user.
- Control: the same Vitest coverage run passed when `reportsDirectory` pointed to a fresh `/tmp` path (38 files, 157 passed, 1 skipped).
- Additional filesystem constraint: moving the root-owned directory out of the workspace failed because cross-filesystem moves require deleting its contents; a same-filesystem rename was also denied by the mounted workspace.
- Root cause: a stale root-owned generated report collides with Vitest's default clean-before-write behavior.
- Fix: direct generated coverage reports to the ignored, workspace-owned `frontend/.artifacts/coverage` path.
- Rollback: remove `reportsDirectory` from `frontend/vite.config.ts` and `.artifacts` from `frontend/.gitignore` after the host-owned artifact is repaired.

## VOD library false-empty state

- Reproduction: reject `listStreamLibrary` on initial load.
- Root cause: the render conditional treated every non-loading empty `items` array as a successful no-match response, even when `error` was set.
- Fix: render an announced unavailable state before the valid empty-results branch.
- Verification: `StreamsPage.test.tsx` proves failure, empty, results, filters, and pagination remain distinct.

## Timeline false-empty state

- Reproduction: reject `getTimeline` on initial load.
- Root cause: the catch path cleared buckets but did not retain failure state, so failure rendered as “No timeline data yet.”
- Fix: retain an explicit failure flag and render an announced unavailable state before the valid empty branch.
- Verification: `TimelinePage.test.tsx` separately exercises rejected and successful-empty responses.

## Saved-search synchronization duplicate

- Reproduction: return a server saved search with filter keys in a different object order from an equivalent local search.
- Root cause: synchronization identity used raw `JSON.stringify(filters)`, which is order-sensitive.
- Fix: use a canonical field-ordered `savedSearchKey` for local/server comparison.
- Verification: component migration coverage and a service regression prove equivalent filters deduplicate while missing moments still synchronize.
