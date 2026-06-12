/**
 * SubscriptionService - W3-2 サブスクリプション管理
 *
 * FEATURE_SUBSCRIPTION フラグで有効化。
 * Stripe Checkout Session（mode=subscription）で月額プランを販売し、
 * subscriptions シートで加入状態を管理する。
 */

var SUBSCRIPTION_STATUS = {
  ACTIVE:     'active',
  CANCELED:   'canceled',
  PAST_DUE:   'past_due',
  INCOMPLETE: 'incomplete'
};

var SUBSCRIPTION_HEADERS = [
  'id', 'line_user_id', 'stripe_customer_id', 'stripe_subscription_id',
  'status', 'plan_name', 'started_at', 'next_billing_at', 'canceled_at', 'created_at'
];

/**
 * Stripe Checkout Session（subscription mode）を作成してURLを返す。
 * @param {string} lineUserId
 * @param {string} patientName
 * @returns {{ ok: boolean, url?: string, error?: string }}
 */
function createSubscriptionCheckout(lineUserId, patientName) {
  var priceId = getSubscriptionPriceId();
  if (!priceId) {
    return { ok: false, error: 'SUBSCRIPTION_PRICE_ID not configured' };
  }

  var result = _callStripeApi('POST', '/checkout/sessions', {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: getStripeSuccessUrl(),
    cancel_url: getStripeCancelUrl(),
    metadata: { line_user_id: lineUserId, patient_name: patientName || '', type: 'subscription' }
  });

  if (!result.success) {
    return { ok: false, error: result.error || 'Stripe API error' };
  }

  appendLogRow('INFO', '[Subscription] Checkout created for: ' + lineUserId);
  return { ok: true, url: result.data.url };
}

/**
 * サブスクリプションを即時解約する。
 * @param {string} stripeSubscriptionId
 * @returns {{ ok: boolean, error?: string }}
 */
function cancelSubscription(stripeSubscriptionId) {
  if (!stripeSubscriptionId) return { ok: false, error: 'stripeSubscriptionId is required' };

  var result = _callStripeApi('DELETE', '/subscriptions/' + stripeSubscriptionId);
  if (!result.success) {
    return { ok: false, error: result.error || 'Stripe API error' };
  }

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  updateSubscriptionStatus(stripeSubscriptionId, SUBSCRIPTION_STATUS.CANCELED, { canceled_at: nowStr });
  appendLogRow('INFO', '[Subscription] Canceled: ' + stripeSubscriptionId);
  return { ok: true };
}

/**
 * LINEユーザーIDでサブスクリプションを検索する（active優先）。
 * @param {string} lineUserId
 * @returns {Object|null}
 */
function getSubscriptionByLineUserId(lineUserId) {
  if (!lineUserId) return null;
  var sheet = _getOrCreateSubscriptionSheet();
  var data = sheet.getDataRange().getValues();
  var activeSub = null;
  var latestSub = null;

  for (var i = 1; i < data.length; i++) {
    var sub = _rowToSubscription(data[i]);
    if (!sub || sub.line_user_id !== lineUserId) continue;
    if (sub.status === SUBSCRIPTION_STATUS.ACTIVE && !activeSub) activeSub = sub;
    if (!latestSub) latestSub = sub;
  }
  return activeSub || latestSub;
}

/**
 * サブスクリプションをシートに保存する（upsert）。
 * Webhookから呼ばれる。
 * @param {Object} subscriptionData - { id, line_user_id, stripe_customer_id, stripe_subscription_id, status, plan_name, started_at, next_billing_at }
 * @returns {{ ok: boolean, error?: string }}
 */
