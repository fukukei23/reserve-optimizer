/**
 * CouponService - クーポン発行・バリデーション・割引計算
 *
 * FEATURE_COUPON=true で有効化。
 * クーポンシートの構造: coupon_id, code, discount_type, discount_value,
 *   expiry_date, use_limit, use_count, target_tags, active
 */

var COUPON_SHEET_NAME = 'coupons';
var COUPON_HEADERS = ['coupon_id', 'code', 'discount_type', 'discount_value', 'expiry_date', 'use_limit', 'use_count', 'target_tags', 'active'];

var COUPON_COLUMNS = {
  COUPON_ID: 1,
  CODE: 2,
  DISCOUNT_TYPE: 3,
  DISCOUNT_VALUE: 4,
  EXPIRY_DATE: 5,
  USE_LIMIT: 6,
  USE_COUNT: 7,
  TARGET_TAGS: 8,
  ACTIVE: 9
};

var COUPON_DISCOUNT_TYPE = {
  PERCENT: 'percent',
  AMOUNT: 'amount'
};

// Per-execution cache
var _couponCache = null;

// --- Sheet ---

function getCouponSheet() {
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(COUPON_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(COUPON_SHEET_NAME);
    sheet.appendRow(COUPON_HEADERS);
  }
  return sheet;
}

// --- Cache ---

function _ensureCouponCache() {
  if (_couponCache !== null) return;

  var sheet = getCouponSheet();
  var data = sheet.getDataRange().getValues();
  _couponCache = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    _couponCache.push({
      coupon_id:     String(row[0]),
      code:          String(row[1] || ''),
      discount_type: String(row[2] || 'amount'),
      discount_value: Number(row[3] || 0),
      expiry_date:   String(row[4] || ''),
      use_limit:     Number(row[5] || 0),
      use_count:     Number(row[6] || 0),
      target_tags:   String(row[7] || ''),
      active:        row[8] === true || row[8] === 'TRUE'
    });
  }
}

function _invalidateCouponCache() {
  _couponCache = null;
}

// --- CRUD ---

/**
 * Get coupon by exact code (case-sensitive).
 * @param {string} code
 * @returns {object|null}
 */
function getCouponByCode(code) {
  _ensureCouponCache();
  for (var i = 0; i < _couponCache.length; i++) {
    if (_couponCache[i].code === code) return _couponCache[i];
  }
  return null;
}

/**
 * Increment use_count for the coupon.
 * Idempotency guard: does not increment past use_limit (unless use_limit === 0).
 * @param {string} couponId
 */
function applyCoupon(couponId) {
  var sheet = getCouponSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== couponId) continue;
    var useLimit = Number(data[i][COUPON_COLUMNS.USE_LIMIT - 1] || 0);
    var useCount = Number(data[i][COUPON_COLUMNS.USE_COUNT - 1] || 0);

    // Idempotency guard: don't exceed limit
    if (useLimit > 0 && useCount >= useLimit) return;

    sheet.getRange(i + 1, COUPON_COLUMNS.USE_COUNT).setValue(useCount + 1);
    _invalidateCouponCache();
    return;
  }
}

// --- Validation ---

/**
 * Validate a coupon code for the given user.
 * @param {string} code
 * @param {string} lineUserId
 * @param {Date} [now] - injectable for testing (defaults to new Date())
 * @returns {{ok: boolean, error: string|null, coupon: object|null}}
 */
function validateCoupon(code, lineUserId, now) {
  var today = now || new Date();
  var coupon = getCouponByCode(code);

  if (!coupon) return { ok: false, error: 'NOT_FOUND', coupon: null };
  if (!coupon.active) return { ok: false, error: 'INACTIVE', coupon: null };

  // Expiry check (expiry_date is inclusive)
  if (coupon.expiry_date) {
    var parts = coupon.expiry_date.split('/');
    var expiry = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    expiry.setHours(23, 59, 59, 999);
    if (today > expiry) return { ok: false, error: 'EXPIRED', coupon: null };
  }

  // Use limit check (0 = unlimited)
  if (coupon.use_limit > 0 && coupon.use_count >= coupon.use_limit) {
    return { ok: false, error: 'USE_LIMIT', coupon: null };
  }

  // Target tags check (empty = all users)
  if (coupon.target_tags) {
    var requiredTags = coupon.target_tags.split(',').map(function(t) { return t.trim(); });
    var customer = getCustomerByLineUserId ? getCustomerByLineUserId(lineUserId) : null;
    var userTags = (customer && customer.tags) ? customer.tags.split(',').map(function(t) { return t.trim(); }) : [];

    var matched = false;
    for (var i = 0; i < requiredTags.length; i++) {
      for (var j = 0; j < userTags.length; j++) {
        if (requiredTags[i] === userTags[j]) { matched = true; break; }
      }
      if (matched) break;
    }
    if (!matched) return { ok: false, error: 'TAG_MISMATCH', coupon: null };
  }

  return { ok: true, error: null, coupon: coupon };
}

// --- Discount ---

/**
 * Calculate discount amount.
 * @param {number} baseAmount - original deposit amount in JPY
 * @param {object} coupon
 * @returns {number} discount amount (never exceeds baseAmount)
 */
function calculateDiscount(baseAmount, coupon) {
  var discount = 0;
  if (coupon.discount_type === COUPON_DISCOUNT_TYPE.PERCENT) {
    discount = Math.round(baseAmount * coupon.discount_value / 100);
  } else {
    discount = coupon.discount_value;
  }
  return Math.min(discount, baseAmount);
}
