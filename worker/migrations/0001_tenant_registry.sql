-- worker/migrations/0001_tenant_registry.sql
-- C1軽量版: テナント登録簿+ハートビートのみ
-- (spec §4 C1・Stripe/冪等はC2/C3で別マイグレーション)

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  clinic_name TEXT NOT NULL,
  line_channel_id TEXT NOT NULL,
  heartbeat_token TEXT NOT NULL UNIQUE,
  gas_deploy_url TEXT NOT NULL,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  license_valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS heartbeats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
  last_reservation_at TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_tenant_time
  ON heartbeats(tenant_id, received_at);
