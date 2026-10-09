/**
 * C1軽量コントロールプレーン:
 * テナント登録簿照会・ハートビート受信・ヘルス。
 * spec §4 C1（Stripe/ライセンスはC3・冪等テーブルはC2）。
 * 個人情報は保持しない（spec §3設計保証・ペイロードは非PIIのみ）。
 */

export interface RegistryEnv {
  DB?: D1Database;
  // /tenants照会用（wrangler secret put ADMIN_TOKEN・r6 GLM#2）
  ADMIN_TOKEN?: string;
}

interface TenantRow {
  tenant_id: string;
  clinic_name: string;
  line_channel_id: string;
  heartbeat_token: string;
  gas_deploy_url: string;
  stripe_customer_id: string | null;
  status: string;
  license_valid_until: string | null;
  created_at: string;
}

/** テスト用インメモリD1スタブ（最小契約） */
export function createRegistryD1Stub(tenantRows: TenantRow[][]) {
  const tenants = tenantRows[0] ?? [];
  const inserted: Array<{ tenant_id: string; last_reservation_at: string | null }> = [];
  return {
    inserted,
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM tenants WHERE tenant_id")) {
                const id = values[0] as string;
                return (
                  (tenants.find((t) => t.tenant_id === id) as T) ?? null
                );
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO heartbeats")) {
                inserted.push({
                  tenant_id: values[0] as string,
                  last_reservation_at:
                    (values[1] as string | null) ?? null,
                });
              }
              return { success: true };
            },
            async all<T>() {
              return { results: tenants as T[] };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// MLR r2採用: 定数時間比較（2ラウンド連続指摘・規定により最優先作業化）
// 長さ不一致は即false（長さは秘匿情報でない・標準的実装）
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const BEARER_PREFIX = "Bearer ";

function extractBearer(header: string | null): string {
  return (header ?? "").replace(/^Bearer\s+/i, "");
}

export async function handleRegistryRequest(
  request: Request,
  env: RegistryEnv
): Promise<Response> {
  // MLR採用(B): D1例外の生500伝播・スタック漏洩防止
  // （GLM#3指摘採用・2026-10-09）
  try {
    return await handleRegistryInner(request, env);
  } catch (err) {
    // MLR r2採用: 500を握り潰さずWorkersログへ記録
    console.error("registry error:", err);
    return json({ error: "internal error" }, 500);
  }
}

async function handleRegistryInner(
  request: Request,
  env: RegistryEnv
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/health") {
    return json({ status: "ok" });
  }

  if (path === "/heartbeat" && request.method === "POST") {
    if (!env.DB) return json({ error: "db not configured" }, 503);
    const token = extractBearer(request.headers.get("Authorization"));
    let payload: {
      tenant_id?: string;
      last_reservation_at?: string | null;
    };
    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    if (!payload.tenant_id) {
      return json({ error: "tenant_id required" }, 400);
    }
    const tenant = await env.DB.prepare(
      "SELECT * FROM tenants WHERE tenant_id = ?1"
    )
      .bind(payload.tenant_id)
      .first<TenantRow>();
    if (!tenant || !timingSafeEqual(tenant.heartbeat_token, token)) {
      return json({ error: "unauthorized" }, 401);
    }
    await env.DB.prepare(
      "INSERT INTO heartbeats (tenant_id, last_reservation_at) VALUES (?1, ?2)"
    )
      .bind(payload.tenant_id, payload.last_reservation_at ?? null)
      .run();
    return json({ status: "recorded" });
  }

  const tenantMatch = path.match(/^\/tenants\/([A-Za-z0-9]+)$/);
  if (tenantMatch && request.method === "GET") {
    // /tenants照会は管理操作のため ADMIN_TOKEN 認証必須
    // （無認証だと院名・URLが公開列挙される・r6 GLM#2）
    if (!env.DB) return json({ error: "db not configured" }, 503);
    // MLR採用(A): ADMIN_TOKEN未設定時は503（"Bearer undefined"
    // 一致による認証回避ホール防止・4機一致指摘 2026-10-09）
    if (!env.ADMIN_TOKEN) {
      return json({ error: "admin token not configured" }, 503);
    }
    const adminAuth = request.headers.get("Authorization") ?? "";
    if (
      !adminAuth.startsWith(BEARER_PREFIX) ||
      !timingSafeEqual(
        adminAuth.slice(BEARER_PREFIX.length), env.ADMIN_TOKEN
      )
    ) {
      return json({ error: "unauthorized" }, 401);
    }
    const tenant = await env.DB.prepare(
      "SELECT * FROM tenants WHERE tenant_id = ?1"
    )
      .bind(tenantMatch[1])
      .first<TenantRow>();
    if (!tenant) return json({ error: "not found" }, 404);
    // シークレット（heartbeat_token）は返さない
    // （MLR r2採用・rename destructureで意図明示）
    const { heartbeat_token: _omitted, ...safe } = tenant;
    void _omitted;
    return json(safe);
  }

  return json({ error: "not found" }, 404);
}
