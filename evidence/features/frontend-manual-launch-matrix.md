# Frontend manual launch matrix

Date prepared: 2026-08-06

Status: operator evidence pending

Automated supporting evidence: all 19 journeys pass in Chromium, Firefox, Mobile Chrome, desktop WebKit, and emulated Mobile Safari. WebKit projects run in the version-matched official Playwright 1.61.1 container because the host lacks native WebKit libraries. The unchecked items below remain human, hardware, provider, or deployed-environment gates.

Deployed preflight on 2026-08-06: unauthenticated requests to `https://hasanara.tv/`, `/api/health`, and `/api/live` all returned `302` redirects to `auth.hasanara.tv`. The active policy is mounted from `/opt/server/management/config/caddy/Caddyfile`, which imports Authelia for both HasanAra handlers, and `/opt/server/management/config/authelia/configuration.yml`, which still classifies the domain as a one-factor private beta. The direct frontend binding serves the August 3 image rather than this candidate; its `/api/health` fallback returns SPA HTML. The production Docker inventory has no running HasanAra API, worker, Redis, or migrations service, and the documented direct API port is closed. NX-013/NX-023 cannot pass until the candidate images and complete service set are deployed, required health endpoints succeed, the intended public routes are removed from the external Authelia gate, and the smoke matrix is rerun. The Authelia configuration also contains inline secret values; the values are intentionally omitted here and must be rotated and moved to secret-file/environment injection before promotion.

Artifacts: [production ingress screenshot](../../output/playwright/production-ingress-2026-08-06.png) and [release defect preflight](release-defect-preflight-2026-08-06.md). The tracker preflight found no open S0–S2 defect, but NX-025 still requires a fresh query and release-owner approval immediately before promotion.

This matrix is the release evidence for stories that cannot be proven completely by the local automated suite. Record the tester, UTC time, deployed commit and environment, result, artifact link, and defect ID (when applicable) for every check. A check is not green when its evidence field is blank.

Use the frozen release candidate and production-like data. Do not record cookies, tokens, OAuth codes, provider identifiers, or private request payloads in screenshots, traces, issues, or notes.

## Browser and visual checks

- [ ] **GL-027 — Image layout stability.** Automated Chromium coverage now measures CLS ≤ 0.1 and delayed-thumbnail geometry across the public thumbnail routes, including Mobile Chrome, with the geometry case repeated in Firefox, WebKit, and Mobile Safari emulation. Complete the human throttled-image check on Home, VOD library, Search, Topic, and VOD pages at 320px, 768px, and desktop widths. Pass when delayed thumbnails do not move the active control or reading position and measured CLS remains at or below 0.1. Evidence: performance trace plus screenshots.
- [ ] **GL-028 — Visible shell focus.** Navigate every desktop and mobile shell control using Tab, Shift+Tab, Enter, Space, and Escape in light and dark themes. Pass when focus is never lost or hidden and each focused control has a visible indicator. Evidence: screen recording.
- [ ] **SE-044 — Shared search state.** Copy filtered Search URLs covering text, date, source, video, speaker, sort, and page state; open each in a clean browser profile. Pass when the recipient sees the same query, controls, result order, and page. Evidence: paired screenshots and URLs with non-sensitive fixture values.
- [ ] **EX-024 — Keyboard period controls.** At 320px and 400% zoom, reach every horizontally scrollable period-kind control using only the keyboard. Pass when each option can be selected, remains visible, and exposes its selected state. Evidence: screen recording.
- [ ] **VD-050 — Keyboard transcript controls.** Using only the keyboard, operate timestamps, transcript sentences, save, copy, search, previous/next match, layout, chapter, and playback controls. Pass when every action works, focus remains visible, and notices are announced without stealing focus. Evidence: screen recording.
- [ ] **NX-003 — Focus sequence and restoration.** Check route changes, menus, disclosures, destructive confirmations, error recovery, and asynchronous save/delete notices. Pass when focus order is logical, route content is reachable, closed surfaces restore focus, and no action strands focus. Evidence: annotated recording.
- [ ] **NX-005 — Zoom and reflow.** Complete search, citation, playback verification, save/remove, and error recovery at 200% and 400% zoom without horizontal page scrolling at the WCAG reflow viewport. Pass when no content or action is clipped, overlapped, or unreachable. Evidence: screenshots and recording.
- [ ] **NX-007 — Forced colors.** Repeat the public route and state matrix with Windows High Contrast or browser forced-colors emulation. Pass when focus, selected/pressed state, errors, links, buttons, charts, and transcript highlights remain distinguishable without color alone. Evidence: screenshots for every route family.
- [ ] **NX-008 — Touch targets.** On representative iOS and Android hardware, inspect and operate primary navigation, search, filters, timestamps, player, save/copy, and dialog controls. Pass when targets are at least 44 CSS px where required, do not overlap, and tolerate normal thumb input. Evidence: device/browser details and recording.

