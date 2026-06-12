/**
 * FollowUpService - 来院後自動フォローアップ
 *
 * 予約のreserved_end時刻から指定時間後（デフォルト24時間）に
 * 「お疲れ様でした」メッセージを自動送信する。
 * GASトリガーから60分ごとに呼び出される。
 */

/**
 * 送信対象のフォローアップメッセージを送信
 * トリガー: 60分ごと
 */
function sendPostVisitFollowUps() {
  _ensureReservationCache();

  var hoursAfter = getFollowUpHoursAfter();
  var now = new Date();
  var sentCount = 0;

  // Snapshot the cache — updateReservation invalidates it mid-loop
  var cache = _reservationCache.slice();

  for (var i = 0; i < cache.length; i++) {
    var r = cache[i];
    if (r.status !== RESERVATION_STATUS.VISITED) continue;
    if (r.follow_up_sent === 'Y') continue;
    if (!r.reserved_date || !r.reserved_end) continue;
    if (!r.line_display_name) continue;

    // Calculate the follow-up target time
    var endDateTime = _parseDateTime(r.reserved_date, r.reserved_end);
    if (!endDateTime) continue;

    var followUpTime = new Date(endDateTime.getTime() + hoursAfter * 60 * 60 * 1000);

    // Check if we're within the current trigger window (±30 min)
    var diff = now.getTime() - followUpTime.getTime();
    if (diff < 0 || diff > 30 * 60 * 1000) continue;

    // Send follow-up message (review request takes priority when enabled)
    var locale = 'ja';

    try {
      if (isFeatureReviewRequestEnabled()) {
        var ratingReplies = [
          {label: '★5', text: '★5'},
          {label: '★4', text: '★4'},
          {label: '★3', text: '★3'},
          {label: '★2', text: '★2'},
          {label: '★1', text: '★1'},
          {label: 'やめる', text: 'やめる'}
        ];
        sendLinePushQuickReply(
          r.line_display_name,
          'この度はご来院いただき、ありがとうございました！\n満足度を教えていただけますか？',
          ratingReplies
        );
        setUserState(r.line_display_name, USER_STATES.AWAITING_REVIEW_RATING, {reservation_id: r.id});
      } else {
        var msg = MessageTemplates.getPostVisitFollowUpMessage(locale);
        sendLinePushQuickReply(r.line_display_name, msg.text, msg.quickReplies);
      }
      updateReservation(r.id, { follow_up_sent: 'Y' });
      sentCount++;
      appendLogRow('INFO', 'Follow-up sent for reservation: ' + r.id);
    } catch (e) {
      appendLogRow('ERROR', 'Follow-up failed for ' + r.id + ': ' + e.message);
    }
  }

  if (sentCount > 0) {
    appendLogRow('INFO', 'Follow-up batch complete: ' + sentCount + ' messages sent');
  }
}

/**
 * Parse date string (yyyy/MM/dd) and time string (HH:mm) into Date object
 */
function _parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  var dateParts = dateStr.split('/');
  var timeParts = timeStr.split(':');
  if (dateParts.length < 3 || timeParts.length < 2) return null;

  var year = parseInt(dateParts[0]);
  var month = parseInt(dateParts[1]) - 1;
  var day = parseInt(dateParts[2]);
  var hour = parseInt(timeParts[0]);
  var minute = parseInt(timeParts[1]);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;

  return new Date(year, month, day, hour, minute, 0);
}
