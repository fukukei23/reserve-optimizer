---
project: reserve-optimizer
date: 2026-07-18
status: design
tags: [reserve-optimizer, LINE-Bot, 施術中自動応答, ココナラオプション]
related:
  - docs/FEATURE_ROADMAP_2026-06-12.md
  - docs/ROADMAP_2026-06-26.md
  - 01_DECISIONS/reserve-optimizer/2026-07-17_ココナラ競合追加リサーチ3層モデル化.md
---

# 施術中自動応答（In-Session Auto Reply）設計

## 概要

個人サロンの施術中、お客さんからのLINEメッセージに即時返信できず「無視された」と不安になるのを防ぐ機能。施術中であることを自動検知し、定型メッセージを自動返信する。

ココナラ「LINE予約Bot構築代行」の有料オプション第1弾（バックログ機能①）。v0.1として実装する。

## 背景・目的

- **ペイン**: 個人サロン（1人店舗）は施術中に電話もLINEも出られない→お客さんが「無視された」と不安→評判悪化・機会損失
- **解決**: 施術中を自動検知し「現在施術中です。終了予定 XX:XX頃にご連絡します」と即時自動返信
- **コンテキスト**: 副業開発者が構築（平日19時〜・納期5日）。個人サロンは「予約通りにいかない」（急な休み・延長・急な来客）

## 設計判断の経緯（Gemini+MiniMaxレビュー・doubt-driven）

### 判定方式: 軽量ハイブリッド（予約ベース主＋手動オーバーライド補）
- ❌ 純手動MVP: 毎予約タップの負担→押さない→機能死にリスク（MiniMax案の楽観性をdoubt）
- ❌ 重厚ハイブリッド: 優先順位制御+フォールバックで工数过大（Gemini案の過大評価をdoubt）
- ✅ **軽量ハイブリッド**: 予約ベース自動（主・手間ゼロ）＋手動オーバーライド（補・予約外の急な施術のみ）→ 実装0.5-1日
- **決定打**: ユーザー実務知見「毎予約タンプしない・予約前から準備で忙しい」→予約ベース主が必須

### 押し忘れ防止: N時間経過（主）＋営業終了時刻（安全装置）
- ❌ 次予約開始時刻: ダブルブッキング対策の空き時間施術で誤作動・連続予約で短すぎる（両LLM一致で却下）
- ✅ N時間経過（デフォ120分）＋営業終了時刻強制リセット

## 要件（確定）

### 機能要件
1. **施術中判定**: 軽量ハイブリッド
   - 予約ベース: 現在時刻が有効な予約枠内なら施術中
   - 手動オーバーライド: リッチメニュー1タップで手動ON（期限付き）
2. **自動応答**: 施術中にお客さんからのメッセージ受信時、即時定型返信
3. **メッセージ**: 終了時刻付き（予約時は動的）＋店舗カスタマイズ可
4. **手動切替**: 管理者のみリッチメニューからON/OFF

### 非機能要件（LLM指摘のエッジケース）
- 重複メッセージ除外（webhook event ID冪等性）
- GAS二重起動防止（LockService）
- 管理者本人のメッセージ除外
- 連投クールダウン（同一ユーザーN分間）
- プレースホルダ崩れ防止（終了時刻null時フォールバック）
- 予約キャンセル残存対策（キャンセル済み予約は除外）

## アーキテクチャ

### コンポーネント構成

```
Code.js doPost(e)
    ↓
WebhookRouter.js
    ↓ (冒頭で割込)
    ├─ InSessionService.isInSession(now, userId) → true
    │     ↓
    │   InSessionService.sendAutoReply(replyToken, userId)
    │     ↓ (早期return・MessageRouterに行かない)
    │   [終了]
    │
    └─ false → MessageRouter.handleMessage() (通常ルーティング)
```

### 新規ファイル
- `gas-project/services/InSessionService.js` — 施術中判定・自動応答（純粋関数中心）

### 既存ファイル変更
- `gas-project/handlers/WebhookRouter.js` — 冒頭にInSessionService判定を追加
- `gas-project/handlers/MessageRouter.js` — postback `in_session_start`/`in_session_end` の処理を追加
- リッチメニュー設定（基本3タブとは別の管理者専用エリア・または4タブ目）

## 状態管理（ScriptProperties）

| キー | 型 | 内容 | デフォルト |
|---|---|---|---|
| `IN_SESSION_MANUAL_UNTIL` | timestamp/null | 手動モード有効期限。null=手動OFF | null |
| `IN_SESSION_AUTO_MSG_RESERVED` | string | 予約時の文面（`{end_time}`プレースホルダ） | 「現在施術中です。終了予定 {end_time}頃にご連絡します」 |
| `IN_SESSION_AUTO_MSG_MANUAL` | string | 手動時の文面 | 「現在施術中です。確認次第ご返信します」 |
| `IN_SESSION_RESET_MIN` | number | 手動ON後の自動リセット時間（分） | 120 |
| `IN_SESSION_COOLDOWN_MIN` | number | 同一ユーザーへの自動応答クールダウン（分） | 10 |

※予約ベース判定は状態を持たず、ReservationService から都度算出（純粋関数）。

## 判定ロジック（核心）

```javascript
// InSessionService.js（疑似コード）
function isInSession(now) {
  // 1. 手動オーバーライド（優先・期限チェック込み）
  var manualUntil = getScriptProperty('IN_SESSION_MANUAL_UNTIL');
  if (manualUntil && new Date(manualUntil) > now) {
    return { inSession: true, source: 'manual' };
  }
  // 期限切れの手動フラグは掃除
  if (manualUntil && new Date(manualUntil) <= now) {
    setScriptProperty('IN_SESSION_MANUAL_UNTIL', null);
  }
  // 2. 予約ベース判定（主）
  var activeReservation = ReservationService.findActiveAt(now);
  if (activeReservation) {
    return { inSession: true, source: 'reserved', reservation: activeReservation };
  }
  return { inSession: false };
}
```

