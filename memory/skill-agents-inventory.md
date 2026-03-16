# Skill Agents Inventory (2026-03-16)

調査対象ログ: /home/node/.openclaw/agents/main/sessions/a2040236-3b0c-41d8-8106-63b83aff13ce.jsonl

基準:
- "実装済み" = skills/agency-agents 以下に SKILL.md（オーケストレータ）が存在し、サブスキルファイルがある
- "稼働履歴あり" = 上記ログ内で該当サブスキル名が出現した件数（>0 の場合、過去に参照・起動された痕跡あり）

---

## 概要
agency-agents フォルダ構成:
- testing/ (9ファイル + SKILL.md)
- engineering/ (24ファイル + SKILL.md)
- specialized/ (25ファイル + SKILL.md)

各オーケストレータ (SKILL.md) は実装済み（オーケストレータファイルあり）。

以下にサブエージェント一覧（ファイル名、パス、ログ内出現回数）を示す。

---

## testing (path: skills/agency-agents/testing/)

- testing/SKILL.md — オーケストレータ（実装済） — 出現: 75
- testing/testing-accessibility-auditor.md — 出現: 8
- testing/testing-api-tester.md — 出現: 78
- testing/testing-evidence-collector.md — 出現: 8
- testing/testing-performance-benchmarker.md — 出現: 13
- testing/testing-reality-checker.md — 出現: 8
- testing/testing-test-results-analyzer.md — 出現: 8
- testing/testing-tool-evaluator.md — 出現: 8
- testing/testing-workflow-optimizer.md — 出現: 8

-> コメント: testing 系はログで頻繁に参照されており、特に testing-api-tester は最も多く出現（78回）。

---

## engineering (path: skills/agency-agents/engineering/)

- engineering/SKILL.md — オーケストレータ（実装済） — 出現: 75
- engineering-ai-data-remediation-engineer.md — 出現: 9
- engineering-ai-engineer.md — 出現: 13
- engineering-autonomous-optimization-architect.md — 出現: 10
- engineering-backend-architect.md — 出現: 9
- engineering-code-reviewer.md — 出現: 13
- engineering-data-engineer.md — 出現: 9
- engineering-database-optimizer.md — 出現: 9
- engineering-devops-automator.md — 出現: 13
- engineering-embedded-firmware-engineer.md — 出現: 9
- engineering-feishu-integration-developer.md — 出現: 9
- engineering-frontend-developer.md — 出現: 9
- engineering-git-workflow-master.md — 出現: 9
- engineering-incident-response-commander.md — 出現: 10
- engineering-mobile-app-builder.md — 出現: 10
- engineering-rapid-prototyper.md — 出現: 9
- engineering-security-engineer.md — 出現: 17
- engineering-senior-developer.md — 出現: 12
- engineering-software-architect.md — 出現: 9
- engineering-solidity-smart-contract-engineer.md — 出現: 9
- engineering-sre.md — 出現: 10
- engineering-technical-writer.md — 出現: 12
- engineering-threat-detection-engineer.md — 出現: 10
- engineering-wechat-mini-program-developer.md — 出現: 9

-> コメント: engineering 系も多数参照されており、security_engineer や code-reviewer 系が比較的多め。

---

## specialized (path: skills/agency-agents/specialized/)

- specialized/SKILL.md — オーケストレータ（実装済） — 出現: 75
- specialized/accounts-payable-agent.md — 出現: 9
- specialized/agentic-identity-trust.md — 出現: 9
- specialized/agents-orchestrator.md — 出現: 9
- specialized/automation-governance-architect.md — 出現: 11
- specialized/blockchain-security-auditor.md — 出現: 9
- specialized/compliance-auditor.md — 出現: 17
- specialized/corporate-training-designer.md — 出現: 9
- specialized/data-consolidation-agent.md — 出現: 9
- specialized/government-digital-presales-consultant.md — 出現: 11
- specialized/healthcare-marketing-compliance.md — 出現: 9
- specialized/identity-graph-operator.md — 出現: 11
- specialized/lsp-index-engineer.md — 出現: 9
- specialized/recruitment-specialist.md — 出現: 19
- specialized/report-distribution-agent.md — 出現: 9
- specialized/sales-data-extraction-agent.md — 出現: 9
- specialized/specialized-cultural-intelligence-strategist.md — 出現: 9
- specialized/specialized-developer-advocate.md — 出現: 9
- specialized/specialized-document-generator.md — 出現: 13
- specialized/specialized-mcp-builder.md — 出現: 9
- specialized/specialized-model-qa.md — 出現: 11
- specialized/specialized-workflow-architect.md — 出現: 11
- specialized/study-abroad-advisor.md — 出現: 9
- specialized/supply-chain-strategist.md — 出現: 3
- specialized/zk-steward.md — 出現: 3

-> コメント: recruitment-specialist と compliance-auditor が比較的多く参照されています。supply-chain と zk-steward は出現が少なめ。

---

## 解釈と次の提案

- **実装済み**: agency-agents のオーケストレータ（SKILL.md）が存在し、サブスキルも配置されているため「実装済み」と見なせる。
- **稼働実績あり**: ログ出現回数 > 0 のサブスキルは実際に参照／起動された痕跡がある。
- **保存のみ（未使用）**: 出現回数が非常に少ない（例: 3回）ものは保存しているが利用頻度は低い。特に使用実績0の項目は見つからなかった。

次のアクション候補:
1. 出現回数の少ないスキル（例: supply-chain, zk-steward）をユーザーにテストさせ、動作確認する
2. より詳細な利用ログ（タイムライン）をCSVで出力して監査する
3. これを `memory/skill-agents-inventory.md` として保存（保存済み）

---

レポート作成: 保存先 `/home/node/.openclaw/workspace/memory/skill-agents-inventory.md` (作成済)

ご要望があればCSV出力やGitコミット（現状は既にコミット済みの inventory あり）を行います。
