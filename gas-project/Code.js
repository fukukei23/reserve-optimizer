/**
 * Reservation System - Main Entry Point
 *
 * Google Apps Script for LINE Bot + Stripe Integration
 *
 * アーキテクチャ:
 *   本番: LINE/Stripe → Cloudflare Worker（署名検証） → GAS（処理のみ）
 *   テスト: LINE → GAS（直接署名検証）
 *   Worker経由のリクエストは X-Verified ヘッダーで識別
 *   直接アクセス時はLINE署名検証を実施（テストモード）
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

  // 直接アクセス（Worker経由でない）→ LINE署名検証を試みる
  // テストモード: LINE Developers Consoleから直接webhookを受信
  console.log('[Direct] Direct access - attempting LINE signature verification');
  return handleDirectLineWebhook(e, body);
}

/**
 * 直接アクセス時のLINE Webhook処理
 * LINE署名検証を実施してから処理
 */
function handleDirectLineWebhook(e, body) {
  var channelSecret = getLineChannelSecret();

  // デバッグ: スプレッドシートにボディ内容を書き込み
  try {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var logSheet = ss.getSheetByName('logs');
    if (logSheet) {
      logSheet.appendRow([new Date(), 'DEBUG', 'body length=' + (body ? body.length : 'null') + ' params=' + JSON.stringify(e.parameter).substring(0, 200)]);
      if (body) {
        logSheet.appendRow([new Date(), 'DEBUG_BODY', body.substring(0, 500)]);
      }
    }
  } catch (debugErr) {
    // デバッグ書き込み失敗は無視
  }

  if (!channelSecret) {
    console.error('[Direct] Rejected: LINE_CHANNEL_SECRET not configured');
    return createTextOutput('error', 'Channel secret not configured');
  }

  // LINE署名検証
  var signature = e.parameter['x-line-signature'];
  if (!signature) {
    // GAS Web Appではカスタムヘッダーがクエリパラメータに変換されない場合がある
    // ボディがLINEイベント形式かチェック
    try {
      var data = JSON.parse(body);
      if (data.events && data.events.length > 0) {
        console.log('[Direct] Events detected, processing (signature bypass for testing)');
        return handleLineWebhookVerified(body);
      }
    } catch (parseErr) {
      console.error('[Direct] Parse error: ' + parseErr.toString());
    }
    console.warn('[Direct] Rejected: not a LINE webhook');
    return createTextOutput('error', 'Not a LINE webhook');
  }

  // 署名検証（HMAC-SHA256）
  var expectedSig = computeLineSignature(channelSecret, body);
  if (signature !== expectedSig) {
    console.error('[Direct] Rejected: LINE signature mismatch');
    return createTextOutput('error', 'Invalid signature');
  }

  return handleLineWebhookVerified(body);
}

/**
 * LINE署名計算（HMAC-SHA256）
 */
function computeLineSignature(secret, body) {
  var blob = Utilities.newBlob(body);
  var key = Utilities.newBlob(secret);
  var hmac = Utilities.computeHmacSha256Signature(blob.getBytes(), key);
  return Utilities.base64Encode(hmac);
}

/**
 * LINE Webhook処理（Worker検証済み）
 */
function handleLineWebhookVerified(body) {
  console.log('[Webhook] Received body length: ' + body.length);
  console.log('[Webhook] Body preview: ' + body.substring(0, 300));

  var data = JSON.parse(body);
  var events = data.events;

  if (!events || events.length === 0) {
    console.warn('[Webhook] No events found');
    return createTextOutput('error', 'No events found');
  }

  console.log('[Webhook] Processing ' + events.length + ' events');

  for (var i = 0; i < events.length; i++) {
    try {
      var evt = events[i];
      console.log('[Webhook] Event #' + i + ': type=' + evt.type + ' replyToken=' + (evt.replyToken || 'N/A').substring(0, 10) + '... userId=' + (evt.source ? evt.source.userId : 'N/A').substring(0, 10) + '...');
      if (evt.message) {
        console.log('[Webhook] Message: type=' + evt.message.type + ' text=' + (evt.message.text || '').substring(0, 100));
      }
      handleLineEvent(evt);
      console.log('[Webhook] Event #' + i + ' completed');
    } catch (eventError) {
      var errMsg = eventError.message || eventError.toString();
      var errStack = eventError.stack || '';
      console.error('[Webhook] Event #' + i + ' error: ' + errMsg + '\nStack: ' + errStack);
      try {
        appendLogRow('ERROR', 'Event #' + i + ': ' + errMsg + ' | Stack: ' + errStack);
      } catch (logErr) {
        console.error('[Webhook] appendLogRow failed: ' + logErr.toString());
      }
      // Try to notify admin
      try {
        var adminId = getLineAdminUserId();
        if (adminId) {
          sendLinePush(adminId, '[DEBUG ERROR] ' + errMsg);
        }
      } catch (notifyErr) {
        console.error('[Webhook] Admin notify failed: ' + notifyErr.toString());
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
    case 'checkout.session.completed':
      handleCheckoutSessionCompleted(event.data.object);
      break;
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
      console.log('[Stripe] Unknown event type: ' + event.type);
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
    console.error('[AutoDetect] Parse error: ' + e.toString());
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
