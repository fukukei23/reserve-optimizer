/**
 * QuickReport Service
 *
 * 毎朝の「実際の来院数」報告をLINEで収集し DAILY_REPORT シートへ記録。
 * 純粋ロジック（GAS API 非依存）と GAS API 依存部分で構成。
 *
 * 関連: docs/superpowers/specs/2026-07-26-reserve-optimizer-quickreport-design.md
 */

/**
 * 来院数入力のバリデーション（非負整数）。
 * @param {string} text スタッフの返信テキスト
 * @return {boolean}
 */
function isValidVisitsInput(text) {
  if (!text) return false;
  var trimmed = String(text).trim();
  if (trimmed === '') return false;
  return /^\d+$/.test(trimmed);
}

/**
 * 電話/窓口経由来院数 = 報告来院数 − Bot経由来店完了数（下限0）。
 * @param {number} reportedVisits スタッフ報告の実際の来院数
 * @param {number} botCompletedVisits Bot経由来店完了数
 * @return {number}
 */
function calcPhoneWindowVisits(reportedVisits, botCompletedVisits) {
  var diff = (reportedVisits || 0) - (botCompletedVisits || 0);
  return diff > 0 ? diff : 0;
}

/**
 * 指定日が営業日か（WORKING_DAYS はカンマ区切り曜日番号 0=日..6=土）。
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} workingDays '1,2,3,4,5'
 * @return {boolean}
 */
function isWorkingDay(dateStr, workingDays) {
  if (!dateStr || !workingDays) return false;
  var days = workingDays.split(',');
  var dow = new Date(dateStr + 'T00:00:00').getDay();
  return days.indexOf(String(dow)) !== -1;
}

/**
 * 昨日の日付文字列（YYYY-MM-DD・Asia/Tokyo）。
 * @return {string}
 */
function getYesterdayDateStr() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * DAILY_REPORT シートを取得（無ければ作成）。
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getDailyReportSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName(SHEET_NAMES.DAILY_REPORT);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, SHEET_NAMES.DAILY_REPORT, DAILY_REPORT_HEADERS);
  }
  return sheet;
}

/**
 * DAILY_REPORT シートから指定日の行インデックスを検索（無ければ0）。
 * @return {number} 1-based row index（0=未存在）
 */
function _findDailyReportRow(sheet, dateStr) {
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var dates = sheet.getRange(2, DAILY_REPORT_COLUMNS.DATE, lastRow - 1, 1).getValues();
  for (var i = 0; i < dates.length; i++) {
    if (String(dates[i][0]).slice(0, 10) === dateStr) return i + 2;
  }
  return 0;
}

/**
 * 昨日のBot実績（予約数・Bot経由来店完了数）を集計。
 * 完了判定は RESERVATION_STATUS.VISITED ('Visited')。
 * @return {{reservations: number, completed: number}}
 */
function getDailyBotStats() {
  var yest = getYesterdayDateStr();
  var sheet = getReservationsSheet();
  if (!sheet) return { reservations: 0, completed: 0 };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { reservations: 0, completed: 0 };

  var DATE_COL = RESERVATIONS_COLUMNS.RESERVED_DATE - 1;       // 0-based
  var STATUS_COL = RESERVATIONS_COLUMNS.STATUS - 1;
  var data = sheet.getRange(2, 1, lastRow - 1, RESERVATIONS_COLUMNS.RESERVED_DATE).getValues();

  var reservations = 0;
  var completed = 0;
  for (var i = 0; i < data.length; i++) {
    var rawDate = data[i][DATE_COL];
    if (!rawDate) continue;
    var dateStr = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rawDate).slice(0, 10);
    if (dateStr !== yest) continue;
    reservations++;
    if (String(data[i][STATUS_COL] || '') === RESERVATION_STATUS.VISITED) completed++;
  }
  return { reservations: reservations, completed: completed };
}

/**
 * DAILY_REPORT シートへ1日分の来院数を記録（同日内は上書き=1日1行）。
 * LockService で排他・書込失敗時3回リトライ・失敗時は管理者へLINE通知。
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} reportedVisits スタッフ報告の来院数
 * @param {string} reportedBy LINE userId
 * @return {boolean} 記録成功
 */
