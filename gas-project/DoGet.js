/**
 * Web App GET handler
 *
 * 3つのモードを処理:
 * 1. Worker転送モード: x-verified=true & x-body=<body> → Webhook処理
 * 2. gas-autopilotモード: fn=<functionName> → 関数実行
 * 3. ヘルスチェック: パラメータなし → ステータス返却
 */

/**
 * Autopilot function routing table
 * Maps function names to their handler functions
 */
var _GET_ROUTES = {
  runSetup: runSetup,
  healthCheck: healthCheck,
  getSystemStatus: getSystemStatus,
  setupRichMenuFromProperty: setupRichMenuFromProperty,
  storeRichMenuImage: _storeRichMenuImageChunk,
  clearRichMenuImage: _clearRichMenuImageProperty,
  initializeDefaultProperties: initializeDefaultProperties,
  renameResources: renameResources
};

// Debug/test routes — only available in non-production environments
var _DEBUG_ROUTES = {
  testConfig: testConfig,
  testCancelFlow: testCancelFlow,
  testChangeFlow: testChangeFlow,
  testLineReply: testLineReply,
  debugDoPost: debugDoPost,
  debugStripeLink: debugStripeLink
};

function doGet(e) {
  // === Mode 1: Worker forwarding ===
  var verified = e.parameter['x-verified'];
  var source = e.parameter['x-source'] || '';
  var body = e.parameter['x-body'] || '';

  if (verified === 'true' && body) {
    body = decodeURIComponent(body);
    appendLogRow('DEBUG', 'doGet: source=' + source + ' body=' + body.substring(0, 300));

    if (source === 'line') {
      return _dispatchLineWebhook(body);
    } else if (source === 'stripe') {
      var stripeParams = { 'x-stripe-signature': e.parameter['x-stripe-signature'] || '' };
      return _dispatchStripeWebhook(body, stripeParams);
    } else {
      return _autoDetectWebhook(body);
    }
  }

  // === Mode 2: gas-autopilot (requires Bearer auth) ===
  var fnName = (e && e.parameter && e.parameter.fn) || '';

  if (fnName && (fnName in _GET_ROUTES || fnName in _DEBUG_ROUTES)) {
    // Block debug routes in production
    if (fnName in _DEBUG_ROUTES) {
      var isProduction = PropertiesService.getScriptProperties().getProperty('ENV') === 'production';
      if (isProduction) {
        return ContentService.createTextOutput(
          JSON.stringify({ ok: false, error: 'Debug routes not available in production' })
        ).setMimeType(ContentService.MimeType.JSON).setStatusCode(403);
      }
    }
    var routeTable = fnName in _GET_ROUTES ? _GET_ROUTES : _DEBUG_ROUTES;
    // Verify Bearer token from Authorization header
    var authHeader = '';
    if (e && e.headers && e.headers['Authorization']) {
      authHeader = e.headers['Authorization'];
    }
    var expectedToken = PropertiesService.getScriptProperties().getProperty('GAS_AUTH_TOKEN');
    if (!expectedToken || authHeader !== 'Bearer ' + expectedToken) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: 'Unauthorized' })
      ).setMimeType(ContentService.MimeType.JSON).setStatusCode(401);
    }
    try {
      var result = routeTable[fnName](e.parameter);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, function: fnName, result: result || null })
      ).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, function: fnName, error: error.message })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // === Mode 3: Health check ===
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', message: 'Reserve Optimizer GAS', timestamp: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Rich menu image chunk storage helper
 */
function _storeRichMenuImageChunk(params) {
  var param1 = params && params.p1 || '';
  if (!param1) return { ok: false, error: 'p1 (base64 chunk) required' };
  var existing = PropertiesService.getScriptProperties().getProperty('RICHMENU_IMAGE_B64') || '';
  PropertiesService.getScriptProperties().setProperty('RICHMENU_IMAGE_B64', existing + param1);
  return { ok: true, length: (existing + param1).length };
}

/**
 * Rich menu image property cleanup helper
 */
function _clearRichMenuImageProperty() {
  PropertiesService.getScriptProperties().deleteProperty('RICHMENU_IMAGE_B64');
  return { ok: true };
}

/**
 * Test config function for gas-run.sh verification
 */
function testConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    lineChannelSecret: props.getProperty('LINE_CHANNEL_SECRET') ? 'SET' : 'NOT_SET',
    lineChannelAccessToken: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') ? 'SET' : 'NOT_SET',
    lineAdminUserId: props.getProperty('LINE_ADMIN_USER_ID') ? 'SET' : 'NOT_SET',
    stripeApiKey: props.getProperty('STRIPE_API_KEY') ? 'SET' : 'NOT_SET',
    spreadsheetId: props.getProperty('SPREADSHEET_ID') ? 'SET' : 'NOT_SET',
    timestamp: new Date().toISOString()
  };
}

/**
 * Test LINE push message to admin
 */
function testLineReply() {
  var adminId = getLineAdminUserId();
  var token = getLineAccessToken();
  if (!adminId || !token) {
    return { error: 'Admin ID or Token not set', adminId: adminId ? 'SET' : 'NOT_SET', token: token ? 'SET' : 'NOT_SET' };
  }

  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
    to: adminId,
    messages: [{ type: 'text', text: 'テストメッセージ from GAS ' + new Date().toISOString() }]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  return {
    statusCode: response.getResponseCode(),
    responseBody: response.getContentText().substring(0, 200),
    adminId: adminId.substring(0, 10) + '...'
  };
}

/**
 * Debug doPost - simulate LINE webhook event
 */
function debugDoPost() {
  var adminId = getLineAdminUserId();
  var testEvent = {
    type: 'message',
    replyToken: 'INVALID_TOKEN_FOR_TEST',
    source: { userId: adminId, type: 'user' },
    message: { type: 'text', text: '予約したい' }
  };

  try {
    handleLineEvent(testEvent);
    return { success: true, note: 'handleLineEvent completed (reply will fail due to invalid token)' };
  } catch (e) {
    return { success: false, error: e.message, stack: e.stack || 'no stack' };
  }
}

/**
 * Debug Stripe payment link creation
 */
function debugStripeLink() {
  try {
    var apiKey = getStripeApiKey();
    if (!apiKey) return { error: 'STRIPE_API_KEY not set' };

    var linkData = {
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: { name: 'テスト予約デポジット' },
          unit_amount: '3000'
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: 'https://line.me/R/',
      cancel_url: 'https://line.me/R/'
    };

    var formBody = flattenForStripe(linkData).join('&');
    var options = {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: formBody,
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions', options);
    return {
      statusCode: response.getResponseCode(),
      body: response.getContentText().substring(0, 500),
      payload: formBody.substring(0, 200)
    };
  } catch (e) {
    return { error: e.message, stack: e.stack || 'no stack' };
  }
}
