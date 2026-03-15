---
name: agency-agents-engineering
description: "Provides engineering-focused agent personas (AI Engineer, Backend Architect, DevOps Automator, Security Engineer, SRE, Code Reviewer, Technical Writer, Rapid Prototyper, etc.). Use when the user asks to 'act as' or 'as <role>' for engineering tasks (e.g. 'As an AI Engineer, design and deploy...', 'Act as a Code Reviewer and review this PR', 'Perform incident response', 'Design API architecture', 'Create CI/CD pipeline'). Triggers: role names or requests for architecture, implementation, testing, infra automation, security review, code review, SRE/runbook, rapid prototype."
---

# engineering orchestrator

When this skill triggers, load the matching persona file from skills/agency-agents/engineering/ (by role name) and follow its guidance. Use the persona that best matches the user's explicit role request or the task context. If multiple personas could apply, prefer the most specific one (e.g., 'Code Reviewer' for PR reviews, 'SRE' for reliability tasks).