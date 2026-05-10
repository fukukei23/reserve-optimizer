/**
 * Change Handler
 *
 * Handles reservation change flow: select → field → date/time/treatment → confirm
 */

/**
 * Handle change flow - search reservations by LINE userId
 * Shows max 5 reservations at a time with pagination
 */
function handleChangeFlow(replyToken, userId) {
  var reservations = getReservationsByLineUserId(userId);

  if (reservations.length === 0) {
    sendLineReply(replyToken, MessageTemplates.getNoChangeableReservationsMessage());
    return;
  }

  if (reservations.length === 1) {
    var r = reservations[0];
    setUserState(userId, USER_STATES.AWAITING_CHANGE_FIELD, {
      selected_reservation_id: r.id
    });
    sendQuickReply(replyToken, MessageTemplates.getChangeFieldSelectMessage(r), [
      { label: '📅 日付', text: '日付' },
      { label: '🕐 時間', text: '時間' },
      { label: '💆 施術', text: '施術' },
      { label: '🗑️ 予約をキャンセル', text: '予約をキャンセル' },
      { label: '✖️ 変更をやめる', text: 'やめる' }
    ]);
    return;
  }

  // Multiple reservations — show paginated list (max 5 at a time)
  var allIds = reservations.map(function(r) { return r.id; });
  var page = 0;
  var pageSize = 5;
  var pageIds = allIds.slice(0, pageSize);
  var pageReservations = reservations.slice(0, pageSize);

  setUserState(userId, USER_STATES.AWAITING_CHANGE_SELECT, {
    reservation_ids: allIds,
    page: page,
    page_size: pageSize
  });

  var msg = MessageTemplates.getChangeListMessage(pageReservations, page, Math.ceil(allIds.length / pageSize));
  var items = [];
  for (var i = 0; i < pageReservations.length; i++) {
    items.push({ label: String(i + 1), text: String(i + 1) });
  }
  if (allIds.length > pageSize) {
    var totalP = Math.ceil(allIds.length / pageSize);
    items.push({ label: '次の5件 ▶ (2/' + totalP + ')', text: '次の5件' });
  }
  items.push({ label: 'やめる', text: 'やめる' });
  sendQuickReply(replyToken, msg, items);
}

/**
 * Handle awaiting change select (user picks a reservation from the list)
 */
function handleAwaitingChangeSelect(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  var reservationIds = tempData.reservation_ids || [];
  var page = tempData.page || 0;
  var pageSize = tempData.page_size || 5;

  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, '変更を中止しました。');
    return;
  }

  // Handle pagination
  if (handlePaginationStep(text, replyToken, userId, tempData, reservationIds, page, pageSize,
      MessageTemplates.getChangeListMessage, USER_STATES.AWAITING_CHANGE_SELECT)) {
    return;
  }

  var selection = parseInt(text);
  var currentStartIdx = page * pageSize;

  if (isNaN(selection) || selection < 1 || selection > pageSize || (currentStartIdx + selection - 1) >= reservationIds.length) {
    var errorItems = [];
    var maxOnPage = Math.min(pageSize, reservationIds.length - currentStartIdx);
    for (var ei = 0; ei < maxOnPage; ei++) {
      errorItems.push({ label: String(ei + 1), text: String(ei + 1) });
    }
    errorItems.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, '番号を選択してください（1〜' + maxOnPage + '）。', errorItems);
    return;
  }

  var selectedId = reservationIds[currentStartIdx + selection - 1];
  var reservation = getReservationById(selectedId);

  if (!reservation) {
    clearUserState(userId);
    sendLineReply(replyToken, '予約が見つかりませんでした。最初からやり直してください。');
    return;
  }

  setUserState(userId, USER_STATES.AWAITING_CHANGE_FIELD, {
    selected_reservation_id: selectedId
  });
  sendQuickReply(replyToken, MessageTemplates.getChangeFieldSelectMessage(reservation), [
    { label: '📅 日付', text: '日付' },
    { label: '🕐 時間', text: '時間' },
    { label: '💆 施術', text: '施術' },
    { label: '🔙 戻る', text: '戻る' }
  ]);
}

/**
 * Handle awaiting change field selection (date / time / treatment)
 */
