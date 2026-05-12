/**
 * Waitlist Handler
 *
 * Handles waitlist registration flow and slot reservation.
 * Extracted from MessageRouter.js for separation of concerns.
 */

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
