# channel: #openclaw-config (ID: 1483266905816174673)

最終更新: 2026-04-19 09:00 UTC

## 2026-04-19 更新分

### 🔴 Auto Push失敗の根本原因（調査中）
- **発生:** 2026-04-05 10:26 UTC（継続中）
- **2026-04-08の調査で判明:**
  - リポジトリ `fukukei23/openclaw-workspace` は**存在確認済み（プライベート）**
  - **SSH鍵の不一致が疑われる:**
    - deploy key登録用的是 `id_ed25519_reserve`（MEMORY.md記載）
    - しかし `.git/config` のremote `origin` は `github-workspace` hostを使用
    - `github-workspace` hostの設定用的是 `id_ed25519`（別の鍵）
  - この鍵の使い分けミスが原因でpush失敗している可能性
- **要対応:** SSH host設定またはdeploy keyの見直し

### ⚠️ Exec承認タイムアウト問題
- **確認日:** 2026-04-08
- Discordからのexec承認がタイムアウトする問題が発生
- 代替手段（Web UI / terminal UI）が必要

---
---

# 2026-09-03 更新分（前回の2026-04-19から大幅更新）

## 🟢 Auto-push 復旧成功（09-03 04:42 UTC）

- **コミット**: `2ee0542`（3 files changed）
- **削除**: `memory/watch_alerts/alert_20260903_001506.txt`
- **結果**: master → origin/master に push 済み
- **コスト**: 入力~33kトークン / 出力~1.5kトークン / 概算 $0.038（約6円）

### 経緯・意味
- **2026-04-19時点**: "Auto Push失敗の根本原因（調査中）" — SSH鍵不一致でpush失敗が継続
- **2026-09-03時点**: auto-push が正常動作。約4.5ヶ月越しの課題が解消（または別経路で回避）された可能性
- **注**: 失敗→復旧の間に何が起きたか（鍵再設定・代替経路確立等）の記録は未確認。SSH鍵設定の見直し履歴があれば追記推奨

(追記者: フクロウ / 2026-09-03 06:00 UTC アーカイブ更新)

## 2026-09-04 更新分

### 🟢 Auto-commit & Push 完了（09-04 04:42 UTC）
- **コミット**: 7ファイル変更、+201/-13行
- **範囲**: `master` → `origin/master`（2ee0542..4230652）
- **コスト**: 約0.1円
- **評価**: auto-push機構は引き続き正常稼働中（09-03復旧から2日連続成功）

(追記者: フクロウ / 2026-09-04 06:00 UTC アーカイブ更新)

## 2026-09-13 02:40-02:42 UTC — ❌ Deploy Key ローテーション失敗（GitHub PAT失効）
- **Cron**: deploy_key_rotate_on_day（対象: fukukei23/openclaw-workspace・現行鍵: openclaw-deploy-2026-03-17）
- **結果**: 失敗 — `GITHUB_TOKEN` / `GITHUB_TOKEN_READ` 両方が 401 Bad credentials（Fine-grained PAT失効期限切れ/無効化が濃厚）
- API経由のdeploy key管理が一切不可の状態（鍵自体 ~/.ssh/id_ed25519_reserve は存在）
- **ふくけい対応が必要**:
  1. 新PAT発行（Fine-grained・openclaw-workspace リポジトリ Administration: read/write 権限）
  2. 環境変数更新（GITHUB_TOKEN / GITHUB_TOKEN_READ）
  3. または手動ローテーション: GitHub → Settings → Deploy keys → 新鍵追加 → 動作確認後に旧鍵削除
- **補足**: Auto Pushには元々 id_ed25519 vs id_ed25519_reserve の使い分けミス（未解決）があり、ローテーション時に併せて修正推奨
- 手順書: memory/reserve-optimizer-access.md / 詳細: memory/2026-09-13.md

(追記者: フクロウ / 2026-09-13 03:00 UTC アーカイブ更新)

## 2026-10-09 更新分

### 🟢 fallbackModels 構成変更検知（glm-4.7復活）
- **検知**: 2026-10-09 04:44 UTC（config-snapshot比較）
- **変更前**: fallbackModels=["zai/glm-5.1"]（10-07 03:45 UTCスナップショット比）
- **変更後**: fallbackModels=["zai/glm-5.1", "zai/glm-4.7"]
- **意味**: MEMORY.md記載（2026-04-01更新）と整合が戻った形。GLM-5.1障害時にGLM-4.7へのフォールバックが再有効化され、運用上の冗長性が回復
- **備考**: 誰がいつ変更したかは記録なし（openclaw.jsonは自動再読込）。有益な変化のため問題なし

(追記者: フクロウ / 2026-10-09 06:00 UTC アーカイブ更新)

### 【追加 2026-10-09 09:00 UTC】✅ openclaw-health 611ms超高遅延 → 正常回復（06:02 UTC）
- **06:02:30 UTC Oct 9: 200, 83ms**（通常レンジ・正常回復確認）
- **背景**: 00:03 UTC Oct 9 = 611ms（超高遅延・SHARED.md 03:00 UTC記録済み）が焦点だった → **見事恢復**
- **判断**: 611ms超高遅延は一時的Gateway/ターゲット側要因で、完全に正常化。03:00 entryで記録した「v2026.9.9との巧合」の因果関係は不明だが、結果的に自然回復
- **系列**: 83ms（10-09 06:02）→ 611ms（10-09 00:03）→ 96ms（10-08 06:03）→ 88ms（10-08 00:04）— **8/8 00:00〜06:00 UTC全8本成功**（06:00 UTC台の周期的な不着問題は完治方向）
- 備考: openclaw-health間欠不着パターン（12:00/18:00/00:00 UTC台）は継続の可能性あるが、重点監視窓（00:00〜06:00 UTC）は安定化

(追記者: フクロウ / 2026-10-09 09:00 UTC アーカイブ更新)

## 2026-10-10 00:00 UTC窓 追記

### ⚠️ daily-workspace-backup consecutiveErrors=23（120s timeout）・新发现问题
- **发觉**: 2026-10-10 00:03 UTC定期スキャン（#記憶と記録）の中で副产品として判明
- **状态**: consecutiveErrors=23（120秒timeout）。openclaw-healthで碓認済みの「state上はerror解决的だが実行・通知は成功」パターンの可能性あり
- **判断**: 本来weekly_agent_self_diagnosis周日cronが检测するはずだが、ここの定期スキャンで先に捕捉した形
- **受影响**: ワークスペースバックアップが23回分以上未取得の可能性がある

(追記者: フクロウ / 2026-10-10 00:03 UTC アーカイブ更新)
