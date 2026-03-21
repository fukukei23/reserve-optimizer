# よつば（Surface Go）環境 引き継ぎ資料

作成日: 2026-03-20
OpenClaw バージョン: 2026.3.11

---

## 1. 目的

Surface Go（Ubuntu 24.04 LTS）上で動作するOpenClawローカルエージェント「よつば」を
完全復元するための引き継ぎ資料。

---

## 2. 環境概要

```
Internet（ローカルネットワーク内のみ）
   ↓
SSH（192.168.1.7:22）
   ↓
openclaw-gateway コンテナ :18789
   ↓
OpenClaw runtime
```

VPSのフクロウ（Caddy + 2コンテナ）とは異なり、Caddyなしのシングルコンテナ構成。
外部公開なし。ローカルネットワーク内からのみアクセス可能。

---

## 3. 実行環境

```
機体:    Surface Go 第1世代 / Pentium 4415Y / RAM 8GB
OS:      Ubuntu 24.04.4 LTS（CUI環境）
ホスト名: claw-node
ユーザー: user
IP:      192.168.1.7（Wi-Fi / wlp1s0）
Swap:    4GB
```

---

## 4. 重要ディレクトリ

```
~/nemoclaw-dev/
├── .env                    ← APIキー（権威ソース）
├── docker-compose.yml      ← コンテナ起動定義（権威ソース）
└── NemoClaw/               ← github.com/NVIDIA/NemoClaw クローン
    └── Dockerfile          ← イメージビルド元

~/.openclaw/
└── openclaw.json           ← Gateway・LLM・Discord設定（権威ソース）
```

---

## 5. Canonical Configuration Source（単一の真実）

| ファイル | パス | 内容 |
|---------|------|------|
| openclaw.json | ~/.openclaw/openclaw.json | LLM・エージェント・Discord設定 |
| .env | ~/nemoclaw-dev/.env | APIキー（GLM/MiniMax/Discord） |
| docker-compose.yml | ~/nemoclaw-dev/docker-compose.yml | コンテナ起動定義 |

---

## 6. Gateway設定

```
port: 18789
bind: lan
mode: local
auth: token（自動生成）
```

---

## 7. LLM設定

| プロバイダー | エンドポイント | モデル | 用途 |
|------------|--------------|--------|------|
| zai（GLM） | https://api.z.ai/api/coding/paas/v4 | glm-5 / glm-4.7 | プライマリ |
| minimax | https://api.minimax.io/v1 | MiniMax-M2.7 | フォールバック |

注意: GLMはCoding Plan専用エンドポイントを使用。一般用URLではサブスク特権が無効。

---

## 8. Discord Bot（よつば）

| 項目 | 内容 |
|------|------|
| Bot名 | よつば |
| サーバー | fopenclaw |
| Guild ID | 1479832235044769872 |
| チャンネルID（#一般） | 1479832235610734664 |
| ユーザーID（fukukei） | 1135078010899398727 |
| Developer Portal | discord.com/developers/applications |

詳細: docs/discord_setup.md 参照

---

## 9. 起動・停止・確認コマンド

```bash
# 起動
cd ~/nemoclaw-dev && docker compose up -d

# 停止
cd ~/nemoclaw-dev && docker compose down

# 再起動
cd ~/nemoclaw-dev && docker compose restart openclaw-gateway

# ログ確認
cd ~/nemoclaw-dev && docker compose logs -f --tail 50

# 状態確認
cd ~/nemoclaw-dev && docker compose ps
```

---

## 10. ヘルスチェック

環境が正常な状態:
- `docker compose ps` で `openclaw-gateway` が `Up`
- `docker compose logs` に `[discord] logged in to discord as ... (よつば)` が出ている
- `curl http://127.0.0.1:18789` が応答する

---

## 11. PC買い替え時の復元手順

1. Ubuntu 24.04 LTS インストール（CUI環境推奨）
2. スリープ無効化:
   ```bash
   sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
   ```
3. Docker公式リポジトリからインストール（apt版ではなくdocker-ce）
4. `sudo usermod -aG docker $USER` → ログアウト→再ログイン
5. NemoClawリポジトリをクローン:
   ```bash
   git clone https://github.com/NVIDIA/NemoClaw.git ~/nemoclaw-dev/NemoClaw
   ```
6. Dockerイメージをビルド（5〜15分）:
   ```bash
   cd ~/nemoclaw-dev/NemoClaw && docker build -t openclaw-surface:local .
   ```
7. `~/.openclaw/openclaw.json` を復元（本パッケージの `infra/openclaw.json` をベースに実際のIDを設定）
8. `~/nemoclaw-dev/.env` を復元（APIキーを設定）
9. `~/nemoclaw-dev/docker-compose.yml` を復元（本パッケージの `infra/docker-compose.yml` をコピー）
10. ファイル権限を設定:
    ```bash
    sudo chown -R 999:999 ~/.openclaw/
    sudo chmod -R 775 ~/.openclaw/
    sudo usermod -aG systemd-journal user
    # ログアウト→再ログイン
    ```
