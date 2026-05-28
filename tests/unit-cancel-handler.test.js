/**
 * Unit Tests - CancelHandler (canCancelReservation logic)
 *
 * Run: node tests/unit-cancel-handler.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Minimal mocks ───
var _mockCache = {}, _mockUserCache = {}, _mockUserProps = {}, _mockSheets = {};

global.SpreadsheetApp = { openById: function() { return { getSheetByName: function() { return null; }, insertSheet: function(n) { return null; } }; } };
global.CacheService = { getScriptCache: function() { return { get: function(k) { return null; }, put: function(){}, remove: function(){} }; }, getUserCache: function() { return { get: function() { return null; }, put: function(){}, remove: function(){} }; } };
global.PropertiesService = { getScriptProperties: function() { return { getProperty: function() { return null; } }; }, getUserProperties: function() { return { getProperty: function() { return null; }, setProperty: function(){}, deleteProperty: function(){}, getProperties: function() { return {}; } }; } };
global.Utilities = { getUuid: function() { return 'mock'; } };
global.Logger = { log: function() {} };
global.appendLogRow = function() {};
global.getCancellationDeadlineHours = function() { return 24; };

global.RESERVATION_STATUS = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', NO_SHOW: 'NoShow', VISITED: 'Visited' };
global.DEPOSIT_STATUS = { UNPAID: 'Unpaid', PAID: 'Paid', APPLIED: 'Applied', REFUNDED: 'Refunded', FORFEITED: 'Forfeited' };

// Load source
var gasDir = path.join(__dirname, '..', 'gas-project');
new vm.Script(fs.readFileSync(path.join(gasDir, 'handlers', 'CancelHandler.js'), 'utf8'), { filename: 'CancelHandler.js' }).runInThisContext();

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond) { if (cond) { passed++; console.log('  PASS ' + name); } else { failed++; errors.push(name); console.log('  FAIL ' + name); } }
function assertEqual(name, a, e) { if (a === e) { passed++; console.log('  PASS ' + name); } else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (got ' + JSON.stringify(a) + ')'); } }
function section(t) { console.log('\n== ' + t + ' =='); }

// ─── Helper ───
function makeReservation(status, date, time) {
  return { status: status, reserved_date: date || '2099/12/31', reserved_start: time || '10:00' };
}

// ─── Tests ───

section('canCancelReservation: cancellable states');

var r1 = makeReservation('Pending');
var check1 = canCancelReservation(r1);
assert('Pending is cancellable', check1.canCancel === true);
assertEqual('Pending reason empty', check1.reason, '');

var r2 = makeReservation('Confirmed');
var check2 = canCancelReservation(r2);
assert('Confirmed is cancellable', check2.canCancel === true);

section('canCancelReservation: non-cancellable states');

var r3 = makeReservation('Cancelled');
var check3 = canCancelReservation(r3);
assert('Cancelled not cancellable', check3.canCancel === false);
assertIncludes('Cancelled reason', check3.reason, 'キャンセル');

var r4 = makeReservation('Visited');
var check4 = canCancelReservation(r4);
assert('Visited not cancellable', check4.canCancel === false);
assertIncludes('Visited reason', check4.reason, '来院');

var r5 = makeReservation('NoShow');
var check5 = canCancelReservation(r5);
assert('NoShow not cancellable', check5.canCancel === false);
assertIncludes('NoShow reason', check5.reason, '無断キャンセル');

section('canCancelReservation: deadline check (24h)');

// Future reservation (>24h from now) — use YYYY-MM-DD (Node.js parseable)
var futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
var futureStr = futureDate.getFullYear() + '-' + ('0' + (futureDate.getMonth() + 1)).slice(-2) + '-' + ('0' + futureDate.getDate()).slice(-2);
var r6 = makeReservation('Pending', futureStr, '10:00');
var check6 = canCancelReservation(r6);
assert('Future 48h is cancellable', check6.canCancel === true);

// Past reservation — fixed past date
var r7 = makeReservation('Pending', '2020-01-01', '10:00');
var check7 = canCancelReservation(r7);
assert('Past reservation not cancellable', check7.canCancel === false);
assertIncludes('Deadline reason includes hour count', check7.reason, '時間前');

section('canCancelReservation: near-future under 24h');

var nearFuture = new Date(Date.now() + 12 * 60 * 60 * 1000);
var nearStr = nearFuture.getFullYear() + '-' + ('0' + (nearFuture.getMonth() + 1)).slice(-2) + '-' + ('0' + nearFuture.getDate()).slice(-2);
var nearHour = ('0' + nearFuture.getHours()).slice(-2);
var r8 = makeReservation('Pending', nearStr, nearHour + ':00');
var check8 = canCancelReservation(r8);
assert('12h future not cancellable', check8.canCancel === false);

section('canCancelReservation: near-future over 24h');

var overFuture = new Date(Date.now() + 30 * 60 * 60 * 1000);
var overStr = overFuture.getFullYear() + '-' + ('0' + (overFuture.getMonth() + 1)).slice(-2) + '-' + ('0' + overFuture.getDate()).slice(-2);
var overHour = ('0' + overFuture.getHours()).slice(-2);
var r9 = makeReservation('Pending', overStr, overHour + ':00');
var check9 = canCancelReservation(r9);
assert('30h future is cancellable', check9.canCancel === true);

function assertIncludes(name, hay, needle) {
  if (hay && hay.indexOf(needle) >= 0) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name); }
}

// ─── Results ───
console.log('\n========================================');
console.log('CancelHandler Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) { console.log('\nFailed:'); for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]); }
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
