# Phase α: 採用デモ基盤 — 設計仕様

> 作成: 2026-06-26
> 対象: reserve-optimizer Roadmap Phase α（A4・C4・E11・A1・A5・A2）
> ゴール: **採用面接で「見せて・説明できて・品質証明されている」を1発で示す公開デモを稼働させる**
> 関連: `docs/ROADMAP_2026-06-26.md`（メインゴール=採用最優先）

---

## 1. 背景・ゴール

reserve-optimizer は機能実装（Wave 1-3）・リファクタリング（P0-P3）は完了したが、**実導入0件・公開デモなし**が採用での最大の穴。実績が無くても「触れるデモ + 品質証明」があれば説得力を持つ。

本 spec は Phase α 6項目を統合し、**誰でも触れる公開デモを安全に稼働させる**ための設計。

### 成功基準
- [ ] 公開デモURL稼働・READMEにリンク（採用官クリック1発）
- [ ] 全機能体験可能（Web予約・AIチャット・6言語・管理者Dashboard readOnly）
- [ ] 毎時リセットcron動作（永続的に触れる状態維持）
- [ ] 本番/デモ物理分離（設定ミスで本番データ露出ゼロ）
- [ ] CI テスト pass + カバレッジバッジ表示
- [ ] Mermaid図3点（アーキ・予約フロー・Stripe/Webhookシーケンス）README掲載
- [ ] Impact数値（ベンチマーク）README冒頭に掲載

### スコープ外
- 実導入（C1）= Phase β
- 本番Stripe live決済
- マルチテナント・Supabase移行 = Phase δ

---

## 2. 6項目の依存グラフ

```
A4(セキュリティ) ─┐
                   ├─→ E11(公開デモ) ─→ A2(数値化: デモでベンチマーク)
C4(規約)         ─┘
                   A1(テスト)  ── デモの信頼性基盤（独立・並行可）
                   A5(アーキ図) ── 設計説明力（独立・並行可）
```

**実装順**: A4 → C4 → E11 → (A1 並行) → (A5 並行) → A2

---

## 3. 各項目の設計

### A4. セキュリティ硬化（E11の前提）
- **CORS**: `worker/src/index.ts` の `Access-Control-Allow-Origin: "*"` → `ALLOWED_ORIGIN` 環境変数（本番ドメイン・demo URLを許可リスト化）
- **console.log 除去**: Worker 本番コードの14箇所 → `DEBUG=true` フラグ制御 or 削除
- **ScriptProperties**: アクセス権限を Owner のみに制限・ローテーション手順をREADME/ADRに明記
- **対象**: 本番・demo 両環境（demo も test mode とはいえ基本塞ぐ）

### C4. 利用規約・免責・プライバシーポリシー（E11の法的前提）
- `docs/legal/` に整備:
  - `TERMS.md`（利用規約）
  - `PRIVACY.md`（プライバシーポリシー・個人情報・決済データの扱い）
  - `DISCLAIMER.md`（免責事項・医学的診断非提供・稼働安定性免責）
- **デモ特記事項**: デモ環境のサンプルデータは架空・入力情報はリセットされる旨を明記
- 要レビュー（本掲載前に人間確認）

### E11. 公開デモ環境（頂点）
- **分離方式**: 別GASプロジェクト `reserve-optimizer-demo` + demo用 Spreadsheet + Stripe **test mode** + Cloudflare **demo env**（コード共用・ScriptProperties で設定分離・`DEMO_MODE=true`）
- **サンプルデータ**: `scripts/seed-demo-data.js` で架空「デモ鍼灸サロン」・顧客30人・予約3ヶ月分・スタンプ/クーポン実例（Faker的・個人情報完全偽装・再現性あり）
- **readOnly仕切り**: デモ予約は `demo_reservations` Sheet に隔離・**毎時 cron** でサンプルdata再注入（リセット）
- **デモ対象**: Web予約6ステップ・AIチャット（GLM）・6言語切替・管理者Dashboard readOnly
- **決済**: Stripe test mode（テストカード `4242...`）・success/cancel URL は demo URL
- **公開URL**: READMEに demo URL（Cloudflare demo env サブパス・新ドメイン取得せず）+ 書き込みRate制限（IP/分）
- **コスト**: GAS/Cloudflare無料枠・**GLM 1セッション5回まで**（超過は固定応答フォールバック）

### A1. 自動テスト（デモの信頼性基盤・独立並行可）
- **Worker**: `vitest` + `@cloudflare/vitest-pool-workers` で `verifyLineSignature` / `verifyStripeSignature` / `timingSafeEqual` のユニットテスト
- **GAS**: StateHandler 15状態×主要入力の遷移行列テスト（モック SheetService）
- **CI**: カバレッジバッジ追加（README）・目標50%（ステートマシン部分中心）

### A5. アーキテクチャ/シーケンス図（設計説明力・独立並行可）
- Mermaid で3点をREADMEに:
  - 全体アーキテクチャ図（LINE→Worker→GAS→Sheets/Stripe/GLM）
  - 予約フローシーケンス（状態遷移）
  - Stripe/Webhook シーケンス（決済→冪等性チェック→通知）

### A2. Impact数値化（E11のデモでベンチマーク計測）
- README冒頭「Impact」セクション:
  - 予約処理時間（デモで実測ベンチマーク）
  - Webhook 平均レイテンシ
  - 決済成功率（test mode で計測）
  - ※実データ（C1後）に差し替え可能な構造

---

## 4. 共通インフラ構成

```
本番: GAS(本番) ─ 本番Spreadsheet ─ Stripe(live) ─ Cloudflare(prod)
デモ: GAS(demo) ─ demo Spreadsheet ─ Stripe(test) ─ Cloudflare(demo) ─ 毎時リセットcron
        ↑ 既存 gas-project を clasp で別プロジェクト push・demo用 ScriptProperties で設定分離
公開: README → demo URL（Cloudflare demo env /reserve 等）
```

---

## 5. 採用での語り種（Phase α 完成時）

1. エッジ署名検証 + waitUntil（Cloudflare正用法）
2. CacheService→PropertiesService 二層state（GAS eviction対応）
3. timingSafeEqual 自前（タイミング攻撃対策）
4. **公開デモで触れる**（E11）— 「見せて」に即応
5. **CI通るテスト基盤**（A1）— 品質証明
6. **本番/デモ物理分離 + コスト抑止設計**（E11+A4）— インフラ設計力

---

## 6. リスク・対策

| リスク | 対策 |
|---|---|
| デモ設定ミスで本番データ露出 | 物理分離（別プロジェクト/Spreadsheet）・`DEMO_MODE` フラグ二重防御 |
| GLM コスト爆発（荒らし） | 1セッション5回制限・超過は固定応答 |
| 荒らしによるデモデータ破壊 | 毎時リセットcron・書き込みRate制限 |
| Stripe test mode 誤認 | UIに「デモ決済（課金なし）」明示 |
| 規約の法的瑕疵 | 本掲載前に人間レビュー（C4） |

---

## 7. 次ステップ

1. 本 spec をレビュー（ユーザー）
2. `writing-plans` スキルで実装タスク分解（Task1-N・依存順）
3. 実装 → 各完了時にSSOT記録
