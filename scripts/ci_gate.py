#!/usr/bin/env python3
"""Fail the stable required check if any selected check did not succeed."""
import os
import sys


def failures(contract, frontend, image, frontend_required, image_required):
    errors = []
    for name, result, required in [
        ("contract", contract, True),
        ("frontend", frontend, frontend_required),
        ("web-image", image, image_required),
    ]:
        allowed = ("success",) if required else ("success", "skipped")
        if result not in allowed:
            errors.append(f"{name}: expected {' or '.join(allowed)}, got {result or 'missing result'}")
    return errors


if __name__ == "__main__":
    for name in ("FRONTEND_REQUIRED", "IMAGE_REQUIRED"):
        if os.environ.get(name) not in ("true", "false"):
            print(f"{name}: missing or invalid check selection", file=sys.stderr)
            sys.exit(1)
    errors = failures(
        os.environ.get("CONTRACT_RESULT", ""),
        os.environ.get("FRONTEND_RESULT", ""),
        os.environ.get("IMAGE_RESULT", ""),
        os.environ.get("FRONTEND_REQUIRED") == "true",
        os.environ.get("IMAGE_REQUIRED") == "true",
    )
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)
    print("All applicable deployment checks succeeded.")
