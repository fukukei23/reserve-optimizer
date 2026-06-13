/**
 * Unit Tests - IntakeService (事前問診票)
 *
 * Run: node tests/unit-intake-service.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── GAS global stubs (before file loads) ───
var _mockScriptProps = {};
var _mockSheetData = {};  // sheetName -> rows[][]

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
    var rows = [];
    var sheet = _makeSheet(name, rows);
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
      return {
        getValues: function() { return r.map(function(row) { return row.slice(); }); }
      };
    },
    getRange: function(row, col, numRows, numCols) {
      var self = this;
      return {
        setValues: function(vals) {
          self._rows[row - 1] = vals[0].slice();
        }
      };
    }
  };
}

global.SpreadsheetApp = { openById: function() { return _mockSS; } };
global.Utilities = {
  formatDate: function(date, tz, fmt) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  },
  getUuid: function() { return 'test-uuid'; }
};
global.Logger = { log: function() {} };
global.CacheService = {
  getScriptCache: function() {
    return { get: function() { return null; }, put: function() {}, remove: function() {} };
  }
};

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(rel) {
  var code = fs.readFileSync(path.join(gasDir, rel), 'utf8');
  new vm.Script(code, { filename: path.basename(rel) }).runInThisContext();
}

loadFile('config/ScriptProperties.js');
loadFile('services/IntakeService.js');

// ─── Spy infrastructure (AFTER file loads) ───
var _logRows = [];
global.appendLogRow = function(level, msg) { _logRows.push({ level: level, msg: msg }); };

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

function assertNotNull(v, msg) {
  if (v === null || v === undefined) throw new Error(msg || 'expected non-null');
}

// ─── Setup helpers ───
function resetState() {
  _mockScriptProps = { SPREADSHEET_ID: 'SHEET001', WORKER_BASE_URL: 'https://example.workers.dev' };
  _mockSheetData = {};
  _logRows = [];
}

function makeIntakeSheet(rows) {
  // rows: array of data rows (without header)
  var headers = ['reservation_id','submitted_at','chief_complaint','medical_history','allergies','pregnancy','notes','summary','processed'];
  var allRows = [headers].concat(rows);
  _mockSheetData['intake_forms'] = _makeSheet('intake_forms', allRows);
}

// ─── saveIntakeForm ───

test('saveIntakeForm: missing reservationId returns error', function() {
  resetState();
  var res = saveIntakeForm('', { chief_complaint: '腰痛' });
  assertEqual(res.ok, false);
  assert(res.error, 'should have error message');
});

test('saveIntakeForm: missing chief_complaint returns error', function() {
  resetState();
  var res = saveIntakeForm('R001', { chief_complaint: '' });
  assertEqual(res.ok, false);
  assert(res.error.indexOf('chief_complaint') >= 0);
});

test('saveIntakeForm: whitespace-only chief_complaint returns error', function() {
  resetState();
  var res = saveIntakeForm('R001', { chief_complaint: '   ' });
  assertEqual(res.ok, false);
});

test('saveIntakeForm: valid data creates intake_forms sheet when missing', function() {
  resetState();
  var res = saveIntakeForm('R001', { chief_complaint: '腰痛' });
  assertEqual(res.ok, true);
  assertNotNull(_mockSheetData['intake_forms'], 'sheet should be created');
});

test('saveIntakeForm: appends row to sheet', function() {
  resetState();
  makeIntakeSheet([]);
  saveIntakeForm('R001', { chief_complaint: '肩こり', medical_history: '高血圧', allergies: '', pregnancy: 'no', notes: '' });
  var rows = _mockSheetData['intake_forms']._rows;
  assertEqual(rows.length, 2, 'header + 1 data row');
  assertEqual(rows[1][0], 'R001');
  assertEqual(rows[1][2], '肩こり');
  assertEqual(rows[1][3], '高血圧');
  assertEqual(rows[1][8], 'N', 'processed = N');
});

test('saveIntakeForm: trims chief_complaint and notes', function() {
  resetState();
  makeIntakeSheet([]);
  saveIntakeForm('R002', { chief_complaint: '  膝痛  ', notes: '  特になし  ' });
  var row = _mockSheetData['intake_forms']._rows[1];
  assertEqual(row[2], '膝痛');
  assertEqual(row[6], '特になし');
});

test('saveIntakeForm: upserts when reservation_id already exists', function() {
  resetState();
  makeIntakeSheet([
    ['R001','2026/01/01 10:00:00','腰痛','','','no','','','N']
  ]);
  var res = saveIntakeForm('R001', { chief_complaint: '首痛（更新）' });
  assertEqual(res.ok, true);
  var rows = _mockSheetData['intake_forms']._rows;
  assertEqual(rows.length, 2, 'no new row added');
  assertEqual(rows[1][2], '首痛（更新）', 'existing row updated');
});

test('saveIntakeForm: appends new row when reservation_id not found', function() {
  resetState();
  makeIntakeSheet([
    ['R001','2026/01/01 10:00:00','腰痛','','','no','','','N']
  ]);
  saveIntakeForm('R002', { chief_complaint: '肩こり' });
  var rows = _mockSheetData['intake_forms']._rows;
  assertEqual(rows.length, 3, 'header + R001 + R002');
});

test('saveIntakeForm: logs INFO on success', function() {
  resetState();
  _logRows = [];
  saveIntakeForm('R001', { chief_complaint: '腰痛' });
  assert(_logRows.some(function(l) { return l.level === 'INFO' && l.msg.indexOf('R001') >= 0; }));
});

test('saveIntakeForm: uses "no" as default pregnancy', function() {
  resetState();
  makeIntakeSheet([]);
  saveIntakeForm('R001', { chief_complaint: '腰痛' });
  assertEqual(_mockSheetData['intake_forms']._rows[1][5], 'no');
});

test('saveIntakeForm: stores pregnancy value when provided', function() {
  resetState();
  makeIntakeSheet([]);
  saveIntakeForm('R001', { chief_complaint: '腰痛', pregnancy: 'unknown' });
  assertEqual(_mockSheetData['intake_forms']._rows[1][5], 'unknown');
});

// ─── getIntakeByReservationId ───

test('getIntakeByReservationId: returns null when not found', function() {
  resetState();
  makeIntakeSheet([]);
  var res = getIntakeByReservationId('NOTEXIST');
  assertEqual(res, null);
});

test('getIntakeByReservationId: returns null for empty reservationId', function() {
  resetState();
  makeIntakeSheet([]);
  var res = getIntakeByReservationId('');
  assertEqual(res, null);
});

test('getIntakeByReservationId: returns object when found', function() {
  resetState();
  makeIntakeSheet([
    ['R001','2026/01/01 10:00:00','腰痛','高血圧','なし','no','特になし','要約','N']
  ]);
  var res = getIntakeByReservationId('R001');
  assertNotNull(res);
  assertEqual(res.reservation_id, 'R001');
  assertEqual(res.chief_complaint, '腰痛');
  assertEqual(res.medical_history, '高血圧');
  assertEqual(res.allergies, 'なし');
  assertEqual(res.pregnancy, 'no');
  assertEqual(res.notes, '特になし');
  assertEqual(res.summary, '要約');
  assertEqual(res.processed, 'N');
});

test('getIntakeByReservationId: returns first match for duplicate IDs', function() {
  resetState();
  makeIntakeSheet([
    ['R001','2026/01/01 10:00:00','腰痛','','','no','','','N'],
    ['R001','2026/01/02 10:00:00','首痛','','','no','','','N']
  ]);
  var res = getIntakeByReservationId('R001');
  assertEqual(res.chief_complaint, '腰痛');
});

// ─── getIntakeFormUrl ───

test('getIntakeFormUrl: returns empty string when WORKER_BASE_URL not set', function() {
  resetState();
  _mockScriptProps['WORKER_BASE_URL'] = '';
  var url = getIntakeFormUrl('R001');
  assertEqual(url, '');
});

test('getIntakeFormUrl: returns correct URL', function() {
  resetState();
  _mockScriptProps['WORKER_BASE_URL'] = 'https://example.workers.dev';
  var url = getIntakeFormUrl('R001');
  assertEqual(url, 'https://example.workers.dev/intake/R001');
});

test('getIntakeFormUrl: strips trailing slash from base', function() {
  resetState();
  _mockScriptProps['WORKER_BASE_URL'] = 'https://example.workers.dev/';
  var url = getIntakeFormUrl('R002');
  assertEqual(url, 'https://example.workers.dev/intake/R002');
});

// ─── _generateIntakeSummary ───

test('_generateIntakeSummary: fallback returns chief_complaint line', function() {
  resetState();
  global.generateGLMSummary = undefined;
  var s = _generateIntakeSummary({ chief_complaint: '腰痛' });
  assert(s.indexOf('腰痛') >= 0, 'should contain chief_complaint');
});

test('_generateIntakeSummary: includes medical_history when present', function() {
  resetState();
  global.generateGLMSummary = undefined;
  var s = _generateIntakeSummary({ chief_complaint: '腰痛', medical_history: '高血圧' });
  assert(s.indexOf('高血圧') >= 0);
});

test('_generateIntakeSummary: includes allergies when present', function() {
  resetState();
  global.generateGLMSummary = undefined;
  var s = _generateIntakeSummary({ chief_complaint: '腰痛', allergies: 'アスピリン' });
  assert(s.indexOf('アスピリン') >= 0);
});

test('_generateIntakeSummary: includes pregnancy when not "no"', function() {
  resetState();
  global.generateGLMSummary = undefined;
  var s = _generateIntakeSummary({ chief_complaint: '腰痛', pregnancy: 'unknown' });
  assert(s.indexOf('unknown') >= 0);
});

test('_generateIntakeSummary: skips pregnancy when "no"', function() {
  resetState();
  global.generateGLMSummary = undefined;
  var s = _generateIntakeSummary({ chief_complaint: '腰痛', pregnancy: 'no' });
  assert(s.indexOf('no') < 0);
});

test('_generateIntakeSummary: skips empty medical_history', function() {
  resetState();
  global.generateGLMSummary = undefined;
  var s = _generateIntakeSummary({ chief_complaint: '腰痛', medical_history: '' });
  assert(s.indexOf('既往歴') < 0);
});

test('_generateIntakeSummary: uses GLM when available', function() {
  resetState();
  global.generateGLMSummary = function(prompt) { return 'GLM要約: ' + prompt.slice(0, 10); };
  var s = _generateIntakeSummary({ chief_complaint: '腰痛' });
  assert(s.indexOf('GLM要約') >= 0, 'should use GLM summary');
  global.generateGLMSummary = undefined;
});

test('_generateIntakeSummary: falls back when GLM throws', function() {
  resetState();
  global.generateGLMSummary = function() { throw new Error('GLM error'); };
  var s = _generateIntakeSummary({ chief_complaint: '腰痛' });
  assert(s.indexOf('腰痛') >= 0, 'should fall back to plain text');
  global.generateGLMSummary = undefined;
});

// ─── _getOrCreateIntakeSheet ───

test('_getOrCreateIntakeSheet: creates sheet with headers when missing', function() {
  resetState();
  _mockSheetData = {};  // no sheets exist
  var sheet = _getOrCreateIntakeSheet();
  assertNotNull(sheet);
  var rows = sheet._rows;
  assert(rows.length >= 1, 'should have header row');
  assertEqual(rows[0][0], 'reservation_id');
  assertEqual(rows[0][2], 'chief_complaint');
});

test('_getOrCreateIntakeSheet: returns existing sheet without adding headers', function() {
  resetState();
  makeIntakeSheet([
    ['R001','','腰痛','','','no','','','N']
  ]);
  var sheet = _getOrCreateIntakeSheet();
  assertEqual(sheet._rows.length, 2, 'should have existing header + 1 data row');
});

// ─── _findIntakeRow ───

test('_findIntakeRow: returns null when sheet has only header', function() {
  resetState();
  makeIntakeSheet([]);
  var sheet = _mockSheetData['intake_forms'];
  var res = _findIntakeRow(sheet, 'R001');
  assertEqual(res, null);
});

test('_findIntakeRow: returns row info when found', function() {
  resetState();
  makeIntakeSheet([
    ['R001','2026/01/01','腰痛','','','no','','','N']
  ]);
  var sheet = _mockSheetData['intake_forms'];
  var res = _findIntakeRow(sheet, 'R001');
  assertNotNull(res);
  assertEqual(res.rowNumber, 2, 'rowNumber is 1-indexed');
  assertEqual(res.row[0], 'R001');
});

test('_findIntakeRow: returns null when ID not found', function() {
  resetState();
  makeIntakeSheet([
    ['R001','2026/01/01','腰痛','','','no','','','N']
  ]);
  var sheet = _mockSheetData['intake_forms'];
  var res = _findIntakeRow(sheet, 'R999');
  assertEqual(res, null);
});

// ─── エッジケース ───

test('L2: saveIntakeForm: formData が null → ok:false', function() {
  resetState();
  var result = saveIntakeForm('R001', null);
  assertEqual(result.ok, false);
});

test('L_warn: saveIntakeForm: サマリー生成が失敗しても ok:true + WARNログ', function() {
  resetState();
  makeIntakeSheet([]);
  var origFn = global._generateIntakeSummary;
  global._generateIntakeSummary = function() { throw new Error('summary fail'); };
  var result = saveIntakeForm('R001', { chief_complaint: '腰痛' });
  global._generateIntakeSummary = origFn;
  assertEqual(result.ok, true);
  assert(_logRows.some(function(l) { return l.level === 'WARN'; }), 'WARNログが記録される');
});

// ─── Report ───
console.log('\n');
console.log('IntakeService Tests:', _results.pass + _results.fail, 'total');
console.log('PASS:', _results.pass);
console.log('FAIL:', _results.fail);
if (_results.errors.length > 0) {
  _results.errors.forEach(function(e) {
    console.log('  FAIL:', e.name);
    console.log('       ', e.error);
  });
}
process.exit(_results.fail > 0 ? 1 : 0);
