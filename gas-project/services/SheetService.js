/**
 * Sheet Service - Google Sheets Operations
 *
 * Handles all CRUD operations for reservations, waitlist, and weekly summary
 * Uses per-execution cache with Map indexes for O(1) lookups
 */

// Per-execution cache (GAS reinitializes globals each execution)
var _reservationCache = null;
var _reservationByIdMap = null;
var _reservationsByLineUserIdMap = null;
var _reservationsByDateMap = null;
var _spreadsheetCache = null;

// CacheService key and TTL for cross-execution caching
var _CACHE_KEY = 'reservation_cache_v2';
var _CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Get cached Spreadsheet instance
 */
function _getCachedSpreadsheet() {
  if (!_spreadsheetCache) {
    _spreadsheetCache = SpreadsheetApp.openById(getSpreadsheetId());
  }
  return _spreadsheetCache;
}

/**
 * Build reservation object from raw sheet row data
 */
function _buildReservationObj(row, i) {
  return {
    id: row[0],
    created_at: row[1],
    patient_name: row[2],
    phone: row[3],
    line_display_name: row[4],
    visit_type: row[5],
    menu_type: row[6],
    reserved_date: formatDateObj(row[7]),
    reserved_start: formatTimeObj(row[8]),
    reserved_end: formatTimeObj(row[9]),
    status: row[10],
    deposit_required: row[11],
    deposit_amount: row[12],
    deposit_status: row[13],
    reminder_sent: row[14],
    reminder_response: row[15],
    cancel_time: row[16],
    resale_notified: row[17],
    resale_success: row[18],
    average_unit_price: row[19],
    notes: row[20],
    payment_intent_id: row[21] || '',
    follow_up_sent: row[22] || 'N',
    used_ticket: row[23] || '',
    row_number: i + 1
  };
}

/**
 * Load all reservations into cache with indexed Maps.
 * Firestore-first: uses Firestore when configured, falls back to Sheets.
 */
function _ensureReservationCache() {
  if (_reservationCache !== null) return;

  // Try CacheService first (shared across executions for 5 min)
  try {
    var scriptCache = CacheService.getScriptCache();
    var cached = scriptCache.get(_CACHE_KEY);
    if (cached) {
      var parsed = JSON.parse(cached);
      _reservationCache = parsed.cache;
      _reservationByIdMap = parsed.byId;
      _reservationsByLineUserIdMap = parsed.byLineId;
      _reservationsByDateMap = parsed.byDate;
      return;
    }
  } catch (e) {
    appendLogRow('WARN', 'CacheService read skipped: ' + e.message);
  }

  // Firestore path
  if (isFirebaseConfigured()) {
    try {
      _ensureReservationCacheFromFirestore();
      return;
    } catch (e) {
      appendLogRow('WARN', 'Firestore cache load failed, falling back to Sheets: ' + e.message);
    }
  }

  // Sheet fallback
  _ensureReservationCacheFromSheet();
}

function _ensureReservationCacheFromFirestore() {
  var docs = fsGetCollection('reservations');

  _reservationCache = [];
  _reservationByIdMap = {};
  _reservationsByLineUserIdMap = {};
  _reservationsByDateMap = {};

  for (var i = 0; i < docs.length; i++) {
    var obj = docs[i];
    if (!obj.id) continue;

    _reservationCache.push(obj);
    _reservationByIdMap[obj.id] = obj;

    var lineKey = String(obj.line_display_name || '');
    if (!_reservationsByLineUserIdMap[lineKey]) {
      _reservationsByLineUserIdMap[lineKey] = [];
    }
    _reservationsByLineUserIdMap[lineKey].push(obj);

    var dateKey = obj.reserved_date || '';
    if (!_reservationsByDateMap[dateKey]) {
      _reservationsByDateMap[dateKey] = [];
    }
    _reservationsByDateMap[dateKey].push(obj);
  }

  // Save to CacheService
  try {
    var toCache = JSON.stringify({
      cache: _reservationCache,
      byId: _reservationByIdMap,
      byLineId: _reservationsByLineUserIdMap,
      byDate: _reservationsByDateMap
    });
    if (toCache.length < 90000) {
      CacheService.getScriptCache().put(_CACHE_KEY, toCache, _CACHE_TTL_SECONDS);
    }
  } catch (e) { /* noop */ }
}

