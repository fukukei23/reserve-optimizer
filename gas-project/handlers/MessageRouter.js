/**
 * Message Router
 *
 * Routes LINE messages to appropriate handlers and provides shared utilities
 */

// Fixed labels for fallback quick replies (same text is sent when tapped)
var FALLBACK_RETRY_TEXT = 'もう一度入力する';
var FALLBACK_CONTACT_TEXT = '人間に問い合わせる';

/**
 * Handle yes/no confirmation input
 * @param {string} text - User input text
 * @param {string} replyToken - LINE reply token
 * @returns {{ confirmed: boolean|null }} true=yes, false=no/cancel, null=invalid (reply already sent)
 */
function handleYesNoConfirm(text, replyToken) {
  if (text === 'やめる' || text === 'いいえ' || text === 'キャンセル') {
    return { confirmed: false };
  }
  if (text !== 'はい') {
    sendQuickReply(replyToken, '「はい」または「いいえ」で答えてください。', [
      { label: 'はい', text: 'はい' },
      { label: 'いいえ', text: 'いいえ' }
    ]);
    return { confirmed: null };
  }
  return { confirmed: true };
}

/**
 * Fetch reservations for a page of IDs (batch lookup via cache)
 * @param {string[]} reservationIds - Full list of reservation IDs
 * @param {number} page - Current page (0-based)
 * @param {number} pageSize - Items per page
 * @returns {{ page: number, reservations: object[] }}
 */
function fetchReservationsPage(reservationIds, page, pageSize) {
  var startIdx = page * pageSize;
  var pageIds = reservationIds.slice(startIdx, startIdx + pageSize);
  var reservations = [];
  _ensureReservationCache();
  for (var i = 0; i < pageIds.length; i++) {
    var r = _reservationByIdMap[pageIds[i]];
    if (r) reservations.push(r);
  }
  return { page: page, reservations: reservations };
}

/**
 * Build QuickReply items for a paginated list
 */
function buildPaginatedQuickReplyItems(pageReservations, page, totalPages, totalItems, pageSize) {
  var items = [];
  for (var i = 0; i < pageReservations.length; i++) {
    items.push({ label: String(i + 1), text: String(i + 1) });
  }
  if ((page + 1) * pageSize < totalItems) {
    items.push({ label: '次の5件 ▶ (' + (page + 2) + '/' + totalPages + ')', text: '次の5件' });
  }
  if (page > 0) {
    items.push({ label: '◀ 前の5件 (' + page + '/' + totalPages + ')', text: '前の5件' });
  }
  items.push({ label: 'やめる', text: 'やめる' });
  return items;
}

/**
 * Handle pagination navigation (次の5件 / 前の5件)
 * @returns {boolean} true if pagination was handled (reply already sent)
 */
function handlePaginationStep(text, replyToken, userId, tempData, reservationIds, page, pageSize, listMessageFn, targetState) {
  if (text === '次の5件') {
    page++;
    var startIdx = page * pageSize;
    if (startIdx >= reservationIds.length) {
      page = 0;
    }
    tempData.page = page;
    setUserState(userId, targetState, tempData);
    var totalPages = Math.ceil(reservationIds.length / pageSize);
    var pageResult = fetchReservationsPage(reservationIds, page, pageSize);
    var msg = listMessageFn(pageResult.reservations, page, totalPages);
    var items = buildPaginatedQuickReplyItems(pageResult.reservations, page, totalPages, reservationIds.length, pageSize);
    sendQuickReply(replyToken, msg, items);
    return true;
  }

  if (text === '前の5件') {
    page = Math.max(0, page - 1);
    tempData.page = page;
    setUserState(userId, targetState, tempData);
    var totalPages2 = Math.ceil(reservationIds.length / pageSize);
    var pageResult2 = fetchReservationsPage(reservationIds, page, pageSize);
    var msg2 = listMessageFn(pageResult2.reservations, page, totalPages2);
    var items2 = buildPaginatedQuickReplyItems(pageResult2.reservations, page, totalPages2, reservationIds.length, pageSize);
    sendQuickReply(replyToken, msg2, items2);
    return true;
  }

  return false;
}

