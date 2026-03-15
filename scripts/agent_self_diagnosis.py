#!/usr/bin/env python3
"""Summarize key OpenClaw runtime signals for a lightweight self-diagnosis."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

HOME = Path.home()
CRON_PATH = HOME / ".openclaw" / "cron" / "jobs.json"
CONFIG_PATH = HOME / ".openclaw" / "openclaw.json"


def load_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def summarize_cron(data: dict | None) -> list[str]:
    if not data:
        return ["Cron設定: ファイル未検出"]
    jobs = data.get("jobs", [])
    lines = [f"Cronジョブ数: {len(jobs)}"]
    problem_jobs = []
    for job in jobs:
        state = job.get("state") or {}
        errors = state.get("consecutiveErrors", 0)
        if errors:
            problem_jobs.append(
                f"- {job.get('name','unknown')} (ID {job.get('id')}) 連続エラー {errors}回"
            )
    if problem_jobs:
        lines.append("エラー中ジョブ:")
        lines.extend(problem_jobs)
    else:
        lines.append("エラー中ジョブ: なし")
    return lines


def summarize_config(data: dict | None) -> list[str]:
    if not data:
        return ["openclaw.json: 読み込めませんでした"]
    meta = data.get("meta", {})
    version = meta.get("lastTouchedVersion", "unknown")
    ts = meta.get("lastTouchedAt", "unknown")
    gateway = data.get("gateway", {})
    bind = gateway.get("bind", "unknown")
    lines = [
        f"Config版: {version}",
        f"最終更新: {ts}",
        f"gateway.bind: {bind}",
    ]
    return lines


def main() -> None:
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"エージェント自己診断 ({now})"]
    lines.append("")

    lines.append("[Cron]")
    lines.extend(summarize_cron(load_json(CRON_PATH)))
    lines.append("")

    lines.append("[Config]")
    lines.extend(summarize_config(load_json(CONFIG_PATH)))

    print("\n".join(lines))


if __name__ == "__main__":
    main()