function _ensureReservationCacheFromSheet() {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();

  _reservationCache = [];
  _reservationByIdMap = {};
  _reservationsByLineUserIdMap = {};
  _reservationsByDateMap = {};

  for (var i = 1; i < data.length; i++) {
    var obj = _buildReservationObj(data[i], i);
    _reservationCache.push(obj);

    _reservationByIdMap[obj.id] = obj;

    var lineKey = String(data[i][4]);
    if (!_reservationsByLineUserIdMap[lineKey]) {
      _reservationsByLineUserIdMap[lineKey] = [];
    }
    _reservationsByLineUserIdMap[lineKey].push(obj);

    var dateKey = obj.reserved_date;
    if (!_reservationsByDateMap[dateKey]) {
      _reservationsByDateMap[dateKey] = [];
    }
    _reservationsByDateMap[dateKey].push(obj);
  }

  // Save to CacheService (respect 100KB limit)
  try {
    var toCache = JSON.stringify({
      cache: _reservationCache,
      byId: _reservationByIdMap,
      byLineId: _reservationsByLineUserIdMap,
      byDate: _reservationsByDateMap
    });
    if (toCache.length < 90000) {
      var scriptCache2 = CacheService.getScriptCache();
      scriptCache2.put(_CACHE_KEY, toCache, _CACHE_TTL_SECONDS);
    }
  } catch (e) {
    appendLogRow('WARN', 'CacheService write skipped: ' + e.message);
  }
}

/**
 * Invalidate cache (call after create/update/delete).
 * Clears both per-execution and CacheService caches.
 */
function _invalidateReservationCache() {
  _reservationCache = null;
  _reservationByIdMap = null;
  _reservationsByLineUserIdMap = null;
  _reservationsByDateMap = null;

  try {
    CacheService.getScriptCache().remove(_CACHE_KEY);
  } catch (e) { /* noop */ }
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
function formatDateObj(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.indexOf('NaN') === -1 ? d : '';
  if (!(d instanceof Date)) return '';
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  if (isNaN(y) || isNaN(m) || isNaN(day)) return '';
  return y + '/' + ('0' + m).slice(-2) + '/' + ('0' + day).slice(-2);
}

/**
 * Format a Date object to HH:MM string (for time columns stored as dates)
 */
function formatTimeObj(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.indexOf('NaN') === -1 ? d : '';
  if (!(d instanceof Date)) return '';
  var h = d.getHours();
  var min = d.getMinutes();
  if (isNaN(h) || isNaN(min)) return '';
  return ('0' + h).slice(-2) + ':' + ('0' + min).slice(-2);
}

/**
 * Get reservations sheet
 */
function getReservationsSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.RESERVATIONS);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, SHEET_NAMES.RESERVATIONS, RESERVATIONS_HEADERS);
  }
  return sheet;
}

/**
 * Get waitlist sheet
 */
function getWaitlistSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.WAITLIST);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, SHEET_NAMES.WAITLIST, WAITLIST_HEADERS);
  }
  return sheet;
}

/**
 * Get weekly summary sheet
 */
function getWeeklySummarySheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.WEEKLY_SUMMARY);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, SHEET_NAMES.WEEKLY_SUMMARY, WEEKLY_SUMMARY_HEADERS);
  }
  return sheet;
}

/**
 * Get tickets sheet
 */
function getTicketsSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.TICKETS);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, SHEET_NAMES.TICKETS, TICKETS_HEADERS);
  }
  return sheet;
}

/**
 * Get log sheet (creates with headers if missing)
 */
function getLogSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.LOG);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, SHEET_NAMES.LOG, LOG_HEADERS);
  }
  return sheet;
}

