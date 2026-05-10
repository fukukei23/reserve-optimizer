# reserve-optimizer リファクタリングバックログ

> 最終更新: 2026-05-10
> 前提: 216ファイル評価のコードレビュー結果に基づく
> 基準: P0 = 影響大/工数小、P1 = 影響大/工数中、P2 = 影響中/工数中
> 環境制約: GAS（clasp、ESモジュール不可、var/functionベース）

## 優先度P0（すぐやる）

- [x] **P0-1: debug loggingの本番コードからの除去** — `handlers/LineWebhookHandler.js` 全体、`gas-project/Code.js`
  - 問題: `console.log('[handleFollow] ...')`、`console.log('[handleLineEvent] Unhandled event type: ...')` 等のdebugログが本番に残存。GAS実行ログにノイズを生じ、不要なログ肥大化を招く
  - 修正方針: `console.log` を `appendLogRow` （既存のログ関数）に統一、または条件付きデバッグフラグで制御。全ファイルの `console.log`/`console.error` を grep して洗い出し
  - 推定工数: 1時間

- [x] **P0-2: cancel/changeフローのページネーション重複コードの共通化** — `handlers/LineWebhookHandler.js`
  - 問題: `handleAwaitingCancelSelect` と `handleAwaitingChangeSelect` でページネーションUI構築ロジックが ~80% 重複（「次の5件」「前の5件」のハンドリング、アイテム構築）。各関数約80行のうち約60行が同一パターン
  - 修正方針: `buildPaginatedQuickReplyItems(reservationIds, page, pageSize)` を抽出し、両ハンドラから呼び出す。ページ遷移の共通ハンドラ `handlePaginationStep(text, tempData, userId, targetState, listMessageFn)` を作成
  - 推定工数: 3時間

- [x] **P0-3: 日付バリデーションの重複排除** — `handlers/LineWebhookHandler.js`
  - 問題: `handleAwaitingDate` と `handleAwaitingChangeDate` で90日制限チェック・日曜日チェック・過去日付チェックが完全に重複（各20行程度）
  - 修正方針: `validateDateForBooking(parsedDate)` を抽出し、両方から呼び出す。`ValidationUtils.js` に配置するのが自然
  - 推定工数: 1時間

- [x] **P0-4: cancel確認フローとchange確認フローの重複排除** — `handlers/LineWebhookHandler.js`
  - 問題: `handleAwaitingCancelConfirm` と `handleAwaitingChangeConfirm` で「はい/いいえ」の入力検証パターンが重複
  - 修正方針: `handleYesNoConfirm(text, replyToken, userId, onYes, onNo)` ヘルパーを抽出
  - 推定工数: 1時間

## 優先度P1（次にやる）

- [x] **P1-1: LineWebhookHandler.jsのファイル分割（1,686行→6ファイル）** — `handlers/LineWebhookHandler.js`
  - 問題: 単一ファイルに全15状態のハンドラ＋ユーティリティ＋状態管理が集約。理解・テスト・レビューが困難
  - 修正方針: GAS環境（ESモジュール不可）を考慮し、以下のようにファイル分割:
    - `handlers/ReservationHandler.js` — 予約フロー（startReservationFlow, handleAwaiting*）
    - `handlers/CancelHandler.js` — キャンセルフロー（handleCancelFlow, handleAwaitingCancel*）
    - `handlers/ChangeHandler.js` — 変更フロー（handleChangeFlow, handleAwaitingChange*）
    - `handlers/StateHandler.js` — 状態管理（setUserState, getUserState, clearUserState）
    - `handlers/MessageRouter.js` — ルーティング（handleLineEvent, handleMessage, handleIdleState）
    - `handlers/DateInputHelper.js` — 日付解析・カレンダーUI（parseDateInput, sendDatePrompt*）
  - ※GAS制約: グローバル関数として各ファイルのfunctionが自動的に見えるため、`var`/`function`ベースのまま分割可能
  - 推定工数: 4時間