/**
 * Send error message with fallback quick replies (もう一度入力する / 人間に問い合わせる / やめる)
 */
function sendFallbackWithContact(replyToken, errorMessage) {
  var items = [
    { label: FALLBACK_RETRY_TEXT, text: FALLBACK_RETRY_TEXT },
    { label: FALLBACK_CONTACT_TEXT, text: FALLBACK_CONTACT_TEXT },
    { label: 'やめる', text: 'やめる' }
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
      handleFollow(userId, replyToken);
      break;
    case 'unfollow':
      handleUnfollow(userId);
      break;
    default:
      appendLogRow('WARN', 'Unhandled event type: ' + eventType);
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

  // Handle settings change responses (SET_REMINDER: prefix)
  if (text.indexOf('SET_REMINDER:') === 0) {
    var timing = text.substring('SET_REMINDER:'.length);
    setUserPref(userId, 'reminder_timing', timing);
    sendLineReply(replyToken, 'リマインダー時刻を ' + timing + ' に変更しました。');
    return;
  }

  // Handle waitlist slot reservation (RESERVE_SLOT:date:time)
  if (text.indexOf('RESERVE_SLOT:') === 0) {
    var parts = text.substring('RESERVE_SLOT:'.length).split(':');
    if (parts.length >= 2) {
      handleWaitlistSlotReservation(replyToken, userId, parts[0], parts[1]);
      return;
    }
  }

  // Handle "営業時間・アクセス" globally (rich menu action — works in any state)
  if (text === '営業時間・アクセス') {
    sendLineReply(replyToken, MessageTemplates.getBusinessHoursMessage());
    clearUserState(userId);
    return;
  }

  // Handle "やめる" globally across all non-IDLE states (with confirmation)
  if (text === 'やめる' && userState.state !== USER_STATES.IDLE) {
    clearUserState(userId);
    sendLineReply(replyToken, '操作をキャンセルしました。\n\n「予約する」でまた始められます。');
    return;
  }

  // Handle "本当にやめる" — explicit cancel confirmation
  if (text === '本当にやめる' && userState.state !== USER_STATES.IDLE) {
    clearUserState(userId);
    sendLineReply(replyToken, '操作をキャンセルしました。\n\n「予約する」でまた始められます。');
    return;
  }

  // Handle "戻る" — go back to menu (clears state, returns to welcome)
  if (text === '戻る' && userState.state !== USER_STATES.IDLE) {
    clearUserState(userId);
    var menuData = MessageTemplates.getWelcomeMessage();
    sendQuickReply(replyToken, '操作を中止し、メニューに戻ります。\n\n「やめる」との違い：「戻る」＝メニューに戻る、「やめる」＝完全にキャンセル', menuData.quickReplies);
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
    case USER_STATES.AWAITING_WAITLIST_TIME:
      handleAwaitingWaitlistTime(text, replyToken, userId);
      break;
    default:
      sendLineReply(replyToken, '何かお手伝いしましょうか？');
  }
}

/**
 * Handle command messages
 */
function handleCommand(command, replyToken, userId) {
  // Admin commands (restricted to LINE_ADMIN_USER_ID)
  var adminId = getLineAdminUserId();
  var isAdmin = adminId && userId === adminId;

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
    case '/status':
      if (isAdmin) {
        var validation = validateRequiredProperties();
        var statusMsg = '【System Status】\n' +
          'Config: ' + (validation.valid ? 'OK' : 'MISSING: ' + validation.missing.join(', ')) + '\n' +
          'Time: ' + new Date().toISOString();
        sendLineReply(replyToken, statusMsg);
      } else {
        sendLineReply(replyToken, 'このコマンドは管理者のみ利用可能です。');
      }
      break;
    case '/cleanup':
      if (isAdmin) {
        cleanupExpiredStates();
        sendLineReply(replyToken, '期限切れ状態のクリーンアップを実行しました。');
      } else {
        sendLineReply(replyToken, 'このコマンドは管理者のみ利用可能です。');
      }
      break;
    case '/help':
      var helpMsg = '【コマンド一覧】\n' +
        '/reserve - 予約開始\n' +
        '/change - 予約変更\n' +
        '/cancel - 予約キャンセル\n' +
        '/waitlist - 空き枠通知登録\n' +
        '/settings - 設定確認・変更';
      if (isAdmin) {
        helpMsg += '\n【管理者】\n/status - 設定確認\n/cleanup - 状態クリーンアップ';
      }
      sendLineReply(replyToken, helpMsg);
      break;
    case '/settings':
      var prefs = getUserPrefs(userId);
      sendQuickReply(replyToken, '【現在の設定】\nリマインダー時刻: ' + prefs.reminder_timing + '\n\nリマインダー時刻を変更する場合は下から選択してください。', [
        { label: '07:00', text: 'SET_REMINDER:07:00' },
        { label: '08:00', text: 'SET_REMINDER:08:00' },
        { label: '09:00', text: 'SET_REMINDER:09:00' },
        { label: 'メニューに戻る', text: 'メニュー' }
      ]);
      break;
    default:
      sendLineReply(replyToken, '無効なコマンドです。/help でコマンド一覧を確認してください。');
  }
}

