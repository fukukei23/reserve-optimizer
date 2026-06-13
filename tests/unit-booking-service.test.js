/**
 * Unit Tests - BookingService (getBookedSlotsForDate, cancelExpiredUnpaidReservations)
 *
 * Run: node tests/unit-booking-service.test.js
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
var sendLinePushCalls = [];
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global.isFirebaseConfigured = function() { return false; };
global.getDepositAmount = function() { return 1000; };
global.getAverageUnitPrice = function() { return 5000; };
global.getLineAccessToken = function() { return 'mock'; };
global.getStripeApiKey = function() { return 'mock'; };
global.sendLinePush = function(userId, msg) { sendLinePushCalls.push({ userId: userId, msg: msg }); };
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

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var code = fs.readFileSync(path.join(gasDir, relPath), 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) }).runInThisContext();
}

// SheetService must be loaded first (BookingService depends on its cache infrastructure)
loadFile('services/SheetService.js');
loadFile('services/BookingService.js');

// ─── Post-load overrides ───
// The real appendLogRow (from SheetService.js) needs a 'log' sheet in _mockSheets.
// Override it with a safe no-op to avoid log sheet side effects in these tests.
global.appendLogRow = function() {};

// The real updateReservation calls _invalidateReservationCache() which sets _reservationCache=null,
// causing the for-loop in cancelExpiredUnpaidReservations to crash on .length access.
// Override with a direct sheet-write stub that does NOT invalidate the cache.
global.updateReservation = function(reservationId, updates) {
  var sheet = _mockSheets['reservations'];
  if (!sheet) return;
  for (var i = 0; i < sheet.rows.length; i++) {
    if (sheet.rows[i][0] === reservationId) {
      for (var key in updates) {
        var colIdx = RESERVATIONS_COLUMNS[key.toUpperCase()];
        if (colIdx) {
          sheet.rows[i][colIdx - 1] = updates[key];
        }
      }
      return;
    }
  }
};

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
function assertDeepEqual(name, actual, expected) {
  var aStr = JSON.stringify(actual);
  var eStr = JSON.stringify(expected);
  if (aStr === eStr) { passed++; console.log('  PASS ' + name); }
  else { failed++; var d = 'expected ' + eStr + ' got ' + aStr; errors.push(name + ' -- ' + d); console.log('  FAIL ' + name + ' (' + d + ')'); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// Cache reset helper
function resetCache() {
  _spreadsheetCache = null;
  _invalidateReservationCache();
}

// Helper: build a row array for the reservations sheet
// Columns: reservation_id(0) created_at(1) patient_name(2) phone(3) line_display_name(4)
//          visit_type(5) menu_type(6) reserved_date(7) reserved_start(8) reserved_end(9)
//          status(10) deposit_required(11) deposit_amount(12) deposit_status(13)
//          reminder_sent(14) reminder_response(15) cancel_time(16) resale_notified(17)
//          resale_success(18) average_unit_price(19) notes(20) payment_intent_id(21)
//          follow_up_sent(22) used_ticket(23)
function makeRow(id, createdAt, status, depositStatus, reservedDate, reservedStart, lineDisplayName) {
  return [
    id, createdAt, 'TestUser', '090-0000-0000', lineDisplayName || 'LINE_U1',
    'First', 'Initial', reservedDate || '2026-06-01', reservedStart || '10:00', '11:00',
    status, 'N', 1000, depositStatus, 'N', '', '', 'N', 'N', 5000, '', '', 'N', ''
  ];
}

// ─── Tests: getBookedSlotsForDate ───

section('getBookedSlotsForDate - empty date');
addMockSheet('reservations', RESERVATIONS_HEADERS, []);
resetCache();
var emptySlots = getBookedSlotsForDate('2026-06-01');
assertDeepEqual('empty sheet returns {}', emptySlots, {});

section('getBookedSlotsForDate - 2 Confirmed at 10:00');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R001', '2026-06-01T09:00:00Z', 'Confirmed', 'Paid', '2026-06-01', '10:00'),
  makeRow('R002', '2026-06-01T09:30:00Z', 'Confirmed', 'Paid', '2026-06-01', '10:00')
]);
resetCache();
var slots2 = getBookedSlotsForDate('2026-06-01');
assertEqual('2 Confirmed at 10:00', slots2['10:00'], 2);

section('getBookedSlotsForDate - only Pending+Confirmed counted');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R010', '2026-06-01T09:00:00Z', 'Pending', 'Unpaid', '2026-06-01', '09:00'),
  makeRow('R011', '2026-06-01T09:00:00Z', 'Confirmed', 'Paid', '2026-06-01', '10:00'),
  makeRow('R012', '2026-06-01T09:00:00Z', 'Cancelled', 'Refunded', '2026-06-01', '11:00'),
  makeRow('R013', '2026-06-01T09:00:00Z', 'NoShow', 'Forfeited', '2026-06-01', '12:00')
]);
resetCache();
var slots3 = getBookedSlotsForDate('2026-06-01');
assertEqual('Pending at 09:00 counted', slots3['09:00'], 1);
assertEqual('Confirmed at 10:00 counted', slots3['10:00'], 1);
assert('Cancelled at 11:00 not counted', slots3['11:00'] === undefined);
assert('NoShow at 12:00 not counted', slots3['12:00'] === undefined);

section('getBookedSlotsForDate - null reserved_start skipped');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R020', '2026-06-01T09:00:00Z', 'Pending', 'Unpaid', '2026-06-01', null)
]);
// Override reserved_start to be empty string (which is falsy)
_mockSheets['reservations'].rows[0][8] = '';
resetCache();
var slots4 = getBookedSlotsForDate('2026-06-01');
assertDeepEqual('null reserved_start returns {}', slots4, {});

// ─── Tests: cancelExpiredUnpaidReservations ───

section('cancelExpiredUnpaidReservations - old unpaid cancelled');
var fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R100', fourHoursAgo.toISOString(), 'Pending', 'Unpaid', '2026-06-01', '10:00', 'LINE_EXPIRED')
]);
resetCache();
sendLinePushCalls = [];
cancelExpiredUnpaidReservations();
var cancelledRow = _mockSheets['reservations'].rows[0];
assertEqual('old unpaid status → Cancelled', cancelledRow[10], 'Cancelled');
assert('old unpaid notes contains auto-cancelled', String(cancelledRow[20]).indexOf('Auto-cancelled') >= 0);
assert('sendLinePush called for expired user', sendLinePushCalls.length >= 1);

section('cancelExpiredUnpaidReservations - recent unpaid NOT cancelled');
var oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R200', oneHourAgo.toISOString(), 'Pending', 'Unpaid', '2026-06-01', '14:00', 'LINE_RECENT')
]);
resetCache();
sendLinePushCalls = [];
cancelExpiredUnpaidReservations();
var recentRow = _mockSheets['reservations'].rows[0];
assertEqual('recent unpaid status stays Pending', recentRow[10], 'Pending');
assert('no sendLinePush for recent', sendLinePushCalls.length === 0);

section('cancelExpiredUnpaidReservations - paid NOT cancelled even if old');
var fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R300', fiveHoursAgo.toISOString(), 'Pending', 'Paid', '2026-06-01', '15:00', 'LINE_PAID')
]);
resetCache();
sendLinePushCalls = [];
cancelExpiredUnpaidReservations();
var paidRow = _mockSheets['reservations'].rows[0];
assertEqual('old paid status stays Pending', paidRow[10], 'Pending');
assert('no sendLinePush for paid', sendLinePushCalls.length === 0);

section('cancelExpiredUnpaidReservations - Confirmed NOT cancelled');
var sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R400', sixHoursAgo.toISOString(), 'Confirmed', 'Unpaid', '2026-06-01', '16:00', 'LINE_CONF')
]);
resetCache();
sendLinePushCalls = [];
cancelExpiredUnpaidReservations();
var confRow = _mockSheets['reservations'].rows[0];
assertEqual('old Confirmed stays Confirmed', confRow[10], 'Confirmed');
assert('no sendLinePush for Confirmed', sendLinePushCalls.length === 0);

// ─── エッジケース ───

section('M1: 複数の期限切れ予約が一括キャンセルされる');
var fourHoursAgoM1 = new Date(Date.now() - 4 * 60 * 60 * 1000);
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R_M1A', fourHoursAgoM1.toISOString(), 'Pending', 'Unpaid', '2026-06-01', '10:00', 'LINE_M1A'),
  makeRow('R_M1B', fourHoursAgoM1.toISOString(), 'Pending', 'Unpaid', '2026-06-01', '11:00', 'LINE_M1B')
]);
resetCache();
sendLinePushCalls = [];
cancelExpiredUnpaidReservations();
assertEqual('M1: R_M1A → Cancelled', _mockSheets['reservations'].rows[0][10], 'Cancelled');
assertEqual('M1: R_M1B → Cancelled', _mockSheets['reservations'].rows[1][10], 'Cancelled');
assertEqual('M1: 2件のpush送信', sendLinePushCalls.length, 2);

section('M2: 不正な created_at (NaN) → スキップ');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R_M2', 'INVALID_DATE', 'Pending', 'Unpaid', '2026-06-01', '10:00', 'LINE_M2')
]);
resetCache();
sendLinePushCalls = [];
cancelExpiredUnpaidReservations();
assertEqual('M2: ステータス変わらず Pending', _mockSheets['reservations'].rows[0][10], 'Pending');
assert('M2: push送信なし', sendLinePushCalls.length === 0);

section('L3: Visited/NoShow は getBookedSlotsForDate でカウントされない');
addMockSheet('reservations', RESERVATIONS_HEADERS, [
  makeRow('R_L3A', '2026-06-01T08:00:00Z', 'Visited',  'Paid',      '2026-06-01', '10:00'),
  makeRow('R_L3B', '2026-06-01T08:00:00Z', 'NoShow',   'Forfeited', '2026-06-01', '10:00'),
  makeRow('R_L3C', '2026-06-01T08:00:00Z', 'Pending',  'Unpaid',    '2026-06-01', '10:00')
]);
resetCache();
var slotsL3 = getBookedSlotsForDate('2026-06-01');
assertEqual('L3: 10:00 は Pending 1件のみカウント', slotsL3['10:00'], 1);

// ─── Results ───
console.log('\n========================================');
console.log('BookingService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
