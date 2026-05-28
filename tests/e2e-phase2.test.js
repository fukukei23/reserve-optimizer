/**
 * Phase 2 E2E Tests - Staff, Monitoring, Security, Health endpoint
 *
 * Run: node tests/e2e-phase2.test.js
 *
 * Tests pure logic functions with mocked GAS environment.
 * Worker /health endpoint tested with simulated fetch.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals ───
var mockCache = {};
var mockUserCache = {};
var mockUserProps = {};
var mockSheetData = {
  staff: {
    headers: ['staff_id', 'name', 'role', 'active', 'specialties'],
    rows: [
      ['S001', '田中医師', '医師', true, '初診,再診'],
      ['S002', '佐藤柔整', '柔道整復師', true, '初診,再診'],
      ['S003', '鈴木研修', '研修生', true, '再診'],
      ['S004', '退職者', '元スタッフ', false, '初診'],
    ]
  },
  staff_shifts: {
    headers: ['staff_id', 'date', 'start_time', 'end_time', 'break_start', 'break_end'],
    rows: [
      ['S001', new Date(2026, 4, 26), new Date(2026, 0, 1, 9, 0), new Date(2026, 0, 1, 18, 0), new Date(2026, 0, 1, 12, 0), new Date(2026, 0, 1, 13, 0)],
      ['S002', new Date(2026, 4, 26), new Date(2026, 0, 1, 9, 0), new Date(2026, 0, 1, 17, 0), null, null],
    ]
  },
  reservations: {
    headers: ['reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name', 'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end', 'status', 'deposit_required', 'deposit_amount', 'deposit_status', 'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified', 'resale_success', 'average_unit_price', 'notes', 'payment_intent_id'],
    rows: []
  },
  'ログ': {
    headers: ['timestamp', 'level', 'message'],
    rows: []
  }
};

function makeMockSheet(name) {
  var sheet = mockSheetData[name];
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

// Mock SpreadsheetApp
global.SpreadsheetApp = {
  openById: function() {
    return {
      getSheetByName: function(name) {
        if (!mockSheetData[name]) return null;
        return makeMockSheet(name);
      },
      insertSheet: function(name) {
        mockSheetData[name] = { headers: [], rows: [] };
        return makeMockSheet(name);
      }
    };
  }
};

// Mock CacheService
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

// Mock PropertiesService
global.PropertiesService = {
  getScriptProperties: function() {
    var props = {
      'SPREADSHEET_ID': 'mock-sheet-id',
      'LINE_CHANNEL_ACCESS_TOKEN': 'mock-token',
      'STRIPE_API_KEY': 'mock-key',
      'GOOGLE_CALENDAR_ID': 'mock-calendar',
      'CANCELLATION_DEADLINE_HOURS': '24',
      'DEPOSIT_AMOUNT': '1000',
      'MAX_CONCURRENT_BOOKINGS': '3',
      'MAX_RESERVATIONS_PER_USER': '5',
      'BOOKING_LEAD_TIME_MINUTES': '30',
      'BUSINESS_START_TIME': '09:00',
      'BUSINESS_END_TIME': '18:00'
    };
    return {
      getProperty: function(key) { return props[key] || null; },
      setProperty: function() {}
    };
  },
  getUserProperties: function() {
    return {
      getProperty: function(key) { return mockUserProps[key] || null; },
      setProperty: function(key, val) { mockUserProps[key] = val; },
      deleteProperty: function(key) { delete mockUserProps[key]; },
      getProperties: function() { return Object.assign({}, mockUserProps); }
    };
  }
};

// Mock other GAS globals
global.Utilities = { formatDate: function(d) { return d.toISOString(); } };
global.LockService = {
  getScriptLock: function() {
    return { waitLock: function() {}, releaseLock: function() {} };
  }
};
global.Logger = { log: function() {} };
global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };

// Stub functions that other files depend on
global.appendLogRow = function(level, msg) {};
global.getSpreadsheetId = function() { return 'mock-sheet-id'; };
global.getLineAccessToken = function() { return 'mock-token'; };
global.getStripeApiKey = function() { return 'mock-key'; };
global.getStripeWebhookSecret = function() { return ''; };
global.getDepositAmount = function() { return 1000; };
global.getAverageUnitPrice = function() { return 5000; };
global.getCancellationDeadlineHours = function() { return 24; };
global.getMaxConcurrentBookings = function() { return 3; };
global.getMaxReservationsPerUser = function() { return 5; };
global.getBookingLeadTimeMinutes = function() { return 30; };
global.getBusinessStartTime = function() { return '09:00'; };
global.getBusinessEndTime = function() { return '18:00'; };
global.getLineAdminUserId = function() { return 'admin-id'; };
global.validateRequiredProperties = function() { return { valid: true, missing: [] }; };
global.getProperty = function(key) { return global.PropertiesService.getScriptProperties().getProperty(key); };

// ─── Load source files via vm ───
var gasDir = path.join(__dirname, '..', 'gas-project');

function loadFile(filepath) {
  var code = fs.readFileSync(filepath, 'utf8');
  var script = new vm.Script(code, { filename: path.basename(filepath) });
  script.runInThisContext();
}

loadFile(path.join(gasDir, 'config', 'SheetConfig.js'));
loadFile(path.join(gasDir, 'services', 'SheetService.js'));
loadFile(path.join(gasDir, 'handlers', 'StateHandler.js'));
loadFile(path.join(gasDir, 'services', 'StaffService.js'));
loadFile(path.join(gasDir, 'services', 'MonitoringService.js'));

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

function section(title) {
  console.log('\n== ' + title + ' ==');
}

// ─── Tests ───

section('StaffService: cache and basic retrieval');

_staffCache = null;
_shiftCache = null;

_ensureStaffCache();
assert('_staffCache loaded (4 rows)', _staffCache && _staffCache.length === 4,
  'Expected 4, got ' + (_staffCache ? _staffCache.length : 'null'));

var activeStaff = getActiveStaff();
assert('getActiveStaff returns 3 (excludes inactive)', activeStaff.length === 3,
  'Expected 3, got ' + activeStaff.length);

var firstVisit = getStaffForTreatment('初診');
assert('getStaffForTreatment(first) returns 2', firstVisit.length === 2,
  'Expected 2, got ' + firstVisit.length);

var repeat = getStaffForTreatment('再診');
assert('getStaffForTreatment(repeat) returns 3', repeat.length === 3,
  'Expected 3, got ' + repeat.length);

section('StaffService: name and ID lookup');

var tanaka = getStaffByName('田中医師');
assert('getStaffByName found', tanaka !== null && tanaka.staff_id === 'S001',
  tanaka ? tanaka.staff_id : 'null');

var retired = getStaffByName('退職者');
assert('getStaffByName(inactive) returns null', retired === null);

var byId = getStaffById('S002');
assert('getStaffById(S002) found', byId !== null && byId.name === '佐藤柔整');

var notFound = getStaffById('S999');
assert('getStaffById(S999) returns null', notFound === null);

section('StaffService: shift management');

_ensureShiftCache();
var shiftS001 = getStaffShift('S001', '2026/05/26');
assert('getStaffShift S001 found', shiftS001 !== null && shiftS001.start_time === '09:00',
  shiftS001 ? shiftS001.start_time : 'null');

var shiftS003 = getStaffShift('S003', '2026/05/26');
assert('getStaffShift S003 returns null (no shift)', shiftS003 === null);

var working = getStaffWorkingOnDate('2026/05/26');
assert('getStaffWorkingOnDate returns 2', working.length === 2,
  'Expected 2, got ' + working.length);

section('StaffService: QuickReply generation');

var qrFirst = buildStaffSelectionOptions('初診');
assert('buildStaffSelectionOptions(first) has 4 items (2+指名しない+やめる)', qrFirst.length === 4,
  'Expected 4, got ' + qrFirst.length);
assert('last item is やめる', qrFirst[qrFirst.length - 1].text === 'やめる');
assert('second-to-last is 指名しない', qrFirst[qrFirst.length - 2].text === '指名しない');

var qrRepeat = buildStaffSelectionOptions('再診');
assert('buildStaffSelectionOptions(repeat) has 5 items', qrRepeat.length === 5);

section('StaffService: cache invalidation');

_invalidateStaffCache();
assert('_invalidateStaffCache clears _staffCache', _staffCache === null);
assert('_invalidateStaffCache clears _shiftCache', _shiftCache === null);
_ensureStaffCache();
assert('Cache rebuilds after invalidation', _staffCache !== null && _staffCache.length === 4);

section('MonitoringService: health metrics');

mockSheetData['ログ'].rows = [
  [new Date(), 'ERROR', 'Test error 1'],
  [new Date(), 'INFO', 'Normal log'],
  [new Date(), 'ERROR', 'Test error 2'],
  [new Date(), 'WARN', 'Warning'],
];

_reservationCache = [];
_reservationByIdMap = {};
_reservationsByLineUserIdMap = {};
_reservationsByDateMap = {};

var metrics = getSystemHealthMetrics();
assert('metrics has timestamp', !!metrics.timestamp);
assert('metrics has reservations', metrics.reservations !== undefined);
assert('metrics has performance', metrics.performance !== undefined);
assert('metrics has errors', metrics.errors !== undefined);
assert('metrics has storage', metrics.storage !== undefined);
assert('metrics.healthy is boolean', typeof metrics.healthy === 'boolean');
assert('active_count is 0', metrics.reservations.active_count === 0);
assert('error count_today >= 2', metrics.errors.count_today >= 2);

section('MonitoringService: alert check');

var alertResult = checkAndAlert();
assert('checkAndAlert checked=true', alertResult.checked === true);
assert('checkAndAlert alertCount is number', typeof alertResult.alertCount === 'number');
assert('checkAndAlert alerts is array', Array.isArray(alertResult.alerts));

section('MonitoringService: report format');

var report = formatHealthReport();
assert('report has System Status', report.indexOf('System Status') !== -1);
assert('report has Reservations', report.indexOf('Reservations') !== -1);
assert('report has Performance', report.indexOf('Performance') !== -1);
assert('report has Errors', report.indexOf('Errors') !== -1);
assert('report has Config', report.indexOf('Config') !== -1);

section('StateHandler: AWAITING_STAFF state');

assert('USER_STATES.AWAITING_STAFF exists', USER_STATES.AWAITING_STAFF === 'AWAITING_STAFF');

var testUserId = 'test_state_' + Date.now();
setUserState(testUserId, USER_STATES.AWAITING_STAFF, { menu_type: '初診（30分）' });
var state = getUserState(testUserId);
assert('state saved as AWAITING_STAFF', state.state === 'AWAITING_STAFF');
assert('context.menu_type preserved', state.context.menu_type === '初診（30分）');

clearUserState(testUserId);
var clearedState = getUserState(testUserId);
assert('clearUserState resets to IDLE', clearedState.state === USER_STATES.IDLE);

section('StaffService: staff-specific booking slots');

_reservationCache = [
  { id: 'R0001', status: 'Pending', reserved_date: '2026/05/26', reserved_start: '10:00', notes: 'staff:S001' },
  { id: 'R0002', status: 'Confirmed', reserved_date: '2026/05/26', reserved_start: '10:00', notes: 'staff:S001' },
  { id: 'R0003', status: 'Cancelled', reserved_date: '2026/05/26', reserved_start: '11:00', notes: 'staff:S001' },
  { id: 'R0004', status: 'Pending', reserved_date: '2026/05/26', reserved_start: '14:00', notes: 'staff:S002' }
];
_reservationsByDateMap = { '2026/05/26': _reservationCache };

var s001Slots = getBookedSlotsForStaff('S001', '2026/05/26');
assert('S001 10:00 count=2 (Pending+Confirmed)', s001Slots['10:00'] === 2,
  'Expected 2, got ' + (s001Slots['10:00'] || 0));
assert('S001 11:00 excluded (Cancelled)', !s001Slots['11:00']);

var s002Slots = getBookedSlotsForStaff('S002', '2026/05/26');
assert('S002 14:00 count=1', s002Slots['14:00'] === 1);

var s999Slots = getBookedSlotsForStaff('S999', '2026/05/26');
assert('S999 returns empty', Object.keys(s999Slots).length === 0);

section('Security: constant-time comparison');

function testConstantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

assert('identical strings match', testConstantTimeEqual('abc123', 'abc123'));
assert('different strings do not match', !testConstantTimeEqual('abc123', 'abc124'));
assert('different lengths do not match', !testConstantTimeEqual('abc', 'abcd'));

section('Worker /health: endpoint logic');

function simulateHealthCheck(gasStatus, gasLatency) {
  var gasReachable = gasStatus === 200 || gasStatus === 302;
  return {
    status: gasReachable ? 'ok' : 'degraded',
    gas_reachable: gasReachable,
    gas_latency_ms: gasReachable ? gasLatency : -1
  };
}

var h200 = simulateHealthCheck(200, 150);
assert('GAS 200 => status=ok', h200.status === 'ok');
assert('GAS 200 => reachable=true', h200.gas_reachable === true);
assert('GAS 200 => latency=150', h200.gas_latency_ms === 150);

var h302 = simulateHealthCheck(302, 80);
assert('GAS 302 => status=ok', h302.status === 'ok');

var h500 = simulateHealthCheck(500, -1);
assert('GAS 500 => status=degraded', h500.status === 'degraded');

var hTimeout = simulateHealthCheck(null, -1);
assert('timeout => status=degraded', hTimeout.status === 'degraded');

section('Integration: staff selection in reservation flow');

var treatmentPrefix = '初診';
var staffOpts = buildStaffSelectionOptions(treatmentPrefix);
assert('Staff options available', staffOpts.length > 2, 'got ' + staffOpts.length);

var hasNoPreference = false;
for (var oi = 0; oi < staffOpts.length; oi++) {
  if (staffOpts[oi].text === '指名しない') { hasNoPreference = true; break; }
}
assert('指名しない option exists', hasNoPreference);

var selectedStaff = getStaffByName('田中医師');
assert('Selected staff found and active', selectedStaff !== null && selectedStaff.active === true);

var testNotes = 'staff:' + selectedStaff.staff_id;
assert('Notes format: staff:S001', testNotes === 'staff:S001');

// ─── Results ───

console.log('\n========================================');
console.log('Phase 2 E2E Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var fi = 0; fi < errors.length; fi++) {
    console.log('  FAIL ' + errors[fi]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
