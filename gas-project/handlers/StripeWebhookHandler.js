/**
 * Stripe Webhook Handler
 *
 * Handles Stripe payment events and updates reservation status
 */

/**
 * Handle Stripe webhook
 */
function handleStripeWebhook(event) {
  var eventType = event.type;
  var eventData = event.data.object;

  Logger.log('Stripe webhook received: ' + eventType);

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
    default:
      Logger.log('Unhandled Stripe event type: ' + eventType);
  }
}

/**
 * Handle payment succeeded
 */
function handlePaymentSuccess(paymentIntent) {
  var reservationId = paymentIntent.metadata.reservation_id;

  if (!reservationId) {
    Logger.log('No reservation_id in payment intent metadata');
    return;
  }

  Logger.log('Processing payment success for reservation: ' + reservationId);

  // Get reservation
  var reservation = getReservationById(reservationId);

  if (!reservation) {
    Logger.log('Reservation not found: ' + reservationId);
    return;
  }

  // Update deposit status and reservation status
  updateReservation(reservationId, {
    deposit_status: DEPOSIT_STATUS.PAID,
    status: RESERVATION_STATUS.CONFIRMED
  });

  // Send confirmation message to user
  var confirmationMessage = MessageTemplates.getConfirmationMessage(reservation);
  sendLinePush(reservation.line_display_name, confirmationMessage);

  // Send notification to admin
  var adminMessage = '新しい予約が確定しました。\n\n' +
    'ID: ' + reservationId + '\n' +
    '患者: ' + reservation.patient_name + '\n' +
    '電話: ' + reservation.phone + '\n' +
    '日時: ' + reservation.reserved_date + ' ' + reservation.reserved_start;

  var adminUserId = getLineAdminUserId();
  if (adminUserId) {
    sendLinePush(adminUserId, adminMessage);
  }

  Logger.log('Reservation confirmed: ' + reservationId);
}

/**
 * Handle payment failed
 */
function handlePaymentFailure(paymentIntent) {
  var reservationId = paymentIntent.metadata.reservation_id;
  var errorMessage = paymentIntent.last_payment_error ? paymentIntent.last_payment_error.message : 'Unknown error';

  if (!reservationId) {
    Logger.log('No reservation_id in payment intent metadata');
    return;
  }

  Logger.log('Processing payment failure for reservation: ' + reservationId);

  // Get reservation
  var reservation = getReservationById(reservationId);

  if (!reservation) {
    Logger.log('Reservation not found: ' + reservationId);
    return;
  }

  // Update deposit status
  updateReservation(reservationId, {
    deposit_status: DEPOSIT_STATUS.UNPAID
  });

  // Send failure message to user
  var failureMessage = MessageTemplates.getPaymentFailedMessage(errorMessage);
  sendLinePush(reservation.line_display_name, failureMessage);

  Logger.log('Payment failed for reservation: ' + reservationId);
}

/**
 * Handle refund
 */
function handleRefund(charge) {
  var paymentIntentId = charge.payment_intent;

  if (!paymentIntentId) {
    Logger.log('No payment_intent_id in charge');
    return;
  }

  Logger.log('Processing refund for payment intent: ' + paymentIntentId);

  // Find reservation with this payment intent
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var reservation = data[i];
    var reservationId = reservation[0];
    var depositStatus = reservation[13];

    // For simplicity, assume refunded reservations are marked manually or via payment intent tracking
    if (depositStatus === DEPOSIT_STATUS.PAID && reservation[10] === RESERVATION_STATUS.CANCELLED) {
      updateReservation(reservationId, {
        deposit_status: DEPOSIT_STATUS.REFUNDED
      });

      var lineDisplayName = reservation[4];

      var refundMessage = MessageTemplates.getRefundConfirmationMessage(reservationId);
      sendLinePush(lineDisplayName, refundMessage);

      Logger.log('Refund processed for reservation: ' + reservationId);
      break;
    }
  }
}

/**
 * Handle checkout.session.completed event
 * This is the primary event for Stripe Checkout Sessions
 */
function handleCheckoutSessionCompleted(session) {
  Logger.log('[Stripe] Checkout session completed: ' + session.id);

  var reservationId = session.metadata ? session.metadata.reservation_id : null;
  if (!reservationId) {
    Logger.log('[Stripe] No reservation_id in checkout session metadata');
    return;
  }

  Logger.log('[Stripe] Processing checkout completion for reservation: ' + reservationId);

  var reservation = getReservationById(reservationId);
  if (!reservation) {
    Logger.log('[Stripe] Reservation not found: ' + reservationId);
    return;
  }

  // Update deposit status and reservation status
  updateReservation(reservationId, {
    deposit_status: DEPOSIT_STATUS.PAID,
    status: RESERVATION_STATUS.CONFIRMED
  });

  // Send confirmation message to user
  var message = MessageTemplates.getConfirmationMessage(reservation);
  sendLinePush(reservation.line_display_name, message);

  // Send notification to admin
  var adminMessage = '新しい予約が確定しました。\n\n' +
    'ID: ' + reservationId + '\n' +
    '患者: ' + reservation.patient_name + '\n' +
    '電話: ' + reservation.phone + '\n' +
    '日時: ' + reservation.reserved_date + ' ' + reservation.reserved_start;

  var adminUserId = getLineAdminUserId();
  if (adminUserId) {
    sendLinePush(adminUserId, adminMessage);
  }

  Logger.log('[Stripe] Reservation confirmed via checkout: ' + reservationId);
}
