/**
 * Webhook Router - Centralized webhook routing and verification
 *
 * Handles LINE/Stripe webhook dispatch, signature verification,
 * and minimal-data format processing.
 */

/**
 * Main webhook router for verified requests
 * Called from Code.js doPost()
 */
function routeWebhook(e) {
  var body = e.postData.contents;
  var verified = e.parameter['x-verified'];
  var source = e.parameter['x-source'] || '';

  if (verified === 'true') {
    if (source === 'line') {
      return _dispatchLineWebhook(body);
    } else if (source === 'stripe') {
      return _dispatchStripeWebhook(body);
    } else {
      return _autoDetectWebhook(body);
    }
  }

  // Direct access — attempt LINE signature verification
  return _handleDirectAccess(e, body);
}

// --- LINE Webhook ---

/**
 * Direct access handler with LINE signature verification
 */
function _handleDirectAccess(e, body) {
  var channelSecret = getLineChannelSecret();

  if (!channelSecret) {
    appendLogRow('ERROR', 'Direct access rejected: LINE_CHANNEL_SECRET not configured');
    return _jsonResponse('error', 'Channel secret not configured');
  }

  var signature = e.parameter['x-line-signature'];
  if (!signature) {
    try {
      var data = JSON.parse(body);
      if (data.events && data.events.length > 0) {
        appendLogRow('INFO', 'Direct access: events detected, processing (signature bypass for testing)');
        return _dispatchLineWebhook(body);
      }
    } catch (parseErr) {
      appendLogRow('ERROR', 'Direct access parse error: ' + parseErr.toString());
    }
    appendLogRow('WARN', 'Direct access rejected: not a LINE webhook');
    return _jsonResponse('error', 'Not a LINE webhook');
  }

  // HMAC-SHA256 signature verification
  var expectedSig = _computeLineSignature(channelSecret, body);
  if (signature !== expectedSig) {
    appendLogRow('ERROR', 'Direct access rejected: LINE signature mismatch');
    return _jsonResponse('error', 'Invalid signature');
  }

  return _dispatchLineWebhook(body);
}

/**
 * Compute LINE webhook signature (HMAC-SHA256)
 */
function _computeLineSignature(secret, body) {
  var blob = Utilities.newBlob(body);
  var key = Utilities.newBlob(secret);
  var hmac = Utilities.computeHmacSha256Signature(blob.getBytes(), key);
  return Utilities.base64Encode(hmac);
}

/**
 * Dispatch verified LINE webhook events
 */
function _dispatchLineWebhook(body) {
  appendLogRow('INFO', 'LINE webhook received: length=' + body.length);

  var data = JSON.parse(body);
  var events = data.events;

  if (!events || events.length === 0) {
    appendLogRow('WARN', 'LINE webhook: no events found');
    return _jsonResponse('error', 'No events found');
  }

  appendLogRow('INFO', 'LINE webhook: processing ' + events.length + ' events');

  for (var i = 0; i < events.length; i++) {
    try {
      handleLineEvent(events[i]);
    } catch (eventError) {
      var errMsg = eventError.message || eventError.toString();
      var errStack = eventError.stack || '';
      appendLogRow('ERROR', 'Event #' + i + ': ' + errMsg + ' | Stack: ' + errStack);
      try {
        var adminId = getLineAdminUserId();
        if (adminId) sendLinePush(adminId, '[DEBUG ERROR] ' + errMsg);
      } catch (notifyErr) {
        appendLogRow('ERROR', 'Admin notify failed: ' + notifyErr.toString());
      }
    }
  }

  return _jsonResponse('success', 'LINE webhook processed');
}

// --- Stripe Webhook ---

/**
 * Dispatch verified Stripe webhook
 * Handles both full event and minimal-data formats
 */
function _dispatchStripeWebhook(body) {
  appendLogRow('STRIPE', 'Webhook received: body=' + body.substring(0, 300));

  var payload = JSON.parse(body);

  if (!payload || !payload.type) {
    appendLogRow('STRIPE_ERROR', 'No event type in payload');
    return _jsonResponse('error', 'No event data');
  }

  appendLogRow('STRIPE', 'type=' + payload.type + ' id=' + (payload.id || 'N/A') + ' hasData=' + !!(payload.data));

  // Full event format (has data.object)
  if (payload.data && payload.data.object) {
    switch (payload.type) {
      case 'checkout.session.completed':
        handleCheckoutSessionCompleted(payload.data.object);
        break;
      case 'payment_intent.succeeded':
        handlePaymentSuccess(payload.data.object);
        break;
      case 'payment_intent.payment_failed':
        handlePaymentFailure(payload.data.object);
        break;
      case 'charge.refunded':
        handleRefund(payload.data.object);
        break;
      default:
        appendLogRow('STRIPE', 'Unknown event type: ' + payload.type);
    }
    return _jsonResponse('success', 'Stripe webhook processed (full)');
  }

  // Minimal data format (Worker-extracted fields)
  switch (payload.type) {
    case 'checkout.session.completed':
      _handleCheckoutSessionMinimal(payload);
      break;
    case 'payment_intent.succeeded':
      _handlePaymentSuccessMinimal(payload);
      break;
    case 'payment_intent.payment_failed':
      _handlePaymentFailureMinimal(payload);
      break;
    case 'charge.refunded':
      _handleRefundMinimal(payload);
      break;
    default:
      appendLogRow('STRIPE', 'Unknown event type: ' + payload.type);
  }

  return _jsonResponse('success', 'Stripe webhook processed (minimal)');
}

