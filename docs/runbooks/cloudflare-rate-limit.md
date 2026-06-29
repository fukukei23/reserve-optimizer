# Runbook: Cloudflare WAF Rate Limiting（DoS 対策）

> 関連脅威: [ADR-001](../adr/ADR-001-threat-model.md) T09（レート制限なし / DoS）

## 目的
Worker 公開エンドポイント（`/api/*`）経由の間接 GAS 起動による**クォータ枯渇・予約受信停止**を防ぐ。Cloudflare エッジでリクエストを遮断し、GAS に到達する前に弾く。

## 背景（なぜ必要か）
- Worker `/api/availability`, `/api/reserve`, `/api/intake` は各リクエストで `forwardToGAS()` を呼び、**1回の GAS 実行を誘発**する。
- Worker は `x-verified=true&x-gas-auth=<TOKEN>` を付与するため、**3層認証は全て通過**する。つまり攻撃者は Token を知らなくても Worker URL を叩くだけで GAS を間接起動できる（認証 ≠ 可用性保護）。
- GAS 無料枠（6時間/日）は並列リクエストで分単位で枯渇し、正規の LINE/Stripe webhook が処理できなくなる。

## 手順（Cloudflare Dashboard）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 対象ドメイン（Worker をルーティングしているドメイン）を選択
3. **Security** → **WAF** → **Rate limiting rules** → **Create rule**
4. 以下を設定:
   - **Rule name**: `reserve-optimizer API rate limit`
   - **If incoming requests match**:
     - Field: `URI Path`
     - Operator: `starts with`
     - Value: `/api/`
   - **When rate exceeds**:
     - Characteristics: `IP address`
     - Period: `1 minute`
     - Requests: `10`
   - **Take action**: `Block`
   - **Duration**: `10 seconds`（または `1 minute`）
5. **Deploy** をクリック

## 効果
- 同一 IP から `/api/*` へ 10 req/min 超で **Cloudflare エッジで Block**。GAS には1リクエストも到達しない。
- コスト: **無料**（Cloudflare Free プランの WAF Rate Limiting）。コード変更ゼロ。所要5分。

## 注意
- 正規ユーザーへの影響: 個人セラピスト予約のトラフィックでは 10 req/min/IP に到達しないため、実質ゼロ。
- 閾値調整: 実運用で誤爆が出たら `Requests` を緩和（20〜30 等）。ロードテスト後に最終決定。
- LINE/Stripe webhook 経路（`/webhook/*` 等）は署名検証で保護されているため、本ルールの対象外でよい。

## 確認方法
- Cloudflare Dashboard > **Security** > **Events** で、Block されたリクエストを確認可能。
- 定期的なスキャン攻撃が Block されていれば効果発揮中。
