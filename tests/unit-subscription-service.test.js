/**
 * Unit Tests - W3-2 サブスクリプションサービス
 *
 * Run: node tests/unit-subscription-service.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Test runner ───
var _results = { pass: 0, fail: 0, errors: [] };
function test(name, fn) {
  try { fn(); _results.pass++; process.stdout.write('.'); }
  catch (e) { _results.fail++; _results.errors.push({ name: name, error: e.message }); process.stdout.write('F'); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

// ─── GAS stubs ───
var _logRows = [];
var _pushLogs = [];
var _stripeCallLog = [];
var _mockStripeResponse = { success: true, data: { url: 'https://checkout.stripe.com/test', id: 'cs_test' } };

global.Logger = { log: function() {} };
global.Utilities = {
  formatDate: function(date, tz, fmt) {
    if (fmt === 'yyyy/MM/dd HH:mm:ss') return '2026/06/13 10:00:00';
    if (fmt === 'yyyy/MM/dd') return '2026/06/13';
    return '2026/06/13';
  }
};
global.appendLogRow = function(level, msg) { _logRows.push({ level: level, msg: msg }); };
global.sendLinePush = function(userId, msg) { _pushLogs.push({ userId: userId, msg: msg }); };
global.getSpreadsheetId = function() { return 'SHEET001'; };
global.getStripeSuccessUrl = function() { return 'https://line.me/R/'; };
global.getStripeCancelUrl = function() { return 'https://line.me/R/'; };
global.getSubscriptionPriceId = function() { return _mockScriptProps['SUBSCRIPTION_PRICE_ID'] || ''; };
global.getSubscriptionPlanName = function() { return _mockScriptProps['SUBSCRIPTION_PLAN_NAME'] || '月額定額プラン'; };
global._callStripeApi = function(method, path, payload) {
  _stripeCallLog.push({ method: method, path: path, payload: payload });
  return _mockStripeResponse;
};

var _mockScriptProps = {};

// ─── Spreadsheet mock ───
var HEADERS = ['id','line_user_id','stripe_customer_id','stripe_subscription_id','status','plan_name','started_at','next_billing_at','canceled_at','created_at'];
var _mockRows = [];

var _mockSheet = {
  appendRow: function(row) { _mockRows.push(row.slice()); },
  getDataRange: function() {
    return { getValues: function() { return _mockRows.map(function(r) { return r.slice(); }); } };
  },
  getRange: function(row, col) {
    return { setValue: function(val) { if (!_mockRows[row-1]) _mockRows[row-1]=[]; _mockRows[row-1][col-1]=val; } };
  }
};
var _mockSS = {
  getSheetByName: function(name) { return name === 'subscriptions' ? _mockSheet : null; },
  insertSheet: function() { return _mockSheet; }
};
global.SpreadsheetApp = { openById: function() { return _mockSS; } };

// SUBSCRIPTION_STATUS はロード後に利用するためグローバルに定義
global.SUBSCRIPTION_STATUS = {
  ACTIVE: 'active', CANCELED: 'canceled', PAST_DUE: 'past_due', INCOMPLETE: 'incomplete'
};

function resetMocks() {
  _mockRows = [HEADERS.slice()];
  _logRows = [];
  _pushLogs = [];
  _stripeCallLog = [];
  _mockScriptProps = { SUBSCRIPTION_PRICE_ID: 'price_test123', SPREADSHEET_ID: 'SHEET001' };
  _mockStripeResponse = { success: true, data: { url: 'https://checkout.stripe.com/test', id: 'cs_test' } };
}

function makeSubRow(overrides) {
  var defaults = {
    id: '', line_user_id: 'U001', stripe_customer_id: 'cus_001',
    stripe_subscription_id: 'sub_001', status: 'active',
    plan_name: '月額定額プラン', started_at: '2026/05/01',
    next_billing_at: '2026/07/01', canceled_at: '', created_at: '2026/05/01 10:00:00'
  };
  var merged = {};
  for (var k in defaults) merged[k] = defaults[k];
  for (var k in overrides) merged[k] = overrides[k];
  return HEADERS.map(function(h) { return merged[h]; });
}

// ─── Load source ───
resetMocks();
var code = fs.readFileSync(
  path.join(__dirname, '..', 'gas-project', 'services', 'SubscriptionService.js'), 'utf8'
);
new vm.Script(code, { filename: 'SubscriptionService.js' }).runInThisContext();

// ─── createSubscriptionCheckout ───

test('createSubscriptionCheckout: PRICE_ID未設定 → ok:false', function() {
  resetMocks();
  _mockScriptProps['SUBSCRIPTION_PRICE_ID'] = '';
  var r = createSubscriptionCheckout('U001', '田中');
  assertEqual(r.ok, false);
  assert(r.error.indexOf('SUBSCRIPTION_PRICE_ID') >= 0);
});

test('createSubscriptionCheckout: Stripe呼び出し成功 → ok:true + url', function() {
  resetMocks();
  var r = createSubscriptionCheckout('U001', '田中');
  assertEqual(r.ok, true);
  assert(r.url.indexOf('checkout.stripe.com') >= 0);
});

test('createSubscriptionCheckout: Stripe APIが失敗 → ok:false', function() {
  resetMocks();
  _mockStripeResponse = { success: false, error: 'card_declined' };
  var r = createSubscriptionCheckout('U001', '田中');
  assertEqual(r.ok, false);
  assert(r.error, 'error exists');
});

test('createSubscriptionCheckout: mode=subscriptionでStripeを呼ぶ', function() {
  resetMocks();
  createSubscriptionCheckout('U001', '田中');
  assert(_stripeCallLog.length > 0);
  assertEqual(_stripeCallLog[0].method, 'POST');
  assert(_stripeCallLog[0].path.indexOf('/checkout/sessions') >= 0);
});

// ─── cancelSubscription ───

test('cancelSubscription: IDなし → ok:false', function() {
  resetMocks();
  var r = cancelSubscription('');
  assertEqual(r.ok, false);
});

test('cancelSubscription: Stripe DELETE呼び出し成功 → ok:true', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ stripe_subscription_id: 'sub_001', status: 'active' }));
  var r = cancelSubscription('sub_001');
  assertEqual(r.ok, true);
});

test('cancelSubscription: シートのstatusがcanceledに更新される', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ stripe_subscription_id: 'sub_001', status: 'active' }));
  cancelSubscription('sub_001');
  var statusCol = HEADERS.indexOf('status');
  var dataRow = _mockRows[1]; // header=0, data=1
  assertEqual(dataRow[statusCol], 'canceled');
});

test('cancelSubscription: Stripe APIが失敗 → ok:false', function() {
  resetMocks();
  _mockStripeResponse = { success: false, error: 'sub_not_found' };
  var r = cancelSubscription('sub_999');
  assertEqual(r.ok, false);
});

// ─── getSubscriptionByLineUserId ───

test('getSubscriptionByLineUserId: nullはnull', function() {
  resetMocks();
  assertEqual(getSubscriptionByLineUserId(null), null);
});

test('getSubscriptionByLineUserId: 存在しないユーザー → null', function() {
  resetMocks();
  assertEqual(getSubscriptionByLineUserId('U_NONE'), null);
});

test('getSubscriptionByLineUserId: active優先で返す', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ line_user_id: 'U001', stripe_subscription_id: 'sub_old', status: 'canceled' }));
  _mockRows.push(makeSubRow({ line_user_id: 'U001', stripe_subscription_id: 'sub_new', status: 'active' }));
  var r = getSubscriptionByLineUserId('U001');
  assertEqual(r.stripe_subscription_id, 'sub_new');
  assertEqual(r.status, 'active');
});

test('getSubscriptionByLineUserId: activeなければ最初の行を返す', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ line_user_id: 'U001', stripe_subscription_id: 'sub_old', status: 'canceled' }));
  var r = getSubscriptionByLineUserId('U001');
  assertEqual(r.stripe_subscription_id, 'sub_old');
});

// ─── saveSubscription ───

test('saveSubscription: stripe_subscription_idなし → ok:false', function() {
  resetMocks();
  var r = saveSubscription({ line_user_id: 'U001' });
  assertEqual(r.ok, false);
});

test('saveSubscription: 新規 → シートに1行追加', function() {
  resetMocks();
  var before = _mockRows.length;
  saveSubscription({
    line_user_id: 'U001', stripe_subscription_id: 'sub_001',
    status: 'active', plan_name: '月額定額プラン'
  });
  assertEqual(_mockRows.length, before + 1);
});

test('saveSubscription: 既存IDはupsert（行数変わらず）', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ stripe_subscription_id: 'sub_001', status: 'active' }));
  var before = _mockRows.length;
  saveSubscription({ stripe_subscription_id: 'sub_001', status: 'past_due' });
  assertEqual(_mockRows.length, before, 'no new row added');
});

// ─── updateSubscriptionStatus ───

test('updateSubscriptionStatus: 存在しないID → found:false', function() {
  resetMocks();
  var r = updateSubscriptionStatus('sub_999', 'canceled', {});
  assertEqual(r.found, false);
});

test('updateSubscriptionStatus: statusが更新される', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ stripe_subscription_id: 'sub_001', status: 'active' }));
  updateSubscriptionStatus('sub_001', 'past_due', {});
  var statusCol = HEADERS.indexOf('status');
  assertEqual(_mockRows[1][statusCol], 'past_due');
});

test('updateSubscriptionStatus: extraFieldsも更新される', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ stripe_subscription_id: 'sub_001', status: 'active', canceled_at: '' }));
  updateSubscriptionStatus('sub_001', 'canceled', { canceled_at: '2026/06/13 10:00:00' });
  var col = HEADERS.indexOf('canceled_at');
  assertEqual(_mockRows[1][col], '2026/06/13 10:00:00');
});

// ─── getSubscriptionSummaryText ───

test('getSubscriptionSummaryText: サブスクなし → 登録なしメッセージ', function() {
  resetMocks();
  var text = getSubscriptionSummaryText('U_NONE');
  assert(text.indexOf('登録はありません') >= 0, text);
});

test('getSubscriptionSummaryText: active → アクティブ表示', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ line_user_id: 'U001', status: 'active', plan_name: '月額定額プラン', next_billing_at: '2026/07/01' }));
  var text = getSubscriptionSummaryText('U001');
  assert(text.indexOf('アクティブ') >= 0, text);
  assert(text.indexOf('月額定額プラン') >= 0, text);
});

test('getSubscriptionSummaryText: canceled → 解約済み表示', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ line_user_id: 'U001', status: 'canceled' }));
  var text = getSubscriptionSummaryText('U001');
  assert(text.indexOf('解約済み') >= 0, text);
});

// ─── エッジケース ───

test('getSubscriptionSummaryText: past_due → 支払い期限切れ表示', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ line_user_id: 'U001', status: 'past_due' }));
  var text = getSubscriptionSummaryText('U001');
  assert(text.indexOf('支払い期限切れ') >= 0, text);
});

test('getSubscriptionSummaryText: incomplete → 未完了表示', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ line_user_id: 'U001', status: 'incomplete' }));
  var text = getSubscriptionSummaryText('U001');
  assert(text.indexOf('未完了') >= 0, text);
});

test('getSubscriptionByLineUserId: 空文字 → null', function() {
  resetMocks();
  _mockRows.push(makeSubRow({ line_user_id: 'U001' }));
  assertEqual(getSubscriptionByLineUserId(''), null);
});

// ─── Report ───
console.log('\n');
console.log('Subscription Tests:', _results.pass + _results.fail, 'total');
console.log('PASS:', _results.pass);
console.log('FAIL:', _results.fail);
if (_results.errors.length > 0) {
  _results.errors.forEach(function(e) {
    console.log('  FAIL:', e.name);
    console.log('       ', e.error);
  });
}
process.exit(_results.fail > 0 ? 1 : 0);
