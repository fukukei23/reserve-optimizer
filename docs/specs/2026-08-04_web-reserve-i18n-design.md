# Web予約画面 6言語化 — 設計仕様

> 作成: 2026-08-04 (v3・第2Rレビュー反映)
> 対象: reserve-optimizer Web予約画面（`worker/src/reserve-page.html`）の6言語化
> ゴール: **demo spec（phase-alpha）の「6言語切替」をWeb予約画面で達成する**
> 関連: `docs/specs/2026-06-26_phase-alpha-recruitment-demo-design.md`（E11 デモ対象「Web予約6ステップ・6言語切替」）
> レビュー: multi-llm-review 2ラウンド（Gemini + MiniMax・2026-08-04）経緯は §7

---

## 1. 背景・ゴール

demo spec は採用デモの対象に「**6言語切替（日・英・中・韓・スペイン・ポルトガル）**」を掲げるが、現状のWeb予約画面（`reserve-page.html`）は**日本語直書き固定**。LINE Bot 側（`gas-project/i18n/Locales.js`）は `ja`/`en` の2言語のみで、Web画面には未連携。これが今回のギャップ。

本 spec は **Web予約画面のみを6言語化** し、demo の「6言語切替」を達成する。

### 成功基準
- [ ] `reserve-page.html` が6言語（ja/en/zh/ko/pt/es）で表示される（テキスト**および placeholder/aria-label/title 属性**）
- [ ] 言語切替UI（6ボタン）で動的に切替可能・選択言語は `localStorage` に保持
- [ ] デフォルト言語がブラウザ設定（`navigator.languages`）から自動判定される（SUPPORTED 外は `en`→`ja` フォールバック）
- [ ] 切替時に進行中の入力値・ステップ状態が保持される
- [ ] API エラーが各言語で表示される（フィールド単位エラーコード化・**フィールド名も各言語化**）
- [ ] `document.documentElement.lang`・`document.title` も切替言語に連動（a11y/SEO）
- [ ] 既存の `/reserve`・`/api/availability`・`/api/reserve` 正常系テストが回帰なく通る
- [ ] vitest でカタログ網羅性・`detectLang`・エラーコード正規化のテストが通る

### スコープ外（YAGNI）
- **GAS側 `Locales.js` の6言語拡張**（LINE Bot 側・別タスク）
- RTL対応（6言語は全て LTR）
- 日付/通貨フォーマットのローカライズ（`date-input` は `type=date`・通貨は demo 外）
- i18next / lit 等のライブラリ導入（純JS・単一HTML構造維持）

---

## 2. 前提事実（現状コード）

| 要素 | 現状 | 箇所 |
|---|---|---|
| `GET /reserve` | `reserve-page.html` を文字列で返す（`import RESERVE_PAGE_HTML`） | `worker/src/index.ts:62` |
| 6ステップUI | 実装済み（施術→日付→時間→顧客情報→確認→完了）・テキストは**日本語直書き**（placeholder/確認画面ラベル含む） | `reserve-page.html` |
| `POST /api/availability` | GAS `get_availability` へ転送 | `index.ts:69` |
| `POST /api/reserve` | GAS `create_reservation` へ転送・バリデーションエラーは英語（`Missing fields: name`） | `index.ts:74`・`handleApiReserve` |
| GAS 成功レスポンス | `reservation_id` 等を返す（※Worker 正規化層で `ok===true && typeof reservation_id==='string'` のホワイトリスト検証を行う・§3.5） | GAS 側 |
| GAS 側 i18n | `MESSAGES` カタログ `ja`/`en` のみ | `gas-project/i18n/Locales.js` |
| 制約 | GAS と Worker は別ランタイム・**カタログ直接共有不可** | — |

---

## 3. 設計

### 3.1 カタログの場所（案A 採用）

`reserve-page.html` の `<script>` 内に `const I18N = { ja:{...}, en:{...}, zh:{...}, ko:{...}, pt:{...}, es:{...} }` を定義。

- **理由**: 現状の単一HTML構造を維持・Worker のビルド設定変更不要・デプロイ簡単
- **肥大化許容**: 6言語インラインで +15〜30KB。demo 用途・モバイル LINE 内ブラウザでも許容範囲
- **将来拡張**: 7言語目追加時に別ファイル化を検討（本 spec では YAGNI）

> **却下**: 案B（別ファイル fetch）— 初期ロード fetch 待ち・ビルド設定変更・demo 規模では過剰（詳細 §7）

