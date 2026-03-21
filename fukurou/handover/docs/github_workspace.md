# GitHub Workspace 連携設定 — フクロウ（VPS）

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

## VPS側のワークスペースパス

```
/home/op/openclaw-stack/openclaw_workspace/
```

git remote:
```
git@github-workspace:fukukei23/openclaw-workspace.git（SSH）
```

SSH設定は `/home/op/.ssh/config` の `github-workspace` ホストエイリアスを使用。

---

## ワークスペースの主要ファイル

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

## 自動push設定

フクロウは30分毎にワークスペースの変更をGitHubに自動pushする。
cronジョブで管理されている。

---

## よつば（Surface Go）との共有

よつばは同じリポジトリをHTTPS経由でcloneして読み取る。
よつば側の詳細は `Yotsuba-Handover/docs/github_workspace.md` を参照。

---

## 注意事項

- フクロウが書き込み権限を持ち、よつばは読み取り推奨
- よつばがファイルを更新した場合は競合に注意
- GITHUB_TOKENとGITHUB_TOKEN_READは `/home/op/openclaw-stack/.env` で管理
