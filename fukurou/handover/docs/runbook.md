# OpenClaw Gateway Runbook

## 環境概要
- 目的: OpenClaw Gateway 本番環境の運用 Runbook。
- アーキテクチャ:

```text
Internet
-> Caddy (TLS termination)
-> openclaw-gateway:18789
```

- 常時稼働コンテナ:
  - `caddy`
  - `openclaw-gateway`
- 正規設定ファイル:
  - `infra/docker-compose.yml`
  - `infra/Caddyfile`
  - `infra/openclaw.json`
- Gateway 起動コマンド:

```bash
node dist/index.js gateway --bind lan --port 18789
```

## 正常状態の定義
- 公開エンドポイントが HTTPS で正常応答している。
- `caddy` と `openclaw-gateway` の両コンテナが稼働中。
- Caddy が内部ネットワーク経由で `openclaw-gateway:18789` に到達できる。

## ヘルスチェック
以下をすべて満たすとき、環境は正常と見なす:

- `https://fopenclaw.com` が HTTP 200 を返す
- `docker compose ps` で `caddy` と `openclaw-gateway` が `Up` 表示

確認コマンド例:

```bash
curl -I https://fopenclaw.com
docker compose ps
```

## 起動手順
1. スタックディレクトリに移動する。
2. デタッチモードでサービスを起動する。
3. 状態とヘルスを確認する。

```bash
cd /home/op/openclaw-stack
docker compose up -d
docker compose ps
curl -I https://fopenclaw.com
```

## 停止手順
1. 運用対象コンテナのみ停止する。
2. 両コンテナが停止していることを確認する。

```bash
cd /home/op/openclaw-stack
docker compose stop caddy openclaw-gateway
docker compose ps
```

## 再起動手順
1. 運用対象サービスを再起動する。
2. 状態と HTTPS ヘルスを再確認する。

```bash
cd /home/op/openclaw-stack
docker compose restart caddy openclaw-gateway
docker compose ps
curl -I https://fopenclaw.com
```

## ⚠️ .env変更時の注意

**`docker compose restart` では `.env` の変更が反映されない。**

`.env` を変更した場合（APIキー追加・変更など）は必ず以下を使用すること：

```bash
docker compose down && docker compose up -d
```

`restart` はコンテナを再起動するだけで環境変数を再読み込みしない。`down && up` はコンテナを完全に再作成するため `.env` が反映される。

確認コマンド：

```bash
docker compose exec openclaw-gateway env | grep <KEY_NAME>
```

## OpenClaw用環境変数の追加手順

> ⚠️ **この操作はOpenClawには権限がないため、必ずふくけいがVPS上で直接実行すること。**

### .envファイルの種類（混同注意）

| ファイル | パス | 用途 |
|---------|------|------|
| Docker起動用 | `/home/op/openclaw-stack/.env` | Docker Composeが起動時に読む環境変数。コンテナのビルド・起動設定に使用。 |
| OpenClaw用 | `/home/op/openclaw-stack/openclaw_config/.env` | OpenClawランタイムが読む環境変数。APIキー等を追加する場合はこちら。 |

### 手順

```bash
# 1. OpenClaw用 .env を編集（Docker起動用の .env と混同しないこと）
nano /home/op/openclaw-stack/openclaw_config/.env

# 2. 追記例（ファイル末尾に追加）
SOME_API_KEY=sk-xxx

# 3. Gatewayを再起動
#    openclaw_config/.env はボリュームマウントなので restart で反映される
docker compose restart openclaw-gateway
```

### 注意事項

- `/home/op/openclaw-stack/.env`（Docker起動用）を誤って編集しないこと。これを変更した場合は `docker compose down && docker compose up -d` が必要（上記「⚠️ .env変更時の注意」参照）。
- `openclaw_config/.env` はコンテナ内にボリュームマウントされているため、`docker compose restart` だけで反映される。`down && up` は不要。
- OpenClaw（Gateway）自身にはこのファイルへの書き込み権限がない。編集は必ずふくけいがSSHでVPSに入り実施する。

