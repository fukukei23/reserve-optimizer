/**
 * Test Runner - Orchestrates all test suites
 *
 * Call runAllTests() from GAS editor or script.google.com to execute.
 * Individual suites can also be run directly:
 *   - testValidationUtils() — ValidationUtils unit tests
 *   - testDateUtils() — DateUtils/DateInputHelper unit tests
 *   - testMessageTemplates() — MessageTemplates unit tests
 *   - testCancelFlow() — Cancel flow integration test
 *   - testChangeFlow() — Change flow integration test
 *   - testSheetServiceIntegration() — Sheet accessibility check
 *   - testLineService() — LINE token check
 *   - testStripeService() — Stripe API key check
 */

/**
 * Helper: Get a future date string (YYYY/MM/DD) N days from now
 */
function getFutureDate(daysAhead) {
  var d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return formatDateObj(d) || Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd');
}

/**
 * Run all tests and return summary
 */
function runAllTests() {
  appendLogRow('INFO', '=== Starting All Tests ===');

  var results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  // Unit tests (no external dependencies)
  results.tests = results.tests.concat(testValidationUtils());
  results.tests = results.tests.concat(testDateUtils());
  results.tests = results.tests.concat(testMessageTemplates());
  results.tests = results.tests.concat(testReminderService());

  // Integration tests
  results.tests = results.tests.concat(testSheetServiceIntegration());
  results.tests = results.tests.concat(testLineService());
  results.tests = results.tests.concat(testStripeService());

  // E2E flow tests
  var cancelResult = testCancelFlow();
  var changeResult = testChangeFlow();

  // Flatten flow test results
  if (cancelResult && cancelResult.results) {
    for (var i = 0; i < cancelResult.results.length; i++) {
      var step = cancelResult.results[i];
      results.tests.push({
        name: 'Cancel: ' + step.step,
        passed: step.status === 'PASS' || step.status === 'OK',
        message: step.status + (step.actual ? ' (actual: ' + step.actual + ')' : '')
      });
    }
  }
  if (changeResult && changeResult.results) {
    for (var j = 0; j < changeResult.results.length; j++) {
      var step2 = changeResult.results[j];
      results.tests.push({
        name: 'Change: ' + step2.step,
        passed: step2.status === 'PASS' || step2.status === 'OK',
        message: step2.status + (step2.actual ? ' (actual: ' + step2.actual + ')' : '')
      });
    }
  }

  // Calculate summary
  for (var k = 0; k < results.tests.length; k++) {
    results.total++;
    if (results.tests[k].passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  appendLogRow('INFO', '=== Test Summary === Total: ' + results.total + ' Passed: ' + results.passed + ' Failed: ' + results.failed);

  return results;
}
