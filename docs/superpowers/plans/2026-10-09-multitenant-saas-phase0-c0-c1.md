# マルチテナントSaaS化 — Phase 0機械部分+C0+C1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spec `docs/superpowers/specs/2026-10-08-multitenant-saas-c-design.md`（v4確定版）のうち、コードで完結する部分（C0定数掃出し・Phase 0のKPI集計実装・C1軽量コントロールプレーン）を実装する。

**Architecture:** 既存GAS予約Bot（無変更流用・定数のみ外部化）に対し、①定数インベントリ自動生成スクリプト（C0）②KPI集計サービス（Phase 0・additive）③中央のテナント登録簿+ハートビート受け（Workers+D1・C1軽量版）を追加。データプレーン（予約処理ロジック）は一切変更しない。

**Tech Stack:** Google Apps Script（既存テストランナー=関数が `Array<{name, passed, message}>` を返す方式）・Cloudflare Workers（TypeScript+vitest・既存 `worker/`）・D1（SQLite）・pytest（定数スキャナ）

**スコープ外（この計画に含めない）:** C2（sandboxテナント実機検証）、C3（Stripe課金・ライセンス）、営業資材。これらは C0成果物（定数インベントリ）と Phase 0実測値に依存するため、C1ゲート通過後に別計画として作成する。Phase 0の人間タスク（兼業確認・模擬面接・メトリクス2〜4週記録・適法性チェック）はコードでないため本計画末尾の「人間タスク チェックリスト」に記載するのみ。

---

### Task 1: C0-1 定数スキャナ（テナント固有定数の摘出ツール）

**Files:**
- Create: `scripts/tenant_constant_scan.py`
- Create: `tests/test_tenant_constant_scan.py`
- Output（実行で生成）: `docs/tenant-constants.tsv`

- [ ] **Step 1: 失敗するテストを書く**

```python
# tests/test_tenant_constant_scan.py
"""tenant_constant_scan.py の単体テスト（リポジトリルートで pytest 実行）"""
from pathlib import Path

from scripts.tenant_constant_scan import scan_file, scan_repo, write_tsv

FIXTURE = """
var SHEET_ID = '1AbC_sheetid_1234567890';
var CHANNEL_ID = 'U1234567890abcdef123456';
var BASE_URL = 'https://script.google.com/macros/s/AKfycbXYZ/exec';
var RETRY_MAX = 3; // 共通設定・テナント固有でない
"""

def test_scan_file_detects_sheet_id():
    findings = scan_file("gas-project/Code.js", FIXTURE)
    cats = [f["category"] for f in findings]
    assert "spreadsheet_id" in cats

def test_scan_file_detects_line_channel_id():
    findings = scan_file("gas-project/Code.js", FIXTURE)
    cats = [f["category"] for f in findings]
    assert "line_channel_id" in cats

def test_scan_file_detects_webapp_url():
    findings = scan_file("gas-project/Code.js", FIXTURE)
    cats = [f["category"] for f in findings]
    assert "gas_webapp_url" in cats

def test_scan_file_ignores_common_numbers():
    findings = scan_file("gas-project/Code.js", FIXTURE)
    cats = [f["category"] for f in findings]
    assert "common_number" not in cats  # RETRY_MAX=3 は摘出しない

def test_tsv_has_required_columns(tmp_path):
    findings = scan_file("gas-project/Code.js", FIXTURE)
    out = tmp_path / "out.tsv"
    write_tsv(findings, out)
    header = out.read_text().splitlines()[0]
    assert header == "category\tvalue\tfile\tline\tjudgment"
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd /home/yn4416/projects/reserve-optimizer && python3 -m pytest tests/test_tenant_constant_scan.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'scripts.tenant_constant_scan'`）

- [ ] **Step 3: スキャナ本体を実装**

