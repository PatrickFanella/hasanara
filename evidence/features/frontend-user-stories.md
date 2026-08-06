# Frontend user-story inventory

Date: 2026-08-05

This inventory was derived from the frontend router, route components, shared controls, service behavior, existing Vitest coverage, Playwright smoke coverage, access matrix, and private-beta protocol. It deliberately includes happy paths, permission boundaries, loading/empty/error states, persistence, keyboard and mobile behavior, and launch-only checks.

## Coverage legend

- **E2E** — exercised in the current Playwright browser suite.
- **Unit** — directly or substantially exercised by Vitest at component/service level.
- **Partial** — some underlying behavior is tested, but not the complete user journey.
- **Gap** — no direct automated frontend story was found.
- **API** — enforced or exercised below the frontend boundary.
- **Automated build gate** — verified by the release validation commands rather than a UI test.
- **Manual** — requires a real provider, production integration, assistive technology, or human judgment.

Priorities: **P0** blocks a safe public launch; **P1** is important public functionality; **P2** is secondary, administrative, or resilience depth.

## Global shell, navigation, and route states

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| GL-001 | P0 | As a visitor, I can load the application shell without a runtime exception. | E2E |
| GL-002 | P0 | As a visitor, I can skip directly to the main content with the keyboard. | Unit |
| GL-003 | P1 | As a desktop visitor, I can navigate to Home, Search, Explore, Timeline, VODs, and Saved. | Unit |
| GL-004 | P1 | As a mobile visitor, I can open the navigation menu. | E2E |
| GL-005 | P1 | As a mobile visitor, I can close the menu by selecting a destination. | E2E |
| GL-006 | P1 | As a keyboard user, I can close the mobile menu with Escape and regain focus on its trigger. | E2E, Unit |
| GL-007 | P1 | As a visitor, I can see which desktop navigation destination is active. | Unit |
| GL-008 | P1 | As an authenticated user, I can see Account navigation. | Unit |
| GL-009 | P1 | As an anonymous visitor, I do not see Account navigation. | Unit |
| GL-010 | P1 | As a visitor, I can switch between light and dark themes. | Unit |
| GL-011 | P1 | As a returning visitor, my explicit theme choice persists. | Unit |
| GL-012 | P1 | As a first-time visitor, the theme follows my operating-system preference. | Unit |
| GL-013 | P1 | As a visitor using automatic theme selection, the page responds to system changes. | Unit |
| GL-014 | P1 | As a mobile visitor, I can change theme from the open navigation menu. | Unit |
| GL-015 | P1 | As a visitor, browser chrome receives the correct theme color. | Unit |
| GL-016 | P0 | As a visitor, serious and critical accessibility violations are absent on all core public routes in light mode. | E2E |
| GL-017 | P0 | As a visitor, serious and critical accessibility violations are absent on all core public routes in dark mode. | E2E |
| GL-018 | P0 | As a visitor at 320px width, core public routes do not overflow horizontally. | E2E |
| GL-019 | P1 | As a visitor, every lazy-loaded route displays a useful loading state. | Partial |
| GL-020 | P0 | As a visitor following an unknown URL, I see a 404 and can return home. | E2E |
| GL-021 | P0 | As a visitor encountering a route exception, I can retry or return home. | Unit |
| GL-022 | P0 | As a visitor, navigation between routes does not report stale-document runtime errors. | E2E |
| GL-023 | P1 | As an authenticated user, I can log out from desktop navigation. | Unit |
| GL-024 | P1 | As an authenticated mobile user, I can log out and the menu closes. | Unit |
| GL-025 | P1 | As an anonymous visitor, I can start Google or Twitch sign-in from desktop navigation. | Unit |
| GL-026 | P1 | As an anonymous mobile visitor, I can start Google or Twitch sign-in and the menu closes. | Unit |
| GL-027 | P1 | As a visitor, external or thumbnail images do not cause disruptive layout shifts. | Manual |
| GL-028 | P1 | As a keyboard user, all shell controls have a visible focus indicator. | Manual |

## Home

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| HM-001 | P0 | As a visitor, I can understand that the product searches HasanAbi broadcast transcripts. | Unit, E2E |
| HM-002 | P0 | As a visitor, I can submit a non-empty archive search from the home page. | E2E |
| HM-003 | P1 | As a visitor, leading and trailing search whitespace does not alter my query. | Unit |
| HM-004 | P1 | As a visitor, submitting an empty home search leaves me safely on the page. | Unit |
| HM-005 | P1 | As a visitor, I can open a suggested example search. | Unit |
| HM-006 | P1 | As a visitor, I can open Explore from the masthead. | Unit |
| HM-007 | P1 | As a visitor, I can browse all VODs from the masthead or recent section. | Unit |
| HM-008 | P1 | As a visitor, I can see archive counts, runtime, transcript words, and refresh date. | Unit |
| HM-009 | P1 | As a visitor, I see stable placeholders while archive summary data loads. | Unit |
| HM-010 | P1 | As a visitor, I see a useful fallback when archive summary data fails. | Unit |
| HM-011 | P1 | As a visitor, I can open a recently indexed VOD. | Unit |
| HM-012 | P1 | As a visitor, I can open a popular search term. | Unit |
| HM-013 | P1 | As a visitor, I can open the newest transcript at its beginning. | Unit |
| HM-014 | P2 | As a visitor, I can understand the Search → Inspect → Read workflow. | Unit |
| HM-015 | P1 | As a screen-reader user, the home search has a useful accessible name. | Unit |

