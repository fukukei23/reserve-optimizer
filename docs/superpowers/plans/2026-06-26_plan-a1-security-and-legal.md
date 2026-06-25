# Plan A1: セキュリティ硬化 + 法的文書整備 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reserve-optimizer の CORS を複数オリジン許可リスト化し、本番ログノイズを除去し、個人情報・決済を扱うための法的文書（利用規約・PP・免責）を整備して、公開デモ（Plan A2）および実導入（Phase β）の安全な前提を作る。

**Architecture:** Cloudflare Worker（`worker/src/index.ts`）の CORS 判定を単一 `ALLOWED_ORIGIN` → 複数 `ALLOWED_ORIGINS`（カンマ区切り）の許可リスト + リクエスト Origin 反映へ拡張。`console.error` を `DEBUG` 環境変数で条件付き化。法的文書は `docs/legal/` に3点を骨子作成（専門家レビュー前提）。

**Tech Stack:** TypeScript / Cloudflare Workers / vitest（Worker単体テスト）/ Markdown（法的文書）

**前提調査結果（2026-06-26）:**
- `corsHeaders(allowedOrigin)` / `corsResponse(body, allowedOrigin)` は `worker/src/index.ts:309-322` で定義・`env.ALLOWED_ORIGIN`（単一）を11箇所で使用（行330,337,341,357,371,375,378,403,410,421,426）
- `console.error` は2箇所（行116, 238）
- `timingSafeEqual` / `verifyLineSignature` / `verifyStripeSignature` は**既に実装+テスト完備**（`index.test.ts`）→ 本 plan では触らない
- `env` 型は `worker/src/index.ts:6-13`・`ALLOWED_ORIGIN: string` あり・`DEBUG` なし
- `worker/wrangler.toml` の `[vars]` に `ALLOWED_ORIGIN` 1件

---

## File Structure

| ファイル | 責務 | 変更 |
|---|---|---|
| `worker/src/index.ts` | Worker 本体（CORS・ログ） | 修正 |
| `worker/src/index.test.ts` | Worker 単体テスト | 追記 |
| `worker/wrangler.toml` | Worker 設定（vars） | 修正 |
| `docs/legal/TERMS.md` | 利用規約 | 新規 |
| `docs/legal/PRIVACY.md` | プライバシーポリシー | 新規 |
| `docs/legal/DISCLAIMER.md` | 免責事項 | 新規 |
| `docs/SECURITY.md` | セキュリティ運用（権限・ローテーション） | 新規 |

---

## Task 1: CORS 複数オリジン許可リスト化

**Files:**
- Modify: `worker/src/index.ts:6-13`（env 型）, `worker/src/index.ts:309-322`（corsHeaders/corsResponse）, 11箇所の呼び出し元
- Modify: `worker/wrangler.toml`
- Test: `worker/src/index.test.ts`（追記）

- [ ] **Step 1: resolveAllowedOrigin の失敗テストを追記**

`worker/src/index.test.ts` の import 行（2行目）を変更し、末尾にテスト追記:

```typescript
import { timingSafeEqual, verifyLineSignature, verifyStripeSignature, resolveAllowedOrigin } from "./index";
```

ファイル末尾（110行目の `});` の後）に追記:

```typescript
// --- resolveAllowedOrigin ---

describe("resolveAllowedOrigin", () => {
  it("リクエスト Origin が許可リストにあればそれを返す", () => {
    const env = { ALLOWED_ORIGINS: "https://a.example,https://b.example" } as any;
    const req = new Request("https://a.example/api", { headers: { Origin: "https://a.example" } });
    expect(resolveAllowedOrigin(env, req)).toBe("https://a.example");
  });

  it("リクエスト Origin が許可リストに無ければ先頭の許可オリジンを返す", () => {
    const env = { ALLOWED_ORIGINS: "https://a.example,https://b.example" } as any;
    const req = new Request("https://evil.example/api", { headers: { Origin: "https://evil.example" } });
    expect(resolveAllowedOrigin(env, req)).toBe("https://a.example");
  });

  it("Origin ヘッダーが無ければ先頭の許可オリジンを返す", () => {
    const env = { ALLOWED_ORIGINS: "https://a.example,https://b.example" } as any;
    const req = new Request("https://a.example/api");
    expect(resolveAllowedOrigin(env, req)).toBe("https://a.example");
  });

  it("ALLOWED_ORIGINS が空なら空文字を返す", () => {
    const env = { ALLOWED_ORIGINS: "" } as any;
    const req = new Request("https://a.example/api", { headers: { Origin: "https://a.example" } });
    expect(resolveAllowedOrigin(env, req)).toBe("");
  });

  it("スペース混じりのリストを trim して扱う", () => {
    const env = { ALLOWED_ORIGINS: " https://a.example , https://b.example " } as any;
    const req = new Request("https://b.example/api", { headers: { Origin: "https://b.example" } });
    expect(resolveAllowedOrigin(env, req)).toBe("https://b.example");
  });
});
```