11. discord.com/developers でBotのIntentsをONに設定（Message Content / Server Members / Presence）
12. `docker compose up -d` で起動

---

## 12. 運用ルール

- openclaw.json編集後は必ず構文チェック:
  ```bash
  python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null && echo OK || echo ERROR
  ```
- APIキーの追加・変更は `~/nemoclaw-dev/.env` のみで行う
- 18789ポートは外部公開しない（127.0.0.1バインド厳守）
- cronジョブ登録時は同名ジョブの重複を事前確認（VPSで22件重複→5USD消費の前例あり）
- MiniMaxフォールバック発火頻度に注意

---

## 13. VPS（フクロウ）との構成比較

| 項目 | VPS（フクロウ） | Surface Go（よつば） |
|------|---------------|-------------------|
| コンテナ数 | 2（caddy + openclaw-gateway） | 1（openclaw-gatewayのみ） |
| リバースプロキシ | Caddy（TLS終端） | なし |
| 外部公開 | fopenclaw.com / HTTPS | なし（ローカルのみ） |
| Docker image | openclaw-custom:2026.3.12 | openclaw-surface:local |
| 設定ディレクトリ | /home/op/openclaw-stack/ | ~/nemoclaw-dev/ |
| openclaw.json | /home/op/openclaw-stack/openclaw_config/ | ~/.openclaw/ |
| Bot名 | フクロウ | よつば |
| 用途 | 本番・常時稼働 | ローカル開発・実験 |

---

## 14. セキュリティ注意事項

以下はこの資料に含めない。別途安全な場所で管理:

- GLM_API_KEY
- MINIMAX_API_KEY
- DISCORD_BOT_TOKEN
- gateway.auth.token（自動生成されるが ~/.openclaw/openclaw.json に書き込まれる）

Discordトークンが漏洩した場合: Developer PortalでReset Tokenを即座に実行。

---

## 15. 引き継ぎパッケージ構成

```
Yotsuba-Handover/
├── README_HANDOVER.md        ← この資料
├── infra/
│   ├── openclaw.json         ← 設定テンプレート（IDはREDACTED）
│   ├── docker-compose.yml    ← コンテナ起動定義
│   └── .env.template         ← APIキーテンプレート
├── docs/
│   ├── discord_setup.md      ← Discord設定手順
│   └── troubleshooting.md    ← 初期セットアップのトラブル記録
└── meta/
    └── environment.txt       ← ハードウェア・OS情報
```

---

## 16. 更新ポリシー

以下の変更があった場合に更新:
- docker-compose.yml変更
- openclaw.json変更（構造的な変更）
- Discord設定変更
- OpenClawバージョンアップ
- トラブルシュート対応

# END

---

## 17. GitHub Workspace 連携（2026-03-20追加）

フクロウ（VPS）とよつば（Surface Go）はGitHubリポジトリでワークスペースを共有している。

| 項目 | 内容 |
|------|------|
| リポジトリ | github.com/fukukei23/openclaw-workspace |
| よつばのパス | ~/.openclaw/workspace/ |
| 認証 | GITHUB_TOKEN（~/nemoclaw-dev/.env） |

詳細: docs/github_workspace.md 参照

最新の内容を取得:
```bash
cd ~/.openclaw/workspace && git pull origin master
```

---

## 18. よつばワークスペース（yotsuba/ディレクトリ）（2026-03-20追加）

フクロウのワークスペース（fukukei23/openclaw-workspace）内に `yotsuba/` ディレクトリを作成。
よつば専用のエージェント設定・記憶ファイルを管理する。

```
~/.openclaw/workspace/yotsuba/
├── AGENTS.md    ← よつばのエージェント設定
├── MEMORY.md   ← よつばの記憶・プロフィール
├── SOUL.md     ← よつばのキャラクター
├── IDENTITY.md ← よつばのアイデンティティ（埋め済み）
├── USER.md     ← ふくけいのユーザー情報（埋め済み）
├── TOOLS.md    ← 環境固有ツールメモ
└── HEARTBEAT.md ← 定期タスク（現在空）
```

openclaw.jsonのワークスペースパス設定:
```json
"agents": {
  "defaults": {
    "workspace": "~/.openclaw/workspace/yotsuba"
  }
}
```

**重要**: フクロウの親ディレクトリは参照のみ、書き込みしない。

---

## 19. VNC画面共有（2026-03-20追加）

Wi-Fi不安定時の保険としてVNCを設定済み。

