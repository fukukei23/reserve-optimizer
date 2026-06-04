#!/usr/bin/env python3
"""
reserve-optimizer デモ録画スクリプト v2
========================================
cast → Pillow → ffmpeg で CLI デモ GIF/MP4 を生成

使用方法:
    python scripts/record_demo.py              # 全シーン生成
    python scripts/record_demo.py --scene 1     # シーン1のみ
    python scripts/record_demo.py --list        # シーン一覧
"""

import os
import json
import time
import subprocess
import argparse
from pathlib import Path

# ============================================================================
# 設定
# ============================================================================
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
DEMO_DIR = PROJECT_ROOT / "docs" / "demo"
CAST_DIR = DEMO_DIR / "casts"
PNG_DIR = DEMO_DIR / "frames"
GIF_DIR = DEMO_DIR / "gifs"
MP4_DIR = DEMO_DIR / "mp4"

FPS = 10
WIDTH = 80
HEIGHT = 24

BG_COLOR = (40, 44, 52)
TEXT_COLOR = (220, 223, 228)
PROMPT_COLOR = (86, 156, 214)
HEADER_COLOR = (106, 153, 78)
GREEN = (106, 153, 78)
RED = (204, 85, 85)
BLUE = (97, 175, 239)
YELLOW = (227, 179, 65)

# ============================================================================
# シーン定義
# ============================================================================
SCENES = [
    {
        "id": 1,
        "name": "webbooking",
        "title": "Web予約フロー",
        "cast_file": "01_webbooking.cast",
        "gif_file": "01_webbooking.gif",
        "mp4_file": "01_webbooking.mp4",
        "duration": 30,
        "output": """=== RESERVE OPTIMIZER ===

LINE Bot + Web予約システム
━━━━━━━━━━
Cloudflare Worker + GAS + Stripe

$ node gas-project/run-cli.js status

[DATE] 今日の予約
━━━━━━━━━━━━━━━━━━
09:00 田辺様（初診60分）
10:30 田中様（再診30分）
14:00 鈴木様（初診60分）

[AUTO] 予約フロー
━━━━━━━━━━━━━━━━━━
① 顧客: LINEで「予約」と送信
② Bot:  Button Messageで返信
③ 顧客:  クイックリプライで選択
④ Bot:  GAS → Spreadsheet記録
⑤ Bot:  Stripe Checkout案内
⑥ 顧客:  デポジット決済（¥1,000）
⑦ Bot:  予約確定メッセージ送信"""
    },
    {
        "id": 2,
        "name": "stripe_payment",
        "title": "Stripe決済",
        "cast_file": "02_stripe.cast",
        "gif_file": "02_stripe.gif",
        "mp4_file": "02_stripe.mp4",
        "duration": 25,
        "output": """=== Stripe Checkout ===

$ node gas-project/run-cli.js payment --create

[PAY] 決済セッション作成
━━━━━━━━━━━━━━━━━━
 amount:  ¥1,000 (デポジット)
 currency: JPY
 customer:田中 太郎

[LINK] Checkout URL生成
━━━━━━━━━━━━━━━━━━
 https://checkout.stripe.com/...
 payment_id: pi_3abc123xyz

⏳ 顧客決済待機中...
[OK] 決済完了通知受信
   payment_id: pi_3abc123xyz
   amount: ¥1,000
   status: succeeded

[STAT] 月次サマリー
━━━━━━━━━━━━━━━━━━
 今月: 45件 ¥45,000
 前月: 38件 ¥38,000
 成長率: +18.4%"""
    },
    {
        "id": 3,
        "name": "ai_chatbot",
        "title": "AIチャットBot",
        "cast_file": "03_ai_chat.cast",
        "gif_file": "03_ai_chat.gif",
        "mp4_file": "03_ai_chat.mp4",
        "duration": 20,
        "output": """=== AI Q&A Bot (MiniMax) ===

$ node gas-project/run-cli.js chat --message "予約変更したい"

[AI] AI回答生成中...
━━━━━━━━━━━━━━━━━━
Model: MiniMax M2.7
Temperature: 0.7

[CHAT] 回答:
━━━━━━━━━━━━━━━━━━
予約変更をご希望ですね。
以下の方法でお手続きできます:

1. LINEで「変更」と送信
2. 予約IDと新しい日時を入力

お困りのことがあれば
もう一度ご質問ください :)

[TIME] 処理時間: 1.2秒
[COST] コスト: ¥0.08"""
    },
    {
        "id": 4,
        "name": "i18n",
        "title": "多言語対応",
        "cast_file": "04_i18n.cast",
        "gif_file": "04_i18n.gif",
        "mp4_file": "04_i18n.mp4",
        "duration": 20,
        "output": """=== i18n (多言語対応) ===

$ node gas-project/run-cli.js i18n --list

[GLOBE] 対応言語
━━━━━━━━━━━━━━━━━━
ja: 日本語 (デフォルト)
en: English
zh: 中文（简体）
zh-TW: 中文（繁体）
ko: 한국어
th: ภาษาไทย

[WEB] 外国人観光客対応
━━━━━━━━━━━━━━━━━━
対応国: 45カ国
前年比: +23%

英語での予約例:
"I'd like to book a 60min
 treatment for tomorrow 10am"

[OK] 多言語Bot自動返信"""
    },
]