/**
 * Keyword map for idle state routing — O(1) lookup
 * Keys: normalized keyword → Values: action identifier
 * Prefix-match keywords (e.g. '予約' matches '予約したい') are stored in _KEYWORD_PREFIXES
 * and checked after exact match fails.
 */
var _KEYWORD_MAP = {
  '予約する': 'reserve', '予約したい': 'reserve', '新規予約': 'reserve',
  '予約お願い': 'reserve', '予約おねがい': 'reserve',
  '予約確認': 'view', '予約状況': 'view', 'マイ予約': 'view',
  '予約変更・キャンセル': 'change', '予約変更': 'change', '変更': 'change',
  'キャンセル': 'change', '予約キャンセル': 'change',
  '変更したい': 'change', 'キャンセルしたい': 'change',
  '当日空き枠通知を受け取る': 'waitlist', '空き枠通知': 'waitlist',
  'キャンセル待ち': 'waitlist', '空き通知': 'waitlist', 'ウェイティング': 'waitlist',
  '営業時間・アクセス': 'hours', '営業時間': 'hours', 'アクセス': 'hours',
  '住所': 'hours', 'どこ': 'hours', '場所': 'hours', '何時': 'hours', '時間': 'hours',
  'お問い合わせ': 'contact', 'お問合せ': 'contact',
  '電話': 'contact', '電話番号': 'contact', '連絡': 'contact'
};

// Short keywords that also match as prefix (e.g. '予約' matches '予約したい')
var _KEYWORD_PREFIXES = ['予約'];

/**
 * Resolve normalized text to an action via keyword map
 * @param {string} normalized - whitespace-normalized text
 * @returns {string|null} action identifier or null
 */
function resolveKeywordAction(normalized) {
  // Exact match (O(1))
  if (_KEYWORD_MAP[normalized]) {
    return _KEYWORD_MAP[normalized];
  }
  // Prefix match for short keywords
  for (var i = 0; i < _KEYWORD_PREFIXES.length; i++) {
    if (normalized.indexOf(_KEYWORD_PREFIXES[i]) === 0) {
      return _KEYWORD_MAP[_KEYWORD_PREFIXES[i]];
    }
  }
  return null;
}

/**
 * Handle idle state
 */
