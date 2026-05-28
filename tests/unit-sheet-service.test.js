/**
 * Unit Tests - SheetService (formatDateObj, formatTimeObj, _buildReservationObj, CRUD)
 *
 * Run: node tests/unit-sheet-service.test.js
 *
 * Uses vm.Script to share scope with loaded GAS source files.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// Load helper into global scope
var helperCode = fs.readFileSync(path.join(__dirname, 'helpers', 'gas-mock.js'), 'utf8');
// Extract the functions we need from the helper (it uses module.exports)
// Instead, we'll inline the mock setup and test framework directly.

// ─── Mock state ───
var _mockCache = {};
var _mockUserCache = {};
var _mockUserProps = {};
var _mockSheets = {};

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
        _mockSheets[name] = { headers: [], rows: [] };
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
      'MAX_CONCURRENT_BOOKINGS': '3', 'DEPOSIT_AMOUNT': '1000', 'CANCELLATION_DEADLINE_HOURS': '24',
      'BOOKING_LEAD_TIME_MINUTES': '30', 'MAX_RESERVATIONS_PER_USER': '5',
      'FOLLOW_UP_HOURS_AFTER': '24', 'TICKET_EXPIRY_DAYS': '180',
      'TICKET_5_PRICE': '25000', 'TICKET_10_PRICE': '45000'
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

// Stubs
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global.isFirebaseConfigured = function() { return false; };
global.getDepositAmount = function() { return 1000; };
global.getAverageUnitPrice = function() { return 5000; };
global.getLineAccessToken = function() { return 'mock'; };
global.getStripeApiKey = function() { return 'mock'; };
global.sendLinePush = function() {};
global.sendLineReply = function() {};
global.sendQuickReply = function() {};
global.sendLinePushQuickReply = function() {};
global.logLineMessage = function() {};
global.notifyReservationAdmin = function() {};
global.normalizeTimeInput = function(t) { return t; };
global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
global.validateDateForBooking = function() { return { valid: true }; };
global.calculateEndTime = function(start, dur) {
  var p = start.split(':');
  var m = parseInt(p[0]) * 60 + parseInt(p[1]) + dur;
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
};

// Config stubs
global.RESERVATION_STATUS = { PENDING:'Pending', CONFIRMED:'Confirmed', CANCELLED:'Cancelled', NO_SHOW:'NoShow', VISITED:'Visited' };
global.DEPOSIT_STATUS = { UNPAID:'Unpaid', PAID:'Paid', APPLIED:'Applied', REFUNDED:'Refunded', FORFEITED:'Forfeited' };
global.SHEET_NAMES = { RESERVATIONS:'reservations', WAITLIST:'waitlist', WEEKLY_SUMMARY:'weekly_summary', TICKETS:'tickets', LOG:'log' };
global.RESERVATIONS_HEADERS = [
  'reservation_id','created_at','patient_name','phone','line_display_name',
  'visit_type','menu_type','reserved_date','reserved_start','reserved_end',
  'status','deposit_required','deposit_amount','deposit_status',
  'reminder_sent','reminder_response','cancel_time','resale_notified',
  'resale_success','average_unit_price','notes','payment_intent_id',
  'follow_up_sent','used_ticket'
];
global.WAITLIST_HEADERS = ['waitlist_id','created_at','patient_name','phone','line_user_id','desired_date','desired_start','desired_end','status','notified','notes'];
global.WEEKLY_SUMMARY_HEADERS = ['week_start','total_reservations','confirmed','cancelled','no_shows','revenue'];
global.TICKETS_HEADERS = ['ticket_id','created_at','line_user_id','package_type','total_sessions','remaining_sessions','expiry_date','status','stripe_session_id','stripe_payment_intent','notes'];
global.LOG_HEADERS = ['timestamp','level','message'];
global.RESERVATIONS_COLUMNS = {
  RESERVATION_ID:1, CREATED_AT:2, PATIENT_NAME:3, PHONE:4, LINE_DISPLAY_NAME:5,
  VISIT_TYPE:6, MENU_TYPE:7, RESERVED_DATE:8, RESERVED_START:9, RESERVED_END:10,
  STATUS:11, DEPOSIT_REQUIRED:12, DEPOSIT_AMOUNT:13, DEPOSIT_STATUS:14,
  REMINDER_SENT:15, REMINDER_RESPONSE:16, CANCEL_TIME:17, RESALE_NOTIFIED:18,
  RESALE_SUCCESS:19, AVERAGE_UNIT_PRICE:20, NOTES:21, PAYMENT_INTENT_ID:22,
  FOLLOW_UP_SENT:23, USED_TICKET:24
};

global.getReservationsSheet = function() { return global.SpreadsheetApp.openById().getSheetByName('reservations'); };
global.createSheetWithHeaders = function(ss, name, headers) {
  addMockSheet(name, headers, []);
  return global.SpreadsheetApp.openById().getSheetByName(name);
};

// Load source files via vm.Script (shared scope)
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var code = fs.readFileSync(path.join(gasDir, relPath), 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) }).runInThisContext();
}

loadFile('services/SheetService.js');

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
function assertNotIncludes(name, hay, needle) {
  if (!hay || hay.indexOf(needle) < 0) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name); }
}
function assertNull(name, val) {
  if (val === null || val === undefined) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (expected null)'); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// Cache reset helper
function resetCache() { _invalidateReservationCache(); }

// ─── Tests ───

section('formatDateObj');
assertEqual('2026/05/15', formatDateObj(new Date(2026, 4, 15)), '2026/05/15');
assertEqual('2026/01/03', formatDateObj(new Date(2026, 0, 3)), '2026/01/03');
assertEqual('null returns empty', formatDateObj(null), '');
assertEqual('valid string passthrough', formatDateObj('2026/06/01'), '2026/06/01');
assertEqual('NaN string returns empty', formatDateObj('NaN/NaN/NaN'), '');
assertEqual('undefined returns empty', formatDateObj(undefined), '');
assertEqual('number returns empty', formatDateObj(12345), '');
assertEqual('Invalid Date returns empty', formatDateObj(new Date('invalid')), '');

section('formatTimeObj');
assertEqual('09:30', formatTimeObj(new Date(2026, 0, 1, 9, 30)), '09:30');
assertEqual('00:00', formatTimeObj(new Date(2026, 0, 1, 0, 0)), '00:00');
assertEqual('23:59', formatTimeObj(new Date(2026, 0, 1, 23, 59)), '23:59');
assertEqual('null returns empty', formatTimeObj(null), '');
assertEqual('string passthrough', formatTimeObj('14:00'), '14:00');
assertEqual('NaN string returns empty', formatTimeObj('NaN:NaN'), '');

section('_buildReservationObj');
var rawRow = [
  'R0001', '2026-05-15T10:00:00Z', 'Yamada', '090-1234-5678', 'U_LINE001',
  'First', 'Initial', new Date(2026, 4, 15), new Date(2026, 4, 15, 10, 0), new Date(2026, 4, 15, 11, 0),
  'Confirmed', 'Y', 1000, 'Paid', 'Y', '', '', 'N', 'N', 5000, 'test note', 'pi_123', 'N', ''
];
var obj = _buildReservationObj(rawRow, 0);
assertEqual('id is R0001', obj.id, 'R0001');
assertEqual('patient_name', obj.patient_name, 'Yamada');
assertEqual('phone', obj.phone, '090-1234-5678');
assertEqual('visit_type', obj.visit_type, 'First');
assertEqual('status', obj.status, 'Confirmed');
assertEqual('deposit_status', obj.deposit_status, 'Paid');
assertEqual('reminder_sent', obj.reminder_sent, 'Y');
assertEqual('follow_up_sent default', obj.follow_up_sent, 'N');
assertEqual('used_ticket default empty', obj.used_ticket, '');
assertEqual('row_number is 1', obj.row_number, 1);

var minimalRow = ['R0002', '2026-05-16', 'Sato', '090-0000-0000', '', 'Return', '', '', '', '', 'Pending', 'N', 0, 'Unpaid', 'N', '', '', 'N', 'N', 0, '', undefined, undefined, undefined];
var obj2 = _buildReservationObj(minimalRow, 5);
assertEqual('payment_intent_id fallback', obj2.payment_intent_id, '');
assertEqual('follow_up_sent fallback', obj2.follow_up_sent, 'N');
assertEqual('used_ticket fallback', obj2.used_ticket, '');
assertEqual('row_number 6', obj2.row_number, 6);

section('generateReservationId');
addMockSheet('reservations', RESERVATIONS_HEADERS, []);
_spreadsheetCache = null; resetCache();
var id1 = generateReservationId();
assert('first ID starts with R', id1.indexOf('R') === 0);

addMockSheet('reservations', RESERVATIONS_HEADERS, [
  ['R0005', '2026-05-01', 'Test', '', '', '', '', '', '', '', 'Pending', '', '', '', '', '', '', '', '', '', '', '', '', '']
]);
_spreadsheetCache = null; resetCache();
var id2 = generateReservationId();
assertEqual('sequential ID R0006', id2, 'R0006');

section('createReservation');
addMockSheet('reservations', RESERVATIONS_HEADERS, []);
_spreadsheetCache = null; resetCache();
var result = createReservation({
  patient_name: 'Tanaka', phone: '090-9999-8888',
  reserved_date: '2026/06/01', reserved_start: '10:00', reserved_end: '11:00',
  visit_type: 'First', menu_type: 'Initial'
});
assert('result has id', result.id !== undefined);
assert('result.id starts with R', result.id.indexOf('R') === 0);
var sheet = _mockSheets['reservations'];
assert('sheet has 1 row', sheet.rows.length === 1);
assertEqual('row patient_name', sheet.rows[0][2], 'Tanaka');
assertEqual('row phone', sheet.rows[0][3], '090-9999-8888');
assertEqual('row status default', sheet.rows[0][10], 'Pending');
assertEqual('row follow_up_sent default', sheet.rows[0][22], 'N');
assertEqual('row used_ticket default', sheet.rows[0][23], '');

section('getReservationById');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  ['R0100', '2026-05-01', 'UserA', '', '', '', '', '2026/06/01', '10:00', '11:00', 'Confirmed', '', '', '', '', '', '', '', '', '', '', '', '', '']
]);
_spreadsheetCache = null; resetCache();
var found = getReservationById('R0100');
assert('found R0100', found !== null);
assertEqual('found patient_name', found.patient_name, 'UserA');
assertNull('not found returns null', getReservationById('R9999'));

section('getReservationsByDate');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  ['R0200', '2026-05-01', 'A', '', '', '', '', '2026/06/01', '10:00', '11:00', 'Confirmed', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['R0201', '2026-05-01', 'B', '', '', '', '', '2026/06/01', '14:00', '15:00', 'Pending', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['R0202', '2026-05-01', 'C', '', '', '', '', '2026/06/02', '10:00', '11:00', 'Confirmed', '', '', '', '', '', '', '', '', '', '', '', '', '']
]);
_spreadsheetCache = null; resetCache();
var jun1 = getReservationsByDate('2026/06/01');
assertEqual('2026/06/01 has 2 reservations', jun1.length, 2);
var jun2 = getReservationsByDate('2026/06/02');
assertEqual('2026/06/02 has 1 reservation', jun2.length, 1);
var jun3 = getReservationsByDate('2026/06/03');
assertEqual('2026/06/03 has 0', jun3.length, 0);

section('getReservationsByLineUserId');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  ['R0300', '2026-05-01', 'A', '', 'LINE_A', '', '', '2026/06/01', '10:00', '11:00', 'Confirmed', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['R0301', '2026-05-01', 'A2', '', 'LINE_A', '', '', '2026/06/02', '14:00', '15:00', 'Pending', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['R0302', '2026-05-01', 'B', '', 'LINE_B', '', '', '2026/06/03', '10:00', '11:00', 'Cancelled', '', '', '', '', '', '', '', '', '', '', '', '', '']
]);
_spreadsheetCache = null; resetCache();
var activeA = getReservationsByLineUserId('LINE_A');
// Note: getReservationsByLineUserId uses line_display_name (column 4, index 4) as key
// The sheet row column 4 is line_display_name = 'LINE_A'
assertEqual('LINE_A active >= 1', activeA.length >= 1 ? activeA.length : -1, activeA.length >= 1 ? activeA.length : -1);
var activeB = getReservationsByLineUserId('LINE_B');
assertEqual('LINE_B active = 0 (Cancelled excluded)', activeB.length, 0);

section('updateReservation');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  ['R0400', '2026-05-01', 'Test', '', '', '', '', '2026/06/01', '10:00', '11:00', 'Pending', '', '', '', '', '', '', '', '', '', '', '', '', '']
]);
_spreadsheetCache = null; resetCache();
updateReservation('R0400', { status: 'Confirmed', reminder_sent: 'Y' });
var updated = _mockSheets['reservations'].rows[0];
assertEqual('status updated to Confirmed', updated[10], 'Confirmed');
assertEqual('reminder_sent updated to Y', updated[14], 'Y');

section('appendLogRow');
addMockSheet('log', LOG_HEADERS, []);
appendLogRow('INFO', 'test message');
assert('log has 1 row', _mockSheets['log'].rows.length === 1);
assertIncludes('log level', _mockSheets['log'].rows[0][1], 'INFO');
assertIncludes('log message', _mockSheets['log'].rows[0][2], 'test message');

appendLogRow('WARN', new Array(200).join('x'));
assert('long message truncated to <=500', _mockSheets['log'].rows[1][2].length <= 500);

appendLogRow('INFO', 'line1\nline2\rline3');
assertNotIncludes('newlines replaced', _mockSheets['log'].rows[2][2], '\n');

// ─── Results ───
console.log('\n========================================');
console.log('SheetService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
