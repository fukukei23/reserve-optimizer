/**
 * Unit Tests - ReminderService (structure, function existence, checkForNoShows logic)
 *
 * Run: node tests/unit-reminder-service.test.js
 *
 * Uses vm.Script to share scope with loaded GAS source files.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockSheets = {};
var _mockCache = {};

function addMockSheet(name, headers, rows) {
  _mockSheets[name] = { headers: headers || [], rows: rows || [] };
}

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
    },
    deleteRow: function(rowNum) {
      // rowNum is 1-based; data rows start at row 2 (row 1 is headers)
      var idx = rowNum - 2;
      if (idx >= 0 && idx < sheet.rows.length) {
        sheet.rows.splice(idx, 1);
      }
    }
  };
}

// ─── Mock GAS globals ───
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
  }
};

global.PropertiesService = {
  getScriptProperties: function() {
    var props = {
      'SPREADSHEET_ID': 'mock',
      'REMINDER_HOURS_BEFORE': '24',
      'NO_SHOW_DEPOSIT_AMOUNT': '2000'
    };
    return { getProperty: function(k) { return props[k] || null; }, setProperty: function() {} };
  }
};

global.Utilities = {
  formatDate: function(d, tz, fmt) {
    var pad = function(n) { return ('0' + n).slice(-2); };
    if (fmt === 'yyyy-MM-dd') {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    if (fmt === 'HH:mm') {
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    if (fmt === 'yyyy/MM/dd') {
      return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
    }
    return d.toISOString();
  },
  getUuid: function() {
    return Math.random().toString(36).substring(2, 18);
  }
};

global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };
global.Logger = { log: function() {} };
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };

// ─── Stubs ───
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global.isFirebaseConfigured = function() { return false; };

// LINE stubs
global.sendLinePush = function() { return true; };
global.sendLinePushQuickReply = function() { return true; };
global.sendLineReply = function() {};
global.sendQuickReply = function() {};
global.logLineMessage = function() {};

// Config stubs
global.RESERVATION_STATUS = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled',
  NO_SHOW: 'NoShow', VISITED: 'Visited'
};
global.DEPOSIT_STATUS = {
  UNPAID: 'Unpaid', PAID: 'Paid', REFUNDED: 'Refunded',
  APPLIED: 'Applied', FORFEITED: 'Forfeited'
};
global.SHEET_NAMES = {
  RESERVATIONS: 'reservations',
  WAITLIST: 'waitlist',
  WEEKLY_SUMMARY: 'weekly_summary',
  CUSTOMERS: 'customers',
  TICKETS: 'tickets',
  LOG: 'log'
};
global.TIMEZONE = 'Asia/Tokyo';

global.RESERVATIONS_HEADERS = [
  'reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name',
  'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end',
  'status', 'deposit_required', 'deposit_amount', 'deposit_status',
  'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified',
  'resale_success', 'average_unit_price', 'notes', 'payment_intent_id',
  'follow_up_sent', 'used_ticket'
];
global.WAITLIST_HEADERS = ['waitlist_id', 'line_display_name', 'phone', 'preferred_time', 'same_day_ok', 'last_notified_at', 'notes'];
global.LOG_HEADERS = ['timestamp', 'level', 'message'];
global.CUSTOMERS_HEADERS = [
  'customer_id', 'phone', 'line_user_id', 'name',
  'visit_count', 'no_show_count', 'last_visit', 'tags', 'notes'
];
global.CRM_TAG_THRESHOLDS = { REGULAR: 3, VIP: 10, NO_SHOW_WARN: 2 };

// Sheet helper stubs
global.getReservationsSheet = function() { return global.SpreadsheetApp.openById().getSheetByName('reservations'); };
global.createSheetWithHeaders = function(ss, name, headers) {
  addMockSheet(name, headers, []);
  return global.SpreadsheetApp.openById().getSheetByName(name);
};

// ReminderService dependency stubs
var markNoShowCalls = [];
var incrementNoShowCountCalls = [];
var notifyAdminCalls = [];

global.markReminderSent = function() {};
// markNoShow will be overridden after SheetService loads since SheetService defines it
var _realMarkNoShow = null;
global.markNoShow = function(id) { markNoShowCalls.push(id); };
global.getReminderHoursBefore = function() { return 24; };
global.getNoShowDepositAmount = function() { return 2000; };
global.getUserPrefs = function() { return {}; };
global.getUserLocale = function() { return 'ja'; };
global.updateReservation = function() {};
global.getWaitlistSheet = function() { return global.SpreadsheetApp.openById().getSheetByName('waitlist'); };
global.findWaitlistCandidate = function() { return []; };
global.handleCancellation = function() {};
global.resellVacancy = function() {};
global.getReservationById = function() { return null; };
global.getProperty = function(key, defaultVal) { return defaultVal || ''; };

global.incrementNoShowCount = function(phone) { incrementNoShowCountCalls.push(phone); };
global.notifyAdmin = function(eventType, message) { notifyAdminCalls.push({ eventType: eventType, message: message }); };

// MessageTemplates stub
global.MessageTemplates = {
  getReminderMessage: function(date, time, menu) {
    return { text: 'Reminder: ' + date + ' ' + time + ' ' + menu, quickReplies: null };
  },
  getNoShowPenaltyMessage: function(amount) {
    return 'No-show penalty: ' + amount + ' JPY';
  },
  getResaleNotificationMessage: function(date, timeRange, menu) {
    return { text: 'Slot available: ' + date + ' ' + timeRange, quickReplies: null };
  }
};

// i18n stubs
global.t = function(key, locale) { return key; };
global.tf = function(key, vals, locale) { return key; };

// _fill stub (used in sendSameDayReminders)
global._fill = function(template, values) {
  var result = template;
  for (var k in values) {
    result = result.replace(new RegExp('\\{' + k + '\\}', 'g'), values[k]);
  }
  return result;
};

// CRM processFollowups stub
global.processFollowups = function() { return 0; };

// ScriptApp mock
global.ScriptApp = {
  newTrigger: function(functionName) {
    return {
      timeBased: function() {
        return {
          after: function(ms) {
            return { create: function() {} };
          }
        };
      }
    };
  }
};

// ─── Load source files via vm.Script ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var code = fs.readFileSync(path.join(gasDir, relPath), 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) }).runInThisContext();
}

// Load SheetService first (provides _getCachedSpreadsheet, formatDateObj, etc.)
addMockSheet('reservations', global.RESERVATIONS_HEADERS, []);
addMockSheet('waitlist', global.WAITLIST_HEADERS, []);
addMockSheet('log', global.LOG_HEADERS, []);
loadFile('services/SheetService.js');

// Override markNoShow and updateReservation AFTER SheetService loads
// SheetService defines these, so we need to override them after load
var _sheetMarkNoShow = global.markNoShow;
var _sheetUpdateReservation = global.updateReservation;

// Re-stub markNoShow to avoid dependency on _reservationByIdMap
global.markNoShow = function(id) { markNoShowCalls.push(id); };
global.updateReservation = function() {};
global.markReminderSent = function() {};

// Load ReminderService
loadFile('services/ReminderService.js');

// Ensure our stubs are still in place (ReminderService may reference these by closure)
// Re-set global references
global.markNoShow = function(id) { markNoShowCalls.push(id); };
global.updateReservation = function() {};
global.markReminderSent = function() {};

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

// ─── Tests: Function existence ───

section('Function existence');
assert('sendDayBeforeReminders is function', typeof sendDayBeforeReminders === 'function');
assert('sendSameDayReminders is function', typeof sendSameDayReminders === 'function');
assert('checkForNoShows is function', typeof checkForNoShows === 'function');
assert('checkWaitlistResponses is function', typeof checkWaitlistResponses === 'function');
assert('cleanupWaitlist is function', typeof cleanupWaitlist === 'function');
assert('runCrmPeriodicTasks is function', typeof runCrmPeriodicTasks === 'function');
assert('handleSameDayCancellation is function', typeof handleSameDayCancellation === 'function');

// ─── Tests: checkForNoShows logic ───

section('checkForNoShows - detects no-show (reserved_end <= current time, status=Confirmed)');

// We need to manipulate _reservationCache directly and freeze time
// Create a date where currentTime = '11:00' and currentDate = '2026-05-29'
var frozenDate = new Date(2026, 4, 29, 11, 0, 0); // 2026-05-29 11:00 JST-like

// Override Utilities.formatDate to use frozen date
var origFormatDate = global.Utilities.formatDate;
global.Utilities.formatDate = function(d, tz, fmt) {
  // Use frozenDate for 'now' comparisons
  var pad = function(n) { return ('0' + n).slice(-2); };
  if (fmt === 'HH:mm') return pad(frozenDate.getHours()) + ':' + pad(frozenDate.getMinutes());
  if (fmt === 'yyyy-MM-dd') return frozenDate.getFullYear() + '-' + pad(frozenDate.getMonth() + 1) + '-' + pad(frozenDate.getDate());
  if (fmt === 'yyyy/MM/dd') return frozenDate.getFullYear() + '/' + pad(frozenDate.getMonth() + 1) + '/' + pad(frozenDate.getDate());
  return origFormatDate(d, tz, fmt);
};

// Reset tracking arrays
markNoShowCalls = [];
incrementNoShowCountCalls = [];
notifyAdminCalls = [];

// Set up a reservation where end time has passed
_reservationCache = [
  {
    id: 'R_NS001',
    reserved_date: '2026-05-29',
    reserved_start: '10:00',
    reserved_end: '10:30',  // 10:30 <= 11:00 (current) => no-show
    status: 'Confirmed',
    phone: '090-1234-5678',
    line_display_name: 'U_TEST001',
    patient_name: 'TestUser',
    deposit_status: 'Unpaid',
    menu_type: 'Initial'
  }
];

var noShowResult = checkForNoShows();
assertEqual('no-show detected count', noShowResult, 1);
assertEqual('markNoShow called with R_NS001', markNoShowCalls.length >= 1 ? markNoShowCalls[0] : '', 'R_NS001');
assert('incrementNoShowCount called', incrementNoShowCountCalls.length >= 1);
assertIncludes('incrementNoShowCount phone', incrementNoShowCountCalls.join(','), '090-1234-5678');
assert('notifyAdmin called', notifyAdminCalls.length >= 1);
assertIncludes('notifyAdmin event type', notifyAdminCalls[0].eventType, 'no_show');

section('checkForNoShows - no detection for future end time');
markNoShowCalls = [];
incrementNoShowCountCalls = [];
notifyAdminCalls = [];

_reservationCache = [
  {
    id: 'R_NS002',
    reserved_date: '2026-05-29',
    reserved_start: '11:00',
    reserved_end: '12:00',  // 12:00 > 11:00 (current) => NOT no-show
    status: 'Confirmed',
    phone: '090-9999-8888',
    line_display_name: 'U_TEST002',
    patient_name: 'FutureUser',
    deposit_status: 'Unpaid',
    menu_type: 'Initial'
  }
];

var noFutureResult = checkForNoShows();
assertEqual('no future no-show detected', noFutureResult, 0);
assertEqual('markNoShow not called', markNoShowCalls.length, 0);

section('checkForNoShows - no detection for already cancelled');
markNoShowCalls = [];
_reservationCache = [
  {
    id: 'R_NS003',
    reserved_date: '2026-05-29',
    reserved_start: '09:00',
    reserved_end: '09:30',  // 09:30 <= 11:00, but status is Cancelled
    status: 'Cancelled',
    phone: '090-5555-6666',
    line_display_name: 'U_TEST003',
    patient_name: 'CancelledUser',
    deposit_status: 'Unpaid',
    menu_type: 'Initial'
  }
];

var noCancelResult = checkForNoShows();
assertEqual('cancelled reservation not flagged', noCancelResult, 0);

section('checkForNoShows - no detection for different date');
markNoShowCalls = [];
_reservationCache = [
  {
    id: 'R_NS004',
    reserved_date: '2026-05-30',  // different date
    reserved_start: '10:00',
    reserved_end: '10:30',
    status: 'Confirmed',
    phone: '090-1111-2222',
    line_display_name: 'U_TEST004',
    patient_name: 'TomorrowUser',
    deposit_status: 'Unpaid',
    menu_type: 'Initial'
  }
];

var noDiffDateResult = checkForNoShows();
assertEqual('different date not flagged', noDiffDateResult, 0);

section('checkForNoShows - multiple no-shows detected');
markNoShowCalls = [];
incrementNoShowCountCalls = [];
notifyAdminCalls = [];

_reservationCache = [
  {
    id: 'R_NS010',
    reserved_date: '2026-05-29',
    reserved_start: '09:00',
    reserved_end: '09:30',
    status: 'Confirmed',
    phone: '090-1000-0001',
    line_display_name: 'U_MULTI1',
    patient_name: 'User1',
    deposit_status: 'Unpaid',
    menu_type: 'Initial'
  },
  {
    id: 'R_NS011',
    reserved_date: '2026-05-29',
    reserved_start: '10:00',
    reserved_end: '10:30',
    status: 'Confirmed',
    phone: '090-1000-0002',
    line_display_name: 'U_MULTI2',
    patient_name: 'User2',
    deposit_status: 'Unpaid',
    menu_type: 'Initial'
  },
  {
    id: 'R_NS012',
    reserved_date: '2026-05-29',
    reserved_start: '12:00',
    reserved_end: '13:00',  // future slot, should NOT be flagged
    status: 'Confirmed',
    phone: '090-1000-0003',
    line_display_name: 'U_MULTI3',
    patient_name: 'User3',
    deposit_status: 'Unpaid',
    menu_type: 'Initial'
  }
];

var multiResult = checkForNoShows();
assertEqual('2 no-shows detected', multiResult, 2);
assertEqual('markNoShow called 2 times', markNoShowCalls.length, 2);

section('checkForNoShows - paid deposit triggers penalty message');
markNoShowCalls = [];
incrementNoShowCountCalls = [];
notifyAdminCalls = [];

var sendLinePushCalls = [];
var origSendLinePush = global.sendLinePush;
global.sendLinePush = function(userId, msg) {
  sendLinePushCalls.push({ userId: userId, msg: msg });
  return true;
};

_reservationCache = [
  {
    id: 'R_NS020',
    reserved_date: '2026-05-29',
    reserved_start: '09:00',
    reserved_end: '09:30',
    status: 'Confirmed',
    phone: '090-2000-0001',
    line_display_name: 'U_PAID',
    patient_name: 'PaidUser',
    deposit_status: 'Paid',  // deposit paid => penalty message
    menu_type: 'Initial'
  }
];

var paidResult = checkForNoShows();
assertEqual('paid no-show detected', paidResult, 1);
assert('sendLinePush called for penalty', sendLinePushCalls.length >= 1);
if (sendLinePushCalls.length >= 1) {
  assertIncludes('penalty message includes amount', sendLinePushCalls[0].msg, '2000');
}

// Restore
global.sendLinePush = origSendLinePush;

// Restore Utilities.formatDate
global.Utilities.formatDate = origFormatDate;

// ─── Tests: cleanupWaitlist ───

section('cleanupWaitlist - deletes old entries');

addMockSheet('waitlist', global.WAITLIST_HEADERS, [
  ['WL001', 'U_OLD', '090-old', '', '', new Date(2026, 3, 1), ''],  // 30+ days ago => delete
  ['WL002', 'U_RECENT', '090-new', '', '', new Date(2026, 4, 28), ''], // recent => keep
  ['WL003', 'U_NO_NOTIFY', '090-none', '', '', null, '']  // never notified => keep
]);

// Need to freeze Date.now for cleanupWaitlist's "now"
var now = new Date(2026, 4, 29); // 2026-05-29
var origNow = Date.now;
Date.now = function() { return now.getTime(); };

var waitlistSheet = _mockSheets['waitlist'];
var rowsBefore = waitlistSheet.rows.length;

cleanupWaitlist();

// The 30-day-old entry should be deleted
assert('waitlist rows decreased', waitlistSheet.rows.length < rowsBefore);

Date.now = origNow;

// ─── Tests: runCrmPeriodicTasks ───

section('runCrmPeriodicTasks');
var followupCalls = 0;
var origProcessFollowups = global.processFollowups;
global.processFollowups = function(mins) {
  followupCalls++;
  assertEqual('processFollowups called with 60', mins, 60);
  return 0;
};

runCrmPeriodicTasks();
assertEqual('processFollowups was called', followupCalls, 1);

global.processFollowups = origProcessFollowups;

// ─── Results ───
console.log('\n========================================');
console.log('ReminderService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
