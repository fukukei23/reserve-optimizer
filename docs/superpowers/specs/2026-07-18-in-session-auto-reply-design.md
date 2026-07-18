---
project: reserve-optimizer
date: 2026-07-18
status: design
review_round: 2（Gemini+MiniMax specレビュー反映）
tags: [reserve-optimizer, LINE-Bot, 施術中自動応答, ココナラオプション]
related:
  - docs/FEATURE_ROADMAP_2026-06-12.md
  - docs/ROADMAP_2026-06-26.md
  - 01_DECISIONS/reserve-optimizer/2026-07-17_ココナラ競合追加リサーチ3層モデル化.md
---

# 施術中自動応答（In-Session Auto Reply）設計

## 概要

個人サロンの施術中、お客さんからのLINEメッセージに即時返信できず「無視された」と不安になるのを防ぐ機能。施術中を自動検知し、定型メッセージを自動返信する。

ココナラ「LINE予約Bot構築代行」の有料オプション第1弾（バックログ機能①）。v0.1として実装する。

## 背景・目的

- **ペイン**: 個人サロン（1人店舗）は施術中に電話もLINEも出られない→お客さんが「無視された」と不安→評判悪化・機会損失
- **解決**: 施術中を自動検知し「現在施術中です。終了予定 XX:XX頃にご連絡します」と即時自動返信
- **コンテキスト**: 副業開発者が構築（平日19時〜・納期5日）。個人サロンは「予約通りにいかない」（急な休み・延長・急な来客）

## 設計判断の経緯

### Round 1: 設計レビュー（Gemini+MiniMax・brainstorming段階）
- 判定方式: **軽量ハイブリッド**（予約ベース主＋手動オーバーライド補）
  - ❌ 純手動MVP: 毎予約タンプの負担→機能死にリスク（MiniMax案の楽観性をdoubt）
  - ❌ 重厚ハイブリッド: 優先順位制御+フォールバックで工数过大（Gemini案の過大評価をdoubt）
  - ✅ 軽量ハイブリッド: 予約ベース自動（主・手間ゼロ）＋手動（補）→ 実装0.5-1日
  - 決定打: ユーザー実務知見「毎予約タンプしない・予約前から準備で忙しい」
- 押し忘れ防止: N時間経過（主・デフォ120分）＋営業終了時刻（安全装置）
  - ❌ 次予約開始時刻: ダブルブッキング空き時間施術で誤作動（両LLM一致で却下）

### Round 2: specレビュー（Gemini+MiniMax）→ 既存実装の発見
specレビューで「署名検証・LockService・CacheService・重複除外」の懸念が出たが、**既存実装で対応済み**と判明:
- 署名検証: **Cloudflare Worker層で検証済み**（Code.js:8・本番はWorker経由・GASは処理専念）
- 重複除外: **WebhookRouter.js 既存**（event ID・CacheService 20min TTL）
- LockService: **ReservationHandler.js 既存パターン**（getScriptLock・waitLock(10000)）
- CacheService: **StateHandler.js 既存**（getUserCache・TTL 6時間・PropertiesService fallback）

→ specは「既存パターン踏襲」に寄せて修正。新規は「MANUAL_UNTILのatomic更新」「クールダウンCacheService化」「DI・Clock抽象化」のみ。

## 要件（確定）

### 機能要件
1. **施術中判定**: 軽量ハイブリッド（予約ベース主＋手動オーバーライド補）
2. **自動応答**: 施術中にお客さんからの**テキストメッセージ**受信時、即時定型返信
3. **メッセージ**: 終了時刻付き（予約時は動的）＋店舗カスタマイズ可
4. **手動切替**: 管理者のみリッチメニューからON/OFF

### 非機能要件
- 並行安全（LockServiceでMANUAL_UNTIL更新をatomic化）
- クールダウン（CacheService・肥大化回避）
- タイムゾーン一貫（JST統一・timestampはUnix epoch）
- 管理者本人除外・グループ/ルーム除外
- テスト容易（DI・Clock抽象化）

## アーキテクチャ

### 既存の webhook 処理フロー（踏襲）
```
LINE → Cloudflare Worker（署名検証）→ GAS doPost
    → WebhookRouter
        ├ 冪等性チェック（既存・event ID・CacheService 20min TTL）
        ├ LockService.getScriptLock().waitLock()（既存パターン）
        └ 【新規】InSessionService.isInSession → true なら自動応答で早期return
                                              → false なら MessageRouter.handleMessage（通常）
```

**署名検証は Cloudflare Worker 層で既存**（Code.js:8）。GAS層では重複除外・ロック・施術中判定のみ。

### 新規ファイル
- `gas-project/services/InSessionService.js` — 施術中判定・自動応答（**DI可能・純粋関数中心**）

### 既存ファイル変更
- `gas-project/handlers/WebhookRouter.js` — 冪等性チェック後にInSessionService判定を追加
- `gas-project/handlers/MessageRouter.js` — postback `in_session_start`/`in_session_end` 処理を追加
- リッチメニュー設定（管理者専用エリア）

