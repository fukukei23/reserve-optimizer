/**
 * Date Parser Tests - Unit tests for DateUtils and DateInputHelper
 *
 * Tests date/time parsing, formatting, and calculation functions.
 * Run in GAS environment only (uses Utilities.formatDate).
 */

/**
 * Run all date parser tests
 * @returns {Array<{name: string, passed: boolean, message: string}>}
 */
function testDateUtils() {
  var tests = [];

  // ── formatDate (GAS Utilities.formatDate) ──
  try {
    var date1 = new Date('2026-02-20T00:00:00+09:00');
    var formatted1 = formatDate(date1);
    tests.push(_assert('formatDate: YYYY-MM-DD', formatted1, '2026-02-20'));
  } catch (e) {
    tests.push({name: 'formatDate: YYYY-MM-DD', passed: false, message: 'Error: ' + e.toString()});
  }

  // ── addDays ──
  try {
    var date2 = new Date('2026-02-20T00:00:00+09:00');
    var result2 = addDays(date2, 7);
    var formatted2 = formatDate(result2);
    tests.push(_assert('addDays: +7 days', formatted2, '2026-02-27'));
  } catch (e) {
    tests.push({name: 'addDays: +7 days', passed: false, message: 'Error: ' + e.toString()});
  }

  try {
    var date2b = new Date('2026-03-01T00:00:00+09:00');
    var result2b = addDays(date2b, -1);
    var formatted2b = formatDate(result2b);
    tests.push(_assert('addDays: -1 day (month boundary)', formatted2b, '2026-02-28'));
  } catch (e) {
    tests.push({name: 'addDays: -1 day', passed: false, message: 'Error: ' + e.toString()});
  }

  // ── calculateEndTime ──
  tests.push(_assert('calculateEndTime: 10:00 + 30min', calculateEndTime('10:00', 30), '10:30'));
  tests.push(_assert('calculateEndTime: 09:30 + 60min', calculateEndTime('09:30', 60), '10:30'));
  tests.push(_assert('calculateEndTime: 23:30 + 60min (midnight)', calculateEndTime('23:30', 60), '24:30'));
  tests.push(_assert('calculateEndTime: empty input', calculateEndTime('', 30), ''));

  // ── calculateDuration ──
  tests.push(_assert('calculateDuration: 10:00-10:30', calculateDuration('10:00', '10:30'), 30));
  tests.push(_assert('calculateDuration: 09:00-10:00', calculateDuration('09:00', '10:00'), 60));
  tests.push(_assert('calculateDuration: invalid', calculateDuration('abc', '10:00'), 0));

  // ── parseTime ──
  var parsed = parseTime('10:30');
  tests.push(_assert('parseTime: hours', parsed ? parsed.hours : null, 10));
  tests.push(_assert('parseTime: minutes', parsed ? parsed.minutes : null, 30));
  tests.push(_assert('parseTime: invalid returns null', parseTime('abc'), null));

  // ── getDaysDifference ──
  var d1 = new Date('2026-02-20T00:00:00+09:00');
  var d2 = new Date('2026-02-27T00:00:00+09:00');
  tests.push(_assert('getDaysDifference: 7 days', getDaysDifference(d1, d2), 7));

  // ── isPastDateTime (from DateUtils) ──
  tests.push(_assert('isPastDateTime: empty date → true', isPastDateTime('', '10:00'), true));
  tests.push(_assert('isPastDateTime: empty time → true', isPastDateTime('2026-02-20', ''), true));
  // Note: "today" tests depend on runtime, so we test structural behavior
  var farFuture = '2099-12-31';
  tests.push(_assert('isPastDateTime: far future → false', isPastDateTime(farFuture, '23:59'), false));
  var pastDate = '2020-01-01';
  tests.push(_assert('isPastDateTime: past date → true', isPastDateTime(pastDate, '10:00'), true));

  // ── parseDateInput (from DateInputHelper.js) ──
  try {
    if (typeof parseDateInput === 'function') {
      var parsedDate1 = parseDateInput('明日');
      tests.push({name: 'parseDateInput: "明日" returns non-empty', passed: !!parsedDate1, message: parsedDate1 || 'empty'});

      var parsedDate2 = parseDateInput('2026/06/15');
      tests.push({name: 'parseDateInput: "2026/06/15" returns YYYY/MM/DD format', passed: parsedDate2 === '2026/06/15', message: parsedDate2 || 'empty'});

      var parsedDate3 = parseDateInput('あいうえお');
      tests.push({name: 'parseDateInput: invalid returns empty', passed: parsedDate3 === '' || parsedDate3 === null, message: parsedDate3 || 'empty'});
    }
  } catch (e) {
    tests.push({name: 'parseDateInput tests', passed: false, message: 'Error: ' + e.toString()});
  }

  return tests;
}
