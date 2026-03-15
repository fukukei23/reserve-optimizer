# Browser Relay 接続手順

## 概要

Browser Relayを使うと、Surface Goで動いているChromeをVPSから操作できる。
2FA必須サイトや既存ログイン状態が必要な場合に使用する。

---

## 前提条件

- Surface Go（Windows）
- Chrome インストール済み
- OpenClaw Browser Relay 拡張機能 インストール済み
- VPSとSurface Goがネットワーク接続可能

---

## 手順

### 1. Surface GoでChromeを起動

1. Surface Goの電源を入れる
2. Chromeを開く
3. 必要なサイトに事前ログインしておく（2FAも完了させておく）

### 2. Browser Relay拡張機能を有効化

1. Chromeのツールバーにある OpenClaw Browser Relay アイコンをクリック
2. 「Attach this tab」をクリック
3. バッジが「ON」になれば接続準備完了

### 3. VPSから接続確認

フクロウに以下を依頼：
```
Browser Relay使える？
```

接続状態が返ってくる。

### 4. ブラウザ操作

フクロウに操作を依頼：
```
Amazonの注文履歴を見て
```
```
Gmailの未読メールを確認して
```

---

## 使い分け

| 用途 | 使用ツール |
|------|-----------|
| 情報収集・スクレイピング | コンテナ内Chromium |
| ログイン不要の操作 | コンテナ内Chromium |
| 2FA必須サイト | Surface Go + Browser Relay |
| 既存ログイン状態維持 | Surface Go + Browser Relay |

---

## トラブルシューティング

### 接続できない場合

1. Surface GoとVPSが同じネットワークにいるか確認
2. Browser Relay拡張機能が有効か確認
3. Chromeが起動しているか確認
4. ファイアウォール設定を確認

### タイムアウトする場合

1. Surface Goがスリープ状態になっていないか確認
2. ネットワーク接続を確認
3. Browser Relay拡張機能を再読み込み

---

## 注意事項

- Surface Goは常時起動不要（必要時のみ使用）
- 操作中はSurface GoでChromeを触らない
- センシティブな操作は人間の承認を得る
