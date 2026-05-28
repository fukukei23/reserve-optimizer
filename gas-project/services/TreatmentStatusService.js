/**
 * TreatmentStatusService - 施術中自動応答
 *
 * 現在時刻がConfirmed予約の施術時間内かどうかを判定し、
 * 施術中の場合はLINEメッセージに自動応答する。
 */

function isCurrentlyInTreatment() {
  _ensureReservationCache();

  var now = new Date();
  var today = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd');
  var currentMinutes = now.getHours() * 60 + now.getMinutes();

  var todayReservations = _reservationsByDateMap[today] || [];
  for (var i = 0; i < todayReservations.length; i++) {
    var r = todayReservations[i];
    if (r.status !== 'Confirmed' && r.status !== 'Pending') continue;

    var startParts = r.reserved_start.split(':');
    var endParts = r.reserved_end.split(':');
    var startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    var endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

    if (currentMinutes >= startMin && currentMinutes < endMin) {
      return { inTreatment: true, estimatedEndTime: r.reserved_end };
    }
  }

  return { inTreatment: false, estimatedEndTime: null };
}

function sendTreatmentAutoResponse(replyToken, locale, estimatedEndTime) {
  var msg = MessageTemplates.getTreatmentAutoResponseMessage(estimatedEndTime, locale);
  sendQuickReply(replyToken, msg.text, msg.quickReplies);
}
