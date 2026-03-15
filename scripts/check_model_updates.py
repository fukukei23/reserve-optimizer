#!/usr/bin/env python3
"""Check OpenClaw-related repositories for new releases and summarize changes."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPOS = [
    {
        "name": "openclaw/openclaw",
        "api": "https://api.github.com/repos/openclaw/openclaw/releases/latest",
        "display": "OpenClaw"
    }
]

STATE_PATH = Path("logs/model_update_state.json")


def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "openclaw-monitor"})
    with urllib.request.urlopen(req, timeout=15) as resp:  # nosec - trusted GitHub API
        data = resp.read().decode("utf-8")
    return json.loads(data)


def main() -> None:
    state = load_state()
    messages = []
    now = datetime.now(timezone.utc).isoformat()

    for repo in REPOS:
        name = repo["name"]
        try:
            release = fetch_json(repo["api"])
        except urllib.error.HTTPError as exc:
            messages.append(f"{repo['display']}: GitHub API error {exc.code}")
            continue
        except Exception as exc:  # pylint: disable=broad-except
            messages.append(f"{repo['display']}: fetch failed ({exc})")
            continue

        tag = release.get("tag_name") or release.get("name", "unknown")
        published = release.get("published_at", "unknown time")
        html_url = release.get("html_url", release.get("url", ""))
        prev_tag = (state.get(name) or {}).get("tag")

        if prev_tag == tag:
            messages.append(f"{repo['display']}: 最新リリースは {tag}（変更なし）")
        else:
            summary = release.get("body", "").strip()
            if summary:
                summary = summary.splitlines()[0][:160]
            else:
                summary = "リリースノートは未記載"
            messages.append(
                f"{repo['display']}: 新リリース {tag} 公開 ({published}) - {summary} {html_url}"
            )
            state[name] = {"tag": tag, "checked_at": now}

    save_state(state)

    if messages:
        output = "\n".join(messages)
    else:
        output = "チェック対象が見つかりませんでした"

    print(output)


if __name__ == "__main__":
    main()
