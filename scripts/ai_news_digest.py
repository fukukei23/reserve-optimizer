#!/usr/bin/env python3
"""Fetch AI news headlines for specific keywords and format a digest."""

from __future__ import annotations

import html
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

KEYWORDS = [
    ("OpenClaw", "https://news.google.com/rss/search?q=OpenClaw+AI&hl=en-US&gl=US&ceid=US:en"),
    ("GLM", "https://news.google.com/rss/search?q=GLM+AI&hl=en-US&gl=US&ceid=US:en"),
    ("OpenCode", "https://news.google.com/rss/search?q=OpenCode+AI&hl=en-US&gl=US&ceid=US:en"),
    ("Cursor", "https://news.google.com/rss/search?q=Cursor+AI+editor&hl=en-US&gl=US&ceid=US:en"),
]

MAX_ITEMS_PER_FEED = 2
TIMEOUT = 15


def fetch_feed(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "openclaw-news-digest"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:  # nosec - public RSS
        return resp.read().decode("utf-8", errors="replace")


def parse_items(feed_xml: str) -> list[tuple[str, str, str]]:
    items: list[tuple[str, str, str]] = []
    try:
        root = ET.fromstring(feed_xml)
    except ET.ParseError:
        return items
    for item in root.findall(".//item")[:MAX_ITEMS_PER_FEED]:
        title = html.unescape((item.findtext("title") or "").strip())
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        items.append((title, link, pub_date))
    return items


def main() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"AIニュースダイジェスト ({now})"]

    for label, url in KEYWORDS:
        try:
            feed = fetch_feed(url)
            items = parse_items(feed)
        except urllib.error.HTTPError as exc:
            lines.append(f"- {label}: RSS取得エラー {exc.code}")
            continue
        except Exception as exc:  # pylint: disable=broad-except
            lines.append(f"- {label}: RSS取得失敗 ({exc})")
            continue

        if not items:
            lines.append(f"- {label}: 新着なし")
            continue

        lines.append(f"- {label} 最新 {len(items)}件:")
        for title, link, pub_date in items:
            title_short = title[:140]
            lines.append(f"    • {title_short} ({pub_date}) {link}")

    print("\n".join(lines))


if __name__ == "__main__":
    main()
