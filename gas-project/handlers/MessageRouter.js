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
 * Declarative state dispatch table.
 * Maps USER_STATES → handler function(text, replyToken, userId).
 * Add new states here — no switch statement modification needed.
 */
var STATE_DISPATCH = null;

function _getStateDispatch() {
  if (STATE_DISPATCH) return STATE_DISPATCH;
  STATE_DISPATCH = {};
  STATE_DISPATCH[USER_STATES.IDLE]                   = handleIdleState;
  STATE_DISPATCH[USER_STATES.AWAITING_NAME]          = handleAwaitingName;
  STATE_DISPATCH[USER_STATES.AWAITING_PHONE]         = handleAwaitingPhone;
  STATE_DISPATCH[USER_STATES.AWAITING_DATE]          = handleAwaitingDate;
  STATE_DISPATCH[USER_STATES.AWAITING_TIME]          = handleAwaitingTime;
  STATE_DISPATCH[USER_STATES.AWAITING_TREATMENT]     = handleAwaitingTreatment;
  STATE_DISPATCH[USER_STATES.AWAITING_PAYMENT]       = handleAwaitingPayment;
  STATE_DISPATCH[USER_STATES.AWAITING_STAFF]         = handleAwaitingStaff;
  STATE_DISPATCH[USER_STATES.AWAITING_CANCEL_SELECT] = handleAwaitingCancelSelect;
  STATE_DISPATCH[USER_STATES.AWAITING_CANCEL_CONFIRM]= handleAwaitingCancelConfirm;
  STATE_DISPATCH[USER_STATES.AWAITING_CHANGE_SELECT] = handleAwaitingChangeSelect;
  STATE_DISPATCH[USER_STATES.AWAITING_CHANGE_FIELD]  = handleAwaitingChangeField;
  STATE_DISPATCH[USER_STATES.AWAITING_CHANGE_DATE]   = handleAwaitingChangeDate;
  STATE_DISPATCH[USER_STATES.AWAITING_CHANGE_TIME]   = handleAwaitingChangeTime;
  STATE_DISPATCH[USER_STATES.AWAITING_CHANGE_TREATMENT] = handleAwaitingChangeTreatment;
  STATE_DISPATCH[USER_STATES.AWAITING_CHANGE_CONFIRM]= handleAwaitingChangeConfirm;
  STATE_DISPATCH[USER_STATES.AWAITING_WAITLIST_TIME] = handleAwaitingWaitlistTime;
  STATE_DISPATCH[USER_STATES.AWAITING_TICKET_SELECT] = handleAwaitingTicketSelect;
  STATE_DISPATCH[USER_STATES.AWAITING_COUPON]         = handleAwaitingCoupon;
  STATE_DISPATCH[USER_STATES.AWAITING_REVIEW_RATING]  = handleAwaitingReviewRating;
  STATE_DISPATCH[USER_STATES.AWAITING_KARTE_SELECT]   = handleAwaitingKarteSelect;
  STATE_DISPATCH[USER_STATES.AWAITING_KARTE_INPUT]    = handleAwaitingKarteInput;
  return STATE_DISPATCH;
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

  // Input validation: message length + sanitization (T08)
  var lengthCheck = validateMessageLength(text);
  if (!lengthCheck.valid) {
    sendLineReply(replyToken, lengthCheck.errorMessage);
    return;
  }
  text = sanitizeInput(text);
  if (!text) {
    return;
  }

  var userState = getUserState(userId);
  var _locale = getUserLocale(userId);

  logLineMessage({userId: userId}, text);

  // Auto-response during treatment (only for IDLE users — don't interrupt active conversations)
  if (userState.state === USER_STATES.IDLE) {
    var treatmentStatus = isCurrentlyInTreatment();
    if (treatmentStatus.inTreatment) {
      sendTreatmentAutoResponse(replyToken, _locale, treatmentStatus.estimatedEndTime);
      return;
    }
  }

  // Global intercepts — handled before state dispatch
  if (_handleGlobalInput(text, replyToken, userId, userState.state, _locale)) {
    return;
  }

  // Route based on current state via dispatch table
  var dispatch = _getStateDispatch();
  var handler = dispatch[userState.state];
  if (handler) {
    handler(text, replyToken, userId);
  } else {
    sendLineReply(replyToken, t('router.can_help', _locale));
  }
}

/**
 * Handle inputs that intercept before state dispatch.
 * Returns true if the input was consumed (reply already sent).
 */
