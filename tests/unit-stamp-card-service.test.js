/**
 * Unit Tests - W3-1 スタンプカードサービス
 *
 * Run: node tests/unit-stamp-card-service.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Test runner ───
var _results = { pass: 0, fail: 0, errors: [] };
function test(name, fn) {
  try {
    fn();
    _results.pass++;
    process.stdout.write('.');
  } catch (e) {
    _results.fail++;
    _results.errors.push({ name: name, error: e.message });
    process.stdout.write('F');
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

// ─── GAS global stubs ───
var _mockScriptProps = {};
var _logRows = [];
var _pushLogs = [];

global.PropertiesService = {
  getScriptProperties: function() {
    return {
      getProperty: function(k) { return _mockScriptProps[k] !== undefined ? _mockScriptProps[k] : null; },
      setProperty: function(k, v) { _mockScriptProps[k] = v; }
    };
  }
};
global.Utilities = {
  formatDate: function() { return '2026/06/13 10:00:00'; }
};
global.Logger = { log: function() {} };
global.CacheService = {
  getScriptCache: function() { return { get: function() { return null; }, put: function() {}, remove: function() {} }; }
};
global.appendLogRow = function(level, msg) { _logRows.push({ level: level, msg: msg }); };
global.sendLinePush = function(userId, msg) { _pushLogs.push({ userId: userId, msg: msg }); };
global.getSpreadsheetId = function() { return 'SHEET001'; };
global.getStampThreshold = function() {
  return parseInt(_mockScriptProps['STAMP_THRESHOLD'] !== undefined ? _mockScriptProps['STAMP_THRESHOLD'] : '10');
};
global.getStampRewardMessage = function() {
  return _mockScriptProps['STAMP_REWARD_MESSAGE'] || 'スタンプ10枚達成！特典をご利用ください。';
};

// ─── Spreadsheet mock ───
var HEADERS = ['line_user_id', 'stamp_count', 'total_stamps_earned', 'last_stamped_reservation_id', 'last_stamped_at', 'updated_at'];
var _mockRows = [];

var _mockSheet = {
  appendRow: function(row) { _mockRows.push(row.slice()); },
  getDataRange: function() {
    return {
      getValues: function() {
        return _mockRows.length > 0 ? _mockRows.map(function(r) { return r.slice(); }) : [HEADERS.slice()];
      }
    };
  },
  getRange: function(row, col, numRows, numCols) {
    return {
      setValue: function(val) {
        if (!_mockRows[row - 1]) _mockRows[row - 1] = [];
        _mockRows[row - 1][col - 1] = val;
      },
      setValues: function(vals) {
        if (!_mockRows[row - 1]) _mockRows[row - 1] = [];
        var flatVals = vals[0];
        for (var c = 0; c < flatVals.length; c++) {
          _mockRows[row - 1][col - 1 + c] = flatVals[c];
        }
      }
    };
  }
};
var _mockSS = {
  getSheetByName: function(name) { return name === 'stamp_cards' ? _mockSheet : null; },
  insertSheet: function() { return _mockSheet; }
};
global.SpreadsheetApp = { openById: function() { return _mockSS; } };

function resetMocks() {
  _mockRows = [HEADERS.slice()];
  _logRows = [];
  _pushLogs = [];
  _mockScriptProps = { SPREADSHEET_ID: 'SHEET001' };
}

// ─── Load source ───
resetMocks();
var gasDir = path.join(__dirname, '..', 'gas-project');
var code = fs.readFileSync(path.join(gasDir, 'services', 'StampCardService.js'), 'utf8');
new vm.Script(code, { filename: 'StampCardService.js' }).runInThisContext();

// ─── addStamp: 基本 ───

test('addStamp: lineUserIdなし → ok:false + error', function() {
  resetMocks();
  var r = addStamp(null, 'R001');
  assertEqual(r.ok, false);
  assert(r.error, 'error message exists');
});

test('addStamp: reservationIdなし → ok:false + error', function() {
  resetMocks();
  var r = addStamp('U001', null);
  assertEqual(r.ok, false);
  assert(r.error, 'error message exists');
});

test('addStamp: 新規ユーザー → ok:true, stampCount=1, rewarded=false', function() {
  resetMocks();
  var r = addStamp('U001', 'R001');
  assertEqual(r.ok, true);
  assertEqual(r.stampCount, 1);
  assertEqual(r.rewarded, false);
});

test('addStamp: 新規ユーザーでシートに1行追加される', function() {
  resetMocks();
  var before = _mockRows.length;
  addStamp('U001', 'R001');
  assertEqual(_mockRows.length, before + 1);
});

test('addStamp: 既存ユーザーの2回目のスタンプ → stampCount=2', function() {
  resetMocks();
  addStamp('U001', 'R001');
  var r = addStamp('U001', 'R002');
  assertEqual(r.ok, true);
  assertEqual(r.stampCount, 2);
});

// ─── addStamp: 重複防止 ───

test('addStamp: 同一reservationIdで2回 → 2回目はスタンプ増えない', function() {
  resetMocks();
  addStamp('U001', 'R001');
  var r2 = addStamp('U001', 'R001');
  assertEqual(r2.ok, true);
  assertEqual(r2.stampCount, 1, 'stamp unchanged');
  assertEqual(r2.rewarded, false);
});

test('addStamp: 重複スタンプでsendLinePushは呼ばれない', function() {
  resetMocks();
  _mockScriptProps['STAMP_THRESHOLD'] = '2';
  addStamp('U001', 'R001');
  var pushBefore = _pushLogs.length;
  addStamp('U001', 'R001'); // duplicate
  assertEqual(_pushLogs.length, pushBefore, 'no push for duplicate');
});

// ─── addStamp: しきい値到達 ───

test('addStamp: stamp_count=9で追加 → rewarded=true, stampCount=0', function() {
  resetMocks();
  // seed a row with stamp_count=9
  _mockRows.push(['U001', 9, 9, 'R_PREV', '2026/06/12', '2026/06/12']);
  var r = addStamp('U001', 'R010');
  assertEqual(r.rewarded, true);
  assertEqual(r.stampCount, 0);
});

test('addStamp: しきい値到達でsendLinePushが呼ばれる', function() {
  resetMocks();
  _mockRows.push(['U001', 9, 9, 'R_PREV', '2026/06/12', '2026/06/12']);
  addStamp('U001', 'R010');
  assert(_pushLogs.length > 0, 'sendLinePush called');
  assertEqual(_pushLogs[0].userId, 'U001');
});

test('addStamp: threshold=1のとき新規ユーザーでも即報酬', function() {
  resetMocks();
  _mockScriptProps['STAMP_THRESHOLD'] = '1';
  var r = addStamp('U001', 'R001');
  assertEqual(r.rewarded, true);
  assertEqual(r.stampCount, 0);
});

test('addStamp: 報酬後の次スタンプはcount=1から再開', function() {
  resetMocks();
  _mockRows.push(['U001', 9, 9, 'R_PREV', '2026/06/12', '2026/06/12']);
  addStamp('U001', 'R010'); // rewarded, reset to 0
  var r = addStamp('U001', 'R011');
  assertEqual(r.stampCount, 1);
  assertEqual(r.rewarded, false);
});

// ─── getStampCard ───

test('getStampCard: 存在しないユーザー → null', function() {
  resetMocks();
  assertEqual(getStampCard('U_NONE'), null);
});

test('getStampCard: 存在するユーザー → オブジェクト返却', function() {
  resetMocks();
  _mockRows.push(['U001', 3, 5, 'R000', '2026/06/12', '2026/06/12']);
  var r = getStampCard('U001');
  assert(r !== null);
  assertEqual(r.line_user_id, 'U001');
  assertEqual(r.stamp_count, 3);
});

test('getStampCard: total_stamps_earned が正しい', function() {
  resetMocks();
  _mockRows.push(['U001', 3, 15, 'R000', '2026/06/12', '2026/06/12']);
  var r = getStampCard('U001');
  assertEqual(r.total_stamps_earned, 15);
});

test('getStampCard: lineUserId=nullはnull', function() {
  resetMocks();
  assertEqual(getStampCard(null), null);
});

// ─── getStampSummaryText ───

test('getStampSummaryText: ユーザーなし → 0/10', function() {
  resetMocks();
  var text = getStampSummaryText('U_NONE');
  assert(text.indexOf('0 / 10枚') >= 0, text);
  assert(text.indexOf('累計: 0枚') >= 0, text);
});

test('getStampSummaryText: stamp_count=3, total=15 → 正しいテキスト', function() {
  resetMocks();
  _mockRows.push(['U001', 3, 15, 'R000', '2026/06/12', '2026/06/12']);
  var text = getStampSummaryText('U001');
  assert(text.indexOf('3 / 10枚') >= 0, text);
  assert(text.indexOf('累計: 15枚') >= 0, text);
});

test('getStampSummaryText: threshold=5のとき分母が5', function() {
  resetMocks();
  _mockScriptProps['STAMP_THRESHOLD'] = '5';
  var text = getStampSummaryText('U_NONE');
  assert(text.indexOf('0 / 5枚') >= 0, text);
});

// ─── 累積カウント ───

test('累積: 5回スタンプ → total_stamps_earned=5', function() {
  resetMocks();
  ['R1','R2','R3','R4','R5'].forEach(function(rid) {
    addStamp('U001', rid);
  });
  var card = getStampCard('U001');
  assertEqual(card.total_stamps_earned, 5);
});

test('累積: 報酬到達後もtotal_stamps_earnedは引き継がれる', function() {
  resetMocks();
  _mockScriptProps['STAMP_THRESHOLD'] = '3';
  addStamp('U001', 'R1');
  addStamp('U001', 'R2');
  addStamp('U001', 'R3'); // reward → reset
  addStamp('U001', 'R4'); // next cycle
  var card = getStampCard('U001');
  assertEqual(card.total_stamps_earned, 4);
  assertEqual(card.stamp_count, 1);
});

// ─── エッジケース ───

test('getStampSummaryText: stamp_count=0のカードが存在する場合「あと」は表示されない', function() {
  resetMocks();
  _mockRows.push(['U001', 0, 10, 'R000', '2026/06/12', '2026/06/12']);
  var text = getStampSummaryText('U001');
  assert(text.indexOf('あと') < 0, '「あと」が含まれないこと: ' + text);
});

test('getStampSummaryText: threshold-1枚のとき「あと1枚で特典！」が表示される', function() {
  resetMocks();
  _mockRows.push(['U001', 9, 9, 'R000', '2026/06/12', '2026/06/12']);
  var text = getStampSummaryText('U001');
  assert(text.indexOf('あと1枚で特典！') >= 0, '「あと1枚で特典！」が含まれること: ' + text);
});

test('addStamp: 複数ユーザーが存在する場合、対象ユーザーのみ更新される', function() {
  resetMocks();
  _mockRows.push(['U001', 2, 2, 'R_PREV1', '2026/06/12', '2026/06/12']);
  _mockRows.push(['U002', 5, 5, 'R_PREV2', '2026/06/12', '2026/06/12']);
  addStamp('U001', 'R010');
  var cardU002 = getStampCard('U002');
  assertEqual(cardU002.stamp_count, 5, 'U002のstamp_countは変わらない');
});

test('addStamp: lineUserId=空文字 → ok:false', function() {
  resetMocks();
  var r = addStamp('', 'R001');
  assertEqual(r.ok, false);
});

// ─── Report ───
console.log('\n');
console.log('StampCard Tests:', _results.pass + _results.fail, 'total');
console.log('PASS:', _results.pass);
console.log('FAIL:', _results.fail);
if (_results.errors.length > 0) {
  _results.errors.forEach(function(e) {
    console.log('  FAIL:', e.name);
    console.log('       ', e.error);
  });
}
process.exit(_results.fail > 0 ? 1 : 0);
