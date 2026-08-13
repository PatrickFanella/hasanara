# HasanAra UI/UX Remediation Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Recommended path:
> dispatch a fresh subagent per task, review each result with `review-quality`,
> then continue. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every finding from the August 12 deployed HasanAra UI/UX review while preserving URLs, authentication, exports, deep links, and current roles.

**Architecture:** Ship three independently releasable vertical slices: reliable and accessible state handling, bounded responsive admin lists, then paginated search and progressive transcript chapters. API changes remain additive under `/api`; browser behavior is verified against the deployed Chrome experience after each release.

**Tech Stack:** FastAPI, SQLAlchemy/PostgreSQL, Pydantic, React 19, React Router, TanStack Query, Tailwind CSS, Vitest, Playwright.

---

## Stage 1: Reliability and accessibility

- [ ] Add observable loading, success, empty, and retryable error states to Home and Explore without discarding the last successful payload.
- [ ] Model Saved synchronization explicitly; never substitute local/empty data for a failed authenticated sync, and keep failed deletions visible with retry feedback.
- [ ] Make Admin Events requests abortable and independently retryable, validate date ranges, and distinguish loading, empty, and failure states.
- [ ] Use current-page-aware public/mobile/admin navigation, redirect `/admin` to the dashboard, and give protected/loading states correct headings and live status semantics.
- [ ] Add focused Vitest, axe, and mobile-menu pointer/keyboard coverage.

## Stage 2: Admin usability and responsive density

- [ ] Add the shared additive `OffsetPageInfo` contract and `limit + 1` pagination to Users, Events, and Periods with a default page size of 25.
- [ ] Retain the current page after failed navigation, reset pagination on applied filters, and report only the visible range rather than an unknown total.
- [ ] Keep complete People/Tags lookup data for assignments while filtering and paging their management views client-side in groups of 25.
- [ ] Render admin data as cards below `md` and tables above it; remove narrow-screen fixed-width clipping while preserving every action.
- [ ] Add backend page-boundary tests and frontend card/table parity, pagination, and 320px reflow tests.

## Stage 3: Search and transcript performance

- [ ] Expose Topic, Whole word, and Exact phrase matching; keep Topic as the URL-default and explain stemming.
- [ ] Add offset page metadata to grouped search, load 20 raw moments at a time with `useInfiniteQuery`, and merge later pages into stable VOD groups.
- [ ] Collapse moments within ten seconds into expandable nearby-match clusters while retaining raw exports and raw expanded results.
- [ ] Bound each PostgreSQL search branch before the final union and verify indexed representative query plans plus warm/cold response budgets.
- [ ] Build deterministic transcript chapters from landmarks or 15-minute/200-sentence fallbacks; mount the active and adjacent chapters, preserve deep links/player sync, and provide explicit full-document mode.
- [ ] Add search-mode, incremental-load, cluster, chapter-boundary, deep-link, playback-transition, and DOM-budget tests.

## Integration and release

- [ ] Run `TEST_POSTGRES_PORT=55433 mise exec node@20 -- env PYTHON_BIN="$PWD/.venv/bin/python" make verify` for every stage and again for the combined diff.
- [ ] Review the combined diff for unrelated changes; preserve `mise.toml` and `transcript-audit-2026-08-11/` as user-owned untracked content.
- [ ] Build immutable images through the documented release path and deploy one stage at a time.
- [ ] After every deployment verify asset parity, health, search, saves, account, admin, 320px behavior, and Logout followed by reload in Chrome; roll back the individual stage if acceptance fails.
- [ ] Record before/after search timing and transcript DOM/control counts.

## Locked defaults

- Search page size is 20 raw moments; admin page size is 25 records.
- Topic remains the default; Whole word and Exact phrase are explicit alternatives.
- Progressive chapters are the default; full-document rendering is opt-in.
- No database migration is expected.
- Existing admin assignments for `clpr_tv`, `patrick__eff`, and `subcult_tv` remain unchanged.
