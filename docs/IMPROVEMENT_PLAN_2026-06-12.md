# reserve-optimizer 改善計画 — 2026-06-12

> 評価者: Claude Sonnet 4.6
> 対象: gas-project/, worker/, tests/ 全体
> 前提: refactoring-backlog.md のP0〜P3は大半完了済み。本書は残課題と新規発見の整理。

---

## 評価サマリー

### 強み（触らない）
| 項目 | 評価 |
|------|------|
| LINE署名検証 + `waitUntil` でタイムアウト回避 | ★★★★★ 設計が正しい |
| `timingSafeEqual` 自前実装 | ★★★★★ タイミング攻撃対策を理解している証拠 |
| Stripe Webhook 冪等性チェック | ★★★★ ISSUE化済み・実装済み |
| `config/SheetConfig.js` の定数管理 | ★★★★ 高品質ファイルとして評価済み |
| ハンドラ分割（P1-1完了） | ★★★ 1,700行モノリス→6ファイルに分離 |
| i18n 6言語対応 | ★★★★ 差別化ポイント |

---

## 未解決・新発見の問題（優先度順）

### 🔴 HIGH-1: Worker の `console.log` が本番コードに大量残存

**ファイル**: `worker/src/index.ts`
**行**: 88, 91, 97, 101, 144, 226, 228, 230, 235, 238 など14箇所

```typescript
// 現状（本番ログノイズ）
console.log("[LINE] Received webhook, body length:", body.length);
console.log("[LINE] Signature valid:", isValid);
console.log("[GAS] Full URL length:", gasUrl.length);
```

**問題**: Cloudflare Workers のログは課金対象。デバッグ情報が外部から参照可能な状態。
**修正**: 環境変数 `DEBUG=true` フラグで制御するか、`console.log` を全削除。
**工数**: 30分

---

### 🔴 HIGH-2: CORS が `"*"` のまま（決済APIに不適切）

**ファイル**: `worker/src/index.ts:315-319`

```typescript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",  // ← 問題
  ...
};
```

**問題**: `/api/reserve`（予約作成）と `/api/availability` に `*` CORS を適用している。
決済フローを含むAPIにワイルドカードCORSは不適切。
**修正**: `ALLOWED_ORIGIN` 環境変数を追加し、`Access-Control-Allow-Origin` を本番ドメインのみに制限。
**工数**: 1時間

---

### 🔴 HIGH-3: テストカバレッジ不足（ISSUE-001 未完了）

**現状**: Worker 側のユニットテストがゼロ。GAS側も統合テスト中心。
**具体的に不足しているテスト**:
- `verifyLineSignature` — 正常/不正署名のユニットテスト
- `verifyStripeSignature` — タイムスタンプ期限切れ検証
- `timingSafeEqual` — 長さ不一致・等値・非等値
- `StateHandler` の状態遷移行列（15状態 × 主要入力）

**修正**: `vitest` + `@cloudflare/vitest-pool-workers` でWorker側テスト追加。
**工数**: 1〜2日

---

### 🟡 MED-1: `forwardToGAS` の302リダイレクト追従（ISSUE-003 未完了）

**ファイル**: `worker/src/index.ts:225-270`

**問題**:
- GASへのデータ転送をURLクエリパラメータ（GET）で行っている
- 302リダイレクト時にパラメータを再付与する脆弱なロジック
- GAS Web App仕様変更で即死するリスク

```typescript
// body をクエリパラメータで渡す（URL長2000文字制限リスク）
const gasUrl = `${env.GAS_WEBAPP_URL}?x-verified=true&x-source=${source}&x-body=${encodedBody}&x-gas-auth=...`;
```

**修正方針**: 
- 短期: URL長2000文字超過時のアラートをGASに通知する仕組みを追加
- 中期: GAS Apps Script Execution API への移行検討

---

### 🟡 MED-2: ステートマシンが if/switch ベース（ISSUE-004 未完了）

**ファイル**: `handlers/MessageRouter.js`, `handlers/StateHandler.js`

**問題**: 状態遷移が命令型 if/switch チェーン。新状態追加のたびに複雑度が線形増加。不正遷移の明示的拒否なし。

**修正方針**:
```javascript
// 宣言的遷移テーブル（目標形式）
var TRANSITIONS = {
  IDLE: { 'reserve': 'AWAITING_TREATMENT', 'cancel': 'AWAITING_CANCEL_SELECT' },
  AWAITING_TREATMENT: { 'select': 'AWAITING_DATE' },
  // ...
};
```

**工数**: 1〜2日

---

### 🟡 MED-3: P1-2 スプレッドシート検索最適化が未完了

**ファイル**: `services/SheetService.js`

**問題**: `getReservationsByLineUserId` 等が O(n) リニアスキャン。予約件数増加でパフォーマンス劣化。

**修正**: `_reservationCache` Map構造を導入し、1実行内でO(1)ルックアップを実現。

---

### 🟡 MED-4: ビジネスインパクト数値が README に無い（ISSUE-002 未完了）

**問題**: ポートフォリオとして見た時に「何がどう改善したか」が一切数値化されていない。採用面接で弱点になる。

**推奨追記内容**:
- 月間予約処理件数（推定・実測どちらでも）
- 電話受付からBot受付への切り替えで削減した受付時間
- Webhook平均レイテンシ（/health エンドポイントで取れる）
- Stripe決済成功率

---

### 🟢 LOW-1: `slimForGAS` の `undefined` 代入がバグ

**ファイル**: `worker/src/index.ts:284`

```typescript
// 現状（バグ: JSON.stringifyはundefinedキーを除去するが、意図が不明瞭）
parsed.destination = undefined;

// 推奨（明示的な削除）
delete parsed.destination;
```

---

### 🟢 LOW-2: CI/CD バッジ未設定（ISSUE-006 未完了）

**推奨**: GitHub Actions で `clasp lint` + `jest` + `wrangler deploy --dry-run` を自動化し、バッジをREADMEに追加。

---

### 🟢 LOW-3: `GAS_AUTH_TOKEN` が README のセットアップ手順から漏れている

**ファイル**: `README.md`（セットアップ > ScriptProperties設定 の表）

`worker/src/index.ts` の `Env` インタフェースに `GAS_AUTH_TOKEN` があるが、README のセットアップ手順に記載がない。新規セットアップ者が詰まるポイント。

---

## 優先実施順（推奨ロードマップ）

```
Week 1（ポートフォリオ品質）
  HIGH-1: Worker console.log 削除（30分）
  HIGH-2: CORS 制限（1時間）
  MED-4:  README Impact セクション追加（1時間）
  LOW-3:  README セットアップ手順に GAS_AUTH_TOKEN 追記（15分）

Week 2（信頼性・テスト）
  HIGH-3: Worker ユニットテスト追加（1〜2日）
  LOW-1:  slimForGAS の delete 修正（15分）

Week 3（アーキテクチャ改善）
  MED-2: ステートマシンの宣言的テーブル化（1〜2日）
  MED-3: SheetService O(1) キャッシュ（半日）
  LOW-2: CI/CD バッジ（半日）

中長期（Phase 2移行時）
  MED-1: forwardToGAS の302ハック解消
```

---

## 参照

- [refactoring-backlog.md](refactoring-backlog.md) — P0〜P3 完了済み作業
- [REVIEW_ISSUES_2026-05-15.md](REVIEW_ISSUES_2026-05-15.md) — Opus×MiniMaxレビュー結果
- [PRODUCT_VISION.md](PRODUCT_VISION.md) — Phase 2: Next.js + Supabase移行計画
