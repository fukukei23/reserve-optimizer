/**
 * StampCardService - W3-1 スタンプカード
 *
 * FEATURE_STAMP_CARD フラグで有効化。
 * 来院1回でスタンプ1つ付与し、STAMP_THRESHOLD 枚達成で特典通知。
 * stamp_cards シートにデータ保存。
 */

var STAMP_CARD_HEADERS = [
  'line_user_id', 'stamp_count', 'total_stamps_earned',
  'last_stamped_reservation_id', 'last_stamped_at', 'updated_at'
];

/**
 * スタンプを1つ追加する。
 * 同一予約IDでの重複付与は防止する。
 * @param {string} lineUserId
 * @param {string} reservationId
 * @returns {{ ok: boolean, stampCount: number, rewarded: boolean, error?: string }}
 */
function addStamp(lineUserId, reservationId) {
  if (!lineUserId) return { ok: false, error: 'lineUserId is required' };
  if (!reservationId) return { ok: false, error: 'reservationId is required' };

  var sheet = _getOrCreateStampSheet();
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var stampCard = null;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === lineUserId) {
      stampCard = _rowToStampCard(data[i]);
      rowIndex = i + 1; // 1-indexed
      break;
    }
  }

  var now = new Date();
  var nowStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  var threshold = getStampThreshold();
  var rewarded = false;

  if (stampCard) {
    // 同一予約の重複スタンプ防止
    if (stampCard.last_stamped_reservation_id === reservationId) {
      return { ok: true, stampCount: stampCard.stamp_count, rewarded: false };
    }

    var newCount = stampCard.stamp_count + 1;
    var newTotal = stampCard.total_stamps_earned + 1;

    if (newCount >= threshold) {
      rewarded = true;
      newCount = 0;
      sendLinePush(lineUserId, getStampRewardMessage());
      appendLogRow('INFO', '[Stamp] Reward triggered for: ' + lineUserId);
    }

    sheet.getRange(rowIndex, 2).setValue(newCount);
    sheet.getRange(rowIndex, 3).setValue(newTotal);
    sheet.getRange(rowIndex, 4).setValue(reservationId);
    sheet.getRange(rowIndex, 5).setValue(nowStr);
    sheet.getRange(rowIndex, 6).setValue(nowStr);

    return { ok: true, stampCount: newCount, rewarded: rewarded };
  } else {
    // 新規ユーザー
    var initialCount = 1;
    if (initialCount >= threshold) {
      rewarded = true;
      initialCount = 0;
      sendLinePush(lineUserId, getStampRewardMessage());
      appendLogRow('INFO', '[Stamp] Reward triggered for: ' + lineUserId);
    }

    sheet.appendRow([lineUserId, initialCount, 1, reservationId, nowStr, nowStr]);
    return { ok: true, stampCount: initialCount, rewarded: rewarded };
  }
}

/**
 * スタンプカード情報を取得する。
 * @param {string} lineUserId
 * @returns {{ line_user_id, stamp_count, total_stamps_earned, last_stamped_at }|null}
 */
function getStampCard(lineUserId) {
  if (!lineUserId) return null;
  var sheet = _getOrCreateStampSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === lineUserId) return _rowToStampCard(data[i]);
  }
  return null;
}

/**
 * スタンプ状況のサマリー文字列を返す（患者向け表示用）。
 * @param {string} lineUserId
 * @returns {string}
 */
function getStampSummaryText(lineUserId) {
  var threshold = getStampThreshold();
  var card = getStampCard(lineUserId);
  if (!card) {
    return '🎟 スタンプ: 0 / ' + threshold + '枚\n（累計: 0枚）';
  }
  return '🎟 スタンプ: ' + card.stamp_count + ' / ' + threshold + '枚\n（累計: ' + card.total_stamps_earned + '枚）';
}

// ─── private ───

function _rowToStampCard(row) {
  return {
    line_user_id:                row[0],
    stamp_count:                 row[1],
    total_stamps_earned:         row[2],
    last_stamped_reservation_id: row[3],
    last_stamped_at:             row[4],
    updated_at:                  row[5]
  };
}

function _getOrCreateStampSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('stamp_cards');
  if (!sheet) {
    sheet = ss.insertSheet('stamp_cards');
    sheet.appendRow(STAMP_CARD_HEADERS);
  }
  return sheet;
}
