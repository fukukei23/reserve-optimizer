# Google Apps Script インポート・設定チェックリスト

## 実行状況

| ステップ | 項目 | ステータス | メモ |
|--------|------|--------|------|
| 1. Google Apps Script プロジェクト作成 | スクリプトエディタで新規プロジェクト作成 | ⏳ |
| 2. 17個の.gsファイルをインポート | 全17ファイルをコピー貼り付け | ⏳ |
| 3. Google Sheets（3シート）を作成 | reservations、waitlist、weekly_summary の3シート作成 | ⏳ |
| 4. Script Properties（11項目）を設定 | LINE/Stripe の API キー等を設定 | ⏳ |
| 5. Web Appをデプロイ | GAS をウェブアプリとしてデプロイ | ⏳ |
| 6. LINE Developers Consoleを設定 | Messaging API 設定、Webhook URL登録 | ⏳ |
| 7. Stripe Dashboardでwebhookを設定 | Webhook エンドポイント登録、シークレット設定 | ⏳ |
| 8. トリガーを設定 | 自動通知用トリガーを設定 | ⏳ |
| 9. 動作確認テスト | doGet、LINEボット、スプレッドシート接続確認 | ⏳ |
| 10. 本番運用開始 | 実際の予約受付開始 | ⏳ |

## 設定値メモ

### Script Properties に設定する値

```javascript
// LINE 設定
LINE_CHANNEL_ACCESS_TOKEN: [LINEコンソールからコピー]
LINE_CHANNEL_SECRET: [LINEコンソールからコピー]
LINE_ADMIN_USER_ID: [管理者のLINEユーザーID]

// Stripe 設定
STRIPE_API_KEY: sk_test_[テストキー] または sk_live_[本番キー]
STRIPE_WEBHOOK_SECRET: whsec_[シークレット]

// スプレッドシート
SPREADSHEET_ID: [作成したシートのURLからIDを抽出]

// システム設定
DEPOSIT_AMOUNT_JPY: 1000
CANCELLATION_DEADLINE_HOURS: 2
REMINDER_HOURS_BEFORE: 24
RESALE_NOTIFICATION_MINUTES: 10
AVERAGE_UNIT_PRICE: 6000
NO_SHOW_THRESHOLD: 2
NO_SHOW_DEPOSIT_AMOUNT: 2000
```

### Google Sheets シート名

1. reservations
2. waitlist
3. weekly_summary

### デプロイURL

GASデプロイ完了後の URL:
```
https://script.google.com/macros/s/[PROJECT_ID]/exec
```

※ [PROJECT_ID] はデプロイ時に自動生成されます

---

## 次のステップ

各ステップが完了したら、以下の項目にチェックを入れてください。

### ステップ1: プロジェクト作成完了
- [ ] スクリプトエディタが表示された
- [ ] プロジェクト名を確認

### ステップ2: ファイルインポート完了
- [ ] config/ ディレクトリ（2ファイル）作成
- [ ] services/ ディレクトリ（4ファイル）作成
- [ ] handlers/ ディレクトリ（2ファイル）作成
- [ ] templates/ ディレクトリ（1ファイル）作成
- [ ] models/ ディレクトリ（2ファイル）作成
- [ ] utils/ ディレクトリ（2ファイル）作成
- [ ] Code.gs 作成

### ステップ3: Google Sheets 作成完了
- [ ] reservations シート作成（19列ヘッダー設定）
- [ ] waitlist シート作成（6列ヘッダー設定）
- [ ] weekly_summary シート作成（7列ヘッダー設定）
- [ ] シート名が正しいか確認

### ステップ4: Script Properties 設定完了
- [ ] 全11項目のプロパティ設定
- [ ] 値が正しく入力されているか確認
- [ ] 「保存」ボタンをクリック

### ステップ5: Web App デプロイ完了
- [ ] ウェブアプリとしてデプロイ
- [ ] URL を取得
- [ ] URL を記録

### ステップ6: LINE Developers Console 設定完了
- [ ] Messaging API チャネル設定完了
- [ ] チャネルアクセストークンを Script Properties に設定
- [ ] チャネルシークレットを Script Properties に設定
- [ ] Webhook URL を登録
- [ ] 接続テスト成功

### ステップ7: Stripe Dashboard 設定完了
- [ ] Webhook エンドポイント設定完了
- [ ] Webhook URL が正しく登録されている
- [ ] イベント（payment_intent.succeeded）が有効
- [ ] Webhook シークレットを Script Properties に設定

