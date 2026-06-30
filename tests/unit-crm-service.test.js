/**
 * Unit Tests - CRMService (_buildCustomer, _updateTags, getCustomerTagLabels)
 *
 * Run: node tests/unit-crm-service.test.js
 *
 * Uses vm.Script to share scope with loaded GAS source files.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockSheets = {};

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
      get: function() { return null; },
      put: function() {},
      remove: function() {}
    };
  }
};

global.PropertiesService = {
  getScriptProperties: function() {
    var props = { 'SPREADSHEET_ID': 'mock' };
    return { getProperty: function(k) { return props[k] || null; }, setProperty: function() {} };
  }
};

global.Utilities = {
  formatDate: function(d, tz, fmt) {
    return d.toISOString();
  },
  getUuid: function() {
    // 本番 Utilities.getUuid() 相当（UUID v4形式: 36字・ハイフン区切り）
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };
global.Logger = { log: function() {} };
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };

// ─── Stubs for functions used by CRMService ───
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global.isFirebaseConfigured = function() { return false; };
global.sendLinePush = function() {};
global.fsGetCollection = function() { return []; };
global.fsSet = function() {};
global.fsUpdate = function() {};
global.getProperty = function(key, defaultVal) { return defaultVal || ''; };

// i18n stubs
global.t = function(key, locale) { return key; };
global.tf = function(key, vals, locale) { return key; };

// Config constants
global.SHEET_NAMES = {
  RESERVATIONS: 'reservations',
  WAITLIST: 'waitlist',
  WEEKLY_SUMMARY: 'weekly_summary',
  CUSTOMERS: 'customers',
  TICKETS: 'tickets',
  LOG: 'log'
};

global.CUSTOMERS_HEADERS = [
  'customer_id', 'phone', 'line_user_id', 'name',
  'visit_count', 'no_show_count', 'last_visit', 'tags', 'notes'
];

global.CRM_TAG_THRESHOLDS = {
  REGULAR: 3,
  VIP: 10,
  NO_SHOW_WARN: 2
};

global.RESERVATION_STATUS = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled',
  NO_SHOW: 'NoShow', VISITED: 'Visited'
};

global.TIMEZONE = 'Asia/Tokyo';

// Additional stubs needed by CRMService
global._reservationCache = null;
global._ensureReservationCache = function() {};
global.getUserLocale = function() { return 'ja'; };
global.updateReservation = function() {};

// ─── Load source files via vm.Script ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(relPath) {
  var code = fs.readFileSync(path.join(gasDir, relPath), 'utf8');
  new vm.Script(code, { filename: path.basename(relPath) }).runInThisContext();
}

// Load SheetService first (provides _getCachedSpreadsheet, formatDateObj, formatTimeObj, etc.)
loadFile('services/SheetService.js');

// Add a customers mock sheet
addMockSheet('customers', global.CUSTOMERS_HEADERS, []);

// Load CRMService
loadFile('services/CRMService.js');

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
function section(t) { console.log('\n== ' + t + ' =='); }

// ─── Tests: _buildCustomer ───

section('_buildCustomer - full row');
var fullRow = ['090-1234-5678', '090-1234-5678', 'U_LINE001', 'Yamada Taro', 5, 1, '2026-05-20', 'vip', 'good customer'];
var customer = _buildCustomer(fullRow);
assertEqual('customer_id', customer.customer_id, '090-1234-5678');
assertEqual('phone', customer.phone, '090-1234-5678');
assertEqual('line_user_id', customer.line_user_id, 'U_LINE001');
assertEqual('name', customer.name, 'Yamada Taro');
assertEqual('visit_count', customer.visit_count, 5);
assertEqual('no_show_count', customer.no_show_count, 1);
assertEqual('last_visit', customer.last_visit, '2026-05-20');
assertEqual('tags', customer.tags, 'vip');
assertEqual('notes', customer.notes, 'good customer');

section('_buildCustomer - row with missing fields');
var sparseRow = ['090-0000-0000', '090-0000-0000', '', 'Sato', '', '', '', '', ''];
var customer2 = _buildCustomer(sparseRow);
assertEqual('customer_id present', customer2.customer_id, '090-0000-0000');
assertEqual('visit_count defaults to 0', customer2.visit_count, 0);
assertEqual('no_show_count defaults to 0', customer2.no_show_count, 0);
assertEqual('tags defaults to empty', customer2.tags, '');
assertEqual('notes defaults to empty', customer2.notes, '');

section('_buildCustomer - numeric visit counts as strings');
var stringRow = ['090-9999-8888', '090-9999-8888', '', 'Test', '7', '3', '2026-05-01', 'regular', ''];
var customer3 = _buildCustomer(stringRow);
assertEqual('visit_count parsed from string', customer3.visit_count, 7);
assertEqual('no_show_count parsed from string', customer3.no_show_count, 3);

section('_buildCustomer - null/undefined fields');
var nullRow = ['090-1111-2222', '090-1111-2222', null, null, null, null, null, null, null];
var customer4 = _buildCustomer(nullRow);
assertEqual('visit_count 0 for null', customer4.visit_count, 0);
assertEqual('no_show_count 0 for null', customer4.no_show_count, 0);
assertEqual('tags empty for null', customer4.tags, '');
assertEqual('notes empty for null', customer4.notes, '');

// ─── Tests: _updateTags ───

section('_updateTags - new customer (visit_count=0)');
var c_new = { visit_count: 0, no_show_count: 0, tags: '' };
_updateTags(c_new);
assertEqual('tags=new for 0 visits', c_new.tags, 'new');

section('_updateTags - regular customer (visit_count=3)');
var c_regular = { visit_count: 3, no_show_count: 0, tags: '' };
_updateTags(c_regular);
assertEqual('tags=regular for 3 visits', c_regular.tags, 'regular');

section('_updateTags - VIP customer (visit_count=10)');
var c_vip = { visit_count: 10, no_show_count: 0, tags: '' };
_updateTags(c_vip);
assertEqual('tags=vip for 10 visits', c_vip.tags, 'vip');

section('_updateTags - new with no_show_warn (no_show_count=2)');
var c_warn = { visit_count: 0, no_show_count: 2, tags: '' };
_updateTags(c_warn);
assertEqual('tags includes new', c_warn.tags.indexOf('new') === 0 ? 'new present' : '', 'new present');
assertIncludes('tags includes no_show_warn', c_warn.tags, 'no_show_warn');

section('_updateTags - VIP + no_show_warn');
var c_vip_warn = { visit_count: 10, no_show_count: 2, tags: '' };
_updateTags(c_vip_warn);
assertEqual('tags=vip,no_show_warn', c_vip_warn.tags, 'vip,no_show_warn');

section('_updateTags - regular boundary (visit_count=2)');
var c_2 = { visit_count: 2, no_show_count: 0, tags: '' };
_updateTags(c_2);
assertEqual('tags=new for 2 visits (< REGULAR threshold)', c_2.tags, 'new');

section('_updateTags - VIP boundary (visit_count=9)');
var c_9 = { visit_count: 9, no_show_count: 0, tags: '' };
_updateTags(c_9);
assertEqual('tags=regular for 9 visits (< VIP threshold)', c_9.tags, 'regular');

section('_updateTags - no_show_warn boundary (no_show_count=1)');
var c_ns1 = { visit_count: 0, no_show_count: 1, tags: '' };
_updateTags(c_ns1);
assertNotIncludes('tags has no no_show_warn for 1 no-show', c_ns1.tags, 'no_show_warn');

section('_updateTags - no_show_warn at threshold (no_show_count=2)');
var c_ns2 = { visit_count: 5, no_show_count: 2, tags: '' };
_updateTags(c_ns2);
assertIncludes('tags includes no_show_warn for 2 no-shows', c_ns2.tags, 'no_show_warn');
assertIncludes('tags includes regular', c_ns2.tags, 'regular');

// ─── Tests: getCustomerTagLabels ───

section('getCustomerTagLabels - empty/null');
assertEqual('empty string returns empty', getCustomerTagLabels('', 'ja'), '');
assertEqual('null returns empty', getCustomerTagLabels(null, 'ja'), '');
assertEqual('undefined returns empty', getCustomerTagLabels(undefined, 'ja'), '');

section('getCustomerTagLabels - single tag');
// t() stub returns the key, so when t('crm.tag.new', 'ja') returns 'crm.tag.new' === key, getCustomerTagLabels falls back to the raw tag
var label = getCustomerTagLabels('new', 'ja');
assertEqual('single tag returns tag name (t stub fallback)', label, 'new');

section('getCustomerTagLabels - multiple tags');
var labelMulti = getCustomerTagLabels('vip,no_show_warn', 'ja');
assertIncludes('multi tags includes vip', labelMulti, 'vip');
assertIncludes('multi tags includes no_show_warn', labelMulti, 'no_show_warn');
assert('multi tags are comma-space separated', labelMulti.indexOf(', ') >= 0);

section('getCustomerTagLabels - with i18n mock returning localized values');
// Override t() temporarily to simulate localization
var origT = global.t;
global.t = function(key, locale) {
  var map = {
    'crm.tag.new': '新規',
    'crm.tag.regular': '常連',
    'crm.tag.vip': 'VIP',
    'crm.tag.no_show_warn': '要注意'
  };
  return map[key] || key;
};
var labelJa = getCustomerTagLabels('vip', 'ja');
assertEqual('vip localized', labelJa, 'VIP');

var labelJaMulti = getCustomerTagLabels('vip,no_show_warn', 'ja');
assertEqual('multi localized', labelJaMulti, 'VIP, 要注意');

var labelNew = getCustomerTagLabels('new', 'ja');
assertEqual('new localized', labelNew, '新規');

var labelRegular = getCustomerTagLabels('regular', 'ja');
assertEqual('regular localized', labelRegular, '常連');

// Restore original t() stub
global.t = origT;

section('getCustomerTagLabels - whitespace handling');
var labelSpace = getCustomerTagLabels(' new , vip ', 'ja');
assertIncludes('handles spaces around tags', labelSpace, 'new');
assertIncludes('handles spaces around tags (vip)', labelSpace, 'vip');

// ─── getOrCreateCustomer: customer_id UUID化 ───
section('getOrCreateCustomer - new customer_id is UUID (not phone)');
(function() {
  // テスト用リセット: customers シートを空に + キャッシュ無効化
  _mockSheets['customers'].rows = [];
  _invalidateCustomerCache();

  var c1 = getOrCreateCustomer('090-1234-5678', 'Test User', 'LINE_001');
  assertEqual('customer_id differs from phone', c1.customer_id !== '090-1234-5678', true);
  assertEqual('customer_id matches UUID v4 format', /^[a-f0-9-]{36}$/.test(c1.customer_id), true);
  assertEqual('phone field preserved', c1.phone, '090-1234-5678');
})();

section('getOrCreateCustomer - same phone returns same customer (no duplicate)');
(function() {
  _mockSheets['customers'].rows = [];
  _invalidateCustomerCache();

  var c1 = getOrCreateCustomer('090-9999-0000', 'User One', '');
  var c2 = getOrCreateCustomer('090-9999-0000', 'User One Updated', '');
  assertEqual('same customer_id on duplicate phone', c2.customer_id, c1.customer_id);
  assertEqual('customers sheet has 1 row (no duplicate)', _mockSheets['customers'].rows.length, 1);
})();

section('getCustomerByPhone - lookup by phone works');
(function() {
  _mockSheets['customers'].rows = [];
  _invalidateCustomerCache();

  var created = getOrCreateCustomer('080-1111-2222', 'Lookup User', 'LINE_X');
  _invalidateCustomerCache();  // キャッシュクリア後に再取得で永続性確認
  var found = getCustomerByPhone('080-1111-2222');
  assertEqual('getCustomerByPhone finds persisted customer', found !== null, true);
  assertEqual('found customer_id matches created', found.customer_id, created.customer_id);
})();

section('different phone = different customer (phone is lookup key)');
(function() {
  _mockSheets['customers'].rows = [];
  _invalidateCustomerCache();

  var cA = getOrCreateCustomer('090-AAAA-AAAA', 'User A', '');
  var cB = getOrCreateCustomer('090-BBBB-BBBB', 'User B', '');
  assertEqual('different phones yield different customer_ids', cA.customer_id !== cB.customer_id, true);
  assertEqual('customers sheet has 2 rows', _mockSheets['customers'].rows.length, 2);
})();

section('cache invalidation preserves UUID identity');
(function() {
  _mockSheets['customers'].rows = [];
  _invalidateCustomerCache();

  var c1 = getOrCreateCustomer('090-7777-8888', 'Persist User', '');
  var uuidBefore = c1.customer_id;
  _invalidateCustomerCache();
  var c2 = getOrCreateCustomer('090-7777-8888', 'Persist User', '');
  assertEqual('UUID stable across cache invalidation', c2.customer_id, uuidBefore);
})();

// ─── Results ───
console.log('\n========================================');
console.log('CRMService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
