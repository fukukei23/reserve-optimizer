/**
 * Unit Tests - StaffService (staff CRUD, shifts, QuickReply builders)
 *
 * Run: node tests/unit-staff-service.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockCache = {};
var _mockUserCache = {};
var _mockUserProps = {};
var _mockSheets = {};

function addMockSheet(name, headers, rows) { _mockSheets[name] = { headers: headers || [], rows: rows || [] }; }

function makeSheetProxy(name) {
  var s = _mockSheets[name];
  if (!s) return null;
  return {
    getDataRange: function() { return { getValues: function() { return [s.headers].concat(s.rows); } }; },
    appendRow: function(row) { s.rows.push(row); },
    getLastRow: function() { return s.rows.length + 1; },
    getRange: function(row, col) {
      return {
        getValue: function() { return s.rows[row - 2] ? s.rows[row - 2][col - 1] : ''; },
        setValue: function(val) { if (s.rows[row - 2]) s.rows[row - 2][col - 1] = val; }
      };
    }
  };
}

global.SpreadsheetApp = {
  openById: function() {
    return {
      getSheetByName: function(name) { return makeSheetProxy(name); },
      insertSheet: function(name) { _mockSheets[name] = { headers: [], rows: [] }; return makeSheetProxy(name); }
    };
  }
};
global.CacheService = {
  getScriptCache: function() { return { get: function(k) { return _mockCache[k] || null; }, put: function(k,v) { _mockCache[k]=v; }, remove: function(k) { delete _mockCache[k]; } }; },
  getUserCache: function() { return { get: function(k) { return _mockUserCache[k] || null; }, put: function(k,v) { _mockUserCache[k]=v; }, remove: function(k) { delete _mockUserCache[k]; } }; }
};
global.PropertiesService = {
  getScriptProperties: function() { return { getProperty: function() { return null; } }; },
  getUserProperties: function() { return { getProperty: function(k) { return _mockUserProps[k] || null; }, setProperty: function(k,v) { _mockUserProps[k]=v; }, deleteProperty: function(k) { delete _mockUserProps[k]; }, getProperties: function() { return Object.assign({}, _mockUserProps); } }; }
};
global.Utilities = { getUuid: function() { return Math.random().toString(36).substring(2, 10); } };
global.Logger = { log: function() {} };
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global.isFirebaseConfigured = function() { return false; };

// Config stubs
global.SHEET_NAMES = { RESERVATIONS: 'reservations', WAITLIST: 'waitlist', WEEKLY_SUMMARY: 'weekly_summary', TICKETS: 'tickets', LOG: 'log' };
global.RESERVATIONS_HEADERS = ['reservation_id'];
global.WAITLIST_HEADERS = ['waitlist_id'];
global.WEEKLY_SUMMARY_HEADERS = ['week_start'];
global.TICKETS_HEADERS = ['ticket_id'];
global.LOG_HEADERS = ['timestamp'];
global.RESERVATION_STATUS = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled' };
global.RESERVATIONS_COLUMNS = {};

// SheetService stubs (StaffService uses _ensureReservationCache, getReservationsSheet)
global.getReservationsSheet = function() { return global.SpreadsheetApp.openById().getSheetByName('reservations'); };
global.createSheetWithHeaders = function(ss, name, headers) { addMockSheet(name, headers, []); return makeSheetProxy(name); };
global.formatDateObj = function(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.indexOf('NaN') === -1 ? d : '';
  if (!(d instanceof Date)) return '';
  return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
};
global.formatTimeObj = function(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.indexOf('NaN') === -1 ? d : '';
  if (!(d instanceof Date)) return '';
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
};

// SheetService cache variables (StaffService references _reservationsByDateMap / _reservationsByLineUserIdMap)
var _reservationCache = null;
var _reservationByIdMap = null;
var _reservationsByLineUserIdMap = {};
var _reservationsByDateMap = {};
global._reservationCache = _reservationCache;
global._reservationsByDateMap = _reservationsByDateMap;
global._reservationsByLineUserIdMap = _reservationsByLineUserIdMap;

// Minimal SheetService functions needed by StaffService
global._ensureReservationCache = function() {};
global._getCachedSpreadsheet = function() {
  return global.SpreadsheetApp.openById();
};

// ScriptProperties mock (overrideable per test)
var _mockScriptProps = {};
global.PropertiesService.getScriptProperties = function() {
  return { getProperty: function(k) { return _mockScriptProps[k] || null; } };
};

// Load source
var gasDir = path.join(__dirname, '..', 'gas-project');
// ScriptProperties.js must load before StaffService.js (isFeatureStaffSelectEnabled)
global.appendLogRow = global.appendLogRow || function() {};
new vm.Script(fs.readFileSync(path.join(gasDir, 'config', 'ScriptProperties.js'), 'utf8'), { filename: 'ScriptProperties.js' }).runInThisContext();
new vm.Script(fs.readFileSync(path.join(gasDir, 'services', 'StaffService.js'), 'utf8'), { filename: 'StaffService.js' }).runInThisContext();

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond) { if (cond) { passed++; console.log('  PASS ' + name); } else { failed++; errors.push(name); console.log('  FAIL ' + name); } }
function assertEqual(name, a, e) { if (a === e) { passed++; console.log('  PASS ' + name); } else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (got ' + JSON.stringify(a) + ')'); } }
function section(t) { console.log('\n== ' + t + ' =='); }

function resetStaffCache() {
  // StaffService uses _staffCache and _shiftCache as module-level vars
  // Access via the vm context - call _invalidateStaffCache if available
  if (typeof _invalidateStaffCache === 'function') _invalidateStaffCache();
}

// ─── Setup test data ───
addMockSheet('staff', ['staff_id', 'name', 'role', 'active', 'specialties'], [
  ['S001', 'Dr. Tanaka', 'Director', 'TRUE', '初診,再診'],
  ['S002', 'Dr. Sato', 'Staff', 'TRUE', '再診'],
  ['S003', 'Dr. Inactive', 'Staff', 'FALSE', '初診']
]);
addMockSheet('staff_shifts', ['staff_id', 'date', 'start_time', 'end_time', 'break_start', 'break_end'], [
  ['S001', '2026/06/01', '09:00', '17:00', '12:00', '13:00'],
  ['S002', '2026/06/01', '10:00', '16:00', '', ''],
  ['S001', '2026/06/02', '09:00', '17:00', '12:00', '13:00']
]);
addMockSheet('reservations', ['reservation_id'], []);

// ─── Tests ───

section('getActiveStaff');
resetStaffCache();
var active = getActiveStaff();
assertEqual('active staff count', active.length, 2);
assert('S001 is active', active.some(function(s) { return s.staff_id === 'S001'; }));
assert('S002 is active', active.some(function(s) { return s.staff_id === 'S002'; }));
assert('S003 not active', !active.some(function(s) { return s.staff_id === 'S003'; }));

section('getStaffForTreatment: 初診');
resetStaffCache();
var forFirst = getStaffForTreatment('初診');
assertEqual('初診 staff count', forFirst.length, 1);
assertEqual('初診 staff is S001', forFirst[0].staff_id, 'S001');

section('getStaffForTreatment: 再診');
resetStaffCache();
var forReturn = getStaffForTreatment('再診');
assertEqual('再診 staff count', forReturn.length, 2);
assert('S001 available for 再診', forReturn.some(function(s) { return s.staff_id === 'S001'; }));
assert('S002 available for 再診', forReturn.some(function(s) { return s.staff_id === 'S002'; }));

section('getStaffByName');
resetStaffCache();
var byName = getStaffByName('Dr. Tanaka');
assert('found by name', byName !== null);
assertEqual('correct staff_id', byName.staff_id, 'S001');
assert('inactive not found', getStaffByName('Dr. Inactive') === null);
assert('unknown not found', getStaffByName('NonExistent') === null);

section('getStaffById');
resetStaffCache();
var byId = getStaffById('S002');
assert('found by ID', byId !== null);
assertEqual('correct name', byId.name, 'Dr. Sato');
assert('unknown returns null', getStaffById('S999') === null);

section('getStaffShift');
resetStaffCache();
var shift1 = getStaffShift('S001', '2026/06/01');
assert('shift found', shift1 !== null);
assertEqual('start_time', shift1.start_time, '09:00');
assertEqual('end_time', shift1.end_time, '17:00');
assertEqual('break_start', shift1.break_start, '12:00');

var shiftOff = getStaffShift('S002', '2026/06/02');
assert('off-duty returns null', shiftOff === null);

section('getStaffWorkingOnDate');
resetStaffCache();
var working = getStaffWorkingOnDate('2026/06/01');
assertEqual('2 staff working on 6/1', working.length, 2);

var working2 = getStaffWorkingOnDate('2026/06/02');
assertEqual('1 staff working on 6/2', working2.length, 1);

var working3 = getStaffWorkingOnDate('2026/06/03');
assertEqual('0 staff working on 6/3', working3.length, 0);

section('buildStaffSelectionOptions');
resetStaffCache();
var options = buildStaffSelectionOptions('再診');
assert('options has staff + 2 fixed', options.length >= 3);
assertEqual('last option is やめる', options[options.length - 1].text, 'やめる');
assertEqual('second last is 指名しない', options[options.length - 2].text, '指名しない');

section('staff object structure');
resetStaffCache();
var s = getStaffById('S001');
assertEqual('has staff_id', s.staff_id, 'S001');
assertEqual('has name', s.name, 'Dr. Tanaka');
assertEqual('has role', s.role, 'Director');
assert('has active boolean', typeof s.active === 'boolean');
assert('active is true', s.active === true);
assert('has specialties array', Array.isArray(s.specialties));
assertEqual('specialties count', s.specialties.length, 2);

// ─── W1-1: getPreviousStaffIdByLineUserId ───

section('getPreviousStaffIdByLineUserId: basic');
_reservationsByLineUserIdMap['U001'] = [
  { status: 'Confirmed', notes: 'staff:S001', reserved_date: '2026/05/01' },
  { status: 'Confirmed', notes: 'staff:S002', reserved_date: '2026/06/01' }
];
_reservationsByLineUserIdMap['U002'] = [
  { status: 'Confirmed', notes: '', reserved_date: '2026/06/01' }
];
_reservationsByLineUserIdMap['U003'] = [
  { status: 'Cancelled', notes: 'staff:S001', reserved_date: '2026/06/01' }
];
assertEqual('last confirmed staff is S002', getPreviousStaffIdByLineUserId('U001'), 'S002');
assert('returns null when notes has no staff', getPreviousStaffIdByLineUserId('U002') === null);
assert('returns null when only cancelled', getPreviousStaffIdByLineUserId('U003') === null);
assert('returns null for unknown user', getPreviousStaffIdByLineUserId('U999') === null);

section('getPreviousStaffIdByLineUserId: edge cases');
_reservationsByLineUserIdMap['U004'] = [];
assert('returns null for empty history', getPreviousStaffIdByLineUserId('U004') === null);
_reservationsByLineUserIdMap['U005'] = [
  { status: 'Confirmed', notes: 'staff:S001 extra', reserved_date: '2026/06/01' }
];
assertEqual('parses staff id with trailing text', getPreviousStaffIdByLineUserId('U005'), 'S001');

// ─── W1-1: buildStaffSelectionOptionsWithHistory ───

section('buildStaffSelectionOptionsWithHistory: previous staff first');
resetStaffCache();
_reservationsByLineUserIdMap['U_HAS_HISTORY'] = [
  { status: 'Confirmed', notes: 'staff:S001', reserved_date: '2026/06/01' }
];
var histOpts = buildStaffSelectionOptionsWithHistory('再診', 'U_HAS_HISTORY');
assert('has at least 4 options (2 staff + 2 fixed)', histOpts.length >= 4);
assertEqual('first option is previous staff S001', histOpts[0].text, 'Dr. Tanaka');
assert('first option label contains 前回', histOpts[0].label.indexOf('前回') >= 0);
assertEqual('second last is 指名しない', histOpts[histOpts.length - 2].text, '指名しない');
assertEqual('last is やめる', histOpts[histOpts.length - 1].text, 'やめる');

section('buildStaffSelectionOptionsWithHistory: no history');
resetStaffCache();
_reservationsByLineUserIdMap['U_NO_HISTORY'] = [];
var noHistOpts = buildStaffSelectionOptionsWithHistory('再診', 'U_NO_HISTORY');
assertEqual('same as buildStaffSelectionOptions length', noHistOpts.length, buildStaffSelectionOptions('再診').length);
assertEqual('last is やめる', noHistOpts[noHistOpts.length - 1].text, 'やめる');

section('buildStaffSelectionOptionsWithHistory: previous staff not in current options');
resetStaffCache();
_reservationsByLineUserIdMap['U_OLD_STAFF'] = [
  { status: 'Confirmed', notes: 'staff:S999', reserved_date: '2026/06/01' }
];
var oldStaffOpts = buildStaffSelectionOptionsWithHistory('再診', 'U_OLD_STAFF');
assertEqual('fallback: same length as base', oldStaffOpts.length, buildStaffSelectionOptions('再診').length);

// ─── W1-1: isFeatureStaffSelectEnabled (requires ScriptProperties.js) ───

section('isFeatureStaffSelectEnabled');
_mockScriptProps = {};
assert('disabled by default', isFeatureStaffSelectEnabled() === false);
_mockScriptProps['FEATURE_STAFF_SELECT'] = 'true';
assert('enabled when set to true', isFeatureStaffSelectEnabled() === true);
_mockScriptProps['FEATURE_STAFF_SELECT'] = 'false';
assert('disabled when set to false', isFeatureStaffSelectEnabled() === false);
_mockScriptProps = {};

// ─── Results ───
console.log('\n========================================');
console.log('StaffService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) { console.log('\nFailed:'); for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]); }
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
