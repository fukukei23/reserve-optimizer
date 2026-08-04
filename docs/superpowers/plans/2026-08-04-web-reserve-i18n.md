# Web予約画面 6言語化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reserve-optimizer の Web予約画面（`reserve-page.html`）を6言語化し、demo spec の「6言語切替」を達成する。

**Architecture:** カタログ・ロジックは spec 案A 通り `reserve-page.html` の `<script>` 内に埋め込み（単一HTML維持・Worker ビルド変更不要）。テストのため `window.ReserveI18n` に参照を露出し、jsdom 環境で HTML を読込んで検証。Worker 側 API エラーは `normalizeGasError()` 共通関数で code 形式に正規化（ローカライズはフロント）。

**Tech Stack:** TypeScript (Worker)・純JS (reserve-page.html)・vitest + jsdom (テスト)・Cloudflare Workers

**Spec:** `docs/specs/2026-08-04_web-reserve-i18n-design.md` (v3)

---

## File Structure

| ファイル | 役割 | 操作 |
|---|---|---|
| `worker/package.json` | jsdom (devDep) 追加 | 修正 |
| `worker/src/reserve-page.html` | I18N カタログ・SUPPORTED・detectLang・t/tError・render・setLang・言語切替UI・`window.ReserveI18n` 露出・既存6ステップUIの data-i18n 化 | 修正 |
| `worker/src/index.ts` | `normalizeGasError()` 共通関数・handleApiReserve/handleApiAvailability の code 正規化 | 修正 |
| `worker/src/reserve-page.test.ts` | クライアント側（カタログ網羅性・detectLang・t/tError・render）テスト・jsdom | 新設 |
| `worker/src/index.test.ts` | normalizeGasError・両 handler の code 形式テスト | 修正 |

**カタログ翻訳の方針**: `ja`/`en` は本 plan に実例を示す。`zh`(簡体)/`ko`/`pt`(伯)/`es`(墨) は実装時に GLM で `ja` を基に翻訳し、キー構造を同一に保つ（spec §6「翻訳品質」・demo品質）。

---

## Task 1: jsdom 環境セットアップ

**Files:**
- Modify: `worker/package.json`
- Create: `worker/src/reserve-page.test.ts`

- [ ] **Step 1: jsdom を devDep 追加**

```bash
cd worker && npm install --save-dev jsdom
```

- [ ] **Step 2: 失敗テストを書く（jsdom で HTML 読込の最小確認）**

`worker/src/reserve-page.test.ts`（node 環境・JSDOM を直接 import）:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

function loadPage() {
  const html = readFileSync(join(__dirname, "reserve-page.html"), "utf-8");
  // JSDOM constructor + runScripts:"dangerously" で <script> をサンドボックス内で安全に実行
  // （new Function/eval による文字列実行は使わない・コード注入リスク回避）
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).navigator = dom.window.navigator;
  (global as any).localStorage = dom.window.localStorage;
}

describe("reserve-page i18n setup", () => {
  it("window.ReserveI18n が露出する", () => {
    loadPage();
    expect((window as any).ReserveI18n).toBeDefined();
  });
});
```

- [ ] **Step 3: テスト実行（失敗を確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: FAIL（`window.ReserveI18n` が undefined・まだ未実装）

- [ ] **Step 4: 既存 `<script>` に `window.ReserveI18n` 露出を最小追加**

`worker/src/reserve-page.html` の IIFE の先頭（`(function() {` の直後）に追記:
```js
var __test = {}; // テスト用露出（本番でも無害）
```
IIFE の最後（`})();` の直前）に追記:
```js
window.ReserveI18n = __test;
```
（この時点では `__test` は空オブジェクト・Task 2 以降で中身を詰める）

- [ ] **Step 5: テスト実行（パスを確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd worker && git add package.json package-lock.json src/reserve-page.html src/reserve-page.test.ts
git commit -m "feat(i18n): jsdomテスト環境セットアップ + window.ReserveI18n露出"
```

---

## Task 2: I18N カタログ骨格（ja/en）+ t()/tError()

