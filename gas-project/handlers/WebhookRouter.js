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
    } else if (source === 'api') {
      return _dispatchApiRequest(body);
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
    appendLogRow('WARN', 'Direct access rejected: missing LINE signature');
    return _jsonResponse('error', 'Missing signature');
  }

  // HMAC-SHA256 signature verification (constant-time comparison)
  var expectedSig = _computeLineSignature(channelSecret, body);
  if (!_constantTimeEqual(signature, expectedSig)) {
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
 * Constant-time string comparison to prevent timing attacks
 */
function _constantTimeEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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
function _dispatchStripeWebhook(body, headers) {
  appendLogRow('STRIPE', 'Webhook received: body=' + body.substring(0, 300));

  // Verify Stripe webhook signature (mandatory)
  var webhookSecret = getStripeWebhookSecret();
  if (webhookSecret) {
    var sigParam = (headers && headers['x-stripe-signature']) || '';
    if (!sigParam) {
      appendLogRow('ERROR', '[Stripe] No signature provided — rejecting');
      return _jsonResponse('error', 'Missing signature', 400);
    } else if (!verifyStripeSignature(body, sigParam, webhookSecret)) {
      appendLogRow('ERROR', '[Stripe] Signature verification failed');
      return _jsonResponse('error', 'Invalid signature');
    }
  }

  var payload = JSON.parse(body);

  if (!payload || !payload.type) {
    appendLogRow('STRIPE_ERROR', 'No event type in payload');
    return _jsonResponse('error', 'No event data');
  }

  // Idempotency check: skip already-processed events (20min TTL via CacheService)
  var eventId = payload.id;
  if (eventId) {
    var processedKey = 'stripe_evt_' + eventId;
    var cache = CacheService.getScriptCache();
    if (cache.get(processedKey)) {
      appendLogRow('INFO', '[Stripe] Duplicate event skipped: ' + eventId);
      return _jsonResponse('success', 'Duplicate event already processed');
    }
    cache.put(processedKey, new Date().toISOString(), 1200); // 20 minutes TTL
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
  notifyReservationAdmin('新しい予約が確定しました', reservation);

  // CRM: fire confirmed webhook
  try {
    _fireCrmWebhook('reservation.confirmed', {
      reservation_id: reservationId, phone: reservation.phone
    });
  } catch (crmErr) {
    appendLogRow('WARN', 'CRM confirmed hook error: ' + crmErr.message);
  }
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
  var paymentIntentId = payload.payment_intent || '';
  appendLogRow('STRIPE', 'Refund event for charge: ' + payload.id + ' pi: ' + paymentIntentId);

  if (!paymentIntentId) {
    appendLogRow('WARN', 'No payment_intent in refund payload');
    return;
  }

  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];
    if (r.payment_intent_id === paymentIntentId) {
      updateReservation(r.id, { deposit_status: DEPOSIT_STATUS.REFUNDED });
      sendLinePush(r.line_display_name, MessageTemplates.getRefundConfirmationMessage(r.id));
      appendLogRow('STRIPE', 'Refund processed for reservation: ' + r.id);
      return;
    }
  }
  appendLogRow('WARN', 'No reservation found with payment_intent_id: ' + paymentIntentId);
}

// --- Web API handlers ---

/**
 * Dispatch API requests from Web reservation page (x-source=api)
 */
function _dispatchApiRequest(body) {
  // Bearer token authentication — API endpoints require WEB_API_KEY
  var authToken = PropertiesService.getScriptProperties().getProperty('WEB_API_KEY');
  if (!authToken) {
    appendLogRow('ERROR', 'API request rejected: WEB_API_KEY not configured');
    return _apiResponse({ error: 'Server misconfigured' }, 500);
  }
  // Token passed via x-api-key header or api_token field in body
  var apiKey = '';
  try {
    var preData = JSON.parse(body);
    apiKey = preData.api_token || '';
  } catch (e) {
    return _apiResponse({ error: 'Invalid JSON' }, 400);
  }
  if (apiKey !== authToken) {
    appendLogRow('WARN', 'API request rejected: invalid token');
    return _apiResponse({ error: 'Unauthorized' }, 401);
  }

  var data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return _apiResponse({ error: 'Invalid JSON' }, 400);
  }

  switch (data.action) {
    case 'get_availability':
      return _handleGetAvailability(data);
    case 'create_reservation':
      return _handleCreateReservationApi(data);
    default:
      return _apiResponse({ error: 'Unknown action: ' + (data.action || 'null') }, 400);
  }
}

