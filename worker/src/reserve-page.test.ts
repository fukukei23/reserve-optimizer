import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

function loadPage() {
  const html = readFileSync(join(__dirname, "reserve-page.html"), "utf-8");
  // JSDOM constructor + runScripts:"dangerously" で <script> をサンドボックス内で安全に実行
  // （new Function/eval による文字列実行は使わない・コード注入リスク回避）
  // url 指定必須: opaque origin(about:blank)では localStorage が SecurityError になる
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://localhost/" });
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).navigator = dom.window.navigator;
  (global as any).localStorage = dom.window.localStorage;
}

function loadPageFresh() {
  // JSDOM 再生成で DOM を完全リセット（innerHTML 代入でなく再パース・安全）
  loadPage();
}

describe("reserve-page i18n setup", () => {
  it("window.ReserveI18n が露出する", () => {
    loadPage();
    expect((window as any).ReserveI18n).toBeDefined();
  });
});

describe("t / tError", () => {
  it("t('ja','page.title') は日本語を返す", () => {
    loadPage();
    const { t } = (window as any).ReserveI18n;
    expect(t("ja", "page.title")).toBe("Web予約");
  });
  it("t は未対応キーを en→ja→key へフォールバック", () => {
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
