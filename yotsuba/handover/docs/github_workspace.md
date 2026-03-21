# GitHub Workspace 連携設定 — よつば（Surface Go）

作成日: 2026-03-20

---

## 概要

フクロウ（VPS）とよつば（Surface Go）はファイルシステムを共有できないため、
GitHubリポジトリを介してワークスペースを共有している。

---

## リポジトリ情報

| 項目 | 内容 |
|------|------|
| リポジトリ | github.com/fukukei23/openclaw-workspace |
| 可視性 | プライベート |
| ブランチ | master |
| 管理者 | フクロウ（VPS側が自動push） |

---

## 各環境のワークスペースパス

| 環境 | パス | git remote |
|------|------|-----------|
| VPS（フクロウ） | /home/op/openclaw-stack/openclaw_workspace/ | git@github-workspace:fukukei23/openclaw-workspace.git（SSH） |
| Surface Go（よつば） | /home/user/.openclaw/workspace/ | https://github.com/fukukei23/openclaw-workspace.git（HTTPS） |

---

## よつば側のgit設定

```bash
cd ~/.openclaw/workspace
git remote -v
# origin  https://fukukei23:<TOKEN>@github.com/fukukei23/openclaw-workspace.git
```

トークンは `~/nemoclaw-dev/.env` の `GITHUB_TOKEN` を使用。

---

## よつば側の初期セットアップ手順（復元時）

```bash
# 1. .envにGITHUB_TOKENを追加（VPS側から取得）
echo "GITHUB_TOKEN=<トークン値>" >> ~/nemoclaw-dev/.env

# 2. workspaceにリモートを設定してfetch
cd ~/.openclaw/workspace
git init
git remote add origin https://fukukei23:$(grep '^GITHUB_TOKEN=' ~/nemoclaw-dev/.env | cut -d= -f2)@github.com/fukukei23/openclaw-workspace.git
git fetch origin
git reset --hard origin/master

# 3. 確認
ls
```

---

## ワークスペースの主要ファイル

フクロウが管理・更新するファイル（よつばは読み取りのみ推奨）：

| ファイル | 内容 |
|---------|------|
| AGENTS.md | エージェントの役割・ルール定義 |
| MEMORY.md | 長期記憶・重要な文脈 |
| SOUL.md | エージェントの性格・スタイル |
| USER.md | ユーザー（fukukei）の情報 |
| TOOLS.md | 使用可能なツール一覧 |
| HEARTBEAT.md | ハートビート設定 |
| IDENTITY.md | エージェントのアイデンティティ |
| memory/ | 日付別の記憶ファイル |

---

## 同期方法

### よつばが最新の内容を取得する場合

```bash
cd ~/.openclaw/workspace
git pull origin master
```

またはDiscordでよつばに指示：
```
よつば　workspaceを最新に更新して
```

### フクロウ側の自動push
フクロウ（VPS）は30分毎にワークスペースの変更を自動でGitHubにpushする設定になっている。

---

## 注意事項

- よつばがworkspaceファイルを書き換えた場合、フクロウのpushと競合する可能性がある
- 基本的にはフクロウが書き込み権限を持ち、よつばは読み取りのみとする運用が安全
- よつばがファイルを更新した場合は手動でpushが必要:
  ```bash
  cd ~/.openclaw/workspace
  git add -A && git commit -m "よつば: 更新内容" && git push origin master
  ```
