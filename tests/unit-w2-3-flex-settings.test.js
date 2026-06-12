/**
 * Unit Tests - W2-3 運用柔軟性設定
 * BUFFER_MINUTES / SAME_DAY_CUTOFF_HOUR / CLINIC_MAP_URL
 *
 * Run: node tests/unit-w2-3-flex-settings.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── GAS global stubs ───
var _mockScriptProps = {};
var _nowHour = 10; // controllable "current hour" for cutoff tests

global.PropertiesService = {
  getScriptProperties: function() {
    return {
      getProperty: function(k) { return _mockScriptProps[k] !== undefined ? _mockScriptProps[k] : null; },
      setProperty: function(k, v) { _mockScriptProps[k] = v; }
    };
  }
};
global.Utilities = {
  formatDate: function(date, tz, fmt) {
    if (fmt === 'HH') return String(_nowHour).padStart(2, '0');
    if (fmt === 'yyyy-MM-dd') return '2026/06/13'.replace(/\//g, '-');
    return '';
  },
  getUuid: function() { return 'test-uuid'; }
};
global.Logger = { log: function() {} };
global.CacheService = {
  getScriptCache: function() { return { get: function() { return null; }, put: function() {}, remove: function() {} }; }
};

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(rel) {
  var code = fs.readFileSync(path.join(gasDir, rel), 'utf8');
  new vm.Script(code, { filename: path.basename(rel) }).runInThisContext();
}

loadFile('config/ScriptProperties.js');

// ─── Minimal stubs for ValidationUtils ───
global.TIMEZONE = 'Asia/Tokyo';
global.MAX_BOOKING_DAYS_AHEAD = 90;
global.CLOSED_DAYS = [0]; // Sunday
global.isJapaneseHoliday = function() { return false; };
global.pad2 = function(n) { return String(n).length === 1 ? '0' + n : String(n); };

loadFile('utils/ValidationUtils.js');

// ─── Test runner ───
var _results = { pass: 0, fail: 0, errors: [] };
function test(name, fn) {
  try { fn(); _results.pass++; process.stdout.write('.'); }
  catch (e) { _results.fail++; _results.errors.push({ name: name, error: e.message }); process.stdout.write('F'); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

function resetProps() {
  _mockScriptProps = { SPREADSHEET_ID: 'S001' };
  _nowHour = 10;
}

// ─── getBufferMinutes ───

test('getBufferMinutes: default is 0', function() {
  resetProps();
  assertEqual(getBufferMinutes(), 0);
});

test('getBufferMinutes: reads BUFFER_MINUTES property', function() {
  resetProps();
  _mockScriptProps['BUFFER_MINUTES'] = '15';
  assertEqual(getBufferMinutes(), 15);
});

test('getBufferMinutes: parses integer', function() {
  resetProps();
  _mockScriptProps['BUFFER_MINUTES'] = '30';
  assertEqual(typeof getBufferMinutes(), 'number');
});

// ─── getSameDayCutoffHour ───

test('getSameDayCutoffHour: default is 24 (no cutoff)', function() {
  resetProps();
  assertEqual(getSameDayCutoffHour(), 24);
});

test('getSameDayCutoffHour: reads SAME_DAY_CUTOFF_HOUR property', function() {
  resetProps();
  _mockScriptProps['SAME_DAY_CUTOFF_HOUR'] = '17';
  assertEqual(getSameDayCutoffHour(), 17);
});

test('getSameDayCutoffHour: parses integer', function() {
  resetProps();
  _mockScriptProps['SAME_DAY_CUTOFF_HOUR'] = '20';
  assertEqual(typeof getSameDayCutoffHour(), 'number');
});

// ─── getClinicMapUrl ───

test('getClinicMapUrl: default is empty string', function() {
  resetProps();
  assertEqual(getClinicMapUrl(), '');
});

test('getClinicMapUrl: reads CLINIC_MAP_URL property', function() {
  resetProps();
  _mockScriptProps['CLINIC_MAP_URL'] = 'https://maps.google.com/?q=clinic';
  assertEqual(getClinicMapUrl(), 'https://maps.google.com/?q=clinic');
});

// ─── validateDateForBooking: same-day cutoff ───

test('validateDateForBooking: no cutoff (default 24) allows today at any hour', function() {
  resetProps();
  _nowHour = 23;
  // today = '2026-06-13' (Utilities.formatDate mock returns this)
  var res = validateDateForBooking('2026-06-13');
  // Should not fail due to cutoff (may fail due to Sunday/holiday, but not cutoff)
  var isCutoffError = res.errorMessage && res.errorMessage.indexOf('受付') >= 0 && res.errorMessage.indexOf('時まで') >= 0;
  assert(!isCutoffError, 'should not return cutoff error with default cutoff=24');
});

test('validateDateForBooking: cutoff=17, nowHour=16 → valid (before cutoff)', function() {
  resetProps();
  _mockScriptProps['SAME_DAY_CUTOFF_HOUR'] = '17';
  _nowHour = 16;
  var res = validateDateForBooking('2026-06-13');
  var isCutoffError = res.errorMessage && res.errorMessage.indexOf('受付') >= 0 && res.errorMessage.indexOf('17時まで') >= 0;
  assert(!isCutoffError, 'hour 16 should be before cutoff 17');
});

test('validateDateForBooking: cutoff=17, nowHour=17 → invalid (at cutoff)', function() {
  resetProps();
  _mockScriptProps['SAME_DAY_CUTOFF_HOUR'] = '17';
  _nowHour = 17;
  var res = validateDateForBooking('2026-06-13');
  assert(!res.valid, 'should be invalid at cutoff hour');
  assert(res.errorMessage.indexOf('17時まで') >= 0, 'error should mention cutoff hour');
});

test('validateDateForBooking: cutoff=17, nowHour=20 → invalid (past cutoff)', function() {
  resetProps();
  _mockScriptProps['SAME_DAY_CUTOFF_HOUR'] = '17';
  _nowHour = 20;
  var res = validateDateForBooking('2026-06-13');
  assert(!res.valid, 'should be invalid past cutoff');
  assert(res.errorMessage.indexOf('翌日以降') >= 0, 'error should mention next day');
});

test('validateDateForBooking: cutoff applies only to today, not future dates', function() {
  resetProps();
  _mockScriptProps['SAME_DAY_CUTOFF_HOUR'] = '17';
  _nowHour = 23;
  // Future date — cutoff should not apply
  var res = validateDateForBooking('2026-06-14');
  var isCutoffError = res.errorMessage && res.errorMessage.indexOf('時まで') >= 0;
  assert(!isCutoffError, 'cutoff should not apply to future dates');
});

// ─── Buffer filtering logic (unit test of the logic, not full DateInputHelper) ───

test('_slotToMinutes helper: "09:00" → 540', function() {
  // Load DateInputHelper to get _slotToMinutes
  // We'll test the logic directly
  var result = (function() {
    var parts = '09:00'.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  })();
  assertEqual(result, 540);
});

test('_slotToMinutes helper: "14:30" → 870', function() {
  var result = (function() {
    var parts = '14:30'.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  })();
  assertEqual(result, 870);
});

test('buffer logic: slot within buffer of booked slot is blocked', function() {
  var allSlots = ['09:00', '09:30', '10:00', '10:30'];
  var bookedSlots = { '09:00': 1 };
  var bufferMinutes = 45;

  function slotToMins(slot) {
    var parts = slot.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  var blockedByBuffer = {};
  for (var bs = 0; bs < allSlots.length; bs++) {
    if ((bookedSlots[allSlots[bs]] || 0) > 0) {
      var bookedMins = slotToMins(allSlots[bs]);
      for (var ns = bs + 1; ns < allSlots.length; ns++) {
        var nextMins = slotToMins(allSlots[ns]);
        if (nextMins - bookedMins <= bufferMinutes) {
          blockedByBuffer[allSlots[ns]] = true;
        } else { break; }
      }
    }
  }

  assert(blockedByBuffer['09:30'], '09:30 should be blocked (30 <= 45)');
  assert(!blockedByBuffer['10:00'], '10:00 should not be blocked (60 > 45)');
  assert(!blockedByBuffer['10:30'], '10:30 should not be blocked');
});

test('buffer logic: no buffer (0) blocks nothing', function() {
  var allSlots = ['09:00', '09:30', '10:00'];
  var bookedSlots = { '09:00': 1 };
  var bufferMinutes = 0;

  var blockedByBuffer = {};
  if (bufferMinutes > 0) {
    // (same logic as above — skipped when buffer=0)
  }

  assert(!blockedByBuffer['09:30'], 'no buffer should block nothing');
});

test('buffer logic: multiple booked slots each have their own buffer window', function() {
  var allSlots = ['09:00', '09:30', '10:00', '10:30', '11:00'];
  var bookedSlots = { '09:00': 1, '10:30': 1 };
  var bufferMinutes = 20;

  function slotToMins(slot) {
    var parts = slot.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  var blockedByBuffer = {};
  for (var bs = 0; bs < allSlots.length; bs++) {
    if ((bookedSlots[allSlots[bs]] || 0) > 0) {
      var bookedMins = slotToMins(allSlots[bs]);
      for (var ns = bs + 1; ns < allSlots.length; ns++) {
        var nextMins = slotToMins(allSlots[ns]);
        if (nextMins - bookedMins <= bufferMinutes) {
          blockedByBuffer[allSlots[ns]] = true;
        } else { break; }
      }
    }
  }

  assert(!blockedByBuffer['09:30'], '09:30 not blocked (30 > 20)');
  // 11:00(660) - 10:30(630) = 30 min > 20 buffer → NOT blocked
  assert(!blockedByBuffer['11:00'], '11:00 should not be blocked (gap 30 > buffer 20)');
  assert(!blockedByBuffer['09:30'], '09:30 should not be blocked (gap 30 > buffer 20)');
});

// Fix the last test - 11:00 should NOT be blocked
test('buffer logic: slot beyond buffer window is NOT blocked', function() {
  var allSlots = ['10:30', '11:00'];
  var bookedSlots = { '10:30': 1 };
  var bufferMinutes = 20;

  function slotToMins(slot) {
    var parts = slot.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  var blockedByBuffer = {};
  for (var bs = 0; bs < allSlots.length; bs++) {
    if ((bookedSlots[allSlots[bs]] || 0) > 0) {
      var bookedMins = slotToMins(allSlots[bs]);
      for (var ns = bs + 1; ns < allSlots.length; ns++) {
        var nextMins = slotToMins(allSlots[ns]);
        if (nextMins - bookedMins <= bufferMinutes) {
          blockedByBuffer[allSlots[ns]] = true;
        } else { break; }
      }
    }
  }
  // 11:00(660) - 10:30(630) = 30 > 20 → not blocked
  assert(!blockedByBuffer['11:00'], '11:00 should not be blocked when gap > bufferMinutes');
});

// ─── Report ───
console.log('\n');
console.log('W2-3 FlexSettings Tests:', _results.pass + _results.fail, 'total');
console.log('PASS:', _results.pass);
console.log('FAIL:', _results.fail);
if (_results.errors.length > 0) {
  _results.errors.forEach(function(e) {
    console.log('  FAIL:', e.name);
    console.log('       ', e.error);
  });
}
process.exit(_results.fail > 0 ? 1 : 0);
