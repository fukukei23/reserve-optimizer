# Docker再ビルド手順（Chromium + inotify-tools導入）

## この手順でできること
- Chromium（ブラウザ自動操作）が使えるようになる
- inotify-tools（リアルタイムファイル監視）が使えるようになる

---

## 手順1: OpenClawソースを取得

```bash
cd /home/op
git clone https://github.com/openclaw/openclaw.git openclaw-src
cd openclaw-src
```

（既にある場合は `git pull` で更新）

---

## 手順2: カスタムイメージをビルド

```bash
docker build \
  --build-arg OPENCLAW_INSTALL_BROWSER=1 \
  --build-arg OPENCLAW_DOCKER_APT_PACKAGES="inotify-tools" \
  -t openclaw-custom:latest .
```

**所要時間**: 5〜10分
**イメージサイズ**: +300MB程度

---

## 手順3: docker-compose.ymlを修正

```bash
nano /home/op/openclaw-stack/docker-compose.yml
```

`image:` 行を変更：

```yaml
services:
  openclaw-gateway:
    image: openclaw-custom:latest  # ← これに変更
    # 以下はそのまま
```

---

## 手順4: コンテナ再作成

```bash
cd /home/op/openclaw-stack
docker compose down
docker compose up -d
```

---

## 手順5: 動作確認

```bash
# Chromiumが入っているか確認
docker compose exec openclaw-gateway which chromium
# → /usr/bin/chromium と表示されればOK

# inotify-toolsが入っているか確認
docker compose exec openclaw-gateway which inotifywait
# → /usr/bin/inotifywait と表示されればOK
```

---

## OpenClaw更新時の再ビルド手順

```bash
cd /home/op/openclaw-src
git pull
docker build \
  --build-arg OPENCLAW_INSTALL_BROWSER=1 \
  --build-arg OPENCLAW_DOCKER_APT_PACKAGES="inotify-tools" \
  -t openclaw-custom:latest .
docker compose -f /home/op/openclaw-stack/docker-compose.yml down
docker compose -f /home/op/openclaw-stack/docker-compose.yml up -d
```

**頻度**: 月1〜2回程度（OpenClawの更新頻度による）

---

作成日: 2026-03-15
