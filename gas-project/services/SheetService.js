/**
 * Sheet Service - Google Sheets Operations
 *
 * Handles all CRUD operations for reservations, waitlist, and weekly summary
 */

/**
 * Format a Date object to YYYY-MM-DD string
 */
function formatDateObj(d) {
  if (!d || !(d instanceof Date)) return d || '';
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return y + '/' + m + '/' + day;
}

/**
 * Format a Date object to HH:MM string (for time columns stored as dates)
 */
function formatTimeObj(d) {
  if (!d || !(d instanceof Date)) return d || '';
  var h = ('0' + d.getHours()).slice(-2);
  var min = ('0' + d.getMinutes()).slice(-2);
  return h + ':' + min;
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
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === reservationId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error('Reservation not found: ' + reservationId);
  }

  // Update only provided fields
  for (var key in updates) {
    var columnIndex = RESERVATIONS_COLUMNS[key.toUpperCase()];
    if (columnIndex) {
      sheet.getRange(rowIndex, columnIndex).setValue(updates[key]);
    }
  }

  Logger.log('Updated reservation: ' + reservationId);
}

/**
 * Get reservation by ID
 */
function getReservationById(reservationId) {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === reservationId) {
      return {
        id: data[i][0],
        created_at: data[i][1],
        patient_name: data[i][2],
        phone: data[i][3],
        line_display_name: data[i][4],
        visit_type: data[i][5],
        menu_type: data[i][6],
        reserved_date: formatDateObj(data[i][7]),
        reserved_start: formatTimeObj(data[i][8]),
        reserved_end: formatTimeObj(data[i][9]),
        status: data[i][10],
        deposit_required: data[i][11],
        deposit_amount: data[i][12],
        deposit_status: data[i][13],
        reminder_sent: data[i][14],
        reminder_response: data[i][15],
        cancel_time: data[i][16],
        resale_notified: data[i][17],
        resale_success: data[i][18],
        average_unit_price: data[i][19],
        notes: data[i][20],
        row_number: i + 1
      };
    }
  }

  return null;
}

/**
 * Get reservations by date
 */
function getReservationsByDate(date) {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][7] === date) {
      results.push({
        id: data[i][0],
        patient_name: data[i][2],
        phone: data[i][3],
        line_display_name: data[i][4],
        visit_type: data[i][5],
        menu_type: data[i][6],
        reserved_date: data[i][7],
        reserved_start: data[i][8],
        reserved_end: data[i][9],
        status: data[i][10]
      });
    }
  }

  return results;
}

/**
 * Get active reservations by LINE User ID (Pending or Confirmed only)
 */
function getReservationsByLineUserId(lineUserId) {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === lineUserId) {  // line_display_name column (col 5, 0-based index 4)
      var status = data[i][10];
      if (status === RESERVATION_STATUS.PENDING || status === RESERVATION_STATUS.CONFIRMED) {
        results.push({
          id: data[i][0],
          patient_name: data[i][2],
          phone: data[i][3],
          line_display_name: data[i][4],
          visit_type: data[i][5],
          menu_type: data[i][6],
          reserved_date: data[i][7],
          reserved_start: data[i][8],
          reserved_end: data[i][9],
          status: status,
          deposit_required: data[i][11],
          deposit_amount: data[i][12],
          deposit_status: data[i][13],
          row_number: i + 1
        });
      }
    }
  }

  return results;
}

/**
 * Get reservations by phone number
 */
function getReservationsByPatient(phoneNumber) {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][3] === phoneNumber) {
      results.push({
        id: data[i][0],
        reserved_date: data[i][7],
        reserved_start: data[i][8],
        status: data[i][10]
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