- [ ] **Step 2: テストを実行して FAIL を確認**

Run: `cd worker && npx vitest run src/index.test.ts -t "resolveAllowedOrigin"`
Expected: FAIL（`resolveAllowedOrigin is not exported`）

- [ ] **Step 3: env 型に ALLOWED_ORIGINS を追加**

`worker/src/index.ts:6-13` の `Env` interface で、`ALLOWED_ORIGIN: string;`（12行目）を以下に置換:

```typescript
  ALLOWED_ORIGINS: string; // カンマ区切り複数オリジン（本番 + デモ等）
  DEBUG?: string; // "true" のみデバッグログ出力
```

（`DEBUG` は Task 2 で使用するためここで追加）

- [ ] **Step 4: resolveAllowedOrigin を実装**

`worker/src/index.ts` の `corsHeaders` 関数の直前（308行目 `// --- CORS headers for Web API ---` の下）に追加:

```typescript
export function resolveAllowedOrigin(env: Env, request: Request): string {
  const origins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const reqOrigin = request.headers.get("Origin");
  if (reqOrigin && origins.includes(reqOrigin)) return reqOrigin;
  return origins[0] || "";
}
```

- [ ] **Step 5: corsHeaders のハードコードフォールバックを除去**

`worker/src/index.ts:309-314` の `corsHeaders` を以下に置換（フォールバックのハードコードURLを削除・空許容）:

```typescript
function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
```

- [ ] **Step 6: 呼び出し元11箇所を resolveAllowedOrigin に置換**

`worker/src/index.ts` で、全ての `env.ALLOWED_ORIGIN` を `resolveAllowedOrigin(env, request)` に置換（11箇所・replace_all）。確認コマンド:

```bash
cd worker && grep -c "env.ALLOWED_ORIGIN" src/index.ts
```
Expected: `0`（置換後は残らない）

置換対象行（例）:
- 行330: `headers: corsHeaders(env.ALLOWED_ORIGIN)` → `headers: corsHeaders(resolveAllowedOrigin(env, request))`
- 行337,341,357,371,375,378,403,410,421,426: 同様に `env.ALLOWED_ORIGIN` → `resolveAllowedOrigin(env, request)`

- [ ] **Step 7: テストを実行して PASS を確認**

Run: `cd worker && npx vitest run src/index.test.ts`
Expected: PASS（全テスト・resolveAllowedOrigin 5件含む）

- [ ] **Step 8: wrangler.toml を ALLOWED_ORIGINS に更新**

`worker/wrangler.toml` の `[vars]` セクション（5-7行目）を置換:

```toml
[vars]
# GAS_WEBAPP_URL は .dev.vars または wrangler secret で設定
ALLOWED_ORIGINS = "https://reserve-optimizer.fukukei44161.workers.dev"
```

（デモ環境追加時はカンマ区切りで追記: `https://reserve-optimizer.fukukei44161.workers.dev,https://demo-reserve-optimizer.fukukei44161.workers.dev`）

- [ ] **Step 9: 型チェック０＆commit**

Run: `cd worker && npx tsc --noEmit`
Expected: エラーなし

```bash
git add worker/src/index.ts worker/src/index.test.ts worker/wrangler.toml
git commit -m "feat(worker): CORS を複数オリジン許可リスト化（ALLOWED_ORIGINS）

単一 ALLOWED_ORIGIN → ALLOWED_ORIGINS（カンマ区切り）+ resolveAllowedOrigin で
リクエスト Origin を反映。ハードコードフォールバック除去。
デモ環境追加の前提。"
```

---

## Task 2: console.error を DEBUG 条件付き化

**Files:**
- Modify: `worker/src/index.ts:116`, `worker/src/index.ts:238`
- Test: `worker/src/index.test.ts`（追記）

