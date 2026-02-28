/**
 * Script Properties Configuration
 *
 * Manages environment variables and system settings
 */

// Property keys
var PROPERTY_KEYS = {
  // LINE settings
  LINE_CHANNEL_ACCESS_TOKEN: 'LINE_CHANNEL_ACCESS_TOKEN',
  LINE_CHANNEL_SECRET: 'LINE_CHANNEL_SECRET',
  LINE_ADMIN_USER_ID: 'LINE_ADMIN_USER_ID',

  // Stripe settings
  STRIPE_API_KEY: 'STRIPE_API_KEY',
  STRIPE_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',

  // Google Sheets
  SPREADSHEET_ID: 'SPREADSHEET_ID',

  // System settings
  DEPOSIT_AMOUNT_JPY: 'DEPOSIT_AMOUNT_JPY',
  CANCELLATION_DEADLINE_HOURS: 'CANCELLATION_DEADLINE_HOURS',
  REMINDER_HOURS_BEFORE: 'REMINDER_HOURS_BEFORE',
  RESALE_NOTIFICATION_MINUTES: 'RESALE_NOTIFICATION_MINUTES',
  AVERAGE_UNIT_PRICE: 'AVERAGE_UNIT_PRICE',
  NO_SHOW_THRESHOLD: 'NO_SHOW_THRESHOLD',
  NO_SHOW_DEPOSIT_AMOUNT: 'NO_SHOW_DEPOSIT_AMOUNT'
};

/**
 * Get property value with default fallback
 */
function getProperty(key, defaultValue) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value !== null ? value : defaultValue;
}

/**
 * Set property value
 */
function setProperty(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

/**
 * Get LINE channel access token
 */
function getLineAccessToken() {
  return getProperty(PROPERTY_KEYS.LINE_CHANNEL_ACCESS_TOKEN);
}

/**
 * Get LINE channel secret
 */
function getLineChannelSecret() {
  return getProperty(PROPERTY_KEYS.LINE_CHANNEL_SECRET);
}

/**
 * Get LINE admin user ID
 */
function getLineAdminUserId() {
  return getProperty(PROPERTY_KEYS.LINE_ADMIN_USER_ID);
}

/**
 * Get Stripe API key
 */
function getStripeApiKey() {
  return getProperty(PROPERTY_KEYS.STRIPE_API_KEY);
}

/**
 * Get Stripe webhook secret
 */
function getStripeWebhookSecret() {
  return getProperty(PROPERTY_KEYS.STRIPE_WEBHOOK_SECRET);
}

/**
 * Get spreadsheet ID
 */
function getSpreadsheetId() {
  return getProperty(PROPERTY_KEYS.SPREADSHEET_ID);
}

/**
 * Get deposit amount in JPY
 */
function getDepositAmount() {
  return parseInt(getProperty(PROPERTY_KEYS.DEPOSIT_AMOUNT_JPY, '1000'));
}

/**
 * Get cancellation deadline in hours
 */
function getCancellationDeadlineHours() {
  return parseInt(getProperty(PROPERTY_KEYS.CANCELLATION_DEADLINE_HOURS, '2'));
}

/**
 * Get reminder hours before appointment
 */
function getReminderHoursBefore() {
  return parseInt(getProperty(PROPERTY_KEYS.REMINDER_HOURS_BEFORE, '24'));
}

/**
 * Get resale notification minutes
 */
function getResaleNotificationMinutes() {
  return parseInt(getProperty(PROPERTY_KEYS.RESALE_NOTIFICATION_MINUTES, '10'));
}

/**
 * Get average unit price
 */
function getAverageUnitPrice() {
  return parseInt(getProperty(PROPERTY_KEYS.AVERAGE_UNIT_PRICE, '6000'));
}

/**
 * Get no-show threshold
 */
function getNoShowThreshold() {
  return parseInt(getProperty(PROPERTY_KEYS.NO_SHOW_THRESHOLD, '2'));
}

/**
 * Get no-show deposit amount
 */
function getNoShowDepositAmount() {
  return parseInt(getProperty(PROPERTY_KEYS.NO_SHOW_DEPOSIT_AMOUNT, '2000'));
}

/**
 * Initialize default properties if not set
 */
function initializeDefaultProperties() {
  var defaults = {
    DEPOSIT_AMOUNT_JPY: '1000',
    CANCELLATION_DEADLINE_HOURS: '2',
    REMINDER_HOURS_BEFORE: '24',
    RESALE_NOTIFICATION_MINUTES: '10',
    AVERAGE_UNIT_PRICE: '6000',
    NO_SHOW_THRESHOLD: '2',
    NO_SHOW_DEPOSIT_AMOUNT: '2000'
  };

  var properties = PropertiesService.getScriptProperties();

  for (var key in defaults) {
    if (!properties.getProperty(key)) {
      properties.setProperty(key, defaults[key]);
      Logger.log('Initialized property: ' + key + ' = ' + defaults[key]);
    }
  }
}

/**
 * Check if all required properties are set
 */
function validateRequiredProperties() {
  var required = [
    PROPERTY_KEYS.LINE_CHANNEL_ACCESS_TOKEN,
    PROPERTY_KEYS.LINE_CHANNEL_SECRET,
    PROPERTY_KEYS.STRIPE_API_KEY,
    PROPERTY_KEYS.STRIPE_WEBHOOK_SECRET,
    PROPERTY_KEYS.SPREADSHEET_ID
  ];

  var missing = [];
  for (var i = 0; i < required.length; i++) {
    if (!getProperty(required[i])) {
      missing.push(required[i]);
    }
  }

  return {
    valid: missing.length === 0,
    missing: missing
  };
}
