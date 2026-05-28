/**
 * Unit Tests - WaitlistService (getWaitlistReservations, addToWaitlist,
 *   findWaitlistCandidate, resellVacancy, markResaleSuccessful)
 *
 * Run: node tests/unit-waitlist-service.test.js
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
global.normalizeTimeInput = function(t) { return t; };
global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
global.validateDateForBooking = function() { return { valid: true }; };
global.calculateEndTime = function(start, dur) {
  var p = start.split(':');
  var m = parseInt(p[0]) * 60 + parseInt(p[1]) + dur;
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
};
global.getProperty = function(k) { return null; };

// Track calls to updateReservation (will be overridden after SheetService loads)
var _updateReservationCalls = [];

// Track calls to notifyAdmin
var _notifyAdminCalls = [];

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

// MessageTemplates stub
global.MessageTemplates = {
  getResaleNotificationMessage: function(date, time, menu) {
    return { text: 'Vacancy: ' + date + ' ' + time + ' ' + menu, quickReplies: [] };
  }
};

// getWaitlistSheet returns the waitlist sheet
global.getWaitlistSheet = function() {
  return global.SpreadsheetApp.openById().getSheetByName('waitlist');
};

// Load source files via vm.Script (shared scope)
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var code = fs.readFileSync(path.join(gasDir, relPath), 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) }).runInThisContext();
}

// Load SheetService first (WaitlistService depends on it)
loadFile('services/SheetService.js');
loadFile('services/WaitlistService.js');

// Override updateReservation and notifyAdmin AFTER loading source files
// (SheetService defines its own updateReservation which requires actual sheet data)
global.updateReservation = function(id, updates) {
  _updateReservationCalls.push({ id: id, updates: updates });
};
global.notifyAdmin = function(type, msg) {
  _notifyAdminCalls.push({ type: type, msg: msg });
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
function assertNull(name, val) {
  if (val === null || val === undefined) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (expected null, got ' + JSON.stringify(val) + ')'); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ─── Tests ───

section('getWaitlistReservations - empty sheet');
addMockSheet('waitlist', WAITLIST_HEADERS, []);
var emptyResult = getWaitlistReservations();
assert('empty sheet returns array', Array.isArray(emptyResult));
assertEqual('empty sheet returns 0 entries', emptyResult.length, 0);

section('getWaitlistReservations - 3 entries');
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0001', 'Taro', '090-1111-2222', 'Morning', 'Y', '', 'note1'],
  ['W0002', 'Hanako', '090-3333-4444', 'Afternoon', 'N', '2026-05-28', 'note2'],
  ['W0003', 'Jiro', '090-5555-6666', 'Any', 'Y', '', 'note3']
]);
var threeResult = getWaitlistReservations();
assertEqual('3 entries returned', threeResult.length, 3);
assertEqual('first entry id', threeResult[0].id, 'W0001');
assertEqual('first entry line_display_name', threeResult[0].line_display_name, 'Taro');
assertEqual('first entry phone', threeResult[0].phone, '090-1111-2222');
assertEqual('first entry preferred_time', threeResult[0].preferred_time, 'Morning');
assertEqual('first entry same_day_ok', threeResult[0].same_day_ok, 'Y');
assertEqual('second entry id', threeResult[1].id, 'W0002');
assertEqual('second entry preferred_time', threeResult[1].preferred_time, 'Afternoon');
assertEqual('second entry same_day_ok', threeResult[1].same_day_ok, 'N');
assertEqual('third entry id', threeResult[2].id, 'W0003');
assertEqual('third entry preferred_time', threeResult[2].preferred_time, 'Any');

section('addToWaitlist - first entry');
addMockSheet('waitlist', WAITLIST_HEADERS, []);
var row1 = addToWaitlist({ line_display_name: 'TestUser1', phone: '090-0000-0001', preferred_time: 'Morning', same_day_ok: 'Y', notes: 'test note' });
assert('returns row count', typeof row1 === 'number');
assertEqual('first entry id is W0001', _mockSheets['waitlist'].rows[0][0], 'W0001');
assertEqual('first entry name', _mockSheets['waitlist'].rows[0][1], 'TestUser1');
assertEqual('first entry phone', _mockSheets['waitlist'].rows[0][2], '090-0000-0001');
assertEqual('first entry preferred_time', _mockSheets['waitlist'].rows[0][3], 'Morning');
assertEqual('first entry same_day_ok', _mockSheets['waitlist'].rows[0][4], 'Y');
assertEqual('first entry notes', _mockSheets['waitlist'].rows[0][6], 'test note');

section('addToWaitlist - second entry gets W0002');
_notifyAdminCalls = [];
var row2 = addToWaitlist({ line_display_name: 'TestUser2', phone: '090-0000-0002', same_day_ok: 'N' });
assertEqual('second entry id is W0002', _mockSheets['waitlist'].rows[1][0], 'W0002');
assertEqual('second entry name', _mockSheets['waitlist'].rows[1][1], 'TestUser2');

section('addToWaitlist - default preferred_time is Any');
addMockSheet('waitlist', WAITLIST_HEADERS, []);
addToWaitlist({ line_display_name: 'NoPref', phone: '090-9999-9999' });
assertEqual('default preferred_time is Any', _mockSheets['waitlist'].rows[0][3], 'Any');

section('findWaitlistCandidate - same_day_ok=Y gives +10');
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0100', 'User1', '090-1000', 'Any', 'Y', '', '']
]);
// Morning appointment (10:00)
var candidates1 = findWaitlistCandidate('2026-06-15T10:00');
assertEqual('1 candidate found', candidates1.length, 1);
assertEqual('candidate is W0100', candidates1[0].id, 'W0100');

section('findWaitlistCandidate - preferred_time=Any gives +5');
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0200', 'UserAny', '090-2000', 'Any', 'N', '', '']
]);
var candidatesAny = findWaitlistCandidate('2026-06-15T14:00');
assertEqual('Any time candidate found', candidatesAny.length, 1);
assertEqual('Any candidate is W0200', candidatesAny[0].id, 'W0200');

section('findWaitlistCandidate - Morning match');
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0300', 'UserMorn', '090-3000', 'Morning', 'N', '', '']
]);
var candidatesMorn = findWaitlistCandidate('2026-06-15T09:00');
assertEqual('Morning match found', candidatesMorn.length, 1);
assertEqual('Morning candidate is W0300', candidatesMorn[0].id, 'W0300');

section('findWaitlistCandidate - Afternoon match');
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0400', 'UserAft', '090-4000', 'Afternoon', 'N', '', '']
]);
var candidatesAft = findWaitlistCandidate('2026-06-15T14:00');
assertEqual('Afternoon match found', candidatesAft.length, 1);
assertEqual('Afternoon candidate is W0400', candidatesAft[0].id, 'W0400');

section('findWaitlistCandidate - Evening match');
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0500', 'UserEve', '090-5000', 'Evening', 'N', '', '']
]);
var candidatesEve = findWaitlistCandidate('2026-06-15T18:00');
assertEqual('Evening match found', candidatesEve.length, 1);
assertEqual('Evening candidate is W0500', candidatesEve[0].id, 'W0500');

section('findWaitlistCandidate - recently notified (<24h) gives -5');
// Create a date 1 hour ago
var recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0600', 'RecentNotified', '090-6000', 'Any', 'Y', recentDate.toISOString(), '']
]);
var candidatesRecent = findWaitlistCandidate('2026-06-15T10:00');
// same_day_ok=Y gives +10, Any gives +5, recently notified gives -5 => total = 10 > 0, still included
assertEqual('recently notified still in results (score>0)', candidatesRecent.length, 1);

section('findWaitlistCandidate - score=0 excluded');
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0700', 'NoMatch', '090-7000', 'Morning', 'N', '', '']
]);
// Afternoon appointment but preferred Morning and not same_day_ok => score 0 => excluded
var candidatesNoMatch = findWaitlistCandidate('2026-06-15T14:00');
assertEqual('score=0 candidate excluded', candidatesNoMatch.length, 0);

section('findWaitlistCandidate - returns top 3 sorted by score');
addMockSheet('waitlist', WAITLIST_HEADERS, [
  ['W0801', 'LowScore', '090-8001', 'Morning', 'N', '', ''],           // Morning + morning(10h) => +5
  ['W0802', 'HighScore', '090-8002', 'Any', 'Y', '', ''],              // Any +5, same_day_ok +10 => 15
  ['W0803', 'MidScore', '090-8003', 'Morning', 'Y', '', ''],          // same_day_ok +10, Morning+10h +5 => 15
  ['W0804', 'ZeroScore', '090-8004', 'Evening', 'N', '', '']           // Evening + morning(10h) => 0
]);
var candidatesSorted = findWaitlistCandidate('2026-06-15T10:00');
assertEqual('top 3 returned', candidatesSorted.length, 3);
// All 3 should be from W0801, W0802, W0803 (W0804 excluded with score=0)
var ids = candidatesSorted.map(function(c) { return c.id; });
assert('W0802 included', ids.indexOf('W0802') >= 0);
assert('W0803 included', ids.indexOf('W0803') >= 0);
assert('W0801 included', ids.indexOf('W0801') >= 0);
assert('W0804 excluded', ids.indexOf('W0804') < 0);

section('findWaitlistCandidate - no candidates');
addMockSheet('waitlist', WAITLIST_HEADERS, []);
var candidatesEmpty = findWaitlistCandidate('2026-06-15T10:00');
assertEqual('empty waitlist returns empty array', candidatesEmpty.length, 0);

section('resellVacancy');
_updateReservationCalls = [];
resellVacancy('R1000', 'W0500');
assertEqual('updateReservation called once', _updateReservationCalls.length, 1);
assertEqual('reservation id is R1000', _updateReservationCalls[0].id, 'R1000');
assertEqual('resale_notified is Y', _updateReservationCalls[0].updates.resale_notified, 'Y');

section('markResaleSuccessful');
_updateReservationCalls = [];
markResaleSuccessful('R2000');
assertEqual('updateReservation called once', _updateReservationCalls.length, 1);
assertEqual('reservation id is R2000', _updateReservationCalls[0].id, 'R2000');
assertEqual('resale_success is Y', _updateReservationCalls[0].updates.resale_success, 'Y');

// ─── Results ───
console.log('\n========================================');
console.log('WaitlistService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
