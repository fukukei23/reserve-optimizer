# LLM引き継ぎ資料 — OpenClaw環境 完全版

**作成日**: 2026-03-22（openclaw-workspace の各資料を統合）
**最終更新**: 2026-03-23（tmux自動起動設定・SSH鍵設定・よつばMiniMax baseUrl修正・Remote Control設定完了）
**対象**: LLM・ユーザー両方が記憶リセットされた状態でも引き継げる完全な状態記録

---

## 1. 環境の全体像

### システム構成図

```
[ふくけい（fukukei）]
      │
      ├── Discord（fopenclaw サーバー）
      │         │
      │         ├── フクロウ（VPS: 162.43.17.111）   ← 本番・常時稼働
      │         └── よつば（Surface Go: 192.168.1.7） ← ローカル開発・実験
      │
      └── ターミナル（VSCode / WSL2 on krokod）
                └── Claude Code CLI（クロコド上で動作）
```

### 登場人物・システムの役割

| 名前 | 種別 | 役割 | アクセス |
|------|------|------|---------|
| **ふくけい（fukukei）** | ユーザー | オーナー。Discord / ターミナルから各エージェントに指示 | Discord / SSH / krokod |
| **クロコド（krokod）** | PC（WSL2） | ふくけいのメイン開発マシン。Claude Code常駐 | ローカル |
| **フクロウ（fukurou）** | VPS | OpenClaw本番環境。fopenclaw.comドメイン。常時稼働 | ssh openclaw-vps |
| **よつば（yotsuba）** | Surface Go | OpenClawローカル実験環境。自走ビジネス実験機 | ssh claw-node / Tailscale |

### 共有ワークスペース

- リポジトリ: `github.com/fukukei23/openclaw-workspace`（プライベート）
- フクロウ・よつば両機がwrite権限あり（2026-03-21確認済み）

---

## 2. クロコド（krokod）セットアップ済み内容

### 2-1. OS・基本環境

| 項目 | 内容 |
|------|------|
| OS | Windows 11 + WSL2 Ubuntu |
| シェル | bash（WSL2） |
| エディタ | VSCode |
| tmux セッション名 | `krokod`（`tmux attach -t krokod` で接続） |

### 2-2. Claude Code

| 項目 | 内容 |
|------|------|
| バージョン | 2.1.81 |
| メインモデル | claude-sonnet-4-6 |
| 設定ファイル | `~/.claude/settings.json` |
| プロジェクト設定 | `/mnt/c/Users/USER/.claude/CLAUDE.md` |

**有効プラグイン**: `discord@claude-plugins-official`

**MCPサーバー**: brave-search / plugin:discord / plugin:context7 / plugin:playwright

**起動時リソース**: 19 plugins / 14 skills / 24 agents / 18 hooks / 6 plugin MCP servers / 3 plugin LSP servers

**/config設定（2026-03-23 確認済み）**

| 設定項目 | 値 | 備考 |
|---------|-----|------|
| Language | 日本語 | Claude Codeの応答言語 |
| Enable Remote Control for all sessions | true | 起動時から自動でRemote Control有効 |
| Theme | Dark mode | |
| Auto-update channel | latest | 常に最新版に自動更新 |
| Default permission mode | Default | コマンド実行前に都度確認 |

**Remote Control（2026-03-23 設定完了）**

- 起動方法: セッション中に `/rc` または自動起動（全セッション有効化済み）
- スマホ接続: Claudeアプリ → Codeタブ → セッション選択
- 用途: 確認ダイアログのスマホからの承認・セッション監視
- 注意: リサーチプレビューのため不安定な場合あり。Discordと併用する

### 2-3. Discord チャンネル設定（Claude Code側）

設定ファイル: `~/.claude/channels/discord/access.json`

```json
{
  "dmPolicy": "allowlist",
  "allowFrom": ["1135078010899398727"],
  "groups": {
    "1479832235044769872": { "requireMention": true, "allowFrom": [] },
    "1479832235610734664": { "requireMention": true, "allowFrom": [] }
  },
  "pending": {}
}
```

### 2-4. GitHub 設定

| 項目 | 内容 |
|------|------|
| GitHubユーザー名 | `fukukei23` |
| メール | `fukukei4416@gmail.com` |
| トークン環境変数 | `GITHUB_TOKEN`（`~/.bashrc`に設定済み） |
| credential helper | `GITHUB_TOKEN` 環境変数を自動使用 |

### 2-5. 重要なファイルパス（クロコド）

