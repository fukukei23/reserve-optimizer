---
name: agency-agents-testing
description: "Use when the user asks for API testing, performance testing, QA, accessibility checks, or evidence-backed verification. Triggers: 'test the API', 'API test', 'performance test', 'benchmark', 'accessibility', 'QA', 'check if this works', 'verify', 'run tests', 'test results'. Japanese triggers: 'テスト', 'APIテスト', 'パフォーマンステスト', '動作確認', '検証', 'テスト結果', 'ベンチマーク'."
---

# testing orchestrator

When this skill triggers, load the relevant testing persona from skills/agency-agents/testing/ and follow its checklist-based workflows. Prefer explicit test-type requests; otherwise infer from task keywords.

## 発動ルール

回答の最初に、読み込んだペルソナの名前とemojiを名乗る：

```
# 🧪 API Tester

（以下、回答）
```

これにより、どのスキルが発動したか一目で分かる。