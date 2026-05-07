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

---

## 2026-04-10

### v2026.4.9 リリース検知（2026-04-10 09:30 JST）
- **リリース日**: 2026-04-09
- **内容**: Memory/dreaming改善（REM backfill、diary commit/reset flows、durable-fact extraction、短期記憶プロンプション統合）
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.9
- **状態**: ヘルスチェック全正常（200, 49-160ms）

(追記者: フクロウ)

---

## 2026-04-14

### v2026.4.12 リリース検知（2026-04-14 09:31 JST）
- **リリース日**: 2026-04-13
- **内容**: プラグイン読み込み改善、メモリ・ドリーム信頼性改善、ローカルモデル新オプション追加、Feishu統合改善
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.12
- **状態**: ヘルスチェック全正常（200, 52-206ms）

(追記者: フクロウ)

---

## 2026-04-12

### v2026.4.11 リリース検知（2026-04-12 09:31 JST）
- **リリース日**: 2026-04-12
- **内容**: Dreaming/memory-wiki強化
  - ChatGPT import取り込み対応
  - Imported Insights / Memory Palace diaryサブタブ追加
  - 取り込んだソースチャット・Wikiページ・スキルダイアログの検査が可能に
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.11
- **状態**: ヘルスチェック全正常（200, 50ms）

(追記者: フクロウ)

---

## 2026-04-09

### v2026.4.8 リリース検知（2026-04-09 09:31 JST）
- **リリース日**: 2026-04-08
- **内容**: バグ修正メイン
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.8
- **状態**: ヘルスチェック全正常（200, 50-363ms）

### exec承認問題（2026-04-09 08:34 JST〜）
- **問題**: Discordではexec承認（`/approve`）が効かない設定になっている
- **対応**: Surface Goのターミナル（SSH: `ssh user@100.78.104.58`）で `openclaw doctor --fix` を実行する必要がある
- **参照**: よつばが案内、ふくけいが「SSHでSurface Goに入るなら」と返信
- **その後**: 承認タイムアウト発生（よつば node）。`openclaw doctor --fix` 未実行

(追記者: フクロウ)

---

## 2026-04-17

### OpenClaw v2026.4.15 リリース（04/16 09:31 JST = 04/16 00:31 UTC）
- **公開**: 2026-04-16
- **内容**: Anthropicモデルデフォルト改善、Opusエイリアス強化、Claude CLIデフォルト改善、Google TTS（Gemini TTS）追加
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.15
- **状態**: ヘルスチェック全正常（200, 55-300ms）

(追記者: フクロウ)

### ヘルスチェック結果（04/17 15:04 JST = 04/17 06:04 UTC）
- https://fopenclaw.com/ → 200, 79ms（正常）

(追記者: フクロウ)

### ヘルスチェック結果（04/17 21:04 JST = 04/17 12:04 UTC）
- https://fopenclaw.com/ → 200, 52ms（正常）

### ヘルスチェック結果（04/18 03:04 JST = 04/17 18:04 UTC）
- https://fopenclaw.com/ → 200, 75ms（正常）

(追記者: フクロウ)

### ヘルスチェック結果（04/18 09:03-09:04 JST = 04/18 00:03-00:04 UTC）
- https://fopenclaw.com/ → 200, 63ms（正常）
- モデルアップデート: v2026.4.15（変更なし）

---

## 2026-04-18

### チャンネルアーカイブ自動更新（06:00 UTC）
- 最終更新時刻: 2026-04-18 06:00 UTC
- 特筆すべき新しい会話なし（最新ログは04/17 21:04 JSTのみ）

### チャンネルアーカイブ自動更新（09:00 UTC）
- 特筆すべき新しい会話なし（#一般 の最新は04/12 12:00 UTCのまま）

### ヘルスチェック結果（04/18 12:04 UTC）
- https://fopenclaw.com/ → 200, **546ms**（高負荷。注意監視）

### ヘルスチェック結果（04/18 18:04 UTC）
- https://fopenclaw.com/ → 200, 65ms（正常に戻す）

(追記者: フクロウ)

## 2026-04-19

### チャンネルアーカイブ自動更新（00:02 UTC）
- #一般: 最終メッセージ 2026-04-12 12:00 UTC（自己診断）から変化なし
- #openclawヘルスチェック: 04/18 18:04 UTCまで正常運用
- 特筆すべき新しい会話なし

### チャンネルアーカイブ自動更新（03:00 UTC）
- #一般: 特筆すべき新しい会話なし（最終メッセージは04/12 12:00 UTCのまま）
- #openclawヘルスチェック: 04/18 18:04→04/19 00:02 UTCも正常運用
- 特筆すべき新しい会話なし

(追記者: フクロウ)

---

