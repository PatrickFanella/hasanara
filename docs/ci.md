# CI and web image publishing

`.gitea/workflows/validate.yaml` owns validation and publication. Main's existing required context, `Deployment validation / validate (pull_request)`, is the final validation result. It requires every applicable job to succeed; deliberate skips are accepted only for inputs that did not change.

The deployment contract runs on every PR and main push. `scripts/ci_plan.py` compares the event's base and head trees, including the complete push range. Missing initial-push bases and manual runs select all checks. Frontend, E2E and pinned-core inputs select frontend checks. Frontend, Docker-context, branding and smoke inputs select container checks. CI changes exercise both. Tests for selection and failure propagation run in the contract job.

Frontend checks retain API compatibility, lint, formatting, dependency security, coverage thresholds, production build/bundle budget and the Chromium archive smoke suite. Build includes TypeScript checking. The security gate runs before the longer tests. Chromium tests use mocked APIs and the development server; the container smoke separately verifies production nginx, site metadata and branding assets.

On main, image-source changes select the publisher instead of a second container-validation build. Publication needs successful validation of that exact commit, then builds and smoke-tests the image once, scans it, pushes it, signs and attests its digest, and verifies the signature and attestations. Branding-only changes still test the existing image/profile contract without publishing an unchanged image source. PRs never publish. Superseded PR frontend/image jobs can be cancelled; publication is not cancelled by that setting.

For a manual web release, dispatch `validate.yaml` on main using the configured `RELEASE_OPERATOR`. It runs the validation checks before publication. The former independent `web-image.yaml` entry point is retired. The result is an immutable published image and evidence artifact; recording `web-image.json` and deploying remain separate operations.

Coverage thresholds remain 65% lines/functions/statements and 50% branches. CI emits the consumed text report. npm auditing includes build/development dependencies; container scanning inspects the final runtime image. Both remain in place. The existing informational OS-vulnerability policy is unchanged.

Before changing job selection or required checks, verify documentation-only skips, relevant frontend/core/branding changes, failure propagation and the main publishing dependency on the installed Gitea runner. Do not interpret an intentionally skipped irrelevant job as evidence that its tests ran.