| ファイル | 用途 |
|---------|------|
| `~/.claude/settings.json` | Claude Code 設定 |
| `~/.claude/channels/discord/access.json` | Discord アクセス制御 |
| `~/.bashrc` | 環境変数（GITHUB_TOKEN, MINIMAX_API_KEY） |
| `~/.ssh/config` | SSH接続設定（openclaw-vps / claw-node / claw-node-tailscale） |
| `~/.ssh/id_ed25519` | SSH秘密鍵（フクロウ・よつば両機に登録済み） |
| `~/Documents/krokod-setup/` | セットアップ資料（Linux側） |
| `/mnt/c/Users/USER/Documents/krokod-setup/` | セットアップ資料（Windows側） |

---

## 3. フクロウ（VPS）の詳細設定

### 3-1. 基本情報

| 項目 | 内容 |
|------|------|
| IP | 162.43.17.111 |
| ユーザー | op |
| SSH設定名 | `openclaw-vps` |
| 作業ディレクトリ | `/home/op/openclaw-stack/` |
| 公開URL | https://fopenclaw.com |
| Bot名 | フクロウ |

### 3-2. Docker構成

```
Internet → Caddy（172.30.0.10, TLS終端） → openclaw-gateway（172.30.0.20:18789）
```

| 項目 | 内容 |
|------|------|
| コンテナ数 | 2（caddy + openclaw-gateway） |
| **caddyコンテナ名** | `openclaw-stack-caddy-1` |
| **gatewayコンテナ名** | `openclaw-stack-openclaw-gateway-1` |
| イメージ | openclaw-custom:2026.3.12（カスタムDockerfile必須） |
| **Dockerfile変更禁止** | `/usr/bin/chromium`設定保持のため公式版に切り替えない |
| ネットワーク | openclaw-net / subnet: 172.30.0.0/24 |
| 外部公開ポート | 22, 80, 443（18789はインターネット非公開） |

⚠️ **`docker exec openclaw-gateway` は失敗する**。正しいコンテナ名は `openclaw-stack-openclaw-gateway-1`。

### 3-3. LLM設定（フクロウ openclaw.json）※2026-03-22 実ファイル確認済み

| プロバイダー | エンドポイント | モデル | 用途 |
|------------|--------------|--------|------|
| minimax | `https://api.minimax.io/anthropic` | MiniMax-M2.7 | プライマリ |
| zai（GLM） | `https://api.z.ai/api/coding/paas/v4` | glm-5 / glm-4.7 | フォールバック1 |
| openai | `https://api.openai.com/v1` | gpt-5-mini / gpt-5.1-codex | フォールバック2・3 |

**フォールバック順序**: `minimax/MiniMax-M2.7` → `zai/glm-5` → `openai/gpt-5-mini` → `openai/gpt-5.1-codex`

**MiniMax APIタイプ**: `anthropic-messages`（`https://api.minimax.io/anthropic` = anthropic互換エンドポイント）

**モデルエイリアス**: 賢者（glm-5）/ 忍者（glm-4.7）/ 見習い（gpt-5-mini）/ 錬金術師（gpt-5.1-codex）/ 匠人（minimax/m2.1）/ 僧侶（minimax/m2.5）

### 3-4. 権威ファイル（フクロウ）

| ファイル | VPS上のパス |
|---------|------------|
| docker-compose.yml | `/home/op/openclaw-stack/docker-compose.yml` |
| Caddyfile | `/home/op/openclaw-stack/caddy/Caddyfile` |
| openclaw.json | `/home/op/openclaw-stack/openclaw_config/openclaw.json` |
| .env（唯一の権威ソース） | `/home/op/openclaw-stack/.env` |
| cron/jobs.json | `/home/op/openclaw-stack/openclaw_config/cron/jobs.json` |

### 3-5. Discord設定（フクロウ openclaw.json）

```json
"guilds": {
  "1479832235044769872": {
    "requireMention": false,
    "users": ["1135078010899398727"]
  }
}
```

### 3-6. Gateway設定（フクロウ）

```json
"gateway": {
  "mode": "local",
  "auth": { "mode": "token" },
  "controlUi": { "allowedOrigins": ["https://fopenclaw.com"] },
  "trustedProxies": ["172.30.0.10"]
}
```

⚠️ **`gateway.mode` を `"local"` から `"remote"` に変更禁止**（即座にクラッシュループ→502）

### 3-7. .env管理ルール（フクロウ）

- APIキーの追加・変更は必ず `/home/op/openclaw-stack/.env` のみで行う
- `openclaw_config/.env` は使用しない
- `.env`変更後は `docker compose down && docker compose up -d`（restart では反映されない）
- 主要キー: `GLM_API_KEY`, `MINIMAX_API_KEY`, `DISCORD_BOT_TOKEN`, `GITHUB_TOKEN`, `GITHUB_TOKEN_READ`, `OPENAI_API_KEY`

---

## 4. よつば（Surface Go）の詳細設定

### 4-1. 基本情報

