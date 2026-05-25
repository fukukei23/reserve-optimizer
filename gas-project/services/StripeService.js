/**
 * Stripe Service - Stripe Payment Integration
 *
 * Handles payment link creation and Stripe API interactions
 * All API methods return Result objects: { success: boolean, data?: any, error?: string }
 */

var STRIPE_API_BASE = 'https://api.stripe.com/v1';

/**
 * Call Stripe API with consistent error handling
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. '/checkout/sessions')
 * @param {object} [payload] - Request payload (will be form-encoded)
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
function _callStripeApi(method, path, payload) {
  var apiKey = getStripeApiKey();
  if (!apiKey) {
    return { success: false, error: 'STRIPE_API_KEY not configured' };
  }

  var options = {
    method: method,
    contentType: 'application/x-www-form-urlencoded',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    muteHttpExceptions: true
  };

  if (payload) {
    options.payload = typeof payload === 'string' ? payload : flattenForStripe(payload).join('&');
  }

  try {
    var response = UrlFetchApp.fetch(STRIPE_API_BASE + path, options);
    var code = response.getResponseCode();

    if (code >= 200 && code < 300) {
      return { success: true, data: JSON.parse(response.getContentText()) };
    }

    var errorBody = response.getContentText();
    appendLogRow('ERROR', 'Stripe API ' + method + ' ' + path + ' returned ' + code + ': ' + errorBody.substring(0, 300));
    return { success: false, error: 'Stripe API error ' + code + ': ' + errorBody.substring(0, 200) };
  } catch (e) {
    appendLogRow('ERROR', 'Stripe API exception: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Flatten nested object to Stripe-compatible form-encoded string
 * {a: {b: 'c'}} → 'a[b]=c'
 * {items: [{price: 100}]} → 'items[0][price]=100'
 */
function flattenForStripe(obj, prefix) {
  var parts = [];
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    var fullKey = prefix ? prefix + '[' + key + ']' : key;
    var val = obj[key];
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      for (var i = 0; i < val.length; i++) {
        parts = parts.concat(flattenForStripe(val[i], fullKey + '[' + i + ']'));
      }
    } else if (typeof val === 'object') {
      parts = parts.concat(flattenForStripe(val, fullKey));
    } else {
      parts.push(encodeURIComponent(fullKey) + '=' + encodeURIComponent(val));
    }
  }
  return parts;
}

/**
 * Create payment link for reservation deposit
 * @returns {string|null} Checkout session URL or null on failure
 */
function createPaymentLink(reservationId, patientName, amount) {
  var linkData = {
    line_items: [{
      price_data: {
        currency: 'jpy',
        product_data: {
          name: '予約デポジット - ' + reservationId,
          description: '患者: ' + patientName
        },
        unit_amount: String(amount)
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: getStripeSuccessUrl(),
    cancel_url: getStripeCancelUrl(),
    metadata: {
      reservation_id: reservationId,
      patient_name: patientName
    }
  };

  var result = _callStripeApi('post', '/checkout/sessions', linkData);
  if (!result.success) {
    appendLogRow('ERROR', '[createPaymentLink] Failed for ' + reservationId + ': ' + result.error);
    return null;
  }

  appendLogRow('INFO', '[createPaymentLink] Created: ' + result.data.url + ' for reservation: ' + reservationId);
  return result.data.url;
}

/**
 * Get payment intent by ID
 * @returns {object|null} Payment intent object or null on failure
 */
function getPaymentIntent(paymentIntentId) {
  var result = _callStripeApi('get', '/payment_intents/' + paymentIntentId);
  if (!result.success) {
    appendLogRow('ERROR', '[getPaymentIntent] Failed for ' + paymentIntentId + ': ' + result.error);
    return null;
  }
  return result.data;
}

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(payload, signature, secret) {
  if (!signature || signature.indexOf(',') === -1) {
    appendLogRow('WARN', '[Stripe] Invalid signature format');
    return false;
  }

  var parts = signature.split(',');

  var timestamp = parts[0].replace('t=', '');
  var v1Signature = parts[1].replace('v1=', '');

  // Check timestamp tolerance (5 minutes)
  var currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - parseInt(timestamp)) > 300) {
    appendLogRow('WARN', '[Stripe] Signature timestamp too old');
    return false;
  }

  // Create expected signature (byte array → hex string)
  var signedPayload = timestamp + '.' + payload;
  var sigBytes = Utilities.computeHmacSha256Signature(signedPayload, secret);
  var expectedSignature = sigBytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');

  // Compare signatures (constant-time to prevent timing attacks)
  return _constantTimeEqual(v1Signature, expectedSignature);
}

/**
 * Refund payment
 * @returns {object|null} Refund object or null on failure
 */
function refundPayment(paymentIntentId, amount) {
  var result = _callStripeApi('post', '/refunds', {
    payment_intent: paymentIntentId,
    amount: amount
  });
  if (!result.success) {
    appendLogRow('ERROR', '[refundPayment] Failed for ' + paymentIntentId + ': ' + result.error);
    return null;
  }
  return result.data;
}

/**
 * Get checkout session by ID from Stripe API
 * @returns {object|null} Session object or null on failure
 */
function getCheckoutSession(sessionId) {
  var result = _callStripeApi('get', '/checkout/sessions/' + sessionId);
  if (!result.success) {
    appendLogRow('ERROR', '[getCheckoutSession] Failed for ' + sessionId + ': ' + result.error);
    return null;
  }
  return result.data;
}

