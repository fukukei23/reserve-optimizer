# Quick Reference - OpenClaw

## ログ
- モデル確認: `/tmp/openclaw/openclaw-$(date +%F).log`
- リアルタイム: `tail -f /tmp/openclaw/openclaw-2026-03-17.log`

## コンテナ制約（重要）
- docker compose / systemctl はコンテナ内から実行不可
- 権限なし（sudo 不可）
- SSH鍵はコンテナ再作成で消える（VPS マウントで永続化済み）

## 主要パス
- ワークスペース: `/home/node/.openclaw/workspace/`
- Config: `/home/node/.openclaw/openclaw.json`
- Env: `/home/node/.openclaw/.env`

## コマンド
-  Gateway再起動: `openclaw gateway restart`（systemd 非対応時はフォアグラウンド起動）
-  Doctor: `openclaw doctor`
-  Status: `openclaw status`

## モデル
- 達人: GLM-5（複雑な分析）
- 早人: GLM-4.7（ニュース・YouTube要約、軽量タスク）
- 匠人: GPT-5.1-Codex（フォールバック）
