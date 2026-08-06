# Frontend manual launch matrix

Date prepared: 2026-08-06

Status: operator evidence pending

This matrix is the release evidence for stories that cannot be proven completely by the local automated suite. Record the tester, UTC time, deployed commit and environment, result, artifact link, and defect ID (when applicable) for every check. A check is not green when its evidence field is blank.

Use the frozen release candidate and production-like data. Do not record cookies, tokens, OAuth codes, provider identifiers, or private request payloads in screenshots, traces, issues, or notes.

## Browser and visual checks

- [ ] **GL-027 — Image layout stability.** Throttle images and the network on Home, VOD library, Search, Topic, and VOD pages at 320px, 768px, and desktop widths. Pass when delayed thumbnails do not move the active control or reading position and measured CLS remains at or below 0.1. Evidence: performance trace plus screenshots.
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

- [ ] **NX-022 — WebKit and Mobile Safari.** Install the native Playwright dependencies listed in the story-coverage summary, run all 14 journeys under desktop WebKit and Mobile Safari, then repeat the core search → citation → playback journey on representative iOS hardware. Pass only when both automated projects and the hardware smoke are green. Evidence: CI links plus device/browser details.
- [ ] **Release runtime — Node 20.** Run `make verify` with Python 3.11 and the repository-pinned Node 20 runtime. Pass when the command exits zero. The local Node 24 pass is supporting evidence, not a substitute. Evidence: CI job URL and commit SHA.

## Promotion rule

Public promotion remains blocked until every checkbox above is green, the WebKit runner gap is closed, and the invite-only beta/public-decision requirements in the private-beta protocol have been met. Any failure creates a defect using the protocol's S0–S3 severity rubric and requires the affected check to be rerun after the fix.