---

## SSH鍵の永続化設定

### 概要

コンテナ内で生成したSSH鍵は `docker compose down && up` で消える。VPS上に鍵を生成し、ボリュームマウントで永続化する。

### 設定済み内容（変更禁止）

| 項目 | 値 |
|-----|-----|
| 秘密鍵の実体 | `/home/op/openclaw-stack/openclaw_config/.ssh/id_ed25519` |
| 公開鍵 | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEwKgT8/7WN6A/G7kdJHveKXpTkdQUfoNibwb/XEu6YE openclaw-container` |

`docker-compose.yml` にて `openclaw-gateway`・`openclaw-cli` 両コンテナに以下のマウント設定済み：

```yaml
${OPENCLAW_CONFIG_DIR}/.ssh:/home/node/.ssh:ro
```

コンテナ内からは `/home/node/.ssh/id_ed25519` として参照可能。

### 新しいリポジトリへのアクセス追加手順

> ⚠️ **GitHubの操作はふくけいが行う。OpenClawは依頼のみ。**

1. `https://github.com/fukukei23/<リポジトリ名>/settings/keys` を開く
2. **Add deploy key** をクリック
3. Title: `openclaw-container`
4. Key: 上記公開鍵を貼り付け
5. 書き込みが必要なら「Allow write access」にチェック
6. **Add key** をクリック

### 現在登録済みリポジトリ

| リポジトリ | 権限 |
|----------|------|
| fukukei23/openclaw-workspace | write |

### 注意事項

- SSH鍵をコンテナ内で生成・保存してはいけない（`down && up` で消える）。
- 公開鍵は公開しても問題なし。
- 秘密鍵（`id_ed25519`）は絶対に公開・出力・送信禁止。

---

## Dockerfileパッケージ管理方針

### 基本方針
- 公式リポジトリのDockerfileへの切り替えは**しない**
- パッケージ追加は現在のDockerfileの`apt-get install`行に追記する
- 理由: 現在のChromium構成（`/usr/bin/chromium`）が動作確認済みのため

### 現在インストール済みパッケージ（2026-03-15時点）

| パッケージ | コマンド | 用途 |
|---------|---------|------|
| chromium | chromium | ブラウザ自動化 |
| chromium-driver | - | ChromeDriver |
| jq | jq | JSON処理 |
| inotify-tools | inotifywait | ファイル監視 |
| zip | zip | 圧縮 |
| ffmpeg | ffmpeg | 動画・音声処理 |
| yt-dlp | yt-dlp | YouTube DL |
| pandoc | pandoc | ドキュメント変換 |
| poppler-utils | pdftotext | PDF操作 |

### パッケージ追加手順
```bash
# 1. Dockerfileを編集
nano /home/op/openclaw-stack/Dockerfile

# ca-certificates \ の行の後に追記（&& rm -rf の前）
#     新しいパッケージ名 \

# 2. 再ビルド
docker build -t openclaw-custom:<VERSION> .
docker compose down && docker compose up -d

# 3. 確認
docker compose exec openclaw-gateway which <パッケージ名>
```

## OpenClawバージョンアップ手順

### 確認コマンド
```bash
docker compose exec openclaw-gateway node dist/index.js update status
docker compose exec openclaw-gateway node dist/index.js --version
```

- `Update: available` → アップデートあり
- `Update: latest` → 最新状態

### アップデート手順（Dockerカスタムイメージ構成）

