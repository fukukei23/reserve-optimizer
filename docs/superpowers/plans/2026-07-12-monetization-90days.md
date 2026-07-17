# reserve-optimizer マネタイズ実行計画（90日）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 90日以内にココナラで有償1件目（29,800円）を獲得し、月10万円/12ヶ月の基盤を構築する。

**Architecture:**
- **B主軸**: 構築代行（ココナラ匿名・テキスト完結・初案件29,800円→保守月4,980円でストック化）
- **C並走**: セルフ構築キット19,800円（BOOTH/ココナラ）+ note有料記事980円
- **営業動線**: ココナラ主戦場 + E11デモURLが営業資産 + X DM週10通（2026-04テンプレ再利用）
- **再演防止**: §6「最初の2週間=出品ページ下書き着手・週次タスクで強制実行」

**Tech Stack:**
- GAS (clasp) / Stripe / LINE Messaging API / Node.js (Wrangler) / Python (Playwright for demo) / GitHub Pages
- 既存資産: `gas-project/` (Setup.js / DoGet.js / Dashboard.js等), `docs/demo/`, `scripts/record_demo.py`
- SSOT: `~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-07-10_マネタイズ戦略策定-構築代行主軸.md`
- 仕様: `docs/specs/2026-07-10_monetization-b-daiko-c-product-design.md`

**前提spec承認状況:** 2026-07-10 ユーザー正式承認済。本計画はその §1〜6 を90日週次に分解する。

---

## Phase 0: 即着手（第1-2週・再演防止の最重点）

> spec §6 「最初の2週間は『ココナラ出品ページ下書き』から着手・90日計画を週次タスク化」の徹底。
> **整備が完璧になる前に出品ページを起こす**ことが目的。1円の入金より「出品ページが存在し公開できる状態」を最初の成果物とする。

### Task 0.1: ココナラ出品ページ下書き（Markdown）

**Files:**
- Create: `docs/marketing/coconala-draft.md`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p /home/yn4416/projects/reserve-optimizer/docs/marketing/
```

- [ ] **Step 2: 出品ページMarkdown下書きを書く**

`docs/marketing/coconala-draft.md` を作成：

```markdown
---
service: coconala_listing_draft
created: 2026-07-12
price_initial: 29800
target_persona: 個人サロン・セラピスト・整体・ネイル等の小規模店舗オーナー
---

# サービスタイトル（25文字以内）
【初期費用0円】LINEで予約完結│サロン専用Bot導入

# カテゴリ
IT・プログラミング > Webシステム開発 > LINE連携

# キャッチコピー
"ポチコ月3,300円が永久0円" — 自社ツールで構築費2年で実質回収

# 内容説明（Markdown・2000文字以内）

## こんな方におすすめ
- 小規模サロン・整体・セラピスト・ネイル・まつエク等1〜3名店舗
- 電話や手動DM予約をLINEで自動化して本業に集中したい方
- 月額SaaSに抵抗があり初期導入コストで済ませたい方

## 提供内容（ライトプラン・29,800円）
- LINE公式アカウント初期設定（友達追加QRコード含む）
- リッチメニュー（3タブ：予約/確認/お問い合わせ）
- 予約Bot（予約/変更/キャンセル/リマインダー自動送信）
- スプレッドシートでの予約管理画面
- 操作方法マニュアル（PDF）

## なぜこのサービスを選ぶべきか
- **金額メリット**: 他社SaaSは月額3,300円〜。本サービスは買い切り型のため2年利用で約8万円削減
- **無断キャンセル対策**（スタンダード以上）: Stripeデポジット決済で予約時・現地で自動的に金額保全
- **口コミ自動化**（スタンダード以上）: ★4-5評価時のみ自動でGoogle口コミ誘導
- **オープンソース技術**: 自社で運用可能。撤退時のロックイン無し

## 納品までの流れ
1. 購入後チャットで「業種・営業時間・メニュー」を共有
2. 3営業日で初期設定完了 → 確認テスト
3. 運用マニュアル共有・操作説明会（15分のテキストチャット）→ 納品完了

## 注意事項
LINE/Stripeのアカウント取得は購入者様でお願いします（本人確認書類が必要です）。
公開デモURLをプロフィール欄に掲載中。
```

- [ ] **Step 3: ファイルサイズ確認**

```bash
wc -l /home/yn4416/projects/reserve-optimizer/docs/marketing/coconala-draft.md
```

期待: `40行前後` が出力されることを確認（下書きの体裁を維持）

- [ ] **Step 4: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/coconala-draft.md && git commit -m "feat(marketing): ココナラ出品ページMarkdown下書き(ライト29,800円)"
```

