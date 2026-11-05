#!/usr/bin/env python3
"""List key-step E2E screenshot basenames for the PR comment.

Looks under reports/ and screenshots-artifact/ (including nested
screenshots/screenshots/*.png from the screenshots artifact).
"""
from __future__ import annotations

import re
from pathlib import Path

HEX_SUFFIX = re.compile(r"-(?:[a-f0-9]{16,})\.png$", re.I)
KEY_STEP = re.compile(r"^(?:admin|tech)-[a-z0-9-]+\.png$", re.I)


def main() -> None:
    names: set[str] = set()
    roots = [Path("reports"), Path("screenshots-artifact")]

    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*.png"):
            name = path.name
            if not KEY_STEP.match(name) or HEX_SUFFIX.search(name):
                continue
            if "screenshots" in {part.lower() for part in path.parts}:
                names.add(name)

    if not names:
        for root in roots:
            if not root.exists():
                continue
            for path in root.rglob("*.png"):
                name = path.name
                if KEY_STEP.match(name) and not HEX_SUFFIX.search(name):
                    names.add(name)

    if names:
        for name in sorted(names):
            print(f"- `{name}`")
    else:
        print("_No key-step screenshots found._")


if __name__ == "__main__":
    main()
