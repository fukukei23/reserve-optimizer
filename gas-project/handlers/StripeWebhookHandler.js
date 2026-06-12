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
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      handleSubscriptionCreatedOrUpdated(eventData);
      break;
    case 'customer.subscription.deleted':
      handleSubscriptionDeleted(eventData);
      break;
    case 'invoice.payment_succeeded':
      handleInvoicePaymentSucceeded(eventData);
      break;
    case 'invoice.payment_failed':
      handleInvoicePaymentFailed(eventData);
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
  var metadata = session.metadata || {};
  var type = metadata.type || 'deposit';

  // Ticket purchase
  if (type === 'ticket') {
    handleTicketCheckoutCompleted(session, metadata);
    return;
  }

  // Subscription purchase
  if (type === 'subscription') {
    handleSubscriptionCheckoutCompleted(session, metadata);
    return;
  }

  // Reservation deposit (default)
  var reservationId = metadata.reservation_id;

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

/**
 * Handle ticket purchase checkout completion
 */
function handleTicketCheckoutCompleted(session, metadata) {
  var lineUserId = metadata.line_user_id;
  var packageType = metadata.package_type;

  if (!lineUserId || !packageType) {
    appendLogRow('ERROR', '[handleTicketCheckoutCompleted] Missing metadata: line_user_id=' + lineUserId + ' package_type=' + packageType);
    return;
  }

  var ticket = createTicket({
    line_user_id: lineUserId,
    package_type: packageType,
    stripe_session_id: session.id || '',
    stripe_payment_intent: session.payment_intent || '',
    notes: 'Purchased via Stripe'
  });

  var locale = 'ja';
  var confirmMsg = MessageTemplates.getTicketConfirmedMessage(
    ticket.ticket_id, packageType, ticket.total_sessions, ticket.expiry_date, locale
  );
  sendLinePushQuickReply(lineUserId, confirmMsg, [
    { label: t('welcome.reserve', locale), text: t('welcome.reserve', locale) },
    { label: '回数券', text: '回数券' }
  ]);

  appendLogRow('INFO', '[handleTicketCheckoutCompleted] Ticket created: ' + ticket.ticket_id + ' for user: ' + lineUserId);
}

/**
 * Handle subscription checkout completion
 * checkout.session.completed with metadata.type === 'subscription'
 */
function handleSubscriptionCheckoutCompleted(session, metadata) {
  var lineUserId = metadata.line_user_id;
  var stripeSubId = session.subscription;
  var stripeCustomerId = session.customer;

  if (!lineUserId || !stripeSubId) {
    appendLogRow('WARN', '[Subscription] Missing metadata in checkout session');
    return;
  }

  saveSubscription({
    line_user_id:           lineUserId,
    stripe_customer_id:     stripeCustomerId || '',
    stripe_subscription_id: stripeSubId,
    status:                 SUBSCRIPTION_STATUS.ACTIVE,
    plan_name:              getSubscriptionPlanName(),
    started_at:             Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd')
  });

  sendLinePush(lineUserId,
    '✅ ' + getSubscriptionPlanName() + 'へのご加入ありがとうございます！\n毎月自動更新されます。確認は「/subscription」でいつでもご確認いただけます。'
  );
  appendLogRow('INFO', '[Subscription] Checkout completed for: ' + lineUserId);
}

/**
 * Handle customer.subscription.created / updated
 */
function handleSubscriptionCreatedOrUpdated(subscription) {
  var stripeSubId = subscription.id;
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  var nextBillingAt = subscription.current_period_end
    ? Utilities.formatDate(new Date(subscription.current_period_end * 1000), 'Asia/Tokyo', 'yyyy/MM/dd')
    : '';

  updateSubscriptionStatus(stripeSubId, subscription.status || SUBSCRIPTION_STATUS.ACTIVE, {
    next_billing_at: nextBillingAt
  });
  appendLogRow('INFO', '[Subscription] Created/Updated: ' + stripeSubId + ' status=' + subscription.status);
}

/**
 * Handle customer.subscription.deleted
 */
function handleSubscriptionDeleted(subscription) {
  var stripeSubId = subscription.id;
  var nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  var result = updateSubscriptionStatus(stripeSubId, SUBSCRIPTION_STATUS.CANCELED, { canceled_at: nowStr });

  // LINEユーザーIDをシートから取得して通知
  if (result.found) {
    var sub = null;
    try {
      // SubscriptionService の getSubscriptionByLineUserId を使えないため直接検索しない
      // Stripe metadataからline_user_idを取得（subscription objectのmetadata）
      var lineUserId = subscription.metadata ? subscription.metadata.line_user_id : null;
      if (lineUserId) {
        sendLinePush(lineUserId,
          'ℹ️ ' + getSubscriptionPlanName() + 'が解約されました。ご利用ありがとうございました。'
        );
      }
    } catch (e) {
      appendLogRow('WARN', '[Subscription] Could not send cancellation notice: ' + e.message);
    }
  }
  appendLogRow('INFO', '[Subscription] Deleted: ' + stripeSubId);
}

/**
 * Handle invoice.payment_succeeded — update next billing date
 */
function handleInvoicePaymentSucceeded(invoice) {
  var stripeSubId = invoice.subscription;
  if (!stripeSubId) return;

  var nextBillingAt = invoice.period_end
    ? Utilities.formatDate(new Date(invoice.period_end * 1000), 'Asia/Tokyo', 'yyyy/MM/dd')
    : '';

  updateSubscriptionStatus(stripeSubId, SUBSCRIPTION_STATUS.ACTIVE, { next_billing_at: nextBillingAt });
  appendLogRow('INFO', '[Subscription] Invoice paid: ' + stripeSubId);
}

/**
 * Handle invoice.payment_failed — notify patient
 */
function handleInvoicePaymentFailed(invoice) {
  var stripeSubId = invoice.subscription;
  if (!stripeSubId) return;

  updateSubscriptionStatus(stripeSubId, SUBSCRIPTION_STATUS.PAST_DUE, {});

  var lineUserId = invoice.customer_email
    ? null // emailからlineUserIdは逆引き不可
    : (invoice.metadata ? invoice.metadata.line_user_id : null);

  if (lineUserId) {
    sendLinePush(lineUserId,
      '⚠️ サブスクリプションの決済が失敗しました。カード情報をご確認ください。'
    );
  }
  appendLogRow('WARN', '[Subscription] Invoice payment failed: ' + stripeSubId);
}
