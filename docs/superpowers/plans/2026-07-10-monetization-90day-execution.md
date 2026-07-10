# reserve-optimizer マネタイズ90日実行計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 90日以内にココナラ経由で有償構築1件目（29,800円）を受注し、12ヶ月で月10万円に至る営業・製品基盤を立ち上げる。

**Architecture:** 「出品が先・完璧な整備は後」の原則で、Week 1-2 は営業資材（出品ページ・文面・スクショ）のみで出品まで到達する。技術整備（業種汎用化・セットアップ自動化・E11公開デモ）は独立サブシステムのため本計画から**サブ計画に分離**し、受注前の空き時間で並行実行する。C並走（キット/note）は納品副産物の流用なので Week 3 以降に開始。

**Tech Stack:** ココナラ（販売）/ 既存 reserve-optimizer（GAS+Cloudflare Worker+Stripe）/ GitHub Pages（LP）/ note・BOOTH（C並走）

**Spec:** `docs/specs/2026-07-10_monetization-b-daiko-c-product-design.md`

---

## 90日全体マップ

| 週 | テーマ | 主タスク |
|---|---|---|
| W1 | 出品準備 | Task 1-3（プロフィール・出品文面・範囲定義） |
| W2 | **出品公開** | Task 4-5（画像パッケージ・出品公開）← 90日計画の最重要マイルストーン |
| W3-4 | 導線強化 | Task 6-8（LP・DM再開・note1本目）+ サブ計画A着手 |
| W5-8 | 受注体制 | サブ計画A/B実行・納品手順書v1・DM週10通・note月2本の定常運転 |
| W9-12 | 初納品→資産化 | 受注対応（最優先割込）・納品副産物→キット化（Task 10）・レビュー獲得 |
| W13 | 総括 | 90日レビュー（Task 11の週次レビュー最終回・価格/チャネル見直し） |

**割込ルール:** 受注・問い合わせ対応は常に全タスクに優先する。

---

### Task 1: ココナラアカウント・プロフィール整備（W1・人間+CC共同）

**Files:**
- Create: `docs/sales/profile.md`（プロフィール文面の原本管理）

- [ ] **Step 1: プロフィール文面を `docs/sales/profile.md` に作成**

```markdown
# ココナラ プロフィール（原本）

## 表示名
LINE予約システム工房（仮・匿名ハンドル）

## キャッチコピー
月額0円で動くLINE予約Bot、まるごと構築します

## 自己紹介
LINE公式アカウント×Google環境で動く予約システムを自作ツールで構築しています。
- 予約・変更・キャンセル・リマインダーを24時間自動化
- 月額ツール費0円（ポチコ等の予約SaaS費用が不要になります）
- 無断キャンセル対策の事前デポジット決済（Stripe）対応
- 多言語対応（6言語）・AIチャット対応
テスト1,300件超で品質管理された自作システムがベースのため、
相場より大幅に安く・早く納品できます。
副業のため返信は平日夜・土日中心ですが、24時間以内に必ず返信します。

## スキル・経歴欄
Google Apps Script / Cloudflare Workers / Stripe決済連携 / LINE Messaging API
```

- [ ] **Step 2: ココナラにアカウント登録し、上記文面を転記（人間操作）**

匿名ハンドル・アイコンはロゴ調（顔写真不使用）。本人確認はココナラ内手続き（出品に必要）。

- [ ] **Step 3: コミット**

```bash
git add docs/sales/profile.md
git commit -m "docs(sales): ココナラプロフィール文面の原本追加"
```

---

### Task 2: 出品ページ文面ドラフト（W1・CC）

**Files:**
- Create: `docs/sales/coconala-listing.md`

- [ ] **Step 1: 出品文面を作成**

