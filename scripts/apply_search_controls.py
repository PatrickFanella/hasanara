#!/usr/bin/env python3
"""Replace only HasanAra API using its live Compose stack plus search controls."""
import json
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
details = json.loads(subprocess.check_output(["docker", "inspect", "hasanara-api"]))[0]
labels = details["Config"]["Labels"]
if labels["com.docker.compose.project"] != "hasanara":
    raise SystemExit("Unexpected API Compose owner")
files = labels["com.docker.compose.project.config_files"].split(",")
overlay = str(root / "docker-compose.search-controls.json")
files = [f for f in files if f != overlay]
base = ["docker", "compose", "--project-name", "hasanara", "--project-directory", str(root),
        "--env-file", str(root / ".env.prod")]
for path in files:
    base += ["--file", path]
env = os.environ.copy()
env.update(HASANARA_ENV_FILE=str(root / ".env.prod"), TRANSCRIPT_DEPLOY_ROOT=str(root),
           TRANSCRIPT_CORE_DIR=str(root / "core"))

def config(command):
    # Compose output contains secrets. Parse in memory and never print it.
    return json.loads(subprocess.check_output(command + ["config", "--format", "json"], env=env))

before = config(base)
command = base + ["--file", overlay]
after = config(command)
expected = json.loads(Path(overlay).read_text())["services"]["api"]
api = after["services"]["api"]
assert api["image"] == expected["image"]
# Allow only this image and its admission setting to change.
normalized = json.loads(json.dumps(after))
normalized["services"]["api"]["image"] = before["services"]["api"]["image"]
normalized["services"]["api"]["environment"] = before["services"]["api"]["environment"]
assert normalized == before, "Unexpected changes outside API image/environment"
old_env = before["services"]["api"]["environment"]
new_env = dict(api["environment"])
new_env.pop("ANONYMOUS_SEARCH_CONCURRENCY", None)
old_env = dict(old_env)
old_env.pop("ANONYMOUS_SEARCH_CONCURRENCY", None)
assert old_env == new_env, "Unexpected API environment changes"
subprocess.run(["docker", "image", "inspect", expected["image"]], stdout=subprocess.DEVNULL, check=True)
subprocess.run(command + ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "api"], env=env, check=True)
print("Only API selected; other services were not deployed.")