/**
 * Append a row to the log sheet. Message is truncated and newlines replaced to avoid cell issues.
 */
function appendLogRow(level, message) {
  var safeMsg = (message || '').toString().replace(/\r?\n/g, ' ').substring(0, 500);
  try {
    var sheet = getLogSheet();
    sheet.appendRow([new Date(), level || 'INFO', safeMsg]);
  } catch (e) {
    Logger.log('[' + (level || 'INFO') + '] ' + safeMsg + ' (log write failed: ' + e.message + ')');
  }
}

/**
 * Create sheet with headers
 */
function createSheetWithHeaders(ss, sheetName, headers) {
  var sheet = ss.insertSheet(sheetName);
  sheet.appendRow(headers);
  return sheet;
}

/**
 * Generate unique reservation ID
 */
function generateReservationId() {
  if (isFirebaseConfigured()) {
    return 'R' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();
  }
  var sheet = getReservationsSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow === 1) {
    return 'R0001';
  }

  var lastId = sheet.getRange(lastRow, 1).getValue();
  var lastNumber = parseInt(lastId.substring(1));
  var newNumber = lastNumber + 1;

  return 'R' + String(newNumber).padStart(4, '0');
}

/**
 * Create new reservation
 */
function createReservation(reservationData) {
  var reservationId = generateReservationId();
  var now = new Date();

  var reservation = {
    id: reservationId,
    created_at: now.toISOString(),
    patient_name: reservationData.patient_name || '',
    phone: reservationData.phone || '',
    line_display_name: reservationData.line_display_name || '',
    visit_type: reservationData.visit_type || 'First',
    menu_type: reservationData.menu_type || '',
    reserved_date: reservationData.reserved_date || '',
    reserved_start: reservationData.reserved_start || '',
    reserved_end: reservationData.reserved_end || '',
    status: reservationData.status || RESERVATION_STATUS.PENDING,
    deposit_required: reservationData.deposit_required || 'N',
    deposit_amount: getDepositAmount(),
    deposit_status: reservationData.deposit_status || DEPOSIT_STATUS.UNPAID,
    reminder_sent: 'N',
    reminder_response: '',
    cancel_time: '',
    resale_notified: 'N',
    resale_success: 'N',
    average_unit_price: getAverageUnitPrice(),
    notes: reservationData.notes || '',
    payment_intent_id: '',
    follow_up_sent: 'N',
    used_ticket: ''
  };

  if (isFirebaseConfigured()) {
    fsSet('reservations', reservationId, reservation);
  } else {
    var row = [
      reservationId, now,
      reservation.patient_name, reservation.phone, reservation.line_display_name,
      reservation.visit_type, reservation.menu_type,
      reservation.reserved_date, reservation.reserved_start, reservation.reserved_end,
      reservation.status, reservation.deposit_required, reservation.deposit_amount,
      reservation.deposit_status, reservation.reminder_sent, reservation.reminder_response,
      reservation.cancel_time, reservation.resale_notified, reservation.resale_success,
      reservation.average_unit_price, reservation.notes, '', 'N', ''
    ];
    var sheet = getReservationsSheet();
    sheet.appendRow(row);
  }

  _invalidateReservationCache();
  appendLogRow('INFO', 'Created reservation: ' + reservationId);

  return { id: reservationId, row_number: 0 };
}

/**
 * Update reservation by ID — batch writes all fields
 */
