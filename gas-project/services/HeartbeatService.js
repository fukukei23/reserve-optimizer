/**
 * HeartbeatService - 中央コントロールプレーンへの
 * 日次ハートビート送信（spec §4 C1）。
 * トリガー=既存の日次定期トリガー
 * （無イベント院の静的死対策・spec §4 C1ゲート）。
 * 失敗しても例外を投げない
 * （予約処理に影響しない・fire-and-forget）。
 */
var HeartbeatService = (function() {

  function buildPayload(tenantId, lastReservationAt) {
    // 非PIIのみ（spec §3ストア配置表）
    return {
      tenant_id: tenantId,
      last_reservation_at: lastReservationAt || null
    };
  }

  function send(
    tenantId, lastReservationAt, centralUrl, token, fetchImpl
  ) {
    var doFetch = fetchImpl || UrlFetchApp.fetch;
    var payload = buildPayload(tenantId, lastReservationAt);
    try {
      var response = doFetch(centralUrl + '/heartbeat', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      return response.getResponseCode() === 200;
    } catch (e) {
      // 中央障害時は諦める（次の定期トリガーで再試行）
      return false;
    }
  }

  /** 日次トリガーから呼ばれるエントリポイント。
   *  Token/URLは Script Properties。 */
  function sendDaily() {
    var props = PropertiesService.getScriptProperties();
    var tenantId = props.getProperty('TENANT_ID') || 'T0001';
    var url = props.getProperty('CENTRAL_URL');
    var token = props.getProperty('HEARTBEAT_TOKEN');
    if (!url || !token) return;
    // 予約サービスが更新（無ければnull）
    var lastReservationAt =
      props.getProperty('LAST_RESERVATION_AT');
    send(tenantId, lastReservationAt, url, token);
  }

  return {
    buildPayload: buildPayload,
    send: send,
    sendDaily: sendDaily
  };
})();
