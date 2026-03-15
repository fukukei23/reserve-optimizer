#!/usr/bin/env python3
"""Fetch AI news with summaries and publish dates."""

from __future__ import annotations

import html
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

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


def parse_items(feed_xml: str) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    try:
        root = ET.fromstring(feed_xml)
    except ET.ParseError:
        return items
    for item in root.findall(".//item")[:MAX_ITEMS_PER_FEED]:
        title = html.unescape((item.findtext("title") or "").strip())
        link = (item.findtext("link") or "").strip()
        items.append((title, link))
    return items


def fetch_article(url: str) -> tuple[str, str | None, str]:
    """Fetch article and extract publish date and content."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:  # nosec
            html_content = resp.read().decode("utf-8", errors="replace")

        # Extract publish date from various meta tags
        publish_date = extract_publish_date(html_content)

        # Extract article content (simple text extraction)
        content = extract_article_content(html_content)

        return content, publish_date, url
    except Exception as exc:  # pylint: disable=broad-except
        return "", f"取得失敗: {exc}", url


def extract_publish_date(html_content: str) -> str | None:
    """Extract publish date from various meta tags."""
    patterns = [
        r'<meta[^>]*property=["\']article:published_time["\'][^>]*content=["\']([^"\']+)["\']',
        r'<meta[^>]*name=["\']date["\'][^>]*content=["\']([^"\']+)["\']',
        r'<meta[^>]*name=["\']pubdate["\'][^>]*content=["\']([^"\']+)["\']',
        r'<time[^>]*datetime=["\']([^"\']+)["\']',
    ]

    for pattern in patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            date_str = match.group(1)
            # Try to parse and format the date
            try:
                # Parse ISO 8601 date
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                # Convert to JST
                jst = dt + timedelta(hours=9)
                return jst.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def extract_article_content(html_content: str) -> str:
    """Extract main article content from HTML."""
    # Remove script and style tags
    html_content = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html_content, flags=re.DOTALL)

    # Extract text from p, h1-h6, li tags
    tags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']
    text_parts = []

    for tag in tags:
        pattern = rf'<{tag}[^>]*>(.*?)</{tag}>'
        matches = re.findall(pattern, html_content, re.DOTALL | re.IGNORECASE)
        for match in matches:
            # Remove HTML entities and clean up whitespace
            text = html.unescape(re.sub(r'\s+', ' ', match).strip())
            if len(text) > 50:  # Only keep substantial content
                text_parts.append(text)

    return ' '.join(text_parts[:10])  # Limit to first 10 paragraphs


def main() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"AIニュースダイジェスト: {now}"]

    all_articles = []

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

        for title, link in items:
            content, publish_date, _ = fetch_article(link)
            if content:
                all_articles.append({
                    "label": label,
                    "title": title,
                    "content": content[:500],  # Limit content for summarization
                    "publish_date": publish_date,
                    "link": link
                })

    # Print JSON for further processing by OpenClaw
    import json
    print(json.dumps({"articles": all_articles}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
