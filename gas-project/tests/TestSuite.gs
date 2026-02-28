/**
 * Test Suite - Unit Tests
 *
 * Runs unit tests for core functionality
 */

/**
 * Run all tests
 */
function runAllTests() {
  Logger.log('=== Starting Unit Tests ===');

  var results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  // Sheet Service tests
  results.tests = results.tests.concat(testSheetService());

  // Validation tests
  results.tests = results.tests.concat(testValidationUtils());

  // Date Utils tests
  results.tests = results.tests.concat(testDateUtils());

  // Message Templates tests
  results.tests = results.tests.concat(testMessageTemplates());

  // Calculate summary
  for (var i = 0; i < results.tests.length; i++) {
    results.total++;
    if (results.tests[i].passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  Logger.log('=== Test Summary ===');
  Logger.log('Total: ' + results.total);
  Logger.log('Passed: ' + results.passed);
  Logger.log('Failed: ' + results.failed);

  return results;
}

/**
 * Test Sheet Service
 */
function testSheetService() {
  var tests = [];

  // Test 1: Generate reservation ID
  var test1 = {
    name: 'Generate Reservation ID',
    passed: false,
    message: ''
  };

  try {
    var id = generateReservationId();
    test1.passed = id.startsWith('R') && id.length === 5;
    test1.message = test1.passed ? 'OK: ' + id : 'Failed: ' + id;
  } catch (e) {
    test1.message = 'Error: ' + e.toString();
  }
  tests.push(test1);

  // Test 2: Validate phone number
  var test2 = {
    name: 'Validate Phone Number',
    passed: false,
    message: ''
  };

  test2.passed = validatePhoneNumber('09012345678');
  test2.message = test2.passed ? 'OK: Valid phone' : 'Failed: Invalid phone';
  tests.push(test2);

  return tests;
}

/**
 * Test Validation Utils
 */
function testValidationUtils() {
  var tests = [];

  // Test 1: Valid phone
  var test1 = {
    name: 'Validate Valid Phone',
    passed: false,
    message: ''
  };

  test1.passed = validatePhoneNumber('09012345678');
  test1.message = test1.passed ? 'OK' : 'Failed';
  tests.push(test1);

  // Test 2: Invalid phone
  var test2 = {
    name: 'Validate Invalid Phone',
    passed: false,
    message: ''
  };

  test2.passed = !validatePhoneNumber('123');
  test2.message = test2.passed ? 'OK' : 'Failed';
  tests.push(test2);

  // Test 3: Valid date
  var test3 = {
    name: 'Validate Valid Date',
    passed: false,
    message: ''
  };

  test3.passed = validateDate('2026-02-20');
  test3.message = test3.passed ? 'OK' : 'Failed';
  tests.push(test3);

  // Test 4: Valid time
  var test4 = {
    name: 'Validate Valid Time',
    passed: false,
    message: ''
  };

  test4.passed = validateTime('10:30');
  test4.message = test4.passed ? 'OK' : 'Failed';
  tests.push(test4);

  // Test 5: Invalid time
  var test5 = {
    name: 'Validate Invalid Time',
    passed: false,
    message: ''
  };

  test5.passed = !validateTime('25:00');
  test5.message = test5.passed ? 'OK' : 'Failed';
  tests.push(test5);

  return tests;
}

/**
 * Test Date Utils
 */
function testDateUtils() {
  var tests = [];

  // Test 1: Format date
  var test1 = {
    name: 'Format Date',
    passed: false,
    message: ''
  };

  try {
    var date = new Date('2026-02-20');
    var formatted = formatDate(date);
    test1.passed = formatted === '2026-02-20';
    test1.message = test1.passed ? 'OK: ' + formatted : 'Failed: ' + formatted;
  } catch (e) {
    test1.message = 'Error: ' + e.toString();
  }
  tests.push(test1);

  // Test 2: Add days
  var test2 = {
    name: 'Add Days',
    passed: false,
    message: ''
  };

  try {
    var date2 = new Date('2026-02-20');
    var result2 = addDays(date2, 7);
    var formatted2 = formatDate(result2);
    test2.passed = formatted2 === '2026-02-27';
    test2.message = test2.passed ? 'OK: ' + formatted2 : 'Failed: ' + formatted2;
  } catch (e) {
    test2.message = 'Error: ' + e.toString();
  }
  tests.push(test2);

  return tests;
}

/**
 * Test Message Templates
 */
function testMessageTemplates() {
  var tests = [];

  // Test 1: Welcome message
  var test1 = {
    name: 'Welcome Message',
    passed: false,
    message: ''
  };

  try {
    var welcome = MessageTemplates.getWelcomeMessage();
    test1.passed = welcome.text && welcome.quickReplies;
    test1.message = test1.passed ? 'OK: Message generated' : 'Failed: Message missing';
  } catch (e) {
    test1.message = 'Error: ' + e.toString();
  }
  tests.push(test1);

  // Test 2: Confirmation message
  var test2 = {
    name: 'Confirmation Message',
    passed: false,
    message: ''
  };

  try {
    var mockReservation = {
      id: 'R0001',
      patient_name: 'Test Patient',
      reserved_date: '2026-02-20',
      reserved_start: '10:00',
      reserved_end: '10:30',
      menu_type: '初診（30分）'
    };

    var confirmMsg = MessageTemplates.getConfirmationMessage(mockReservation);
    test2.passed = confirmMsg && confirmMsg.includes('R0001');
    test2.message = test2.passed ? 'OK: Message generated' : 'Failed: Message missing';
  } catch (e) {
    test2.message = 'Error: ' + e.toString();
  }
  tests.push(test2);

  return tests;
}

/**
 * Run Sheet Service test
 */
function testSheetServiceIntegration() {
  Logger.log('=== Testing Sheet Service Integration ===');

  try {
    // Get sheets
    var reservationsSheet = getReservationsSheet();
    var waitlistSheet = getWaitlistSheet();
    var summarySheet = getWeeklySummarySheet();

    if (reservationsSheet && waitlistSheet && summarySheet) {
      Logger.log('OK: All sheets accessible');
      return true;
    } else {
      Logger.log('Failed: One or more sheets not found');
      return false;
    }
  } catch (e) {
    Logger.log('Error: ' + e.toString());
    return false;
  }
}

/**
 * Test LINE Service
 */
function testLineService() {
  Logger.log('=== Testing LINE Service ===');

  try {
    var token = getLineAccessToken();
    if (!token) {
      Logger.log('Warning: LINE_CHANNEL_ACCESS_TOKEN not set');
      return false;
    }

    Logger.log('OK: LINE access token available');
    return true;
  } catch (e) {
    Logger.log('Error: ' + e.toString());
    return false;
  }
}

/**
 * Test Stripe Service
 */
function testStripeService() {
  Logger.log('=== Testing Stripe Service ===');

  try {
    var apiKey = getStripeApiKey();
    if (!apiKey) {
      Logger.log('Warning: STRIPE_API_KEY not set');
      return false;
    }

    Logger.log('OK: Stripe API key available');
    return true;
  } catch (e) {
    Logger.log('Error: ' + e.toString());
    return false;
  }
}
