# OpenClaw Environment Handover

## 1. 目的

このパッケージは **OpenClaw Gateway 環境を完全復元できる引継ぎセット**です。

LLMまたはエンジニアが **過去の文脈を一切持っていなくても**
この環境を理解し、トラブルシュートを継続できることを目的としています。

---

# 2. 環境概要

OpenClaw Gateway は以下の構成で動作しています。

```
Internet
   ↓
DNS
   ↓
Caddy (HTTPS Reverse Proxy)
   ↓
openclaw-gateway :18789
   ↓
OpenClaw runtime
```

現状の安定状態チェック（最初に確認）

- `curl -I https://fopenclaw.com` が `200` を返すこと
- `docker compose ps` で `caddy` と `openclaw-gateway` が `Up` であること

Docker Compose の常時運用対象は2コンテナです。

```
caddy
openclaw-gateway
```

`openclaw-cli` は補助用途のサービス定義であり、現構成では常駐コンテナ運用の対象外です。

---

# 3. 実行環境

## VPS

```
IP: 162.43.17.111
user: op
```

作業ディレクトリ

```
/home/op/openclaw-stack
```

---

# 4. 重要ディレクトリ

VPS 内

```
/home/op/openclaw-stack
├ docker-compose.yml
├ caddy
│  └ Caddyfile
├ openclaw_config
│  └ openclaw.json
└ openclaw_workspace
```

---

# 5. OpenClaw Gateway 設定

Gateway は

```
port: 18789
bind: lan
```

で起動します。

Docker compose command

```
node dist/index.js gateway --bind lan --port 18789
```

---

# 6. ネットワーク構成

Docker network

```
openclaw-net
subnet: 172.30.0.0/24
```

コンテナIP

```
Caddy            172.30.0.10
openclaw-gateway 172.30.0.20
```

---

# 7. 認証構成

Gateway authentication

```
mode: token
```

Control UI origin

```
https://fopenclaw.com
```

Caddy → Gateway は

```
trustedProxies
```

で許可されています。

---

# 8. 引継ぎパッケージ構成

```
OpenClaw-Handover
│
├ support_bundle.tgz
│
├ infra
│   ├ docker-compose.yml
│   ├ Caddyfile
│   └ openclaw.json
│
└ README_HANDOVER.md
```

---

# 9. support_bundle の内容

```
01_compose_ps.txt
02_compose_structure_sanitized.txt
03_caddyfile_keylines_sanitized.txt
04_gateway_mount_paths.txt
05_openclaw_json_gateway_keys.txt
06_gateway_logs_filtered.txt
07_caddy_logs_filtered.txt
08_external_http_ws_status.txt
```

これらは **サニタイズ済みログ**です。

---

# 10. トラブルシュート

最初に実行するコマンド

```
docker compose ps
docker compose logs
```

Gateway確認

```
curl localhost:18789
```

---

# 11. よくある問題

OpenClaw環境で発生しやすい問題

### Caddy Reverse Proxy

```
502 Bad Gateway
```

原因

```
gateway container down
gateway port mismatch
docker network misconfiguration
```

補足（兆候ベース）

```
502 の主因候補: gateway 再起動中、または一時的に listen 不可
```

---

### pairing required

原因

```
device pairing missing
token mismatch
gateway auth failure
```

---

### websocket failure

原因

```
Authorization header conflict
Caddy header forwarding
trustedProxies mismatch
```

---

# 12. 復旧手順

完全復旧手順

```
1 VPSへSSH
2 openclaw-stackへ移動
3 docker compose up -d
4 gateway config確認
5 Caddy reverse proxy確認
6 Control UI接続
```

---

# 13. セキュリティ注意

絶対に共有してはいけないもの

```
token
apiKey
Authorization header
private logs
```

support_bundle は **サニタイズ済み**です。

---

# 14. 次のエンジニアへの指示

以下の順で調査してください

1 Docker containers
2 Gateway config
3 Caddy reverse proxy
4 WebSocket connection
5 Control UI auth

---

# 15. 参考

OpenClaw は

```
Gateway
Agent runtime
Plugin system
Control UI
```

で構成されています。

---

# 16. 引継ぎメモ

この環境は

```
Caddy → Gateway → OpenClaw runtime
```

の三層構造です。

トラブルの **約90%は Caddy または認証設定**です。

---

# 17. snapshots フォルダ

snapshots は

環境状態のスナップショットを保存するディレクトリです。

含まれるファイル

docker-compose-config.txt
docker-compose-logs.txt
support_bundle.tgz

docker-compose-config.txt

以下コマンドの出力

docker compose config

これは

環境変数展開後の最終 docker 構成です。

docker-compose-logs.txt

