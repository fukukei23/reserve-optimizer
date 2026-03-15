# Claw5 Flash

5分でOpenClaw/AI自動化の最新を追うメディアパイプライン。

## ディレクトリ構成
- `templates/` … 長尺・Shorts台本テンプレ
- `scripts/` … ネタ取りまとめや差し込み用スクリプト
- `data/` … Cron収集後の生データ(JSON)
- `reviews/` … Discordに投げるドラフト台本
- `config/` … フィードや設定類
- `assets/` … サムネPSD、CapCut/Remotionプリセット、音声サンプル
- `remotion/` … Remotionベースの動画テンプレ
- `package.json` / `tsconfig.json` … スクリプト実行環境

## 使い方（人間向け）
1. `cd claw5-flash && npm install`
2. `npm run collect [-- YYYYMMDD]` でRSS/GitHub/Discord/Xからネタ収集→`data/YYYYMMDD.json`（日付省略で今日）
3. `npm run summarize -- YYYYMMDD` で要約JSON（`reviews/daily-flash-draft.json`）を生成
4. `npm run render` でテンプレートに自動差し込み → `reviews/daily-flash-YYYY-MM-DD.md`
5. Shorts用に `data/shorts-YYYYMMDD.json` を用意し、`npm run captions -- YYYYMMDD` で字幕JSON + SRT + TTMLを一括生成（Hook/Tip/CTAごとに色分けスタイル付き）
6. 台本をDiscordスレに貼り、TTS/CapCutテンプレ（`assets/`）に沿って収録

## 環境変数
収集スクリプト（`npm run collect`）でGitHub/Discordからデータを取るには以下の環境変数が必要：

- `GITHUB_TOKEN` … GitHub API用（`repo`スコープ推奨）
- `DISCORD_BOT_TOKEN` … Discord Botのトークン
- `DISCORD_GUILD_ID` … DiscordサーバーID（オプション、URL生成用）

設定例：
```bash
export GITHUB_TOKEN=ghp_xxxxx
export DISCORD_BOT_TOKEN=OTkxNxxxxx
export DISCORD_GUILD_ID=1479832235044769872
npm run collect
```

## 自動化フロー（暫定）
1. Cronが `config/feeds-openclaw.json` を参照して Zenn / GitHub / Discord / X からネタ収集
2. `data/YYYYMMDD.json` に保存
3. `scripts/flash_summarizer.ts YYYYMMDD` を実行 → `reviews/daily-flash-draft.json`
4. `scripts/apply_template.ts` でテンプレへ流し込み
5. Shorts字幕は `scripts/shorts_caption_builder.ts` で作成
6. Remotion/CapCut JSONとTTSスクリプトを出力 → Discordレビュー
7. OKならYouTube予約 + Zenn/GitHubログ展開

### Remotionテンプレ
1. `npm run remotion:props` で `reviews/daily-flash-draft.json` → `remotion/src/props.json` を生成
2. `cd remotion && npm install`（初回のみ）
3. `npm run start` で最新propsを読み込んだプレビューが立ち上がる
4. `npm run build` で `out/video.mp4` を書き出し

### LLM要約を有効化したいとき
```bash
# OpenAIを使う場合
export OPENAI_API_KEY=sk-xxxxx
export OPENAI_MODEL=gpt-4.1-mini # 任意

# GLM (智谱) を使う場合
export GLM_API_KEY=xxx
export GLM_MODEL=glm-4-air # 任意

npm run summarize -- 20260310
```
どちらかのキーがあれば優先して利用し、無い場合はルールベース要約に自動フォールバック。

### Shorts/CapCutチェックリスト
- `assets/broll/` … 背景動画、`assets/audio/` … TTS音声
- `docs/shorts-checklist.md` に手順あり
- `templates/capcut-short-template.json` を読み込んで、B-roll/音声/字幕を差し替え

### YouTube予約投稿（初回セットアップ）
1. Google Cloud Console → 新規プロジェクト → YouTube Data API v3 を有効化
2. OAuth同意画面を作成（内部でもOK）
3. 「OAuthクライアントID」→アプリタイプ「デスクトップ」を選択し、`config/youtube.credentials.json` として保存
4. `npm run publish -- 20260310` を初回実行 → ブラウザに表示されたコードをターミナルへ貼り付け → `config/youtube.token.json` ができる

### YouTubeへアップロード（2回目以降）
```bash
# Remotion等で main-20260310.mp4 を out/ に置いてから実行
npm run publish -- 20260310 2026-03-11T07:00:00+09:00
```
- 第2引数をISO形式で渡すと予約公開（publishAt）。省略するとUnlistedで即アップ
- `YOUTUBE_VIDEO_PATH` を指定すれば任意の動画パスをアップロード可能

## TODO
- Summarizer内でLLM要約を差し込む（現在はダミーロジック）
- CapCut/Remotionの実ファイルとB-rollプレースホルダを設置
- Cronスキルへfeed設定を接続（環境変数／認証を含む）
- Discordレビュー後にYouTube予約投稿を自動化