| 項目 | 内容 |
|------|------|
| 機体 | Surface Go 第1世代 / Pentium 4415Y / RAM 8GB / Swap 4GB |
| OS | Ubuntu 24.04.4 LTS（CUI環境） |
| ホスト名 | claw-node |
| ユーザー | user |
| LAN IP | 192.168.1.7（Wi-Fi / wlp1s0） |
| Tailscale IP | **100.78.104.58**（固定） |
| SSH設定名 | `claw-node` |
| 作業ディレクトリ | `~/nemoclaw-dev/` |
| Bot名 | よつば |

### 4-2. Docker構成（2026-03-21 公式イメージ移行済み）

| 項目 | 内容 |
|------|------|
| コンテナ数 | 1（openclaw-gatewayのみ） |
| イメージ | openclaw-surface:local（ghcr.io/openclaw/openclaw:latest ベース） |
| uid | 1000（node）← uid権限問題解決済み |
| バインド | 127.0.0.1:18789（外部非公開） |
| Caddyなし | ローカルネットワーク内のみアクセス可能 |

### 4-3. LLM設定（よつば openclaw.json）

| プロバイダー | エンドポイント | モデル | 用途 |
|------------|--------------|--------|------|
| zai（GLM） | `https://api.z.ai/api/coding/paas/v4` | glm-5 / glm-4.7 | プライマリ |
| minimax | `https://api.minimax.io/anthropic` | MiniMax-M2.7 | フォールバック |

**フォールバック順序**: `zai/glm-5` → `minimax/MiniMax-M2.7`

**MiniMax APIタイプ**: `anthropic-messages`（フクロウと同一。2026-03-23修正済み）

### 4-4. 権威ファイル（よつば）

| ファイル | パス |
|---------|------|
| openclaw.json | `~/.openclaw/openclaw.json` |
| .env | `~/nemoclaw-dev/.env` |
| docker-compose.yml | `~/nemoclaw-dev/docker-compose.yml` |
| Dockerfile | `~/nemoclaw-dev/Dockerfile` |

### 4-5. openclaw.json 重要設定（よつば）

```json
"agents": {
  "defaults": {
    "workspace": "/home/node/.openclaw/workspace/yotsuba",
    "sandbox": { "mode": "off" }
  }
}
```

- **workspace は絶対パス指定必須**（チルダ使用不可）
- **sandbox=off**: docker.sockが未マウントのため sandbox機能が動作しない

### 4-6. Discord設定（よつば）

| 項目 | 内容 |
|------|------|
| Guild ID | `1479832235044769872` |
| チャンネルID（#一般） | `1479832235610734664` |
| ユーザーID（fukukei） | `1135078010899398727` |
| mentionPatterns | `["よつば", "@よつば"]` |

### 4-7. ワークスペース（よつば）

```
~/.openclaw/workspace/yotsuba/
├── AGENTS.md    ← エージェント設定
├── MEMORY.md   ← 記憶・プロフィール
├── SOUL.md     ← キャラクター
├── IDENTITY.md ← アイデンティティ
├── USER.md     ← ふくけい情報
├── TOOLS.md    ← 環境固有ツールメモ
└── HEARTBEAT.md ← 定期タスク
```

最新化コマンド: `cd ~/.openclaw/workspace && git pull origin master`

### 4-8. Tailscale設定

| ノード | OS | Tailscale IP | ホスト名 |
|--------|-----|-------------|---------|
| claw-node（よつば） | Linux | `100.78.104.58` | claw-node.tail01e5db.ts.net |
| TABLET-LIQK885H（Windows） | Windows | `100.123.21.28` | tablet-liqk885h.tail01e5db.ts.net |

- アカウント: fukukei4416@gmail.com
- キー有効期限: **2026-09-16**（期限後は再認証が必要）
- 外出先からの接続: `ssh user@100.78.104.58`

### 4-9. VNC設定

| 項目 | 内容 |
|------|------|
| ポート | 5900 |
| 接続先 | 192.168.1.7:5900（LAN内のみ） |
| クライアント | RealVNC Viewer |
| 自動起動 | **未設定**（再起動後は手動実行が必要） |

再起動後の起動コマンド:
```bash
Xvfb :1 -screen 0 1280x800x24 &
sleep 2
DISPLAY=:1 x11vnc -display :1 -rfbauth /home/user/.vnc/passwd -rfbport 5900 -forever -bg -o /tmp/x11vnc.log
```

---

## 5. Discord ID 対応表（全体）

| ID | 種別 | 用途 |
|----|------|------|
| `1479832235044769872` | **Guild ID** | fopenclaw サーバーID（＝よつばのGuild ID） |
| `1479832235610734664` | チャンネルID | #一般チャンネル |
| `1135078010899398727` | ユーザーID | ふくけい |
| `1485180498832658485` | ロールID | @ロールメンションで使用 |
| `1480704704349606021` | チャンネルID | フクロウ技術通知チャンネル |
| `1482053801623163011` | チャンネルID | フクロウタスクチャンネル |

