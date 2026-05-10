/**
 * Cancel Handler
 *
 * Handles reservation cancellation flow: select → confirm → execute
 */

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
  var pageSize = 5;
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
    items.push({ label: '次の5件 ▶', text: '次の5件' });
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
  var pageSize = tempData.page_size || 5;

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

  if (reservation.deposit_status === DEPOSIT_STATUS.PAID) {
    // Refund via Stripe
    try {
      var refundResult = refundPayment(reservation.id, reservation.deposit_amount);
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
        clearUserState(userId);
        sendLineReply(replyToken, MessageTemplates.getCancelRefundFailedMessage(reservation));
        appendLogRow('ERROR', 'Refund failed for reservation: ' + reservationId);
        return;
      }
    } catch (e) {
      // Refund error — still cancel but notify
      updateReservation(reservationId, {
        status: RESERVATION_STATUS.CANCELLED,
        cancel_time: new Date(),
        notes: 'REFUND_ERROR:' + e.message
      });
      clearUserState(userId);
      sendLineReply(replyToken, MessageTemplates.getCancelRefundFailedMessage(reservation));
      appendLogRow('ERROR', 'Refund error for reservation ' + reservationId + ': ' + e.message);
      return;
    }
  } else {
    // No refund needed (unpaid or already forfeited)
    handleCancellation(reservationId, 'User cancelled via LINE');
  }

  // Notify waitlist candidates about the vacancy
  try {
    var candidates = findWaitlistCandidate(
      reservation.reserved_date + 'T' + reservation.reserved_start
    );
    for (var i = 0; i < candidates.length; i++) {
      var vacancyMsg = MessageTemplates.getResaleNotificationMessage(
        reservation.reserved_date,
        reservation.reserved_start + '-' + reservation.reserved_end,
        reservation.menu_type
      );
      sendLinePush(candidates[i].line_display_name, vacancyMsg);
      appendLogRow('INFO', 'Sent vacancy notification to waitlist: ' + candidates[i].line_display_name);
    }
  } catch (e) {
    appendLogRow('ERROR', 'Waitlist notification error: ' + e.message);
  }

  clearUserState(userId);
  sendLineReply(replyToken, MessageTemplates.getCancelCompletedMessage(reservation, refunded));
  appendLogRow('INFO', 'Reservation cancelled: ' + reservationId + ' Refunded: ' + refunded);
}
