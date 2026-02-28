/**
 * Reservation System - Main Entry Point
 *
 * Google Apps Script for LINE Bot + Stripe Integration
 *
 */

// Webhook entry point - handles both LINE and Stripe webhooks
function doPost(e) {
  var body = e.postData.contents;
  var signature = e.parameter.signature;

  // Parse X-Line-Signature header for LINE webhook verification
  var lineSignature = e.parameter['x-line-signature'];

  // Parse Stripe-Signature header for Stripe webhook verification
  var stripeSignature = e.parameter['stripe-signature'];

  var headers = {};
  if (lineSignature) {
    headers['x-line-signature'] = lineSignature;
  }
  if (stripeSignature) {
    headers['stripe-signature'] = stripeSignature;
  }

  // Route to appropriate handler
  if (lineSignature) {
    // LINE webhook event
    handleLineWebhook(body, headers);
  } else if (stripeSignature) {
    // Stripe webhook event
    handleStripeWebhook(body, headers);
  } else {
    // Unknown webhook
    Logger.log('Unknown webhook source');
    return createTextOutput('error', 'Unknown webhook');
  }

  return createTextOutput('success', 'Webhook processed');
}

/**
 * Handle LINE webhook events
 *
 */
function handleLineWebhook(body, headers) {
  // Verify LINE signature
  if (!verifyLineSignature(body, headers['x-line-signature'])) {
    return createTextOutput('error', 'Invalid LINE signature');
  }

  var data = JSON.parse(body);
  var events = data.events;

  if (!events || events.length === 0) {
    return createTextOutput('error', 'No events found');
  }

  for (var i = 0; i < events.length; i++) {
    try {
      handleLineEvent(events[i]);
    } catch (eventError) {
      Logger.log('handleLineEvent error: ' + eventError.toString());
    }
  }
}

/**
 * Handle Stripe webhook events
 *
 */
function handleStripeWebhook(body, headers) {
  // Verify Stripe signature
  if (!verifyStripeSignature(body, headers['stripe-signature'])) {
    return createTextOutput('error', 'Invalid Stripe signature');
  }

  var data = JSON.parse(body);
  var event = data;

  if (!event || !event.type) {
    return createTextOutput('error', 'No event data');
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      handlePaymentFailure(event.data.object);
      break;
    default:
      Logger.log('Unknown Stripe event type: ' + event.type);
  }
}

/**
 * Verify LINE webhook signature
 *
 */
function verifyLineSignature(body, signature) {
  var secret = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_SECRET');
  if (!secret) {
    Logger.log('LINE_CHANNEL_SECRET not configured');
    return false;
  }

  // Create expected signature
  var expectedSignature = Utilities.computeHmacSha256Signature(body, secret);

  // Get signature from header
  var actualSignature = headers['x-line-signature'];

  // Compare signatures
  return actualSignature === expectedSignature;
}

/**
 * Verify Stripe webhook signature
 *
 */
function verifyStripeSignature(body, signature) {
  var secret = PropertiesService.getScriptProperties().getProperty('STRIPE_WEBHOOK_SECRET');
  if (!secret) {
    Logger.log('STRIPE_WEBHOOK_SECRET not configured');
    return false;
  }

  // Parse Stripe signature format: timestamp,v1
  var signatureParts = signature.split(',');
  var timestamp = parseInt(signatureParts[0]);
  var v1 = signatureParts[1].replace(/=/g, '');

  var expectedSignature = Utilities.computeHmacSha256Signature(
    'timestamp=' + timestamp + ',v1=' + v1 + ',signature=' + body,
    secret
  );

  // Get signature from header
  var actualSignature = headers['stripe-signature'];

  // Compare signatures
  return actualSignature === expectedSignature;
}

/**
 * Create webhook response output
 *
 */
function createTextOutput(status, message) {
  var output = {
    status: status,
    message: message
  };

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}