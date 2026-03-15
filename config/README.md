# OpenClaw Configuration

OpenClaw Gatewayの設定ファイル。

## ファイル

| ファイル | 内容 |
|----------|------|
| **openclaw.json** | システム設定（機密情報は変数化済み） |

## 機密情報

以下は環境変数で管理（このリポジトリには含めない）：
- `GLM_API_KEY`
- `OPENAI_API_KEY`
- `DISCORD_BOT_TOKEN`
- `BRAVE_API_KEY`
- その他APIキー

## 復旧手順

1. VPSで `.env` に環境変数を設定
2. `openclaw.json` を `~/.openclaw/openclaw.json` にコピー
3. `docker compose restart` で反映

## 変更履歴

Gitのコミット履歴で管理。
