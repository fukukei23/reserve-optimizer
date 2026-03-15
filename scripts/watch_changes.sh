#!/usr/bin/env bash

# watch_changes.sh
# 重要ファイルの変更を監視して、変更時にバックアップを作成し alert ファイルを出す
# 使う: inotifywait (inotify-tools が必要)

WATCH_FILES=(
  "/home/node/.openclaw/workspace/memory/SHARED.md"
  "/home/node/.openclaw/workspace/MEMORY.md"
  "/home/node/.openclaw/workspace/memory/channel_deletion_policy.md"
  "/home/node/.openclaw/workspace/memory/critical_data_list.md"
  "/home/node/.openclaw/workspace/HEARTBEAT.md"
  "/home/node/.openclaw/workspace/openclaw.json"
  "/home/node/.openclaw/.env"
)

ALERT_DIR="/home/node/.openclaw/workspace/memory/watch_alerts"
BACKUP_DIR="/home/node/.openclaw/workspace/memory/backups"
LOG_FILE="${BACKUP_DIR}/watcher.log"

mkdir -p "$ALERT_DIR"
mkdir -p "$BACKUP_DIR"

# check if inotifywait exists
if ! command -v inotifywait >/dev/null 2>&1; then
  echo "inotifywait not found. Install inotify-tools to use watch_changes.sh" >> "$LOG_FILE"
  exit 0
fi

# build inotifywait args
ARGS=()
for f in "${WATCH_FILES[@]}"; do
  # if file doesn't exist, watch parent directory
  if [ -f "$f" ]; then
    ARGS+=("$f")
  else
    ARGS+=("$(dirname "$f")")
  fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] watcher started" >> "$LOG_FILE"

# main loop
while true; do
  inotifywait -e modify,create,delete,move --format '%w%f %e' "${ARGS[@]}" 2>>"$LOG_FILE" | while read path event; do
    ts=$(date +%Y%m%d_%H%M%S)
    base=$(basename "$path")
    # create backup copy if file exists
    if [ -f "$path" ]; then
      cp -a "$path" "$BACKUP_DIR/${base}.${ts}.bak" 2>>"$LOG_FILE"
      echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] backed up $path -> ${base}.${ts}.bak" >> "$LOG_FILE"
    fi

    # create alert file
    alert_file="${ALERT_DIR}/alert_${ts}.txt"
    echo "timestamp: $(date '+%Y-%m-%d %H:%M:%S JST')" > "$alert_file"
    echo "path: $path" >> "$alert_file"
    echo "event: $event" >> "$alert_file"
    echo "backup: ${base}.${ts}.bak" >> "$alert_file"

    # append to ops-log
    echo "$(date '+%Y-%m-%d %H:%M:%S JST') - WATCHER - $event - $path" >> /home/node/.openclaw/workspace/memory/ops-log.md
  done
done
