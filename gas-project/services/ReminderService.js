/**
 * Reminder Service - Automatic Notifications
 *
 * Handles day-before reminders, no-show detection, and resale notifications
 * Uses SheetService cache for all data access
 */

/**
 * Send day-before reminders
 */
function sendDayBeforeReminders() {
  var now = new Date();
  var tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = Utilities.formatDate(tomorrow, 'Asia/Tokyo', 'yyyy-MM-dd');

  var reminderHoursBefore = getReminderHoursBefore();
  var sentCount = 0;

  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];

    if (r.reserved_date !== tomorrowStr || r.reminder_sent === 'Y' || r.status !== RESERVATION_STATUS.CONFIRMED) {
      continue;
    }

    var message = MessageTemplates.getReminderMessage(tomorrowStr, r.reserved_start, r.menu_type);

    if (sendLinePush(r.line_display_name, message)) {
      markReminderSent(r.id);
      sentCount++;
    }
  }

  appendLogRow('INFO', 'Sent ' + sentCount + ' day-before reminders for ' + tomorrowStr);
  return sentCount;
}

/**
 * Check for no-shows
 */
function checkForNoShows() {
  var now = new Date();
  var currentTime = Utilities.formatDate(now, 'Asia/Tokyo', 'HH:mm');
  var currentDate = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');

  var noShowCount = 0;

  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];

    if (r.reserved_date === currentDate &&
        r.reserved_end <= currentTime &&
        r.status === RESERVATION_STATUS.CONFIRMED) {

      appendLogRow('INFO', 'No-show detected: ' + r.id);
      markNoShow(r.id);

      if (r.deposit_status === DEPOSIT_STATUS.PAID) {
        var noShowDepositAmount = getNoShowDepositAmount();
        var message = MessageTemplates.getNoShowPenaltyMessage(noShowDepositAmount);
        sendLinePush(r.line_display_name, message);
      }

      noShowCount++;
    }
  }

  if (noShowCount > 0) {
    appendLogRow('INFO', 'Detected ' + noShowCount + ' no-shows');
  }

  return noShowCount;
}

/**
 * Handle same-day cancellation and resale
 */
function handleSameDayCancellation(reservationId, reason) {
  var reservation = getReservationById(reservationId);

  if (!reservation) {
    appendLogRow('WARN', 'Reservation not found: ' + reservationId);
    return;
  }

  // Cancel reservation
  handleCancellation(reservationId, reason);

  // Find waitlist candidates
  var appointmentDateTime = reservation.reserved_date + ' ' + reservation.reserved_start;
  var candidates = findWaitlistCandidate(appointmentDateTime);

  if (candidates.length > 0) {
    // Notify waitlist candidates
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      var message = MessageTemplates.getResaleNotificationMessage(
        reservation.reserved_date,
        reservation.reserved_start,
        reservation.menu_type
      );

      sendLinePush(candidate.line_display_name, message);

      // Update last notified time
      var sheet = getWaitlistSheet();
      var waitlistData = sheet.getDataRange().getValues();

      for (var j = 1; j < waitlistData.length; j++) {
        if (waitlistData[j][0] == candidate.id) {
          sheet.getRange(j + 1, 6).setValue(new Date());
          break;
        }
      }
    }

    // Mark resale notified
    resellVacancy(reservationId, candidates[0].id);

    // Schedule check for responses
    ScriptApp.newTrigger('checkWaitlistResponses')
      .timeBased()
      .after(10 * 60 * 1000)
      .create();

    appendLogRow('INFO', 'Scheduled waitlist response check for: ' + reservationId);
  }
}

/**
 * Check waitlist responses for resale
 */
function checkWaitlistResponses() {
  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];

    if (r.resale_notified !== 'Y' || r.resale_success === 'Y') {
      continue;
    }

    appendLogRow('INFO', 'Waitlist response check needed for: ' + r.id);
  }
}

/**
 * Clean up old waitlist entries
 */
function cleanupWaitlist() {
  var sheet = getWaitlistSheet();
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  var rowsToDelete = [];

  for (var i = 1; i < data.length; i++) {
    var lastNotified = data[i][5];

    if (lastNotified && new Date(lastNotified) < thirtyDaysAgo) {
      rowsToDelete.push(i + 1);
    }
  }

  // Delete old rows (in reverse order to maintain indices)
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }

  appendLogRow('INFO', 'Cleaned up ' + rowsToDelete.length + ' old waitlist entries');
}