## Search and research tools

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| SE-001 | P0 | As a visitor, I can search for a topic or exact phrase. | E2E, Unit |
| SE-002 | P1 | As a visitor, a search URL restores its query and filters after reload or sharing. | Unit |
| SE-003 | P1 | As a visitor, I can filter by start and end date. | Unit |
| SE-004 | P1 | As a visitor, I can choose the best, Whisper, or YouTube transcript source when supported. | Unit |
| SE-005 | P1 | As a visitor, I can filter by category. | Unit |
| SE-006 | P1 | As a visitor, I can filter by minimum and maximum VOD duration. | Unit |
| SE-007 | P1 | As a visitor, I can change result ordering. | Unit |
| SE-008 | P1 | As a visitor, I can reset all filters and return to the search start state. | Unit |
| SE-009 | P1 | As a visitor, I cannot submit a blank archive query. | Unit |
| SE-010 | P1 | As a visitor, I see an announced loading state while transcripts are scanned. | Unit |
| SE-011 | P0 | As a visitor, results are grouped by VOD with a moment and VOD count. | Unit, E2E |
| SE-012 | P1 | As a visitor, legacy flat search responses remain usable and grouped by VOD. | Unit |
| SE-013 | P1 | As a visitor, I can see VOD title, channel, date, duration, and match count in a result group. | Unit |
| SE-014 | P0 | As a visitor, I can open a matching transcript moment at the correct timestamp. | E2E |
| SE-015 | P1 | As a visitor, I can open the containing VOD from its result header. | Unit |
| SE-016 | P1 | As a visitor, matching text is highlighted without interpreting transcript markup as HTML. | Unit |
| SE-017 | P1 | As a visitor, Unicode highlights align with the intended characters. | Unit |
| SE-018 | P1 | As a visitor, I can play all matches within a VOD beginning at the first match. | Unit |
| SE-019 | P1 | As a visitor, I can copy a timestamp link for a result. | Unit |
| SE-020 | P1 | As a visitor, successful timestamp copying is announced. | Unit |
| SE-021 | P1 | As a visitor, clipboard failure produces an actionable error. | Unit |
| SE-022 | P1 | As a visitor, I can copy a quote with VOD title, timestamp, and deep link. | Unit |
| SE-023 | P1 | As an anonymous visitor, I can save a matching moment locally. | Unit |
| SE-024 | P1 | As an authenticated user, I can save a matching moment to my account. | Unit |
| SE-025 | P1 | As a visitor, a saved result is visibly and accessibly identified. | Unit |
| SE-026 | P1 | As a visitor, save failure does not falsely show success. | Unit |
| SE-027 | P1 | As a visitor, I can export every matching mention as JSON. | Unit |
| SE-028 | P1 | As a visitor, I can export every matching mention as CSV. | Unit |
| SE-029 | P1 | As a visitor, I can export every matching mention as M3U. | Unit |
| SE-030 | P1 | As a visitor, exports preserve the active query and filters. | Unit |
| SE-031 | P1 | As a visitor, I can add every matching mention to a persistent playback queue. | E2E, Unit |
| SE-032 | P1 | As a visitor, queue creation reports the number of added moments. | Unit |
| SE-033 | P1 | As a visitor, a queue-creation failure leaves existing queue data intact and reports an error. | Unit |
| SE-034 | P1 | As a visitor, I can open a queued moment. | E2E |
| SE-035 | P1 | As a visitor, I can remove one queued moment. | Unit |
| SE-036 | P1 | As a visitor, I can clear the complete playback queue. | Unit |
| SE-037 | P1 | As a visitor, I can open a mention map for my active query. | Unit |
| SE-038 | P1 | As a visitor, I can carry the complete current query into the Save Search page. | Unit |
| SE-039 | P1 | As a visitor, I see related search suggestions when available. | Unit |
| SE-040 | P1 | As a visitor, search remains usable when suggestions fail. | Unit |
| SE-041 | P1 | As a visitor, an empty result explains how to broaden the query. | Unit |
| SE-042 | P0 | As a visitor, a search API failure is announced without destroying my editable query. | Unit |
| SE-043 | P1 | As a visitor, changing a filter resets stale pagination appropriately. | Unit |
| SE-044 | P1 | As a visitor sharing filtered search results, the recipient sees the same research state. | Manual |

