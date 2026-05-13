/**
 * Cancel Handler
 *
 * Handles reservation cancellation flow: select → confirm → execute
 */

/**
 * Check if a reservation can be cancelled
 * @param {object} reservation - Reservation object
 * @returns {{ canCancel: boolean, reason: string }}
 */
function canCancelReservation(reservation) {
  if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    return { canCancel: false, reason: '既にキャンセルされています。' };
  }
  if (reservation.status === RESERVATION_STATUS.VISITED) {
    return { canCancel: false, reason: '既に来院されています。' };
  }
  if (reservation.status === RESERVATION_STATUS.NO_SHOW) {
    return { canCancel: false, reason: '無断キャンセルとなっています。' };
  }

  var now = new Date();
  var reservedDateTime = new Date(reservation.reserved_date + 'T' + reservation.reserved_start + ':00');
  var hoursUntilReservation = (reservedDateTime - now) / (1000 * 60 * 60);
  var deadlineHours = getCancellationDeadlineHours();

  if (hoursUntilReservation < deadlineHours) {
    return { canCancel: false, reason: 'キャンセル締切（' + deadlineHours + '時間前）を過ぎています。' };
  }

  return { canCancel: true, reason: '' };
}

/**
 * Notify waitlist candidates about a vacancy (delegates to WaitlistService)
 */
function _notifyWaitlistVacancy(reservation) {
  notifyWaitlistCandidates(reservation);
}

/**
 * Handle cancel flow - search reservations by LINE userId
 * Shows max 5 cancellable reservations at a time with pagination
 */
function handleCancelFlow(replyToken, userId) {
  // Search active reservations for this LINE user
  var reservations = getReservationsByLineUserId(userId);

  // Filter to cancellable status only (Pending, Confirmed)
  var activeReservations = [];
  for (var i = 0; i < reservations.length; i++) {
    var s = reservations[i].status;
    if (s === RESERVATION_STATUS.PENDING || s === RESERVATION_STATUS.CONFIRMED) {
      activeReservations.push(reservations[i]);
    }
  }

  if (activeReservations.length === 0) {
    sendLineReply(replyToken, MessageTemplates.getNoCancellableReservationsMessage());
    return;
  }

  if (activeReservations.length === 1) {
    // Single reservation — go directly to confirm
    var r = activeReservations[0];
    var cancelCheck = canCancelReservation(r);
    if (!cancelCheck.canCancel) {
      sendLineReply(replyToken, cancelCheck.reason);
      return;
    }
    setUserState(userId, USER_STATES.AWAITING_CANCEL_CONFIRM, {
      selected_reservation_id: r.id
    });
    sendQuickReply(replyToken, MessageTemplates.getCancelConfirmMessage(r), [
      { label: 'はい', text: 'はい' },
      { label: 'いいえ', text: 'いいえ' }
    ]);
    return;
  }

  // Multiple reservations — show paginated list
  var allIds = activeReservations.map(function(r) { return r.id; });
  var pageSize = PAGE_SIZE;
  var pageReservations = activeReservations.slice(0, pageSize);

  setUserState(userId, USER_STATES.AWAITING_CANCEL_SELECT, {
    reservation_ids: allIds,
    page: 0,
    page_size: pageSize
  });

  var msg = MessageTemplates.getCancelListMessage(pageReservations, 0, Math.ceil(allIds.length / pageSize));
  var items = [];
  for (var j = 0; j < pageReservations.length; j++) {
    items.push({ label: String(j + 1), text: String(j + 1) });
  }
  if (allIds.length > pageSize) {
    var totalP = Math.ceil(allIds.length / pageSize);
    items.push({ label: '次の5件 ▶ (2/' + totalP + ')', text: '次の5件' });
  }
  items.push({ label: 'やめる', text: 'やめる' });
  sendQuickReply(replyToken, msg, items);
}

/**
 * Handle awaiting cancel select (user picks a reservation from the list)
 */
