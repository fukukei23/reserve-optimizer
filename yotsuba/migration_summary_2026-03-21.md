# よつば（Surface Go）公式イメージ移行 作業記録
日時: 2026-03-21
作業者: ふくけい

## 移行の目的
NemoClawベースのカスタムイメージ（openclaw-surface:local、uid=999/sandbox）から
公式イメージ（ghcr.io/openclaw/openclaw:latest、uid=1000/node）へ移行。
uid権限問題の根本解決が主目的。

## 変更ファイル一覧

### Dockerfile（新規作成）
FROM ghcr.io/openclaw/openclaw:latest
パッケージ変更点:
- mysql-client → default-mysql-client
- mongodb-clients → 削除
- kafkacat → kcat

### docker-compose.yml（変更）
- HOME: /sandbox → /home/node
- volumes: /sandbox/.openclaw → /home/node/.openclaw
- user: 1000:1000 削除
- entrypoint削除、command を公式デフォルトに変更

### openclaw.json（変更）
- workspace: チルダ → /home/node/.openclaw/workspace/yotsuba（絶対パス）
- sandbox.mode: off 追加

## トラブルシュート

### 問題1: ビルドエラー（パッケージ名）
エラー: mysql-client / mongodb-clients が見つからない
原因: Debian bookwormでのパッケージ名変更・廃止
対処: default-mysql-client に変更、mongodb-clients削除、kafkacat→kcat

### 問題2: EACCES: permission denied, mkdir '/sandbox'
根本原因: sessions.json に旧NemoClawイメージ時代の
workspaceDir: /sandbox/.openclaw/workspace/yotsuba がキャッシュとして残存。
調査過程:
1. sandbox.mode=off 追加 → 解決せず
2. workspace を絶対パスに変更 → 解決せず
3. sessions.json を確認 → 旧パスのキャッシュ発見
4. sessions.json削除 → docker compose down && up → 解決

### 問題3: entrypoint/commandパス
NemoClaw版: /usr/local/lib/node_modules/openclaw/dist/index.js
公式イメージ: WorkingDir=/app, Cmd=node openclaw.mjs gateway
対処: entrypoint削除、command を --bind lan --port 18789 のみに変更

## sandbox=off判断根拠
- uid権限問題: 解決（999→1000）
- docker.sockマウント: なし → sandbox機能が動作しない
- 課金リスク: ZAI・MinMax月額上限ありで実質ゼロ
- 勝手に契約リスク: クレカ情報を渡さない限り技術的に不可
- 現時点でoff理由: 実験開始フェーズ、設定コストより実験優先

## 自走ビジネス実験の構成方針
- sandbox: off（当面）
- APIキー: ZAI + MinMax（月額上限あり）
- クレカ: 渡さない。必要になれば上限付き仮想カードを検討
- Googleアカウント: 新規専用アカウント
- PC: Surface Go（よつば）= 実験専用機

## 未検討事項
- sandbox=on移行（実験が進んでからでよい）
- VNC自動起動（systemdサービス化）
- Wi-Fiチップ（ath10k）不安定問題（有線LANアダプターで根本解決）

## 現在の構成（2026-03-21時点）
Surface Go / Ubuntu / claw-node / 192.168.1.7 / Tailscale: 100.78.104.58
- イメージ: openclaw-surface:local（公式イメージベース）
- HOME: /home/node / uid: 1000(node)
- LLM: zai/glm-5（primary）/ minimax/MiniMax-M2.7（fallback）
- Discord Bot: よつば
- workspace: /home/node/.openclaw/workspace/yotsuba
