---
title: ココナラ出品画像 追加up手順ガイド（5枚→10枚）
created: 2026-07-24
purpose: Phase1デモ画像拡充で作成した追加画像5枚をココナラ出品に追加する手順
related: coconala-draft.md / coconala-images/ / coconala-blog-line-reservation.md
---

# ココナラ出品画像 追加up手順ガイド

## 概要（💡 何をやるか）

ココナラ出品（サービスID 4316257）の画像を **現在5枚 → 最大10枚** に拡充。
実績0のハンデを「機能・価格・比較が一目で伝わる情報画像」で補強する。

📖 **かみ砋くと**: 買う人が「実績ないけど本当に大丈夫？」と迷うのを、中身の濃い画像で「しっかりしていそう」と安心させる仕上げ。

## 追加画像5枚（`docs/marketing/coconala-images/` 配下）

| ファイル | 内容 | 役割 |
|---|---|---|
| `06_compare.png` | 月額SaaS比較表 | 「月額0円」の優位性を一眼で |
| `07_features.png` | できること一覧（5機能） | 「これだけできる」訴求 |
| `08_sheet.png` | スプレッドシート管理画面 | 管理側メリットの可視化 |
| `09_price.png` | 価格・オプション表 | 明朗会計アピール |
| `10_case.png` | 導入事例（Before→After） | 共感・実績0をイメージで補強 |

> 全て既存5枚と同じデザイン（1220×1240px・LINE緑基調）で統一感あり。

## 推奨する10枚の表示順（興味→理解→信頼→行動）

ココナラは出品画像の**表示順序を変更可能**。以下の順を推奨:

| 枚目 | 画像 | 理由 |
|---|---|---|
| 1 | `01_banner.png` | メインバナー（人物入り・必ず先頭） |
| 2 | `03_reservation.png` | 予約画面（「こう予約できる」の核） |
| 3 | `07_features.png` | 機能一覧（できることを一眼で） |
| 4 | `06_compare.png` | 比較表（他社との差別化） |
| 5 | `02_richmenu.png` | リッチメニュー（入口の簡単さ） |
| 6 | `08_sheet.png` | スプレッドシート（管理のしやすさ） |
| 7 | `04_payment.png` | 決済画面（オプションの魅力） |
| 8 | `09_price.png` | 価格表（明朗会計） |
| 9 | `10_case.png` | 導入事例（共感・安心） |
| 10 | `05_flow.png` | 納品フロー（最後の安心感） |

## ココナラでの画像追加手順

1. ココナラにログイン → マイページ → サービス管理 → 当該サービス（ID 4316257）を編集
2. 「サービス画像」欄で既存5枚の下に `06-10.png` を5枚アップロード
3. 上記「推奨10枚の表示順」にドラッグで並び替え
4. 必要に応じて各画像にキャプション（下記参照）
5. 保存（公開中のサービスは即反映）

### 各画像のキャプション案（任意・ココナラ画像説明欄）

- `06_compare.png`: 「月額の予約システムとの違い。最大の特徴は月額費用がずっと0円であること」
- `07_features.png`: 「LINE予約Botでできること5つ。24時間受付からスプレッドシート管理まで」
- `08_sheet.png`: 「予約はスプレッドシートに自動記録。スマホ・PCからいつでも確認」
- `09_price.png`: 「明朗会計。基本5,000円（買い切り）+ 必要な方だけオプション追加」
- `10_case.png`: 「導入イメージ（※実在しません）。Before→Afterで変わる予約対応の負担」

## ⚠️ レイアウト確認（up前に必ず実機で確認）

追加画像5枚はHTMLテンプレートからPlaywrightでスクショ生成。**up前に必ず各画像を開いて以下を確認**:
- 文字欠け / 見切れ / 要素のはみ出し
- 表・グリッドの崩れ

崩れがあれば `scene-extras.html` を編集 → 再スクショ（手順は本ガイド下部「再生成手順」参照）。

## 再生成手順（レイアウト崩れ修正時）

```bash
# 1. HTTPサーバ起動
cd ~/projects/reserve-optimizer/docs/marketing/coconala-images
python3 -m http.server 8137 --bind 127.0.0.1 &

# 2. Playwright MCP で http://127.0.0.1:8137/scene-extras.html を開く
#    - browser_resize(1220, 1240)
#    - browser_navigate(http://127.0.0.1:8137/scene-extras.html)
#    - 各frameのactiveを切り替え → browser_take_screenshot(element=#scene-xxx)

# 3. サーバ停止
pkill -f "http.server 8137"
```

`scene-extras.html` の5 frame:
- `#scene-compare` → 06_compare.png
- `#scene-features` → 07_features.png
- `#scene-sheet` → 08_sheet.png
- `#scene-price` → 09_price.png
- `#scene-case` → 10_case.png

## ブログ投稿も忘れずに（別作業）

解説ブログ（`coconala-blog-line-reservation.md`）も未投稿。
ココナラのブログ機能で投稿時:
- 本文冒頭の「【🔥要差替】サービスID 4316257のURL」を実際の出品URLに置換
- 追加画像5枚を本文の対応セクションに挿入（ブログMD末尾の「追加画像の活用」表参照）