```python
# scripts/tenant_constant_scan.py
"""C0: GASコードからテナント固有定数を摘出しTSVインベントリを出力する。

spec §4 C0ゲートの成果物生成ツール。カテゴリ= spec §3の主要ストア配置表の
前提となる分類。judgment列は人間(CC)が Task 2 で記入するため空で出力する。
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

# (カテゴリ, 正規表現) — spec「無変更流用の定義」の対象=テナント固有値のみ
PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("spreadsheet_id", re.compile(r"'([A-Za-z0-9_-]{25,60})'\s*;\s*//\s*[Ss]heet|[Ss]preadsheet[^'\n]*'([A-Za-z0-9_-]{25,60})'")),
    ("line_channel_id", re.compile(r"'(U[0-9a-fA-F]{32})'")),
    ("line_channel_access_token", re.compile(r"'([A-Za-z0-9+/=]{100,})'\s*(?://.*)?$")),
    ("stripe_key_prefix", re.compile(r"'((?:sk|pk|whsec)_[A-Za-z0-9_]{8,})'")),
    ("gas_webapp_url", re.compile(r"'(https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec)'")),
]

TSV_HEADER = "category\tvalue\tfile\tline\tjudgment"


def scan_file(rel_path: str, content: str) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for lineno, line in enumerate(content.splitlines(), start=1):
        for category, pattern in PATTERNS:
            for match in pattern.finditer(line):
                value = next(g for g in match.groups() if g)
                findings.append(
                    {
                        "category": category,
                        "value": value[:40],
                        "file": rel_path,
                        "line": str(lineno),
                        "judgment": "",
                    }
                )
    return findings


def scan_repo(root: Path) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    for js in sorted(root.glob("gas-project/**/*.js")):
        if "tests" in js.parts or "node_modules" in js.parts:
            continue
        results.extend(scan_file(str(js.relative_to(root)), js.read_text(errors="replace")))
    return results


def write_tsv(findings: list[dict[str, str]], out: Path) -> None:
    lines = [TSV_HEADER]
    lines += [
        f"{f['category']}\t{f['value']}\t{f['file']}\t{f['line']}\t{f['judgment']}"
        for f in findings
    ]
    out.write_text("\n".join(lines) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="C0 tenant constant scanner")
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    out = args.out or (args.repo / "docs" / "tenant-constants.tsv")
    findings = scan_repo(args.repo)
    write_tsv(findings, out)
    print(f"scanned: {len(findings)} findings -> {out}")


if __name__ == "__main__":
    main()
```

注: `tests/` パッケージ化のため `tests/__init__.py` が無い場合は空ファイルを作成する（`scripts/__init__.py` も同様）。

- [ ] **Step 4: テストが通ることを確認**

Run: `python3 -m pytest tests/test_tenant_constant_scan.py -v`
Expected: 5 passed

- [ ] **Step 5: 実リポジトリに走らせインベントリを生成**

Run: `python3 scripts/tenant_constant_scan.py && head -20 docs/tenant-constants.tsv && wc -l docs/tenant-constants.tsv`
Expected: 「scanned: N findings」出力+TSV先頭行=ヘッダ

- [ ] **Step 6: Commit**

```bash
git add scripts/tenant_constant_scan.py tests/test_tenant_constant_scan.py tests/__init__.py scripts/__init__.py docs/tenant-constants.tsv
git commit -m "feat(c0): tenant constant scanner + inventory (spec §4 C0)"
```

### Task 2: C0-2 定数インベントリの判定記入

**Files:**
- Modify: `docs/tenant-constants.tsv`（judgment列）

- [ ] **Step 1: 各行に判定を記入する**

TSVのjudgment列に以下の3値のいずれかを記入（spec §3「無変更流用の定義」準拠）:
- `properties` = Script Propertiesへ移すべき（シークレット・チャネルID等テナント固有値）
- `common` = 共通設定として残す（タイムアウト秒数等・複数院で同一値）
- `remove` = 未使用定数（削除候補として C1後に消す）

判定ルール: 値が「院ごとに異なる」または「漏洩時に害がある」→`properties`。全院で同一かつ無害→`common`。

- [ ] **Step 2: 集計して全行判定済みを確認**

Run: `awk -F'\t' 'NR>1 && $5=="" {c++} END {print c+0, "rows without judgment"}' docs/tenant-constants.tsv`
Expected: `0 rows without judgment`

- [ ] **Step 3: Commit**

```bash
git add docs/tenant-constants.tsv
git commit -m "docs(c0): tenant constants inventory with judgments (spec §4 C0 gate)"
```

### Task 3: Phase 0-1 KPIログサービス（GAS側・additive）

**Files:**
- Create: `gas-project/services/KpiLogService.js`
- Create: `gas-project/tests/KpiLogServiceTests.js`
- Modify: `gas-project/tests/TestRunner.js`（末尾のテスト連結配列に1行追加）
- Modify: `gas-project/handlers/ReservationHandler.js`（予約成功/失敗パスに2行追加・**ロジック変更はしない**）

- [ ] **Step 1: 失敗するGASテストを書く**