---

## 6. 未解決の注意点・既知の問題

### 🔴 クリティカル

| 問題 | 状況 | 対処 |
|------|------|------|
| ~~**CVE-2026-25253（OpenClaw RCE）**~~ | **✅ 2026-03-22 対応済み**。バージョン2026.3.12（修正版2026.1.29より新しい）。allowedOrigins設定も確認済み（`https://fopenclaw.com` のみ） | 対応不要 |
| ~~**MiniMax baseUrl不一致（フクロウ・よつば）**~~ | **✅ 2026-03-23 解決済み**。フクロウ・よつば両機とも `https://api.minimax.io/anthropic`（anthropic互換）に統一 | 対応不要 |
| **workspaceパス問題（よつば）** | sessions.jsonに旧パスキャッシュが残ると `/sandbox` への権限エラーが発生 | `sessions.json`を削除して `docker compose down && up` |

### 🟡 中程度

| 問題 | 状況 | 対処 |
|------|------|------|
| ~~**よつばMiniMax baseUrl要確認**~~ | **✅ 2026-03-23 修正済み**。`/v1` → `/anthropic` に変更。フクロウと統一（同一APIキー使用のため） | 対応不要 |
| **VNC自動起動未設定（よつば）** | 再起動後に手動でVNC起動が必要 | systemdサービス化が未完了 |
| **Wi-Fiチップ不安定（よつば）** | ath10k_pci AERエラーによるSSH切断が発生 | 有線LANアダプター（USB-C to LAN）で根本解決 |
| **cronジョブ重複リスク** | 過去にLong Task Watcherが22件重複→約5USD消費 | 登録前に必ず同名ジョブの存在確認 |
| **GLM エラーコード1113** | Coding PlanエンドポイントのURL違いで「残高不足」エラー | `baseUrl: https://api.z.ai/api/coding/paas/v4` を厳守 |

### 🟢 低優先度

| 問題 | 状況 |
|------|------|
| @よつばメンション不安定 | mentionPatterns `["よつば", "@よつば"]` で運用回避済み |
| フクロウ側channelsセクション未設定 | openclaw.jsonに channels.discord がなく guilds設定のみ |
| Tailscaleキー期限 | 2026-09-16に再認証が必要 |

---

## 7. よく使うコマンド

### クロコド（Claude Code）

```bash
claude                                   # Claude Code 起動
/reload-plugins                          # プラグインリロード
/discord:access                          # Discord設定確認
/discord:access group add <channelId>    # チャンネル追加
tmux attach -t krokod                    # tmuxセッション接続
tmux new -s krokod                       # tmuxセッション新規作成
source ~/.bashrc                         # 環境変数再読み込み
```

### フクロウ（VPS: ssh openclaw-vps）

```bash
cd /home/op/openclaw-stack

# 状態確認
docker compose ps
curl -I https://fopenclaw.com

# ログ確認
docker compose logs -f --tail 50 openclaw-gateway
docker compose logs -f --tail 50 caddy

# コンテナ操作（正しいコンテナ名を使うこと）
docker exec openclaw-stack-openclaw-gateway-1 <command>

# 再起動（.env変更なし）
docker compose restart openclaw-gateway

# 再起動（.env変更あり）
docker compose down && docker compose up -d

# openclaw.json構文チェック
python3 -m json.tool /home/op/openclaw-stack/openclaw_config/openclaw.json > /dev/null && echo "OK" || echo "ERROR"

# フォールバック確認
cat /tmp/openclaw/openclaw-$(date +%F).log | grep -E "fallback|model=" | tail -20

# GitHub push（DNS問題時）
git push https://fukukei23:$(grep '^GITHUB_TOKEN=' /home/op/openclaw-stack/.env | cut -d= -f2)@github.com/fukukei23/openclaw-workspace.git master
```

### よつば（Surface Go: ssh claw-node または ssh user@100.78.104.58）

```bash
cd ~/nemoclaw-dev

# 状態確認
docker compose ps
curl http://127.0.0.1:18789

# ログ確認
docker compose logs -f --tail 50

# 再起動
docker compose restart openclaw-gateway

# 権限修正（EACCES発生時）
sudo chown -R 1000:1000 ~/.openclaw/

# sessions.jsonリセット（workspaceパスエラー時）
docker compose down
rm ~/.openclaw/sessions.json
docker compose up -d

# workspace最新化
cd ~/.openclaw/workspace && git pull origin master

# イメージ再ビルド
cd ~/nemoclaw-dev && docker build -t openclaw-surface:local .

# openclaw.json構文チェック
python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null && echo "OK" || echo "ERROR"

# Tailscale状態確認
tailscale status
tailscale ip -4
```