function handleIdleState(text, replyToken, userId) {
  var normalized = text.replace(/[\s　]+/g, '').replace(/！/g, '!').replace(/？/g, '?');
  var action = resolveKeywordAction(normalized);

  if (action === 'reserve') {
    startReservationFlow(replyToken, userId);
  } else if (action === 'view') {
    handleViewReservations(replyToken, userId);
  } else if (action === 'change') {
    handleChangeFlow(replyToken, userId);
  } else if (action === 'waitlist') {
    handleWaitlistFlow(replyToken, userId);
  } else if (action === 'hours') {
    sendLineReply(replyToken, MessageTemplates.getBusinessHoursMessage());
  } else if (action === 'contact') {
    sendLineReply(replyToken, MessageTemplates.getContactMessage());
  } else {
    if (!handleLLMQuery(replyToken, text)) {
      var welcomeData = MessageTemplates.getWelcomeMessage();
      sendQuickReply(replyToken, welcomeData.text, welcomeData.quickReplies);
    }
  }
}

/**
 * Handle waitlist flow
 */
function handleWaitlistFlow(replyToken, userId) {
  setUserState(userId, USER_STATES.AWAITING_WAITLIST_TIME, {});
  sendQuickReply(replyToken, '空き枠通知の登録をします。\n\n希望の時間帯を選択してください。', [
    { label: '午前中', text: '午前中' },
    { label: '午後', text: '午後' },
    { label: 'いつでもOK', text: 'いつでもOK' },
    { label: 'やめる', text: 'やめる' }
  ]);
}

/**
 * Show read-only reservation list for the user
 */
function handleViewReservations(replyToken, userId) {
  var reservations = getReservationsByLineUserId(userId);
  var active = [];
  for (var i = 0; i < reservations.length; i++) {
    var r = reservations[i];
    if (r.status === RESERVATION_STATUS.CONFIRMED || r.status === RESERVATION_STATUS.PENDING) {
      active.push(r);
    }
  }

  if (active.length === 0) {
    sendQuickReply(replyToken, '現在予約はありません。\n\n「予約する」から新しく予約できます。', [
      { label: '予約する', text: '予約する' },
      { label: 'メニューに戻る', text: 'メニュー' }
    ]);
    return;
  }

  var msg = '【現在の予約】\n\n';
  for (var j = 0; j < active.length; j++) {
    var res = active[j];
    var statusLabel = res.status === RESERVATION_STATUS.CONFIRMED ? '確定' : '支払待ち';
    msg += (j + 1) + '. ' + res.reserved_date + ' ' + res.reserved_start + ' - ' + (res.reserved_end || '') + '\n';
    msg += '   ' + res.menu_type + ' / ' + statusLabel;
    if (res.deposit_status === DEPOSIT_STATUS.PAID) {
      msg += ' / デポジット済';
    }
    msg += '\n\n';
  }
  msg += '変更・キャンセルは「予約変更・キャンセル」からどうぞ。';

  sendQuickReply(replyToken, msg, [
    { label: '予約変更・キャンセル', text: '予約変更・キャンセル' },
    { label: '予約する', text: '予約する' },
    { label: 'メニューに戻る', text: 'メニュー' }
  ]);
}

/**
 * Handle awaiting waitlist time preference
 */
