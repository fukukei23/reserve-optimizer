# Claw5 Flash Runbook (人手運用版)

## 1. 朝いちでやること
1. `cd /home/node/.openclaw/workspace/claw5-flash`
2. `git pull`（同期しておく）
3. `npm install`（初回のみ）
4. `npm run summarize -- YYYYMMDD`
5. `npm run render`
6. `npm run captions -- YYYYMMDD`
7. `reviews/` にできたMarkdownと字幕JSONをDiscordに貼ってレビュー依頼

## 2. Cronに任せるとき
- `config/feeds-openclaw.json` をCronスキルに読ませてネタ収集
- `config/cron-sample.json` を参考に、20:00 JST（=朝5時）ごろに収集→要約→テンプレ反映まで自動実行

## 3. 問題がおきたら
| 症状 | 対処 |
| --- | --- |
| summarizeが失敗 | `data/YYYYMMDD.json` のJSON崩れを確認。3件以上入っているかも確認 |
| renderが失敗 | Mustacheのキー不足が多いので `daily-flash-draft.json` に必要なフィールドがあるか確認 |
| captionsが短い/長い | `data/shorts-YYYYMMDD.json` のポイント数を3つ以内に調整 |

## 4. 次の改善候補
- SummarizerにLLM APIを繋ぐ（`OPENAI_API_KEY` を環境変数にセットし、`flash_summarizer.ts` から呼び出す）
- CapCut JSONとB-rollをS3に置き、`assets/video` から自動DL
- Discordレビュー後にYouTube予約投稿までAPIで自動化