## Explore and archive intelligence

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| EX-001 | P1 | As a visitor, I can load the latest archive-intelligence window. | Unit, E2E |
| EX-002 | P1 | As a visitor, I can select a predefined period from the period selector. | Unit |
| EX-003 | P1 | As a visitor, I can switch among latest, event, era, recurring, and other supported period kinds. | Unit |
| EX-004 | P1 | As a visitor, switching period kind loads the corresponding period options. | Unit |
| EX-005 | P1 | As a visitor, I can select a period from the discovery rail. | Unit |
| EX-006 | P1 | As a visitor, the selected period is represented in the URL. | Unit |
| EX-007 | P1 | As a visitor, I can define a custom date range. | Unit |
| EX-008 | P1 | As a visitor, I can switch custom-range granularity between week and month. | Unit |
| EX-009 | P1 | As a visitor, applying a range refreshes archive intelligence. | Unit |
| EX-010 | P1 | As a visitor, refresh progress is visible without discarding the previous snapshot. | Unit |
| EX-011 | P1 | As a visitor, refresh failure preserves the last successful snapshot and explains the problem. | Unit |
| EX-012 | P1 | As a visitor, I can see period VOD, runtime, label, and evidence totals. | Unit |
| EX-013 | P1 | As a visitor, I can understand why a named period matters. | Unit |
| EX-014 | P1 | As a visitor, an empty period explains that no archived VODs were found. | Unit |
| EX-015 | P1 | As a visitor, I can inspect ranked topic, series, and person cards with evidence. | Unit |
| EX-016 | P1 | As a visitor, I can open a topic card into its mention map. | Unit |
| EX-017 | P1 | As a visitor, I see a useful empty state when no topic cards exist. | Unit |
| EX-018 | P1 | As a visitor, I can open a representative VOD for the selected period. | Unit |
| EX-019 | P0 | As a visitor, I can open a cited period moment at the intended transcript timestamp. | Unit |
| EX-020 | P1 | As a visitor, I see explicit empty states for missing representative VODs, cited moments, or calculated source material. | Unit |
| EX-021 | P1 | As a visitor, I can open a person facet as a transcript search. | Unit |
| EX-022 | P1 | As a visitor, I can open a content tag as a transcript search. | Unit |
| EX-023 | P1 | As a visitor, missing people or tag facets are explained. | Unit |
| EX-024 | P1 | As a keyboard user, horizontally scrollable period-kind controls remain operable and visibly selected. | Manual |
| EX-025 | P1 | As a mobile visitor, period controls and evidence cards remain usable without content loss. | E2E, Partial |

## VOD library and archive timeline

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| EP-001 | P0 | As a visitor, I can browse the VOD library. | E2E, Unit |
| EP-002 | P1 | As a visitor, VODs are presented newest first. | Unit |
| EP-003 | P1 | As a visitor, I can filter VODs by title, channel, or notes. | Unit |
| EP-004 | P1 | As a visitor, I can filter VODs by upload-date range. | Unit |
| EP-005 | P1 | As a visitor, applied library filters are reflected in the URL. | Unit |
| EP-006 | P1 | As a visitor, I can clear all library filters. | Unit |
| EP-007 | P1 | As a visitor, I can move to the next result page. | Unit, E2E |
| EP-008 | P1 | As a visitor, I can move to the previous result page. | Unit |
| EP-009 | P1 | As a visitor, pagination controls disable correctly at boundaries and while loading. | Unit |
| EP-010 | P1 | As a visitor, I can see the current result range and total count. | Unit |
| EP-011 | P1 | As a visitor, initial loading uses a stable card skeleton. | Unit |
| EP-012 | P0 | As a visitor, a library failure is reported without showing stale results as current. | Unit |
| EP-013 | P1 | As a visitor, a no-match state suggests broadening filters. | Unit |
| EP-014 | P1 | As a visitor, each VOD card clearly indicates transcript availability. | Unit |
| EP-015 | P1 | As a visitor, I can open a VOD from its library card. | E2E |
| EP-016 | P1 | As a visitor, the `/streams` compatibility route shows the same library as `/episodes`. | Gap |
| TL-001 | P1 | As a visitor, I can browse the archive chronology by month or year. | E2E, Unit |
| TL-002 | P1 | As a visitor, I can see the VOD count and runtime for each timeline bucket. | Unit |
| TL-003 | P1 | As a visitor, I can open a timeline VOD. | Unit |
| TL-004 | P1 | As a visitor, I can jump from a timeline bucket to an exactly matching VOD date range. | E2E, Unit |
| TL-005 | P1 | As a visitor, timeline loading is explicit. | Unit |
| TL-006 | P1 | As a visitor, an empty timeline is explicit. | Unit |
| TL-007 | P1 | As a visitor, timeline API failure does not crash the route. | Unit |

