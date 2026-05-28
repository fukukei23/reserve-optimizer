/**
 * Unit Tests - ErrorHandler (safeExecute, recordDeadLetter, getDeadLetterSheet)
 *
 * Run: node tests/unit-error-handler.test.js
 *
 * Uses vm.Script to share scope with loaded GAS source files.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockCache = {}, _mockUserCache = {}, _mockUserProps = {}, _mockSheets = {};

function resetMocks() {
  _mockCache = {};
  _mockUserCache = {};
  _mockUserProps = {};
  _mockSheets = {};
}

function addMockSheet(name, headers, rows) {
  _mockSheets[name] = { headers: headers || [], rows: rows || [] };
}

// ─── Mock GAS globals ───
function makeSheetProxy(name) {
  var sheet = _mockSheets[name];
  if (!sheet) return null;
  return {
    getDataRange: function() {
      return { getValues: function() { return [sheet.headers].concat(sheet.rows); } };
    },
    appendRow: function(row) { sheet.rows.push(row); },
    getLastRow: function() { return sheet.rows.length + 1; },
    getRange: function(row, col, optNumRows, optNumCols) {
      if (optNumCols !== undefined) {
        return {
          setValues: function(vals) {
            for (var r = 0; r < vals.length; r++) {
              if (!sheet.rows[row - 2 + r]) sheet.rows[row - 2 + r] = [];
              for (var c = 0; c < vals[r].length; c++) {
                sheet.rows[row - 2 + r][col - 1 + c] = vals[r][c];
              }
            }
          },
          getValue: function() { return sheet.rows[row - 2] ? sheet.rows[row - 2][col - 1] : ''; },
          setValue: function(val) { if (sheet.rows[row - 2]) sheet.rows[row - 2][col - 1] = val; }
        };
      }
      return {
        getValue: function() { return sheet.rows[row - 2] ? sheet.rows[row - 2][col - 1] : ''; },
        setValue: function(val) { if (sheet.rows[row - 2]) sheet.rows[row - 2][col - 1] = val; },
        setValues: function(vals) {
          for (var r = 0; r < vals.length; r++) {
            if (!sheet.rows[row - 2 + r]) sheet.rows[row - 2 + r] = [];
            for (var c = 0; c < vals[r].length; c++) {
              sheet.rows[row - 2 + r][col - 1 + c] = vals[r][c];
            }
          }
        }
      };
    }
  };
}

global.SpreadsheetApp = {
  openById: function() {
    return {
      getSheetByName: function(name) { return makeSheetProxy(name); },
      insertSheet: function(name) {
        addMockSheet(name, [], []);
        return makeSheetProxy(name);
      }
    };
  }
};

global.CacheService = {
  getScriptCache: function() {
    return {
      get: function(key) { return _mockCache[key] || null; },
      put: function(key, val, ttl) { _mockCache[key] = val; },
      remove: function(key) { delete _mockCache[key]; }
    };
  },
  getUserCache: function() {
    return {
      get: function(key) { return _mockUserCache[key] || null; },
      put: function(key, val, ttl) { _mockUserCache[key] = val; },
      remove: function(key) { delete _mockUserCache[key]; }
    };
  }
};

global.PropertiesService = {
  getScriptProperties: function() {
    var props = {
      'SPREADSHEET_ID': 'mock', 'LINE_CHANNEL_ACCESS_TOKEN': 'mock',
      'STRIPE_API_KEY': 'mock', 'BUSINESS_START_TIME': '09:00', 'BUSINESS_END_TIME': '18:00',
      'MAX_CONCURRENT_BOOKINGS': '3', 'DEPOSIT_AMOUNT_JPY': '1000', 'CANCELLATION_DEADLINE_HOURS': '24',
      'BOOKING_LEAD_TIME_MINUTES': '30', 'MAX_RESERVATIONS_PER_USER': '5',
      'FOLLOW_UP_HOURS_AFTER': '24', 'TICKET_EXPIRY_DAYS': '180',
      'TICKET_5_PRICE': '25000', 'TICKET_10_PRICE': '45000',
      'AVERAGE_UNIT_PRICE': '6000'
    };
    return { getProperty: function(k) { return props[k] || null; }, setProperty: function() {} };
  },
  getUserProperties: function() {
    return {
      getProperty: function(k) { return _mockUserProps[k] || null; },
      setProperty: function(k, v) { _mockUserProps[k] = v; },
      deleteProperty: function(k) { delete _mockUserProps[k]; },
      getProperties: function() { return Object.assign({}, _mockUserProps); }
    };
  }
};

global.Utilities = {
  formatDate: function(d, tz, fmt) {
    if (fmt === 'yyyy/MM/dd') return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
    return d.toISOString();
  },
  getUuid: function() {
    return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 18);
  }
};
global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };
global.ContentService = { createTextOutput: function(t) { return { setMimeType: function() { return t; } }; }, MimeType: { JSON: 'application/json' } };
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
global.Logger = { log: function() {} };

// ─── Stubs ───
var logRows = [];
var sendLineReplyCalls = [];
var sendLinePushCalls = [];
var clearUserStateCalls = [];
var notifyAdminCalls = [];

global.appendLogRow = function(level, msg) { logRows.push({ level: level, msg: msg }); };
global.getSpreadsheetId = function() { return 'mock'; };
global.isFirebaseConfigured = function() { return false; };
global.getDepositAmount = function() { return 1000; };
global.getAverageUnitPrice = function() { return 5000; };
global.getLineAccessToken = function() { return 'mock'; };
global.getStripeApiKey = function() { return 'mock'; };
global.sendLinePush = function(userId, msg) { sendLinePushCalls.push({ userId: userId, msg: msg }); };
global.sendLineReply = function(token, msg) { sendLineReplyCalls.push({ token: token, msg: msg }); };
global.sendQuickReply = function() {};
global.sendLinePushQuickReply = function() {};
global.logLineMessage = function() {};
global.notifyReservationAdmin = function() {};
global.clearUserState = function(userId) { clearUserStateCalls.push(userId); };
global.notifyAdmin = function(type, msg) { notifyAdminCalls.push({ type: type, msg: msg }); };
global.normalizeTimeInput = function(t) { return t; };
global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
global.validateDateForBooking = function() { return { valid: true }; };
global.calculateEndTime = function(start, dur) {
  var p = start.split(':');
  var m = parseInt(p[0]) * 60 + parseInt(p[1]) + dur;
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
};

// Config stubs
global.RESERVATION_STATUS = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', NO_SHOW: 'NoShow', VISITED: 'Visited' };
global.DEPOSIT_STATUS = { UNPAID: 'Unpaid', PAID: 'Paid', APPLIED: 'Applied', REFUNDED: 'Refunded', FORFEITED: 'Forfeited', PENDING: 'Pending' };
global.SHEET_NAMES = { RESERVATIONS: 'reservations', WAITLIST: 'waitlist', WEEKLY_SUMMARY: 'weekly_summary', TICKETS: 'tickets', LOG: 'log' };
global.RESERVATIONS_HEADERS = [
  'reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name',
  'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end',
  'status', 'deposit_required', 'deposit_amount', 'deposit_status',
  'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified',
  'resale_success', 'average_unit_price', 'notes', 'payment_intent_id',
  'follow_up_sent', 'used_ticket'
];
global.WAITLIST_HEADERS = ['waitlist_id', 'created_at', 'patient_name', 'phone', 'line_user_id', 'desired_date', 'desired_start', 'desired_end', 'status', 'notified', 'notes'];
global.WEEKLY_SUMMARY_HEADERS = ['week_start', 'total_reservations', 'confirmed', 'cancelled', 'no_shows', 'revenue'];
global.TICKETS_HEADERS = ['ticket_id', 'created_at', 'line_user_id', 'package_type', 'total_sessions', 'remaining_sessions', 'expiry_date', 'status', 'stripe_session_id', 'stripe_payment_intent', 'notes'];
global.LOG_HEADERS = ['timestamp', 'level', 'message'];
global.RESERVATIONS_COLUMNS = {
  RESERVATION_ID: 1, CREATED_AT: 2, PATIENT_NAME: 3, PHONE: 4, LINE_DISPLAY_NAME: 5,
  VISIT_TYPE: 6, MENU_TYPE: 7, RESERVED_DATE: 8, RESERVED_START: 9, RESERVED_END: 10,
  STATUS: 11, DEPOSIT_REQUIRED: 12, DEPOSIT_AMOUNT: 13, DEPOSIT_STATUS: 14,
  REMINDER_SENT: 15, REMINDER_RESPONSE: 16, CANCEL_TIME: 17, RESALE_NOTIFIED: 18,
  RESALE_SUCCESS: 19, AVERAGE_UNIT_PRICE: 20, NOTES: 21, PAYMENT_INTENT_ID: 22,
  FOLLOW_UP_SENT: 23, USED_TICKET: 24
};

global.getReservationsSheet = function() { return global.SpreadsheetApp.openById().getSheetByName('reservations'); };
global.createSheetWithHeaders = function(ss, name, headers) {
  addMockSheet(name, headers, []);
  return global.SpreadsheetApp.openById().getSheetByName(name);
};

// _getCachedSpreadsheet stub — ErrorHandler's getDeadLetterSheet uses it directly
global._getCachedSpreadsheet = function() {
  return global.SpreadsheetApp.openById();
};

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var code = fs.readFileSync(path.join(gasDir, relPath), 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) }).runInThisContext();
}

loadFile('services/ErrorHandler.js');

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name + (detail ? ' -- ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' (' + detail + ')' : '')); }
}
function assertEqual(name, actual, expected) {
  if (actual === expected) { passed++; console.log('  PASS ' + name); }
  else { failed++; var d = 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual); errors.push(name + ' -- ' + d); console.log('  FAIL ' + name + ' (' + d + ')'); }
}
function assertIncludes(name, hay, needle) {
  if (hay && hay.indexOf(needle) >= 0) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// Helper: reset all call trackers
function resetTrackers() {
  logRows = [];
  sendLineReplyCalls = [];
  sendLinePushCalls = [];
  clearUserStateCalls = [];
  notifyAdminCalls = [];
}

// ─── Tests: safeExecute ───

section('safeExecute - success case');
resetTrackers();
var successResult = safeExecute(function() {
  return { data: 42 };
}, { operation: 'test-success' });
assert('success returns value', successResult.data === 42);
assert('success result has no error property', successResult.error === undefined);

section('safeExecute - error case returns error object');
resetTrackers();
var errorResult = safeExecute(function() {
  throw new Error('test error message');
}, { operation: 'test-error' });
assert('error result has error=true', errorResult.error === true);
assertIncludes('error result has message', errorResult.message, 'test error message');

section('safeExecute - error with lock releases lock');
resetTrackers();
var lockReleased = false;
var mockLock = { releaseLock: function() { lockReleased = true; } };
safeExecute(function() {
  throw new Error('lock test');
}, { operation: 'lock-test', lock: mockLock });
assert('lock.releaseLock() was called', lockReleased);

section('safeExecute - error with rollback calls onRollback');
resetTrackers();
var rollbackCalled = false;
safeExecute(function() {
  throw new Error('rollback test');
}, { operation: 'rollback-test', onRollback: function() { rollbackCalled = true; } });
assert('onRollback() was called', rollbackCalled);

section('safeExecute - error with userId clears user state');
resetTrackers();
safeExecute(function() {
  throw new Error('state test');
}, { operation: 'state-test', userId: 'LINE_USER_1' });
assert('clearUserState called with userId', clearUserStateCalls.length === 1 && clearUserStateCalls[0] === 'LINE_USER_1');

section('safeExecute - error silent=true skips user notification');
resetTrackers();
safeExecute(function() {
  throw new Error('silent test');
}, { operation: 'silent-test', silent: true, replyToken: 'TOKEN_X', userId: 'LINE_U2' });
assert('sendLineReply NOT called when silent', sendLineReplyCalls.length === 0);
assert('sendLinePush NOT called when silent', sendLinePushCalls.length === 0);

section('safeExecute - error with replyToken calls sendLineReply');
resetTrackers();
safeExecute(function() {
  throw new Error('reply test');
}, { operation: 'reply-test', replyToken: 'REPLY_TOKEN_1' });
assert('sendLineReply called once', sendLineReplyCalls.length === 1);
assertEqual('sendLineReply token matches', sendLineReplyCalls[0].token, 'REPLY_TOKEN_1');
assertIncludes('sendLineReply msg contains error apology', sendLineReplyCalls[0].msg, '申し訳ございません');

section('safeExecute - error with userId but no replyToken calls sendLinePush');
resetTrackers();
safeExecute(function() {
  throw new Error('push test');
}, { operation: 'push-test', userId: 'LINE_PUSH_USER' });
assert('sendLinePush called once', sendLinePushCalls.length === 1);
assertEqual('sendLinePush userId matches', sendLinePushCalls[0].userId, 'LINE_PUSH_USER');
assertIncludes('sendLinePush msg contains error apology', sendLinePushCalls[0].msg, '申し訳ございません');

// ─── Tests: recordDeadLetter ───

section('recordDeadLetter - appends row to dead_letters sheet');
resetMocks();
resetTrackers();
addMockSheet('log', ['timestamp', 'level', 'message'], []);
recordDeadLetter('test-op', { foo: 'bar' }, 'something failed');
var dlSheet = _mockSheets['dead_letters'];
assert('dead_letters sheet exists', dlSheet !== null && dlSheet !== undefined);
assert('dead_letters has 2 rows (header + data)', dlSheet.rows.length === 2);
var row = dlSheet.rows[1];
assertIncludes('row has operation name', row[1], 'test-op');
assertIncludes('row data is JSON-stringified', row[2], 'foo');
assertIncludes('row has error message', row[3], 'something failed');
assertEqual('row status is PENDING', row[4], 'PENDING');

section('recordDeadLetter - data truncated to 2000 chars');
resetMocks();
resetTrackers();
addMockSheet('log', ['timestamp', 'level', 'message'], []);
var bigData = { content: new Array(3000).join('x') };
recordDeadLetter('truncate-test', bigData, 'err');
var dataCell = _mockSheets['dead_letters'].rows[1][2];
assert('data <= 2000 chars', dataCell.length <= 2000);

section('recordDeadLetter - error truncated to 500 chars');
resetMocks();
resetTrackers();
addMockSheet('log', ['timestamp', 'level', 'message'], []);
var bigError = new Array(800).join('E');
recordDeadLetter('err-trunc-test', null, bigError);
var errCell = _mockSheets['dead_letters'].rows[1][3];
assert('error <= 500 chars', errCell.length <= 500);

// ─── Tests: getDeadLetterSheet ───

section('getDeadLetterSheet - creates sheet if not exists');
resetMocks();
addMockSheet('log', ['timestamp', 'level', 'message'], []);
var sheet1 = getDeadLetterSheet();
assert('sheet returned is not null', sheet1 !== null);
var dlSheetAfterCreate = _mockSheets['dead_letters'];
assert('dead_letters sheet was created in mock', dlSheetAfterCreate !== null && dlSheetAfterCreate !== undefined);
assert('dead_letters has 1 header row (from appendRow in source)', dlSheetAfterCreate.rows.length === 1 || dlSheetAfterCreate.rows.length === 2);

section('getDeadLetterSheet - returns existing sheet');
resetMocks();
addMockSheet('log', ['timestamp', 'level', 'message'], []);
addMockSheet('dead_letters', ['timestamp', 'operation', 'data', 'error', 'status'], [
  ['existing row data']
]);
var sheet2 = getDeadLetterSheet();
assert('existing sheet returned is not null', sheet2 !== null);
assert('existing sheet preserved its rows', _mockSheets['dead_letters'].rows.length === 1);

// ─── Results ───
console.log('\n========================================');
console.log('ErrorHandler Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
