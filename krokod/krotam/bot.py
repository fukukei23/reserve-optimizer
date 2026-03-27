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
import time
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# 設定
ALLOWED_USER_IDS = [1135078010899398727]
TMUX_SESSION = "krokod"
CLAUDE_CMD = "claude --dangerously-skip-permissions"
INBOX_DIR = Path.home() / ".claude" / "krotam_inbox"
LOG_FILE = Path.home() / ".claude" / "krotam_log.jsonl"
INBOX_DIR.mkdir(parents=True, exist_ok=True)

# レートリミット設定
RATE_LIMIT = 10
RATE_WINDOW = 60
rate_counter = defaultdict(list)

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

client = discord.Client(intents=intents)


def is_allowed(user_id: int) -> bool:
    return user_id in ALLOWED_USER_IDS


def check_rate_limit(user_id: int) -> bool:
    now = time.time()
    rate_counter[user_id] = [t for t in rate_counter[user_id] if now - t < RATE_WINDOW]
    if len(rate_counter[user_id]) >= RATE_LIMIT:
        return False
    rate_counter[user_id].append(now)
    return True


def write_log(user_id: int, command: str, result: str = ""):
    entry = {
        "timestamp": datetime.now().isoformat(),
        "user_id": user_id,
        "command": command,
        "result": result[:200] if result else ""
    }
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def tmux_send(command: str) -> bool:
    try:
        result = subprocess.run(
            ["tmux", "has-session", "-t", TMUX_SESSION],
            capture_output=True
        )
        if result.returncode != 0:
            return False
        subprocess.run([
            "tmux", "send-keys", "-t", TMUX_SESSION,
            command, "Enter"
        ], check=True)
        return True
    except Exception:
        return False


def tmux_capture(lines: int = 50) -> str:
    try:
        result = subprocess.run(
            ["tmux", "capture-pane", "-t", TMUX_SESSION, "-p", "-S", f"-{lines}"],
            capture_output=True, text=True
        )
        return result.stdout.strip()
    except Exception:
        return ""


def tmux_interrupt():
    try:
        subprocess.run([
            "tmux", "send-keys", "-t", TMUX_SESSION, "C-c"
        ], check=True)
        return True
    except Exception:
        return False


def ensure_claude_running() -> bool:
    screen = tmux_capture()
    if "❯" in screen or ">" in screen:
        return True
    tmux_send(CLAUDE_CMD)
    return True


async def wait_for_response(timeout: int = 120) -> str:
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
    lines = raw.split("\n")
    result_lines = []
    capture = False
    for line in lines:
        if "❯" in line or ">" in line:
            capture = True
            result_lines = []
            continue
        if capture:
            result_lines.append(line)
    text = "\n".join(result_lines).strip()
    return text if text else "（応答なし）"


async def send_long_message(channel, text: str):
    if len(text) <= 1900:
        await channel.send(f"```\n{text}\n```" if "\n" in text else text)
        return
    chunks = [text[i:i+1900] for i in range(0, len(text), 1900)]
    for chunk in chunks:
        await channel.send(f"```\n{chunk}\n```")
        await asyncio.sleep(0.5)


@client.event
async def on_ready():
    print(f"クロタム起動完了: {client.user}")


