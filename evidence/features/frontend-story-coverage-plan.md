# Frontend story-coverage execution plan

Date: 2026-08-06
Mode: execute
Source of truth: `evidence/features/frontend-user-stories.md`

## Goal

Give every one of the 355 frontend/launch stories an appropriate, traceable verification method; add missing automated coverage and fix behavior exposed by those tests; finish with all locally executable gates green.

## Scope and interpretation

- Automated behavior belongs at the lowest layer that still proves the user-observable promise: service/model unit tests, rendered component tests, API/contract tests, or Playwright journeys.
- A story is not considered covered merely because its ID appears in documentation. Its traceability entry must point to an executable test/gate or a concrete manual protocol with required evidence.
- Real OAuth providers, deployed CSP/cookies/analytics, Mobile Safari host behavior, screen readers, zoom/reflow, forced colors, and moderated usability remain manual/external gates.
- Existing unrelated working-tree changes are preserved.

## Options considered

- **A — Incremental closure (selected):** build traceability, close P0 gaps first, then P1/P2 in small red-green batches. Lower regression and review risk.
- **B — One large generated suite:** create all missing cases at once. Faster to type but likely to produce brittle or superficial tests, so rejected.

## Acceptance criteria

- Every story ID appears exactly once in a machine-checkable coverage manifest.
- Every automated manifest target exists and is executed by the documented validation commands.
- No story remains labeled only `Gap`; each is automated or assigned a named manual/external protocol.
- All frontend lint, formatting, type, unit, coverage, production-build, and bundle gates pass.
- All locally supported Playwright projects pass their complete story suite.
- API/OpenAPI contract tests used by frontend journeys pass.
- Manual/external items state their environment, steps, evidence, and pass condition; unexecuted items are reported as pending, never green.

## Execution batches

1. Baseline and traceability validator.
2. P0 public research and deep-link journeys.
3. Anonymous/authenticated save migration and failure recovery.
4. Account and authentication security journeys.
5. Search, topic, VOD, player, transcript, and export interactions.
6. Home, Explore, Episodes, Timeline, Saved, and route-state resilience.
7. Admin capability, data display, mutation, and failure paths.
8. Cross-cutting accessibility, responsive, persistence, security, and deployment protocols.
9. Full matrix and final evidence summary.

## Risks and rollback

- Browser fixtures can overfit mock payloads. Prefer behavior assertions and shared realistic fixtures.
- Large test files can become hard to diagnose. Keep route-level component cases near existing suites and durable multi-route journeys in Playwright.
- External gates cannot be honestly completed on an unsupported host. Preserve them as explicit release blockers until evidence is captured.
- Test-only changes are independently reversible; product fixes are kept narrowly tied to a failing story.