```javascript
// gas-project/tests/KpiLogServiceTests.js
/**
 * KpiLogService unit tests - additivity only, no core logic touched.
 * Run in GAS environment: testKpiLogService()
 */

function testKpiLogService() {
  var tests = [];

  // ── logReservationEvent: 成功イベント行を書き込む ──
  try {
    var mockSheet = { appendRow: function(row) { mockSheet.lastRow = row; } };
    KpiLogService._setSheetForTest(mockSheet);
    KpiLogService.logReservationEvent('success', 'T0001', 'req-001', 'system');
    tests.push(_assert('logReservationEvent: writes row',
      mockSheet.lastRow && mockSheet.lastRow.length === 5, 'row must have 5 columns'));
    tests.push(_assert('logReservationEvent: success column',
      mockSheet.lastRow[1] === 'success', '2nd column is event type'));
  } catch (e) {
    tests.push({name: 'logReservationEvent', passed: false, message: 'Error: ' + e.toString()});
  }

  // ── logReservationEvent: 不正イベント種別は無視（silently skip）──
  try {
    var called = false;
    var mockSheet2 = { appendRow: function() { called = true; } };
    KpiLogService._setSheetForTest(mockSheet2);
    KpiLogService.logReservationEvent('bogus', 'T0001', 'req-002', 'system');
    tests.push(_assert('logReservationEvent: bogus type ignored', called === false,
      'unknown event type must not write'));
  } catch (e) {
    tests.push({name: 'logReservationEvent: bogus', passed: false, message: 'Error: ' + e.toString()});
  }

  // ── weeklySummary: 成功率を計算する ──
  try {
    var rows = [
      ['2026/10/01', 'success', 'T0001', 'r1', 'system'],
      ['2026/10/01', 'success', 'T0001', 'r2', 'system'],
      ['2026/10/02', 'failure', 'T0001', 'r3', 'system']
    ];
    var summary = KpiLogService.computeSuccessRate(rows);
    tests.push(_assert('computeSuccessRate: 2/3 ≈ 66.7%',
      Math.abs(summary.rate - 66.7) < 0.1, 'rate=' + summary.rate));
    tests.push(_assert('computeSuccessRate: total', summary.total === 3, 'total must be 3'));
  } catch (e) {
    tests.push({name: 'computeSuccessRate', passed: false, message: 'Error: ' + e.toString()});
  }

  return tests;
}
```

- [ ] **Step 2: テストをTestRunnerへ登録（連結を追加・既存行は触らない）**

`gas-project/tests/TestRunner.js` の `results.tests = results.tests.concat(testValidationUtils());` 等の連結列の末尾に追加:

```javascript
  results.tests = results.tests.concat(testKpiLogService());
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `bash gas-project/gas-run.sh testKpiLogService 2>&1 | tail -20; echo "EXIT=$?"`
Expected: FAIL（`KpiLogService is not defined`）※ gas-run.shの引数形式が異なる場合は `gas-project/gas-run.sh --help` を先に確認し、同名関数をローカル実行できる引数を使う

- [ ] **Step 4: KpiLogServiceを実装**

```javascript
// gas-project/services/KpiLogService.js
/**
 * KpiLogService - Phase 0 KPI集計のための予約イベント記録（additive・spec §8）。
 * 予約処理ロジックは一切変更しない。成功/失敗パスから fire-and-forget で呼ばれる。
 * シート: 「KPI_LOG」(5列: 日時, イベント種別, tenant_id, リクエストID, 起因)
 */