```bash
# 1. 新イメージをpull
docker pull ghcr.io/openclaw/openclaw:<NEW_VERSION>

# 2. Dockerfileのベースイメージを更新
sed -i 's/FROM ghcr.io\/openclaw\/openclaw:<OLD>/FROM ghcr.io\/openclaw\/openclaw:<NEW>/' Dockerfile

# 3. docker-compose.ymlのイメージ名を更新
sed -i 's/openclaw-custom:<OLD>/openclaw-custom:<NEW>/g' docker-compose.yml

# 4. カスタムイメージを再ビルド
docker build -t openclaw-custom:<NEW_VERSION> .

# 5. 再起動
docker compose down && docker compose up -d
```

### 注意事項
- コンテナ内で `openclaw update` を実行しても永続しない（次回down/upで元に戻る）
- 必ずDockerfileとdocker-compose.ymlの両方を更新してからrebuildする

### バージョン履歴
| 日付 | バージョン | 備考 |
|------|-----------|------|
| 2026-03-07 | 2026.3.7 | 初期構築 |
| 2026-03-14 | 2026.3.12 | 安定版アップデート |

## Chromium / browserツールのセットアップ

### 概要

OpenClawのbrowserツールはDockerコンテナを動的に起動するサンドボックス方式。gatewayコンテナ内にChromiumをインストールするだけでは不十分で、以下の2つが必要：

1. Dockerfileでカスタムイメージをビルド（Chromiumインストール）
2. docker-compose.ymlでDockerソケットをマウント

### Step 1: Dockerfileを作成

```bash
cat > Dockerfile << 'EOF'
FROM ghcr.io/openclaw/openclaw:2026.3.7

USER root

RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libasound2 \
    libxdamage1 \
    libxcomposite1 \
    libxrandr2 \
    libxi6 \
    libgbm1 \
    xdg-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

USER node
EOF
```

### Step 2: カスタムイメージをビルド

```bash
docker build -t openclaw-custom:<VERSION> .
```

### Step 3: docker-compose.ymlのイメージを差し替え

```bash
sed -i 's|image: ghcr.io/openclaw/openclaw:<VERSION>|image: openclaw-custom:<VERSION>|g' docker-compose.yml
```

### Step 4: docker-compose.ymlにDockerソケットをマウント

`openclaw-gateway`の`volumes:`に追加：

```yaml
      - /var/run/docker.sock:/var/run/docker.sock
```

### Step 5: openclaw.jsonにbrowser.executablePathを設定

```bash
python3 -c "
import json
with open('openclaw_config/openclaw.json', 'r') as f:
    cfg = json.load(f)
cfg['browser'] = {
    'executablePath': '/usr/bin/chromium'
}
with open('openclaw_config/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print('done')
"
```

### Step 6: コンテナを再作成

```bash
docker compose down && docker compose up -d
```

### 動作確認

```bash
docker compose exec openclaw-gateway chromium --version
docker compose exec openclaw-gateway env | grep -i chrome
```

### 注意事項

- `browser.chrome`、`browser.chromePath`、`browser.args` はすべて無効なキー。正しくは `browser.executablePath`
- `CHROMIUM_FLAGS`環境変数はOpenClawでは参照されない（コード内で`--no-sandbox`は自動付与）
- OpenClawバージョンアップ時はDockerfileのベースイメージも合わせて更新し再ビルドが必要
- dbusのエラーログはコンテナ環境では無視して問題なし

### Step 1: .envにキーを追加

```bash
nano .env
# 例: KIMI_API_KEY=sk-xxx
```

### Step 2: openclaw.jsonに設定を追加（必要な場合）

envだけで自動検出されるケース（例: KIMI_API_KEY）は不要。
openclaw.jsonで明示的に参照する場合は `${ENV_VAR}` 形式で記述：

```json
"apiKey": "${KIMI_API_KEY}"
```

### Step 3: コンテナを完全再作成

```bash
docker compose down && docker compose up -d
```

### Step 4: 反映確認

```bash
docker compose exec openclaw-gateway env | grep <KEY_NAME>
```

### パターン一覧

