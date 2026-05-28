/**
 * Unit Tests - ReservationHandler
 *
 * Run: node tests/unit-reservation-handler.test.js
 *
 * Uses vm.Script to share scope with loaded GAS source files.
 * All mocks are inline — no external dependencies.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockCache = {};
var _mockUserCache = {};
var _mockUserProps = {};
var _mockSheets = {};

// Trackers for verifying side effects
var _trackers = {
  sendQuickReply: [],
  sendLineReply: [],
  sendLinePush: [],
  sendLinePushQuickReply: [],
  setUserState: [],
  clearUserState: [],
  appendLogRow: [],
  notifyAdmin: [],
  createPaymentLink: [],
  updateReservation: [],
  deductSession: [],
  createCalendarEvent: [],
  appendAuditLog: [],
  sendFallbackWithContact: [],
  sendDatePrompt: [],
  sendTimePrompt: [],
  startReservationFlow: []
};

function resetMocks() {
  _mockCache = {};
  _mockUserCache = {};
  _mockUserProps = {};
  _mockSheets = {};
}

function resetTrackers() {
  for (var k in _trackers) {
    _trackers[k] = [];
  }
}

// ─── User state mock (in-memory) ───
var _userStates = {};

// ─── Configurable stub returns ───
var _stubReturns = {
  lastReservationByLineUserId: null,
  reservationsByLineUserId: [],
  reservationById: null,
  bookedSlotsForDate: {},
  maxConcurrentBookings: 2,
  maxReservationsPerUser: 3,
  bookingLeadTimeMinutes: 60,
  lineProfile: null,
  activeTicket: null,
  sessionCount: 0,
  paymentLink: null,
  staffByName: null,
  staffOptions: [{ label: '指名しない', text: '指名しない' }, { label: 'やめる', text: 'やめる' }],
  treatmentTimeOrdering: { valid: true, reason: '' },
  createReservationResult: { id: 'R0001', patient_name: 'Test', reserved_date: '2099-12-31', reserved_start: '10:00' },
  lockResult: null,
  userLocale: 'ja'
};

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
    getRange: function(row, col) {
      return {
        getValue: function() { return sheet.rows[row - 2] ? sheet.rows[row - 2][col - 1] : ''; },
        setValue: function(val) { if (sheet.rows[row - 2]) sheet.rows[row - 2][col - 1] = val; }
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
      'MAX_CONCURRENT_BOOKINGS': '2', 'DEPOSIT_AMOUNT_JPY': '1000',
      'BOOKING_LEAD_TIME_MINUTES': '60', 'MAX_RESERVATIONS_PER_USER': '3',
      'CANCELLATION_DEADLINE_HOURS': '24'
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
    if (!d || isNaN(d.getTime())) return '';
    if (fmt === 'yyyy-MM-dd') return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    if (fmt === 'yyyy/MM/dd') return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
    if (fmt === 'HH:mm') return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return d.toISOString();
  },
  getUuid: function() { return 'mock-uuid-' + Math.random().toString(36).substring(2, 10); }
};

global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };
global.ContentService = { createTextOutput: function(t) { return { setMimeType: function() { return t; } }; }, MimeType: { JSON: 'application/json' } };
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
global.Logger = { log: function() {} };

// ─── Config stubs ───
global.RESERVATION_STATUS = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', NO_SHOW: 'NoShow', VISITED: 'Visited' };
global.DEPOSIT_STATUS = { UNPAID: 'Unpaid', PAID: 'Paid', APPLIED: 'Applied', REFUNDED: 'Refunded', FORFEITED: 'Forfeited', PENDING: 'Pending' };
global.VISIT_TYPE = { FIRST: 'First', REPEAT: 'Repeat' };
global.SHEET_NAMES = { RESERVATIONS: 'reservations', WAITLIST: 'waitlist', WEEKLY_SUMMARY: 'weekly_summary', TICKETS: 'tickets', LOG: 'log' };
global.RESERVATIONS_HEADERS = [
  'reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name',
  'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end',
  'status', 'deposit_required', 'deposit_amount', 'deposit_status',
  'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified',
  'resale_success', 'average_unit_price', 'notes', 'payment_intent_id',
  'follow_up_sent', 'used_ticket'
];
global.RESERVATIONS_COLUMNS = {
  RESERVATION_ID: 1, CREATED_AT: 2, PATIENT_NAME: 3, PHONE: 4, LINE_DISPLAY_NAME: 5,
  VISIT_TYPE: 6, MENU_TYPE: 7, RESERVED_DATE: 8, RESERVED_START: 9, RESERVED_END: 10,
  STATUS: 11, DEPOSIT_REQUIRED: 12, DEPOSIT_AMOUNT: 13, DEPOSIT_STATUS: 14,
  REMINDER_SENT: 15, REMINDER_RESPONSE: 16, CANCEL_TIME: 17, RESALE_NOTIFIED: 18,
  RESALE_SUCCESS: 19, AVERAGE_UNIT_PRICE: 20, NOTES: 21, PAYMENT_INTENT_ID: 22,
  FOLLOW_UP_SENT: 23, USED_TICKET: 24
};

global.TREATMENT_DURATIONS = {
  '初診（30分）': 30,
  '再診（30分）': 30,
  '再診（60分）': 60
};
global.DEFAULT_TREATMENT_DURATION = 30;
global.MAX_PAYMENT_RETRIES = 5;
global.MAX_BOOKING_DAYS_AHEAD = 90;
global.CLOSED_DAYS = [0]; // Sunday
global.TIMEZONE = 'Asia/Tokyo';
global.FALLBACK_RETRY_TEXT = 'もう一度入力する';

// ─── Stub functions ───
global.appendLogRow = function(level, msg) { _trackers.appendLogRow.push({ level: level, msg: msg }); };
global.notifyAdmin = function() { _trackers.notifyAdmin.push(arguments); };
global.getSpreadsheetId = function() { return 'mock'; };
global.isFirebaseConfigured = function() { return false; };
global.getDepositAmount = function() { return 1000; };
global.getAverageUnitPrice = function() { return 5000; };
global.getLineAccessToken = function() { return 'mock'; };
global.getStripeApiKey = function() { return 'mock'; };

global.sendLinePush = function() { _trackers.sendLinePush.push(Array.prototype.slice.call(arguments)); };
global.sendLineReply = function(token, msg) { _trackers.sendLineReply.push({ token: token, msg: msg }); };
global.sendQuickReply = function(token, msg, opts) { _trackers.sendQuickReply.push({ token: token, msg: msg, opts: opts }); };
global.sendLinePushQuickReply = function(userId, msg, opts) { _trackers.sendLinePushQuickReply.push({ userId: userId, msg: msg, opts: opts }); };
global.logLineMessage = function() {};

global.setUserState = function(userId, state, context) {
  _userStates[userId] = { state: state, context: context };
  _trackers.setUserState.push({ userId: userId, state: state, context: context });
};
global.getUserState = function(userId) {
  return _userStates[userId] || { state: 'IDLE', context: {} };
};
global.clearUserState = function(userId) {
  delete _userStates[userId];
  _trackers.clearUserState.push(userId);
};

global.getBookedSlotsForDate = function(date) { return _stubReturns.bookedSlotsForDate; };
global.getMaxConcurrentBookings = function() { return _stubReturns.maxConcurrentBookings; };
global.getMaxReservationsPerUser = function() { return _stubReturns.maxReservationsPerUser; };
global.getBookingLeadTimeMinutes = function() { return _stubReturns.bookingLeadTimeMinutes; };
global.getProperty = function(key, def) { return def || null; };

global.normalizeTimeInput = function(t) { return t; };
global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
global.normalizePhoneInput = function(p) {
  if (!p || typeof p !== 'string') return '';
  return p.trim().replace(/[-\s()]/g, '');
};
global.validatePhoneNumber = function(p) {
  if (!p || typeof p !== 'string') return false;
  var cleaned = p.replace(/[-\s]/g, '');
  return /^0\d{9,10}$/.test(cleaned);
};
global.calculateEndTime = function(start, dur) {
  var p = start.split(':');
  var m = parseInt(p[0]) * 60 + parseInt(p[1]) + dur;
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
};
global.getTreatmentDuration = function(menuType) { return global.TREATMENT_DURATIONS[menuType] || 30; };

global.validateDateForBooking = function() { return { valid: true, errorMessage: null }; };
global.isPastDateTime = function(dateStr, timeStr, leadMin) { return false; };

global.parseDateInput = function(text) {
  // Simple parse: accept YYYY-MM-DD or YYYY/MM/DD
  var m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  return null;
};

global.sendFallbackWithContact = function(token, msg) {
  _trackers.sendFallbackWithContact.push({ token: token, msg: msg });
};

global.sendDatePromptWithQuickReply = function(token, userId, pageDate) {
  _trackers.sendDatePrompt.push({ token: token, userId: userId, pageDate: pageDate });
};

global.sendTimePromptWithQuickReply = function(token, date) {
  _trackers.sendTimePrompt.push({ token: token, date: date });
};

global.validateTreatmentTimeOrdering = function() { return _stubReturns.treatmentTimeOrdering; };

global.getLastReservationByLineUserId = function() { return _stubReturns.lastReservationByLineUserId; };
global.getReservationsByLineUserId = function() { return _stubReturns.reservationsByLineUserId; };
global.getReservationById = function(id) {
  if (_stubReturns.reservationById) return _stubReturns.reservationById;
  return null;
};

global.getLineProfile = function() { return _stubReturns.lineProfile; };
global.createPaymentLink = function(resId, name, amount) {
  _trackers.createPaymentLink.push({ resId: resId, name: name, amount: amount });
  return _stubReturns.paymentLink;
};

global.getUserLocale = function() { return _stubReturns.userLocale; };

global.updateReservation = function(id, data) {
  _trackers.updateReservation.push({ id: id, data: data });
};

global.getActiveTicketByUser = function() { return _stubReturns.activeTicket; };
global.deductSession = function(ticketId) {
  _trackers.deductSession.push(ticketId);
};
global.getSessionCountForUser = function() { return _stubReturns.sessionCount; };

global.createCalendarEvent = function(res) {
  _trackers.createCalendarEvent.push(res);
};
global.appendAuditLog = function() {
  _trackers.appendAuditLog.push(Array.prototype.slice.call(arguments));
};

global.getStaffByName = function() { return _stubReturns.staffByName; };
global.buildStaffSelectionOptions = function() { return _stubReturns.staffOptions; };

global.createReservation = function(data) { return _stubReturns.createReservationResult; };

global._invalidateReservationCache = function() {};
global._getCachedSpreadsheet = function() {
  return global.SpreadsheetApp.openById();
};

global.MessageTemplates = {
  getDepositRequestMessage: function(resId, date, time, menu, link, locale) {
    return 'Deposit request for ' + resId + ' ' + date + ' ' + time + ' ' + link;
  }
};

global.startReservationFlow = function(token, userId) {
  _trackers.startReservationFlow.push({ token: token, userId: userId });
};

// USER_STATES must be defined before loading the file
global.USER_STATES = {
  IDLE: 'IDLE',
  AWAITING_NAME: 'AWAITING_NAME',
  AWAITING_PHONE: 'AWAITING_PHONE',
  AWAITING_DATE: 'AWAITING_DATE',
  AWAITING_TIME: 'AWAITING_TIME',
  AWAITING_TREATMENT: 'AWAITING_TREATMENT',
  AWAITING_STAFF: 'AWAITING_STAFF',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT'
};

// ─── Load source ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var code = fs.readFileSync(path.join(gasDir, relPath), 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) }).runInThisContext();
}

loadFile('handlers/ReservationHandler.js');

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

// ─── Helpers ───
function setupUserState(userId, state, context) {
  _userStates[userId] = { state: state, context: context || {} };
}

// ─── Tests ───

// ========================================
section('_buildTreatmentMenuOptions');
// ========================================

(function() {
  resetMocks(); resetTrackers();

  var options = _buildTreatmentMenuOptions(false); // 初診
  assert('returns array', Array.isArray(options));
  assert('初診 options includes 初診（30分）', options.some(function(o) { return o.text === '初診（30分）'; }));
  assert('初診 options includes やめる', options.some(function(o) { return o.text === 'やめる'; }));
  assert('初診 options excludes 再診', !options.some(function(o) { return o.text.indexOf('再診') === 0; }));

  var options2 = _buildTreatmentMenuOptions(true); // 再診
  assert('再診 options includes 再診（30分）', options2.some(function(o) { return o.text === '再診（30分）'; }));
  assert('再診 options includes 再診（60分）', options2.some(function(o) { return o.text === '再診（60分）'; }));
  assert('再診 options excludes 初診', !options2.some(function(o) { return o.text.indexOf('初診') === 0; }));
})();

// ========================================
section('_getValidTreatmentOptions');
// ========================================

(function() {
  resetMocks(); resetTrackers();

  var opts = _getValidTreatmentOptions(false);
  assert('初診 returns array of strings', opts.every(function(o) { return typeof o === 'string'; }));
  assertEqual('初診 has 1 option', opts.length, 1);
  assertEqual('初診 option is 初診（30分）', opts[0], '初診（30分）');

  var opts2 = _getValidTreatmentOptions(true);
  assertEqual('再診 has 2 options', opts2.length, 2);
  assert('再診 includes 再診（30分）', opts2.indexOf('再診（30分）') >= 0);
  assert('再診 includes 再診（60分）', opts2.indexOf('再診（60分）') >= 0);
})();

// ========================================
section('startReservationFlow');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // New user (no last reservation)
  _stubReturns.lastReservationByLineUserId = null;
  startReservationFlow('token1', 'user1');

  assertEqual('setUserState called 1 time', _trackers.setUserState.length, 1);
  assertEqual('state is AWAITING_TREATMENT', _trackers.setUserState[0].state, 'AWAITING_TREATMENT');
  assertEqual('is_returning false', _trackers.setUserState[0].context.is_returning, false);
  assert('sendQuickReply called', _trackers.sendQuickReply.length === 1);
  assertIncludes('sendQuickReply step 1 message', _trackers.sendQuickReply[0].msg, 'Step 1');

  // Returning user
  resetTrackers();
  _stubReturns.lastReservationByLineUserId = { patient_name: 'Test User', phone: '09012345678' };
  startReservationFlow('token2', 'user2');

  assertEqual('returning user state', _trackers.setUserState[0].state, 'AWAITING_TREATMENT');
  assertEqual('returning user is_returning', _trackers.setUserState[0].context.is_returning, true);
  assertEqual('returning user has name', _trackers.setUserState[0].context.patient_name, 'Test User');
  assertEqual('returning user has phone', _trackers.setUserState[0].context.phone, '09012345678');
})();

// ========================================
section('handleAwaitingName');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // Normal name input
  setupUserState('user1', 'AWAITING_NAME', { total_steps: 4 });
  handleAwaitingName('山田太郎', 'token1', 'user1');

  assertEqual('state changed to AWAITING_PHONE', _trackers.setUserState[0].state, 'AWAITING_PHONE');
  assertEqual('patient_name stored', _trackers.setUserState[0].context.patient_name, '山田太郎');
  assertIncludes('confirmation message', _trackers.sendQuickReply[0].msg, '確認');
  assertIncludes('step indicator', _trackers.sendQuickReply[0].msg, 'Step 4/4');

  // FALLBACK_RETRY_TEXT
  resetTrackers();
  setupUserState('user2', 'AWAITING_NAME', { total_steps: 4 });
  handleAwaitingName(FALLBACK_RETRY_TEXT, 'token2', 'user2');

  assertEqual('retry: no state change', _trackers.setUserState.length, 0);
  assertIncludes('retry: asks name again', _trackers.sendQuickReply[0].msg, 'お名前');

  // Empty input
  resetTrackers();
  setupUserState('user3', 'AWAITING_NAME', { total_steps: 4 });
  handleAwaitingName('   ', 'token3', 'user3');

  assertEqual('empty: no state change', _trackers.setUserState.length, 0);
  assertIncludes('empty: asks name again', _trackers.sendQuickReply[0].msg, '100文字以内');

  // Too long input (101 chars)
  resetTrackers();
  setupUserState('user4', 'AWAITING_NAME', { total_steps: 4 });
  var longName = '';
  for (var i = 0; i < 101; i++) longName += 'a';
  handleAwaitingName(longName, 'token4', 'user4');

  assertEqual('too long: no state change', _trackers.setUserState.length, 0);
  assertIncludes('too long: error message', _trackers.sendQuickReply[0].msg, '100文字以内');

  // Trimmed name
  resetTrackers();
  setupUserState('user5', 'AWAITING_NAME', { total_steps: 4 });
  handleAwaitingName('  田中  ', 'token5', 'user5');

  assertEqual('trimmed name stored', _trackers.setUserState[0].context.patient_name, '田中');
})();

// ========================================
section('handleAwaitingPhone');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // Valid phone - should call createReservationAndGoToPayment
  setupUserState('user1', 'AWAITING_PHONE', { total_steps: 4, patient_name: 'Test' });
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.paymentLink = 'https://pay.example.com/123';
  _stubReturns.lockResult = null;
  _stubReturns.activeTicket = null;

  handleAwaitingPhone('09012345678', 'token1', 'user1');

  // createReservationAndGoToPayment should be called
  assert('valid phone triggers sendLineReply (processing)', _trackers.sendLineReply.length >= 1);
  assertIncludes('processing message', _trackers.sendLineReply[0].msg, '予約を作成中');

  // FALLBACK_RETRY_TEXT
  resetTrackers();
  setupUserState('user2', 'AWAITING_PHONE', { total_steps: 4 });
  handleAwaitingPhone(FALLBACK_RETRY_TEXT, 'token2', 'user2');

  assertIncludes('retry: asks phone again', _trackers.sendQuickReply[0].msg, '電話番号');

  // Invalid phone format
  resetTrackers();
  setupUserState('user3', 'AWAITING_PHONE', { total_steps: 4 });
  handleAwaitingPhone('abc', 'token3', 'user3');

  assertIncludes('invalid phone: error message', _trackers.sendQuickReply[0].msg, '電話番号の形式');
})();

// ========================================
section('handleAwaitingDate');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // PAGE_NEXT navigation
  handleAwaitingDate('PAGE_NEXT:2099-06-01', 'token1', 'user1');
  assertEqual('PAGE_NEXT calls sendDatePrompt', _trackers.sendDatePrompt.length, 1);
  assertEqual('PAGE_NEXT passes navDate', _trackers.sendDatePrompt[0].pageDate, '2099-06-01');

  // PAGE_PREV navigation
  resetTrackers();
  handleAwaitingDate('PAGE_PREV:2099-05-01', 'token2', 'user2');
  assertEqual('PAGE_PREV calls sendDatePrompt', _trackers.sendDatePrompt.length, 1);

  // 日付入力
  resetTrackers();
  handleAwaitingDate('日付入力', 'token3', 'user3');
  assertIncludes('free text prompt', _trackers.sendQuickReply[0].msg, '日付を入力');

  // FALLBACK_RETRY_TEXT
  resetTrackers();
  handleAwaitingDate(FALLBACK_RETRY_TEXT, 'token4', 'user4');
  assertEqual('retry calls sendDatePrompt', _trackers.sendDatePrompt.length, 1);

  // 別の日
  resetTrackers();
  handleAwaitingDate('別の日', 'token5', 'user5');
  assertEqual('別の日 calls sendDatePrompt', _trackers.sendDatePrompt.length, 1);

  // Valid date input
  resetTrackers();
  setupUserState('user6', 'AWAITING_DATE', {});
  _stubReturns.bookedSlotsForDate = {};
  handleAwaitingDate('2099-12-31', 'token6', 'user6');

  assertEqual('valid date sets AWAITING_TIME', _trackers.setUserState[0].state, 'AWAITING_TIME');
  assertEqual('reserved_date stored', _trackers.setUserState[0].context.reserved_date, '2099-12-31');
  assertEqual('sendTimePrompt called', _trackers.sendTimePrompt.length, 1);

  // Invalid date format
  resetTrackers();
  setupUserState('user7', 'AWAITING_DATE', {});
  handleAwaitingDate('invalid-date', 'token7', 'user7');
  assertEqual('invalid date calls sendFallbackWithContact', _trackers.sendFallbackWithContact.length, 1);
  assertIncludes('invalid date message', _trackers.sendFallbackWithContact[0].msg, '日付の形式');

  // Date fails validation (e.g. past)
  resetTrackers();
  setupUserState('user8', 'AWAITING_DATE', {});
  var origValidate = global.validateDateForBooking;
  global.validateDateForBooking = function() { return { valid: false, errorMessage: '過去の日付は選択できません。' }; };
  handleAwaitingDate('2020-01-01', 'token8', 'user8');
  global.validateDateForBooking = origValidate;

  assertEqual('failed validation calls sendFallbackWithContact', _trackers.sendFallbackWithContact.length, 1);
  assertIncludes('past date message', _trackers.sendFallbackWithContact[0].msg, '過去の日付');
})();

// ========================================
section('handleAwaitingTime');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // 別の時間 retry
  setupUserState('user1', 'AWAITING_TIME', { reserved_date: '2099-12-31' });
  handleAwaitingTime('別の時間', 'token1', 'user1');
  assertEqual('retry calls sendTimePrompt', _trackers.sendTimePrompt.length, 1);

  // 別の日 goes back to date
  resetTrackers();
  setupUserState('user2', 'AWAITING_TIME', { reserved_date: '2099-12-31' });
  handleAwaitingTime('別の日', 'token2', 'user2');
  assertEqual('別の日 sets AWAITING_DATE', _trackers.setUserState[0].state, 'AWAITING_DATE');
  assertEqual('別の日 calls sendDatePrompt', _trackers.sendDatePrompt.length, 1);

  // Invalid time format
  resetTrackers();
  setupUserState('user3', 'AWAITING_TIME', { reserved_date: '2099-12-31', menu_type: '初診（30分）' });
  handleAwaitingTime('abc', 'token3', 'user3');
  assertEqual('invalid time calls sendFallbackWithContact', _trackers.sendFallbackWithContact.length, 1);
  assertIncludes('invalid time message', _trackers.sendFallbackWithContact[0].msg, '時間の形式');

  // Valid time - past check fails
  resetTrackers();
  setupUserState('user4', 'AWAITING_TIME', { reserved_date: '2099-12-31', menu_type: '初診（30分）' });
  var origIsPast = global.isPastDateTime;
  global.isPastDateTime = function() { return true; };
  _stubReturns.bookingLeadTimeMinutes = 60;
  _stubReturns.bookedSlotsForDate = {};
  _stubReturns.maxConcurrentBookings = 2;
  _stubReturns.treatmentTimeOrdering = { valid: true, reason: '' };

  handleAwaitingTime('10:00', 'token4', 'user4');
  global.isPastDateTime = origIsPast;

  assertEqual('past time calls sendFallbackWithContact', _trackers.sendFallbackWithContact.length, 1);
  assertIncludes('past time message', _trackers.sendFallbackWithContact[0].msg, '予約できません');

  // Valid time - slot fully booked
  resetTrackers();
  setupUserState('user5', 'AWAITING_TIME', { reserved_date: '2099-12-31', menu_type: '初診（30分）' });
  global.isPastDateTime = function() { return false; };
  _stubReturns.bookedSlotsForDate = { '10:00': 2 };
  _stubReturns.maxConcurrentBookings = 2;

  handleAwaitingTime('10:00', 'token5', 'user5');
  assert('slot full: sendQuickReply called', _trackers.sendQuickReply.length === 1);
  assertIncludes('slot full message', _trackers.sendQuickReply[0].msg, '埋まって');

  // Valid time - treatment ordering fails
  resetTrackers();
  setupUserState('user6', 'AWAITING_TIME', { reserved_date: '2099-12-31', menu_type: '初診（30分）' });
  _stubReturns.bookedSlotsForDate = {};
  _stubReturns.treatmentTimeOrdering = { valid: false, reason: '初診は再診の前に予約してください' };

  handleAwaitingTime('10:00', 'token6', 'user6');
  assertIncludes('ordering fail message', _trackers.sendQuickReply[0].msg, '初診は再診の前に');

  // Valid time - returning user goes to createReservationAndGoToPayment
  resetTrackers();
  setupUserState('user7', 'AWAITING_TIME', {
    reserved_date: '2099-12-31', menu_type: '再診（30分）',
    is_returning: true, patient_name: 'Test', phone: '09012345678'
  });
  _stubReturns.treatmentTimeOrdering = { valid: true, reason: '' };
  _stubReturns.bookedSlotsForDate = {};
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.paymentLink = 'https://pay.example.com';
  _stubReturns.activeTicket = null;

  handleAwaitingTime('10:00', 'token7', 'user7');
  assert('returning user: sendLineReply (processing) called', _trackers.sendLineReply.length >= 1);

  // Valid time - new user goes to AWAITING_NAME
  resetTrackers();
  setupUserState('user8', 'AWAITING_TIME', {
    reserved_date: '2099-12-31', menu_type: '初診（30分）'
  });
  _stubReturns.bookedSlotsForDate = {};
  handleAwaitingTime('10:00', 'token8', 'user8');

  assertEqual('new user sets AWAITING_NAME', _trackers.setUserState[0].state, 'AWAITING_NAME');
  assertIncludes('new user step message', _trackers.sendQuickReply[0].msg, 'Step 3/4');
})();

// ========================================
section('handleAwaitingTreatment');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // Invalid treatment option
  setupUserState('user1', 'AWAITING_TREATMENT', { is_returning: false, total_steps: 4 });
  _stubReturns.staffOptions = [{ label: '指名しない', text: '指名しない' }, { label: 'やめる', text: 'やめる' }];

  handleAwaitingTreatment('Invalid Option', 'token1', 'user1');
  assertEqual('invalid treatment: no state change', _trackers.setUserState.length, 0);
  assertIncludes('invalid treatment: asks again', _trackers.sendQuickReply[0].msg, '施術の種類');

  // Valid treatment - with staff options (staffOptions.length > 2)
  resetTrackers();
  setupUserState('user2', 'AWAITING_TREATMENT', { is_returning: false, total_steps: 4 });
  _stubReturns.staffOptions = [
    { label: 'スタッフA', text: 'スタッフA' },
    { label: '指名しない', text: '指名しない' },
    { label: 'やめる', text: 'やめる' }
  ];

  handleAwaitingTreatment('初診（30分）', 'token2', 'user2');
  assertEqual('valid 初診 sets AWAITING_STAFF', _trackers.setUserState[0].state, 'AWAITING_STAFF');
  assertEqual('menu_type stored', _trackers.setUserState[0].context.menu_type, '初診（30分）');
  assertEqual('visit_type is First', _trackers.setUserState[0].context.visit_type, 'First');
  assertIncludes('staff selection message', _trackers.sendQuickReply[0].msg, 'スタッフ');

  // Valid treatment - no staff data (skip to date)
  resetTrackers();
  setupUserState('user3', 'AWAITING_TREATMENT', { is_returning: false, total_steps: 4 });
  _stubReturns.staffOptions = [{ label: '指名しない', text: '指名しない' }, { label: 'やめる', text: 'やめる' }];

  handleAwaitingTreatment('初診（30分）', 'token3', 'user3');
  assertEqual('no staff: sets AWAITING_DATE', _trackers.setUserState[0].state, 'AWAITING_DATE');
  assertEqual('no staff: calls sendDatePrompt', _trackers.sendDatePrompt.length, 1);

  // 再診 visit_type
  resetTrackers();
  setupUserState('user4', 'AWAITING_TREATMENT', { is_returning: true, total_steps: 3 });
  _stubReturns.staffOptions = [{ label: '指名しない', text: '指名しない' }, { label: 'やめる', text: 'やめる' }];

  handleAwaitingTreatment('再診（30分）', 'token4', 'user4');
  assertEqual('再診 visit_type is Repeat', _trackers.setUserState[0].context.visit_type, 'Repeat');
})();

// ========================================
section('handleAwaitingStaff');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // やめる cancels flow
  setupUserState('user1', 'AWAITING_STAFF', { menu_type: '初診（30分）' });
  handleAwaitingStaff('やめる', 'token1', 'user1');

  assertEqual('やめる clears state', _trackers.clearUserState.length, 1);
  assertIncludes('cancel message', _trackers.sendLineReply[0].msg, 'キャンセル');

  // 指名しない skips to date
  resetTrackers();
  setupUserState('user2', 'AWAITING_STAFF', { menu_type: '初診（30分）' });
  handleAwaitingStaff('指名しない', 'token2', 'user2');

  assertEqual('指名しない sets AWAITING_DATE', _trackers.setUserState[0].state, 'AWAITING_DATE');
  assertEqual('指名しない calls sendDatePrompt', _trackers.sendDatePrompt.length, 1);

  // Invalid staff name
  resetTrackers();
  setupUserState('user3', 'AWAITING_STAFF', { menu_type: '初診（30分）' });
  _stubReturns.staffByName = null;
  _stubReturns.staffOptions = [
    { label: 'スタッフA', text: 'スタッフA' },
    { label: '指名しない', text: '指名しない' },
    { label: 'やめる', text: 'やめる' }
  ];

  handleAwaitingStaff('存在しないスタッフ', 'token3', 'user3');
  assertIncludes('invalid staff message', _trackers.sendQuickReply[0].msg, '見つかりません');

  // Valid staff name
  resetTrackers();
  setupUserState('user4', 'AWAITING_STAFF', { menu_type: '初診（30分）' });
  _stubReturns.staffByName = { staff_id: 'S001', name: 'スタッフA' };

  handleAwaitingStaff('スタッフA', 'token4', 'user4');
  assertEqual('valid staff sets AWAITING_DATE', _trackers.setUserState[0].state, 'AWAITING_DATE');
  assertEqual('staff_id stored', _trackers.setUserState[0].context.staff_id, 'S001');
  assertEqual('staff_name stored', _trackers.setUserState[0].context.staff_name, 'スタッフA');
})();

// ========================================
section('handleAwaitingPayment');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // キャンセル cancels payment
  setupUserState('user1', 'AWAITING_PAYMENT', { reservation_id: 'R001' });
  handleAwaitingPayment('キャンセル', 'token1', 'user1');

  assertEqual('cancel clears state', _trackers.clearUserState.length, 1);
  assertIncludes('cancel message', _trackers.sendLineReply[0].msg, 'キャンセル');

  // やめる
  resetTrackers();
  setupUserState('user2', 'AWAITING_PAYMENT', { reservation_id: 'R002' });
  handleAwaitingPayment('やめる', 'token2', 'user2');
  assertEqual('やめる clears state', _trackers.clearUserState.length, 1);

  // 予約する restarts flow
  resetTrackers();
  setupUserState('user3', 'AWAITING_PAYMENT', { reservation_id: 'R003' });
  handleAwaitingPayment('予約する', 'token3', 'user3');
  assertEqual('restart clears state', _trackers.clearUserState.length, 1);
  // startReservationFlow is called (from loaded source, not the tracker wrapper)
  // Verify via clearUserState being called before restart
  assert('restart: state was cleared before restart', _trackers.clearUserState[0] === 'user3');

  // Deposit PAID
  resetTrackers();
  setupUserState('user4', 'AWAITING_PAYMENT', { reservation_id: 'R004', payment_link: 'https://pay.com' });
  _stubReturns.reservationById = { deposit_status: 'Paid' };
  handleAwaitingPayment('支払完了', 'token4', 'user4');

  assertIncludes('paid message', _trackers.sendLineReply[0].msg, '確認');
  assertEqual('paid clears state', _trackers.clearUserState.length, 1);

  // Deposit not paid but has stored link
  resetTrackers();
  setupUserState('user5', 'AWAITING_PAYMENT', { reservation_id: 'R005', payment_link: 'https://pay.com/123' });
  _stubReturns.reservationById = { deposit_status: 'Unpaid' };
  handleAwaitingPayment('支払完了', 'token5', 'user5');

  assertIncludes('unpaid with link message', _trackers.sendQuickReply[0].msg, 'まだ完了');
  assertIncludes('shows stored link', _trackers.sendQuickReply[0].msg, 'https://pay.com/123');

  // No payment link stored
  resetTrackers();
  setupUserState('user6', 'AWAITING_PAYMENT', { reservation_id: 'R006', payment_link: null });
  _stubReturns.reservationById = { deposit_status: 'Unpaid' };
  handleAwaitingPayment('支払完了', 'token6', 'user6');

  assertIncludes('no link message', _trackers.sendQuickReply[0].msg, '届いていない');

  // Retry with no link - success
  resetTrackers();
  setupUserState('user7', 'AWAITING_PAYMENT', { reservation_id: 'R007', payment_link: null, retry_count: 0 });
  _stubReturns.reservationById = { patient_name: 'Test', deposit_status: 'Unpaid' };
  _stubReturns.paymentLink = 'https://pay.com/retry';

  handleAwaitingPayment('再試行', 'token7', 'user7');
  assertIncludes('retry success message', _trackers.sendQuickReply[0].msg, '再作成');
  assertIncludes('retry shows new link', _trackers.sendQuickReply[0].msg, 'https://pay.com/retry');

  // Retry with no link - failure
  resetTrackers();
  setupUserState('user8', 'AWAITING_PAYMENT', { reservation_id: 'R008', payment_link: null, retry_count: 0 });
  _stubReturns.reservationById = { patient_name: 'Test', deposit_status: 'Unpaid' };
  _stubReturns.paymentLink = null;

  handleAwaitingPayment('再試行', 'token8', 'user8');
  assertIncludes('retry fail message', _trackers.sendQuickReply[0].msg, '失敗');

  // Retry max exceeded
  resetTrackers();
  setupUserState('user9', 'AWAITING_PAYMENT', { reservation_id: 'R009', payment_link: null, retry_count: 5 });
  _stubReturns.reservationById = { patient_name: 'Test' };

  handleAwaitingPayment('再試行', 'token9', 'user9');
  assertIncludes('max retry message', _trackers.sendQuickReply[0].msg, '上限');
})();

// ========================================
section('createReservationAndGoToPayment - max reservations');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // Max reservations reached
  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }];

  createReservationAndGoToPayment('token1', 'user1', {});

  assert('max reached: clearUserState called', _trackers.clearUserState.length === 1);
  assertIncludes('max reached message', _trackers.sendQuickReply[0].msg, '3件あるため');
})();

// ========================================
section('createReservationAndGoToPayment - duplicate check');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // Duplicate reservation on same date/time
  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [
    { reserved_date: '2099-12-31', reserved_start: '10:00', reserved_end: '10:30' }
  ];
  _stubReturns.lineProfile = null;

  createReservationAndGoToPayment('token1', 'user1', {
    reserved_date: '2099-12-31',
    reserved_start: '10:00'
  });

  assertIncludes('duplicate message', _trackers.sendLinePushQuickReply[0].msg, '既に予約');
})();

// ========================================
section('createReservationAndGoToPayment - success with payment link');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.lineProfile = null;
  _stubReturns.activeTicket = null;
  _stubReturns.paymentLink = 'https://pay.example.com/abc';
  _stubReturns.lockResult = { ok: true, reservation: { id: 'R0099', reserved_date: '2099-12-31', reserved_start: '10:00' } };
  _stubReturns.createReservationResult = { id: 'R0099' };

  // Override _createReservationWithLock temporarily
  var origLock = global._createReservationWithLock;
  global._createReservationWithLock = function() { return _stubReturns.lockResult; };

  createReservationAndGoToPayment('token1', 'user1', {
    patient_name: 'Test User',
    phone: '09012345678',
    reserved_date: '2099-12-31',
    reserved_start: '10:00',
    menu_type: '初診（30分）'
  });

  global._createReservationWithLock = origLock;

  assert('sendLineReply (processing) called', _trackers.sendLineReply.length >= 1);
  assert('sendLinePushQuickReply called', _trackers.sendLinePushQuickReply.length >= 1);
  assertIncludes('push message has deposit request', _trackers.sendLinePushQuickReply[0].msg, 'pay.example.com');
  assertEqual('setUserState to AWAITING_PAYMENT', _trackers.setUserState[0].state, 'AWAITING_PAYMENT');
  assertEqual('reservation_id in state', _trackers.setUserState[0].context.reservation_id, 'R0099');
  assertEqual('payment_link in state', _trackers.setUserState[0].context.payment_link, 'https://pay.example.com/abc');
})();

// ========================================
section('createReservationAndGoToPayment - slot full after lock');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.lineProfile = null;
  _stubReturns.lockResult = { ok: false, reason: 'SLOT_FULL' };

  var origLock = global._createReservationWithLock;
  global._createReservationWithLock = function() { return _stubReturns.lockResult; };

  createReservationAndGoToPayment('token1', 'user1', {
    reserved_date: '2099-12-31', reserved_start: '10:00'
  });

  global._createReservationWithLock = origLock;

  assert('slot full: clearUserState called', _trackers.clearUserState.length >= 1);
  assertIncludes('slot full message', _trackers.sendLinePushQuickReply[0].msg, '他の方が予約');
})();

// ========================================
section('createReservationAndGoToPayment - active ticket');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.lineProfile = null;
  _stubReturns.activeTicket = { ticket_id: 'TK001' };
  _stubReturns.sessionCount = 4;
  _stubReturns.lockResult = { ok: true, reservation: { id: 'R0088' } };

  var origLock = global._createReservationWithLock;
  global._createReservationWithLock = function() { return _stubReturns.lockResult; };

  createReservationAndGoToPayment('token1', 'user1', {
    patient_name: 'Ticket User',
    phone: '09012345678',
    reserved_date: '2099-12-31',
    reserved_start: '10:00',
    menu_type: '再診（30分）'
  });

  global._createReservationWithLock = origLock;

  assert('ticket: updateReservation called', _trackers.updateReservation.length >= 1);
  assertEqual('ticket: status Confirmed', _trackers.updateReservation[0].data.status, 'Confirmed');
  assertEqual('ticket: deposit Applied', _trackers.updateReservation[0].data.deposit_status, 'Applied');
  assertEqual('ticket: deductSession called', _trackers.deductSession[0], 'TK001');
  assertIncludes('ticket message', _trackers.sendLinePushQuickReply[0].msg, '回数券');
  assertIncludes('remaining count', _trackers.sendLinePushQuickReply[0].msg, '4回');
})();

// ========================================
section('createReservationAndGoToPayment - payment link failure');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.lineProfile = null;
  _stubReturns.activeTicket = null;
  _stubReturns.paymentLink = null; // Payment link creation fails
  _stubReturns.lockResult = { ok: true, reservation: { id: 'R0077' } };

  var origLock = global._createReservationWithLock;
  global._createReservationWithLock = function() { return _stubReturns.lockResult; };

  createReservationAndGoToPayment('token1', 'user1', {
    patient_name: 'Test',
    reserved_date: '2099-12-31',
    reserved_start: '10:00'
  });

  global._createReservationWithLock = origLock;

  assertIncludes('payment fail message', _trackers.sendLinePushQuickReply[0].msg, '失敗');
  assertIncludes('retry button offered', JSON.stringify(_trackers.sendLinePushQuickReply[0].opts), '再試行');
})();

// ========================================
section('_createReservationWithLock');
// ========================================

(function() {
  resetMocks(); resetTrackers();

  // Slot available
  _stubReturns.bookedSlotsForDate = { '10:00': 0 };
  _stubReturns.maxConcurrentBookings = 2;
  _stubReturns.createReservationResult = { id: 'R_LOCK_1' };

  var result = _createReservationWithLock({
    reserved_date: '2099-12-31',
    reserved_start: '10:00'
  });

  assertEqual('lock success: ok true', result.ok, true);
  assertEqual('lock success: has reservation', result.reservation.id, 'R_LOCK_1');

  // Slot full
  resetTrackers();
  _stubReturns.bookedSlotsForDate = { '10:00': 2 };
  _stubReturns.maxConcurrentBookings = 2;

  var result2 = _createReservationWithLock({
    reserved_date: '2099-12-31',
    reserved_start: '10:00'
  });

  assertEqual('lock slot full: ok false', result2.ok, false);
  assertEqual('lock slot full reason', result2.reason, 'SLOT_FULL');
})();

// ========================================
section('_onReservationCreated');
// ========================================

(function() {
  resetMocks(); resetTrackers();

  // Reservation exists
  _stubReturns.reservationById = {
    id: 'R001', patient_name: 'Test', reserved_date: '2099-12-31',
    reserved_start: '10:00', menu_type: '初診（30分）'
  };

  _onReservationCreated('R001', {});

  assert('calendar event created', _trackers.createCalendarEvent.length === 1);
  assert('audit log appended', _trackers.appendAuditLog.length === 1);
  assertEqual('audit action is CREATE', _trackers.appendAuditLog[0][0], 'CREATE');

  // Reservation not found
  resetTrackers();
  _stubReturns.reservationById = null;
  _onReservationCreated('R999', {});
  assertEqual('not found: no calendar event', _trackers.createCalendarEvent.length, 0);

  // Calendar sync throws - should not crash
  resetTrackers();
  _stubReturns.reservationById = { id: 'R002', patient_name: 'Test', reserved_date: '2099-12-31', reserved_start: '10:00', menu_type: 'Test' };
  var origCal = global.createCalendarEvent;
  global.createCalendarEvent = function() { throw new Error('Calendar API error'); };

  _onReservationCreated('R002', {});
  global.createCalendarEvent = origCal;

  assert('calendar error logged as WARN', _trackers.appendLogRow.some(function(l) { return l.level === 'WARN' && l.msg.indexOf('Calendar') >= 0; }));
  assert('audit log still appended', _trackers.appendAuditLog.length === 1);
})();

// ========================================
section('_findNearestAvailableSlots');
// ========================================

(function() {
  resetMocks(); resetTrackers();

  // All slots available
  _stubReturns.bookedSlotsForDate = {};
  _stubReturns.maxConcurrentBookings = 2;

  var slots = _findNearestAvailableSlots('2099-12-31', '10:00', 3);
  assert('returns array', Array.isArray(slots));
  assertEqual('returns max 3 slots', slots.length, 3);
  assertEqual('nearest slot is 10:00', slots[0], '10:00');

  // Some slots booked
  _stubReturns.bookedSlotsForDate = { '10:00': 2, '10:30': 2 }; // Both full
  var slots2 = _findNearestAvailableSlots('2099-12-31', '10:00', 3);
  assertNotIncludes('excludes full slot 10:00', slots2, '10:00');
  assertNotIncludes('excludes full slot 10:30', slots2, '10:30');

  // Verify sorted by distance
  _stubReturns.bookedSlotsForDate = {};
  var slots3 = _findNearestAvailableSlots('2099-12-31', '11:00', 5);
  assertEqual('first slot is nearest', slots3[0], '11:00');
  // Second should be 10:30 or 11:30 (equal distance)
  assert('second slot is 30min away', slots3[1] === '10:30' || slots3[1] === '11:30');
})();

// ========================================
section('createReservationAndGoToPayment - staff_id in notes');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.lineProfile = null;
  _stubReturns.activeTicket = null;
  _stubReturns.paymentLink = 'https://pay.com';
  _stubReturns.lockResult = { ok: true, reservation: { id: 'R_STAFF' } };

  var capturedData = null;
  var origLock = global._createReservationWithLock;
  global._createReservationWithLock = function(data) {
    capturedData = data;
    return _stubReturns.lockResult;
  };

  createReservationAndGoToPayment('token1', 'user1', {
    patient_name: 'Staff User',
    reserved_date: '2099-12-31',
    reserved_start: '10:00',
    staff_id: 'S001'
  });

  global._createReservationWithLock = origLock;

  assert('staff_id embedded in notes', capturedData.notes && capturedData.notes.indexOf('staff:S001') >= 0);
})();

// ========================================
section('createReservationAndGoToPayment - line profile');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.activeTicket = null;
  _stubReturns.paymentLink = 'https://pay.com';
  _stubReturns.lockResult = { ok: true, reservation: { id: 'R_PROF' } };
  _stubReturns.lineProfile = { userId: 'LINE_PROF_123' };

  var capturedData = null;
  var origLock = global._createReservationWithLock;
  global._createReservationWithLock = function(data) {
    capturedData = data;
    return _stubReturns.lockResult;
  };

  createReservationAndGoToPayment('token1', 'user1', {
    patient_name: 'Profile User',
    reserved_date: '2099-12-31',
    reserved_start: '10:00'
  });

  global._createReservationWithLock = origLock;

  assertEqual('line_display_name from profile', capturedData.line_display_name, 'LINE_PROF_123');
})();

// ========================================
section('handleAwaitingPayment - retry with exception');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  setupUserState('user1', 'AWAITING_PAYMENT', { reservation_id: 'R_RETRY_EX', payment_link: null, retry_count: 0 });
  _stubReturns.reservationById = { patient_name: 'Test', deposit_status: 'Unpaid' };

  var origPay = global.createPaymentLink;
  global.createPaymentLink = function() { throw new Error('Stripe timeout'); };

  handleAwaitingPayment('再試行', 'token1', 'user1');

  global.createPaymentLink = origPay;

  assertIncludes('retry exception: fail message', _trackers.sendQuickReply[0].msg, '失敗');
  assert('retry exception: logged', _trackers.appendLogRow.length >= 1);
})();

// ========================================
section('handleAwaitingPayment - lock error');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  _stubReturns.maxReservationsPerUser = 3;
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.lineProfile = null;
  _stubReturns.lockResult = { ok: false, reason: 'Lock timeout' };

  var origLock = global._createReservationWithLock;
  global._createReservationWithLock = function() { return _stubReturns.lockResult; };

  createReservationAndGoToPayment('token1', 'user1', {
    reserved_date: '2099-12-31', reserved_start: '10:00'
  });

  global._createReservationWithLock = origLock;

  assert('lock error: clearUserState called', _trackers.clearUserState.length >= 1);
  assertIncludes('lock error message', _trackers.sendLinePushQuickReply[0].msg, 'エラー');
})();

// ========================================
section('handleAwaitingTime - reserved_end calculation');
// ========================================

(function() {
  resetMocks(); resetTrackers(); _userStates = {};

  // 60 minute treatment
  setupUserState('user1', 'AWAITING_TIME', {
    reserved_date: '2099-12-31',
    menu_type: '再診（60分）',
    is_returning: true, patient_name: 'Test', phone: '09012345678'
  });
  _stubReturns.bookedSlotsForDate = {};
  _stubReturns.treatmentTimeOrdering = { valid: true, reason: '' };
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.paymentLink = 'https://pay.com';
  _stubReturns.activeTicket = null;
  _stubReturns.lockResult = { ok: true, reservation: { id: 'R_DUR' } };

  var origLock = global._createReservationWithLock;
  global._createReservationWithLock = function(data) {
    assertEqual('reserved_end for 60min', data.reserved_end, '11:00');
    return _stubReturns.lockResult;
  };

  handleAwaitingTime('10:00', 'token1', 'user1');
  global._createReservationWithLock = origLock;

  // 30 minute treatment
  resetTrackers();
  setupUserState('user2', 'AWAITING_TIME', {
    reserved_date: '2099-12-31',
    menu_type: '初診（30分）',
    is_returning: true, patient_name: 'Test', phone: '09012345678'
  });
  _stubReturns.bookedSlotsForDate = {};
  _stubReturns.treatmentTimeOrdering = { valid: true, reason: '' };
  _stubReturns.reservationsByLineUserId = [];
  _stubReturns.lockResult = { ok: true, reservation: { id: 'R_DUR2' } };

  var captured = null;
  global._createReservationWithLock = function(data) {
    captured = data;
    return _stubReturns.lockResult;
  };

  handleAwaitingTime('14:00', 'token2', 'user2');
  global._createReservationWithLock = origLock;

  assertEqual('reserved_end for 30min at 14:00', captured.reserved_end, '14:30');
})();

// ─── Results ───
console.log('\n========================================');
console.log('ReservationHandler Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
