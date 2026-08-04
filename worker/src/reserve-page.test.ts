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

describe("reserve-page i18n setup", () => {
  it("window.ReserveI18n が露出する", () => {
    loadPage();
    expect((window as any).ReserveI18n).toBeDefined();
  });
});
