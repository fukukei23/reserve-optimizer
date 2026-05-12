/**
 * Stripe Webhook Handler
 *
 * Handles Stripe payment events and updates reservation status.
 * All Stripe API calls are delegated to StripeService.js via _callStripeApi.
 */

/**
 * Handle Stripe webhook
 */
function handleStripeWebhook(event) {
  var eventType = event.type;
  var eventData = event.data.object;

  appendLogRow('INFO', 'Stripe webhook received: ' + eventType);

  switch (eventType) {
    case 'payment_intent.succeeded':
      handlePaymentSuccess(eventData);
      break;
    case 'payment_intent.payment_failed':
      handlePaymentFailure(eventData);
      break;
    case 'charge.refunded':
      handleRefund(eventData);
      break;
    case 'checkout.session.completed':
      handleCheckoutSessionCompleted(eventData);
      break;
    default:
      appendLogRow('WARN', 'Unhandled Stripe event type: ' + eventType);
  }
}

/**
 * Handle payment succeeded
 * @param {object} paymentIntent - Stripe payment intent object
 */
function handlePaymentSuccess(paymentIntent) {
  var reservationId = paymentIntent.metadata ? paymentIntent.metadata.reservation_id : null;

  if (!reservationId) {
    appendLogRow('WARN', '[handlePaymentSuccess] No reservation_id in payment intent metadata');
    return;
  }

  var reservation = getReservationById(reservationId);
  if (!reservation) {
    appendLogRow('ERROR', '[handlePaymentSuccess] Reservation not found: ' + reservationId);
    return;
  }

  updateReservation(reservationId, {
    deposit_status: DEPOSIT_STATUS.PAID,
    status: RESERVATION_STATUS.CONFIRMED
  });

  var confirmationMessage = MessageTemplates.getConfirmationMessage(reservation);
  sendLinePush(reservation.line_display_name, confirmationMessage);

  notifyReservationAdmin('新しい予約が確定しました', reservation);

  appendLogRow('INFO', '[handlePaymentSuccess] Reservation confirmed: ' + reservationId);
}

/**
 * Handle payment failed
 * @param {object} paymentIntent - Stripe payment intent object
 */
function handlePaymentFailure(paymentIntent) {
  var reservationId = paymentIntent.metadata ? paymentIntent.metadata.reservation_id : null;
  var errorMessage = paymentIntent.last_payment_error ? paymentIntent.last_payment_error.message : 'Unknown error';

  if (!reservationId) {
    appendLogRow('WARN', '[handlePaymentFailure] No reservation_id in payment intent metadata');
    return;
  }

  var reservation = getReservationById(reservationId);
  if (!reservation) {
    appendLogRow('ERROR', '[handlePaymentFailure] Reservation not found: ' + reservationId);
    return;
  }

  updateReservation(reservationId, {
    deposit_status: DEPOSIT_STATUS.UNPAID
  });

  var failureMessage = MessageTemplates.getPaymentFailedMessage(errorMessage);
  sendLinePush(reservation.line_display_name, failureMessage);

  notifyAdmin('payment_failed', '決済失敗: ' + reservationId + ' / ' + reservation.patient_name + ' / エラー: ' + errorMessage);

  appendLogRow('INFO', '[handlePaymentFailure] Payment failed for reservation: ' + reservationId);
}

/**
 * Handle refund — uses cached reservation lookup instead of direct sheet scan
 * @param {object} charge - Stripe charge object
 */
function handleRefund(charge) {
  var paymentIntentId = charge.payment_intent;

  if (!paymentIntentId) {
    appendLogRow('WARN', '[handleRefund] No payment_intent_id in charge');
    return;
  }

  appendLogRow('INFO', '[handleRefund] Processing refund for payment intent: ' + paymentIntentId);

  // Search cache for reservation with matching payment_intent_id
  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];
    if (r.payment_intent_id === paymentIntentId) {
      updateReservation(r.id, {
        deposit_status: DEPOSIT_STATUS.REFUNDED
      });

      var refundMessage = MessageTemplates.getRefundConfirmationMessage(r.id);
      sendLinePush(r.line_display_name, refundMessage);

      appendLogRow('INFO', '[handleRefund] Refund processed for reservation: ' + r.id);
      return;
    }
  }

  appendLogRow('WARN', '[handleRefund] No reservation found with payment_intent_id: ' + paymentIntentId);
}

/**
 * Handle checkout.session.completed event
 * @param {object} session - Stripe checkout session object
 */
function handleCheckoutSessionCompleted(session) {
  var reservationId = session.metadata ? session.metadata.reservation_id : null;

  if (!reservationId) {
    appendLogRow('WARN', '[handleCheckoutSessionCompleted] No reservation_id in session metadata');
    return;
  }

  var reservation = getReservationById(reservationId);
  if (!reservation) {
    appendLogRow('ERROR', '[handleCheckoutSessionCompleted] Reservation not found: ' + reservationId);
    return;
  }

  updateReservation(reservationId, {
    deposit_status: DEPOSIT_STATUS.PAID,
    status: RESERVATION_STATUS.CONFIRMED,
    payment_intent_id: session.payment_intent || ''
  });

  var message = MessageTemplates.getConfirmationMessage(reservation);
  sendLinePush(reservation.line_display_name, message);

  notifyReservationAdmin('新しい予約が確定しました', reservation);

  appendLogRow('INFO', '[handleCheckoutSessionCompleted] Reservation confirmed via checkout: ' + reservationId);
}

/**
 * Send admin notification for confirmed reservation
 */
function notifyReservationAdmin(subject, reservation) {
  var adminMessage = subject + '\n\n' +
    'ID: ' + reservation.id + '\n' +
    '患者: ' + reservation.patient_name + '\n' +
    '電話: ' + reservation.phone + '\n' +
    '日時: ' + reservation.reserved_date + ' ' + reservation.reserved_start;

  var adminUserId = getLineAdminUserId();
  if (adminUserId) {
    sendLinePush(adminUserId, adminMessage);
  }
}