**Files:**
- Modify: `worker/src/reserve-page.html`
- Modify: `worker/src/reserve-page.test.ts`

- [ ] **Step 1: 失敗テスト追加**

`reserve-page.test.ts` に追加:
```ts
describe("t / tError", () => {
  it("t('ja','page.title') は日本語を返す", () => {
    loadPage();
    const { t } = (window as any).ReserveI18n;
    expect(t("ja", "page.title")).toBe("Web予約");
  });
  it("t は未対応キーを ja→key へフォールバック", () => {
    loadPage();
    const { t } = (window as any).ReserveI18n;
    expect(t("en", "nonexistent.key")).toBe("nonexistent.key");
  });
  it("tError は code を各言語表示し en→ja→code へフォールバック", () => {
    loadPage();
    const { tError } = (window as any).ReserveI18n;
    expect(tError("ja", "ERR_GENERIC")).toMatch(/.+/);
    expect(tError("en", "ERR_UNKNOWN_CODE")).toBe("ERR_UNKNOWN_CODE");
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: FAIL（`t`/`tError` 未定義）

- [ ] **Step 3: 実装（IIFE 内にカタログ + t/tError を追加）**

`reserve-page.html` の IIFE 内（`var __test = {};` の後）:
```js
var I18N = {
  ja: {
    "page.title": "Web予約",
    "errors.ERR_GENERIC": "エラーが発生しました。",
    "errors.ERR_MISSING_FIELDS": "必須項目が入力されていません。",
    "errors.ERR_INVALID_PHONE": "電話番号は10-11桁で入力してください。",
    "errors.ERR_SLOT_FULL": "この時間は満席です。",
    "errors.ERR_RESERVATION_FAILED": "予約に失敗しました。"
  },
  en: {
    "page.title": "Web Reservation",
    "errors.ERR_GENERIC": "An error occurred.",
    "errors.ERR_MISSING_FIELDS": "Required fields are missing.",
    "errors.ERR_INVALID_PHONE": "Phone number must be 10-11 digits.",
    "errors.ERR_SLOT_FULL": "This time slot is fully booked.",
    "errors.ERR_RESERVATION_FAILED": "Reservation failed."
  },
  zh: {}, ko: {}, pt: {}, es: {}  // Task 6 で GLM 翻訳
};

function t(lang, key) {
  var v = (I18N[lang] && I18N[lang][key]);
  if (v !== undefined) return v;
  v = (I18N.en && I18N.en[key]);   // en フォールバック
  if (v !== undefined) return v;
  v = (I18N.ja && I18N.ja[key]);   // ja フォールバック
  if (v !== undefined) return v;
  return key;
}

function tError(lang, code) {
  var k = "errors." + code;
  var v = (I18N[lang] && I18N[lang][k]);
  if (v !== undefined) return v;
  v = (I18N.en && I18N.en[k]);
  if (v !== undefined) return v;
  v = (I18N.ja && I18N.ja[k]);
  if (v !== undefined) return v;
  return code;
}

__test.I18N = I18N;
__test.t = t;
__test.tError = tError;
```

- [ ] **Step 4: テスト実行（パス確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reserve-page.html src/reserve-page.test.ts
git commit -m "feat(i18n): I18Nカタログ骨格(ja/en) + t()/tError()フォールバック"
```

---

## Task 3: SUPPORTED マップ + detectLang()

**Files:**
- Modify: `worker/src/reserve-page.html`
- Modify: `worker/src/reserve-page.test.ts`

- [ ] **Step 1: 失敗テスト追加**