### Task 0.2: ココナラアカウント・プロフィール準備

**Files:**
- Create: `docs/marketing/coconala-profile-draft.md`

- [ ] **Step 1: プロフィール文下書き**

`docs/marketing/coconala-profile-draft.md` を作成：

```markdown
# ココナラプロフィール文（500文字以内・匿名運用）

---

業務歴10年以上のエンジニアが、個人サロン・小さな店舗向けにLINE予約システムを構築代行します。

【対応】
・LINE公式アカウント初期設定〜Bot構築
・予約/変更/キャンセル/リマインダー自動化
・スプレッドシートでの予約管理画面構築
・Stripeデポジット決済連携（※追加プラン）

【強み】
・買い切り型：月額SaaS代2年分を1度の構築で実質回収
・キャンセル対策：Stripe決済で無断キャンセルを金額化
・運用サポート：保守契約（4,980円/月）で仕様変更時も安心

【公開デモ】
実機動作するデモを公開中。プロフィール欄のリンクから「触ってみる」が可能です。

納品は全てチャット完結。匿名・テキストベースで対応します。
お気軽にどうぞ。
```

- [ ] **Step 2: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/coconala-profile-draft.md && git commit -m "feat(marketing): ココナラプロフィール文下書き(匿名運用・500文字)"
```

### Task 0.3: 価格・パッケージ3段階の対比表作成

**Files:**
- Create: `docs/marketing/packages-table.md`

- [ ] **Step 1: 3パッケージ対比表Markdown作成**

`docs/marketing/packages-table.md` を作成：

```markdown
# パッケージ対比表（ココナラ出品用・Markdown・拡張用Web）

| 機能 | ライト(29,800円) | スタンダード(79,800円) | プレミアム(148,000円) |
|---|---|---|---|
| LINE公式アカウント初期設定 | ✅ | ✅ | ✅ |
| リッチメニュー(3タブ) | ✅ | ✅ | ✅ |
| 予約/変更/キャンセルBot | ✅ | ✅ | ✅ |
| リマインダー自動送信 | ✅ | ✅ | ✅ |
| スプレッドシート管理画面 | ✅ | ✅ | ✅ |
| Stripeデポジット決済 | ✗ | ✅ | ✅ |
| 口コミ依頼自動化(★4-5のみ) | ✗ | ✅ | ✅ |
| 多言語6言語対応 | ✗ | ✗ | ✅(選択2) |
| AIチャット | ✗ | ✗ | ✅(選択2) |
| スタンプカード | ✗ | ✗ | ✅(選択2) |
| サブスクリプション | ✗ | ✗ | ✅(選択2) |
| 保守(任意・4,980円/月) | オプション | オプション | オプション |
```

- [ ] **Step 2: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/packages-table.md && git commit -m "feat(marketing): パッケージ対比表(3段階・拡張Web用Markdown)"
```

---

## Phase 1: 営業基盤構築（第3-4週）

### Task 1.1: E11公開デモ実装（spec流用）

**Files:**
- Read: `docs/specs/2026-06-26_phase-alpha-recruitment-demo-design.md`
- Create: `scripts/demo-reset-trigger.sh`

- [ ] **Step 1: 既存spec読込**

```bash
cat /home/yn4416/projects/reserve-optimizer/docs/specs/2026-06-26_phase-alpha-recruitment-demo-design.md | head -80
```

期待: 公開デモ仕様（毎時リセット・GLM回数制限）の記述を確認

- [ ] **Step 2: デモURL運用スクリプト作成**

`scripts/demo-reset-trigger.sh` を作成：

```bash
#!/usr/bin/env bash
# E11デモリセット・状態監視スクリプト
# Usage: ./scripts/demo-reset-trigger.sh status|reset
set -euo pipefail

case "${1:-status}" in
  status)
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Demo environment status:"
    if [ -f /tmp/demo-last-reset ]; then
      echo "Last reset: $(cat /tmp/demo-last-reset)"
    else
      echo "Last reset: unknown (初回起動)"
    fi
    ;;
  reset)
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Triggering demo reset..."
    # 実環境では GAS API または Worker (Cloudflare) API を叩く
    # 現時点では状態ファイルの更新のみ
    date -u +%Y-%m-%dT%H:%M:%SZ > /tmp/demo-last-reset
    echo "Reset recorded"
    ;;
  *)
    echo "Usage: $0 status|reset" >&2
    exit 1
    ;;
esac
```

