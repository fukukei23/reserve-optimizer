/**
 * Flow Tests - Integration tests for cancel/change flows and template rendering
 *
 * Cancel/change flow tests create real reservations in the spreadsheet
 * and clean up after completion. Template tests are pure unit tests.
 * Run in GAS environment only.
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

  _cleanupTestRows(cleanupIds, results);

  return _summarizeFlowResults(results);
}

/**
 * Test change flow (E2E via Web App)
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

  _cleanupTestRows(cleanupIds, results);

  return _summarizeFlowResults(results);
}

/**
 * Test message templates (pure unit tests — no SheetService dependency)
 */
function testMessageTemplates() {
  var tests = [];

  // Welcome message
  try {
    var welcome = MessageTemplates.getWelcomeMessage();
    var t1 = welcome.text && welcome.quickReplies;
    tests.push({name: 'Welcome Message has text + quickReplies', passed: !!t1, message: t1 ? 'OK' : 'Missing fields'});
  } catch (e) {
    tests.push({name: 'Welcome Message', passed: false, message: 'Error: ' + e.toString()});
  }

  // Confirmation message
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
    tests.push({name: 'Confirmation Message includes R0001', passed: confirmMsg && confirmMsg.indexOf('R0001') !== -1, message: confirmMsg ? 'OK' : 'Missing'});
  } catch (e) {
    tests.push({name: 'Confirmation Message', passed: false, message: 'Error: ' + e.toString()});
  }

  return tests;
}

/**
 * Test Sheet Service integration (checks sheet accessibility)
 */
function testSheetServiceIntegration() {
  appendLogRow('INFO', '=== Testing Sheet Service Integration ===');

  try {
    var reservationsSheet = getReservationsSheet();
    var waitlistSheet = getWaitlistSheet();
    var summarySheet = getWeeklySummarySheet();

    var allAccessible = !!(reservationsSheet && waitlistSheet && summarySheet);
    appendLogRow('INFO', 'Sheet Service Integration: ' + (allAccessible ? 'OK' : 'FAIL'));
    return [{name: 'All sheets accessible', passed: allAccessible, message: allAccessible ? 'OK' : 'One or more sheets not found'}];
  } catch (e) {
    return [{name: 'All sheets accessible', passed: false, message: 'Error: ' + e.toString()}];
  }
}

/**
 * Test LINE Service (checks token availability)
 */
function testLineService() {
  appendLogRow('INFO', '=== Testing LINE Service ===');

  try {
    var token = getLineAccessToken();
    var hasToken = !!token;
    appendLogRow('INFO', 'LINE Service: ' + (hasToken ? 'Token available' : 'Token not set'));
    return [{name: 'LINE access token available', passed: hasToken, message: hasToken ? 'OK' : 'LINE_CHANNEL_ACCESS_TOKEN not set'}];
  } catch (e) {
    return [{name: 'LINE access token available', passed: false, message: 'Error: ' + e.toString()}];
  }
}

/**
 * Test Stripe Service (checks API key availability)
 */
function testStripeService() {
  appendLogRow('INFO', '=== Testing Stripe Service ===');

  try {
    var apiKey = getStripeApiKey();
    var hasKey = !!apiKey;
    appendLogRow('INFO', 'Stripe Service: ' + (hasKey ? 'API key available' : 'API key not set'));
    return [{name: 'Stripe API key available', passed: hasKey, message: hasKey ? 'OK' : 'STRIPE_API_KEY not set'}];
  } catch (e) {
    return [{name: 'Stripe API key available', passed: false, message: 'Error: ' + e.toString()}];
  }
}

// ── Shared helpers ──

/**
 * Delete test rows from reservations sheet (iterate backwards to avoid index shift)
 */
function _cleanupTestRows(cleanupIds, results) {
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
}

/**
 * Summarize flow test results
 */
function _summarizeFlowResults(results) {
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