| パターン | 例 | openclaw.json変更 |
|---------|-----|-----------------|
| envのみで自動検出 | KIMI_API_KEY | 不要 |
| envのみで自動検出 | BRAVE_API_KEY | 不要 |
| openclaw.jsonで参照 | GLM_API_KEY | `"apiKey": "${GLM_API_KEY}"` が必要 |

### web_searchプロバイダの切り替え

```bash
python3 -c "
import json
with open('openclaw_config/openclaw.json', 'r') as f:
    cfg = json.load(f)
cfg['tools']['web']['search']['provider'] = 'brave'  # brave / kimi / perplexity / grok / gemini
with open('openclaw_config/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print('done')
"
docker compose restart openclaw-gateway
```

## MiniMaxプロバイダー設定

### 正しい設定値（変更禁止）

| キー | 値 |
|-----|-----|
| `baseUrl` | `https://api.minimax.io/anthropic` |
| `api` | `anthropic-messages` |
| モデルID | `MiniMax-M2.5`（大文字混在。`minimax-m2.5` 等に変更しない） |

> ⚠️ **モデルIDの大文字混在は変更禁止。** 小文字に書き換えるとAPI認証エラーになる。

### フォールバック順序

```
zai/glm-5
  ↓（失敗時）
minimax/MiniMax-M2.5
  ↓（失敗時）
openai/gpt-5-mini
  ↓（失敗時）
openai/gpt-5.1-codex
```

### モデル動作確認方法

`docker compose logs` はホスト側コマンドのため、OpenClawは以下のコマンドを使うこと：

```bash
cat /tmp/openclaw/openclaw-$(date +%F).log | grep -E "fallback|model=" | tail -20
```

このコマンドでフォールバックの発生とどのモデルが実際に使用されたかを確認できる。

---

## サービス状態確認
クイック確認用コマンド:

```bash
cd /home/op/openclaw-stack
docker compose ps
docker compose logs --tail 100 caddy openclaw-gateway
curl -I https://fopenclaw.com
```

期待される状態:
- `docker compose ps` で `caddy` と `openclaw-gateway` が `Up` 表示。
- HTTPS エンドポイントが `HTTP/1.1 200` または `HTTP/2 200` を返す。

## ログ確認
以下の順で確認する:
1. Compose 全体の概要
2. Caddy ログ（エッジ入口）
3. Gateway ログ（アプリケーション上流）

```bash
cd /home/op/openclaw-stack
docker compose logs

docker compose logs --tail 200 caddy
docker compose logs --tail 200 openclaw-gateway
```

必要に応じてスナップショットと照合する:
- `snapshots/docker-compose-config.txt`
- `snapshots/docker-compose-logs.txt`

## よくある問題
- `502 Bad Gateway`
- `pairing required`
- WebSocket 接続失敗

最初に実行するコマンド:

```bash
cd /home/op/openclaw-stack
docker compose ps
docker compose logs --tail 200 caddy openclaw-gateway
curl -I https://fopenclaw.com
```

## 502 Bad Gateway トラブルシュート
主な原因:
- `openclaw-gateway` が再起動中または一時的に `18789` でリッスン不可。
- アップストリームルーティングの不一致。
- 再起動直後の起動競合。

確認コマンド:

```bash
cd /home/op/openclaw-stack
docker compose ps
docker compose logs --tail 200 openclaw-gateway
docker compose logs --tail 200 caddy
curl -I https://fopenclaw.com
```

コンテナ間疎通確認:

```bash
docker compose exec openclaw-gateway wget -qSO- http://127.0.0.1:18789
docker compose exec caddy wget -qSO- http://openclaw-gateway:18789
```

復旧操作:

```bash
docker compose restart openclaw-gateway
docker compose restart caddy
curl -I https://fopenclaw.com
```

## pairing required トラブルシュート
主な原因:
- ペアリング・セッション状態の欠落。
- Gateway の認証モードがトークンベースで、クライアントがペアリングされていない。
- コンテナ再起動後にランタイム状態が変わった。

