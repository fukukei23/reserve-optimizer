/**
 * Reminder Service - Automatic Notifications
 *
 * Handles day-before reminders, no-show detection, and resale notifications
 */

/**
 * Send day-before reminders
 */
function sendDayBeforeReminders() {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = Utilities.formatDate(tomorrow, 'Asia/Tokyo', 'yyyy-MM-dd');

  var reminderHoursBefore = getReminderHoursBefore();
  var sentCount = 0;

  for (var i = 1; i < data.length; i++) {
    var reservation = data[i];
    var reservationId = reservation[0];
    var reservedDate = reservation[7];
    var reminderSent = reservation[14];
    var status = reservation[10];

    // Skip if not tomorrow, already sent reminder, or not confirmed
    if (reservedDate !== tomorrowStr || reminderSent === 'Y' || status !== RESERVATION_STATUS.CONFIRMED) {
      continue;
    }

    // Send reminder
    var lineDisplayName = reservation[4];
    var reservedStart = reservation[8];
    var menuType = reservation[6];

    var message = MessageTemplates.getReminderMessage(
      tomorrowStr,
      reservedStart,
      menuType
    );

    if (sendLinePush(lineDisplayName, message)) {
      markReminderSent(reservationId);
      sentCount++;
    }
  }

  Logger.log('Sent ' + sentCount + ' day-before reminders for ' + tomorrowStr);
  return sentCount;
}

/**
 * Check for no-shows
 */
function checkForNoShows() {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var currentTime = Utilities.formatDate(now, 'Asia/Tokyo', 'HH:mm');
  var currentDate = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');

  var noShowCount = 0;

  for (var i = 1; i < data.length; i++) {
    var reservation = data[i];
    var reservationId = reservation[0];
    var reservedDate = reservation[7];
    var reservedEnd = reservation[9];
    var status = reservation[10];
    var depositStatus = reservation[13];

    // Check if appointment time passed and still confirmed
    if (reservedDate === currentDate &&
        reservedEnd <= currentTime &&
        status === RESERVATION_STATUS.CONFIRMED) {

      Logger.log('No-show detected: ' + reservationId);

      // Mark as no-show
      markNoShow(reservationId);

      // Send penalty notification if deposit paid
      if (depositStatus === DEPOSIT_STATUS.PAID) {
        var lineDisplayName = reservation[4];
        var noShowDepositAmount = getNoShowDepositAmount();

        var message = MessageTemplates.getNoShowPenaltyMessage(noShowDepositAmount);
        sendLinePush(lineDisplayName, message);
      }

      noShowCount++;
    }
  }

  if (noShowCount > 0) {
    Logger.log('Detected ' + noShowCount + ' no-shows');
  }

  return noShowCount;
}

/**
 * Handle same-day cancellation and resale
 */
function handleSameDayCancellation(reservationId, reason) {
  var reservation = getReservationById(reservationId);

  if (!reservation) {
    Logger.log('Reservation not found: ' + reservationId);
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
  }
}

/**
 * Check waitlist responses for resale
 */
function checkWaitlistResponses() {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var reservation = data[i];
    var resaleNotified = reservation[17];
    var resaleSuccess = reservation[18];

    // Skip if not notified or already successful
    if (resaleNotified !== 'Y' || resaleSuccess === 'Y') {
      continue;
    }

    // TODO: Check for waitlist responses via webhook or polling
    // For now, this is a placeholder for manual confirmation
    Logger.log('Waitlist response check needed for: ' + reservation[0]);
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

  Logger.log('Cleaned up ' + rowsToDelete.length + ' old waitlist entries');
}
