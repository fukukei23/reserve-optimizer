#!/usr/bin/env python3
"""
クロタム - Discord Bot
スマホのDiscordからClaude Codeを操作するBot
"""

import discord
import asyncio
import subprocess
import os
import json
import tempfile
from pathlib import Path

# 設定
ALLOWED_USER_IDS = [1135078010899398727]  # ふくけいのDiscord ID
TMUX_SESSION = "krokod"
CLAUDE_CMD = "claude --dangerously-skip-permissions"
STATE_FILE = Path.home() / ".claude" / "krotam_state.json"
INBOX_DIR = Path.home() / ".claude" / "krotam_inbox"
INBOX_DIR.mkdir(parents=True, exist_ok=True)

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

client = discord.Client(intents=intents)


def is_allowed(user_id: int) -> bool:
    return user_id in ALLOWED_USER_IDS


def tmux_send(command: str) -> bool:
    """tmuxセッションにコマンドを送信"""
    try:
        # セッション存在確認
        result = subprocess.run(
            ["tmux", "has-session", "-t", TMUX_SESSION],
            capture_output=True
        )
        if result.returncode != 0:
            return False
        # コマンド送信
        subprocess.run([
            "tmux", "send-keys", "-t", TMUX_SESSION,
            command, "Enter"
        ], check=True)
        return True
    except Exception:
        return False


def tmux_capture() -> str:
    """tmuxセッションの現在の画面内容を取得"""
    try:
        result = subprocess.run(
            ["tmux", "capture-pane", "-t", TMUX_SESSION, "-p", "-S", "-50"],
            capture_output=True, text=True
        )
        return result.stdout.strip()
    except Exception:
        return ""


def ensure_claude_running() -> bool:
    """Claude Codeが起動しているか確認、起動していなければ起動"""
    screen = tmux_capture()
    if "❯" in screen or ">" in screen:
        return True
    # Claude Codeを起動
    tmux_send(CLAUDE_CMD)
    asyncio.sleep(3)
    return True


async def wait_for_response(timeout: int = 60) -> str:
    """Claude Codeの応答を待機して取得"""
    await asyncio.sleep(2)
    prev = ""
    stable_count = 0
    for _ in range(timeout):
        await asyncio.sleep(1)
        current = tmux_capture()
        if current == prev:
            stable_count += 1
            if stable_count >= 3:
                return current
        else:
            stable_count = 0
            prev = current
    return tmux_capture()


def extract_response(raw: str) -> str:
    """tmux出力からClaude Codeの応答部分を抽出"""
    lines = raw.split("\n")
    result_lines = []
    capture = False
    for line in lines:
        if "❯" in line or ">" in line:
            capture = True
            continue
        if capture:
            result_lines.append(line)
    text = "\n".join(result_lines).strip()
    # 長すぎる場合は分割
    return text if text else "（応答なし）"


async def send_long_message(channel, text: str):
    """2000文字を超えるメッセージを分割送信"""
    if len(text) <= 1900:
        await channel.send(text)
        return
    chunks = [text[i:i+1900] for i in range(0, len(text), 1900)]
    for chunk in chunks:
        await channel.send(chunk)
        await asyncio.sleep(0.5)


@client.event
async def on_ready():
    print(f"クロタム起動完了: {client.user}")


@client.event
async def on_message(message):
    # Bot自身のメッセージは無視
    if message.author.bot:
        return

    # allowlistチェック
    if not is_allowed(message.author.id):
        return

    content = message.content.strip()

    # 特殊コマンド処理
    if content == "!status":
        screen = tmux_capture()
        await message.channel.send(f"```\n{screen[-500:]}\n```")
        return

    if content == "!restart":
        tmux_send("q")
        await asyncio.sleep(2)
        tmux_send(CLAUDE_CMD)
        await message.channel.send("Claude Codeを再起動しました")
        return

    if content == "!help":
        help_text = """**クロタム コマンド一覧**
`!status` - tmuxセッションの現在の状態を表示
`!restart` - Claude Codeを再起動
`!help` - このヘルプを表示
それ以外のメッセージはすべてClaude Codeに送信されます
ファイルを添付すると~/krotam_inbox/に保存されます"""
        await message.channel.send(help_text)
        return

    # ファイル添付処理
    if message.attachments:
        for attachment in message.attachments:
            file_path = INBOX_DIR / attachment.filename
            await attachment.save(file_path)
            await message.channel.send(
                f"ファイルを保存しました: `{file_path}`"
            )
        if not content:
            return

    # Claude Codeにメッセージ送信
    await message.add_reaction("⏳")
    ensure_claude_running()
    tmux_send(content)

    # 応答待機
    raw = await wait_for_response(timeout=120)
    response = extract_response(raw)

    await message.remove_reaction("⏳", client.user)
    await message.add_reaction("✅")
    await send_long_message(message.channel, response)


def main():
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        # .envから読み込み
        env_file = Path.home() / ".claude" / "krotam.env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("DISCORD_BOT_TOKEN="):
                    token = line.split("=", 1)[1].strip()
                    break
    if not token:
        print("エラー: DISCORD_BOT_TOKEN が設定されていません")
        print(f"~/.claude/krotam.env に設定してください")
        return
    client.run(token)


if __name__ == "__main__":
    main()
