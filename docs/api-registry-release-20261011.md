# API registry release, October 11

This API-only release includes the merged anonymous search admission and mention-map cache, the preceding availability/title-search fixes and removal of unnecessary PostgreSQL indexing-backlog reads. It updates urllib3 to 2.8.0 after the selective release scan rejected 2.7.0.

The selected API image is built by the existing selective-release workflow, scanned for high/critical library vulnerabilities, signed and attested with provenance and SPDX SBOM. Unchanged ingestion, ML and PostgreSQL artifacts retain their digests and have signatures/attestations reverified. The frontend stays in its separate hasanara-web project. The signed selective artifact records the workflow source; the deployment manifest retains its strict schema and stores selective-release metadata separately as evidence.

The backend source pin advances to this release's source_commit. The inert frontend stub is removed. Anonymous concurrency two and PGOPTIONS statement_timeout=30000 are normal client-overlay settings. The obsolete local image overlay and apply helper are retired; historical build snapshots remain rollback evidence. bin/compose-prod deploy-api validates source/manifests/environment/mounts first and recreates only API. Database, ingestion, background services and the web container are not selected by that command. The deployed database already reports the source's latest Alembic revision, so no schema change is required for this rollout.

Private recovery inputs on Almaz are under /home/onnwee/.local/state/hasanara/registry-release-20261011. They contain the prior manifest, environment, client overlay, exact API inspection, source pins and image IDs. Preserve later source and configuration changes during rollback. Restore the preceding API Compose file set and local image only, retaining crawl restrictions and data mounts. Never use a broad stack down/up or downgrade the database to roll back this stateless API release.

Published release: https://git.subcult.tv/subculture-collective/rekolekt/releases/tag/backend-api-beb645fd765e

The pinned API specification changed since the old core source. The generated frontend TypeScript contract was refreshed and type-checking passed; this is a type-only source update, and the running web image remains unchanged. Clean preflight and public-safe deployment validation passed.

Deployment CI also found the existing source-map-js 1.2.1 high-severity advisory GHSA-68fv-2mgg-jv7q. The frontend lockfile now resolves 1.2.2; its security gate and build passed. This does not alter the published API image.
