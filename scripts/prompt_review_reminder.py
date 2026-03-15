#!/usr/bin/env python3
"""Generate a reminder to review key prompt/knowledge base files."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

FILES = [
    "AGENTS.md",
    "USER.md",
    "docs/OPENCLAW_RECOVERY.md",
    "memory/MEMORY.md",
]


def existing_targets() -> list[str]:
    root = Path(".").resolve()
    targets = []
    for rel in FILES:
        path = root / rel
        if path.exists():
            targets.append(rel)
    today_mem = Path("memory") / f"{datetime.now().date():%Y-%m-%d}.md"
    if today_mem.exists():
        targets.append(today_mem.as_posix())
    return targets


def main() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    targets = existing_targets()

    lines = [
        "プロンプト／ナレッジベース再学習リマインダ",
        f"チェック時刻: {now}",
        "以下のファイルを見直して、最新状況や学びを反映してください:",
    ]

    if not targets:
        lines.append("- （対象ファイルが見つかりませんでした）")
    else:
        for rel in targets:
            lines.append(f"- {rel}")

    lines.append("必要に応じて MEMORY.md や今日の日次メモへ更新内容を転記してください。")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
