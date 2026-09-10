# 時限テスト・オーディット仕分け表（2026-09-10）

> オーディット時点の全33テストファイル（現34: その後 unit-reservation-lock を追加）の「実行日依存で将来壊れる（時限爆弾）」パターンの全数調査。
> 発端: 2026-09-10 の CI 緑化タスクで時限テスト3件が実際に発火（固定日付2026-06-13前提・expiry年'2026'ハードコード・モック欠落）。
> 詳細経緯: `01_DECISIONS`（obsidian-ssot）/ MLR: `00_SYSTEM/マルチLLMレビュー/2026-09-10_reserve-optimizer-CI実装レビュー/`
>
> **分類**:
> - ✅ 安全（fixture入力）: 日付文字列が純粋な入力データ（関数引数・シート行）で、実時刻と比較されない
> - 🔒 安全（frozen clock）: テスト内で formatDate や validateDateForBooking を固定値/stub に置換済み
> - 🔄 安全（動的対）: `new Date()` ベースで生成した値を同様に動的な側と比較（固定年を含まない）
> - 🛠️ 修正済み: 今回のオーディットで時限爆弾を検出し修正した
> - 👀 観察: 現在無害だが将来の変更で時限化しうる箇所

## 修正済み（🛠️）

| ファイル | 問題 | 修正 |
|---|---|---|
| tests/unit-segment-broadcast-service.test.js | `_nowDate`(2026-06-13固定)を定義するだけで未使用・固定日付前提の期待値 | `daysAgoStr(n)` 動的化+90日境界は±5日マージン（2026-09-10・ae24544） |
| tests/e2e-phase5-ticket.test.js | `expiry_date.indexOf('2026')` ハードコード（+180日の年跨ぎで必ず壊れる） | 期待年を実行日+180日から動的算出（ae24544） |
| tests/e2e-phase4-crm.test.js | モック getUuid 欠落+customer_id 期待値が uuid 実装に未追従（過去の実装変更がCI不在で隠蔽） | モック追加→シーケンス発行化+一意性不変式assert（ae24544→cb81078） |
| tests/e2e-wave1-3-integration.test.js | **validateCoupon 6呼び出しが now 無し**（実装は `now \|\| new Date()` で実時刻と期限比較）→ クーポン期限 '2026/12/31' を過ぎる **2027-01-01 に一斉FAIL** | `COUPON_TEST_NOW = new Date(2026,5,1)` を全呼び出しに渡す（2026-09-10 本オーディット） |

## 全ファイル仕分け（33ファイル・2026-09-10時点）

| ファイル | 分類 | 根拠 |
|---|---|---|
| unit-stripe-webhook.test.js | 🔄 | 署名タイムスタンプは `Date.now()` から両側生成（有効/期限切れの両ケースを明示テスト） |
| unit-segment-broadcast-service.test.js | 🔄 | daysAgoStr 動的化+マージン境界（修正済み） |
| unit-sheet-service.test.js | ✅ | formatDateObj の純関数テスト・fixture行の日付 |
| unit-staff-service.test.js | ✅ | getStaffShift 等の純データルックアップにfixture日付 |
| unit-coupon-service.test.js | 🔒 | validateCoupon 全呼び出しに固定 `today`（2026/06/12）を渡し済み・EXPIRED/境界のテストも固定now |
| unit-booking-service.test.js | ✅ | 日付はfixture入力（実時刻比較なし・grep確認） |
| unit-calendar-service.test.js | ✅ | 同上 |
| unit-cancel-handler.test.js | ✅ | 同上（'20xx'リテラルの実時刻比較なし） |
| unit-crm-service.test.js | ✅ | uuid・来院回数系・日付比較なし |
| unit-demo-seed.test.js | ✅ | シードデータ生成 |
| unit-error-handler.test.js | ✅ | エラー分類 |
| unit-followup-service.test.js | 🔄 | `new Date()` で作った値を動的側と比較（M5/M6系）・'_parseDateTime' は純関数 |
| unit-intake-service.test.js | ✅ | fixture行（'2026/01/01'は入力） |
| unit-karte-service.test.js | ✅ | 保存/取得 |
| unit-message-router.test.js | ✅ | ルーティング |
| unit-reminder-service.test.js | 🔒 | formatDate モック+`frozenDate` 固定（:320） |
| unit-reservation-handler.test.js | ✅ | fixture入力 |
| unit-review-handler.test.js | ✅ | ルーティング |
| unit-script-properties.test.js | ✅ | プロパティ |
| unit-segment-broadcast-service.test.js | 🔄 | 修正済み（上表） |
| unit-stamp-card-service.test.js | ✅/👀 | fixture '2026/06/12'・実装側 `new Date()` は作成時刻記録のみで比較なし（:38/:109確認） |
| unit-state-handler.test.js | ✅ | 状態遷移 |
| unit-subscription-service.test.js | 🔒 | formatDate モックが固定 '2026/06/13' を返す |
| unit-w2-3-flex-settings.test.js | ✅ | 設定 |
| unit-waitlist-service.test.js | ✅ | キャンセル待ち |
| e2e-phase2.test.js | ✅ | シフト/スロットの純データルックアップ（'2026/05/26'は入力） |
| e2e-phase3.test.js | 🔒 | `global.validateDateForBooking = stub`（:140）で実時刻検証を固定化 |
| e2e-phase4-crm.test.js | 🔄 | 修正済み（上表） |
| e2e-phase4-firestore.test.js | ✅ | 日付リテラルなし（grep 0件） |
| e2e-phase4-i18n.test.js | ✅ | getReminderMessage の引数（純テンプレート関数） |
| e2e-phase5-auto-response.test.js | 🔄 | yesterday/today を `new Date()` から動的生成して対比較 |
| e2e-phase5-followup.test.js | ✅ | _parseDateTime 純関数テスト |
| e2e-phase5-ticket.test.js | 🔄 | 修正済み（上表）+ '2026/11/28' はテンプレート関数の引数（無害） |
| e2e-wave1-3-integration.test.js | 🛠️ | validateCoupon 6呼び出し修正（上表） |

## 👀 観察（将来の変更で時限化しうる箇所・対応不要）

1. **`validateDateForBooking`（実装）は実時刻と比較する**（過去日拒否・MAX_BOOKING_DAYS_AHEAD・当日カットオフ）。現テストは全員 stub/frozen で安全だが、**この関数を通す新規 e2e テストを書く時は必ず stub するか日付を動的生成すること**。
2. **観察（未検証のimpl疑義）**: `ValidationUtils.validateDateForBooking` 内の `parsedDate < todayStr` は文字列比較で、呼び出し側の日期形式（'yyyy/MM/dd' か 'yyyy-MM-dd' か）によっては比較が成立しない可能性。本オーディット（テスト側）では影響なし・impl側の形式契約は要確認とする。
3. unit-stamp-card-service の fixture 日付は作成時刻の記録にのみ使われる（比較なし・実装 :38/:109 確認）。

## 運用ルール（新規テスト作成時）

- 日付は **実行日から動的生成**（例: `daysAgoStr(n)`・unit-segment-broadcast を参照）または **frozen clock/stub**（unit-reminder・unit-coupon を参照）
- 「ちょうどN日」の境界テストは **±5日マージン** で書く（TZ差で床落ちが反転しない）
- 実装が `now` 引数を持つ場合は **必ず固定nowを渡す**（validateCoupon 型）
- CI は `.github/workflows/test.yml` の root-test で毎 push 実行・時限爆弾は発火日まで静かなので本表を新規テスト作成時に参照すること
