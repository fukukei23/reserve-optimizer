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
 * Fetch reservations for a page of IDs
 * @param {string[]} reservationIds - Full list of reservation IDs
 * @param {number} page - Current page (0-based)
 * @param {number} pageSize - Items per page
 * @returns {{ page: number, reservations: object[] }}
 */
function fetchReservationsPage(reservationIds, page, pageSize) {
  var startIdx = page * pageSize;
  var pageIds = reservationIds.slice(startIdx, startIdx + pageSize);
  var reservations = [];
  for (var i = 0; i < pageIds.length; i++) {
    var r = getReservationById(pageIds[i]);
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
    items.push({ label: '次の5件 ▶', text: '次の5件' });
  }
  if (page > 0) {
    items.push({ label: '◀ 前の5件', text: '前の5件' });
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
 * Keyword map for idle state routing — O(1) lookup
 * Keys: normalized keyword → Values: action identifier
 * Prefix-match keywords (e.g. '予約' matches '予約したい') are stored in _KEYWORD_PREFIXES
 * and checked after exact match fails.
 */
var _KEYWORD_MAP = {
  '予約する': 'reserve', '予約したい': 'reserve', '新規予約': 'reserve',
  '予約お願い': 'reserve', '予約おねがい': 'reserve',
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
  // TODO: Implement waitlist registration flow
  sendLineReply(replyToken, '待機リスト登録機能は準備中です。');
}

/**
 * Handle follow event
 */
function handleFollow(userId) {
  var profile = getLineProfile(userId);
  var displayName = profile ? profile.displayName : '患者さん';

  appendLogRow('INFO', 'User followed: ' + userId + ' (' + displayName + ')');

  var welcomeData = MessageTemplates.getWelcomeMessage();
  sendLinePush(userId, welcomeData.text);
}

/**
 * Handle unfollow event
 */
function handleUnfollow(userId) {
  appendLogRow('INFO', 'User unfollowed: ' + userId);
  clearUserState(userId);
}