---

## 8. 残タスクと優先順位

| 優先度 | タスク | 状態 |
|--------|--------|------|
| ~~🔴 高~~ | ~~CVE-2026-25253対応~~ | **✅ 2026-03-22 対応済み（v2026.3.12）** |
| ~~🔴 高~~ | ~~MiniMax baseUrl確認（フクロウ openclaw.jsonの実際の値）~~ | **✅ 2026-03-22 確認済み（`/anthropic`が正）** |
| ~~🟡 中~~ | ~~tmuxセッション自動起動（WSL2起動時）~~ | **✅ 2026-03-23 完了（systemdユーザーサービス: tmux-krokod.service）** |
| ~~🟡 中~~ | ~~よつばMiniMax baseUrl意図確認（`/v1` vs `/anthropic`）~~ | **✅ 2026-03-23 修正済み（`/anthropic`に統一）** |
| ~~🔴 高~~ | ~~Discord 全チャンネル応答設定（チャンネルID追加）~~ | **✅ 2026-03-23 完了（メンションで呼び分け運用に決定）** |
| ~~🔴 高~~ | ~~クロコ Discord Channels設定（Botとの紐付け）~~ | **✅ 2026-03-23 動作確認済み** |
| ~~🟡 中~~ | ~~CLAUDE.md作成・配置（クロコ）~~ | **✅ 2026-03-23 完了（OpenClaw環境操作・プロアクティブ提案ルール追記）** |
| 🟡 中 | VNC自動起動 systemdサービス化（よつば） | 未着手 |
| 🟡 中 | Wi-Fiチップ不安定問題（有線LANアダプター購入） | 根本未解決 |
| 🟡 中 | sudoers設定の確認・記録（クロコド） | 未確認 |
| 🟢 低 | sandbox=on移行検討（よつば、実験進展後） | 未着手 |
| 🟢 低 | krokod-setupリポジトリへの継続更新 | 進行中 |

---

## 9. 引き継ぎ資料のGitHub URL一覧

| 資料 | URL |
|------|-----|
| **このファイル（krokod設定）** | https://github.com/fukukei23/krokod-setup/blob/main/LLM_HANDOVER_KROKOD_2026-03-22.md |
| 全体引き継ぎプロンプト | https://github.com/fukukei23/openclaw-workspace/blob/master/LLM_HANDOVER_PROMPT_2026-03-22.md |
| フクロウ引き継ぎ | https://github.com/fukukei23/openclaw-workspace/blob/master/fukurou/handover/README_HANDOVER.md |
| フクロウ runbook | https://github.com/fukukei23/openclaw-workspace/blob/master/fukurou/handover/docs/runbook.md |
| フクロウ openclaw.json | https://github.com/fukukei23/openclaw-workspace/blob/master/fukurou/handover/infra/openclaw.json |
| よつば引き継ぎ | https://github.com/fukukei23/openclaw-workspace/blob/master/yotsuba/handover/README_HANDOVER.md |
| よつば公式イメージ移行記録 | https://github.com/fukukei23/openclaw-workspace/blob/master/yotsuba/migration_summary_2026-03-21.md |
| よつば openclaw.json | https://github.com/fukukei23/openclaw-workspace/blob/master/yotsuba/handover/infra/openclaw.json |
| openclaw-workspaceリポジトリ | https://github.com/fukukei23/openclaw-workspace |
| krokod-setupリポジトリ | https://github.com/fukukei23/krokod-setup |

**Raw URL（LLM直接参照用）**:
```
https://raw.githubusercontent.com/fukukei23/openclaw-workspace/master/LLM_HANDOVER_PROMPT_2026-03-22.md
```

---

## 10. セッション引き継ぎ手順

1. `tmux attach -t krokod`（または `tmux new -s krokod`）
2. `source ~/.bashrc`（環境変数確認）
3. `cat ~/.claude/channels/discord/access.json`（Discord設定確認）
4. `claude`（Claude Code 起動）
5. `/reload-plugins`（プラグイン確認）
6. openclaw-workspaceの最新状態確認: `cd /tmp/openclaw-workspace && git pull`
7. この資料の「残タスク」から作業再開

---

## 11. 参照ドキュメント

| 内容 | URL |
|------|-----|
| OpenClaw公式 | https://docs.openclaw.ai |
| Discord設定 | https://docs.openclaw.ai/channels/discord |
| 設定リファレンス | https://docs.openclaw.ai/gateway/configuration-reference |
| Docker運用 | https://docs.openclaw.ai/install/docker |
| トラブルシュート | https://docs.openclaw.ai/gateway/troubleshooting |

