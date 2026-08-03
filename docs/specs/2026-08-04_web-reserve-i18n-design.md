# Web予約画面 6言語化 — 設計仕様

> 作成: 2026-08-04
> 対象: reserve-optimizer Web予約画面（`worker/src/reserve-page.html`）の6言語化
> ゴール: **demo spec（phase-alpha）の「6言語切替」をWeb予約画面で達成する**
> 関連: `docs/specs/2026-06-26_phase-alpha-recruitment-demo-design.md`（E11 デモ対象「Web予約6ステップ・6言語切替」）
> レビュー: multi-llm-review（Gemini + MiniMax・2026-08-04）経緯は §7

---

## 1. 背景・ゴール

demo spec は採用デモの対象に「**6言語切替（日・英・中・韓・スペイン・ポルトガル）**」を掲げるが、現状のWeb予約画面（`reserve-page.html`）は**日本語直書き固定**。LINE Bot 側（`gas-project/i18n/Locales.js`）は `ja`/`en` の2言語のみで、Web画面には未連携。これが今回のギャップ。

本 spec は **Web予約画面のみを6言語化** し、demo の「6言語切替」を達成する。

### 成功基準
- [ ] `reserve-page.html` が6言語（ja/en/zh/ko/pt/es）で表示される
- [ ] 言語切替UI（6ボタン）で動的に切替可能・選択言語は `localStorage` に保持
- [ ] デフォルト言語がブラウザ設定（`navigator.languages`）から自動判定される
- [ ] 切替時に進行中の入力値・ステップ状態が保持される
- [ ] API エラーが各言語で表示される（フィールド単位エラーコード化）
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
| 6ステップUI | 実装済み（施術→日付→時間→顧客情報→確認→完了）・テキストは**日本語直書き** | `reserve-page.html` |
| `POST /api/availability` | GAS `get_availability` へ転送 | `index.ts:69` |
| `POST /api/reserve` | GAS `create_reservation` へ転送・バリデーションエラーは英語（`Missing fields: name`） | `index.ts:74`・`handleApiReserve` |
| GAS 側 i18n | `MESSAGES` カタログ `ja`/`en` のみ | `gas-project/i18n/Locales.js` |
| 制約 | GAS と Worker は別ランタイム・**カタログ直接共有不可** | — |

---

## 3. 設計

### 3.1 カタログの場所（案A 採用）

`reserve-page.html` の `<script>` 内に `const I18N = { ja:{...}, en:{...}, zh:{...}, ko:{...}, pt:{...}, es:{...} }` を定義。

- **理由**: 現状の単一HTML構造を維持・Worker のビルド設定変更不要・デプロイ簡単
- **肥大化許容**: 6言語インラインで +15〜30KB。demo 用途・モバイル LINE 内ブラウザでも許容範囲（通常Webページより小さい）
- **将来拡張**: 7言語目追加時に別ファイル化（`i18n.js` 分離・ビルド時インライン）を検討（本 spec では YAGNI）

> **却下**: 案B（`worker/src/i18n.json` 別ファイル fetch）— 初期ロード fetch 待ち・ビルド設定変更が必要・demo 規模では過剰（multi-llm-review 両LLM指摘も YAGNI 判断で却下・詳細 §7）

### 3.2 言語切替UI

- `h1` 下に6つの言語ボタン（`日本語 / EN / 中文 / 한국어 / PT / ES`）を `flex` 横並び
- **`flex-wrap: wrap` 許可**（480px 以下で2段折返し・モバイル崩れ対策）
- 選択中は `#06c755` ハイライト（既存テーマ色）
- **a11y**: 各ボタンに `role="button"`・`aria-pressed="true/false"`・`aria-label="Language"` を付与

### 3.3 デフォルト言語判定

```
localStorage("reserve_lang")
  → navigator.languages 配列を SUPPORTED マップで解決
  → フォールバック ja
```

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

### 3.4 再描画（切替時）

**`data-i18n` 属性を持つテキストノードのみ書換**（`innerHTML` 禁止）:
```js
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = t(el.dataset.i18n);
});
```
- **不変条件**: `input value`・`active` class・`aria-current`・イベントリスナは触らない
- **理由**: `innerHTML` 一括置換だとフォーム値・ステップ状態・イベントが消える（両LLM一致指摘）

### 3.5 API エラーの扱い（フィールド単位エラーコード化）

**Worker 側（正規化層・ローカライズ層でない）**:
- `handleApiReserve` / `handleApiAvailability` のエラー返却を `{error:"..."}` → **`{ok:false, code:"ERR_MISSING_FIELDS", fields:["name"]}`** 形式に正規化
- GAS 由来の人間可読文字列は破棄・**`code` のみフロントへ**

**フロント側（ローカライズ）**:
- `code` を `I18N[currentLang].errors[code]` で各言語表示
- コード例: `ERR_MISSING_FIELDS` / `ERR_INVALID_PHONE` / `ERR_SLOT_FULL` / `ERR_RESERVATION_FAILED` / `ERR_GENERIC`

> **採用理由**: 両LLM（Gemini=critical・MiniMax=med）が「汎用メッセージ化はUX最悪・ユーザーが原因を解決できない」と一致指摘。フィールド単位エラーコード化で各言語でも原因が分かる。Worker は「ローカライズ層」でなく「正規化層」のため、API エラー処理の方針（ローカライズはフロント）は維持。

