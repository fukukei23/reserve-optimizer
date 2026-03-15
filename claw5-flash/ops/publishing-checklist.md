# Claw5 Flash 公開チェックリスト

## 1. 台本 & 音声
- [ ] `npm run summarize -- YYYYMMDD`
- [ ] `npm run render`
- [ ] `npm run captions -- YYYYMMDD`
- [ ] TTS: `assets/tts/style-guide.md` に沿って収録 or 合成

## 2. 動画
- [ ] CapCutテンプレ `assets/video/capcut_flash_v1.json` を読み込み
- [ ] B-rollが揃っているか `assets/video/broll-manifest.json` で確認
- [ ] Shorts用に縦長版を複製、字幕TTMLを貼り付け

## 3. サムネ
- [ ] `assets/thumbs/spec.md` のレイアウトでPSDを更新
- [ ] 長尺／Shortsでテキストが被らないか確認

## 4. 配信設定
- [ ] YouTube長尺：タイトル「Claw5 Flash #XX｜主要トピック」
- [ ] 説明欄に参考リンクとShortsURL
- [ ] Shorts：ハッシュタグ #OpenClaw #Claw5Flash
- [ ] Zenn/GitHubログ：公開後に要約＋リンクを貼る

## 5. Discord報告
- [ ] Claw5 Flashチャンネルに公開リンクを貼る
- [ ] Cronの結果（成功/失敗）をThreadで共有

## 6. アーカイブ
- [ ] `reviews/` と `data/` をGitにコミット
- [ ] アセットの更新があれば `broll-manifest.json` に追記