- [ ] **P1-2: スプレッドシート検索の最適化（リニアスキャン→Map化）** — `services/SheetService.js`
  - 問題: `getReservationsByLineUserId` 等が全行を `for` ループでリニアスキャン（O(n)）。予約件数増加時にパフォーマンス劣化
  - 修正方針: キャッシュ付きMap構造を導入。`SheetService` に `_reservationCache` を追加し、`loadAllReservations()` でMap構築後に各種検索関数がMap lookup（O(1)）を利用。GASの1実行内キャッシュ有効
  - 推定工数: 3時間

- [x] **P1-3: キーワードマッチングの最適化** — `handlers/MessageRouter.js`
  - 問題: `handleIdleState` で5種類のキーワード配列をリニアループでマッチング。各配列6〜8要素、最大40回のループ
  - 修正方針: Map/Setベースのキーワードマッチャーを導入。`keywordMap = { '予約する': 'reserve', '予約': 'reserve', ... }` の形でO(1)ルックアップ
  - 推定工数: 1.5時間

- [x] **P1-4: TestSuite.jsの単体テストへの移行** — `gas-project/tests/TestSuite.js`
  - 問題: 現状は統合テストのみで、スプレッドシート実データに依存。テストの安定性・再現性が低い
  - 修正方針:
    - `TestSuite.js`（20.6KB）を機能別に分割: `tests/ValidationTests.js`、`tests/DateParserTests.js`、`tests/FlowTests.js`
    - モックオブジェクトパターンを導入（`MockSheetService`）してSheetService依存を切る
    - GAS環境のAssert関数を活用
  - 推定工数: 4時間

- [x] **P1-5: StripeServiceとStripeWebhookHandlerのエラーハンドリング強化** — `services/StripeService.js`、`handlers/StripeWebhookHandler.js`
  - 問題: Stripe API呼び出しのエラーハンドリングが不均一。`createPaymentLink` は try-catch で囲まれているが、`refundPayment` のエラー処理が呼び出し側（LineWebhookHandler）に漏れ出している
  - 修正方針: `StripeService` 内で一貫したエラーラッピング。Result オブジェクトパターン `{ success: boolean, data?: any, error?: string }` を導入
  - 推定工数: 2時間

## 優先度P2（余裕があれば）

- [x] **P2-1: MessageTemplates.jsのテンプレートエンジン化** — `templates/MessageTemplates.js`
  - 問題: メッセージ文字列がハードコード。施術名や時間のフォーマットが散在。多言語対応や文言変更が困難
  - 修正方針: テンプレート文字列を定数化し、パラメータ置換パターンを導入。`{date}`, `{time}`, `{menu_type}` 等のプレースホルダー
  - 推定工数: 2時間

- [x] **P2-2: 時間枠定義の設定化** — `handlers/DateInputHelper.js`（`sendTimePromptWithQuickReply` 内）
  - 問題: 平日・土曜の時間スロットがハードコード: `['9:00', '9:30', '10:00', ...]`。営業時間変更時にコード修正が必要
  - 修正方針: `SheetConfig.js` に時間枠設定を追加。`{ weekday: { slots: [...], lunchBreak: [...] }, saturday: { slots: [...] } }` の形
  - 推定工数: 1.5時間

- [x] **P2-3: KPIService.jsとDashboard.jsのUI分離** — `gas-project/KPIService.js`、`gas-project/Dashboard.js`
  - 問題: KPI計算ロジックとHTMLレンダリングが混在。データ取得と表示の責務が分離されていない
  - 修正方針: `KPIService.js` は純粋なデータ取得・計算のみにし、`Dashboard.js` はHTML生成のみにする
  - 推定工数: 2時間

- [x] **P2-4: DoGet.jsのルーティング整理** — `gas-project/DoGet.js`
  - 問題: GETリクエストのルーティングがswitch文で処理。新しいエンドポイント追加時にファイル修正が必要
  - 修正方針: ルーティングテーブルパターンを導入: `var routes = { 'dashboard': showDashboard, 'settings': showSettings, ... }`
  - 推定工数: 1時間