```markdown
# ココナラ出品ページ（原本）

## タイトル（25字以内）
LINE予約システムを月額0円で構築します

## キャッチ（30字以内）
予約SaaS費が永久不要・無断キャンセル対策の決済対応も

## サービス内容
「LINEで予約を受けたいけど、月額ツールは高いし設定が大変…」
その両方を解決します。

【できあがるもの】
✅ LINE公式アカウントに予約Botを設置
　（お客様がLINE上で予約・変更・キャンセル・リマインダー受信）
✅ 予約はGoogleスプレッドシートに自動記録（管理画面いらず）
✅ 月額ツール費0円（お客様のGoogle環境で動くため）

【他社サービスとの違い】
・予約SaaS（月2,000〜3,300円）を契約し続ける必要がありません
　→ 2年で約8万円の節約 = 構築費は実質回収できます
・オプションで「事前デポジット決済」対応（無断キャンセル対策）
　※事前決済に対応した予約SaaSはほとんどありません

【料金プラン】
◆ ライト 39,800円 → 初回限定 29,800円（レビュー協力価格）
　LINE公式アカウント初期設定＋リッチメニュー＋予約Bot＋スプレッドシート管理
◆ スタンダード 79,800円
　ライト＋Stripeデポジット決済＋口コミ依頼自動化（高評価のみGoogle誘導）
◆ プレミアム 148,000円
　スタンダード＋多言語(6言語)/AIチャット/スタンプカード等から2機能
◆ 保守サポート 月4,980円（任意）
　動作監視・文言変更・LINE仕様変更への追従

【納品までの流れ】
1. チャットでヒアリング（メニュー・営業時間・定休日）
2. デモ環境で動作確認（実際に触っていただけます）
3. お客様のLINE公式アカウントに設置・動作確認
4. 操作マニュアルをお渡しして完了（目安：1〜2週間）

【対応できないこと（必ずお読みください）】
・LINE公式アカウントの利用停止/BAN・Stripe審査結果には関与できません
・LINE公式アカウント自体の月額（無料プランあり）はお客様負担です
・ホットペッパー等の外部予約サイトとの連携は対象外です

## 購入にあたってのお願い
店舗名・業種・希望メニュー数・営業時間をお知らせください。
```

- [ ] **Step 2: 文面の自己レビュー**

チェック: 誇大表現なし / 範囲外明記あり / 価格が§1と一致 / 「実質回収」の算数が誤解を招かない表現か。

- [ ] **Step 3: コミット**

```bash
git add docs/sales/coconala-listing.md
git commit -m "docs(sales): ココナラ出品ページ文面ドラフト追加"
```

---

### Task 3: サービス範囲・提供条件定義（W1・CC）

**Files:**
- Create: `docs/sales/scope-and-terms.md`

- [ ] **Step 1: 範囲定義ドキュメント作成**

```markdown
# サービス範囲・提供条件（内部原本）

## 含まれる（ライト）
- LINE公式アカウント開設代行 or 既存アカウント設定
- リッチメニュー画像1点（テンプレベース）+ 設定
- 予約Bot（予約/変更/キャンセル/前日リマインダー）
- 予約枠設定（営業時間・定休日・メニュー最大5件）
- スプレッドシート管理画面 + 操作マニュアル（PDF）
- 納品後2週間の無償不具合対応

## 含まれない（トラブル防止・出品ページにも明記）
- LINE公式アカウントのBAN/審査・Stripeアカウント審査
- 独自ドメイン・既存HP改修・外部予約サイト連携
- 納品後の仕様追加（保守契約 or 追加見積り）
- 集客成果の保証

## 検収条件
- デモ環境での動作確認をもって仕様確定
- 本番設置後、予約→通知→キャンセルの1往復確認で検収完了

## 決済・契約
- ココナラ内決済のみ（直接契約への誘導はしない・規約遵守）
```

- [ ] **Step 2: ココナラ利用規約との整合を確認**

確認観点: 外部誘導禁止 / 直接取引禁止 / 出品カテゴリ（IT・プログラミング > プログラミング・システム開発）。問題があれば文面修正。

- [ ] **Step 3: コミット**

```bash
git add docs/sales/scope-and-terms.md
git commit -m "docs(sales): サービス範囲・提供条件の内部原本追加"
```

---

### Task 4: 出品用画像パッケージ（W2・CC+人間）

**Files:**
- Create: `docs/sales/images/`（出品用に選定した画像の置き場）