function handleAwaitingWaitlistTime(text, replyToken, userId) {
  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, '空き枠通知の登録を中止しました。');
    return;
  }

  var timeMap = {
    '午前中': 'Morning',
    '午後': 'Afternoon',
    'いつでもOK': 'Any'
  };
  var preferredTime = timeMap[text];
  if (!preferredTime) {
    sendQuickReply(replyToken, '時間帯を選択してください。', [
      { label: '午前中', text: '午前中' },
      { label: '午後', text: '午後' },
      { label: 'いつでもOK', text: 'いつでもOK' },
      { label: 'やめる', text: 'やめる' }
    ]);
    return;
  }

  // Check if already on waitlist
  var existing = getWaitlistReservations();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].line_display_name === userId) {
      clearUserState(userId);
      sendQuickReply(replyToken, '既に空き枠通知に登録されています。\n\n希望時間帯を変更する場合は管理者にお問い合わせください。', [
        { label: '予約する', text: '予約する' },
        { label: 'やめる', text: 'やめる' }
      ]);
      return;
    }
  }

  var phone = '';
  var lastRes = getLastReservationByLineUserId(userId);
  if (lastRes && lastRes.phone) {
    phone = lastRes.phone;
  }

  addToWaitlist({
    line_display_name: userId,
    phone: phone,
    preferred_time: preferredTime,
    same_day_ok: 'Y',
    notes: 'Registered via LINE bot'
  });

  clearUserState(userId);
  var confirmMsg = '空き枠通知に登録しました！\n\n' +
    '【登録内容】\n' +
    '希望時間帯: ' + text + '\n' +
    '当日空き枠: 可\n\n' +
    'キャンセルが出た場合、優先的に通知をお送りします。\n' +
    '通知は24時間以内に1回までです。';
  sendQuickReply(replyToken, confirmMsg, [
    { label: '予約する', text: '予約する' },
    { label: 'メニューに戻る', text: 'メニュー' }
  ]);
  appendLogRow('INFO', 'Waitlist registered: ' + userId + ' preferred: ' + preferredTime);
}

/**
 * Handle waitlist slot reservation (from "この枠を予約する" button)
 */
function handleWaitlistSlotReservation(replyToken, userId, date, time) {
  // Check if slot is still available
  var bookedSlots = getBookedSlotsForDate(date);
  var bookedCount = bookedSlots[time] || 0;
  if (bookedCount >= getMaxConcurrentBookings()) {
    sendQuickReply(replyToken, '申し訳ございません、この枠は既に他の方が予約しました。\n\n再度「当日空き枠通知を受け取る」から登録ください。', [
      { label: '空き枠通知を受け取る', text: '当日空き枠通知を受け取る' },
      { label: '予約する', text: '予約する' }
    ]);
    return;
  }

  // Get user info from last reservation
  var lastRes = getLastReservationByLineUserId(userId);
  if (!lastRes || !lastRes.patient_name) {
    sendQuickReply(replyToken, '空き枠の予約には事前の予約履歴が必要です。\n\n「予約する」からまず予約をお願いします。', [
      { label: '予約する', text: '予約する' }
    ]);
    return;
  }

  var tempData = {
    patient_name: lastRes.patient_name,
    phone: lastRes.phone || '',
    is_returning: true,
    menu_type: '再診（30分）',
    visit_type: VISIT_TYPE.REPEAT,
    reserved_date: date,
    reserved_start: time,
    reserved_end: calculateEndTime(time, getTreatmentDuration('再診（30分）'))
  };

  createReservationAndGoToPayment(replyToken, userId, tempData);
}

/**
 * Handle follow event
 */
function handleFollow(userId, replyToken) {
  var profile = getLineProfile(userId);
  var displayName = profile ? profile.displayName : '患者さん';

  appendLogRow('INFO', 'User followed: ' + userId + ' (' + displayName + ')');

  // Personalize for returning users
  var lastReservation = getLastReservationByLineUserId(userId);
  if (lastReservation && lastReservation.patient_name) {
    var welcomeMsg = displayName + 'さん、おかえりなさい！\n\n' +
      '前回は「' + lastReservation.patient_name + '」様としてご来院いただきました。\n' +
      '引き続き「予約する」からご予約いただけます。';
    if (replyToken) {
      sendQuickReply(replyToken, welcomeMsg, [
        { label: '予約する', text: '予約する' },
        { label: '営業時間・アクセス', text: '営業時間・アクセス' }
      ]);
    } else {
      sendLinePush(userId, welcomeMsg);
    }
    return;
  }

  var welcomeData = MessageTemplates.getWelcomeMessage();
  if (replyToken) {
    sendQuickReply(replyToken, welcomeData.text, welcomeData.quickReplies);
  } else {
    sendLinePush(userId, welcomeData.text);
  }
}

/**
 * Handle unfollow event
 */
function handleUnfollow(userId) {
  appendLogRow('INFO', 'User unfollowed: ' + userId);
  clearUserState(userId);
}
