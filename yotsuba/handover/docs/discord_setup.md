# Discord設定手順 — よつば（Surface Go）

作成日: 2026-03-20

---

## 1. Bot作成（Discord Developer Portal）

1. https://discord.com/developers/applications を開く
2. 「New Application」→ アプリ名を入力（例: よつば）→「Create」
3. 左メニュー「Bot」→「Reset Token」→ トークンをコピーして保管
4. 同じBot画面で以下3つをONにする（Privileged Gateway Intents）
   - Message Content Intent ← 必須
   - Server Members Intent ← 必須
   - Presence Intent ← 任意

---

## 2. サーバーへの招待

1. 左メニュー「OAuth2」→「URL Generator」
2. Scopesで `bot` と `applications.commands` にチェック
3. Bot Permissionsで `管理者`（Administrator）にチェック
4. 生成されたURLをブラウザで開いてサーバーに招待

---

## 3. 必要なIDの収集

Discord設定 → 詳細設定 → 「開発者モード」をON にすると各IDをコピーできる。

| ID種別 | 取得方法 |
|--------|---------|
| サーバーID（Guild ID） | サーバーアイコンを右クリック → 「サーバーIDをコピー」 |
| チャンネルID | チャンネル名を右クリック → 「チャンネルIDをコピー」 |
| ユーザーID | 自分のアバターを右クリック → 「ユーザーIDをコピー」 |

現在の設定値（fopenclaw サーバー）:

| 項目 | ID |
|------|----|
| Guild ID | 1479832235044769872 |
| チャンネルID（#一般） | 1479832235610734664 |
| ユーザーID（fukukei） | 1135078010899398727 |

---

## 4. openclaw.json のDiscord設定

```json
"channels": {
  "discord": {
    "enabled": true,
    "token": {
      "source": "env",
      "provider": "default",
      "id": "DISCORD_BOT_TOKEN"
    },
    "dmPolicy": "open",
    "allowFrom": ["*"],
    "groupPolicy": "allowlist",
    "guilds": {
      "<GUILD_ID>": {
        "requireMention": true,
        "users": ["<YOUR_USER_ID>"],
        "channels": {
          "<CHANNEL_ID>": {
            "allow": true,
            "requireMention": true
          }
        }
      }
    }
  }
}
```

重要ポイント:
- `token` のキー名は `botToken` ではなく `token`（バージョン2026.3.11で確認）
- トークンは `gateway.auth.token` と別物。discord用は `channels.discord.token`
- トークンはopenclaw.jsonに直書きせず、SecretRef（env参照）で渡す
- `gateway.mode: "local"` が未設定だとGatewayが起動しない（必須）
- `groupPolicy: "allowlist"` と `guilds` の設定が両方必要
- チャンネルレベルで `allow: true` を設定しないとguildチャンネルでは動作しない

---

## 5. mentionPatterns の設定（重要）

`@よつば` のDiscordメンションが `failed to fetch bot identity` エラーにより
機能しない場合がある。回避策として `mentionPatterns` を設定する。

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

この設定により、メッセージに「よつば」というテキストが含まれていれば
よつばが反応するようになる。

---

## 6. ファイル権限の注意

コンテナ（uid=999/sandbox）とホスト（uid=1000/user）のUID不一致が原因で
openclaw.jsonの書き込みエラーが発生する。

解決策:
```bash
sudo chown -R 999:999 ~/.openclaw/
sudo chmod -R 775 ~/.openclaw/
sudo usermod -aG systemd-journal user
# ログアウト→再ログイン必要
```

---

## 7. 動作確認済み内容（2026-03-20）

| 機能 | 状態 | 備考 |
|------|------|------|
| DM（ダイレクトメッセージ） | ✅ 動作確認済み | |
| guildチャンネル（requireMention: false） | ✅ 動作確認済み | |
| guildチャンネル（「よつば」テキスト含む） | ✅ 動作確認済み | mentionPatterns経由 |
| guildチャンネル（@メンション） | ⚠️ 不安定 | Bot identity取得エラー時に失敗 |

---

## 8. フクロウ（VPS）との使い分け状況

| 送り方 | よつば | フクロウ |
|--------|--------|---------|
| メンションなし | 無視 | 無視（requireMention: true設定済み） |
| 「よつば ○○」 | 反応 | 無視 |
| `@フクロウ ○○` | 無視 | 反応 |
| `@よつば ○○` | 不安定 | 無視 |
| DM | 反応 | — |

フクロウ側の設定（VPS openclaw.json）:
- `requireMention: true` 設定済み（2026-03-20）
- `channels` セクション未設定（未解決）

---

## 9. 未解決事項

### @よつばメンションの不安定動作
- 原因: `failed to fetch bot identity` エラー（Discord APIへの接続タイムアウト）
- 発生条件: Surface GoからDiscord APIへの接続が不安定な場合
- 回避策: `mentionPatterns: ["よつば"]` でテキストマッチを使用
- 根本解決: ネットワーク安定化が必要

### フクロウ側のchannels設定
- `channels` セクションが未設定のため挙動が不明確
- VPS側 openclaw.json に `channels` セクションを追加することで改善可能

### 参照すべき公式ドキュメント
- Discord設定全般: https://docs.openclaw.ai/channels/discord
- 設定リファレンス: https://docs.openclaw.ai/gateway/configuration-reference
- トラブルシュート: https://docs.openclaw.ai/gateway/troubleshooting
- Dockerでの運用: https://docs.openclaw.ai/install/docker
