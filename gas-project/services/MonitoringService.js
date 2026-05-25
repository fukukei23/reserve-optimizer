/**
 * Monitoring Service - System health metrics and alerting
 *
 * Provides health check data, error rate monitoring,
 * and automatic admin alerts when anomalies are detected.
 */

/**
 * Get comprehensive system health metrics.
 * Called from KPI dashboard and /status admin command.
 *
 * @returns {object} Health metrics snapshot
 */
function getSystemHealthMetrics() {
  var metrics = {
    timestamp: new Date().toISOString(),
    reservations: _getReservationMetrics(),
    performance: _getPerformanceMetrics(),
    errors: _getErrorMetrics(),
    storage: _getStorageMetrics()
  };

  metrics.healthy = metrics.errors.count_today < 10
    && metrics.performance.sheet_load_ms < 3000
    && metrics.reservations.active_count < 2000;

  return metrics;
}

/**
 * Check system health and send alerts if anomalies detected.
 * Call from time-driven trigger (hourly).
 */
function checkAndAlert() {
  var metrics = getSystemHealthMetrics();
  var alerts = [];

  if (metrics.errors.count_today >= 10) {
    alerts.push('ERROR_SPIKE: 本日のエラー件数が' + metrics.errors.count_today + '件に達しました');
  }

  if (metrics.performance.sheet_load_ms >= 3000) {
    alerts.push('SLOW_SHEETS: Sheets読み込みに' + metrics.performance.sheet_load_ms + 'msかかっています');
  }

  if (metrics.reservations.active_count >= 1500) {
    alerts.push('APPROACHING_LIMIT: アクティブ予約が' + metrics.reservations.active_count + '件（スケール限界接近）');
  }

  for (var i = 0; i < alerts.length; i++) {
    notifyAdmin('error', alerts[i]);
    appendLogRow('WARN', '[Monitor] Alert: ' + alerts[i]);
  }

  return { checked: true, alertCount: alerts.length, alerts: alerts };
}

/**
 * Format system health as a readable message for /status command.
 * @returns {string}
 */
function formatHealthReport() {
  var m = getSystemHealthMetrics();
  var status = m.healthy ? 'HEALTHY' : 'DEGRADED';

  var report = '【System Status】' + status + '\n';
  report += 'Time: ' + m.timestamp + '\n\n';
  report += 'Reservations:\n';
  report += '  Active: ' + m.reservations.active_count + '\n';
  report += '  Total: ' + m.reservations.total_count + '\n\n';
  report += 'Performance:\n';
  report += '  Sheet load: ' + m.performance.sheet_load_ms + 'ms\n';
  report += '  Last webhook: ' + (m.performance.last_webhook_ago || 'N/A') + '\n\n';
  report += 'Errors today: ' + m.errors.count_today + '\n';
  report += 'Config: ' + m.storage.config_status;

  return report;
}

// --- Internal metrics collectors ---

function _getReservationMetrics() {
  try {
    _ensureReservationCache();
    var active = 0;
    for (var i = 0; i < _reservationCache.length; i++) {
      var s = _reservationCache[i].status;
      if (s === RESERVATION_STATUS.PENDING || s === RESERVATION_STATUS.CONFIRMED) active++;
    }
    return {
      active_count: active,
      total_count: _reservationCache.length
    };
  } catch (e) {
    return { active_count: -1, total_count: -1 };
  }
}

function _getPerformanceMetrics() {
  var sheetLoadMs = -1;
  try {
    var start = Date.now();
    getReservationsSheet().getLastRow();
    sheetLoadMs = Date.now() - start;
  } catch (e) { /* measurement failed */ }

  var lastWebhookAgo = 'unknown';
  try {
    var logSheet = getLogSheet();
    var logData = logSheet.getDataRange().getValues();
    for (var i = logData.length - 1; i >= 1; i--) {
      var msg = String(logData[i][2] || '');
      if (msg.indexOf('webhook received') >= 0 || msg.indexOf('Webhook received') >= 0) {
        var whTime = new Date(logData[i][0]);
        var agoMin = Math.round((Date.now() - whTime.getTime()) / 60000);
        lastWebhookAgo = agoMin + ' min ago';
        break;
      }
    }
  } catch (e) { /* noop */ }

  return {
    sheet_load_ms: sheetLoadMs,
    last_webhook_ago: lastWebhookAgo
  };
}

function _getErrorMetrics() {
  var countToday = 0;
  try {
    var logSheet = getLogSheet();
    var logData = logSheet.getDataRange().getValues();
    var today = formatDateObj(new Date());
    for (var i = logData.length - 1; i >= 1; i--) {
      if (formatDateObj(logData[i][0]) !== today) break;
      if (logData[i][1] === 'ERROR') countToday++;
    }
  } catch (e) { /* noop */ }

  return { count_today: countToday };
}

function _getStorageMetrics() {
  var validation = validateRequiredProperties();
  return {
    config_status: validation.valid ? 'OK' : 'MISSING: ' + validation.missing.join(', ')
  };
}
