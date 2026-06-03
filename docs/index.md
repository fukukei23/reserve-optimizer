---
title: 概要
nav_order: 1
---

# reserve-optimizer

> 📂 **[GitHub リポジトリ →](https://github.com/fukukei23/reserve-optimizer)**{: .btn .btn-blue } — ソースコード・技術詳細はこちらから

*GAS + Cloudflare Worker + Stripe* による、LINE予約管理Bot。会話型ステートマシン、デポジット決済、AIチャットを統合。

## 操作デモ

<p align="center">
  <img src="{{ site.baseurl }}/screenshots/demo-flow.gif" width="300" alt="予約フローデモ">
</p>

> 患者がブラウザでアクセスするWeb予約画面の流れ。LINEアプリ内ブラウザでも同じUIが動作します。

## 各ステップ

<table>
  <tr>
    <td align="center"><b>01. 施術選択</b></td>
    <td align="center"><b>02. 日付選択</b></td>
    <td align="center"><b>03. 時間枠</b></td>
  </tr>
  <tr>
    <td><img src="{{ site.baseurl }}/screenshots/01-treatment.png" width="180" alt="Treatment"></td>
    <td><img src="{{ site.baseurl }}/screenshots/02-date.png" width="180" alt="Date"></td>
    <td><img src="{{ site.baseurl }}/screenshots/03-time-slots.png" width="180" alt="Slots"></td>
  </tr>
  <tr>
    <td>初診・再診から選択。ボタン1タップで次へ</td>
    <td>当日から90日先まで選択可能</td>
    <td>空き枠のみ表示、満枠はグレーアウト</td>
  </tr>
  <tr>
    <td align="center"><b>04. お客様情報</b></td>
    <td align="center"><b>05. 予約確認</b></td>
    <td align="center"><b>06. 完了</b></td>
  </tr>
  <tr>
    <td><img src="{{ site.baseurl }}/screenshots/04-customer-info.png" width="180" alt="Info"></td>
    <td><img src="{{ site.baseurl }}/screenshots/05-confirm.png" width="180" alt="Confirm"></td>
    <td><img src="{{ site.baseurl }}/screenshots/06-complete.png" width="180" alt="Done"></td>
  </tr>
  <tr>
    <td>氏名・電話番号を入力、バリデーション実行</td>
    <td>最終確認 → Stripe Checkout遷移</td>
    <td>予約ID発行、LINEから変更・キャンセル可能</td>
  </tr>
</table>

## 特徴

- **LINE予約フロー**: 会話型ウィザード（予約・変更・キャンセル）
- **Stripe Checkout決済**: デポジット 1,000円（前日キャンセルまで無料返金）
- **AIチャット**: MiniMax M2.7 による|Q&A自動応答
- **セキュリティ**: Cloudflare Worker でLINE/Stripe双方のHMAC署名検証
- **多言語対応**: 外国人 관광객も母語で予約可能

## 技術スタック

| レイヤー | 技術 | 役割 |
|---|---|---|
| フロントエンド | LINE Messaging API | LINEアプリ + リッチメニュー |
| Webhook中継 | Cloudflare Worker | LINE/Stripe署名検証 → GAS転送 |
| バックエンド | Google Apps Script | 会話ステートマシン |
| データストア | Google Spreadsheets | 予約・ユーザー管理 |
| 決済 | Stripe Checkout | デポジット制 1,000円 |
| AI | MiniMax M2.7 | コラー|Q&A |

---

> 👉 各機能の詳細はサイドバーの **機能ショーケース** をご覧ください。