/**
 * Setup - Initial Configuration
 *
 * Sets up triggers, creates sheets, and configures the system
 */

/**
 * Run initial setup
 */
function runSetup() {
  Logger.log('=== Starting System Setup ===');

  // Step 1: Initialize properties
  initializeDefaultProperties();
  Logger.log('Step 1: Properties initialized');

  // Step 2: Create sheets
  createAllSheets();
  Logger.log('Step 2: Sheets created');

  // Step 3: Create dashboard
  createDashboardSheet();
  Logger.log('Step 3: Dashboard created');

  // Step 4: Create waitlist dashboard
  createWaitlistDashboard();
  Logger.log('Step 4: Waitlist dashboard created');

  // Step 5: Set up triggers
  setupTriggers();
  Logger.log('Step 5: Triggers created');

  // Step 6: Validate configuration
  var validation = validateRequiredProperties();
  if (!validation.valid) {
    Logger.log('WARNING: Missing properties: ' + validation.missing.join(', '));
  }

  Logger.log('=== Setup Complete ===');
}

/**
 * Create all required sheets
 */
function createAllSheets() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());

  var sheetNames = [
    SHEET_NAMES.RESERVATIONS,
    SHEET_NAMES.WAITLIST,
    SHEET_NAMES.WEEKLY_SUMMARY
  ];

  for (var i = 0; i < sheetNames.length; i++) {
    var sheet = ss.getSheetByName(sheetNames[i]);

    if (!sheet) {
      switch (sheetNames[i]) {
        case SHEET_NAMES.RESERVATIONS:
          sheet = createSheetWithHeaders(ss, SHEET_NAMES.RESERVATIONS, RESERVATIONS_HEADERS);
          break;
        case SHEET_NAMES.WAITLIST:
          sheet = createSheetWithHeaders(ss, SHEET_NAMES.WAITLIST, WAITLIST_HEADERS);
          break;
        case SHEET_NAMES.WEEKLY_SUMMARY:
          sheet = createSheetWithHeaders(ss, SHEET_NAMES.WEEKLY_SUMMARY, WEEKLY_SUMMARY_HEADERS);
          break;
      }
      Logger.log('Created sheet: ' + sheetNames[i]);
    }
  }
}

/**
 * Setup time-based triggers — schedule reads from ScriptProperties with defaults
 */
