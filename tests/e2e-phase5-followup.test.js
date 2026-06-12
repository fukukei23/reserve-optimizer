/**
 * Phase 5-2 E2E Tests - 来院後自動フォローアップ
 *
 * Run: node tests/e2e-phase5-followup.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals ───
var mockCache = {};
var mockUserCache = {};
var mockUserProps = {};
var mockNow = null;

var mockSheetData = {
  reservations: {
    headers: ['reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name', 'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end', 'status', 'deposit_required', 'deposit_amount', 'deposit_status', 'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified', 'resale_success', 'average_unit_price', 'notes', 'payment_intent_id', 'follow_up_sent'],
    rows: []
  }
};

function makeMockSheet(name) {
  var sheet = mockSheetData[name];
  if (!sheet) return null;
  return {
    getDataRange: function() {
      return { getValues: function() { return [sheet.headers].concat(sheet.rows); } };
    },
    appendRow: function(row) { sheet.rows.push(row); },
    getLastRow: function() { return sheet.rows.length + 1; },
    getRange: function(row, col) {
      return {
        getValue: function() { return sheet.rows[row - 2] ? sheet.rows[row - 2][col - 1] : ''; },
        setValues: function(vals) {
          if (sheet.rows[row - 2]) {
            for (var i = 0; i < vals[0].length; i++) {
              sheet.rows[row - 2][col - 1 + i] = vals[0][i];
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
      getSheetByName: function(name) { return makeMockSheet(name); },
      insertSheet: function(name) {
        mockSheetData[name] = { headers: [], rows: [] };
        return makeMockSheet(name);
      }
    };
  }
};

global.CacheService = {
  getScriptCache: function() {
    return {
      get: function(key) { return mockCache[key] || null; },
      put: function(key, val, ttl) { mockCache[key] = val; },
      remove: function(key) { delete mockCache[key]; }
    };
  },
  getUserCache: function() {
    return {
      get: function(key) { return mockUserCache[key] || null; },
      put: function(key, val, ttl) { mockUserCache[key] = val; },
      remove: function(key) { delete mockUserCache[key]; }
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
      'FOLLOW_UP_HOURS_AFTER': '24'
    };
    return { getProperty: function(k) { return props[k] || null; }, setProperty: function() {} };
  },
  getUserProperties: function() {
    return {
      getProperty: function(k) { return mockUserProps[k] || null; },
      setProperty: function(k, v) { mockUserProps[k] = v; },
      deleteProperty: function(k) { delete mockUserProps[k]; },
      getProperties: function() { return Object.assign({}, mockUserProps); }
    };
  }
};

global.Utilities = {
  formatDate: function(d, tz, fmt) {
    if (fmt === 'yyyy/MM/dd') {
      return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
    }
    return d.toISOString();
  },
  newBlob: function(s) { return { getBytes: function() { return []; } }; },
  base64Encode: function() { return ''; },
  getUuid: function() { return 'test-uuid-' + Math.random(); }
};

var _lastPushText = null;
var _lastPushQuickReply = null;

global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };
global.ContentService = {
  createTextOutput: function(text) {
    return { setMimeType: function() { return text; } };
  },
  MimeType: { JSON: 'application/json' }
};
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
global.Logger = { log: function() {} };

// Stubs
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global.getLineAccessToken = function() { return 'mock'; };
global.getStripeApiKey = function() { return 'mock'; };
global.getStripeWebhookSecret = function() { return ''; };
global.getDepositAmount = function() { return 1000; };
global.getAverageUnitPrice = function() { return 5000; };
global.getCancellationDeadlineHours = function() { return 24; };
global.getMaxConcurrentBookings = function() { return 3; };
global.getMaxReservationsPerUser = function() { return 5; };
global.getBookingLeadTimeMinutes = function() { return 30; };
global.isFirebaseConfigured = function() { return false; };
global.getLineAdminUserId = function() { return 'admin'; };
global.getLineChannelSecret = function() { return 'mock-secret'; };
global.validateRequiredProperties = function() { return { valid: true, missing: [] }; };
global.getProperty = function(k) { return global.PropertiesService.getScriptProperties().getProperty(k); };
global.notifyReservationAdmin = function() {};
global.sendLinePush = function() {};
global.sendLineReply = function() {};
global.sendQuickReply = function() {};
global.normalizeTimeInput = function(t) { return t; };
global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
global.validateDateForBooking = function(d) { return { valid: true }; };
global.calculateEndTime = function(start, duration) {
  var parts = start.split(':');
  var mins = parseInt(parts[0]) * 60 + parseInt(parts[1]) + duration;
  return ('0' + Math.floor(mins / 60)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2);
};
global.getReservationsSheet = function() { return makeMockSheet('reservations'); };
global.getBookedSlotsForDate = function() { return {}; };
global._onReservationCreated = function() {};
global.getReservationById = function() { return null; };

// Follow-up stubs
global.getFollowUpHoursAfter = function() { return 24; };
global.isFeatureReviewRequestEnabled = function() { return false; };
global.sendLinePushQuickReply = function(userId, text, quickReplies) {
  _lastPushText = text;
  _lastPushQuickReply = quickReplies;
};
global.updateReservation = function(id, updates) {
  // Find and update the row in mockSheetData
  for (var i = 0; i < mockSheetData.reservations.rows.length; i++) {
    if (mockSheetData.reservations.rows[i][0] === id) {
      if (updates.follow_up_sent) {
        mockSheetData.reservations.rows[i][22] = updates.follow_up_sent;
      }
      break;
    }
  }
  _invalidateReservationCache();
};

// State stubs
var mockStates = {};
global.getUserState = function(userId) { return mockStates[userId] || { state: 'IDLE' }; };
global.setUserState = function(userId, state, data) { mockStates[userId] = { state: state, data: data }; };
global.clearUserState = function(userId) { delete mockStates[userId]; };
global.getUserLocale = function() { return 'ja'; };
global.USER_STATES = { IDLE: 'IDLE', AWAITING_NAME: 'AWAITING_NAME' };
global.logLineMessage = function() {};

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(filepath) {
  var code = fs.readFileSync(filepath, 'utf8');
  var script = new vm.Script(code, { filename: path.basename(filepath) });
  script.runInThisContext();
}

loadFile(path.join(gasDir, 'config', 'SheetConfig.js'));
loadFile(path.join(gasDir, 'i18n', 'Locales.js'));
loadFile(path.join(gasDir, 'i18n', 'I18n.js'));
loadFile(path.join(gasDir, 'templates', 'MessageTemplates.js'));
loadFile(path.join(gasDir, 'services', 'SheetService.js'));
loadFile(path.join(gasDir, 'services', 'FollowUpService.js'));

_invalidateReservationCache();

// ─── Test framework ───
var passed = 0;
var failed = 0;
var errors = [];

function assert(name, condition, detail) {
  if (condition) {
    passed++;
    console.log('  PASS ' + name);
  } else {
    failed++;
    errors.push(name + (detail ? ' -- ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? ' (' + detail + ')' : ''));
  }
}

function section(title) { console.log('\n== ' + title + ' =='); }

function addMockReservation(id, date, start, end, status, lineUser, followUpSent) {
  var row = [id, new Date(), 'テスト患者', '09011112222', (lineUser !== undefined ? lineUser : 'U001'), 'First', '初診（30分）', date, start, end, status, 'Y', 1000, 'Paid', 'N', '', '', 'N', 'N', 5000, '', '', followUpSent || 'N'];
  mockSheetData.reservations.rows.push(row);
  _invalidateReservationCache();
}

// ─── Tests ───

section('_parseDateTime: valid input');

var dt1 = _parseDateTime('2026/05/27', '10:30');
assert('Parses date+time correctly', dt1 !== null);
assert('Year matches', dt1.getFullYear() === 2026);
assert('Month matches', dt1.getMonth() === 4); // 0-indexed
assert('Day matches', dt1.getDate() === 27);
assert('Hour matches', dt1.getHours() === 10);
assert('Minute matches', dt1.getMinutes() === 30);

section('_parseDateTime: invalid input');

var dt2 = _parseDateTime('', '10:30');
assert('Empty date returns null', dt2 === null);
var dt3 = _parseDateTime('2026/05/27', '');
assert('Empty time returns null', dt3 === null);
var dt4 = _parseDateTime(null, null);
assert('Null inputs return null', dt4 === null);
var dt5 = _parseDateTime('invalid', '10:30');
assert('Invalid date returns null', dt5 === null);

section('Message template: ja');

var msgJa = MessageTemplates.getPostVisitFollowUpMessage('ja');
assert('JA template has ありがとうございました', msgJa.text.indexOf('ありがとうございました') >= 0);
assert('JA template has 予約する prompt', msgJa.text.indexOf('予約する') >= 0);
assert('JA template has 2 quickReplies', msgJa.quickReplies.length === 2);
assert('JA quickReply 0 is 予約する', msgJa.quickReplies[0].label === '予約する');
assert('JA quickReply 1 is お問い合わせ', msgJa.quickReplies[1].label === 'お問い合わせ');

section('Message template: en');

var msgEn = MessageTemplates.getPostVisitFollowUpMessage('en');
assert('EN template has Thank you', msgEn.text.indexOf('Thank you') >= 0);
assert('EN template has Book prompt', msgEn.text.indexOf('Book') >= 0);
assert('EN template has 2 quickReplies', msgEn.quickReplies.length === 2);
assert('EN quickReply 0 is Book', msgEn.quickReplies[0].label === 'Book');

section('sendPostVisitFollowUps: no reservations');

_lastPushText = null;
_lastPushQuickReply = null;
sendPostVisitFollowUps();
assert('No reservations: no push sent', _lastPushText === null);

section('sendPostVisitFollowUps: already sent (skipped)');

var yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
var yesterdayStr = yesterday.getFullYear() + '/' + ('0' + (yesterday.getMonth() + 1)).slice(-2) + '/' + ('0' + yesterday.getDate()).slice(-2);

addMockReservation('R0101', yesterdayStr, '10:00', '10:30', 'Visited', 'U001', 'Y');
_lastPushText = null;
sendPostVisitFollowUps();
assert('Already sent: no push', _lastPushText === null);

section('sendPostVisitFollowUps: wrong status (skipped)');

addMockReservation('R0102', yesterdayStr, '10:00', '10:30', 'Confirmed', 'U001', 'N');
_lastPushText = null;
sendPostVisitFollowUps();
assert('Confirmed status: no push', _lastPushText === null);

section('sendPostVisitFollowUps: timing window - too early');

// Add a reservation that ended 1 hour ago (24h follow-up means target is 23h in the future)
var recent = new Date();
recent.setMinutes(recent.getMinutes() - 60);
var recentStr = recent.getFullYear() + '/' + ('0' + (recent.getMonth() + 1)).slice(-2) + '/' + ('0' + recent.getDate()).slice(-2);
var recentStart = ('0' + (recent.getHours() - 1 >= 0 ? recent.getHours() - 1 : recent.getHours() + 23)).slice(-2) + ':00';
var recentEnd = ('0' + recent.getHours()).slice(-2) + ':' + ('0' + recent.getMinutes()).slice(-2);

addMockReservation('R0103', recentStr, recentStart, recentEnd, 'Visited', 'U002', 'N');
_lastPushText = null;
sendPostVisitFollowUps();
assert('Too early: no push', _lastPushText === null);

section('sendPostVisitFollowUps: correct timing window');

// Create a reservation that ended ~24 hours ago
var targetDate = new Date();
targetDate.setHours(targetDate.getHours() - 24);
var targetDateStr = targetDate.getFullYear() + '/' + ('0' + (targetDate.getMonth() + 1)).slice(-2) + '/' + ('0' + targetDate.getDate()).slice(-2);
// Make the end time be about 24h ago
var endHour = targetDate.getHours();
var endMin = targetDate.getMinutes();
var endTime = ('0' + endHour).slice(-2) + ':' + ('0' + endMin).slice(-2);
var startHour = endHour - 1 >= 0 ? endHour - 1 : endHour + 23;
var startTime = ('0' + startHour).slice(-2) + ':' + ('0' + endMin).slice(-2);

addMockReservation('R0104', targetDateStr, startTime, endTime, 'Visited', 'U003', 'N');
_lastPushText = null;
sendPostVisitFollowUps();
assert('Correct timing: push sent', _lastPushText !== null, 'got: ' + _lastPushText);
assert('Push text has follow-up message', _lastPushText.indexOf('ありがとうございました') >= 0);
assert('Push has quickReplies', _lastPushQuickReply !== null);
assert('Push has 2 quickReplies', _lastPushQuickReply.length === 2);

section('sendPostVisitFollowUps: no LINE user ID (skipped)');

addMockReservation('R0105', targetDateStr, startTime, endTime, 'Visited', '', 'N');
_lastPushText = null;
sendPostVisitFollowUps();
assert('No LINE user: no push', _lastPushText === null);

// ─── Results ───

console.log('\n========================================');
console.log('Phase 5-2 E2E Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var fi = 0; fi < errors.length; fi++) {
    console.log('  FAIL ' + errors[fi]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
