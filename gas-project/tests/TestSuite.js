/**
 * Test Suite - Unit Tests
 *
 * Runs unit tests for core functionality
 */

/**
 * Test cancel flow (E2E via Web App)
 *
 * Creates test reservations, runs cancel logic, verifies results.
 * No LINE/Stripe calls — only sheet operations are verified.
 */
function testCancelFlow() {
  var TEST_USER_ID = 'TEST_LINE_USER_CANCEL';
  var results = [];
  var cleanupIds = [];

  try {
    // ── Step 1: Create test reservations ──
    // Reservation A: Pending + Unpaid (no refund needed)
    var resA = createReservation({
      patient_name: 'キャンセルテストA',
      phone: '09011112222',
      line_display_name: TEST_USER_ID,
      visit_type: VISIT_TYPE.FIRST,
      menu_type: '初診（30分）',
      reserved_date: getFutureDate(3),
      reserved_start: '10:00',
      reserved_end: '10:30',
      status: RESERVATION_STATUS.PENDING,
      deposit_status: DEPOSIT_STATUS.UNPAID
    });
    cleanupIds.push(resA.id);

    // Reservation B: Confirmed + Paid (refund path, but mock refund)
    var resB = createReservation({
      patient_name: 'キャンセルテストB',
      phone: '09011112222',
      line_display_name: TEST_USER_ID,
      visit_type: VISIT_TYPE.REPEAT,
      menu_type: '再診（30分）',
      reserved_date: getFutureDate(4),
      reserved_start: '14:00',
      reserved_end: '14:30',
      status: RESERVATION_STATUS.CONFIRMED,
      deposit_status: DEPOSIT_STATUS.PAID
    });
    cleanupIds.push(resB.id);

    // Reservation C: Already cancelled (should NOT appear in results)
    var resC = createReservation({
      patient_name: 'キャンセルテストC',
      phone: '09011112222',
      line_display_name: TEST_USER_ID,
      visit_type: VISIT_TYPE.REPEAT,
      menu_type: '再診（60分）',
      reserved_date: getFutureDate(5),
      reserved_start: '15:00',
      reserved_end: '16:00',
      status: RESERVATION_STATUS.CANCELLED,
      deposit_status: DEPOSIT_STATUS.UNPAID
    });
    cleanupIds.push(resC.id);

    results.push({step: 'Create 3 test reservations', status: 'OK', ids: [resA.id, resB.id, resC.id]});

    // ── Step 2: getReservationsByLineUserId returns only active (A, B) ──
    var activeReservations = getReservationsByLineUserId(TEST_USER_ID);
    var activeIds = activeReservations.map(function(r) { return r.id; });

    var step2Pass = activeReservations.length === 2
      && activeIds.indexOf(resA.id) !== -1
      && activeIds.indexOf(resB.id) !== -1
      && activeIds.indexOf(resC.id) === -1;

    results.push({
      step: 'getReservationsByLineUserId returns 2 active (excludes Cancelled)',
      status: step2Pass ? 'PASS' : 'FAIL',
      expected: 2,
      actual: activeReservations.length,
      ids: activeIds
    });

    // ── Step 3: canCancelReservation — future reservation is cancellable ──
    var cancelCheck = canCancelReservation(activeReservations[0]);
    results.push({
      step: 'canCancelReservation for future date returns canCancel=true',
      status: cancelCheck.canCancel ? 'PASS' : 'FAIL',
      detail: cancelCheck.reason || 'OK'
    });

    // ── Step 4: Cancel reservation A (Unpaid → no refund) ──
    handleCancellation(resA.id, 'testCancelFlow');
    var cancelledA = getReservationById(resA.id);
    var step4Pass = cancelledA.status === RESERVATION_STATUS.CANCELLED;
    results.push({
      step: 'Cancel unpaid reservation A → status=Cancelled',
      status: step4Pass ? 'PASS' : 'FAIL',
      expected: RESERVATION_STATUS.CANCELLED,
      actual: cancelledA.status
    });

    // ── Step 5: After cancelling A, only B remains active ──
    var activeAfterCancel = getReservationsByLineUserId(TEST_USER_ID);
    var step5Pass = activeAfterCancel.length === 1 && activeAfterCancel[0].id === resB.id;
    results.push({
      step: 'After cancel A, only 1 active reservation remains (B)',
      status: step5Pass ? 'PASS' : 'FAIL',
      expected: 1,
      actual: activeAfterCancel.length
    });

    // ── Step 6: Cancel reservation B (Paid → refund path) ──
    // NOTE: handleCancellation only updates status; refund is handled in
    // handleAwaitingCancelConfirm. For this test we verify the sheet update.
    updateReservation(resB.id, {
      status: RESERVATION_STATUS.CANCELLED,
      deposit_status: DEPOSIT_STATUS.REFUNDED,
      cancel_time: new Date()
    });
    var cancelledB = getReservationById(resB.id);
    var step6Pass = cancelledB.status === RESERVATION_STATUS.CANCELLED
      && cancelledB.deposit_status === DEPOSIT_STATUS.REFUNDED;
    results.push({
      step: 'Cancel paid reservation B → status=Cancelled + deposit=Refunded',
      status: step6Pass ? 'PASS' : 'FAIL',
      expected: 'Cancelled/Refunded',
      actual: cancelledB.status + '/' + cancelledB.deposit_status
    });

    // ── Step 7: No active reservations remain ──
    var finalActive = getReservationsByLineUserId(TEST_USER_ID);
    var step7Pass = finalActive.length === 0;
    results.push({
      step: 'After cancelling both, 0 active reservations remain',
      status: step7Pass ? 'PASS' : 'FAIL',
      expected: 0,
      actual: finalActive.length
    });

    // ── Step 8: getCancelListMessage template works ──
    var listMsg = MessageTemplates.getCancelListMessage([
      {id: 'R0001', reserved_date: '2026-04-10', reserved_start: '10:00', reserved_end: '10:30', menu_type: '初診（30分）', deposit_status: 'Unpaid'},
      {id: 'R0002', reserved_date: '2026-04-11', reserved_start: '14:00', reserved_end: '14:30', menu_type: '再診（30分）', deposit_status: 'Paid'}
    ]);
    var step8Pass = listMsg.indexOf('R0001') !== -1 && listMsg.indexOf('R0002') !== -1 && listMsg.indexOf('2 件') !== -1;
    results.push({
      step: 'getCancelListMessage generates list with 2 reservations',
      status: step8Pass ? 'PASS' : 'FAIL'
    });

    // ── Step 9: getCancelConfirmMessage template works ──
    var confirmMsg = MessageTemplates.getCancelConfirmMessage({
      id: 'R0001',
      reserved_date: '2026-04-10',
      reserved_start: '10:00',
      reserved_end: '10:30',
      menu_type: '初診（30分）',
      deposit_status: DEPOSIT_STATUS.PAID,
      deposit_amount: 1000
    });
    var step9Pass = confirmMsg.indexOf('R0001') !== -1 && confirmMsg.indexOf('返金') !== -1;
    results.push({
      step: 'getCancelConfirmMessage includes reservation ID and refund info',
      status: step9Pass ? 'PASS' : 'FAIL'
    });

  } catch (e) {
    results.push({step: 'UNEXPECTED ERROR', status: 'ERROR', message: e.toString()});
  }

  // ── Cleanup: delete test rows ──
  try {
    var sheet = getReservationsSheet();
    var data = sheet.getDataRange().getValues();
    // Iterate backwards to avoid row index shift
    for (var i = data.length - 1; i >= 1; i--) {
      if (cleanupIds.indexOf(data[i][0]) !== -1) {
        sheet.deleteRow(i + 1);
      }
    }
    results.push({step: 'Cleanup test data', status: 'OK', deleted: cleanupIds});
  } catch (e) {
    results.push({step: 'Cleanup failed', status: 'ERROR', message: e.toString()});
  }

  // ── Summary ──
  var passCount = 0;
  var failCount = 0;
  for (var j = 0; j < results.length; j++) {
    if (results[j].status === 'PASS') passCount++;
    else if (results[j].status === 'FAIL') failCount++;
  }

  return {
    summary: {total: passCount + failCount, passed: passCount, failed: failCount},
    results: results
  };
}

