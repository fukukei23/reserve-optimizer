/**
 * IntakeService - 事前問診票
 *
 * FEATURE_INTAKE_FORM フラグで有効化。
 * Worker /api/intake から転送されたフォームデータを `intake_forms` シートに保存する。
 * GLMService でサマリーを生成し、当日朝のスタッフ通知に含める。
 */

var INTAKE_HEADERS = [
  'reservation_id', 'submitted_at', 'chief_complaint', 'medical_history',
  'allergies', 'pregnancy', 'notes', 'summary', 'processed'
];

/**
 * 問診票を intake_forms シートに保存する。
 * 同一 reservation_id の既存レコードがある場合は上書きする（再送防止）。
 * @param {string} reservationId
 * @param {Object} formData - { chief_complaint, medical_history, allergies, pregnancy, notes }
 * @returns {{ ok: boolean, error?: string }}
 */
function saveIntakeForm(reservationId, formData) {
  if (!reservationId) return { ok: false, error: 'reservation_id is required' };
  if (!formData || !formData.chief_complaint || !formData.chief_complaint.trim()) {
    return { ok: false, error: 'chief_complaint is required' };
  }

  var sheet = _getOrCreateIntakeSheet();
  var existing = _findIntakeRow(sheet, reservationId);

  var summary = '';
  try {
    summary = _generateIntakeSummary(formData);
  } catch (e) {
    appendLogRow('WARN', '[Intake] Summary generation failed: ' + e.message);
  }

  var now = new Date();
  var row = [
    reservationId,
    Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
    formData.chief_complaint.trim(),
    (formData.medical_history || '').trim(),
    (formData.allergies || '').trim(),
    formData.pregnancy || 'no',
    (formData.notes || '').trim(),
    summary,
    'N'
  ];

  if (existing) {
    // Update existing row
    var range = sheet.getRange(existing.rowNumber, 1, 1, INTAKE_HEADERS.length);
    range.setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  appendLogRow('INFO', '[Intake] Saved for reservation: ' + reservationId);
  return { ok: true };
}

/**
 * 予約IDに紐づく問診票を取得する。
 * @param {string} reservationId
 * @returns {Object|null}
 */
function getIntakeByReservationId(reservationId) {
  if (!reservationId) return null;

  var sheet = _getOrCreateIntakeSheet();
  var found = _findIntakeRow(sheet, reservationId);
  if (!found) return null;

  return {
    reservation_id: found.row[0],
    submitted_at:   found.row[1],
    chief_complaint: found.row[2],
    medical_history: found.row[3],
    allergies:      found.row[4],
    pregnancy:      found.row[5],
    notes:          found.row[6],
    summary:        found.row[7],
    processed:      found.row[8]
  };
}

/**
 * 問診票URLを生成する。
 * @param {string} reservationId
 * @returns {string} URL（WORKER_BASE_URL未設定なら空文字）
 */
function getIntakeFormUrl(reservationId) {
  var base = getWorkerBaseUrl();
  if (!base) return '';
  return base.replace(/\/$/, '') + '/intake/' + reservationId;
}

/**
 * 問診票サマリーを3行で生成する（GLMService 利用、未設定時はフォールバック）。
 * テストでは `_generateIntakeSummary` を差し替えてモック可能。
 * @param {Object} formData
 * @returns {string}
 */
function _generateIntakeSummary(formData) {
  // GLM が利用可能な場合は要約を依頼（任意）
  if (typeof generateGLMSummary === 'function') {
    var prompt =
      '以下の問診情報をスタッフ向けに3行で要約してください（箇条書き）:\n' +
      '主訴: ' + formData.chief_complaint + '\n' +
      '既往歴: ' + (formData.medical_history || 'なし') + '\n' +
      'アレルギー: ' + (formData.allergies || 'なし') + '\n' +
      '妊娠: ' + (formData.pregnancy || 'no') + '\n' +
      'その他: ' + (formData.notes || 'なし');
    try {
      return generateGLMSummary(prompt);
    } catch (e) {
      // フォールバック
    }
  }

  // シンプルなフォールバックサマリー
  var lines = ['主訴: ' + formData.chief_complaint.trim()];
  if (formData.medical_history && formData.medical_history.trim()) {
    lines.push('既往歴: ' + formData.medical_history.trim());
  }
  if (formData.allergies && formData.allergies.trim()) {
    lines.push('アレルギー: ' + formData.allergies.trim());
  }
  if (formData.pregnancy && formData.pregnancy !== 'no') {
    lines.push('妊娠: ' + formData.pregnancy);
  }
  return lines.join('\n');
}

/**
 * intake_forms シートを取得または作成する。
 */
function _getOrCreateIntakeSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('intake_forms');
  if (!sheet) {
    sheet = ss.insertSheet('intake_forms');
    sheet.appendRow(INTAKE_HEADERS);
  }
  return sheet;
}

/**
 * シート内で reservation_id が一致する行を検索する。
 * @returns {{ rowNumber: number, row: Array }|null}
 */
function _findIntakeRow(sheet, reservationId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === reservationId) {
      return { rowNumber: i + 1, row: data[i] };
    }
  }
  return null;
}