## Topic mention maps and opinion history

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| TP-001 | P0 | As a visitor, I can view a citation-backed mention map for a real topic. | E2E, Unit |
| TP-002 | P1 | As a visitor, I can see total moments, total VODs, and other topic statistics. | Unit |
| TP-003 | P1 | As a visitor, I can see the first and latest known mentions. | Unit |
| TP-004 | P1 | As a visitor, I can open first/latest mention evidence at its timestamp. | Unit |
| TP-005 | P1 | As a visitor, I can inspect top VODs for the topic. | Unit |
| TP-006 | P1 | As a visitor, I can open a top VOD. | Unit |
| TP-007 | P1 | As a visitor, I can open the first or latest matching moment within a top VOD. | Unit |
| TP-008 | P1 | As a visitor, I can play all topic matches in a top VOD. | Unit |
| TP-009 | P1 | As a visitor, I can view grouped topic results and source labels. | Unit |
| TP-010 | P1 | As a visitor, I can open the full search for this topic. | Unit |
| TP-011 | P1 | As a visitor, I can change topic timeline granularity. | Unit |
| TP-012 | P1 | As a visitor, I can restrict the topic timeline by date range. | Unit |
| TP-013 | P1 | As a visitor, timeline filters persist in the URL. | Unit |
| TP-014 | P1 | As a visitor, I can open evidence from a timeline bucket. | E2E |
| TP-015 | P1 | As a visitor, topic timeline loading, empty, and unavailable states are distinct. | Unit |
| TP-016 | P1 | As a visitor, I can inspect labeled model-generated opinion history with citations and revisions. | Unit |
| TP-017 | P1 | As a visitor, an empty opinion history is understandable and accessible. | E2E, Unit |
| TP-018 | P1 | As a visitor, opinion-history failure does not hide the rest of the topic page. | Unit |
| TP-019 | P1 | As a visitor, I can copy a citation-ready topic quote. | Unit |
| TP-020 | P1 | As a visitor, quote-copy failure is announced. | Unit |
| TP-021 | P1 | As an anonymous visitor, I can save a topic moment locally. | Unit |
| TP-022 | P1 | As an authenticated user, I can save a topic moment remotely. | Unit |
| TP-023 | P1 | As a visitor, topic save failure does not falsely mark the moment as saved. | Unit |
| TP-024 | P2 | As an administrator, I can correct an opinion by supplying a reason and retain revision history. | Partial |
| TP-025 | P2 | As an administrator, I can retract an opinion by supplying a reason and retain revision history. | Partial |
| TP-026 | P1 | As a non-admin user, I cannot see opinion correction or retraction controls. | Unit |
| TP-027 | P1 | As a visitor following an invalid empty topic, I receive a useful recovery state. | Unit |
| TP-028 | P0 | As a visitor, topic load failure is announced without a route crash. | Unit |

## VOD, player, transcript, and exports

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| VD-001 | P0 | As a visitor, I can open an archived VOD and its transcript. | E2E |
| VD-002 | P0 | As a visitor, a missing VOD is distinguished from a temporary service failure. | Unit |
| VD-003 | P0 | As a visitor, a missing VOD offers a route back to the VOD library. | Unit |
| VD-004 | P0 | As a visitor, a temporary VOD failure offers a retry. | Unit |
| VD-005 | P1 | As a visitor, I can see VOD title, source metadata, people, and content tags. | Unit |
| VD-006 | P1 | As a visitor, I can inspect related episodes and why they are related. | Unit |
| VD-007 | P1 | As a visitor, I can open a related episode. | Unit |
| VD-008 | P1 | As a visitor, I can open a quoted related moment at its timestamp. | Unit |
| VD-009 | P1 | As a visitor, related-episode empty and unavailable states do not block the transcript. | Unit |
| VD-010 | P0 | As a visitor, the YouTube player initializes for the correct video. | Unit |
| VD-011 | P0 | As a visitor following a timestamp URL, playback seeks to that timestamp. | Unit, E2E |
| VD-012 | P1 | As a visitor, selecting a transcript paragraph seeks and plays the VOD. | Unit |
| VD-013 | P1 | As a visitor, selecting a formatted sentence seeks and deep-links that exact sentence. | Unit |
| VD-014 | P1 | As a visitor, a segment hash takes precedence over rounded timestamp ambiguity. | Unit |
| VD-015 | P1 | As a visitor, a block hash opens and highlights the intended formatted block. | Unit |
| VD-016 | P1 | As a visitor, I can switch among Split, Watch, and Read layouts. | Unit |
| VD-017 | P1 | As a reader, I can play or pause without leaving Read layout. | Unit |
| VD-018 | P1 | As a visitor, playback progress highlights the current transcript content efficiently. | Unit |
| VD-019 | P1 | As a visitor, automatic transcript following pauses when I manually scroll or navigate. | Unit |
| VD-020 | P1 | As a visitor, I can explicitly resume following the current sentence. | Unit |
| VD-021 | P1 | As a visitor, I can navigate an episode outline and jump to a chapter. | Unit |
| VD-022 | P1 | As a visitor, selecting a chapter seeks playback and scrolls to its evidence. | Unit |
| VD-023 | P0 | As a visitor, formatted transcript blocks render without module-evaluation crashes. | E2E |
| VD-024 | P1 | As a visitor, a plain transcript remains readable when formatted blocks are unavailable. | Unit |
| VD-025 | P1 | As a visitor, transcript text normalization changes spacing but not words. | Unit |
| VD-026 | P1 | As a visitor, unlabeled transcript segments are grouped into readable turns. | Unit |
| VD-027 | P1 | As a visitor, I see a clear announced transcript loading state. | Unit |
| VD-028 | P0 | As a visitor, transcript failure is distinct from VOD failure and can be retried in place. | Unit |
| VD-029 | P1 | As a visitor, retry uses the preferred persisted Whisper source when available. | Unit |
| VD-030 | P1 | As a visitor, I can search inside the current VOD. | Unit |
| VD-031 | P1 | As a visitor, clearing in-VOD search removes its URL query state. | Unit |
| VD-032 | P1 | As a visitor, in-VOD matches are highlighted as inert text. | Unit |
| VD-033 | P1 | As a visitor, I can move to the next match. | Unit |
| VD-034 | P1 | As a visitor, I can move to the previous match, wrapping when necessary. | Unit |
| VD-035 | P1 | As a visitor, I can start and stop sequential playback of all matches. | Unit |
| VD-036 | P1 | As a visitor, sequential match playback stops after the final match. | Unit |
| VD-037 | P1 | As an anonymous visitor, I can save and remove a transcript moment locally. | E2E, Unit |
| VD-038 | P1 | As an authenticated user, I can save and remove a transcript moment remotely. | Unit |
| VD-039 | P1 | As a visitor, transcript save/remove feedback accurately describes the completed action. | E2E, Unit |
| VD-040 | P1 | As a visitor, transcript save failure is announced without changing the saved state. | Unit |
| VD-041 | P1 | As a visitor, I can copy a transcript quote containing normalized text, VOD title, timestamp, and deep link. | Unit |
| VD-042 | P1 | As a visitor, transcript quote-copy failure is announced. | Unit |
| VD-043 | P1 | As a visitor, I can reopen a saved transcript moment at the intended location. | E2E |
| VD-044 | P1 | As a visitor, I can open the transcript export menu. | Unit |
| VD-045 | P1 | As a visitor, I can download supported transcript formats with correct source-aware links. | Unit |
| VD-046 | P1 | As a visitor, selecting an export records the correct analytics format. | Unit |
| VD-047 | P1 | As a visitor, export options explain whether they apply to a section or full transcript. | Unit |
| VD-048 | P0 | As a visitor, failure to load or operate the YouTube API does not crash the transcript and permits retry. | Unit |
| VD-049 | P1 | As a visitor navigating between VODs, the old player is destroyed and state resets. | Unit |
| VD-050 | P1 | As a keyboard user, timestamps, transcript sentences, save, copy, search, and layout controls are operable. | Manual |
| VD-051 | P1 | As a mobile visitor, player and transcript controls remain usable without overlap or overflow. | E2E, Partial |

