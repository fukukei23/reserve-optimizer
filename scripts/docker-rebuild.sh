#!/bin/bash
# Docker再ビルドスクリプト（dry-run対応）
# 使用方法: ./docker-rebuild.sh [--dry-run]

set -e

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 DRY-RUN モード: コマンドを表示のみ（実行しません）"
  echo ""
fi

# 設定
OPENCLAW_SRC="/home/op/openclaw-src"
OPENCLAW_STACK="/home/op/openclaw-stack"
IMAGE_NAME="openclaw-custom:latest"

# コマンド実行関数
run() {
  if $DRY_RUN; then
    echo "[DRY-RUN] $@"
  else
    echo "▶ 実行: $@"
    "$@"
  fi
}

echo "========================================"
echo "🐳 OpenClaw Docker再ビルド"
echo "========================================"
echo ""

# 手順1: ソースディレクトリへ移動
echo "📂 手順1: ソースディレクトリへ移動"
if [[ -d "$OPENCLAW_SRC" ]]; then
  echo "  → 既存ディレクトリを使用: $OPENCLAW_SRC"
  run cd "$OPENCLAW_SRC"
  echo "  → git pull で更新"
  run git pull
else
  echo "  → 新規クローン作成"
  run cd /home/op
  run git clone https://github.com/openclaw/openclaw.git openclaw-src
  run cd "$OPENCLAW_SRC"
fi
echo ""

# 手順2: イメージビルド
echo "🏗️ 手順2: カスタムイメージをビルド"
echo "  → ブラウザ(Chromium) + inotify-tools を含める"
run docker build \
  --build-arg OPENCLAW_INSTALL_BROWSER=1 \
  --build-arg OPENCLAW_DOCKER_APT_PACKAGES="inotify-tools" \
  -t "$IMAGE_NAME" .
echo ""

# 手順3: docker-compose.yml確認
echo "📝 手順3: docker-compose.yml の image: を確認"
COMPOSE_FILE="$OPENCLAW_STACK/docker-compose.yml"
if grep -q "image: openclaw-custom:latest" "$COMPOSE_FILE" 2>/dev/null; then
  echo "  ✅ 既に openclaw-custom:latest が設定されています"
else
  echo "  ⚠️  image: 行を openclaw-custom:latest に変更してください"
  echo "  ファイル: $COMPOSE_FILE"
  if ! $DRY_RUN; then
    echo "  自動変更しますか？ (y/n)"
    read -r answer
    if [[ "$answer" == "y" ]]; then
      sed -i 's|image:.*|image: openclaw-custom:latest|' "$COMPOSE_FILE"
      echo "  ✅ 変更完了"
    fi
  fi
fi
echo ""

# 手順4: コンテナ再作成
echo "🔄 手順4: コンテナ再作成"
run cd "$OPENCLAW_STACK"
run docker compose down
run docker compose up -d
echo ""

# 手順5: 動作確認
echo "✅ 手順5: 動作確認"
if ! $DRY_RUN; then
  echo "  → Chromium 確認:"
  docker compose exec openclaw-gateway which chromium && echo "    ✅ OK" || echo "    ❌ NG"
  echo "  → inotifywait 確認:"
  docker compose exec openclaw-gateway which inotifywait && echo "    ✅ OK" || echo "    ❌ NG"
else
  echo "  [DRY-RUN] 動作確認はスキップ"
fi
echo ""

echo "========================================"
echo "🎉 完了！"
echo "========================================"
