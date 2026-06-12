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
  NO_SHOW_DEPOSIT_AMOUNT: 'NO_SHOW_DEPOSIT_AMOUNT',

  // Contact (for fallback "人間に問い合わせる")
  CONTACT_PHONE: 'CONTACT_PHONE',
  CONTACT_URL: 'CONTACT_URL',

  // Business info (for rich menu "営業時間・アクセス")
  BUSINESS_HOURS: 'BUSINESS_HOURS',
  BUSINESS_ADDRESS: 'BUSINESS_ADDRESS',

  // MiniMax LLM settings
  MINIMAX_API_KEY: 'MINIMAX_API_KEY',

  // GLM (ZhipuAI) LLM settings
  GLM_API_KEY: 'GLM_API_KEY',

  // Booking management settings
  BOOKING_LEAD_TIME_MINUTES: 'BOOKING_LEAD_TIME_MINUTES',   // minimum advance booking time (default: 60)
  MAX_CONCURRENT_BOOKINGS: 'MAX_CONCURRENT_BOOKINGS',       // simultaneous slots per time (default: 1)
  MAX_RESERVATIONS_PER_USER: 'MAX_RESERVATIONS_PER_USER',   // max active reservations per user (default: 3)
  BUSINESS_START_TIME: 'BUSINESS_START_TIME',               // business open time (default: 09:00)
  BUSINESS_END_TIME: 'BUSINESS_END_TIME',                    // business close time (default: 18:00)

  // Stripe redirect URLs
  STRIPE_SUCCESS_URL: 'STRIPE_SUCCESS_URL',
  STRIPE_CANCEL_URL: 'STRIPE_CANCEL_URL',

  // Firebase / Firestore
  FIREBASE_PROJECT_ID: 'FIREBASE_PROJECT_ID',
  FIREBASE_CLIENT_EMAIL: 'FIREBASE_CLIENT_EMAIL',
  FIREBASE_PRIVATE_KEY: 'FIREBASE_PRIVATE_KEY',

  // Follow-up settings
  FOLLOW_UP_HOURS_AFTER: 'FOLLOW_UP_HOURS_AFTER',

  // Ticket package settings
  TICKET_EXPIRY_DAYS: 'TICKET_EXPIRY_DAYS',
  TICKET_5_PRICE: 'TICKET_5_PRICE',
  TICKET_10_PRICE: 'TICKET_10_PRICE',

  // Feature flags (opt-in)
  FEATURE_STAFF_SELECT: 'FEATURE_STAFF_SELECT',
  FEATURE_COUPON: 'FEATURE_COUPON',
  FEATURE_REVIEW_REQUEST: 'FEATURE_REVIEW_REQUEST',
  FEATURE_INTAKE_FORM: 'FEATURE_INTAKE_FORM',
  FEATURE_KARTE: 'FEATURE_KARTE',

  // Review settings
  GOOGLE_REVIEW_URL: 'GOOGLE_REVIEW_URL',

  // Worker base URL (for intake form link generation)
  WORKER_BASE_URL: 'WORKER_BASE_URL'
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
  return parseInt(getProperty(PROPERTY_KEYS.CANCELLATION_DEADLINE_HOURS, '24'));
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
 * Get contact phone for "人間に問い合わせる" message (optional)
 */
function getContactPhone() {
  return getProperty(PROPERTY_KEYS.CONTACT_PHONE, '');
}

/**
 * Get contact URL for "人間に問い合わせる" message (optional)
 */
function getContactUrl() {
  return getProperty(PROPERTY_KEYS.CONTACT_URL, '');
}

/**
 * Get business hours for "営業時間・アクセス" message (optional)
 */
function getBusinessHours() {
  return getProperty(PROPERTY_KEYS.BUSINESS_HOURS, '');
}

/**
 * Get business address for "営業時間・アクセス" message (optional)
 */
function getBusinessAddress() {
  return getProperty(PROPERTY_KEYS.BUSINESS_ADDRESS, '');
}

/**
 * Get booking lead time in minutes (minimum advance booking time)
 */
function getBookingLeadTimeMinutes() {
  return parseInt(getProperty(PROPERTY_KEYS.BOOKING_LEAD_TIME_MINUTES, '60'));
}

/**
 * Get max concurrent bookings per time slot
 */
function getMaxConcurrentBookings() {
  return parseInt(getProperty(PROPERTY_KEYS.MAX_CONCURRENT_BOOKINGS, '2'));
}

/**
 * Get max active reservations per user
 */
function getMaxReservationsPerUser() {
  return parseInt(getProperty(PROPERTY_KEYS.MAX_RESERVATIONS_PER_USER, '3'));
}

/**
 * Get business start time (HH:MM)
 */
function getBusinessStartTime() {
  return getProperty(PROPERTY_KEYS.BUSINESS_START_TIME, '09:00');
}

/**
 * Get business end time (HH:MM)
 */
function getBusinessEndTime() {
  return getProperty(PROPERTY_KEYS.BUSINESS_END_TIME, '18:00');
}

/**
 * Get Stripe success redirect URL
 */
