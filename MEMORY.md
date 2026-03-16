# MEMORY.md - Long-term Memory

## Discord Server Structure
- **Server ID**: 1479832235044769872
- **構成**: ふくけい（ユーザー）とフクロウ（AI）の2名のみ
- **今後も変更なし**: この構成は変わらない前提で運用する
- **全チャンネルで即応答**: メンションなしでも全メッセージに返信する

## Infrastructure

### OpenClaw Gateway
- **Environment**: VPS
- **OS**: Debian GNU/Linux 12 (bookworm)
- **Browser**: Not installed (Chromium needed for browser automation)
- **Install Chromium**: `apt update && apt install -y chromium`

### ⚠️ コンテナの制約（重要）
- **コンテナ内からDocker操作はできない**（dockerコマンドなし、権限なし）
- Docker socketはマウントされているが、nodeユーザー（uid=1000）には権限がない
- `sudo`も入っていないため、権限昇格も不可
- **Dockerビルド・コンテナ再作成はVPS上で直接実行する必要がある**

### Docker構成方針（2026-03-15）
- **ベースイメージ**: `ghcr.io/openclaw/openclaw:2026.3.12`（公式Dockerfileは使用しない）
- **Chromium**: 手動apt install済み（`/usr/bin/chromium`）
- **設定**: `browser.executablePath: /usr/bin/chromium`
- **パッケージ追加**: 現在のDockerfileの`apt-get install`行に追記する方針
- **理由**: 現在の構成が動作確認済み、Playwright経由にするとパスが変わる可能性
- **重要**: コンテナ内では`"noSandbox": true`が必須

### Environment Files Structure
- **VPS .env**: `/home/op/openclaw-stack/.env`
  - コンテナ起動時に環境変数として注入
  - docker compose down && docker compose up -d で反映
- **Container .env**: `/home/node/.openclaw/.env`（VPSの.envから自動注入）
- **Config**: `/home/node/.openclaw/openclaw.json`
  - 変更は自動再読み込み（restart不要）
  - ハッシュ: 55381c6cde33a12d481ba54671ecc80342d1a22ba5099b32422b27e0a22ff2bf

### Environment Variables (verified 2026-03-13 17:29 JST)
コンテナ内で確認済み（マスク済み）:
- `BRAVE_API_KEY=BSA...Y3qu`
- `DISCORD_BOT_TOKEN=MTQ...BG9E`
- `GLM_API_KEY=7f4...3Q6R`
- `KIMI_API_KEY=sk-...dhHr`
- `OPENAI_API_KEY=sk-...XEvLE`
- `ZAI_EMAIL=fuk...@gmail.com`
- `ZAI_PASSWORD=ken...4416`

**確認方法**:
1. コンテナ内: `env | grep -E "API|KEY|TOKEN|SECRET|ZAI"`
2. VPS側: `docker compose exec openclaw-gateway env | grep -E "BRAVE|DISCORD|KIMI|GLM|ZAI"`
3. VPSの.env直接: `cat /home/op/openclaw-stack/.env`

**定期チェック**:
- HEARTBEAT.md で5分ごとに config-snapshot.json を更新・比較
- 変更があれば #openclawヘルスチェック に通知
- env-snapshot.json でハッシュ管理

## API Keys (status)
- GLM_API_KEY: configured
- DISCORD_BOT_TOKEN: configured
- KIMI_API_KEY: configured (web_search via KIMI works but results quality is poor)
- BRAVE_API_KEY: configured (web_search works via Brave provider, verified 2026-03-12)

## Security Implementation Guidelines (2026-03-13)

### 外部コード導入の安全なアプローチ
1. **外部コードはコピーしない** - 概念のみ抽出
2. **セキュリティリスクのあるアイデアは除外**:
   - キーワード: hack, crack, exploit, malware, virus, trojan, bypass, inject, payload, illegal, pirated
3. **実装前にユーザー承認を取得**
4. **dry-run で動作確認**
5. **機密情報は環境変数で管理**
6. **生成コードは必ずレビュー**

### テキスト→音声（TTS）選択肢
- **OpenAI TTS**: tts-1 / tts-1-hd（既に利用可能）
- **ElevenLabs**: 高品質・感情表現豊か
- **YouTube活用**: ナレーション生成→動画編集→投稿

## Model Allocation (2026-03-13)
- **達人 (GLM-5)**: 複雑な分析・推論タスク（温存推奨）
- **早人 (GLM-4.7)**: ニュース要約・YouTube要約・軽量タスク（メイン使用推奨）
- **匠人 (GPT-5.1-Codex)**: フォールバック用

## Cron Jobs 目的一覧 (2026-03-15)

### Heartbeat vs Cron: 使い分け

**Heartbeatを使う場面**:
- 複数チェックをまとめて実行（inbox + calendar + notifications）
- 会話コンテキストが必要
- タイミングの厳密さが不要（~30分の誤差OK）
- API呼び出しを減らしたい

**Cronを使う場面**:
- 正確な時刻が必要（「毎週月曜9時ぴったり」）
- タスクを分離したい（メインセッション履歴に影響させない）
- 別モデル・思考レベルで実行したい
- ワンショットリマインダー
- チャンネルに直接配信したい

### 監視系
- **Long Task Watcher** (5分): サブエージェントの長時間実行タスクを監視・進捗確認
- **openclaw_health_check_q6h** (6時間): OpenClaw Gatewayのヘルスチェック
- **browser-relay-check** (1日2回): Chrome Browser Relay接続状態確認
- **LLMモデル監視** (6時間): openaiプロバイダー使用を検知して警告（GLM-5優先）

### コンテンツ収集系
- **discord_context_scan_30m** (30分): 会話量・TODO・マネタイズ信号をスキャン
- **ai_news_digest_v2_brave** (1日2回): AIニュース収集・要約
- **AI YouTube Digest** (毎日20:00): AI関連YouTube動画要約
- **Weekly OpenClaw Ideas Collector** (火/木/土): OpenClaw活用アイデア収集

### メンテナンス系
- **daily-workspace-backup** (毎日04:00): ワークスペースバックアップ
- **daily_obsidian_note** (毎日08:00): Obsidian日次ノート更新
- **weekly_agent_self_diagnosis** (日曜21:00): エージェント自己診断
- **weekly_prompt_review_reminder** (月曜09:15): プロンプト再学習リマインダ
- **daily_model_update_monitor** (毎日09:30): モデルアップデート監視

### 注意事項
- 新規cron作成時は `message` フィールドに目的を明記すること
- 不要なcronは即削除（ノイズ防止）
- 一覧は #技術手順 にも保存済み

## Notification Policy (2026-03-16)

### 静穏時間（Quiet Hours）
- **定義**: 00:00-06:00 JST（深夜0時〜朝6時）
- **ポリシー**: 静穏時間中は緊急案件のみ通知
- **緊急案件**: システム障害、セキュリティインシデント、データ損失リスク等

### 適用対象
- 全定期タスク（cron / heartbeat）
- Discord通知
- その他自動通知

---

## Channel & Data Deletion Policy (追加)
- チャンネル／データの削除はユーザーの明示がある場合のみ実行します。
- 保護対象チャンネル: #一般 (1479832235610734664), #記憶と記録 (1482523923886113032)、及びサーバー内全チャンネル
- 保護対象データ: obsidianフォルダ、memory/SHARED.md、memory/*.md、memory/*.json、HEARTBEAT.md、openclaw.json、~/.openclaw/.env 等
- 重要アクションは memory/ops-log.md に記録する

(詳細は /home/node/.openclaw/workspace/memory/channel_deletion_policy.md を参照)