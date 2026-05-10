/**
 * KPI Service - Key Performance Indicators
 *
 * Pure data calculation layer. No HTML/sheet rendering.
 * Rendering is handled by Dashboard.js
 */

/**
 * Calculate weekly KPIs
 */
function calculateWeeklyKPIs(weekStart) {
  var sheet = getReservationsSheet();
  var data = sheet.getDataRange().getValues();

  var weekEnd = addDays(parseDate(weekStart), 6);

  var stats = {
    total_reservations: 0,
    total_no_shows: 0,
    same_day_cancellations: 0,
    resale_notifications: 0,
    resale_success_count: 0,
    total_deposits: 0,
    forfeited_deposits: 0
  };

  for (var i = 1; i < data.length; i++) {
    var reservation = data[i];
    var reservedDate = parseDate(reservation[7]);

    if (!reservedDate || reservedDate < parseDate(weekStart) || reservedDate > weekEnd) {
      continue;
    }

    var status = reservation[10];
    var depositStatus = reservation[13];
    var depositAmount = reservation[12];
    var resaleNotified = reservation[17];
    var resaleSuccess = reservation[18];

    if (status !== RESERVATION_STATUS.PENDING) {
      stats.total_reservations++;
    }

    if (status === RESERVATION_STATUS.NO_SHOW) {
      stats.total_no_shows++;
    }

    if (status === RESERVATION_STATUS.CANCELLED) {
      var cancelTime = new Date(reservation[16]);
      var reservedDateTime = new Date(reservation[7] + 'T' + reservation[8] + ':00');
      var hoursUntil = (reservedDateTime - cancelTime) / (1000 * 60 * 60);
      if (hoursUntil < 24) {
        stats.same_day_cancellations++;
      }
    }

    if (resaleNotified === 'Y') {
      stats.resale_notifications++;
    }

    if (resaleSuccess === 'Y') {
      stats.resale_success_count++;
    }

    if (depositStatus === DEPOSIT_STATUS.PAID) {
      stats.total_deposits += depositAmount;
    }

    if (depositStatus === DEPOSIT_STATUS.FORFEITED) {
      stats.forfeited_deposits += depositAmount;
    }
  }

  var noShowRate = stats.total_reservations > 0
    ? ((stats.total_no_shows / stats.total_reservations) * 100).toFixed(2)
    : '0.00';

  var resaleRate = stats.same_day_cancellations > 0
    ? ((stats.resale_success_count / stats.same_day_cancellations) * 100).toFixed(2)
    : '0.00';

  var estimatedRecoveredRevenue = stats.resale_success_count * getAverageUnitPrice();

  return {
    week_start: weekStart,
    total_reservations: stats.total_reservations,
    total_no_shows: stats.total_no_shows,
    no_show_rate: noShowRate,
    same_day_cancellations: stats.same_day_cancellations,
    resale_notifications: stats.resale_notifications,
    resale_success_count: stats.resale_success_count,
    resale_rate: resaleRate,
    total_deposits: stats.total_deposits,
    forfeited_deposits: stats.forfeited_deposits,
    estimated_recovered_revenue: estimatedRecoveredRevenue
  };
}

/**
 * Save weekly summary to spreadsheet
 */
function saveWeeklySummary(kpiData) {
  var sheet = getWeeklySummarySheet();

  var row = [
    kpiData.week_start,
    kpiData.total_reservations,
    kpiData.total_no_shows,
    kpiData.no_show_rate,
    kpiData.same_day_cancellations,
    kpiData.resale_notifications,
    kpiData.resale_success_count,
    kpiData.estimated_recovered_revenue
  ];

  sheet.appendRow(row);
  appendLogRow('INFO', 'Saved weekly summary for: ' + kpiData.week_start);
}

/**
 * Generate and send weekly report
 */
function generateWeeklyReport() {
  appendLogRow('INFO', 'Generating weekly report...');

  var now = new Date();
  var weekStart = formatDate(getWeekStart(now));
  var kpiData = calculateWeeklyKPIs(weekStart);

  saveWeeklySummary(kpiData);

  var adminUserId = getLineAdminUserId();
  if (adminUserId) {
    var message = MessageTemplates.getWeeklySummaryMessage(kpiData);
    sendLinePush(adminUserId, message);
  }

  appendLogRow('INFO', 'Weekly report generated: ' + weekStart);
}

/**
 * Get KPI trend (last 8 weeks)
 */
function getKPITrend() {
  var sheet = getWeeklySummarySheet();
  var data = sheet.getDataRange().getValues();

  var trend = [];

  for (var i = 1; i < data.length; i++) {
    trend.push({
      week_start: data[i][0],
      no_show_rate: parseFloat(data[i][3]) || 0,
      resale_rate: _calculateResaleRateFromRow(data[i])
    });
  }

  return trend.slice(-8);
}

/**
 * Calculate resale rate from summary row
 */
function _calculateResaleRateFromRow(row) {
  var sameDayCancellations = row[4];
  var resaleSuccessCount = row[6];

  if (sameDayCancellations > 0) {
    return ((resaleSuccessCount / sameDayCancellations) * 100).toFixed(2);
  }

  return '0.00';
}

/**
 * Get current week KPIs
 */
function getCurrentWeekKPIs() {
  var now = new Date();
  var weekStart = formatDate(getWeekStart(now));
  return calculateWeeklyKPIs(weekStart);
}

/**
 * Compare KPIs to targets
 */
function compareKPIsToTargets(kpiData) {
  var targets = {
    no_show_rate: 5.0,
    resale_rate: 20.0,
    line_completion_rate: 40.0
  };

  return {
    no_show_rate: {
      actual: parseFloat(kpiData.no_show_rate),
      target: targets.no_show_rate,
      achieved: parseFloat(kpiData.no_show_rate) <= targets.no_show_rate
    },
    resale_rate: {
      actual: parseFloat(kpiData.resale_rate),
      target: targets.resale_rate,
      achieved: parseFloat(kpiData.resale_rate) >= targets.resale_rate
    }
  };
}
