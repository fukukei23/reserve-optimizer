# Runbook: GAS_AUTH_TOKEN Rotation

> 関連脅威: [ADR-001](../adr/ADR-001-threat-model.md) T03（Worker→GAS 認証）/ T10（トークン rotation・漏洩時対応）

## 目的
`GAS_AUTH_TOKEN`（Cloudflare Worker → GAS Web App 間の共有秘密）を新しく入れ替える。**漏洩時の即時無効化**と**予防的 rotation**の両方で本手順を使用する。

## 前提
- 認証モデル: Worker は GAS 転送時に `?x-verified=true&x-gas-auth=<GAS_AUTH_TOKEN>` を付与。GAS 側 `routeWebhook` が `GAS_AUTH_TOKEN` と比較検証（不一致は reject）。
- Token 強度: UUID v4（128bit / 32 hex）。ブルートフォース不可。rotation は**強度ではなく運用**のためのもの。
- `GAS_AUTH_TOKEN` は GAS 側 `ScriptProperties` と Worker 側 `wrangler secret` の**2箇所**に保持。両方を更新する。

## 手順

### 1. GAS 側で新トークン生成（旧トークン即時無効化）
1. GAS エディタ（script.google.com）で本プロジェクトを開く
2. `config/ScriptProperties.js` を開く
3. 関数セレクタで **`rotateAuthToken`** を選択し **実行**
   - 初回実行時は認可プロンプトが出る場合あり（承認）
4. 実行完了後、**実行ログ**（`log` シート or Stackdriver）に新トークンは出力しない設計（`appendLogRow` は rotation 事実のみ記録・値は非表示）
5. **返却値の新トークンをコピー**（実行結果の戻り値、または `Logger.log(rotateAuthToken())` で取得）

> ⚠️ この瞬間から**旧トークンは無効**。Worker 側を更新するまで Worker→GAS 通信が 401 になる（一時的な予約受信停止）。影響最小化のため、トラフィックの少ない時間帯に実施すること。

### 2. Worker 側 secret 更新
```bash
cd <reserve-optimizer リポジトリ>/worker
npx wrangler secret put GAS_AUTH_TOKEN
# プロンプトで手順1の新トークンを貼り付け
```

### 3. デプロイ・疎通確認
```bash
npx wrangler deploy
```
- 確認: LINE からテスト予約を行い、GAS 側 `log` シートに `INFO`（reject ではない）が記録されること
- 確認: `/api/availability` 等、Web API 経路が正常応答すること

### 4. 旧トークン無効化確認
- GAS エディタで `PropertiesService.getScriptProperties().getProperty('GAS_AUTH_TOKEN')` を実行し、新トークンになっていることを確認（旧トークンは上書き済み）

## 予防的 rotation の推奨頻度
- **6ヶ月に1回**（目安）
- 漏洩を疑う事象（コミット誤混入・ログ露出・関係者異動）があれば**即時**実施

## 漏洩時の影響範囲
`GAS_AUTH_TOKEN` 1つで GAS の**全 webhook/API ルート**（LINE・Stripe・Web予約API）が Worker になりすまして実行可能。影響: 虚偽予約・予約データ汚染・Stripe 連携起点。漏洩を発見次第、本手順を**即時**実行すること。
