#!/usr/bin/env python3
"""Append conversation notes to memory/YYYY-MM-DD.md with session grouping."""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("entry", help="Text to append as a bullet point under the session heading")
    parser.add_argument(
        "--session",
        required=True,
        help="Session label (e.g., 'Session 1 (03:35 UTC start)')",
    )
    parser.add_argument(
        "--date",
        help="Date in YYYY-MM-DD (default: today, UTC)",
    )
    parser.add_argument(
        "--timestamp",
        help="Optional timestamp string to prefix each entry (default: now, HH:MM UTC)",
    )
    parser.add_argument(
        "--speaker",
        default="assistant",
        help="Speaker tag to include in entry (default: assistant)",
    )
    parser.add_argument(
        "--memory-root",
        default="memory",
        help="Relative path to memory directory (default: memory)",
    )
    return parser.parse_args()


def ensure_header(text: str, header: str) -> bool:
    return header in text


def main() -> None:
    args = parse_args()

    today = dt.datetime.utcnow().date()
    date_str = args.date or today.isoformat()
    timestamp = args.timestamp
    if not timestamp:
        timestamp = dt.datetime.utcnow().strftime("%H:%M UTC")

    memory_dir = Path(args.memory_root)
    memory_dir.mkdir(parents=True, exist_ok=True)
    file_path = memory_dir / f"{date_str}.md"

    if file_path.exists():
        content = file_path.read_text()
    else:
        content = f"# {date_str}\n\n"

    session_header = f"## {args.session}".strip()
    if not ensure_header(content, session_header):
        if not content.endswith("\n"):
            content += "\n"
        content += f"{session_header}\n"

    if not content.endswith("\n"):
        content += "\n"

    entry_text = args.entry.strip().replace("\n", " ")
    bullet = f"- {timestamp} ({args.speaker}): {entry_text}\n"
    content += bullet

    file_path.write_text(content)
    print(f"Logged entry to {file_path}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
