#!/usr/bin/env python3
"""
チャンネルアーカイブ自動更新スクリプト
- memory/channels/*.md に重要な会話を追記
- memory/SHARED.md に重要事項を抜粋
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
MEMORY_DIR = ROOT / "memory"
CHANNELS_DIR = MEMORY_DIR / "channels"
SHARED_PATH = MEMORY_DIR / "SHARED.md"
STATE_PATH = MEMORY_DIR / "channel_archive_state.json"
TZ = ZoneInfo("Asia/Tokyo")

# 重要キーワード
IMPORTANT_KEYWORDS = [
    "決定", "決めた", "合意", "ルール", "追加", "変更", "削除",
    "TODO", "FIXME", "やること", "次は", "今後",
    "バグ", "エラー", "障害", "修正",
    "リリース", "アップデート", "バージョン",
    "設定", "コンフィグ", "config",
    "手順", "やり方", "方法",
    "インストール", "導入", "構築",
]

# チャンネル定義
CHANNELS = {
    "1479832235610734664": "一般",
    "1480559453538484375": "ai-zenn",
    "1480589360465186847": "claw5速報",
    "1480704704349606021": "openclawヘルスチェック",
    "1480724445747482720": "glm使用量モニター",
    "1481189779449057361": "llmモデルモニター",
    "1481513790091563101": "自走ビジネス実験",
    "1481747400686178434": "ai-youtube-digest",
    "1482053801623163011": "タスク通知",
    "1482154983070634025": "アイデア通知",
    "1482523923886113032": "記憶と記録",
    "1482539740044591104": "技術手順",
    "1482558437702238249": "確定申告",
    "1482569332516192413": "朝の準備",
}


def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"last_message_ids": {}, "last_run": None}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def is_important(content: str) -> bool:
    if not content or len(content) < 10:
        return False
    content_lower = content.lower()
    return any(kw.lower() in content_lower for kw in IMPORTANT_KEYWORDS)


def extract_important_from_text(text: str) -> list[dict]:
    """テキストから重要な行を抽出"""
    important = []
    for line in text.split("\n"):
        line = line.strip()
        if is_important(line):
            important.append({"content": line[:200]})
    return important


def format_for_archive(items: list[dict], date_str: str) -> str:
    if not items:
        return ""
    lines = [f"\n### {date_str} 自動抽出\n"]
    for item in items:
        content = item["content"].replace("\n", " ").strip()
        lines.append(f"- {content}")
    return "\n".join(lines)


def append_to_archive(channel_name: str, content: str) -> bool:
    archive_path = CHANNELS_DIR / f"{channel_name}.md"
    if not archive_path.exists():
        return False
    current = archive_path.read_text(encoding="utf-8")
    if content.strip() and content.strip() not in current:
        archive_path.write_text(current + content, encoding="utf-8")
        return True
    return False


def update_shared(new_items: list[str], date_str: str) -> None:
    if not new_items:
        return
    current = SHARED_PATH.read_text(encoding="utf-8") if SHARED_PATH.exists() else ""
    items_to_add = [item for item in new_items if item not in current]
    if not items_to_add:
        return
    addition = f"\n## {date_str} 自動抽出\n" + "\n".join(items_to_add) + "\n"
    SHARED_PATH.write_text(current + addition, encoding="utf-8")


def main() -> None:
    print("=== Channel Archive Auto Update ===")
    print(f"Time: {datetime.now(TZ).isoformat()}")

    state = load_state()
    date_str = datetime.now(TZ).strftime("%Y-%m-%d")
    shared_items: list[str] = []
    updated_count = 0

    # 注: このスクリプトは単独では動作しません
    # OpenClawのmessageツール経由で実行されるか、
    # 別の方法でDiscord履歴を取得する必要があります
    
    # 今回はフクロウが会話中に判断して追記する仕組みなので、
    # このスクリプトは「状態管理」のみ行います
    
    state["last_run"] = datetime.now(TZ).isoformat()
    save_state(state)
    
    print(f"Updated {updated_count} archives")
    print("=== Done ===")


if __name__ == "__main__":
    main()
