/**
 * Backup Service - Automated backup, audit logging, and restore
 *
 * Provides daily CSV backup via Time-driven trigger,
 * audit logging for all reservation mutations, and point-in-time restore.
 */

// Backup retention period (days)
var BACKUP_RETENTION_DAYS = 30;

/**
 * Daily backup entry point — call from GAS Time-driven trigger (daily, e.g. 02:00).
 * Exports all data sheets to CSV in the configured Drive folder.
 */
function dailyBackup() {
  var timestamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd_HHmm');
  var backupFolderId = getProperty('BACKUP_FOLDER_ID');

  if (!backupFolderId) {
    appendLogRow('WARN', 'Backup skipped: BACKUP_FOLDER_ID not configured');
    return { ok: false, error: 'BACKUP_FOLDER_ID not configured' };
  }

  var folder;
  try {
    folder = DriveApp.getFolderById(backupFolderId);
  } catch (e) {
    appendLogRow('ERROR', 'Backup failed: cannot access folder ' + backupFolderId + ' - ' + e.message);
    return { ok: false, error: 'Cannot access backup folder' };
  }

  var sheets = [SHEET_NAMES.RESERVATIONS, SHEET_NAMES.WAITLIST, SHEET_NAMES.LOG, 'dead_letters'];
  var ss = _getCachedSpreadsheet();
  var exported = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sheet = ss.getSheetByName(sheets[i]);
    if (!sheet) continue;

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) continue; // headers only

    var data = sheet.getDataRange().getValues();
    var csv = _rowsToCsv(data);
    var fileName = sheets[i] + '_' + timestamp + '.csv';

    var blob = Utilities.newBlob(csv, 'text/csv', fileName);
    folder.createFile(blob);
    exported++;
  }

  // Prune old backups
  _pruneOldBackups(folder);

  appendLogRow('INFO', 'Daily backup completed: ' + exported + ' sheets exported (' + timestamp + ')');
  return { ok: true, exported: exported };
}

/**
 * Restore reservations sheet from a backup CSV file.
 *
 * @param {string} dateStr - Date string to search for in backup filenames (e.g. '20260525')
 * @returns {object} Result with ok status
 */
function restoreFromBackup(dateStr) {
  var backupFolderId = getProperty('BACKUP_FOLDER_ID');
  if (!backupFolderId) return { ok: false, error: 'BACKUP_FOLDER_ID not configured' };

  var folder = DriveApp.getFolderById(backupFolderId);
  var files = folder.getFiles();
  var targetFile = null;

  while (files.hasNext()) {
    var file = files.next();
    if (file.getName().indexOf(dateStr) >= 0 && file.getName().indexOf('reservations') >= 0) {
      targetFile = file;
      break;
    }
  }

  if (!targetFile) {
    return { ok: false, error: 'No backup found for date: ' + dateStr };
  }

  // Pre-restore: create safety backup of current data
  dailyBackup();

  var csv = targetFile.getBlob().getDataAsString('utf8');
  var rows = Utilities.parseCsv(csv);

  var sheet = getReservationsSheet();
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  _invalidateReservationCache();
  appendLogRow('INFO', 'Restored reservations from backup: ' + targetFile.getName() + ' (' + (rows.length - 1) + ' rows)');

  return { ok: true, rows: rows.length - 1, source: targetFile.getName() };
}

/**
 * Append an audit log entry for reservation mutations.
 *
 * @param {string} action - CREATE / UPDATE / CANCEL / RESTORE
 * @param {string} reservationId - Reservation ID
 * @param {object|null} before - State before change
 * @param {object|null} after - State after change
 */
function appendAuditLog(action, reservationId, before, after) {
  var sheet = getAuditLogSheet();
  sheet.appendRow([
    new Date(),
    action,
    reservationId || '',
    before ? JSON.stringify(before).substring(0, 2000) : '',
    after ? JSON.stringify(after).substring(0, 2000) : ''
  ]);
}

/**
 * Get or create the audit log sheet.
 */
function getAuditLogSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName('audit_log');
  if (!sheet) {
    sheet = ss.insertSheet('audit_log');
    sheet.appendRow(['timestamp', 'action', 'reservation_id', 'before', 'after']);
  }
  return sheet;
}

// --- Internal helpers ---

/**
 * Convert 2D array to CSV string.
 */
function _rowsToCsv(rows) {
  return rows.map(function(row) {
    return row.map(function(cell) {
      var val = String(cell == null ? '' : cell);
      if (val.indexOf(',') >= 0 || val.indexOf('"') >= 0 || val.indexOf('\n') >= 0) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',');
  }).join('\n');
}

/**
 * Delete backup files older than BACKUP_RETENTION_DAYS.
 */
function _pruneOldBackups(folder) {
  var cutoff = new Date(Date.now() - BACKUP_RETENTION_DAYS * 86400000);
  var files = folder.getFiles();
  var pruned = 0;

  while (files.hasNext()) {
    var file = files.next();
    if (file.getDateCreated() < cutoff) {
      file.setTrashed(true);
      pruned++;
    }
  }

  if (pruned > 0) {
    appendLogRow('INFO', 'Pruned ' + pruned + ' old backup(s)');
  }
}
