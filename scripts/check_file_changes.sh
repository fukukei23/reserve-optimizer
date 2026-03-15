#!/bin/bash

# check_file_changes.sh
# 重要ファイルのハッシュをチェックし、変更があればバックアップ＆通知
# inotify-tools 不要

WATCH_FILES=(
  "/home/node/.openclaw/workspace/memory/SHARED.md"
  "/home/node/.openclaw/workspace/memory/MEMORY.md"
  "/home/node/.openclaw/workspace/memory/channel_deletion_policy.md"
  "/home/node/.openclaw/workspace/memory/critical_data_list.md"
  "/home/node/.openclaw/workspace/memory/ops-log.md"
  "/home/node/.openclaw/workspace/HEARTBEAT.md"
  "/home/node/.openclaw/workspace/openclaw.json"
  "/home/node/.openclaw/.env"
)

HASH_DIR="/home/node/.openclaw/workspace/memory/file_hashes"
BACKUP_DIR="/home/node/.openclaw/workspace/memory/backups"
ALERT_DIR="/home/node/.openclaw/workspace/memory/watch_alerts"
LOG_FILE="${BACKUP_DIR}/change_check.log"

mkdir -p "$HASH_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$ALERT_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] チェック開始" >> "$LOG_FILE"

for file in "${WATCH_FILES[@]}"; do
  if [ -f "$file" ]; then
    # 現在のハッシュを計算
    current_hash=$(md5sum "$file" | cut -d' ' -f1)
    hash_file="${HASH_DIR}/$(echo "$file" | tr '/' '_').hash"

    # 前回のハッシュと比較
    if [ -f "$hash_file" ]; then
      previous_hash=$(cat "$hash_file")

      if [ "$current_hash" != "$previous_hash" ]; then
        # 変更検知
        ts=$(date +%Y%m%d_%H%M%S)
        base=$(basename "$file")

        # バックアップ作成
        cp -a "$file" "${BACKUP_DIR}/${base}.${ts}.bak" 2>> "$LOG_FILE"

        # アラートファイル作成
        alert_file="${ALERT_DIR}/alert_${ts}.txt"
        echo "timestamp: $(date '+%Y-%m-%d %H:%M:%S JST')" > "$alert_file"
        echo "file: $file" >> "$alert_file"
        echo "event: modified" >> "$alert_file"
        echo "previous_hash: $previous_hash" >> "$alert_file"
        echo "current_hash: $current_hash" >> "$alert_file"
        echo "backup: ${BACKUP_DIR}/${base}.${ts}.bak" >> "$alert_file"

        # ログ記録
        echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] 変更検知: $file" >> "$LOG_FILE"
        echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] → バックアップ: ${base}.${ts}.bak" >> "$LOG_FILE"

        # ハッシュ更新
        echo "$current_hash" > "$hash_file"
      fi
    else
      # 初回はハッシュを保存するだけ
      echo "$current_hash" > "$hash_file"
      echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] 初回ハッシュ保存: $file" >> "$LOG_FILE"
    fi
  fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] チェック完了" >> "$LOG_FILE"