## Saved moments, saved searches, and synchronization

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| SV-001 | P1 | As an anonymous visitor, I can view locally saved moments. | Unit, E2E |
| SV-002 | P1 | As an anonymous visitor, I can reopen a locally saved moment. | E2E |
| SV-003 | P1 | As an anonymous visitor, I can remove a locally saved moment. | E2E, Unit |
| SV-004 | P1 | As an authenticated user, I can view server-synchronized saved moments. | Unit |
| SV-005 | P1 | As an authenticated user, I can remove a remote saved moment. | Unit |
| SV-006 | P1 | As an anonymous visitor, local storage failures do not crash the Saved page. | Unit |
| SV-007 | P1 | As a visitor with no saved moments, I see a useful empty state and search link. | Unit |
| SV-008 | P0 | As a newly signed-in user, local moments missing from the server are synchronized once. | Unit |
| SV-009 | P0 | As a newly signed-in user, successfully synchronized local moments are removed locally to prevent duplication. | Unit |
| SV-010 | P1 | As a user, synchronization failure preserves access to my local moments. | Unit |
| SV-011 | P1 | As an anonymous visitor, I can save a named search and all active filters locally. | Unit |
| SV-012 | P1 | As an authenticated user, I can save a named search and all active filters remotely. | Unit |
| SV-013 | P1 | As a visitor, a blank search cannot be saved. | Unit |
| SV-014 | P1 | As a visitor, saving progress disables duplicate submission. | Unit |
| SV-015 | P1 | As a visitor, successful local or synchronized saving is announced accurately. | Unit |
| SV-016 | P1 | As a visitor, saved-search failure is announced without a false list entry. | Unit |
| SV-017 | P1 | As a visitor, I can open a saved search with its complete filter set. | Unit |
| SV-018 | P1 | As an anonymous visitor, I can delete a local saved search. | Unit |
| SV-019 | P1 | As an authenticated user, I can delete a remote saved search. | Unit |
| SV-020 | P0 | As a newly signed-in user, local searches missing from the server are synchronized once. | Unit |
| SV-021 | P0 | As a newly signed-in user, successfully synchronized local searches are removed locally to prevent duplication. | Unit |
| SV-022 | P1 | As a visitor, the UI distinguishes local-only saves from synchronized saves. | Unit |
| SV-023 | P1 | As an anonymous visitor, I am invited to sign in to synchronize without being blocked from saving. | Unit |
| SV-024 | P1 | As a visitor, the `/favorites` compatibility route shows the same content as `/saved`. | Gap |
| SV-025 | P1 | As a visitor, locally saved items update across tabs or windows. | Unit |