```ts
describe("detectLang", () => {
  it("localStorage 値 ∈ SUPPORTED を返す", () => {
    loadPage();
    const { detectLang } = (window as any).ReserveI18n;
    expect(detectLang("ko", ["en"])).toBe("ko");
  });
  it("navigator.languages の完全一致（zh-TW→zh）", () => {
    loadPage();
    const { detectLang } = (window as any).ReserveI18n;
    expect(detectLang(undefined, ["zh-TW", "en"])).toBe("zh");
  });
  it("接頭辞一致（en-US→en）", () => {
    loadPage();
    const { detectLang } = (window as any).ReserveI18n;
    expect(detectLang(undefined, ["en-US"])).toBe("en");
  });
  it("SUPPORTED 外は en フォールバック（fr-FR→en）", () => {
    loadPage();
    const { detectLang } = (window as any).ReserveI18n;
    expect(detectLang(undefined, ["fr-FR"])).toBe("en");
  });
  it("最終フォールバック ja（空配列）", () => {
    loadPage();
    const { detectLang } = (window as any).ReserveI18n;
    expect(detectLang(undefined, [])).toBe("ja");
  });
  it("localStorage 例外時も navigator で解決", () => {
    loadPage();
    const { detectLang } = (window as any).ReserveI18n;
    expect(detectLang(null, ["pt-BR"])).toBe("pt");
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: FAIL

- [ ] **Step 3: 実装**

IIFE 内に追加:
```js
var SUPPORTED = {
  ja: ["ja"],
  en: ["en"],
  zh: ["zh-CN","zh-TW","zh-Hans","zh-Hant","zh"],
  ko: ["ko"],
  pt: ["pt-BR","pt-PT","pt"],
  es: ["es-AR","es-MX","es-ES","es"]
};
var SUPPORTED_KEYS = ["ja","en","zh","ko","pt","es"];

function detectLang(stored, navLangs) {
  // 1. localStorage 値（例外時は stored===null）
  if (stored && SUPPORTED_KEYS.indexOf(stored) !== -1) return stored;
  // 2. navigator.languages 完全一致
  var langs = navLangs || [];
  for (var i = 0; i < langs.length; i++) {
    var l = langs[i];
    for (var k = 0; k < SUPPORTED_KEYS.length; k++) {
      var key = SUPPORTED_KEYS[k];
      if (SUPPORTED[key].indexOf(l) !== -1) return key;
    }
  }
  // 3. 接頭辞一致
  for (var i2 = 0; i2 < langs.length; i2++) {
    var pfx = (langs[i2] || "").split("-")[0];
    if (SUPPORTED_KEYS.indexOf(pfx) !== -1) return pfx;
  }
  // 4. en フォールバック（SUPPORTED 外言語）
  if (langs.length > 0) return "en";
  // 5. 最終 ja
  return "ja";
}

__test.SUPPORTED = SUPPORTED;
__test.detectLang = detectLang;
```

- [ ] **Step 4: テスト実行（パス確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reserve-page.html src/reserve-page.test.ts
git commit -m "feat(i18n): SUPPORTEDマップ + detectLang()サブ言語解決/フォールバック鎖"
```

---

## Task 4: render()（テキスト + 属性）+ document.lang/title

**Files:**
- Modify: `worker/src/reserve-page.html`
- Modify: `worker/src/reserve-page.test.ts`

- [ ] **Step 1: 失敗テスト追加**

`reserve-page.test.ts` にヘルパー追加（先頭）:
```ts
function loadPageFresh() {
  // JSDOM 再生成で DOM を完全リセット（innerHTML 代入でなく再パース・安全）
  loadPage();
}

describe("render", () => {
  it("data-i18n の textContent を更新", () => {
    loadPageFresh();
    const { setLang } = (window as any).ReserveI18n;
    setLang("en");
    const el = document.querySelector("[data-i18n='page.title']") as HTMLElement;
    expect(el?.textContent).toBe("Web Reservation");
  });
  it("data-i18n-attr で placeholder を更新", () => {
    loadPageFresh();
    const { setLang } = (window as any).ReserveI18n;
    setLang("en");
    const el = document.querySelector("[data-i18n-attr*='placeholder']") as HTMLInputElement;
    expect(el?.placeholder).toMatch(/.+/);
    expect(el?.placeholder).not.toBe("");  // ja 以外でも設定される
  });
  it("document.documentElement.lang が連動", () => {
    loadPageFresh();
    const { setLang } = (window as any).ReserveI18n;
    setLang("ko");
    expect(document.documentElement.lang).toBe("ko");
  });
  it("input value は保持される（消えない）", () => {
    loadPageFresh();
    const input = document.getElementById("name-input") as HTMLInputElement;
    input.value = "テスト太郎";
    const { setLang } = (window as any).ReserveI18n;
    setLang("en");
    expect(input.value).toBe("テスト太郎");
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: FAIL

- [ ] **Step 3: 実装**

IIFE 内に追加（`currentLang`・`setLang`・`render`）。また HTML 側に `data-i18n` 付きの見本要素（Task 5/8 で本格展開・ここでは最小）:
```js
var currentLang = "ja";