---

## 12. 目標アーキテクチャ（2026-03-23 策定）

### 全体構成

```
【外出先】
スマホ（テザリング）
  │
  ├─ Discord ──────────────────────────────────────────┐
  │                                                    │（直接）
  │                                                    ▼
  │                                          fopenclaw サーバー
  │                                          │              │
  │                                          ▼              ▼
  │                                     フクロウ(VPS)   よつば(Surface Go)
  │                                     OpenClaw本番    OpenClaw実験
  │
  └─ Discord Channels ──────────────────▶ クロコ（自宅PC・常時電源ON）
                                          Claude Code + Channels + tmux
                                          │
                                          ├─ SSH ──────▶ フクロウ(VPS)
                                          ├─ SSH/Tailscale ▶ よつば
                                          └─ git push ▶ GitHub
```

### ノード役割分担

| ノード | 役割 | 常時稼働 | 特記 |
|--------|------|---------|------|
| スマホ | 唯一の操作端末。外出先からすべてに指示 | 持ち歩き | テザリング接続 |
| クロコ（自宅PC） | Claude Code常駐。ターミナル・Git・SSH代行 | 自宅電源ON | Channels経由でDiscord受信 |
| フクロウ（VPS） | OpenClaw本番。Discord Bot。AIアシスタント | VPS常時稼働 | GLM-5プライマリ |
| よつば（Surface Go） | OpenClaw実験。ローカル検証・自走実験 | Surface Go常時稼働 | Tailscale経由でリモートアクセス可 |

### 用途による使い分け

| やりたいこと | 経路 |
|------------|------|
| 日常会話・簡単な質問 | スマホ → Discord → フクロウ |
| SSH操作・Docker・設定変更 | スマホ → Discord → クロコ → SSH |
| Git push・コード編集・ビルド | スマホ → Discord → クロコ → GitHub |
| よつばの実験操作 | スマホ → Discord → クロコ → SSH/Tailscale → よつば |

### クロコ構築状態（2026-03-23 時点）

| 項目 | 状態 |
|------|------|
| Claude Code | v2.1.81 ✅ |
| Bun | v1.3.11 ✅ |
| tmux自動起動（systemd） | tmux-krokod.service ✅ |
| SSH鍵（フクロウ・よつば） | 設定済み ✅ |
| Discord Channels設定 | ✅ 動作中（メンションで呼び分け運用） |
| Discord全チャンネル同期 | ✅ access.jsonに全チャンネル追加済み（requireMention: true） |
| Remote Control | ✅ 動作確認済み・全セッション自動有効化済み |
| CLAUDE.md | ✅ 作成済み（OpenClaw環境操作・プロアクティブ提案ルール追記） |

---

## 13. 各ノードの権限情報（2026-03-23 確認）

### 権限とは何か（素人向け説明）

| 用語 | 意味 |
|------|------|
| **ユーザー** | そのマシンにログインしているアカウント名 |
| **グループ** | ユーザーが所属する権限グループ。`docker`グループに入っていればDockerが使える、など |
| **sudo** | 管理者権限でコマンドを実行する仕組み。Windowsの「管理者として実行」に相当 |
| **NOPASSWD** | パスワードなしでsudoできるコマンド。これがあると自動化が楽になる |

---

### クロコ（自宅PC / WSL2）

| 項目 | 内容 |
|------|------|
| ユーザー | `yn441611` |
| UID/GID | 1000 |
| 所属グループ | adm, cdrom, **sudo**, dip, plugdev, users, **docker** |
| sudo権限 | **(ALL:ALL) ALL** — 全コマンドにsudo可能 |
| パスワード不要のコマンド | `apt` `apt-get` `systemctl` `chown` `chmod` |

**ポイント**: 最も強い権限。Dockerも使えてsudoもフル権限。Claude Codeが自律作業しやすい環境。

---

### フクロウ（VPS: 162.43.17.111）

| 項目 | 内容 |
|------|------|
| ユーザー | `op` |
| UID/GID | 1000 |
| 所属グループ | **sudo**, users, **docker** |
| sudo権限 | sudoグループ所属だが**パスワード必須** |
| パスワード不要のコマンド | なし |

**ポイント**: Dockerは使える。sudoはパスワードが必要なため、Claude CodeがSSH経由でsudoコマンドを自動実行することはできない。`docker compose`等の操作はパスワードなしで可能。

---

### よつば（Surface Go: 192.168.1.7 / Tailscale: 100.78.104.58）

| 項目 | 内容 |
|------|------|
| ユーザー | `user` |
| UID/GID | 1000 |
| 所属グループ | adm, cdrom, **sudo**, dip, plugdev, **lxd**, **docker**, systemd-journal |
| sudo権限 | sudoグループ所属だが**パスワード必須** |
| パスワード不要のコマンド | なし |

