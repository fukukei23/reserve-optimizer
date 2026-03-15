#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/update_daily_note.py"
"$SCRIPT_DIR/daily_summary.py"
