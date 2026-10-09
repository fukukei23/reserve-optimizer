# C0 セキュリティ自己レビュー
（OWASP Top10視点・spec §4 C0ゲート・2026-10-09実施）

## 機械チェック結果（実測）

| チェック | コマンド | 結果 |
|---|---|---|
| コード実行系API（eval/new Function/innerHTML） | `grep -rn "eval(\|new Function(\|innerHTML" gas-project --include='*.js' \| grep -v node_modules \| grep -v tests` | **0件**（生exit code=1=正常な該当なし） |
| Secret類の集中管理 | `grep -rn "Secret\|TOKEN\|KEY" gas-project/config/ScriptProperties.js` | 全て `getProperty(PROPERTY_KEYS.*)` 経由（ScriptProperties集中管理を確認） |
| テナント固有定数のハードコード | `python3 scripts/tenant_constant_scan.py`（C0スキャナ） | 0件（`scanned: 0 findings`・プローブで機能実証済み・2026-10-09） |

## 脅威モデルごとの目視チェック

| 脅威 | 確認方法 | 対応方針 | 要対応 |
|---|---|---|---|
| LINE webhookのパラメータ注入（Invalidated input） | ReservationHandler.js doPost内でユーザー入力をシートに書く箇所の目視（ValidationUtils.js存在を確認・2026-10-09） | 予約氏名等はスプレッドシート限定=影響小・SQLなし（GAS Sheets API・文字列は値として格納） | 要対応: なし |
| シークレットのハードコード | Task 1定数インベントリ（stripe_key_prefix・line_channel_access_tokenカテゴリ=0件実測） | 全SecretはScriptProperties経由（ScriptProperties.js目視） | 要対応: なし |
| LOG経由の機密漏えい | `grep -rn "Logger.log"` 実測=Setup.jsのステップ表示のみ・webhook本文は`appendLogRow('DEBUG', ... body.substring(0, 300))`で300字切り捨て（token/認証情報は含まない・ユーザー発言本文のDEBUGログは残る） | token類のログ出力なし実測・DEBUG本文ログはユーザー発言を含むため**C1後に保持期間/レベルの見直し候補** | 要対応: なし |
| URL Fetch先の固定性（SSRF） | `UrlFetchApp.fetch`の全呼び出し先を目視（LineService=api.line.me固定リテラル・Stripe=api.stripe.com・Firestore=googleapis.com・AI API=GLM_API_URL定数） | 全URLがconfig定数ホスト+内部ID結合・ユーザー入力由来のfetch先なし | 要対応: なし |
| 過度な権限（OAuth scope） | appsscript.json実測=10スコープ（spreadsheets/external_request/deployments/projects/webapp.deploy/drive.file/drive.metadata.readonly/userinfo.* /scriptapp） | `script.projects`・`script.deployments`・`script.webapp.deploy`・`drive.metadata.readonly`・`userinfo.*`は実行時に不要な可能性=**削除候補としてC1後に判断**（r5 OR1指摘どおり・削除はclasp動作に影響するため要検証） | 要対応: なし |

## 要対応サマリ

`grep -c "要対応: 有" docs/c0-security-review.md` = **0**

- フォローアップ（起票済み相当・C1後判断）:
  1. DEBUGログのwebhook本文記録（300字）の保持ポリシー見直し
  2. OAuthスコープの最小化候補5件（script.projects/deployments/webapp.deploy/drive.metadata.readonly/userinfo.*）
