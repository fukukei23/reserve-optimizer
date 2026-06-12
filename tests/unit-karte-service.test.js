/**
 * Unit Tests - KarteService (簡易施術カルテ)
 *
 * Run: node tests/unit-karte-service.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── GAS global stubs ───
var _mockScriptProps = {};
var _mockSheetData = {};

global.PropertiesService = {
  getScriptProperties: function() {
    return {
      getProperty: function(k) { return _mockScriptProps[k] || null; },
      setProperty: function(k, v) { _mockScriptProps[k] = v; }
    };
  }
};

var _mockSS = {
  getSheetByName: function(name) { return _mockSheetData[name] || null; },
  insertSheet: function(name) {
    var sheet = _makeSheet(name, []);
    _mockSheetData[name] = sheet;
    return sheet;
  }
};

function _makeSheet(name, rows) {
  return {
    _name: name,
    _rows: rows,
    appendRow: function(row) { this._rows.push(row.slice()); },
    getDataRange: function() {
      var r = this._rows;
      return { getValues: function() { return r.map(function(row) { return row.slice(); }); } };
    },
    getRange: function(row, col, numRows, numCols) {
      var self = this;
      return { setValues: function(vals) { self._rows[row - 1] = vals[0].slice(); } };
    }
  };
}

global.SpreadsheetApp = { openById: function() { return _mockSS; } };
global.Utilities = {
  formatDate: function(date, tz, fmt) { return '2026/01/15 10:00:00'; },
  getUuid: function() { return 'abcd-1234-efgh-5678'; }
};
global.Logger = { log: function() {} };
global.CacheService = {
  getScriptCache: function() { return { get: function() { return null; }, put: function() {}, remove: function() {} }; }
};

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(rel) {
  var code = fs.readFileSync(path.join(gasDir, rel), 'utf8');
  new vm.Script(code, { filename: path.basename(rel) }).runInThisContext();
}

loadFile('config/ScriptProperties.js');
loadFile('services/KarteService.js');

// ─── Spies (AFTER file loads) ───
var _logRows = [];
global.appendLogRow = function(level, msg) { _logRows.push({ level: level, msg: msg }); };

// Stub for getReservationsByDate (used by getTodayUnrecordedReservations)
var _mockReservations = [];
global.getReservationsByDate = function(date) { return _mockReservations; };
global.getReservationById = function(id) {
  return _mockReservations.find(function(r) { return r.id === id; }) || null;
};

// ─── Test runner ───
var _results = { pass: 0, fail: 0, errors: [] };

function test(name, fn) {
  try { fn(); _results.pass++; process.stdout.write('.'); }
  catch (e) { _results.fail++; _results.errors.push({ name: name, error: e.message }); process.stdout.write('F'); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function assertNotNull(v, msg) { if (v === null || v === undefined) throw new Error(msg || 'expected non-null'); }

// ─── Helpers ───
function resetState() {
  _mockScriptProps = { SPREADSHEET_ID: 'SHEET001' };
  _mockSheetData = {};
  _logRows = [];
  _mockReservations = [];
}

function makeKarteSheet(rows) {
  var headers = ['id','reservation_id','line_user_id','patient_name','treatment_date',
                 'treatment_content','body_part','staff_name','next_suggestion','notes','created_at'];
  _mockSheetData['karte_records'] = _makeSheet('karte_records', [headers].concat(rows));
}

// ─── saveKarte ───

test('saveKarte: missing reservationId returns error', function() {
  resetState();
  var res = saveKarte('', { treatment_content: '腰部矯正' });
  assertEqual(res.ok, false);
  assert(res.error, 'should have error');
});

test('saveKarte: missing treatment_content returns error', function() {
  resetState();
  var res = saveKarte('R001', { treatment_content: '' });
  assertEqual(res.ok, false);
  assert(res.error.indexOf('treatment_content') >= 0);
});

test('saveKarte: whitespace-only treatment_content returns error', function() {
  resetState();
  var res = saveKarte('R001', { treatment_content: '   ' });
  assertEqual(res.ok, false);
});

test('saveKarte: valid data creates karte_records sheet', function() {
  resetState();
  var res = saveKarte('R001', { treatment_content: '腰部矯正' });
  assertEqual(res.ok, true);
  assertNotNull(_mockSheetData['karte_records']);
});

test('saveKarte: returns generated id', function() {
  resetState();
  var res = saveKarte('R001', { treatment_content: '腰部矯正' });
  assert(res.id && res.id.indexOf('K-') === 0, 'id should start with K-');
});

test('saveKarte: appends row to sheet', function() {
  resetState();
  makeKarteSheet([]);
  saveKarte('R001', { treatment_content: '腰部矯正', body_part: '腰', staff_name: '田中' });
  var rows = _mockSheetData['karte_records']._rows;
  assertEqual(rows.length, 2, 'header + 1 data row');
  assertEqual(rows[1][1], 'R001');
  assertEqual(rows[1][5], '腰部矯正');
  assertEqual(rows[1][6], '腰');
  assertEqual(rows[1][7], '田中');
});

test('saveKarte: trims treatment_content', function() {
  resetState();
  makeKarteSheet([]);
  saveKarte('R001', { treatment_content: '  頸部  ' });
  assertEqual(_mockSheetData['karte_records']._rows[1][5], '頸部');
});

test('saveKarte: logs INFO on success', function() {
  resetState();
  _logRows = [];
  saveKarte('R001', { treatment_content: '施術内容' });
  assert(_logRows.some(function(l) { return l.level === 'INFO' && l.msg.indexOf('R001') >= 0; }));
});

test('saveKarte: multiple saves append multiple rows', function() {
  resetState();
  makeKarteSheet([]);
  saveKarte('R001', { treatment_content: '施術A' });
  saveKarte('R002', { treatment_content: '施術B' });
  assertEqual(_mockSheetData['karte_records']._rows.length, 3);
});

test('saveKarte: stores next_suggestion', function() {
  resetState();
  makeKarteSheet([]);
  saveKarte('R001', { treatment_content: '腰部', next_suggestion: '2週間後推奨' });
  assertEqual(_mockSheetData['karte_records']._rows[1][8], '2週間後推奨');
});

// ─── getKarteByReservationId ───

test('getKarteByReservationId: returns null when not found', function() {
  resetState();
  makeKarteSheet([]);
  assertEqual(getKarteByReservationId('R999'), null);
});

test('getKarteByReservationId: returns null for empty id', function() {
  resetState();
  makeKarteSheet([]);
  assertEqual(getKarteByReservationId(''), null);
});

test('getKarteByReservationId: returns object when found', function() {
  resetState();
  makeKarteSheet([
    ['K-001','R001','U001','山田太郎','2026/01/15','腰部矯正','腰','田中','2週間後','','2026/01/15 10:00:00']
  ]);
  var res = getKarteByReservationId('R001');
  assertNotNull(res);
  assertEqual(res.id, 'K-001');
  assertEqual(res.reservation_id, 'R001');
  assertEqual(res.treatment_content, '腰部矯正');
  assertEqual(res.staff_name, '田中');
  assertEqual(res.next_suggestion, '2週間後');
});

// ─── getKarteHistoryByUserId ───

test('getKarteHistoryByUserId: returns empty array for unknown user', function() {
  resetState();
  makeKarteSheet([]);
  var res = getKarteHistoryByUserId('U999');
  assertEqual(res.length, 0);
});

test('getKarteHistoryByUserId: returns empty for empty userId', function() {
  resetState();
  makeKarteSheet([]);
  assertEqual(getKarteHistoryByUserId('').length, 0);
});

test('getKarteHistoryByUserId: returns records for user', function() {
  resetState();
  makeKarteSheet([
    ['K-001','R001','U001','山田','2026/01/10','施術A','','','','',''],
    ['K-002','R002','U001','山田','2026/01/15','施術B','','','','',''],
    ['K-003','R003','U002','鈴木','2026/01/15','施術C','','','','','']
  ]);
  var res = getKarteHistoryByUserId('U001');
  assertEqual(res.length, 2);
});

test('getKarteHistoryByUserId: respects limit', function() {
  resetState();
  var rows = [];
  for (var i = 1; i <= 10; i++) {
    rows.push(['K-00' + i, 'R00' + i, 'U001', '山田', '2026/01/' + i, '施術' + i, '', '', '', '', '']);
  }
  makeKarteSheet(rows);
  var res = getKarteHistoryByUserId('U001', 3);
  assertEqual(res.length, 3);
});

test('getKarteHistoryByUserId: default limit is 5', function() {
  resetState();
  var rows = [];
  for (var i = 1; i <= 8; i++) {
    rows.push(['K-00' + i, 'R00' + i, 'U001', '山田', '2026/01/' + i, '施術' + i, '', '', '', '', '']);
  }
  makeKarteSheet(rows);
  var res = getKarteHistoryByUserId('U001');
  assertEqual(res.length, 5);
});

// ─── getTodayUnrecordedReservations ───

test('getTodayUnrecordedReservations: returns empty when no reservations', function() {
  resetState();
  makeKarteSheet([]);
  _mockReservations = [];
  var res = getTodayUnrecordedReservations();
  assertEqual(res.length, 0);
});

test('getTodayUnrecordedReservations: returns only Visited status', function() {
  resetState();
  makeKarteSheet([]);
  _mockReservations = [
    { id: 'R001', status: 'Visited' },
    { id: 'R002', status: 'Confirmed' },
    { id: 'R003', status: 'Visited' }
  ];
  var res = getTodayUnrecordedReservations();
  assertEqual(res.length, 2);
});

test('getTodayUnrecordedReservations: excludes already-recorded reservations', function() {
  resetState();
  makeKarteSheet([
    ['K-001', 'R001', 'U001', '山田', '2026/01/15', '施術A', '', '', '', '', '']
  ]);
  _mockReservations = [
    { id: 'R001', status: 'Visited' },
    { id: 'R002', status: 'Visited' }
  ];
  var res = getTodayUnrecordedReservations();
  assertEqual(res.length, 1);
  assertEqual(res[0].id, 'R002');
});

test('getTodayUnrecordedReservations: returns all when none recorded', function() {
  resetState();
  makeKarteSheet([]);
  _mockReservations = [
    { id: 'R001', status: 'Visited' },
    { id: 'R002', status: 'Visited' }
  ];
  var res = getTodayUnrecordedReservations();
  assertEqual(res.length, 2);
});

// ─── _getOrCreateKarteSheet ───

test('_getOrCreateKarteSheet: creates sheet with headers when missing', function() {
  resetState();
  _mockSheetData = {};
  var sheet = _getOrCreateKarteSheet();
  assertNotNull(sheet);
  assertEqual(sheet._rows[0][0], 'id');
  assertEqual(sheet._rows[0][1], 'reservation_id');
  assertEqual(sheet._rows[0][5], 'treatment_content');
});

test('_getOrCreateKarteSheet: returns existing sheet', function() {
  resetState();
  makeKarteSheet([['K-001','R001','','','','施術','','','','','']]);
  var sheet = _getOrCreateKarteSheet();
  assertEqual(sheet._rows.length, 2);
});

// ─── Report ───
console.log('\n');
console.log('KarteService Tests:', _results.pass + _results.fail, 'total');
console.log('PASS:', _results.pass);
console.log('FAIL:', _results.fail);
if (_results.errors.length > 0) {
  _results.errors.forEach(function(e) {
    console.log('  FAIL:', e.name);
    console.log('       ', e.error);
  });
}
process.exit(_results.fail > 0 ? 1 : 0);
