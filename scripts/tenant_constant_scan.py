# scripts/tenant_constant_scan.py
"""C0: GASコードからテナント固有定数を摘出し
TSVインベントリを出力する。

spec §4 C0ゲートの成果物生成ツール。
judgment列は Task 2 で記入するため空で出力する。
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

# (カテゴリ, 正規表現) — 無変更流用の定義の対象=テナント固有値のみ
# 正規表現は行を短く保つため分割定義（r5フィクスチャ整合）
_RE_SHEET = (
    r"'([A-Za-z0-9_-]{25,60})'\s*;\s*//\s*[Ss]heet"
    r"|[Ss]preadsheet[^'\n]*'([A-Za-z0-9_-]{25,60})'"
)
_RE_LINE_ID = r"'(U[0-9a-fA-F]{32})'"
_RE_LINE_TOKEN = (
    r"'([A-Za-z0-9+/=]{100,})'\s*(?://.*)?$"
)
_RE_STRIPE = r"'((?:sk|pk|whsec)_[A-Za-z0-9_]{8,})'"
_RE_WEBAPP = (
    r"'(https://script\.google\.com/macros/s/"
    r"[A-Za-z0-9_-]+/exec)'"
)

PATTERNS = [
    ("spreadsheet_id", re.compile(_RE_SHEET)),
    ("line_channel_id", re.compile(_RE_LINE_ID)),
    ("line_channel_access_token", re.compile(_RE_LINE_TOKEN)),
    ("stripe_key_prefix", re.compile(_RE_STRIPE)),
    ("gas_webapp_url", re.compile(_RE_WEBAPP)),
]

TSV_HEADER = "category\tvalue\tfile\tline\tjudgment"


def scan_file(rel_path: str, content: str) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for lineno, line in enumerate(content.splitlines(), start=1):
        for category, pattern in PATTERNS:
            for match in pattern.finditer(line):
                value = next(g for g in match.groups() if g)
                findings.append({
                    "category": category,
                    "value": value[:40],
                    "file": rel_path,
                    "line": str(lineno),
                    "judgment": "",
                })
    return findings


def scan_repo(root: Path) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    js_files = sorted(root.glob("gas-project/**/*.js"))
    for js in js_files:
        parts = js.parts
        if "tests" in parts or "node_modules" in parts:
            continue
        text = js.read_text(errors="replace")
        rel = str(js.relative_to(root))
        results.extend(scan_file(rel, text))
    return results


def write_tsv(
    findings: list[dict[str, str]], out: Path
) -> None:
    lines = [TSV_HEADER]
    for f in findings:
        row = "\t".join([
            f["category"], f["value"], f["file"],
            f["line"], f["judgment"],
        ])
        lines.append(row)
    out.write_text("\n".join(lines) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="C0 tenant constant scanner"
    )
    parser.add_argument(
        "--repo", type=Path,
        default=Path(__file__).resolve().parent.parent,
    )
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    out = args.out or (args.repo / "docs" / "tenant-constants.tsv")
    findings = scan_repo(args.repo)
    write_tsv(findings, out)
    print(f"scanned: {len(findings)} findings -> {out}")


if __name__ == "__main__":
    main()
