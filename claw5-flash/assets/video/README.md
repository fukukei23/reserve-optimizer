# Video Assets Guide

1. **B-rollファイル配置**
   - `assets/video/broll_*.mp4` に上書きするだけでCapCutテンプレが参照。
   - 必要なクリップ一覧は `broll-manifest.json` を参照。
   - 推奨: 1080p / 30fps / 10sループ。

2. **CapCutテンプレとの紐付け**
   - `capcut_flash_v1.json` の `timeline.layers` で `broll_*` を参照。
   - Remotionを使う場合も同じファイルパスをimportする構成にする。

3. **差し替え手順**
   - 新しいバージョンを `assets/video/source` に保存。
   - `ffmpeg -stream_loop -1 -i source.mp4 -t 10 -c copy broll_xxx.mp4` で10秒ループを作る。
   - `broll-manifest.json` の `notes` に撮影/生成メモを残す。

4. **ファイル容量ガイド**
   - 1クリップあたり 20–40MB を目安。
   - Gitに含める場合はLFS推奨。現状はプレースホルダなので `.gitignore` で除外中。

5. **Remotion連携（予定）**
   - `remotion/config.ts` で上記B-rollをインポート。
   - 動画と字幕（SRT/TTML）を読み込み、`assets/tts` で生成した音声と合成。
