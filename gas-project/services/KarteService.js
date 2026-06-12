/**
 * KarteService - 簡易施術カルテ
 *
 * FEATURE_KARTE フラグで有効化。
 * スタッフが LINE から施術後メモを入力し、`karte_records` シートに保存する。
 * 患者ごとの施術履歴として次回来院時の参照にも使う。
 */

var KARTE_HEADERS = [
  'id', 'reservation_id', 'line_user_id', 'patient_name',
  'treatment_date', 'treatment_content', 'body_part',
  'staff_name', 'next_suggestion', 'notes', 'created_at'
];

/**
 * カルテを karte_records シートに保存する。
 * @param {string} reservationId
 * @param {Object} karteData - { line_user_id, patient_name, treatment_date, treatment_content, body_part, staff_name, next_suggestion, notes }
 * @returns {{ ok: boolean, id?: string, error?: string }}
 */
function saveKarte(reservationId, karteData) {
  if (!reservationId) return { ok: false, error: 'reservation_id is required' };
  if (!karteData || !karteData.treatment_content || !karteData.treatment_content.trim()) {
    return { ok: false, error: 'treatment_content is required' };
  }

  var sheet = _getOrCreateKarteSheet();
  var karteId = 'K-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  var now = new Date();

  var row = [
    karteId,
    reservationId,
    karteData.line_user_id || '',
    karteData.patient_name || '',
    karteData.treatment_date || Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd'),
    karteData.treatment_content.trim(),
    (karteData.body_part || '').trim(),
    (karteData.staff_name || '').trim(),
    (karteData.next_suggestion || '').trim(),
    (karteData.notes || '').trim(),
    Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
  ];

  sheet.appendRow(row);
  appendLogRow('INFO', '[Karte] Saved: ' + karteId + ' for reservation: ' + reservationId);
  return { ok: true, id: karteId };
}

/**
 * 予約IDに紐づくカルテを取得する。
 * @param {string} reservationId
 * @returns {Object|null}
 */
function getKarteByReservationId(reservationId) {
  if (!reservationId) return null;
  var sheet = _getOrCreateKarteSheet();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1] === reservationId) {
      return _rowToKarte(rows[i]);
    }
  }
  return null;
}

/**
 * LINEユーザーIDに紐づくカルテ履歴を取得する（最新N件）。
 * @param {string} lineUserId
 * @param {number} limit
 * @returns {Array}
 */
function getKarteHistoryByUserId(lineUserId, limit) {
  if (!lineUserId) return [];
  limit = limit || 5;
  var sheet = _getOrCreateKarteSheet();
  var rows = sheet.getDataRange().getValues();
  var result = [];
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][2] === lineUserId) {
      result.push(_rowToKarte(rows[i]));
      if (result.length >= limit) break;
    }
  }
  return result;
}

/**
 * 当日の完了済み予約から未記録のものを取得する（スタッフ向け一覧）。
 * @returns {Array} 予約オブジェクトの配列
 */
function getTodayUnrecordedReservations() {
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  var allReservations = getReservationsByDate(today);
  if (!allReservations || allReservations.length === 0) return [];

  // 完了済み（status=Visited）のもののみ
  var visited = allReservations.filter(function(r) {
    return r.status === 'Visited';
  });

  // 既記録のreservation_idセットを作成
  var recorded = {};
  var sheet = _getOrCreateKarteSheet();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1]) recorded[rows[i][1]] = true;
  }

  return visited.filter(function(r) { return !recorded[r.id]; });
}

// ─── private ───

function _rowToKarte(row) {
  return {
    id:                row[0],
    reservation_id:    row[1],
    line_user_id:      row[2],
    patient_name:      row[3],
    treatment_date:    row[4],
    treatment_content: row[5],
    body_part:         row[6],
    staff_name:        row[7],
    next_suggestion:   row[8],
    notes:             row[9],
    created_at:        row[10]
  };
}

function _getOrCreateKarteSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('karte_records');
  if (!sheet) {
    sheet = ss.insertSheet('karte_records');
    sheet.appendRow(KARTE_HEADERS);
  }
  return sheet;
}
