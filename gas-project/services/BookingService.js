/**
 * Booking Service - Conflict Detection & Auto-Cancellation
 *
 * Handles booking slot conflict detection and expired unpaid reservation cleanup
 */

/**
 * Get booked slot counts for a specific date
 * Returns {timeString: count} for active reservations (Pending/Confirmed)
 */
function getBookedSlotsForDate(date) {
  _ensureReservationCache();
  var slots = {};
  var dateReservations = _reservationsByDateMap[date] || [];
  for (var i = 0; i < dateReservations.length; i++) {
    var r = dateReservations[i];
    if (r.status === RESERVATION_STATUS.PENDING || r.status === RESERVATION_STATUS.CONFIRMED) {
      if (r.reserved_start) {
        slots[r.reserved_start] = (slots[r.reserved_start] || 0) + 1;
      }
    }
  }
  return slots;
}

/**
 * Cancel expired unpaid reservations (3 hours threshold)
 * Called by time-based trigger every 30 minutes
 */
function cancelExpiredUnpaidReservations() {
  var UNPAID_EXPIRE_MS = 3 * 60 * 60 * 1000; // 3 hours
  var now = new Date();

  _ensureReservationCache();
  var cancelled = 0;

  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];
    if (r.status !== RESERVATION_STATUS.PENDING) continue;
    if (r.deposit_status !== DEPOSIT_STATUS.UNPAID && r.deposit_status !== DEPOSIT_STATUS.PENDING) continue;

    var created = new Date(r.created_at);
    if (isNaN(created.getTime())) continue;

    if (now.getTime() - created.getTime() > UNPAID_EXPIRE_MS) {
      updateReservation(r.id, {
        status: RESERVATION_STATUS.CANCELLED,
        cancel_time: now.toISOString(),
        notes: 'Auto-cancelled: unpaid for 3 hours'
      });

      try {
        sendLinePush(r.line_display_name,
          '予約 ' + r.id + '（' + r.reserved_date + ' ' + r.reserved_start + '）はお支払いが確認できなかったため自動キャンセルされました。\n\n再度「予約する」からお試しください。');
      } catch (pushErr) {
        appendLogRow('ERROR', 'Auto-cancel notification failed: ' + pushErr.message);
      }

      appendLogRow('INFO', 'Auto-cancelled unpaid reservation: ' + r.id);
      cancelled++;
    }
  }

  if (cancelled > 0) {
    appendLogRow('INFO', 'Auto-cancelled ' + cancelled + ' expired unpaid reservations');
  }
}
