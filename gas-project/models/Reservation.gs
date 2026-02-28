/**
 * Reservation Model
 *
 * Data model for reservation object
 */

/**
 * Create reservation object from data
 */
function createReservationObject(data) {
  return {
    id: data.reservation_id,
    created_at: data.created_at,
    patient_name: data.patient_name,
    phone: data.phone,
    line_display_name: data.line_display_name,
    visit_type: data.visit_type,
    menu_type: data.menu_type,
    reserved_date: data.reserved_date,
    reserved_start: data.reserved_start,
    reserved_end: data.reserved_end,
    status: data.status,
    deposit_required: data.deposit_required,
    deposit_amount: data.deposit_amount,
    deposit_status: data.deposit_status,
    reminder_sent: data.reminder_sent,
    reminder_response: data.reminder_response,
    cancel_time: data.cancel_time,
    resale_notified: data.resale_notified,
    resale_success: data.resale_success,
    average_unit_price: data.average_unit_price,
    notes: data.notes
  };
}

/**
 * Validate reservation data
 */
function validateReservationData(data) {
  var errors = [];

  if (!data.patient_name || data.patient_name.trim() === '') {
    errors.push('患者名を入力してください。');
  }

  if (!data.phone || !validatePhoneNumber(data.phone)) {
    errors.push('電話番号の形式が正しくありません。');
  }

  if (!data.reserved_date || !validateDate(data.reserved_date)) {
    errors.push('日付の形式が正しくありません。');
  }

  if (!data.reserved_start || !validateTime(data.reserved_start)) {
    errors.push('時間の形式が正しくありません。');
  }

  if (!data.menu_type || data.menu_type.trim() === '') {
    errors.push('施術の種類を選択してください。');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Check if reservation can be cancelled
 */
function canCancelReservation(reservation) {
  if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    return {canCancel: false, reason: '既にキャンセルされています。'};
  }

  if (reservation.status === RESERVATION_STATUS.VISITED) {
    return {canCancel: false, reason: '既に来院されています。'};
  }

  if (reservation.status === RESERVATION_STATUS.NO_SHOW) {
    return {canCancel: false, reason: '無断キャンセルとなっています。'};
  }

  // Check deadline
  var now = new Date();
  var reservedDateTime = new Date(reservation.reserved_date + 'T' + reservation.reserved_start + ':00');
  var hoursUntilReservation = (reservedDateTime - now) / (1000 * 60 * 60);
  var deadlineHours = getCancellationDeadlineHours();

  if (hoursUntilReservation < deadlineHours) {
    return {
      canCancel: false,
      reason: 'キャンセル締切（' + deadlineHours + '時間前）を過ぎています。'
    };
  }

  return {canCancel: true, reason: ''};
}

/**
 * Calculate no-show penalty
 */
function calculateNoShowPenalty(reservation) {
  var userReservations = getReservationsByPatient(reservation.phone);

  var noShowCount = 0;
  for (var i = 0; i < userReservations.length; i++) {
    if (userReservations[i].status === RESERVATION_STATUS.NO_SHOW) {
      noShowCount++;
    }
  }

  if (noShowCount >= getNoShowThreshold()) {
    return {
      isRepeatOffender: true,
      penaltyAmount: getNoShowDepositAmount()
    };
  }

  return {
    isRepeatOffender: false,
    penaltyAmount: getDepositAmount()
  };
}

/**
 * Format reservation for display
 */
function formatReservationForDisplay(reservation) {
  return '【予約ID】 ' + reservation.id + '\n' +
    '【氏名】 ' + reservation.patient_name + '\n' +
    '【電話】 ' + reservation.phone + '\n' +
    '【タイプ】 ' + (reservation.visit_type === VISIT_TYPE.FIRST ? '初診' : '再診') + '\n' +
    '【施術】 ' + reservation.menu_type + '\n' +
    '【日時】 ' + reservation.reserved_date + ' ' + reservation.reserved_start + '\n' +
    '【ステータス】 ' + reservation.status + '\n' +
    '【デポジット】 ' + reservation.deposit_status;
}

/**
 * Get reservation duration in minutes
 */
function getReservationDuration(reservation) {
  var startParts = reservation.reserved_start.split(':');
  var endParts = reservation.reserved_end.split(':');

  var startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  var endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

  return endMinutes - startMinutes;
}
