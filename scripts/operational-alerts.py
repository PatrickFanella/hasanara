#!/usr/bin/env python3
"""Check HasanAra availability; send operator email only with --send."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import tempfile
import time
import uuid
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check(base_url, opener):
    failures = []
    for path in ("/api/health", "/api/archive/summary"):
        try:
            with opener.open(urllib.request.Request(base_url.rstrip("/") + path, headers={"User-Agent": "HasanAra-Operations/1.0"}), timeout=10) as response:
                body = response.read(65537)
                if response.status != 200 or len(body) > 65536:
                    raise ValueError("invalid response")
                payload = json.loads(body)
                if not isinstance(payload, dict) or payload.get("status") in ("error", "unhealthy", "degraded"):
                    raise ValueError("unhealthy response")
        except (OSError, ValueError):
            failures.append(path)
    return failures


def transition(previous, failures):
    """Notify once per change in failed checks, and once on recovery."""
    if failures == previous or (previous is None and not failures):
        return None
    return "incident" if failures else "recovery"


def send_alert(kind, failures, opener, idempotency_key):
    key = os.environ.get("BREVO_API_KEY", "")
    if not key or any(c in key for c in "\r\n"):
        raise ValueError("BREVO_API_KEY is required")
    recipient = os.environ.get("HASANARA_ALERT_TO", "patrick@subcult.tv")
    sender = os.environ.get("HASANARA_ALERT_FROM", "noreply@hasanara.tv")
    payload = {
        "sender": {"name": "HasanAra Operations", "email": sender},
        "messageVersions": [{"to": [{"email": recipient}]}],
        "headers": {"idempotencyKey": idempotency_key},
        "subject": "HasanAra: availability " + kind,
        "textContent": "HasanAra availability checks failed: " + ", ".join(failures)
        if failures else "HasanAra availability checks have recovered.",
        "tags": ["hasanara-operations"],
    }
    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode(),
        headers={"api-key": key, "content-type": "application/json", "accept": "application/json"},
    )
    try:
        with opener.open(request, timeout=10) as response:
            body = response.read(65537)
            result = json.loads(body) if len(body) <= 65536 else {}
            if not isinstance(result, dict):
                raise ValueError("email acceptance unavailable")
            ids = result.get("messageIds", [result.get("messageId")])
            if response.status != 201 or not isinstance(ids, list) or len(ids) != 1 or not isinstance(ids[0], str) or not ids[0] or len(ids[0]) > 512 or any(c in ids[0] for c in "\r\n"):
                raise ValueError("email acceptance unavailable")
    except (OSError, ValueError):
        # Provider bodies and request headers can contain secrets or addresses.
        raise ValueError("email acceptance unavailable") from None


def save_state(path, value):
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as temporary:
        json.dump(value, temporary)
        temporary.flush()
        os.fsync(temporary.fileno())
    os.replace(temporary.name, path)
    directory_fd = os.open(path.parent, os.O_DIRECTORY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


def notify(state, failures, opener):
    saved = json.loads(state.read_text()) if state.exists() else {"failures": None}
    # Accept the initial list-only state format.
    if isinstance(saved, list):
        saved = {"failures": saved}
    pending = saved.get("pending")
    kind = transition(saved.get("failures"), failures)
    if pending is None and kind:
        pending = {"kind": kind, "failures": failures, "id": str(uuid.uuid4()), "started": time.time()}
        saved["pending"] = pending
        save_state(state, saved)
    if pending is not None:
        if time.time() - pending["started"] >= 29 * 60:
            raise ValueError("unconfirmed notification requires operator review")
        send_alert(pending["kind"], pending["failures"], opener, pending["id"])
        saved = {"failures": pending["failures"]}
        kind = pending["kind"]
    else:
        saved = {"failures": failures}
    save_state(state, saved)
    return kind


def run(args):
    base = os.environ.get("HASANARA_ALERT_BASE_URL", "https://hasanara.tv")
    if not base.startswith(("https://", "http://127.0.0.1:", "http://localhost:")):
        raise ValueError("health checks require HTTPS or loopback")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    failures = check(base, opener)
    if not args.send:
        print(json.dumps({"mode": "dry-run", "failed_checks": failures}))
        return 1 if failures else 0
    state = Path(args.state)
    state.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_fd = os.open(str(state) + ".lock", os.O_CREAT | os.O_RDWR, 0o600)
    with os.fdopen(lock_fd, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        kind = notify(state, failures, opener)
    print(json.dumps({"mode": "send", "failed_checks": failures, "notification": kind}))
    return 1 if failures else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--send", action="store_true")
    parser.add_argument("--state", default=str(Path.home() / ".local/state/hasanara/operational-alerts.json"))
    try:
        raise SystemExit(run(parser.parse_args()))
    except (OSError, ValueError):
        print(json.dumps({"error": "operational-alert check or delivery failed"}))
        raise SystemExit(2)
