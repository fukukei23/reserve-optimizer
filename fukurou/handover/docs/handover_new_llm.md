# LLM設定 引継ぎメモ

最終更新: 2026-03-17

---

## MiniMax設定

`openclaw_config/openclaw.json` の `models.providers` に設定するMiniMaxプロバイダーの正確な値。

| キー | 値 |
|-----|-----|
| `baseUrl` | `https://api.minimax.io/anthropic` |
| `api` | `anthropic-messages` |
| モデルID（大） | `MiniMax-M2.5` |
| モデルID（小） | `MiniMax-M2.1` |

> ⚠️ **モデルIDの大文字混在は変更禁止。**
> `MiniMax-M2.5` を `minimax-m2.5` などに書き換えるとAPI認証エラーになる。
> openclaw.jsonを編集する際は必ず元の表記を維持すること。

### フォールバック順序（2026-03-17時点）

```
zai/glm-5
  ↓（失敗時）
minimax/MiniMax-M2.5
  ↓（失敗時）
openai/gpt-5-mini
  ↓（失敗時）
openai/gpt-5.1-codex
```

---

## モデル動作確認方法

### OpenClaw（フクロウ）が使用できるコマンド

コンテナ内のログファイルを直接参照する：

```bash
cat /tmp/openclaw/openclaw-$(date +%F).log | grep -E "fallback|model=" | tail -20
```

このコマンドでフォールバックの発生とどのモデルが実際に使用されたかを確認できる。

### OpenClawが使用できないコマンド

```bash
# ❌ ホスト側コマンドのためOpenClawには実行権限がない
docker compose logs --tail 200 openclaw-gateway
```

`docker compose` はVPSのホスト上で実行するコマンド。コンテナ内で動作するOpenClawからは実行不可。ホスト側の確認が必要な場合はふくけいがSSHでVPSに入って実行すること。

---

## GLMレート制限

### 仕様

GLM Coding Plan（Z.AI）には以下の利用制限がある：

| 制限 | 内容 |
|------|------|
| 週次クォータ | 週あたりのリクエスト上限あり（Z.AIダッシュボードで確認） |
| 月次クォータ | 月あたりの上限あり |
| リセット周期 | エラーメッセージに次回リセット日時が含まれる |

### 制限到達時の動作

上記フォールバック順序に従い、自動的にMiniMaxへ切り替わる。ユーザー側での操作は不要。

### リセット日時の確認方法

GLM制限到達時のエラーレスポンスにリセット日時が記載される。OpenClawのログで確認：

```bash
cat /tmp/openclaw/openclaw-$(date +%F).log | grep -i "rate\|quota\|reset\|limit" | tail -20
```

### 注意事項

- Z.AIダッシュボードの Cash/Credits 残高が `$0.00` でもCoding Planサブスクが有効であればAPIは利用可能（残高とクォータは別管理）。
- 制限到達でフォールバックが発生してもOpenClawの動作は継続する。
- GLMが復旧してもフォールバック先に固定されたままになる場合がある。その場合はGatewayを再起動すること。

---

## 関連ファイル

- `infra/openclaw.json` — LLMプロバイダー設定の正規ソース
- `docs/runbook.md` — Z.AI APIエラーコード1113の対処手順を含む
