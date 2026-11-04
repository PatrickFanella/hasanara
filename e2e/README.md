# Seeded browser tests

**Status:** shipped test guidance (2026-07-12).

Playwright exercises the current archive flows with deterministic API fixtures. Chromium is required on each change; Firefox, WebKit, Mobile Chrome, and Mobile Safari run nightly and before release.

```bash
npm ci
npm run test:critical
npm run test:mobile
```

Current scenarios cover anonymous search, archive timeline/library navigation, every-mention playback queues, and topic intelligence evidence/empty states. Add browser coverage with each new user workflow. Billing and PWA scenarios are intentionally absent because those products are disabled.

The suite mocks the API, so it needs no database. For manual testing against a real core API, `npm run seed-db` inserts two completed VODs with transcripts and three accounts (one admin) into the PostgreSQL database named by `DATABASE_URL` (the core's own `postgresql+psycopg://` form is accepted); the database must have the pinned core's migrations applied. `npm run seed-db clean` removes those rows again. The fixtures in `fixtures/` follow the pinned core's schema.
