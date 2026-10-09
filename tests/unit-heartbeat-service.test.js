/**
 * Unit Tests - HeartbeatService (C1 中央への日次ハートビート)
 *
 * Run: node tests/unit-heartbeat-service.test.js
 *
 * Uses vm.Script to share scope with loaded GAS source files.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals ───
var _props = {};
var _fetchCalls = [];

function resetMocks() {
  _props = {};
  _fetchCalls = [];
}

global.PropertiesService = {
  getScriptProperties: function() {
    return {
      getProperty: function(k) { return _props[k] || null; },
      setProperty: function(k, v) { _props[k] = String(v); }
    };
  }
};

global.UrlFetchApp = {
  fetch: function(url, params) {
    _fetchCalls.push({ url: url, params: params });
    return { getResponseCode: function() { return 200; } };
  }
};

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var full = path.join(gasDir, relPath);
  var code = fs.readFileSync(full, 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) })
    .runInThisContext();
}

loadFile('services/HeartbeatService.js');

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else {
    failed++;
    errors.push(name + (detail ? ' -- ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? ' (' + detail + ')' : ''));
  }
}
function assertEqual(name, actual, expected) {
  assert(name, actual === expected,
    'actual=' + JSON.stringify(actual)
    + ' expected=' + JSON.stringify(expected));
}

// ─── H1: buildPayload は非PIIのみ ──
var payload = HeartbeatService.buildPayload(
  'T0001', '2026/10/08 22:00:00'
);
assertEqual('H1: キーは2個',
  Object.keys(payload).length, 2);
assertEqual('H1: tenant_id', payload.tenant_id, 'T0001');
assertEqual('H1: last_reservation_at',
  payload.last_reservation_at, '2026/10/08 22:00:00');

// ─── H2: send は200でtrue・Bearer設定 ──
resetMocks();
var r1 = HeartbeatService.send(
  'T0001', null, 'https://central.example', 'hb-tok'
);
assertEqual('H2: 200でtrue', r1, true);
assertEqual('H2: 呼び出しは1回', _fetchCalls.length, 1);
assertEqual('H2: URLは/heartbeat',
  _fetchCalls[0].url, 'https://central.example/heartbeat');
assertEqual('H2: Bearerヘッダ',
  _fetchCalls[0].params.headers.Authorization, 'Bearer hb-tok');
assertEqual('H2: POSTメソッド',
  _fetchCalls[0].params.method, 'post');
assertEqual('H2: ペイロードはJSON',
  JSON.parse(_fetchCalls[0].params.payload).tenant_id, 'T0001');

// ─── H3: 5xx時は例外にせずfalse ──
resetMocks();
global.UrlFetchApp.fetch = function() {
  return { getResponseCode: function() { return 500; } };
};
var r2 = HeartbeatService.send('T0001', null, 'https://x', 't');
assertEqual('H3: 500でfalse', r2, false);

// ─── H4: 例外時もfalse（ネットワーク断）──
resetMocks();
global.UrlFetchApp.fetch = function() {
  throw new Error('network down');
};
var r3 = HeartbeatService.send('T0001', null, 'https://x', 't');
assertEqual('H4: 例外時にfalse', r3, false);

// ─── H5: sendDaily はProps未設定なら何もしない ──
resetMocks();
HeartbeatService.sendDaily();
assertEqual('H5: 未設定ならfetchしない', _fetchCalls.length, 0);

// ─── H6: sendDaily はPropsから値を取り送信 ──
resetMocks();
// H3/H4で置換したfetchを記録型に戻す（モック復元）
global.UrlFetchApp.fetch = function(url, params) {
  _fetchCalls.push({ url: url, params: params });
  return { getResponseCode: function() { return 200; } };
};
_props['TENANT_ID'] = 'T0001';
_props['CENTRAL_URL'] = 'https://central.example';
_props['HEARTBEAT_TOKEN'] = 'tok6';
_props['LAST_RESERVATION_AT'] =
  '2026-10-09T00:00:00.000Z';
HeartbeatService.sendDaily();
assertEqual('H6: fetchは1回', _fetchCalls.length, 1);
var sentPayload = JSON.parse(_fetchCalls[0].params.payload);
assertEqual('H6: tenant_id', sentPayload.tenant_id, 'T0001');
assertEqual('H6: last_reservation_at',
  sentPayload.last_reservation_at,
  '2026-10-09T00:00:00.000Z');

// ─── Results ───
console.log('\n========================================');
console.log('HeartbeatService Unit Tests');
console.log('Total: ' + (passed + failed)
  + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) {
    console.log('  FAIL ' + errors[i]);
  }
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
