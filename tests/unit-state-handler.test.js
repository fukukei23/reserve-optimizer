/**
 * Unit Tests - StateHandler (state management, user preferences)
 *
 * Run: node tests/unit-state-handler.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockUserCache = {};
var _mockUserProps = {};
var _mockCache = {};
var _mockSheets = {};

function addMockSheet(name, headers, rows) { _mockSheets[name] = { headers: headers || [], rows: rows || [] }; }

global.SpreadsheetApp = {
  openById: function() {
    return {
      getSheetByName: function(name) {
        var s = _mockSheets[name];
        if (!s) return null;
        return {
          getDataRange: function() { return { getValues: function() { return [s.headers].concat(s.rows); } }; },
          appendRow: function(row) { s.rows.push(row); }
        };
      },
      insertSheet: function(name) { _mockSheets[name] = { headers: [], rows: [] }; return global.SpreadsheetApp.openById().getSheetByName(name); }
    };
  }
};

global.CacheService = {
  getScriptCache: function() {
    return { get: function(k) { return _mockCache[k] || null; }, put: function(k, v) { _mockCache[k] = v; }, remove: function(k) { delete _mockCache[k]; } };
  },
  getUserCache: function() {
    return { get: function(k) { return _mockUserCache[k] || null; }, put: function(k, v) { _mockUserCache[k] = v; }, remove: function(k) { delete _mockUserCache[k]; } };
  }
};

global.PropertiesService = {
  getScriptProperties: function() { return { getProperty: function() { return null; } }; },
  getUserProperties: function() {
    return {
      getProperty: function(k) { return _mockUserProps[k] || null; },
      setProperty: function(k, v) { _mockUserProps[k] = v; },
      deleteProperty: function(k) { delete _mockUserProps[k]; },
      getProperties: function() { return Object.assign({}, _mockUserProps); }
    };
  }
};

global.Utilities = { getUuid: function() { return Math.random().toString(36).substring(2, 10); } };
global.Logger = { log: function() {} };
global.appendLogRow = function() {};

// Load source
var gasDir = path.join(__dirname, '..', 'gas-project');
new vm.Script(fs.readFileSync(path.join(gasDir, 'handlers', 'StateHandler.js'), 'utf8'), { filename: 'StateHandler.js' }).runInThisContext();

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond) { if (cond) { passed++; console.log('  PASS ' + name); } else { failed++; errors.push(name); console.log('  FAIL ' + name); } }
function assertEqual(name, a, e) { if (a === e) { passed++; console.log('  PASS ' + name); } else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (got ' + JSON.stringify(a) + ')'); } }
function section(t) { console.log('\n== ' + t + ' =='); }

function resetState() {
  _mockUserCache = {};
  _mockUserProps = {};
}

// ─── Tests ───

section('USER_STATES constants');
assert('IDLE defined', USER_STATES.IDLE === 'IDLE');
assert('AWAITING_NAME defined', USER_STATES.AWAITING_NAME === 'AWAITING_NAME');
assert('AWAITING_DATE defined', USER_STATES.AWAITING_DATE === 'AWAITING_DATE');
assert('AWAITING_TIME defined', USER_STATES.AWAITING_TIME === 'AWAITING_TIME');
assert('AWAITING_PAYMENT defined', USER_STATES.AWAITING_PAYMENT === 'AWAITING_PAYMENT');
assert('AWAITING_CANCEL_SELECT defined', USER_STATES.AWAITING_CANCEL_SELECT === 'AWAITING_CANCEL_SELECT');
assert('AWAITING_TICKET_SELECT defined', USER_STATES.AWAITING_TICKET_SELECT === 'AWAITING_TICKET_SELECT');
assert('18 states total', Object.keys(USER_STATES).length === 18);

section('setUserState / getUserState');
resetState();

setUserState('U001', USER_STATES.AWAITING_DATE, { reserved_date: '2026/06/01' });
var state1 = getUserState('U001');
assertEqual('state is AWAITING_DATE', state1.state, 'AWAITING_DATE');
assert('has context', state1.context !== undefined);
assertEqual('context reserved_date', state1.context.reserved_date, '2026/06/01');
assert('has timestamp', typeof state1.timestamp === 'number');

section('getUserState: no state returns IDLE');
resetState();
var idleState = getUserState('U_UNKNOWN');
assertEqual('state is IDLE', idleState.state, 'IDLE');
assertEqual('context is empty', Object.keys(idleState.context).length, 0);

section('clearUserState');
resetState();
setUserState('U002', USER_STATES.AWAITING_TIME, { reserved_start: '10:00' });
clearUserState('U002');
var cleared = getUserState('U002');
assertEqual('cleared state is IDLE', cleared.state, 'IDLE');

section('state overwrite');
resetState();
setUserState('U003', USER_STATES.AWAITING_NAME);
setUserState('U003', USER_STATES.AWAITING_PHONE, { phone: '090-1234' });
var overwritten = getUserState('U003');
assertEqual('state overwritten to AWAITING_PHONE', overwritten.state, 'AWAITING_PHONE');
assertEqual('context preserved', overwritten.context.phone, '090-1234');

section('getUserState: cache miss falls back to PropertiesService');
resetState();
var key = 'user_temp_U004';
var data = JSON.stringify({ state: 'AWAITING_DATE', context: { test: true }, timestamp: Date.now() });
_mockUserProps[key] = data;
// CacheService returns null, PropertiesService has data
var fallbackState = getUserState('U004');
assertEqual('fallback state', fallbackState.state, 'AWAITING_DATE');
assertEqual('fallback context', fallbackState.context.test, true);

section('getUserState: expired state returns IDLE');
resetState();
var expiredKey = 'user_temp_U005';
_mockUserProps[expiredKey] = JSON.stringify({ state: 'AWAITING_TIME', context: {}, timestamp: Date.now() - 25 * 60 * 60 * 1000 });
var expiredState = getUserState('U005');
assertEqual('expired state returns IDLE', expiredState.state, 'IDLE');

section('getUserPref / setUserPref');
resetState();

var lang = getUserPref('U100', 'language');
assertEqual('default language is ja', lang, 'ja');

var reminder = getUserPref('U100', 'reminder_timing');
assertEqual('default reminder_timing', reminder, '08:00');

setUserPref('U100', 'language', 'en');
var afterSet = getUserPref('U100', 'language');
assertEqual('language set to en', afterSet, 'en');

// Other pref unchanged
var reminder2 = getUserPref('U100', 'reminder_timing');
assertEqual('reminder_timing unchanged', reminder2, '08:00');

section('getUserPrefs');
resetState();

var defaults = getUserPrefs('U200');
assertEqual('default language', defaults.language, 'ja');
assertEqual('default reminder_timing', defaults.reminder_timing, '08:00');

setUserPref('U200', 'language', 'en');
setUserPref('U200', 'custom_key', 'custom_val');
var prefs = getUserPrefs('U200');
assertEqual('overridden language', prefs.language, 'en');
assertEqual('custom key', prefs.custom_key, 'custom_val');
assertEqual('reminder unchanged', prefs.reminder_timing, '08:00');

section('cleanupExpiredStates');
resetState();
_mockUserProps['user_temp_U_VALID'] = JSON.stringify({ state: 'IDLE', timestamp: Date.now() });
_mockUserProps['user_temp_U_EXPIRED'] = JSON.stringify({ state: 'AWAITING_DATE', timestamp: Date.now() - 25 * 60 * 60 * 1000 });
_mockUserProps['user_temp_U_MALFORMED'] = 'not-json-{';
_mockUserProps['other_key'] = 'should_not_be_touched';

cleanupExpiredStates();

assert('expired removed', _mockUserProps['user_temp_U_EXPIRED'] === undefined);
assert('malformed removed', _mockUserProps['user_temp_U_MALFORMED'] === undefined);
assert('valid kept', _mockUserProps['user_temp_U_VALID'] !== undefined);
assert('non-prefixed key kept', _mockUserProps['other_key'] !== undefined);

// ─── Results ───
console.log('\n========================================');
console.log('StateHandler Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) { console.log('\nFailed:'); for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]); }
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