function saveSubscription(subscriptionData) {
  if (!subscriptionData || !subscriptionData.stripe_subscription_id) {
    return { ok: false, error: 'stripe_subscription_id is required' };
  }

  var sheet = _getOrCreateSubscriptionSheet();
  var data = sheet.getDataRange().getValues();
  var targetId = subscriptionData.stripe_subscription_id;

  for (var i = 1; i < data.length; i++) {
    var sub = _rowToSubscription(data[i]);
    if (sub && sub.stripe_subscription_id === targetId) {
      if (subscriptionData.status) {
        sheet.getRange(i + 1, _colIdx('status')).setValue(subscriptionData.status);
      }
      if (subscriptionData.next_billing_at) {
        sheet.getRange(i + 1, _colIdx('next_billing_at')).setValue(subscriptionData.next_billing_at);
      }
      if (subscriptionData.plan_name) {
        sheet.getRange(i + 1, _colIdx('plan_name')).setValue(subscriptionData.plan_name);
      }
      appendLogRow('INFO', '[Subscription] Updated: ' + targetId);
      return { ok: true };
    }
  }

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  var row = SUBSCRIPTION_HEADERS.map(function(h) {
    if (h === 'created_at') return nowStr;
    if (h === 'started_at' && !subscriptionData[h]) return nowStr;
    return subscriptionData[h] || '';
  });
  sheet.appendRow(row);
  appendLogRow('INFO', '[Subscription] Saved: ' + targetId);
  return { ok: true };
}

/**
 * stripe_subscription_idでステータスと追加フィールドを更新する。
 * @param {string} stripeSubscriptionId
 * @param {string} status
 * @param {Object} extraFields - { canceled_at, next_billing_at } など
 * @returns {{ ok: boolean, found: boolean }}
 */
function updateSubscriptionStatus(stripeSubscriptionId, status, extraFields) {
  if (!stripeSubscriptionId) return { ok: false, found: false };
  var sheet = _getOrCreateSubscriptionSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var sub = _rowToSubscription(data[i]);
    if (!sub || sub.stripe_subscription_id !== stripeSubscriptionId) continue;

    sheet.getRange(i + 1, _colIdx('status')).setValue(status);
    if (extraFields) {
      for (var k in extraFields) {
        var col = _colIdx(k);
        if (col > 0) sheet.getRange(i + 1, col).setValue(extraFields[k]);
      }
    }
    appendLogRow('INFO', '[Subscription] Status updated: ' + stripeSubscriptionId + ' → ' + status);
    return { ok: true, found: true };
  }
  return { ok: true, found: false };
}

/**
 * サブスクリプション状況のサマリー文字列を返す（患者向け）。
 * @param {string} lineUserId
 * @returns {string}
 */
function getSubscriptionSummaryText(lineUserId) {
  var sub = getSubscriptionByLineUserId(lineUserId);
  if (!sub) return 'サブスクリプションの登録はありません。';

  var statusLabel = {
    active:     'アクティブ',
    canceled:   '解約済み',
    past_due:   '支払い期限切れ',
    incomplete: '未完了'
  }[sub.status] || sub.status;

  var planName = sub.plan_name || '月額定額プラン';
  var nextBilling = sub.next_billing_at ? String(sub.next_billing_at).slice(0, 10).replace(/-/g, '/') : '-';
  return '📋 サブスク: ' + statusLabel + '\nプラン: ' + planName + '\n次回更新: ' + nextBilling;
}

// ─── private ───

function _colIdx(headerName) {
  return SUBSCRIPTION_HEADERS.indexOf(headerName) + 1; // 1-indexed
}

function _rowToSubscription(row) {
  if (!row || row.length < SUBSCRIPTION_HEADERS.length) return null;
  var obj = {};
  for (var i = 0; i < SUBSCRIPTION_HEADERS.length; i++) {
    obj[SUBSCRIPTION_HEADERS[i]] = row[i];
  }
  return obj;
}

function _getOrCreateSubscriptionSheet() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('subscriptions');
  if (!sheet) {
    sheet = ss.insertSheet('subscriptions');
    sheet.appendRow(SUBSCRIPTION_HEADERS);
  }
  return sheet;
}