# ============================================================================
# ユーティリティ
# ============================================================================

def ensure_dirs():
    for d in [CAST_DIR, PNG_DIR, GIF_DIR, MP4_DIR]:
        d.mkdir(parents=True, exist_ok=True)
    print(f"📁 出力ディレクトリ: {DEMO_DIR}")


def cast_to_png_frames(cast_path: Path, png_dir: Path, fps: int, duration: float) -> list:
    print(f"   🖼️  PNGフレーム生成中...")
    png_dir.mkdir(parents=True, exist_ok=True)

    from PIL import Image, ImageDraw, ImageFont

    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    font_size = 14
    try:
        font = ImageFont.truetype(font_path, font_size)
    except:
        font = ImageFont.load_default()

    line_h = font_size + 6
    char_w = font_size // 2 + 2
    margin = 20
    canvas_w = WIDTH * char_w + margin * 2
    canvas_h = HEIGHT * line_h + margin * 2

    events = []
    if cast_path.exists():
        with open(cast_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    if isinstance(event, list) and len(event) >= 3:
                        events.append(event)
                except:
                    continue

    total_frames = int(duration * fps)
    frame_times = [i / fps for i in range(total_frames)]

    png_files = []
    for i, t in enumerate(frame_times):
        frame_path = png_dir / f"frame_{i:04d}.png"
        img = Image.new("RGB", (canvas_w, canvas_h), BG_COLOR)
        draw = ImageDraw.Draw(img)

        text_y = margin
        for event in events:
            event_time, event_type, text = event[0], event[1], event[2]
            if event_time > t:
                break
            if event_type == "o" and text:
                for line_text in text.replace("\r\n", "\n").replace("\r", "").split("\n"):
                    if line_text.strip():
                        if line_text.startswith("$"):
                            color = PROMPT_COLOR
                        elif line_text.startswith("===") or line_text.startswith("━━"):
                            color = HEADER_COLOR
                        elif line_text.startswith("[OK]") or line_text.startswith("+"):
                            color = GREEN
                        elif line_text.startswith("[WARN]") or line_text.startswith("[FAIL]"):
                            color = RED
                        elif line_text.startswith("[AI]") or line_text.startswith("[CHAT]"):
                            color = BLUE
                        elif line_text.startswith("[PAY]") or line_text.startswith("[COST]"):
                            color = YELLOW
                        else:
                            color = TEXT_COLOR
                        draw.text((margin, text_y), line_text, font=font, fill=color)
                        text_y += line_h
                        if text_y > canvas_h - margin:
                            break

        img.save(frame_path, "PNG")
        png_files.append(frame_path)

        if (i + 1) % 50 == 0:
            print(f"   [STAT] {i + 1}/{total_frames} フレーム")

    print(f"   [OK] PNG生成完了: {len(png_files)} フレーム")
    return png_files


def png_to_gif(png_files: list, gif_path: Path, fps: int) -> bool:
    if not png_files:
        return False
    print(f"   🎬 GIF生成中...")

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False) as f:
        for p in png_files:
            f.write(f"file '{p}'\n")
        concat_file = f.name

    ffmpeg = os.path.expanduser("~/.local/bin/ffmpeg")
    try:
        subprocess.run([
            ffmpeg, "-y", "-f", "concat", "-safe", "0",
            "-i", concat_file,
            "-vf", f"fps={fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
            "-loop", "0", str(gif_path)
        ], check=True, capture_output=True)
        print(f"   [OK] GIF生成: {gif_path.name} ({gif_path.stat().st_size // 1024}KB)")
        return True
    except subprocess.CalledProcessError:
        return False
    finally:
        Path(concat_file).unlink()


