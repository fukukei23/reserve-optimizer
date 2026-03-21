# トラブルシュート記録 — よつば初期セットアップ（2026-03-20）

OpenClaw を Surface Go（Ubuntu 24.04 LTS）に新規セットアップした際に
発生した問題と解決策をまとめる。

---

## 1. cannot execute binary file

### 症状
```
/usr/local/bin/node: /usr/local/bin/node: cannot execute binary file
```

### 原因
`docker-compose.yml` の `command` に `node` を含めていたが、
Dockerfile の `ENTRYPOINT` が `/bin/bash` であるため、
bash が node コマンドを実行しようとして失敗した。

### 解決策
`entrypoint` を明示的に `/usr/local/bin/node` に設定し、
`command` にはスクリプトパスのみを渡す。

```yaml
entrypoint: ["/usr/local/bin/node"]
command: ["/usr/local/lib/node_modules/openclaw/dist/index.js", "gateway", "--bind", "lan", "--port", "18789"]
```

---

## 2. agents.defaults.model: Invalid input

### 症状
```
Config invalid: agents.defaults.model: Invalid input
```

### 原因
フォールバックモデルのキー名を `fallback`（単数形）で設定していた。

### 解決策
`fallbacks`（複数形・配列）が正しい形式。

```json
"model": {
  "primary": "zai/glm-5",
  "fallbacks": ["minimax/MiniMax-M2.7"]
}
```

---

## 3. Gateway start blocked: gateway.mode=local

### 症状
```
Gateway start blocked: set gateway.mode=local (current: unset)
```

### 原因
`gateway.mode` が未設定。バージョン2026以降で必須になった。

### 解決策
openclaw.jsonの `gateway` セクションに追加:
```json
"gateway": {
  "mode": "local"
}
```

---

## 4. EACCES: permission denied（openclaw.json書き込み失敗）

### 症状
```
EACCES: permission denied, open '/sandbox/.openclaw/openclaw.json.tmp'
```

### 原因
コンテナ内ユーザーは `uid=999(sandbox)`、ホスト側は `uid=1000(user)`。
UIDが異なるため、コンテナがホスト側の `~/.openclaw/` に書き込めない。

### 解決策
```bash
sudo chown -R 999:999 ~/.openclaw/
sudo chmod -R 775 ~/.openclaw/
sudo usermod -aG systemd-journal user
# ログアウト→再ログイン
```

注意: コンテナが設定を自動書き換えするたびにuid=999に戻る。
`usermod -aG systemd-journal` でグループに参加することで
ホスト側userもディレクトリに書き込めるようになる。

---

## 5. channels.discord: Unrecognized key: "botToken"

### 症状
```
Config invalid: channels.discord: Unrecognized key: "botToken"
```

### 原因
Discordトークンのキー名を `botToken` と設定したが誤り。

### 解決策
正しいキー名は `token`。さらにSecretRef形式で指定する:

```json
"token": {
  "source": "env",
  "provider": "default",
  "id": "DISCORD_BOT_TOKEN"
}
```

直書きも可能:
```json
"token": "実際のトークン文字列"
```

---

## 6. guildチャンネルでメッセージを受信しない

### 症状
Discordにログインしているのにチャンネルメッセージを無視する。

### 原因（複数が重なっていた）
1. `channels.discord.guilds` の設定がなかった
2. `guilds` 内に `channels` セクションがなかった（チャンネルを明示的に許可していなかった）
3. `groupPolicy: "allowlist"` に対してguildが登録されていなかった

### 解決策
以下を全て設定する:
```json
"groupPolicy": "allowlist",
"guilds": {
  "<GUILD_ID>": {
    "requireMention": false,
    "users": ["<USER_ID>"],
    "channels": {
      "<CHANNEL_ID>": {
        "allow": true
      }
    }
  }
}
```

---

## 7. SSHが時間経過で切断される

### 症状
一定時間後に `client_loop: send disconnect: Connection reset`

### 解決策
Windows側の `C:\Users\USER\.ssh\config` に追記:
```
Host claw-node
  HostName 192.168.1.7
  User user
  ServerAliveInterval 60
  ServerAliveCountMax 10
  TCPKeepAlive yes
```

---

## 8. Surface Goがスリープして接続できなくなる

### 解決策
```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

---

## 設定変更時の注意事項

1. openclaw.jsonを編集したら必ず構文チェック:
   ```bash
   python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null && echo OK || echo ERROR
   ```

2. OpenClawはファイル変更を検知して自動リロードする（ホットリロード対応）
   ただし一部の設定変更はrestartが必要

3. 設定変更後にコンテナが自動でopenclaw.jsonを書き換えることがある
   その場合ファイルの所有者がuid=999に変わり、ホスト側から編集できなくなる
   → `sudo chown user:user ~/.openclaw/openclaw.json` で戻す

---

## 公式ドキュメント参照先

| 内容 | URL |
|------|-----|
| Discord設定 | https://docs.openclaw.ai/channels/discord |
| 設定リファレンス | https://docs.openclaw.ai/gateway/configuration-reference |
| Gateway設定 | https://docs.openclaw.ai/gateway/configuration |
| Docker運用 | https://docs.openclaw.ai/install/docker |
| トラブルシュート | https://docs.openclaw.ai/gateway/troubleshooting |

---

## 9. failed to fetch bot identity（@メンション検知失敗）

### 症状
`@よつば` メンションをしてもよつばが反応しない。
ログに以下が出ている場合がある:
```
failed to fetch bot identity: Error: upstream connect error or disconnect/reset before headers. reset reason: connection timeout
```

### 原因
OpenClawがBot自身のIDをDiscord APIから取得できていないため、
`@よつば` が自分へのメンションと認識できない。
Surface GoからDiscord APIへの接続が一時的にタイムアウトする場合に発生。

### 回避策
`mentionPatterns` を使ってテキストマッチで代替する:
```json
"agents": {
  "list": [
    {
      "id": "main",
      "groupChat": {
        "mentionPatterns": ["よつば", "@よつば"]
      }
    }
  ]
}
```
この設定後、「よつば ○○」というメッセージでよつばが反応するようになる。

### 根本解決
ネットワーク安定化（Wi-Fiの品質改善、有線接続など）が必要。
設定レベルでの完全解決は確認できていない。

---

## 10. health-monitor: restarting (reason: disconnected)

### 症状
ログに以下が定期的に出る:
```
[health-monitor] [discord:default] health-monitor: restarting (reason: disconnected)
```

### 原因
Discord接続が切断されてヘルスモニターが自動再起動している。
Surface GoのWi-Fi接続が不安定な場合に頻発する。

### 対処
動作自体には影響しない（自動再接続される）。
頻発する場合はWi-Fi環境の改善を検討する。
