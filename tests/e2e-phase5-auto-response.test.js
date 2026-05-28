/**
 * Phase 5-1 E2E Tests - 施術中自動応答
 *
 * Run: node tests/e2e-phase5-auto-response.test.js
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
    headers: ['reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name', 'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end', 'status', 'deposit_required', 'deposit_amount', 'deposit_status', 'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified', 'resale_success', 'average_unit_price', 'notes', 'payment_intent_id'],
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
      'BOOKING_LEAD_TIME_MINUTES': '30', 'MAX_RESERVATIONS_PER_USER': '5'
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

// Override Utilities to control time
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

var _lastQuickReply = null;
var _lastReplyText = null;

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
global.sendLinePushQuickReply = function() {};
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
global.sendLineReply = function(token, text) { _lastReplyText = text; };
global.sendQuickReply = function(token, text, quickReplies) {
  _lastReplyText = text;
  _lastQuickReply = quickReplies;
};
global.sendLineReplyQuickReply = function(token, text, qr) {
  _lastReplyText = text;
  _lastQuickReply = qr;
};
global.sendLinePush = function() {};

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
loadFile(path.join(gasDir, 'services', 'TreatmentStatusService.js'));

// Clear cache to force fresh load
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

function addMockReservation(id, date, start, end, status) {
  var row = [id, new Date(), 'テスト患者', '09011112222', 'U001', 'First', '初診（30分）', date, start, end, status, 'Y', 1000, 'Paid', 'N', '', '', 'N', 'N', 5000, '', ''];
  mockSheetData.reservations.rows.push(row);
  _invalidateReservationCache();
}

// ─── Tests ───

section('isCurrentlyInTreatment: no reservations');

var result1 = isCurrentlyInTreatment();
assert('No reservations returns inTreatment=false', result1.inTreatment === false);

section('isCurrentlyInTreatment: past reservation');

var yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
var yesterdayStr = yesterday.getFullYear() + '/' + ('0' + (yesterday.getMonth() + 1)).slice(-2) + '/' + ('0' + yesterday.getDate()).slice(-2);

addMockReservation('R0001', yesterdayStr, '10:00', '10:30', 'Confirmed');
var result2 = isCurrentlyInTreatment();
assert('Past date returns inTreatment=false', result2.inTreatment === false);

section('isCurrentlyInTreatment: future time today');

var today = new Date();
var todayStr = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy/MM/dd');

// Add a reservation 2 hours from now
var futureHour = today.getHours() + 2;
var futureStart = ('0' + futureHour).slice(-2) + ':00';
var futureEnd = ('0' + futureHour).slice(-2) + ':30';

addMockReservation('R0002', todayStr, futureStart, futureEnd, 'Confirmed');
var result3 = isCurrentlyInTreatment();
assert('Future time today returns inTreatment=false', result3.inTreatment === false);

section('isCurrentlyInTreatment: currently active');

// Add a reservation that started 15 min ago and ends 15 min from now
var now2 = new Date();
var startMin = now2.getHours() * 60 + now2.getMinutes() - 15;
var endMin = now2.getHours() * 60 + now2.getMinutes() + 15;
if (startMin < 0) startMin = 0;
var startH = Math.floor(startMin / 60);
var startM2 = startMin % 60;
var endH = Math.floor(endMin / 60);
var endM = endMin % 60;
var activeStart = ('0' + startH).slice(-2) + ':' + ('0' + startM2).slice(-2);
var activeEnd = ('0' + endH).slice(-2) + ':' + ('0' + endM).slice(-2);

addMockReservation('R0003', todayStr, activeStart, activeEnd, 'Confirmed');
var result4 = isCurrentlyInTreatment();
assert('Currently active returns inTreatment=true', result4.inTreatment === true);
assert('Estimated end time matches', result4.estimatedEndTime === activeEnd, 'got: ' + result4.estimatedEndTime);

section('isCurrentlyInTreatment: cancelled status ignored');

addMockReservation('R0004', todayStr, activeStart, activeEnd, 'Cancelled');
var result5 = isCurrentlyInTreatment();
// Should still be true from R0003
assert('Cancelled reservation is ignored (still true from R0003)', result5.inTreatment === true);

section('Message template: ja');

var msgJa = MessageTemplates.getTreatmentAutoResponseMessage('10:30', 'ja');
assert('JA template has 施術中', msgJa.text.indexOf('施術中') >= 0);
assert('JA template has 終了予定', msgJa.text.indexOf('10:30') >= 0);
assert('JA template has 終わり次第', msgJa.text.indexOf('終わり次第') >= 0);
assert('JA template has 2 quickReplies', msgJa.quickReplies.length === 2);
assert('JA quickReply 0 is 予約する', msgJa.quickReplies[0].text === '予約する');

section('Message template: en');

var msgEn = MessageTemplates.getTreatmentAutoResponseMessage('10:30', 'en');
assert('EN template has in treatment', msgEn.text.indexOf('treatment') >= 0);
assert('EN template has 10:30', msgEn.text.indexOf('10:30') >= 0);
assert('EN template has contact you', msgEn.text.indexOf('contact you') >= 0);
assert('EN template has 2 quickReplies', msgEn.quickReplies.length === 2);
assert('EN quickReply 0 is Book', msgEn.quickReplies[0].text === 'Book');

section('sendTreatmentAutoResponse');

_lastQuickReply = null;
_lastReplyText = null;
sendTreatmentAutoResponse('mock-token', 'ja', '10:30');
assert('sendTreatmentAutoResponse sets reply text', _lastReplyText !== null);
assert('sendTreatmentAutoResponse sets quickReplies', _lastQuickReply !== null);
assert('sendTreatmentAutoResponse has 2 quickReplies', _lastQuickReply.length === 2);

// ─── Results ───

console.log('\n========================================');
console.log('Phase 5-1 E2E Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var fi = 0; fi < errors.length; fi++) {
    console.log('  FAIL ' + errors[fi]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
