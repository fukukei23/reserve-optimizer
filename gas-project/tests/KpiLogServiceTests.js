/**
 * KpiLogService unit tests - additivity only, no core logic touched.
 * Run in GAS environment: testKpiLogService()
 */

function testKpiLogService() {
  var tests = [];

  // ── logReservationEvent: 成功イベント行を書き込む ──
  try {
    var mockSheet = {
      appendRow: function(row) { mockSheet.lastRow = row; }
    };
    KpiLogService._setSheetForTest(mockSheet);
    KpiLogService.logReservationEvent(
      'success', 'T0001', 'req-001', 'system'
    );
    tests.push(_assert(
      'logReservationEvent: writes row',
      mockSheet.lastRow && mockSheet.lastRow.length === 5,
      'row must have 5 columns'
    ));
    tests.push(_assert(
      'logReservationEvent: success column',
      mockSheet.lastRow[1] === 'success',
      '2nd column is event type'
    ));
  } catch (e) {
    tests.push({
      name: 'logReservationEvent',
      passed: false,
      message: 'Error: ' + e.toString()
    });
  }

  // ── logReservationEvent: 不正イベント種別は無視 ──
  try {
    var called = false;
    var mockSheet2 = { appendRow: function() { called = true; } };
    KpiLogService._setSheetForTest(mockSheet2);
    KpiLogService.logReservationEvent(
      'bogus', 'T0001', 'req-002', 'system'
    );
    tests.push(_assert(
      'logReservationEvent: bogus type ignored',
      called === false,
      'unknown event type must not write'
    ));
  } catch (e) {
    tests.push({
      name: 'logReservationEvent: bogus',
      passed: false,
      message: 'Error: ' + e.toString()
    });
  }

  // ── weeklySummary: 成功率を計算する ──
  try {
    var rows = [
      ['2026/10/01', 'success', 'T0001', 'r1', 'system'],
      ['2026/10/01', 'success', 'T0001', 'r2', 'system'],
      ['2026/10/02', 'failure', 'T0001', 'r3', 'system']
    ];
    var summary = KpiLogService.computeSuccessRate(rows);
    tests.push(_assert(
      'computeSuccessRate: 2/3 ≈ 66.7%',
      Math.abs(summary.rate - 66.7) < 0.1,
      'rate=' + summary.rate
    ));
    tests.push(_assert(
      'computeSuccessRate: total',
      summary.total === 3,
      'total must be 3'
    ));
  } catch (e) {
    tests.push({
      name: 'computeSuccessRate',
      passed: false,
      message: 'Error: ' + e.toString()
    });
  }

  return tests;
}
