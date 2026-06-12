/**
 * KarteHandler - 簡易施術カルテ入力フロー（スタッフ向け）
 *
 * トリガー: スタッフが「カルテ」と送信
 * フロー: 当日未記録予約一覧 → 予約選択 → メモ入力 → 保存
 */

/**
 * 「カルテ」トリガー — 当日の未記録予約一覧を表示する。
 */
function handleKarteTrigger(replyToken, userId) {
  if (!isFeatureKarteEnabled()) {
    sendLineReply(replyToken, 'カルテ機能は現在無効です。');
    return;
  }

  var unrecorded = getTodayUnrecordedReservations();

  if (unrecorded.length === 0) {
    sendLineReply(replyToken, '本日の未記録施術はありません。');
    return;
  }

  // 最大10件をQuickReplyで表示
  var replies = unrecorded.slice(0, 10).map(function(r) {
    var label = (r.patient_name || r.line_display_name || r.id) + ' ' + (r.reserved_start || '');
    label = label.slice(0, 20);
    return { label: label, text: 'カルテ:' + r.id };
  });
  replies.push({ label: 'キャンセル', text: 'カルテ:キャンセル' });

  sendQuickReply(replyToken, '施術カルテを記録する予約を選んでください。', replies);
}

/**
 * AWAITING_KARTE_SELECT ステート — 予約選択を処理する。
 */
function handleAwaitingKarteSelect(text, replyToken, userId) {
  if (text === 'カルテ:キャンセル' || text === 'キャンセル') {
    clearUserState(userId);
    sendLineReply(replyToken, 'カルテ記録をキャンセルしました。');
    return;
  }

  var reservationId = null;
  if (text.indexOf('カルテ:') === 0) {
    reservationId = text.slice(4);
  }

  if (!reservationId) {
    sendQuickReply(replyToken, '予約を選択してください。', [{ label: 'キャンセル', text: 'カルテ:キャンセル' }]);
    return;
  }

  var reservation = getReservationById(reservationId);
  if (!reservation) {
    clearUserState(userId);
    sendLineReply(replyToken, '予約が見つかりません。');
    return;
  }

  setUserState(userId, USER_STATES.AWAITING_KARTE_INPUT, {
    reservation_id: reservationId,
    patient_name: reservation.patient_name || reservation.line_display_name || '',
    line_user_id: reservation.line_display_name || '',
    treatment_date: reservation.reserved_date || ''
  });

  var patientName = reservation.patient_name || reservation.line_display_name || reservationId;
  sendLineReply(
    replyToken,
    '【' + patientName + '】の施術メモを入力してください。\n\n' +
    '例）腰部・骨盤矯正。左腸腰筋の緊張強め。次回は2週間後推奨。\n\n' +
    '「やめる」でキャンセル'
  );
}

/**
 * AWAITING_KARTE_INPUT ステート — 施術メモを受け取って保存する。
 */
function handleAwaitingKarteInput(text, replyToken, userId) {
  if (text === 'やめる' || text === 'キャンセル') {
    clearUserState(userId);
    sendLineReply(replyToken, 'カルテ記録をキャンセルしました。');
    return;
  }

  if (!text || !text.trim()) {
    sendLineReply(replyToken, '施術メモを入力してください。「やめる」でキャンセル');
    return;
  }

  var state = getUserState(userId);
  var ctx = state.context || {};

  clearUserState(userId);

  var result = saveKarte(ctx.reservation_id, {
    line_user_id:      ctx.line_user_id || '',
    patient_name:      ctx.patient_name || '',
    treatment_date:    ctx.treatment_date || '',
    treatment_content: text.trim()
  });

  if (!result.ok) {
    appendLogRow('ERROR', '[Karte] Save failed: ' + result.error);
    sendLineReply(replyToken, 'カルテの保存に失敗しました。もう一度お試しください。');
    return;
  }

  appendLogRow('INFO', '[Karte] Recorded ' + result.id + ' by ' + userId);
  sendLineReply(
    replyToken,
    '✅ カルテを記録しました。\n' +
    '患者: ' + (ctx.patient_name || ctx.reservation_id) + '\n' +
    'ID: ' + result.id
  );
}
