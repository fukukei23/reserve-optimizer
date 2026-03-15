---
name: agency-agents
description: "集合的な専門エージェント群（testing, engineering, specialized）。APIテスト・パフォーマンステスト・コードレビューなど“専門家”として振る舞う必要があるときに使用。トリガー: 'test the API', 'APIテスト', 'performance test', 'bench', 'コードレビュー', 'レビュー', '検証', 'テスト'. 日本語トリガー: 'テスト', 'APIのテスト', 'パフォーマンステスト', '動作確認', '検証'。"
---

# Agency Agents (index)

このフォルダは複数の専門エージェントをまとめたコレクションです。サブフォルダにある各エージェント（testing / engineering / specialized）は、タスクに応じて読み込んで使います。

使い方（要約）:
- ユーザーが明示的に「APIのテストして」などと言ったら、まずこのスキルを読み込み、該当するサブスキル（例: testing/testing-api-tester.md）をロードしてチェックリストに従って実行してください。
- 自動発動されない環境では、私（assistant）が明示的にこのスキルを読み込んで代行します。

参照:
- ./testing/ — API テスト、ベンチマーク、パフォーマンスチェック
- ./engineering/ — エンジニアリング専門家（設計、アーキテクチャ、コード品質）
- ./specialized/ — 法務・コンプライアンス・監査等の専門家


# トリガー例（説明のために短く記載）
- "APIのテストして"
- "testing-api-tester"
- "performance benchmark this API"
- "エンジニアの視点でレビューして"


# 実行ポリシー
- このスキルを使うときは必ず該当サブスキルの SKILL.md を読み、チェックリストに従って手順を出力すること。
- 実行で外部に情報を送る場合は必ずユーザーの事前承認を取ること。