/**
 * HeartbeatService unit tests - 中央への日次ハートビート送信
 * (spec §4 C1)
 * Run in GAS environment: testHeartbeatService()
 */

function testHeartbeatService() {
  var tests = [];

  // ── buildPayload: 非PIIのみ ──
  try {
    var payload = HeartbeatService.buildPayload(
      'T0001', '2026/10/08 22:00:00'
    );
    var keys = Object.keys(payload);
    tests.push(_assert(
      'buildPayload: only non-PII keys',
      keys.indexOf('tenant_id') !== -1 &&
        keys.indexOf('last_reservation_at') !== -1 &&
        keys.length === 2,
      'keys=' + keys.join(',')
    ));
  } catch (e) {
    tests.push({
      name: 'buildPayload',
      passed: false,
      message: 'Error: ' + e.toString()
    });
  }

  // ── send: 中央へのPOST（モックUrlFetchApp）──
  try {
    var captured = null;
    var mockFetch = function(url, params) {
      captured = { url: url, params: params };
      return { getResponseCode: function() { return 200; } };
    };
    var result = HeartbeatService.send(
      'T0001', null,
      'https://central.example/heartbeat',
      'hb-token-0001',
      mockFetch
    );
    tests.push(_assert(
      'send: returns true on 200',
      result === true,
      'must be true'
    ));
    tests.push(_assert(
      'send: Bearer token set',
      captured.params.headers.Authorization ===
        'Bearer hb-token-0001',
      'token header missing'
    ));
  } catch (e) {
    tests.push({
      name: 'send',
      passed: false,
      message: 'Error: ' + e.toString()
    });
  }

  // ── send: 5xx時は例外にせずfalse ──
  try {
    var mock500 = function() {
      return { getResponseCode: function() { return 500; } };
    };
    var result2 = HeartbeatService.send(
      'T0001', null,
      'https://central.example/heartbeat',
      'tok', mock500
    );
    tests.push(_assert(
      'send: returns false on 500',
      result2 === false,
      'must be false, not throw'
    ));
  } catch (e) {
    tests.push({
      name: 'send 500',
      passed: false,
      message: 'Error: ' + e.toString()
    });
  }

  return tests;
}
