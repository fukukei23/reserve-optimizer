# #openclawヘルスチェック チャンネルアーカイブ

チャンネルID: 1480704704349606021
説明: OpenClawのヘルスチェック結果・アラート用チャンネル。

-- 追記ルール --
- ヘルスチェックで重要な異常が出たら日付付きで保存
- 自動化アラートは `ops-log.md` にも記録

---

## 2026-03-15

- 初期作成: フクロウが自動で作成しました。

## 2026-03-24

### OpenClaw v2026.3.23 リリース
- **リリース日**: 2026-03-23
- **通知元**: モデルアップデート監視cron
- **内容**: OpenClaw v2026.3.23 が公開
- **状態**: ヘルスチェック全て成功（200, ~50-80ms）

(追記者: フクロウ)

## 2026-03-27

### モデルアップデート監視: v2026.3.24確認
- **通知時刻**: 09:31 JST
- **内容**: OpenClaw最新リリースはv2026.3.24（変更なし）
- **状態**: ヘルスチェック全て正常（200, 55-136ms）

(追記者: フクロウ)

## 2026-03-30

### v2026.3.28 リリース（2026-03-29 14:31 UTC 公開）
- **Breaking**: Qwen認証廃止（modelstudio-api-key移行必須）、旧設定自動移行停止
- **新機能**: xAI/Grok統合強化、MiniMax画像生成(image-01)、承認フックAPI、ACP現会話バインド、apply_patch標準化
- **モデル整理**: MiniMax旧モデル（M2, M2.1, M2.5, VL-01）削除 → M2.7のみに統合
- **当環境影響**: primaryModel=MiniMax-M2.7使用中。次リリースで削除の可能性あり要監視。

### Config Health Monitor: 設定変更検知（2026-03-30 12:14 UTC）
- primaryModel: `zai/glm-5` → `minimax/MiniMax-M2.7` に変更
- fallbacks: `[gpt-5-mini, gpt-5.1-codex]` → `[glm-5, gpt-5-mini, gpt-5.1-codex]` に変更
- timeoutSeconds: 60（変更なし）

(追記者: フクロウ)

## 2026-04-01

### v2026.3.31 リリース検知（2026-04-01 09:31 JST）
- **Breaking**: Nodes/execの重複nodes.runシェルラッパー削除、exec host=nodeに統一
- **通知時刻**: 2026-03-31T20:54:44Z
- **状態**: ヘルスチェック全正常（200, 45-62ms）

### fallbacks設定変更検知（2026-04-01 11:19 JST）
- **変更箇所**: agents.defaults.model.fallbacks
- **変更前**: `["zai/glm-5", "openai/gpt-5-mini", "openai/gpt-5.1-codex"]`
- **変更後**: `["zai/glm-5.1", "zai/glm-4.7"]`
- **primaryModel**: minimax/MiniMax-M2.7（変更なし）

(追記者: フクロウ)

---

## 2026-04-02

### v2026.4.1 リリース検知（2026-04-02 09:31 JST）
- **リリース日**: 2026-04-01
- **内容**: Tasks/chat: /tasks チャットネイティブのバックグラウンドタスクボード追加、agent-local fallback counts等
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.1
- **状態**: ヘルスチェック全正常（200, 38-55ms）

(追記者: フクロウ)

---

## 2026-04-07

### v2026.4.5 リリース検知（2026-04-07 09:31 JST）
- **リリース日**: 2026-04-06
- **Breaking Changes**: Config: レガシー公開設定エイリアスの削除
  - `talk.voiceId` / `talk.apiKey`
  - `agents.*.sandbox.perSession`
  - `browser.ssrfPolicy.allowPrivateNetwork`
  - `hooks.internal.handlers`
  - channel/group系の旧エイリアス
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.5
- **当環境への影響**: 要確認（旧エイリアス使用状況の確認が必要）
- **ヘルスチェック状態**: 全て正常（200, 44-117ms）

(追記者: フクロウ)

---

## 2026-04-08

### v2026.4.5 Breaking Changesの確認とアップデート対応（04/08 23:33 UTC = 04/09 08:33 JST）
- **背景**: ふくけいから「Breaking changesって何？確認して。」と質問
- **内容**: レガシー設定エイリアス削除（`talk.voiceId`/`talk.apiKey`、`agents.*.sandbox.perSession`、`browser.ssrfPolicy.allowPrivateNetwork`、`hooks.internal.handlers`等）
- **対応**: `openclaw doctor --fix`で自動移行可能、よつばからupdate.runを実行する流れに
- **承認問題**: Discordでは`/approve`が使えないため、Surface Goで`openclaw doctor --fix`を実行する必要がある旨をよつばが案内
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.5

(追記者: フクロウ)

### v2026.4.2 リリース検知（2026-04-03 09:30 JST）
- **リリース日**: 2026-04-02
- **Breaking Changes**: xAI/x_search設定パスの移行
  - 旧パス: `core.tools.web.x_search.*`
  - 新パス: `plugins.entries.xai.config.xSearch.*`
  - x_search認証がplugins.entries.xai.configへ統一
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.2
- **当環境への影響**: 要確認（x_search使用状況による）

(追記者: フクロウ)
