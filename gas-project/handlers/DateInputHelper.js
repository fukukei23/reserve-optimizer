/**
 * Date Input Helper
 *
 * Date parsing, calendar UI, time slot prompts, and treatment time ordering
 */

/**
 * Parse date input (YYYY-MM-DD, M月D日, M/D, 今日, 明日, 明後日, 来週月曜...)
 * Also strips trailing (曜日) suffix e.g. "4/25(金)" → "4/25"
 */
function parseDateInput(text) {
  if (!text || typeof text !== 'string') return null;
  var s = text.trim();

  // Strip trailing (曜日) suffix e.g. "4/25(金)" → "4/25"
  s = s.replace(/\([月火水木金土日]\)$/, '');

  var tz = TIMEZONE;
  var now = new Date();
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var currentYear = parseInt(Utilities.formatDate(now, tz, 'yyyy'));

  // YYYY-MM-DD
  var isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return isoMatch[0];

  // YYYY/MM/DD
  var ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) return ymdSlash[1] + '-' + pad2(ymdSlash[2]) + '-' + pad2(ymdSlash[3]);

  // MM/DD/YYYY
  var mdySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdySlash) return mdySlash[3] + '-' + pad2(mdySlash[1]) + '-' + pad2(mdySlash[2]);

  // M/D (no year — assume current year, if past assume next year)
  var mdSlash = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (mdSlash) return resolveMonthDay(currentYear, parseInt(mdSlash[1]), parseInt(mdSlash[2]), todayStr);

  // M月D日 (Japanese date format)
  var jpDate = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
  if (jpDate) return resolveMonthDay(currentYear, parseInt(jpDate[1]), parseInt(jpDate[2]), todayStr);

  if (s === '今日') return todayStr;
  if (s === '明日' || s === '翌日') return addDaysToDateStr(todayStr, 1);
  if (s === '明後日') return addDaysToDateStr(todayStr, 2);

  var weekdays = { '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 7 };
  var nextWeekMatch = s.match(/^来週([月火水木金土日])曜?/);
  if (nextWeekMatch) {
    var targetDow = weekdays[nextWeekMatch[1]];
    var d = getNextWeekday(now, targetDow, tz);
    return d ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : null;
  }

  var thisWeekMatch = s.match(/^(今週|今週の)?([月火水木金土日])曜?/);
  if (thisWeekMatch) {
    var targetDow2 = weekdays[thisWeekMatch[2]];
    var d2 = getThisOrNextWeekday(now, targetDow2, tz);
    return d2 ? Utilities.formatDate(d2, tz, 'yyyy-MM-dd') : null;
  }

  return null;
}

/**
 * Resolve M/D to YYYY-MM-DD, using next year if the date is in the past
 */
function resolveMonthDay(year, month, day, todayStr) {
  var m = pad2(String(month));
  var d = pad2(String(day));
  var candidate = year + '-' + m + '-' + d;
  if (candidate < todayStr) {
    candidate = (year + 1) + '-' + m + '-' + d;
  }
  return candidate;
}

/**
 * Zero-pad a number string to 2 digits
 */
function pad2(n) {
  return n.length === 1 ? '0' + n : String(n);
}

function addDaysToDateStr(dateStr, days) {
  var d = new Date(dateStr + 'T12:00:00+09:00');
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}

