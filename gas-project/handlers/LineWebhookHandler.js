/**
 * LINE Webhook Handler
 *
 * Handles LINE message events and manages conversation state
 */

// Conversation states
var USER_STATES = {
  IDLE: 'IDLE',
  AWAITING_NAME: 'AWAITING_NAME',
  AWAITING_PHONE: 'AWAITING_PHONE',
  AWAITING_DATE: 'AWAITING_DATE',
  AWAITING_TIME: 'AWAITING_TIME',
  AWAITING_TREATMENT: 'AWAITING_TREATMENT',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  AWAITING_CANCEL_SELECT: 'AWAITING_CANCEL_SELECT',
  AWAITING_CANCEL_CONFIRM: 'AWAITING_CANCEL_CONFIRM',
  AWAITING_CHANGE_SELECT: 'AWAITING_CHANGE_SELECT',
  AWAITING_CHANGE_FIELD: 'AWAITING_CHANGE_FIELD',
  AWAITING_CHANGE_DATE: 'AWAITING_CHANGE_DATE',
  AWAITING_CHANGE_TIME: 'AWAITING_CHANGE_TIME',
  AWAITING_CHANGE_TREATMENT: 'AWAITING_CHANGE_TREATMENT',
  AWAITING_CHANGE_CONFIRM: 'AWAITING_CHANGE_CONFIRM'
};

// Temporary data storage (24-hour TTL)
var TEMP_DATA_KEY_PREFIX = 'user_temp_';

// Fixed labels for fallback quick replies (same text is sent when tapped)
var FALLBACK_RETRY_TEXT = 'もう一度入力する';
var FALLBACK_CONTACT_TEXT = '人間に問い合わせる';

/**
 * Send error message with fallback quick replies (もう一度入力する / 人間に問い合わせる)
 */
function sendFallbackWithContact(replyToken, errorMessage) {
  var items = [
    { label: FALLBACK_RETRY_TEXT, text: FALLBACK_RETRY_TEXT },
    { label: FALLBACK_CONTACT_TEXT, text: FALLBACK_CONTACT_TEXT }
  ];
  sendQuickReply(replyToken, errorMessage, items);
}

/**
 * Handle LINE webhook event
 */
function handleLineEvent(event) {
  var eventType = event.type;
  var source = event.source;
  var userId = source.userId;
  var replyToken = event.replyToken;

  switch (eventType) {
    case 'message':
      handleMessage(event.message, replyToken, userId);
      break;
    case 'follow':
      handleFollow(userId);
      break;
    case 'unfollow':
      handleUnfollow(userId);
      break;
    default:
      Logger.log('Unhandled event type: ' + eventType);
  }
}

/**
 * Handle message event
 */