**ポイント**: フクロウと同様、sudoにはパスワードが必要。`lxd`グループ（軽量コンテナ操作）も所属。Docker操作はパスワードなしで可能。SSH接続はTailscale（100.78.104.58）経由が安定。LAN（192.168.1.7）はWi-Fiチップ不安定のため切断されることがある。

---

### 3ノード比較まとめ

| ノード | sudo自動化 | Docker | 注意点 |
|--------|-----------|--------|--------|
| クロコ | ✅ 一部NOPASSWD | ✅ | 最も自由度が高い |
| フクロウ | ❌ パスワード必須 | ✅ | docker compose操作は問題なし |
| よつば | ❌ パスワード必須 | ✅ | SSH接続はTailscale推奨 |

---

## 14. ふくけいの運用方針・要望

### AI作業の基本方針

- **claude.aiの役割**: 設計・判断・指示書作成・ドキュメント記録
- **Claude Codeの役割**: 実作業（SSH・ファイル編集・Git・Docker操作）の自律実行
- **ふくけいの役割**: 要望を出す。判断が必要な場面だけclaude.aiに戻る

### claude.aiへの要求事項

1. **問題・リスク・改善点を発見したら、聞かれなくても即座に提案する**
2. **実作業はClaude Codeに委譲する**。コマンドを提示してコピペさせるループは不要
3. **セッション開始時に状況を把握したら、まとめて指示書を提案する**
4. 「確認できますか？」で終わらせない。発見した問題には行動を伴う提案をする
5. 数値・実例・構造化された論理で説明する。曖昧な表現を避ける
6. 励ましや感情表現は不要。事実・ロジックベースで回答する

### セッションの理想的な流れ

```
1. ふくけい → claude.ai: 「今日やりたいこと」を伝える
2. claude.ai: 優先順位整理 → 指示書作成 → ふくけいに渡す
3. ふくけい → Claude Code: 指示書をそのまま貼り付ける
4. Claude Code: 自律実行 → 結果報告
5. ふくけい → claude.ai: 結果を貼り付けて記録依頼
```

### CLAUDE.mdに書くべき内容（未作成・要対応）

```markdown
## 作業方針
- VPS・よつばへの操作はSSHで直接実行する。手順をユーザーに提示してコピペさせない
- SSH接続先:
  - VPS: ssh openclaw-vps（~/.ssh/config参照）
  - よつば: ssh claw-node または ssh user@100.78.104.58（Tailscale）
- 作業前に必ず対象ファイルをSSHで読んでから編集する
- openclaw.json編集後は必ずJSON構文チェックを実行してからrestart

## プロアクティブ提案ルール

### トリガー → 即座に取るべき行動
| 発見内容 | 取るべき行動 |
|----------|------------|
| 設定ファイルの不整合・矛盾 | 「今修正します」と提案してそのまま実行 |
| セキュリティリスク（CVE等） | 調査を後回しにせず即確認 |
| コピペ作業が発生しそう | 「Claude Codeで直接やれます」と最初に言う |
| 引き継ぎ資料に実体ファイルがない | 「今作ります」と提案 |

### やってはいけないこと
- 「確認できますか？」で終わらせる
- 問題を発見しても後回しにする
- ユーザーにコピペ作業を強いる

## 回答前チェックリスト
- [ ] この会話で未解決の問題を見落としていないか
- [ ] 「確認できますか」で終わっていないか
- [ ] ユーザーにコピペ作業を強いていないか
- [ ] 発見した問題に対して行動を提案したか
```

---

*このドキュメントは 2026-03-22 の作業終了時点の状態を記録。openclaw-workspaceの各引き継ぎ資料を統合したものです。*
*2026-03-22 更新: CVE-2026-25253対応済み確認、フクロウLLM設定を実ファイルに合わせて修正、コンテナ名を正式名称に修正、MiniMax baseUrl確認済み。*
*2026-03-23 更新: tmux自動起動（systemdユーザーサービス）設定完了、SSH鍵設定（フクロウ・よつば）完了、よつばMiniMax baseUrlを`/anthropic`に修正・統一、クロコドSSH設定ファイルパスを追記。目標アーキテクチャ・運用方針・CLAUDE.md草案を追加。Discord Channels動作確認済み・メンション呼び分け運用に決定。各ノード権限情報を追加。Remote Control動作確認・全セッション自動有効化。CLAUDE.md作成完了。/config設定（言語を日本語に変更）。Discord全チャンネルをaccess.jsonに同期済み。*

---

## 15. 2026-03-27 更新分

### クロコド追加設定

