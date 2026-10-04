#!/usr/bin/env bash
# Smoke-test a built web image with HasanAra's brand profile, without network
# access or bind mounts (CI jobs talk to the host Docker daemon, where job
# workspace paths do not exist).
#
#   scripts/web_image_smoke.sh IMAGE
#
# Checks: the crawler-metadata unit tests pass inside the runtime image; the
# container becomes healthy; the served shell carries the HasanAra title,
# description and social tags; /social-preview.png is a 1200x630 PNG; brand
# assets are served.
set -Eeuo pipefail

image=${1:?usage: scripts/web_image_smoke.sh IMAGE}
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
tests='' smoke=''
cleanup() {
    [[ -z $tests ]] || docker rm -f "$tests" >/dev/null 2>&1 || true
    [[ -z $smoke ]] || docker rm -f "$smoke" >/dev/null 2>&1 || true
}
trap cleanup EXIT

tests=$(docker create --network none -w /tmp --entrypoint python3 "$image" \
    -B -m unittest discover -s frontend/scripts -p 'test_*.py')
docker cp "$root/frontend" "$tests:/tmp/frontend"
docker start --attach "$tests"

smoke=$(docker create --network none \
    -e SITE_PROFILE_PATH=/tmp/branding/brand.json -e FRONTEND_ORIGIN=https://hasanara.tv "$image")
docker cp "$root/branding" "$smoke:/tmp/branding"
docker cp "$root/branding/assets" "$smoke:/usr/share/nginx/html/branding"
docker start "$smoke" >/dev/null

deadline=$((SECONDS + 90))
until [[ $(docker inspect --format '{{.State.Health.Status}}' "$smoke") == healthy ]]; do
    if ((SECONDS > deadline)) || [[ $(docker inspect --format '{{.State.Status}}' "$smoke") != running ]]; then
        docker logs "$smoke" >&2 || true
        printf '%s\n' 'web container did not become healthy' >&2
        exit 1
    fi
    sleep 2
done

fetch() { docker exec "$smoke" wget -q -O - "http://127.0.0.1$1"; }
shell=$(fetch /)
description=$(python3 -c 'import html, json, sys; print(html.escape(json.load(open(sys.argv[1]))["description"]))' "$root/branding/brand.json")
for expected in \
    '<title>HasanAra</title>' \
    "<meta name=\"description\" content=\"$description\" />" \
    '<meta property="og:title" content="HasanAra" />' \
    '<meta property="og:url" content="https://hasanara.tv/" />' \
    '<meta property="og:image" content="https://hasanara.tv/social-preview.png" />' \
    '<meta name="twitter:card" content="summary_large_image" />'; do
    if [[ $shell != *"$expected"* ]]; then
        printf 'served shell lacks: %s\n' "$expected" >&2
        exit 1
    fi
done

fetch /social-preview.png | python3 -c '
import struct, sys
png = sys.stdin.buffer.read()
assert png[:8] == b"\x89PNG\r\n\x1a\n", "social preview is not a PNG"
assert struct.unpack(">II", png[16:24]) == (1200, 630), "social preview is not 1200x630"
'
for asset in /branding/logo.svg /branding/favicon.svg /favicon.ico /healthz; do
    fetch "$asset" >/dev/null
done
printf 'web image smoke test passed: %s\n' "$image"
