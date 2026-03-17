# Summary - Latest Important Decisions

## 環境
- OpenClaw Gateway: VPS コンテナ運用（Docker）
- OS: Debian 12 (bookworm)
- Browser: Chromium（手動 apt install）

## 制約（重要）
- コンテナ内から docker / systemctl 実行不可（権限なし）
- SSH 鍵は VPS マウントで永続化

## SSH
- 秘密鍵: /home/op/openclaw-stack/openclaw_config/.ssh/id_ed25519
- 公開鍵: ssh-ed25519 AAAAC3...（GitHub Deploy key: openclaw-container）

## モデル配分
- GLM-5: 複雑な分析タスク
- GLM-4.7: ニュース・YouTube 要約
- GPT-5.1-Codex: フォールバック

## 定期タスク
- discord_context_scan: 30 分ごと
- ai_news_digest: 1 日 2 回
- workspace backup: 毎日 04:00

## ログ
- /tmp/openclaw/openclaw-$(date +%F).log
