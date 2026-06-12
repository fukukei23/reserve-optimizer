/**
 * Unit Tests - ReviewHandler (口コミ依頼・評価分岐)
 *
 * Run: node tests/unit-review-handler.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── GAS global stubs (before file loads) ───
var _mockUserCache = {};
var _mockUserProps = {};
var _mockScriptProps = {};

global.SpreadsheetApp = { openById: function() { return { getSheetByName: function() { return null; } }; } };
global.CacheService = {
  getScriptCache: function() {
    return { get: function() { return null; }, put: function() {}, remove: function() {} };
  },
  getUserCache: function() {
    return {
      get: function(k) { return _mockUserCache[k] || null; },
      put: function(k, v) { _mockUserCache[k] = v; },
      remove: function(k) { delete _mockUserCache[k]; }
    };
  }
};
global.PropertiesService = {
  getScriptProperties: function() {
    return {
      getProperty: function(k) { return _mockScriptProps[k] || null; },
      setProperty: function(k, v) { _mockScriptProps[k] = v; }
    };
  },
  getUserProperties: function() {
    return {
      getProperty: function(k) { return _mockUserProps[k] || null; },
      setProperty: function(k, v) { _mockUserProps[k] = v; },
      deleteProperty: function(k) { delete _mockUserProps[k]; },
      getProperties: function() { return Object.assign({}, _mockUserProps); }
    };
  }
};
global.Utilities = { getUuid: function() { return 'test-uuid'; } };
global.Logger = { log: function() {} };

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(rel) {
  var code = fs.readFileSync(path.join(gasDir, rel), 'utf8');
  new vm.Script(code, {filename: path.basename(rel)}).runInThisContext();
}

loadFile('config/ScriptProperties.js');
loadFile('handlers/StateHandler.js');
loadFile('handlers/ReviewHandler.js');

// ─── Spy infrastructure (defined AFTER file loads to override loaded fns) ───
var _replies = [];
var _quickReplies = [];
var _pushes = [];
var _cleared = [];
var _logs = [];

global.sendLineReply = function(rt, text) { _replies.push({rt: rt, text: text}); };
global.sendQuickReply = function(rt, text, items) { _quickReplies.push({rt: rt, text: text, items: items}); };
global.sendLinePush = function(userId, text) { _pushes.push({userId: userId, text: text}); };
global.clearUserState = function(userId) { _cleared.push(userId); };
global.appendLogRow = function(level, msg) { _logs.push({level: level, msg: msg}); };

var MOCK_REVIEW_URL = 'https://g.page/r/test/review';
var MOCK_ADMIN_ID   = 'ADMIN001';

function setConfig(reviewUrl, adminId) {
  _mockScriptProps['GOOGLE_REVIEW_URL']     = reviewUrl || MOCK_REVIEW_URL;
  _mockScriptProps['LINE_ADMIN_USER_ID']     = adminId  || MOCK_ADMIN_ID;
}

function resetSpies() {
  _replies = []; _quickReplies = []; _pushes = []; _cleared = []; _logs = [];
}
function resetAll() {
  resetSpies();
  _mockUserCache = {}; _mockUserProps = {};
  _mockScriptProps = {};
  setConfig();
}

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name); }
}
function assertEqual(name, a, e) {
  if (a === e) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(e) + ')'); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ─── Tests ───

section('_parseRating: valid inputs');
assertEqual('★5 → 5',   _parseRating('★5'), 5);
assertEqual('★1 → 1',   _parseRating('★1'), 1);
assertEqual('5 → 5',    _parseRating('5'),   5);
assertEqual('1 → 1',    _parseRating('1'),   1);
assertEqual('★3 → 3',   _parseRating('★3'), 3);
assertEqual(' ★4  → 4', _parseRating(' ★4 '), 4);

section('_parseRating: invalid inputs');
assertEqual('null → null',     _parseRating(null),      null);
assertEqual('empty → null',    _parseRating(''),         null);
assertEqual('0 → null',        _parseRating('0'),        null);
assertEqual('6 → null',        _parseRating('6'),        null);
assertEqual('abc → null',      _parseRating('abc'),      null);
assertEqual('やめる → null',   _parseRating('やめる'),  null);

section('handleAwaitingReviewRating: ★5 → Google review URL sent');
resetAll();
setUserState('U001', USER_STATES.AWAITING_REVIEW_RATING, {reservation_id: 'R001'});
handleAwaitingReviewRating('★5', 'rt-01', 'U001');
assert('reply sent',           _replies.length === 1);
assert('reply has review URL', _replies[0].text.indexOf(MOCK_REVIEW_URL) >= 0);
assert('reply has ★5',         _replies[0].text.indexOf('★5') >= 0);
assert('state cleared',        _cleared.indexOf('U001') >= 0);
assert('no admin push',        _pushes.length === 0);

section('handleAwaitingReviewRating: ★4 → Google review URL sent');
resetAll();
setUserState('U002', USER_STATES.AWAITING_REVIEW_RATING, {});
handleAwaitingReviewRating('★4', 'rt-02', 'U002');
assert('★4: reply sent',          _replies.length === 1);
assert('★4: contains review URL', _replies[0].text.indexOf(MOCK_REVIEW_URL) >= 0);
assert('★4: no admin push',       _pushes.length === 0);

section('handleAwaitingReviewRating: ★3 → internal feedback + admin notify');
resetAll();
setUserState('U003', USER_STATES.AWAITING_REVIEW_RATING, {reservation_id: 'R003'});
handleAwaitingReviewRating('★3', 'rt-03', 'U003');
assert('★3: reply sent',             _replies.length === 1);
assert('★3: no review URL',          _replies[0].text.indexOf(MOCK_REVIEW_URL) < 0);
assert('★3: admin push sent',        _pushes.length === 1);
assert('★3: admin push to ADMIN001', _pushes[0].userId === MOCK_ADMIN_ID);
assert('★3: admin msg has ★3',       _pushes[0].text.indexOf('★3') >= 0);
assert('★3: admin msg has R003',     _pushes[0].text.indexOf('R003') >= 0);
assert('★3: state cleared',          _cleared.indexOf('U003') >= 0);

section('handleAwaitingReviewRating: ★2 → admin notify');
resetAll();
setUserState('U004', USER_STATES.AWAITING_REVIEW_RATING, {});
handleAwaitingReviewRating('★2', 'rt-04', 'U004');
assert('★2: admin push sent', _pushes.length === 1);
assert('★2: msg has ★2',     _pushes[0].text.indexOf('★2') >= 0);

section('handleAwaitingReviewRating: ★1 → admin notify');
resetAll();
setUserState('U005', USER_STATES.AWAITING_REVIEW_RATING, {});
handleAwaitingReviewRating('★1', 'rt-05', 'U005');
assert('★1: admin push sent', _pushes.length === 1);

section('handleAwaitingReviewRating: やめる → graceful exit');
resetAll();
setUserState('U006', USER_STATES.AWAITING_REVIEW_RATING, {});
handleAwaitingReviewRating('やめる', 'rt-06', 'U006');
assert('やめる: reply sent',    _replies.length === 1);
assert('やめる: state cleared', _cleared.indexOf('U006') >= 0);
assert('やめる: no admin push', _pushes.length === 0);
assert('やめる: no review URL', _replies[0].text.indexOf(MOCK_REVIEW_URL) < 0);

section('handleAwaitingReviewRating: invalid input → re-prompt with quickReply');
resetAll();
setUserState('U007', USER_STATES.AWAITING_REVIEW_RATING, {});
handleAwaitingReviewRating('ありがとう', 'rt-07', 'U007');
assert('invalid: quickReply sent',        _quickReplies.length === 1);
assert('invalid: no clearState',          _cleared.length === 0);
assert('invalid: quickReply has ★5 opt', _quickReplies[0].items.some(function(i) { return i.label === '★5'; }));

section('handleAwaitingReviewRating: admin ID unset → no crash, reply still sent');
resetAll();
_mockScriptProps['GOOGLE_REVIEW_URL'] = MOCK_REVIEW_URL;
_mockScriptProps['LINE_ADMIN_USER_ID'] = '';
setUserState('U008', USER_STATES.AWAITING_REVIEW_RATING, {});
handleAwaitingReviewRating('★2', 'rt-08', 'U008');
assert('no admin: reply sent',    _replies.length === 1);
assert('no admin: no push crash', _pushes.length === 0);

section('handleAwaitingReviewRating: no reservation_id in context → no crash');
resetAll();
setUserState('U009', USER_STATES.AWAITING_REVIEW_RATING, {});
handleAwaitingReviewRating('★1', 'rt-09', 'U009');
assert('no ctx: admin push sent',    _pushes.length === 1);
assert('no ctx: msg no "undefined"', _pushes[0].text.indexOf('undefined') < 0);

section('handleAwaitingReviewRating: INFO log written');
resetAll();
setUserState('U010', USER_STATES.AWAITING_REVIEW_RATING, {reservation_id: 'R010'});
handleAwaitingReviewRating('★5', 'rt-10', 'U010');
assert('log entry written',    _logs.some(function(l) { return l.level === 'INFO' && l.msg.indexOf('R010') >= 0; }));

section('handleAwaitingReviewRating: "5" (no ★) also works');
resetAll();
setUserState('U011', USER_STATES.AWAITING_REVIEW_RATING, {});
handleAwaitingReviewRating('5', 'rt-11', 'U011');
assert('"5": review URL sent', _replies.length === 1 && _replies[0].text.indexOf(MOCK_REVIEW_URL) >= 0);

section('_buildRatingQuickReplies');
var qr = _buildRatingQuickReplies();
assert('6 options total', qr.length === 6);
assert('first is ★5',    qr[0].label === '★5');
assert('last is やめる', qr[qr.length - 1].label === 'やめる');
assert('★1 present',     qr.some(function(i) { return i.label === '★1'; }));

// ─── Results ───
console.log('\n========================================');
console.log('ReviewHandler Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) { console.log('\nFailed:'); for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]); }
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
