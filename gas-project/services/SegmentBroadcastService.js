/**
 * SegmentBroadcastService - W3-3 セグメント配信
 *
 * FEATURE_SEGMENT_BROADCAST フラグで有効化。
 * 患者を属性でフィルタリングして LINE Push を一斉送信する。
 */

var SEGMENT_TYPES = {
  ALL:       'all',        // line_user_id を持つ全患者
  TAG:       'tag',        // タグ一致 (vip / regular / new)
  INACTIVE:  'inactive',   // 最終来院からN日以上経過
  VISIT_GTE: 'visit_gte'  // 来院回数 >= N
};

/**
 * セグメント条件に一致する顧客リストを取得する。
 * @param {string} segmentType - SEGMENT_TYPES のいずれか
 * @param {string|number} segmentParam - タグ名 or 数値
 * @returns {Array} customerオブジェクトの配列
 */
function getSegmentCustomers(segmentType, segmentParam) {
  _ensureCustomerCache();
  var customers = _customerCache || [];

  // line_user_id のない顧客はLINE送信不可なので除外
  var filtered = customers.filter(function(c) {
    return c.line_user_id && c.line_user_id.trim() !== '';
  });

  switch (segmentType) {
    case SEGMENT_TYPES.ALL:
      break;

    case SEGMENT_TYPES.TAG:
      filtered = filtered.filter(function(c) {
        if (!c.tags) return false;
        var tags = c.tags.split(',').map(function(t) { return t.trim(); });
        return tags.indexOf(segmentParam) !== -1;
      });
      break;

    case SEGMENT_TYPES.INACTIVE:
      var days = parseInt(segmentParam, 10);
      var today = new Date();
      filtered = filtered.filter(function(c) {
        if (!c.last_visit || c.last_visit.trim() === '') return true; // 来院なし=休眠扱い
        var lastDate = new Date(c.last_visit.replace(/\//g, '-') + 'T00:00:00+09:00');
        var diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        return diffDays >= days;
      });
      break;

    case SEGMENT_TYPES.VISIT_GTE:
      var minCount = parseInt(segmentParam, 10);
      filtered = filtered.filter(function(c) {
        return (c.visit_count || 0) >= minCount;
      });
      break;

    default:
      filtered = [];
      break;
  }

  return filtered;
}

/**
 * セグメント配信を実行する。
 * 個別エラーはスキップして継続する（全体が止まらないように）。
 * @param {string} segmentType
 * @param {string|number} segmentParam
 * @param {string} message - 送信するメッセージ本文
 * @returns {{ ok: boolean, sent: number, skipped: number, total: number, error?: string }}
 */
function broadcastToSegment(segmentType, segmentParam, message) {
  if (!message || !message.trim()) {
    return { ok: false, error: 'message is required' };
  }

  var targets = getSegmentCustomers(segmentType, segmentParam);
  if (targets.length === 0) {
    return { ok: true, sent: 0, skipped: 0, total: 0, message: '対象患者が見つかりません' };
  }

  var sent = 0;
  var skipped = 0;

  for (var i = 0; i < targets.length; i++) {
    var customer = targets[i];
    try {
      sendLinePush(customer.line_user_id, message);
      Utilities.sleep(50);
      appendLogRow('INFO', '[Broadcast] Sent to: ' + customer.line_user_id);
      sent++;
    } catch (e) {
      appendLogRow('ERROR', '[Broadcast] Failed for ' + customer.line_user_id + ': ' + e.message);
      skipped++;
    }
  }

  return { ok: true, sent: sent, skipped: skipped, total: sent + skipped };
}

/**
 * 送信プレビューを返す（実際には送信しない）。
 * @param {string} segmentType
 * @param {string|number} segmentParam
 * @returns {{ count: number, preview: string[] }}
 */
function getBroadcastPreview(segmentType, segmentParam) {
  var targets = getSegmentCustomers(segmentType, segmentParam);
  var preview = targets.slice(0, 5).map(function(c) { return c.name || '名前不明'; });
  return { count: targets.length, preview: preview };
}