function render() {
  // テキスト
  var nodes = document.querySelectorAll("[data-i18n]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = t(currentLang, nodes[i].getAttribute("data-i18n"));
  }
  // 属性
  var attrNodes = document.querySelectorAll("[data-i18n-attr]");
  for (var j = 0; j < attrNodes.length; j++) {
    var pairs = (attrNodes[j].getAttribute("data-i18n-attr") || "").split(";");
    for (var k = 0; k < pairs.length; k++) {
      var parts = pairs[k].split(":");
      if (parts.length === 2) {
        attrNodes[j].setAttribute(parts[0].trim(), t(currentLang, parts[1].trim()));
      }
    }
  }
  document.documentElement.lang = currentLang;
  document.title = t(currentLang, "page.title");
}

function setLang(lang) {
  currentLang = lang;
  try { localStorage.setItem("reserve_lang", lang); } catch (e) { /* プライベートモード等 */ }
  render();
}

__test.setLang = setLang;
__test.render = render;
__test.getCurrentLang = function() { return currentLang; };
```

HTML の `<h1>Web予約</h1>` を `<h1 data-i18n="page.title">Web予約</h1>` に変更（見本・Task 8 で全展開）。

- [ ] **Step 4: テスト実行（パス確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reserve-page.html src/reserve-page.test.ts
git commit -m "feat(i18n): render()(テキスト+属性) + setLang() + document.lang/title連動"
```

---

## Task 5: 言語切替UI（6ボタン・aria・flex-wrap）

**Files:**
- Modify: `worker/src/reserve-page.html`
- Modify: `worker/src/reserve-page.test.ts`

- [ ] **Step 1: 失敗テスト追加**

```ts
describe("language switcher UI", () => {
  it("6つの言語ボタンが描画される", () => {
    loadPageFresh();
    const btns = document.querySelectorAll("#lang-switcher button");
    expect(btns.length).toBe(6);
  });
  it("ボタンクリックで currentLang が変わる", () => {
    loadPageFresh();
    const btns = document.querySelectorAll("#lang-switcher button");
    (btns[1] as HTMLElement).click();  // en
    expect((window as any).ReserveI18n.getCurrentLang()).toBe("en");
  });
  it("aria-pressed が選択状態を反映", () => {
    loadPageFresh();
    const { setLang } = (window as any).ReserveI18n;
    setLang("zh");
    const pressed = document.querySelector("#lang-switcher button[aria-pressed='true']");
    expect(pressed?.getAttribute("data-lang")).toBe("zh");
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: FAIL

- [ ] **Step 3: 実装**

HTML: `<div class="progress" id="progress"></div>` の直前に追加:
```html
<div id="lang-switcher" style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:8px 0;"></div>
```
CSS 追加（`<style>` 内）:
```css
#lang-switcher button{padding:6px 10px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:.8rem}
#lang-switcher button[aria-pressed="true"]{background:#06c755;color:#fff;border-color:#06c755}
```
IIFE 内（render の後に言語ボタン生成処理）。IIFE 末尾（初期化部）に:
```js
var LANG_LABELS = { ja:"日本語", en:"EN", zh:"中文", ko:"한국어", pt:"PT", es:"ES" };
function renderSwitcher() {
  var sw = document.getElementById("lang-switcher");
  if (!sw) return;
  // innerHTML 代入でなく removeChild で安全クリア（XSS 回避）
  while (sw.firstChild) sw.removeChild(sw.firstChild);
  SUPPORTED_KEYS.forEach(function(key) {
    var b = document.createElement("button");
    b.setAttribute("data-lang", key);
    b.setAttribute("role", "button");
    b.setAttribute("aria-pressed", String(key === currentLang));
    b.setAttribute("aria-label", "Language");
    b.textContent = LANG_LABELS[key];
    b.addEventListener("click", function() { setLang(key); renderSwitcher(); });
    sw.appendChild(b);
  });
}
// 初期化
currentLang = detectLang(
  (function(){ try { return localStorage.getItem("reserve_lang"); } catch(e){ return null; } })(),
  navigator.languages
);
render();
renderSwitcher();
```

- [ ] **Step 4: テスト実行（パス確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reserve-page.html src/reserve-page.test.ts
git commit -m "feat(i18n): 言語切替UI(6ボタン/aria-pressed/flex-wrap) + 初期化detectLang"
```

