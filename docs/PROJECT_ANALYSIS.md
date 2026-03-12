# reserve-optimizer プロジェクト解析

このドキュメントは、`/reserve-optimizer` プロジェクトの構成・役割・動きを整理した解析レポートです。

---

## 1. プロジェクトの二層構造

このリポジトリは **2つのレイヤー** で成り立っています。

| レイヤー | 内容 | 主なフォルダ・ファイル |
|----------|------|--------------------------|
| **開発プロセス** | Claude Code での開発ガイド・品質管理・エージェント・スキル | `README.md`, `DEVELOPMENT.md`, `.claude/`, `docs/decisions/`, `docs/specs/` |
| **製品（予約システム）** | LINE + Stripe + スプレッドシートの予約管理アプリ（GAS） | `gas-project/`, `docs/GAS_PASTE_ALL.gs`, `docs/GAS_SETUP_GUIDE.md` |

- **開発プロセス側**: どう開発するか（Tier 1 判定、レビュー、決定の記録、スキル）
- **製品側**: クリニック・整骨院向けの「予約＋デポジット＋リマインド＋KPI」を実現する GAS アプリ

---

## 2. 製品：予約管理システムの全体像

### 2.1 技術スタック

| 要素 | 技術 | 役割 |
|------|------|------|
| 実行基盤 | Google Apps Script (GAS) | Webhook 受信・ビジネスロジック・トリガー |
| フロント・窓口 | LINE Messaging API | ユーザーとの会話・通知 |
| 決済 | Stripe | デポジットの支払い・返金・Webhook |
| データ保存 | Google スプレッドシート | 予約・待機リスト・週次サマリ・ログ・ダッシュボード |

### 2.2 アーキテクチャ概要

```
[LINE] ----POST----> [GAS doPost] ----+---> handleLineWebhook --> handleLineEvent --> 会話・予約作成
                                       |
[Stripe] ---POST---> (同じURL) -------+---> handleStripeWebhook --> 支払成功/失敗/返金
```

- **1本の GAS Web アプリ URL** で `doPost(e)` が呼ばれる。
- リクエストの **ヘッダ**（`X-Line-Signature` または `Stripe-Signature`）で LINE と Stripe を判別し、それぞれのハンドラに振り分ける。
- 予約データ・待機リスト・KPI はすべて **Script Properties で指定した 1 つのスプレッドシート** に保存される。

### 2.3 主要なデータ・シート

| シート名 | 用途 |
|----------|------|
| reservations | 予約（ID・氏名・電話・日時・施術・ステータス・デポジット状態など） |
| waitlist | 当日空き枠通知希望者（電話・希望時間・当日OK など） |
| weekly_summary | 週次の KPI（予約数・無断数・無断率・当日キャンセル・再販など） |
| ログ | エラー等のログ（timestamp, level, message） |
| Dashboard | 今週の KPI と目標達成状況 |
| Waitlist Dashboard | 待機リストのサマリ・一覧 |

---

## 3. 主な処理フロー

### 3.1 エントリポイント（Code.gs）

- **doPost(e)**  
  - `e.postData.contents` で body 取得。  
  - LINE 用・Stripe 用の署名を **e.parameter** から取得してルーティング（※後述「注意」参照）。
- **handleLineWebhook(body, headers)**  
  - LINE 署名検証 → `handleLineEvent` で各イベント処理。
  - 例外時は `Logger.log` に加え **appendLogRow('ERROR', ...)** でスプレッドシート「ログ」に記録。
- **handleStripeWebhook(body, headers)**  
  - Stripe 署名検証 → `event.type` に応じて  
    - `payment_intent.succeeded` → handlePaymentSuccess  
    - `payment_intent.payment_failed` → handlePaymentFailure  
    - `charge.refunded` → handleRefund  

### 3.2 LINE 会話フロー（LineWebhookHandler）