function setupTriggers() {
  deleteExistingTriggers();

  var REMINDER_HOUR = parseInt(getProperty('TRIGGER_REMINDER_HOUR', '8'));
  var NOSHOW_CHECK_HOURS = (getProperty('TRIGGER_NOSHOW_CHECK_HOURS', '9,10,11,12,13,14,15,16,17') || '').split(',');
  var CLEANUP_HOUR = parseInt(getProperty('TRIGGER_CLEANUP_HOUR', '22'));
  var WEEKLY_REPORT_HOUR = parseInt(getProperty('TRIGGER_WEEKLY_REPORT_HOUR', '22'));
  var DASHBOARD_HOUR = parseInt(getProperty('TRIGGER_DASHBOARD_HOUR', '8'));

  // Trigger 1: Day-before reminders
  ScriptApp.newTrigger('sendDayBeforeReminders')
    .timeBased()
    .everyDays(1)
    .atHour(REMINDER_HOUR)
    .create();

  // Trigger 1b: Same-day morning reminders
  ScriptApp.newTrigger('sendSameDayReminders')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  // Trigger 2: No-show check (one trigger per hour)
  for (var i = 0; i < NOSHOW_CHECK_HOURS.length; i++) {
    var hour = parseInt(NOSHOW_CHECK_HOURS[i]);
    if (!isNaN(hour)) {
      ScriptApp.newTrigger('checkForNoShows')
        .timeBased()
        .everyDays(1)
        .atHour(hour)
        .create();
    }
  }

  // Trigger 3: Waitlist cleanup
  ScriptApp.newTrigger('cleanupWaitlist')
    .timeBased()
    .everyDays(1)
    .atHour(CLEANUP_HOUR)
    .create();

  // Trigger 4: Weekly report (Sunday)
  ScriptApp.newTrigger('generateWeeklyReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(WEEKLY_REPORT_HOUR)
    .create();

  // Trigger 5: Dashboard update
  ScriptApp.newTrigger('updateDashboard')
    .timeBased()
    .everyDays(1)
    .atHour(DASHBOARD_HOUR)
    .create();

  // Trigger 6: Unpaid reservation auto-cancel (every 30 minutes)
  ScriptApp.newTrigger('cancelExpiredUnpaidReservations')
    .timeBased()
    .everyMinutes(30)
    .create();

  // Trigger 7: Post-visit follow-up (every 60 minutes)
  ScriptApp.newTrigger('sendPostVisitFollowUps')
    .timeBased()
    .everyMinutes(60)
    .create();

  Logger.log('Created ' + (4 + NOSHOW_CHECK_HOURS.length + 3) + ' triggers');
}

/**
 * Delete existing triggers
 */
function deleteExistingTriggers() {
  var triggers = ScriptApp.getProjectTriggers();

  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  if (triggers.length > 0) {
    Logger.log('Deleted ' + triggers.length + ' existing triggers');
  }
}

/**
 * Configure for production
 */
function configureProductionEnvironment() {
  Logger.log('=== Configuring Production Environment ===');

  // Check current API keys
  var apiKey = getStripeApiKey();

  if (apiKey && apiKey.startsWith('sk_test_')) {
    Logger.log('WARNING: Currently using test API key');
    Logger.log('Please update STRIPE_API_KEY to live key in production');
  }

  // Set log level
  // Note: In production, minimize logging to avoid quota issues

  Logger.log('Production configuration review complete');
}

/**
 * List current triggers
 */
function listCurrentTriggers() {
  var triggers = ScriptApp.getProjectTriggers();

  Logger.log('=== Current Triggers (' + triggers.length + ') ===');

  for (var i = 0; i < triggers.length; i++) {
    var trigger = triggers[i];
    Logger.log('Trigger ' + (i + 1) + ': ' + trigger.getHandlerFunction());

    var triggerSource = trigger.getTriggerSource();
    var triggerType = '';

    if (triggerSource === ScriptApp.TriggerSource.CLOCK) {
      triggerType = 'Time-based';
    } else if (triggerSource === ScriptApp.TriggerSource.SPREADSHEETS) {
      triggerType = 'Spreadsheet';
    }

    Logger.log('  Type: ' + triggerType);
  }
}

/**
 * Get system status
 */
function getSystemStatus() {
  var validation = validateRequiredProperties();
  var triggers = ScriptApp.getProjectTriggers();

  var status = {
    properties_configured: validation.valid,
    missing_properties: validation.missing,
    triggers_count: triggers.length,
    spreadsheets_accessible: false
  };

  // Test sheet access
  try {
    var sheet = getReservationsSheet();
    status.spreadsheets_accessible = (sheet !== null);
  } catch (e) {
    status.spreadsheets_accessible = false;
  }

  return status;
}

/**
 * Run system health check
 */
function healthCheck() {
  Logger.log('=== System Health Check ===');

  var status = getSystemStatus();

  Logger.log('Properties Configured: ' + (status.properties_configured ? '✓' : '✗'));

  if (!status.properties_configured) {
    Logger.log('Missing Properties:');
    for (var i = 0; i < status.missing_properties.length; i++) {
      Logger.log('  - ' + status.missing_properties[i]);
    }
  }

  Logger.log('Triggers: ' + status.triggers_count);
  Logger.log('Spreadsheets Accessible: ' + (status.spreadsheets_accessible ? '✓' : '✗'));

  var overallHealth = status.properties_configured && status.spreadsheets_accessible;

  if (overallHealth) {
    Logger.log('System Status: HEALTHY ✓');
  } else {
    Logger.log('System Status: REQUIRES ATTENTION ✗');
  }

  return overallHealth;
}

/**
 * Manual test trigger function
 */
function testTriggerFunction() {
  Logger.log('Test trigger executed at: ' + formatDateTime(new Date()));
}

/**
 * Clear old user states (cleanup)
 */
function clearUserStates() {
  var userProps = PropertiesService.getUserProperties();
  var keys = userProps.getKeys();

  var clearedCount = 0;

  for (var i = 0; i < keys.length; i++) {
    if (keys[i].startsWith(TEMP_DATA_KEY_PREFIX)) {
      userProps.deleteProperty(keys[i]);
      clearedCount++;
    }
  }

  Logger.log('Cleared ' + clearedCount + ' old user states');
}

/**
 * Rename spreadsheet and script project (one-time setup utility)
 */
function renameResources() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  ss.setName('整骨院予約管理システム');
  Logger.log('Spreadsheet renamed to: ' + ss.getName());
  return 'OK: Spreadsheet renamed to ' + ss.getName();
}
