/**
 * Unit Tests - KpiLogService (Phase 0 KPI集計・additive)
 *
 * Run: node tests/unit-kpi-log-service.test.js
 *
 * Uses vm.Script to share scope with loaded GAS source files.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals ───
var _mockSheets = {};
var _insertedNames = [];

function resetMockSheets() {
  _mockSheets = {};
  _insertedNames = [];
}

function addMockSheet(name, headers, rows) {
  _mockSheets[name] = { headers: headers || [], rows: rows || [] };
}

global.SpreadsheetApp = {
  getActiveSpreadsheet: function() {
    return {
      getSheetByName: function(name) {
        var s = _mockSheets[name];
        if (!s) return null;
        return makeSheet(name, s);
      },
      insertSheet: function(name) {
        _insertedNames.push(name);
        _mockSheets[name] = { headers: [], rows: [] };
        return makeSheet(name, _mockSheets[name]);
      }
    };
  }
};

function makeSheet(name, s) {
  return {
    appendRow: function(row) { s.rows.push(row); },
    // GAS実セマンティクス: 最終行index=1-based、
    // 行1から詰まっている場合=行数と一致
    getLastRow: function() { return s.rows.length; },
    getRange: function(row, col, numRows, numCols) {
      return {
        getValues: function() {
          var out = [];
          for (var r = 0; r < numRows; r++) {
            var src = s.rows[row - 1 + r] || [];
            var line = [];
            for (var c = 0; c < numCols; c++) {
              line.push(src[col - 1 + c] !== undefined
                ? src[col - 1 + c] : '');
            }
            out.push(line);
          }
          return out;
        }
      };
    }
  };
}

global.Utilities = {
  formatDate: function() { return '2026/10/09 12:00:00'; }
};

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var full = path.join(gasDir, relPath);
  var code = fs.readFileSync(full, 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) })
    .runInThisContext();
}

loadFile('services/KpiLogService.js');

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

// ─── K1: logReservationEvent 成功行を書き込む ──
resetMockSheets();
KpiLogService.logReservationEvent(
  'success', 'T0001', 'req-001', 'system'
);
assertEqual('K1: KPI_LOGシートが遅延作成される',
  _insertedNames.indexOf('KPI_LOG') !== -1, true);
var kpiSheet = _mockSheets['KPI_LOG'];
// 1行目=ヘッダ（insertSheet直後のappendRow）+2行目=イベント
assertEqual('K1: ヘッダ+イベントの2行',
  kpiSheet.rows.length, 2);
assertEqual('K1: ヘッダは5列',
  kpiSheet.rows[0].length, 5);
assertEqual('K1: イベント行は5列',
  kpiSheet.rows[1].length, 5);
assertEqual('K1: 2列目=イベント種別 success',
  kpiSheet.rows[1][1], 'success');
assertEqual('K1: 3列目=tenant_id',
  kpiSheet.rows[1][2], 'T0001');

// ─── K2: 不正イベント種別は無視 ──
resetMockSheets();
KpiLogService.logReservationEvent(
  'bogus', 'T0001', 'req-002', 'system'
);
assertEqual('K2: bogusは書き込まない',
  (_mockSheets['KPI_LOG'] || { rows: [] }).rows.length, 0);

// ─── K3: computeSuccessRate ──
var rows3 = [
  ['2026/10/01', 'success', 'T0001', 'r1', 'system'],
  ['2026/10/01', 'success', 'T0001', 'r2', 'system'],
  ['2026/10/02', 'failure', 'T0001', 'r3', 'system']
];
var summary = KpiLogService.computeSuccessRate(rows3);
assertEqual('K3: total=3', summary.total, 3);
assertEqual('K3: success=2', summary.success, 2);
assert('K3: rate≈66.7',
  Math.abs(summary.rate - 66.7) < 0.1, 'rate=' + summary.rate);

// ─── K4: getAllRows（複数行取得・r2リネーム追従）──
resetMockSheets();
KpiLogService.logReservationEvent('success', 'T0001', 'r1', 'system');
KpiLogService.logReservationEvent('failure', 'T0001', 'r2', 'system');
var weekly = KpiLogService.getAllRows();
assertEqual('K4: 2行取得', weekly.length, 2);

// ─── Results ───
console.log('\n========================================');
console.log('KpiLogService Unit Tests');
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
