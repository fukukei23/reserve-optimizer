/**
 * Unit Tests - FollowUpService (FEATURE_REVIEW_REQUEST フラグ分岐)
 *
 * Run: node tests/unit-followup-service.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state (before file loads) ───
var _mockCache = {};
var _mockUserCache = {};
var _mockUserProps = {};
var _reviewFeatureOn = false;

var _mockSheetData = {
  reservations: { headers: [], rows: [] }
};

global.SpreadsheetApp = {
  openById: function() {
    return {
      getSheetByName: function(name) {
        var s = _mockSheetData[name];
        if (!s) return null;
        return {
          getDataRange: function() { return { getValues: function() { return [s.headers].concat(s.rows); } }; },
          appendRow: function(row) { s.rows.push(row); },
          getLastRow: function() { return s.rows.length + 1; },
          getRange: function(row, col) {
            return {
              getValue: function() { return s.rows[row - 2] ? s.rows[row - 2][col - 1] : ''; },
              setValues: function(vals) {
                if (s.rows[row - 2]) {
                  for (var i = 0; i < vals[0].length; i++) {
                    s.rows[row - 2][col - 1 + i] = vals[0][i];
                  }
                }
              }
            };
          }
        };
      },
      insertSheet: function(name) {
        _mockSheetData[name] = {headers: [], rows: []};
        return global.SpreadsheetApp.openById().getSheetByName(name);
      }
    };
  }
};
global.CacheService = {
  getScriptCache: function() {
    return {
      get: function(k) { return _mockCache[k] || null; },
      put: function(k, v) { _mockCache[k] = v; },
      remove: function(k) { delete _mockCache[k]; }
    };
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
      getProperty: function(k) {
        if (k === 'FEATURE_REVIEW_REQUEST') return _reviewFeatureOn ? 'true' : 'false';
        return null;
      },
      setProperty: function() {}
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
global.Utilities = {
  formatDate: function(d, tz, fmt) {
    return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
  },
  getUuid: function() { return 'test-uuid'; }
};
global.Logger = { log: function() {} };
global.UrlFetchApp = { fetch: function() { return {getResponseCode: function() { return 200; }}; } };
global.LockService = { getScriptLock: function() { return {waitLock: function() {}, releaseLock: function() {}}; } };

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(rel) {
  var code = fs.readFileSync(path.join(gasDir, rel), 'utf8');
  new vm.Script(code, {filename: path.basename(rel)}).runInThisContext();
}

loadFile('config/SheetConfig.js');
loadFile('config/ScriptProperties.js');
loadFile('i18n/Locales.js');
loadFile('i18n/I18n.js');
loadFile('templates/MessageTemplates.js');
loadFile('handlers/StateHandler.js');
loadFile('services/SheetService.js');
loadFile('services/FollowUpService.js');

// ─── Spy infrastructure (AFTER file loads to override loaded fns) ───
var _lastPushText = null;
var _lastPushQuickReplies = null;
var _lastPushUserId = null;
var _setStateCalls = [];
var _updatedReservations = [];

global.appendLogRow = function() {};
global.getFollowUpHoursAfter = function() { return 24; };
global.sendLinePushQuickReply = function(userId, text, qr) {
  _lastPushUserId = userId;
  _lastPushText = text;
  _lastPushQuickReplies = qr;
};

// Spy updateReservation — wrap the real one
var _realUpdateReservation = updateReservation;
global.updateReservation = function(id, updates) {
  _updatedReservations.push({id: id, updates: updates});
  _realUpdateReservation(id, updates);
};

// Spy setUserState — wrap the real one
var _realSetUserState = setUserState;
global.setUserState = function(userId, state, ctx) {
  _setStateCalls.push({userId: userId, state: state, ctx: ctx});
  _realSetUserState(userId, state, ctx);
};

global.isFirebaseConfigured = function() { return false; };

// ─── Sheet setup ───
var HEADERS = [
  'reservation_id', 'created_at', 'patient_name', 'phone', 'line_display_name',
  'visit_type', 'menu_type', 'reserved_date', 'reserved_start', 'reserved_end',
  'status', 'deposit_required', 'deposit_amount', 'deposit_status',
  'reminder_sent', 'reminder_response', 'cancel_time', 'resale_notified',
  'resale_success', 'average_unit_price', 'notes', 'payment_intent_id',
  'follow_up_sent', 'used_ticket'
];
_mockSheetData.reservations.headers = HEADERS;

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ─── Helpers ───
function resetSpies() {
  _lastPushText = null; _lastPushQuickReplies = null; _lastPushUserId = null;
  _setStateCalls = []; _updatedReservations = [];
}
function clearReservations() {
  _mockSheetData.reservations.rows = [];
  _mockCache = {}; _mockUserCache = {};
  _invalidateReservationCache();
}

function makeTargetDate() {
  var d = new Date();
  d.setHours(d.getHours() - 24);
  return d;
}

function addTargetReservation(id, lineUser, followUpSent, status) {
  var d = makeTargetDate();
  var dateStr = d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
  var endTime = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  var startHour = d.getHours() - 1 >= 0 ? d.getHours() - 1 : 23;
  var startTime = ('0' + startHour).slice(-2) + ':00';
  _mockSheetData.reservations.rows.push([
    id, new Date(), 'テスト患者', '09011112222', lineUser || 'U001',
    'First', '初診（30分）', dateStr, startTime, endTime,
    status || 'Visited', 'Y', 1000, 'Paid', 'N', '', '', 'N', 'N', 5000, '', '',
    followUpSent || 'N', ''
  ]);
  _invalidateReservationCache();
}

// ─── Tests ───

section('FEATURE_REVIEW_REQUEST OFF: sends standard follow-up message');
clearReservations(); resetSpies();
_reviewFeatureOn = false;
addTargetReservation('R001', 'U001', 'N');
sendPostVisitFollowUps();
assert('push sent',              _lastPushText !== null);
assert('standard follow-up msg', _lastPushText.indexOf('ありがとうございました') >= 0);
assert('2 quickReplies',         _lastPushQuickReplies !== null && _lastPushQuickReplies.length === 2);
assert('no setUserState called', _setStateCalls.length === 0);
assert('follow_up_sent updated', _updatedReservations.length === 1 && _updatedReservations[0].updates.follow_up_sent === 'Y');

section('FEATURE_REVIEW_REQUEST ON: sends rating request message');
clearReservations(); resetSpies();
_reviewFeatureOn = true;
addTargetReservation('R002', 'U002', 'N');
sendPostVisitFollowUps();
assert('push sent',              _lastPushText !== null);
assert('rating request msg',     _lastPushText.indexOf('満足度') >= 0);
assert('6 quickReplies',         _lastPushQuickReplies !== null && _lastPushQuickReplies.length === 6);
assert('setUserState called',    _setStateCalls.length === 1);
assert('state is AWAITING_REVIEW_RATING', _setStateCalls[0].state === 'AWAITING_REVIEW_RATING');
assert('context has reservation_id',      _setStateCalls[0].ctx.reservation_id === 'R002');
assert('userId matches lineUser',         _setStateCalls[0].userId === 'U002');
assert('follow_up_sent updated', _updatedReservations.length === 1 && _updatedReservations[0].updates.follow_up_sent === 'Y');

section('FEATURE_REVIEW_REQUEST ON: already sent → skip');
clearReservations(); resetSpies();
_reviewFeatureOn = true;
addTargetReservation('R003', 'U003', 'Y');
sendPostVisitFollowUps();
assert('already sent: no push',         _lastPushText === null);
assert('already sent: no setUserState', _setStateCalls.length === 0);

section('FEATURE_REVIEW_REQUEST ON: wrong status → skip');
clearReservations(); resetSpies();
_reviewFeatureOn = true;
addTargetReservation('R004', 'U004', 'N', 'Confirmed');
sendPostVisitFollowUps();
assert('Confirmed: no push', _lastPushText === null);

// ─── Results ───
console.log('\n========================================');
console.log('FollowUpService Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) { console.log('\nFailed:'); for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]); }
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