---

## 4. コンポーネント（`reserve-page.html` 内・純JS）

1. **`I18N` カタログ**: `I18N[lang][key]`（6言語 × Nキー）。キー群 = ステップタイトル・ボタン・placeholder・`errors.ERR_*`
2. **`SUPPORTED` マップ**: §3.3
3. **`detectLang()`**: `localStorage` → `navigator.languages` → `SUPPORTED` 解決 → フォールバック `ja`
4. **`currentLang`** 状態 + **`setLang(lang)`**: `localStorage` 保存 → `render()`
5. **`t(key)`**: `I18N[currentLang][key]` → フォールバック `I18N.ja[key]` → `key`
6. **`render()`**: `[data-i18n]` の `textContent` のみ更新
7. **言語切替UI**: 6ボタン・`aria-pressed`/`aria-label`

### Worker 側変更（`worker/src/index.ts`）⚠️ 72e0 と同ファイル
- `handleApiReserve`: エラー返却を code 形式に正規化
- `handleApiAvailability`: 同様
- GAS 由来エラーの正規化層（1関数）を追加
- 既存 `index.test.ts` の `/api/reserve`・`/api/availability` テストを code 形式に更新
- **注意**: 72e0 が同ファイルに `DEMO_MODE` 関連1行を追加済み（commit 9e3d154）。pre-commit hook で巻込み検知に注意・commit 時は特定ファイル指定

---

## 5. データフロー

```
ページ読込:
  detectLang() → currentLang → render() → 6ボタン描画

言語切替クリック:
  setLang(lang) → localStorage 保存 → render()

API:
  /api/availability POST → GAS → {ok, slots} | {ok:false, code}
  /api/reserve      POST → GAS → {ok, reservation_id} | {ok:false, code, fields}
  → フロントが I18N[lang].errors[code] で表示
```

---

## 6. テスト（TDD・vitest）

1. **`I18N` カタログ網羅性**: 全キーが6言語に存在（欠落検知）
2. **`t()` フォールバック**: 不在キー → `ja` → `key`
3. **`detectLang()`**: `localStorage` / `navigator.languages` / フォールバック 各パス
4. **`SUPPORTED` サブ言語解決**: `zh-TW→zh`・`pt-PT→pt`・`es-MX→es` 等
5. **Worker エラーコード正規化**: `handleApiReserve` の `ERR_MISSING_FIELDS` 返却（既存テスト更新）
6. **回帰**: 既存 `/reserve`・`/api/availability`・`/api/reserve` 正常系テスト維持

### 翻訳品質
- `ja`: 既存テキスト流用
- `en`: `gas-project/i18n/Locales.js` の `en` 参考
- `zh`: 簡体（zh-CN）・GLM 翻訳
- `ko` / `pt` / `es`: GLM 翻訳（demo 品質・必要なら人間レビュー）

---

## 7. レビュー経緯（multi-llm-review・2026-08-04）

**レビュアー**: Gemini（gemini-3.1-pro-preview・5件） + MiniMax（9件）= 計14件
**当初目的**: Web予約画面の6言語化で demo spec の「6言語切替」を達成（範囲: Web画面のみ・1セッション完結）

### 採用（両LLM合意または妥当）
| 指摘 | Gemini | MiniMax | 改訂 |
|---|---|---|---|
| APIエラー汎用化はUX最悪 → フィールド単位エラーコード化 | critical | med | §3.5 採用 |
| 切替時の入力値・状態保持が未定義 → `data-i18n`属性のみ書換・`innerHTML`禁止 | high | high | §3.4 採用 |
| モバイル6ボタン崩れ + a11y → `flex-wrap`・`aria`属性 | high | med | §3.2 採用 |
| `navigator.language` サブ言語吸収不全 → `SUPPORTED`マップ | low | high | §3.3 採用 |

### 却下
| 指摘 | 理由 |
|---|---|
| HTML肥大化（15-30KB）→ lazy fetch / 別ファイル化 | YAGNI・demo 用途で許容範囲・7言語目追加時に再検討 |

### ⚠️ 集団サボりバイアス検知（Step6.5 成立）
元案の「APIエラー汎用化」は**実装コスト回避のサボり**（両LLMが「詳細化すべき」と一致指摘）。反証シナリオ：英語UIユーザーが電話番号形式を間違えても「予約に失敗しました」のみで原因不明 → 予約完了不能。改訂案でフィールド単位エラーコード化を採用して解消。

---

## 8. リスク・対策

| リスク | 対策 |
|---|---|
| 切替でフォーム入力が消える | `data-i18n` 属性のみ書換・`innerHTML` 禁止（§3.4）・E2E で input value 保持を検証 |
| サブ言語で意図しない方言露出 | `SUPPORTED` マップで事前ポリシー決定（§3.3） |
| API エラーの言語混在 | Worker 正規化層で人間可読文字列破棄・code のみ（§3.5） |
| 72e0 と `index.ts` で競合 | commit 時特定ファイル指定・pre-commit hook の stage 内容確認 |
| 翻訳品質（zh/ko/pt/es） | GLM 翻訳・demo 品質・必要なら人間レビュー |

---

## 9. 次ステップ

1. 本 spec をレビュー（ユーザー）
2. `writing-plans` スキルで実装タスク分解（Task1-N・TDD・依存順）
3. 実装 → 各完了時に `ssot-record` スキルで SSOT 記録
