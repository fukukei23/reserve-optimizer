# OpenClaw Workspace

OpenClaw運用用のワークスペース。

## 構成

```
.
├── AGENTS.md          # エージェント設定・ルール
├── SOUL.md            # エージェントの性格
├── USER.md            # ユーザー情報
├── MEMORY.md          # 長期記憶
├── HEARTBEAT.md       # 定期タスク設定
├── TOOLS.md           # ツール固有設定
├── IDENTITY.md        # エージェントID
├── docs/              # ドキュメント
├── memory/            # 記憶・ログ
│   ├── SHARED.md      # 全チャンネル共通の重要事項
│   ├── YYYY-MM-DD.md  # 日次ログ
│   └── channels/      # チャンネル別アーカイブ
├── obsidian/          # Obsidianノート
├── scripts/           # 自動化スクリプト
└── skills/            # スキル定義
```

## 主な機能

### 自動化
- AIニュース収集（1日2回）
- YouTube動画要約（毎日20:00）
- ワークスペースバックアップ（毎日04:00）
- ヘルスチェック（6時間毎）

### ブラウザ操作
- **コンテナ内Chromium**: 情報収集・スクレイピング
- **Surface Go + Browser Relay**: 2FA必須サイト

### 自動マネタイズ方針
- API優先で設計
- 必要時にブラウザ操作に切り替え

## ドキュメント

- [Browser Relay接続手順](docs/browser-relay-setup.md)
- [Docker再ビルド手順](docs/docker-rebuild.md)
- [OpenClaw構成](docs/00-README.md)

## セキュリティ

- 機密情報は `.env` で管理（gitignore済み）
- APIキー等は環境変数で注入
- GitHubはプライベートリポジトリ

---

運用開始: 2026-02-26
