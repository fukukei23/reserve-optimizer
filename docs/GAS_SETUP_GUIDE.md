# GAS セットアップ手順書

予約管理システム（LINE + Stripe + Google Sheets）を Google Apps Script で動かすための手順です。

---

## 前提

- LINE 公式アカウント作成済み（チャネルアクセストークン・チャネルシークレット取得済み）
- Google アカウント（script.google.com / sheets.google.com にログインできること）

---

## ステップ1: GAS 新規プロジェクト作成

1. [script.google.com](https://script.google.com) を開く
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「予約管理システム」などに変更（左上）

---

## ステップ2: スプレッドシートを用意する

1. [sheets.google.com](https://sheets.google.com) で **新しいスプレッドシート** を作成
2. 名前を「予約管理データ」などに
3. ブラウザのURLから **スプレッドシートID** をコピーする  
   - 例: `https://docs.google.com/spreadsheets/d/【ここがID】/edit`  
   - この **【ここがID】** をメモ（後で Script Properties に入れる）

---

## ステップ3: コードを GAS に貼り付ける

### 方法A: ファイルごとに貼る（推奨）

1. 同梱の **`GAS_PASTE_ALL.gs`** を開く
2. 区切りコメント `// ========== ファイル名.gs ==========` ごとにブロックが分かれている
3. GAS エディタで:
   - 初期状態の `Code.gs` の内容を **すべて削除**
   - `GAS_PASTE_ALL.gs` の **「Code.gs」ブロックだけ** をコピーして貼り付け
4. 左の「+」→「スクリプト」で **新しい .gs ファイル** を追加し、名前を **そのブロックのファイル名** にする（例: `ScriptProperties`）
5. 同様に、**各ブロックを対応するファイルに貼り付け** 
   - 作成するファイル一覧は下記「ファイル対応表」を参照

### 方法B: 1ファイルにまとめて貼る

1. GAS の **Code.gs** だけを使う場合
2. **`GAS_PASTE_ALL.gs`** の **全区切りを除いた中身をすべて** 1つの Code.gs に貼り付ける
3. 保存（Ctrl+S）

### ファイル対応表

| GAS で作るファイル名 | ペースト用のブロック名 |
|----------------------|-------------------------|
| Code.gs              | Code.gs                 |
| ScriptProperties.gs  | config/ScriptProperties.gs |
| SheetConfig.gs       | config/SheetConfig.gs   |
| ValidationUtils.gs   | utils/ValidationUtils.gs |
| DateUtils.gs         | utils/DateUtils.gs      |
| MessageTemplates.gs  | templates/MessageTemplates.gs |
| Reservation.gs       | models/Reservation.gs  |
| Waitlist.gs          | models/Waitlist.gs     |
| SheetService.gs      | services/SheetService.gs |
| LineService.gs       | services/LineService.gs |
| StripeService.gs     | services/StripeService.gs |
| ReminderService.gs   | services/ReminderService.gs |
| LineWebhookHandler.gs| handlers/LineWebhookHandler.gs |
| StripeWebhookHandler.gs | handlers/StripeWebhookHandler.gs |
| Setup.gs             | Setup.gs                |
| KPIService.gs        | KPIService.gs           |
| Dashboard.gs         | Dashboard.gs            |
| TestSuite.gs         | tests/TestSuite.gs      |

※ フォルダは GAS では作れないため、ファイル名だけで区別する。

---

## ステップ4: Script Properties を設定する

1. GAS エディタで **プロジェクトの設定**（歯車アイコン）をクリック
2. 「スクリプト プロパティ」→「スクリプト プロパティを追加」
3. 以下の **プロパティ名** と **値** を1つずつ追加（既存は上書きでOK）

| プロパティ名 | 値 | 備考 |
|-------------|-----|------|
| LINE_CHANNEL_ACCESS_TOKEN | （LINEで取得した長いトークン） | 必須 |
| LINE_CHANNEL_SECRET | （LINEで取得したシークレット） | 必須 |
| LINE_ADMIN_USER_ID | （管理者のLINEユーザーID） | 任意・通知用 |
| STRIPE_API_KEY | sk_test_xxxx... または sk_live_xxxx... | Stripe取得後 |
| STRIPE_WEBHOOK_SECRET | whsec_xxxx... | デプロイ後に取得 |
| SPREADSHEET_ID | （ステップ2でメモしたID） | 必須 |
| DEPOSIT_AMOUNT_JPY | 1000 | 任意・デフォルト1000 |
| CANCELLATION_DEADLINE_HOURS | 2 | 任意 |
| REMINDER_HOURS_BEFORE | 24 | 任意 |
| RESALE_NOTIFICATION_MINUTES | 10 | 任意 |
| AVERAGE_UNIT_PRICE | 6000 | 任意 |
| NO_SHOW_THRESHOLD | 2 | 任意 |
| NO_SHOW_DEPOSIT_AMOUNT | 2000 | 任意 |

4. 保存してエディタに戻る

---

## ステップ5: 初回セットアップ関数を実行する

1. エディタで **Setup.gs** を開く（または Code.gs のみの場合はその中から）
2. 関数一覧で **`runSetup`** を選択
3. 「実行」をクリック
4. 初回は **権限の承認** が求められる:
   - 「権限を確認」→ 自分のGoogleアカウントを選択
   - 「詳細」→「〇〇（安全ではないページ）に移動」→「許可」
5. 実行が完了すると、指定したスプレッドシートに **reservations / waitlist / weekly_summary / Dashboard / Waitlist Dashboard** が自動作成される
6. トリガー（リマインド・No-Show チェック等）も自動作成される

※ SPREADSHEET_ID が未設定だとエラーになる。先にステップ4を完了すること。

---

## ステップ6: Web アプリとしてデプロイする

1. GAS エディタで「デプロイ」→「新しいデプロイ」
2. 種類で「ウェブアプリ」を選択
3. 説明: 「予約Webhook」など任意
4. 「次のユーザーとして実行」: 自分
5. 「アクセスできるユーザー」: **全員**（LINE/Stripe がアクセスするため）
6. 「デプロイ」をクリック
7. 表示される **ウェブアプリのURL** をコピー（例: `https://script.google.com/macros/s/xxxxx/exec`）
8. このURLを **LINE の Webhook URL** と **Stripe の Webhook エンドポイント** に登録する

---

## ステップ7: LINE Webhook を設定する

1. LINE Developers コンソール（または LINE 公式アカウント管理）で、対象チャネルの **Messaging API 設定** を開く
2. **Webhook URL** に、ステップ6でコピーした **GAS のデプロイURL** をそのまま貼り付けて保存
3. **「Webhook の利用」をオン** にする
4. 「検証」で成功すればOK

---

## ステップ8: Stripe Webhook を設定する（Stripe 利用時）

1. [dashboard.stripe.com](https://dashboard.stripe.com) → 開発者 → Webhook
2. 「エンドポイントを追加」
3. エンドポイントURL に **GAS のデプロイURL** を入力
4. イベントで **payment_intent.succeeded** と **payment_intent.payment_failed** を選択
5. 作成後、**署名シークレット（whsec_...）** をコピー
6. GAS の **Script Properties** に **STRIPE_WEBHOOK_SECRET** として追加

---

## ステップ9: 動作確認

1. LINE でボットを友だち追加
2. `/reserve` と送信
3. 名前・電話番号・日付・時間・施術を入力
4. デポジット決済リンクが届けば、LINE 連携はOK
5. スプレッドシートの **reservations** シートに1行追加されていれば、GAS ↔ シート連携もOK
6. Stripe テストモードで支払い完了すると、予約確定メッセージが届く想定

---

## トラブルシューティング

| 現象 | 確認すること |
|------|----------------|
| Webhook が届かない | LINE/Stripe の Webhook URL がデプロイURLと完全一致か、HTTPS か |
| 「Invalid LINE signature」 | Script Properties の LINE_CHANNEL_SECRET が正しいか |
| シートに書き込めない | SPREADSHEET_ID が正しいか、runSetup を実行してシートが作成されているか |
| 決済リンクが作成されない | STRIPE_API_KEY が設定されているか（sk_test_ または sk_live_） |

---

## 注意

### Stripe 決済リンク
ペースト用コードの `createPaymentLink` は簡略版です。Stripe の Payment Links API または Checkout の URL を正しく返すように、必要に応じて [Stripe ドキュメント](https://stripe.com/docs/api) を参照して修正してください。

### Code.gs の署名検証

`Code.gs` 内の `verifyLineSignature` / `verifyStripeSignature` では、引数で受け取った **signature** をそのまま **actualSignature** として比較してください。  
元コードで `headers` を参照している場合はスコープにないため、`actualSignature = signature` に置き換えてください。  
（`GAS_PASTE_ALL.gs` 側で修正済みの場合はそのまま貼って問題ありません。）

---

## 次のステップ

- 本番運用前に Stripe を **本番キー（sk_live_）** に切り替え
- LINE_ADMIN_USER_ID を設定すると、週次レポートがLINEに送信される
- 必要に応じて `docs/setup-guide.md` のチェックリストで全体を再確認
