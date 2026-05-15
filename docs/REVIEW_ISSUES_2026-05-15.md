---
name: コードレビュー指摘事項 — Opus × MiniMax (2026-05-15)
date: 2026-05-15
reviewer: Opus 4.7 / MiniMax M2.7
type: issue-backlog
status: open
---

# reserve-optimizer — レビュー指摘事項

> 出典: SSOT `40_CAREER/キャリア分析/01_能力評価/2026-05-15_クロスレビュー_Opus×MiniMax.md`
> 採用ポートフォリオ品質向上のための修正タスク。優先度順。

---

## 優先度: 🔴 高（採用面接で必ず突かれる）

### ISSUE-001: pytest 等の自動テストが存在しない
- **症状**: `test_*.py` 0件。tests/ 配下も軽め。15+状態の会話マシンが人手検証のみ。
- **対象**: `gas-project/handlers/*.js`（特に StateHandler / ReservationHandler / ChangeHandler / CancelHandler）, `worker/src/index.ts`
- **推奨対応**:
  - GAS 側: clasp + Jest（GAS スタブ）または Vitest で `StateHandler.js` の遷移行列テスト追加（最低 15 状態 × 主要入力）
  - Worker 側: `vitest` + `@cloudflare/vitest-pool-workers` で `verifyLineSignature` / `verifyStripeSignature` / `timingSafeEqual` のユニットテスト
  - 最低カバレッジ目標: 50%（GAS 制約上ステートマシン部分のみで十分）
- **想定工数**: 1〜2日
- **完了条件**: README に CI バッジ + カバレッジバッジ

### ISSUE-002: ビジネスインパクトの数値化が README に無い
- **症状**: 「整骨院向け」とは書いてあるが、実運用件数・処理時間・顧客満足度などの数値が一切ない
- **対象**: `README.md`
- **推奨対応**: README 冒頭に「Impact」セクション追加
  - 例: 月間予約処理件数、自動化により削減した受付時間（時間/月）、決済成功率、Webhook 平均レイテンシ
- **想定工数**: 1〜2時間
- **完了条件**: 採用面接で「これで何がどれくらい改善したか」を 30 秒で答えられる README

---

## 優先度: 🟡 中（運用品質）

### ISSUE-003: Worker → GAS の 302 リダイレクト追従ハックがフラジリティ
- **症状**: `forwardToGAS` (worker/src/index.ts:184-226) で 302 Location を手動追従。GAS WebApp 仕様変更で即死する設計
- **対象**: `worker/src/index.ts:184-226`
- **推奨対応**:
  - GAS Web App の Apps Script API 化を検討（実行可能 API なら 302 を踏まない）
  - 暫定: 302 を捕捉した時点でエラー通知 + アラートを GAS 側に投げる
  - 構造化ログを Cloudflare Logpush で外部保存
- **想定工数**: 半日〜1日

### ISSUE-004: ステートマシンが if/switch ベースで状態爆発に弱い
- **症状**: MessageRouter / ReservationHandler の遷移ロジックが if/switch チェーン。新状態追加で複雑度が線形に悪化
- **対象**: `gas-project/handlers/MessageRouter.js`, `gas-project/handlers/StateHandler.js`
- **推奨対応**:
  - 遷移を `TRANSITIONS = { state: { input: nextState } }` 形式の宣言的テーブルへ抽出
  - atelier-kyo-manager の `auto_order_service.py` の `VALID_TRANSITIONS` 辞書パターンを参考
  - 不正遷移の明示的拒否（現状は黙って次に進む可能性）
- **想定工数**: 1〜2日

### ISSUE-005: ScriptProperties に平文で API キーが置かれる
- **症状**: README で LINE_CHANNEL_ACCESS_TOKEN 等を ScriptProperties に直書き指示
- **対象**: README、`gas-project/config/ScriptProperties.js`
- **推奨対応**:
  - GAS の制約上仕方ない部分はあるが、最低限「アクセス権限を Owner のみに制限する」「ローテーション手順」を README に明記
  - 可能なら Secret Manager / Cloud KMS 経由化を検討（長期）
- **想定工数**: 30分（ドキュメント） + 中期で再設計

---

## 優先度: 🟢 低（余裕があれば）

### ISSUE-006: CI/CD バッジが無い
- **対象**: GitHub Actions 未設定
- **推奨**: clasp lint + jest テスト + wrangler deploy --dry-run を CI 化、バッジを README へ
- **想定工数**: 半日

### ISSUE-007: 英語 README 不在
- **対象**: `README.md`
- **推奨**: 最低 1 段落の英語 abstract を冒頭に
- **想定工数**: 30分

---

## 補足: 採用面接で語るべきストーリー

このリポジトリで強調すべきは:
1. **エッジ署名検証 + waitUntil による LINE タイムアウト回避**（Cloudflare Worker の正しい使い方）
2. **CacheService → PropertiesService の二層 state ストア**（GAS 固有の eviction バグへの対応）
3. **timingSafeEqual を自前実装**（HMAC タイミング攻撃を知っている証拠）

逆に質問されたら困る箇所:
- 「テストはどうしてますか？」 → ISSUE-001 を先に潰せ
- 「スケールしますか？」 → GAS の制約を理解した選択であることを明確に
