/**
 * ReminderService Tests
 *
 * Unit tests for ReminderService logic (no external dependencies).
 * Run via testReminderService() from GAS editor.
 */

function testReminderService() {
  var results = [];

  // Test 1: _buildReservationObj builds correct structure
  results.push(_rsTest('buildReservationObj structure', function() {
    var row = ['R0001', new Date(), '田中太郎', '09012345678', 'U123',
               'First', '初診（30分）', new Date(2026, 0, 15), new Date(2026, 0, 15, 10, 0), new Date(2026, 0, 15, 10, 30),
               'Pending', 'Y', 3000, 'Unpaid', 'N', '', '', 'N', 'N', 5000, ''];
    var obj = _buildReservationObj(row, 1);
    return obj.id === 'R0001' && obj.status === 'Pending' && obj.deposit_status === 'Unpaid';
  }));

  // Test 2: formatDateObj handles null
  results.push(_rsTest('formatDateObj null', function() {
    return formatDateObj(null) === '';
  }));

  // Test 3: formatDateObj handles string
  results.push(_rsTest('formatDateObj string passthrough', function() {
    return formatDateObj('2026/01/15') === '2026/01/15';
  }));

  // Test 4: formatDateObj handles NaN string
  results.push(_rsTest('formatDateObj NaN string', function() {
    return formatDateObj('NaN/NaN/NaN') === '';
  }));

  // Test 5: formatTimeObj handles null
  results.push(_rsTest('formatTimeObj null', function() {
    return formatTimeObj(null) === '';
  }));

  // Test 6: formatTimeObj formats correctly
  results.push(_rsTest('formatTimeObj format', function() {
    var d = new Date(2026, 0, 1, 9, 5);
    return formatTimeObj(d) === '09:05';
  }));

  // Test 7: getTreatmentDuration returns correct values
  results.push(_rsTest('getTreatmentDuration known', function() {
    return getTreatmentDuration('再診（60分）') === 60 && getTreatmentDuration('初診（30分）') === 30;
  }));

  // Test 8: getTreatmentDuration fallback
  results.push(_rsTest('getTreatmentDuration fallback', function() {
    return getTreatmentDuration('Unknown') === DEFAULT_TREATMENT_DURATION;
  }));

  // Test 9: _constantTimeEqual equal strings
  results.push(_rsTest('constantTimeEqual equal', function() {
    return _constantTimeEqual('abc123', 'abc123') === true;
  }));

  // Test 10: _constantTimeEqual different strings
  results.push(_rsTest('constantTimeEqual different', function() {
    return _constantTimeEqual('abc123', 'abc124') === false;
  }));

  // Test 11: _constantTimeEqual different lengths
  results.push(_rsTest('constantTimeEqual diff length', function() {
    return _constantTimeEqual('abc', 'ab') === false;
  }));

  // Test 12: _constantTimeEqual null inputs
  results.push(_rsTest('constantTimeEqual null', function() {
    return _constantTimeEqual(null, 'abc') === false;
  }));

  // Test 13: handleYesNoConfirm yes
  results.push(_rsTest('handleYesNoConfirm yes', function() {
    var result = handleYesNoConfirm('はい', null);
    return result.confirmed === true;
  }));

  // Test 14: handleYesNoConfirm no
  results.push(_rsTest('handleYesNoConfirm no', function() {
    var result = handleYesNoConfirm('いいえ', null);
    return result.confirmed === false;
  }));

  // Test 15: handleYesNoConfirm cancel
  results.push(_rsTest('handleYesNoConfirm cancel', function() {
    var result = handleYesNoConfirm('やめる', null);
    return result.confirmed === false;
  }));

  return results;
}

function _rsTest(name, fn) {
  try {
    var passed = fn();
    return { name: name, passed: passed, message: passed ? 'PASS' : 'FAIL' };
  } catch (e) {
    return { name: name, passed: false, message: 'ERROR: ' + e.message };
  }
}