## 2026-04-22

### OpenClaw v2026.4.20 リリース検知（04/22 00:31 UTC）
- **リリース日**: 2026-04-21
- **内容**: Onboard/wizard: セキュリティ免責事項の再スタイル（黄色バナー・セクション見出し・箇条書き）
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.20
- **状態**: ヘルスチェック全正常（200, 49-324ms）

### OpenClaw v2026.4.21 リリース検知（04/23 00:31 UTC）
- **リリース日**: 2026-04-22
- **内容**: 詳細未取得（モデルアップデート監視で検知）
- **状態**: ヘルスチェック全正常（200, 109-319ms）

---

## 2026-04-23

### OpenClaw v2026.4.22 リリース検知（04/24 00:31 UTC）
- **リリース日**: 2026-04-23
- **内容**: 詳細未取得（モデルアップデート監視で検知）
- **状態**: ヘルスチェック全正常（200, 58-223ms）

---

## 2026-04-24

### OpenClaw v2026.4.23 リリース検知（04/25 00:31 UTC）
- **リリース日**: 2026-04-24
- **内容**: 
  - **OpenAI画像生成**: Codex OAuth経由で `openai/gpt-image-2` がOPENAI_API_KEY不要で動作
  - **OpenRouter**: 改善（詳細略）
  - Fixes #70703
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.23
- **状態**: ヘルスチェック全正常（200, 58-219ms）

### ヘルスチェック結果サマリ（04/22〜04/25）
- 全て正常（200 OK）
- レスポンスタイム: 49ms〜324ms（一時的な高負荷なし）
- 6時間おきヘルスチェック安定動作

---

## 2026-04-25 / 2026-04-26

### OpenClaw v2026.4.24 リリース検知（04/26 00:30 UTC）
- **リリース日**: 2026-04-25
- **内容**: マイナーアップデート（詳細略）
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.24
- **状態**: ヘルスチェック正常（04/26 00:04 UTC → 200, 48ms）

### ヘルスチェック結果（04/25 18:04〜04/26 00:04 UTC）
- 全て正常（200 OK, 48〜208ms）

---

## 2026-04-27 / 2026-04-28

### OpenClaw v2026.4.25 リリース検知（04/28 00:30 UTC）
- **リリース日**: 2026-04-27
- **ハイライト**:
  - **Voice replies / TTS大規模アップグレード**: `/tts latest`、チャットスコープ自動TTS制御、ペルソナ、エージェント/アカウント別オーバーライド
  - **新TTSプロバイダー**: Azure Speech、Xiaomi、Local CLI、Inworld 追加
- **参照**: https://github.com/openclaw/openclaw/releases/tag/v2026.4.25
- **状態**: ヘルスチェック全正常（200, 54〜207ms）

### ヘルスチェック結果（04/27 06:04〜04/29 00:04 UTC）
- 全て正常（200 OK, 54〜207ms）
- 6時間おきヘルスチェック安定動作

---

## 2026-04-29

### ヘルスチェック結果（04/29 00:02〜00:04 UTC）
- 全て正常（200 OK, 54〜67ms）

(追記者: フクロウ)

---

## 2026-05-02

### OpenClaw v2026.5.2 リリース（05/02 公開・05/03 検知）
- **内容**: 外部プラグインのnpm-first移行、更新・doctor修復、依存関係レポート、artifact metadata対応
- **URL**: https://github.com/openclaw/openclaw/releases/tag/v2026.5.2
- **ヘルスチェック**: 正常（05/03〜05/04 全て200 OK, 42〜238ms）

### ヘルスチェック結果（04/30 00:04〜05/04 00:31 UTC）
- 全て正常（200 OK, 42〜238ms）
- モデルアップデート監視: 05/04 09:30 JST時点で変更なし（v2026.5.2が最新）

(追記者: フクロウ / 2026-05-04 09:00 UTC)

---

## 2026-05-06 ~ 2026-05-07

### OpenClaw v2026.5.6 リリース（05/06 17:51:03Z 公開・05/07 00:31 UTC 検知）
- **内容**: モデルアップデート監視cronが検知、現在利用可能な最新版
- **URL**: https://github.com/openclaw/openclaw/releases/tag/v2026.5.6

### OpenClaw v2026.5.4 公開（05/05 公開・05/06 00:31 UTC 検知）
- **URL**: https://github.com/openclaw/openclaw/releases/tag/v2026.5.4

### ヘルスチェック結果（05/06 00:04〜05/07 00:31 UTC）
- 05/06 00:04 UTC: ✅ 200, 59ms
- 05/07 00:04 UTC: ✅ 200, 55ms
- fopenclaw.com 安定稼働

(追記者: フクロウ / 2026-05-07 03:00 UTC)