function _handleGlobalInput(text, replyToken, userId, currentState, _locale) {
  // Contact requests bypass all states
  if (text === '人間に問い合わせる' || text === 'お問い合わせ') {
    sendLineReply(replyToken, MessageTemplates.getContactMessage(_locale));
    clearUserState(userId);
    return true;
  }

  // Settings: reminder timing (SET_REMINDER:<time>)
  if (text.indexOf('SET_REMINDER:') === 0) {
    var timing = text.substring('SET_REMINDER:'.length);
    setUserPref(userId, 'reminder_timing', timing);
    sendLineReply(replyToken, t('router.reminder_changed', _locale) + timing + t('router.reminder_changed_suffix', _locale));
    return true;
  }

  // Waitlist slot reservation (RESERVE_SLOT:<date>:<time>)
  if (text.indexOf('RESERVE_SLOT:') === 0) {
    var parts = text.substring('RESERVE_SLOT:'.length).split(':');
    if (parts.length >= 2) {
      handleWaitlistSlotReservation(replyToken, userId, parts[0], parts[1]);
      return true;
    }
  }

  // Ticket purchase (TICKET_BUY:<pkg>)
  if (text.indexOf('TICKET_BUY:') === 0) {
    handleTicketPurchase(replyToken, userId, text.substring('TICKET_BUY:'.length));
    return true;
  }

  // Ticket balance
  if (text === 'TICKET_BALANCE') {
    handleTicketBalance(replyToken, userId);
    return true;
  }

  // Rich menu: business hours (works in any state)
  if (text === '営業時間・アクセス') {
    sendLineReply(replyToken, MessageTemplates.getBusinessHoursMessage(_locale));
    clearUserState(userId);
    return true;
  }

  // Navigation: cancel / back / jump (non-IDLE only)
  if (currentState !== USER_STATES.IDLE) {
    if (text === 'やめる' || text === '本当にやめる') {
      clearUserState(userId);
      sendLineReply(replyToken, t('router.cancelled', _locale));
      return true;
    }
    if (text === '戻る') {
      clearUserState(userId);
      var menuData = MessageTemplates.getWelcomeMessage(_locale);
      sendQuickReply(replyToken, t('router.back_to_menu', _locale), menuData.quickReplies);
      return true;
    }
    if (text === '予約する') {
      clearUserState(userId);
      startReservationFlow(replyToken, userId);
      return true;
    }
    if (text === '予約変更・キャンセル') {
      clearUserState(userId);
      handleChangeFlow(replyToken, userId);
      return true;
    }
  }

  // Admin / slash commands
  if (text.charAt(0) === '/') {
    handleCommand(text, replyToken, userId);
    return true;
  }

  return false;
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
        sendLineReply(replyToken, formatHealthReport());
      } else {
        sendLineReply(replyToken, t('router.admin_only', _locale));
      }
      break;
    case '/cleanup':
      if (isAdmin) {
        cleanupExpiredStates();
        sendLineReply(replyToken, t('router.cleanup_done', _locale));
      } else {
        sendLineReply(replyToken, t('router.admin_only', _locale));
      }
      break;
    case '/karte':
      if (isAdmin && isFeatureKarteEnabled()) {
        handleKarteTrigger(replyToken, userId);
      } else if (!isAdmin) {
        sendLineReply(replyToken, t('router.admin_only', _locale));
      } else {
        sendLineReply(replyToken, 'カルテ機能は現在無効です。');
      }
      break;
    case '/stamp':
      if (isFeatureStampCardEnabled()) {
        var stampText = getStampSummaryText(userId);
        sendLineReply(replyToken, stampText);
      } else {
        sendLineReply(replyToken, 'スタンプカード機能は現在無効です。');
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
      sendLineReply(replyToken, t('router.invalid_command', _locale));
  }
}

/**
 * Keyword map for idle state routing — O(1) lookup
 * Keys: normalized keyword → Values: action identifier
 * Prefix-match keywords (e.g. '予約' matches '予約したい') are stored in _KEYWORD_PREFIXES
 * and checked after exact match fails.
 */
