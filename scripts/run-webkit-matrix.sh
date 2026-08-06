#!/usr/bin/env bash
set -Eeuo pipefail

E2E_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
REPOSITORY_ROOT="$(cd -- "${E2E_ROOT}/.." && pwd -P)"
PLAYWRIGHT_VERSION="$(${E2E_ROOT}/node_modules/.bin/playwright --version | awk '{print $2}')"
PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"
RUN_AS_USER="$(id -u):$(id -g)"

exec docker run \
  --rm \
  --init \
  --ipc=host \
  --user "${RUN_AS_USER}" \
  --volume "${REPOSITORY_ROOT}:/work" \
  --workdir /work/e2e \
  "${PLAYWRIGHT_IMAGE}" \
  npx playwright test tests/archive-smoke.spec.ts \
  --project=webkit \
  --project='Mobile Safari' \
  "$@"
