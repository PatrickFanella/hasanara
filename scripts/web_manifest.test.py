"""Tests for the web image manifest and the bin/compose-prod web commands.

Run with: python3 -B scripts/web_manifest.test.py
"""

import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("web_manifest", SCRIPTS / "web_manifest.py")
web_manifest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web_manifest)

OWN_WEB = "git.subcult.tv/subculture-collective/hasanara-web@sha256:" + "2" * 64
CORE_WEB = "git.subcult.tv/subculture-collective/hasanara-frontend@sha256:" + "1" * 64

# Stand-in for core/scripts/compose_prod.sh: logs what the wrapper asked for.
FAKE_HELPER = """#!/usr/bin/env bash
printf 'helper %s\\n' "$*" >> "$FAKE_STATE/calls.log"
exit "$(cat "$FAKE_STATE/helper-status" 2>/dev/null || echo 0)"
"""

# Stand-in for docker. Compose rendering echoes the image it was given, so the
# tests see what bin/compose-prod injected; state files drive the other answers.
FAKE_DOCKER = r"""#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
state = Path(STATE)
args = sys.argv[1:]
def log(line):
    with open(state / "calls.log", "a") as handle:
        handle.write(line + "\n")
if args[0] == "compose":
    if "config" in args:
        override = state / "rendered-image"
        image = override.read_text().strip() if override.exists() else os.environ["HASANARA_WEB_IMAGE"]
        print(json.dumps({
            "name": "hasanara-web",
            "networks": {"management": {"name": "management", "external": True}},
            "services": {"frontend": {"image": image, "container_name": "hasanara-web"}},
        }))
    else:
        words = " ".join(a for a in args[1:] if not a.startswith("/"))
        log("compose " + words + " image=" + os.environ.get("HASANARA_WEB_IMAGE", ""))
elif args[:2] == ["network", "inspect"]:
    sys.exit(0)
elif args[0] == "ps":
    print((state / "web-project-services").read_text() if (state / "web-project-services").exists() else "")
elif args[:2] == ["container", "inspect"]:
    container = state / "container"
    if not container.exists():
        sys.exit(1)
    owner, image = container.read_text().split()
    if "com.docker.compose.project" in args[3]:
        print(owner, image)
    else:
        print("running/healthy")
elif args[:2] in (["container", "stop"], ["container", "rm"]):
    log(" ".join(args[:2]) + " " + args[-1])
else:
    sys.exit(f"unexpected docker call: {args}")
"""


def git(root, *arguments):
    return subprocess.run(
        ["git", *arguments], cwd=root, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    ).stdout.strip()


def commit_all(root, message):
    git(root, "add", "-A")
    git(
        root,
        *("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false"),
        *("commit", "-q", "-m", message),
    )
    return git(root, "rev-parse", "HEAD")