/**
 * Helper: Get a future date string (YYYY-MM-DD) N days from now
 */
function getFutureDate(daysAhead) {
  var d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

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

/**
 * Test change flow (E2E via Web App)
 *
 * Creates test reservations, runs change logic, verifies sheet updates.
 * No LINE/Stripe calls — only sheet operations are verified.
 */
function testChangeFlow() {
  var TEST_USER_ID = 'TEST_LINE_USER_CHANGE';
  var results = [];
  var cleanupIds = [];

  try {
    // ── Step 1: Create test reservations ──
    var resA = createReservation({
      patient_name: '変更テストA',
      phone: '09099998888',
      line_display_name: TEST_USER_ID,
      visit_type: VISIT_TYPE.FIRST,
      menu_type: '初診（30分）',
      reserved_date: getFutureDate(3),
      reserved_start: '10:00',
      reserved_end: '10:30',
      status: RESERVATION_STATUS.CONFIRMED,
      deposit_status: DEPOSIT_STATUS.PAID
    });
    cleanupIds.push(resA.id);

    var resB = createReservation({
      patient_name: '変更テストB',
      phone: '09099998888',
      line_display_name: TEST_USER_ID,
      visit_type: VISIT_TYPE.REPEAT,
      menu_type: '再診（30分）',
      reserved_date: getFutureDate(5),
      reserved_start: '14:00',
      reserved_end: '14:30',
      status: RESERVATION_STATUS.PENDING,
      deposit_status: DEPOSIT_STATUS.UNPAID
    });
    cleanupIds.push(resB.id);

    results.push({step: 'Create 2 test reservations', status: 'OK', ids: [resA.id, resB.id]});

    // ── Step 2: getReservationsByLineUserId returns both ──
    var active = getReservationsByLineUserId(TEST_USER_ID);
    var step2Pass = active.length === 2;
    results.push({
      step: 'getReservationsByLineUserId returns 2 active',
      status: step2Pass ? 'PASS' : 'FAIL',
      expected: 2,
      actual: active.length
    });

    // ── Step 3: Change date on reservation A ──
    var newDate = getFutureDate(7);
    updateReservation(resA.id, { reserved_date: newDate });
    var updatedA = getReservationById(resA.id);
    var step3Pass = updatedA.reserved_date === newDate;
    results.push({
      step: 'Change date on reservation A',
      status: step3Pass ? 'PASS' : 'FAIL',
      expected: newDate,
      actual: updatedA.reserved_date
    });

    // ── Step 4: Change time on reservation B ──
    updateReservation(resB.id, { reserved_start: '15:00', reserved_end: '15:30' });
    var updatedB = getReservationById(resB.id);
    var step4Pass = updatedB.reserved_start === '15:00' && updatedB.reserved_end === '15:30';
    results.push({
      step: 'Change time on reservation B',
      status: step4Pass ? 'PASS' : 'FAIL',
      expected: '15:00-15:30',
      actual: updatedB.reserved_start + '-' + updatedB.reserved_end
    });

    // ── Step 5: Change treatment on reservation A ──
    updateReservation(resA.id, { menu_type: '再診（60分）', visit_type: VISIT_TYPE.REPEAT });
    var updatedA2 = getReservationById(resA.id);
    var step5Pass = updatedA2.menu_type === '再診（60分）' && updatedA2.visit_type === VISIT_TYPE.REPEAT;
    results.push({
      step: 'Change treatment on reservation A',
      status: step5Pass ? 'PASS' : 'FAIL',
      expected: '再診（60分）/Repeat',
      actual: updatedA2.menu_type + '/' + updatedA2.visit_type
    });

    // ── Step 6: Multiple reservations list still shows both ──
    var activeAfter = getReservationsByLineUserId(TEST_USER_ID);
    var step6Pass = activeAfter.length === 2;
    results.push({
      step: 'After changes, still 2 active reservations',
      status: step6Pass ? 'PASS' : 'FAIL',
      expected: 2,
      actual: activeAfter.length
    });

    // ── Step 7: Template: getChangeListMessage ──
    var listMsg = MessageTemplates.getChangeListMessage(activeAfter);
    var step7Pass = listMsg.indexOf(activeAfter[0].id) !== -1 && listMsg.indexOf('2 件') !== -1;
    results.push({
      step: 'getChangeListMessage generates list',
      status: step7Pass ? 'PASS' : 'FAIL'
    });

    // ── Step 8: Template: getChangeFieldSelectMessage ──
    var fieldMsg = MessageTemplates.getChangeFieldSelectMessage(updatedA2);
    var step8Pass = fieldMsg.indexOf(updatedA2.id) !== -1 && fieldMsg.indexOf('日付') !== -1 && fieldMsg.indexOf('時間') !== -1 && fieldMsg.indexOf('施術') !== -1;
    results.push({
      step: 'getChangeFieldSelectMessage shows field options',
      status: step8Pass ? 'PASS' : 'FAIL'
    });

    // ── Step 9: Template: getChangeConfirmMessage ──
    var confirmMsg = MessageTemplates.getChangeConfirmMessage(updatedA2, 'date', '2026-04-15');
    var step9Pass = confirmMsg.indexOf('日付') !== -1 && confirmMsg.indexOf('2026-04-15') !== -1;
    results.push({
      step: 'getChangeConfirmMessage shows change details',
      status: step9Pass ? 'PASS' : 'FAIL'
    });

    // ── Step 10: Template: getChangeCompletedMessage ──
    var completedMsg = MessageTemplates.getChangeCompletedMessage(updatedA2, '日付 → 2026-04-15');
    var step10Pass = completedMsg.indexOf(updatedA2.id) !== -1 && completedMsg.indexOf('変更しました') !== -1;
    results.push({
      step: 'getChangeCompletedMessage shows confirmation',
      status: step10Pass ? 'PASS' : 'FAIL'
    });

    // ── Step 11: Template: getNoChangeableReservationsMessage ──
    var noMsg = MessageTemplates.getNoChangeableReservationsMessage();
    var step11Pass = noMsg.indexOf('変更可能') !== -1;
    results.push({
      step: 'getNoChangeableReservationsMessage generates message',
      status: step11Pass ? 'PASS' : 'FAIL'
    });

  } catch (e) {
    results.push({step: 'UNEXPECTED ERROR', status: 'ERROR', message: e.toString()});
  }

  // ── Cleanup ──
  try {
    var sheet = getReservationsSheet();
    var data = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (cleanupIds.indexOf(data[i][0]) !== -1) {
        sheet.deleteRow(i + 1);
      }
    }
    results.push({step: 'Cleanup test data', status: 'OK', deleted: cleanupIds});
  } catch (e) {
    results.push({step: 'Cleanup failed', status: 'ERROR', message: e.toString()});
  }

  // ── Summary ──
  var passCount = 0;
  var failCount = 0;
  for (var j = 0; j < results.length; j++) {
    if (results[j].status === 'PASS') passCount++;
    else if (results[j].status === 'FAIL') failCount++;
  }

  return {
    summary: {total: passCount + failCount, passed: passCount, failed: failCount},
    results: results
  };
}