- [ ] **Step 3: 実行権限付与**

```bash
chmod +x /home/yn4416/projects/reserve-optimizer/scripts/demo-reset-trigger.sh
```

- [ ] **Step 4: status実行テスト**

```bash
/home/yn4416/projects/reserve-optimizer/scripts/demo-reset-trigger.sh status
```

期待: `Last reset: unknown (初回起動)` などのメッセージ

- [ ] **Step 5: resetテスト後 status確認**

```bash
/home/yn4416/projects/reserve-optimizer/scripts/demo-reset-trigger.sh reset
/home/yn4416/projects/reserve-optimizer/scripts/demo-reset-trigger.sh status
```

期待: 2回目のstatusで `Last reset: <UTC timestamp>` が出力

- [ ] **Step 6: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add scripts/demo-reset-trigger.sh && git commit -m "feat(demo): E11デモ状態監視・リセットトリガースクリプト(status/reset)"
```

### Task 1.2: 営業LP（GitHub Pages・1枚）

**Files:**
- Create: `docs/marketing/lp-draft.md`

- [ ] **Step 1: LP仕様Markdown作成**

`docs/marketing/lp-draft.md` を作成：

```markdown
---
title: LINE予約を月額0円で。サロン専用Bot構築代行
description: ポチコ月3,300円が永久0円。買い切り型LINE予約Bot構築を業界最安水準で。
---

# LINE予約を月額0円で。

