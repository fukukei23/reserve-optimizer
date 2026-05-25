/**
 * Error Handler - Unified error handling and dead letter queue
 *
 * Provides safeExecute() for consistent try-catch across all handlers,
 * automatic lock cleanup, rollback support, and admin notification.
 */

/**
 * Execute fn with unified error handling.
 *
 * @param {function} fn - Business logic to execute
 * @param {object} context - Error context
 * @param {string} context.operation - Name of the operation (for logging)
 * @param {string} [context.replyToken] - LINE reply token (for user notification)
 * @param {string} [context.userId] - LINE user ID (for push notification if no replyToken)
 * @param {Lock} [context.lock] - GAS LockService lock to release on error
 * @param {function} [context.onRollback] - Rollback callback on error
 * @param {boolean} [context.silent] - If true, skip user notification (webhook handlers)
 * @returns {*} fn's return value, or { error: true, message: string } on failure
 */
function safeExecute(fn, context) {
  try {
    return fn();
  } catch (e) {
    // Lock cleanup (prevent leaked locks)
    if (context.lock) {
      try { context.lock.releaseLock(); } catch (le) { /* already released */ }
    }

    // Structured log
    var errMsg = (e.message || e.toString()).substring(0, 400);
    var errStack = (e.stack || '').substring(0, 300);
    appendLogRow('ERROR', '[' + context.operation + '] ' + errMsg + ' | ' + errStack);

    // Rollback
    if (context.onRollback) {
      try {
        context.onRollback();
        appendLogRow('INFO', '[' + context.operation + '] Rollback completed');
      } catch (rbErr) {
        appendLogRow('ERROR', '[' + context.operation + '] Rollback failed: ' + rbErr.message);
      }
    }

    // Admin notification
    try {
      notifyAdmin('error', context.operation + ': ' + errMsg);
    } catch (notifyErr) { /* notification failure is non-critical */ }

    // Dead letter record
    try {
      recordDeadLetter(context.operation, context.deadLetterData || null, errMsg);
    } catch (dlErr) { /* dead letter failure is non-critical */ }

    // User notification (skip for webhook-level handlers)
    if (!context.silent) {
      var userMsg = '申し訳ございません、処理中にエラーが発生しました。\n時間をおいて再度お試しください。';
      if (context.replyToken) {
        try {
          sendLineReply(context.replyToken, userMsg);
        } catch (replyErr) { /* replyToken may be expired */ }
      } else if (context.userId) {
        try {
          sendLinePush(context.userId, userMsg);
        } catch (pushErr) { /* push may fail */ }
      }
    }

    // State cleanup
    if (context.userId) {
      try { clearUserState(context.userId); } catch (stateErr) { /* noop */ }
    }

    return { error: true, message: errMsg };
  }
}

/**
 * Record a failed operation to the dead letter sheet for manual retry.
 *
 * @param {string} operation - Operation name
 * @param {object|null} data - Input data that failed
 * @param {string} error - Error message
 */
function recordDeadLetter(operation, data, error) {
  var sheet = getDeadLetterSheet();
  sheet.appendRow([
    new Date(),
    operation,
    data ? JSON.stringify(data).substring(0, 2000) : '',
    (error || '').substring(0, 500),
    'PENDING'
  ]);
}

/**
 * Get or create the dead letter sheet.
 */
function getDeadLetterSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName('dead_letters');
  if (!sheet) {
    sheet = ss.insertSheet('dead_letters');
    sheet.appendRow(['timestamp', 'operation', 'data', 'error', 'status']);
  }
  return sheet;
}
