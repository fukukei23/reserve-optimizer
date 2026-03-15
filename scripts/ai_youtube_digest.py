#!/usr/bin/env python3
"""Daily digest of AI YouTube channels with summaries."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

TZ = ZoneInfo("Asia/Tokyo")
YT_DLP = Path.home() / ".local" / "bin" / "yt-dlp"

# Target AI YouTubers
YOUTUBERS = [
    {
        "name": "Matt Wolfe",
        "channel_url": "https://www.youtube.com/@mreflow",
        "description": "AI news, tools, and practical tutorials",
    },
    {
        "name": "Two Minute Papers",
        "channel_url": "https://www.youtube.com/channel/UCbfYPyITQ-7l4upoX8nvctg",
        "description": "AI research breakthroughs explained",
    },
    {
        "name": "AI Explained",
        "channel_url": "https://www.youtube.com/@aiexplained-official",
        "description": "AI concepts and news for all audiences",
    },
    {
        "name": "Matthew Berman",
        "channel_url": "https://www.youtube.com/@matthew_berman",
        "description": "AI, open source, and futurism",
    },
    {
        "name": "AI Daily Brief",
        "channel_url": "https://www.youtube.com/channel/UCKelCK4ZaO6HeEI1KQjqzWA",
        "description": "Daily AI news updates",
    },
]


@dataclass
class VideoInfo:
    title: str
    url: str
    channel: str
    description: str
    transcript: str | None = None
    summary: str | None = None


def get_latest_video(channel_url: str) -> VideoInfo | None:
    """Get the latest video from a channel."""
    cmd = [
        str(YT_DLP),
        "--flat-playlist",
        "--playlist-end", "1",
        "--dump-json",
        channel_url,
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            print(f"yt-dlp error for {channel_url}: {result.stderr}")
            return None
        
        data = json.loads(result.stdout)
        return VideoInfo(
            title=data.get("title", "Unknown"),
            url=f"https://www.youtube.com/watch?v={data.get('id', '')}",
            channel=data.get("channel", "Unknown"),
            description=data.get("description", ""),
        )
    except Exception as e:
        print(f"Error fetching video from {channel_url}: {e}")
        return None


def get_transcript(video_url: str) -> str | None:
    """Download transcript/subtitles for a video."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = os.path.join(tmpdir, "transcript")
        cmd = [
            str(YT_DLP),
            "--write-auto-sub",
            "--sub-lang", "en",
            "--skip-download",
            "--sub-format", "vtt",
            "-o", output_template,
            video_url,
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                # Try without auto-sub
                cmd[1] = "--write-sub"
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if result.returncode != 0:
                    return None
            
            # Find the VTT file
            for f in os.listdir(tmpdir):
                if f.endswith(".vtt"):
                    vtt_path = os.path.join(tmpdir, f)
                    with open(vtt_path, "r", encoding="utf-8") as fp:
                        content = fp.read()
                    # Clean VTT format
                    lines = []
                    for line in content.split("\n"):
                        if not line.strip().isdigit() and "-->" not in line and not line.startswith("WEBVTT"):
                            lines.append(line.strip())
                    return " ".join(filter(None, lines))
            
            return None
        except Exception as e:
            print(f"Error getting transcript for {video_url}: {e}")
            return None


def summarize_with_llm(video: VideoInfo) -> str:
    """Summarize video content using LLM with detailed, comprehensive summary."""
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    # Use more transcript content for detailed summary
    transcript_text = video.transcript[:15000] if video.transcript else "字幕なし"
    description_text = video.description[:2000] if video.description else ""
    
    prompt = f"""以下のYouTube動画の内容を、動画を見なくても内容が完全に理解できるレベルで詳細に日本語で要約してください。

**動画情報**:
- タイトル: {video.title}
- チャンネル: {video.channel}
- URL: {video.url}

**動画の説明**:
{description_text}

**字幕内容**:
{transcript_text}

---

以下のフォーマットで出力してください：

## 📌 概要（3-5文で全体の要約）

## 🔑 主要なポイント（5-10個の詳細な箇条書き）
- （具体的な内容、数字、名前などを含める）

## 💡 重要な洞察・結論
（動画全体の結論や、視聴者が得られる価値）

## 📊 具体的な内容・詳細
（技術的な詳細、具体例、引用など）

## 🔗 関連情報
- 動画URL: {video.url}
- （動画内で言及されたツール、サービス、論文などがあれば）

※必ず字幕の内容を活用して、動画を見なくても内容が理解できるレベルで詳細に書くこと。"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.5,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error summarizing: {e}")
        return f"要約エラー: {e}"


def create_simple_summary(video: VideoInfo) -> str:
    """Create a simple summary without LLM."""
    return f"""**{video.title}**
📺 {video.channel}
🔗 {video.url}

{video.description[:300]}...
"""


def main() -> None:
    print(f"=== AI YouTube Digest - {datetime.now(TZ).strftime('%Y-%m-%d %H:%M')} JST ===\n")
    
    summaries = []
    
    for youtuber in YOUTUBERS:
        print(f"Checking: {youtuber['name']}...")
        video = get_latest_video(youtuber["channel_url"])
        
        if not video:
            print(f"  ❌ No video found")
            continue
        
        print(f"  ✓ Found: {video.title}")
        
        # Try to get transcript
        transcript = get_transcript(video.url)
        if transcript:
            video.transcript = transcript
            print(f"  ✓ Got transcript ({len(transcript)} chars)")
        
        # Summarize
        if OpenAI and os.environ.get("OPENAI_API_KEY"):
            video.summary = summarize_with_llm(video)
        else:
            video.summary = create_simple_summary(video)
        
        summaries.append(asdict(video))
        print()
    
    # Output JSON
    output = {
        "generated_at": datetime.now(TZ).isoformat(),
        "summaries": summaries,
    }
    
    print(json.dumps(output, ensure_ascii=False, indent=2))
    
    # Save to file
    output_path = Path("/home/node/.openclaw/workspace/memory/ai_youtube_digest.json")
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✓ Saved to {output_path}")


if __name__ == "__main__":
    main()