function updateReservation(reservationId, updates) {
  if (isFirebaseConfigured()) {
    var doc = fsGet('reservations', reservationId);
    if (!doc || !doc.id) {
      throw new Error('Reservation not found: ' + reservationId);
    }
    // Convert Date objects to ISO strings for Firestore
    var cleaned = {};
    for (var key in updates) {
      cleaned[key] = updates[key] instanceof Date ? updates[key].toISOString() : updates[key];
    }
    fsUpdate('reservations', reservationId, cleaned);
    appendLogRow('INFO', 'Updated reservation (FS): ' + reservationId);
    _invalidateReservationCache();
    return;
  }

  // Sheet fallback
  _ensureReservationCache();
  var cached = _reservationByIdMap[reservationId];
  if (!cached) {
    throw new Error('Reservation not found: ' + reservationId);
  }

  var rowIndex = cached.row_number;
  var sheet = getReservationsSheet();

  var minCol = Infinity;
  var maxCol = 0;
  var colValues = {};

  for (var key in updates) {
    var columnIndex = RESERVATIONS_COLUMNS[key.toUpperCase()];
    if (columnIndex) {
      if (columnIndex < minCol) minCol = columnIndex;
      if (columnIndex > maxCol) maxCol = columnIndex;
      colValues[columnIndex] = updates[key];
    }
  }

  if (minCol <= maxCol) {
    var width = maxCol - minCol + 1;
    var row = [];
    for (var c = 0; c < width; c++) {
      var colIdx = minCol + c;
      row.push(colValues[colIdx] !== undefined ? colValues[colIdx] : sheet.getRange(rowIndex, colIdx).getValue());
    }
    sheet.getRange(rowIndex, minCol, 1, width).setValues([row]);
  }

  appendLogRow('INFO', 'Updated reservation (Sheet): ' + reservationId);
  _invalidateReservationCache();
}

/**
 * Get reservation by ID
 */
function getReservationById(reservationId) {
  _ensureReservationCache();
  return _reservationByIdMap[reservationId] || null;
}

/**
 * Get reservations by date
 */
function getReservationsByDate(date) {
  _ensureReservationCache();
  return _reservationsByDateMap[date] || [];
}

/**
 * Get active reservations by LINE User ID (Pending or Confirmed only)
 */
function getReservationsByLineUserId(lineUserId) {
  _ensureReservationCache();
  var all = _reservationsByLineUserIdMap[lineUserId] || [];
  var results = [];
  for (var i = 0; i < all.length; i++) {
    var s = all[i].status;
    if (s === RESERVATION_STATUS.PENDING || s === RESERVATION_STATUS.CONFIRMED) {
      results.push(all[i]);
    }
  }
  return results;
}

/**
 * Get last reservation by LINE User ID (any status except Cancelled/NoShow)
 * Used for returning user detection to skip name/phone input
 */
function getLastReservationByLineUserId(lineUserId) {
  _ensureReservationCache();
  var all = _reservationsByLineUserIdMap[lineUserId] || [];
  for (var i = all.length - 1; i >= 0; i--) {
    if (all[i].status === RESERVATION_STATUS.CONFIRMED) {
      var name = all[i].patient_name;
      if (name) {
        return {
          patient_name: String(name),
          phone: all[i].phone ? String(all[i].phone) : ''
        };
      }
    }
  }
  return null;
}

/**
 * Get reservations by phone number
 */
function getReservationsByPatient(phoneNumber) {
  _ensureReservationCache();
  var results = [];
  for (var i = 0; i < _reservationCache.length; i++) {
    if (_reservationCache[i].phone === phoneNumber) {
      results.push({
        id: _reservationCache[i].id,
        reserved_date: _reservationCache[i].reserved_date,
        reserved_start: _reservationCache[i].reserved_start,
        status: _reservationCache[i].status
      });
    }
  }
  return results;
}

/**
 * Mark reminder sent
 */
function markReminderSent(reservationId) {
  updateReservation(reservationId, {
    reminder_sent: 'Y'
  });
}

/**
 * Mark no-show
 */
function markNoShow(reservationId) {
  updateReservation(reservationId, {
    status: RESERVATION_STATUS.NO_SHOW,
    deposit_status: DEPOSIT_STATUS.FORFEITED
  });
}

/**
 * Handle cancellation
 */
function handleCancellation(reservationId, reason) {
  updateReservation(reservationId, {
    status: RESERVATION_STATUS.CANCELLED,
    cancel_time: new Date()
  });
  appendLogRow('INFO', 'Cancelled reservation: ' + reservationId + ' Reason: ' + reason);
}

