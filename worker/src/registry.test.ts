/**
 * registry ルートの単体テスト（vitest・インメモリD1スタブ）
 * spec §4 C1: 登録簿照会 / ハートビート受信 / ヘルス
 */
import { describe, expect, it } from "vitest";
import { createRegistryD1Stub, handleRegistryRequest } from "./registry";

const TENANT = {
  tenant_id: "T0001",
  clinic_name: "テスト整骨院",
  line_channel_id: "U1234567890abcdef123456",
  heartbeat_token: "hb-token-0001",
  gas_deploy_url: "https://script.google.com/macros/s/AKfycb/exec",
  stripe_customer_id: null,
  status: "active",
  license_valid_until: null,
  created_at: "2026-10-09 00:00:00",
};

describe("registry routes", () => {
  it("GET /health returns ok", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const res = await handleRegistryRequest(
      new Request("https://x/health"), env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("POST /heartbeat with valid token records", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const req = new Request("https://x/heartbeat", {
      method: "POST",
      headers: {
        "Authorization": "Bearer hb-token-0001",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenant_id: "T0001", last_reservation_at: null,
      }),
    });
    const res = await handleRegistryRequest(req, env);
    expect(res.status).toBe(200);
  });

  it("POST /heartbeat invalid token returns 401", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const req = new Request("https://x/heartbeat", {
      method: "POST",
      headers: {
        "Authorization": "Bearer wrong-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tenant_id: "T0001" }),
    });
    const res = await handleRegistryRequest(req, env);
    expect(res.status).toBe(401);
  });

  it("GET /tenants/:id returns tenant w/o secrets", async () => {
    const env = {
      DB: createRegistryD1Stub([[TENANT]]),
      ADMIN_TOKEN: "admin-tok",
    };
    const res = await handleRegistryRequest(
      new Request("https://x/tenants/T0001", {
        headers: { Authorization: "Bearer admin-tok" },
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { heartbeat_token?: string };
    expect(body.heartbeat_token).toBeUndefined();
  });

  it("GET /tenants/unknown returns 404", async () => {
    const env = {
      DB: createRegistryD1Stub([]),
      ADMIN_TOKEN: "admin-tok",
    };
    const res = await handleRegistryRequest(
      new Request("https://x/tenants/T9999", {
        headers: { Authorization: "Bearer admin-tok" },
      }),
      env
    );
    expect(res.status).toBe(404);
  });

  it("POST /heartbeat w/o auth header returns 401", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const res = await handleRegistryRequest(
      new Request("https://x/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: "T0001" }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("POST /heartbeat invalid json returns 400", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const res = await handleRegistryRequest(
      new Request("https://x/heartbeat", {
        method: "POST",
        headers: {
          "Authorization": "Bearer hb-token-0001",
          "Content-Type": "application/json",
        },
        body: "not-json{{",
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /heartbeat without tenant_id returns 400", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const res = await handleRegistryRequest(
      new Request("https://x/heartbeat", {
        method: "POST",
        headers: {
          "Authorization": "Bearer hb-token-0001",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ last_reservation_at: null }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("GET /tenants/:id wrong admin token returns 401", async () => {
    const env = {
      DB: createRegistryD1Stub([[TENANT]]),
      ADMIN_TOKEN: "admin-tok",
    };
    const res = await handleRegistryRequest(
      new Request("https://x/tenants/T0001", {
        headers: { Authorization: "Bearer wrong-admin" },
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("DB not configured returns 503", async () => {
    const env = { ADMIN_TOKEN: "admin-tok" };
    const res = await handleRegistryRequest(
      new Request("https://x/tenants/T0001", {
        headers: { Authorization: "Bearer admin-tok" },
      }),
      env
    );
    expect(res.status).toBe(503);
  });

  it("ADMIN_TOKEN unset returns 503 not auth bypass", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const res = await handleRegistryRequest(
      new Request("https://x/tenants/T0001", {
        headers: { Authorization: "Bearer undefined" },
      }),
      env
    );
    expect(res.status).toBe(503);
  });

  it("D1 failure returns 500 json not raw stack", async () => {
    const throwingDb = {
      prepare() {
        throw new Error("d1 exploded: stack trace here");
      },
    } as unknown as D1Database;
    const env = {
      DB: throwingDb,
      ADMIN_TOKEN: "admin-tok",
    };
    const res = await handleRegistryRequest(
      new Request("https://x/tenants/T0001", {
        headers: { Authorization: "Bearer admin-tok" },
      }),
      env
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("internal error");
  });

  it("subpath /tenants/:id/heartbeats returns 404", async () => {
    const env = {
      DB: createRegistryD1Stub([[TENANT]]),
      ADMIN_TOKEN: "admin-tok",
    };
    const res = await handleRegistryRequest(
      new Request("https://x/tenants/T0001/heartbeats", {
        headers: { Authorization: "Bearer admin-tok" },
      }),
      env
    );
    expect(res.status).toBe(404);
  });

  it("heartbeat records insert payload", async () => {
    const stub = createRegistryD1Stub([[TENANT]]) as unknown as {
      inserted: Array<{
        tenant_id: string;
        last_reservation_at: string | null;
      }>;
    };
    const env = { DB: stub as unknown as D1Database };
    const res = await handleRegistryRequest(
      new Request("https://x/heartbeat", {
        method: "POST",
        headers: {
          "Authorization": "Bearer hb-token-0001",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: "T0001",
          last_reservation_at: "2026-10-09T00:00:00Z",
        }),
      }),
      env
    );
    expect(res.status).toBe(200);
    expect(stub.inserted).toEqual([
      { tenant_id: "T0001", last_reservation_at: "2026-10-09T00:00:00Z" },
    ]);
  });
});
