/**
 * QuickReport Tests
 *
 * Unit tests for QuickReportService pure logic (no external dependencies).
 * Run via testQuickReport() from GAS editor.
 */

function _qrTest(name, fn) {
  try {
    var ok = fn();
    return { name: name, passed: !!ok };
  } catch (e) {
    return { name: name, passed: false, error: e.message };
  }
}

function testQuickReport() {
  var results = [];

  // isValidVisitsInput
  results.push(_qrTest('isValidVisitsInput 正の整数', function() {
    return isValidVisitsInput('25') === true && isValidVisitsInput('0') === true;
  }));
  results.push(_qrTest('isValidVisitsInput 非数値', function() {
    return isValidVisitsInput('abc') === false && isValidVisitsInput('') === false;
  }));
  results.push(_qrTest('isValidVisitsInput 負・小数', function() {
    return isValidVisitsInput('-5') === false && isValidVisitsInput('3.5') === false;
  }));
  results.push(_qrTest('isValidVisitsInput 前後スペース許容', function() {
    return isValidVisitsInput('  12  ') === true;
  }));

  // calcPhoneWindowVisits
  results.push(_qrTest('calcPhoneWindowVisits 通常', function() {
    return calcPhoneWindowVisits(25, 20) === 5;
  }));
  results.push(_qrTest('calcPhoneWindowVisits 報告<完了時は0', function() {
    return calcPhoneWindowVisits(10, 20) === 0;
  }));

  // isWorkingDay
  results.push(_qrTest('isWorkingDay 平日営業', function() {
    return isWorkingDay('2026-07-27', '1,2,3,4,5') === true;  // 月曜
  }));
  results.push(_qrTest('isWorkingDay 日曜休診', function() {
    return isWorkingDay('2026-07-26', '1,2,3,4,5') === false;  // 日曜
  }));
  results.push(_qrTest('isWorkingDay 空文字', function() {
    return isWorkingDay('2026-07-27', '') === false;
  }));

  return results;
}