- **状態（USER_STATES）**: IDLE → 名前 → 電話番号 → 日付 → 時間 → 施術 → 支払い待ち。
- **コマンド**: `/reserve`, `/change`, `/cancel`, `/waitlist`（変更・キャンセル・待機リストは「準備中」メッセージ）。
- **入力のゆるい受け入れ**  
  - 電話: `normalizePhoneInput`（+81・ハイフン・スペース等を正規化）。  
  - 日付: 「今日」「明日」「来週月曜」＋ 数値日付。  
  - 時間: `normalizeTimeInput`（「10時」「10:30」等を "HH:mm" に統一）。
- **救済 UI**: 入力不正時に「もう一度入力する」「人間に問い合わせる」の **Quick Reply** を出し、問い合わせ用に `CONTACT_PHONE` / `CONTACT_URL` を表示。
- 予約作成後は **Stripe で Payment Intent を作り、決済リンクを LINE で送信**。ユーザーが「支払完了」と送るか、Stripe Webhook で支払い成功が来たら予約確定。

### 3.3 Stripe 連携

- **createPaymentLink(reservationId, patientName, amount)**  
  - Stripe API で Payment Intent 作成し、Checkout URL を返す（実装は簡易版。本番では Stripe ドキュメントに合わせた URL 生成を推奨）。
- **handlePaymentSuccess**  
  - 予約の `deposit_status` → Paid、`status` → Confirmed。  
  - ユーザーに確定メッセージを Push。  
  - **LINE_ADMIN_USER_ID** が設定されていれば管理者にも「新しい予約が確定しました」を Push。
- **handlePaymentFailure**  
  - 支払失敗メッセージをユーザーに Push。
- **handleRefund**  
  - `charge.refunded` を受け、該当予約を検索して `deposit_status` を Refunded にし、返金完了メッセージを Push。

### 3.4 定期処理（ReminderService・トリガー）

- **sendDayBeforeReminders**  
  - 翌日予約の確定者にリマインドを Push（毎日 8 時等）。
- **checkForNoShows**  
  - 予約時刻を過ぎても来院していない予約を No-Show にし、デポジット没収と通知（9〜17 時などで複数回トリガー想定）。
- **cleanupWaitlist**  
  - 古い待機リストの整理（例: 毎日 22 時）。
- **generateWeeklyReport**  
  - 週次 KPI を計算して weekly_summary に保存し、管理者に LINE で週次サマリを送信（例: 日曜 22 時）。
- **updateDashboard**  
  - Dashboard シートの数値を更新（例: 毎日 8 時）。

---

## 4. プロジェクト構造（ファイル単位）

### 4.1 開発プロセスまわり

```
reserve-optimizer/
├── README.md                 # 開発ガイド・目次・エージェント・スキル一覧
├── DEVELOPMENT.md           # 品質管理・レビュー・Tier 1 等の詳細
├── IMPLEMENTATION_SUMMARY.md # 実装完了まとめ（.claude 構成）
└── .claude/
    ├── rules.md              # 基本ルール（Tier 1 判定など）
    ├── agents/               # コードレビュー・決定記録・Tier1 バリデーター
    ├── workflows/            # 開発フロー
    └── skills/               # spec, plan, safety-check, self-review, test-plan 等
```

### 4.2 製品（GAS）まわり

```
gas-project/
├── Code.gs                           # doPost, LINE/Stripe 振り分け、署名検証
├── config/ScriptProperties.gs        # 設定キー・getProperty/getLineAccessToken 等
├── config/SheetConfig.gs             # シート名・列定義・ステータス定数
├── utils/ValidationUtils.gs          # 電話・日付・時間・名前の正規化・検証
├── utils/DateUtils.gs                # 日付フォーマット・週・時間計算
├── templates/MessageTemplates.gs     # 文言テンプレート
├── models/Reservation.gs             # 予約オブジェクト・検証・キャンセル可否
├── models/Waitlist.gs                # 待機リスト・マッチスコア
├── services/SheetService.gs          # シート取得・CRUD・getLogSheet / appendLogRow
├── services/LineService.gs           # reply / push / Quick Reply
├── services/StripeService.gs         # Payment Intent・createPaymentLink（簡易）
├── services/ReminderService.gs       # リマインド・No-Show・待機リスト通知
├── handlers/LineWebhookHandler.gs     # 会話状態・予約フロー・日付/時間パース
├── handlers/StripeWebhookHandler.gs  # 支払成功/失敗/返金・管理者通知
├── Setup.gs                           # runSetup, シート作成・トリガー登録
├── KPIService.gs                     # 週次 KPI 計算・週次レポート
├── Dashboard.gs                       # Dashboard / Waitlist Dashboard 作成・更新
└── tests/TestSuite.gs                # 単体テスト（ValidationUtils, DateUtils）
```