| 項目 | 内容 |
|---|---|
| Claude Code バージョン | v2.1.83（v2.1.81から更新） |
| GLM接続設定 | ANTHROPIC_BASE_URL を ~/.claude/.env に追加済み |
| MiniMaxフォールバック | claude_fallback.py の無限ループ対策済み（固定バイナリパス） |
| claude単体起動 | .bashrcエイリアスに`.`を追加済み |

### ~/.claude/.env の現在の構成

| 変数名 | 用途 |
|---|---|
| MINIMAX_API_KEY | MiniMaxフォールバック用 |
| GITHUB_TOKEN | GitHub操作用 |
| BRAVE_API_KEY | Brave Search用 |
| ANTHROPIC_AUTH_TOKEN | GLM APIキー |
| ANTHROPIC_BASE_URL | https://api.z.ai/api/anthropic |

### WSLスリープ復帰後の復旧手順

#### 症状
- エラーコード: `Wsl/Service/0x8007274c`
- Claude CodeやCursorがWSLに接続できない

#### 復旧手順
1. PowerShellで実行:
   ```powershell
   wsl --shutdown
   wsl -d Ubuntu echo "test"
   ```
2. WSL内で環境変数を再読み込み:
   ```bash
   source ~/.claude/.env
   ```
3. tmuxセッション確認:
   ```bash
   tmux ls
   ```
4. krokodセッションがなければ再作成:
   ```bash
   tmux new-session -d -s krokod
   ```
5. Claude Code起動:
   ```bash
   claude
   ```

### デバイス構成の確定情報

| デバイス | 役割 |
|---|---|
| スマホA（回線用） | テザリング提供のみ。Surface Pro 8に接続 |
| スマホB（ふくけいが持つ） | Discord経由でClaude Codeを操作 |
| クロコド（Surface Pro 8） | Claude Code常時起動。持ち運び運用 |

### クロタム（自作Discord Bot）

| 項目 | 内容 |
|---|---|
| Bot名 | クロタム（クロコド-custom） |
| 用途 | スマホのDiscordからClaude Codeをリモート操作 |
| 実装場所 | `~/discord-bot/krotam/bot.py` |
| トークン管理 | `~/.claude/krotam.env`（GitHubには上げない） |
| 常時起動 | systemdユーザーサービス: `krotam.service` |
| allowlist | 1135078010899398727（ふくけい）のみ |
| 特殊コマンド | `!status` `!restart` `!help` |
| ファイル受信先 | `~/.claude/krotam_inbox/` |

#### 起動・停止コマンド
```bash
systemctl --user start krotam.service
systemctl --user stop krotam.service
systemctl --user status krotam.service
```

#### リポジトリ内のファイル構成
```
krokod/
├── krotam/
│   ├── bot.py          # Botメイン
│   ├── krotam.service  # systemdサービス
│   └── krotam.env.example  # トークン設定サンプル
└── scripts/
    ├── claude-fallback      # フォールバックラッパー
    ├── claude_fallback.py   # フォールバック本体
    └── fallback-config.json # フォールバック設定
```

### 運用前提・確定設定（2026-03-27）

#### デバイス構成
| デバイス | 役割 |
|---|---|
| スマホA（回線用） | テザリング提供のみ。Surface Pro 8に接続。常時テザリングON |
| スマホB（ふくけいが持つ） | Discordでクロタムに指示。モバイルデータ回線で動作 |
| Surface Pro 8（クロコド） | Claude Code常時起動。スマホAのテザリングでネット接続 |

#### Windows電源設定
- 電源接続時スリープ：なし（設定済み）
- バッテリー駆動時スリープ：なし（設定済み）
- 理由：スリープするとWSLが死んでクロタムも停止するため

#### Claude Code起動方針
- 起動コマンド：`claude --dangerously-skip-permissions`
- 理由：スマホからのリモート操作時に権限確認ダイアログで止まるのを防ぐ
- セキュリティ対策：クロタムのallowlistでふくけいのDiscord IDのみ許可

#### クロタムコマンド一覧（2026-03-27全機能版）
| コマンド | 機能 |
|---|---|
| !help | 全コマンド一覧表示 |
| !status | tmux現在画面表示 |
| !screenshot | tmux直近100行表示 |
| !abort | 実行中処理を中断（Ctrl+C） |
| !restart | Claude Code再起動 |
| !ls [パス] | ディレクトリ一覧 |
| !cat <ファイル> | ファイル内容表示 |
| !send <ファイル> | ファイルをDiscordに送信（8MB以下） |
| !git | git status表示 |
| !log | 直近10件のコマンドログ |
| その他テキスト | Claude Codeに直接送信 |

#### systemdサービス依存関係
- `tmux-krokod.service` → `Requires=krotam.service`
- tmuxセッション起動時にクロタムBotも自動起動
