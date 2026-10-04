# Adopting the first backend-only core release

**Status:** prepared 2026-10-04, not yet run. Run it after the owner publishes the first Rekolekt release whose `release-images.json` has no `frontend` role. Only the owner starts Rekolekt release workflows.

HasanAra already serves its own web image (`web-image.json`) from its own Compose project, `hasanara-web`, so the core `hasanara` project has no web container and the old core `hasanara-web` container is gone. This adoption changes only backend images: it moves `core` from `19124a7` to the release's `source_commit`, takes every backend image from that release's manifest, and replaces the October 3 incident API image (`sha256:7ad07c3a…`, Rekolekt PR 48 applied by hand) with the released API.

The core API serves at the root (`/site`, `/videos`, `/search/...`); Caddy's `handle_path /api/*` strips the prefix before `hasanara-api:8000`. Leave that edge routing unchanged.

Two conditions from October 3 still apply on Almaz until someone changes them:

- The Almaz CUDA worker is stopped because its GTX 1080 is unusable. Kvant runs ingestion (`hasanara-kvant-worker.service`). `bin/compose-prod deploy` would start the Almaz worker, so the steps below recreate services individually and never start `worker`.
- `hasanara-api` runs the incident image. A release that includes PR 48 replaces it.

Variables used throughout:

```bash
TAG=v0.1.0-rc.NN                                   # the backend-only release
DEPLOY=/mnt/spektr/server/projects/hasanara-deploy  # on Almaz
```

## 1. Prepare the adoption pull request (workstation)

```bash
git clone --recurse-submodules https://git.subcult.tv/subculture-collective/hasanara.git /tmp/hasanara-adopt
cd /tmp/hasanara-adopt
git switch -c adopt/core-$TAG

# The release manifest: a release asset when the release was a tag push,
# otherwise the release-evidence artifact of the release run.
tea api --login subcult-agent /repos/subculture-collective/rekolekt/releases/tags/$TAG \
  | python3 -c 'import json, sys; print(next(a["browser_download_url"] for a in json.load(sys.stdin)["assets"] if a["name"] == "release-images.json"))' \
  | xargs curl -fsSL -o release-images.json
python3 -c 'import json; m = json.load(open("release-images.json")); print(m["source_commit"]); print(sorted(m["images"]))'
# Expect no "frontend" role.

COMMIT=$(python3 -c 'import json; print(json.load(open("release-images.json"))["source_commit"])')
git -C core fetch origin
git -C core checkout "$COMMIT"
git -C core log --oneline 19124a7..HEAD | grep -i 'database pressure'      # PR 48 must be in range
git -C core diff --stat 19124a7 HEAD -- alembic/versions worker            # schema or worker changes? (step 3)

# The core preflight now rejects services outside its manifest: delete the inert
# frontend stub (the commented "frontend: scale: 0" block at the end of the file).
python3 - <<'PY'
from pathlib import Path
p = Path("docker-compose.client.yml"); s = p.read_text()
i = s.index("    # HasanAra's web container runs in its own Compose project")
p.write_text(s[:i].rstrip("\n") + "\n")
PY

npm ci --prefix frontend
npm --prefix frontend run api:check || npm --prefix frontend run api:generate   # review any type change
python3 -m venv .validate-venv && .validate-venv/bin/pip install -q -c core/constraints.txt pydantic
.validate-venv/bin/python scripts/validate.py
python3 -B scripts/web_manifest.test.py
```

On 2026-10-04 this check was rehearsed against Rekolekt `5d71685`: with the stub `validate.py` fails at `config --quiet`; without it, validation passes. `HASANARA_FRONTEND_IMAGE` in `.env.prod` becomes unused and may be deleted after the deploy.

If the API types changed and frontend code had to change, merge, let the web image workflow publish, record the new image (`scripts/web_manifest.py record …`) in a follow-up, and deploy it with `bin/compose-prod deploy-web` after the backend.

