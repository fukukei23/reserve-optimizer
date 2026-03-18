# Private GitHub リポジトリへのアクセス手順

## 概要

OpenClaw コンテナ内から Private リポジトリ（fukukei23/*）にアクセスする方法。

## 原則

- **web_fetch (HTTP) では Private リポジトリにアクセスできない**（404 になる）
- **SSH 鍵経由で git clone/pull/push** する

---

## アクセス手順

### 1. ユーザーは Deploy Key を追加（1回だけ）

リポジトリ Settings → Deploy keys → Add deploy key

| 項目 | 値 |
|------|-----|
| Title | `openclaw-container` |
| Key | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEwKgT8/7WN6A/G7kdJHveKXpTkdQUfoNibwb/XEu6YE openclaw-container` |
| Write access | 必要ならチェック |

### 2. ユーザーは SSH config を設定（1回だけ）

~/.ssh/config に以下を追加:

```
Host github-reserve
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_reserve
```

> 既存: `github-workspace` → openclaw-workspace 用

### 3. フクロウは git clone で取得

```bash
git clone git@github-reserve:fukukei23/<リポジトリ名>.git /home/node/.openclaw/workspace/<リポジトリ名>
```

### 4. 以後の更新

```bash
cd /home/node/.openclaw/workspace/<リポジトリ名>
git pull
```

---

## 新しい Private リポジトリを追加する場合

1. ユーザーに Deploy Key を追加してもらう（上記 step 1）
2. ~/.ssh/config に新しい Host を追加（例: `github-<リポジトリ略名>`）
3. クローン

---

## 失敗したら確認すること

| 症状 | 確認 |
|------|------|
| 404 | web_fetch 使ってない？ → git clone で |
| Permission denied | Deploy Key 添加済み？ |
| No such identity | ~/.ssh/config の Host / IdentityFile 正しい？ |

---

更新日: 2026-03-17
