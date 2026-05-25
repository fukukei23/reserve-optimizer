/**
 * reserve-optimizer Worker
 * LINE/Stripe webhook を署名検証して GAS に転送する
 */

export interface Env {
  LINE_CHANNEL_SECRET: string;
  STRIPE_WEBHOOK_SECRET: string;
  GAS_WEBAPP_URL: string;
}

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

  console.log("[LINE] Received webhook, body length:", body.length);

  if (!signature) {
    console.log("[LINE] ERROR: Missing x-line-signature");
    return new Response("Missing x-line-signature", { status: 401 });
  }

  // HMAC-SHA256 検証
  const isValid = await verifyLineSignature(body, signature, env.LINE_CHANNEL_SECRET);
  console.log("[LINE] Signature valid:", isValid);

  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  // LINE に即座に 200 OK を返す（タイムアウト回避）
  // GAS 転送は waitUntil でバックグラウンド実行
  ctx.waitUntil(
    forwardToGAS(body, env, "line").catch((e) =>
      console.log("[LINE] forwardToGAS error:", e.message)
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

  console.log("[Stripe] Forwarding minimal data:", JSON.stringify(minimalData));

  return forwardToGAS(JSON.stringify(minimalData), env, "stripe");
}

/**
 * LINE 署名検証 (HMAC-SHA256 via Web Crypto API)
 */
async function verifyLineSignature(
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
async function verifyStripeSignature(
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
async function forwardToGAS(body: string, env: Env, source: string): Promise<Response> {
  console.log("[GAS] Forwarding to:", env.GAS_WEBAPP_URL);
  console.log("[GAS] Source:", source);
  console.log("[GAS] Body length:", body.length);

  // body を URL エンコードしてクエリパラメータに含める
  const encodedBody = encodeURIComponent(body);
  const gasUrl = `${env.GAS_WEBAPP_URL}?x-verified=true&x-source=${source}&x-body=${encodedBody}`;
  console.log("[GAS] Full URL length:", gasUrl.length);

  let response = await fetch(gasUrl, {
    method: "GET",
    redirect: "manual",
  });

  console.log("[GAS] Initial response status:", response.status);

  // GAS が 302 を返した場合、Location に向けて再 GET
  if (response.status === 302 || response.status === 301) {
    const location = response.headers.get("Location");
    console.log("[GAS] Redirect location:", location?.substring(0, 150));
    if (location) {
      // Location URL にパラメータを追加
      const separator = location.includes("?") ? "&" : "?";
      const redirectUrl = `${location}${separator}x-verified=true&x-source=${source}&x-body=${encodedBody}`;
      console.log("[GAS] Redirect URL length:", redirectUrl.length);

      response = await fetch(redirectUrl, {
        method: "GET",
        redirect: "manual",
      });

      console.log("[GAS] Final response status:", response.status);
    }
  }

  const respBody = await response.text();
  console.log("[GAS] Response body:", respBody.substring(0, 500));
  return new Response(respBody, {
    status: response.status,
    headers: response.headers,
  });
}

/**
 * タイミングセーフな文字列比較
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
