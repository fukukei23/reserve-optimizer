/**
 * Reservation System - Main Entry Point
 *
 * Google Apps Script for LINE Bot + Stripe Integration
 *
 * アーキテクチャ:
 *   LINE/Stripe → Cloudflare Worker（署名検証） → GAS（処理のみ）
 *   Worker経由のリクエストは X-Verified ヘッダーで識別
 */

// Webhook entry point - handles both LINE and Stripe webhooks
function doPost(e) {
  var body = e.postData.contents;

  // Worker経由の検証済みリクエストかチェック
  // Workerは X-Verified: true ヘッダーを付与（GASではクエリパラメータとして受信）
  var verified = e.parameter['x-verified'];
  var source = e.parameter['x-source'] || '';

  if (verified === 'true') {
    // Workerで署名検証済み → ソースに応じてルーティング
    if (source === 'line') {
      return handleLineWebhookVerified(body);
    } else if (source === 'stripe') {
      return handleStripeWebhookVerified(body);
    } else {
      // ソース不明 → ボディから自動判別
      return handleAutoDetect(body);
    }
  }

  // 直接アクセス（Worker経由でない）→ 拒否
  Logger.log('Rejected direct access (not from Worker)');
  return createTextOutput('error', 'Direct access not allowed');
}

/**
 * LINE Webhook処理（Worker検証済み）
 */
function handleLineWebhookVerified(body) {
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
      try {
        appendLogRow('ERROR', eventError.message || eventError.toString());
      } catch (logErr) {
        Logger.log('appendLogRow failed: ' + logErr.toString());
      }
    }
  }

  return createTextOutput('success', 'LINE webhook processed');
}

/**
 * Stripe Webhook処理（Worker検証済み）
 */
function handleStripeWebhookVerified(body) {
  var event = JSON.parse(body);

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
    case 'charge.refunded':
      handleRefund(event.data.object);
      break;
    default:
      Logger.log('Unknown Stripe event type: ' + event.type);
  }

  return createTextOutput('success', 'Stripe webhook processed');
}

/**
 * ソース自動判別（Worker検証済みだがソース不明の場合）
 */
function handleAutoDetect(body) {
  try {
    var data = JSON.parse(body);
    if (data.events) {
      return handleLineWebhookVerified(body);
    } else if (data.type && data.data) {
      return handleStripeWebhookVerified(body);
    }
  } catch (e) {
    Logger.log('Auto-detect parse error: ' + e.toString());
  }

  return createTextOutput('error', 'Could not determine webhook source');
}

/**
 * Create webhook response output
 */
function createTextOutput(status, message) {
  var output = {
    status: status,
    message: message
  };

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