@client.event
async def on_message(message):
    if message.author.bot:
        return
    if not is_allowed(message.author.id):
        return

    # レートリミットチェック
    if not check_rate_limit(message.author.id):
        await message.channel.send("⚠️ 送信が速すぎます。少し待ってから再試行してください。")
        return

    content = message.content.strip()
    write_log(message.author.id, content)

    # !help
    if content == "!help":
        help_text = """**クロタム コマンド一覧**

**システム系**
`!status` - tmuxの現在の画面を表示
`!screenshot` - tmuxの直近100行を表示
`!restart` - Claude Codeを再起動
`!abort` - 実行中の処理を中断（Ctrl+C）
`!log` - 直近10件のコマンドログを表示

**ファイル操作**
`!ls [パス]` - ディレクトリ一覧（省略時はホーム）
`!cat <ファイルパス>` - ファイル内容を表示
`!send <ファイルパス>` - ファイルをDiscordに送信（8MB以下）

**Git操作**
`!git` - git statusを表示

**LLM切り替え**
`!mini` - MiniMaxに切り替えてClaude Codeを再起動
`!glm`  - GLMに戻してClaude Codeを再起動

**その他**
`!help` - このヘルプを表示

**通常メッセージ**
コマンド以外のメッセージはすべてClaude Codeに送信されます。
ファイルを添付するとホーム直下の`~/.claude/krotam_inbox/`に保存されます。"""
        await message.channel.send(help_text)
        return

    # !status
    if content == "!status":
        screen = tmux_capture(30)
        await message.channel.send(f"```\n{screen[-1500:]}\n```")
        return

    # !screenshot
    if content == "!screenshot":
        screen = tmux_capture(100)
        await send_long_message(message.channel, screen)
        return

    # !abort
    if content == "!abort":
        tmux_interrupt()
        await message.channel.send("⏹️ 中断シグナルを送信しました（Ctrl+C）")
        return

    # !restart
    if content == "!restart":
        tmux_interrupt()
        await asyncio.sleep(1)
        tmux_send("q")
        await asyncio.sleep(2)
        tmux_send(CLAUDE_CMD)
        await message.channel.send("🔄 Claude Codeを再起動しました")
        return

    # !log
    if content == "!log":
        if not LOG_FILE.exists():
            await message.channel.send("ログがありません")
            return
        lines = LOG_FILE.read_text().strip().split("\n")
        recent = lines[-10:]
        log_text = ""
        for line in recent:
            try:
                entry = json.loads(line)
                log_text += f"`{entry['timestamp'][:16]}` {entry['command'][:50]}\n"
            except Exception:
                continue
        await message.channel.send(f"**直近10件のログ**\n{log_text}")
        return

    # !ls
    if content.startswith("!ls"):
        parts = content.split(maxsplit=1)
        path = parts[1] if len(parts) > 1 else "~"
        result = subprocess.run(
            ["bash", "-c", f"ls -la {path}"],
            capture_output=True, text=True
        )
        output = result.stdout or result.stderr
        await send_long_message(message.channel, output)
        return

    # !cat
    if content.startswith("!cat "):
        file_path = Path(content[5:].strip()).expanduser()
        if not file_path.exists():
            await message.channel.send(f"ファイルが見つかりません: `{file_path}`")
            return
        text = file_path.read_text(errors="replace")
        await send_long_message(message.channel, text[:3000])
        return

    # !send
    if content.startswith("!send "):
        file_path = Path(content[6:].strip()).expanduser()
        if not file_path.exists():
            await message.channel.send(f"ファイルが見つかりません: `{file_path}`")
            return
        if file_path.stat().st_size > 8 * 1024 * 1024:
            await message.channel.send("ファイルサイズが8MBを超えています")
            return
        await message.channel.send(file=discord.File(str(file_path)))
        return

    # !git
    if content == "!git":
        result = subprocess.run(
            ["bash", "-c", "cd ~ && git status 2>/dev/null || echo 'gitリポジトリではありません'"],
            capture_output=True, text=True
        )
        await send_long_message(message.channel, result.stdout or result.stderr)
        return

    # !mini - MiniMaxに切り替え
    if content == "!mini":
        await message.channel.send("⏳ MiniMaxに切り替え中...")
        settings_path = Path.home() / ".claude" / "settings.json"
        try:
            settings = json.loads(settings_path.read_text())
            settings["env"]["ANTHROPIC_BASE_URL"] = "https://api.minimax.io/anthropic"
            settings["env"]["ANTHROPIC_AUTH_TOKEN"] = os.environ.get("MINIMAX_API_KEY", "")
            settings["env"]["ANTHROPIC_DEFAULT_OPUS_MODEL"] = "MiniMax-M2.7"
            settings["env"]["ANTHROPIC_DEFAULT_SONNET_MODEL"] = "MiniMax-M2.7"
            settings["env"]["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = "MiniMax-M2.5-highspeed"
            settings_path.write_text(json.dumps(settings, ensure_ascii=False, indent=2))
            # Claude Code再起動
            tmux_interrupt()
            await asyncio.sleep(2)
            tmux_send("q")
            await asyncio.sleep(2)
            tmux_send("claude --dangerously-skip-permissions")
            await asyncio.sleep(5)
            await message.channel.send("✅ MiniMaxに切り替えました")
        except Exception as e:
            await message.channel.send(f"❌ エラー: {e}")
        return

    # !glm - GLMに戻す
    if content == "!glm":
        await message.channel.send("⏳ GLMに切り替え中...")
        settings_path = Path.home() / ".claude" / "settings.json"
        try:
            settings = json.loads(settings_path.read_text())
            settings["env"]["ANTHROPIC_BASE_URL"] = "https://api.z.ai/api/anthropic"
            settings["env"]["ANTHROPIC_AUTH_TOKEN"] = os.environ.get("ANTHROPIC_AUTH_TOKEN", "")
            settings["env"]["ANTHROPIC_DEFAULT_OPUS_MODEL"] = "GLM-5-Turbo"
            settings["env"]["ANTHROPIC_DEFAULT_SONNET_MODEL"] = "GLM-5"
            settings["env"]["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = "GLM-4.7"
            settings_path.write_text(json.dumps(settings, ensure_ascii=False, indent=2))
            # Claude Code再起動
            tmux_interrupt()
            await asyncio.sleep(2)
            tmux_send("q")
            await asyncio.sleep(2)
            tmux_send("claude --dangerously-skip-permissions")
            await asyncio.sleep(5)
            await message.channel.send("✅ GLMに切り替えました")
        except Exception as e:
            await message.channel.send(f"❌ エラー: {e}")
        return

    # ファイル添付処理
    if message.attachments:
        for attachment in message.attachments:
            file_path = INBOX_DIR / attachment.filename
            await attachment.save(file_path)
            await message.channel.send(f"📥 保存しました: `{file_path}`")
        if not content:
            return

    # Claude Codeにメッセージ送信
    await message.add_reaction("⏳")
    ensure_claude_running()
    tmux_send(content)

    raw = await wait_for_response(timeout=120)
    response = extract_response(raw)

    await message.remove_reaction("⏳", client.user)
    await message.add_reaction("✅")

    # タスク完了メンション
    mention = f"<@{message.author.id}> ✅ 完了\n"
    await send_long_message(message.channel, mention + response)


def main():
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        env_file = Path.home() / ".claude" / "krotam.env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("DISCORD_BOT_TOKEN="):
                    token = line.split("=", 1)[1].strip()
                    break
    if not token:
        print("エラー: DISCORD_BOT_TOKEN が設定されてません")
        return
    client.run(token)


if __name__ == "__main__":
    main()