- [x] **P2-5: ReminderService.jsの定期実行スケジュール管理の改善** — `services/ReminderService.js`
  - 問題: トリガー管理がGASの時間主導トリガーに直接依存。テスト・デバッグが困難
  - 修正方針: トリガー操作を抽象化した `TriggerManager` を導入。setup/teardown/cron表現での設定
  - 推定工数: 2時間

- [x] **P2-6: Code.js（エントリポイント）の薄く化** — `gas-project/Code.js`
  - 問題: `doPost`/`doGet` にWebhook検証やルーティングが含まれ、エントリポイントとしての責務を超えている
  - 修正方針: `Code.js` は `doPost(e)` → `WebhookRouter.handle(e)` の1行委譲のみにする。署名検証は `WebhookRouter` 内で処理
  - 推定工数: 1時間

## 優先度P3（品質・UX改善） — 全12項目完了

- [x] **P3-0: console.log/Logger.log全置換 + URL設定化** — `services/LineService.js`, `services/MiniMaxService.js`, `services/StripeService.js`, `services/SheetService.js`, `config/ScriptProperties.js`
  - 30+箇所の console.log/error → appendLogRow 統一
  - success_url/cancel_url を ScriptProperties に設定化
  - Logger.log → appendLogRow (StripeService.verifyStripeSignature, SheetService, ScriptProperties)

- [x] **P3-1: Stripe Webhook冪等性チェック** — `handlers/WebhookRouter.js`
  - _dispatchStripeWebhook 内でイベントID重複検出
  - PropertiesService に処理済みイベントIDを記録（stripe_evt_ プレフィックス）

- [x] **P3-2: 同時予約競合防止** — `handlers/ReservationHandler.js`
  - LockService.getScriptLock() で排他制御
  - ロック取得後に _invalidateReservationCache() → 再チェック → createReservation
  - 10秒タイムアウト、try-catch でロック解放保証

- [x] **P3-3: 決済リンク失敗時リトライ** — `handlers/ReservationHandler.js`
  - 失敗時に clearUserState せず AWAITING_PAYMENT 状態を維持
  - handleAwaitingPayment で「再試行」ボタンから createPaymentLink 再実行
  - 再失敗時も状態維持で無限リトライ可能

- [x] **P3-4: 予約重複検出** — `handlers/ReservationHandler.js`
  - createReservationAndGoToPayment 内で同一日時の既存予約をチェック
  - ユーザーごとに既予約の日付+開始時刻が一致したら拒否

- [x] **P3-5: 待機リスト登録フロー実装** — `handlers/MessageRouter.js`
  - AWAITING_WAITLIST_TIME 状態追加
  - 時間帯選択（午前中/午後/いつでもOK）→ 既存登録チェック → addToWaitlist
  - 過去予約から電話番号を自動取得

- [x] **P3-6: エラーUX統一** — 各ハンドラ
  - 決済失敗メッセージに QuickReply ボタン追加（お問い合わせ/やめる）
  - sendFallbackWithContact は P0 で実装済み

- [x] **P3-7: 戻るユーザーパーソナライズ** — `handlers/MessageRouter.js`
  - handleFollow で getLastReservationByLineUserId をチェック
  - 戻りユーザーに「おかえりなさい」+ 前回名前表示
  - 新規ユーザーには通常ウェルカムメッセージ

- [x] **P3-8: ページネーション位置表示** — `handlers/MessageRouter.js`, `handlers/CancelHandler.js`, `handlers/ChangeHandler.js`
  - buildPaginatedQuickReplyItems のラベルに "(2/5)" 形式のページ位置追加
  - CancelHandler/ChangeHandler の初回ページ表示にも位置追加

- [x] **P3-9: 期限切れ状態クリーンアップTrigger** — `handlers/StateHandler.js`
  - cleanupExpiredStates() 関数追加
  - PropertiesService.getUserProperties() 全スキャン → 24h超過エントリ削除
  - 不正JSON エントリも除去

