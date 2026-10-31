#!/usr/bin/env python3
"""Decode base64-embedded zip payloads from Playwright HTML reports into SCAN_ROOT.

The HTML reporter stores step titles (including Fill \"secret\") inside a zip
embedded as data:application/zip;base64,... — plaintext grep of index.html
misses those. Never prints secret values.
"""
from __future__ import annotations

import base64
import io
import os
import re
import zipfile
from pathlib import Path


def main() -> None:
    root = Path(os.environ["SCAN_ROOT"])
    out = root / "html-embedded-zips"
    out.mkdir(parents=True, exist_ok=True)
    extracted = 0
    for html in root.rglob("*.html"):
        text = html.read_text(errors="ignore")
        for i, match in enumerate(
            re.finditer(r"data:application/zip;base64,([A-Za-z0-9+/=]+)", text)
        ):
            try:
                data = base64.b64decode(match.group(1), validate=False)
            except Exception:
                continue
            if data[:2] != b"PK":
                continue
            dest = out / f"{html.stem}-{i}"
            dest.mkdir(parents=True, exist_ok=True)
            try:
                with zipfile.ZipFile(io.BytesIO(data)) as zf:
                    zf.extractall(dest)
                extracted += 1
            except Exception:
                continue
    print(f"Decoded {extracted} embedded report zip(s) for secret scan")


if __name__ == "__main__":
    main()
