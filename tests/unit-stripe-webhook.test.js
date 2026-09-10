/**
 * Unit Tests - Stripe Webhook 署名検証（WebhookRouter._dispatchStripeWebhook）
 *
 * 2026-09-10 新設（3機MLR採用指摘・バックログP2）: 金銭経路の署名検証分岐の無検証を解消。
 * 対象分岐: ①signature欠落拒否 ②不正署名拒否 ③タイムスタンプ期限切れ拒否 ④有効署名で通過 ⑤secret未設定時のfail-open ⑥形式不正拒否
 *
 * Run: node tests/unit-stripe-webhook.test.js
 *
 * ※ 疑似HMACモックについて: Utilities.computeHmacSha256Signature を決定論的疑似関数で置換し、
 *   テスト側の期待署名も同じモックで計算する。暗号自体の強度は GAS ランタイムの責務で、
 *   本テストは「署名検証ロジック（形式パース・時刻許容・恒定時間比較・分岐）」のみを検証する。
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Test runner（run-all.js の /Passed:\s*(\d+)\s+Failed:\s*(\d+)/ 形式に整合） ───
var _results = { pass: 0, fail: 0, errors: [] };
function test(name, fn) {
  try {
    fn();
    _results.pass++;
    process.stdout.write('.');
  } catch (e) {
    _results.fail++;
    _results.errors.push({ name: name, error: e.message });
    process.stdout.write('F');
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

console.log('Stripe Webhook Signature Tests: ');

// ─── GAS stubs ───
var _logs = [];

// 決定論的疑似HMAC（32バイト配列を返す・実装は .map でhex化するため配列で十分）
function pseudoHmac(payload, secret) {
  var h = 2166136261;
  var input = secret + ':' + payload;
  for (var i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  var bytes = [];
  for (var j = 0; j < 32; j++) {
    h = (h * 16777619 + j) >>> 0;
    bytes.push(h & 0xff);
  }
  return bytes;
}

global.Logger = { log: function() {} };
global.appendLogRow = function(level, msg) { _logs.push({ level: level, msg: msg }); };
global.CacheService = {
  getScriptCache: function() { return { get: function() { return null; }, put: function() {} }; }
};
global.PropertiesService = {
  getScriptProperties: function() { return { getProperty: function() { return null; } }; }
};
global.Utilities = {
  newBlob: function(s) {
    var bytes = [];
    for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);
    return { getBytes: function() { return bytes; } };
  },
  computeHmacSha256Signature: function(payload, secret) { return pseudoHmac(String(payload), String(secret)); },
  base64Encode: function(bytes) { return 'b64'; },
  formatDate: function() { return '2026/01/01'; }
};
global.ContentService = {
  createTextOutput: function(t) {
    return {
      _content: t,
      setMimeType: function() { return this; },
      getContent: function() { return this._content; }
    };
  },
  MimeType: { JSON: 'JSON' }
};

// 検証対象が呼ぶプロパティ取得関数（テストごとに切り替え）
var _stripeSecret = null;
global.getStripeWebhookSecret = function() { return _stripeSecret; };

// ─── Load source（WebhookRouter→StripeService→StripeWebhookHandler の順） ───
['handlers/WebhookRouter.js', 'services/StripeService.js', 'handlers/StripeWebhookHandler.js'].forEach(function(rel) {
  var code = fs.readFileSync(path.join(__dirname, '..', 'gas-project', rel), 'utf8');
  new vm.Script(code, { filename: rel }).runInThisContext();
});

// 下流 dispatch の捕捉用スタブ（ソースロード後に上書きしないと本物実装が掴む・署名通過後の到達確認用）
var _dispatched = [];
global.handleCheckoutSessionCompleted = function(session) { _dispatched.push('checkout'); };
global.handlePaymentSuccess = function(pi) { _dispatched.push('payment_success'); };
global.handlePaymentFailure = function(pi) { _dispatched.push('payment_failed'); };
global.handleRefund = function(c) { _dispatched.push('refund'); };

// ─── helpers ───
var SECRET = 'whsec_test_secret';
var BODY = JSON.stringify({ id: 'evt_test_1', type: 'charge.refunded', data: { object: { payment_intent: 'pi_test_1' } } });

// テスト側も同じ疑似HMACで期待署名を計算（Stripe形式: t=<ts>,v1=<hex>）
function makeSigHeader(body, secret, timestampSec) {
  var ts = timestampSec || Math.floor(Date.now() / 1000);
  var sig = pseudoHmac(ts + '.' + body, secret).map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
  return 't=' + ts + ',v1=' + sig;
}

function dispatch(body, headers) {
  return _dispatchStripeWebhook(body, headers || {});
}
function responseOf(resp) { return JSON.parse(resp.getContent()); }

function resetStubs() {
  _logs = [];
  _dispatched = [];
  _stripeSecret = SECRET;
}

// ─── ① signature 欠落 → 拒否 ───
test('署名欠落ヘッダーは Missing signature で拒否される', function() {
  resetStubs();
  var resp = responseOf(dispatch(BODY, {}));
  assert(resp.status === 'error', 'status should be error, got ' + resp.status);
  assert(resp.message === 'Missing signature', 'message=' + resp.message);
  assert(_dispatched.length === 0, '下流dispatchは呼ばれないはず');
});

// ─── ② 不正署名 → 拒否 ───
test('不正なv1署名は Invalid signature で拒否される', function() {
  resetStubs();
  var ts = Math.floor(Date.now() / 1000);
  var badHeader = 't=' + ts + ',v1=' + Array(65).join('a'); // 64文字の誤署名
  var resp = responseOf(dispatch(BODY, { 'x-stripe-signature': badHeader }));
  assert(resp.status === 'error', 'status should be error');
  assert(resp.message === 'Invalid signature', 'message=' + resp.message);
  assert(_dispatched.length === 0, '下流dispatchは呼ばれないはず');
});

// ─── ③ タイムスタンプ期限切れ（5分許容の外側） → 拒否 ───
test('5分より古いタイムスタンプの署名は拒否される', function() {
  resetStubs();
  var oldTs = Math.floor(Date.now() / 1000) - 301; // 許容300秒の外側
  var resp = responseOf(dispatch(BODY, { 'x-stripe-signature': makeSigHeader(BODY, SECRET, oldTs) }));
  assert(resp.status === 'error', 'status should be error');
  assert(resp.message === 'Invalid signature', 'message=' + resp.message);
  assert(_dispatched.length === 0, '下流dispatchは呼ばれないはず');
});

// ─── ④ 有効署名 → 通過して下流dispatchまで到達 ───
test('有効な署名は通過し下流dispatchに到達する', function() {
  resetStubs();
  var resp = responseOf(dispatch(BODY, { 'x-stripe-signature': makeSigHeader(BODY, SECRET) }));
  assert(resp.status === 'success', 'status should be success, got ' + JSON.stringify(resp));
  assert(_dispatched.length === 1 && _dispatched[0] === 'refund',
    'type=refund(harness) が dispatch されるはず・got ' + JSON.stringify(_dispatched));
});

// ─── ⑤ secret 未設定 → 署名なしでも処理される（現行 fail-open の文書化テスト） ───
test('secret未設定時は署名なしでも処理される(fail-open・現行仕様)', function() {
  resetStubs();
  _stripeSecret = null;
  var resp = responseOf(dispatch(BODY, {}));
  assert(resp.status === 'success', 'status should be success, got ' + JSON.stringify(resp));
  assert(_dispatched.length === 1, '下流dispatchは呼ばれるはず');
});

// ─── ⑥ 形式不正（カンマ無し） → 拒否 ───
test('カンマ無しの署名形式は Invalid signature で拒否される', function() {
  resetStubs();
  var resp = responseOf(dispatch(BODY, { 'x-stripe-signature': 't=1234567890v1=abcdef' }));
  assert(resp.status === 'error', 'status should be error');
  assert(_dispatched.length === 0, '下流dispatchは呼ばれないはず');
});

// ─── ⑦ 許容境界の内側（5分ちょうど-1秒） → 通過 ───
test('タイムスタンプが許容300秒の内側なら通過する', function() {
  resetStubs();
  var nearTs = Math.floor(Date.now() / 1000) - 299;
  var resp = responseOf(dispatch(BODY, { 'x-stripe-signature': makeSigHeader(BODY, SECRET, nearTs) }));
  assert(resp.status === 'success', 'status should be success, got ' + JSON.stringify(resp));
});

// ─── 結果サマリー ───
console.log('');
console.log('Passed: ' + _results.pass + '  Failed: ' + _results.fail);
_results.errors.forEach(function(e) {
  console.log('  FAIL: ' + e.name);
  console.log('         ' + e.error);
});
process.exit(_results.fail > 0 ? 1 : 0);
