/**
 * Phase 5-3 E2E Tests - 回数券パッケージ販売
 *
 * Run: node tests/e2e-phase5-ticket.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals ───
var mockCache = {};
var mockUserCache = {};
var mockUserProps = {};

var mockSheetData = {
  reservations: {
    headers: ['reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name', 'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end', 'status', 'deposit_required', 'deposit_amount', 'deposit_status', 'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified', 'resale_success', 'average_unit_price', 'notes', 'payment_intent_id', 'follow_up_sent', 'used_ticket'],
    rows: []
  },
  tickets: {
    headers: ['ticket_id', 'created_at', 'line_user_id', 'package_type', 'total_sessions', 'remaining_sessions', 'expiry_date', 'status', 'stripe_session_id', 'stripe_payment_intent', 'notes'],
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
        setValue: function(val) {
          if (sheet.rows[row - 2]) {
            sheet.rows[row - 2][col - 1] = val;
          }
        },
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
      'FOLLOW_UP_HOURS_AFTER': '24',
      'TICKET_EXPIRY_DAYS': '180', 'TICKET_5_PRICE': '25000', 'TICKET_10_PRICE': '45000'
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
  getUuid: function() { return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 18); }
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
global.getFollowUpHoursAfter = function() { return 24; };
global.sendLinePushQuickReply = function(userId, text, quickReplies) {
  _lastPushText = text;
  _lastPushQuickReply = quickReplies;
};
global.sendLinePush = function(userId, text) {
  _lastPushText = text;
};

// State stubs
var mockStates = {};
global.getUserState = function(userId) { return mockStates[userId] || { state: 'IDLE' }; };
global.setUserState = function(userId, state, data) { mockStates[userId] = { state: state, data: data }; };
global.clearUserState = function(userId) { delete mockStates[userId]; };
global.getUserLocale = function() { return 'ja'; };
global.USER_STATES = { IDLE: 'IDLE', AWAITING_NAME: 'AWAITING_NAME', AWAITING_TICKET_SELECT: 'AWAITING_TICKET_SELECT' };
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
loadFile(path.join(gasDir, 'services', 'TicketService.js'));

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

section('TICKET_PACKAGES constants');

assert('5-session package exists', TICKET_PACKAGES['5'] !== undefined);
assert('10-session package exists', TICKET_PACKAGES['10'] !== undefined);
assert('5-session has 5 sessions', TICKET_PACKAGES['5'].sessions === 5);
assert('10-session has 10 sessions', TICKET_PACKAGES['10'].sessions === 10);

section('getTicketPrice');

var price5 = getTicketPrice('5');
var price10 = getTicketPrice('10');
assert('5-session price is 25000', price5 === 25000);
assert('10-session price is 45000', price10 === 45000);
assert('Unknown package returns 0', getTicketPrice('99') === 0);

section('createTicket');

var ticket1 = createTicket({
  line_user_id: 'U001',
  package_type: '5',
  stripe_session_id: 'cs_test1',
  notes: 'Test ticket'
});

assert('Ticket has ticket_id', ticket1.ticket_id.indexOf('TK') === 0);
assert('Ticket has line_user_id', ticket1.line_user_id === 'U001');
assert('Ticket package_type is 5', ticket1.package_type === '5');
assert('Ticket total_sessions is 5', ticket1.total_sessions === 5);
assert('Ticket remaining_sessions is 5', ticket1.remaining_sessions === 5);
assert('Ticket status is Active', ticket1.status === 'Active');
assert('Ticket has expiry_date', ticket1.expiry_date.indexOf('2026') === 0);
assert('Ticket sheet has 1 row', mockSheetData.tickets.rows.length === 1);

section('getActiveTicketByUser');

var activeTicket = getActiveTicketByUser('U001');
assert('Active ticket found for U001', activeTicket !== null);
assert('Active ticket ID matches', activeTicket.ticket_id === ticket1.ticket_id);
assert('No ticket for unknown user', getActiveTicketByUser('U999') === null);

section('deductSession');

deductSession(ticket1.ticket_id);
var afterDeduct1 = getActiveTicketByUser('U001');
assert('After 1 deduction, remaining=4', afterDeduct1.remaining_sessions === 4);
assert('Status still Active', afterDeduct1.status === 'Active');

section('deductSession to exhaustion');

deductSession(ticket1.ticket_id);
deductSession(ticket1.ticket_id);
deductSession(ticket1.ticket_id);
deductSession(ticket1.ticket_id);
var afterExhaust = getTicketById(ticket1.ticket_id);
assert('After 5 deductions, remaining=0', afterExhaust.remaining_sessions === 0);
assert('Status is Exhausted', afterExhaust.status === 'Exhausted');

section('refundSession');

refundSession(ticket1.ticket_id);
var afterRefund = getTicketById(ticket1.ticket_id);
assert('After refund, remaining=1', afterRefund.remaining_sessions === 1);
assert('Status back to Active from Exhausted', afterRefund.status === 'Active');

section('refundSession does not exceed total');

for (var ri = 0; ri < 10; ri++) {
  refundSession(ticket1.ticket_id);
}
var afterOverRefund = getTicketById(ticket1.ticket_id);
assert('Remaining capped at total_sessions (5)', afterOverRefund.remaining_sessions === 5);

section('getTicketById');

var found = getTicketById(ticket1.ticket_id);
assert('getTicketById returns ticket', found !== null);
assert('getTicketById ID matches', found.ticket_id === ticket1.ticket_id);
assert('getTicketById null for unknown', getTicketById('TK_UNKNOWN') === null);

section('checkExpiredTickets: no expired');

checkExpiredTickets();
var notExpired = getTicketById(ticket1.ticket_id);
assert('Non-expired ticket stays Active', notExpired.status === 'Active');

section('createTicket: second ticket for different user');

var ticket2 = createTicket({
  line_user_id: 'U002',
  package_type: '10'
});
assert('Second ticket created', ticket2.ticket_id !== ticket1.ticket_id);
assert('Second ticket has 10 sessions', ticket2.total_sessions === 10);
assert('Ticket sheet has 2 rows', mockSheetData.tickets.rows.length === 2);

section('getSessionCountForUser');

assert('U001 has 5 remaining', getSessionCountForUser('U001') === 5);
assert('U002 has 10 remaining', getSessionCountForUser('U002') === 10);
assert('Unknown user has 0', getSessionCountForUser('U999') === 0);

section('getTicketStatusMessage');

var statusMsg = getTicketStatusMessage(ticket1.ticket_id, 'ja');
assert('Status message contains ticket ID', statusMsg.indexOf(ticket1.ticket_id) >= 0);
assert('Status message contains Active', statusMsg.indexOf('Active') >= 0);
assert('Status message contains 5/5', statusMsg.indexOf('5/5') >= 0);

section('getTicketStatusMessage: not found');

var notFoundMsg = getTicketStatusMessage('TK_FAKE', 'ja');
assert('Not found message', notFoundMsg.indexOf('見つかりません') >= 0);

section('Message template: getTicketSelectMessage');

var selectMsg = MessageTemplates.getTicketSelectMessage('ja');
assert('Select message has 回数券', selectMsg.text.indexOf('回数券') >= 0);
assert('Select has 4 quickReplies', selectMsg.quickReplies.length === 4);
assert('QuickReply 0 is 5回券', selectMsg.quickReplies[0].text === 'TICKET_BUY:5');
assert('QuickReply 1 is 10回券', selectMsg.quickReplies[1].text === 'TICKET_BUY:10');
assert('QuickReply 2 is balance check', selectMsg.quickReplies[2].text === 'TICKET_BALANCE');

section('Message template: getTicketConfirmedMessage');

var confirmMsg = MessageTemplates.getTicketConfirmedMessage('TK12345678', '5', 5, '2026/11/28', 'ja');
assert('Confirm message has ID', confirmMsg.indexOf('TK12345678') >= 0);
assert('Confirm message has 5回', confirmMsg.indexOf('5回') >= 0);
assert('Confirm message has expiry', confirmMsg.indexOf('2026/11/28') >= 0);

section('Message template: getTicketBalanceMessage');

var balanceMsg = MessageTemplates.getTicketBalanceMessage(ticket2, 'ja');
assert('Balance message has ticket ID', balanceMsg.indexOf(ticket2.ticket_id) >= 0);
assert('Balance message has 10回', balanceMsg.indexOf('10') >= 0);

var noBalanceMsg = MessageTemplates.getTicketBalanceMessage(null, 'ja');
assert('No balance message indicates no ticket', noBalanceMsg.indexOf('アクティブな回数券') >= 0);

// ─── Results ───

console.log('\n========================================');
console.log('Phase 5-3 E2E Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var fi = 0; fi < errors.length; fi++) {
    console.log('  FAIL ' + errors[fi]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