[![公開デモを試す](https://img.shields.io/badge/Demo-触ってみる-00C300?style=for-the-badge)](#)
[![ココナラで依頼](https://img.shields.io/badge/Coconala-出品ページ-F7A800?style=for-the-badge)](#)

## 数字で見る価値

| 比較対象 | 月額 | 2年合計 |
|---|---|---|
| ポチコ | 3,300円 | 79,200円 |
| リピッテ | 1,980円〜 | 47,520円〜 |
| **本サービス(ライト)** | **0円** | **29,800円(初期のみ)** |

→ 構築費を2年で実質回収。

## 3つの強み

### 1. 買い切り型
月額SaaSと違い、初期構築費のみ。撤退しても再請求無し。

### 2. キャンセル対策
Stripeデポジット決済で無断キャンセルを金額化（※スタンダード以上）。

### 3. 口コミ自動化
★4-5評価時のみ自動でGoogle口コミ誘導（※スタンダード以上）。

## 納品までの3ステップ

1. チャットで業種・営業時間・メニューを共有
2. 3営業日で初期構築完了
3. テスト → 納品（15分のテキスト操作説明会付き）

## 対象業種

- 個人サロン・セラピスト
- 整体・接骨・マッサージ
- ネイル・まつエク・アイラッシュ
- ピラティス・ヨガの少人数クラス
- 小規模歯科・美容クリニック

## FAQ

### Q. 自社LINEアカウントが必要？
A. はい。アカウント開設サポートも対応しています。

### Q. 仕上がりに満足できなければ？
A. 納品前は無条件で作り直し対応。

### Q. 解約は自由？
A. 買い切り型のため契約自体がありません。

---

**詳細は[公開デモ](#)を触ってみてください** — 実機で予約動線が確認できます。
```

- [ ] **Step 2: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/lp-draft.md && git commit -m "feat(marketing): 営業LP Markdown下書き(GitHub Pages用1枚)"
```

---

## Phase 2: 既存テンプレート整理（第5週）

### Task 2.1: X DMテンプレ再利用準備

**Files:**
- Read: `~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-04-19_ピボット-DMアウトリーチ準備.md`
- Create: `docs/marketing/x-dm-templates.md`

- [ ] **Step 1: 既存DMテンプレ確認**

```bash
cat ~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-04-19_ピボット-DMアウトリーチ準備.md
```

期待: 2026-04作成のDMテンプレ・X検索クエリが含まれている

- [ ] **Step 2: 再利用版DMテンプレ作成**

`docs/marketing/x-dm-templates.md` を作成：

```markdown
---
purpose: X DM週10通アウトバウンド用(2026-07-12時点版)
reuse_from: 2026-04-19 DMアウトリーチ準備
target_persona: 個人サロン・整体・セラピスト系店舗オーナー
---

# X DM テンプレート（週10通・テキスト完結）

## 検索クエリ（再利用）

```
"LINE予約" 整体 OR サロン OR セラピスト since:2026-07-01 -filter:verified
"予約システム サロン" -filter:verified lang:ja
"無断キャンセル" 整体 OR サロン lang:ja
```

## DM テンプレート（3種・曜日別）

### 月/水/金: 初回ライト訴求（29800円）

```
はじめまして。LINE予約Bot構築代行をしている者です。
プロフィールを見させて頂き、整体院/サロン向けのサービスに共感しました。

LINEの予約を「買い切り型」で構築するサービスを提供しており、
月額SaaS（ポチコ3,300円等）の代わりにご利用頂ければ、
2年で構築費を実質回収できます。

公開デモを公開しております（実機で予約動線が確認できます）。
興味があれば、お気軽にお声がけください。
```

### 火/木: キャンセル対策訴求

```
失礼します。LINE予約Bot構築関連のサービスをしている者です。

サロン・整体院での「無断キャンセル」でお悩みではないでしょうか。
Stripeデポジット決済を組み合わせた予約Botを構築すると、
予約時に金額を保全できるため、キャンセル時の損害を最小化できます。

無料相談も歓迎です。よろしければデモURLもお送りできます。
```

### 土曜: 週末リスト確認・来週向け

```
いつもDM失礼します。予約Bot構築代行サービスの[名前]です。
[曜日]はリサーチで多くのサロンオーナーとお話しできたので、
来週は[特定曜日]に5通送ろうと考えています。

過去に「LINE予約を構築してみたい」と思ったきっかけは、
どんな経験でしたか？可能な範囲で教えて頂けると助かります。
```

## 数値目標

- 週10通(コールド)
- 開封率目安: 20-30% (業界平均)
- 返信率目安: 3-5%
- → 週0.3〜0.5件リアクション・月1〜2件商談化の想定

## 注意点

- 1日5通まで(プラットフォームガイドライン)
- フォローは不要(本文で完結)
- 決済・契約はココナラに誘導(個人間トラブル回避)
- 1週間返信なければブロックOK
```

- [ ] **Step 3: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/x-dm-templates.md && git commit -m "feat(marketing): X DMテンプレ3種(2026-04版を7月時点に更新・週10通)"
```

---

## Phase 3: 初期営業開始（第6-8週）

### Task 3.1: 週次営業レビュー用スプレッドシート雛形

**Files:**
- Create: `docs/marketing/crm-tracking-template.md`

- [ ] **Step 1: CRM追跡テンプレ作成**

`docs/marketing/crm-tracking-template.md` を作成：

```markdown
---
purpose: 週次営業KPI追跡シート雛形
tool: Google Sheets想定（.csv/Excel化可能）
---

# 週次営業トラッキング（90日・4column）

| 週 | 開始日 | DM送付数 | 反応数 | ココナラ注文件数 |
|---|---|---|---|---|
| W1 | 2026-07-12 | 0 | 0 | 0（下書き作成） |
| W2 | 2026-07-19 | 5 | 0 | 0（出品ページ公開準備） |
| W3 | 2026-07-26 | 10 | 1 | 0（デモ公開） |
| W4 | 2026-08-02 | 10 | 2 | 0（LP公開） |
| W5 | 2026-08-09 | 10 | 3 | 0 |
| W6 | 2026-08-16 | 10 | 3 | 1 ← **目標達成** |
| W7-12 | W6達成後継続 | - | - | - |

## 追跡KPI

- DM反応率 = 反応数 / DM送付数
- ココナラ成約率 = 注文件数 / プロフィール閲覧数（出品ページanalytics）
- 単価維持率 = 実際単価 / 設定単価（値下げ圧力を監視）

## 月次レビュー（30日毎）

- 90日目標達成状況
- 反応パターン分析（どの業種・どの曜日が反応良いか）
- DM文面A/Bテスト結果
```

- [ ] **Step 2: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/crm-tracking-template.md && git commit -m "feat(marketing): 週次営業トラッキング雛形(90日・4column)"
```

---

## Phase 4: C並走（第9-10週）

### Task 4.1: セルフ構築キットdraft準備

**Files:**
- Create: `docs/marketing/self-build-kit-outline.md`

- [ ] **Step 1: キット目次作成**

`docs/marketing/self-build-kit-outline.md` を作成：

```markdown
---
title: セルフ構築キット 19,800円(BOOTH/ココナラ)
target: 自社でLINE予約を構築したい個人事業主（エンジニア基礎知識必須）
delivery: PDF + 動画URL + チャットサポート1週間
creation_cost_per_order: 2-3時間（納品物の匿名化・汎用化のみ）
---

# セルフ構築キット目次(案)

## 第1部: 事前準備（30分）
- 1.1 LINE公式アカウント開設手順
- 1.2 Stripeアカウント開設（コンビニリブランド本人確認込み）
- 1.3 Google Apps Scriptプロジェクトの作成

## 第2部: コア実装（4-6時間）
- 2.1 GAS基本構造（doGet / doPost）
- 2.2 LINE Messaging APIイベント受信
- 2.3 スプレッドシート管理画面との連携
- 2.4 リッチメニュー設定
- 2.5 リマインダー自動送信（time-based trigger）

## 第3部: 拡張機能（必要なものだけ・各30分）
- 3.1 Stripeデポジット決済連携
- 3.2 口コミ誘導（評価フィルタ付き）
- 3.3 多言語対応（i18nテンプレート）

## 第4部: 運用・デバッグ（1-2時間）
- 4.1 ログの見方
- 4.2 LINE/GAS仕様変更時の対応フロー
- 4.3 よくある質問（FAQ）

## チャットサポート
- 7日間・平日10-18時
- 1日最大3往復まで

---

## 目次決定後に実施すること

1. PowerPointテンプレート起こし
2. 動画収録(GAS画面 + 音声解説・合計30-60分)
3. note記事(無料)→ キット購入の導線化
4. BOOTH/ココナラ商品ページ作成
```

- [ ] **Step 2: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/self-build-kit-outline.md && git commit -m "feat(marketing): セルフ構築キット19,800円目次案(C並走)"
```

---

## Phase 5: 1件目獲得後の標準化（第11-12週）

### Task 5.1: 納品フローのチェックリスト化

**Files:**
- Create: `docs/marketing/delivery-checklist-template.md`

- [ ] **Step 1: 納品フローチェックリスト作成**

`docs/marketing/delivery-checklist-template.md` を作成：

```markdown
# 納品フローチェックリスト（ライト・標準29,800円）

## 受領時（ココナラチャットで収集）
- [ ] 業種（例: 整体・ネイル等）
- [ ] 営業時間（曜日ごと）
- [ ] メニュー名と所要時間
- [ ] 店舗住所（LINE Botのリッチメニューで使う場合）
- [ ] LINE公式アカウントID（QRコード）
- [ ] スプレッドシート共有URL（オーナー権限付与）

## 構築（3営業日目標）
- [ ] GASプロジェクト複製（セットアップスクリプトで自動化）
- [ ] LINE公式アカウント接続情報設定
- [ ] リッチメニュー3タブ設定
- [ ] 予約Bot設定（業種汎用化済みテンプレート適用）
- [ ] リマインダー設定
- [ ] スプレッドシート管理画面テスト
- [ ] スクリプトプロパティ設定検証

## 納品前テスト
- [ ] 友だち追加 → メニュー表示 → 予約フロー（5パターン）
- [ ] 変更・キャンセルフロー
- [ ] リマインダー送信タイミング確認
- [ ] オーナー側スプレッドシート予約表示確認
- [ ] 異常系（満員・時間外・スプレッドシート上限等）

## 納品
- [ ] オーナーにLINE Bot動作確認依頼（QRコード+テスト手順送信）
- [ ] 運用PDFマニュアル共有
- [ ] 15分以内のチャット操作説明実施
- [ ] ココナラ評価依頼（4-5誘導）

## 納品後
- [ ] 保守契約（4,980円/月）の任意案内
- [ ] 次案件対応の営業機会として記録（CRMシート記入）
```

- [ ] **Step 2: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/delivery-checklist-template.md && git commit -m "feat(marketing): 納品フローチェックリスト(ライト29,800円・3営業日)"
```

---

## Phase 6: 月次レビュー・12ヶ月計画準備（第13週）

### Task 6.1: 月次レビューテンプレート

**Files:**
- Create: `docs/marketing/monthly-review-template.md`

- [ ] **Step 1: 月次レビューテンプレート作成**

`docs/marketing/monthly-review-template.md` を作成：

```markdown
# 月次レビュー（30日毎・90日以内に3回実施）

## レビュー項目

### 1. 数値目標の達成状況

| 項目 | 目標 | 実績 | 差分 | 原因 |
|---|---|---|---|---|
| DM送付数 | 月40通 | | | |
| 反応数 | 月4通(10%) | | | |
| ココナラ面談数 | 月2件 | | | |
| 受注件数 | 月1件 | | | |
| 売上 | 月30,000円〜 | | | |

### 2. 良かった点（続けたい）
- 例: 「火曜日のDM反応率が良かった」

### 3. 改善点（変えたい）
- 例: 「水曜日の文面がピンと来ない反応だった」

### 4. 次月の実験
- 例: 「業種の対象をサロン系→歯科系にも広げる」

### 5. リスク・懸念
- 公務員名義問題: ココナラ匿名運用継続で問題なし
- LINE/GAS仕様変更: 現時点で検知なし
- 資金繰り: 90日までは副業収入ゼロ前提のため、副業なしでも生活できる計画か確認

### 6. 12ヶ月計画への接続状況

90日目標（有償1件目）が達成できた場合：
- 6ヶ月目標達成確率の自己評価
- 12ヶ月目標達成確率の自己評価
- D案発動（代行者卸し）の是非

90日目標未達成の場合：
- 中止判断 / 方針転換（D案・E案）をいつまでに判断するか
- 中止する場合の出口（E案・事業売却）

---

## 振り返り時にSSOTへ記録

完了したら `~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/YYYY-MM-DD_月次レビュー-N回目.md` を作成する。
```

- [ ] **Step 2: コミット**

```bash
cd /home/yn4416/projects/reserve-optimizer && git add docs/marketing/monthly-review-template.md && git commit -m "feat(marketing): 月次レビューテンプレート(90日以内に3回実施)"
```

---

## 実行チェックリスト（週次メンテナンス）

> 毎セッション開始時に確認する週次TODO。**実装計画ではなく運用チェック**。

### Week 1-2（Phase 0）
- [ ] ココナラアカウント開設（実作業はユーザー判断・ガイドはdocs/marketing/）
- [ ] Task 0.1 / 0.2 / 0.3 完了
- [ ] 出品ページ下書き → 公開（ユーザーが実機で行う）
- [ ] SSOT記録 `~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-MM-DD_初回出品-公開.md`

### Week 3-4（Phase 1）
- [ ] E11デモURLをプロフィール欄に掲載
- [ ] 営業LP（GitHub Pages）公開
- [ ] SNSで告知（X投稿1本）
- [ ] SSOT記録 `2026-MM-DD_E11デモ公開.md`

### Week 5（Phase 2）
- [ ] DMテンプレ最新版をX送信準備
- [ ] 検索クエリで10件のターゲット抽出

### Week 6-8（Phase 3）
- [ ] DM送付（週10通）
- [ ] CRMトラッキング記録
- [ ] 反応パターン分析

### Week 9-10（Phase 4）
- [ ] note記事1本公開
- [ ] セルフ構築キット目次確定
- [ ] BOOTH/ココナラ出品ページ作成

### Week 11-12（Phase 5）
- [ ] 1件目受注済みの場合：納品 → 評価獲得
- [ ] 受注なしの場合：営業文面改善 or 業種ターゲット変更
- [ ] 保守契約案内（受注案件の +30%程度を想定）

### Week 13（Phase 6）
- [ ] 月次レビュー1回目実施
- [ ] SSOT記録（30日振り返り）
- [ ] 次30日計画への反映

---

## 完了基準

### 90日目標達成（有償1件目）
- [ ] ココナラで1件以上の注文を受注
- [ ] 納品完了
- [ ] ★4以上の評価獲得
- [ ] SSOT記録（受注〜納品〜評価まで）

### 90日目標未達成の場合の分岐
- 自動継続: 120日目に2回目レビュー
- 方針転換判断: D案発動（代行者卸し）への移行検討
- 中止判断: E案（事業売却）またはスキル/プロダクトへの移行

---

## 関連リンク

- SSOT決定: `~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-07-10_マネタイズ戦略策定-構築代行主軸.md`
- spec: `docs/specs/2026-07-10_monetization-b-daiko-c-product-design.md`
- 既存仕様: `docs/specs/2026-06-26_phase-alpha-recruitment-demo-design.md` (E11デモ)
- DMテンプレ源流: `~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-04-19_ピボット-DMアウトリーチ準備.md`
- ピボット経緯: `~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-04-17_LINE予約ピボット.md`
- 競合分析: `~/projects/obsidian-ssot/01_DECISIONS/reserve-optimizer/2026-06-12_競合分析と機能ロードマップ策定.md`