確認コマンド:

```bash
cd /home/op/openclaw-stack
docker compose ps
docker compose logs --tail 200 openclaw-gateway
```

設定確認ポイント（秘密情報は出力しない）:
- `infra/openclaw.json`:
  - `gateway.auth.mode`
  - `gateway.controlUi.allowedOrigins`
  - `gateway.trustedProxies`
- `infra/Caddyfile`:
  - リバースプロキシ先が `openclaw-gateway:18789` であること

## WebSocket 接続失敗トラブルシュート
主な原因:
- Caddy が Gateway アップストリームに転送できない。
- Gateway プロセスが正常でない。
- プロキシ・ヘッダー信頼設定の不一致。

確認コマンド:

```bash
cd /home/op/openclaw-stack
docker compose ps
docker compose logs --tail 200 caddy
docker compose logs --tail 200 openclaw-gateway
curl -I https://fopenclaw.com
```

設定整合性の確認:
- `infra/Caddyfile` が `reverse_proxy openclaw-gateway:18789` を使用していること。
- `infra/openclaw.json` に `gateway.bind` および trustedProxy・origin キーが設定されていること。

## 設定変更手順
原則: `infra` を先に変更し、その後ランタイムに反映する。

1. 正規設定ファイルを編集する:
   - `infra/docker-compose.yml`
   - `infra/Caddyfile`
   - `infra/openclaw.json`
2. 変更を適用する。
3. ヘルスとログを確認する。
4. スナップショットを取得する。

```bash
cd /home/op/openclaw-stack
docker compose up -d
docker compose restart

docker compose ps
docker compose logs --tail 200
curl -I https://fopenclaw.com
```

スナップショット更新（推奨）:

```bash
docker compose config > snapshots/docker-compose-config.txt
docker compose logs --tail 200 > snapshots/docker-compose-logs.txt
```

## バックアップ手順
バックアップ対象:
- `infra/`（設定の正規ソース）
- `snapshots/`（状態エビデンス）
- `README_HANDOVER.md` および本 Runbook

アーカイブコマンド例:

```bash
cd /home/op
cp -a openclaw-stack openclaw-stack.backup.$(date +%Y%m%d-%H%M%S)
```

最低限の確認事項:
- バックアップに `infra/docker-compose.yml`、`infra/Caddyfile`、`infra/openclaw.json` が含まれること。
- バックアップに最新の `snapshots` ファイルが含まれること。

## 復旧手順
1. バックアップからスタックディレクトリを復元する。
2. 正規設定ファイルが存在することを確認する。
3. サービスを起動する。
4. ヘルスチェックで正常を確認する。

```bash
cd /home/op/openclaw-stack
docker compose up -d
docker compose ps
docker compose logs --tail 200
curl -I https://fopenclaw.com
```

正常に戻らない場合:
- `infra/Caddyfile` のアップストリーム先を再確認する。
- `infra/openclaw.json` の Gateway 関連キーを再確認する（トークン値は出力しない）。
- 対象サービスを個別に再起動する:

```bash
docker compose restart openclaw-gateway
docker compose restart caddy
curl -I https://fopenclaw.com
```

## Android デバイスペアリング手順

ペアリングはデバイス側から開始し、サーバー側で承認する。

### 前提条件
- Gateway が正常稼働中（`docker compose ps` で `openclaw-gateway` が `Up`）
- Android 端末に OpenClaw アプリがインストール済み

### Step 1: Android アプリからペアリング開始

Android の OpenClaw アプリを開き、Gateway 接続設定に以下を入力する:

- **Gateway URL**: `https://fopenclaw.com`
- **Token**: `openclaw_config/openclaw.json` の `gateway.auth.token` の値

アプリがペアリングリクエストを Gateway に送信する。

### Step 2: サーバー側で保留リクエストを確認

```bash
docker compose exec openclaw-gateway node dist/index.js devices list
```

