/**
 * Web App GET handler (for gas-autopilot / gas-run.sh)
 *
 * Specifies the function to execute via the query parameter "fn"
 * Only allowed functions can be executed (security)
 *
 * Usage: curl "<deployUrl>?fn=healthCheck"
 */
function doGet(e) {
  var fnName = (e && e.parameter && e.parameter.fn) || '';

  // List allowed functions here
  var allowedFunctions = {
    runSetup: runSetup,
    healthCheck: healthCheck,
    getSystemStatus: getSystemStatus,
    testConfig: testConfig,
    testCancelFlow: testCancelFlow,
    testChangeFlow: testChangeFlow
  };

  if (!fnName || !(fnName in allowedFunctions)) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: 'Unknown function: ' + fnName + '. Allowed: ' + Object.keys(allowedFunctions).join(', ') })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var result = allowedFunctions[fnName]();
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, function: fnName, result: result || null })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, function: fnName, error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test config function for gas-run.sh verification
 */
function testConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    lineChannelSecret: props.getProperty('LINE_CHANNEL_SECRET') ? 'SET' : 'NOT_SET',
    stripeSecretKey: props.getProperty('STRIPE_SECRET_KEY') ? 'SET' : 'NOT_SET',
    spreadsheetId: props.getProperty('SPREADSHEET_ID') ? 'SET' : 'NOT_SET',
    timestamp: new Date().toISOString()
  };
}