以下コマンドの出力

docker compose logs --tail 200

コンテナの直近ログです。

support_bundle.tgz

OpenClaw Gateway の

調査用サポートログです。

すべて機密情報を除去した状態で保存されています。

# 18. docs フォルダ

docs フォルダは

OpenClaw の仕様書や運用資料を保存する場所です。

例

OpenClaw documentation
運用Runbook
トラブルシュート手順
構成図

docs は参考資料です。

実際の環境の真実は

infra ディレクトリの

docker-compose.yml
Caddyfile
openclaw.json

です。

# 19. 引継ぎパッケージ更新ポリシー

この引継ぎパッケージは

環境の状態を再現するためのフォレンジック資料です。

フォルダ構造は恒久的に固定します。

OpenClaw-Handover
infra
snapshots
meta
docs

更新が必要な条件

以下の変更があった場合

引継ぎパッケージを更新してください。

docker-compose.yml 変更
Caddyfile 変更
openclaw.json 変更
OpenClaw Gateway設定変更
ドメイン変更
TLS設定変更
pairing方式変更
トラブルシュート実施

更新手順

VPSで以下を実行

docker compose config > snapshots/docker-compose-config.txt

docker compose logs --tail 200 > snapshots/docker-compose-logs.txt

support_bundle を更新

infra の設定ファイルを更新

README_HANDOVER.md に変更内容を記録

# 20. セキュリティ

以下の情報は引継ぎ資料に含めない

token
apiKey
Authorization header
.env
private logs

必要な場合

<REDACTED>

でマスクする

# アーキテクチャ図

OpenClaw Gateway 環境の構成図

docs/openclaw_architecture.png

# END

## Responsibility Boundary (Architecture Contract)

### 役割範囲と責務
- `docker-compose.yml` は `caddy` と `openclaw-gateway` の実行トポロジー、サービス接続、ネットワーク分離を定義する。
- `Caddyfile` は公開 HTTP/HTTPS の受け口、TLS 終端、gateway へのリバースプロキシ経路を定義する。
- `openclaw.json` は gateway の設定キー（例: `gateway.bind`, `gateway.auth.mode`, `gateway.controlUi.allowedOrigins`, `gateway.trustedProxies`）の意味を定義する。

### デプロイ構成（現行）
- 稼働コンテナ: `caddy`, `openclaw-gateway`
- ネットワークフロー:
  - Internet
  - -> Caddy (TLS termination)
  - -> `openclaw-gateway:18789`（`infra/Caddyfile` の `reverse_proxy` 先）

### 境界契約
- `docker-compose.yml` は、`caddy` が利用する内部 Docker ネットワークから `openclaw-gateway` に到達できる状態を維持する。
- `Caddyfile` は `openclaw-gateway:18789` へプロキシし、gateway トラフィックのインターネット向け入口を唯一の経路として維持する。
- `openclaw.json` は外部公開設定を再定義しない。責務は gateway の実行時挙動制御であり、ホスト側の公開制御は対象外。

### セキュリティルール
- gateway の `18789` ポートはインターネットへ公開しない。
- gateway へ接続できるのは `caddy` のみ。
- ホストファイアウォールの公開ポートは `22`、`80`、`443` のみ。

### Gateway 実行時情報
- gateway プロセスの実行コマンド:

```bash
node dist/index.js gateway --bind lan --port 18789
```

- 運用注記: `openclaw doctor --fix` は **コンテナ内では利用不可**。

### トラブルシュート
以下の順で確認する:

```bash
docker compose exec openclaw-gateway wget -qSO- http://127.0.0.1:18789
docker compose exec caddy wget -qSO- http://openclaw-gateway:18789
curl -I https://fopenclaw.com
```

### Canonical Configuration Source（単一の真実）
authoritative files は以下で固定する。

- `infra/docker-compose.yml`
- `infra/Caddyfile`
- `infra/openclaw.json`

原則

- 実行状態（コンテナ内状態・ログ）から設定を推測しない。
- まず authoritative files を参照し、その後に `snapshots/docker-compose-config.txt` と `snapshots/docker-compose-logs.txt` で裏付ける。
- 変更は `infra` を起点に行い、必要に応じて `docker compose up -d` または再起動で反映する。

### Runtime Health Check

The environment is considered healthy when:

- https://fopenclaw.com returns HTTP 200
- docker compose ps shows `caddy` and `openclaw-gateway` as `Up`

---

# 障害記録・運用メモ (2026-03-18/19)

## 1. .env 二重管理問題（解決済み）

### 問題
APIキーが2箇所に分散して管理されており、意図せず一方が有効・他方が無効という状態になっていた。