## 状態管理

### ScriptProperties（店舗グローバル設定・既存config/ScriptProperties.js拡張）
| キー | 型 | 内容 | デフォルト |
|---|---|---|---|
| `IN_SESSION_MANUAL_UNTIL` | number（Unix epoch ms）/null | 手動モード有効期限 | null |
| `IN_SESSION_AUTO_MSG_RESERVED` | string | 予約時文面（`{end_time}`プレースホルダ） | 「現在施術中です。終了予定 {end_time}頃にご連絡します」 |
| `IN_SESSION_AUTO_MSG_MANUAL` | string | 手動時文面 | 「現在施術中です。確認次第ご返信します」 |
| `IN_SESSION_RESET_MIN` | number | 手動ON後の自動リセット時間（分） | 120 |
| `IN_SESSION_COOLDOWN_MIN` | number | 同一ユーザーへの自動応答クールダウン（分） | 10 |

### CacheService（ユーザー別・TTL付き・肥大化回避）
| キー | 内容 | TTL |
|---|---|---|
| `IN_SESSION_LAST_REPLY_{userId}` | ユーザー別の最終自動応答時刻 | COOLDOWN_MIN相当 |

→ StateHandler.js の getUserCache パターン（CacheService + PropertiesService fallback）を踏襲。**ユーザー数増でScriptPropertiesが肥大化しない**。

### タイムゾーン
- 全時刻は **Unix epoch（ms）** で保存・比較（TZ不問）
- 表示（メッセージの`{end_time}`）はJST変換（`Utilities.formatDate(date, 'JST', 'HH:mm')`）
- GASプロジェクトのタイムゾーンは appsscript.json でJST確認済みの前提

## 判定ロジック（核心・DI可能）

```javascript
// InSessionService.js（疑似コード・DIでテスト可能）
// props/getCache/reservationFinder/clock は引数注入（本番は実体・テストはモック）

function isInSession(now, props, reservationFinder) {
  // LockService で get〜set を atomic に（呼出元でロック取得済み前提・既存パターン踏襲）
  var manualUntil = props.get('IN_SESSION_MANUAL_UNTIL');
  if (manualUntil && manualUntil > now.getTime()) {
    return { inSession: true, source: 'manual' };
  }
  // 期限切れの手動フラグは掃除
  if (manualUntil && manualUntil <= now.getTime()) {
    props.set('IN_SESSION_MANUAL_UNTIL', null);
  }
  // 予約ベース判定（主）・キャンセル済み除外
  var active = reservationFinder.findActiveAt(now);  // ReservationService既存 or 追加
  if (active) {
    return { inSession: true, source: 'reserved', reservation: active };
  }
  return { inSession: false };
}
```

### atomic更新（Round 2指摘対応）
- `isInSession` の呼出は **WebhookRouter の LockService.getScriptLock().waitLock() 内**で実行（既存の重複除外ロックと同じスコープ）
- MANUAL_UNTIL の get〜判定〜set（期限切れ掃除・手動ON時のセット）は全てロック内で完結→ lost update 回避

### 手動モード中に新規予約が入った場合の挙動（Round 2指摘対応）
- **手動優先のまま**（手動期限内は予約判定に行かない）
- 手動期限切れ後、自動的に予約ベース判定へ移行
- 理由: 手動は「予約外の急な施術」のための上書き・意図的に優先すべき

## 自動応答メッセージ

| 判定source | 文面 | 終了時刻 |
|---|---|---|
| `reserved` | `IN_SESSION_AUTO_MSG_RESERVED`（`{end_time}`を予約終了時刻でJST置換） | 動的挿入 |
| `manual` | `IN_SESSION_AUTO_MSG_MANUAL` | なし |

### プレースホルダ崩れ防止
- `{end_time}`置換失敗時（予約データ不整合・null）は、マニュアル時と同じ文面へフォールバック（「XX:XX頃」残り防止）

## 手動切替（リッチメニュー・管理者のみ）

### postbackアクション（MessageRouterで処理）
| postback.data | 動作（LockService内） |
|---|---|
| `action=in_session_start` | `IN_SESSION_MANUAL_UNTIL = now + IN_SESSION_RESET_MIN*60000` |
| `action=in_session_end` | `IN_SESSION_MANUAL_UNTIL = null` |

### 管理者識別
- 管理者userId（既存 `ADMIN_USER_IDS` or ScriptProperties設定を再利用・要確認）
- 管理者以外にリッチメニューのボタンを表示しない

## 押し忘れ防止

- **N時間経過リセット**: 手動ON時に `now + IN_SESSION_RESET_MIN` を期限設定。`isInSession` 呼出時に期限切れチェック＆掃除（都度判定・タイマー不要）
- **営業終了時刻リセット**: 営業終了時刻（既存の営業時間設定から取得）を超過していたら、期限に関わらず手動フラグをnull化（深夜帯の手動残し掃除の安全装置）

