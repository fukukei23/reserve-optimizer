/**
 * Unit Tests - _createReservationWithLock（ダブルブッキング防止の本体・MLR起票④）
 *
 * 2026-09-10 新設: 既存テストは全てこの実装をstub置換しており（e2e-phase3:166・
 * e2e-wave1-3:206・unit-reservation-handler:914）、LockService+スロット容量チェックの
 * 本体が無検証だった。本テストは ReservationHandler.js の実装を直接ロードして検証する。
 *
 * Run: node tests/unit-reservation-lock.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Test runner ───
var _results = { pass: 0, fail: 0, errors: [] };
function test(name, fn) {
  try {
    fn();
    _results.pass++;
    process.stdout.write('.');
  } catch (e) {
    _results.fail++;
    _results.errors.push({ name: name, error: e.message });
    process.stdout.write('F');
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

console.log('Reservation Lock Tests: ');

// ─── GAS stubs ───
var _logs = [];
global.Logger = { log: function() {} };
global.appendLogRow = function(level, msg) { _logs.push({ level: level, msg: msg }); };

// Lock モック（waitLock/releaseLock の呼び出し記録・例外注入可）
var _lockCalls = [];
var _waitLockError = null;
global.LockService = {
  getScriptLock: function() {
    return {
      waitLock: function(ms) {
        _lockCalls.push('waitLock:' + ms);
        if (_waitLockError) throw _waitLockError;
      },
      releaseLock: function() { _lockCalls.push('releaseLock'); }
    };
  }
};

var _invalidated = 0;
global._invalidateReservationCache = function() { _invalidated++; };

// スロット状況モック（テストごとに切替）
var _bookedSlots = {};
global.getBookedSlotsForDate = function(date) { return _bookedSlots; };
global.getMaxConcurrentBookings = function() { return 3; };

// createReservation モック（テストごとに切替）
var _created = [];
var _createError = null;
global.createReservation = function(data) {
  if (_createError) throw _createError;
  _created.push(data);
  return { id: 'R_TEST_001', patient_name: data.patient_name };
};

// ─── Load source（実装本体をロード・stub置換ではない） ───
var code = fs.readFileSync(path.join(__dirname, '..', 'gas-project', 'handlers', 'ReservationHandler.js'), 'utf8');
new vm.Script(code, { filename: 'ReservationHandler.js' }).runInThisContext();

function resetStubs() {
  _logs = [];
  _lockCalls = [];
  _waitLockError = null;
  _bookedSlots = {};
  _invalidated = 0;
  _created = [];
  _createError = null;
}

var TEMP = { patient_name: 'テスト', phone: '09000000000', reserved_date: '2099/01/01', reserved_start: '10:00' };

// ─── ① 容量内 → 予約作成される ───
test('スロットに空きがあれば予約が作成される(ok:true)', function() {
  resetStubs();
  _bookedSlots = { '10:00': 2 }; // 上限3・残り1
  var r = _createReservationWithLock(TEMP);
  assert(r.ok === true, 'ok should be true, got ' + JSON.stringify(r));
  assert(_created.length === 1, 'createReservation は1回呼ばれるはず・got ' + _created.length);
  assert(_lockCalls.indexOf('releaseLock') !== -1, 'releaseLock は呼ばれるはず');
});

// ─── ② 満席 → SLOT_FULL で拒否・作成されない ───
test('満席スロットは SLOT_FULL で拒否され予約は作成されない', function() {
  resetStubs();
  _bookedSlots = { '10:00': 3 }; // 上限3で満席
  var r = _createReservationWithLock(TEMP);
  assert(r.ok === false, 'ok should be false');
  assert(r.reason === 'SLOT_FULL', 'reason should be SLOT_FULL, got ' + r.reason);
  assert(_created.length === 0, 'createReservation は呼ばれないはず');
  assert(_lockCalls.indexOf('releaseLock') !== -1, '拒否時も releaseLock は呼ばれるはず');
});

// ─── ③ 空き枠なし（0件） → 空きあり扱いで作成される（0=誰も予約していない） ───
test('同時刻の予約が0件なら作成される', function() {
  resetStubs();
  _bookedSlots = {}; // 10:00 の予約なし
  var r = _createReservationWithLock(TEMP);
  assert(r.ok === true, 'ok should be true, got ' + JSON.stringify(r));
});

// ─── ④ ロック取得失敗 → エラー理由で拒否・releaseLock は呼ばれる ───
test('waitLock 例外時はエラー理由で拒否され releaseLock は呼ばれる', function() {
  resetStubs();
  _waitLockError = new Error('lock timeout');
  var r = _createReservationWithLock(TEMP);
  assert(r.ok === false, 'ok should be false');
  assert(r.reason === 'lock timeout', 'reason should carry error message, got ' + r.reason);
  assert(_created.length === 0, 'createReservation は呼ばれないはず');
  assert(_lockCalls.indexOf('releaseLock') !== -1, 'finally で releaseLock は呼ばれるはず');
});

// ─── ⑤ createReservation 失敗 → エラー理由で拒否 ───
test('createReservation 例外時はエラー理由で拒否される', function() {
  resetStubs();
  _createError = new Error('sheet write failed');
  var r = _createReservationWithLock(TEMP);
  assert(r.ok === false, 'ok should be false');
  assert(r.reason === 'sheet write failed', 'reason=' + r.reason);
});

// ─── ⑥ キャッシュ無効化が作成前に呼ばれる（整合性） ───
test('ロック取得後にキャッシュ無効化される', function() {
  resetStubs();
  _bookedSlots = { '10:00': 1 };
  _createReservationWithLock(TEMP);
  assert(_invalidated === 1, '_invalidateReservationCache は1回呼ばれるはず・got ' + _invalidated);
});

// ─── 結果サマリー ───
console.log('');
console.log('Passed: ' + _results.pass + '  Failed: ' + _results.fail);
_results.errors.forEach(function(e) {
  console.log('  FAIL: ' + e.name);
  console.log('         ' + e.error);
});
process.exit(_results.fail > 0 ? 1 : 0);
