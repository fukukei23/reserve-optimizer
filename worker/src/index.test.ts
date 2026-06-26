import { describe, it, expect } from "vitest";
import { timingSafeEqual, verifyLineSignature, verifyStripeSignature, resolveAllowedOrigin } from "./index";

// --- timingSafeEqual ---

describe("timingSafeEqual", () => {
  it("等値の文字列で true を返す", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });

  it("内容が異なる文字列で false を返す", () => {
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  it("長さが異なる文字列で false を返す", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("空文字列同士で true を返す", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

// --- verifyLineSignature ---

async function makeLineSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

describe("verifyLineSignature", () => {
  const secret = "test-line-secret";
  const body = '{"events":[{"type":"message"}]}';

  it("正しい署名で true を返す", async () => {
    const sig = await makeLineSignature(body, secret);
    expect(await verifyLineSignature(body, sig, secret)).toBe(true);
  });

  it("改ざんされた署名で false を返す", async () => {
    expect(await verifyLineSignature(body, "invalidsignature==", secret)).toBe(false);
  });

  it("body が異なる場合に false を返す", async () => {
    const sig = await makeLineSignature(body, secret);
    expect(await verifyLineSignature('{"events":[]}', sig, secret)).toBe(false);
  });

  it("secret が異なる場合に false を返す", async () => {
    const sig = await makeLineSignature(body, "other-secret");
    expect(await verifyLineSignature(body, sig, secret)).toBe(false);
  });
});

// --- verifyStripeSignature ---

async function makeStripeSignature(payload: string, secret: string, timestamp: number): Promise<string> {
  const sigPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(sigPayload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const body = '{"type":"checkout.session.completed"}';

  it("正しい署名で true を返す", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const v1 = await makeStripeSignature(body, secret, ts);
    const sigHeader = `t=${ts},v1=${v1}`;
    expect(await verifyStripeSignature(body, sigHeader, secret)).toBe(true);
  });

  it("タイムスタンプが5分超過で false を返す", async () => {
    const ts = Math.floor(Date.now() / 1000) - 400; // 6分以上前
    const v1 = await makeStripeSignature(body, secret, ts);
    const sigHeader = `t=${ts},v1=${v1}`;
    expect(await verifyStripeSignature(body, sigHeader, secret)).toBe(false);
  });

  it("改ざんされた署名で false を返す", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sigHeader = `t=${ts},v1=0000000000000000000000000000000000000000000000000000000000000000`;
    expect(await verifyStripeSignature(body, sigHeader, secret)).toBe(false);
  });

  it("Signature ヘッダーに t または v1 がない場合に false を返す", async () => {
    expect(await verifyStripeSignature(body, "v1=abc", secret)).toBe(false);
    expect(await verifyStripeSignature(body, "t=12345", secret)).toBe(false);
    expect(await verifyStripeSignature(body, "", secret)).toBe(false);
  });
});

// --- resolveAllowedOrigin ---

describe("resolveAllowedOrigin", () => {
  it("リクエスト Origin が許可リストにあればそれを返す", () => {
    const env = { ALLOWED_ORIGINS: "https://a.example,https://b.example" } as any;
    const req = new Request("https://a.example/api", { headers: { Origin: "https://a.example" } });
    expect(resolveAllowedOrigin(env, req)).toBe("https://a.example");
  });

  it("リクエスト Origin が許可リストに無ければ先頭の許可オリジンを返す", () => {
    const env = { ALLOWED_ORIGINS: "https://a.example,https://b.example" } as any;
    const req = new Request("https://evil.example/api", { headers: { Origin: "https://evil.example" } });
    expect(resolveAllowedOrigin(env, req)).toBe("https://a.example");
  });

  it("Origin ヘッダーが無ければ先頭の許可オリジンを返す", () => {
    const env = { ALLOWED_ORIGINS: "https://a.example,https://b.example" } as any;
    const req = new Request("https://a.example/api");
    expect(resolveAllowedOrigin(env, req)).toBe("https://a.example");
  });

  it("ALLOWED_ORIGINS が空なら空文字を返す", () => {
    const env = { ALLOWED_ORIGINS: "" } as any;
    const req = new Request("https://a.example/api", { headers: { Origin: "https://a.example" } });
    expect(resolveAllowedOrigin(env, req)).toBe("");
  });

  it("スペース混じりのリストを trim して扱う", () => {
    const env = { ALLOWED_ORIGINS: " https://a.example , https://b.example " } as any;
    const req = new Request("https://b.example/api", { headers: { Origin: "https://b.example" } });
    expect(resolveAllowedOrigin(env, req)).toBe("https://b.example");
  });
});