class Deployment:
    """A throwaway deployment checkout with a fake core helper and fake docker."""

    def __init__(self, directory):
        base = Path(directory)
        self.root = base / "deploy"
        self.state = base / "state"
        self.state.mkdir()
        (self.root / "core" / "scripts").mkdir(parents=True)
        (self.root / "core" / "scripts" / "compose_prod.sh").write_text(FAKE_HELPER, encoding="utf-8")
        for directory_name in ("frontend", "branding", "bin", "scripts"):
            (self.root / directory_name).mkdir(exist_ok=True)
        (self.root / "frontend" / "index.html").write_text("<!doctype html>\n", encoding="utf-8")
        (self.root / "branding" / "brand.json").write_text("{}\n", encoding="utf-8")
        shutil.copy(SCRIPTS.parent / "bin" / "compose-prod", self.root / "bin" / "compose-prod")
        shutil.copy(SCRIPTS / "web_manifest.py", self.root / "scripts" / "web_manifest.py")
        shutil.copy(SCRIPTS.parent / "docker-compose.web.yml", self.root / "docker-compose.web.yml")
        (self.root / ".gitignore").write_text("core/\n", encoding="utf-8")
        git(self.root, "init", "-q")
        self.commit = commit_all(self.root, "deployment")
        fakebin = base / "fakebin"
        fakebin.mkdir()
        # bin/compose-prod clears the environment, so the fake learns its state path here.
        (fakebin / "docker").write_text(FAKE_DOCKER.replace("STATE", repr(str(self.state)), 1), encoding="utf-8")
        (fakebin / "docker").chmod(0o755)
        self.env = {**os.environ, "PATH": f"{fakebin}:{os.environ['PATH']}", "FAKE_STATE": str(self.state)}

    def record(self):
        web_manifest.record(self.root, OWN_WEB, "HEAD")
        return commit_all(self.root, "record web image")

    def set_state(self, name, value):
        (self.state / name).write_text(value, encoding="utf-8")

    def check(self, deploy=False):
        old = os.environ.get("PATH")
        os.environ["PATH"], os.environ["FAKE_STATE"] = self.env["PATH"], str(self.state)
        try:
            return web_manifest.check(self.root, deploy)
        finally:
            os.environ["PATH"] = old

    def wrapper(self, *arguments):
        return subprocess.run(
            ["bash", str(self.root / "bin" / "compose-prod"), *arguments],
            env=self.env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def calls(self):
        log = self.state / "calls.log"
        return log.read_text(encoding="utf-8").splitlines() if log.exists() else []


class ManifestTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.deployment = Deployment(self.temp.name)

    def test_recorded_image_passes_the_deploy_check(self):
        self.deployment.record()
        recorded = json.loads((self.deployment.root / web_manifest.WEB_MANIFEST).read_text())
        self.assertEqual(recorded["image"], OWN_WEB)
        self.assertEqual(recorded["frontend_tree"], git(self.deployment.root, "rev-parse", "HEAD~1:frontend"))
        self.assertEqual(self.deployment.check(deploy=True), [])

    def test_missing_manifest_is_a_notice_offline_and_blocks_deploy(self):
        self.assertIn("web-image.json is missing", self.deployment.check()[0])
        with self.assertRaisesRegex(web_manifest.ManifestError, "missing or invalid"):
            self.deployment.check(deploy=True)

    def test_changed_frontend_needs_a_new_image_before_deploy(self):
        self.deployment.record()
        (self.deployment.root / "frontend" / "index.html").write_text("<!doctype html><p>changed\n")
        commit_all(self.deployment.root, "change frontend")
        self.assertIn("publish a new web image", self.deployment.check()[0])
        with self.assertRaisesRegex(web_manifest.ManifestError, "differs from the tree"):
            self.deployment.check(deploy=True)

    def test_uncommitted_branding_blocks_deploy(self):
        self.deployment.record()
        (self.deployment.root / "branding" / "brand.json").write_text('{"name": "edited"}\n')
        with self.assertRaisesRegex(web_manifest.ManifestError, "uncommitted"):
            self.deployment.check(deploy=True)

    def test_rendered_image_must_match(self):
        self.deployment.record()
        self.deployment.set_state("rendered-image", CORE_WEB)
        with self.assertRaisesRegex(web_manifest.ManifestError, "image does not match"):
            self.deployment.check(deploy=True)

    def test_unexpected_web_project_containers_block_deploy(self):
        self.deployment.record()
        self.deployment.set_state("web-project-services", "frontend\nsidecar\n")
        with self.assertRaisesRegex(web_manifest.ManifestError, "unexpected containers"):
            self.deployment.check(deploy=True)

    def test_record_rejects_another_repository(self):
        with self.assertRaisesRegex(web_manifest.ManifestError, "invalid image"):
            web_manifest.record(self.deployment.root, CORE_WEB, "HEAD")
        self.assertFalse((self.deployment.root / web_manifest.WEB_MANIFEST).exists())


class WrapperTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.deployment = Deployment(self.temp.name)

    def test_core_commands_pass_straight_through(self):
        for arguments in (["preflight"], ["deploy"], ["maintenance", "pitr-list-backups", "--approved"], ["ps"]):
            result = self.deployment.wrapper(*arguments)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            self.deployment.calls(),
            ["helper preflight", "helper deploy", "helper maintenance pitr-list-backups --approved", "helper ps"],
        )

    def test_deploy_web_replaces_the_core_frontend_container(self):
        self.deployment.record()
        self.deployment.set_state("container", f"hasanara {CORE_WEB}")
        result = self.deployment.wrapper("deploy-web")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            self.deployment.calls(),
            [
                "helper preflight",
                "compose --project-name hasanara-web --project-directory --env-file --file pull --quiet"
                f" image={OWN_WEB}",
                "container stop hasanara-web",
                "container rm hasanara-web",
                "compose --project-name hasanara-web --project-directory --env-file --file up -d --no-build"
                f" --pull never image={OWN_WEB}",
            ],
        )
        self.assertIn("hasanara-web is healthy", result.stdout)

    def test_deploy_web_leaves_its_own_container_to_compose(self):
        self.deployment.record()
        self.deployment.set_state("container", f"hasanara-web {OWN_WEB}")
        result = self.deployment.wrapper("deploy-web")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(call.startswith("container ") for call in self.deployment.calls()))

    def test_deploy_web_stops_before_touching_containers_when_a_check_fails(self):
        result = self.deployment.wrapper("deploy-web")  # no web-image.json
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.deployment.calls(), [])
        self.deployment.record()
        self.deployment.set_state("helper-status", "1")
        result = self.deployment.wrapper("deploy-web")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.deployment.calls(), ["helper preflight"])

    def test_web_commands_are_read_only(self):
        self.deployment.record()
        self.assertEqual(self.deployment.wrapper("web", "ps").returncode, 0)
        self.assertEqual(self.deployment.wrapper("web", "up", "-d").returncode, 64)
        self.assertEqual(self.deployment.wrapper("deploy-web", "extra").returncode, 64)


if __name__ == "__main__":
    unittest.main()
