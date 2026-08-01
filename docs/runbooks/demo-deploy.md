# デモ環境デプロイ手順（Phase α E11）

> 採用デモ環境の構築・運用手順。**本番環境と物理分離**（別GASプロジェクト・別Spreadsheet・別Worker）。

関連: [spec](../specs/2026-06-26_phase-alpha-recruitment-demo-design.md) / [セキュリティ: token-rotation](./token-rotation.md) / [法的: DISCLAIMER](../legal/DISCLAIMER.md)

---

## 前提
- 本番GASプロジェクト（scriptId `1Ujr...`）・本番Spreadsheet（`18grw9Mv...`）は**触らない**
- demo環境はすべて別リソース（別GAS・別Sheet・別Worker）

---

## S2: ユーザー作業（LLM不可・クレデンシャル系）

### 1. demo用 Spreadsheet 作成
- Google Sheets で新規スプレッドシート作成（例: 「reserve-optimizer demo」）
- `spreadsheetId` を記録
- シート作成は初回push後、demo GAS の `runSetup()` で自動生成される（手作業不要）

### 2. demo用 GAS プロジェクト作成
- Google Apps Script で新規スタンドアロンプロジェクト作成
- `scriptId` を記録
- `gas-project/.clasp.demo.json` の `TODO_DEMO_SCRIPT_ID` を実IDに書き換え

### 3. clasp で demo プロジェクトへ push
```bash
cd gas-project
clasp login
clasp push -c .clasp.demo.json     # ← 本番(.clasp.json)でなく demo用を指定
```
> ⚠️ 必ず `-c .clasp.demo.json` を指定。誤って本番へ push しないこと。

### 4. demo GAS の ScriptProperties 設定
demoプロジェクトの ScriptProperties に以下を設定（本番とは**別値**）:

| キー | 値 |
|---|---|
| `SPREADSHEET_ID` | demo用 Spreadsheet ID |
| `DEMO_MODE` | `true` |
| `STRIPE_API_KEY` | `sk_test_...`（Stripe test mode） |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...`（test） |
| `STRIPE_SUCCESS_URL` | demo URL |
| `STRIPE_CANCEL_URL` | demo URL |
| `GAS_AUTH_TOKEN` | 再生成（`openssl rand -hex 32`） |
| `WEB_API_KEY` | 再生成 |
| `GLM_API_KEY` | demo用 |
| `LINE_CHANNEL_ACCESS_TOKEN` | demo用 LINE チャネルがあれば |
| `LINE_CHANNEL_SECRET` | 同上 |

### 5. demo Web App デプロイ
- GAS エディタで `doGet` を Web App としてデプロイ（アクセス: 全員）
- `webappUrl` を記録 → Cloudflare demo env の `GAS_WEBAPP_URL` に設定

### 6. 初回セットアップ（demo GAS エディタの関数実行）
1. `runSetup()` — シート作成・trigger類セットアップ
2. `resetDemoData()` — サンプルデータ注入（顧客30件・予約3ヶ月分）
3. `setupDemoResetTrigger()` — 毎時リセット trigger インストール

### 7. Cloudflare demo env デプロイ
```bash
cd worker
npx wrangler secret put --env demo GAS_WEBAPP_URL
npx wrangler secret put --env demo GAS_AUTH_TOKEN
npx wrangler secret put --env demo STRIPE_WEBHOOK_SECRET
npx wrangler secret put --env demo LINE_CHANNEL_SECRET
npx wrangler secret put --env demo WEB_API_KEY
npx wrangler deploy --env demo
```
- デプロイ後の demo Worker URL を記録
- `worker/wrangler.toml` の `[env.demo.vars].ALLOWED_ORIGINS` を実URLに書き換え（TODO箇所）→ 再デプロイ

### 8. Stripe test webhook 設定
- Stripe ダッシュボード（test mode）で webhook endpoint に demo Worker の `/webhook/stripe` を登録
- sign secret を demo GAS の `STRIPE_WEBHOOK_SECRET` に反映

### 9. 動作確認
- demo Worker URL + `/reserve` にアクセス → 5ステップ予約が動くか
- 決済はテストカード `4242 4242 4242 4242`（課金なし）
- 毎時リセット後も触れるか（`resetDemoData()` の時間経過後確認）

---

## 安全性チェックリスト
- [ ] demo GAS の `SPREADSHEET_ID` が demo用（本番 `18grw9Mv...` でない）
- [ ] `DEMO_MODE=true` 設定済
- [ ] Stripe が test mode（`sk_test_`）
- [ ] 本番 `.clasp.json` を誤って使っていない（demo push は `.clasp.demo.json`）
- [ ] demo Worker の `ALLOWED_ORIGINS` に本番ドメインが混入していない
- [ ] `resetDemoData()` が `isDemoMode()` ガードで守られている（本番誤実行防止）

---

## S3: LLM作業（demo稼働後）
- `resetDemoData()` 動作検証（実Sheet注入のE2E）
- `DEMO_MODE` 分岐本実装（Rate制限・GLM 5回後固定応答フォールバック）
- A1 demo固有テスト追加・coverage 設定（vitest.config.ts）
- A2 実測ベンチマークを README Impact 表へ埋め戻し
- README の demo URL プレースホルダを正式URLに置換
