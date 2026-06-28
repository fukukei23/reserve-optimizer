/**
 * reserve-optimizer Worker
 * LINE/Stripe webhook を署名検証して GAS に転送する
 */

export interface Env {
  LINE_CHANNEL_SECRET: string;
  STRIPE_WEBHOOK_SECRET: string;
  GAS_WEBAPP_URL: string;
  GAS_AUTH_TOKEN: string;
  WEB_API_KEY: string;
  ALLOWED_ORIGINS: string; // カンマ区切り複数オリジン（本番 + デモ等）
  DEBUG?: string; // "true" のみデバッグログ出力
}

import RESERVE_PAGE_HTML from "./reserve-page.html";
import INTAKE_FORM_HTML from "./intake-form.html";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ヘルスチェック（GAS到達性確認付き）
    if (url.pathname === "/health") {
      let gasReachable = false;
      let gasLatencyMs = -1;
      try {
        const gasStart = Date.now();
        const gasResp = await fetch(env.GAS_WEBAPP_URL, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
        });
        gasLatencyMs = Date.now() - gasStart;
        gasReachable = gasResp.status === 200 || gasResp.status === 302;
      } catch {
        gasReachable = false;
      }
      return new Response(
        JSON.stringify({
          status: gasReachable ? "ok" : "degraded",
          gas_reachable: gasReachable,
          gas_latency_ms: gasLatencyMs,
          timestamp: new Date().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // LINE webhook
    if (url.pathname === "/webhook/line" && request.method === "POST") {
      return handleLineWebhook(request, env, ctx);
    }

    // Stripe webhook
    if (url.pathname === "/webhook/stripe" && request.method === "POST") {
      return handleStripeWebhook(request, env, ctx);
    }

    // Web reservation page
    if (url.pathname === "/reserve") {
      return new Response(RESERVE_PAGE_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
      });
    }

    // API: availability check
    if (url.pathname === "/api/availability" && (request.method === "POST" || request.method === "OPTIONS")) {
      return handleApiAvailability(request, env);
    }

    // API: create reservation
    if (url.pathname === "/api/reserve" && (request.method === "POST" || request.method === "OPTIONS")) {
      return handleApiReserve(request, env);
    }

    // Intake form page: /intake/:reservationId
    if (url.pathname.startsWith("/intake/") && request.method === "GET") {
      return new Response(INTAKE_FORM_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // API: save intake form
    if (url.pathname === "/api/intake" && (request.method === "POST" || request.method === "OPTIONS")) {
      return handleApiIntake(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

/**
 * LINE webhook 処理
 * 1. x-line-signature を HMAC-SHA256 で検証
 * 2. 即座に 200 OK を返す（LINE タイムアウト回避）
 * 3. 検証済みリクエストを GAS にバックグラウンド転送
 */
async function handleLineWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature) {
    return new Response("Missing x-line-signature", { status: 401 });
  }

  const isValid = await verifyLineSignature(body, signature, env.LINE_CHANNEL_SECRET);

  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  // LINE に即座に 200 OK を返す（タイムアウト回避）
  // GAS 転送は waitUntil でバックグラウンド実行
  ctx.waitUntil(
    forwardToGAS(body, env, "line").catch((e) =>
      console.error("[LINE] forwardToGAS error:", e.message)
    )
  );

  return new Response("OK", { status: 200 });
}

/**
 * Stripe webhook 処理
 * 1. Stripe-Signature ヘッダーを検証
 * 2. 検証済みリクエストを GAS に転送（x-verified=true&x-source=stripe）
 */
async function handleStripeWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.text();
  const sigHeader = request.headers.get("Stripe-Signature");

  if (!sigHeader) {
    return new Response("Missing Stripe-Signature", { status: 401 });
  }

  const isValid = await verifyStripeSignature(body, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  // 最小データのみ転送（URL長制限回避）
  const event = JSON.parse(body);
  const minimalData = {
    type: event.type,
    id: (event.data && event.data.object && event.data.object.id) || "",
    reservation_id:
      (event.data && event.data.object && event.data.object.metadata &&
        event.data.object.metadata.reservation_id) ||
      "",
  };

  return forwardToGAS(JSON.stringify(minimalData), env, "stripe");
}

/**
 * LINE 署名検証 (HMAC-SHA256 via Web Crypto API)
 */
export async function verifyLineSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));

  // バイナリ → Base64
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return timingSafeEqual(expected, signature);
}

/**
 * Stripe 署名検証 (t=timestamp,v1=signature via Web Crypto API)
 */
export async function verifyStripeSignature(
  body: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",");
  let timestamp = "";
  let signature = "";

  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signature = value;
  }

  if (!timestamp || !signature) return false;

  // タイムスタンプが5分以内かチェック
  const timestampInt = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestampInt) > 300) {
    return false;
  }

  // HMAC-SHA256(timestamp + "." + body)
  const payload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, signature);
}

/**
 * GAS にリクエストを転送
 * GAS Web App の 302 リダイレクトは POST を GET に変換し、body を消失する。
 * そのため GET リクエストで body をクエリパラメータとして渡す。
 * GAS 側の doGet が x-verified + x-body パラメータを処理する。
 */