- [ ] **Step 1: 既存アセットから出品画像を選定**

流用元: `docs/screenshots/01-treatment.png`〜`06-complete.png`・`docs/screenshots/demo-flow.gif`・`docs/demo/gifs/`。ココナラ規格（横1220×720px推奨・最大10枚）に合わせトリミング。

- [ ] **Step 2: 1枚目（サムネイル）に文字入れ**

構成: 左=スマホでの予約フロー画面 / 右=「月額0円で動くLINE予約Bot」「予約SaaS費が永久不要」の2行コピー。

- [ ] **Step 3: `docs/sales/images/` に保存してコミット**

```bash
git add docs/sales/images/
git commit -m "docs(sales): ココナラ出品用画像パッケージ追加"
```

---

### Task 5: 出品公開（W2・人間）🏁最重要マイルストーン

- [ ] **Step 1: Task 1-4の成果物をココナラに転記し出品申請（人間操作）**
- [ ] **Step 2: 出品URL・公開日を `docs/sales/coconala-listing.md` 冒頭に追記**
- [ ] **Step 3: SSOTに記録（ssot-recordスキル・バックログの該当タスクに出品日を追記）**
- [ ] **Step 4: コミット**

```bash
git add docs/sales/coconala-listing.md
git commit -m "docs(sales): ココナラ出品公開・URL追記"
```

---

### Task 6: GitHub Pages 1枚LP（W3・CC）

**Files:**
- Modify: `docs/index.md`（既存GitHub Pagesのトップを営業LP化）
- Modify: `docs/_config.yml`（タイトル・description調整）

- [ ] **Step 1: `docs/index.md` を営業LP構成に書き換え**

構成（上から順）: キャッチコピー →「触れるデモ」ボタン（E11完成までは`docs/screenshots/demo-flow.gif`埋め込みで代替）→ 3つの差別化（月額0円/デポジット決済/多言語）→ 料金3プラン表 → ココナラ出品ページへのリンク → よくある質問3件（範囲外事項の明記）。文面はTask 2の出品文面を流用。

- [ ] **Step 2: ローカルプレビューで表示崩れ確認後コミット**

```bash
git add docs/index.md docs/_config.yml
git commit -m "docs: GitHub PagesトップをLP化（デモ・料金・ココナラ導線）"
```

---

### Task 7: X DM営業の再開（W3〜継続・人間+CC）

**Files:**
- Create: `docs/sales/dm-templates.md`（2026-04テンプレの改訂版）

- [ ] **Step 1: SSOT `01_DECISIONS/reserve-optimizer/2026-04-19_ピボット-DMアウトリーチ準備.md` のテンプレ・検索クエリを取得し、ココナラ導線版に改訂**

変更点: 「無料導入」→「デモを触ってみてください（LPリンク）+ ご興味あればココナラから」に差し替え（決済・契約をプラットフォームに乗せる）。共感型・デモ型・フォローアップの3種を維持。

- [ ] **Step 2: `docs/sales/dm-templates.md` に保存しコミット**

```bash
git add docs/sales/dm-templates.md
git commit -m "docs(sales): X DMテンプレをココナラ導線版に改訂"
```

- [ ] **Step 3: 週10通の送信を定常運転化（人間操作・W3以降毎週）**

記録: 送信数・返信数を週次レビュー（Task 11）で集計。

---

### Task 8: note記事1本目（W4・CC下書き+人間投稿）

**Files:**
- Create: `docs/sales/note-drafts/01-line-yoyaku-0yen.md`

- [ ] **Step 1: 記事下書き作成**

タイトル案: 「LINE予約システムを『月額0円』で動かす仕組みを作った話」。構成: 予約SaaSの月額の現実（ポチコ3,300円/リピッテ1,980円）→ Google環境で自走させる設計 → デモGIF → 「構築代行やってます」（ココナラリンク）。技術深掘りはせず店舗オーナー向けの平易さを維持（1,500〜2,500字）。

- [ ] **Step 2: コミット後、noteに投稿（人間操作）し公開URLを追記**