```bash
git add core release-images.json docker-compose.client.yml frontend/src/types/generated/api.ts
git commit -m "deploy: adopt Rekolekt $TAG backend images"
git push -u origin adopt/core-$TAG
tea pr create --login subcult-agent --repo subculture-collective/hasanara --head adopt/core-$TAG --base main --title "deploy: adopt Rekolekt $TAG"
# Merge only when hosted CI is green:
tea pr merge --login subcult-agent --repo subculture-collective/hasanara <number>
```

## 2. Record pre-deploy state (Almaz)

```bash
cd $DEPLOY
ev=deploy-backups/core-adoption-$(date -u +%Y%m%dT%H%M%SZ); mkdir -m 700 -p $ev
git rev-parse HEAD > $ev/deploy-head; git -C core rev-parse HEAD > $ev/core-head
install -m 600 .env.prod $ev/env.prod.before
docker ps -a --filter label=com.docker.compose.project=hasanara \
  --format '{{.Names}} {{.Image}} {{.Status}}' > $ev/containers.before
for c in $(docker ps -aq --filter label=com.docker.compose.project=hasanara); do
  docker inspect --format '{{.Name}} {{.Image}} {{.State.StartedAt}}' "$c"; done > $ev/image-ids.before
docker exec hasanara-db psql -U postgres -d transcripts -Atc 'SELECT version_num FROM alembic_version' > $ev/alembic.before
for q in people trump; do
  curl -s -o /dev/null -w "$q %{http_code} %{time_total}\n" --max-time 120 \
    "https://hasanara.tv/api/search/grouped?q=$q&limit=20&offset=0"; done | tee $ev/search.before
curl -s https://hasanara.tv/api/health | tee $ev/health.before
bin/compose-prod maintenance pitr-base-backup --approved
bin/compose-prod maintenance pitr-list-backups --approved | tail -3 | tee $ev/pitr.before
```

## 3. Kvant worker (Kvant)

If step 1 showed changes under `alembic/versions` or `worker`, drain the Kvant worker before migrations run, and rebuild it from the new core source afterwards (step 6):

```bash
systemctl --user stop hasanara-kvant-worker.service      # allows ten minutes to finish an active job
systemctl --user is-active hasanara-kvant-worker.service  # expect inactive
```

Otherwise leave it running.

## 4. Deploy backend images without starting the Almaz worker (Almaz)

```bash
cd $DEPLOY
git pull --recurse-submodules
# Point the backend image variables at the new manifest; other lines are kept.
python3 - <<'PY'
import json
from pathlib import Path
variables = {"api": "HASANARA_API_IMAGE", "ingest-cuda": "HASANARA_INGEST_IMAGE", "ml-cuda": "HASANARA_ML_IMAGE",
             "postgres-walg": "HASANARA_POSTGRES_IMAGE", "redis": "HASANARA_REDIS_IMAGE"}
images = json.load(open("release-images.json"))["images"]
env = Path(".env.prod"); lines = env.read_text().splitlines(keepends=True); seen = []
for i, line in enumerate(lines):
    key = line.split("=", 1)[0]
    for role, variable in variables.items():
        if key == variable:
            lines[i] = f"{variable}={images[role]}\n"; seen.append(variable)
assert sorted(seen) == sorted(variables.values()), "missing or repeated image variable"
tmp = env.with_name(".env.prod.tmp"); tmp.write_text("".join(lines)); tmp.chmod(0o600); tmp.replace(env)
print("updated", ", ".join(sorted(seen)))
PY
bin/compose-prod preflight
bin/compose-prod web-preflight     # the web project is unchanged and still valid

guarded() { TRANSCRIPT_DEPLOY_ROOT=$DEPLOY bash -c 'source core/scripts/compose_prod.sh && run_preflight && compose "$@"' _ "$@"; }
guarded up -d --no-deps --no-build --pull always migrations
docker wait hasanara-migrations                          # expect 0
guarded up -d --no-deps --no-build --pull always api analytics-retention summary-refresher \
  archive-intelligence-refresher archive-enrichment-queue
```