## エッジケース対策（Round 2反映）

| ケース | 対策 | 実装 |
|---|---|---|
| LINE重複メッセージ | webhook event IDで重複除外 | **既存WebhookRouter再利用**（CacheService 20min TTL） |
| GAS二重起動 | LockService.getScriptLock().waitLock() | **既存パターン踏襲**（ReservationHandler:587） |
| 署名検証 | Cloudflare Worker層 | **既存**（Code.js:8） |
| 管理者本人のメッセージ | 管理者userIdは自動応答対象外 | InSessionService呼出前に対象外判定 |
| 連投 | ユーザー別クールダウン | **CacheService**（getUserCache・COOLDOWN_MIN相当TTL）・StateHandlerパターン踏襲 |
| 終了時刻null | マニュアル時文面へフォールバック | InSessionService |
| 予約キャンセル残存 | findActiveAtでキャンセル済み除外 | ReservationService連携 |
| **非テキストイベント**（follow/postback等） | InSessionServiceは**テキストメッセージのみ**対象・postback（手動切替）は別処理 | WebhookRouter |
| **グループ/ルーム送信** | `source.type === 'user'`のみ処理（group/roomは無視） | WebhookRouter |

## テスト戦略（TDD・Round 2 DI反映）

### テスト基盤
- clasp + Node.js テスト（既存 tests/ ディレクトリ・unit-staff-service.test.js 等のパターン踏襲）
- InSessionService は **DI可能**（props/cache/reservationFinder/clock を引数注入）→ LockService・PropertiesService・時刻をモック化

### Unit Test（InSessionService・純粋関数）
- `isInSession`: ①手動期限内→manual ②手動期限切れ→掃除して予約判定 ③予約枠内→reserved ④両方なし→false ⑤キャンセル済み予約→false ⑥手動中に新規予約→manual優先
- メッセージ生成: ①予約時の`{end_time}`置換（JST） ②マニュアル時 ③`{end_time}`置換失敗→フォールバック
- クールダウン: ①期限内→応答しない ②期限外→応答

### Integration Test（WebhookRouter・モック）
- 施術中（予約）→自動応答・MessageRouterに行かない
- 施術中（手動）→自動応答
- 非施術中→通常ルーティング
- 管理者メッセージ→自動応答しない
- 重複event ID→2回目は応答しない（既存冪等性）
- グループ/ルーム→自動応答しない
- 非テキストイベント→自動応答しない

### 時刻依存テスト
- Clock抽象化（`now`を引数注入）で「120分経過」「営業終了」をflakyにしない

## スコープ（v0.1 MVP範囲）

### v0.1（本spec範囲・実装する）
- 軽量ハイブリッド判定（予約ベース＋手動オーバーライド）
- 自動応答メッセージ（終了時刻付き・カスタマイズ可）
- リッチメニュー手動切替（管理者のみ）
- 押し忘れ防止（N時間＋営業終了）
- エッジケース一式（既存パターン踏襲）

### v0.2以降（本spec範囲外・後日）
- 複数店舗対応（MANUAL_UNTIL_{storeId}・今回は1人店舗前提）
- LINE レート制限429リトライ・バックオフ
- 監査ログ永続化（自動応答送信履歴・別シート・Stackdriverは7日で消える）
- 統計ログ（発動回数・クールダウン効率）
- 文面A/Bテスト
- 予約ベース判定の精度向上（実際の施術開始/終了とのズレ学習）

## 実装順序（writing-plansで詳細化・Round 2反映）

1. **ドメインモデル・インターフェース確定**（InSessionResult構造・reservationFinder IF・props IF）→ 手戻りコスト最大なので最初
2. **InSessionService.js**（純粋関数・DI・TDD）
3. **ScriptProperties定義**（config/ScriptProperties.js拡張）
4. **ReservationService.findActiveAt** 連携（既存確認・なければ追加）
5. **WebhookRouter割込**（既存ロック内でInSessionService呼出・テキスト判定・source.type=user・管理者除外）
6. **MessageRouter postback処理**（in_session_start/end・ロック内）
7. **リッチメニュー設定**（管理者専用）
8. **統合テスト・E2E**

## 関連
- [FEATURE_ROADMAP_2026-06-12.md](../../FEATURE_ROADMAP_2026-06-12.md) — 全体ロードマップ（本機能は別途追記予定）
- [01_DECISIONS/reserve-optimizer/2026-07-17_ココナラ競合追加リサーチ3層モデル化.md](../../../obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-07-17_ココナラ競合追加リサーチ3層モデル化.md) — ココナラオプション機能の背景
- obsidian-ssot バックログ「reserve-optimizer ココナラ有料オプション機能実装」
- 既存実装（踏襲元）: Code.js:8（署名検証）/ WebhookRouter.js:110（重複除外）/ ReservationHandler.js:587（LockService）/ StateHandler.js:35（CacheService）
