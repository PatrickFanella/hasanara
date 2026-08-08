# Quality review traceability

**Status:** completed audit (2026-07-12). The original review files remain historical snapshots.

## Frontend review

- [x] Stored HTML injection replaced by plain snippets and React-node highlights.
- [x] Anonymous saved moments reopen locally and synchronize after confirmed persistence.
- [x] Every serialized search filter round-trips or is rejected.
- [x] Query, period, and video requests cancel stale work.
- [x] Player loader/readiness/seek state resets per video/start.
- [x] Authentication has loading/authenticated/anonymous/error states and resilient logout.
- [x] 403, 404, route errors, and missing-video recovery are tested.
- [x] Admin routes require the admin capability before loading their shell.
- [x] Dependency advisories and the single-command verification gate are blocking.
- [x] Routes are lazy, public downloads exclude admin, and bundle budgets pass.
- [x] Transcript playback updates are isolated, indexed, memoized, throttled, and content-visible.
- [x] TanStack Query owns shared freshness/retry/cancellation; suggestions use a small endpoint.
- [x] Five route hotspots were split by responsibility.
- [x] Mobile focus/Escape, landmarks, tabs/button groups, pressed states, targets, transitions, images, forms, reduced motion, and axe coverage are repaired.
- [x] Topic timelines, opinion revisions, related episodes, quoted moments, mention exports/queue, Timeline navigation, shareable Explore state, and operation feedback are shipped.
- [x] Seeded browser flows reflect current routes, envelopes, search fields, archive intelligence, and mobile behavior.
- [x] README, architecture, design, accessibility/PWA, and testing documentation match shipped behavior.

## Backend review

- [x] 1. Stored XSS boundary uses plain snippets and Unicode highlight offsets.
- [x] 2. Analytics uses a separate HMAC subject; credentials are scrubbed/rotated by rollout tooling; CSV is formula-safe.
- [x] 3. Private/credential-bearing responses default to `private, no-store`; public caching is allowlisted.
- [x] 4. Vocabulary mutations enforce authentication, ownership/admin policy, ID validation, and exact worker selection.
- [x] 5. Jobs have leases, heartbeats, attempts, bounded retries/concurrency, cancellation, recovery, and compare-and-set finalization.
- [x] 6. Redis stores versioned JSON DTOs with cold/warm parity and mutation invalidation.
- [x] 7. Python 3.11/Node 20 `make verify` is reproducible and blocking.
- [x] 8. The search outbox, tombstones, classified fallback, freshness state, reconciliation, and lag metrics are implemented.
- [x] 9. Analytics taxonomy, batch/property/body/depth limits, rate limits, bulk insert, rejection monitoring, and 90-day retention are implemented.
- [x] 10. Quota and duplicate submission are atomic under advisory locking and indexed identity/idempotency constraints.
- [x] Metrics use route templates; framework GZip, short transactions, rollback-before-retry, typed taxonomy, explicit unavailable states, centralized policy, real worker concurrency, repository boundaries, and split runtime dependencies are implemented.
- [x] Job history/cancel/retry/operator recovery/progress, API-key scopes, source deletion, search freshness, idempotency, billing retirement, and API stability are shipped.
- [x] Generated OpenAPI, access/deployment matrices, status metadata, and privacy/lease/cache/search/backup/incident runbooks resolve documentation discrepancies.

Production execution items—backup rehearsal, analytics scrub/session rotation, deployment, outbox backfill, and live metric checks—remain explicit release steps rather than repository findings.

## 2026-08-07 backend remediation register

| Finding group | Repository evidence | Verification | Deployment evidence |
| --- | --- | --- | --- |
| Vocabulary authorization, event-token removal, CSV safety, private caching, dependency patches | `3d2bff0`, `2b192ad` | Security regression suite and dependency audit pass; runtime pins verified as Authlib 1.7.2, yt-dlp 2026.7.4, requests 2.34.2, and python-dotenv 1.2.2 | API `sha256:3130c1b649126d5b5dcaf8e275af8212489b1fa313ace67211a34638fa4e3a1c`; health, authentication boundaries, protected event export, cache headers, and logs verified |
| Worker imports, rolling caption eligibility, dataclass defaults, graceful drain, and base-image security | `ce5c99f`, `d93d885` | Worker import, queue, lifecycle, recovery, GPU/runtime, and image-security checks pass | ingest-cuda `sha256:d1fcbf457d9bc1642f132bf83a8ed5323262a9dc238fe803761a5eac17ca0393`; idle drain exited 0 and restarted with a running/zero-active heartbeat. No pending production item was available for a caption/Whisper canary |
| Redis limiting, bounded metrics, OpenSearch TLS, health authorization, lifespan, GZip, and production overlay validation | `b5908ce`, `3053553` | Platform regression and fail-closed rendered-configuration suites pass | API health is healthy; public minimal health routes return 200, detailed health returns 401, and no unexpected production errors were observed |
| Event session-token schema contraction | `9490ce0`, `6371bd1`, `b3e865a` | The migration suite models the legacy production trigger and passes upgrade/downgrade validation | WAL-G backup `base_000000010000012B000000B6` completed at 2026-08-08 01:18:47Z; production is at `20260807_event_token`, both plaintext token columns are absent, and the legacy event trigger/function are absent |
| Formatting, typing, repository boundaries, worker module boundaries, CI, billing retirement, and Python SDK gate | `a869366`, `676617e`, `7a4024d`, `b221e65`, `671b4d2` | Ruff, Black, isort, backend and SDK mypy, 1,544 backend tests, 26 SDK tests, and 78% combined coverage pass | Role-selective API and ingest-cuda releases completed; frontend, diarization/ML, PostgreSQL, and Redis images were neither rebuilt nor restarted |

All backend findings are closed. The newly built API and ingest-cuda images have BuildKit provenance and zero HIGH/CRITICAL Trivy findings. Registry digests were re-pulled and verified after publication. Local release signing was unavailable, so the next CI release must attach the configured keyless signature before these digests are promoted as signed release candidates; unchanged reused roles retain their existing immutable digests.
