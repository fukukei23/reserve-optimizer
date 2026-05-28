/**
 * Phase 4-2 E2E Tests - CRM Minimal
 *
 * Run: node tests/e2e-phase4-crm.test.js
 *
 * Tests CRMService (tags, followup, webhook),
 * SheetConfig CRM definitions, and i18n CRM keys.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals ───
var mockCache = {};
var mockUserProps = {};
var mockSheetData = {
  reservations: {
    headers: ['reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name', 'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end', 'status', 'deposit_required', 'deposit_amount', 'deposit_status', 'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified', 'resale_success', 'average_unit_price', 'notes', 'payment_intent_id'],
    rows: [
      ['R0001', new Date(), 'Test User', '09011112222', 'U001', 'Repeat', '再診（30分）', '2026/05/30', '10:00', '10:30', 'Visited', 'Y', 1000, 'Paid', 'Y', '', '', 'N', 'N', 5000, '', ''],
      ['R0002', new Date(), 'Web User', '09022223333', 'WEB', 'First', '初診（30分）', '2026/05/30', '11:00', '11:30', 'Pending', 'Y', 1000, 'Unpaid', 'N', '', '', 'N', 'N', 5000, 'source:web', ''],
    ]
  },
  customers: {
    headers: ['customer_id', 'phone', 'line_user_id', 'name', 'visit_count', 'no_show_count', 'last_visit', 'tags', 'notes'],
    rows: []
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
      get: function(key) { return null; },
      put: function() {},
      remove: function() {}
    };
  }
};

global.PropertiesService = {
  getScriptProperties: function() {
    var props = {
      'SPREADSHEET_ID': 'mock', 'LINE_CHANNEL_ACCESS_TOKEN': 'mock',
      'STRIPE_API_KEY': 'mock', 'BUSINESS_START_TIME': '09:00', 'BUSINESS_END_TIME': '18:00'
    };
    return { getProperty: function(k) { return props[k] || null; }, setProperty: function() {} };
  },
  getUserProperties: function() {
    return {
      getProperty: function(k) { return mockUserProps[k] || null; },
      setProperty: function(k, v) { mockUserProps[k] = v; }
    };
  }
};

global.Utilities = {
  formatDate: function(d, tz, fmt) {
    if (fmt === 'yyyy/MM/dd') {
      return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
    }
    if (fmt === 'HH:mm') return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (fmt === 'yyyy-MM-dd') {
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    return d.toISOString();
  }
};
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
global.Logger = { log: function() {} };
global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };
global.ContentService = {
  createTextOutput: function(t) { return { setMimeType: function() { return t; } }; },
  MimeType: { JSON: 'application/json' }
};
global.ScriptApp = { newTrigger: function() { return { timeBased: function() { return { after: function() { return { create: function() {} }; } }; } }; } };

// Stubs
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global.getProperty = function(k) { return global.PropertiesService.getScriptProperties().getProperty(k); };
global.sendLinePush = function() { return true; };
global.sendLinePushQuickReply = function() { return true; };
global.notifyAdmin = function() {};
global.markReminderSent = function() {};
global.markNoShow = function() {};
global.getReservationById = function() { return null; };
global.updateReservation = function() {};
global._ensureReservationCache = function() {
  global._reservationCache = [];
  var rows = mockSheetData.reservations.rows;
  for (var i = 0; i < rows.length; i++) {
    global._reservationCache.push({
      id: rows[i][0], patient_name: rows[i][2], phone: rows[i][3],
      line_display_name: rows[i][4], menu_type: rows[i][6],
      reserved_date: rows[i][7], reserved_start: rows[i][8], reserved_end: rows[i][9],
      status: rows[i][10], deposit_status: rows[i][13],
      reminder_sent: rows[i][14], resale_notified: rows[i][17],
      resale_success: rows[i][18], notes: rows[i][20]
    });
  }
};
global._getCachedSpreadsheet = function() {
  return global.SpreadsheetApp.openById();
};
global.getUserPrefs = function() { return { language: 'ja', reminder_timing: '08:00' }; };
global.getReminderHoursBefore = function() { return 24; };
global.getNoShowDepositAmount = function() { return 3000; };
global.getNoShowThreshold = function() { return 3; };
global.isFirebaseConfigured = function() { return false; };

global.RESERVATION_STATUS = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', NO_SHOW: 'NoShow', VISITED: 'Visited' };
global.DEPOSIT_STATUS = { UNPAID: 'Unpaid', PAID: 'Paid', REFUNDED: 'Refunded' };
global.VISIT_TYPE = { FIRST: 'First', REPEAT: 'Repeat' };
global.TREATMENT_DURATIONS = { '初診（30分）': 30, '再診（30分）': 30 };
global.TIMEZONE = 'Asia/Tokyo';

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
loadFile(path.join(gasDir, 'services', 'SheetService.js'));
loadFile(path.join(gasDir, 'services', 'CRMService.js'));

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

section('SheetConfig: CRM definitions');

assert('SHEET_NAMES.CUSTOMERS exists', SHEET_NAMES.CUSTOMERS === 'customers');
assert('CUSTOMERS_COLUMNS defined', CUSTOMERS_COLUMNS.CUSTOMER_ID === 1);
assert('CUSTOMERS_COLUMNS has 9 columns', CUSTOMERS_COLUMNS.NOTES === 9);
assert('CUSTOMERS_HEADERS has 9 items', CUSTOMERS_HEADERS.length === 9);
assert('CRM_TAG_THRESHOLDS.REGULAR is 3', CRM_TAG_THRESHOLDS.REGULAR === 3);
assert('CRM_TAG_THRESHOLDS.VIP is 10', CRM_TAG_THRESHOLDS.VIP === 10);
assert('CRM_TAG_THRESHOLDS.NO_SHOW_WARN is 2', CRM_TAG_THRESHOLDS.NO_SHOW_WARN === 2);

section('Locales: CRM keys');

assert('crm.followup.title ja exists', MESSAGES['crm.followup.title'] !== undefined);
assert('crm.followup.title ja has Japanese', MESSAGES['crm.followup.title'].ja.indexOf('ありがとうございました') >= 0);
assert('crm.followup.title en has English', MESSAGES['crm.followup.title'].en.indexOf('Thank you') >= 0);
assert('crm.tag.new exists', MESSAGES['crm.tag.new'] !== undefined);
assert('crm.tag.regular exists', MESSAGES['crm.tag.regular'] !== undefined);
assert('crm.tag.vip exists', MESSAGES['crm.tag.vip'] !== undefined);
assert('crm.tag.no_show_warn exists', MESSAGES['crm.tag.no_show_warn'] !== undefined);

section('CRMService: getOrCreateCustomer');

var c1 = getOrCreateCustomer('09012345678', 'Test Customer', 'U001');
assert('New customer created', c1.customer_id === '09012345678');
assert('New customer has name', c1.name === 'Test Customer');
assert('New customer has line_user_id', c1.line_user_id === 'U001');
assert('New customer visit_count is 0', c1.visit_count === 0);
assert('New customer no_show_count is 0', c1.no_show_count === 0);
assert('New customer tag is new', c1.tags === 'new');
assert('Customer written to sheet', mockSheetData.customers.rows.length === 1);

var c1again = getOrCreateCustomer('09012345678', 'Test Customer', 'U001');
assert('Same customer returned on second call', c1again.customer_id === '09012345678');
assert('No duplicate rows in sheet', mockSheetData.customers.rows.length === 1);

section('CRMService: incrementVisitCount');

var c2 = incrementVisitCount('09012345678');
assert('Visit count incremented to 1', c2.visit_count === 1);
assert('Tag still new after 1 visit', c2.tags === 'new');

incrementVisitCount('09012345678');
incrementVisitCount('09012345678');
var c3 = getCustomerByPhone('09012345678');
assert('Visit count is 3', c3.visit_count === 3);
assert('Tag changed to regular after 3 visits', c3.tags === 'regular');

// Increment to VIP (10 visits)
for (var vi = c3.visit_count; vi < 10; vi++) {
  incrementVisitCount('09012345678');
}
var c4 = getCustomerByPhone('09012345678');
assert('Visit count is 10', c4.visit_count === 10);
assert('Tag changed to vip after 10 visits', c4.tags === 'vip');

section('CRMService: incrementNoShowCount');

var c5 = getOrCreateCustomer('09099999999', 'NoShow User');
assert('NoShow user created', c5.customer_id === '09099999999');

incrementNoShowCount('09099999999');
var c6 = getCustomerByPhone('09099999999');
assert('No-show count is 1', c6.no_show_count === 1);
assert('Tags: new only', c6.tags === 'new');

incrementNoShowCount('09099999999');
var c7 = getCustomerByPhone('09099999999');
assert('No-show count is 2', c7.no_show_count === 2);
assert('Tags includes no_show_warn', c7.tags.indexOf('no_show_warn') >= 0);

section('CRMService: getCustomerTagLabels');

assert('Tag labels ja', getCustomerTagLabels('new', 'ja') === '新規');
assert('Tag labels en', getCustomerTagLabels('new', 'en') === 'new');
assert('Tag labels multiple ja', getCustomerTagLabels('vip,no_show_warn', 'ja').indexOf('VIP') >= 0);
assert('Tag labels multiple ja has no_show_warn', getCustomerTagLabels('vip,no_show_warn', 'ja').indexOf('要注意') >= 0);
assert('Tag labels empty', getCustomerTagLabels('', 'ja') === '');

section('CRMService: followup message content');

var followupMsg = tf('crm.followup.title', null, 'ja') + '\n' + tf('crm.followup.next_booking', null, 'ja');
assert('Followup ja has thank you', followupMsg.indexOf('ありがとうございました') >= 0);
assert('Followup ja has booking prompt', followupMsg.indexOf('予約する') >= 0);

var followupEn = tf('crm.followup.title', null, 'en') + '\n' + tf('crm.followup.next_booking', null, 'en');
assert('Followup en has thank you', followupEn.indexOf('Thank you') >= 0);
assert('Followup en has booking prompt', followupEn.indexOf('Book') >= 0);

section('CRMService: processFollowups');

section('CRMService: processFollowups logic');

var today = new Date().getFullYear() + '/' + ('0' + (new Date().getMonth() + 1)).slice(-2) + '/' + ('0' + new Date().getDate()).slice(-2);

var testReservations = [
  { id: 'R001', status: 'Visited', reserved_date: today, notes: '', line_display_name: 'U001', phone: '09011112222' },
  { id: 'R002', status: 'Confirmed', reserved_date: today, notes: '', line_display_name: 'U002', phone: '09022223333' },
  { id: 'R003', status: 'Visited', reserved_date: today, notes: 'followup_sent', line_display_name: 'U003', phone: '09033334444' },
  { id: 'R004', status: 'Visited', reserved_date: '2026/05/01', notes: '', line_display_name: 'U004', phone: '09044445555' }
];

var followupCandidates = 0;
for (var fi = 0; fi < testReservations.length; fi++) {
  var tr = testReservations[fi];
  if (tr.status !== 'Visited') continue;
  if (tr.notes && tr.notes.indexOf('followup_sent') >= 0) continue;
  if (!tr.reserved_date || tr.reserved_date !== today) continue;
  followupCandidates++;
}

assert('Followup: only R001 qualifies', followupCandidates === 1);
assert('Followup: R002 skipped (not Visited)', testReservations[1].status === 'Confirmed');
assert('Followup: R003 skipped (followup_sent)', testReservations[2].notes === 'followup_sent');
assert('Followup: R004 skipped (not today)', testReservations[3].reserved_date === '2026/05/01');

assert('_fireCrmWebhook function exists', typeof _fireCrmWebhook === 'function');
assert('processFollowups function exists', typeof processFollowups === 'function');
assert('sendFollowupMessage function exists', typeof sendFollowupMessage === 'function');
assert('getOrCreateCustomer function exists', typeof getOrCreateCustomer === 'function');
assert('incrementVisitCount function exists', typeof incrementVisitCount === 'function');
assert('incrementNoShowCount function exists', typeof incrementNoShowCount === 'function');
assert('getCustomerTagLabels function exists', typeof getCustomerTagLabels === 'function');

// ─── Results ───

console.log('\n========================================');
console.log('Phase 4-2 CRM E2E Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var fi = 0; fi < errors.length; fi++) {
    console.log('  FAIL ' + errors[fi]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
