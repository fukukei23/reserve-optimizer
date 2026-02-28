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
  AWAITING_PAYMENT: 'AWAITING_PAYMENT'
};

// Temporary data storage (24-hour TTL)
var TEMP_DATA_KEY_PREFIX = 'user_temp_';

/**
 * Handle LINE webhook event
 */
function handleLineEvent(event) {
  var eventType = event.type;
  var source = event.source;
  var userId = source.userId;

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
  var tempData = getUserState(userId).context;
  tempData.patient_name = text;

  setUserState(userId, USER_STATES.AWAITING_PHONE, tempData);
  sendLineReply(replyToken, 'お名前を確認しました。\n\n電話番号を入力してください（例: 09012345678）。');
}

/**
 * Handle awaiting phone
 */
function handleAwaitingPhone(text, replyToken, userId) {
  var tempData = getUserState(userId).context;

  // Validate phone number
  if (!validatePhoneNumber(text)) {
    sendLineReply(replyToken, '電話番号の形式が正しくありません。もう一度入力してください（例: 09012345678）。');
    return;
  }

  tempData.phone = text;

  setUserState(userId, USER_STATES.AWAITING_DATE, tempData);
  sendLineReply(replyToken, '電話番号を確認しました。\n\n希望日を入力してください（例: 来週の月曜日、または 2026-02-20）。');
}

/**
 * Handle awaiting date
 */
function handleAwaitingDate(text, replyToken, userId) {
  var tempData = getUserState(userId).context;

  // Parse date
  var parsedDate = parseDateInput(text);
  if (!parsedDate) {
    sendLineReply(replyToken, '日付の形式が正しくありません。もう一度入力してください（例: 来週の月曜日、または 2026-02-20）。');
    return;
  }

  tempData.reserved_date = parsedDate;

  setUserState(userId, USER_STATES.AWAITING_TIME, tempData);
  sendLineReply(replyToken, '日付を確認しました。\n\n希望時間を入力してください（例: 10:00）。');
}

/**
 * Handle awaiting time
 */
function handleAwaitingTime(text, replyToken, userId) {
  var tempData = getUserState(userId).context;

  // Validate time
  if (!validateTime(text)) {
    sendLineReply(replyToken, '時間の形式が正しくありません。もう一度入力してください（例: 10:00）。');
    return;
  }

  tempData.reserved_start = text;
  tempData.reserved_end = calculateEndTime(text);

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

  // Move to payment awaiting state
  setUserState(userId, USER_STATES.AWAITING_PAYMENT, {
    reservation_id: result.id
  });

  // Send confirmation with payment link
  var paymentLink = createPaymentLink(
    result.id,
    tempData.patient_name,
    getDepositAmount()
  );

  if (paymentLink) {
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

  var reservation = getReservationById(reservationId);

  if (reservation && reservation.deposit_status === DEPOSIT_STATUS.PAID) {
    sendLineReply(replyToken, 'お支払いが確認されました。予約が確定しました！');
    clearUserState(userId);
  } else {
    sendLineReply(replyToken, 'お支払いがまだ完了していません。\n\n先ほど送信したリンクからデポジットをお支払いください。');
  }
}

/**
 * Handle change flow
 */
function handleChangeFlow(replyToken, userId) {
  // TODO: Implement change flow
  sendLineReply(replyToken, '予約変更機能は準備中です。管理者にお問い合わせください。');
}

/**
 * Handle cancel flow
 */
function handleCancelFlow(replyToken, userId) {
  // TODO: Implement cancel flow
  sendLineReply(replyToken, 'キャンセル機能は準備中です。管理者にお問い合わせください。');
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
 * Parse date input
 */
function parseDateInput(text) {
  // Simple implementation - could be enhanced with natural language parsing
  var patterns = [
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/ // MM/DD/YYYY
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) {
      return match[0];
    }
  }

  return null;
}
