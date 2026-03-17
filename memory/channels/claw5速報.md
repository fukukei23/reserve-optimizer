# #claw5速報 チャンネルアーカイブ

チャンネルID: 1480589360465186847
説明: Claw5関連の速報・通知。

-- 追記ルール --
- バージョンや重要アナウンスは日付とともに保存

---

## 2026-03-15

- 初期作成: フクロウが自動で作成しました。

## 2026-03-16

### 04:20-05:10 JST — API接続テストとエンドポイント是正
- `testing-api-tester` で Brave Search / OpenAI / GLM / Discord Bot を順次テスト。GLM は最初 `https://open.bigmodel.cn/...` に投げたため残高エラー扱いになり、ユーザー指摘で Coding Plan 用エンドポイント `https://api.z.ai/api/coding/paas/v4` を再接続して成功。
- エンドポイント情報が `memory/SHARED.md` に既に記載されていたが検索漏れが判明。原因は `memory_search` クエリ不足。再発防止として「セッション冒頭で SHARED.md を読み、要点を1〜2行で要約する」ルールを AGENTS.md に追記。
- 同期間に `agents_list` には `main` しか表示されず、agency-agents が available_skills に登録されていないことを再確認。Gateway 側での登録＋再起動が必要と結論。

### 05:20-06:00 JST — YouTube Data API 認証不足の洗い出し
- `testing-api-tester` で YouTube Data API v3 を呼び出したところ、Google OAuth 認証が未設定で `Method doesn't allow unregistered callers`。必要なファイルパス（`config/youtube.credentials.json`, `config/youtube.token.json`）と Google Cloud Console での設定手順を共有。対応はユーザー側または管理者権限作業待ち。

### 09:40-10:45 JST — ショート動画制作支援
- Remotion で生成した Shorts（OpenClawセキュリティ対策）の日本語フォントが「□」になる問題を調査。`@fontsource/noto-sans-jp` を組み込んで再レンダリングを試みたが `canvas` モジュールのネイティブ依存で失敗。代替案として CapCut テンプレに Noto Sans JP + 背景バー/ストロークを強制指定し、必要なら ffmpeg でヘッダーと下帯テキストを焼き込む方針を提示。
- ユーザーの要望で修正版動画を Discord にアップ → 実機確認で視認性改善ならず。「動画を貼るときは再生確認まで行う」こと、ならびに「鑑賞端末で文字が潰れる場合は上部ヘッダー/下部バーに情報を固定表示する」方針を共有。

### 10:40-10:55 JST — スキル情報の再確認
- `skills/agency-agents/marketing` と `design` 配下にショート動画系エージェント（Short-Video Editing Coach / TikTok Strategist / Livestream Commerce Coach / Visual Storyteller）が存在することを再確認。再起動後に自動発動させるには gateway で `skills.load.extraDirs` を再スキャンさせる必要あり。

### アーカイブ自動更新（2026-03-17 14:12 JST）
- 実行: 全チャンネルスキャンを行い、直近履歴を確認しました。必要な追記は各チャンネルファイルに反映済みです。詳細は各ファイルを参照してください。

(追記者: フクロウ)