def png_to_mp4(png_files: list, mp4_path: Path, fps: int) -> bool:
    if not png_files:
        return False
    print(f"   🎬 MP4生成中...")

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False) as f:
        for p in png_files:
            f.write(f"file '{p}'\n")
        concat_file = f.name

    ffmpeg = os.path.expanduser("~/.local/bin/ffmpeg")
    try:
        subprocess.run([
            ffmpeg, "-y", "-f", "concat", "-safe", "0",
            "-i", concat_file,
            "-vf", f"fps={fps}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            str(mp4_path)
        ], check=True, capture_output=True)
        print(f"   [OK] MP4生成: {mp4_path.name} ({mp4_path.stat().st_size // 1024}KB)")
        return True
    except subprocess.CalledProcessError:
        return False
    finally:
        Path(concat_file).unlink()


def generate_sample_cast(scene: dict) -> Path:
    cast_path = CAST_DIR / scene["cast_file"]

    with open(cast_path, "w") as f:
        header = {"version": 2, "width": WIDTH, "height": HEIGHT,
                  "timestamp": int(time.time()), "env": {"TERM": "xterm-256color"}}
        f.write(json.dumps(header) + "\n")

        timestamp = 0.0
        for line in scene["output"].split("\n"):
            f.write(json.dumps([round(timestamp, 4), "o", line + "\r\n"]) + "\n")
            timestamp += 0.15

        f.write(json.dumps([round(timestamp, 4), "o", "$ "]) + "\n")

    print(f"   [OK] Cast生成: {cast_path.name}")
    return cast_path


def process_scene(scene: dict, generate: bool = True) -> dict:
    result = {"scene": scene["name"], "success": False}
    print(f"\n🎬 シーン {scene['id']}: {scene['title']}")

    cast_path = CAST_DIR / scene["cast_file"]
    if generate or not cast_path.exists():
        cast_path = generate_sample_cast(scene)

    png_dir = PNG_DIR / scene["name"]
    png_files = cast_to_png_frames(cast_path, png_dir, FPS, scene["duration"])
    if not png_files:
        return result

    gif_path = GIF_DIR / scene["gif_file"]
    mp4_path = MP4_DIR / scene["mp4_file"]

    if png_to_gif(png_files, gif_path, FPS):
        result["gif"] = str(gif_path)
    if png_to_mp4(png_files, mp4_path, FPS):
        result["mp4"] = str(mp4_path)

    result["success"] = True
    return result


def main():
    parser = argparse.ArgumentParser(description="reserve-optimizer Demo Recorder")
    parser.add_argument("--scene", type=int, choices=range(1, 5),
                        help="特定シーンのみ処理")
    parser.add_argument("--list", action="store_true", help="シーン一覧")

    args = parser.parse_args()
    ensure_dirs()

    if args.list:
        print("\n[LIST] シーン一覧:")
        for s in SCENES:
            print(f"  {s['id']}. {s['title']} ({s['duration']}秒)")
        return

    scenes = [s for s in SCENES if not args.scene or s["id"] == args.scene]
    print(f"\n🎬 reserve-optimizer Demo Recorder — 対象: {[s['id'] for s in scenes]}")

    results = []
    for scene in scenes:
        try:
            result = process_scene(scene, generate=True)
            results.append(result)
        except Exception as e:
            print(f"\n[FAIL] エラー: {e}")
            continue

    success = sum(1 for r in results if r["success"])
    print(f"\n[OK] 成功: {success}/{len(results)} シーン")


if __name__ == "__main__":
    main()