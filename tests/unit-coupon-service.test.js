/**
 * Unit Tests - CouponService
 * TDD RED phase: W1-2 クーポン機能
 *
 * Run: node tests/unit-coupon-service.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockCache = {};
var _mockSheets = {};
var _mockScriptProps = {};

function addMockSheet(name, headers, rows) { _mockSheets[name] = { headers: headers || [], rows: rows || [] }; }
function makeSheetProxy(name) {
  var s = _mockSheets[name];
  if (!s) return null;
  return {
    getDataRange: function() { return { getValues: function() { return [s.headers].concat(s.rows); } }; },
    appendRow: function(row) { s.rows.push(row); },
    getLastRow: function() { return s.rows.length + 1; },
    getRange: function(row, col, numRows, numCols) {
      if (numRows && numCols) {
        // Range for batch read/write
        return {
          getValues: function() {
            var result = [];
            for (var i = 0; i < numRows; i++) {
              var rowData = [];
              for (var j = 0; j < numCols; j++) {
                rowData.push(s.rows[row - 2 + i] ? (s.rows[row - 2 + i][col - 1 + j] || '') : '');
              }
              result.push(rowData);
            }
            return result;
          },
          setValues: function() {}
        };
      }
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
  getScriptCache: function() { return { get: function(k) { return _mockCache[k] || null; }, put: function(k,v) { _mockCache[k]=v; }, remove: function(k) { delete _mockCache[k]; } }; }
};
global.PropertiesService = {
  getScriptProperties: function() {
    return { getProperty: function(k) { return _mockScriptProps[k] || null; }, setProperty: function(k,v) { _mockScriptProps[k]=v; } };
  },
  getUserProperties: function() {
    return { getProperty: function() { return null; }, setProperty: function() {}, deleteProperty: function() {} };
  }
};
global.Utilities = {
  getUuid: function() { return Math.random().toString(36).substring(2, 10); },
  formatDate: function(d, tz, fmt) {
    return d.getFullYear() + '/' + ('0' + (d.getMonth()+1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
  }
};
global.Logger = { log: function() {} };
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global._getCachedSpreadsheet = function() { return global.SpreadsheetApp.openById(); };

// SheetConfig stubs
global.SHEET_NAMES = { RESERVATIONS: 'reservations', WAITLIST: 'waitlist', WEEKLY_SUMMARY: 'weekly_summary', TICKETS: 'tickets', LOG: 'log', CUSTOMERS: 'customers' };

// CRM stubs
global.getCustomerByLineUserId = function() { return _stubCRM; };
var _stubCRM = null;

// Load source
var gasDir = path.join(__dirname, '..', 'gas-project');
new vm.Script(fs.readFileSync(path.join(gasDir, 'config', 'ScriptProperties.js'), 'utf8'), { filename: 'ScriptProperties.js' }).runInThisContext();
new vm.Script(fs.readFileSync(path.join(gasDir, 'services', 'CouponService.js'), 'utf8'), { filename: 'CouponService.js' }).runInThisContext();

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond) { if (cond) { passed++; console.log('  PASS ' + name); } else { failed++; errors.push(name); console.log('  FAIL ' + name); } }
function assertEqual(name, a, e) { if (a === e) { passed++; console.log('  PASS ' + name); } else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(e) + ')'); } }
function section(t) { console.log('\n== ' + t + ' =='); }

// ─── Setup helper ───
var COUPON_HEADERS_TEST = ['coupon_id', 'code', 'discount_type', 'discount_value', 'expiry_date', 'use_limit', 'use_count', 'target_tags', 'active'];

function setupCoupons(rows) {
  // reset coupon cache
  if (typeof _invalidateCouponCache === 'function') _invalidateCouponCache();
  addMockSheet('coupons', COUPON_HEADERS_TEST, rows);
}

var TODAY = '2026/06/12';
var TOMORROW = '2026/06/13';
var YESTERDAY = '2026/06/11';

// ─── getCouponByCode ───

section('getCouponByCode');
setupCoupons([
  ['C001', 'SUMMER10', 'percent', 10, TOMORROW, 100, 0, '', 'TRUE'],
  ['C002', 'FLAT500', 'amount', 500, TOMORROW, 5, 3, '', 'TRUE'],
  ['C003', 'INACTIVE', 'percent', 20, TOMORROW, 0, 0, '', 'FALSE']
]);

var c = getCouponByCode('SUMMER10');
assert('found by code', c !== null);
assertEqual('correct id', c.coupon_id, 'C001');
assertEqual('discount_type', c.discount_type, 'percent');
assertEqual('discount_value', c.discount_value, 10);

assert('unknown code returns null', getCouponByCode('NOTEXIST') === null);
assert('case sensitive', getCouponByCode('summer10') === null);

// ─── validateCoupon ───

section('validateCoupon: valid cases');
var today = new Date(2026, 5, 12); // 2026-06-12

setupCoupons([
  ['C001', 'VALID10', 'percent', 10, '2026/12/31', 100, 5, '', 'TRUE']
]);
var r1 = validateCoupon('VALID10', 'U001', today);
assert('valid coupon ok', r1.ok === true);
assert('valid coupon has coupon object', r1.coupon !== null);

section('validateCoupon: unknown code');
setupCoupons([]);
var rUnknown = validateCoupon('UNKNOWN', 'U001', today);
assert('unknown returns false', rUnknown.ok === false);
assertEqual('error is NOT_FOUND', rUnknown.error, 'NOT_FOUND');

section('validateCoupon: inactive');
setupCoupons([
  ['C003', 'INACTIVE', 'percent', 20, '2026/12/31', 0, 0, '', 'FALSE']
]);
var rInactive = validateCoupon('INACTIVE', 'U001', today);
assert('inactive returns false', rInactive.ok === false);
assertEqual('error is INACTIVE', rInactive.error, 'INACTIVE');

section('validateCoupon: expired');
setupCoupons([
  ['C004', 'EXPIRED', 'percent', 10, YESTERDAY, 100, 0, '', 'TRUE']
]);
var rExpired = validateCoupon('EXPIRED', 'U001', today);
assert('expired returns false', rExpired.ok === false);
assertEqual('error is EXPIRED', rExpired.error, 'EXPIRED');

section('validateCoupon: expiry boundary — today is valid');
setupCoupons([
  ['C005', 'EXPTODAY', 'percent', 10, TODAY, 100, 0, '', 'TRUE']
]);
var rToday = validateCoupon('EXPTODAY', 'U001', today);
assert('expiry today is still valid', rToday.ok === true);

section('validateCoupon: use_limit exceeded');
setupCoupons([
  ['C006', 'MAXED', 'amount', 500, '2026/12/31', 3, 3, '', 'TRUE']
]);
var rMaxed = validateCoupon('MAXED', 'U001', today);
assert('use_limit exceeded returns false', rMaxed.ok === false);
assertEqual('error is USE_LIMIT', rMaxed.error, 'USE_LIMIT');

section('validateCoupon: use_limit 0 means unlimited');
setupCoupons([
  ['C007', 'UNLIMITED', 'percent', 5, '2026/12/31', 0, 9999, '', 'TRUE']
]);
var rUnlimited = validateCoupon('UNLIMITED', 'U001', today);
assert('use_limit=0 is always valid', rUnlimited.ok === true);

section('validateCoupon: target_tags mismatch');
setupCoupons([
  ['C008', 'VIPONLY', 'percent', 20, '2026/12/31', 0, 0, 'vip', 'TRUE']
]);
_stubCRM = { tags: 'new,regular' };
var rTagMiss = validateCoupon('VIPONLY', 'U001', today);
assert('tag mismatch returns false', rTagMiss.ok === false);
assertEqual('error is TAG_MISMATCH', rTagMiss.error, 'TAG_MISMATCH');

section('validateCoupon: target_tags match');
setupCoupons([
  ['C009', 'VIPOK', 'percent', 20, '2026/12/31', 0, 0, 'vip', 'TRUE']
]);
_stubCRM = { tags: 'vip,regular' };
var rTagMatch = validateCoupon('VIPOK', 'U001', today);
assert('tag match returns ok', rTagMatch.ok === true);

section('validateCoupon: target_tags empty = all users');
setupCoupons([
  ['C010', 'ALLOK', 'percent', 10, '2026/12/31', 0, 0, '', 'TRUE']
]);
_stubCRM = { tags: 'new' };
var rAllOk = validateCoupon('ALLOK', 'U001', today);
assert('empty target_tags applies to all', rAllOk.ok === true);

section('validateCoupon: no CRM record and empty target_tags');
setupCoupons([
  ['C011', 'NOCRM', 'percent', 10, '2026/12/31', 0, 0, '', 'TRUE']
]);
_stubCRM = null;
var rNoCRM = validateCoupon('NOCRM', 'U001', today);
assert('no CRM record with empty tags is ok', rNoCRM.ok === true);

// ─── calculateDiscount ───

section('calculateDiscount: percent');
var couponPercent = { discount_type: 'percent', discount_value: 10 };
assertEqual('10% of 1000 = 100', calculateDiscount(1000, couponPercent), 100);
assertEqual('10% of 1500 = 150', calculateDiscount(1500, couponPercent), 150);

var couponPercent20 = { discount_type: 'percent', discount_value: 20 };
assertEqual('20% of 1000 = 200', calculateDiscount(1000, couponPercent20), 200);

section('calculateDiscount: amount');
var couponAmount = { discount_type: 'amount', discount_value: 500 };
assertEqual('500 off 1000: discount=500', calculateDiscount(1000, couponAmount), 500);
// discount amount is capped at baseAmount (caller computes base - discount)
assertEqual('500 off 300: discount capped at 300', calculateDiscount(300, couponAmount), 300);

section('calculateDiscount: 100% discount');
var couponFull = { discount_type: 'percent', discount_value: 100 };
assertEqual('100% off 1000: discount=1000', calculateDiscount(1000, couponFull), 1000);

// ─── applyCoupon (use_count increment) ───

section('applyCoupon: increments use_count');
setupCoupons([
  ['C001', 'INCR', 'percent', 10, '2026/12/31', 100, 5, '', 'TRUE']
]);
applyCoupon('C001');
// Re-read coupon to verify increment
_invalidateCouponCache();
var afterApply = getCouponByCode('INCR');
assertEqual('use_count incremented to 6', afterApply.use_count, 6);

section('applyCoupon: idempotency guard — already at limit');
setupCoupons([
  ['C002', 'ATMAX', 'percent', 10, '2026/12/31', 3, 3, '', 'TRUE']
]);
applyCoupon('C002'); // should NOT increment past limit
_invalidateCouponCache();
var afterMaxApply = getCouponByCode('ATMAX');
assertEqual('use_count not exceeded (still 3)', afterMaxApply.use_count, 3);

// ─── isFeatureCouponEnabled ───

section('isFeatureCouponEnabled');
_mockScriptProps = {};
assert('disabled by default', isFeatureCouponEnabled() === false);
_mockScriptProps['FEATURE_COUPON'] = 'true';
assert('enabled when set', isFeatureCouponEnabled() === true);
_mockScriptProps = {};

// ─── エッジケース ───

section('M3: validateCoupon: CRM null + target_tags → TAG_MISMATCH');
setupCoupons([
  ['C_M3', 'VIPONLY', 'percent', 10, TOMORROW, 100, 0, 'vip', 'TRUE']
]);
_stubCRM = null;
var rM3 = validateCoupon('VIPONLY', 'U001', new Date(2026, 5, 12));
assert('M3: ok は false', rM3.ok === false);
assertEqual('M3: error は TAG_MISMATCH', rM3.error, 'TAG_MISMATCH');

section('M4: applyCoupon: 存在しないコードはエラーにならない');
setupCoupons([]);
var m4Threw = false;
try { applyCoupon('NOTEXIST'); } catch(e) { m4Threw = true; }
assert('M4: 例外が発生しない', !m4Threw);

section('L1: calculateDiscount: baseAmount=0 → 0');
var cPctL1 = { discount_type: 'percent', discount_value: 10 };
assertEqual('L1: percent 10% × 0 = 0', calculateDiscount(0, cPctL1), 0);
var cAmtL1 = { discount_type: 'amount', discount_value: 500 };
assertEqual('L1: amount 500 でも負にならず 0', calculateDiscount(0, cAmtL1), 0);

// ─── Results ───
console.log('\n========================================');
console.log('CouponService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) { console.log('\nFailed:'); for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]); }
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
