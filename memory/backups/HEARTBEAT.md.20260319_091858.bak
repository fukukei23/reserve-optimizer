# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

---

## 定期チェックタスク（30分おき）

1. 静穏時間（23:00-08:00 JST）はスキャンをスキップ → `HEARTBEAT_OK` を返す。

2. 通常時間のみ:
   - `python3 scripts/discord_context_scan.py` を実行。
   - JSON形式で「会話量」「未対応TODO候補」「リマインド候補」「マネタイズのヒント」が出力される。

3. 出力を要約し、以下の順番で処理：
   - 重要な提案があれば `memory/SHARED.md` に追記（差分は必ず記録）。
   - 要約を Discord #記憶と記録（ID: 1482523923886113032）へ送信。
   - 特筆事項が無ければ `HEARTBEAT_OK`。

**【メンション方式 - 重要の基準】**

重要（@ふくけいを付ける）：
- ユーザーの指示待ち（意思決定が必要）
- 緊急案件（システム障害、セキュリティインシデント）
- 大きな進捗（マネタイズ関連決定事項等）
- TODO期限切れ

通常（メンションなし）：
- 日常的な定期スキャン結果
- 特筆事項なし（HEARTBEAT_OK）

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

---

## 新規Cron作成时的コスト算出ルール（2026-03-19追加）

新規cron / サブエージェント起床タスクを作成する際は、**必ず以下を算出・表記すること**。

### コスト計算式

```
月額実行回数 = 頻度（回/時）× 24時間 × 30日
月額コスト（円）= 月額実行回数 × 1回あたり平均コスト × 汇率（160円/$）
```

### 1回あたりの平均コスト（GLM-5使用時）

| タスク类型 | 平均コスト/回 | 月額（1時間ごとに実行の場合） |
|-----------|-------------|--------------------------|
| 軽量（数秒で終わる） | $0.05 = 8円 | 8 × 24 × 30 = **5,760円** |
| 中量（~30秒） | $0.20 = 32円 | 32 × 24 × 30 = **23,040円** |
|重量（1分~） | $0.40 = 64円 | 64 × 24 × 30 = **46,080円** |

###  Ninja（glm-4.7）使用時は40%安い

| タスク类型 | 平均コスト/回 | 月額（1時間ごとに実行の場合） |
|-----------|-------------|--------------------------|
| 軽量 | $0.03 = 5円 | 5 × 24 × 30 = **3,600円** |
| 中量 | $0.12 = 19円 | 19 × 24 × 30 = **13,680円** |
| 重量 | $0.24 = 38円 | 38 × 24 × 30 = **27,360円** |

###  Cron作成時に表記する内容

cronの `name` または `payload.message` の冒頭に以下を記載する:

```
【コスト目安】
- 頻度: X分ごと → X回/時
- 月額実行回数: X,XXX回
- 概算コスト: $XX/月（約X,XXX円/月）
- 使用モデル: [GLM-5 or Ninja]
```

###  判断基準

| 月額コスト | 判定 |
|-----------|------|
| ~3,000円 | ✓ 没问题 |
| 3,000~10,000円 | 要ユーザー確認 |
| 10,000円~ | ユーザー承認必须的 |

###  例文

```
【コスト目安】
- 頻度: 30分ごと → 48回/日 → 1,440回/月
- 概算コスト: $0.20 × 1,440 = $288/月（約46,000円/月）
- 使用モデル: Ninja（軽量タスクのため）
→ ユーザー確認必要
```
