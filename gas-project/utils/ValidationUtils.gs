/**
 * Validation Utils - Input Validation
 *
 * Helper functions for validating user input
 */

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