### ステップ8: トリガー設定完了
- [ ] sendDayBeforeReminders トリガー作成（毎日8:00）
- [ ] checkForNoShows トリガー作成（9:00-18:00、30分間隔）
- [ ] トリガーが有効化されているか確認

### ステップ9: 動作確認テスト完了
- [ ] doGet テスト成功（正常なJSON応答）
- [ ] LINEボット接続確認
- [ ] /reserve コマンド動作
- [ ] Google Sheets 接続確認

### ステップ10: 本番運用開始
- [ ] 週次レポートが自動生成されるのを確認
- [ ] 1日運用手順（15分以内）で開始
- [ ] 正常に動作しているか監視

---

## トラブルシューティング

各ステップで問題が発生した場合の解決策：

### ステップ1-2: プロジェクト作成・インポート
**問題:** ファイルインポート時にエラーが発生
**解決策:**
- 1つずつインポートする（一度に複数）
- エラー箇所を確認し、修正する
- スクリプトエディタのログ（実行ログタブ）を確認

### ステップ3: Google Sheets 作成
**問題:** シートが自動作成されない
**解決策:**
- スクリプトの `SheetConfig.gs` でシート名を確認
- 手動でシートを作成（ヘッダー設定）
- シート共有設定を確認

### ステップ4: Script Properties 設定
**問題:** プロパティ保存時にエラー
**解決策:**
- プロパティ名が正しいか確認（大文字小文字区別）
- 値が空でないか確認
- スクリプトエディタを再読み込み

### ステップ5-7: デプロイ・外部連携
**問題:** デプロイ時、実行エラー
**解決策:**
- スクリプトエディタの「実行ログ」を確認
- 全てのプロパティが設定されているか確認
- URL を再デプロイ

### ステップ8: トリガー設定
**問題:** トリガーが作成されない
**解決策:**
- `ReminderService.gs` 内の関数名を確認
- スクリプトエディタを再読み込み
- トリガーを削除して再作成

### ステップ9: 動作確認テスト
**問題:** テスト失敗
**解決策:**
- 各モジュールの初期化処理を確認
- Script Properties の値を確認
- Google Sheets の接続権限を確認

---

## テストシナリオ

### テスト1: 正常予約フロー
```
1. LINEで /reserve を送信
2. 氏名: 山田太郎 と入力
3. 電話番号: 09012345678 と入力
4. 日付: 来週月15日 と入力（または 2026-02-20）
5. 時間: 10:00 と入力
6. 施術: 初診（30分）と入力
7. Stripe Payment Link が送信される
8. テスト用カードで支払い完了
9. 予約確定メッセージが届く
10. reservations シートにデータが保存される
```

**期待結果:** 全ステップが正常に完了し、データが正しく保存される

### テスト2: キャンセル・再販フロー
```
1. テスト予約を作成（上記フロー）
2. 当日キャンセルを実施（手動またはシステム経由）
3. waitlist に候補者を登録
4. キャンセル処理を実行
5. waitlist 通知が送信される
6. 再販処理が成功する
```

**期待結果:** キャンセル処理が正常に行われ、再販通知が送信される

### テスト3: 24時間前リマインド
```
1. 翌日の予約を作成（日時設定）
2. リマインド送信トリガーを待つ（8:00）
3. リマインドメッセージが届く
4. reservations シートで reminder_sent が Y に更新される
```

**期待結果:** リマインドが正しいタイミングで送信される

---

## 成功基準

以下の全てが達成されたら、セットアップ完了とみなします：

- ✅ Google Apps Script プロジェクト作成
- ✅ 全17個のファイルインポート
- ✅ Google Sheets（3シート）作成
- ✅ Script Properties（11項目）設定
- ✅ Web App デプロイ
- ✅ LINE Developers Console 設定
- ✅ Stripe Dashboard Webhook 設定
- ✅ トリガー設定
- ✅ 動作確認テスト成功

---

## 進捗状況

**完了:** 0/10 ステップ
**進行中:** なし
**未着手:** 10 ステップ

---

## メモ

- 各ステップ完了時、チェックリストにチェックを入れてください
- 問題が発生した場合は「トラブルシューティング」を参照
- Google Sheets シートID はデプロイ後の URL から抽出できます
- デプロイ URL は変更される場合があるため、最新の URL を使用してください
