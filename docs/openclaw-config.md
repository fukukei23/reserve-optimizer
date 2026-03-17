# OpenClaw 設定・環境変数 — canonical

概要
- このファイルは OpenClaw の環境変数、再起動手順、重要注意事項を正本（canonical）としてまとめたものです。

重要パス
- コンテナ内の表記: /home/node/.openclaw/.env
- VPS 側の実体（編集先）: /home/op/openclaw-stack/openclaw_config/.env
- ワークスペース（このリポジトリ）: workspace/docs/openclaw-config.md（このファイル）

編集・追加手順（推奨）
1. VPS に SSH 接続
2. 適切な権限でファイルを編集
   - sudo nano /home/op/openclaw-stack/openclaw_config/.env
3. 保存後、反映のために再起動
   - docker compose restart openclaw-gateway
   - 必要なら: docker compose up -d

反映確認（コンテナ内）
- コンテナ内環境変数確認例:
  - env | grep -E "API|KEY|TOKEN|SECRET|ZAI|BRAVE|DISCORD|OPENAI|KIMI|GLM"
- VPS 側（コンテナに exec して確認）:
  - docker compose exec openclaw-gateway env | grep -E "BRAVE|DISCORD|OPENAI|KIMI|GLM"

セキュリティ注意
- API キー等の機密情報はこのチャンネル（Discord）にプレーンテキストで貼らないこと。必ずマスクする（例: sk-abc...xyz）。
- Git にコミットする場合も機密は環境変数ファイルに入れず、`.env.example` のようにサンプルを置き、実運用値は秘匿する。
- トークンやキーを貼ってしまった場合は即座に該当キーを無効化（revoke）すること。

ロールと責任
- 編集者: VPS にアクセス権のある管理者のみ（@fukukei）
- 反映確認: 編集者が反映後にこのチャンネルで「反映済み」を報告すること

変更履歴（例）
- 2026-03-17: 初版作成 — フクロウ

付録: よく使うコマンド
- ファイルの編集（VPS）: sudo nano /home/op/openclaw-stack/openclaw_config/.env
- Gateway 再起動: docker compose restart openclaw-gateway
- コンテナ内での確認: docker compose exec openclaw-gateway env | grep GLM

運用ルール（短く）
- 正本はこのファイル（workspace/docs/openclaw-config.md）。Discord には要約＋リンクを貼ってピン固定する。
- 重要な抜粋は memory/SHARED.md に追記し、他チャネルでも参照可能にする。
- 重大変更（認証情報の差し替え、公開鍵変更等）は事前にここで共有して承認を得る。

-- end of file --