```
/home/op/openclaw-stack/
├── .env                      ← docker-compose.yml が読む（env_file: .env）
│                                ※ MINIMAX_API_KEY はコメントアウトされていた
└── openclaw_config/
    └── .env                  ← 実際のAPIキーが書かれていた
                                 ※ docker-compose.yml は読まない
```

docker-compose.yml の `env_file: .env` はルートの `.env` のみを読む。
`openclaw_config/.env` はコンテナに渡らない。

### 解決
2026-03-19 に `openclaw_config/.env` の内容をルートの `.env` に統合。
重複キーを整理し、以下の13キーに整理した：

```
OPENCLAW_CONFIG_DIR, OPENCLAW_WORKSPACE_DIR, OPENCLAW_IMAGE,
GLM_API_KEY, DISCORD_BOT_TOKEN, KIMI_API_KEY, BRAVE_API_KEY,
ZAI_EMAIL, ZAI_PASSWORD, GITHUB_TOKEN, MINIMAX_API_KEY,
OPENAI_API_KEY, GITHUB_TOKEN_READ
```

### 運用ルール
- APIキーの追加・変更は必ず `/home/op/openclaw-stack/.env` に行う
- `openclaw_config/.env` は使用しない（削除または空ファイルにしてよい）
- 変更後は `docker compose stop openclaw-gateway && docker compose up -d openclaw-gateway` で反映
- 確認コマンド: `docker compose exec openclaw-gateway printenv | grep <KEY_NAME> | sed 's/=.*/=***/'`

---

## 2. MiniMax APIキー設定

### 変更内容
- MINIMAX_API_KEY を Coding Plan（サブスク）キー（`sk-cp-x...`）に変更
- Coding Plan は MiniMax-M2.7 で動作（全プラン共通）
- フォールバックモデルを `minimax/MiniMax-M2.5` → `minimax/MiniMax-M2.7` に変更

### openclaw.json の MiniMax 設定
```
baseUrl: https://api.minimax.io/anthropic
apiKey:  ${MINIMAX_API_KEY}
models:  MiniMax-M2.7（追加）, MiniMax-M2.5, MiniMax-M2.1
fallback: minimax/MiniMax-M2.7
```

---

## 3. cronジョブ大量重複による MiniMax 残高過剰消費（解決済み）

### 原因
`Long Task Watcher (hybrid)` cronジョブが22件重複登録されており、
5分ごとに並行実行されていた。

プライマリモデル（zai/glm-5）がレート制限に達すると、フォールバックチェーンが
全22件で同時に発火し、MiniMax-M2.5 に流入。
2026-03-18 の約7時間で約5 USD を消費した。

### 解決
- Long Task Watcher 22件: `enabled: false` に変更
- その他重複ジョブ（openclaw_health_check_q6h × 5件等）8件: `enabled: false` に変更
- 設定ファイル: `/home/op/openclaw-stack/openclaw_config/cron/jobs.json`
  （コンテナ内 `/home/node/.openclaw/cron/jobs.json` にマウント）

### 再発防止
- cronジョブを登録する前に同名ジョブの存在を必ず確認する
- Long Task Watcher を再登録する場合は1件のみ
- 確認コマンド:
```bash
cat /home/op/openclaw-stack/openclaw_config/cron/jobs.json | python3 -c "
import json,sys
data=json.load(sys.stdin)
for j in data.get('jobs',[]):
    print(j.get('enabled','?'), j.get('name','?'))
"
```

---

## 4. MiniMax サブスク vs 従量課金 整理

| 種別 | モデル | 課金 | OpenClaw用途 |
|------|-------|------|-------------|
| Coding Plan（サブスク） | M2.7 | 月額固定・リクエスト数制限あり | フォールバック（現在設定中） |
| Pay-as-you-go（従量課金） | M2.5/M2.7 | トークン単価 | 残高ゼロのため一時停止 |


---

## 障害記録・運用メモ追記 (2026-03-20)

### よつば（Surface Go）との連携確立
- Surface Go（192.168.1.7）にOpenClaw「よつば」を構築
- fopenclaw Discordサーバーにフクロウとよつばが共存
- フクロウ側: requireMention: true 設定済み（@フクロウでのみ反応）
- GitHubワークスペース（fukukei23/openclaw-workspace）をフクロウ・よつばで共有
- よつば専用ディレクトリ: workspace/yotsuba/

### フクロウのSSH設定（github-workspace）
- VPSのgit pushはSSH（git@github-workspace:）経由
- DNS解決失敗時はHTTPS経由でpush:
  ```bash
  git push https://fukukei23:$(grep '^GITHUB_TOKEN=' /home/op/openclaw-stack/.env | cut -d= -f2)@github.com/fukukei23/openclaw-workspace.git master
  ```
