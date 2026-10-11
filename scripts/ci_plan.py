#!/usr/bin/env python3
"""Select expensive checks from the complete event diff, keeping the gate stable."""
import os
import subprocess


def plan(paths, event, ref):
    full = paths is None or event == "workflow_dispatch"
    paths = paths or []
    ci_changed = any(path.startswith(".gitea/workflows/") or path.startswith("scripts/ci") for path in paths)
    frontend = full or ci_changed or any(
        path.startswith(("frontend/", "e2e/", "core/")) or path in ("core", ".gitmodules") for path in paths
    )
    image_source = full or ci_changed or any(
        path.startswith("frontend/") or path in (".dockerignore", "scripts/web_image_smoke.sh") for path in paths
    )
    publish = image_source and event in ("push", "workflow_dispatch") and ref == "refs/heads/main"
    image = (image_source or any(path.startswith("branding/") for path in paths)) and not publish
    return {"frontend": frontend, "image": image, "publish": publish}


def changed_paths(event):
    base = os.environ.get("CI_BASE" if event == "pull_request" else "CI_BEFORE", "")
    head = os.environ["CI_SHA"]
    if event == "workflow_dispatch" or not base or set(base) == {"0"}:
        return None
    # Full checkout history includes PR bases and push ranges. Fetch an event's
    # exact base too: a force-pushed previous tip may no longer be reachable.
    if subprocess.run(["git", "cat-file", "-e", base + "^{commit}"], capture_output=True).returncode:
        subprocess.run(["git", "fetch", "--no-tags", "--depth=1", "origin", base], check=True)
    output = subprocess.check_output(["git", "diff", "--name-only", "-z", base, head])
    return [path.decode("utf-8", errors="surrogateescape") for path in output.split(b"\0") if path]


if __name__ == "__main__":
    event = os.environ["CI_EVENT"]
    result = plan(changed_paths(event), event, os.environ["CI_REF"])
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        for name, enabled in result.items():
            value = str(enabled).lower()
            output.write(f"{name}={value}\n")
            print(f"{name}={value}")
