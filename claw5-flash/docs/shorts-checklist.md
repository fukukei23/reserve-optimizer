# Shorts 制作チェックリスト

> 5分で終わるように、毎回同じ順番で並べたメモ。

## 準備
- [ ] `npm run summarize -- YYYYMMDD` + `npm run remotion:props`
- [ ] `reviews/shorts-YYYYMMDD.srt` を確認（間違いがあれば修正）
- [ ] Hook/CTAのセリフを決めて `assets/audio/` に `voice-hook.mp3` など名前で保存

## CapCut 作業
1. テンプレート `templates/capcut-short-template.json` を読み込み
2. B-rollを `assets/broll/` から差し替え（3カット: hook / headlineまとめ / CTA）
3. オーディオトラックに `assets/audio/voice-*.mp3` を順番に配置
4. 字幕タブで `reviews/shorts-YYYYMMDD.srt` を読み込み
5. 冒頭3秒にタイトルテキスト、ラスト3秒にCTAテキストを配置

## 書き出し
- [ ] フレームレート 30fps / 1080×1920 を確認
- [ ] 60秒以内に収まっているかチェック
- [ ] ファイル名 `shorts-YYYYMMDD.mp4` で書き出し → `out/shorts/` に保存

## 仕上げ
- [ ] YouTubeにShortsをアップロード（タイトル: `Claw5 Flash #XX - Hook文`）
- [ ] Discord #claw5-flash に完了コメント
