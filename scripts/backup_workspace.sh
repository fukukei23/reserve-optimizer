#!/bin/bash

# Daily Backup Script for OpenClaw Workspace
# 作成日: 2026-03-15
# 実行時刻: 毎日 04:00 JST

# 設定
WORKSPACE_DIR="/home/node/.openclaw/workspace"
BACKUP_DIR="/home/node/.openclaw/workspace/memory/backups"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/workspace_${TIMESTAMP}.tar.gz"

# ログファイル
LOG_FILE="${BACKUP_DIR}/backup.log"

# バックアップ実行
echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] バックアップ開始" >> "$LOG_FILE"

# バックアップ作成（除外対象を指定）
tar -czf "$BACKUP_FILE" \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="*.log" \
  --exclude="memory/backups/*.tar.gz" \
  -C "$(dirname "$WORKSPACE_DIR")" \
  "$(basename "$WORKSPACE_DIR")" 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] バックアップ成功: $BACKUP_FILE" >> "$LOG_FILE"

  # 古いバックアップを削除（30日以上前）
  find "$BACKUP_DIR" -name "workspace_*.tar.gz" -mtime +30 -delete 2>> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] 古いバックアップを削除（30日以上前）" >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] バックアップ失敗" >> "$LOG_FILE"
  exit 1
fi

# バックアップサイズを記録
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] バックアップサイズ: $BACKUP_SIZE" >> "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S JST')] バックアップ完了" >> "$LOG_FILE"

exit 0
