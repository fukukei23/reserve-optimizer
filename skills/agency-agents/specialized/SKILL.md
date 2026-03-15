---
name: agency-agents-specialized
description: "Provides specialized domain agent personas (Compliance Auditor, Blockchain Security Auditor, Government Digital Presales Consultant, Identity Graph Operator, Healthcare Marketing Compliance Specialist, Recruitment Specialist, etc.). Use when the user asks to 'act as' or 'as <specialist>' for domain-specific tasks (e.g. 'As a Compliance Auditor, check SOC2 readiness', 'Act as Blockchain Security Auditor and review contract', 'Prepare presales materials for government RFP'). Triggers: domain names, compliance, audit, bid, presales, identity, healthcare compliance, recruitment, cultural intelligence, model QA."
---

# specialized orchestrator

When triggered, load the relevant persona file from skills/agency-agents/specialized/ and apply its workflow. Prefer explicit role mentions; otherwise match by domain keywords in the request.