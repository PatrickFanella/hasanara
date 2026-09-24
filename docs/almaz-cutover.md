# Almaz cutover to the deployment layout

**Status:** not performed. Written 2026-09-24 from a read-only inspection of Almaz; recheck every observation before starting.

## Starting state (observed 2026-09-24)

- Production runs from `/mnt/spektr/server/projects/hasanara`, a full application checkout of this repository's old `main` at `311ddbe` (2026-09-10), with Compose project `hasanara`.
- That checkout has an uncommitted frontend healthcheck in `docker-compose.hasanara.yml` plus the backup `docker-compose.hasanara.yml.before-healthchecks-resume-20260924`. transcript-create `ec2418f` replaced it with a `HEALTHCHECK` in the frontend image, so the new overlay does not carry it.
- State lives inside the checkout: `docker-volumes/` (PostgreSQL and Redis data), `data/`, `cache/`, `backups/`, `deploy-backups/`, `evidence/`, and the operator files `.env.prod` and `.env.diarization`.
- Running images are digest-pinned `hasanara-*` release images from this repository's old release workflow. Their manifest `source_commit` is an old HasanAra commit, not a transcript-create commit, so the new preflight cannot accept them.

## Prerequisites

1. transcript-create includes the deployment-directory change, and a release candidate built from it has passed its release workflow. Keep that release's verified `release-images.json`.
2. This repository's `main` pins `core` at that release's `source_commit` and contains its `release-images.json`. CI passes.
3. A maintenance window is agreed, and nobody else is changing the Almaz stack. The healthcheck work above shows other sessions have been operating on it.

## Procedure

Run on Almaz as the owning user. `OLD=/mnt/spektr/server/projects/hasanara`, `NEW=/mnt/spektr/server/projects/hasanara-deploy`, and `ARCHIVE=/mnt/spektr/server/projects/hasanara-cutover-<UTC timestamp>`. All three must be on the same filesystem so that `mv` is a rename, not a copy. Check with `stat -c %d`.

1. **Record rollback evidence.** In `OLD`, record `git rev-parse HEAD`, `git status --short`, `git diff`, `docker compose ... images` through `scripts/compose_prod.sh images`, and every `HASANARA_*_IMAGE` value from `.env.prod`. Store them under `ARCHIVE` with mode 700.
2. **Back up.** Run the normal database backup, then `scripts/compose_prod.sh maintenance pitr-base-backup --approved`, and confirm with `pitr-list-backups`. Do not continue without a verified backup.
3. **Prepare the new checkout.** `git clone --recurse-submodules <this repository> "$NEW"`. In `NEW`, confirm `git -C core rev-parse HEAD` equals `release-images.json`'s `source_commit`, and run `scripts/validate.py`.
4. **Check the operator env file.** Search `OLD/.env.prod` for absolute paths under `OLD` and for keys the new overlay requires: `OAUTH_GOOGLE_REDIRECT_URI`, `OAUTH_TWITCH_REDIRECT_URI`, `HASANARA_DIARIZATION_ENV_FILE`, both enrichment flags, WAL-G settings, and the image variables. Update the image variables to the new manifest's digests. Keep a copy of the original under `ARCHIVE`.
5. **Stop the stack.** From `OLD`, stop every container in project `hasanara` (the guarded helper intentionally has no full-stop action; this step needs explicit operator approval). Confirm with `docker ps --filter label=com.docker.compose.project=hasanara`.
6. **Move state.** `mv` `docker-volumes`, `data`, `cache`, `backups`, `deploy-backups`, `evidence`, `.env.prod` and `.env.diarization` from `OLD` to `NEW`. Do not copy the database directory, and do not use symlinks: the preflight rejects symlinked mounts.
7. **Preflight and deploy.** In `NEW`: `bin/compose-prod preflight`, then `bin/compose-prod deploy`.
8. **Verify.** All containers are healthy. `/api/site` returns the HasanAra profile. Login, search, a VOD page, passage sharing and `/branding/logo.svg` work through `https://hasanara.tv`. `pitr-archive-status` shows WAL archiving resumed. Running image digests match `release-images.json`.
9. **Record.** Save the verification evidence under `ARCHIVE` and update the canonical Almaz host briefing in Ars Malefica.
10. **Retire the old path later.** After a soak period, move `OLD` into `ARCHIVE`. `NEW` can then be renamed to the old path during another brief stop, or proxies and scripts that name the path can be updated. Check the host briefing and any cron or systemd units for references first.

## Rollback

Before step 7 succeeds: stop anything started from `NEW`, `mv` the state directories and env files back to `OLD`, and restore the original `.env.prod` from `ARCHIVE`. Then run `scripts/compose_prod.sh deploy` from `OLD`, which still pins the previous image digests.

After new migrations have run, image rollback alone is not enough. Restore the database from the step 2 backup according to the core disaster-recovery runbook.