---

## Task 6: 既存6ステップUI の data-i18n 化 + zh/ko/pt/es カタログ拡張

**Files:**
- Modify: `worker/src/reserve-page.html`
- Modify: `worker/src/reserve-page.test.ts`

> **翻訳生成**: `zh`/`ko`/`pt`/`es` の各キーは `ja` を基に GLM（ホスト）で翻訳する。キー構造は `ja`/`en` と完全一致。

- [ ] **Step 1: カタログの全キー確定**

`ja`/`en` に全 UI キーを追加（ステップタイトル・ボタン・placeholder・確認画面ラベル・フィールド名）:
```js
// ja/en のみ抜粋（zh/ko/pt/es も同構造で追加）
"step1.title": "Step 1: 施術を選択" / "Step 1: Select treatment",
"step2.title": "Step 2: 日付を選択" / "Step 2: Select date",
"step3.title": "Step 3: 時間を選択" / "Step 3: Select time",
"step4.title": "Step 4: お客様情報" / "Step 4: Your information",
"step5.title": "予約内容の確認" / "Confirm reservation",
"step6.title": "予約完了" / "Reservation complete",
"treatment.first_30": "初診（30分）" / "First visit (30 min)",
"treatment.follow_30": "再診（30分）" / "Follow-up (30 min)",
"treatment.follow_60": "再診（60分）" / "Follow-up (60 min)",
"btn.check_slots": "空き枠を確認" / "Check availability",
"btn.back": "戻る" / "Back",
"btn.to_confirm": "確認画面へ" / "To confirmation",
"btn.submit": "予約する" / "Reserve",
"placeholder.name": "お名前" / "Name",
"placeholder.phone": "電話番号（09012345678）" / "Phone (09012345678)",
"confirm.treatment": "施術" / "Treatment",
"confirm.date": "日付" / "Date",
"confirm.time": "時間" / "Time",
"confirm.name": "お名前" / "Name",
"confirm.phone": "電話番号" / "Phone",
"fields.name": "お名前" / "Name",
"fields.phone": "電話番号" / "Phone",
"fields.date": "日付" / "Date",
"fields.time": "時間" / "Time",
"fields.treatment": "施術" / "Treatment",
"done.msg": "予約ID: " / "Reservation ID: ",
"error.date_required": "日付を選択してください" / "Please select a date",
"error.no_slots": "空き枠がありません" / "No slots available",
"error.fetch_failed": "空き枠取得に失敗しました" / "Failed to fetch slots",
"error.name_required": "お名前を入力してください" / "Please enter your name",
"error.phone_invalid": "電話番号は10-11桁で入力してください" / "Phone must be 10-11 digits",
"error.reserve_failed": "予約に失敗しました。時間をおいてもう一度お試しください。" / "Reservation failed. Please try again later."
```

- [ ] **Step 2: zh/ko/pt/es を GLM で翻訳して I18N に追加**

各キーについて `ja` → 各言語へ翻訳（demo品質・簡体/伯/墨ポリシー）。`I18N.zh`/`ko`/`pt`/`es` の空オブジェクトを埋める。

- [ ] **Step 3: カタログ網羅性テスト追加**