var _KEYWORD_MAP = {
  // Japanese
  '予約する': 'reserve', '予約したい': 'reserve', '新規予約': 'reserve',
  '予約お願い': 'reserve', '予約おねがい': 'reserve',
  '予約確認': 'view', '予約状況': 'view', 'マイ予約': 'view',
  '予約変更・キャンセル': 'change', '予約変更': 'change', '変更': 'change',
  'キャンセル': 'change', '予約キャンセル': 'change',
  '変更したい': 'change', 'キャンセルしたい': 'change',
  '当日空き枠通知を受け取る': 'waitlist', '空き枠通知': 'waitlist',
  'キャンセル待ち': 'waitlist', '空き通知': 'waitlist', 'ウェイティング': 'waitlist',
  '回数券': 'ticket', 'パック': 'ticket', 'パッケージ': 'ticket',
  '営業時間・アクセス': 'hours', '営業時間': 'hours', 'アクセス': 'hours',
  '住所': 'hours', 'どこ': 'hours', '場所': 'hours', '何時': 'hours', '時間': 'hours',
  'お問い合わせ': 'contact', 'お問合せ': 'contact',
  '電話': 'contact', '電話番号': 'contact', '連絡': 'contact',
  // English
  'book': 'reserve', 'reserve': 'reserve', 'appointment': 'reserve',
  'my reservations': 'view', 'my booking': 'view', 'view': 'view',
  'change': 'change', 'cancel': 'change',
  'modify': 'change', 'reschedule': 'change',
  'waitlist': 'waitlist', 'notify': 'waitlist', 'alert': 'waitlist',
  'ticket': 'ticket', 'package': 'ticket', 'pack': 'ticket',
  'hours': 'hours', 'location': 'hours', 'address': 'hours',
  'when': 'hours', 'where': 'hours',
  'contact': 'contact', 'phone': 'contact', 'call': 'contact'
};

// Short keywords that also match as prefix (e.g. '予約' matches '予約したい')
var _KEYWORD_PREFIXES = ['予約', 'book'];

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
  var _locale = getUserLocale(userId);

  if (action === 'reserve') {
    startReservationFlow(replyToken, userId);
  } else if (action === 'view') {
    handleViewReservations(replyToken, userId);
  } else if (action === 'change') {
    handleChangeFlow(replyToken, userId);
  } else if (action === 'waitlist') {
    handleWaitlistFlow(replyToken, userId);
  } else if (action === 'ticket') {
    handleTicketFlow(replyToken, userId);
  } else if (action === 'hours') {
    sendLineReply(replyToken, MessageTemplates.getBusinessHoursMessage(_locale));
  } else if (action === 'contact') {
    sendLineReply(replyToken, MessageTemplates.getContactMessage(_locale));
  } else {
    if (!handleLLMQuery(replyToken, text)) {
      var welcomeData = MessageTemplates.getWelcomeMessage(_locale);
      sendQuickReply(replyToken, welcomeData.text, welcomeData.quickReplies);
    }
  }
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

  var welcomeData = MessageTemplates.getWelcomeMessage(getUserLocale(userId));
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

// --- Ticket flow handlers ---

/**
 * Start ticket purchase flow
 */
function handleTicketFlow(replyToken, userId) {
  var _locale = getUserLocale(userId);
  var msgData = MessageTemplates.getTicketSelectMessage(_locale);
  sendQuickReply(replyToken, msgData.text, msgData.quickReplies);
}

/**
 * Handle awaiting ticket package selection
 */
function handleAwaitingTicketSelect(text, replyToken, userId) {
  if (text === 'TICKET_BALANCE') {
    handleTicketBalance(replyToken, userId);
    return;
  }
  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, t('router.cancelled', getUserLocale(userId)));
    return;
  }
  // Redirect to purchase handler
  if (text.indexOf('TICKET_BUY:') === 0) {
    var pkg = text.substring('TICKET_BUY:'.length);
    handleTicketPurchase(replyToken, userId, pkg);
    return;
  }
  // Unknown input — show menu again
  handleTicketFlow(replyToken, userId);
}

/**
 * Handle ticket package purchase
 */
function handleTicketPurchase(replyToken, userId, packageType) {
  var _locale = getUserLocale(userId);
  var pkg = TICKET_PACKAGES[packageType];
  if (!pkg) {
    handleTicketFlow(replyToken, userId);
    return;
  }

  sendLineReply(replyToken, t('ticket.creating', _locale));

  var paymentLink = createTicketPaymentLink(packageType, userId);
  if (paymentLink) {
    var message = MessageTemplates.getTicketPurchaseLinkMessage(paymentLink, _locale);
    sendLinePushQuickReply(userId, message, [
      { label: '支払完了', text: '支払完了' },
      { label: 'やめる', text: 'やめる' }
    ]);
  } else {
    sendLinePushQuickReply(userId, t('ticket.link_failed', _locale), [
      { label: '回数券', text: '回数券' },
      { label: 'やめる', text: 'やめる' }
    ]);
  }
  clearUserState(userId);
}

/**
 * Handle ticket balance check
 */
function handleTicketBalance(replyToken, userId) {
  var _locale = getUserLocale(userId);
  var ticket = getActiveTicketByUser(userId);
  var message = MessageTemplates.getTicketBalanceMessage(ticket, _locale);
  sendQuickReply(replyToken, message, [
    { label: t('welcome.reserve', _locale), text: t('welcome.reserve', _locale) },
    { label: '回数券', text: '回数券' },
    { label: 'やめる', text: 'やめる' }
  ]);
  clearUserState(userId);
}
