"""Contracts for backend-only release artifact selection."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".gitea" / "workflows" / "backend-role-release.yaml"


def test_selective_release_only_accepts_api_or_ingest_worker():
    source = WORKFLOW.read_text(encoding="utf-8")

    assert "- api" in source
    assert "- ingest-cuda" in source
    assert '[[ "$ROLE" == api || "$ROLE" == ingest-cuda ]]' in source
    assert "Dockerfile.api" in source
    assert "Dockerfile.ingest.cuda" in source
    assert "frontend/Dockerfile" not in source
    assert "Dockerfile.cuda" not in source
    assert "Dockerfile.postgres-walg" not in source


def test_selective_release_revalidates_every_unchanged_first_party_digest():
    source = WORKFLOW.read_text(encoding="utf-8")

    assert "base_manifest_json" in source
    assert "reused-images.txt" in source
    assert 'cosign verify --key cosign.pub "$image"' in source
    assert 'cosign verify-attestation --key cosign.pub --type slsaprovenance "$image"' in source
    assert 'cosign verify-attestation --key cosign.pub --type spdxjson "$image"' in source
    assert 'manifest["images"][os.environ["ROLE"]]' in source
    assert '"reused_artifacts_reverified": True' in source


def test_selected_digest_is_scanned_signed_attested_and_uploaded():
    source = WORKFLOW.read_text(encoding="utf-8")

    assert "--severity CRITICAL,HIGH --pkg-types library --exit-code 1" in source
    assert '"builder": {"id":' in source
    assert 'cosign sign --yes --key env://COSIGN_PRIVATE_KEY "$IMAGE_REF"' in source
    assert "--type slsaprovenance --predicate selected.provenance.json" in source
    assert "--type spdxjson --predicate selected.spdx.json" in source
    assert "release-images.json" in source