function recordDailyReport(dateStr, reportedVisits, reportedBy) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var stats = dateStr === getYesterdayDateStr() ? getDailyBotStats() : { reservations: 0, completed: 0 };
    var phoneWindow = calcPhoneWindowVisits(reportedVisits, stats.completed);
    var row = [
      dateStr, reportedVisits, stats.reservations, stats.completed,
      phoneWindow, new Date().toISOString(), reportedBy
    ];

    var sheet = getDailyReportSheet();
    var existingRowIdx = _findDailyReportRow(sheet, dateStr);

    var lastErr = null;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        if (existingRowIdx > 0) {
          sheet.getRange(existingRowIdx, 1, 1, row.length).setValues([row]);
        } else {
          sheet.appendRow(row);
        }
        return true;
      } catch (e) {
        lastErr = e;
        appendLogRow('WARN', 'recordDailyReport attempt ' + (attempt + 1) + ' failed: ' + e.message);
        Utilities.sleep(1000);
      }
    }
    _notifyRecordFailure(dateStr, lastErr ? lastErr.message : 'unknown');
    return false;
  } finally {
    lock.releaseLock();
  }
}

/**
 * QuickReport 送信先（管理者配列・カンマ区切り LINE_ADMIN_USER_ID を展開）。
 * @return {string[]}
 */
function getQuickReportRecipients() {
  var raw = getProperty(PROPERTY_KEYS.LINE_ADMIN_USER_ID, '');
  if (!raw) return [];
  return raw.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
}

/**
 * 毎朝のQuickReportを管理者へ送信（時限トリガーから呼出）。
 * 休診日（昨日）はスキップ。送信後 QUOTE_REPORT_AWAITING 状態をセット。
 */
function sendQuickReport() {
  var yest = getYesterdayDateStr();
  var workingDays = getProperty(PROPERTY_KEYS.WORKING_DAYS, '1,2,3,4,5');
  if (!isWorkingDay(yest, workingDays)) {
    appendLogRow('INFO', 'QuickReport: 昨日(' + yest + ')は休診日のためスキップ');
    return;
  }

  var stats = getDailyBotStats();
  var adminIds = getQuickReportRecipients();
  if (adminIds.length === 0) {
    appendLogRow('WARN', 'QuickReport: 送信先0件・トリガー生存監視要');
    return;
  }

  var msg = buildQuickReportMessage(stats.reservations);
  for (var i = 0; i < adminIds.length; i++) {
    _sendPush(adminIds[i], [msg]);
    setUserState(adminIds[i], 'QUICK_REPORT_AWAITING', { date: yest });
  }
  appendLogRow('INFO', 'QuickReport 送信: ' + adminIds.length + '件 / 昨日Bot予約 ' + stats.reservations);
}

/**
 * 昼のリマインド：前日分の来院数が未記録ならリマインド送信。
 */
function sendQuickReportReminder() {
  var yest = getYesterdayDateStr();
  var sheet = getDailyReportSheet();
  if (_findDailyReportRow(sheet, yest) > 0) return;  // 記録済み

  var adminIds = getQuickReportRecipients();
  var msg = buildQuickReportMessage(getDailyBotStats().reservations);
  for (var i = 0; i < adminIds.length; i++) {
    _sendPush(adminIds[i], [msg]);
    setUserState(adminIds[i], 'QUICK_REPORT_AWAITING', { date: yest });
  }
  appendLogRow('INFO', 'QuickReport リマインド送信: 昨日(' + yest + ')分未記録');
}

/**
 * 記録失敗を管理者へ通知。
 * @param {string} dateStr
 * @param {string} errMsg
 */
function _notifyRecordFailure(dateStr, errMsg) {
  var adminIds = getQuickReportRecipients();
  var text = '【QuickReport記録失敗】' + dateStr + '分の来院数記録に失敗: ' + errMsg;
  for (var i = 0; i < adminIds.length; i++) {
    _sendPush(adminIds[i], [{ type: 'text', text: text }]);
  }
}


