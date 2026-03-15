#!/usr/bin/env python3
"""Fetch AI news using Brave Search and format a digest."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone

QUERIES = [
    "OpenClaw AI news",
    "GLM-5 AI news",
    "OpenCode AI coding agents news",
    "Cursor AI editor news",
]

MAX_RESULTS_PER_QUERY = 3
TIMEOUT = 30


def run_brave_search(query: str) -> dict:
    """Run Brave search using openclaw CLI."""
    cmd = [
        "python3", "-c",
        f'''
import json
import os
import sys
from openclaw.tools import web_search

result = web_search(
    query="{query}",
    count={MAX_RESULTS_PER_QUERY},
    language="en",
    country="ALL"
)
print(json.dumps(result))
'''
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
            cwd="/home/node/.openclaw/workspace"
        )

        if result.returncode != 0:
            print(f"Search failed: {result.stderr}", file=sys.stderr)
            return {"results": []}

        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        print(f"Search timeout for: {query}", file=sys.stderr)
        return {"results": []}
    except Exception as exc:  # pylint: disable=broad-except
        print(f"Search error for {query}: {exc}", file=sys.stderr)
        return {"results": []}


def format_publish_date(published_str: str | None) -> str:
    """Format publish date from search result."""
    if not published_str:
        return "取得不可"

    # Parse relative dates like "2 days ago", "1 week ago"
    if "ago" in published_str.lower():
        return published_str.strip()

    # Try to parse ISO dates
    try:
        dt = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
        jst = dt.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta=timedelta(hours=9)))
        return jst.strftime("%Y-%m-%d")
    except Exception:  # pylint: disable=broad-except
        return published_str


def main() -> None:
    from datetime import timedelta

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"AIニュースダイジェスト: {now}"]

    all_articles = []

    for query in QUERIES:
        search_result = run_brave_search(query)

        if not search_result.get("results"):
            lines.append(f"- {query}: 検索結果なし")
            continue

        for item in search_result["results"][:MAX_RESULTS_PER_QUERY]:
            title = item.get("title", "").strip()
            url = item.get("url", "").strip()
            description = item.get("description", "").strip()
            published = format_publish_date(item.get("published"))
            site_name = item.get("siteName", "Unknown")

            if not title or not url:
                continue

            all_articles.append({
                "title": title,
                "url": url,
                "description": description,
                "published": published,
                "site_name": site_name,
                "query": query
            })

    # Print JSON for further processing by OpenClaw
    print(json.dumps({"articles": all_articles}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