新しいデバイスが `Pending` に表示される。

### Step 3: 承認

```bash
docker compose exec openclaw-gateway node dist/index.js devices approve
```

保留中のデバイスを選択して確定する。

### Step 4: 確認

```bash
docker compose exec openclaw-gateway node dist/index.js devices list
```

デバイスが `Pending` から `Paired` に移行していることを確認する。

追加デバイスがある場合は Step 1〜4 を繰り返す。

### 注意事項

- `qr` コマンドは iOS 専用。Android には使用しない。
- デバイス管理コマンドはすべて `docker compose exec openclaw-gateway node dist/index.js devices ...` で実行する。`docker compose run --rm openclaw-cli` は使用しない。
- `openclaw-cli` コンテナは `gateway.mode` が `"local"`（ループバック）のため Gateway に到達できない。CLI デバイスコマンドは Gateway コンテナ自身を使用すること。

---

## ⚠️ 重要: gateway.mode を変更してはいけない

**`openclaw_config/openclaw.json` の `gateway.mode` を `"local"` から `"remote"` に変更しないこと。**

この設定は CLI の接続方式と Gateway プロセス自体の動作の両方を制御する。`"remote"` に変更すると `openclaw-gateway` コンテナが即座にクラッシュループに入り、`https://fopenclaw.com` が 502 になる。

実証済みの影響（2026-03-08）:
- `"local"` → `"remote"` に変更: Gateway コンテナが数秒以内にクラッシュループ、サイトが 502 に。
- `"local"` に戻して `docker compose restart openclaw-gateway`: 約 5 秒で復旧。

`openclaw-cli` コンテナがループバックへの接続に失敗するのは想定内で無害。代わりに `docker compose exec openclaw-gateway` を使用すること（上記デバイスペアリング手順参照）。

---

## バージョンアップ手順

### インストール形態

この環境はビルド済み Docker イメージ（`ghcr.io/openclaw/openclaw`）を使用しており、git クローンではない。

- `openclaw update` / `openclaw update.run` は**適用不可**。インプロセス更新機能は git ベースのインストールを対象としており、`not-git-install` と表示してスキップされる。
- git クローンへの移行（`scripts/install.sh`）は**不適切**。ディレクトリ構造が異なるため、現行の Docker 運用が壊れるリスクがある。

正しいアップグレード方法はイメージを差し替えて `docker-compose.yml` を更新すること。

### バージョン確認

```bash
docker compose exec openclaw-gateway cat /app/package.json | grep '"version"'
```

### アップグレード手順

```bash
cd /home/op/openclaw-stack

# 1. docker-compose.yml をバックアップ
cp docker-compose.yml docker-compose.yml.bak.$(date +%Y%m%d-%H%M%S)

# 2. 新イメージを pull
docker pull ghcr.io/openclaw/openclaw:<NEW_VERSION>

# 3. docker-compose.yml のイメージタグを書き換え
sed -i 's|image: ghcr.io/openclaw/openclaw:.*|image: ghcr.io/openclaw/openclaw:<NEW_VERSION>|g' docker-compose.yml

# 4. 変更を確認（caddy:2 が変わっていないこと）
grep image docker-compose.yml

# 5. 適用と確認
docker compose up -d
sleep 15
docker compose ps
curl -I https://fopenclaw.com
```

`<NEW_VERSION>` を対象バージョンタグ（例: `2026.3.7`）に置き換えること。

### 注意事項

- `docker compose up -d` 直後の `502` は想定内。Gateway の起動に約 15 秒かかる。
- `openclaw-cli` のイメージも `openclaw-gateway` と同じバージョンに揃えること。
- アップグレード後はスナップショットを更新すること:

```bash
docker compose config > snapshots/docker-compose-config.txt
docker compose logs --tail 200 > snapshots/docker-compose-logs.txt
```

---

## アップグレード後のクラッシュループ対処

