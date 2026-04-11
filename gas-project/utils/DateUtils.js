/**
 * Date Utils - Date and Time Utilities
 *
 * Helper functions for date/time manipulation and formatting
 */

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return '';
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * Format time to HH:MM
 */
function formatTime(date) {
  if (!date) return '';
  return Utilities.formatDate(date, 'Asia/Tokyo', 'HH:mm');
}

/**
 * Format datetime to YYYY-MM-DD HH:mm
 */
function formatDateTime(date) {
  if (!date) return '';
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
}

/**
 * Parse date string to Date object
 */
function parseDate(dateString) {
  if (!dateString) return null;

  var formats = [
    'yyyy-MM-dd',
    'yyyy/MM/dd',
    'MM/dd/yyyy',
    'dd/MM/yyyy'
  ];

  for (var i = 0; i < formats.length; i++) {
    try {
      return Utilities.parseDate(dateString, 'Asia/Tokyo', formats[i]);
    } catch (e) {
      continue;
    }
  }

  return null;
}

/**
 * Parse time string to hours and minutes
 */
function parseTime(timeString) {
  if (!timeString) return null;

  var parts = timeString.split(':');
  if (parts.length !== 2) return null;

  return {
    hours: parseInt(parts[0]),
    minutes: parseInt(parts[1])
  };
}

/**
 * Add days to date
 */
function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to date
 */
function addHours(date, hours) {
  var result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Add minutes to date
 */
function addMinutes(date, minutes) {
  var result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Get week start date (Monday)
 */
function getWeekStart(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);

  return new Date(d.setDate(diff));
}

/**
 * Get week end date (Sunday)
 */
function getWeekEnd(date) {
  var weekStart = getWeekStart(date);
  return addDays(weekStart, 6);
}

/**
 * Check if date is today
 */
function isToday(date) {
  if (!date) return false;
  var today = new Date();
  return formatDate(date) === formatDate(today);
}

/**
 * Check if date is tomorrow
 */
function isTomorrow(date) {
  if (!date) return false;
  var tomorrow = addDays(new Date(), 1);
  return formatDate(date) === formatDate(tomorrow);
}

/**
 * Check if date is in the past
 */
function isPast(date) {
  if (!date) return false;
  return date < new Date();
}

/**
 * Get difference in days between two dates
 */
function getDaysDifference(date1, date2) {
  var oneDay = 24 * 60 * 60 * 1000;
  var diff = date2 - date1;
  return Math.round(diff / oneDay);
}

/**
 * Get difference in hours between two dates
 */
function getHoursDifference(date1, date2) {
  var oneHour = 60 * 60 * 1000;
  var diff = date2 - date1;
  return Math.round(diff / oneHour);
}

/**
 * Get difference in minutes between two dates
 */
function getMinutesDifference(date1, date2) {
  var oneMinute = 60 * 1000;
  var diff = date2 - date1;
  return Math.round(diff / oneMinute);
}

/**
 * Calculate end time from start time and duration
 */
function calculateEndTime(startTime, durationMinutes) {
  var timeParts = parseTime(startTime);
  if (!timeParts) return '';

  var totalMinutes = timeParts.hours * 60 + timeParts.minutes + durationMinutes;

  var endHours = Math.floor(totalMinutes / 60);
  var endMinutes = totalMinutes % 60;

  return String(endHours).padStart(2, '0') + ':' + String(endMinutes).padStart(2, '0');
}

/**
 * Calculate duration between two times
 */
function calculateDuration(startTime, endTime) {
  var startParts = parseTime(startTime);
  var endParts = parseTime(endTime);

  if (!startParts || !endParts) return 0;

  var startMinutes = startParts.hours * 60 + startParts.minutes;
  var endMinutes = endParts.hours * 60 + endParts.minutes;

  return endMinutes - startMinutes;
}

/**
 * Format date for Japanese display
 */
function formatDateJapanese(date) {
  if (!date) return '';

  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  var weekday = weekdays[date.getDay()];

  return year + '年' + month + '月' + day + '日（' + weekday + '）';
}

/**
 * Get age in days
 */
function getAgeInDays(date) {
  if (!date) return 0;
  var oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((Date.now() - date.getTime()) / oneDay);
}

/**
 * Check if a date+time combination is in the past (with optional lead time buffer)
 * @param {string} dateStr - YYYY-MM-DD format
 * @param {string} timeStr - HH:MM format
 * @param {number} leadTimeMinutes - additional buffer minutes required before the slot
 * @returns {boolean} true if the slot is within the lead time or past
 */
function isPastDateTime(dateStr, timeStr, leadTimeMinutes) {
  if (!dateStr || !timeStr) return true;
  var leadTime = leadTimeMinutes || 0;
  var tz = 'Asia/Tokyo';
  var now = new Date();
  var nowStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var nowTimeStr = Utilities.formatDate(now, tz, 'HH:mm');

  // If date is before today, definitely past
  if (dateStr < nowStr) return true;
  // If date is after today, definitely not past
  if (dateStr > nowStr) return false;

  // Same day — compare times with lead time
  var timeParts = timeStr.split(':');
  var slotMinutes = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);

  var nowParts = nowTimeStr.split(':');
  var nowMinutes = parseInt(nowParts[0]) * 60 + parseInt(nowParts[1]);

  // Slot must be at least leadTime minutes from now
  return slotMinutes <= (nowMinutes + leadTime);
}
