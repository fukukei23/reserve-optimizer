#!/usr/bin/env python3
"""Generate daily Obsidian note (Asia/Tokyo) and sync memory file."""

from __future__ import annotations

import os
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
TZ = ZoneInfo("Asia/Tokyo")

WEEKDAY_JA = {
    0: "月",
    1: "火",
    2: "水",
    3: "木",
    4: "金",
    5: "土",
    6: "日",
}

def load_template() -> str:
    template_path = ROOT / "obsidian" / "templates" / "daily.md"
    return template_path.read_text(encoding="utf-8")


def ensure_daily_note(date: str, weekday: str) -> Path:
    target = ROOT / "obsidian" / "01_Daily" / f"{date}.md"
    if not target.exists():
        template = load_template()
        content = (
            template
            .replace("{{DATE}}", date)
            .replace("{{WEEKDAY_JA}}", weekday)
        )
        target.write_text(content, encoding="utf-8")
    return target


def ensure_memory_note(date: str, daily_note: Path) -> Path:
    target = ROOT / "memory" / f"{date}.md"
    if not target.exists():
        rel_path = daily_note.relative_to(ROOT)
        target.write_text(
            f"# {date}\n\n"
            f"## Obsidian日次ノート\n- [[{rel_path.as_posix()}]]\n\n"
            f"## 要約\n- (ここにポイントを書いてください)\n",
            encoding="utf-8",
        )
    return target


def main() -> None:
    now = datetime.now(TZ)
    date_str = now.strftime("%Y-%m-%d")
    weekday = WEEKDAY_JA[now.weekday()]

    daily_note = ensure_daily_note(date_str, weekday)
    ensure_memory_note(date_str, daily_note)


if __name__ == "__main__":
    main()
