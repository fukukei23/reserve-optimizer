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
    row_number: i + 1
  };
}

/**
 * Load all reservations into cache with indexed Maps
 * Called lazily on first search access; stays valid for the GAS execution lifetime
 */
function _ensureReservationCache() {
  if (_reservationCache !== null) return;

  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();

  _reservationCache = [];
  _reservationByIdMap = {};
  _reservationsByLineUserIdMap = {};
  _reservationsByDateMap = {};

  for (var i = 1; i < data.length; i++) {
    var obj = _buildReservationObj(data[i], i);
    _reservationCache.push(obj);

    // Index by ID
    _reservationByIdMap[obj.id] = obj;

    // Index by LINE user ID (array per user)
    var lineKey = String(data[i][4]);
    if (!_reservationsByLineUserIdMap[lineKey]) {
      _reservationsByLineUserIdMap[lineKey] = [];
    }
    _reservationsByLineUserIdMap[lineKey].push(obj);

    // Index by date (array per date)
    var dateKey = obj.reserved_date;
    if (!_reservationsByDateMap[dateKey]) {
      _reservationsByDateMap[dateKey] = [];
    }
    _reservationsByDateMap[dateKey].push(obj);
  }
}

/**
 * Invalidate cache (call after create/update/delete)
 */
function _invalidateReservationCache() {
  _reservationCache = null;
  _reservationByIdMap = null;
  _reservationsByLineUserIdMap = null;
  _reservationsByDateMap = null;
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
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
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
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
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
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName(SHEET_NAMES.WEEKLY_SUMMARY);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, SHEET_NAMES.WEEKLY_SUMMARY, WEEKLY_SUMMARY_HEADERS);
  }
  return sheet;
}

/**
 * Get log sheet (creates with headers if missing)
 */
function getLogSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
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
  var sheet = getLogSheet();
  sheet.appendRow([new Date(), level || 'INFO', safeMsg]);
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
  var sheet = getReservationsSheet();
  var reservationId = generateReservationId();
  var now = new Date();

  var row = [
    reservationId,
    now,
    reservationData.patient_name || '',
    reservationData.phone || '',
    reservationData.line_display_name || '',
    reservationData.visit_type || 'First',
    reservationData.menu_type || '',
    reservationData.reserved_date || '',
    reservationData.reserved_start || '',
    reservationData.reserved_end || '',
    reservationData.status || RESERVATION_STATUS.PENDING,
    reservationData.deposit_required || 'N',
    getDepositAmount(),
    reservationData.deposit_status || DEPOSIT_STATUS.UNPAID,
    'N',
    '',
    '',
    'N',
    'N',
    getAverageUnitPrice(),
    reservationData.notes || ''
  ];

  sheet.appendRow(row);
  _invalidateReservationCache();
  Logger.log('Created reservation: ' + reservationId);

  return {
    id: reservationId,
    row_number: sheet.getLastRow()
  };
}

/**
 * Update reservation by ID
 */
function updateReservation(reservationId, updates) {
  _ensureReservationCache();
  var cached = _reservationByIdMap[reservationId];
  if (!cached) {
    throw new Error('Reservation not found: ' + reservationId);
  }

  var rowIndex = cached.row_number;
  var sheet = getReservationsSheet();

  // Update only provided fields
  for (var key in updates) {
    var columnIndex = RESERVATIONS_COLUMNS[key.toUpperCase()];
    if (columnIndex) {
      sheet.getRange(rowIndex, columnIndex).setValue(updates[key]);
    }
  }

  Logger.log('Updated reservation: ' + reservationId);
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
 * Get all waitlist entries
 */
function getWaitlistReservations() {
  var sheet = getWaitlistSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    results.push({
      id: data[i][0],
      line_display_name: data[i][1],
      phone: data[i][2],
      preferred_time: data[i][3],
      same_day_ok: data[i][4],
      last_notified_at: data[i][5]
    });
  }

  return results;
}

/**
 * Add waitlist entry
 */
function addToWaitlist(waitlistData) {
  var sheet = getWaitlistSheet();
  var now = new Date();

  var row = [
    sheet.getLastRow(),
    waitlistData.line_display_name || '',
    waitlistData.phone || '',
    waitlistData.preferred_time || 'Any',
    waitlistData.same_day_ok || 'N',
    '',
    waitlistData.notes || ''
  ];

  sheet.appendRow(row);
  return sheet.getLastRow();
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
  Logger.log('Cancelled reservation: ' + reservationId + ' Reason: ' + reason);
}

/**
 * Get booked slot counts for a specific date
 * Returns {timeString: count} for active reservations (Pending/Confirmed)
 * Used for concurrent booking conflict detection
 */
function getBookedSlotsForDate(date) {
  _ensureReservationCache();
  var slots = {};
  var dateReservations = _reservationsByDateMap[date] || [];
  for (var i = 0; i < dateReservations.length; i++) {
    var r = dateReservations[i];
    if (r.status === RESERVATION_STATUS.PENDING || r.status === RESERVATION_STATUS.CONFIRMED) {
      if (r.reserved_start) {
        slots[r.reserved_start] = (slots[r.reserved_start] || 0) + 1;
      }
    }
  }
  return slots;
}

/**
 * Find waitlist candidate for vacancy
 */
function findWaitlistCandidate(appointmentDateTime) {
  var waitlist = getWaitlistReservations();
  var appointmentDate = new Date(appointmentDateTime);
  var hours = appointmentDate.getHours();

  var candidates = [];

  for (var i = 0; i < waitlist.length; i++) {
    var entry = waitlist[i];

    // Check if already notified recently (within 24 hours)
    if (entry.last_notified_at) {
      var lastNotified = new Date(entry.last_notified_at);
      var hoursSinceNotification = (Date.now() - lastNotified.getTime()) / (1000 * 60 * 60);
      if (hoursSinceNotification < 24) {
        continue;
      }
    }

    // Check preferred time match
    var timeMatch = false;
    if (entry.preferred_time === 'Any') {
      timeMatch = true;
    } else if (entry.preferred_time === 'Morning' && hours < 12) {
      timeMatch = true;
    } else if (entry.preferred_time === 'Afternoon' && hours >= 12 && hours < 17) {
      timeMatch = true;
    } else if (entry.preferred_time === 'Evening' && hours >= 17) {
      timeMatch = true;
    }

    // Prioritize same_day_ok=Y
    candidates.push({
      entry: entry,
      timeMatch: timeMatch,
      priority: entry.same_day_ok === 'Y' ? 1 : 0
    });
  }

  // Sort by priority and time match
  candidates.sort(function(a, b) {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.timeMatch - a.timeMatch;
  });

  return candidates.slice(0, 3).map(function(c) { return c.entry; });
}

/**
 * Resell vacancy to waitlist candidate
 */
function resellVacancy(reservationId, waitlistPatientId) {
  updateReservation(reservationId, {
    resale_notified: 'Y'
  });

  // TODO: Send notification to waitlist patient
  Logger.log('Reselling vacancy: ' + reservationId + ' to waitlist ID: ' + waitlistPatientId);
}

/**
 * Mark resale successful
 */
function markResaleSuccessful(reservationId) {
  updateReservation(reservationId, {
    resale_success: 'Y'
  });
}