/**
 * GET /api/availability — return available time slots for a date
 */
function _handleGetAvailability(data) {
  if (!data.date) {
    return _apiResponse({ error: 'date is required' }, 400);
  }

  var dateValidation = validateDateForBooking(data.date);
  if (!dateValidation.valid) {
    return _apiResponse({ error: dateValidation.errorMessage }, 400);
  }

  var bookedSlots = getBookedSlotsForDate(data.date);
  var maxBookings = getMaxConcurrentBookings();
  var startH = parseInt((getProperty('BUSINESS_START_TIME') || '09:00').split(':')[0]);
  var endH = parseInt((getProperty('BUSINESS_END_TIME') || '18:00').split(':')[0]);

  var slots = [];
  for (var h = startH; h < endH; h++) {
    for (var m = 0; m < 60; m += 30) {
      var time = ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
      var count = bookedSlots[time] || 0;
      slots.push({ time: time, available: count < maxBookings, booked: count, capacity: maxBookings });
    }
  }

  return _apiResponse({ date: data.date, slots: slots });
}

/**
 * POST /api/reserve — create reservation from Web form
 */
function _handleCreateReservationApi(data) {
  if (!data.name || !data.phone || !data.date || !data.time || !data.treatment) {
    return _apiResponse({ error: 'Missing required fields' }, 400);
  }

  // Validate treatment
  if (!TREATMENT_DURATIONS[data.treatment]) {
    return _apiResponse({ error: 'Invalid treatment type' }, 400);
  }

  // Validate date
  var dateValidation = validateDateForBooking(data.date);
  if (!dateValidation.valid) {
    return _apiResponse({ error: dateValidation.errorMessage }, 400);
  }

  // Validate time
  var normalized = normalizeTimeInput(data.time);
  if (!validateTime(normalized)) {
    return _apiResponse({ error: 'Invalid time format' }, 400);
  }

  var duration = getTreatmentDuration(data.treatment);
  var endTime = calculateEndTime(normalized, duration);

  var tempData = {
    patient_name: data.name,
    phone: data.phone,
    line_display_name: 'WEB',
    visit_type: data.treatment.includes('初診') ? VISIT_TYPE.FIRST : VISIT_TYPE.REPEAT,
    menu_type: data.treatment,
    reserved_date: data.date,
    reserved_start: normalized,
    reserved_end: endTime,
    status: RESERVATION_STATUS.PENDING,
    deposit_status: DEPOSIT_STATUS.UNPAID,
    notes: 'source:web'
  };

  // Create reservation with lock (shared function in ReservationHandler)
  var lockResult = _createReservationWithLock(tempData);

  if (!lockResult.ok) {
    if (lockResult.reason === 'SLOT_FULL') {
      return _apiResponse({ error: 'この時間は既に予約で埋まっています' }, 409);
    }
    return _apiResponse({ error: '予約の作成に失敗しました' }, 500);
  }

  var result = lockResult.reservation;

  // Post-creation hooks
  try { _onReservationCreated(result.id, tempData); } catch (hookErr) {
    appendLogRow('WARN', 'Web API post-create hook error: ' + hookErr.message);
  }

  // CRM: get or create customer, fire webhook
  try {
    getOrCreateCustomer(data.phone, data.name, 'WEB');
    _fireCrmWebhook('reservation.created', {
      reservation_id: result.id, phone: data.phone, date: data.date, time: normalized
    });
  } catch (crmErr) {
    appendLogRow('WARN', 'CRM hook error: ' + crmErr.message);
  }

  appendLogRow('INFO', 'Web reservation created: ' + result.id);

  return _apiResponse({
    status: 'created',
    reservation_id: result.id,
    date: data.date,
    time: normalized,
    end_time: endTime,
    menu_type: data.treatment
  });
}

/**
 * API response helper (JSON with CORS-friendly format)
 */
function _apiResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// --- Response helpers ---

/**
 * Create JSON webhook response
 */
function _jsonResponse(status, message) {
  return ContentService.createTextOutput(JSON.stringify({ status: status, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