### 3.2 言語切替UI

- `h1` 下に6つの言語ボタン（`日本語 / EN / 中文 / 한국어 / PT / ES`）を `flex` 横並び
- **`flex-wrap: wrap` 許可**（480px 以下で2段折返し・モバイル崩れ対策）
- 選択中は `#06c755` ハイライト（既存テーマ色）
- **a11y**: 各ボタンに `role="button"`・`aria-pressed="true/false"`・`aria-label="Language"` を付与
- 配置（sticky 有無等）の詳細は実装時に CSS 判断（ステップ1ファーストビューと競合しないか確認）

### 3.3 デフォルト言語判定

**`detectLang()` アルゴリズム**（疑似コード・第2R指摘反映）:
```
1. try { localStorage.getItem("reserve_lang") } catch { null }   // プライベートモード/無効化対策
   → 値 ∈ SUPPORTED のキーなら返す
2. for (navLang of navigator.languages || []):
     a. SUPPORTED の各サブ言語配列と完全一致 → 該当キー返す
     b. 接頭辞一致（en-US → en, zh-Hans → zh）→ 該当キー返す
3. SUPPORTED 接頭辞にもマッチしない場合は en（第2R指摘: fr/de/ru 等を ja 押し付け回避）
4. 最終フォールバック ja
```
- **localStorage 例外**: Safari プライベートモード等で `localStorage` アクセスが例外を投げるため `try-catch`（第2R Gemini high 指摘）
- **`navigator.languages` 空配列/undefined**: フォールバック鎖で吸収

**`SUPPORTED` マップ**（サブ言語ポリシー事前決定）:
```js
const SUPPORTED = {
  ja: ['ja'],
  en: ['en'],
  zh: ['zh-CN','zh-TW','zh-Hans','zh-Hant','zh'],  // → 簡体(zh-CN)
  ko: ['ko'],
  pt: ['pt-BR','pt-PT','pt'],                       // → 伯(pt-BR)
  es: ['es-AR','es-MX','es-ES','es']                // → 墨(es-MX)
};
```
- **ポリシー**: `zh` は簡体固定・`pt` は伯（ブラジル）固定・`es` は墨（メキシコ）固定
- **理由**: サブ言語間の敬称・表現差を事前に潰す（繁体ユーザーへ簡体露出等の事故防止）

### 3.4 再描画（切替時・テキスト + 属性）

**テキストノード**（`data-i18n` 属性）と **属性**（`data-i18n-attr` 属性）の両方を書換（`innerHTML` 禁止・第2R指摘反映）:
```js
// テキスト
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = t(el.dataset.i18n);
});
// 属性（placeholder/aria-label/title 等）
document.querySelectorAll('[data-i18n-attr]').forEach(el => {
  // 例: data-i18n-attr="placeholder:reserve.name;aria-label:reserve.submit"
  el.dataset.i18nAttr.split(';').forEach(pair => {
    const [attr, key] = pair.split(':');
    el.setAttribute(attr.trim(), t(key.trim()));
  });
});
// 文書言語属性・タイトル（a11y/SEO）
document.documentElement.lang = currentLang;
document.title = t('page.title');
```
- **不変条件**: `input value`・`active` class・`aria-current`・イベントリスナは触らない
- **属性翻訳対象**: `placeholder`（お名前/電話番号）・`aria-label`・`title` 等（第2R Gemini#1 high・MiniMax#6 一致指摘）
- **確認画面の動的ラベル**（`showConfirm` 内の「施術」「日付」「時間」「お名前」「電話番号」）も `I18N[lang].confirm.*` で組み立て（第2R Gemini#5 指摘）

### 3.5 API エラーの扱い（フィールド単位エラーコード化）

**Worker 側（正規化層・ローカライズ層でない）**:
- 共通関数 **`normalizeGasError(gasResp)`**（§4）を `handleApiReserve` / `handleApiAvailability` の**両 handler**で必ず通す
- エラー返却を `{error:"..."}` → **`{ok:false, code:"ERR_MISSING_FIELDS", fields:["name"]}`** 形式に正規化
- **GAS 成功レスポンスも正規化**: `{ok:true, reservation_id}` 形式にする際、`ok===true && typeof reservation_id==='string'` のホワイトリスト検証（GAS 側の偶発的フィールド変更・null 返却での誤判定防止・第2R MiniMax#1 high 指摘）
- GAS 由来の人間可読文字列は破棄・**`code` のみフロントへ**

