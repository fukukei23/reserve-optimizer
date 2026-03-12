# 引き継ぎ資料（他 LLM 向け）

**目的**: このリポジトリと予約管理システムを、別の LLM にコード・文脈を渡して引き継ぐための資料です。  
**想定読者**: 引き継ぎ後に開発・修正・運用サポートを行う LLM（または人間）。

---

## 1. 渡すもの一覧

| 種類 | パス・内容 |
|------|------------|
| **コード（製品）** | `gas-project/` 配下の全 .gs ファイル |
| **1ファイル貼り付け用** | `docs/GAS_PASTE_ALL.gs`（上記を1つに結合したもの。GAS の Code.gs にそのまま貼れる） |
| **引き継ぎ資料（本文書）** | `docs/HANDOVER.md` |
| **システム解析・構成** | `docs/PROJECT_ANALYSIS.md` |
| **GAS セットアップ手順** | `docs/GAS_SETUP_GUIDE.md` |
| **開発ガイド** | `README.md`, `DEVELOPMENT.md` |
| **実装サマリ** | `IMPLEMENTATION_SUMMARY.md`（.claude 構成の説明） |

**他 LLM に渡すときの最小セット**: この `HANDOVER.md` と `PROJECT_ANALYSIS.md` を必ず含める。コードは `gas-project/` または `docs/GAS_PASTE_ALL.gs` のどちらか（または両方）を渡す。

---

## 2. 読む順序（推奨）

1. **本文書（HANDOVER.md）** … 何ができているか・何に注意か・どこに何があるかを把握。
2. **PROJECT_ANALYSIS.md** … アーキテクチャ・処理フロー・ファイル対応・注意点の詳細。
3. **GAS_SETUP_GUIDE.md** … デプロイ・Script Properties・LINE/Stripe Webhook の手順。
4. **コード** … `gas-project/Code.gs` → `handlers/LineWebhookHandler.gs` → `handlers/StripeWebhookHandler.gs` の順で読むと流れが追いやすい。

---

## 3. プロジェクトの二層構造（一言）

- **レイヤー1（開発プロセス）**: Claude Code 用のルール・エージェント・スキル（`.claude/`, `README.md`, `DEVELOPMENT.md`）。品質管理・Tier1 判定・レビュー用。
- **レイヤー2（製品）**: クリニック・整骨院向け **予約管理システム**。GAS + LINE + Stripe + Google スプレッドシート。LINE で予約フロー、Stripe でデポジット、シートに保存・KPI・ログ。

引き継ぎで重要なのは主に **レイヤー2（製品）**。レイヤー1 は「このリポジトリの開発の進め方」なので、必要に応じて参照。

---

## 4. できていること

- LINE Webhook 受信・署名検証・メッセージ/フォロー/アンフォロー処理。
- 予約フロー: 名前 → 電話 → 日付（今日/明日/来週〇曜・数値日付）→ 時間（10時/10:00 等）→ 施術選択 → 予約作成。
- 電話・日付・時間の**ゆるい入力**（正規化・バリデーション）と、不正時の「もう一度入力する」「人間に問い合わせる」Quick Reply。
- Stripe Payment Intent によるデポジット決済リンク送付。
- Stripe Webhook: 支払成功・失敗・返金（`charge.refunded`）。成功時はユーザー＋管理者（LINE_ADMIN_USER_ID）に通知。
- スプレッドシート: reservations / waitlist / weekly_summary / ログ / Dashboard / Waitlist Dashboard。
- エラー時に「ログ」シートへ `appendLogRow('ERROR', ...)` で記録（#ERROR! だけにならない）。
- 定期トリガー: リマインド（前日）、No-Show 判定、待機リスト整理、週次レポート、Dashboard 更新。
- 単体テスト: `tests/TestSuite.gs`（ValidationUtils, DateUtils）。
- **GAS_PASTE_ALL.gs**: 上記を1ファイルにまとめたペースト用。Code.gs に貼れば単一ファイルでも動作。

---

## 5. 未実装・「準備中」のままのもの

- **予約変更** (`/change`) … 「準備中です。管理者にお問い合わせください。」と返すだけ。
- **予約キャンセル** (`/cancel`) … 同様に準備中メッセージのみ。
- **待機リスト登録** (`/waitlist`) … 同様に準備中。

