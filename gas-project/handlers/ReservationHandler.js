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

  var menuOptions = _buildTreatmentMenuOptions(isReturning);
  var totalSteps = isReturning ? 3 : 4; // returning: 施術→日付→時間(3), new: 施術→日付→名前→電話(4)
  tempData.total_steps = totalSteps;
  sendQuickReply(replyToken, '予約を開始します。\n\n[Step 1/' + totalSteps + '] 施術の種類を選択してください。', menuOptions);
}

/**
 * Handle awaiting name
 */
function handleAwaitingName(text, replyToken, userId) {
  var tempDataN = getUserState(userId).context;
  var total = tempDataN.total_steps || 4;
  if (text === FALLBACK_RETRY_TEXT) {
    sendQuickReply(replyToken, '[Step 3/' + total + '] お名前を入力してください。', [
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  var trimmed = text.trim();
  if (!trimmed || trimmed.length > 100) {
    sendQuickReply(replyToken, '[Step 3/' + total + '] お名前を入力してください。\n（100文字以内でご入力ください）', [
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  var tempData = getUserState(userId).context;
  tempData.patient_name = trimmed;

  setUserState(userId, USER_STATES.AWAITING_PHONE, tempData);
  sendQuickReply(replyToken, 'お名前を確認しました。\n\n[Step ' + total + '/' + total + '] 電話番号を入力してください（例: 09012345678）。', [
    { label: 'やめる', text: 'やめる' }
  ]);
}

/**
 * Handle awaiting phone
 */
function handleAwaitingPhone(text, replyToken, userId) {
  var tempDataP = getUserState(userId).context;
  var totalP = tempDataP.total_steps || 4;
  if (text === FALLBACK_RETRY_TEXT) {
    sendQuickReply(replyToken, '[Step ' + totalP + '/' + totalP + '] 電話番号を入力してください（例: 09012345678）。', [
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
  var duration = getTreatmentDuration(tempData.menu_type);
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
    // Suggest nearest available time slots
    var alternativeMsg = '申し訳ございません、' + tempData.reserved_date + ' ' + normalized + 'は既に予約で埋まっています。';
    var altSlots = _findNearestAvailableSlots(tempData.reserved_date, normalized, 3);
    if (altSlots.length > 0) {
      alternativeMsg += '\n\n以下の時間なら空きがあります：\n';
      for (var ai = 0; ai < altSlots.length; ai++) {
        alternativeMsg += '・' + altSlots[ai] + '\n';
      }
    }
    sendQuickReply(replyToken, alternativeMsg + '\n別の時間を選択してください。', [
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
    sendQuickReply(replyToken, '[Step 3/4] お名前を入力してください。', [
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
  var validOptions = _getValidTreatmentOptions(isReturning);
  var found = false;
  for (var i = 0; i < validOptions.length; i++) {
    if (text === validOptions[i]) { found = true; break; }
  }

  if (!found) {
    var menuOptions = validOptions.map(function(opt) {
      return { label: opt, text: opt };
    });
    menuOptions.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, '[Step 1/' + (tempData.total_steps || 3) + '] 施術の種類を選択してください。', menuOptions);
    return;
  }
  tempData.menu_type = text;
  tempData.visit_type = text.includes('初診') ? VISIT_TYPE.FIRST : VISIT_TYPE.REPEAT;

  // Check if staff assignment is available for this treatment type
  var treatmentPrefix = text.includes('初診') ? '初診' : '再診';
  var staffOptions = buildStaffSelectionOptions(treatmentPrefix);
  // staffOptions always includes '指名しない' and 'やめる' (at least 3 items)
  if (staffOptions.length > 2) {
    setUserState(userId, USER_STATES.AWAITING_STAFF, tempData);
    var staffStep = isReturning ? 2 : 2;
    sendQuickReply(replyToken, '[Step ' + staffStep + '/' + tempData.total_steps + '] スタッフを選択してください。\n指名がない場合は「指名しない」を選んでください。', staffOptions);
  } else {
    // No staff data — skip staff selection, go directly to date
    setUserState(userId, USER_STATES.AWAITING_DATE, tempData);
    sendDatePromptWithQuickReply(replyToken, userId);
  }
}

/**
 * Handle awaiting staff selection
 */
function handleAwaitingStaff(text, replyToken, userId) {
  var tempData = getUserState(userId).context;

  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, '操作をキャンセルしました。');
    return;
  }

  if (text === '指名しない') {
    // No staff preference — proceed to date selection
    setUserState(userId, USER_STATES.AWAITING_DATE, tempData);
    sendDatePromptWithQuickReply(replyToken, userId);
    return;
  }

  // Validate staff name
  var staff = getStaffByName(text);
  if (!staff) {
    var treatmentPrefix = tempData.menu_type.includes('初診') ? '初診' : '再診';
    var staffOptions = buildStaffSelectionOptions(treatmentPrefix);
    sendQuickReply(replyToken, 'スタッフが見つかりません。選択し直してください。', staffOptions);
    return;
  }

  tempData.staff_id = staff.staff_id;
  tempData.staff_name = staff.name;

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

  // Retry payment link creation if previous attempt failed
  if (text === '再試行' && !storedLink) {
    var retryCount = tempData.retry_count || 0;
    if (retryCount >= MAX_PAYMENT_RETRIES) {
      sendQuickReply(replyToken, 'リトライ回数の上限に達しました。\n\n管理者にお問い合わせください。', [
        { label: 'お問い合わせ', text: 'お問い合わせ' },
        { label: 'やめる', text: 'やめる' }
      ]);
      return;
    }
    tempData.retry_count = retryCount + 1;
    try {
      var retryLink = createPaymentLink(reservationId, reservation ? reservation.patient_name : '', getDepositAmount());
      if (retryLink) {
        tempData.payment_link = retryLink;
        setUserState(userId, USER_STATES.AWAITING_PAYMENT, tempData);
        sendQuickReply(replyToken, '決済リンクを再作成しました。\n\n下のリンクからデポジットをお支払いください。\n\n' + retryLink + '\n\nお支払い完了後、「支払完了」と返信してください。', [
          { label: '支払完了', text: '支払完了' },
          { label: 'やめる', text: 'やめる' }
        ]);
        return;
      }
    } catch (e) {
      appendLogRow('ERROR', 'Payment link retry error: ' + e.message);
    }
    sendQuickReply(replyToken, '決済リンクの再作成にも失敗しました。時間をおいて再度お試しください。', [
      { label: '再試行', text: '再試行' },
      { label: 'お問い合わせ', text: 'お問い合わせ' },
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  if (reservation && reservation.deposit_status === DEPOSIT_STATUS.PAID) {
    sendLineReply(replyToken, 'お支払いが確認されました。予約が確定しました！');
    clearUserState(userId);
  } else if (storedLink) {
    sendQuickReply(replyToken, 'お支払いがまだ完了していません。\n\n下のリンクからデポジットをお支払いください。\n\n' + storedLink + '\n\nお支払い完了後、「支払完了」と返信してください。', [
      { label: '支払完了', text: '支払完了' },
      { label: 'やめる', text: 'やめる' }
    ]);
  } else {
    sendQuickReply(replyToken, 'デポジットのお支払いがまだです。\n\n支払いリンクが届いていない場合は、管理者にお問い合わせください。', [
      { label: 'お問い合わせ', text: 'お問い合わせ' },
      { label: 'やめる', text: 'やめる' }
    ]);
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

  // Send processing indicator (replyToken is one-time use, so push for results after this)
  sendLineReply(replyToken, '予約を作成中です...');

  // Duplicate check before acquiring lock
  var lockedExisting = getReservationsByLineUserId(userId);
  for (var di = 0; di < lockedExisting.length; di++) {
    var er = lockedExisting[di];
    if (er.reserved_date === tempData.reserved_date && er.reserved_start === tempData.reserved_start) {
      clearUserState(userId);
      sendLinePushQuickReply(userId, '同じ日時に既に予約があります。\n\n' + er.reserved_date + ' ' + er.reserved_start + ' - ' + (er.reserved_end || '') + '\n\n別の日時を選択してください。', [
        { label: '予約する', text: '予約する' },
        { label: 'やめる', text: 'やめる' }
      ]);
      return;
    }
  }

  var profile = getLineProfile(userId);
  if (profile) {
    tempData.line_display_name = profile.userId;
  }

  // Embed staff info in notes for staff-specific booking lookup
  if (tempData.staff_id) {
    tempData.notes = (tempData.notes || '') + 'staff:' + tempData.staff_id;
  }

  // Create reservation with lock (shared function)
  var lockResult = _createReservationWithLock(tempData);

  if (!lockResult.ok) {
    clearUserState(userId);
    if (lockResult.reason === 'SLOT_FULL') {
      sendLinePushQuickReply(userId, '申し訳ございません、' + tempData.reserved_date + ' ' + tempData.reserved_start + 'は他の方が予約しました。\n\n再度「予約する」からお試しください。', [
        { label: '予約する', text: '予約する' },
        { label: 'やめる', text: 'やめる' }
      ]);
    } else {
      sendLinePushQuickReply(userId, '予約の作成中にエラーが発生しました。\n\n時間をおいて再度お試しいただくか、管理者にお問い合わせください。', [
        { label: '予約する', text: '予約する' },
        { label: 'お問い合わせ', text: 'お問い合わせ' }
      ]);
    }
    return;
  }

  var result = lockResult.reservation;

  // Post-creation hooks (calendar sync, audit log)
  try { _onReservationCreated(result.id, tempData); } catch (hookErr) {
    appendLogRow('WARN', 'Post-create hook error: ' + hookErr.message);
  }

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
      paymentLink,
      getUserLocale(userId)
    );
    sendLinePushQuickReply(userId, message, [
      { label: '支払完了', text: '支払完了' },
      { label: 'やめる', text: 'やめる' }
    ]);
  } else {
    setUserState(userId, USER_STATES.AWAITING_PAYMENT, {
      reservation_id: result.id,
      payment_link: null
    });
    sendLinePushQuickReply(userId, '決済リンクの作成に失敗しました。下のボタンで再試行するか、管理者にお問い合わせください。', [
      { label: '再試行', text: '再試行' },
      { label: 'お問い合わせ', text: 'お問い合わせ' },
      { label: 'やめる', text: 'やめる' }
    ]);
  }
}

/**
 * Create reservation with LockService race condition guard.
 * Shared by LINE Bot flow and Web API flow.
 *
 * @param {Object} tempData - Reservation fields (patient_name, phone, reserved_date, etc.)
 * @returns {Object} { ok: true, reservation: {...} } or { ok: false, reason: 'SLOT_FULL'|'DUPLICATE'|error_msg }
 */
function _createReservationWithLock(tempData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    _invalidateReservationCache();

    var bookedSlots = getBookedSlotsForDate(tempData.reserved_date);
    var bookedCount = bookedSlots[tempData.reserved_start] || 0;
    if (bookedCount >= getMaxConcurrentBookings()) {
      return { ok: false, reason: 'SLOT_FULL' };
    }

    var result = createReservation(tempData);
    return { ok: true, reservation: result };
  } catch (e) {
    appendLogRow('ERROR', '_createReservationWithLock: ' + e.message);
    return { ok: false, reason: e.message };
  } finally {
    try { lock.releaseLock(); } catch (le) { /* noop */ }
  }
}

/**
 * Hook: called after reservation creation succeeds.
 * Triggers calendar sync and audit log.
 */
function _onReservationCreated(reservationId, tempData) {
  var reservation = getReservationById(reservationId);
  if (!reservation) return;

  // Calendar sync
  try {
    createCalendarEvent(reservation);
  } catch (e) {
    appendLogRow('WARN', '[Calendar] Post-create sync failed: ' + e.message);
  }

  // Audit log
  try {
    appendAuditLog('CREATE', reservationId, null, {
      patient_name: reservation.patient_name,
      date: reservation.reserved_date,
      time: reservation.reserved_start,
      menu: reservation.menu_type
    });
  } catch (e) { /* non-critical */ }
}

/**
 * Find nearest available time slots on the same date
 */
function _findNearestAvailableSlots(date, requestedTime, maxSlots) {
  var bookedSlots = getBookedSlotsForDate(date);
  var maxBookings = getMaxConcurrentBookings();
  var startH = parseInt((getProperty('BUSINESS_START_TIME') || '09:00').split(':')[0]);
  var endH = parseInt((getProperty('BUSINESS_END_TIME') || '18:00').split(':')[0]);
  var requestedMinutes = parseInt(requestedTime.split(':')[0]) * 60 + parseInt(requestedTime.split(':')[1]);

  var available = [];
  for (var h = startH; h < endH; h++) {
    for (var m = 0; m < 60; m += 30) {
      var slot = ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
      var slotCount = bookedSlots[slot] || 0;
      if (slotCount < maxBookings) {
        var slotMinutes = h * 60 + m;
        var distance = Math.abs(slotMinutes - requestedMinutes);
        available.push({ slot: slot, distance: distance });
      }
    }
  }

  available.sort(function(a, b) { return a.distance - b.distance; });
  return available.slice(0, maxSlots).map(function(s) { return s.slot; });
}

/**
 * Build treatment QuickReply menu options from TREATMENT_DURATIONS
 */
function _buildTreatmentMenuOptions(isReturning) {
  var prefix = isReturning ? '再診' : '初診';
  var options = [];
  for (var key in TREATMENT_DURATIONS) {
    if (key.indexOf(prefix) === 0) {
      options.push({ label: key, text: key });
    }
  }
  options.push({ label: 'やめる', text: 'やめる' });
  return options;
}

/**
 * Get valid treatment option strings from TREATMENT_DURATIONS
 */
function _getValidTreatmentOptions(isReturning) {
  var prefix = isReturning ? '再診' : '初診';
  var options = [];
  for (var key in TREATMENT_DURATIONS) {
    if (key.indexOf(prefix) === 0) {
      options.push(key);
    }
  }
  return options;
}
