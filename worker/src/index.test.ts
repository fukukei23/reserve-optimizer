import { describe, it, expect, vi, afterEach } from "vitest";
import { timingSafeEqual, verifyLineSignature, verifyStripeSignature, resolveAllowedOrigin } from "./index";
import worker from "./index";

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

// --- fetch routing: CORS preflight (OPTIONS) + success response headers ---

afterEach(() => {
  vi.restoreAllMocks();
});

const stubEnv = () => ({
  ALLOWED_ORIGINS: "https://app.example,https://demo.example",
  GAS_WEBAPP_URL: "https://gas.example/exec",
  GAS_AUTH_TOKEN: "tok",
  WEB_API_KEY: "key",
  LINE_CHANNEL_SECRET: "s",
  STRIPE_WEBHOOK_SECRET: "s",
} as any);

const stubCtx = () => ({ waitUntil: (_: Promise<unknown>) => {} } as any);

function mockGAS(status: number, body: string) {
  globalThis.fetch = vi.fn(async () => new Response(body, { status })) as typeof fetch;
}

describe("CORS preflight: OPTIONS on API routes", () => {
  it("/api/availability OPTIONS → 204 + CORS ヘッダ", async () => {
    const req = new Request("https://w.example/api/availability", {
      method: "OPTIONS",
      headers: { Origin: "https://app.example" },
    });
    const res = await (worker as any).fetch(req, stubEnv(), stubCtx());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
  });

  it("/api/reserve OPTIONS → 204 + CORS ヘッダ", async () => {
    const req = new Request("https://w.example/api/reserve", {
      method: "OPTIONS",
      headers: { Origin: "https://demo.example" },
    });
    const res = await (worker as any).fetch(req, stubEnv(), stubCtx());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://demo.example");
  });

  it("/api/intake OPTIONS → 204 + CORS ヘッダ（既存・回帰保証）", async () => {
    const req = new Request("https://w.example/api/intake", {
      method: "OPTIONS",
      headers: { Origin: "https://app.example" },
    });
    const res = await (worker as any).fetch(req, stubEnv(), stubCtx());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
  });
});

describe("forwardToGAS 成功レスポンスの CORS ヘッダ付与", () => {
  it("/api/availability POST 成功 → Access-Control-Allow-Origin 付与", async () => {
    mockGAS(200, '{"slots":[]}');
    const req = new Request("https://w.example/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://app.example" },
      body: JSON.stringify({ date: "2026/05/30" }),
    });
    const res = await (worker as any).fetch(req, stubEnv(), stubCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
  });

  it("/api/reserve POST 成功 → Access-Control-Allow-Origin 付与", async () => {
    mockGAS(200, '{"reservation_id":"r1"}');
    const req = new Request("https://w.example/api/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://demo.example" },
      body: JSON.stringify({
        name: "山田", phone: "09012345678", date: "2026/05/30", time: "10:00", treatment: "massage",
      }),
    });
    const res = await (worker as any).fetch(req, stubEnv(), stubCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://demo.example");
  });

  it("/api/availability バリデーションエラー(400) → CORS ヘッダ付与（既存corsResponse・回帰保証）", async () => {
    const req = new Request("https://w.example/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://app.example" },
      body: JSON.stringify({ date: "invalid" }),
    });
    const res = await (worker as any).fetch(req, stubEnv(), stubCtx());
    expect(res.status).toBe(400);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
  });
});
