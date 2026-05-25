/**
 * Staff Service - Staff member and shift management
 *
 * Manages staff master data and shift schedules stored in Google Sheets.
 * Integrates with the reservation flow to support staff-specific booking.
 */

// Sheet names for staff data
var STAFF_SHEET_NAME = 'staff';
var STAFF_SHIFTS_SHEET_NAME = 'staff_shifts';

// Staff sheet headers
var STAFF_HEADERS = ['staff_id', 'name', 'role', 'active', 'specialties'];
var STAFF_SHIFTS_HEADERS = ['staff_id', 'date', 'start_time', 'end_time', 'break_start', 'break_end'];

// Staff column indices (1-based)
var STAFF_COLUMNS = {
  STAFF_ID: 1,
  NAME: 2,
  ROLE: 3,
  ACTIVE: 4,
  SPECIALTIES: 5
};

var STAFF_SHIFTS_COLUMNS = {
  STAFF_ID: 1,
  DATE: 2,
  START_TIME: 3,
  END_TIME: 4,
  BREAK_START: 5,
  BREAK_END: 6
};

// Per-execution cache
var _staffCache = null;
var _shiftCache = null;

/**
 * Get or create the staff sheet.
 */
function getStaffSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(STAFF_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(STAFF_SHEET_NAME);
    sheet.appendRow(STAFF_HEADERS);
  }
  return sheet;
}

/**
 * Get or create the staff shifts sheet.
 */
function getStaffShiftsSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(STAFF_SHIFTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(STAFF_SHIFTS_SHEET_NAME);
    sheet.appendRow(STAFF_SHIFTS_HEADERS);
  }
  return sheet;
}

// --- Staff CRUD ---

/**
 * Get all active staff members.
 * @returns {Array<{staff_id: string, name: string, role: string, specialties: string[]}>}
 */
function getActiveStaff() {
  _ensureStaffCache();
  var results = [];
  for (var i = 0; i < _staffCache.length; i++) {
    if (_staffCache[i].active) {
      results.push(_staffCache[i]);
    }
  }
  return results;
}

/**
 * Get staff members who can handle a given treatment type.
 * @param {string} treatmentPrefix - '初診' or '再診'
 * @returns {Array<object>}
 */
function getStaffForTreatment(treatmentPrefix) {
  var active = getActiveStaff();
  var results = [];
  for (var i = 0; i < active.length; i++) {
    var specs = active[i].specialties;
    for (var j = 0; j < specs.length; j++) {
      if (treatmentPrefix === '初診' && specs[j] === '初診') {
        results.push(active[i]);
        break;
      }
      if (treatmentPrefix === '再診' && (specs[j] === '再診' || specs[j] === '初診')) {
        results.push(active[i]);
        break;
      }
    }
  }
  return results;
}

/**
 * Get staff by name.
 * @param {string} name
 * @returns {object|null}
 */
function getStaffByName(name) {
  _ensureStaffCache();
  for (var i = 0; i < _staffCache.length; i++) {
    if (_staffCache[i].name === name && _staffCache[i].active) {
      return _staffCache[i];
    }
  }
  return null;
}

/**
 * Get staff by ID.
 * @param {string} staffId
 * @returns {object|null}
 */
function getStaffById(staffId) {
  _ensureStaffCache();
  for (var i = 0; i < _staffCache.length; i++) {
    if (_staffCache[i].staff_id === staffId) return _staffCache[i];
  }
  return null;
}

// --- Shift Management ---

/**
 * Get a staff member's shift for a specific date.
 * @param {string} staffId
 * @param {string} date - YYYY/MM/DD format
 * @returns {object|null} {start_time, end_time, break_start, break_end} or null if off-duty
 */
function getStaffShift(staffId, date) {
  _ensureShiftCache();
  var key = staffId + '_' + date;
  return _shiftCache[key] || null;
}

/**
 * Get all staff working on a specific date.
 * @param {string} date - YYYY/MM/DD format
 * @returns {Array<{staff_id, name, start_time, end_time}>}
 */
function getStaffWorkingOnDate(date) {
  _ensureShiftCache();
  var results = [];
  var activeStaff = getActiveStaff();

  for (var i = 0; i < activeStaff.length; i++) {
    var shift = _shiftCache[activeStaff[i].staff_id + '_' + date];
    if (shift) {
      results.push({
        staff_id: activeStaff[i].staff_id,
        name: activeStaff[i].name,
        start_time: shift.start_time,
        end_time: shift.end_time
      });
    }
  }
  return results;
}

/**
 * Get booked slot counts for a specific staff member on a date.
 * @param {string} staffId
 * @param {string} date
 * @returns {{timeString: count}}
 */
function getBookedSlotsForStaff(staffId, date) {
  _ensureReservationCache();
  var slots = {};
  var dateReservations = _reservationsByDateMap[date] || [];
  for (var i = 0; i < dateReservations.length; i++) {
    var r = dateReservations[i];
    if (r.status !== RESERVATION_STATUS.PENDING && r.status !== RESERVATION_STATUS.CONFIRMED) continue;

    // Check if reservation has staff_id in notes
    if (r.notes && r.notes.indexOf('staff:' + staffId) >= 0) {
      if (r.reserved_start) {
        slots[r.reserved_start] = (slots[r.reserved_start] || 0) + 1;
      }
    }
  }
  return slots;
}

// --- QuickReply Builders ---

/**
 * Build staff selection QuickReply items for a given treatment.
 * @param {string} treatmentPrefix - '初診' or '再診'
 * @returns {Array<{label, text}>}
 */
function buildStaffSelectionOptions(treatmentPrefix) {
  var staff = getStaffForTreatment(treatmentPrefix);
  var items = [];

  for (var i = 0; i < staff.length; i++) {
    items.push({ label: staff[i].name + '（' + staff[i].role + '）', text: staff[i].name });
  }

  items.push({ label: '指名しない', text: '指名しない' });
  items.push({ label: 'やめる', text: 'やめる' });
  return items;
}

// --- Cache ---

function _ensureStaffCache() {
  if (_staffCache !== null) return;

  var sheet = getStaffSheet();
  var data = sheet.getDataRange().getValues();
  _staffCache = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    _staffCache.push({
      staff_id: String(row[0]),
      name: String(row[1] || ''),
      role: String(row[2] || ''),
      active: row[3] === true || row[3] === 'TRUE' || row[3] === true,
      specialties: String(row[4] || '').split(',').map(function(s) { return s.trim(); })
    });
  }
}

function _ensureShiftCache() {
  if (_shiftCache !== null) return;

  var sheet = getStaffShiftsSheet();
  var data = sheet.getDataRange().getValues();
  _shiftCache = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] || !row[1]) continue;
    var key = String(row[0]) + '_' + formatDateObj(row[1]);
    _shiftCache[key] = {
      staff_id: String(row[0]),
      date: formatDateObj(row[1]),
      start_time: formatTimeObj(row[2]),
      end_time: formatTimeObj(row[3]),
      break_start: formatTimeObj(row[4]),
      break_end: formatTimeObj(row[5])
    };
  }
}

function _invalidateStaffCache() {
  _staffCache = null;
  _shiftCache = null;
}
