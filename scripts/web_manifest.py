#!/usr/bin/env python3
"""Record and check HasanAra's web image manifest, web-image.json.

The web container runs in its own Compose project, hasanara-web
(docker-compose.web.yml), outside the core project whose release preflight
checks backend images against release-images.json. web-image.json names the
image digest, the commit the web image workflow built and that commit's
frontend/ tree.

    web_manifest.py image                    print the image reference
    web_manifest.py record IMAGE COMMIT      write web-image.json for an image built from COMMIT
    web_manifest.py check                    offline check (CI)
    web_manifest.py check --deploy           host preflight for bin/compose-prod deploy-web
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, NoReturn

ROOT = Path(__file__).resolve().parent.parent
WEB_MANIFEST = "web-image.json"
WEB_COMPOSE = "docker-compose.web.yml"
WEB_PROJECT = "hasanara-web"
WEB_SERVICE = "frontend"
WEB_CONTAINER = "hasanara-web"
WEB_REPOSITORY = "git.subcult.tv/subculture-collective/hasanara-web"
# Inputs of the running web container that must be committed, not edited on the host.
WEB_INPUTS = ("frontend", "branding", WEB_COMPOSE, WEB_MANIFEST)
DIGEST_RE = re.compile(r"^[^\s@]+@sha256:[0-9a-f]{64}$")
OBJECT_RE = re.compile(r"^[0-9a-f]{40}$")


class ManifestError(Exception):
    """A non-sensitive validation error."""


def fail(message: str) -> NoReturn:
    raise ManifestError(message)


def dump(data: dict[str, Any]) -> str:
    return json.dumps(data, indent=2, sort_keys=True) + "\n"


def validate(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict) or set(data) != {"schema_version", "image", "source_commit", "frontend_tree"}:
        fail(f"{WEB_MANIFEST} has an invalid schema")
    image = data["image"]
    if (
        data["schema_version"] != 1
        or not isinstance(image, str)
        or not DIGEST_RE.fullmatch(image)
        or image.split("@", 1)[0] != WEB_REPOSITORY
        or not all(
            isinstance(data[key], str) and OBJECT_RE.fullmatch(data[key]) for key in ("source_commit", "frontend_tree")
        )
    ):
        fail(f"{WEB_MANIFEST} has an invalid image or source reference")
    return data


def load(root: Path) -> dict[str, Any]:
    try:
        data = json.loads((root / WEB_MANIFEST).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        fail(f"{WEB_MANIFEST} is missing or invalid")
    return validate(data)


def run(root: Path, command: list[str], error: str, env: dict[str, str] | None = None) -> str:
    result = subprocess.run(
        command, cwd=root, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
    )
    if result.returncode:
        fail(error)
    return result.stdout


def frontend_tree(root: Path, revision: str = "HEAD") -> str:
    tree = run(root, ["git", "rev-parse", f"{revision}:frontend"], "cannot resolve the frontend/ tree").strip()
    if not OBJECT_RE.fullmatch(tree):
        fail("cannot resolve the frontend/ tree")
    return tree


def compose_command(root: Path) -> list[str]:
    # --env-file /dev/null: the web project takes no operator settings or secrets.
    return [
        "docker",
        "compose",
        "--project-name",
        WEB_PROJECT,
        "--project-directory",
        str(root),
        "--env-file",
        os.devnull,
        "--file",
        str(root / WEB_COMPOSE),
    ]


def compose_env(image: str) -> dict[str, str]:
    keep = ("PATH", "HOME", "USER", "DOCKER_HOST", "DOCKER_CONFIG")
    env = {key: os.environ[key] for key in keep if key in os.environ}
    return {**env, "HASANARA_WEB_IMAGE": image}


def check_rendered(root: Path, image: str) -> list[str]:
    """Check the rendered web project; returns its external network names."""
    rendered = run(
        root, [*compose_command(root), "config", "--format", "json"], "web Compose rendering failed", compose_env(image)
    )
    try:
        config = json.loads(rendered)
    except json.JSONDecodeError:
        fail("web Compose rendered invalid JSON")
    services = config.get("services", {})
    if set(services) != {WEB_SERVICE}:
        fail(f"{WEB_COMPOSE} must define exactly the {WEB_SERVICE} service")
    service = services[WEB_SERVICE]
    if service.get("image") != image or "build" in service:
        fail(f"web Compose image does not match {WEB_MANIFEST}")
    if service.get("container_name") != WEB_CONTAINER:
        fail(f"web container must be named {WEB_CONTAINER}")
    networks = config.get("networks", {})
    names = [details.get("name", key) for key, details in networks.items() if details.get("external") is True]
    if not names or len(names) != len(networks):
        fail(f"{WEB_COMPOSE} must attach only to external networks")
    return names


def check(root: Path, deploy: bool) -> list[str]:
    """Validate web-image.json and the web project. Returns non-blocking notices."""
    notices: list[str] = []
    if not deploy and not (root / WEB_MANIFEST).exists():
        notices.append(f"{WEB_MANIFEST} is missing; publish the web image and record it before deploying")
        check_rendered(root, f"{WEB_REPOSITORY}@sha256:{'0' * 64}")
        return notices
    web = load(root)
    if frontend_tree(root) != web["frontend_tree"]:
        message = "frontend/ differs from the tree the recorded web image was built from; publish a new web image"
        if deploy:
            fail(message)
        notices.append(message + " and record it before deploying")
    if deploy:
        dirty = run(root, ["git", "status", "--porcelain", "--untracked-files=all", "--", *WEB_INPUTS], "git failed")
        if dirty:
            fail("web inputs have uncommitted changes")
    networks = check_rendered(root, web["image"])
    if deploy:
        for network in networks:
            run(root, ["docker", "network", "inspect", network], f"required external network is missing: {network}")
        services = run(
            root,
            [
                "docker",
                "ps",
                "--all",
                "--filter",
                f"label=com.docker.compose.project={WEB_PROJECT}",
                "--format",
                '{{.Label "com.docker.compose.service"}}',
            ],
            "cannot inspect web project containers",
        ).split()
        if any(service != WEB_SERVICE for service in services):
            fail(f"unexpected containers in the {WEB_PROJECT} project")
    return notices


def record(root: Path, image: str, commit: str) -> None:
    commit = run(root, ["git", "rev-parse", "--verify", f"{commit}^{{commit}}"], "unknown commit").strip()
    tree = frontend_tree(root, commit)
    web = validate({"schema_version": 1, "image": image, "source_commit": commit, "frontend_tree": tree})
    (root / WEB_MANIFEST).write_text(dump(web), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("image")
    recorder = commands.add_parser("record")
    recorder.add_argument("image")
    recorder.add_argument("commit")
    checker = commands.add_parser("check")
    checker.add_argument("--deploy", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.command == "image":
            print(load(ROOT)["image"])
        elif args.command == "record":
            record(ROOT, args.image, args.commit)
        else:
            for notice in check(ROOT, args.deploy):
                print(f"notice: {notice}")
            print("web preflight passed" if args.deploy else "web manifest check passed")
    except ManifestError as error:
        print(f"web manifest check failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