これらを実装する場合は、`handlers/LineWebhookHandler.gs` の `handleChangeFlow` / `handleCancelFlow` / `handleWaitlistFlow` と、SheetService の検索・更新を拡張する形になる。

---

## 6. 技術的な注意点・ハマりどころ

- **doPost と署名の取得**: 現在、LINE/Stripe の署名を `e.parameter` から取得している。GAS の `doPost(e)` では通常 **HTTP ヘッダは e.parameter に含まれない**。LINE/Stripe が実際にヘッダで署名を送っている場合、GAS 側でヘッダを読む方法（制限あり）の確認が必要になる可能性がある。
- **署名検証関数**: `verifyLineSignature(body, signature)` / `verifyStripeSignature(body, signature)` は、**引数で渡した signature** をそのまま比較する実装。呼び出し元で正しく署名を渡しているか確認すること。
- **createPaymentLink**: Stripe の Checkout URL を返す簡易実装。本番では Stripe の Payment Links / Checkout の仕様に合わせた URL 生成を推奨（GAS_SETUP_GUIDE にも記載あり）。
- **sendLinePush の宛先**: 予約の `line_display_name` に LINE の **userId** を入れている箇所がある。LINE に Push するには **userId** が必要。表示名だけでは送れないので、予約時に userId を保存する設計になっているか確認すること。
- **Dashboard.gs**: `createDashboardSheet` / `updateDashboard` で `getRange` の行数と `setValues` の配列長が一致しないと「The number of rows in the data does not match...」が出る。過去に指摘されたことがあるので、変更時は範囲と配列の対応を確認すること。
- **空の .gs ファイル**: GAS で「1ファイル貼り付け」方式を取る場合、他ファイルを削除するか、空で残すと実行時エラーになることがある。空の .gs は削除するか、使わないファイルは中身を消さずに残すなら運用方針を揃えること。

---

## 7. 設定（Script Properties）の要点

必須: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `SPREADSHEET_ID`。  
任意: `LINE_ADMIN_USER_ID`（管理者への通知）, `CONTACT_PHONE` / `CONTACT_URL`（「人間に問い合わせる」用）, その他業務パラメータ（デフォルトあり）。  
一覧は `docs/PROJECT_ANALYSIS.md` の「6. 設定（Script Properties）まとめ」を参照。

---

## 8. 運用・デプロイの要点

1. GAS で「ウェブアプリ」としてデプロイし、**実行ユーザー＝自分**、**アクセス＝全員** にする（LINE/Stripe がアクセスするため）。
2. デプロイ後に得た URL を、LINE の Webhook URL と Stripe の Webhook エンドポイントに登録。
3. コード更新後は「デプロイを管理」→ 該当デプロイの「バージョン」を「新バージョン」にして保存。URL は変えない。
4. 初回またはシートを新規で使う場合は `runSetup` を実行（シート・トリガー作成）。

詳細は `docs/GAS_SETUP_GUIDE.md` に従う。

---

## 9. 重要な判断・仕様の記録場所

- **判断の記録**: `docs/decisions/`（現在は `000-template.md` のみ。実記録は今後の追加を想定）。
- **Tier 1 仕様テンプレート**: `docs/specs/tier1-template.md`。
- **開発ルール・Tier 1 判定**: `.claude/rules.md`。

---

## 10. まとめ：他 LLM が最初にやること

1. **HANDOVER.md**（本文書）と **PROJECT_ANALYSIS.md** を読む。
2. 依頼内容が「製品（予約システム）」なら `gas-project/` または `GAS_PASTE_ALL.gs` を触る。開発プロセスなら `.claude/` や `DEVELOPMENT.md` を触る。
3. バグ修正・機能追加時は、上記「6. 技術的な注意点」と **PROJECT_ANALYSIS.md** の「5. GAS_PASTE_ALL.gs の役割と注意点」を参照する。
4. デプロイ・設定の手順は **GAS_SETUP_GUIDE.md** に従う。

以上で、コードと資料を渡して他 LLM に引き継ぐための最低限の情報が揃っています。