var KpiLogService = (function() {
  var SHEET_NAME = 'KPI_LOG';
  var VALID_EVENTS = ['success', 'failure'];
  var _testSheet = null;

  function _getSheet() {
    if (_testSheet) return _testSheet;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['日時', 'イベント', 'tenant_id', 'リクエストID', '起因']);
    }
    return sheet;
  }

  function logReservationEvent(eventType, tenantId, requestId, cause) {
    if (VALID_EVENTS.indexOf(eventType) === -1) return; // 不正種別は無視
    var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    _getSheet().appendRow([now, eventType, tenantId, requestId, cause]);
  }

  function computeSuccessRate(rows) {
    var total = rows.length;
    var success = 0;
    for (var i = 0; i < total; i++) {
      if (rows[i][1] === 'success') success++;
    }
    return { total: total, success: success, rate: total ? Math.round(success / total * 1000) / 10 : 0 };
  }

  function getWeeklyRows() {
    var sheet = _getSheet();
    var last = sheet.getLastRow();
    if (last < 2) return [];
    return sheet.getRange(2, 1, last - 1, 5).getValues();
  }

  // テスト用（本番コードから呼ばないこと）
  function _setSheetForTest(sheet) { _testSheet = sheet; }

  return {
    logReservationEvent: logReservationEvent,
    computeSuccessRate: computeSuccessRate,
    getWeeklyRows: getWeeklyRows,
    _setSheetForTest: _setSheetForTest
  };
})();
```

- [ ] **Step 5: 予約ハンドラへの差し込み（2行追加のみ）**

`gas-project/handlers/ReservationHandler.js` 内、予約作成成功のreturn直前と失敗パスに以下を追加（既存行は1行も変更しない・追加のみ）:

```javascript
  // 成功パスの return 直前:
  try { KpiLogService.logReservationEvent('success', 'T0001', requestId || '', 'system'); } catch (e) { /* KPIは予約を止めない */ }
  // 失敗パス（catch節内）:
  try { KpiLogService.logReservationEvent('failure', 'T0001', requestId || '', 'system'); } catch (e) { /* KPIは予約を止めない */ }
```

注: `requestId` 変数が当該スコープに無い場合は空文字 `''` を渡す（一意性はKPI集計に必須でない）。tenant_id は現行単一院のため `'T0001'` 固定（spec §4 C1どおり）。

- [ ] **Step 6: テストが通ることを確認**

Run: `bash gas-project/gas-run.sh testKpiLogService 2>&1 | tail -10; echo "EXIT=$?"`
Expected: 全テストPASS（exit 0）

- [ ] **Step 7: E2E回帰（データプレーン無変更の確認）**

Run: `node tests/run-all.js 2>&1 | tail -5; echo "EXIT=$?"`
Expected: 36/36 green・EXIT=0

- [ ] **Step 8: Commit**

```bash
git add gas-project/services/KpiLogService.js gas-project/tests/KpiLogServiceTests.js gas-project/tests/TestRunner.js gas-project/handlers/ReservationHandler.js
git commit -m "feat(phase0): KPI log service (additive, no core logic change) - spec §8"
```

### Task 4: C1-1 D1スキーママイグレーション

**Files:**
- Create: `worker/migrations/0001_tenant_registry.sql`

- [ ] **Step 1: マイグレーションSQLを書く**

```sql
-- worker/migrations/0001_tenant_registry.sql
-- C1軽量版: テナント登録簿+ハートビートのみ（spec §4 C1・Stripe/冪等はC2/C3で別マイグレーション）

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,          -- 例: T0001
  clinic_name TEXT NOT NULL,
  line_channel_id TEXT NOT NULL,       -- 検証用（自己診断照合）
  heartbeat_token TEXT NOT NULL,       -- ハートビート認証用（各院GASのScript Propertiesとペア）
  gas_deploy_url TEXT NOT NULL,
  stripe_customer_id TEXT,             -- C3で使用（C1ではNULL許容）
  status TEXT NOT NULL DEFAULT 'active',  -- active|warning|stopped|unknown
  license_valid_until TEXT,            -- ISO8601・C3で使用
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS heartbeats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
  last_reservation_at TEXT,            -- 非PII（spec §3ストア配置表）
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_tenant_time ON heartbeats(tenant_id, received_at);
```

- [ ] **Step 2: ローカルD1へ適用して動作確認**

Run: `cd worker && npx wrangler d1 execute reserve-optimizer --local --file=migrations/0001_tenant_registry.sql && npx wrangler d1 execute reserve-optimizer --local --command "SELECT name FROM sqlite_master WHERE type='table'" | tail -15; echo "EXIT=$?"`
Expected: `tenants` と `heartbeats` が表示される・EXIT=0
注: D1データベース名が未作成の場合は `npx wrangler d1 create reserve-optimizer` を先に実行し、出力の `database_id` を `worker/wrangler.toml` の `[[env.d1_databases]]` へ追記する（本番は `--env demo` 側にも同じく適用）。

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0001_tenant_registry.sql worker/wrangler.toml
git commit -m "feat(c1): D1 schema for tenant registry + heartbeats (spec §4 C1)"
```

### Task 5: C1-2 Worker実装（登録簿+ハートビート+ヘルス）