function handleAwaitingChangeField(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  var reservationId = tempData.selected_reservation_id;

  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, '変更を中止しました。');
    return;
  }

  if (text === '予約をキャンセル' || text === 'キャンセル') {
    var reservationToCancel = getReservationById(reservationId);
    if (!reservationToCancel) {
      clearUserState(userId);
      sendLineReply(replyToken, '予約が見つかりませんでした。');
      return;
    }
    var cancelCheck = canCancelReservation(reservationToCancel);
    if (!cancelCheck.canCancel) {
      clearUserState(userId);
      sendLineReply(replyToken, cancelCheck.reason);
      return;
    }
    setUserState(userId, USER_STATES.AWAITING_CANCEL_CONFIRM, {
      selected_reservation_id: reservationId
    });
    sendQuickReply(replyToken, MessageTemplates.getCancelConfirmMessage(reservationToCancel), [
      { label: 'はい、キャンセルする', text: 'はい' },
      { label: 'いいえ、やめる', text: 'いいえ' }
    ]);
    return;
  }

  if (text === '日付') {
    setUserState(userId, USER_STATES.AWAITING_CHANGE_DATE, tempData);
    sendDatePromptWithQuickReply(replyToken, userId);
    return;
  }

  if (text === '時間') {
    setUserState(userId, USER_STATES.AWAITING_CHANGE_TIME, tempData);
    // Show available slots for the reservation's date
    var reservationForTime = getReservationById(tempData.selected_reservation_id);
    if (reservationForTime) {
      sendTimePromptWithQuickReply(replyToken, reservationForTime.reserved_date);
    } else {
      sendTimePromptWithQuickReply(replyToken);
    }
    return;
  }

  if (text === '施術') {
    setUserState(userId, USER_STATES.AWAITING_CHANGE_TREATMENT, tempData);
    var menuOptions = ['初診（30分）', '再診（30分）', '再診（60分）'];
    sendQuickReply(replyToken, '施術の種類を選択してください。', menuOptions.map(function(opt) {
      return { label: opt, text: opt };
    }).concat([{ label: 'やめる', text: 'やめる' }]));
    return;
  }

  // Invalid input — re-show field selection
  var reservation = getReservationById(reservationId);
  if (reservation) {
    sendQuickReply(replyToken, MessageTemplates.getChangeFieldSelectMessage(reservation), [
      { label: '📅 日付', text: '日付' },
      { label: '🕐 時間', text: '時間' },
      { label: '💆 施術', text: '施術' },
      { label: '🗑️ 予約をキャンセル', text: '予約をキャンセル' },
      { label: '✖️ 変更をやめる', text: 'やめる' }
    ]);
  } else {
    clearUserState(userId);
    sendLineReply(replyToken, '予約が見つかりませんでした。');
  }
}

/**
 * Handle awaiting change date
 */