function getNextWeekday(now, targetDow, tz) {
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var todayDate = new Date(todayStr + 'T12:00:00+09:00');
  var day = todayDate.getDay();
  var currentDow = day === 0 ? 7 : day;
  var daysAhead = (targetDow - currentDow + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  var d = new Date(todayDate);
  d.setDate(d.getDate() + daysAhead);
  return d;
}

function getThisOrNextWeekday(now, targetDow, tz) {
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var todayDate = new Date(todayStr + 'T12:00:00+09:00');
  var day = todayDate.getDay();
  var currentDow = day === 0 ? 7 : day;
  var daysAhead = (targetDow - currentDow + 7) % 7;
  var d = new Date(todayDate);
  d.setDate(d.getDate() + daysAhead);
  return d;
}

/**
 * Send date prompt with rolling calendar (next 10 available dates, skip Sundays)
 * @param {string} replyToken - LINE reply token
 * @param {string} userId - LINE user ID (unused but kept for signature compatibility)
 * @param {string} pageStartDate - optional 'YYYY-MM-DD' to start showing from a specific date
 */
function sendDatePromptWithQuickReply(replyToken, userId, pageStartDate) {
  var tz = TIMEZONE;
  var now = new Date();
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var todayDate = new Date(todayStr + 'T00:00:00+09:00');
  var maxDate = new Date(todayDate);
  maxDate.setDate(maxDate.getDate() + 90);
  var maxDateStr = Utilities.formatDate(maxDate, tz, 'yyyy-MM-dd');
  var weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  // Start date for this page
  var start;
  if (pageStartDate) {
    start = new Date(pageStartDate + 'T00:00:00+09:00');
  } else {
    start = new Date(todayDate);
  }

  // Collect up to 10 available dates (skip Sundays)
  var dates = [];
  var current = new Date(start);
  while (dates.length < 10) {
    var dateStr = Utilities.formatDate(current, tz, 'yyyy-MM-dd');
    if (dateStr > maxDateStr) break;
    var dow = current.getDay();
    if (dow === 0) { // Skip Sunday
      current.setDate(current.getDate() + 1);
      continue;
    }
    if (dateStr < todayStr) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    var month = current.getMonth() + 1;
    var day = current.getDate();
    dates.push({
      date: dateStr,
      label: month + '/' + day + '(' + weekdays[dow] + ')'
    });
    current.setDate(current.getDate() + 1);
  }

  // Build Quick Reply items
  var items = [];
  for (var i = 0; i < dates.length; i++) {
    items.push({ label: dates[i].label, text: dates[i].date });
  }

  // Previous page button
  var isFirstPage = !pageStartDate;
  if (!isFirstPage) {
    var prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    var prevDates = [];
    while (prevDates.length < 10 && prevStart >= todayDate) {
      var prevDateStr = Utilities.formatDate(prevStart, tz, 'yyyy-MM-dd');
      if (prevDateStr < todayStr) break;
      var prevDow = prevStart.getDay();
      if (prevDow !== 0) {
        prevDates.unshift(prevDateStr);
      }
      prevStart.setDate(prevStart.getDate() - 1);
    }
    if (prevDates.length > 0) {
      items.push({ label: '◀前へ', text: 'PAGE_PREV:' + prevDates[0] });
    }
  }

  // Next page button
  if (dates.length === 10) {
    var nextDateStr = Utilities.formatDate(current, tz, 'yyyy-MM-dd');
    if (nextDateStr <= maxDateStr) {
      items.push({ label: '次へ▶', text: 'PAGE_NEXT:' + nextDateStr });
    }
  }

  items.push({ label: '日付入力', text: '日付入力' });
  items.push({ label: 'やめる', text: 'やめる' });

  var msg = isFirstPage
    ? '希望日を選んでください。（日曜休業、90日先まで）'
    : '続きの日付を選んでください。';
  sendQuickReply(replyToken, msg, items);
}

/**
 * Send time prompt with quick reply — shows only available slots
 * Filters out: past times (with lead time buffer) and fully booked slots
 * @param {string} replyToken - LINE reply token
 * @param {string} date - YYYY-MM-DD format (optional, defaults to today)
 */
function sendTimePromptWithQuickReply(replyToken, date) {
  var targetDate = date || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  var leadTime = getBookingLeadTimeMinutes();
  var maxConcurrent = getMaxConcurrentBookings();
  var bufferMinutes = getBufferMinutes();
  var bookedSlots = getBookedSlotsForDate(targetDate);

  // Generate slots based on day of week (configured in SheetConfig.js)
  var targetDateObj = new Date(targetDate + 'T12:00:00+09:00');
  var dayOfWeek = targetDateObj.getDay();
  var allSlots = (dayOfWeek === 6) ? TIME_SLOTS.SATURDAY : TIME_SLOTS.WEEKDAY;

  // Build set of blocked slot times due to buffer (minutes after a booked slot)
  var blockedByBuffer = {};
  if (bufferMinutes > 0) {
    for (var bs = 0; bs < allSlots.length; bs++) {
      if ((bookedSlots[allSlots[bs]] || 0) > 0) {
        var bookedMins = _slotToMinutes(allSlots[bs]);
        for (var ns = bs + 1; ns < allSlots.length; ns++) {
          var nextMins = _slotToMinutes(allSlots[ns]);
          if (nextMins - bookedMins <= bufferMinutes) {
            blockedByBuffer[allSlots[ns]] = true;
          } else {
            break;
          }
        }
      }
    }
  }

  var availableSlots = [];
  for (var i = 0; i < allSlots.length; i++) {
    var slot = allSlots[i];
    // Skip past times (with lead time)
    if (isPastDateTime(targetDate, slot, leadTime)) continue;
    // Skip fully booked slots
    var bookedCount = bookedSlots[slot] || 0;
    if (bookedCount >= maxConcurrent) continue;
    // Skip slots within buffer window after a booked slot
    if (blockedByBuffer[slot]) continue;
    availableSlots.push(slot);
  }

  if (availableSlots.length === 0) {
    sendQuickReply(replyToken, '申し訳ございません、' + targetDate + 'は予約可能な時間がありません。\n\n別の日を選択してください。', [
      { label: '別の日を選ぶ', text: '別の日' },
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  var timeOptions = availableSlots.map(function(t) { return { label: t, text: t }; });
  timeOptions.push({ label: 'やめる', text: 'やめる' });
  sendQuickReply(replyToken, '希望時間を選択してください。（空き枠のみ表示、初診30分/再診30or60分）', timeOptions);
}

/**
 * Validate 初診/再診 time ordering on the same day
 * Rule: 再診 must start AFTER 初診 ends on the same day
 * @param {string} userId - LINE user ID
 * @param {string} date - YYYY-MM-DD
 * @param {string} time - HH:MM (start time being validated)
 * @param {string} treatmentType - menu_type (e.g., '初診（30分）', '再診（30分）')
 * @param {string} excludeId - reservation ID to exclude from check (for changes)
 * @returns {object} { valid: boolean, reason: string }
 */
function validateTreatmentTimeOrdering(userId, date, time, treatmentType, excludeId) {
  var reservations = getReservationsByLineUserId(userId);
  var isShoshin = treatmentType.indexOf('初診') !== -1;
  var tParts = time.split(':');
  var timeMins = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
  var duration = getTreatmentDuration(treatmentType);
  var endMins = timeMins + duration;

  for (var i = 0; i < reservations.length; i++) {
    var r = reservations[i];
    if (excludeId && r.id === excludeId) continue;
    if (r.reserved_date !== date) continue;
    if (r.status !== RESERVATION_STATUS.PENDING && r.status !== RESERVATION_STATUS.CONFIRMED) continue;
    if (!r.menu_type) continue;

    var rIsShoshin = r.menu_type.indexOf('初診') !== -1;
    var rStartParts = r.reserved_start.split(':');
    var rStartMins = parseInt(rStartParts[0]) * 60 + parseInt(rStartParts[1]);
    var rEndParts = r.reserved_end ? r.reserved_end.split(':') : null;
    var rEndMins = rEndParts ? parseInt(rEndParts[0]) * 60 + parseInt(rEndParts[1]) : rStartMins + 30;

    // 再診 must start AFTER 初診 ends
    if (!isShoshin && rIsShoshin) {
      if (timeMins < rEndMins) {
        return {
          valid: false,
          reason: '再診は初診（' + r.reserved_start + ' - ' + (r.reserved_end || '') + '）より後の時間にしてください。'
        };
      }
    }

    // 初診 must end BEFORE 再診 starts
    if (isShoshin && !rIsShoshin) {
      if (endMins > rStartMins) {
        return {
          valid: false,
          reason: '初診は再診（' + r.reserved_start + '）より前の時間にしてください。'
        };
      }
    }
  }

  return { valid: true, reason: '' };
}

// Convert HH:MM slot string to minutes since midnight.
function _slotToMinutes(slot) {
  var parts = slot.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}
