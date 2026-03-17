# OpenClaw 運用手順（チーム用）

## VPS での操作

### コンテナ再起動
```bash
cd /home/op/openclaw-stack
docker compose restart openclaw-gateway
```

### ログ確認
```bash
# リアルタイム監視
docker compose logs -f openclaw-gateway

# モデル確認（最新）
docker compose exec openclaw-gateway tail -f /tmp/openclaw/openclaw-$(date +%F).log
```

### 環境変数反映
```bash
cd /home/op/openclaw-stack
docker compose down
docker compose up -d
```

### SSH 鍵の永続化
- 秘密鍵場所: `/home/op/openclaw-stack/openclaw_config/.ssh/id_ed25519`
- コンテナに読み取り専用でマウント済み

### 新しいリポジトリへのアクセス追加
1. https://github.com/fukukei23/&lt;リポジトリ名&gt;/settings/keys
2. Add deploy key → Title: `openclaw-container`
3. 公開鍵を貼り付け → Add key