function handleAwaitingCancelSelect(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  var reservationIds = tempData.reservation_ids || [];
  var page = tempData.page || 0;
  var pageSize = tempData.page_size || PAGE_SIZE;

  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, 'キャンセルを中止しました。');
    return;
  }

  // Handle pagination
  if (handlePaginationStep(text, replyToken, userId, tempData, reservationIds, page, pageSize,
      MessageTemplates.getCancelListMessage, USER_STATES.AWAITING_CANCEL_SELECT)) {
    return;
  }

  var selection = parseInt(text);
  var currentStartIdx = page * pageSize;

  if (isNaN(selection) || selection < 1 || selection > pageSize || (currentStartIdx + selection - 1) >= reservationIds.length) {
    var errItems = [];
    var maxOnPage = Math.min(pageSize, reservationIds.length - currentStartIdx);
    for (var ei = 0; ei < maxOnPage; ei++) {
      errItems.push({ label: String(ei + 1), text: String(ei + 1) });
    }
    errItems.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, '番号を選択してください（1〜' + maxOnPage + '）。', errItems);
    return;
  }

  var selectedId = reservationIds[currentStartIdx + selection - 1];
  var reservation = getReservationById(selectedId);

  if (!reservation) {
    clearUserState(userId);
    sendLineReply(replyToken, '予約が見つかりませんでした。最初からやり直してください。');
    return;
  }

  // Check deadline
  var cancelCheck = canCancelReservation(reservation);
  if (!cancelCheck.canCancel) {
    clearUserState(userId);
    sendLineReply(replyToken, MessageTemplates.getCancelDeadlineExceededMessage(reservation));
    return;
  }

  setUserState(userId, USER_STATES.AWAITING_CANCEL_CONFIRM, {
    selected_reservation_id: selectedId
  });
  sendQuickReply(replyToken, MessageTemplates.getCancelConfirmMessage(reservation), [
    { label: 'はい', text: 'はい' },
    { label: 'いいえ', text: 'いいえ' }
  ]);
}

/**
 * Handle awaiting cancel confirm (user confirms or cancels)
 */
function handleAwaitingCancelConfirm(text, replyToken, userId) {
  var confirmResult = handleYesNoConfirm(text, replyToken);
  if (confirmResult.confirmed === false) {
    clearUserState(userId);
    sendLineReply(replyToken, 'キャンセルを中止しました。');
    return;
  }
  if (confirmResult.confirmed === null) {
    return;
  }

  var tempData = getUserState(userId).context;
  var reservationId = tempData.selected_reservation_id;
  var reservation = getReservationById(reservationId);

  if (!reservation) {
    clearUserState(userId);
    sendLineReply(replyToken, '予約が見つかりませんでした。');
    return;
  }

  // Re-check deadline (could have changed since selection)
  var cancelCheck = canCancelReservation(reservation);
  if (!cancelCheck.canCancel) {
    clearUserState(userId);
    sendLineReply(replyToken, MessageTemplates.getCancelDeadlineExceededMessage(reservation));
    return;
  }

  // Execute cancellation
  var refunded = false;
  var refundFailed = false;

  if (reservation.deposit_status === DEPOSIT_STATUS.PAID) {
    // Refund via Stripe
    try {
      var refundResult = refundPayment(reservation.payment_intent_id, reservation.deposit_amount);
      if (refundResult) {
        refunded = true;
        updateReservation(reservationId, {
          status: RESERVATION_STATUS.CANCELLED,
          deposit_status: DEPOSIT_STATUS.REFUNDED,
          cancel_time: new Date()
        });
      } else {
        // Refund failed — still cancel but mark deposit issue
        updateReservation(reservationId, {
          status: RESERVATION_STATUS.CANCELLED,
          cancel_time: new Date(),
          notes: 'REFUND_FAILED'
        });
        refundFailed = true;
        appendLogRow('ERROR', 'Refund failed for reservation: ' + reservationId);
      }
    } catch (e) {
      // Refund error — still cancel but mark
      updateReservation(reservationId, {
        status: RESERVATION_STATUS.CANCELLED,
        cancel_time: new Date(),
        notes: 'REFUND_ERROR:' + e.message
      });
      refundFailed = true;
      appendLogRow('ERROR', 'Refund error for reservation ' + reservationId + ': ' + e.message);
    }
  } else {
    // No refund needed (unpaid or already forfeited)
    handleCancellation(reservationId, 'User cancelled via LINE');
  }

  // Notify waitlist candidates about the vacancy (always, regardless of refund outcome)
  _notifyWaitlistVacancy(reservation);

  clearUserState(userId);
  if (refundFailed) {
    sendLineReply(replyToken, MessageTemplates.getCancelRefundFailedMessage(reservation));
  } else {
    sendLineReply(replyToken, MessageTemplates.getCancelCompletedMessage(reservation, refunded));
  }
  appendLogRow('INFO', 'Reservation cancelled: ' + reservationId + ' Refunded: ' + refunded + ' RefundFailed: ' + refundFailed);
}
