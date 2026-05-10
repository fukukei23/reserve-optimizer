/**
 * Validation Utils - Input Validation
 *
 * Helper functions for validating user input
 */

/**
 * Normalize phone input (+81, hyphens, spaces, parens) for validation.
 * Returns cleaned string suitable for validatePhoneNumber; invalid input may still fail.
 */
function normalizePhoneInput(phone) {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  var s = phone.trim().replace(/[-\s()（）]/g, '');
  if (s.replace(/^\+81/, '0').length >= 10 && s.indexOf('+81') === 0) {
    s = '0' + s.substring(3);
  }
  return s;
}

/**
 * Validate phone number (Japanese format)
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove hyphens and spaces
  var cleaned = phone.replace(/[-\s]/g, '');

  // Check for 10 or 11 digits starting with 0
  var pattern = /^0\d{9,10}$/;

  return pattern.test(cleaned);
}

/**
 * Validate date (YYYY-MM-DD format)
 */
function validateDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  var patterns = [
    /^\d{4}-\d{1,2}-\d{1,2}$/,  // YYYY-MM-DD
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{4}\/\d{1,2}\/\d{1,2}$/  // YYYY/MM/DD
  ];

  for (var i = 0; i < patterns.length; i++) {
    if (patterns[i].test(dateString)) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize time input for user-friendly parsing (e.g. "10" or "10時" -> "10:00")
 * Returns HH:MM string or original string; invalid input may still fail validateTime.
 */
function normalizeTimeInput(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return timeString;
  }
  var s = timeString.trim().replace(/[）)]\s*$/, '');
  var onlyHour = /^([01]?[0-9]|2[0-3])$/;
  var hourJp = /^([01]?[0-9]|2[0-3])時(半)?$/;
  var hourMinJp = /^([01]?[0-9]|2[0-3])時([0-5]?[0-9])分?$/;
  var gozenGogo = /^(午前|午後|あさ|昼|よる)?\s*([01]?[0-9]|2[0-3])時(半|([0-5]?[0-9])分?)?$/;
  var amPm = /^([01]?[0-9]|2[0-3]):?([0-5][0-9])?\s*(am|pm|AM|PM)$/;

  if (onlyHour.test(s)) {
    return s + ':00';
  }
  var m = s.match(hourJp);
  if (m) {
    return m[1] + (m[2] ? ':30' : ':00');
  }
  m = s.match(hourMinJp);
  if (m) {
    var min = m[2].length === 1 ? '0' + m[2] : m[2];
    return m[1] + ':' + min;
  }
  m = s.match(gozenGogo);
  if (m) {
    var hour = parseInt(m[2], 10);
    var suffix = (m[1] || '').toString();
    if (suffix.indexOf('午後') !== -1 || suffix.indexOf('昼') !== -1 || suffix === 'よる') {
      if (hour >= 1 && hour <= 11) hour += 12;
    }
    var mins = (m[3] === '半') ? '30' : (m[4] ? (m[4].length === 1 ? '0' + m[4] : m[4]) : '00');
    return hour + ':' + mins;
  }
  m = s.match(amPm);
  if (m) {
    var h = parseInt(m[1], 10);
    var mins = m[2] ? m[2] : '00';
    if ((m[3] || '').toLowerCase() === 'pm' && h >= 1 && h <= 11) h += 12;
    if ((m[3] || '').toLowerCase() === 'am' && h === 12) h = 0;
    return h + ':' + mins;
  }
  return s;
}

/**
 * Validate time (HH:MM format)
 */
function validateTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return false;
  }

  var pattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!pattern.test(timeString)) {
    return false;
  }

  var parts = timeString.split(':');
  var hours = parseInt(parts[0]);
  var minutes = parseInt(parts[1]);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Validate email address
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate visit type
 */
function validateVisitType(visitType) {
  return visitType === VISIT_TYPE.FIRST || visitType === VISIT_TYPE.REPEAT;
}

/**
 * Validate menu type
 */
function validateMenuType(menuType) {
  var validMenus = [
    '初診（30分）',
    '再診（30分）',
    '再診（60分）'
  ];

  return validMenus.indexOf(menuType) !== -1;
}

/**
 * Validate reservation status
 */
function validateReservationStatus(status) {
  var validStatuses = [
    RESERVATION_STATUS.PENDING,
    RESERVATION_STATUS.CONFIRMED,
    RESERVATION_STATUS.VISITED,
    RESERVATION_STATUS.CANCELLED,
    RESERVATION_STATUS.NO_SHOW
  ];

  return validStatuses.indexOf(status) !== -1;
}

/**
 * Validate deposit status
 */
function validateDepositStatus(depositStatus) {
  var validStatuses = [
    DEPOSIT_STATUS.UNPAID,
    DEPOSIT_STATUS.PAID,
    DEPOSIT_STATUS.REFUNDED,
    DEPOSIT_STATUS.APPLIED,
    DEPOSIT_STATUS.FORFEITED
  ];

  return validStatuses.indexOf(depositStatus) !== -1;
}

/**
 * Sanitize user input (prevent XSS)
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  var sanitized = input.replace(/<[^>]*>/g, '');

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>]/g, '');

  return sanitized.trim();
}

/**
 * Validate name (Japanese or alphanumeric)
 */
function validateName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Allow Japanese characters, spaces, and basic punctuation
  var pattern = /^[\u3000-\u30FF\u4E00-\u9FAF\u0020-\u007E\s\u3001\u3002\u30FB\uFF0C\uFF0E\uFF1A\uFF1F]+$/;

  return name.length > 0 && name.length <= 50 && pattern.test(name);
}

/**
 * Validate notes length
 */
function validateNotes(notes) {
  if (!notes) return true;

  return notes.length <= 200;
}

/**
 * Validate cancellation reason
 */
function validateCancellationReason(reason) {
  return reason && reason.length > 0 && reason.length <= 100;
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';

  var cleaned = phone.replace(/[-\s]/g, '');

  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  } else if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  return phone;
}

/**
 * Validate amount (positive integer)
 */
function validateAmount(amount) {
  var num = parseInt(amount);
  return !isNaN(num) && num > 0 && num <= 1000000;
}

/**
 * Validate date for booking (past check, 90-day limit, Sunday check)
 * @param {string} parsedDate - YYYY-MM-DD format date string
 * @returns {{ valid: boolean, errorMessage: string|null }}
 */
function validateDateForBooking(parsedDate) {
  var tz = 'Asia/Tokyo';
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var maxDate = new Date(todayStr + 'T00:00:00+09:00');
  maxDate.setDate(maxDate.getDate() + 90);
  var maxDateStr = Utilities.formatDate(maxDate, tz, 'yyyy-MM-dd');

  if (parsedDate < todayStr) {
    return { valid: false, errorMessage: '過去の日付は選択できません。別の日を選択してください。' };
  }
  if (parsedDate > maxDateStr) {
    return { valid: false, errorMessage: '予約は90日以内のみ可能です。' };
  }

  var bookingDate = new Date(parsedDate + 'T12:00:00+09:00');
  if (bookingDate.getDay() === 0) {
    return { valid: false, errorMessage: '日曜日は休業日です。別の日を選択してください。' };
  }

  return { valid: true, errorMessage: null };
}