function handleAwaitingChangeDate(text, replyToken, userId) {
  // Handle calendar page navigation
  if (text.indexOf('PAGE_NEXT:') === 0 || text.indexOf('PAGE_PREV:') === 0) {
    var navDate = text.split(':')[1];
    sendDatePromptWithQuickReply(replyToken, userId, navDate);
    return;
  }

  // Handle "日付入力" — show free text prompt
  if (text === '日付入力') {
    sendQuickReply(replyToken, '日付を入力してください。（例: 4月25日、5/1、2026-06-01）', [
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  if (text === FALLBACK_RETRY_TEXT || text === '別の日' || text === '別の日を選ぶ') {
    sendDatePromptWithQuickReply(replyToken, userId);
    return;
  }

  var tempData = getUserState(userId).context;
  var parsedDate = parseDateInput(text);

  if (!parsedDate) {
    sendFallbackWithContact(replyToken, '日付の形式が正しくありません。もう一度入力してください（例: 4月25日、5/1、2026-06-01）。');
    return;
  }

  var dateValidation = validateDateForBooking(parsedDate);
  if (!dateValidation.valid) {
    sendFallbackWithContact(replyToken, dateValidation.errorMessage);
    return;
  }

  tempData.new_date = parsedDate;
  setUserState(userId, USER_STATES.AWAITING_CHANGE_CONFIRM, tempData);

  var reservation = getReservationById(tempData.selected_reservation_id);
  sendQuickReply(replyToken, MessageTemplates.getChangeConfirmMessage(reservation, '日付', parsedDate), [
    { label: 'はい', text: 'はい' },
    { label: 'いいえ', text: 'いいえ' }
  ]);
}

/**
 * Handle awaiting change time
 */
function handleAwaitingChangeTime(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT || text === '別の時間') {
    var tempDataCT = getUserState(userId).context;
    var resCT = getReservationById(tempDataCT.selected_reservation_id);
    var dateForPicker = tempDataCT.new_date || (resCT ? resCT.reserved_date : null);
    sendTimePromptWithQuickReply(replyToken, dateForPicker);
    return;
  }

  var tempData = getUserState(userId).context;
  var normalized = normalizeTimeInput(text);

  if (!validateTime(normalized)) {
    sendFallbackWithContact(replyToken, '時間の形式が正しくありません。もう一度入力してください（例: 10:00 または 10時）。');
    return;
  }

  // Check 初診/再診 time ordering (再診 must be after 初診 on same day)
  var reservationForOrder = getReservationById(tempData.selected_reservation_id);
  if (reservationForOrder) {
    var checkDate = tempData.new_date || reservationForOrder.reserved_date;
    var changeOrderResult = validateTreatmentTimeOrdering(userId, checkDate, normalized, reservationForOrder.menu_type, tempData.selected_reservation_id);
    if (!changeOrderResult.valid) {
      sendFallbackWithContact(replyToken, changeOrderResult.reason);
      return;
    }
  }

  tempData.new_time = normalized;
  setUserState(userId, USER_STATES.AWAITING_CHANGE_CONFIRM, tempData);

  var reservation = getReservationById(tempData.selected_reservation_id);
  var duration = getTreatmentDuration(reservation.menu_type);

  if (tempData.new_date) {
    // Combined date+time change confirmation
    var confirmMsg = '以下の内容で変更します。\n\n日付: ' + tempData.new_date + '\n時間: ' + normalized + ' - ' + calculateEndTime(normalized, duration) + '\n\nよろしいですか？';
    sendQuickReply(replyToken, confirmMsg, [
      { label: 'はい', text: 'はい' },
      { label: 'いいえ', text: 'いいえ' }
    ]);
  } else {
    sendQuickReply(replyToken, MessageTemplates.getChangeConfirmMessage(reservation, '時間', normalized + ' - ' + calculateEndTime(normalized, duration)), [
      { label: 'はい', text: 'はい' },
      { label: 'いいえ', text: 'いいえ' }
    ]);
  }
}

/**
 * Handle awaiting change treatment
 */
function handleAwaitingChangeTreatment(text, replyToken, userId) {
  var tempData = getUserState(userId).context;

  var validOptions = ['初診（30分）', '再診（30分）', '再診（60分）'];
  var found = false;
  for (var i = 0; i < validOptions.length; i++) {
    if (text === validOptions[i]) { found = true; break; }
  }

  if (!found) {
    sendFallbackWithContact(replyToken, '施術の種類を選択してください。');
    return;
  }

  tempData.new_treatment = text;
  setUserState(userId, USER_STATES.AWAITING_CHANGE_CONFIRM, tempData);

  var reservation = getReservationById(tempData.selected_reservation_id);
  sendQuickReply(replyToken, MessageTemplates.getChangeConfirmMessage(reservation, '施術', text), [
    { label: 'はい', text: 'はい' },
    { label: 'いいえ', text: 'いいえ' }
  ]);
}

/**
 * Handle awaiting change confirm
 */
function handleAwaitingChangeConfirm(text, replyToken, userId) {
  var confirmResult = handleYesNoConfirm(text, replyToken);
  if (confirmResult.confirmed === false) {
    clearUserState(userId);
    sendLineReply(replyToken, '変更を中止しました。');
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

  // Date change: also prompt for time on the new date
  if (tempData.new_date && !tempData.new_time) {
    setUserState(userId, USER_STATES.AWAITING_CHANGE_TIME, tempData);
    sendTimePromptWithQuickReply(replyToken, tempData.new_date);
    return;
  }

  // Build update object (supports multiple field changes)
  var updates = {};
  var changeLabel = '';

  if (tempData.new_date) {
    updates.reserved_date = tempData.new_date;
    changeLabel += '日付 → ' + tempData.new_date;
  }
  if (tempData.new_time) {
    var duration = getTreatmentDuration(reservation.menu_type);
    updates.reserved_start = tempData.new_time;
    updates.reserved_end = calculateEndTime(tempData.new_time, duration);
    if (changeLabel) changeLabel += ', ';
    changeLabel += '時間 → ' + tempData.new_time + ' - ' + updates.reserved_end;
  }
  if (tempData.new_treatment) {
    updates.menu_type = tempData.new_treatment;
    updates.visit_type = tempData.new_treatment.includes('初診') ? VISIT_TYPE.FIRST : VISIT_TYPE.REPEAT;
    if (changeLabel) changeLabel += ', ';
    changeLabel += '施術 → ' + tempData.new_treatment;
  }

  updateReservation(reservationId, updates);

  // Re-read to get updated values
  var updated = getReservationById(reservationId);

  clearUserState(userId);
  sendLineReply(replyToken, MessageTemplates.getChangeCompletedMessage(updated, changeLabel));
  appendLogRow('INFO', 'Reservation changed: ' + reservationId + ' ' + changeLabel);
}