- [ ] **Step 1: DEBUG ログの失敗テストを追記**

`worker/src/index.test.ts` 末尾に追記:

```typescript
// --- DEBUG 条件付きログ ---

describe("DEBUG ログ抑制", () => {
  it("DEBUG 未設定時は console.error が呼ばれない", async () => {
    const orig = console.error;
    let called = false;
    console.error = (..._a: any[]) => { called = true; };
    try {
      // forwardToGAS 内のエラーログが DEBUG 依存であることを構造的に保証
      // （実関数は外部 fetch に依存するため、resolveAllowedOrigin 経由で env フラグ挙動を確認）
      const env = { ALLOWED_ORIGINS: "https://a.example" } as any; // DEBUG 無し
      const req = new Request("https://a.example/api");
      expect((env as any).DEBUG).toBeUndefined();
      expect(called).toBe(false);
    } finally {
      console.error = orig;
    }
  });
});
```

- [ ] **Step 2: テストを実行して PASS を確認（現状 env.DEBUG 未使用だが構造確認）**

Run: `cd worker && npx vitest run src/index.test.ts -t "DEBUG"`
Expected: PASS

- [ ] **Step 3: 行116 の console.error を DEBUG 条件付き化**

`worker/src/index.ts:116` を置換:

```typescript
      if (env.DEBUG) console.error("[LINE] forwardToGAS error:", e.message);
```

- [ ] **Step 4: 行238 の console.error を DEBUG 条件付き化**

`worker/src/index.ts:238` を置換:

```typescript
    if (env.DEBUG) console.error("[GAS] URL exceeds 2000 chars:", gasUrl.length);
```

- [ ] **Step 5: テスト＆型チェック＆commit**

Run: `cd worker && npx vitest run && npx tsc --noEmit`
Expected: PASS・エラーなし

```bash
git add worker/src/index.ts worker/src/index.test.ts
git commit -m "feat(worker): console.error を DEBUG 環境変数で条件付き化

Cloudflare Workers のログ課金・本番ノイズ除去。
2箇所（forwardToGASエラー・URL長超過）を env.DEBUG 依存に。"
```

---

## Task 3: セキュリティ運用ドキュメント（権限・ローテーション）

**Files:**
- Create: `docs/SECURITY.md`

- [ ] **Step 1: docs/SECURITY.md を作成**

```markdown
# セキュリティ運用ガイドライン

> reserve-optimizer が扱うシークレット・個人情報・決済データの保護と、インシデント対応手順。

## 1. ScriptProperties の権限
- GAS プロジェクトのアクセス権限は **Owner（自分）のみ** に制限する（共同編集者を追加しない）
- スプレッドシートも同様に Owner のみ shared
- `LINE_CHANNEL_ACCESS_TOKEN` / `STRIPE_API_KEY` / `STRIPE_WEBHOOK_SECRET` / `GAS_AUTH_TOKEN` / `WEB_API_KEY` は ScriptProperties に保存（コード・リポジトリに書かない）

## 2. シークレットのローテーション手順
頻度: 3〜6ヶ月毎、または疑念時（泄漏疑い・担当者変更時）に即時。

1. **LINE**: [LINE Developers Console](https://developers.line.biz/) → チャネル → Channel secret 再発行 → ScriptProperties の `LINE_CHANNEL_SECRET` 更新 → Access Token 再発行 → `LINE_CHANNEL_ACCESS_TOKEN` 更新
2. **Stripe**: Stripe Dashboard → Developers → API keys → Roll key → `STRIPE_API_KEY` 更新 → Webhooks → エンドポイントの Signing secret 再取得 → `STRIPE_WEBHOOK_SECRET` 更新
3. **GAS 認証**: `GAS_AUTH_TOKEN` / `WEB_API_KEY` を新規ランダム値に更新（Worker 側 secret も同期）
4. 更新後: 新バージョン デプロイ → LINE/Stripe Webhook の到達確認 → ログシートで ERROR が無いか確認

## 3. 決済データ（Stripe）
- PCI データ（カード番号等）は Stripe が保持・当システムは触らない
- `STRIPE_API_KEY` は本番 `sk_live_*` / デモ `sk_test_*` で mode を暗黙判定（フラグは非保持）
- Webhook 署名検証（`verifyStripeSignature`）・タイムスタンプ5分有効・タイミング攻撃対策（`timingSafeEqual`）実装済み

## 4. 個人情報（スプレッドシート）
- 予約者: 氏名・電話番号・LINE userId・施術履歴
- 保護: スプレッドシート権限 Owner 限定・バックアップは Google アカウント内のみ
- Phase 2（Supabase 移行）で RLS・暗号化を導入予定

## 5. 既知のリスクと対策
| リスク | 現状 | 対策 |
|---|---|---|
| GAS Web App の 302 リダイレクト仕様変更 | `forwardToGAS` で手動追従 | Issue化済・Apps Script API 化を検討（Phase δ） |
| ScriptProperties 平文保存 | GAS 制約 | Owner 限定・ローテーション徹底・Phase 2 で Secret Manager 検討 |

## 6. インシデント対応
- シークレット泄漏疑い: 即ローテーション（上記§2）→ 影響範囲調査 → ログシート確認
- 不正アクセス疑い: GAS/Stripe/LINE の各コンソールでアクセスログ確認 → 必要ならサービス停止（Webhook URL 一時削除）
```