If `postgres-walg` or `redis` digests changed (compare `$ev/env.prod.before` with `.env.prod`), recreating `db`, `backup` or `redis` restarts the database or cache. That needs a separate, agreed maintenance window: `guarded up -d --no-deps --no-build --pull always db backup redis`.

## 5. Verify (outside and on Almaz)

```bash
docker ps -a --filter name=hasanara-worker --format '{{.Names}} {{.Status}}'   # still Exited
docker inspect --format '{{.Name}} {{.Config.Image}} {{.State.Health.Status}}' hasanara-api hasanara-web
grep -E '^HASANARA_API_IMAGE=' .env.prod                                     # equals hasanara-api's Config.Image
curl -s -o /dev/null -w '%{http_code} %{time_total}\n' https://hasanara.tv/api/health
curl -s -o /dev/null -w '%{http_code} %{time_total}\n' https://hasanara.tv/api/archive/summary
for i in 1 2 3; do
  curl -s -o /dev/null -w "people %{http_code} %{time_total}\n" --max-time 120 \
    'https://hasanara.tv/api/search/grouped?q=people&limit=20&offset=0'; done
curl -s https://hasanara.tv/ | grep -F 'Search HasanAbi broadcasts by phrase. Every result opens at the timestamp.'
curl -s https://hasanara.tv/social-preview.png | sha256sum   # unchanged; the web container was not touched
docker inspect --format '{{.State.StartedAt}}' hasanara-web     # unchanged start time
bin/compose-prod logs --since 15m api migrations summary-refresher 2>&1 | grep -iE 'error|traceback|timeout' | head
bin/compose-prod maintenance pitr-archive-status --approved
```

Search for "people" must return 200 well under the frontend's ten-second request timeout; on October 3 it timed out at 90 s. Open search, an episode, about and support in a browser in both editions. Dozor's operational alert monitor should record two healthy scheduled checks.

## 6. Kvant worker after the deploy (Kvant)

If the worker was drained in step 3, rebuild its image from the new core source with the Kvant worker sources (`deploy/kvant-worker/`, deployment worktree commit `859fcb0`; see Machinum's HasanAra GPU failure report), then:

```bash
systemctl --user start hasanara-kvant-worker.service
systemctl --user status hasanara-kvant-worker.service --no-pager | head -5
docker logs --since 10m hasanara-kvant-worker 2>&1 | tail -20       # heartbeat and no schema errors
```

If it was not drained, check that it is still active and heartbeating with the same commands.

## 7. Rollback (Almaz)

Without new migrations (`alembic_version` equals `$ev/alembic.before`):

```bash
cd $DEPLOY
git switch --detach "$(cat $ev/deploy-head)" && git submodule update --init
install -m 600 $ev/env.prod.before .env.prod
guarded() { TRANSCRIPT_DEPLOY_ROOT=$DEPLOY bash -c 'source core/scripts/compose_prod.sh && run_preflight && compose "$@"' _ "$@"; }
guarded up -d --no-deps --no-build --pull never api analytics-retention summary-refresher \
  archive-intelligence-refresher archive-enrichment-queue
# Restore the October 3 incident API image (PR 48 by hand). Its helper refuses to
# overwrite an existing receipt, so set the earlier receipt aside first.
mv ~/.local/state/hasanara/availability-20261003/api.before.json \
   ~/.local/state/hasanara/availability-20261003/api.before.$(date -u +%Y%m%dT%H%M%SZ).json
python3 ~/.local/state/hasanara/availability-20261003/apply.py --apply
git switch main   # once the cause is fixed and main is redeployable
```

With new migrations, image rollback alone is not enough: restore the database from the step 2 base backup following the core disaster-recovery runbook, then roll back the images as above. Record the outcome in Machinum's HasanAra reports.
