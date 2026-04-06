/**
 * Stripe Service - Stripe Payment Integration
 *
 * Handles payment link creation and Stripe API interactions
 */

var STRIPE_API_BASE = 'https://api.stripe.com/v1';

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
 */
function createPaymentLink(reservationId, patientName, amount) {
  var apiKey = getStripeApiKey();
  if (!apiKey) {
    Logger.log('[createPaymentLink] STRIPE_API_KEY not set');
    return null;
  }

  // Build flattened payload for Stripe Payment Links API
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
    success_url: 'https://line.me/R/',
    cancel_url: 'https://line.me/R/',
    metadata: {
      reservation_id: reservationId,
      patient_name: patientName
    }
  };

  var formBody = flattenForStripe(linkData).join('&');
  Logger.log('[createPaymentLink] Payload: ' + formBody.substring(0, 200));

  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: formBody,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(
    STRIPE_API_BASE + '/checkout/sessions',
    options
  );

  if (response.getResponseCode() !== 200) {
    Logger.log('[createPaymentLink] Error ' + response.getResponseCode() + ': ' + response.getContentText());
    return null;
  }

  var link = JSON.parse(response.getContentText());
  Logger.log('[createPaymentLink] Created: ' + link.url + ' for reservation: ' + reservationId);

  return link.url;
}

/**
 * Get payment intent by ID
 */
function getPaymentIntent(paymentIntentId) {
  var apiKey = getStripeApiKey();
  var url = STRIPE_API_BASE + '/payment_intents/' + paymentIntentId;

  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() !== 200) {
    Logger.log('Stripe Get Intent Error: ' + response.getContentText());
    return null;
  }

  return JSON.parse(response.getContentText());
}

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(payload, signature, secret) {
  var parts = signature.split(',');

  if (parts.length < 2) {
    Logger.log('Invalid signature format');
    return false;
  }

  var timestamp = parts[0].replace('t=', '');
  var v1Signature = parts[1].replace('v1=', '');

  // Check timestamp tolerance (5 minutes)
  var currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - parseInt(timestamp)) > 300) {
    Logger.log('Signature timestamp too old');
    return false;
  }

  // Create expected signature (byte array → hex string)
  var signedPayload = timestamp + '.' + payload;
  var sigBytes = Utilities.computeHmacSha256Signature(signedPayload, secret);
  var expectedSignature = sigBytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');

  // Compare signatures
  return v1Signature === expectedSignature;
}

/**
 * Refund payment
 */
function refundPayment(paymentIntentId, amount) {
  var apiKey = getStripeApiKey();
  var url = STRIPE_API_BASE + '/refunds';

  var refundData = {
    payment_intent: paymentIntentId,
    amount: amount
  };

  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: refundData,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() !== 200) {
    Logger.log('Stripe Refund Error: ' + response.getContentText());
    return null;
  }

  return JSON.parse(response.getContentText());
}

/**
 * Handle successful payment
 */
function handlePaymentSuccess(event) {
  var paymentIntent = event.data.object;
  var reservationId = paymentIntent.metadata.reservation_id;

  Logger.log('Payment succeeded for reservation: ' + reservationId);

  // Update reservation
  var reservation = getReservationById(reservationId);
  if (reservation) {
    updateReservation(reservationId, {
      deposit_status: DEPOSIT_STATUS.PAID,
      status: RESERVATION_STATUS.CONFIRMED
    });

    // Send confirmation message
    var message = MessageTemplates.getConfirmationMessage(reservation);
    sendLinePush(reservation.line_display_name, message);
  }
}

/**
 * Handle failed payment
 */
function handlePaymentFailure(event) {
  var paymentIntent = event.data.object;
  var reservationId = paymentIntent.metadata.reservation_id;

  Logger.log('Payment failed for reservation: ' + reservationId);

  var reservation = getReservationById(reservationId);
  if (reservation) {
    var message = MessageTemplates.getPaymentFailedMessage();
    sendLinePush(reservation.line_display_name, message);
  }
}
