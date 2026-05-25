/**
 * Calendar Service - Google Calendar Integration
 *
 * Syncs reservation CRUD to Google Calendar so staff can see
 * bookings in their calendar app without opening Sheets.
 *
 * Setup: Set GOOGLE_CALENDAR_ID in ScriptProperties (or uses default calendar).
 */

var CALENDAR_ID_PROPERTY = 'GOOGLE_CALENDAR_ID';
var CALENDAR_EVENT_PREFIX = 'calendar_event:';

/**
 * Get the target calendar (specific or default).
 */
function _getCalendar() {
  var calendarId = getProperty(CALENDAR_ID_PROPERTY);
  if (calendarId) {
    return CalendarApp.getCalendarById(calendarId);
  }
  return CalendarApp.getDefaultCalendar();
}

/**
 * Create a calendar event for a new reservation.
 * Stores the event ID in the reservation's notes field.
 *
 * @param {object} reservation - Reservation object (must have id, reserved_date, reserved_start, reserved_end, menu_type, patient_name, phone)
 * @returns {string|null} Calendar event ID, or null on failure
 */
function createCalendarEvent(reservation) {
  try {
    var calendar = _getCalendar();
    var startDt = _parseDateTime(reservation.reserved_date, reservation.reserved_start);
    var endDt = _parseDateTime(reservation.reserved_date, reservation.reserved_end);

    if (!startDt || !endDt) {
      appendLogRow('WARN', '[Calendar] Invalid date/time: ' + reservation.reserved_date + ' ' + reservation.reserved_start);
      return null;
    }

    var title = reservation.menu_type + ' - ' + reservation.patient_name;
    var description = '予約ID: ' + reservation.id + '\n電話: ' + (reservation.phone || '');

    var event = calendar.createEvent(title, startDt, endDt, {
      description: description
    });

    // Store event ID in notes
    var existingNotes = reservation.notes || '';
    var newNotes = existingNotes + CALENDAR_EVENT_PREFIX + event.getId();
    updateReservation(reservation.id, { notes: newNotes });

    appendLogRow('INFO', '[Calendar] Created event for ' + reservation.id + ': ' + event.getId());
    return event.getId();
  } catch (e) {
    appendLogRow('ERROR', '[Calendar] createCalendarEvent failed: ' + e.message);
    return null;
  }
}

/**
 * Update a calendar event when a reservation changes.
 *
 * @param {string} reservationId - Reservation ID
 * @param {object} updates - Fields that changed (reserved_date, reserved_start, reserved_end, status)
 */
function updateCalendarEvent(reservationId, updates) {
  try {
    var reservation = getReservationById(reservationId);
    if (!reservation || !reservation.notes) return;

    var eventId = _extractCalendarEventId(reservation.notes);
    if (!eventId) return;

    var calendar = _getCalendar();
    var event = calendar.getEventById(eventId);
    if (!event) {
      appendLogRow('WARN', '[Calendar] Event not found: ' + eventId);
      return;
    }

    // Update time if date/time changed
    if (updates.reserved_date || updates.reserved_start || updates.reserved_end) {
      var date = updates.reserved_date || reservation.reserved_date;
      var startTime = updates.reserved_start || reservation.reserved_start;
      var endTime = updates.reserved_end || reservation.reserved_end;
      var newStart = _parseDateTime(date, startTime);
      var newEnd = _parseDateTime(date, endTime);
      if (newStart && newEnd) {
        event.setTime(newStart, newEnd);
      }
    }

    // Mark cancelled reservations
    if (updates.status === RESERVATION_STATUS.CANCELLED) {
      event.setColor(CalendarApp.EventColor.PALE_RED);
      event.setTitle('[キャンセル] ' + event.getTitle());
    }

    appendLogRow('INFO', '[Calendar] Updated event for ' + reservationId);
  } catch (e) {
    appendLogRow('ERROR', '[Calendar] updateCalendarEvent failed: ' + e.message);
  }
}

/**
 * Delete (or strikethrough) a calendar event on reservation cancellation.
 *
 * @param {string} reservationId - Reservation ID
 */
function deleteCalendarEvent(reservationId) {
  try {
    var reservation = getReservationById(reservationId);
    if (!reservation || !reservation.notes) return;

    var eventId = _extractCalendarEventId(reservation.notes);
    if (!eventId) return;

    var calendar = _getCalendar();
    var event = calendar.getEventById(eventId);
    if (event) {
      event.setColor(CalendarApp.EventColor.PALE_RED);
      event.setTitle('[キャンセル] ' + event.getTitle());
      appendLogRow('INFO', '[Calendar] Marked cancelled: ' + eventId);
    }
  } catch (e) {
    appendLogRow('ERROR', '[Calendar] deleteCalendarEvent failed: ' + e.message);
  }
}

// --- Internal helpers ---

/**
 * Parse date string (YYYY/MM/DD) + time string (HH:MM) into a Date object.
 * Handles GAS locale quirks by building the Date manually.
 */
function _parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  var dateParts = String(dateStr).split('/');
  var timeParts = String(timeStr).split(':');

  if (dateParts.length < 3 || timeParts.length < 2) return null;

  var year = parseInt(dateParts[0], 10);
  var month = parseInt(dateParts[1], 10) - 1; // JS months are 0-based
  var day = parseInt(dateParts[2], 10);
  var hour = parseInt(timeParts[0], 10);
  var minute = parseInt(timeParts[1], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;

  return new Date(year, month, day, hour, minute, 0);
}

/**
 * Extract calendar event ID from notes string.
 */
function _extractCalendarEventId(notes) {
  if (!notes) return null;
  var idx = notes.indexOf(CALENDAR_EVENT_PREFIX);
  if (idx === -1) return null;
  return notes.substring(idx + CALENDAR_EVENT_PREFIX.length).split('|')[0].trim();
}
