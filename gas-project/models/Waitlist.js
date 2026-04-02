/**
 * Waitlist Model
 *
 * Data model for waitlist entry
 */

/**
 * Create waitlist object from data
 */
function createWaitlistObject(data) {
  return {
    id: data.waitlist_id,
    line_display_name: data.line_display_name,
    phone: data.phone,
    preferred_time: data.preferred_time,
    same_day_ok: data.same_day_ok,
    last_notified_at: data.last_notified_at,
    notes: data.notes
  };
}

/**
 * Validate waitlist data
 */
function validateWaitlistData(data) {
  var errors = [];

  if (!data.phone || !validatePhoneNumber(data.phone)) {
    errors.push('電話番号の形式が正しくありません。');
  }

  if (!data.preferred_time || data.preferred_time.trim() === '') {
    errors.push('希望時間を入力してください。');
  }

  if (data.same_day_ok !== 'Y' && data.same_day_ok !== 'N') {
    errors.push('当日空き枠OK（Y/N）を選択してください。');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Calculate match score for vacancy
 */
function calculateMatchScore(waitlistEntry, appointmentDateTime) {
  var score = 0;
  var appointmentDate = new Date(appointmentDateTime);
  var appointmentHour = appointmentDate.getHours();

  // Same-day OK bonus
  if (waitlistEntry.same_day_ok === 'Y') {
    score += 10;
  }

  // Time preference match
  if (waitlistEntry.preferred_time === 'Any') {
    score += 5;
  } else if (waitlistEntry.preferred_time === 'Morning' && appointmentHour < 12) {
    score += 5;
  } else if (waitlistEntry.preferred_time === 'Afternoon' && appointmentHour >= 12 && appointmentHour < 17) {
    score += 5;
  } else if (waitlistEntry.preferred_time === 'Evening' && appointmentHour >= 17) {
    score += 5;
  }

  // Recent notification penalty (avoid spamming)
  if (waitlistEntry.last_notified_at) {
    var lastNotified = new Date(waitlistEntry.last_notified_at);
    var hoursSinceNotification = (Date.now() - lastNotified.getTime()) / (1000 * 60 * 60);

    if (hoursSinceNotification < 24) {
      score -= 5;
    }
  }

  return score;
}

/**
 * Sort waitlist by match score
 */
function sortWaitlistByMatch(waitlistEntries, appointmentDateTime) {
  return waitlistEntries.map(function(entry) {
    return {
      entry: entry,
      score: calculateMatchScore(entry, appointmentDateTime)
    };
  }).sort(function(a, b) {
    return b.score - a.score;
  }).map(function(item) {
    return item.entry;
  });
}

/**
 * Format waitlist entry for display
 */
function formatWaitlistForDisplay(waitlistEntry) {
  var sameDayText = waitlistEntry.same_day_ok === 'Y' ? '可' : '不可';

  return '【待機ID】 ' + waitlistEntry.id + '\n' +
    '【表示名】 ' + waitlistEntry.line_display_name + '\n' +
    '【電話】 ' + waitlistEntry.phone + '\n' +
    '【希望時間】 ' + waitlistEntry.preferred_time + '\n' +
    '【当日OK】 ' + sameDayText + '\n' +
    '【最終通知】 ' + (waitlistEntry.last_notified_at || 'なし') + '\n' +
    '【メモ】 ' + (waitlistEntry.notes || 'なし');
}

/**
 * Get waitlist count
 */
function getWaitlistCount() {
  var sheet = getWaitlistSheet();
  return sheet.getLastRow() - 1; // Subtract header row
}

/**
 * Clean up old waitlist entries
 */
function isWaitlistEntryStale(waitlistEntry, daysToKeep) {
  if (!waitlistEntry.last_notified_at) {
    return false;
  }

  var lastNotified = new Date(waitlistEntry.last_notified_at);
  var daysSinceNotification = (Date.now() - lastNotified.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceNotification > daysToKeep;
}