```ts
describe("I18N カタログ網羅性", () => {
  it("ja の全キーが 6言語すべてに存在", () => {
    loadPage();
    const { I18N } = (window as any).ReserveI18n;
    const langs = ["ja","en","zh","ko","pt","es"];
    const jaKeys = Object.keys(I18N.ja);
    const missing: string[] = [];
    for (const lang of langs) {
      for (const key of jaKeys) {
        if (!(key in I18N[lang])) missing.push(`${lang}.${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 4: 既存6ステップUI の日本語直書きを data-i18n / data-i18n-attr 化**

HTML 全要素の日本語直書きを `data-i18n` に置換（例: `<div class="step-title">Step 1: 施術を選択</div>` → `<div class="step-title" data-i18n="step1.title">Step 1: 施術を選択</div>`）。placeholder も `data-i18n-attr="placeholder:placeholder.name"` 等。

IIFE 内 `showConfirm` のラベル（「施術」「日付」等）も `t(currentLang, "confirm.treatment")` 等に置換。`treatments` 配列も `t(currentLang,"treatment.first_30")` 等から動的生成。

- [ ] **Step 5: テスト実行（パス確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: PASS（網羅性テスト含む全テスト）

- [ ] **Step 6: Commit**

```bash
git add src/reserve-page.html src/reserve-page.test.ts
git commit -m "feat(i18n): 6ステップUI全テキストdata-i18n化 + zh/ko/pt/es翻訳 + 網羅性テスト"
```

---

## Task 7: Worker normalizeGasError() + 両 handler 正規化

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/src/index.test.ts`

- [ ] **Step 1: 失敗テスト追加（index.test.ts）**

```ts
import { normalizeGasError } from "./index";

describe("normalizeGasError", () => {
  it("GAS が ok:true + reservation_id を返すと成功を正規化", () => {
    expect(normalizeGasError({ ok: true, reservation_id: "R123" })).toEqual({ ok: true, reservation_id: "R123" });
  });
  it("GAS が ok:true だが reservation_id 不在なら失敗に正規化", () => {
    expect(normalizeGasError({ ok: true })).toEqual({ ok: false, code: "ERR_RESERVATION_FAILED" });
  });
  it("GAS が ok:false を返すと code を残して正規化", () => {
    expect(normalizeGasError({ ok: false, error: "満席" })).toEqual({ ok: false, code: "ERR_SLOT_FULL" });
  });
  it("GAS が null/異常なら GENERIC", () => {
    expect(normalizeGasError(null)).toEqual({ ok: false, code: "ERR_GENERIC" });
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
cd worker && npx vitest run src/index.test.ts -t normalizeGasError
```
Expected: FAIL（未 export）

- [ ] **Step 3: normalizeGasError 実装（index.ts）**

```ts
export function normalizeGasError(gasResp: any): { ok: boolean; reservation_id?: string; code?: string; fields?: string[] } {
  if (!gasResp || typeof gasResp !== "object") {
    return { ok: false, code: "ERR_GENERIC" };
  }
  if (gasResp.ok === true) {
    // ホワイトリスト検証: reservation_id は文字列必須
    if (typeof gasResp.reservation_id === "string") {
      return { ok: true, reservation_id: gasResp.reservation_id };
    }
    return { ok: false, code: "ERR_RESERVATION_FAILED" };
  }
  // GAS 側の日本語/英語メッセージを破棄・code に正規化
  const msg = String(gasResp.error || gasResp.message || "");
  if (/満|full|slot/i.test(msg)) return { ok: false, code: "ERR_SLOT_FULL" };
  if (/phone|電話/i.test(msg)) return { ok: false, code: "ERR_INVALID_PHONE" };
  if (/missing|必須|未入力/i.test(msg)) return { ok: false, code: "ERR_MISSING_FIELDS" };
  return { ok: false, code: "ERR_GENERIC" };
}
```

- [ ] **Step 4: handleApiReserve/handleApiAvailability に適用**

両 handler で `forwardToGAS` の結果を `normalizeGasError()` に通して返すよう変更（成功時は reservation_id/slots を正規化）。既存のバリデーションエラー（Missing fields）も `{ok:false, code:"ERR_MISSING_FIELDS", fields:[...]}` 形式に。

- [ ] **Step 5: 既存 /api/reserve・/api/availability テストを code 形式に更新**

`index.test.ts` の既存 POST 成功テストの期待値を `{ok:true, reservation_id}` 形式に、エラー系を `{ok:false, code}` 形式に更新。

- [ ] **Step 6: テスト実行（パス確認）**

```bash
cd worker && npx vitest run src/index.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat(worker): normalizeGasError()共通関数 + 両handler code正規化(ホワイトリスト検証)"
```

---

## Task 8: フロント API エラー表示 + 回帰確認

**Files:**
- Modify: `worker/src/reserve-page.html`
- Modify: `worker/src/reserve-page.test.ts`

- [ ] **Step 1: 失敗テスト追加（エラー表示が各言語の汎用メッセージになる）**

```ts
describe("API error display (tError + fields)", () => {
  it("code から各言語メッセージを生成", () => {
    loadPage();
    const { tError, t } = (window as any).ReserveI18n;
    expect(tError("ja", "ERR_SLOT_FULL")).toBe("この時間は満席です。");
    expect(tError("en", "ERR_SLOT_FULL")).toBe("This time slot is fully booked.");
  });
});
```

- [ ] **Step 2: 実装（fetch 箇所のエラー処理を code ベースに）**

`reserve-page.html` の `fetch("/api/availability")` と `fetch("/api/reserve")` の `.then` で:
```js
.then(function(r) { return r.json(); })
.then(function(data) {
  // currentLang を再読み（in-flight 競合対策・spec §3.5）
  if (data.ok === false) {
    setError("slot-error", tError(currentLang, data.code || "ERR_GENERIC"));
    return;
  }
  // 成功時の既存処理...
});
```
`/api/reserve` の confirm-submit も同様に `data.ok`/`data.code` 判定。`fields` がある場合は `tError + I18N[currentLang].fields[name]` で表示。

- [ ] **Step 3: テスト実行（パス確認）**

```bash
cd worker && npx vitest run src/reserve-page.test.ts
```
Expected: PASS

- [ ] **Step 4: 全テスト回帰確認**

```bash
cd worker && npx vitest run
```
Expected: 全テスト PASS（index.test.ts + reserve-page.test.ts）

- [ ] **Step 5: 手動確認（任意）**

```bash
cd worker && npx wrangler dev
```
ブラウザで `/reserve` を開き・6ボタンで言語切替・入力値保持・エラー表示を確認。

- [ ] **Step 6: Commit**

```bash
git add src/reserve-page.html src/reserve-page.test.ts
git commit -m "feat(i18n): APIエラー表示(tError+fields多言語) + currentLang再読み(in-flight対策) + 回帰確認"
```

---

## Self-Review（plan 完成後チェック）

**1. Spec coverage**（spec v3 の各要件 → Task）
- §3.1 カタログ HTML 内埋め込み → Task 2/6
- §3.2 切替UI（flex-wrap/aria）→ Task 5
- §3.3 detectLang（SUPPORTED/サブ言語/en フォールバック/try-catch）→ Task 3
- §3.4 render（テキスト+属性/document.lang・title/確認画面ラベル）→ Task 4/6
- §3.5 API エラー（normalizeGasError/両handler/tError/fields/in-flight）→ Task 7/8
- §6 テスト（網羅性/t/tError/detectLang/render/両handler/回帰）→ 各 Task
- 全カバー ✓

**2. Placeholder scan**: TBD/TODO なし。翻訳（zh/ko/pt/es）は「実装時 GLM 生成」と明記（データなので・ロジックは完全コード）。

**3. Type consistency**: `t(lang,key)`/`tError(lang,code)`/`detectLang(stored,navLangs)`/`normalizeGasError(gasResp)` のシグネチャは Task 間で一致 ✓

---

## 実行後

各 Task 完了時に `ssot-record` スキルで SSOT 記録。全 Task 完了後・ネイティブレビュー（spec §9 推奨）。