### 4.3 ドキュメント・配布用

```
docs/
├── GAS_SETUP_GUIDE.md   # セットアップ手順（Script Properties・デプロイ・LINE/Stripe Webhook）
├── GAS_PASTE_ALL.gs      # 上記 GAS を「1 ファイル」にまとめたペースト用
├── LINE_BOT_VERIFY.md   # LINE ボット検証まわり
├── setup-guide.md       # セットアップチェックリスト
├── decisions/           # 重要な判断の記録
└── specs/               # Tier 1 仕様テンプレート
```

---

## 5. GAS_PASTE_ALL.gs の役割と注意点

- **役割**  
  - 複数 .gs に分かれている処理を **1 つの Code.gs に貼って動かす** ための「全結合版」。
  - 区切りコメント `// ========== 〇〇.gs ==========` で元ファイルと対応付け可能。
- **署名検証**  
  - `verifyLineSignature(body, signature)` / `verifyStripeSignature(body, signature)` は、**引数で渡した signature** をそのまま `actualSignature` として使う実装になっている（headers を参照しない）。
- **ログ**  
  - エラー時に `appendLogRow('ERROR', ...)` で「ログ」シートに書き、`#ERROR!` だけにならないようにしている。
- **doPost とヘッダ**  
  - 現在、LINE/Stripe の署名を **e.parameter** から取得している。  
  - GAS の `doPost(e)` では **HTTP ヘッダは e.parameter には入らない** ため、実際の Webhook 送信方式（ヘッダで送っているか）と合わせて、必要なら **e.postData.type やヘッダの取得方法** を確認する必要がある（GAS ではヘッダ取得が制限される場合あり）。

---

## 6. 設定（Script Properties）まとめ

| キー | 必須 | 説明 |
|------|------|------|
| LINE_CHANNEL_ACCESS_TOKEN | ○ | LINE チャネルアクセストークン |
| LINE_CHANNEL_SECRET | ○ | LINE Webhook 署名検証用 |
| LINE_ADMIN_USER_ID | - | 管理者 LINE ID（予約確定・週次レポート通知） |
| STRIPE_API_KEY | ○ | Stripe API キー（sk_test_ / sk_live_） |
| STRIPE_WEBHOOK_SECRET | ○ | Stripe Webhook 署名検証用 |
| SPREADSHEET_ID | ○ | 予約・ログ・Dashboard 用スプレッドシート ID |
| DEPOSIT_AMOUNT_JPY, CANCELLATION_DEADLINE_HOURS, REMINDER_HOURS_BEFORE 等 | - | 業務パラメータ（デフォルトあり） |
| CONTACT_PHONE, CONTACT_URL | - | 「人間に問い合わせる」用の表示用 |

---

## 7. まとめ

- **reserve-optimizer** は  
  - **開発の進め方**（.claude のルール・エージェント・スキル）と  
  - **クリニック・整骨院向けの予約管理アプリ**（GAS + LINE + Stripe + スプレッドシート）  
  の両方を含むリポジトリです。
- 製品部分は、LINE で予約フローを進め、Stripe でデポジットを徴収し、スプレッドシートで永続化・KPI・ログを取り、リマインド・No-Show・週次レポート・管理者通知まで一通りそろった構成です。
- 運用時は `docs/GAS_SETUP_GUIDE.md` に従い、Script Properties・デプロイ・LINE/Stripe の Webhook を設定し、`runSetup` でシートとトリガーを作成します。コードは `gas-project/` をファイル分割で使うか、`docs/GAS_PASTE_ALL.gs` を Code.gs に貼るかで選択できます。
