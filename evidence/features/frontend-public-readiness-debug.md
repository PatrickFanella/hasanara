# Frontend public-readiness debugging log

## 2026-08-05 — Coverage command could not remove report files

- Reproduction: `cd frontend && npm run test:coverage -- --run`
- Symptom: Vitest exits before collecting tests with `EACCES` while unlinking `frontend/coverage/base.css`.
- Evidence: `frontend/coverage` and its contents are owned by `root:root`; the directory is ignored and not tracked by Git. The same 38 suites pass without coverage.
- Root cause: a prior privileged run created an unwritable generated report directory. This is workspace state, not a frontend failure.
- Minimal verification: direct the same Vitest coverage run to `/tmp/hasanara-frontend-coverage`.
- Result: 38 suites passed; 156 tests passed, 1 skipped; all configured coverage thresholds passed.
- Follow-up: avoid running npm/Vitest as root. The generated directory can be removed or ownership-corrected outside this release change.

## 2026-08-05 — Mobile Safari suite could not launch

- Reproduction: `cd e2e && npm run test:mobile`.
- Symptom: all Mobile Chrome cases pass; every Mobile Safari case fails in 2–4 ms at `browserType.launch`.
- Evidence: Playwright reports that its pinned WebKit executable is absent at `~/.cache/ms-playwright/webkit-2311/pw_run.sh`.
- Root cause: the Playwright package is installed but its WebKit browser runtime is not.
- Fix: install the package-pinned WebKit runtime with `npx playwright install webkit`.
- Re-verification: the pinned binary installed successfully, but the host still lacks WebKit's native Linux libraries. Mobile Safari remains an environment-level release check for CI/a Playwright image with `install-deps` applied.

## 2026-08-05 — Valid video routes crashed before rendering

- Reproduction: open `/v/:videoId` against a valid video/transcript response in Vite and wait for the lazy route to evaluate.
- Symptom: the router error boundary renders `Cannot access 'memo' before initialization`.
- Evidence: `FormattedTranscriptDocument.tsx` invoked `memo(...)` before a trailing React import; the browser transform exposed the import binding's temporal dead zone. Unit-module transforms did not reproduce it.
- Root cause: a value import was placed after the component's default export.
- Fix: move `memo` and `useMemo` to the file's import block.
- Re-verification: formatted transcript video story passes in Chromium, Firefox, and Mobile Chrome.

## 2026-08-05 — Transcript save toggle reported the wrong state

- Reproduction: select an anonymous transcript moment, save it, then activate the action again.
- Symptom: local storage removed the item, while the UI continued to say `Transcript moment saved.` and emitted `favorite_add`.
- Root cause: local favorites used toggle semantics, but the view did not read the pre-toggle state or update feedback/analytics for removal. Authenticated favorites also had no removal branch on the transcript page.
- Fix: branch on the existing favorite, call the delete API for authenticated users, emit `favorite_remove`, and render `Remove moment` when selected.
- Re-verification: Vitest regression plus browser save → Saved page → reopen → remove story passes.

## 2026-08-05 — Light and dark semantic colors failed WCAG AA

- Reproduction: inject axe-core into the rendered public route matrix in light and dark schemes.
- Symptom: serious `color-contrast` and `link-in-text-block` violations across subtle labels, accent links, timestamps, and the footer inline link.
- Root cause: shared light/dark semantic tokens did not maintain 4.5:1 on every surface; accent-filled controls shared a foreground assumption; player chrome inherited the page's light-theme accent.
- Fix: correct the semantic palette, add `accent-contrast` and invariant `player-accent` tokens, use a theme-aware focus outline, and underline the inline footer link.
- Re-verification: serious/critical axe violations are empty across 11 routes in both color schemes; core routes have no document overflow at 320 px.

## 2026-08-05 — Firefox reported errors while replacing test documents

- Reproduction: scan several full-page routes sequentially with `page.goto` in Firefox.
- Symptom: two `NetworkError when attempting to fetch resource` exceptions were attributed to the Search URL only while navigating away.
- Root cause: Firefox reports aborted fetches from the document being replaced; the product's normal internal navigation is client-side, and the active destination route had no runtime error.
- Fix: the runtime assertion associates exceptions with the active document URL and discards stale-document teardown events.
- Re-verification: the Firefox light/dark route matrix passes.