function handleMessage(message, replyToken, userId) {
  var messageType = message.type;

  if (messageType !== 'text') {
    return;
  }

  var text = message.text.trim();
  var userState = getUserState(userId);

  logLineMessage({userId: userId}, text);

  // Handle "人間に問い合わせる" regardless of state (so it is not validated as name/phone/date/time)
  if (text === '人間に問い合わせる') {
    sendLineReply(replyToken, MessageTemplates.getContactMessage());
    clearUserState(userId);
    return;
  }

  // Check for commands
  if (text.startsWith('/')) {
    handleCommand(text, replyToken, userId);
    return;
  }

  // Route based on current state
  switch (userState.state) {
    case USER_STATES.IDLE:
      handleIdleState(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_NAME:
      handleAwaitingName(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_PHONE:
      handleAwaitingPhone(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_DATE:
      handleAwaitingDate(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_TIME:
      handleAwaitingTime(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_TREATMENT:
      handleAwaitingTreatment(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_PAYMENT:
      handleAwaitingPayment(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_CANCEL_SELECT:
      handleAwaitingCancelSelect(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_CANCEL_CONFIRM:
      handleAwaitingCancelConfirm(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_CHANGE_SELECT:
      handleAwaitingChangeSelect(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_CHANGE_FIELD:
      handleAwaitingChangeField(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_CHANGE_DATE:
      handleAwaitingChangeDate(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_CHANGE_TIME:
      handleAwaitingChangeTime(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_CHANGE_TREATMENT:
      handleAwaitingChangeTreatment(text, replyToken, userId);
      break;
    case USER_STATES.AWAITING_CHANGE_CONFIRM:
      handleAwaitingChangeConfirm(text, replyToken, userId);
      break;
    default:
      sendLineReply(replyToken, '何かお手伝いしましょうか？');
  }
}

/**
 * Handle command messages
 */
function handleCommand(command, replyToken, userId) {
  switch (command) {
    case '/reserve':
      startReservationFlow(replyToken, userId);
      break;
    case '/change':
      handleChangeFlow(replyToken, userId);
      break;
    case '/cancel':
      handleCancelFlow(replyToken, userId);
      break;
    case '/waitlist':
      handleWaitlistFlow(replyToken, userId);
      break;
    default:
      sendLineReply(replyToken, '無効なコマンドです。/reserve, /change, /cancel, /waitlist のいずれかを使用してください。');
  }
}

/**
 * Start reservation flow
 */
function startReservationFlow(replyToken, userId) {
  setUserState(userId, USER_STATES.AWAITING_NAME, {});
  sendLineReply(replyToken, '予約を開始します。\n\nお名前を入力してください。');
}

/**
 * Handle idle state
 */
function handleIdleState(text, replyToken, userId) {
  // Check for quick replies or menu selections
  if (text === '予約する') {
    startReservationFlow(replyToken, userId);
  } else if (text === '予約変更・キャンセル') {
    handleChangeFlow(replyToken, userId);
  } else if (text === '当日空き枠通知を受け取る') {
    handleWaitlistFlow(replyToken, userId);
  } else {
    var message = MessageTemplates.getWelcomeMessage();
    sendLineReply(replyToken, message);
  }
}

/**
 * Handle awaiting name
 */
function handleAwaitingName(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT) {
    sendLineReply(replyToken, 'お名前を入力してください。');
    return;
  }

  var trimmed = text.trim();
  if (!trimmed || trimmed.length > 100) {
    sendFallbackWithContact(replyToken, 'お名前を入力してください。\n（100文字以内でご入力ください）');
    return;
  }

  var tempData = getUserState(userId).context;
  tempData.patient_name = trimmed;

  setUserState(userId, USER_STATES.AWAITING_PHONE, tempData);
  sendLineReply(replyToken, 'お名前を確認しました。\n\n電話番号を入力してください（例: 09012345678）。');
}

/**
 * Handle awaiting phone
 */
function handleAwaitingPhone(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT) {
    sendLineReply(replyToken, '電話番号を入力してください（例: 09012345678）。');
    return;
  }

  var tempData = getUserState(userId).context;
  var normalized = normalizePhoneInput(text);
  if (!validatePhoneNumber(normalized)) {
    sendFallbackWithContact(replyToken, '電話番号の形式が正しくありません。もう一度入力してください（例: 09012345678 または 090-1234-5678）。');
    return;
  }

  tempData.phone = normalized;

  setUserState(userId, USER_STATES.AWAITING_DATE, tempData);
  sendDatePromptWithQuickReply(replyToken, userId);
}

/**
 * Send date prompt with quick reply (今日 / 明日 / 明後日 / 来週月曜 ...)
 */
function sendDatePromptWithQuickReply(replyToken, userId) {
  var dateOptions = [
    { label: '今日', text: '今日' },
    { label: '明日', text: '明日' },
    { label: '明後日', text: '明後日' },
    { label: '来週月曜', text: '来週月曜' },
    { label: '来週火曜', text: '来週火曜' },
    { label: '来週水曜', text: '来週水曜' },
    { label: '来週木曜', text: '来週木曜' },
    { label: '来週金曜', text: '来週金曜' },
    { label: '来週土曜', text: '来週土曜' },
    { label: '来週日曜', text: '来週日曜' }
  ];
  sendQuickReply(replyToken, '希望日を入力してください（例: 今日、明日、来週月曜、または 2026-02-20）。下のボタンから選ぶか、日付を入力してください。', dateOptions);
}

/**
 * Handle awaiting date
 */
function handleAwaitingDate(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT) {
    sendDatePromptWithQuickReply(replyToken, userId);
    return;
  }

  var tempData = getUserState(userId).context;

  var parsedDate = parseDateInput(text);
  if (!parsedDate) {
    sendFallbackWithContact(replyToken, '日付の形式が正しくありません。もう一度入力してください（例: 今日、明日、来週月曜、または 2026-02-20）。');
    return;
  }

  tempData.reserved_date = parsedDate;

  setUserState(userId, USER_STATES.AWAITING_TIME, tempData);
  sendTimePromptWithQuickReply(replyToken);
}

/**
 * Send time prompt with quick reply (9:00, 9:30, ... 17:00)
 */
function sendTimePromptWithQuickReply(replyToken) {
  var timeOptions = [
    '9:00', '9:30', '10:00', '10:30', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ].map(function(t) { return { label: t, text: t }; });
  sendQuickReply(replyToken, '希望時間を入力してください（例: 10:00 または 10時）。下のボタンから選ぶか、時刻を入力してください。', timeOptions);
}

/**
 * Handle awaiting time
 */
function handleAwaitingTime(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT) {
    sendTimePromptWithQuickReply(replyToken);
    return;
  }

  var tempData = getUserState(userId).context;

  var normalized = normalizeTimeInput(text);
  if (!validateTime(normalized)) {
    sendFallbackWithContact(replyToken, '時間の形式が正しくありません。もう一度入力してください（例: 10:00 または 10時）。');
    return;
  }

  tempData.reserved_start = normalized;
  tempData.reserved_end = calculateEndTime(normalized);

  setUserState(userId, USER_STATES.AWAITING_TREATMENT, tempData);

  var menuOptions = [
    '初診（30分）',
    '再診（30分）',
    '再診（60分）'
  ];

  sendQuickReply(replyToken, '施術の種類を選択してください。', menuOptions.map(function(opt) {
    return {label: opt, text: opt};
  }));
}

/**
 * Handle awaiting treatment
 */
function handleAwaitingTreatment(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  tempData.menu_type = text;

  // Determine visit type
  tempData.visit_type = text.includes('初診') ? VISIT_TYPE.FIRST : VISIT_TYPE.REPEAT;

  // Get LINE profile
  var profile = getLineProfile(userId);
  if (profile) {
    tempData.line_display_name = profile.userId;
  }

  // Create reservation
  var result = createReservation(tempData);

  // Send confirmation with payment link（先にリンク取得してから状態を移す）
  var paymentLink = null;
  try {
    paymentLink = createPaymentLink(
      result.id,
      tempData.patient_name,
      getDepositAmount()
    );
  } catch (e) {
    Logger.log('createPaymentLink error: ' + e.message);
  }

  if (paymentLink) {
    setUserState(userId, USER_STATES.AWAITING_PAYMENT, {
      reservation_id: result.id,
      payment_link: paymentLink  // 再送用に保持
    });
    var message = MessageTemplates.getDepositRequestMessage(
      result.id,
      tempData.reserved_date,
      tempData.reserved_start,
      tempData.menu_type,
      paymentLink
    );
    sendLineReply(replyToken, message);
  } else {
    sendLineReply(replyToken, '決済リンクの作成に失敗しました。管理者にお問い合わせください。');
    clearUserState(userId);
  }
}

/**
 * Handle awaiting payment
 */
function handleAwaitingPayment(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  var reservationId = tempData.reservation_id;
  var storedLink = tempData.payment_link;

  var reservation = getReservationById(reservationId);

  if (reservation && reservation.deposit_status === DEPOSIT_STATUS.PAID) {
    sendLineReply(replyToken, 'お支払いが確認されました。予約が確定しました！');
    clearUserState(userId);
  } else if (storedLink) {
    sendLineReply(replyToken, 'お支払いがまだ完了していません。\n\n下のリンクからデポジットをお支払いください。\n\n' + storedLink + '\n\nお支払い完了後、「支払完了」と返信してください。');
  } else {
    sendLineReply(replyToken, 'デポジットのお支払いがまだです。\n\n支払いリンクが届いていない場合は、管理者にお問い合わせください。');
  }
}

/**
 * Handle change flow - search reservations by LINE userId
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
    sendLineReply(replyToken, MessageTemplates.getChangeFieldSelectMessage(r));
    return;
  }

  // Multiple reservations — show list for selection
  setUserState(userId, USER_STATES.AWAITING_CHANGE_SELECT, {
    reservation_ids: reservations.map(function(r) { return r.id; })
  });
  sendLineReply(replyToken, MessageTemplates.getChangeListMessage(reservations));
}

/**
 * Handle awaiting change select (user picks a reservation from the list)
 */
function handleAwaitingChangeSelect(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  var reservationIds = tempData.reservation_ids || [];
  var selection = parseInt(text);

  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, '変更を中止しました。');
    return;
  }

  if (isNaN(selection) || selection < 1 || selection > reservationIds.length) {
    var items = [];
    for (var i = 0; i < reservationIds.length && i < 13; i++) {
      items.push({ label: String(i + 1), text: String(i + 1) });
    }
    items.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, '番号を選択してください（1〜' + reservationIds.length + '）。', items);
    return;
  }

  var selectedId = reservationIds[selection - 1];
  var reservation = getReservationById(selectedId);

  if (!reservation) {
    clearUserState(userId);
    sendLineReply(replyToken, '予約が見つかりませんでした。最初からやり直してください。');
    return;
  }

  setUserState(userId, USER_STATES.AWAITING_CHANGE_FIELD, {
    selected_reservation_id: selectedId
  });
  sendLineReply(replyToken, MessageTemplates.getChangeFieldSelectMessage(reservation));
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

  if (text === '日付') {
    setUserState(userId, USER_STATES.AWAITING_CHANGE_DATE, tempData);
    sendDatePromptWithQuickReply(replyToken, userId);
    return;
  }

  if (text === '時間') {
    setUserState(userId, USER_STATES.AWAITING_CHANGE_TIME, tempData);
    sendTimePromptWithQuickReply(replyToken);
    return;
  }

  if (text === '施術') {
    setUserState(userId, USER_STATES.AWAITING_CHANGE_TREATMENT, tempData);
    var menuOptions = ['初診（30分）', '再診（30分）', '再診（60分）'];
    sendQuickReply(replyToken, '施術の種類を選択してください。', menuOptions.map(function(opt) {
      return { label: opt, text: opt };
    }));
    return;
  }

  // Invalid input — re-show field selection
  var reservation = getReservationById(reservationId);
  if (reservation) {
    sendLineReply(replyToken, MessageTemplates.getChangeFieldSelectMessage(reservation));
  } else {
    clearUserState(userId);
    sendLineReply(replyToken, '予約が見つかりませんでした。');
  }
}

/**
 * Handle awaiting change date
 */
function handleAwaitingChangeDate(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT) {
    sendDatePromptWithQuickReply(replyToken, userId);
    return;
  }

  var tempData = getUserState(userId).context;
  var parsedDate = parseDateInput(text);

  if (!parsedDate) {
    sendFallbackWithContact(replyToken, '日付の形式が正しくありません。もう一度入力してください（例: 今日、明日、来週月曜、または 2026-02-20）。');
    return;
  }

  tempData.new_date = parsedDate;
  setUserState(userId, USER_STATES.AWAITING_CHANGE_CONFIRM, tempData);

  var reservation = getReservationById(tempData.selected_reservation_id);
  sendLineReply(replyToken, MessageTemplates.getChangeConfirmMessage(reservation, '日付', parsedDate));
}

/**
 * Handle awaiting change time
 */
function handleAwaitingChangeTime(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT) {
    sendTimePromptWithQuickReply(replyToken);
    return;
  }

  var tempData = getUserState(userId).context;
  var normalized = normalizeTimeInput(text);

  if (!validateTime(normalized)) {
    sendFallbackWithContact(replyToken, '時間の形式が正しくありません。もう一度入力してください（例: 10:00 または 10時）。');
    return;
  }

  tempData.new_time = normalized;
  setUserState(userId, USER_STATES.AWAITING_CHANGE_CONFIRM, tempData);

  var reservation = getReservationById(tempData.selected_reservation_id);
  sendLineReply(replyToken, MessageTemplates.getChangeConfirmMessage(reservation, '時間', normalized + ' - ' + calculateEndTime(normalized)));
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
  sendLineReply(replyToken, MessageTemplates.getChangeConfirmMessage(reservation, '施術', text));
}

/**
 * Handle awaiting change confirm
 */
function handleAwaitingChangeConfirm(text, replyToken, userId) {
  if (text === 'やめる' || text === 'いいえ' || text === 'キャンセル') {
    clearUserState(userId);
    sendLineReply(replyToken, '変更を中止しました。');
    return;
  }

  if (text !== 'はい') {
    sendQuickReply(replyToken, '「はい」または「いいえ」で答えてください。', [
      { label: 'はい', text: 'はい' },
      { label: 'いいえ', text: 'いいえ' }
    ]);
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

  // Build update object
  var updates = {};
  var changeLabel = '';

  if (tempData.new_date) {
    updates.reserved_date = tempData.new_date;
    changeLabel = '日付 → ' + tempData.new_date;
  } else if (tempData.new_time) {
    updates.reserved_start = tempData.new_time;
    updates.reserved_end = calculateEndTime(tempData.new_time);
    changeLabel = '時間 → ' + tempData.new_time + ' - ' + updates.reserved_end;
  } else if (tempData.new_treatment) {
    updates.menu_type = tempData.new_treatment;
    updates.visit_type = tempData.new_treatment.includes('初診') ? VISIT_TYPE.FIRST : VISIT_TYPE.REPEAT;
    changeLabel = '施術 → ' + tempData.new_treatment;
  }

  updateReservation(reservationId, updates);

  // Re-read to get updated values
  var updated = getReservationById(reservationId);

  clearUserState(userId);
  sendLineReply(replyToken, MessageTemplates.getChangeCompletedMessage(updated, changeLabel));
  appendLogRow('INFO', 'Reservation changed: ' + reservationId + ' ' + changeLabel);
}

/**
 * Handle cancel flow - search reservations by LINE userId
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
    sendLineReply(replyToken, MessageTemplates.getCancelConfirmMessage(r));
    return;
  }

  // Multiple reservations — show list for selection
  setUserState(userId, USER_STATES.AWAITING_CANCEL_SELECT, {
    reservation_ids: activeReservations.map(function(r) { return r.id; })
  });
  sendLineReply(replyToken, MessageTemplates.getCancelListMessage(activeReservations));
}

/**
 * Handle awaiting cancel select (user picks a reservation from the list)
 */
function handleAwaitingCancelSelect(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  var reservationIds = tempData.reservation_ids || [];
  var selection = parseInt(text);

  if (isNaN(selection) || selection < 1 || selection > reservationIds.length) {
    var items = [];
    for (var i = 0; i < reservationIds.length && i < 13; i++) {
      var num = String(i + 1);
      items.push({ label: num, text: num });
    }
    items.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, '番号を選択してください（1〜' + reservationIds.length + '）。', items);
    return;
  }

  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, 'キャンセルを中止しました。');
    return;
  }

  var selectedId = reservationIds[selection - 1];
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
  sendLineReply(replyToken, MessageTemplates.getCancelConfirmMessage(reservation));
}

/**
 * Handle awaiting cancel confirm (user confirms or cancels)
 */
function handleAwaitingCancelConfirm(text, replyToken, userId) {
  if (text === 'やめる' || text === 'いいえ' || text === 'キャンセル') {
    clearUserState(userId);
    sendLineReply(replyToken, 'キャンセルを中止しました。');
    return;
  }

  if (text !== 'はい') {
    sendQuickReply(replyToken, '「はい」または「いいえ」で答えてください。', [
      { label: 'はい', text: 'はい' },
      { label: 'いいえ', text: 'いいえ' }
    ]);
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

/**
 * Handle waitlist flow
 */
function handleWaitlistFlow(replyToken, userId) {
  // TODO: Implement waitlist registration flow
  sendLineReply(replyToken, '待機リスト登録機能は準備中です。');
}

/**
 * Handle follow event
 */
function handleFollow(userId) {
  var profile = getLineProfile(userId);
  var displayName = profile ? profile.displayName : '患者さん';

  Logger.log('User followed: ' + userId + ' (' + displayName + ')');

  var message = MessageTemplates.getWelcomeMessage();
  sendLinePush(userId, message);
}

/**
 * Handle unfollow event
 */
function handleUnfollow(userId) {
  Logger.log('User unfollowed: ' + userId);
  clearUserState(userId);
}

/**
 * Set user state with temporary data
 */
function setUserState(userId, state, context) {
  var key = TEMP_DATA_KEY_PREFIX + userId;
  var data = {
    state: state,
    context: context || {},
    timestamp: Date.now()
  };

  PropertiesService.getUserProperties().setProperty(key, JSON.stringify(data));
}

/**
 * Get user state
 */
function getUserState(userId) {
  var key = TEMP_DATA_KEY_PREFIX + userId;
  var data = PropertiesService.getUserProperties().getProperty(key);

  if (!data) {
    return {state: USER_STATES.IDLE, context: {}};
  }

  var parsed = JSON.parse(data);

  // Check TTL (24 hours)
  if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
    clearUserState(userId);
    return {state: USER_STATES.IDLE, context: {}};
  }

  return parsed;
}

/**
 * Clear user state
 */
function clearUserState(userId) {
  var key = TEMP_DATA_KEY_PREFIX + userId;
  PropertiesService.getUserProperties().deleteProperty(key);
}

/**
 * Parse date input (YYYY-MM-DD, MM/DD/YYYY, 今日, 明日, 明後日, 来週月曜...)
 */
function parseDateInput(text) {
  if (!text || typeof text !== 'string') return null;
  var s = text.trim();

  var patterns = [
    /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/   // YYYY/MM/DD
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = s.match(patterns[i]);
    if (match) {
      return match[0].indexOf('-') !== -1 ? match[0] : formatDateFromMatch(match, patterns[i]);
    }
  }

  var tz = 'Asia/Tokyo';
  var now = new Date();
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

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

function formatDateFromMatch(match, pattern) {
  var str = match[0];
  if (str.indexOf('-') !== -1 && str.length >= 10) return str;
  var parts = str.split('/');
  if (parts.length !== 3) return str;
  var y, m, d;
  if (parts[0].length === 4) {
    y = parts[0];
    m = parts[1].length === 1 ? '0' + parts[1] : parts[1];
    d = parts[2].length === 1 ? '0' + parts[2] : parts[2];
  } else {
    y = parts[2];
    m = parts[0].length === 1 ? '0' + parts[0] : parts[0];
    d = parts[1].length === 1 ? '0' + parts[1] : parts[1];
  }
  return y + '-' + m + '-' + d;
}

function addDaysToDateStr(dateStr, days) {
  var d = new Date(dateStr + 'T12:00:00+09:00');
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
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