## Authentication and account security

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| AU-001 | P0 | As an anonymous visitor, I can start Google sign-in. | Unit |
| AU-002 | P0 | As an anonymous visitor, I can start Twitch sign-in. | Unit |
| AU-003 | P0 | As a visitor, an authentication initialization error is shown without an unhandled rejection. | Unit |
| AU-004 | P0 | As an authenticated user, unsafe requests include a memory-only CSRF token. | Unit |
| AU-005 | P0 | As an authenticated user, stale refresh responses cannot restore invalidated authentication. | Unit |
| AU-006 | P0 | As an authenticated user, concurrent refreshes retain only the newest user and CSRF state. | Unit |
| AU-007 | P0 | As an authenticated user, logout clears local authentication and handles server failure coherently. | Unit |
| AU-008 | P1 | As an anonymous visitor opening Account directly, I am redirected to sign in with a return target. | E2E, Unit |
| AU-009 | P1 | As an authenticated user, I can load account settings without sensitive provider tokens or IDs being exposed. | Unit |
| AU-010 | P1 | As a user, account loading and retryable load failures are distinct. | Unit |
| AU-011 | P1 | As a user, I can see my current role. | Unit |
| AU-012 | P1 | As a user, I can update my display name. | Unit |
| AU-013 | P1 | As a user, display-name whitespace is trimmed before saving. | Unit |
| AU-014 | P1 | As a user, empty or overlong display names receive inline validation. | Unit |
| AU-015 | P1 | As a user, I can set or remove an HTTPS avatar URL. | Unit |
| AU-016 | P1 | As a user, invalid, non-HTTPS, or whitespace-containing avatar URLs receive inline validation. | Unit |
| AU-017 | P1 | As a user, backend field validation is attached only to the affected profile field. | Unit |
| AU-018 | P1 | As a user, unknown profile errors remain form-level. | Unit |
| AU-019 | P1 | As a user, a saved profile refreshes shell identity information. | Unit |
| AU-020 | P0 | As a user, I can link a second Google or Twitch identity through a protected authorization start. | Unit |
| AU-021 | P0 | As a user, an identity already owned by another account is not silently merged. | Partial |
| AU-022 | P0 | As a user, unlinking an identity requires a deliberate confirmation step. | Unit |
| AU-023 | P0 | As a user, my final sign-in identity cannot be removed. | Unit |
| AU-024 | P1 | As a user, I can cancel an identity unlink. | Unit |
| AU-025 | P1 | As a user, I can see when and how linked identities were last used without seeing provider tokens. | Unit |
| AU-026 | P0 | As a user, I can review active sessions, current-session status, last activity, creation, and expiry. | Unit |
| AU-027 | P0 | As a user, I can revoke one non-current session while remaining signed in. | Unit |
| AU-028 | P0 | As a user, revoking my current session clears local authentication and returns me home. | Unit |
| AU-029 | P0 | As a user, I can log out all other sessions while retaining the current session. | Unit |
| AU-030 | P0 | As a user, I can log out all sessions and clear local authentication. | Unit |
| AU-031 | P1 | As a user, session-operation failure is announced without falsely changing the list. | Unit |
| AU-032 | P1 | As a user with no returned sessions, I see an explicit empty state. | Unit |
| AU-033 | P0 | As a user, account deletion remains hidden behind a danger-zone disclosure. | Unit |
| AU-034 | P0 | As a user, permanent deletion requires the exact case-sensitive word `DELETE`. | Unit |
| AU-035 | P0 | As a user, cancelling deletion clears the confirmation and errors. | Unit |
| AU-036 | P0 | As a user, successful deletion clears local authentication and returns me home. | Unit |
| AU-037 | P0 | As a user, failed deletion preserves my account and explains that nothing changed. | Unit |
| AU-038 | P0 | As the final administrator, I cannot delete the only remaining admin account. | Unit |
| AU-039 | P0 | As a real user, Google and Twitch callback, linking, conflict, cancellation, and return-target behavior work in the deployed environment. | Manual |

