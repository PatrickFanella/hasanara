# Clip exports

Select a transcript segment and choose **Start clip here**. Select the last
segment and choose **End clip here**. The passage panel lets you preview and
adjust the range. Clips are limited to two minutes.

Sign in and choose **Export and download**. The page checks progress and starts
the MP4 download automatically when it is ready. Keep the page open until it
starts. If your browser blocks it, choose **Download MP4 again**. A failed MP4 request stays on the page with a retry
action; it does not navigate away from the passage.

**Save range** stores both timestamps in your account's Saved moments. Reopen
the saved moment to regenerate the clip after its server copy expires. The range
stays saved independently of the temporary MP4. Saving a range does not download
media; exporting one does.

## Take a completed export to clpr

A completed, unexpired export offers **Download handoff JSON (v1)** and
**Copy handoff JSON** alongside **Download MP4 again**. The JSON comes directly
from Rekolekt's authenticated `GET /clips/{job_id}/handoff` endpoint. It includes
the exported range, recording, request-time transcript revision, caption cues
and the rendered MP4's hash and size. HasanAra does not reconstruct it from the
current transcript. The page shows missing caption timing, cues without end
times and captions shortened by the producer. Review those captions before use.

1. Download the MP4 and handoff JSON. If JSON download or clipboard access fails,
   select the read-only **Handoff JSON** field and copy it into a `.json` file.
2. Choose **Open clpr draft importer**, sign in there if needed, and select
   **Upload video** on clpr's submission page.
3. Choose the JSON under **Archive handoff (optional)** and review its source,
   range, transcript and captions. **Cancel** leaves the draft alone.
   **Use in draft** applies the import; **Replace draft** explicitly replaces
   existing draft content.
4. Select the downloaded MP4 separately under **Video File**. clpr checks its
   bytes against the handoff. Review and edit the draft and captions there.
   Importing is not submission or publication; explicit submission and normal
   moderation remain separate steps.

The clpr link is a fixed `https://clpr.tv/submit` URL with no query data, referrer
or opener access. HasanAra does not send private MP4 URLs, cookies or account
IDs to clpr. The JSON contains declared provenance, not proof of permission to
reuse the media. Downloaded files remain copies even after server expiry or
revocation.

Each JSON download/copy checks the producer again. Wrong-owner, disabled,
expired, revoked, removed-source and changed-output responses remove the
completed export actions and explain how to try again. Older exports without
captured provenance need a fresh export. Temporary request failures allow retry;
no draft or download success is claimed on a failed request. Range or account
changes discard the previous export and abort its in-flight export/download requests. Local
expiry removes the media and handoff actions without requiring a reload.

Passage links, copying, preview and sharing still work for guests and when
exports are disabled. They do not require an export or clpr account.

## Backend setup

Rekolekt must enable `CLIP_EXPORTS_ENABLED` and run a clip renderer with the same
private spool as the API. In `CLIP_EXPORT_SOURCE=original` mode, an operator must
register a creator-authorized local file and its owning account. Only that owner
can export it. See Rekolekt's `docs/product/authorized-original-clips.md`.

The existing `CLIP_EXPORT_SOURCE=youtube` mode uses yt-dlp to obtain a selected
section; see `docs/product/youtube-clips.md` for its setup and acquisition limits.
The default cache lifetime is one hour after successful rendering, configurable
through `CLIP_CACHE_TTL_SECONDS`. These frontend changes do not enable either
mode, install a production renderer/timer, acquire public media or submit to clpr.
The producer contract is documented in `core/docs/product/clip-handoff.md`.

## Verification

The required frontend gates are API type synchronization, dependency security,
ESLint, Prettier, Vitest coverage, production build, bundle budget and Chromium
browser tests in `.gitea/workflows/validate.yaml`. Run them with:

```sh
npm --prefix frontend run api:check
npm --prefix frontend run security:check
npm --prefix frontend run lint
npm --prefix frontend run format:check
npm --prefix frontend run test:coverage
npm --prefix frontend run build
npm --prefix frontend run bundle:check
cd e2e
npx playwright test tests/archive-smoke.spec.ts tests/transcript-highlighting.spec.ts --project=chromium --workers=1
```

Focused component tests cover completed handoff download/copy, intact producer
JSON, absent/untimed/truncated captions, invalid versions and ranges, legacy
exports, transfer failures, clipboard fallback, authorization failures, account
and range changes, late responses and expiry. The required browser suite covers
keyboard download, 320px reflow, range changes and unavailability while passage
links remain usable.

For the optional generated-original journey, use the procedure in
[`e2e/README.md`](../e2e/README.md). On November 9, 2026, it passed with pinned
Rekolekt `ec995c77ba71e7fba02c2c39017660b74973500b` and clpr
`7cc0f7b17a9624c5f09baa7c248b222fbd5b904c`. The generated 0.500–2.500 second
selection rendered a 2.000-second, 274,322-byte MP4. The browser downloaded it
and its handoff through the existing producer routes, checked the byte count
and SHA-256, imported the JSON into clpr's actual draft UI, exercised Cancel and
Use in draft, selected the MP4 and saw **Matches the archive handoff**. The
relative caption and canonical source link were retained; no submission request
occurred. The producer fixture replaces sessions and persistence with a fixed
test owner and SQLite; clpr API responses are mocked. This qualifies the local
handoff and review flow, not production authorization, creator rights,
submission/moderation or an activated renderer.
