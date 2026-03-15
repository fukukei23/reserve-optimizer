# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

---

## 定期チェックタスク（30分おき）

1. `python3 scripts/discord_context_scan.py` を実行。
   - JSON形式で「会話量」「未対応TODO候補」「リマインド候補」「マネタイズのヒント」が出力される。

2. 出力を要約し、以下の順番で処理：
   - 重要な提案があれば `memory/SHARED.md` に追記（差分は必ず記録）。
   - 要約を Discord #記憶と記録（ID: 1482523923886113032）へ送信。
   - 特筆事項が無ければ `HEARTBEAT_OK`。

3. 静穏時間（23:00-08:00 JST）は緊急案件のみ通知。

---

## watch_alert_tick（1分ごと）

1. `/home/node/.openclaw/workspace/scripts/check_file_changes.sh` を実行。
2. `/home/node/.openclaw/workspace/memory/watch_alerts/` にアラートファイルがあれば：
   - アラート内容を #記憶と記録（ID: 1482523923886113032）に通知
   - 処理済みのアラートファイルを削除
3. **アラートがなければ `HEARTBEAT_OK` を返す（ユーザーには何も表示されない）**

**通知ポリシー**:
- アラートなし → HEARTBEAT_OK（サイレント）
- アラートあり → #記憶と記録に通知
- 技術的エラー → #openclawヘルスチェック（1480704704349606021）に通知

---

## 重要ファイル・環境変数の変更監視

以下のファイル・環境変数に変更があった場合、#openclawヘルスチェックへ報告：

**監視対象**:
- 環境変数（APIキー関連）
- `/home/node/.openclaw/.env`
- `/home/node/.openclaw/openclaw.json`（ハッシュ値を比較）

**検知方法**:
- `memory/env-snapshot.json` に前回のハッシュを保存
- `memory/config-snapshot.json` に主要設定を保存
- 変更があったら差分を報告（APIキーは伏せ字で表示）

**報告形式**:
```
⚠️ [ファイル名] に変更を検知
- 変更前: timeoutSeconds=XX
- 変更後: timeoutSeconds=YY
```

---

## Config Health Monitor（5分ごと）

1. `memory/config-snapshot.json` を読み込む
2. 現在の設定（timeoutSeconds, primaryModel, fallbackModels, hooks状態）を取得
3. 前回と比較して変更があれば #openclawヘルスチェック に通知
4. 新しいスナップショットを保存

**監視項目**:
- agents.defaults.timeoutSeconds
- agents.defaults.model.primary / fallbacks
- hooks.internal.enabled
- hooks.internal.entries.fallback-notify.enabled
- channels.discord.enabled

**通知先**: #openclawヘルスチェック（技術アラート用）