- [x] **P3-10: 管理者LINEコマンド追加** — `handlers/MessageRouter.js`
  - /status — 設定状態確認（管理者のみ）
  - /cleanup — 期限切れ状態クリーンアップ実行（管理者のみ）
  - /help — コマンド一覧表示

- [x] **P3-11: Result型統一 + 未使用コード除去** — `services/StripeService.js`
  - verifyStripeSignature の Logger.log → appendLogRow
  - null チェック追加（signature が null/undefined の場合の防御）

- [x] **P3-12: 日付妥当性チェック強化** — `utils/ValidationUtils.js`
  - validateDateForBooking に月(1-12)・日(1-31)の基本チェック追加
  - フォーマット不正時のエラーメッセージ改善

## 高品質ファイル（変更不要・参考モデル）

| ファイル | 評価 | 理由 |
|---|---|---|
| `config/SheetConfig.js` | 4.5/5 | 定数による型安全な設定管理。シート名・カラム位置・ステータス等の一元管理が優秀 |
| `config/ScriptProperties.js` | 4/5 | ScriptStore経由のプロパティアクセス抽象化。キャッシュ付きgetter設計 |
| `utils/ValidationUtils.js` | 4/5 | 電話番号・時間・日付バリデーションの体系化。normalize→validateの2段階設計 |
| `utils/DateUtils.js` | 3.5/5 | 日付操作ユーティリティ。`parseDateInput` は豊富なフォーマット対応 |
| `services/SheetService.js` | 4/5 | スプレッドシート操作のCRUD抽象化。getById/getByLineUserId等の検索API体系 |
| `models/Reservation.js` | 3.5/5 | 予約データモデル。ステータス定数・デポジットステータスの定義 |
| `models/Waitlist.js` | 3.5/5 | ウェイティングリストモデル |
| `templates/MessageTemplates.js` | 3.5/5 | LINEメッセージテンプレートの集約。UIとロジックの分離意図が良い |

## 工数サマリー

| 優先度 | 項目数 | 推定合計工数 |
|---|---|---|
| P0（すぐやる） | 4 | 6時間 |
| P1（次にやる） | 5 | 14.5時間 |
| P2（余裕があれば） | 6 | 9.5時間 |
| **合計** | **15** | **30時間** |

## 依存関係

```
P0-2 (ページネーション共通化)
  ↓
P1-1 (ファイル分割) ← P0-2の共通関数を利用
  ↓
P1-2 (検索最適化) ← P1-1分割後のSheetServiceに対して実施

P0-3 (日付バリデーション共通化)
  ↓
P1-1 (ファイル分割) ← 共通化済みのバリデータをDateInputHelper.jsに配置

P1-4 (単体テスト) ← P1-1分割後に各ファイル単位でテスト可能

P1-3 (キーワード最適化) ← P1-1のMessageRouter.jsに対して実施

P2-1〜P2-6 ← P1完了後に実施（独立実行可能だが、P1分割後の方が効果的）
```

## GAS環境制約の注意事項

1. **ESモジュール不可**: `import/export` は使用不可。全関数はグローバルスコープに露出
2. **clasp制約**: フイル追加時は `.clasp.json` の `filePushOrder` を考慮
3. **グローバル変数**: `var USER_STATES = {...}` 等はファイル分割後もグローバルに見える。名前衝突に注意
4. **テスト実行**: GAS環境でのテストは `ScriptApp.run()` 経由か、`tests/TestSuite.js` 内のAssert関数を使用
5. **`PropertiesService`**: `getUserProperties()` はユーザー単位のキーバリューストア。状態管理の代替として検討価値あり

## 推定効果

| 指標 | 現状 | P0完了後 | P1完了後 |
|---|---|---|---|
| LineWebhookHandler.js行数 | ~1,732行 | ~1,400行 | ~200行（ルーターのみ） |
| 重複コード率 | ~80%（cancel/change間） | ~20% | ~5% |
| テストカバレッジ | 統合テストのみ | 統合テストのみ | 単体テスト追加 |
| スプレッドシート検索 | O(n) | O(n) | O(1)（キャッシュ） |
