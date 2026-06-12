/**
 * ReviewHandler - 口コミ依頼フロー
 *
 * FEATURE_REVIEW_REQUEST フラグで有効化。
 * フォローアップ後に満足度（★1〜★5）を収集し、
 * ★4-5 → Google レビュー URL 送付
 * ★1-3 → 院長 LINE に即時通知 + 内部フィードバックメッセージ
 */

/**
 * 満足度評価入力を処理する
 */
function handleAwaitingReviewRating(text, replyToken, userId) {
  var state = getUserState(userId);
  var context = state.context || {};

  if (text === 'やめる') {
    clearUserState(userId);
    sendLineReply(replyToken, 'またのご来院をお待ちしております。');
    return;
  }

  var rating = _parseRating(text);
  if (!rating) {
    sendQuickReply(replyToken, '★1〜★5 のいずれかでお選びください。', _buildRatingQuickReplies());
    return;
  }

  clearUserState(userId);

  if (rating >= 4) {
    var reviewUrl = getGoogleReviewUrl();
    var msg = 'ありがとうございます！ ★' + rating + ' のご評価、とても励みになります。\n\nよろしければ口コミもぜひお願いいたします🙏\n' + reviewUrl;
    sendLineReply(replyToken, msg);
  } else {
    sendLineReply(replyToken, 'ご意見をお聞かせいただきありがとうございます。\n院長に申し伝え、サービス改善に活かしてまいります。');
    _notifyAdminLowRating(rating, userId, context.reservation_id);
  }

  appendLogRow('INFO', 'Review rating received: ' + rating + ' from ' + userId +
    (context.reservation_id ? ' for reservation ' + context.reservation_id : ''));
}

/**
 * "★3" or "3" など複数フォーマットを受け入れて 1〜5 の整数を返す。
 * 不正入力は null を返す。
 */
function _parseRating(text) {
  if (!text) return null;
  var s = String(text).trim().replace(/★/g, '');
  var n = parseInt(s, 10);
  if (isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

/**
 * ★1-3 受信時に管理者 LINE へプッシュ通知する
 */
function _notifyAdminLowRating(rating, userId, reservationId) {
  var adminId = getLineAdminUserId();
  if (!adminId) return;
  var msg = '⚠️ 低評価フィードバック\n評価: ★' + rating +
    '\nユーザー: ' + userId +
    (reservationId ? '\n予約ID: ' + reservationId : '');
  try {
    sendLinePush(adminId, msg);
  } catch (e) {
    appendLogRow('ERROR', 'Admin low-rating notify failed: ' + e.message);
  }
}

/**
 * 満足度選択用 QuickReply ボタンを生成する
 */
function _buildRatingQuickReplies() {
  return [
    {label: '★5', text: '★5'},
    {label: '★4', text: '★4'},
    {label: '★3', text: '★3'},
    {label: '★2', text: '★2'},
    {label: '★1', text: '★1'},
    {label: 'やめる', text: 'やめる'}
  ];
}
