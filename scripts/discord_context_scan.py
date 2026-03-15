#!/usr/bin/env python3
"""Collect cross-channel context for Heartbeat-driven suggestions."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover (Python <3.9 fallback)
    from backports.zoneinfo import ZoneInfo  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
MEMORY_DIR = ROOT / "memory"
SHARED_PATH = MEMORY_DIR / "SHARED.md"
TZ = ZoneInfo("Asia/Tokyo")

DATE_PATTERN = re.compile(r"20\d{2}-\d{2}-\d{2}")
TIME_PATTERN = re.compile(r"\b([01]?\d|2[0-3]):[0-5]\d\b")
TODO_KEYWORDS = (
    "TODO",
    "未決",
    "未対応",
    "未解決",
    "要対応",
    "フォローアップ",
)
MONETIZE_KEYWORDS = (
    "マネタイズ",
    "収益",
    "売上",
    "ビジネス",
    "自走ビジネス",
    "Felix",
    "商品",
    "Stripe",
)


@dataclass
class ConversationStat:
    path: str
    date: str
    total_lines: int
    bullet_lines: int


def read_text(path: Path) -> str:
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def get_recent_memory_files(days: int = 2) -> list[Path]:
    files: list[Path] = []
    today = datetime.now(TZ).date()
    for i in range(days):
        target = today - timedelta(days=i)
        path = MEMORY_DIR / f"{target.isoformat()}.md"
        if path.exists():
            files.append(path)
    return files


def summarize_file(path: Path) -> ConversationStat:
    text = read_text(path)
    lines = [line.rstrip() for line in text.splitlines()]
    bullet_lines = sum(1 for line in lines if line.strip().startswith(("- ", "* ")))
    return ConversationStat(
        path=path.relative_to(ROOT).as_posix(),
        date=path.stem,
        total_lines=len(lines),
        bullet_lines=bullet_lines,
    )


def extract_matches(text: str, keywords: tuple[str, ...]) -> list[str]:
    hits: list[str] = []
    lower_text = text.lower()
    for keyword in keywords:
        if keyword.lower() in lower_text:
            # collect actual lines containing keyword (case-sensitive search)
            for line in text.splitlines():
                if keyword.lower() in line.lower():
                    hits.append(line.strip())
    return sorted(set(hits))


def extract_todos(texts: dict[str, str]) -> list[dict[str, str]]:
    todos: list[dict[str, str]] = []
    for label, text in texts.items():
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("- [ ]") or any(word in stripped for word in TODO_KEYWORDS):
                todos.append({"source": label, "text": stripped})
    return todos


def extract_reminders(texts: dict[str, str]) -> list[dict[str, str]]:
    reminders: list[dict[str, str]] = []
    for label, text in texts.items():
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if DATE_PATTERN.search(stripped) or TIME_PATTERN.search(stripped):
                # skip obvious headings to avoid noise
                if stripped.startswith(("#", "##")):
                    continue
                reminders.append({"source": label, "text": stripped})
    return reminders


def extract_monetization_context(texts: dict[str, str]) -> list[str]:
    ideas: list[str] = []
    for text in texts.values():
        ideas.extend(extract_matches(text, MONETIZE_KEYWORDS))
    return ideas


def main() -> None:
    shared_text = read_text(SHARED_PATH)
    recent_files = get_recent_memory_files(days=3)

    memory_texts: dict[str, str] = {SHARED_PATH.name: shared_text}
    conv_stats: list[ConversationStat] = []

    for path in recent_files:
        text = read_text(path)
        memory_texts[path.name] = text
        conv_stats.append(summarize_file(path))

    todos = extract_todos(memory_texts)
    reminders = extract_reminders(memory_texts)
    monetization = extract_monetization_context(memory_texts)

    output: dict[str, Any] = {
        "generated_at": datetime.now(TZ).isoformat(),
        "conversation_stats": [asdict(stat) for stat in conv_stats],
        "todo_candidates": todos,
        "reminder_candidates": reminders,
        "monetization_signals": sorted(set(monetization)),
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
