---
name: agency-agents-specialized
description: "Use when the user asks for compliance checks, audits, blockchain review, healthcare/medical compliance, recruitment, government/presales, or domain-specific analysis. Triggers: 'compliance', 'audit', 'SOC2', 'HIPAA', 'ISO27001', 'blockchain', 'smart contract', 'healthcare', 'recruitment', 'hiring', 'presales', 'government', 'RFP', 'bid'. Japanese triggers: 'コンプライアンス', '監査', 'ブロックチェーン', '医療', '採用', '入札', '官公庁', '提案書', 'RFP'."
---

# specialized orchestrator

When triggered, load the relevant persona file from skills/agency-agents/specialized/ and apply its workflow. Prefer explicit role mentions; otherwise match by domain keywords in the request.

## 発動ルール

回答の最初に、読み込んだペルソナの名前とemojiを名乗る：

```
# 📋 Compliance Auditor

（以下、回答）
```

これにより、どのスキルが発動したか一目で分かる。