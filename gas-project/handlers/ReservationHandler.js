/**
 * Reservation Handler
 *
 * Handles new reservation flow: treatment → date → time → name → phone → payment
 */

/**
 * Start reservation flow (施術選択 → 日付 → 時間 → 名前[初回のみ])
 */
function startReservationFlow(replyToken, userId) {
  // Returning user detection: auto-fill name/phone from last reservation
  var lastReservation = getLastReservationByLineUserId(userId);
  var tempData = {};
  var isReturning = false;

  if (lastReservation && lastReservation.patient_name) {
    tempData.patient_name = lastReservation.patient_name;
    tempData.phone = lastReservation.phone || '';
    isReturning = true;
  }
  tempData.is_returning = isReturning;

  setUserState(userId, USER_STATES.AWAITING_TREATMENT, tempData);

  var menuOptions;
  if (isReturning) {
    menuOptions = [
      { label: '再診（30分）', text: '再診（30分）' },
      { label: '再診（60分）', text: '再診（60分）' },
      { label: 'やめる', text: 'やめる' }
    ];
  } else {
    menuOptions = [
      { label: '初診（30分）', text: '初診（30分）' },
      { label: 'やめる', text: 'やめる' }
    ];
  }
  sendQuickReply(replyToken, '予約を開始します。\n\n施術の種類を選択してください。', menuOptions);
}

/**
 * Handle awaiting name
 */