### 予約ベース判定の詳細
- `ReservationService.findActiveAt(now)`: 現在時刻が「有効（キャンセル済みでない）」な予約の開始〜終了時刻内にあるか
- キャンセル済み予約は除外（キャンセル残存対策）

## 自動応答メッセージ

| 判定source | 文面 | 終了時刻 |
|---|---|---|
| `reserved` | `IN_SESSION_AUTO_MSG_RESERVED`（`{end_time}`を予約終了時刻で置換） | 動的挿入 |
| `manual` | `IN_SESSION_AUTO_MSG_MANUAL` | なし |

### プレースホルダ崩れ防止
- `{end_time}`置換失敗時（予約データ不整合等）は、マニュアル時と同じ文面にフォールバック

## 手動切替（リッチメニュー・管理者のみ）

### postbackアクション
| postback.data | 動作 |
|---|---|
| `action=in_session_start` | `IN_SESSION_MANUAL_UNTIL = now + IN_SESSION_RESET_MIN`分 |
| `action=in_session_end` | `IN_SESSION_MANUAL_UNTIL = null` |

### 管理者識別
- 管理者userId（ScriptProperties `ADMIN_USER_IDS`・既存があれば再利用・なければ新設）で判定
- 管理者以外にリッチメニューのボタンを表示しない（LINE公式のリッチメニュー切り替え機能・またはuidベース表示分岐）

## 押し忘れ防止

- **N時間経過リセット**: 手動ON時に `now + IN_SESSION_RESET_MIN` を期限として設定。`isInSession` 呼出時に期限切れチェック＆掃除（都度判定・タイマー不要）
- **営業終了時刻リセット**: 営業終了時刻（既存の営業時間設定）を超過していたら、期限に関わらず手動フラグをnull化（深夜帯の手動残し掃除の安全装置）

## エッジケース対策（詳細）

| ケース | 対策 | 実装箇所 |
|---|---|---|
| LINE重複メッセージ | webhook event IDで重複除外（既存の冪等性機構があれば再利用・なければ`PROCESSED_EVENT_IDS`時限キャッシュ） | WebhookRouter |
| GAS二重起動 | `LockService.getDocumentLock().tryLock(30秒)`で排他 | WebhookRouter冒頭 |
| 管理者本人のメッセージ | 管理者userIdは自動応答対象外（`isInSession`の呼出前に対象外判定） | WebhookRouter |
| 連投クールダウン | 同一ユーザーへの最終自動応答時刻をキャッシュ（`LAST_AUTO_REPLY_{userId}`）・`IN_SESSION_COOLDOWN_MIN`以内は再応答しない | InSessionService |
| 終了時刻null | マニュアル時文面へフォールバック | InSessionService |
| 予約キャンセル残存 | `findActiveAt`でキャンセル済み予約を除外 | ReservationService連携 |

## テスト戦略（TDD）

### Unit Test（InSessionService・純粋関数）
- `isInSession`: ①手動期限内→manual ②手動期限切れ→掃除して予約判定 ③予約枠内→reserved ④両方なし→false ⑤キャンセル済み予約→false
- メッセージ生成: ①予約時の`{end_time}`置換 ②マニュアル時 ③`{end_time}`置換失敗→フォールバック
- クールダウン: ①期限內→応答しない ②期限外→応答

### Integration Test（WebhookRouter）
- 施術中（予約）→自動応答・MessageRouterに行かない
- 施術中（手動）→自動応答
- 非施術中→通常ルーティング
- 管理者メッセージ→自動応答しない
- 重複event ID→2回目は応答しない

### E2E（必要に応じて）
- 実際のLINE公式アカウント（テスト用）で: 予約時間中にメッセージ送信→自動応答確認

## スコープ（v0.1 MVP範囲）

### v0.1（本spec範囲・実装する）
- 軽量ハイブリッド判定（予約ベース＋手動オーバーライド）
- 自動応答メッセージ（終了時刻付き・カスタマイズ可）
- リッチメニュー手動切替（管理者のみ）
- 押し忘れ防止（N時間＋営業終了）
- エッジケース一式

### v0.2以降（本spec範囲外・後日）
- 統計ログ（自動応答発動回数・クールダウン効率）
- 文面のA/Bテスト
- 予約ベース判定の精度向上（実際の施術開始/終了とのズレ学習）

## 実装順序（writing-plansで詳細化）

1. InSessionService.js（純粋関数・TDD）
2. 状態管理のScriptProperties定義
3. ReservationService.findActiveAt 連携（既存確認・必要なら追加）
4. WebhookRouter割込実装（LockService・重複除外・管理者除外）
5. MessageRouter postback処理（in_session_start/end）
6. リッチメニュー設定（管理者専用）
7. 統合テスト・E2E

## 関連
- [FEATURE_ROADMAP_2026-06-12.md](../../FEATURE_ROADMAP_2026-06-12.md) — 全体ロードマップ（本機能は別途追記予定）
- [01_DECISIONS/reserve-optimizer/2026-07-17_ココナラ競合追加リサーチ3層モデル化.md](../../../obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-07-17_ココナラ競合追加リサーチ3層モデル化.md) — ココナラオプション機能の背景
- obsidian-ssot バックログ「reserve-optimizer ココナラ有料オプション機能実装」
