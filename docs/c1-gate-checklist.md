# C1ゲート チェックリスト（spec §4 C1）

| 項目 | チェック | ステータス |
|---|---|---|
| E2E36本全緑（EXIT=0添付） | [x] | 1419/1419・E2E_EXIT=0（2026-10-09実測・Task 3/6の新規unitテスト込み） |
| worker vitest 全緑 | [x] | 55/55・VITEST_EXIT=0（2026-10-09実測・registry 6テスト追加） |
| ハートビート源=日次定期トリガー7日連続発火（合格基準=T0001で7日+外部再作成手順の動作確認） | [ ] | **未着手（開始日: 未定）**・注意: sendDailyを呼ぶ日次トリガーのGAS登録が未実施（C1運用開始時の初回設定タスク） |
| 中央死活の外部プローブ設定済み | [ ] | runbook作成済み（docs/runbooks/uptime-probe.md）・**UptimeRobot登録は人間タスク・未実施** |
| KPI基準値確定 | [ ] | Phase 0メトリクス記録後（2〜4週の記録期間が必要） |
| MLR（C1成果物に対する3機レビュー） | [ ] | 別回実施 |

**本チェックリストの完了は「実装完了」を示すものでC1ゲート通過（C1-go）を含意しない**（r5 MiniMax#6反映・C1-goは7日連続発火+MLR+KPI基準値の3点セット）。

※ 「7日連続発火」と「KPI基準値」が未達の間、C1は**ゲート通過でなく実装完了**と呼ぶ（spec §4のゲート判定はこのチェックリスト全項目完了で確定）。
※ **スコープ明示（r6 GLM#4反映）**: spec §5の「ハートビート24h不着→unknown化」機構（status書き換えCron）は**C2計画で実装**する・C1ではstatusは'active'のまま。C1の死活検知は外部プローブ（中央）+7日連続トリガー確認（テナント）のみ。
※ last_reservation_at は初回ハートビートまではNULL正常（初回以降の値存在をC1ゲート確認項目に含める・r6 OR1#7反映）。
※ **heartbeat_token hash化（C3前提条件・MLR r2 Gemini#1 critical採用）**: 現行はD1に平文保存。影響=heartbeat偽造のみ（PII無し）だが、**C3課金導入前にSHA-256ハッシュ保存方式へ移行必須**（worker側hash比較にすればGAS側変更不要）。C3計画の必須項目として扱うこと。

## 実装完了時点での既知ブロッカー（2026-10-09実測）

| ブロッカー | 影響 | 解除条件 |
|---|---|---|
| ~~Cloudflare APIトークンにD1権限なし~~ **✅解消済み（2026-10-09）**: ふくけいがD1 Edit権限を付与 → d1 create成功（db_id=247f0b72...・APAC）→ リモート適用（3 queries・tenants/heartbeats実測）→ 本番デプロイ成功（Version be4b7a24・/health ok・/heartbeat無認証401実測） | 解消 | — |
| gas-run.shテスト実行経路の既存不具合（Web App経由） | GAS単体テストの実機実行不可（テストはローカルnodeハーネスで代替・全緑） | ①DoGet.jsのsetStatusCode削除（GAS TextOutputに非存在API・testConfigでも同エラー実測）②Bearer照合トークンの不一致解消（gas-run.sh送信OAuthトークン vs DoGet照合GAS_AUTH_TOKEN）※GAS_AUTH_TOKENはローカルに不在 |