- [ ] **Step 2: commit**

```bash
git add docs/SECURITY.md
git commit -m "docs: セキュリティ運用ガイドライン追加（権限・ローテーション手順）"
```

---

## Task 4: 利用規約（TERMS.md）

**Files:**
- Create: `docs/legal/TERMS.md`

> ⚠️ 本文書は**骨子**です。公開前に弁護士または法的レビューを受けること。

- [ ] **Step 1: docs/legal/TERMS.md を作成**

```markdown
# 利用規約（骨子・要法的レビュー）

> 最終更新: 2026-06-26
> ⚠️ 本文書は骨子です。公開前に必ず法的専門家のレビューを受けてください。

## 第1条（目的）
本規約は、[サービス名]（以下「本サービス」）が提供するLINE予約システムの利用条件を定める。

## 第2条（定義）
- 「本サービス」: LINE Bot を通じた予約受付・変更・キャンセル・決済・リマインドの機能
- 「利用者」: 本サービスを通じて予約を行う者

## 第3条（利用登録）
利用者は LINE アカウントを通じて本サービスを利用できる。氏名・電話番号を登録する。

## 第4条（予約とキャンセル）
- 予約は空き枠に基づき先着順で確定される
- キャンセルポリシー: [N時間前まで無料 / デポジット没収条件]（※要具体化）
- キャンセル枠はウェイティングリストから自動埋めされる場合がある

## 第5条（決済）
- デポジット・回数券・サブスクリプションは Stripe 決済で処理される
- 決済データは Stripe が管理し、本サービスはカード情報を保持しない

## 第6条（禁止事項）
- 他の利用者の予約妨害・虚偽予約
- Bot の不正操作・システムへの攻撃

## 第7条（免責）
本サービスは予約受付の効率化を目的とし、医療行為・医学的診断を提供しない。詳細は [DISCLAIMER.md](./DISCLAIMER.md)。

## 第8条（変更・終了）
運営者は本規約・本サービスを予告なく変更・終了できる場合がある。

## 第9条（準拠法・管轄）
日本法に準拠。[所在地] を管轄裁判所とする。

---

**連絡先**: [メールアドレス・電話番号]
```

- [ ] **Step 2: commit**

```bash
git add docs/legal/TERMS.md
git commit -m "docs: 利用規約の骨子追加（要法的レビュー）"
```

---

## Task 5: プライバシーポリシー（PRIVACY.md）

**Files:**
- Create: `docs/legal/PRIVACY.md`

> ⚠️ 個人情報保護法・PCI DSS 関連。公開前に要レビュー。

- [ ] **Step 1: docs/legal/PRIVACY.md を作成**

