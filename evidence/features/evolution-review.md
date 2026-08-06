# Frontend public-readiness evolution review

## Decision

- Record the issue now and optimize the workflow later.
- Do not modify shared skills as part of this release pass.

## Biggest blocker

Environment, dependency, and command setup caused the most friction. In particular:

- Playwright browser availability differed by engine.
- WebKit could not run locally because required native host libraries were missing.
- Firefox surfaced aborted requests from a previous document during navigation, requiring the runtime-error check to associate errors with the active document.
- Dependency advisory validation required separating exploitable application paths from advisories affecting APIs the project does not use.

## Desired optimization direction

Prioritize deterministic scripts and templates for future frontend release passes. A reusable release-validation command should:

1. verify or install supported Playwright browsers and report missing native libraries clearly;
2. run lint, formatting, type checks, unit tests, coverage, production build, and bundle-budget checks in a fixed order;
3. run the durable browser stories across the supported desktop and mobile matrix;
4. run accessibility, runtime-error, and narrow-viewport overflow checks;
5. produce a concise evidence summary that distinguishes application failures from runner/environment limitations;
6. record dependency advisories with an applicability assessment instead of relying only on severity totals.

This item should be processed collectively during a later skill/workflow optimization pass.