async function forwardToGAS(body: string, env: Env, source: string, allowedOrigin = ""): Promise<Response> {
  const slimBody = slimForGAS(body, source);
  const encodedBody = encodeURIComponent(slimBody);
  const gasUrl = `${env.GAS_WEBAPP_URL}?x-verified=true&x-source=${source}&x-body=${encodedBody}&x-gas-auth=${encodeURIComponent(env.GAS_AUTH_TOKEN)}`;

  if (gasUrl.length > 2000) {
    console.error("[GAS] URL exceeds 2000 chars:", gasUrl.length);
  }

  let response = await fetch(gasUrl, {
    method: "GET",
    redirect: "manual",
  });

  // GAS が 302 を返した場合、Location に向けて再 GET
  if (response.status === 302 || response.status === 301) {
    const location = response.headers.get("Location");
    if (location) {
      const separator = location.includes("?") ? "&" : "?";
      const redirectUrl = `${location}${separator}x-verified=true&x-source=${source}&x-body=${encodedBody}&x-gas-auth=${encodeURIComponent(env.GAS_AUTH_TOKEN)}`;

      response = await fetch(redirectUrl, {
        method: "GET",
        redirect: "manual",
      });
    }
  }

  const respBody = await response.text();
  const headers = new Headers(response.headers);
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return new Response(respBody, {
    status: response.status,
    headers,
  });
}

/**
 * Strip unnecessary fields from webhook body to keep URL under ~2000 chars.
 * LINE: remove timestamp, webhookEventId, deliveryContext, mode from events
 * Stripe: remove pending_webhooks, request, livemode from top-level
 */
function slimForGAS(body: string, source: string): string {
  try {
    const parsed = JSON.parse(body);
    if (source === "line" && parsed.events) {
      parsed.events = parsed.events.map((e: any) => ({
        webhookEventId: e.webhookEventId,
        type: e.type,
        replyToken: e.replyToken,
        source: e.source,
        message: e.message,
        postback: e.postback,
      }));
      delete parsed.destination;
    } else if (source === "stripe") {
      delete parsed.pending_webhooks;
      delete parsed.request;
      delete parsed.livemode;
    }
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

/**
 * タイミングセーフな文字列比較
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// --- CORS headers for Web API ---
export function resolveAllowedOrigin(env: Env, request: Request): string {
  const origins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const reqOrigin = request.headers.get("Origin");
  if (reqOrigin && origins.includes(reqOrigin)) return reqOrigin;
  return origins[0] || "";
}

function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function corsResponse(body: string, allowedOrigin: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(allowedOrigin) },
  });
}

/**
 * API: 空き枠取得
 * POST /api/availability  { date: "2026/05/30" }
 */
async function handleApiAvailability(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(resolveAllowedOrigin(env, request)) });
  }

  let body: { date?: string };
  try {
    body = await request.json() as { date?: string };
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON" }), resolveAllowedOrigin(env, request), 400);
  }

  if (!body.date || !/^\d{4}\/\d{2}\/\d{2}$/.test(body.date)) {
    return corsResponse(JSON.stringify({ error: "date must be YYYY/MM/DD" }), resolveAllowedOrigin(env, request), 400);
  }

  return forwardToGAS(
    JSON.stringify({ action: "get_availability", date: body.date, api_token: env.WEB_API_KEY }),
    env,
    "api",
    resolveAllowedOrigin(env, request)
  );
}

/**
 * API: 問診票保存
 * POST /api/intake  { reservation_id, chief_complaint, medical_history, allergies, pregnancy, notes }
 */
async function handleApiIntake(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(resolveAllowedOrigin(env, request)) });
  }

  let body: {
    reservation_id?: string;
    chief_complaint?: string;
    medical_history?: string;
    allergies?: string;
    pregnancy?: string;
    notes?: string;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON" }), resolveAllowedOrigin(env, request), 400);
  }

  if (!body.reservation_id) {
    return corsResponse(JSON.stringify({ error: "reservation_id is required" }), resolveAllowedOrigin(env, request), 400);
  }
  if (!body.chief_complaint || !body.chief_complaint.trim()) {
    return corsResponse(JSON.stringify({ error: "chief_complaint is required" }), resolveAllowedOrigin(env, request), 400);
  }

  return forwardToGAS(
    JSON.stringify({
      action: "save_intake_form",
      reservation_id: body.reservation_id,
      chief_complaint: body.chief_complaint.trim(),
      medical_history: (body.medical_history || "").trim(),
      allergies: (body.allergies || "").trim(),
      pregnancy: body.pregnancy || "no",
      notes: (body.notes || "").trim(),
      api_token: env.WEB_API_KEY,
    }),
    env,
    "api",
    resolveAllowedOrigin(env, request)
  );
}

/**
 * API: 予約作成
 * POST /api/reserve  { name, phone, date, time, treatment }
 */
async function handleApiReserve(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(resolveAllowedOrigin(env, request)) });
  }

  let body: { name?: string; phone?: string; date?: string; time?: string; treatment?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON" }), resolveAllowedOrigin(env, request), 400);
  }

  const missing: string[] = [];
  if (!body.name) missing.push("name");
  if (!body.phone) missing.push("phone");
  if (!body.date) missing.push("date");
  if (!body.time) missing.push("time");
  if (!body.treatment) missing.push("treatment");

  if (missing.length > 0) {
    return corsResponse(JSON.stringify({ error: "Missing fields: " + missing.join(", ") }), resolveAllowedOrigin(env, request), 400);
  }

  const phoneDigits = body.phone!.replace(/[-\s]/g, "");
  if (!/^\d{10,11}$/.test(phoneDigits)) {
    return corsResponse(JSON.stringify({ error: "Invalid phone format" }), resolveAllowedOrigin(env, request), 400);
  }

  return forwardToGAS(
    JSON.stringify({
      action: "create_reservation",
      name: body.name,
      phone: phoneDigits,
      date: body.date,
      time: body.time,
      treatment: body.treatment,
      api_token: env.WEB_API_KEY,
    }),
    env,
    "api",
    resolveAllowedOrigin(env, request)
  );
}
