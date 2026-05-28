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
  var tomorrowStr = Utilities.formatDate(tomorrow, TIMEZONE, 'yyyy-MM-dd');

  var reminderHoursBefore = getReminderHoursBefore();
  var sentCount = 0;

  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];

    if (r.reserved_date !== tomorrowStr || r.reminder_sent === 'Y' || r.status !== RESERVATION_STATUS.CONFIRMED) {
      continue;
    }

    var reminder = MessageTemplates.getReminderMessage(tomorrowStr, r.reserved_start, r.menu_type);

    var sent = false;
    if (reminder.quickReplies) {
      sent = sendLinePushQuickReply(r.line_display_name, reminder.text, reminder.quickReplies);
    } else {
      sent = sendLinePush(r.line_display_name, reminder.text || reminder);
    }

    if (sent) {
      markReminderSent(r.id);
      sentCount++;
    }
  }

  appendLogRow('INFO', 'Sent ' + sentCount + ' day-before reminders for ' + tomorrowStr);
  return sentCount;
}

/**
 * Send same-day (morning-of) reminders
 */
function sendSameDayReminders() {
  var now = new Date();
  var todayStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
  var sentCount = 0;

  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];
    if (r.reserved_date !== todayStr || r.status !== RESERVATION_STATUS.CONFIRMED) continue;

    var prefs = getUserPrefs(r.line_display_name);
    if (prefs.skip_same_day_reminder === 'true') continue;

    var msg = _fill(
      '本日はご予約の日です。\n\n' +
      '【日時】 {date} {time}\n' +
      '【施術】 {menu}\n\n' +
      'ご来院をお待ちしております！',
      { date: r.reserved_date, time: r.reserved_start, menu: r.menu_type }
    );

    if (sendLinePush(r.line_display_name, msg)) {
      sentCount++;
    }
  }

  appendLogRow('INFO', 'Sent ' + sentCount + ' same-day reminders for ' + todayStr);
  return sentCount;
}

/**
 * Check for no-shows
 */
function checkForNoShows() {
  var now = new Date();
  var currentTime = Utilities.formatDate(now, TIMEZONE, 'HH:mm');
  var currentDate = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');

  var noShowCount = 0;

  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];

    if (r.reserved_date === currentDate &&
        r.reserved_end <= currentTime &&
        r.status === RESERVATION_STATUS.CONFIRMED) {

      appendLogRow('INFO', 'No-show detected: ' + r.id);
      markNoShow(r.id);

      // CRM: increment no-show count
      if (r.phone) {
        try { incrementNoShowCount(r.phone); } catch (crmErr) {
          appendLogRow('WARN', 'CRM no-show update failed: ' + crmErr.message);
        }
      }

      if (r.deposit_status === DEPOSIT_STATUS.PAID) {
        var noShowDepositAmount = getNoShowDepositAmount();
        var message = MessageTemplates.getNoShowPenaltyMessage(noShowDepositAmount);
        sendLinePush(r.line_display_name, message);
      }

      notifyAdmin('no_show', '無断キャンセル検知: ' + r.id + ' / ' + r.patient_name + ' / ' + r.reserved_date + ' ' + r.reserved_start);

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

  // Notify waitlist candidates (delegates to WaitlistService)
  notifyWaitlistCandidates(reservation);

  // Mark resale notified
  resellVacancy(reservationId, '');

  // Schedule check for responses
  ScriptApp.newTrigger('checkWaitlistResponses')
    .timeBased()
    .after(10 * 60 * 1000)
    .create();

  appendLogRow('INFO', 'Scheduled waitlist response check for: ' + reservationId);
}

/**
 * Check waitlist responses for resale
 *
 * Triggered 10min after handleSameDayCancellation.
 * Finds notified-but-unclaimed reservations and notifies next waitlist candidate.
 */
function checkWaitlistResponses() {
  var TIMEOUT_HOURS = 2;
  var now = new Date();
  var threshold = new Date(now.getTime() - TIMEOUT_HOURS * 60 * 60 * 1000);

  var timedOut = [];

  _ensureReservationCache();
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];

    if (r.resale_notified !== 'Y' || r.resale_success === 'Y' || r.status !== RESERVATION_STATUS.CANCELLED) {
      continue;
    }

    // Only process reservations cancelled within the timeout window
    var cancelTime = r.updated_at ? new Date(r.updated_at) : null;
    if (!cancelTime || cancelTime < threshold) {
      continue;
    }

    // Check if a new reservation was created for the same slot (someone claimed it)
    var slotClaimed = false;
    for (var j = 0; j < _reservationCache.length; j++) {
      var other = _reservationCache[j];
      if (other.id !== r.id &&
          other.reserved_date === r.reserved_date &&
          other.reserved_start === r.reserved_start &&
          other.status === RESERVATION_STATUS.CONFIRMED) {
        slotClaimed = true;
        break;
      }
    }

    if (!slotClaimed) {
      timedOut.push(r);
    }
  }

  // Notify next candidate for each unclaimed vacancy
  for (var k = 0; k < timedOut.length; k++) {
    var reservation = timedOut[k];
    var appointmentDateTime = reservation.reserved_date + 'T' + reservation.reserved_start;
    var candidates = findWaitlistCandidate(appointmentDateTime);

    if (candidates.length > 0) {
      var candidate = candidates[0];
      var vacancyMsg = MessageTemplates.getResaleNotificationMessage(
        reservation.reserved_date,
        reservation.reserved_start + '-' + (reservation.reserved_end || ''),
        reservation.menu_type
      );

      if (vacancyMsg && vacancyMsg.quickReplies) {
        sendLinePushQuickReply(candidate.line_display_name, vacancyMsg.text, vacancyMsg.quickReplies);
      } else {
        sendLinePush(candidate.line_display_name, vacancyMsg.text || vacancyMsg || '');
      }

      // Update last_notified_at for the candidate
      var sheet = getWaitlistSheet();
      var waitlistData = sheet.getDataRange().getValues();
      for (var w = 1; w < waitlistData.length; w++) {
        if (waitlistData[w][0] == candidate.id) {
          sheet.getRange(w + 1, 6).setValue(new Date());
          break;
        }
      }

      appendLogRow('INFO', 'Waitlist: notified next candidate ' + candidate.id + ' for slot ' + reservation.reserved_date + ' ' + reservation.reserved_start);
    } else {
      appendLogRow('INFO', 'Waitlist: no candidates for unclaimed slot ' + reservation.reserved_date + ' ' + reservation.reserved_start);
    }
  }

  appendLogRow('INFO', 'checkWaitlistResponses completed: ' + timedOut.length + ' unclaimed slot(s) processed');
  return timedOut.length;
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


/**
 * Run all periodic CRM tasks (called from trigger)
 */
function runCrmPeriodicTasks() {
  processFollowups(60);
}
