#!/usr/bin/env python3
"""Simple health check for the public OpenClaw gateway endpoint."""

from __future__ import annotations

import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

TARGETS = [
    "https://fopenclaw.com/",
]

TIMEOUT = 15


def check_url(url: str) -> tuple[int, float]:
    req = urllib.request.Request(url, headers={"User-Agent": "openclaw-health-check"})
    start = time.perf_counter()
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ssl.create_default_context()) as resp:  # nosec - https
        elapsed = time.perf_counter() - start
        return resp.getcode(), elapsed


def main() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"OpenClawヘルスチェック ({now})"]

    for url in TARGETS:
        try:
            status, elapsed = check_url(url)
            lines.append(f"- {url} -> {status}, {elapsed*1000:.0f} ms")
        except urllib.error.HTTPError as exc:
            lines.append(f"- {url} -> HTTP {exc.code}")
        except Exception as exc:  # pylint: disable=broad-except
            lines.append(f"- {url} -> エラー ({exc})")

    print("\n".join(lines))


if __name__ == "__main__":
    main()
