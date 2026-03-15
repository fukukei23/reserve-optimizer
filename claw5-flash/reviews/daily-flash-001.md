# Claw5 Flash #001 台本ドラフト（5分版）

> 収録想定日: 2026-03-10（JST朝）
> ソース要確認: Cron Wake API PR #4821、Skill Packager Beta告知（Discord #release-notes 2026-03-08）、Clawhub投稿「Digest Pipeline」

---

## 0:00–0:20 オープニング
- Hook: 「OpenClawのCronが今朝から“遅延ゼロ”に？5分でキャッチアップしよう」
- 番組紹介: 「OpenClaw/AI自動化の最新を5分で届ける Claw5 Flash、今日は3本の必見アップデートをお届け。」
- 本日のラインナップ: 「Cron Wake API強化 / Skill Packager Beta / Digest Pipeline公開」

## 0:20–1:10 ヘッドライン①: Cron Wake API強化
- 15秒サマリ: 「Wakeイベントが待ち無しで走る“Immediate”モードが追加。SlackやSMSのリマインダーが秒単位で届くようになる。」
- 詳細: 「GatewayのCron APIに `wake mode="now"` が正式追加。即時実行ジョブと定期ジョブを分離し、ジョブごとにリトライポリシーと通知チャネルを設定可能。」
- 実務インパクト: 「エスカレーションやSLA通知をOpenClaw単体で完結。PagerDuty連携なしでも高速リマインダーが作れる。」
- 参考リンク: `<https://docs.openclaw.ai/cron#wake>` `<https://discord.com/channels/1479832235044769872/1479832235044769872>`

## 1:10–2:00 ヘッドライン②: Skill Packager Beta
- 15秒サマリ: 「スキルをJSON1枚で配布できるPackagerがβ公開。依存ファイルとREADMEをまとめて署名できる。」
- 詳細: 「`openclaw skill pack` コマンドが追加され、`skill.json`にメタデータ・バージョン・CHECKSUMを記述。Clawhubにアップロードすると自動でスキルページ生成。」
- 実務インパクト: 「社内の自動化レシピを簡単に共有。Cronから特定バージョンを固定で呼び出せるので、本番と検証を切り分けられる。」
- 参考リンク: `<https://docs.openclaw.ai/skills/packager>` `<https://clawhub.com/skills>`

## 2:00–2:50 ヘッドライン③: Digest Pipeline公開
- 15秒サマリ: 「Clawhubで“Digest Pipeline”テンプレが公開。Zenn/GitHub/Discord/Xからネタ収集→要約→台本化までを自動で繋ぐ。」
- 詳細: 「Cron + Summarizerスキル + Remotion JSON を束ねたテンプレ。台本、Shorts、サムネ指示まで自動生成し、Discordレビューに投げ込む。」
- 実務インパクト: 「社内広報やCSチーム向けの定期Digestを、1人で企画〜公開まで回せるようになる。」
- 参考リンク: `<https://clawhub.com/templates/digest-pipeline>`

## 2:50–4:10 OpenClawトピック深掘り: Claw5 Flash パイプライン
- 背景: 「OpenClawコミュニティに“5分で追える要約”が不足していた。」
- アップデート/仕組み: 「Cronが毎朝5:00 JSTにZenn/GitHub/Discord/Xをスクレイプ→`flash_summarizer.ts`で要約→テンプレに埋め込み→Remotion/CapCut JSONとTTS指示を生成。」
- どう導入: 「自分の関係チーム向けにも同じ仕組みをForkして、ソースリストとテンプレだけ差し替えればOK。レビューはDiscordスレ1本で完結。」
- 追加リソース: `<https://github.com/openclaw/examples/tree/main/media/digests>` `<https://clawhub.com/skills/rss-harvester>`

## 4:10–4:40 クイックアクション
- TIP: 「今日中に“優先チャンネル”1本をCronに登録。Slack #alerts でもメールでも良いので、Wake-Nowで即時通知を試す。」
- Resources: 「`docs/openclaw/cron.md` のサンプル / Clawhub Skill Packagerテンプレ」

## 4:40–5:00 クロージング
- 次回予告: 「次回はUse Case Sprintで“CSハイライト動画を60分で作る”を解剖。」
- Shorts誘導: 「Cronアップデートを35秒でまとめたShorts版を概要欄に載せているのでチェックしてね。」
- CTA: 「いいねとチャンネル登録で毎朝のClaw5 Flashを逃さずキャッチ。」

---

### Shorts台本ドラフト（Cron Wake特化）
- Hook: 「OpenClawのリマインダー、今朝から遅延ゼロです。」
- キートピック: 「Cron Wake Immediate / Retry制御 / 即Slack通知」
- 実務TIP: 「Wake-Nowで障害一次対応。2回失敗したら PagerDuty にフォールバック。」
- リソース案内: 「概要欄で`cron wake`サンプルコード配布。」
- CTA: 「本編で他2本も紹介。Claw5 Flashで検索！」