### 症状

イメージアップグレード後に `openclaw-gateway` がクラッシュループ（`Restarting`）に入り、`curl -I https://fopenclaw.com` が `502` を返す。

### 原因

バージョン間のスキーマ変更により、`openclaw_config/openclaw.json` の既存キーが非互換になることがある。Gateway は無効な設定では起動を拒否する。

### 診断

```bash
docker compose logs --tail 50 openclaw-gateway | grep "Unrecognized keys\|Invalid input\|Config invalid"
```

### 既知の破壊的変更

| バージョン | 廃止されたキー |
|-----------|--------------|
| 2026.3.7 | `channels.discord.inbound`、`channels.discord.outbound` |

### 復旧手順

1. `openclaw.json` をバックアップする。
2. Python で該当キーを削除する（JSON 構造を保持した安全な方法）。
3. Gateway を再起動する。

```bash
cd /home/op/openclaw-stack

# 1. バックアップ
cp openclaw_config/openclaw.json openclaw_config/openclaw.json.bak.$(date +%Y%m%d-%H%M%S)

# 2. 該当キーを削除（例: channels.discord.inbound / outbound）
python3 -c "
import json
with open('openclaw_config/openclaw.json', 'r') as f:
    cfg = json.load(f)
discord = cfg.get('channels', {}).get('discord', {})
discord.pop('inbound', None)
discord.pop('outbound', None)
with open('openclaw_config/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print('done')
"

# 3. 削除確認
grep -n "inbound\|outbound" openclaw_config/openclaw.json

# 4. 再起動
docker compose restart openclaw-gateway
sleep 15
docker compose ps
curl -I https://fopenclaw.com
```

期待される結果: `openclaw-gateway` が `Up (healthy)` になり、HTTPS が `200` を返す。

---

## Z.AI APIエラーコード1113 対処

### 症状

GLM-5呼び出し時に以下のエラーが返される:

```json
{
    "error": {
        "code": "1113",
        "message": "Insufficient balance or no resource package. Please recharge."
    }
}
```

OpenClawのUIには `⚠️ API rate limit reached. Please try again later.` と表示される。

### 原因

**Z.AIのAPIエンドポイントはプランによって異なる。**

| プラン | APIエンドポイント |
|--------|----------------|
| Coding Plan（サブスク） | `https://api.z.ai/api/coding/paas/v4` |
| Standard（従量課金） | `https://api.z.ai/api/paas/v4` |

Coding Planのサブスクを契約していても、Standardエンドポイントを使用すると残高不足（1113）が返される。

### 診断

```bash
# 現在のbaseUrlを確認
python3 -c "
import json
with open('openclaw_config/openclaw.json') as f:
    cfg = json.load(f)
print(cfg['models']['providers']['zai']['baseUrl'])
"

# APIを直接叩いて確認
curl -s -X POST https://api.z.ai/api/coding/paas/v4/chat/completions \
  -H "Authorization: Bearer $(grep GLM_API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"model":"glm-5","messages":[{"role":"user","content":"hi"}],"max_tokens":10}' \
  | python3 -m json.tool
```

### 修正手順

```bash
cd /home/op/openclaw-stack

python3 -c "
import json
with open('openclaw_config/openclaw.json', 'r') as f:
    cfg = json.load(f)
cfg['models']['providers']['zai']['baseUrl'] = 'https://api.z.ai/api/coding/paas/v4'
with open('openclaw_config/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print('done')
"

docker compose restart openclaw-gateway
```

### 注意事項

- `.env` の `GLM_API_KEY` にはCoding Planに紐づいたAPIキーを設定すること。
- Z.AIダッシュボードの Billing → Overview で Cash/Credits残高が $0.00 でも、Coding Planサブスクが有効であればCoding Planエンドポイントで利用可能。
- クォータ（5時間/週次）はリクエスト数の上限であり、残高とは別管理。
