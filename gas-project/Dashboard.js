/**
 * Dashboard - KPI Visualization
 *
 * Rendering layer only. All data calculation is in KPIService.js
 * Uses Logger.log for sheet operations (no appendLogRow during sheet writes)
 */

/**
 * Create dashboard sheet
 */
function createDashboardSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheetName = 'Dashboard';

  var existingSheet = ss.getSheetByName(sheetName);
  if (existingSheet) {
    ss.deleteSheet(existingSheet);
  }

  var sheet = ss.insertSheet(sheetName);

  var currentKPIs = getCurrentWeekKPIs();
  var targets = compareKPIsToTargets(currentKPIs);

  // Header
  sheet.getRange(1, 1).setValue('予約管理システム - ダッシュボード');
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(18);

  // Current Week Summary
  sheet.getRange(3, 1).setValue('【今週のサマリー】');
  sheet.getRange(3, 1).setFontWeight('bold').setFontSize(14);

  var summaryData = [
    ['', '今週', '前週', '変化'],
    ['総予約件数', currentKPIs.total_reservations, '-', '-'],
    ['無断件数', currentKPIs.total_no_shows, '-', '-'],
    ['無断率', currentKPIs.no_show_rate + '%', '-', '-'],
    ['当日キャンセル', currentKPIs.same_day_cancellations, '-', '-'],
    ['再販通知回数', currentKPIs.resale_notifications, '-', '-'],
    ['再販成功数', currentKPIs.resale_success_count, '-', '-'],
    ['推定回収額', currentKPIs.estimated_recovered_revenue + '円', '-', '-']
  ];

  sheet.getRange(4, 1, summaryData.length, summaryData[0].length).setValues(summaryData);

  // KPI Targets
  sheet.getRange(13, 1).setValue('【KPI目標達成状況】');
  sheet.getRange(13, 1).setFontWeight('bold').setFontSize(14);

  var targetData = [
    ['', '目標', '実績', '達成'],
    ['無断率', targets.no_show_rate.target + '%', targets.no_show_rate.actual + '%', targets.no_show_rate.achieved ? '✓' : '✗'],
    ['再販率', targets.resale_rate.target + '%', targets.resale_rate.actual + '%', targets.resale_rate.achieved ? '✓' : '✗']
  ];

  sheet.getRange(14, 1, targetData.length, targetData[0].length).setValues(targetData);

  // Color coding
  for (var i = 0; i < targetData.length - 1; i++) {
    var achieved = (targetData[i + 1][3] === '✓');
    var cell = sheet.getRange(15 + i, 4);

    if (achieved) {
      cell.setBackground('#4CAF50').setFontColor('white');
    } else {
      cell.setBackground('#F44336').setFontColor('white');
    }
  }

  // Format columns
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 100);

  // Last updated timestamp
  sheet.getRange(20, 1).setValue('最終更新: ' + formatDateTime(new Date()));
  sheet.getRange(20, 1).setFontStyle('italic').setFontSize(10);

  appendLogRow('INFO', 'Dashboard created');
}

/**
 * Update existing dashboard
 */
function updateDashboard() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('Dashboard');

  if (!sheet) {
    createDashboardSheet();
    return;
  }

  var currentKPIs = getCurrentWeekKPIs();

  var summaryValues = [
    ['', currentKPIs.total_reservations, '-', '-'],
    ['', currentKPIs.total_no_shows, '-', '-'],
    ['', currentKPIs.no_show_rate + '%', '-', '-'],
    ['', currentKPIs.same_day_cancellations, '-', '-'],
    ['', currentKPIs.resale_notifications, '-', '-'],
    ['', currentKPIs.resale_success_count, '-', '-'],
    ['', currentKPIs.estimated_recovered_revenue + '円', '-', '-']
  ];

  sheet.getRange(5, 2, summaryValues.length, 4).setValues(summaryValues);

  var targets = compareKPIsToTargets(currentKPIs);

  sheet.getRange(15, 3).setValue(targets.no_show_rate.actual + '%');
  sheet.getRange(15, 4).setValue(targets.no_show_rate.achieved ? '✓' : '✗');

  sheet.getRange(16, 3).setValue(targets.resale_rate.actual + '%');
  sheet.getRange(16, 4).setValue(targets.resale_rate.achieved ? '✓' : '✗');

  sheet.getRange(20, 1).setValue('最終更新: ' + formatDateTime(new Date()));

  appendLogRow('INFO', 'Dashboard updated');
}

/**
 * Get dashboard summary for LINE message
 */
function getDashboardSummaryForLine() {
  var kpis = getCurrentWeekKPIs();
  var targets = compareKPIsToTargets(kpis);

  return '【今週の実績】\n\n' +
    '総予約: ' + kpis.total_reservations + '件\n' +
    '無断: ' + kpis.total_no_shows + '件 (' + kpis.no_show_rate + '%)\n' +
    '再販成功: ' + kpis.resale_success_count + '件\n\n' +
    '【目標達成】\n' +
    '無断率: ' + (targets.no_show_rate.achieved ? '✓' : '✗') + '\n' +
    '再販率: ' + (targets.resale_rate.achieved ? '✓' : '✗');
}

/**
 * Create waitlist dashboard
 */
function createWaitlistDashboard() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheetName = 'Waitlist Dashboard';

  var existingSheet = ss.getSheetByName(sheetName);
  if (existingSheet) {
    ss.deleteSheet(existingSheet);
  }

  var sheet = ss.insertSheet(sheetName);

  sheet.getRange(1, 1).setValue('待機リスト - ダッシュボード');
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(18);

  var waitlistEntries = getWaitlistReservations();
  var totalCount = waitlistEntries.length;
  var sameDayOkCount = waitlistEntries.filter(function(e) { return e.same_day_ok === 'Y'; }).length;

  sheet.getRange(3, 1).setValue('【待機リストサマリー】');
  sheet.getRange(3, 1).setFontWeight('bold').setFontSize(14);

  var summaryData = [
    ['総登録数', totalCount + '人'],
    ['当日OK', sameDayOkCount + '人'],
    ['直近24時間通知', '0人']
  ];

  sheet.getRange(4, 1, summaryData.length, 2).setValues(summaryData);

  sheet.getRange(7, 1).setValue('【登録者一覧】');
  sheet.getRange(7, 1).setFontWeight('bold').setFontSize(14);

  if (totalCount > 0) {
    var entriesData = [['ID', '電話', '希望時間', '当日OK', '最終通知']];

    for (var i = 0; i < Math.min(waitlistEntries.length, 20); i++) {
      var entry = waitlistEntries[i];
      entriesData.push([
        entry.id,
        entry.phone,
        entry.preferred_time,
        entry.same_day_ok === 'Y' ? '可' : '不可',
        entry.last_notified_at || 'なし'
      ]);
    }

    sheet.getRange(8, 1, entriesData.length, entriesData[0].length).setValues(entriesData);
  } else {
    sheet.getRange(8, 1).setValue('登録者なし');
  }

  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 150);

  appendLogRow('INFO', 'Waitlist dashboard created');
}