```bash
git add docs/sales/note-drafts/01-line-yoyaku-0yen.md
git commit -m "docs(sales): note記事1本目ドラフト"
```

---

### Task 9: 技術整備サブ計画の作成と実行（W3-8・CC）

> 独立サブシステムのため本計画から分離（writing-plans Scope Check準拠）。**着手時にそれぞれ writing-plans でコード調査込みのサブ計画を作成**してから実行する。

- [ ] **Step 1: サブ計画A「業種汎用化+納品手順書」を writing-plans で作成**

対象spec: `docs/specs/2026-07-10_monetization-b-daiko-c-product-design.md` §5-1・§5-2。調査対象: `gas-project/config/ScriptProperties.js`（メニュー・営業時間の可変化）・`gas-project/templates/MessageTemplates.js`（初診/再診→初回/リピート文言）・`gas-project/Setup.js`（複製セットアップ手順）。ゴール: 新規顧客向けセットアップ3時間以内 + 納品チェックリストv1。保存先: `docs/superpowers/plans/2026-07-XX-genericization-and-delivery.md`

- [ ] **Step 2: サブ計画Aを実行（TDD・既存1,300+テスト全PASS維持）**

- [ ] **Step 3: サブ計画B「E11公開デモ」= 既存Plan A2を作成・実行**

前提spec: `docs/specs/2026-06-26_phase-alpha-recruitment-demo-design.md`（毎時リセット・GLM回数制限は設計済み）。完成後、Task 6のLPの「触れるデモ」ボタンをGIF埋め込み→実デモURLに差し替える。

---

### Task 10: セルフ構築キット化（W9-12・初納品後・CC）

**Files:**
- Create: `docs/sales/kit/`（キット原本）

- [ ] **Step 1: 初納品で作成したマニュアル・手順を匿名化・汎用化して `docs/sales/kit/` に集約**
- [ ] **Step 2: BOOTH/ココナラに「セルフ構築キット 19,800円」として出品（人間操作）**
- [ ] **Step 3: note有料記事（980円）にノウハウの一部を切り出しキット導線を設置**
- [ ] **Step 4: コミット + ssot-recordで記録**

```bash
git add docs/sales/kit/
git commit -m "docs(sales): セルフ構築キット原本追加"
```

---

### Task 11: 週次レビュー（毎週金曜・W1-13・CC+人間）

**Files:**
- Create: `docs/sales/weekly-review.md`（1ファイルに追記型）

- [ ] **Step 1: 初回にKPIテーブルの雛形を作成**

```markdown
# 週次レビュー（毎週金曜・5分）

| 週 | 出品PV | お気に入り | 問合せ | DM送信/返信 | 受注 | 売上 | 来週の一手 |
|---|---|---|---|---|---|---|---|
| W1 | - | - | - | - | - | - | 出品公開 |
```

- [ ] **Step 2: 毎週金曜に1行追記（数字ゼロでも記録する — 「実行されない再演」の検知装置）**

停滞判定: **W2終了時点で出品未公開なら他の全タスクを止めて出品のみに集中**。W8終了時点で問合せ0なら価格・タイトル・画像をA/Bテスト（ココナラ内で編集可）。

- [ ] **Step 3: 毎週コミット**

```bash
git add docs/sales/weekly-review.md
git commit -m "docs(sales): 週次レビューW{N}追記"
```

---

## Self-Review結果

- **Spec coverage**: §1価格→Task 2/6・§2チャネル4本→Task 1-8・§3キット→Task 10・§4数値→Task 11 KPI・§5整備6項目→Task 9（サブ計画A/B）+Task 3/6（法務・LP・請求はココナラ一本化=Task 3）・§6リスク→Task 2/3の範囲外明記+Task 11の停滞判定 ✅
- **Placeholder scan**: 技術タスクの実コードは意図的にサブ計画A/Bへ分離（Scope Check準拠・着手時にコード調査込みで作成）。ops系タスクは実文面を記載済み ✅
- **一貫性**: 価格（29,800/39,800/79,800/148,000/4,980/19,800円）はspec §1・§3と全タスクで一致 ✅
