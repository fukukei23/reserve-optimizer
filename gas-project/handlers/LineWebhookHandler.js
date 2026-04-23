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
      console.log('[handleLineEvent] Unhandled event type: ' + eventType);
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

  // Handle "お問い合わせ" globally (rich menu action — same as "人間に問い合わせる")
  if (text === 'お問い合わせ') {
    sendLineReply(replyToken, MessageTemplates.getContactMessage());
    clearUserState(userId);
    return;
  }

  // Handle "営業時間・アクセス" globally (rich menu action — works in any state)
  if (text === '営業時間・アクセス') {
    sendLineReply(replyToken, MessageTemplates.getBusinessHoursMessage());
    clearUserState(userId);
    return;
  }

  // Handle "やめる" globally across all non-IDLE states
  if (text === 'やめる' && userState.state !== USER_STATES.IDLE) {
    clearUserState(userId);
    sendLineReply(replyToken, '操作をキャンセルしました。\n\n「予約する」でまた始められます。');
    return;
  }

  // Handle "予約する" globally — reset current operation and start new reservation
  if (text === '予約する' && userState.state !== USER_STATES.IDLE) {
    clearUserState(userId);
    startReservationFlow(replyToken, userId);
    return;
  }

  // Handle "予約変更・キャンセル" globally — reset and start change/cancel flow
  if (text === '予約変更・キャンセル' && userState.state !== USER_STATES.IDLE) {
    clearUserState(userId);
    handleChangeFlow(replyToken, userId);
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
 * Handle idle state
 */
function handleIdleState(text, replyToken, userId) {
  // Normalize: trim whitespace and full-width spaces
  var normalized = text.replace(/[\s\u3000]+/g, '').replace(/！/g, '!').replace(/？/g, '?');

  // Reservation keywords
  var reservationTriggers = ['予約する', '予約', '予約したい', '新規予約', '予約お願い', '予約おねがい'];
  // Change/cancel keywords
  var changeTriggers = ['予約変更・キャンセル', '予約変更', '変更', 'キャンセル', '予約キャンセル', '変更したい', 'キャンセルしたい'];
  // Waitlist keywords
  var waitlistTriggers = ['当日空き枠通知を受け取る', '空き枠通知', 'キャンセル待ち', '空き通知', 'ウェイティング'];
  // Info keywords
  var hoursTriggers = ['営業時間・アクセス', '営業時間', 'アクセス', '住所', 'どこ', '場所', '何時', '時間'];
  var contactTriggers = ['お問い合わせ', 'お問合せ', '電話', '電話番号', '連絡'];

  var matched = false;

  for (var i = 0; i < reservationTriggers.length; i++) {
    if (normalized === reservationTriggers[i] || normalized.indexOf(reservationTriggers[i]) === 0) {
      startReservationFlow(replyToken, userId);
      matched = true;
      break;
    }
  }

  if (!matched) {
    for (var j = 0; j < changeTriggers.length; j++) {
      if (normalized === changeTriggers[j] || normalized.indexOf(changeTriggers[j]) === 0) {
        handleChangeFlow(replyToken, userId);
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    for (var k = 0; k < waitlistTriggers.length; k++) {
      if (normalized === waitlistTriggers[k] || normalized.indexOf(waitlistTriggers[k]) === 0) {
        handleWaitlistFlow(replyToken, userId);
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    for (var l = 0; l < hoursTriggers.length; l++) {
      if (normalized === hoursTriggers[l] || normalized.indexOf(hoursTriggers[l]) === 0) {
        sendLineReply(replyToken, MessageTemplates.getBusinessHoursMessage());
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    for (var m = 0; m < contactTriggers.length; m++) {
      if (normalized === contactTriggers[m] || normalized.indexOf(contactTriggers[m]) === 0) {
        sendLineReply(replyToken, MessageTemplates.getContactMessage());
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    // Try LLM for clinic-related questions
    if (!handleLLMQuery(replyToken, text)) {
      var welcomeData = MessageTemplates.getWelcomeMessage();
      sendQuickReply(replyToken, welcomeData.text, welcomeData.quickReplies);
    }
  }
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
 * Send date prompt with rolling calendar (next 10 available dates, skip Sundays)
 * @param {string} replyToken - LINE reply token
 * @param {string} userId - LINE user ID (unused but kept for signature compatibility)
 * @param {string} pageStartDate - optional 'YYYY-MM-DD' to start showing from a specific date
 */
function sendDatePromptWithQuickReply(replyToken, userId, pageStartDate) {
  var tz = 'Asia/Tokyo';
  var now = new Date();
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var todayDate = new Date(todayStr + 'T00:00:00+09:00');
  var maxDate = new Date(todayDate);
  maxDate.setDate(maxDate.getDate() + 90);
  var maxDateStr = Utilities.formatDate(maxDate, tz, 'yyyy-MM-dd');
  var weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  // Start date for this page
  var start;
  if (pageStartDate) {
    start = new Date(pageStartDate + 'T00:00:00+09:00');
  } else {
    start = new Date(todayDate);
  }

  // Collect up to 10 available dates (skip Sundays)
  var dates = [];
  var current = new Date(start);
  while (dates.length < 10) {
    var dateStr = Utilities.formatDate(current, tz, 'yyyy-MM-dd');
    if (dateStr > maxDateStr) break;
    var dow = current.getDay();
    if (dow === 0) { // Skip Sunday
      current.setDate(current.getDate() + 1);
      continue;
    }
    if (dateStr < todayStr) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    var month = current.getMonth() + 1;
    var day = current.getDate();
    dates.push({
      date: dateStr,
      label: month + '/' + day + '(' + weekdays[dow] + ')'
    });
    current.setDate(current.getDate() + 1);
  }

  // Build Quick Reply items
  var items = [];
  for (var i = 0; i < dates.length; i++) {
    items.push({ label: dates[i].label, text: dates[i].date });
  }

  // Previous page button
  var isFirstPage = !pageStartDate;
  if (!isFirstPage) {
    var prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    var prevDates = [];
    while (prevDates.length < 10 && prevStart >= todayDate) {
      var prevDateStr = Utilities.formatDate(prevStart, tz, 'yyyy-MM-dd');
      if (prevDateStr < todayStr) break;
      var prevDow = prevStart.getDay();
      if (prevDow !== 0) {
        prevDates.unshift(prevDateStr);
      }
      prevStart.setDate(prevStart.getDate() - 1);
    }
    if (prevDates.length > 0) {
      items.push({ label: '\u25C0前へ', text: 'PAGE_PREV:' + prevDates[0] });
    }
  }

  // Next page button
  if (dates.length === 10) {
    var nextDateStr = Utilities.formatDate(current, tz, 'yyyy-MM-dd');
    if (nextDateStr <= maxDateStr) {
      items.push({ label: '次へ\u25B6', text: 'PAGE_NEXT:' + nextDateStr });
    }
  }

  items.push({ label: '日付入力', text: '日付入力' });
  items.push({ label: 'やめる', text: 'やめる' });

  var msg = isFirstPage
    ? '希望日を選んでください。（日曜休業、90日先まで）'
    : '続きの日付を選んでください。';
  sendQuickReply(replyToken, msg, items);
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

  // 90-day limit check
  var tz = 'Asia/Tokyo';
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var maxDate = new Date(todayStr + 'T00:00:00+09:00');
  maxDate.setDate(maxDate.getDate() + 90);
  var maxDateStr = Utilities.formatDate(maxDate, tz, 'yyyy-MM-dd');

  if (parsedDate < todayStr) {
    sendFallbackWithContact(replyToken, '過去の日付は選択できません。別の日を選択してください。');
    return;
  }
  if (parsedDate > maxDateStr) {
    sendFallbackWithContact(replyToken, '予約は90日以内のみ可能です。');
    return;
  }

  // Sunday check
  var bookingDate = new Date(parsedDate + 'T12:00:00+09:00');
  if (bookingDate.getDay() === 0) {
    sendFallbackWithContact(replyToken, '日曜日は休業日です。別の日を選択してください。');
    return;
  }

  tempData.reserved_date = parsedDate;

  setUserState(userId, USER_STATES.AWAITING_TIME, tempData);
  sendTimePromptWithQuickReply(replyToken, parsedDate);
}

/**
 * Send time prompt with quick reply — shows only available slots
 * Filters out: past times (with lead time buffer) and fully booked slots
 * @param {string} replyToken - LINE reply token
 * @param {string} date - YYYY-MM-DD format (optional, defaults to today)
 */
function sendTimePromptWithQuickReply(replyToken, date) {
  var targetDate = date || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var leadTime = getBookingLeadTimeMinutes();
  var maxConcurrent = getMaxConcurrentBookings();
  var bookedSlots = getBookedSlotsForDate(targetDate);

  // Generate slots based on day of week
  var targetDateObj = new Date(targetDate + 'T12:00:00+09:00');
  var dayOfWeek = targetDateObj.getDay();
  var allSlots;

  if (dayOfWeek === 6) {
    // Saturday: 9:00-13:00 (no lunch break)
    allSlots = ['9:00', '9:30', '10:00', '10:30', '11:00', '12:00'];
  } else {
    // Weekday: 9:00-18:00, lunch break 12:00-13:00 excluded
    allSlots = ['9:00', '9:30', '10:00', '10:30', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  }

  var availableSlots = [];
  for (var i = 0; i < allSlots.length; i++) {
    var slot = allSlots[i];
    // Skip past times (with lead time)
    if (isPastDateTime(targetDate, slot, leadTime)) continue;
    // Skip fully booked slots
    var bookedCount = bookedSlots[slot] || 0;
    if (bookedCount >= maxConcurrent) continue;
    availableSlots.push(slot);
  }

  if (availableSlots.length === 0) {
    sendQuickReply(replyToken, '申し訳ございません、' + targetDate + 'は予約可能な時間がありません。\n\n別の日を選択してください。', [
      { label: '別の日を選ぶ', text: '別の日' },
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  var timeOptions = availableSlots.map(function(t) { return { label: t, text: t }; });
  timeOptions.push({ label: 'やめる', text: 'やめる' });
  sendQuickReply(replyToken, '希望時間を選択してください。（空き枠のみ表示）', timeOptions);
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
 * Create reservation and transition to payment state
 * Extracted from old handleAwaitingTreatment for reuse by multiple flow paths
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
    console.error('[createPaymentLink] Error: ' + e.message);
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
    items.push({ label: '次の5件 ▶', text: '次の5件' });
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
  if (text === '次の5件') {
    page++;
    var startIdx = page * pageSize;
    if (startIdx >= reservationIds.length) {
      page = 0;
      startIdx = 0;
    }
    var newPageIds = reservationIds.slice(startIdx, startIdx + pageSize);
    var newPageReservations = [];
    for (var pi = 0; pi < newPageIds.length; pi++) {
      var pr = getReservationById(newPageIds[pi]);
      if (pr) newPageReservations.push(pr);
    }
    tempData.page = page;
    setUserState(userId, USER_STATES.AWAITING_CHANGE_SELECT, tempData);
    var pmsg = MessageTemplates.getChangeListMessage(newPageReservations, page, Math.ceil(reservationIds.length / pageSize));
    var pitems = [];
    for (var pj = 0; pj < newPageReservations.length; pj++) {
      pitems.push({ label: String(pj + 1), text: String(pj + 1) });
    }
    if (startIdx + pageSize < reservationIds.length) {
      pitems.push({ label: '次の5件 ▶', text: '次の5件' });
    }
    if (page > 0) {
      pitems.push({ label: '◀ 前の5件', text: '前の5件' });
    }
    pitems.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, pmsg, pitems);
    return;
  }

  if (text === '前の5件') {
    page = Math.max(0, page - 1);
    var prevStartIdx = page * pageSize;
    var prevPageIds = reservationIds.slice(prevStartIdx, prevStartIdx + pageSize);
    var prevPageReservations = [];
    for (var pvi = 0; pvi < prevPageIds.length; pvi++) {
      var pvr = getReservationById(prevPageIds[pvi]);
      if (pvr) prevPageReservations.push(pvr);
    }
    tempData.page = page;
    setUserState(userId, USER_STATES.AWAITING_CHANGE_SELECT, tempData);
    var prevMsg = MessageTemplates.getChangeListMessage(prevPageReservations, page, Math.ceil(reservationIds.length / pageSize));
    var prevItems = [];
    for (var pvj = 0; pvj < prevPageReservations.length; pvj++) {
      prevItems.push({ label: String(pvj + 1), text: String(pvj + 1) });
    }
    if (prevStartIdx + pageSize < reservationIds.length) {
      prevItems.push({ label: '次の5件 ▶', text: '次の5件' });
    }
    if (page > 0) {
      prevItems.push({ label: '◀ 前の5件', text: '前の5件' });
    }
    prevItems.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, prevMsg, prevItems);
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
    { label: '💆 施術', text: '施術' }
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

  // 90-day limit check
  var tz = 'Asia/Tokyo';
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var maxDate = new Date(todayStr + 'T00:00:00+09:00');
  maxDate.setDate(maxDate.getDate() + 90);
  var maxDateStr = Utilities.formatDate(maxDate, tz, 'yyyy-MM-dd');

  if (parsedDate < todayStr) {
    sendFallbackWithContact(replyToken, '過去の日付は選択できません。別の日を選択してください。');
    return;
  }
  if (parsedDate > maxDateStr) {
    sendFallbackWithContact(replyToken, '予約は90日以内のみ可能です。');
    return;
  }

  // Sunday check
  var bookingDate = new Date(parsedDate + 'T12:00:00+09:00');
  if (bookingDate.getDay() === 0) {
    sendFallbackWithContact(replyToken, '日曜日は休業日です。別の日を選択してください。');
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
  var duration = reservation.menu_type === '再診（60分）' ? 60 : 30;

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
    var duration = (reservation.menu_type === '再診（60分）') ? 60 : 30;
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
  if (text === '次の5件') {
    page++;
    var startIdx = page * pageSize;
    if (startIdx >= reservationIds.length) { page = 0; startIdx = 0; }
    var npIds = reservationIds.slice(startIdx, startIdx + pageSize);
    var npRes = [];
    for (var npi = 0; npi < npIds.length; npi++) {
      var npr = getReservationById(npIds[npi]);
      if (npr) npRes.push(npr);
    }
    tempData.page = page;
    setUserState(userId, USER_STATES.AWAITING_CANCEL_SELECT, tempData);
    var npMsg = MessageTemplates.getCancelListMessage(npRes, page, Math.ceil(reservationIds.length / pageSize));
    var npItems = [];
    for (var npj = 0; npj < npRes.length; npj++) {
      npItems.push({ label: String(npj + 1), text: String(npj + 1) });
    }
    if (startIdx + pageSize < reservationIds.length) {
      npItems.push({ label: '次の5件 ▶', text: '次の5件' });
    }
    if (page > 0) {
      npItems.push({ label: '◀ 前の5件', text: '前の5件' });
    }
    npItems.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, npMsg, npItems);
    return;
  }

  if (text === '前の5件') {
    page = Math.max(0, page - 1);
    var pvStartIdx = page * pageSize;
    var pvIds = reservationIds.slice(pvStartIdx, pvStartIdx + pageSize);
    var pvRes = [];
    for (var pvi = 0; pvi < pvIds.length; pvi++) {
      var pvr = getReservationById(pvIds[pvi]);
      if (pvr) pvRes.push(pvr);
    }
    tempData.page = page;
    setUserState(userId, USER_STATES.AWAITING_CANCEL_SELECT, tempData);
    var pvMsg = MessageTemplates.getCancelListMessage(pvRes, page, Math.ceil(reservationIds.length / pageSize));
    var pvItems = [];
    for (var pvj = 0; pvj < pvRes.length; pvj++) {
      pvItems.push({ label: String(pvj + 1), text: String(pvj + 1) });
    }
    if (pvStartIdx + pageSize < reservationIds.length) {
      pvItems.push({ label: '次の5件 ▶', text: '次の5件' });
    }
    if (page > 0) {
      pvItems.push({ label: '◀ 前の5件', text: '前の5件' });
    }
    pvItems.push({ label: 'やめる', text: 'やめる' });
    sendQuickReply(replyToken, pvMsg, pvItems);
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

  console.log('[handleFollow] User followed: ' + userId + ' (' + displayName + ')');

  var welcomeData = MessageTemplates.getWelcomeMessage();
  sendLinePush(userId, welcomeData.text);
}

/**
 * Handle unfollow event
 */
function handleUnfollow(userId) {
  console.log('[handleUnfollow] User unfollowed: ' + userId);
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
 * Validate 初診/再診 time ordering on the same day
 * Rule: 再診 must start AFTER 初診 ends on the same day
 * @param {string} userId - LINE user ID
 * @param {string} date - YYYY-MM-DD
 * @param {string} time - HH:MM (start time being validated)
 * @param {string} treatmentType - menu_type (e.g., '初診（30分）', '再診（30分）')
 * @param {string} excludeId - reservation ID to exclude from check (for changes)
 * @returns {object} { valid: boolean, reason: string }
 */
function validateTreatmentTimeOrdering(userId, date, time, treatmentType, excludeId) {
  var reservations = getReservationsByLineUserId(userId);
  var isShoshin = treatmentType.indexOf('初診') !== -1;
  var tParts = time.split(':');
  var timeMins = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
  var duration = treatmentType === '再診（60分）' ? 60 : 30;
  var endMins = timeMins + duration;

  for (var i = 0; i < reservations.length; i++) {
    var r = reservations[i];
    if (excludeId && r.id === excludeId) continue;
    if (r.reserved_date !== date) continue;
    if (r.status !== RESERVATION_STATUS.PENDING && r.status !== RESERVATION_STATUS.CONFIRMED) continue;
    if (!r.menu_type) continue;

    var rIsShoshin = r.menu_type.indexOf('初診') !== -1;
    var rStartParts = r.reserved_start.split(':');
    var rStartMins = parseInt(rStartParts[0]) * 60 + parseInt(rStartParts[1]);
    var rEndParts = r.reserved_end ? r.reserved_end.split(':') : null;
    var rEndMins = rEndParts ? parseInt(rEndParts[0]) * 60 + parseInt(rEndParts[1]) : rStartMins + 30;

    // 再診 must start AFTER 初診 ends
    if (!isShoshin && rIsShoshin) {
      if (timeMins < rEndMins) {
        return {
          valid: false,
          reason: '再診は初診（' + r.reserved_start + ' - ' + (r.reserved_end || '') + '）より後の時間にしてください。'
        };
      }
    }

    // 初診 must end BEFORE 再診 starts
    if (isShoshin && !rIsShoshin) {
      if (endMins > rStartMins) {
        return {
          valid: false,
          reason: '初診は再診（' + r.reserved_start + '）より前の時間にしてください。'
        };
      }
    }
  }

  return { valid: true, reason: '' };
}

/**
 * Parse date input (YYYY-MM-DD, M月D日, M/D, 今日, 明日, 明後日, 来週月曜...)
 * Also strips trailing (曜日) suffix e.g. "4/25(金)" → "4/25"
 */
function parseDateInput(text) {
  if (!text || typeof text !== 'string') return null;
  var s = text.trim();

  // Strip trailing (曜日) suffix e.g. "4/25(金)" → "4/25"
  s = s.replace(/\([月火水木金土日]\)$/, '');

  var tz = 'Asia/Tokyo';
  var now = new Date();
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var currentYear = parseInt(Utilities.formatDate(now, tz, 'yyyy'));

  // YYYY-MM-DD
  var isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return isoMatch[0];

  // YYYY/MM/DD
  var ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) return ymdSlash[1] + '-' + pad2(ymdSlash[2]) + '-' + pad2(ymdSlash[3]);

  // MM/DD/YYYY
  var mdySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdySlash) return mdySlash[3] + '-' + pad2(mdySlash[1]) + '-' + pad2(mdySlash[2]);

  // M/D (no year — assume current year, if past assume next year)
  var mdSlash = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (mdSlash) return resolveMonthDay(currentYear, parseInt(mdSlash[1]), parseInt(mdSlash[2]), todayStr);

  // M月D日 (Japanese date format)
  var jpDate = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
  if (jpDate) return resolveMonthDay(currentYear, parseInt(jpDate[1]), parseInt(jpDate[2]), todayStr);

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

/**
 * Resolve M/D to YYYY-MM-DD, using next year if the date is in the past
 */
function resolveMonthDay(year, month, day, todayStr) {
  var m = pad2(String(month));
  var d = pad2(String(day));
  var candidate = year + '-' + m + '-' + d;
  if (candidate < todayStr) {
    candidate = (year + 1) + '-' + m + '-' + d;
  }
  return candidate;
}

/**
 * Zero-pad a number string to 2 digits
 */
function pad2(n) {
  return n.length === 1 ? '0' + n : String(n);
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
