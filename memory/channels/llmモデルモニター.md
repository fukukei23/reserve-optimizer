# #llmモデルモニター チャンネルアーカイブ

チャンネルID: 1481189779449057361
説明: LLMモデル使用状況の監視・アラート用。

-- 追記ルール --
- モデル切替や障害時の対応方針を日付付きで記録

---

## 2026-03-15

- 初期作成: フクロウが自動で作成しました。

## 2026-03-31

### OpenAI使用アラート（16:43 JST）
- **内容**: 9セッションがOpenAI（gpt-5-mini / gpt-5.1-codex）を使用
- **問題**: GLM系へのオーバーライド未設定
- **対象セッション**:
  - cron:7a371d42 (gpt-5-mini, 更新3/19)
  - cron:09ded1ad (gpt-5-mini, 更新3/19)
  - discord:1482990699363307591 (reserve-optimizer)
  - discord:1483293897282031697 (openclaw-deploy)
  - discord:1482875560660045977 (skill-agent)
  - discord:1480589360465186847 (claw5速報)
  - discord:1481549724623306792
  - cron:b3e30cb5 (gpt-5.1-codex)
  - cron:77824934 (gpt-5.1-codex)
- **推奨対応**: 各セッションのmodelOverride/providerOverrideをGLM系に設定

(追記者: フクロウ)
