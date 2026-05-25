/**
 * Sheet Configuration - Google Sheets Structure Definitions
 *
 * Defines sheet names and column mappings for the reservation system
 */

// Sheet names
var SHEET_NAMES = {
  RESERVATIONS: 'reservations',
  WAITLIST: 'waitlist',
  WEEKLY_SUMMARY: 'weekly_summary',
  CUSTOMERS: 'customers',
  LOG: 'ログ'
};

// Reservations sheet column indices (1-based)
var RESERVATIONS_COLUMNS = {
  RESERVATION_ID: 1,
  CREATED_AT: 2,
  PATIENT_NAME: 3,
  PHONE: 4,
  LINE_DISPLAY_NAME: 5,
  VISIT_TYPE: 6,
  MENU_TYPE: 7,
  RESERVED_DATE: 8,
  RESERVED_START: 9,
  RESERVED_END: 10,
  STATUS: 11,
  DEPOSIT_REQUIRED: 12,
  DEPOSIT_AMOUNT: 13,
  DEPOSIT_STATUS: 14,
  REMINDER_SENT: 15,
  REMINDER_RESPONSE: 16,
  CANCEL_TIME: 17,
  RESALE_NOTIFIED: 18,
  RESALE_SUCCESS: 19,
  AVERAGE_UNIT_PRICE: 20,
  NOTES: 21,
  PAYMENT_INTENT_ID: 22
};

// Reservations sheet headers
var RESERVATIONS_HEADERS = [
  'reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name',
  'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end',
  'status', 'deposit_required', 'deposit_amount', 'deposit_status',
  'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified',
  'resale_success', 'average_unit_price', 'notes', 'payment_intent_id'
];

// Waitlist sheet column indices (1-based)
var WAITLIST_COLUMNS = {
  WAITLIST_ID: 1,
  LINE_DISPLAY_NAME: 2,
  PHONE: 3,
  PREFERRED_TIME: 4,
  SAME_DAY_OK: 5,
  LAST_NOTIFIED_AT: 6,
  NOTES: 7
};

// Timezone constant (used across the application)
var TIMEZONE = 'Asia/Tokyo';

// QuickReply button label conventions
var QR_LABELS = {
  CANCEL: 'やめる',
  BACK: '戻る',
  CONFIRM_YES: 'はい',
  CONFIRM_NO: 'いいえ',
  RETRY: '再試行',
  CONTACT: 'お問い合わせ',
  NEXT_PAGE: '次の5件 ▶',
  PREV_PAGE: '◀ 前の5件'
};

// Waitlist sheet headers
var WAITLIST_HEADERS = [
  'waitlist_id', 'line_display_name', 'phone', 'preferred_time',
  'same_day_ok', 'last_notified_at', 'notes'
];

// Weekly Summary sheet column indices (1-based)
var WEEKLY_SUMMARY_COLUMNS = {
  WEEK_START: 1,
  TOTAL_RESERVATIONS: 2,
  TOTAL_NO_SHOWS: 3,
  NO_SHOW_RATE: 4,
  SAME_DAY_CANCELLATIONS: 5,
  RESALE_NOTIFICATIONS: 6,
  RESALE_SUCCESS_COUNT: 7,
  ESTIMATED_RECOVERED_REVENUE: 8
};

// Weekly Summary sheet headers
var WEEKLY_SUMMARY_HEADERS = [
  'week_start', 'total_reservations', 'total_no_shows', 'no_show_rate',
  'same_day_cancellations', 'resale_notifications', 'resale_success_count',
  'estimated_recovered_revenue'
];

// Log sheet headers (timestamp, level, message)
var LOG_HEADERS = ['timestamp', 'level', 'message'];

// Reservation status values
var RESERVATION_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  VISITED: 'Visited',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'NoShow'
};

// Deposit status values
var DEPOSIT_STATUS = {
  UNPAID: 'Unpaid',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  APPLIED: 'Applied',
  FORFEITED: 'Forfeited'
};

// Visit type values
var VISIT_TYPE = {
  FIRST: 'First',
  REPEAT: 'Repeat'
};

// Time slot definitions by day type
var TIME_SLOTS = {
  WEEKDAY: ['9:00', '9:30', '10:00', '10:30', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
  SATURDAY: ['9:00', '9:30', '10:00', '10:30', '11:00', '12:00']
};

// Closed days (day-of-week, 0=Sunday)
var CLOSED_DAYS = [0]; // Sunday

// Pagination
var PAGE_SIZE = 5;

// Booking limits
var MAX_BOOKING_DAYS_AHEAD = 90;

// Treatment duration (minutes) — menu_type → duration
var TREATMENT_DURATIONS = {
  '初診（30分）': 30,
  '再診（30分）': 30,
  '再診（60分）': 60
};

// Default treatment duration fallback
var DEFAULT_TREATMENT_DURATION = 30;

// User state TTL (milliseconds)
var USER_STATE_TTL_MS = 24 * 60 * 60 * 1000;

// Max payment retry attempts
var MAX_PAYMENT_RETRIES = 5;

/**
 * Get treatment duration by menu_type
 */
function getTreatmentDuration(menuType) {
  return TREATMENT_DURATIONS[menuType] || DEFAULT_TREATMENT_DURATION;
}

// Get column index by name
function getReservationColumn(columnName) {
  return RESERVATIONS_COLUMNS[columnName];
}

function getWaitlistColumn(columnName) {
  return WAITLIST_COLUMNS[columnName];
}

function getWeeklySummaryColumn(columnName) {
  return WEEKLY_SUMMARY_COLUMNS[columnName];
}

// Dashboard layout constants (row/column positions)
var DASHBOARD_LAYOUT = {
  HEADER_ROW: 1,
  SUMMARY_TITLE_ROW: 3,
  SUMMARY_DATA_START_ROW: 4,
  SUMMARY_DATA_ROWS: 8,
  SUMMARY_COLS: 4,
  TARGET_TITLE_ROW: 13,
  TARGET_DATA_START_ROW: 14,
  TARGET_DATA_ROWS: 3,
  UPDATED_ROW: 20,
  COL_WIDTHS: [250, 150, 150, 100]
};

var WAITLIST_DASHBOARD_LAYOUT = {
  HEADER_ROW: 1,
  SUMMARY_TITLE_ROW: 3,
  SUMMARY_DATA_START_ROW: 4,
  SUMMARY_COLS: 2,
  ENTRIES_TITLE_ROW: 7,
  ENTRIES_DATA_START_ROW: 8,
  MAX_ENTRIES: 20,
  COL_WIDTHS: [150, 150, 150, 100, 150]
};

// Customers sheet column indices (1-based)
var CUSTOMERS_COLUMNS = {
  CUSTOMER_ID: 1,    // phone-based
  PHONE: 2,
  LINE_USER_ID: 3,
  NAME: 4,
  VISIT_COUNT: 5,
  NO_SHOW_COUNT: 6,
  LAST_VISIT: 7,
  TAGS: 8,           // comma-separated
  NOTES: 9
};

var CUSTOMERS_HEADERS = [
  'customer_id', 'phone', 'line_user_id', 'name',
  'visit_count', 'no_show_count', 'last_visit', 'tags', 'notes'
];

// CRM auto-tag thresholds
var CRM_TAG_THRESHOLDS = {
  REGULAR: 3,    // 3+ visits
  VIP: 10,       // 10+ visits
  NO_SHOW_WARN: 2  // 2+ no-shows
};