| 項目 | 内容 |
|------|------|
| ソフト | x11vnc + Xvfb |
| ポート | 5900 |
| 接続先 | 192.168.1.7:5900（LAN内のみ） |
| クライアント | RealVNC Viewer推奨 |

起動コマンド（再起動後に必要）:
```bash
Xvfb :1 -screen 0 1280x800x24 &
sleep 2
DISPLAY=:1 x11vnc -display :1 -rfbauth /home/user/.vnc/passwd -rfbport 5900 -forever -bg -o /tmp/x11vnc.log
```

**未完了**: 起動時自動起動の設定がまだ。再起動後は手動で上記コマンドを実行が必要。

---

## 20. 未完了作業リスト（2026-03-21時点）

| 作業 | 状況 | 優先度 |
|------|------|--------|
| 公式イメージ（ghcr.io/openclaw/openclaw:latest）への移行 | 未実施 | 高（uid権限問題の根本解決） |
| ~~tailscale導入~~ | ✅ 完了（2026-03-21） | - |
| VNC自動起動設定 | 未実施 | 中 |
| Wi-Fiチップ（ath10k）不安定問題 | 根本未解決 | 中 |
| @よつばメンション不安定（Bot identity取得失敗） | mentionPatternsで回避済み | 低 |
| フクロウ側channelsセクション未設定 | 未実施 | 低 |

### 公式イメージ移行の詳細

現在NemoClawのDockerfileベース（sandbox uid=999）を使用しているが、
公式イメージ（node uid=1000）に移行することでuid権限問題が根本解決する。

移行時に追加するパッケージ（OPENCLAW_DOCKER_APT_PACKAGES）:
```
chromium ffmpeg git curl jq python3 python3-pip yt-dlp pandoc imagemagick ghostscript poppler-utils ripgrep unzip wget sqlite3 build-essential openssh-client rsync zip file tree htop net-tools dnsutils iproute2 locales tzdata ca-certificates lsof strace ncdu mediainfo exiftool parallel vim less man-db socat tcpdump nmap postgresql-client redis-tools apache2-utils bat mysql-client mongodb-clients kafkacat httpie
```

移行手順:
1. OpenClawリポジトリをclone: `git clone https://github.com/openclaw/openclaw.git ~/openclaw-official`
2. 既存コンテナを停止: `cd ~/nemoclaw-dev && docker compose down`
3. 既存設定をバックアップ: `cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup`
4. 公式docker-setup.shを実行:
   ```bash
   cd ~/openclaw-official
   export OPENCLAW_IMAGE="ghcr.io/openclaw/openclaw:latest"
   export OPENCLAW_CONFIG_DIR=~/.openclaw
   export OPENCLAW_WORKSPACE_DIR=~/.openclaw/workspace
   export OPENCLAW_DOCKER_APT_PACKAGES="chromium ffmpeg git curl jq python3 python3-pip yt-dlp pandoc imagemagick ghostscript poppler-utils ripgrep unzip wget sqlite3 build-essential openssh-client rsync zip file tree htop net-tools dnsutils iproute2 locales tzdata ca-certificates lsof strace ncdu mediainfo exiftool parallel vim less man-db socat tcpdump nmap postgresql-client redis-tools apache2-utils bat mysql-client mongodb-clients kafkacat httpie"
   ./docker-setup.sh
   ```
5. 既存openclaw.jsonを復元してdocker compose restart
6. 権限確認: `sudo chown -R 1000:1000 ~/.openclaw/`

---

## 21. Tailscale設定（2026-03-21完了）

### 概要
外出先からよつばへSSH/VNC接続するためのVPNメッシュネットワーク。

### ネットワーク情報
| ノード名 | OS | Tailscale IP | ホスト名 |
|---|---|---|---|
| claw-node（よつば） | Linux | `100.78.104.58` | claw-node.tail01e5db.ts.net |
| TABLET-LIQK885H（Windows） | Windows | `100.123.21.28` | tablet-liqk885h.tail01e5db.ts.net |

- アカウント: fukukei4416@gmail.com
- Tailnetドメイン: tail01e5db.ts.net
- キー有効期限: 2026-09-16（期限後は再認証が必要）
- リレー: tok（東京）

### 動作確認済み（2026-03-21）
- Wi-Fi内からSSH：直接通信（direct 192.168.1.10:41641）
- テザリング（モバイル回線）からSSH：リレー経由で接続成功
- 接続コマンド: `ssh user@100.78.104.58`

### 状態確認コマンド（よつばSSH接続後）
```bash
tailscale status
tailscale ip -4
```

### 注意事項
- Wi-Fiチップ（ath10k）のセンサーが75℃を報告するが、CPU実温度は34-35℃で正常
- ath10k AERエラーによるSSH切断は有線LANアダプター（USB-C to LAN）で根本解決予定
