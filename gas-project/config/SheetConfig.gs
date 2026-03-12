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
  NOTES: 21
};

// Reservations sheet headers
var RESERVATIONS_HEADERS = [
  'reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name',
  'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end',
  'status', 'deposit_required', 'deposit_amount', 'deposit_status',
  'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified',
  'resale_success', 'average_unit_price', 'notes'
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