## Administration and capability boundaries

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| AD-001 | P0 | As an anonymous visitor, opening an admin route requires authentication. | Partial |
| AD-002 | P0 | As an authenticated non-admin, I receive a 403 and no admin child content loads. | Unit |
| AD-003 | P0 | As a user with `admin:access`, I can open the admin shell. | Unit |
| AD-004 | P1 | As an administrator, I can navigate Dashboard, Events, Users, Periods, Metadata, and Labels. | Partial |
| AD-005 | P1 | As an administrator, I see a dashboard loading state. | Unit |
| AD-006 | P1 | As an administrator, I can refresh dashboard data manually. | Unit |
| AD-007 | P1 | As an administrator, I can inspect job, video, user, session, search, export, queue, and signup metrics. | Unit |
| AD-008 | P1 | As an administrator, I can inspect database, worker, and queue health. | Unit |
| AD-009 | P1 | As an administrator, I can inspect jobs-over-time, job-status, export-format, and search analytics charts. | Unit |
| AD-010 | P1 | As an administrator, chart values have accessible text alternatives. | Partial |
| AD-011 | P1 | As an administrator, dashboard failure is explained without a crash. | Unit |
| AD-012 | P2 | As an administrator, I can filter events by type. | Unit |
| AD-013 | P2 | As an administrator, I can filter events by user email. | Unit |
| AD-014 | P2 | As an administrator, I can filter events by date/time range. | Unit |
| AD-015 | P2 | As an administrator, I can inspect event summaries by type and day. | Unit |
| AD-016 | P2 | As an administrator, I can inspect event rows and payloads. | Unit |
| AD-017 | P2 | As an administrator, I can export the active event filters to CSV. | Unit |
| AD-018 | P1 | As an administrator, I can list users and roles. | Unit |
| AD-019 | P1 | As an administrator, typed user search is applied only when submitted. | Unit |
| AD-020 | P1 | As an administrator, stale or cancelled user searches cannot replace newer results. | Unit |
| AD-021 | P1 | As an administrator, I can retry a failed initial or filtered user query. | Unit |
| AD-022 | P0 | As an administrator, role changes are CSRF-protected and shown only after server success. | Unit |
| AD-023 | P0 | As an administrator, a failed role change preserves the prior role and capability state. | Unit |
| AD-024 | P0 | As an administrator who demotes myself, admin controls disappear after refreshed capabilities arrive. | Unit |
| AD-025 | P1 | As an administrator, I can list, search, and filter named archive periods. | Partial |
| AD-026 | P1 | As an administrator, I can create a one-time archive period. | Unit |
| AD-027 | P1 | As an administrator, I can create a recurring archive period with valid month/day values. | Unit |
| AD-028 | P1 | As an administrator, invalid sort order or incomplete recurrence fields are rejected locally. | Partial |
| AD-029 | P1 | As an administrator, I can edit an archive period. | Unit |
| AD-030 | P1 | As an administrator, I can activate or deactivate an archive period. | Unit |
| AD-031 | P1 | As an administrator, I can recalculate a named period. | Unit |
| AD-032 | P2 | As an administrator, I can seed curated archive periods. | Unit |
| AD-033 | P1 | As an administrator, period load and mutation failures are announced without losing form data. | Partial |
| AD-034 | P1 | As an administrator, I can create and edit people metadata including aliases, kind, order, and description. | Unit |
| AD-035 | P1 | As an administrator, I can create and edit tag metadata including category, order, and description. | Unit |
| AD-036 | P1 | As an administrator, invalid metadata sort orders are rejected locally. | Partial |
| AD-037 | P2 | As an administrator, I can seed default tags. | Unit |
| AD-038 | P1 | As an administrator, I can search for a VOD by title or YouTube ID. | Unit |
| AD-039 | P1 | As an administrator, I can select a search result and inspect its current people and tags. | Unit |
| AD-040 | P1 | As an administrator, I can assign people to a VOD with an optional role. | Unit |
| AD-041 | P1 | As an administrator, I can assign tags to a VOD. | Unit |
| AD-042 | P1 | As an administrator, I can save the complete VOD metadata assignment. | Unit |
| AD-043 | P1 | As an administrator, metadata loading, searching, and saving failures are announced without a false success state. | Partial |
| AD-044 | P1 | As an administrator, I can load the candidate-label queue. | Unit |
| AD-045 | P1 | As an administrator, I can filter candidate labels by status, kind, or query. | Partial |
| AD-046 | P1 | As an administrator, I can inspect a candidate label, its confidence, and evidence moments. | Unit |
| AD-047 | P1 | As an administrator, I can open label evidence at the cited VOD timestamp. | Unit |
| AD-048 | P1 | As an administrator, I can approve, reject, or merge a candidate label as supported. | Unit |
| AD-049 | P1 | As an administrator, I can review individual label assignments. | Unit |
| AD-050 | P2 | As an administrator, I can trigger label extraction for a VOD with the selected mode. | Unit |
| AD-051 | P1 | As an administrator, label and assignment mutation failures are announced without optimistic false state. | Partial |
| AD-052 | P0 | As a non-admin, direct requests to administrative APIs remain forbidden even if frontend controls are bypassed. | API/manual |

## Cross-cutting public-launch stories

