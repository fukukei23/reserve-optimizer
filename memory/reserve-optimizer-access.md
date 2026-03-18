# reserve-optimizer リポジトリアクセス手順

## なぜ最初は見えなかったか

1. リポジトリが Private（非公開）設定
2. web_fetch は認証なしなのでアクセス不可
3. 当時 SSH 鍵（github-reserve）が未設定

## 解决方法

### 1. Deploy Key の追加（GitHub 側）

対象リポジトリ: https://github.com/fukukei23/reserve-optimizer

1. Repository Settings → Deploy keys → Add deploy key
2. Title: `openclaw-container`
3. Key: コンテナの公開鍵（後述）
4. Write access が必要ならチェック

**コンテナの公開鍵**:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEwKgT8/7WN6A/G7kdJHveKXpTkdQUfoNibwb/XEu6YE openclaw-container
```

### 2. SSH config の設定（コンテナ側）

~/.ssh/config に以下を追加:

```
Host github-reserve
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_reserve
```

### 3. クローン

```bash
git clone git@github-reserve:fukukei23/reserve-optimizer.git /home/node/.openclaw/workspace/reserve-optimizer
```

## 其他 Private リポジトリにアクセスする場合

1. 同様に Deploy Key を追加
2. ~/.ssh/config に新しい Host を追加（例: `github-<リポジトリ名>`）
3. クローン時にその Host を使用

---
作成日: 2026-03-17
