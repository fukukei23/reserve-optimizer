# 開発ガイドライン

## 品質管理の基本方針

このプロジェクトでは、Claude Code の開発速度を維持しつつ、必要最小限の品質管理を実施します。

---

## 1. 重要な判断の記録

### 対象
以下のような判断のみ記録:
- アーキテクチャの選択（例: モノリス vs マイクロサービス）
- 技術スタックの決定（例: PostgreSQL vs MongoDB）
- セキュリティ設計の判断
- パフォーマンスに関わるトレードオフ
- データモデルの重要な変更

### 場所
`docs/decisions/` ディレクトリ

### 形式
- ファイル名: `001-use-postgresql.md`（連番 + 内容）
- テンプレート: `docs/decisions/000-template.md` を参照

### 頻度
週1-2回程度（毎日は不要）

---

## 2. Git コミットメッセージの充実

### 必須要素
- **What**: 何を変更したか（デフォルトで含まれる）
- **Why**: なぜこの変更が必要だったか（必ず記述）

### 推奨要素
- 影響範囲（どのファイル、どの機能に影響するか）
- トレードオフ（何を諦めたか）
- 関連Issue番号

### 良い例
```
Add: JWT認証機能

Why: セッション管理の複雑性を回避し、マイクロサービス対応を可能にするため
影響: auth.py, middleware.py, user_model.py
トレードオフ: リフレッシュトークンの実装が必要（次のスプリントで対応）
関連: #123
```

---

## 3. 定期的なコードレビュー

### 頻度
- 機能実装完了時
- または週次（金曜日推奨）

### 方法
Claude Code に以下のように依頼:
```
今日/今週書いたコード全体をレビューして。
特に以下の観点で確認:
- セキュリティリスク
- パフォーマンスボトルネック
- 保守性の問題
- ベストプラクティスからの逸脱
```

---

## 4. 重要タスクの事前仕様

### Tier 1（事前仕様必須）
以下のタスクのみ、実装前に簡易仕様を作成:
- **認証・認可**: ログイン、権限管理、アクセス制御
- **決済処理**: 支払い、返金、課金ロジック
- **データ移行**: スキーマ変更、大量データ処理
- **公開API設計**: 外部公開するエンドポイント
- **セキュリティ関連**: 暗号化、トークン管理、入力検証

### Tier 2（通常フロー）
上記以外のタスク:
- ビジネスロジック実装
- UI実装
- バグ修正
- リファクタリング
- ドキュメント更新

→ 事前仕様不要、Claude Code と対話しながら実装

### 簡易仕様の書き方
**箇条書き3-5行で十分**。以下を含める:
- 何を作るか
- 主要な制約
- 影響範囲

---

## Claude Code での使い方

### Tier 1 タスクの場合
```
ユーザー: [Tier 1 タスクを依頼]

Claude Code:
これは [認証/決済/等] 機能（Tier 1）です。
簡易仕様を確認させてください：
- 何を作るか
- 主要な制約
- 影響範囲

ユーザー: [仕様を確認]
Claude Code: [実装開始]
```

### レビュー依頼
```
ユーザー: DEVELOPMENT.md の方針に従って、今週のコードをレビューして

Claude Code:
[DEVELOPMENT.md を読む]
[今週のコミット履歴を確認]
[セキュリティ、パフォーマンス、保守性の観点でレビュー]
```

---

## よくある質問

### Q1: 全てのタスクで仕様を書くべきでは？
**A**: 不要。Claude Code の強みは「対話しながら形にしていく」こと。Tier 1 のみで十分。

### Q2: コミットメッセージが長くなりすぎる
**A**: 本文は詳細に、タイトルは簡潔に。
```
git commit -m "Add: JWT認証" -m "Why: セッション管理の複雑性回避
影響: auth.py, middleware.py
トレードオフ: リフレッシュトークン実装が必要"
```

### Q3: docs/decisions/ がどんどん増える
**A**: 問題なし。むしろ資産。ファイル名に連番とキーワードを含める。

---

## 効果測定

このガイドラインの効果を確認する指標:

### 決定の追跡可能性
- 「なぜこうなったか」が3ヶ月後でも分かるか
- `docs/decisions/` に記録があるか

### 問題の早期発見
- レビューで指摘された重大な問題の数
- リリース後に発覚したバグの減少

---

## まとめ

このガイドラインの目的:
- Claude Code の強みを活かしつつ、最低限の品質を担保する

### 重要なこと
- 全てを記録しない（重要な判断のみ）
- 形式に囚われない（箇条書きで十分）
- 開発を止めない（事前仕様は Tier 1 のみ）

---

## テスト実行時の注意（境界ファイル・2026-08-05 追記）

本プロジェクトはテスト2系統が分断されている（構造問題の詳細: `obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-08-05_テスト2系統分断問題の認識.md`）。

- **GAS側**: `npm test`（ルート）= `node tests/run-all.js`（`tests/*.test.js`・約1212テスト）
- **Web側**: `cd worker && npm test` = `vitest run`（`*.test.ts`・約49テスト）
- ⚠️ ルート `npm test` は Web側を回さない（`run-all.js` が `.endsWith('.test.js')` でフィルタ）

**境界ファイル**（`worker/src/` 配下だが GAS側テストも `fs.readFileSync` で参照するファイル）:
- `reserve-page.html`（`e2e-phase3.test.js` が構造アサーションで監視）

**ルール**: 境界ファイル（`reserve-page.html` 等）を変更した時は **両方のテスト**（`npm test` + `cd worker && npm test`）を実行すること。片側だけの確認で完走宣言すると回帰を見逃す（2026-08-04 i18n完走の事故教訓：vitest側のみ確認→GAS側 `e2e-phase3` の innerHTML XSSゲートに引っかかる回帰を見逃した）。

**中期課題**（本ルールは文書ベースで遵守率弱）: vitest側にも同等のXSSゲート追加（両側ゲート二重化）or ESLint(`eslint-plugin-no-inner-html`)/lint-staged での自動検知化を検討。

---

## テスト実行履歴

### 2026-07-28: QuickReport機能 実装後 runAllTests 検証

**コマンド**: `npm test`（`node tests/run-all.js`）
**結果**: 合計 1241 / 通過 1238 / 失敗 3

**判定**: QuickReport 実装による regression なし。
- QuickReport 関連テストは全て合格（`unit-message-router` 170/170・純粋ロジック 9/9・QuickReportHandler/Service・Setup/ScriptProperties）
- QuickReport コミット群（`22af6c8`→`d55c6c5`）が触ったのは QuickReport 専用 8 ファイルのみ（CRM/Ticket/Segment のソースは非接触）

**失敗 3 件（全て pre-existing・QuickReport 開始前 `22af6c8` で実測確認済）**:

| テスト | 内容 | 由来 | 実GASへの影響 |
|---|---|---|---|
| `e2e-phase4-crm.test.js` | Node 環境に GAS `Utilities.getUuid()` モック不足でクラッシュ（CRMService.js:106） | テストインフラ | なし（実GASでは動作） |
| `e2e-phase5-ticket.test.js` | 回数券 `expiry_date` assertion fail（Failed:1/50） | Phase 5-3（`589c76a`） | 要確認 |
| `unit-segment-broadcast-service.test.js` | `getSegmentCustomers inactive:30` expected 1 got 2（Failed:1） | W3（`d3f5dc7`） | 要確認 |

**備考**: バックログ P3「reserve-optimizer pre-existing 赤テスト3件 修正」として登録済。
