> For the product overview, see the [README](README.md).

# HasanAra deployment

This repository deploys [HasanAra](https://hasanara.tv), a searchable archive of HasanAbi broadcasts. It contains no application code. The application is [transcript-create](https://git.subcult.tv/subculture-collective/transcript-create), pinned here as the `core` submodule, and runs from that project's released, digest-pinned images.

| Path | Purpose |
| --- | --- |
| `core/` | transcript-create at the deployed release's `source_commit` |
| `docker-compose.client.yml` | HasanAra overlay: origins, OAuth callback requirements, Almaz port bindings, `management` and `dev` networks, HasanAbi VOD channels, and brand mounts |
| `branding/brand.json`, `branding/assets/` | Public brand profile and Piker Broadcasting Service artwork (`logo.svg`, `favicon.svg`, `badge.svg`, `social-card.svg`) |
| `release-images.json` | The deployed release manifest. It is added when a core release is adopted |
| `bin/compose-prod` | Runs the core's guarded production helper for this directory |
| `scripts/operational-alerts.py` | [Operator email alerts](docs/operational-email.md) for availability and recovery |
| `scripts/validate.py` | Validates the profile and overlay against the pinned core without secrets |

## Where changes go

- Application behavior, shared production services, release tooling and the preflight contract belong in transcript-create. Merge them there, cut a release, then adopt it here.
- HasanAra identity, domains, channel sources, host bindings and artwork belong here.
- Secrets stay in the ignored `.env.prod` and diarization env file on the host. Both repositories are public.

Do not copy core files into this repository or apply core fixes here.

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

The validator renders the full production Compose model with inert values and applies the core preflight's service, diarization and network checks. CI runs it on every pull request.

## Adopt a core release

1. Merge the change in transcript-create and publish a release candidate there. Keep its verified `release-images.json`.
2. Here, check out that release's `source_commit` in `core`, commit the new submodule pointer together with the new `release-images.json`, and open a pull request.
3. After merge, on the host: `git pull --recurse-submodules`, then `bin/compose-prod preflight` and `bin/compose-prod deploy`.

The preflight fails unless both trees are clean, the core checkout matches the manifest's `source_commit`, and every rendered image matches the manifest. See the core [client branding guide](core/docs/deployment/client-branding.md#production-deployment-layout) for the layout contract, and [the Almaz cutover runbook](docs/almaz-cutover.md) for moving the running installation to this layout.

https://www2.onnwee.me