**フロント側（ローカライズ）**:
- `code` を `tError(code)` で各言語表示。コード例: `ERR_MISSING_FIELDS` / `ERR_INVALID_PHONE` / `ERR_SLOT_FULL` / `ERR_RESERVATION_FAILED` / `ERR_GENERIC`
- **`tError(code)` フォールバック chain**: `I18N[currentLang].errors[code]` → `I18N.en.errors[code]` → `I18N.ja.errors[code]` → `code`（第2R MiniMax#2 high 指摘）
- **フィールド名の動的パラメータ多言語化**: `fields:["name"]` の各フィールド名は `I18N[lang].fields["name"]` で各言語表示（例: name→お名前/Name/姓名 等・第2R Gemini#4 指摘）

**in-flight API と言語切替の競合方針**（第2R MiniMax#3 指摘）:
- API レスポンス処理時に **`currentLang` を再読み**して表示（送信時の言語でなく受信時の最新言語）。クロージャに固定しない

> **採用理由**: 両LLM（第1R Gemini=critical・MiniMax=med）が「汎用メッセージ化はUX最悪・原因解決不能」と一致指摘。フィールド単位エラーコード化で各言語でも原因が分かる。Worker は「正規化層」・ローカライズはフロント。

---

## 4. コンポーネント（`reserve-page.html` 内・純JS）

1. **`I18N` カタログ**: `I18N[lang][key]`（6言語 × Nキー）。キー群 = ステップタイトル・ボタン・placeholder・`confirm.*`（確認画面ラベル）・`fields.*`（フィールド名）・`errors.ERR_*`・`page.title`
2. **`SUPPORTED` マップ**: §3.3
3. **`detectLang()`**: §3.3 疑似コード（localStorage try-catch → navigator.languages → en → ja）
4. **`currentLang`** 状態 + **`setLang(lang)`**: `localStorage` 保存（try-catch）→ `render()`
5. **`t(key)`**: `I18N[currentLang][key]` → `I18N.en[key]` → `I18N.ja[key]` → `key`
6. **`tError(code)`**: §3.5 フォールバック chain（errors.* 専用）
7. **`render()`**: §3.4（テキスト + 属性 + document.lang/title）
8. **言語切替UI**: 6ボタン・`aria-pressed`/`aria-label`

### Worker 側変更（`worker/src/index.ts`）⚠️ 72e0 と同ファイル
- **`normalizeGasError(gasResp)`** 共通関数を新設（両 handler で適用・第2R MiniMax#5 指摘）
- `handleApiReserve` / `handleApiAvailability`: エラー返却を code 形式に正規化・成功レスポンスもホワイトリスト検証
- 既存 `index.test.ts` の `/api/reserve`・`/api/availability` テストを code 形式に更新（両 handler 分）
- **注意**: 72e0 が同ファイルに `DEMO_MODE` 関連1行を追加済み（commit 9e3d154）。`handleApiReserve` 関数内が正規化層呼出と隣接する可能性あり。pre-commit hook で巻込み検知に注意・commit 時は特定ファイル指定

---

## 5. データフロー

```
ページ読込:
  detectLang() → currentLang → render() → 6ボタン描画
言語切替クリック:
  setLang(lang) → localStorage 保存 → render()
API:
  /api/availability POST → GAS → {ok, slots} | {ok:false, code}
                              （Worker が normalizeGasError で正規化）
  /api/reserve      POST → GAS → {ok, reservation_id} | {ok:false, code, fields}
  → フロントが受信時に currentLang を再読み → tError(code) + fields[*] の各言語表示
```

---

## 6. テスト（TDD・vitest）

1. **`I18N` カタログ網羅性**: 全キー（**`errors.*`・`fields.*`・`confirm.*` 含む**）が6言語に存在（第2R指摘反映）
2. **`t()` / `tError()` フォールバック**: 不在キー → en → ja → key（第2R指摘反映）
3. **`detectLang()`**: localStorage / navigator.languages（サブ言語解決 `zh-TW→zh` 等）/ `en` フォールバック / `ja` 最終フォールバック / localStorage 例外時の try-catch
4. **`render()` 属性更新**: `placeholder`・`aria-label`・`document.documentElement.lang`・`document.title` が切替で更新される（input value は保持）
5. **Worker エラーコード正規化**: `handleApiReserve` の `ERR_MISSING_FIELDS` 返却 **および** `handleApiAvailability` の `ERR_SLOT_FULL` 返却（両 handler・第2R MiniMax#5 指摘）。成功レスポンスのホワイトリスト検証
6. **回帰**: 既存 `/reserve`・`/api/availability`・`/api/reserve` 正常系テスト維持