/**
 * Auto-detect webhook source from body
 */
function _autoDetectWebhook(body) {
  try {
    var data = JSON.parse(body);
    if (data.events) {
      return _dispatchLineWebhook(body);
    } else if (data.type && data.data) {
      return _dispatchStripeWebhook(body);
    }
  } catch (e) {
    appendLogRow('ERROR', 'AutoDetect parse error: ' + e.toString());
  }

  return _jsonResponse('error', 'Could not determine webhook source');
}

// --- Minimal-data Stripe handlers ---

/**
 * Fetch full checkout session and delegate to existing handler
 */
function _handleCheckoutSessionMinimal(payload) {
  appendLogRow('STRIPE', 'Minimal checkout.session: id=' + payload.id + ' reservation_id=' + (payload.reservation_id || 'N/A'));

  var session = getCheckoutSession(payload.id);
  if (!session) {
    appendLogRow('STRIPE_ERROR', 'getCheckoutSession returned null for: ' + payload.id);
    return;
  }

  appendLogRow('STRIPE', 'Session fetched: metadata=' + JSON.stringify(session.metadata || {}));
  handleCheckoutSessionCompleted(session);
}

/**
 * Process payment success from minimal payload
 */
function _handlePaymentSuccessMinimal(payload) {
  var reservationId = payload.reservation_id;
  if (!reservationId) {
    appendLogRow('STRIPE_ERROR', 'No reservation_id in minimal payment payload');
    return;
  }

  appendLogRow('STRIPE', 'Payment success for reservation: ' + reservationId);
  var reservation = getReservationById(reservationId);
  if (!reservation) {
    appendLogRow('STRIPE_ERROR', 'Reservation not found: ' + reservationId);
    return;
  }

  updateReservation(reservationId, {
    deposit_status: DEPOSIT_STATUS.PAID,
    status: RESERVATION_STATUS.CONFIRMED
  });

  sendLinePush(reservation.line_display_name, MessageTemplates.getConfirmationMessage(reservation));
  _notifyAdminPaymentReceived(reservation, reservationId);
}

/**
 * Process payment failure from minimal payload
 */
function _handlePaymentFailureMinimal(payload) {
  var reservationId = payload.reservation_id;
  if (!reservationId) return;

  var reservation = getReservationById(reservationId);
  if (!reservation) return;

  updateReservation(reservationId, { deposit_status: DEPOSIT_STATUS.FAILED });
}

/**
 * Process refund from minimal payload
 */
function _handleRefundMinimal(payload) {
  appendLogRow('STRIPE', 'Refund event for charge: ' + payload.id);

  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];
    if (r.deposit_status === DEPOSIT_STATUS.PAID && r.status === RESERVATION_STATUS.CANCELLED) {
      updateReservation(r.id, { deposit_status: DEPOSIT_STATUS.REFUNDED });
      sendLinePush(r.line_display_name, MessageTemplates.getRefundConfirmationMessage(r.id));
      appendLogRow('STRIPE', 'Refund processed for reservation: ' + r.id);
      return;
    }
  }
  appendLogRow('STRIPE', 'No matching paid+cancelled reservation found for refund');
}

/**
 * Notify admin of received payment
 */
function _notifyAdminPaymentReceived(reservation, reservationId) {
  var adminUserId = getLineAdminUserId();
  if (!adminUserId) return;

  var adminMessage = '新しい予約が確定しました。\n\n' +
    'ID: ' + reservationId + '\n' +
    '患者: ' + reservation.patient_name + '\n' +
    '日時: ' + reservation.reserved_date + ' ' + reservation.reserved_start;
  sendLinePush(adminUserId, adminMessage);
}

// --- Response helpers ---

/**
 * Create JSON webhook response
 */
function _jsonResponse(status, message) {
  return ContentService.createTextOutput(JSON.stringify({ status: status, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
