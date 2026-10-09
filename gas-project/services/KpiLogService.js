/**
 * KpiLogService - Phase 0 KPI集計のための予約イベント記録
 * （additive・spec §8）。
 * 予約処理ロジックは一切変更しない。
 * 成功/失敗パスから fire-and-forget で呼ばれる。
 * シート: 「KPI_LOG」
 * (5列: 日時, イベント種別, tenant_id, リクエストID, 起因)
 */
var KpiLogService = (function() {
  var SHEET_NAME = 'KPI_LOG';
  var VALID_EVENTS = ['success', 'failure'];
  var _testSheet = null;

  function _getSheet() {
    if (_testSheet) return _testSheet;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        '日時', 'イベント', 'tenant_id',
        'リクエストID', '起因'
      ]);
    }
    return sheet;
  }

  function logReservationEvent(
    eventType, tenantId, requestId, cause
  ) {
    if (VALID_EVENTS.indexOf(eventType) === -1) return;
    var now = Utilities.formatDate(
      new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'
    );
    _getSheet().appendRow([
      now, eventType, tenantId, requestId, cause
    ]);
  }

  function computeSuccessRate(rows) {
    var total = rows.length;
    var success = 0;
    for (var i = 0; i < total; i++) {
      if (rows[i][1] === 'success') success++;
    }
    var rate = total
      ? Math.round(success / total * 1000) / 10 : 0;
    return { total: total, success: success, rate: rate };
  }

  function getWeeklyRows() {
    var sheet = _getSheet();
    var last = sheet.getLastRow();
    if (last < 2) return [];
    return sheet.getRange(2, 1, last - 1, 5).getValues();
  }

  // テスト用（本番コードから呼ばないこと）
  function _setSheetForTest(sheet) { _testSheet = sheet; }

  return {
    logReservationEvent: logReservationEvent,
    computeSuccessRate: computeSuccessRate,
    getWeeklyRows: getWeeklyRows,
    _setSheetForTest: _setSheetForTest
  };
})();