function getStripeSuccessUrl() {
  return getProperty(PROPERTY_KEYS.STRIPE_SUCCESS_URL, 'https://line.me/R/');
}

/**
 * Get Stripe cancel redirect URL
 */
function getStripeCancelUrl() {
  return getProperty(PROPERTY_KEYS.STRIPE_CANCEL_URL, 'https://line.me/R/');
}

/**
 * Get Firebase project ID
 */
function getFirebaseProjectId() {
  return getProperty(PROPERTY_KEYS.FIREBASE_PROJECT_ID, '');
}

/**
 * Get Firebase client email
 */
function getFirebaseClientEmail() {
  return getProperty(PROPERTY_KEYS.FIREBASE_CLIENT_EMAIL, '');
}

/**
 * Get Firebase private key
 */
function getFirebasePrivateKey() {
  return getProperty(PROPERTY_KEYS.FIREBASE_PRIVATE_KEY, '');
}

/**
 * Check if Firebase is configured
 */
function isFirebaseConfigured() {
  return !!(getFirebaseProjectId() && getFirebaseClientEmail() && getFirebasePrivateKey());
}

/**
 * Get follow-up hours after visit (default: 24)
 */
function getFollowUpHoursAfter() {
  return parseInt(getProperty(PROPERTY_KEYS.FOLLOW_UP_HOURS_AFTER, '24'));
}

/**
 * Check if staff nomination feature is enabled.
 * Set FEATURE_STAFF_SELECT=true in ScriptProperties to activate.
 */
function isFeatureStaffSelectEnabled() {
  return getProperty(PROPERTY_KEYS.FEATURE_STAFF_SELECT, 'false') === 'true';
}

/**
 * Check if coupon feature is enabled.
 * Set FEATURE_COUPON=true in ScriptProperties to activate.
 */
function isFeatureCouponEnabled() {
  return getProperty(PROPERTY_KEYS.FEATURE_COUPON, 'false') === 'true';
}

/**
 * Check if review request feature is enabled.
 * Set FEATURE_REVIEW_REQUEST=true in ScriptProperties to activate.
 */
function isFeatureReviewRequestEnabled() {
  return getProperty(PROPERTY_KEYS.FEATURE_REVIEW_REQUEST, 'false') === 'true';
}

/**
 * Get Google review URL (optional).
 */
function getGoogleReviewUrl() {
  return getProperty(PROPERTY_KEYS.GOOGLE_REVIEW_URL, '');
}

/**
 * Check if intake form feature is enabled.
 * Set FEATURE_INTAKE_FORM=true in ScriptProperties to activate.
 */
function isFeatureIntakeFormEnabled() {
  return getProperty(PROPERTY_KEYS.FEATURE_INTAKE_FORM, 'false') === 'true';
}

/**
 * Get Cloudflare Worker base URL (e.g. https://reserve-optimizer.xxx.workers.dev).
 */
/**
 * Check if karte feature is enabled.
 * Set FEATURE_KARTE=true in ScriptProperties to activate.
 */
function isFeatureKarteEnabled() {
  return getProperty(PROPERTY_KEYS.FEATURE_KARTE, 'false') === 'true';
}

function getWorkerBaseUrl() {
  return getProperty(PROPERTY_KEYS.WORKER_BASE_URL, '');
}

/**
 * Initialize default properties if not set
 */
function initializeDefaultProperties() {
  var defaults = {
    DEPOSIT_AMOUNT_JPY: '1000',
    CANCELLATION_DEADLINE_HOURS: '24',
    REMINDER_HOURS_BEFORE: '24',
    RESALE_NOTIFICATION_MINUTES: '10',
    AVERAGE_UNIT_PRICE: '6000',
    NO_SHOW_THRESHOLD: '2',
    NO_SHOW_DEPOSIT_AMOUNT: '2000',
    BOOKING_LEAD_TIME_MINUTES: '60',
    MAX_CONCURRENT_BOOKINGS: '2',
    MAX_RESERVATIONS_PER_USER: '3',
    BUSINESS_START_TIME: '09:00',
    BUSINESS_END_TIME: '18:00',
    FOLLOW_UP_HOURS_AFTER: '24',
    TICKET_EXPIRY_DAYS: '180',
    TICKET_5_PRICE: '25000',
    TICKET_10_PRICE: '45000'
  };

  var properties = PropertiesService.getScriptProperties();

  for (var key in defaults) {
    if (!properties.getProperty(key)) {
      properties.setProperty(key, defaults[key]);
      appendLogRow('INFO', 'Initialized property: ' + key + ' = ' + defaults[key]);
    }
  }

  // Generate GAS_AUTH_TOKEN if not set (used for gas-run.sh autopilot authentication)
  if (!properties.getProperty('GAS_AUTH_TOKEN')) {
    var token = Utilities.getUuid().replace(/-/g, '');
    properties.setProperty('GAS_AUTH_TOKEN', token);
    appendLogRow('INFO', 'Generated GAS_AUTH_TOKEN. Set this in gas-run.sh to authenticate autopilot calls.');
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
