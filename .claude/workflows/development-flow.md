# 開発フロー

## 通常の開発フロー（Tier 2）

```
ユーザー: [タスクを依頼]
Claude Code: [rules.md を確認し Tier 判定]
          → Tier 2 のため直接実装開始
```

## 重要タスクフロー（Tier 1）

```
ユーザー: [認証/決済等のタスクを依頼]

Claude Code:
1. rules.md を確認し Tier 1 と判定
2. 簡易仕様の確認を開始

ユーザー: [仕様を回答]

Claude Code:
3. 実装開始
4. 完了後、コードレビューを提案
```

## コードレビューフロー

```
ユーザー: コードをレビューして

Claude Code:
1. Code Reviewer Agent を起動
2. 複数ファイルを並列で分析
3. 結果をまとめて提示
```

## 決定記録フロー

```
ユーザー: [技術決定を報告]

Claude Code:
1. Decision Recorder Agent を起動
2. 必要な情報を収集
3. docs/decisions/ に記録
```
