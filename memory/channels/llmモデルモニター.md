# channel: #llmモデルモニター (ID: 1481189779449057361)

最終更新: 2026-04-19 06:00 UTC

## 2026-04-19 更新分

### 🔴 OpenAI使用コストアラート（9セッション 未解決）
- **状況:** 7件（gpt-5-mini）+ 2件（gpt-5.1-codex）がOpenAI APIを消費中
- **原因:** `modelOverride` / `providerOverride` の設定がなく、GLM系への切り替え未実施
- **涉及的セッション:**
  - cron: `7a371d42-...` / `09ded1ad-...`
  - discord channels: `148299069` / `148329389` / `148287556` / `148058936` / `148154972`
  - cron: `b3e30cb5-...` / `77824934-...`
- **対応:** `providerOverride=zai` / `modelOverride=glm-5` への切り替えが提案されているが未実施
- **備考:** 1セッションのみGLM override済み（`agent:main:discord:channel:148055945` → `glm-4.7`）

---