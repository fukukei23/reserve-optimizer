# ADR-001: reserve-optimizer 脅威モデル

> ステータス: Accepted
> 日付: 2026-05-24
> 分類: Security

## コンテキスト

reserve-optimizer はLINE Bot + Stripe + Cloudflare Workers + Google Apps Script（GAS）で構成された予約管理システム。

### アーキテクチャ

```
[LINEユーザー] → [Cloudflare Worker] → [GAS Web App]
                     ↓                      ↓
               [Stripe Webhook]      [Google Sheets（DB代用）]
```

### 外部接続
- LINE Messaging API（Webhook受信・メッセージ送信）
- Stripe（決済・Webhook受信）
- Cloudflare Workers（リバースプロキシ）
- Google Sheets（データストア）

## 脅威一覧（STRIDE分類）

| ID | 脅威 | STRIDE | 影響 | 現状の対策 | ステータス |
|----|------|--------|------|-----------|-----------|
| T01 | LINE Webhook署名偽装 | Spoofing | 虚偽予約・なりすまし | HMAC-SHA256検証あり、タイミングセーフ比較 | **対応済** |
| T02 | Stripe Webhook署名偽装 | Spoofing | 虚偽決済完了通知 | 署名検証 + タイムスタンプ検証（5分以内）+ 冪等性 | **対応済** |
| T03 | GAS Web Appエンドポイントの未認証アクセス | Elevation | 全機能の不正実行 | Bearer token（autopilotのみ）、一般エンドポイントに認証なし | **未対応** |
| T04 | 管理者権限のハードコード | Elevation | 管理者なりすまし | LINEユーザーIDで判定、固定値 | **低リスク** |
| T05 | 顧客PIIのGoogle Sheets平文保存 | Information Disclosure | 個人情報漏洩 | 暗号化なし、Googleアクセス権限依存 | **一部対応** |
| T06 | Stripe決済情報の不正取得 | Information Disclosure | カード情報漏洩 | StripeがPCI DSS準拠、自システムにはカード情報非保持 | **対応済** |
| T07 | リプレイ攻撃（Webhook再送） | Repudiation | 重複処理 | Stripe: CacheServiceで冪等性確保（20分TTL）、LINE: 未対応 | **一部対応** |
| T08 | LINEメッセージの入力検証なし | Tampering | 意図しない処理実行 | サニタイズなし | **未対応** |
| T09 | Webhookエンドポイントのレート制限なし | Denial of Service | サービス停止 | Cloudflare Workers（エッジ側で一部緩和） | **低リスク** |

## 決定

### 優先対応（P0）

1. **T03 認証追加**: GAS Web Appのエンドポイントに認証を追加。Cloudflare Worker側でシークレットトークン検証
2. **T08 入力検証**: LINEメッセージの長さ制限・文字種フィルタリング

### 推奨対応（P1）

3. **T07 リプレイ対策**: LINEイベントのイベントIDで冪等性チェックを追加
4. **T05 PII保護**: Google Sheetsの共有設定を最小権限に見直し

### 受容（P2）

5. **T04 管理者ID固定**: LINEプラットフォームがユーザーIDの一意性を保証するため低リスク
6. **T09 DoS**: Cloudflare Workers + GAS無料枠の制限が事実上のレート制限として機能

## 結果

### 強み（既に適切に対策済み）

- LINE/Stripe双方のWebhook署名検証が堅牢（タイミングセーフ比較含む）
- Stripe決済はPCI DSS準拠のホスティング型、カード情報非保持
- API keyはScriptProperties（GAS暗号化ストレージ）に保存

### 受容したリスク

- Google SheetsのPII暗号化は当面対応しない（Googleアカウント保護に依存）
- 管理者判定のハードコードは個人運用のため受容

### 残タスク

- [ ] GAS Web Appエンドポイントに認証追加（T03）
- [ ] LINEメッセージ入力バリデーション（T08）
- [ ] LINEイベント冪等性チェック（T07）

## 参考

- 対象リポジトリ: https://github.com/fukukei23/reserve-optimizer
