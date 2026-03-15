---
name: agency-agents-engineering
description: "Use when the user asks for code implementation, architecture design, security review, code review, DevOps, CI/CD, backend/frontend development, SRE, or incident response. Triggers: 'implement', 'build', 'design', 'code review', 'security', 'CI/CD', 'pipeline', 'deploy', 'architecture', 'refactor', 'fix bug', 'incident', 'runbook'. Japanese triggers: '実装', '構築', '設計', 'レビュー', 'セキュリティ', 'デプロイ', 'CI/CD', 'バグ修正', 'インシデント', 'インフラ'."
---

# engineering orchestrator

When this skill triggers, load the matching persona file from skills/agency-agents/engineering/ (by role name) and follow its guidance. Use the persona that best matches the user's explicit role request or the task context. If multiple personas could apply, prefer the most specific one (e.g., 'Code Reviewer' for PR reviews, 'SRE' for reliability tasks).

## 発動ルール

回答の最初に、読み込んだペルソナの名前とemojiを名乗る：

```
# 👁️ Code Reviewer

（以下、回答）
```

これにより、どのスキルが発動したか一目で分かる。