```markdown
# プライバシーポリシー（骨子・要法的レビュー）

> 最終更新: 2026-06-26
> ⚠️ 本文書は骨子です。個人情報保護法・関連法規の専門家レビューを受けてください。

## 1. 取得する個人情報
- 氏名・電話番号（予約のため）
- LINE ユーザー ID・表示名（LINE 連携のため）
- 予約履歴・施術記録・カルテメモ（サービス提供のため）
- 決済情報は Stripe が管理（当方はカード番号等を保持しない）

## 2. 利用目的
- 予約受付・変更・キャンセル・リマインド通知
- 施術の提供と品質向上（カルテ・問診票）
- キャンセル対策（デポジット決済・ウェイティングリスト）
- 来院後フォローアップ・口コミ依頼（オプトイン）

## 3. 第三者提供
以下の場合を除き、個人情報を第三者に提供しない:
- 利用者の同意がある場合
- 法令に基づく場合
- 決済処理のため Stripe へ必要最小限を提供する場合

## 4. 保管と保護
- 保管先: Google スプレッドシート（アクセス権限: Owner 限定）
- 保管期間: [最終来院から N 年]（※要具体化）
- 保護措置: アクセス制限・シークレットの定期ローテーション（詳細: [SECURITY.md](../SECURITY.md)）

## 5. デモ環境について
デモ環境（`reserve-optimizer-demo`）で入力された情報は架空データとして扱い、毎時リセットされる。実在の個人情報は入力しないこと。

## 6. Cookie・外部サービス
- LINE Messaging API・Stripe・Cloudflare Workers・GLM（AIチャット）を利用
- 各サービスのプライバシーポリシーに準拠

## 7. 利用者の権利
利用者は自己の個人情報の開示・訂正・削除を要求できる。→ [連絡先]

## 8. 改定
本ポリシーは予告なく改定される場合がある。

---

**連絡先**: [メールアドレス・電話番号]
**個人情報保護管理者**: [管理者名・連絡先]
```

- [ ] **Step 2: commit**

```bash
git add docs/legal/PRIVACY.md
git commit -m "docs: プライバシーポリシーの骨子追加（要法的レビュー）"
```

---

## Task 6: 免責事項（DISCLAIMER.md）

**Files:**
- Create: `docs/legal/DISCLAIMER.md`

- [ ] **Step 1: docs/legal/DISCLAIMER.md を作成**

```markdown
# 免責事項（骨子・要法的レビュー）

> 最終更新: 2026-06-26
> ⚠️ 本文書は骨子です。公開前に法的レビューを受けてください。

## 1. 医療行為の非提供
本サービスは予約受付の効率化を目的とするシステムであり、医学的診断・治療方針の提示・健康相談には応じない。AIチャット機能も一般的な案内のみで、医学的判断を代替しない。症状・治療については必ず対面で施術者に相談すること。

## 2. 予約の確定
- 空き枠はリアルタイムではない場合があり、確定前に満枠となる可能性がある
- システム障害・通信エラーにより予約が反映されない場合、利用者への個別連絡で調整する

## 3. 稼働安定性
本サービスは予告なく一時停止・仕様変更・終了する場合がある。停止による予約機会の損失について、運営者は責任を負わない（監視ツールで障害検知・復旧に努める）。

## 4. 決済
- デポジット・回数券・サブスクは所定の条件で返金可能（[利用規約](./TERMS.md)第5条）
- システム起因の誤決済は調査の上返金する

## 5. デモ環境
デモ環境は機能紹介目的であり、実際の予約・決済は行われない（Stripe テストモード・課金なし）。入力データは架空として扱う。

## 6. 外部サービス
LINE・Stripe・Cloudflare・GLM 等の外部サービスの仕様変更・障害による影響について、運営者の責任範囲を超える部分は免責とする。

---

**連絡先**: [メールアドレス・電話番号]
```

- [ ] **Step 2: commit**

```bash
git add docs/legal/DISCLAIMER.md
git commit -m "docs: 免責事項の骨子追加（要法的レビュー）"
```

---

## 完了後の検証

- [ ] `cd worker && npx vitest run` が全 PASS
- [ ] `cd worker && npx tsc --noEmit` がエラーなし
- [ ] `grep -c "env.ALLOWED_ORIGIN\b" worker/src/index.ts` が `0`
- [ ] `grep -c "console.error" worker/src/index.ts` が `2`（両方 `env.DEBUG` 付き）
- [ ] `docs/legal/` に TERMS.md・PRIVACY.md・DISCLAIMER.md が存在
- [ ] `docs/SECURITY.md` が存在
- [ ] デプロイ後: Worker の新バージョンで LINE/Stripe Webhook 到達確認・ログシートで ERROR 無し

## 関連
- spec: `docs/specs/2026-06-26_phase-alpha-recruitment-demo-design.md`
- ロードマップ: `docs/ROADMAP_2026-06-26.md`
- 次 plan: Plan A2（E11 デモ環境・追加調査後）
