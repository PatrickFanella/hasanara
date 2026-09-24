#!/usr/bin/env python3
"""Validate this deployment against its pinned core without production secrets.

Loads the public brand profile with the core loader, then renders the production
Compose model with inert values and applies the core release preflight's service,
diarization and external-network checks. Rendered configuration is never printed.
"""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parent.parent
CORE = ROOT / "core"
ROLE_VARIABLES = {
    "api": "HASANARA_API_IMAGE",
    "ingest-cuda": "HASANARA_INGEST_IMAGE",
    "ml-cuda": "HASANARA_ML_IMAGE",
    "frontend": "HASANARA_FRONTEND_IMAGE",
    "postgres-walg": "HASANARA_POSTGRES_IMAGE",
    "redis": "HASANARA_REDIS_IMAGE",
}
INERT_VALUES = {
    "DB_PASSWORD": "inert",
    "OAUTH_GOOGLE_REDIRECT_URI": "https://example.invalid/google",
    "OAUTH_TWITCH_REDIRECT_URI": "https://example.invalid/twitch",
    "WALG_S3_PREFIX": "s3://inert/prefix",
    "AWS_ACCESS_KEY_ID": "inert",
    "AWS_SECRET_ACCESS_KEY": "inert",
    "AWS_ENDPOINT": "https://example.invalid",
    "AWS_REGION": "auto",
    # The operator env file must set both flags explicitly; the preflight rejects omissions.
    "ARCHIVE_ENRICHMENT_ENABLED": "false",
    "ARCHIVE_ENRICHMENT_PUBLISH": "false",
}


def load_preflight() -> ModuleType:
    path = CORE / "scripts" / "release_preflight.py"
    if not path.is_file():
        raise SystemExit("core submodule is not checked out; run: git submodule update --init")
    spec = importlib.util.spec_from_file_location("release_preflight", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def validate_brand() -> None:
    sys.path.insert(0, str(CORE))
    from app.branding import load_brand_profile

    profile = load_brand_profile(str(ROOT / "branding" / "brand.json"))
    for field in ("logo_url", "favicon_url", "social_image_url"):
        url = getattr(profile, field, None)
        if url and url.startswith("/branding/"):
            if not (ROOT / "branding" / "assets" / url.removeprefix("/branding/")).is_file():
                raise SystemExit(f"brand asset is missing: {url}")


def render(preflight: ModuleType, *arguments: str) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        [*preflight.compose_command(CORE, ROOT), *arguments],
        cwd=ROOT,
        env=preflight.compose_environment(CORE, ROOT),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode:
        # Compose errors can echo interpolated values; report only the command shape.
        raise SystemExit(f"Compose failed: config {' '.join(arguments)}")
    return result


def validate_compose(preflight: ModuleType, scratch: Path) -> list[str]:
    images = {role: f"registry.invalid/hasanara/{role}@sha256:{'0' * 64}" for role in ROLE_VARIABLES}
    diarization_env = scratch / "diarization.env"
    diarization_env.write_text(
        "HF_TOKEN=inert\nDATABASE_URL=postgresql+psycopg://hasanara_diarization:inert@db:5432/transcripts\n",
        encoding="utf-8",
    )
    diarization_env.chmod(0o600)
    values = {
        **INERT_VALUES,
        **{variable: images[role] for role, variable in ROLE_VARIABLES.items()},
        "HASANARA_DIARIZATION_ENV_FILE": str(diarization_env),
    }
    env_file = scratch / "release.env"
    env_file.write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")
    os.environ["HASANARA_ENV_FILE"] = str(env_file)

    manifest = {"images": images, "services": preflight.SERVICE_ROLES}
    render(preflight, "config", "--quiet")
    services = {line for line in render(preflight, "config", "--services").stdout.splitlines() if line}
    preflight.validate_active_service_set(services)
    rendered = json.loads(render(preflight, "config", "--format", "json").stdout)
    preflight.validate_rendered_services(rendered, services, manifest)
    diarization = json.loads(render(preflight, "--profile", "diarization", "config", "--format", "json").stdout)
    preflight.validate_diarization_contract(diarization, manifest, ROOT)
    return preflight.external_networks(rendered)


def main() -> int:
    preflight = load_preflight()
    try:
        validate_brand()
        with tempfile.TemporaryDirectory() as scratch:
            networks = validate_compose(preflight, Path(scratch))
    except preflight.PreflightError as error:
        print(f"deployment validation failed: {error}", file=sys.stderr)
        return 1
    print(f"deployment validation passed; external networks required on the host: {', '.join(networks) or 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
