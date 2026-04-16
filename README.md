# reserve-optimizer

整骨院向けLINE予約管理Bot。GASバックエンド + LINE Messaging API + Google Spreadsheets + Stripe Checkout + Cloudflare Worker + MiniMax AI。

## アーキテクチャ

| レイヤー | 技術 | 役割 |
|----------|------|------|
| フロントエンド | LINE Messaging API | LINEアプリ + リッチメニュー |
| Webhook中継 | Cloudflare Worker | LINE/Stripe署名検証 → GAS転送 |
| バックエンド | Google Apps Script (GAS) | 全.jsファイルがグローバル名前空間を共有 |
| データストア | Google Spreadsheets | 予約・ユーザー・ログ・ウェイティングリスト |
| 決済 | Stripe Checkout | デポジット制 1,000円 |
| AIチャット | MiniMax M2.7 | 整骨院トピック限定Q&A |

## プロジェクト構造

```
reserve-optimizer/
├── gas-project/
│   ├── Code.js                    # doPost, Webhook検証, メインエントリ
│   ├── DoGet.js                   # doGet, gas-autopilot関数, デバッグ
│   ├── Dashboard.js               # 管理ダッシュボード
│   ├── Setup.js                   # 初期セットアップ
│   ├── KPIService.js              # KPI計測
│   ├── appsscript.json            # GAS設定
│   ├── config/
│   │   ├── ScriptProperties.js    # 設定キー・getter/setter・デフォルト値
│   │   └── SheetConfig.js         # シート構成定義
│   ├── handlers/
│   │   ├── LineWebhookHandler.js  # 状態マシン・会話ハンドラ
│   │   └── StripeWebhookHandler.js # Stripe Webhook処理
│   ├── services/
│   │   ├── LineService.js         # LINE API (reply/push/profile/richmenu)
│   │   ├── SheetService.js        # スプレッドシートCRUD
│   │   ├── StripeService.js       # Stripe Checkout/返金
│   │   ├── MiniMaxService.js      # MiniMax LLM統合
│   │   └── ReminderService.js     # リマインダー送信
│   ├── models/
│   │   ├── Reservation.js         # 予約モデル
│   │   └── Waitlist.js            # ウェイティングリスト
│   ├── templates/
│   │   └── MessageTemplates.js    # メッセージテンプレート
│   ├── utils/
│   │   ├── DateUtils.js           # 日付ユーティリティ
│   │   └── ValidationUtils.js     # バリデーション
│   ├── tests/                     # テスト
│   ├── gas-run.sh                 # 自動デプロイスクリプト
│   └── gas-auth.py                # 認証ヘルパー
├── worker/
│   ├── src/index.ts               # Cloudflare Worker（LINE/Stripe webhook中継）
│   ├── wrangler.toml              # Worker設定
│   └── package.json
├── docs/
├── DEVELOPMENT.md                 # 開発ガイドライン
└── README.md                      # このファイル
```

## 主な機能

- **LINE予約フロー**: 予約作成・変更・キャンセル（会話型ウィザード）
- **QuickReply UI**: 選択式UIでフリー入力を最小限に抑制
- **Stripe Checkout決済**: デポジット 1,000円（前日キャンセルまで無料返金）
- **リマインダー & ウェイティングリスト**: 前日リマインダー + キャンセル時の自動通知
- **AIチャット**: MiniMax M2.7による整骨院トピック限定Q&A
- **管理ダッシュボード**: Google Spreadsheetsベースの予約・KPI管理

## ビジネスルール

| 項目 | 内容 |
|------|------|
| 営業時間 | 平日 9:00-18:00（12:00-13:00昼休み除外）、土曜 9:00-13:00 |
| 定休日 | 日曜 + 日本の祝日 |
| 施術メニュー | 初診(30分), 再診(30分), 再診(60分) |
| デポジット | 1,000円（前日キャンセルまで無料返金） |
| 予約制約 | 1ユーザー最大3件、当日60分前まで予約可能 |

## セットアップ

### 前提条件

- Node.js / npm
- [clasp](https://github.com/google/clasp)（GAS CLI）
- Cloudflareアカウント（Worker用）
- LINE Developers アカウント
- Stripe アカウント

### ScriptProperties設定

GASエディタのプロジェクトのプロパティに以下を設定：

| キー | 説明 |
|------|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Bot アクセストークン |
| `LINE_CHANNEL_SECRET` | LINE署名検証 |
| `LINE_ADMIN_USER_ID` | 管理者通知先 |
| `STRIPE_API_KEY` | Stripe APIキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名 |
| `SPREADSHEET_ID` | データストア |
| `MINIMAX_API_KEY` | MiniMax APIキー |

### 外部サービス Webhook URL

- **LINE Developers Console**: `https://reserve-optimizer.fukukei44161.workers.dev/webhook/line`
- **Stripe Dashboard**: `https://reserve-optimizer.fukukei44161.workers.dev/webhook/stripe`

## デプロイ

### GAS

```bash
cd gas-project && clasp push
```

GASエディタUI → デプロイ → デプロイを管理 → 新バージョン作成 → デプロイ

> **注意**: `clasp deploy` は新URL生成 + アクセス権リセットの問題があるため使用しない。`clasp push` + UIデプロイで運用する。

自動デプロイの場合は `gas-run.sh` を使用。

### Cloudflare Worker

```bash
cd worker && npx wrangler deploy
```

シークレット設定（初回またはWorker再作成時）:

```bash
echo -n "<値>" | npx wrangler secret put GAS_WEBAPP_URL
echo -n "<値>" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
echo -n "<値>" | npx wrangler secret put LINE_CHANNEL_SECRET
```

## 詳細ドキュメント

- **仕様書・設計判断**: [obsidian-ssot/01_DECISIONS/reserve-optimizer/](https://github.com/fukukei23/obsidian-ssot/tree/main/01_DECISIONS/reserve-optimizer)
- **開発ガイドライン**: [DEVELOPMENT.md](./DEVELOPMENT.md)
