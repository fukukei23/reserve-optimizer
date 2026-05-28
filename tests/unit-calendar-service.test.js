/**
 * Unit Tests - CalendarService (_parseDateTime, _extractCalendarEventId)
 *
 * Run: node tests/unit-calendar-service.test.js
 *
 * Uses vm.Script to share scope with loaded GAS source files.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

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
global.notifyAdmin = function() {};
global.normalizeTimeInput = function(t) { return t; };
global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
global.validateDateForBooking = function() { return { valid: true }; };
global.calculateEndTime = function(start, dur) {
  var p = start.split(':');
  var m = parseInt(p[0]) * 60 + parseInt(p[1]) + dur;
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
};
global.getProperty = function(k) { return null; };
global.updateReservation = function() {};

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
global.WAITLIST_HEADERS = ['waitlist_id','line_display_name','phone','preferred_time','same_day_ok','last_notified_at','notes'];
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
global.getReservationById = function() { return null; };
global.createSheetWithHeaders = function(ss, name, headers) {
  addMockSheet(name, headers, []);
  return global.SpreadsheetApp.openById().getSheetByName(name);
};

// CalendarApp mock (not needed for pure functions but prevent errors on load)
global.CalendarApp = {
  getDefaultCalendar: function() { return { createEvent: function() { return { getId: function() { return 'mock_evt'; } }; } }; },
  getCalendarById: function() { return { createEvent: function() { return { getId: function() { return 'mock_evt'; } }; } }; },
  EventColor: { PALE_RED: 'pale_red' }
};

// Load source files via vm.Script (shared scope)
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var code = fs.readFileSync(path.join(gasDir, relPath), 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) }).runInThisContext();
}

// Load SheetService first (CalendarService depends on appendLogRow, updateReservation, getReservationById)
loadFile('services/SheetService.js');
loadFile('services/CalendarService.js');

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
function assertNull(name, val) {
  if (val === null || val === undefined) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (expected null, got ' + JSON.stringify(val) + ')'); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ─── Tests ───

section('_parseDateTime - valid inputs');
var d1 = _parseDateTime('2026/06/15', '10:30');
assert('valid returns Date', d1 instanceof Date);
assertEqual('year', d1.getFullYear(), 2026);
assertEqual('month', d1.getMonth(), 5); // June = 5 (0-based)
assertEqual('day', d1.getDate(), 15);
assertEqual('hour', d1.getHours(), 10);
assertEqual('minute', d1.getMinutes(), 30);

var d2 = _parseDateTime('2026/01/01', '00:00');
assertEqual('midnight year', d2.getFullYear(), 2026);
assertEqual('midnight month', d2.getMonth(), 0);
assertEqual('midnight day', d2.getDate(), 1);
assertEqual('midnight hour', d2.getHours(), 0);
assertEqual('midnight minute', d2.getMinutes(), 0);

var d3 = _parseDateTime('2026/12/31', '23:59');
assertEqual('eoy year', d3.getFullYear(), 2026);
assertEqual('eoy month', d3.getMonth(), 11);
assertEqual('eoy day', d3.getDate(), 31);
assertEqual('eoy hour', d3.getHours(), 23);
assertEqual('eoy minute', d3.getMinutes(), 59);

section('_parseDateTime - invalid inputs');
assertNull('null date', _parseDateTime(null, '10:00'));
assertNull('null time', _parseDateTime('2026/06/15', null));
assertNull('undefined date', _parseDateTime(undefined, '10:00'));
assertNull('undefined time', _parseDateTime('2026/06/15', undefined));
assertNull('bad format date', _parseDateTime('bad', '10:00'));
assertNull('missing parts 2026/06', _parseDateTime('2026/06', '10:00'));
assertNull('NaN parts abc/de/fg', _parseDateTime('abc/de/fg', '10:00'));
assertNull('both empty strings', _parseDateTime('', ''));
assertNull('date only whitespace', _parseDateTime('   ', '10:00'));

section('_extractCalendarEventId - valid inputs');
assertEqual('simple prefix', _extractCalendarEventId('calendar_event:evt123'), 'evt123');
assertEqual('with pipe separator', _extractCalendarEventId('calendar_event:evt123|other'), 'evt123');
assertEqual('surrounding text returns until pipe or end', _extractCalendarEventId('blah calendar_event:evt456 blah'), 'evt456 blah');
assertEqual('prefix at start', _extractCalendarEventId('calendar_event:abcXYZ'), 'abcXYZ');

section('_extractCalendarEventId - invalid inputs');
assertNull('no prefix', _extractCalendarEventId('some random notes'));
assertNull('empty string', _extractCalendarEventId(''));
assertNull('null notes', _extractCalendarEventId(null));
assertNull('undefined notes', _extractCalendarEventId(undefined));

// ─── Results ───
console.log('\n========================================');
console.log('CalendarService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
