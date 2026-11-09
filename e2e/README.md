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

## Generated clip handoff qualification

The normal suite mocks clip responses and uses the producer's committed v1
example. An optional run uses generated media and the pinned core's real clip
routes, registration, transcript snapshot and ffmpeg renderer. It never starts
the production application or downloads public media.

From the HasanAra root, run `python e2e/fixtures/clip-export-api.py` in a Python
environment with the pinned core's runtime dependencies installed. It requires
ffmpeg/ffprobe, binds only `127.0.0.1:41861` and keeps its SQLite database, original
and spool in a temporary directory. Stop it after testing; the temporary files
are removed on normal exit. This fixture substitutes a fixed owner for session
authentication and SQLite for the application database.

In another terminal, run:

```sh
cd e2e
CLIP_FIXTURE_API=http://127.0.0.1:41861 \
CLIP_FIXTURE_OUTPUT=../output/issue60 \
PLAYWRIGHT_PORT=41860 \
npx playwright test tests/archive-smoke.spec.ts --project=chromium --workers=1 \
  -g 'completed passage exports'
```

The browser requests the existing export, downloads both files, verifies the
MP4 hash/size and saves them under the ignored `output/issue60` directory. This
run uses a completed cached export; component tests separately cover polling
queued/running jobs. Both entry points require the selected range to match the
handoff exactly.

To include clpr's real draft UI, start a separate clpr checkout's frontend on
`127.0.0.1:41862`, then add `CLPR_FIXTURE_URL=http://127.0.0.1:41862` to the same
command. The test mocks clpr's API and uses its actual importer and digest
validation. It reviews/cancels the import, applies it to a draft, explicitly
selects the generated MP4, checks the caption/source link and asserts there was
no submission request. It saves `clpr-draft-review.png` with the two files. It
never presses Submit or contacts production clpr. Record the tested clpr commit
with the result, since this optional checkout is outside HasanAra's dependency
pin.
