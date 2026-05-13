/**
 * Waitlist Service - Waitlist Management
 *
 * Handles waitlist CRUD, candidate scoring, and vacancy resale
 */

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

  var lastRow = sheet.getLastRow();
  var newId = lastRow < 2 ? 'W0001' : 'W' + String(lastRow).padStart(4, '0');

  var row = [
    newId,
    waitlistData.line_display_name || '',
    waitlistData.phone || '',
    waitlistData.preferred_time || 'Any',
    waitlistData.same_day_ok || 'N',
    '',
    waitlistData.notes || ''
  ];

  sheet.appendRow(row);

  notifyAdmin('waitlist', 'ウェイティングリスト登録: ' + newId + ' / 電話: ' + (waitlistData.phone || 'なし') + ' / 希望時間: ' + (waitlistData.preferred_time || 'Any'));

  return sheet.getLastRow();
}

/**
 * Find waitlist candidate for vacancy
 */
function findWaitlistCandidate(appointmentDateTime) {
  var waitlist = getWaitlistReservations();
  var appointmentDate = new Date(appointmentDateTime);
  var appointmentHour = appointmentDate.getHours();

  var scored = [];
  for (var i = 0; i < waitlist.length; i++) {
    var entry = waitlist[i];
    var score = 0;

    if (entry.same_day_ok === 'Y') {
      score += 10;
    }

    if (entry.preferred_time === 'Any') {
      score += 5;
    } else if (entry.preferred_time === 'Morning' && appointmentHour < 12) {
      score += 5;
    } else if (entry.preferred_time === 'Afternoon' && appointmentHour >= 12 && appointmentHour < 17) {
      score += 5;
    } else if (entry.preferred_time === 'Evening' && appointmentHour >= 17) {
      score += 5;
    }

    if (entry.last_notified_at) {
      var lastNotified = new Date(entry.last_notified_at);
      var hoursSinceNotification = (Date.now() - lastNotified.getTime()) / (1000 * 60 * 60);
      if (hoursSinceNotification < 24) {
        score -= 5;
      }
    }

    if (score > 0) {
      scored.push({ entry: entry, score: score });
    }
  }

  scored.sort(function(a, b) { return b.score - a.score; });

  return scored.slice(0, 3).map(function(c) { return c.entry; });
}

/**
 * Resell vacancy to waitlist candidate
 */
function resellVacancy(reservationId, waitlistPatientId) {
  updateReservation(reservationId, {
    resale_notified: 'Y'
  });

  appendLogRow('INFO', 'Reselling vacancy: ' + reservationId + ' to waitlist ID: ' + waitlistPatientId);
}

/**
 * Mark resale successful
 */
function markResaleSuccessful(reservationId) {
  updateReservation(reservationId, {
    resale_success: 'Y'
  });
}

/**
 * Notify waitlist candidates about a vacancy (best-effort, never blocks caller)
 * Shared by CancelHandler and ReminderService
 */
function notifyWaitlistCandidates(reservation) {
  try {
    var appointmentDateTime = reservation.reserved_date + 'T' + reservation.reserved_start;
    var candidates = findWaitlistCandidate(appointmentDateTime);

    for (var i = 0; i < candidates.length; i++) {
      var vacancyMsg = MessageTemplates.getResaleNotificationMessage(
        reservation.reserved_date,
        reservation.reserved_start + '-' + (reservation.reserved_end || ''),
        reservation.menu_type
      );

      if (vacancyMsg && vacancyMsg.quickReplies) {
        sendLinePushQuickReply(candidates[i].line_display_name, vacancyMsg.text, vacancyMsg.quickReplies);
      } else {
        sendLinePush(candidates[i].line_display_name, vacancyMsg.text || vacancyMsg || '');
      }

      // Update last_notified_at
      var sheet = getWaitlistSheet();
      var waitlistData = sheet.getDataRange().getValues();
      for (var j = 1; j < waitlistData.length; j++) {
        if (waitlistData[j][0] == candidates[i].id) {
          sheet.getRange(j + 1, 6).setValue(new Date());
          break;
        }
      }

      appendLogRow('INFO', 'Sent vacancy notification to waitlist: ' + candidates[i].line_display_name);
    }
  } catch (e) {
    appendLogRow('ERROR', 'Waitlist notification error: ' + e.message);
  }
}
