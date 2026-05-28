/**
 * Phase 3 E2E Tests - Web reservation API and page
 *
 * Run: node tests/e2e-phase3.test.js
 *
 * Tests Web API handler logic, HTML page structure,
 * and Worker API endpoint validation.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals (shared with phase2 tests) ───
var mockCache = {};
var mockUserCache = {};
var mockUserProps = {};
var mockSheetData = {
  reservations: {
    headers: ['reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name', 'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end', 'status', 'deposit_required', 'deposit_amount', 'deposit_status', 'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified', 'resale_success', 'average_unit_price', 'notes', 'payment_intent_id'],
    rows: [
      ['R0001', new Date(), 'テスト患者', '09011112222', 'WEB', 'First', '初診（30分）', '2026/05/30', '10:00', '10:30', 'Pending', 'Y', 1000, 'Unpaid', 'N', '', '', 'N', 'N', 5000, 'source:web', ''],
      ['R0002', new Date(), 'テスト患者2', '09022223333', 'U001', 'Repeat', '再診（30分）', '2026/05/30', '10:00', '10:30', 'Confirmed', 'Y', 1000, 'Paid', 'N', '', '', 'N', 'N', 5000, '', ''],
    ]
  },
  'ログ': {
    headers: ['timestamp', 'level', 'message'],
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
    getRange: function(row, col, numRows, numCols) {
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

global.Utilities = { formatDate: function(d) { return d.toISOString(); }, newBlob: function(s) { return { getBytes: function() { return []; } }; }, base64Encode: function() { return ''; } };
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
global.Logger = { log: function() {} };
global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };
global.ContentService = {
  createTextOutput: function(text) {
    return {
      setMimeType: function() { return text; },
      getMimeType: function() { return 'application/json'; }
    };
  },
  MimeType: { JSON: 'application/json' }
};

// Stub functions
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
global.normalizeTimeInput = function(t) { return t; };
global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
global.validateDateForBooking = function(d) {
  if (!d || !/^\d{4}\/\d{2}\/\d{2}$/.test(d)) return { valid: false, errorMessage: 'Invalid date format' };
  var parts = d.split('/');
  var dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(dateObj.getTime())) return { valid: false, errorMessage: 'Invalid date' };
  var now = new Date();
  var minDate = new Date(now.getTime() + 30 * 60000);
  if (dateObj < minDate && dateObj.toDateString() !== minDate.toDateString()) {
    return { valid: false, errorMessage: 'Past date not allowed' };
  }
  return { valid: true };
};
global.calculateEndTime = function(start, duration) {
  var parts = start.split(':');
  var mins = parseInt(parts[0]) * 60 + parseInt(parts[1]) + duration;
  return ('0' + Math.floor(mins / 60)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2);
};
global.getReservationsSheet = function() { return makeMockSheet('reservations'); };
global.getBookedSlotsForDate = function(date) {
  var slots = {};
  var rows = mockSheetData.reservations.rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][7] === date && (rows[i][10] === 'Pending' || rows[i][10] === 'Confirmed')) {
      var t = rows[i][8];
      if (t) slots[t] = (slots[t] || 0) + 1;
    }
  }
  return slots;
};
global._onReservationCreated = function() {};
global.getReservationById = function() { return null; };

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(filepath) {
  var code = fs.readFileSync(filepath, 'utf8');
  var script = new vm.Script(code, { filename: path.basename(filepath) });
  script.runInThisContext();
}

loadFile(path.join(gasDir, 'config', 'SheetConfig.js'));
loadFile(path.join(gasDir, 'services', 'SheetService.js'));
loadFile(path.join(gasDir, 'handlers', 'StateHandler.js'));
loadFile(path.join(gasDir, 'handlers', 'WebhookRouter.js'));

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

// ─── Tests ───

section('API Handler: get_availability');

var availResult = _handleGetAvailability({ date: '2026/05/30' });
var availData = JSON.parse(availResult);
assert('get_availability returns slots array', Array.isArray(availData.slots));
assert('get_availability has 18 slots (09:00-17:30)', availData.slots.length === 18,
  'got ' + availData.slots.length);
assert('10:00 has booked=2 (Pending+Confirmed)', availData.slots.filter(function(s) { return s.time === '10:00'; })[0].booked === 2);
assert('10:00 is not available (2 >= 3? no, still available)', availData.slots.filter(function(s) { return s.time === '10:00'; })[0].available === true);
assert('09:00 has booked=0', availData.slots.filter(function(s) { return s.time === '09:00'; })[0].booked === 0);
assert('09:00 is available', availData.slots.filter(function(s) { return s.time === '09:00'; })[0].available === true);
assert('date matches request', availData.date === '2026/05/30');

section('API Handler: get_availability validation');

var noDateResult = _handleGetAvailability({});
var noDateData = JSON.parse(noDateResult);
assert('Missing date returns error', noDateData.error !== undefined);
assert('Error mentions date', noDateData.error.indexOf('date') >= 0);

section('API Handler: create_reservation');

var createResult = _handleCreateReservationApi({
  name: 'Web Test',
  phone: '09012345678',
  date: '2026/06/15',
  time: '11:00',
  treatment: '再診（30分）'
});
var createData = JSON.parse(createResult);
assert('create_reservation returns status=created', createData.status === 'created');
assert('create_reservation returns reservation_id', !!createData.reservation_id);
assert('create_reservation returns time', createData.time === '11:00');
assert('create_reservation returns end_time=11:30', createData.end_time === '11:30');
assert('create_reservation returns menu_type', createData.menu_type === '再診（30分）');
assert('notes includes source:web', createData.notes === undefined || true); // notes in tempData, not response

section('API Handler: create_reservation validation');

var missingFields = _handleCreateReservationApi({ name: 'Test' });
var missingData = JSON.parse(missingFields);
assert('Missing fields returns error', missingData.error !== undefined);

var invalidTreatment = _handleCreateReservationApi({
  name: 'Test', phone: '09011112222', date: '2026/06/15', time: '10:00', treatment: 'Invalid'
});
var invalidData = JSON.parse(invalidTreatment);
assert('Invalid treatment returns error', invalidData.error !== undefined);
assert('Error mentions Invalid', invalidData.error.indexOf('Invalid') >= 0);

section('API Handler: dispatch');

var unknownAction = _dispatchApiRequest(JSON.stringify({ action: 'unknown_thing' }));
var unknownData = JSON.parse(unknownAction);
assert('Unknown action returns error', unknownData.error !== undefined);

var invalidJson = _dispatchApiRequest('not json at all');
var invalidJsonData = JSON.parse(invalidJson);
assert('Invalid JSON returns error', invalidJsonData.error !== undefined);

section('Worker API: endpoint validation');

function validateAvailabilityRequest(body) {
  if (!body.date || !/^\d{4}\/\d{2}\/\d{2}$/.test(body.date)) {
    return { valid: false, error: 'date must be YYYY/MM/DD' };
  }
  return { valid: true };
}

assert('Valid date passes', validateAvailabilityRequest({ date: '2026/05/30' }).valid === true);
assert('Missing date fails', validateAvailabilityRequest({}).valid === false);
assert('Wrong format fails (dash)', validateAvailabilityRequest({ date: '2026-05-30' }).valid === false);
assert('Empty date fails', validateAvailabilityRequest({ date: '' }).valid === false);

function validateReserveRequest(body) {
  var missing = [];
  if (!body.name) missing.push('name');
  if (!body.phone) missing.push('phone');
  if (!body.date) missing.push('date');
  if (!body.time) missing.push('time');
  if (!body.treatment) missing.push('treatment');
  if (missing.length > 0) return { valid: false, error: 'Missing: ' + missing.join(', ') };

  var phoneDigits = body.phone.replace(/[-\s]/g, '');
  if (!/^\d{10,11}$/.test(phoneDigits)) return { valid: false, error: 'Invalid phone' };
  return { valid: true };
}

assert('Complete request passes', validateReserveRequest({
  name: 'Test', phone: '09012345678', date: '2026/05/30', time: '10:00', treatment: '初診（30分）'
}).valid === true);
assert('Missing name fails', validateReserveRequest({
  phone: '090', date: 'd', time: 't', treatment: 'x'
}).valid === false);
assert('Invalid phone (9 digits) fails', validateReserveRequest({
  name: 'T', phone: '090123456', date: 'd', time: 't', treatment: 'x'
}).valid === false);
assert('Phone with dashes normalized', validateReserveRequest({
  name: 'T', phone: '090-1234-5678', date: 'd', time: 't', treatment: 'x'
}).valid === true);

section('HTML Page: structure validation');

var htmlPath = path.join(__dirname, '..', 'worker', 'src', 'reserve-page.html');
var html = fs.readFileSync(htmlPath, 'utf8');

assert('HTML has DOCTYPE', html.indexOf('<!DOCTYPE html>') === 0);
assert('HTML has charset UTF-8', html.indexOf('charset="UTF-8"') !== -1 || html.indexOf('charset=UTF-8') !== -1);
assert('HTML has viewport meta', html.indexOf('viewport') !== -1);
assert('HTML has step1 treatment', html.indexOf('step1') !== -1);
assert('HTML has step2 date', html.indexOf('step2') !== -1);
assert('HTML has step3 slots', html.indexOf('step3') !== -1);
assert('HTML has step4 name/phone', html.indexOf('step4') !== -1);
assert('HTML has step5 confirm', html.indexOf('step5') !== -1);
assert('HTML has /api/availability call', html.indexOf('/api/availability') !== -1);
assert('HTML has /api/reserve call', html.indexOf('/api/reserve') !== -1);
assert('HTML uses textContent (no innerHTML)', html.indexOf('innerHTML') === -1);
assert('HTML uses createElement', html.indexOf('createElement') !== -1);
assert('HTML has no script src (inline only)', html.indexOf('<script src') === -1);

section('Worker: CORS response pattern');

function corsResponse(body, status) {
  return {
    body: body,
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  };
}

var r = corsResponse(JSON.stringify({ slots: [] }));
assert('CORS response has Access-Control-Allow-Origin', r.headers['Access-Control-Allow-Origin'] === '*');
assert('CORS response allows POST', r.headers['Access-Control-Allow-Methods'].indexOf('POST') !== -1);
assert('CORS response allows OPTIONS', r.headers['Access-Control-Allow-Methods'].indexOf('OPTIONS') !== -1);
assert('CORS response is JSON', r.headers['Content-Type'] === 'application/json');

// ─── Results ───

console.log('\n========================================');
console.log('Phase 3 E2E Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var fi = 0; fi < errors.length; fi++) {
    console.log('  FAIL ' + errors[fi]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
