#!/usr/bin/env python3
"""Generate daily summary from session logs using GLM-5 and update memory file."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib import request, error

TZ = ZoneInfo("Asia/Tokyo")
SESSIONS_DIR = Path.home() / ".openclaw" / "agents" / "main" / "sessions"
MEMORY_DIR = Path(__file__).resolve().parent.parent / "memory"

API_URL = os.environ.get("GLM_API_URL", "https://api.z.ai/api/coding/paas/v4/chat/completions")
API_KEY = os.environ.get("GLM_API_KEY")

SKIP_PATTERNS = (
    "Read HEARTBEAT.md",
    "HEARTBEAT_OK",
    "[cron:",
    "Agent failed before reply",
    "All models failed",
    "Logs: openclaw logs",
)


def strip_metadata(text: str) -> str:
    stripped = text.strip()
    if "Conversation info (untrusted metadata)" in stripped or "Sender (untrusted metadata)" in stripped:
        last_backtick = stripped.rfind("```")
        if last_backtick != -1:
            stripped = stripped[last_backtick + 3 :]
    return stripped.strip()


def get_yesterday_sessions() -> list[Path]:
    now = datetime.now(TZ)
    yesterday_start = datetime(now.year, now.month, now.day, tzinfo=TZ) - timedelta(days=1)
    today_start = datetime(now.year, now.month, now.day, tzinfo=TZ)
    sessions: list[Path] = []
    for file in SESSIONS_DIR.glob("*.jsonl"):
        if any(tag in file.name for tag in (".deleted", ".reset", ".lock")):
            continue
        mtime = datetime.fromtimestamp(file.stat().st_mtime, tz=TZ)
        if yesterday_start <= mtime < today_start:
            sessions.append(file)
    return sessions


def extract_user_messages(session_file: Path, limit: int = 120) -> list[dict]:
    messages: list[dict] = []
    try:
        with session_file.open("r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    entry = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue
                if entry.get("type") != "message":
                    continue
                payload = entry.get("message", {})
                if payload.get("role") != "user":
                    continue
                content = payload.get("content", [])
                for block in content:
                    if not isinstance(block, dict) or block.get("type") != "text":
                        continue
                    text = strip_metadata(block.get("text", ""))
                    if not text or any(pattern in text for pattern in SKIP_PATTERNS):
                        continue
                    messages.append({
                        "text": text,
                        "timestamp": entry.get("timestamp", "")
                    })
                    break
    except FileNotFoundError:
        return []
    return messages[-limit:] if len(messages) > limit else messages


def summarize_with_llm(messages: list[dict]) -> str:
    if not messages:
        return "- 本日は会話なし"

    excerpt = "\n\n".join(
        f"[{msg['timestamp'][:19] if msg['timestamp'] else '時刻不明'}]\n{msg['text']}"
        for msg in messages[:40]
    )

    prompt = f"""以下は昨日のユーザーとの会話抜粋です。重要なトピックと決定事項を日本語で簡潔に要約してください。出力形式：
\n## 主なトピック\n- 箇条書き\n\n## 決定事項・アクション\n- 箇条書き（なければ『- 特になし』）\n\n## 所感\n- 1〜2文\n\n会話抜粋:\n{excerpt}\n"""

    if not API_KEY:
        return "- （GLM_API_KEY 未設定のため要約できず）"

    payload = json.dumps({
        "model": "glm-5",
        "messages": [
            {"role": "system", "content": "あなたは会話の要約アシスタントです。"},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 400,
    }).encode("utf-8")

    req = request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=60) as resp:
            data = json.load(resp)
            summary = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return summary.strip() if summary else "- （要約生成失敗）"
    except error.HTTPError as exc:
        return f"- （LLM API エラー: {exc.code}）"
    except Exception as exc:
        return f"- （LLM要約で想定外エラー: {exc}）"


def update_memory(date_str: str, summary: str) -> None:
    memory_file = MEMORY_DIR / f"{date_str}.md"
    if not memory_file.exists():
        memory_file.write_text(
            f"# {date_str}\n\n"
            f"## Obsidian日次ノート\n- [[obsidian/01_Daily/{date_str}.md]]\n\n"
            f"## 要約\n{summary}\n",
            encoding="utf-8",
        )
        return

    content = memory_file.read_text(encoding="utf-8")
    lines = content.split("\n")
    new_lines: list[str] = []
    in_summary = False
    replaced = False

    for line in lines:
        if line.startswith("## 要約"):
            in_summary = True
            replaced = True
            new_lines.append(line)
            new_lines.append(summary)
            continue
        if in_summary and line.startswith("## "):
            in_summary = False
        if not in_summary:
            new_lines.append(line)

    if not replaced:
        new_lines.append("\n## 要約")
        new_lines.append(summary)

    memory_file.write_text("\n".join(new_lines), encoding="utf-8")


def main() -> None:
    now = datetime.now(TZ)
    target_date = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    sessions = get_yesterday_sessions()
    all_messages: list[dict] = []
    for session_file in sessions:
        all_messages.extend(extract_user_messages(session_file))

    summary = summarize_with_llm(all_messages)
    update_memory(target_date, summary)
    print(f"Summary updated for {target_date} ({len(all_messages)} messages)")


if __name__ == "__main__":
    main()