### 翻訳品質
- `ja`: 既存テキスト流用
- `en`: `gas-project/i18n/Locales.js` の `en` 参考
- `zh`: 簡体（zh-CN）・GLM 翻訳
- `ko` / `pt` / `es`: GLM 翻訳（demo 品質）

---

## 7. レビュー経緯（multi-llm-review 2ラウンド・2026-08-04）

### 第1R（設計案セクション1）
**レビュアー**: Gemini（5件） + MiniMax（9件）= 計14件
**採用**: APIエラーコード化（critical/med）・`data-i18n`書換・`innerHTML`禁止（high/high）・`flex-wrap`+aria（high/med）・`SUPPORTED`マップ（low/high）
**却下**: HTML肥大化 lazy fetch（YAGNI・demo 許容）
**⚠️ 集団サボりバイアス検知成立**: 元案 APIエラー汎用化は実装コスト回避のサボり（両LLM一致指摘）→ フィールド単位エラーコード化で解消

### 第2R（完成 spec・実装時の落とし穴）
**レビュアー**: Gemini（5件） + MiniMax（10件）= 計15件
**採用**（両LLM合意または妥当）:
| 指摘 | Gemini | MiniMax | 反映 |
|---|---|---|---|
| placeholder/aria-label/title 属性ローカライズ漏れ | high | med | §3.4 `data-i18n-attr` |
| `document.lang`/`title` 更新（a11y/SEO） | med | — | §3.4 |
| localStorage 例外ハンドリング（プライベートモード） | high | — | §3.3 try-catch |
| `errors.*` フォールバック + フィールド名動的パラメータ多言語化 | med | high | §3.5 `tError`+`fields.*` |
| `detectLang()` 疑似コード + フォールバック鎖(en) | — | med/low | §3.3 |
| GAS success レスポンス正規化（ホワイトリスト） | — | high | §3.5/§2 |
| `normalizeGasError()` 共通化 + 両 handler | — | med | §4 |
| in-flight API と言語切替競合（currentLang 再読み） | — | med | §3.5 |
| 確認画面動的ラベルの I18N 化 | low | — | §3.4 `confirm.*` |
| ネイティブレビュー推奨 | — | med | §9 |

**却下（実装時対応）**: 6ボタン sticky 配置詳細・72e0 衝突箇所のコードレベル特定（spec 肥大化回避）

---

## 8. リスク・対策

| リスク | 対策 |
|---|---|
| 切替でフォーム入力が消える | `data-i18n`/`data-i18n-attr` のみ書換・`innerHTML` 禁止（§3.4）・テスト#4 で input value 保持を検証 |
| placeholder/aria-label が日本語固定で残留 | `data-i18n-attr` で属性翻訳（§3.4） |
| サブ言語で意図しない方言露出 | `SUPPORTED` マップで事前ポリシー決定（§3.3） |
| SUPPORTED 外言語（fr/de 等）に ja 押し付け | フォールバック鎖に `en` を挟む（§3.3） |
| localStorage アクセス例外（プライベートモード） | `try-catch`（§3.3） |
| API エラーの言語混在 | Worker 正規化層で人間可読文字列破棄・code のみ（§3.5） |
| GAS レスポンス形式変更でサイレント崩壊 | ホワイトリスト検証（§3.5） |
| in-flight API と言語切替の競合 | レスポンス処理時に currentLang 再読み（§3.5） |
| 72e0 と `index.ts` で競合 | commit 時特定ファイル指定・pre-commit hook の stage 内容確認 |
| 翻訳品質（zh/ko/pt/es） | GLM 翻訳・demo 品質・必要なら人間レビュー（§9） |

---

## 9. 次ステップ

1. 本 spec をレビュー（ユーザー）
2. `writing-plans` スキルで実装タスク分解（Task1-N・TDD・依存順）
3. 実装 → 各完了時に `ssot-record` スキルで SSOT 記録
4. **（推奨）ネイティブレビュー**: zh/ko/pt/es 各言語から5キー（タイトル・ボタン・エラー・placeholder・注記）を抽出し、ネイティブ観点で意味整合性をスポットチェック（demo 品質担保・受入必須でなく推奨）
