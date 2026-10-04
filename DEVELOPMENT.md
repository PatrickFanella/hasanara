> For the product overview, see the [README](README.md).

# HasanAra deployment

This repository builds and deploys [HasanAra](https://hasanara.tv), a searchable archive of HasanAbi broadcasts. It owns HasanAra's web frontend. The backend is [Rekolekt](https://git.subcult.tv/subculture-collective/rekolekt) (formerly transcript-create), a headless core pinned here as the `core` submodule, and runs from that project's released, digest-pinned backend images.

| Path | Purpose |
| --- | --- |
| `core/` | Rekolekt at the deployed release's `source_commit` |
| `frontend/`, `e2e/` | HasanAra's web frontend and its browser tests, imported from Rekolekt `19124a7` ([provenance](frontend/SOURCE.md)) |
| `docker-compose.client.yml` | HasanAra overlay for the core `hasanara` project: origins, OAuth callback requirements, Almaz port bindings, `management` and `dev` networks, HasanAbi VOD channels, and brand mounts. Its `frontend` entry is an inert stub (`scale: 0`) that the core `19124a7` preflight requires |
| `docker-compose.web.yml` | HasanAra's web container in its own Compose project, `hasanara-web`: container `hasanara-web` on the `management` network, `10.0.0.200:5173`, brand mounts |
| `branding/brand.json`, `branding/assets/` | Public brand profile and Piker Broadcasting Service artwork (`logo.svg`, `favicon.svg`, `badge.svg`, `social-card.svg`) |
| `branding/social-card.source.svg` | Editable social card with live text. `branding/assets/social-card.svg` is its outlined export |
| `release-images.json` | The deployed core release manifest, copied unchanged when a core release is adopted. Backend images come from here |
| `web-image.json` | HasanAra's web image: digest, source commit and `frontend/` tree. Written by the web image workflow |
| `bin/compose-prod` | Runs the core's guarded production helper for this directory; `web-preflight`, `deploy-web` and `web` manage the web project |
| `scripts/operational-alerts.py` | [Operator email alerts](docs/operational-email.md) for availability and recovery |
| `scripts/validate.py` | Validates the profile, overlay and web project against the pinned core without secrets |

## Where changes go

- The web frontend belongs here: pages, styles, client code, the nginx serving config and the web image. The owner decided that Rekolekt becomes a headless core and each archive owns its whole frontend.
- Backend behavior, shared production services, backend release tooling and the preflight contract belong in Rekolekt. Merge them there, cut a release, then adopt it here.
- HasanAra identity, domains, channel sources, host bindings and artwork belong here.
- Secrets stay in the ignored `.env.prod` and diarization env file on the host. Both repositories are public.

Apart from the frontend import, do not copy core files into this repository or apply backend fixes here.

## Frontend

```bash
npm ci --prefix frontend && npm ci --prefix e2e
npm --prefix frontend run dev            # proxies /api to VITE_API_PROXY_TARGET (default http://localhost:41177)
npm --prefix frontend run api:check      # generated types match core/docs/api/openapi.json
npm --prefix frontend run lint && npm --prefix frontend run type-check && npm --prefix frontend run test:coverage
npm --prefix frontend run build && npm --prefix frontend run bundle:check && npm --prefix frontend run security:check
(cd e2e && npx playwright test tests/archive-smoke.spec.ts --project=chromium)
```

The app reads the brand profile from `/api/site` at runtime. When the container starts, `frontend/scripts/render-site-metadata.py` writes the crawler title, description and social tags into `index.html` and rasterizes `/social-preview.png` from the profile's `social_image_url`. After adopting a core release, run `npm --prefix frontend run api:generate` if the core's OpenAPI document changed.

CI builds the image on every pull request and smoke-tests it with `scripts/web_image_smoke.sh`. A merge to `main` that changes `frontend/` runs the web image workflow (`.gitea/workflows/web-image.yaml`) on the release runner: it builds, scans, pushes `git.subcult.tv/subculture-collective/hasanara-web:web-<commit>`, signs the digest with this repository's Cosign key, attests provenance and SBOM, and uploads `web-image.json`. Record it in a pull request:

```bash
python3 scripts/web_manifest.py record git.subcult.tv/subculture-collective/hasanara-web@sha256:<digest> <built commit>
```

The deploy checks refuse a `web-image.json` whose `frontend_tree` differs from the checked-out `frontend/`.

## Social card

The frontend image rasterizes `social-card.svg` with only DejaVu fonts installed, so the served file has its text converted to outlines. Edit `branding/social-card.source.svg`, then export it with the HasanAra pack fonts from SUBCULT Studio (Newsreader, Inter Tight; `branding/2026-10-01-packs/brands/hasanara/fonts`):

```bash
printf '<?xml version="1.0"?><fontconfig><dir>%s</dir><cachedir>/tmp/hasanara-fc</cachedir></fontconfig>' \
  /path/to/subcult-studio/branding/2026-10-01-packs/brands/hasanara/fonts > /tmp/hasanara-fonts.conf
FONTCONFIG_FILE=/tmp/hasanara-fonts.conf inkscape --export-text-to-path --export-plain-svg \
  --export-filename=branding/assets/social-card.svg branding/social-card.source.svg
```

Check the result with `rsvg-convert --width 1200 --height 630`, then restart the frontend so `/social-preview.png` is regenerated.

## Checkout

```bash
git clone --recurse-submodules <this repository>
git submodule update --init   # for an existing clone
```

## Validate

```bash
python3 -m venv .validate-venv
.validate-venv/bin/pip install -c core/constraints.txt pydantic
.validate-venv/bin/python scripts/validate.py
```

The validator renders the full production Compose model with inert values and applies the core preflight's service, diarization and network checks. It also checks `web-image.json`, renders the web project, and reports when `frontend/` has changed since the recorded web image was built. CI runs it, `scripts/web_manifest.test.py` and the frontend checks on every pull request.

## Adopt a core release

1. Merge the change in Rekolekt and publish a release candidate there. Keep its verified `release-images.json`.
2. Here, check out that release's `source_commit` in `core`, save its manifest unchanged as `release-images.json`, and run `npm --prefix frontend run api:check` (regenerate the types with `api:generate` if the API changed). Commit the submodule pointer with the manifest, and open a pull request.
3. After merge, on the host: `git pull --recurse-submodules`, then `bin/compose-prod preflight` and `bin/compose-prod deploy`.

For the first backend-only release, follow [the prepared adoption steps](docs/backend-only-core-adoption.md) instead: they keep the stopped Almaz worker stopped and replace the October 3 incident API image.

The core preflight fails unless both trees are clean, the core checkout matches the manifest's `source_commit`, and every rendered image matches the manifest. It covers the `hasanara` project only; the web container is outside it. See the core [client branding guide](core/docs/deployment/client-branding.md#production-deployment-layout) for the layout contract, and [the Almaz cutover runbook](docs/almaz-cutover.md) for moving the running installation to this layout.

## Deploy the web image

The web container runs in its own Compose project, `hasanara-web`, outside the core `hasanara` project that the core release preflight validates. Core is headless: from Rekolekt `5d71685` on, its preflight accepts only the services in its manifest. Caddy proxies `hasanara.tv` to `hasanara-web:80` on the `management` network (through `umami-site-proxy`) and strips `/api` before proxying to `hasanara-api:8000`; the container name, network and host port stay as they were.

```bash
git pull --recurse-submodules
bin/compose-prod web-preflight
bin/compose-prod deploy-web
```

`web-preflight` checks that `web-image.json` names a `hasanara-web` digest built from the checked-out `frontend/` tree, that the web inputs are committed, that the web project renders that image with the container name `hasanara-web`, that its external network exists, and that the project has no other containers. `deploy-web` runs it and the core preflight, pulls the image, removes a `hasanara-web` container that belongs to another Compose project (the core `frontend` service before this layout), starts the web project and waits for the container to report healthy. It does not touch the database, API, worker or other services. The image comes from `web-image.json`; `.env.prod` is not read. The container regenerates `/social-preview.png` when it starts. `bin/compose-prod web ps|logs|images|config` inspects the project.

https://www2.onnwee.me
