# Cron連携メモ

## やりたいこと
平日朝5:00 JSTに自動で
1. フィード収集（Zenn/GitHub/Discord/X）
2. 要約 → テンプレ差し込み
3. Discordへドラフト投稿

## 手順
1. **OpenClaw Cronにジョブ追加**
   ```bash
   openclaw cron add --file claw5-flash/config/cron-sample.json
   ```
   - 1本目: `claw5-flash:collect` → rss-harvesterスキルに `config/feeds-openclaw.json` を渡す
   - 2本目: `claw5-flash:summarize` → `npm run summarize -- $(date +%Y%m%d)` と `npm run render`

2. **スキル側の環境変数**
   - `ZENN_TOKEN`（必要なら）
   - `GITHUB_TOKEN`
   - Discordログ収集はBotトークン or 既存Webhookを利用

3. **ファイル出力先**
   - 収集結果: `claw5-flash/data/YYYYMMDD.json`
   - 要約結果: `claw5-flash/reviews/daily-flash-draft.json`
   - 台本: `claw5-flash/reviews/daily-flash-YYYY-MM-DD.md`

4. **Discord通知**
   - `openclaw cron` の delivery 設定で `channel: "discord"`、`to: "channel:1480589360465186847"` を指定すると完了メッセが直接Claw5 Flashチャンネルに届く。

5. **失敗時リトライ**
   - `schedule.every` を使ったバックオフ or Cron側の `maxRetries` を設定（推奨: 2回）。