## Assistive-technology and usability checks

- [ ] **NX-001 — Keyboard-only core journey.** Complete recent-VOD discovery, find a quote/topic, produce a timestamped citation, verify playback, trigger no results, and recover without a pointer. Pass unaided with no critical or serious accessibility finding. Evidence: the recorded session required by [the private-beta protocol](../../docs/user-testing/private-beta.md).
- [ ] **NX-002 — Screen-reader core journey.** Complete the same core journey with a production screen reader/browser pairing, including landmarks, headings, live notices, search results, transcript position, player labels, and recovery. Pass unaided with no critical or serious finding. Automated axe results do not substitute for this check. Evidence: consented session notes/recording.
- [ ] **NX-024 — Moderated beta journey.** Run the three core scenarios with 5–8 consenting participants. Pass only with at least 80% unaided completion per task, median SEQ at least 5/7, no repeated core failure, and no critical or serious accessibility finding. Evidence: pseudonymous aggregate report following [the private-beta protocol](../../docs/user-testing/private-beta.md).

## Deployed integration and privacy checks

- [ ] **AU-039 — Real OAuth identities.** In the deployed environment, exercise Google and Twitch login, callback cancellation, safe return targets, linking, unlinking, ownership conflict, replay/invalid state, and provider failure. Pass when identities never merge implicitly, sessions/cookies are correct, and errors expose no secrets. Evidence: redacted provider matrix.
- [ ] **NX-013 — Deployed browser contract.** Verify the production API base, CSP, secure cookies, OAuth redirects, analytics endpoint, cache policy, and cross-origin behavior from the public origin. Pass with no console CSP/CORS/runtime error and no failed required request. Evidence: redacted headers and browser trace.
- [ ] **NX-016 — Sensitive-data rendering.** Exercise failed auth, account, analytics, export, save, search, and admin requests while inspecting the DOM, console, network responses, telemetry, and support artifacts. Pass when tokens, cookies, provider identifiers, and private payload fields never appear in rendered errors or analytics. Evidence: redacted trace and log query.
- [ ] **NX-023 — Production smoke.** On the frozen deployed image, verify health, recent VODs, search/fallback, timestamp playback, citation/copy, saves, exports, account/session controls, CSP, analytics, and representative production data. Pass when all required requests and user outcomes succeed. Evidence: completed [production checklist](../../docs/deployment/production-checklist.md) and trace.
- [ ] **NX-025 — Defect release gate.** Query the release defect tracker immediately before promotion. Pass only with zero open S0/S1 defects and every accepted S2 assigned to a named owner and target date. Evidence: dated redacted defect report and approver.

## Provisioned-runner checks

- [ ] **NX-022 — WebKit and Mobile Safari hardware confirmation.** The 19 desktop WebKit and emulated Mobile Safari journeys pass in the official Playwright 1.61.1 container. Repeat the core search → citation → playback journey on representative iOS hardware. Pass when the hardware smoke is also green. Evidence: automated job link plus device/browser details.
- [x] **Release runtime — Node 20.** `make verify` exited zero locally on 2026-08-06 with Python 3.11 and Node 20.20.2: 1,495 backend tests, security and migration checks, 226 frontend tests with 1 intentional skip, the production build and bundle budgets, and 19 Chromium journeys passed. CI must retain the job URL and deployed commit SHA as durable promotion evidence.

## Promotion rule

Public promotion remains blocked until every checkbox above is green, representative iOS hardware confirmation is recorded, and the invite-only beta/public-decision requirements in the private-beta protocol have been met. Any failure creates a defect using the protocol's S0–S3 severity rubric and requires the affected check to be rerun after the fix.
