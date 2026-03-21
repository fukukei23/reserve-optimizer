# OpenClaw 概要

## とは

OpenClaw Gateway は、VPS 上で稼働する **AI エージェントのゲートウェー** です。

マルチチャネル（Discord、WhatsApp、Telegram など）経由での指示受信、スキル実行、ツール使用を一元管理し、外部の AI エージェント（Cursor など）からも利用可能な中核システムを提供します。

---

## アーキテクチャ

```
Internet
   ↓
Caddy (HTTPS Reverse Proxy / TLS 終端)
   ↓
openclaw-gateway :18789 (Docker コンテナ)
   ↓
OpenClaw Runtime (Agent Runtime + Plugin System)
```

---

## 構成要素

| 要素 | 説明 |
|------|--------|
| **Caddy** | HTTPS リバースプロキシ。インターネットから HTTPS で受信し、内部的に Gateway へ転送する。TLS 証証を終端する。 |
| **openclaw-gateway** | OpenClaw のメイン Gateway プロセス。18789 ポートでリッスン待っている。 |
| **Agent Runtime** | AI エージェント（requirement_agent、architect_agent、coder_agent、tester_agent など）の実行エンジン。 |
| **Plugin System** | LLM プロバイダー連携、チャンネル、デバイス管理などを行うプラグイン群。 |
| **Control UI** | Web UI（`https://fopenclaw.com`）。Gateway へのアクセス、デバイス管理、設定確認に使用する。 |

---

## 主な機能

### 1. チャネル管理
複数のプラットフォームに対応し、指示受信・スキル実行・ツール使用を一元管理します。

| プラットフォーム | 対応 |
|------------|--------|
| Discord | WebSocket でのリアルタイム通信 |
| WhatsApp | メッセージング API |
| Telegram | Bot API |
| Slack | WebSocket + Bot API |

### 2. スキル実行
スキルマーケットプレイスからワークフローを定義し、タスクの自動化を実現します。

| カテゴリ | 可能な機能 |
|----------|-----------|
| ネット検索 | Web ブラウジング・情報収集・要約 |
| API 呼び出し | 外部 API 経由でのデータ取得・操作 |
| 定期タスク | Cron やハートビートでの定期実行 |
| メモリ管理 | 過去の実行結果からの学習 |

### 3. AI モデル管理
複数の LLM プロバイダーを管理し、最適なモデルを自動選択します。

### 4. デバイス管理
Android・iOS 端末のペアリング・管理機能。
複数の AI プロバイダーに対応し、動的にルーティングします。

| プロバイダー | モデル |
|------------|--------|
| OpenAI | GPT-4、GPT-3.5-turbo |
| Gemini | Google Gemini |
| Anthropic (Claude) | Claude Sonnet、Opus |
| Perplexity | pplx-7b-online、pplx-70b-online |
| DeepSeek | DeepSeek-V3 |
| Z.AI (GLM) | GLM-5 |

**LLM ルーター**: タスクの複雑度やコスト効率に応じて最適なモデルを自動選択。

### 3. デバイス管理
Android・iOS 端末のペアリング・管理機能。

- **Android**: Gateway URL とトークンを入力してペアリングリクエストを送信
- **iOS**: QR コードによるペアリング（サーバー側で `devices qr` コマンドで生成）

### 4. チャット機能
- リアルタイムのチャットインターフェース
- チャンネル管理

### 5. コーディング支援
- AI モデルを使用したコード補完
- エラーの自動検出と修正提案
- コンテキストベースの会話履歴管理

---

## 他の AI ツールとの違い

| ツール | 役割 | 違い点 |
|------|--------|--------|
| **Cursor**、**v0.dev** | ローカル環境で動く AI エージェント。VSCode 拡張機能として統合されている。 |
| **Gemini Code** (Google AI Studio) | Google が提供する統合開発環境 |
| **Replit** | Web ベースの AI エージェント開発環境 |
| **OpenClaw Gateway** | VPS 上で稼働する **ゲートウェー** 型。複数環境・デバイスから一元的にアクセス可能なアーキテクチャ。 |

**OpenClaw Gateway の主な特徴**:
- 🔒 **分離型**: Gateway が VPS 上で稼働し、クライアント（Cursor、Web UI、モバイルアプリなど）からアクセス可能。
- 🔄 **常時稼働**: VPS で 24 時間稼働可能（`docker compose up -d`）。
- 🌐 **HTTPS 対応**: Caddy により TLS 証証済みの HTTPS エンドポイント（`https://fopenclaw.com`）。
- 📱 **マルチデバイス**: 1 つの Gateway に複数の Android/iOS 端末を登録可能。
- 🔀 **マルチ LLM**: 6 つ以上の AI プロバイダーを同時に管理・切替可能。

---

## ユースケース

### 1. ローカル開発での使用（Cursor など）
```
開発者の PC (Cursor) ---HTTPS--> OpenClaw Gateway (VPS) ---API---> 複数LLMプロバイダー
                      ↑                                     ↑
```

Cursor から OpenClaw Gateway 経由で AI エージェント機能を使用することで、自身のローカル環境から最適な AI モデルを選択できます。

### 2. モバイルアプリからの使用（OpenClaw App）
```
モバイル端末 ---HTTPS--> OpenClaw Gateway (VPS) ---AI---> 複数LLMプロバイダー
                 ↑
```

モバイルアプリからも、Gateway を経由して AI 機能を使用できます。旅行中や外出先からでも、自分の AI 環境にアクセス可能です。

### 3. Web UI からの使用
```
Web ブラウザ ---HTTPS--> OpenClaw Gateway (VPS) ---AI---> 複数LLMプロバイダー
              ↑
```

`https://fopenclaw.com` にアクセスして、ブラウザからも OpenClaw の機能を利用できます。

---

## 技術スタック

| コンポーネント | 技術 |
|------------|--------|
| Gateway Runtime | Node.js |
| コンテナ化 | Docker Compose |
| リバースプロキシ | Caddy |
| TLS 証証 | Let's Encrypt（Caddy 自動） |
| ネットワーク | Docker internal network (`openclaw-net`) |

---

## 関連リソース

- **Runbook**: `docs/runbook.md` - 本番環境の運用手順
- **ハンドオー資料**: `README_HANDOVER.md` - 環境引継ぎ資料
- **トラブルシュート**: 本ドキュメント内のトラブルシュートセクションを参照

---

**備考**: 本概要は README_HANDOVER.md および runbook.md の内容を基に作成されています。詳細な運用手順や設定方法については、これらのドキュメントを参照してください。
