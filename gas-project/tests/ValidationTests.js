/**
 * Validation Tests - Unit tests for ValidationUtils
 *
 * Pure function tests with no SheetService dependency.
 * Run in GAS environment only (uses Utilities.formatDate).
 */

/**
 * Run all validation tests
 * @returns {Array<{name: string, passed: boolean, message: string}>}
 */
function testValidationUtils() {
  var tests = [];

  // ── validatePhoneNumber ──
  tests.push(_assert('validatePhoneNumber: 11-digit mobile', validatePhoneNumber('09012345678'), true));
  tests.push(_assert('validatePhoneNumber: 10-digit landline', validatePhoneNumber('0312345678'), true));
  tests.push(_assert('validatePhoneNumber: 11-digit with hyphens', validatePhoneNumber('090-1234-5678'), true));
  tests.push(_assert('validatePhoneNumber: too short', validatePhoneNumber('123'), false));
  tests.push(_assert('validatePhoneNumber: no leading 0', validatePhoneNumber('9012345678'), false));
  tests.push(_assert('validatePhoneNumber: empty', validatePhoneNumber(''), false));
  tests.push(_assert('validatePhoneNumber: null', validatePhoneNumber(null), false));

  // ── normalizePhoneInput ──
  tests.push(_assert('normalizePhoneInput: +81 conversion', normalizePhoneInput('+819012345678'), '09012345678'));
  tests.push(_assert('normalizePhoneInput: hyphen removal', normalizePhoneInput('090-1234-5678'), '09012345678'));
  tests.push(_assert('normalizePhoneInput: space removal', normalizePhoneInput('090 1234 5678'), '09012345678'));
  tests.push(_assert('normalizePhoneInput: fullwidth parens', normalizePhoneInput('（090）12345678'), '09012345678'));
  tests.push(_assert('normalizePhoneInput: empty string', normalizePhoneInput(''), ''));
  tests.push(_assert('normalizePhoneInput: null', normalizePhoneInput(null), ''));

  // ── validateTime ──
  tests.push(_assert('validateTime: 09:00', validateTime('09:00'), true));
  tests.push(_assert('validateTime: 23:59', validateTime('23:59'), true));
  tests.push(_assert('validateTime: 00:00', validateTime('00:00'), true));
  tests.push(_assert('validateTime: 25:00 invalid', validateTime('25:00'), false));
  tests.push(_assert('validateTime: 12:60 invalid', validateTime('12:60'), false));
  tests.push(_assert('validateTime: abc invalid', validateTime('abc'), false));
  tests.push(_assert('validateTime: empty', validateTime(''), false));

  // ── normalizeTimeInput ──
  tests.push(_assert('normalizeTimeInput: "10" → "10:00"', normalizeTimeInput('10'), '10:00'));
  tests.push(_assert('normalizeTimeInput: "10時" → "10:00"', normalizeTimeInput('10時'), '10:00'));
  tests.push(_assert('normalizeTimeInput: "10時半" → "10:30"', normalizeTimeInput('10時半'), '10:30'));
  tests.push(_assert('normalizeTimeInput: "午後3時" → "15:00"', normalizeTimeInput('午後3時'), '15:00'));
  tests.push(_assert('normalizeTimeInput: "3pm" → "15:00"', normalizeTimeInput('3pm'), '15:00'));
  tests.push(_assert('normalizeTimeInput: "10時30分" → "10:30"', normalizeTimeInput('10時30分'), '10:30'));

  // ── validateDate ──
  tests.push(_assert('validateDate: YYYY-MM-DD', validateDate('2026-02-20'), true));
  tests.push(_assert('validateDate: YYYY/MM/DD', validateDate('2026/02/20'), true));
  tests.push(_assert('validateDate: MM/DD/YYYY', validateDate('02/20/2026'), true));
  tests.push(_assert('validateDate: invalid format', validateDate('20-02-2026'), false));
  tests.push(_assert('validateDate: empty', validateDate(''), false));

  // ── validateEmail ──
  tests.push(_assert('validateEmail: valid', validateEmail('test@example.com'), true));
  tests.push(_assert('validateEmail: no @', validateEmail('testexample.com'), false));
  tests.push(_assert('validateEmail: no domain', validateEmail('test@'), false));
  tests.push(_assert('validateEmail: empty', validateEmail(''), false));

  // ── sanitizeInput ──
  tests.push(_assert('sanitizeInput: removes HTML tags', sanitizeInput('<script>alert(1)</script>hello'), 'alert(1)hello'));
  tests.push(_assert('sanitizeInput: removes angle brackets', sanitizeInput('a<b>c'), 'ac'));
  tests.push(_assert('sanitizeInput: trims whitespace', sanitizeInput('  hello  '), 'hello'));
  tests.push(_assert('sanitizeInput: null returns empty', sanitizeInput(null), ''));

  // ── validateAmount ──
  tests.push(_assert('validateAmount: positive', validateAmount(1000), true));
  tests.push(_assert('validateAmount: string number', validateAmount('5000'), true));
  tests.push(_assert('validateAmount: zero', validateAmount(0), false));
  tests.push(_assert('validateAmount: negative', validateAmount(-100), false));
  tests.push(_assert('validateAmount: too large', validateAmount(2000000), false));

  // ── validateName ──
  tests.push(_assert('validateName: Japanese', validateName('田中太郎'), true));
  tests.push(_assert('validateName: alphanumeric', validateName('John Smith'), true));
  tests.push(_assert('validateName: empty', validateName(''), false));
  tests.push(_assert('validateName: too long (51 chars)', validateName(new Array(52).join('a')), false));

  // ── validateMenuType ──
  tests.push(_assert('validateMenuType: 初診', validateMenuType('初診（30分）'), true));
  tests.push(_assert('validateMenuType: 再診30', validateMenuType('再診（30分）'), true));
  tests.push(_assert('validateMenuType: 再診60', validateMenuType('再診（60分）'), true));
  tests.push(_assert('validateMenuType: invalid', validateMenuType('カウンセリング'), false));

  return tests;
}