function handleAwaitingName(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT) {
    sendQuickReply(replyToken, 'お名前を入力してください。', [
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  var trimmed = text.trim();
  if (!trimmed || trimmed.length > 100) {
    sendQuickReply(replyToken, 'お名前を入力してください。\n（100文字以内でご入力ください）', [
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  var tempData = getUserState(userId).context;
  tempData.patient_name = trimmed;

  setUserState(userId, USER_STATES.AWAITING_PHONE, tempData);
  sendQuickReply(replyToken, 'お名前を確認しました。\n\n電話番号を入力してください（例: 09012345678）。', [
    { label: 'やめる', text: 'やめる' }
  ]);
}

/**
 * Handle awaiting phone
 */
function handleAwaitingPhone(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT) {
    sendQuickReply(replyToken, '電話番号を入力してください（例: 09012345678）。', [
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  var tempData = getUserState(userId).context;
  var normalized = normalizePhoneInput(text);
  if (!validatePhoneNumber(normalized)) {
    sendQuickReply(replyToken, '電話番号の形式が正しくありません。もう一度入力してください（例: 09012345678 または 090-1234-5678）。', [
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  tempData.phone = normalized;

  // Phone is the last input before reservation creation
  createReservationAndGoToPayment(replyToken, userId, tempData);
}

/**
 * Handle awaiting date
 */
function handleAwaitingDate(text, replyToken, userId) {
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

  tempData.reserved_date = parsedDate;

  setUserState(userId, USER_STATES.AWAITING_TIME, tempData);
  sendTimePromptWithQuickReply(replyToken, parsedDate);
}

/**
 * Handle awaiting time
 */
function handleAwaitingTime(text, replyToken, userId) {
  if (text === FALLBACK_RETRY_TEXT || text === '別の時間') {
    var tempDataR = getUserState(userId).context;
    sendTimePromptWithQuickReply(replyToken, tempDataR.reserved_date);
    return;
  }

  // "別の日" / "別の日を選ぶ" → 日付選択に戻る（空き枠なし時のQuick Reply用）
  if (text === '別の日' || text === '別の日を選ぶ') {
    var tempDataD = getUserState(userId).context;
    setUserState(userId, USER_STATES.AWAITING_DATE, tempDataD);
    sendDatePromptWithQuickReply(replyToken, userId);
    return;
  }

  var tempData = getUserState(userId).context;

  var normalized = normalizeTimeInput(text);
  if (!validateTime(normalized)) {
    sendFallbackWithContact(replyToken, '時間の形式が正しくありません。もう一度入力してください（例: 10:00 または 10時）。');
    return;
  }

  tempData.reserved_start = normalized;
  var duration = tempData.menu_type === '再診（60分）' ? 60 : 30;
  tempData.reserved_end = calculateEndTime(normalized, duration);

  // Check if this time slot is in the past (with lead time buffer)
  if (isPastDateTime(tempData.reserved_date, normalized, getBookingLeadTimeMinutes())) {
    sendFallbackWithContact(replyToken, 'その時間は予約できません（' + getBookingLeadTimeMinutes() + '分以上前の予約が必要です）。別の時間を選択してください。');
    return;
  }

  // Check if this time slot is already fully booked
  var bookedSlots = getBookedSlotsForDate(tempData.reserved_date);
  var bookedCount = bookedSlots[normalized] || 0;
  if (bookedCount >= getMaxConcurrentBookings()) {
    sendQuickReply(replyToken, '申し訳ございません、' + tempData.reserved_date + ' ' + normalized + 'は既に予約で埋まっています。\n\n別の時間を選択してください。', [
      { label: '別の時間', text: '別の時間' },
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  // Check 初診/再診 time ordering (再診 must be after 初診 on same day)
  var orderingResult = validateTreatmentTimeOrdering(userId, tempData.reserved_date, normalized, tempData.menu_type, null);
  if (!orderingResult.valid) {
    sendQuickReply(replyToken, orderingResult.reason + '\n\n別の時間を選択してください。', [
      { label: '別の時間', text: '別の時間' },
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  // Returning user: skip name/phone → go directly to reservation creation
  if (tempData.is_returning && tempData.patient_name && tempData.phone) {
    createReservationAndGoToPayment(replyToken, userId, tempData);
  } else {
    // First-time user: collect name → phone → reservation creation
    setUserState(userId, USER_STATES.AWAITING_NAME, tempData);
    sendQuickReply(replyToken, 'お名前を入力してください。', [
      { label: 'やめる', text: 'やめる' }
    ]);
  }
}

/**
 * Handle awaiting treatment (Step 1 of new flow: menu selection → date)
 */
function handleAwaitingTreatment(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  var isReturning = tempData.is_returning;
  var validOptions = isReturning
    ? ['再診（30分）', '再診（60分）']
    : ['初診（30分）'];
  var found = false;
  for (var i = 0; i < validOptions.length; i++) {
    if (text === validOptions[i]) { found = true; break; }
  }

  if (!found) {
    var menuOptions = validOptions.map(function(opt) {
      return { label: opt, text: opt };
    });
    menuOptions.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, '施術の種類を選択してください。', menuOptions);
    return;
  }
  tempData.menu_type = text;
  tempData.visit_type = text.includes('初診') ? VISIT_TYPE.FIRST : VISIT_TYPE.REPEAT;

  setUserState(userId, USER_STATES.AWAITING_DATE, tempData);
  sendDatePromptWithQuickReply(replyToken, userId);
}

/**
 * Handle awaiting payment
 */
function handleAwaitingPayment(text, replyToken, userId) {
  var tempData = getUserState(userId).context;
  var reservationId = tempData.reservation_id;
  var storedLink = tempData.payment_link;

  // Allow cancel/restart from payment state
  if (text === 'キャンセル' || text === '取消' || text === 'やめる' || text === '最初から') {
    clearUserState(userId);
    sendLineReply(replyToken, '予約をキャンセルしました。もう一度「予約する」で始められます。');
    return;
  }

  // Allow new reservation from payment state
  if (text === '予約する' || text === '予約') {
    clearUserState(userId);
    startReservationFlow(replyToken, userId);
    return;
  }

  var reservation = getReservationById(reservationId);

  if (reservation && reservation.deposit_status === DEPOSIT_STATUS.PAID) {
    sendLineReply(replyToken, 'お支払いが確認されました。予約が確定しました！');
    clearUserState(userId);
  } else if (storedLink) {
    sendQuickReply(replyToken, 'お支払いがまだ完了していません。\n\n下のリンクからデポジットをお支払いください。\n\n' + storedLink + '\n\nお支払い完了後、「支払完了」と返信してください。', [
      { label: '支払完了', text: '支払完了' },
      { label: 'やめる', text: 'やめる' }
    ]);
  } else {
    sendLineReply(replyToken, 'デポジットのお支払いがまだです。\n\n支払いリンクが届いていない場合は、管理者にお問い合わせください。');
  }
}

/**
 * Create reservation and transition to payment state
 */
function createReservationAndGoToPayment(replyToken, userId, tempData) {
  // Check max reservations per user
  var existingReservations = getReservationsByLineUserId(userId);
  var maxReservations = getMaxReservationsPerUser();
  if (existingReservations.length >= maxReservations) {
    clearUserState(userId);
    sendQuickReply(replyToken, '予約が' + maxReservations + '件あるため、これ以上予約できません。\n変更・キャンセルする場合は「予約変更・キャンセル」をご利用ください。', [
      { label: '予約変更・キャンセル', text: '予約変更・キャンセル' },
      { label: 'メニューに戻る', text: 'メニュー' }
    ]);
    return;
  }

  // Final conflict check (race condition guard)
  var bookedSlots = getBookedSlotsForDate(tempData.reserved_date);
  var bookedCount = bookedSlots[tempData.reserved_start] || 0;
  if (bookedCount >= getMaxConcurrentBookings()) {
    clearUserState(userId);
    sendQuickReply(replyToken, '申し訳ございません、' + tempData.reserved_date + ' ' + tempData.reserved_start + 'は他の方が予約しました。\n\n再度「予約する」からお試しください。', [
      { label: '予約する', text: '予約する' },
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  var profile = getLineProfile(userId);
  if (profile) {
    tempData.line_display_name = profile.userId;
  }

  var result = createReservation(tempData);

  var paymentLink = null;
  try {
    paymentLink = createPaymentLink(
      result.id,
      tempData.patient_name,
      getDepositAmount()
    );
  } catch (e) {
    appendLogRow('ERROR', 'createPaymentLink error: ' + e.message);
  }

  if (paymentLink) {
    setUserState(userId, USER_STATES.AWAITING_PAYMENT, {
      reservation_id: result.id,
      payment_link: paymentLink
    });
    var message = MessageTemplates.getDepositRequestMessage(
      result.id,
      tempData.reserved_date,
      tempData.reserved_start,
      tempData.menu_type,
      paymentLink
    );
    sendQuickReply(replyToken, message, [
      { label: '支払完了', text: '支払完了' },
      { label: 'やめる', text: 'やめる' }
    ]);
  } else {
    sendLineReply(replyToken, '決済リンクの作成に失敗しました。管理者にお問い合わせください。');
    clearUserState(userId);
  }
}