| ID | Priority | User story | Coverage |
| --- | --- | --- | --- |
| NX-001 | P0 | As a keyboard-only user, I can complete recent-VOD discovery, timestamped citation, playback verification, and recovery. | Manual |
| NX-002 | P0 | As a screen-reader user, I can complete recent-VOD discovery, timestamped citation, playback verification, and recovery. | Manual |
| NX-003 | P0 | As a visitor, focus order remains logical after route changes, disclosures, dialogs, and async updates. | Manual |
| NX-004 | P0 | As a visitor, important loading, success, and error messages are announced without unexpected focus movement. | Partial |
| NX-005 | P0 | As a visitor at 200% and 400% zoom, core tasks remain operable without lost content. | Manual |
| NX-006 | P0 | As a visitor using reduced motion, nonessential animation and smooth scrolling respect my preference. | Gap |
| NX-007 | P0 | As a visitor using high-contrast or forced-colors mode, controls and state remain distinguishable. | Manual |
| NX-008 | P0 | As a mobile visitor, touch targets for primary actions are large enough and do not overlap. | Manual |
| NX-009 | P0 | As a visitor on a slow connection, route and data loading states prevent duplicate or unsafe actions. | Partial |
| NX-010 | P0 | As a visitor whose network drops mid-action, the UI never reports a save, role change, deletion, or export as successful unless confirmed. | Partial |
| NX-011 | P0 | As a visitor, back/forward navigation restores URL-driven filters, periods, timestamps, and queries coherently. | Partial |
| NX-012 | P0 | As a visitor, refreshing a deep link preserves its route and intended research context. | Partial |
| NX-013 | P0 | As a visitor, public routes work with the deployed API base, CSP, cookies, OAuth redirects, and analytics endpoint. | Manual |
| NX-014 | P0 | As a visitor, production content containing punctuation, Unicode, emoji, angle brackets, and long unbroken text renders safely. | Unit, Partial |
| NX-015 | P0 | As a visitor, user-controlled transcript or metadata content cannot execute script or inject markup. | Unit, API |
| NX-016 | P0 | As a visitor, sensitive tokens, cookies, provider IDs, and private payload fields never appear in rendered errors or analytics. | Unit, Manual |
| NX-017 | P0 | As an anonymous visitor, local saved data remains scoped to my browser and is not sent before I authenticate. | Partial |
| NX-018 | P0 | As a user signing in after anonymous use, synchronization is idempotent and does not lose or duplicate saves. | Unit |
| NX-019 | P0 | As a user signing out, private account and synchronized-save data disappears from the UI immediately. | Partial |
| NX-020 | P0 | As a visitor, the current production bundle remains within its launch size budgets. | Automated build gate |
| NX-021 | P0 | As a visitor, no critical production dependency vulnerability applies to a reachable application path. | Automated/manual review |
| NX-022 | P0 | As a Mobile Safari user, all P0 public journeys pass on WebKit. | Gap — runner dependency |
| NX-023 | P0 | As a deployed-site visitor, real API, authentication, CSP, analytics, exports, and production-data smoke checks pass. | Manual |
| NX-024 | P0 | As a beta participant, I can complete each core research task unaided with a confidence-worthy timestamp citation. | Manual |
| NX-025 | P0 | As the launch team, we have no open S0/S1 defects and accepted S2 defects have owners and dates. | Manual release gate |

## Existing browser journeys

The current Playwright suite contains 10 durable journeys:

1. Search from the populated archive home.
2. Preserve a timeline period when opening the VOD library.
3. Browse the seeded VOD library.
4. Build and persist an every-mention playback queue.
5. Inspect topic timeline evidence and the empty opinion state.
6. Read, save, remove, and reopen a formatted transcript moment.
7. Redirect anonymous Account access and recover from a 404.
8. Close mobile navigation after selection and restore focus with Escape.
9. Check the public route matrix for serious accessibility issues and runtime errors in light/dark themes.
10. Check core public routes for overflow at 320px.

## Recommended automation order

1. **P0 cross-browser research journey:** search → cited moment → playback → copy citation → recover from no results.
2. **Save synchronization:** anonymous save/search → authenticate → deduplicated server migration → reopen → remove.
3. **Authenticated transcript actions:** remote save/remove and failure recovery.
4. **URL/deep-link matrix:** search filters, explore periods, topic ranges, VOD timestamps, segment/sentence/block hashes, back/forward, reload.
5. **Account security journey:** provider link/unlink guard, individual/current/all session revocation, exact deletion confirmation, failure states.
6. **Search action matrix:** timestamp copy, quote copy, local/remote save, export formats, queue failure, empty and error states.
7. **Player/transcript matrix:** layouts, chapter navigation, auto-follow pause/resume, match previous/next/wrap/sequential stop.
8. **Admin capability and mutation matrix:** anonymous, non-admin, admin, failed mutation, self-demotion, direct API denial.
9. **Resilience matrix:** slow API, aborted requests, offline transitions, malformed/partial responses, stale responses, retry.
10. **Manual launch matrix:** WebKit/Mobile Safari, keyboard-only, screen reader, zoom/reflow, forced colors, reduced motion, deployed integrations.

## Inventory totals

This file contains **355 distinct frontend and launch stories**. The count is intentionally broader than the number of screens: each important permission, state transition, failure mode, persistence boundary, and access mode is treated as a separate user-observable promise.

- Priority mix: 87 P0, 256 P1, and 12 P2 stories.
- Current evidence touches 37 stories through E2E coverage and 218 through unit/component coverage.
- 62 stories have only partial journey coverage, 41 are explicit automation gaps, and 17 require manual validation. These coverage labels overlap when a story needs more than one kind of proof.