/**
 * Assert helper — creates a test result object
 * @param {string} name - Test name
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @returns {{name: string, passed: boolean, message: string}}
 */
function _assert(name, actual, expected) {
  var passed = actual === expected;
  return {
    name: name,
    passed: passed,
    message: passed ? 'OK' : 'Expected: ' + JSON.stringify(expected) + ', Got: ' + JSON.stringify(actual)
  };
}

/**
 * Assert not equal
 */
function _assertNotEqual(name, actual, unexpected) {
  var passed = actual !== unexpected;
  return {
    name: name,
    passed: passed,
    message: passed ? 'OK' : 'Expected NOT: ' + JSON.stringify(unexpected) + ', Got: ' + JSON.stringify(actual)
  };
}

/**
 * Assert truthy
 */
function _assertTrue(name, actual) {
  var passed = !!actual;
  return {
    name: name,
    passed: passed,
    message: passed ? 'OK' : 'Expected truthy, Got: ' + JSON.stringify(actual)
  };
}

/**
 * Assert falsy
 */
function _assertFalse(name, actual) {
  var passed = !actual;
  return {
    name: name,
    passed: passed,
    message: passed ? 'OK' : 'Expected falsy, Got: ' + JSON.stringify(actual)
  };
}

/**
 * Assert throws — verifies that fn() throws an exception
 * @param {string} name - Test name
 * @param {Function} fn - Function to execute
 * @returns {{name: string, passed: boolean, message: string}}
 */
function _assertThrows(name, fn) {
  try {
    fn();
    return { name: name, passed: false, message: 'Expected exception but none was thrown' };
  } catch (e) {
    return { name: name, passed: true, message: 'OK (threw: ' + e.message + ')' };
  }
}

/**
 * Assert deep equal — compares arrays/objects by JSON serialization
 */
function _assertDeepEqual(name, actual, expected) {
  var actualJson = JSON.stringify(actual);
  var expectedJson = JSON.stringify(expected);
  var passed = actualJson === expectedJson;
  return {
    name: name,
    passed: passed,
    message: passed ? 'OK' : 'Expected: ' + expectedJson + ', Got: ' + actualJson
  };
}

/**
 * Assert instance of
 */
function _assertInstanceOf(name, actual, expectedType) {
  var passed = typeof actual === expectedType;
  return {
    name: name,
    passed: passed,
    message: passed ? 'OK' : 'Expected type: ' + expectedType + ', Got: ' + typeof actual + ' (' + JSON.stringify(actual) + ')'
  };
}