**Files:**
- Create: `worker/src/registry.ts`
- Create: `worker/src/registry.test.ts`
- Modify: `worker/src/index.ts`（既存fetchハンドラにルーティング3行を追加）

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// worker/src/registry.test.ts
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
    const res = await handleRegistryRequest(new Request("https://x/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("POST /heartbeat with valid token records heartbeat", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const req = new Request("https://x/heartbeat", {
      method: "POST",
      headers: {
        "Authorization": "Bearer hb-token-0001",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tenant_id: "T0001", last_reservation_at: null }),
    });
    const res = await handleRegistryRequest(req, env);
    expect(res.status).toBe(200);
  });

  it("POST /heartbeat with invalid token returns 401", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const req = new Request("https://x/heartbeat", {
      method: "POST",
      headers: { "Authorization": "Bearer wrong-token", "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: "T0001" }),
    });
    const res = await handleRegistryRequest(req, env);
    expect(res.status).toBe(401);
  });

  it("GET /tenants/:id returns tenant without secrets", async () => {
    const env = { DB: createRegistryD1Stub([[TENANT]]) };
    const res = await handleRegistryRequest(new Request("https://x/tenants/T0001"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { heartbeat_token?: string };
    expect(body.heartbeat_token).toBeUndefined(); // シークレットは返さない
  });

  it("GET /tenants/unknown returns 404", async () => {
    const env = { DB: createRegistryD1Stub([]) };
    const res = await handleRegistryRequest(new Request("https://x/tenants/T9999"), env);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd worker && npx vitest run src/registry.test.ts 2>&1 | tail -10; echo "EXIT=$?"`
Expected: FAIL（`Cannot find module './registry'`）

- [ ] **Step 3: registry.tsを実装**

```typescript
// worker/src/registry.ts
/**
 * C1軽量コントロールプレーン: テナント登録簿照会・ハートビート受信・ヘルス。
 * spec §4 C1（Stripe/ライセンスはC3・冪等テーブルはC2で別モジュール）。
 * 個人情報は保持しない（spec §3設計保証・ペイロードは非PIIのみ）。
 */

export interface Env {
  DB: D1Database;
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

/** テスト用インメモリD1スタブ（prepare/bind/first/all/run の最小契約） */
export function createRegistryD1Stub(tenantRows: TenantRow[][]) {
  const tenants = tenantRows[0] ?? [];
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM tenants WHERE tenant_id")) {
                const id = values[0] as string;
                return (tenants.find((t) => t.tenant_id === id) as T) ?? null;
              }
              return null;
            },
            async run() {
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

export async function handleRegistryRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/health") {
    return json({ status: "ok" });
  }

  if (path === "/heartbeat" && request.method === "POST") {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    let payload: { tenant_id?: string; last_reservation_at?: string | null };
    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    if (!payload.tenant_id) return json({ error: "tenant_id required" }, 400);
    const tenant = await env.DB.prepare(
      "SELECT * FROM tenants WHERE tenant_id = ?1"
    )
      .bind(payload.tenant_id)
      .first<TenantRow>();
    if (!tenant || tenant.heartbeat_token !== token) {
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
    const tenant = await env.DB.prepare(
      "SELECT * FROM tenants WHERE tenant_id = ?1"
    )
      .bind(tenantMatch[1])
      .first<TenantRow>();
    if (!tenant) return json({ error: "not found" }, 404);
    // シークレット（heartbeat_token）は返さない
    const { heartbeat_token, ...safe } = tenant;
    return json(safe);
  }

  return json({ error: "not found" }, 404);
}
```

注: 既存 `worker/src/index.ts` のD1バインディング名と異なる場合は本モジュールの `Env` に合わせる（wrangler.tomlの `binding` 名を `DB` に統一する方が変更が小さい）。

- [ ] **Step 4: テストが通ることを確認**

Run: `cd worker && npx vitest run src/registry.test.ts 2>&1 | tail -10; echo "EXIT=$?"`
Expected: 5 passed

- [ ] **Step 5: 既存index.tsへルーティングを追加**

`worker/src/index.ts` の fetch ハンドラ冒頭（他ルーティングより前）に追加:

```typescript
import { handleRegistryRequest } from "./registry";

// （fetchハンドラ内・url解析後の冒頭に）:
const pathname = new URL(request.url).pathname;
if (
  pathname === "/health" ||
  pathname === "/heartbeat" ||
  pathname.startsWith("/tenants/")
) {
  return handleRegistryRequest(request, env as never);
}
```

注: 既存index.tsに同名の `/health` ルートが既にある場合は、既存側を削除せず本ブロックを優先配置（先にマッチさせると既存に影響しない）。`env as never` は既存Env型と型が競合しないための一時措置で、既存Envへ `DB: D1Database` を足せば `as never` は削除してよい。

- [ ] **Step 6: 全テスト（既存含む）が通ることを確認**

Run: `cd worker && npx vitest run 2>&1 | tail -8; echo "EXIT=$?"`
Expected: 既存テスト含め全PASS・EXIT=0

- [ ] **Step 7: デプロイして実機ヘルス確認**

Run: `cd worker && npx wrangler deploy 2>&1 | tail -5 && curl -s https://reserve-optimizer.fukukei44161.workers.dev/health; echo; echo "EXIT=$?"`
Expected: `{"status":"ok"}`

- [ ] **Step 8: Commit**

```bash
git add worker/src/registry.ts worker/src/registry.test.ts worker/src/index.ts
git commit -m "feat(c1): tenant registry + heartbeat + health endpoints (spec §4 C1)"
```

### Task 6: C1-3 GAS側ハートビート送信

**Files:**
- Create: `gas-project/services/HeartbeatService.js`
- Create: `gas-project/tests/HeartbeatServiceTests.js`
- Modify: `gas-project/tests/TestRunner.js`（Task 3と同様の1行連結追加）

- [ ] **Step 1: 失敗するテストを書く**

```javascript
// gas-project/tests/HeartbeatServiceTests.js
/**
 * HeartbeatService unit tests - 中央への日次ハートビート送信（spec §4 C1）
 * Run in GAS environment: testHeartbeatService()
 */

function testHeartbeatService() {
  var tests = [];

  // ── buildPayload: 非PIIのみ（tenant_id+最終予約時刻）──
  try {
    var payload = HeartbeatService.buildPayload('T0001', '2026/10/08 22:00:00');
    var keys = Object.keys(payload);
    tests.push(_assert('buildPayload: only non-PII keys',
      keys.indexOf('tenant_id') !== -1 && keys.indexOf('last_reservation_at') !== -1 && keys.length === 2,
      'keys=' + keys.join(',')));
  } catch (e) {
    tests.push({name: 'buildPayload', passed: false, message: 'Error: ' + e.toString()});
  }

  // ── send: 中央へのPOST（モックUrlFetchApp）──
  try {
    var captured = null;
    var mockFetch = function(url, params) {
      captured = { url: url, params: params };
      return { getResponseCode: function() { return 200; } };
    };
    var result = HeartbeatService.send('T0001', null, 'https://central.example/heartbeat', 'hb-token-0001', mockFetch);
    tests.push(_assert('send: returns true on 200', result === true, 'must be true'));
    tests.push(_assert('send: Bearer token set',
      captured.params.headers.Authorization === 'Bearer hb-token-0001', 'token header missing'));
  } catch (e) {
    tests.push({name: 'send', passed: false, message: 'Error: ' + e.toString()});
  }

  // ── send: 5xx時は例外にせずfalse（予約を止めない）──
  try {
    var mock500 = function() { return { getResponseCode: function() { return 500; } }; };
    var result2 = HeartbeatService.send('T0001', null, 'https://central.example/heartbeat', 'tok', mock500);
    tests.push(_assert('send: returns false on 500', result2 === false, 'must be false, not throw'));
  } catch (e) {
    tests.push({name: 'send 500', passed: false, message: 'Error: ' + e.toString()});
  }

  return tests;
}
```

- [ ] **Step 2: TestRunnerへ連結追加**

Task 3 Step 2と同様に `results.tests = results.tests.concat(testHeartbeatService());` を末尾へ追加。

- [ ] **Step 3: テストが失敗することを確認**

Run: `bash gas-project/gas-run.sh testHeartbeatService 2>&1 | tail -10; echo "EXIT=$?"`
Expected: FAIL（`HeartbeatService is not defined`）

- [ ] **Step 4: HeartbeatServiceを実装**

```javascript
// gas-project/services/HeartbeatService.js
/**
 * HeartbeatService - 中央コントロールプレーンへの日次ハートビート送信（spec §4 C1）。
 * トリガー=既存の日次定期トリガー（無イベント院の静的死対策・spec §4 C1ゲート）。
 * 失敗しても例外を投げない（予約処理に影響しない・fire-and-forget）。
 */
var HeartbeatService = (function() {

  function buildPayload(tenantId, lastReservationAt) {
    // 非PIIのみ（spec §3ストア配置表）
    return { tenant_id: tenantId, last_reservation_at: lastReservationAt || null };
  }

  function send(tenantId, lastReservationAt, centralUrl, token, fetchImpl) {
    var doFetch = fetchImpl || UrlFetchApp.fetch;
    var payload = buildPayload(tenantId, lastReservationAt);
    try {
      var response = doFetch(centralUrl + '/heartbeat', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      return response.getResponseCode() === 200;
    } catch (e) {
      return false; // 中央障害時は諦める（次の定期トリガーで再試行）
    }
  }

  /** 日次トリガーから呼ばれるエントリポイント。Token/URLは Script Properties。 */
  function sendDaily() {
    var props = PropertiesService.getScriptProperties();
    var tenantId = props.getProperty('TENANT_ID') || 'T0001';
    var url = props.getProperty('CENTRAL_URL');
    var token = props.getProperty('HEARTBEAT_TOKEN');
    if (!url || !token) return; // 未設定なら何もしない（C1途中の院を壊さない）
    var lastReservationAt = props.getProperty('LAST_RESERVATION_AT'); // 予約サービスが更新（無ければnull）
    send(tenantId, lastReservationAt, url, token);
  }

  return { buildPayload: buildPayload, send: send, sendDaily: sendDaily };
})();
```

- [ ] **Step 5: テストが通ることを確認**

Run: `bash gas-project/gas-run.sh testHeartbeatService 2>&1 | tail -10; echo "EXIT=$?"`
Expected: 全テストPASS

- [ ] **Step 6: E2E回帰**

Run: `node tests/run-all.js 2>&1 | tail -5; echo "EXIT=$?"`
Expected: 36/36 green

- [ ] **Step 7: Commit**

```bash
git add gas-project/services/HeartbeatService.js gas-project/tests/HeartbeatServiceTests.js gas-project/tests/TestRunner.js
git commit -m "feat(c1): GAS heartbeat service (daily trigger, fire-and-forget) - spec §4 C1"
```

### Task 7: C1-4 中央死活の外部プローブRunbook

**Files:**
- Create: `docs/runbooks/uptime-probe.md`

- [ ] **Step 1: Runbookを書く**

```markdown
# 中央死活外部プローブ設定手順（spec §4 C1・「中央が死んで誰が気づくか」対策）

1. UptimeRobot（無料枠50モニター）でアカウント作成: https://uptimerobot.com
2. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: reserve-optimizer-central
   - URL: https://reserve-optimizer.fukukei44161.workers.dev/health
   - Monitoring Interval: 60分（無料枠の制約）
   - 「Send an email alert」に開発者メールアドレス
3. 1時間後にUptimeRobotダッシュボードで「Up」表示を確認
4. 検証: ターミナルから `curl -s https://reserve-optimizer.fukukei44161.workers.dev/health`
   が `{"status":"ok"}` を返すことと一致することを確認

注意: 60分間隔のため「検知遅延3h以内」KPI（spec §9）の中央側要件はこのプローブ+ハートビート欠落検知の組合せで満たす。プローブがDownになったら開発者が手動で復旧（spec §3 復旧権限=開発者）。
```

- [ ] **Step 2: プローブ設定を実施しDown/Upを確認**

Run: `curl -s https://reserve-optimizer.fukukei44161.workers.dev/health; echo`
Expected: `{"status":"ok"}`（プローブ対象が生きていることを実機確認）

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/uptime-probe.md
git commit -m "docs(c1): uptime probe runbook (spec §4 C1)"
```

### Task 8: C1回帰確認+ゲート判定材料の記録

**Files:**
- Create: `docs/c1-gate-checklist.md`

- [ ] **Step 1: 全回帰を実行**

Run: `cd /home/yn4416/projects/reserve-optimizer && node tests/run-all.js 2>&1 | tail -3; echo "E2E_EXIT=$?" && cd worker && npx vitest run 2>&1 | tail -5; echo "VITEST_EXIT=$?"`
Expected: E2E 36/36 green・vitest全PASS・両方EXIT=0

- [ ] **Step 2: ゲートチェックリストを書く（C1ゲート=spec §4・MLRとKPI基準値は別途）**

```markdown
# C1ゲート チェックリスト（spec §4 C1）

- [x] E2E36本全緑（実施日・EXIT=0を添付）
- [x] worker vitest 全緑
- [x] ハートビート源=日次定期トリガー方式の検証
  - 合格基準（spec §4）: T0001で7日連続トリガー発火確認+発火失敗時の外部再作成手順の動作確認
  - 判定: 「7日連続発火」は実機運用待ち（開始日: ____ / 判定日: 開始日+7日）
- [x] 中央死活の外部プローブ設定済み（docs/runbooks/uptime-probe.md）
- [ ] KPI基準値確定（Phase 0の2〜4週メトリクス記録後に記入）
- [ ] MLR（C1成果物に対する3機レビュー）

※ 「7日連続発火」と「KPI基準値」が未達の間、C1は**ゲート通過でなく実装完了**と呼ぶ（spec §4のゲート判定はこのチェックリスト全項目完了で確定）。
```

- [ ] **Step 3: Commit**

```bash
git add docs/c1-gate-checklist.md
git commit -m "docs(c1): gate checklist - implementation complete, gate pending on 7-day trigger + KPI baseline"
```

### Task 9: C0-3 セキュリティ自己レビュー（OWASP Top10視点・spec §4 C0ゲート）

**Files:**
- Create: `docs/c0-security-review.md`

- [ ] **Step 1: 既存GASコードへの機械チェックを実行（OWASP対応表のうち機械可能な項目）**

Run: `cd /home/yn4416/projects/reserve-optimizer && grep -rn "eval(\|new Function(\|innerHTML" gas-project --include='*.js' | grep -v node_modules | grep -v tests | head -10; echo "GREP_EXIT=$?" && grep -rn "Secret\|TOKEN\|KEY" gas-project/config/ScriptProperties.js | head -15; echo "EXIT=$?"`
Expected: コード実行系API（eval等）の使用=0件が理想・Secret類はScriptProperties経由で集中管理されていることを目視

- [ ] **Step 2: 脅威モデルごとの目視チェックを記録**

`docs/c0-security-review.md` に以下の観点ごとに「確認方法/結果/要対応」を記入（spec固有の脅威モデル+r4 OR1指摘のOWASP適用限界を踏まえたもの）:

| 脅威 | 確認方法 | 対応方針 |
|---|---|---|
| LINE webhookのパラメータ注入（Invalidated input） | ReservationHandler.js の doPost 内でユーザー入力をシートに書く箇所のサニタイズ有無を目視 | 予約氏名等はスプレッドシート限定=影響小・SQLなし |
| シークレットのハードコード | Task 1の定数インベントリ `stripe_key_prefix`・`line_channel_access_token` カテゴリが0件か確認 | 1件以上あればproperties判定へ |
| LOG経由の機密漏えい | `Logger.log` にtoken/本文全文を出していないか grep | tokenを出す箇所はマスク |
| URL Fetch先の固定性（SSRF） | fetch先URLがユーザー入力由来でないか確認 | 全URLはconfig固定値であること |
| 過度な権限（OAuth scope） | appsscript.json の oauthScopes が必要最小限か目視 | 余剰scopeは削除候補としてC1後に判断 |

- [ ] **Step 3: 要対応項目を0件または起票済みにして完了**

Run: `grep -c "要対応" docs/c0-security-review.md; echo "EXIT=$?"`
Expected: 要対応0件（または全件が `docs/tenant-constants.tsv` 判定またはバックグ起票済み）

- [ ] **Step 4: Commit**

```bash
git add docs/c0-security-review.md
git commit -m "docs(c0): security self-review (OWASP view + stack-specific threats, spec §4 C0 gate)"
```

---

## 人間タスク チェックリスト（コードでないため本計画では実行しない・spec §8）

- [ ] 兼業確認「明確OK」の取得（確認方法・担当・期日付きで記録）— **C3課金開始の前提**
- [ ] 模擬面接1回以上（CC資料初版が前提資料）
- [ ] 適法性チェックリスト（Stripe名義・特商法・インボイス・ココナラ経路）
- [ ] 現行院メトリクスの2〜4週記録（KPIベースライン）
- [ ] 撤退基準の運用開始（面談1件+往復2回=操作的定義の自動カウント）
- [ ] GASクォータ消費率測定（webhookリトライ最悪値シナリオ含む）

## 完了条件

Task 1〜8の全チェックボックス完了+人間タスクのうち「兼業確認」以外は並行進行可。C1の**ゲート通過判定**は7日連続トリガー発火確認後に確定する。C2以降の計画は本計画のC0成果物（`docs/tenant-constants.tsv`のjudgment分布）を見てから作成する。
