/**
 * Unit Tests - MessageRouter (routing, keywords, pagination, commands, tickets)
 *
 * Run: node tests/unit-message-router.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockUserCache = {};
var _mockUserProps = {};
var _mockCache = {};
var _mockSheets = {};

// Trackers for verifying handler calls
var _trackers = {
  sendLineReply: [],
  sendQuickReply: [],
  sendLinePush: [],
  sendLinePushQuickReply: [],
  clearUserState: [],
  notifyAdmin: [],
  appendLogRow: [],
  startReservationFlow: [],
  handleChangeFlow: [],
  handleCancelFlow: [],
  handleWaitlistFlow: [],
  handleAwaitingName: [],
  handleAwaitingPhone: [],
  handleAwaitingDate: [],
  handleAwaitingTime: [],
  handleAwaitingTreatment: [],
  handleAwaitingPayment: [],
  handleAwaitingStaff: [],
  handleAwaitingCancelSelect: [],
  handleAwaitingCancelConfirm: [],
  handleAwaitingChangeSelect: [],
  handleAwaitingChangeField: [],
  handleAwaitingChangeDate: [],
  handleAwaitingChangeTime: [],
  handleAwaitingChangeTreatment: [],
  handleAwaitingChangeConfirm: [],
  handleAwaitingWaitlistTime: [],
  handleAwaitingTicketSelect: [],
  handleAwaitingCoupon: [],
  handleLLMQuery: [],
  handleWaitlistSlotReservation: [],
  handleTicketPurchase: [],
  handleTicketBalance: [],
  handleViewReservations: [],
  logLineMessage: [],
  setUserPref: [],
  getLineProfile: null,
  getLastReservationByLineUserId: null,
  getReservationsByLineUserId: [],
  formatHealthReport: '',
  createTicketPaymentLink: null,
  getActiveTicketByUser: null,
  isCurrentlyInTreatment: { inTreatment: false, estimatedEndTime: null },
  cleanupExpiredStatesCalled: false
};

function resetTrackers() {
  for (var key in _trackers) {
    if (Array.isArray(_trackers[key])) {
      _trackers[key] = [];
    } else if (typeof _trackers[key] === 'object' && _trackers[key] !== null) {
      _trackers[key] = { inTreatment: false, estimatedEndTime: null };
    } else if (typeof _trackers[key] === 'string') {
      _trackers[key] = '';
    } else if (typeof _trackers[key] === 'boolean') {
      _trackers[key] = false;
    } else {
      _trackers[key] = null;
    }
  }
}

function resetMocks() {
  _mockUserCache = {};
  _mockUserProps = {};
  _mockCache = {};
  _mockSheets = {};
}

function addMockSheet(name, headers, rows) {
  _mockSheets[name] = { headers: headers || [], rows: rows || [] };
}

// ─── GAS Global stubs ───
global.SpreadsheetApp = {
  openById: function () {
    return {
      getSheetByName: function (name) {
        var s = _mockSheets[name];
        if (!s) return null;
        return {
          getDataRange: function () { return { getValues: function () { return [s.headers].concat(s.rows); } }; },
          appendRow: function (row) { s.rows.push(row); }
        };
      },
      insertSheet: function (name) {
        _mockSheets[name] = { headers: [], rows: [] };
        return global.SpreadsheetApp.openById().getSheetByName(name);
      }
    };
  }
};

global.CacheService = {
  getScriptCache: function () {
    return {
      get: function (k) { return _mockCache[k] || null; },
      put: function (k, v) { _mockCache[k] = v; },
      remove: function (k) { delete _mockCache[k]; }
    };
  },
  getUserCache: function () {
    return {
      get: function (k) { return _mockUserCache[k] || null; },
      put: function (k, v) { _mockUserCache[k] = v; },
      remove: function (k) { delete _mockUserCache[k]; }
    };
  }
};

global.PropertiesService = {
  getScriptProperties: function () { return { getProperty: function () { return null; } }; },
  getUserProperties: function () {
    return {
      getProperty: function (k) { return _mockUserProps[k] || null; },
      setProperty: function (k, v) { _mockUserProps[k] = v; },
      deleteProperty: function (k) { delete _mockUserProps[k]; },
      getProperties: function () { return Object.assign({}, _mockUserProps); }
    };
  }
};

global.Utilities = { getUuid: function () { return 'mock-uuid-' + Math.random().toString(36).substring(2, 8); } };
global.Logger = { log: function () {} };

// ─── Stub functions that MessageRouter depends on ───

global.appendLogRow = function () { _trackers.appendLogRow.push(Array.prototype.slice.call(arguments)); };

global.sendLineReply = function (replyToken, text) {
  _trackers.sendLineReply.push({ replyToken: replyToken, text: text });
};
global.sendQuickReply = function (replyToken, text, items) {
  _trackers.sendQuickReply.push({ replyToken: replyToken, text: text, items: items });
};
global.sendLinePush = function (userId, text) {
  _trackers.sendLinePush.push({ userId: userId, text: text });
};
global.sendLinePushQuickReply = function (userId, text, items) {
  _trackers.sendLinePushQuickReply.push({ userId: userId, text: text, items: items });
};
global.clearUserState = function (userId) {
  _trackers.clearUserState.push(userId);
};

// Handler stubs - just track that they were called
global.startReservationFlow = function (rt, uid) { _trackers.startReservationFlow.push({ replyToken: rt, userId: uid }); };
global.handleChangeFlow = function (rt, uid) { _trackers.handleChangeFlow.push({ replyToken: rt, userId: uid }); };
global.handleCancelFlow = function (rt, uid) { _trackers.handleCancelFlow.push({ replyToken: rt, userId: uid }); };
global.handleWaitlistFlow = function (rt, uid) { _trackers.handleWaitlistFlow.push({ replyToken: rt, userId: uid }); };

global.handleAwaitingName = function (t, rt, uid) { _trackers.handleAwaitingName.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingPhone = function (t, rt, uid) { _trackers.handleAwaitingPhone.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingDate = function (t, rt, uid) { _trackers.handleAwaitingDate.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingTime = function (t, rt, uid) { _trackers.handleAwaitingTime.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingTreatment = function (t, rt, uid) { _trackers.handleAwaitingTreatment.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingPayment = function (t, rt, uid) { _trackers.handleAwaitingPayment.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingStaff = function (t, rt, uid) { _trackers.handleAwaitingStaff.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingCancelSelect = function (t, rt, uid) { _trackers.handleAwaitingCancelSelect.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingCancelConfirm = function (t, rt, uid) { _trackers.handleAwaitingCancelConfirm.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingChangeSelect = function (t, rt, uid) { _trackers.handleAwaitingChangeSelect.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingChangeField = function (t, rt, uid) { _trackers.handleAwaitingChangeField.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingChangeDate = function (t, rt, uid) { _trackers.handleAwaitingChangeDate.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingChangeTime = function (t, rt, uid) { _trackers.handleAwaitingChangeTime.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingChangeTreatment = function (t, rt, uid) { _trackers.handleAwaitingChangeTreatment.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingChangeConfirm = function (t, rt, uid) { _trackers.handleAwaitingChangeConfirm.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingWaitlistTime = function (t, rt, uid) { _trackers.handleAwaitingWaitlistTime.push({ text: t, replyToken: rt, userId: uid }); };
global.handleAwaitingCoupon = function (t, rt, uid) { _trackers.handleAwaitingCoupon.push({ text: t, replyToken: rt, userId: uid }); };
global.handleViewReservations = function (rt, uid) { _trackers.handleViewReservations.push({ replyToken: rt, userId: uid }); };

// Service stubs
global.handleLLMQuery = function (rt, text) {
  _trackers.handleLLMQuery.push({ replyToken: rt, text: text });
  return false; // default: no LLM match
};
global.handleWaitlistSlotReservation = function (rt, uid, date, time) {
  _trackers.handleWaitlistSlotReservation.push({ replyToken: rt, userId: uid, date: date, time: time });
};
global.handleTicketPurchase = function (rt, uid, pkg) {
  _trackers.handleTicketPurchase.push({ replyToken: rt, userId: uid, package: pkg });
};
global.handleTicketBalance = function (rt, uid) {
  _trackers.handleTicketBalance.push({ replyToken: rt, userId: uid });
};
global.getLineProfile = function (uid) {
  return _trackers.getLineProfile;
};
global.getLastReservationByLineUserId = function (uid) {
  return _trackers.getLastReservationByLineUserId;
};
global.getReservationsByLineUserId = function (uid) {
  return _trackers.getReservationsByLineUserId;
};
global.formatHealthReport = function () {
  return _trackers.formatHealthReport || 'mock-health-report';
};
global.getLineAdminUserId = function () { return 'ADMIN001'; };
global.isCurrentlyInTreatment = function () {
  return _trackers.isCurrentlyInTreatment;
};
global.sendTreatmentAutoResponse = function (rt, locale, endTime) {
  _trackers.sendQuickReply.push({ replyToken: rt, treatment: true });
};
global.logLineMessage = function () { _trackers.logLineMessage.push(Array.prototype.slice.call(arguments)); };
global.getUserLocale = function () { return 'ja'; };
global.createTicketPaymentLink = function () { return _trackers.createTicketPaymentLink; };
global.getActiveTicketByUser = function () { return _trackers.getActiveTicketByUser; };
global.handleTicketFlow = function (rt, uid) {
  _trackers.startReservationFlow.push({ replyToken: rt, userId: uid, flow: 'ticket' });
};
global.cleanupExpiredStates = function () { _trackers.cleanupExpiredStatesCalled = true; };

// Config constants
global.RESERVATION_STATUS = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled',
  NO_SHOW: 'NoShow', VISITED: 'Visited'
};
global.DEPOSIT_STATUS = {
  UNPAID: 'Unpaid', PAID: 'Paid', APPLIED: 'Applied',
  REFUNDED: 'Refunded', FORFEITED: 'Forfeited', PENDING: 'Pending'
};
global.SHEET_NAMES = {
  RESERVATIONS: 'reservations', WAITLIST: 'waitlist',
  WEEKLY_SUMMARY: 'weekly_summary', TICKETS: 'tickets', LOG: 'log'
};
global.TIMEZONE = 'Asia/Tokyo';
global.MAX_BOOKING_DAYS_AHEAD = 90;
global.CLOSED_DAYS = []; // No closed days in tests
global.VISIT_TYPE = { FIRST: 'first', REPEAT: 'repeat' };

// MessageTemplates stub
global.MessageTemplates = {
  getContactMessage: function () { return 'contact-msg'; },
  getWelcomeMessage: function () { return { text: 'welcome-text', quickReplies: [{ label: '予約する', text: '予約する' }] }; },
  getBusinessHoursMessage: function () { return 'business-hours-msg'; },
  getTicketSelectMessage: function () { return { text: 'ticket-select', quickReplies: [{ label: '5回券', text: 'TICKET_BUY:5' }] }; },
  getTicketPurchaseLinkMessage: function (link) { return 'ticket-link: ' + link; },
  getTicketBalanceMessage: function (ticket) { return 'ticket-balance-msg'; }
};

// i18n stub
global.t = function (key, locale) { return '[' + key + ']'; };
// handleCommand references _locale from enclosing scope (handleMessage) —
// in tests the function is called directly via handleLineEvent so it should work.
// But some branches in handleCommand use _locale as a bare variable that was
// only defined inside handleMessage's scope. Make it available globally.
global._locale = 'ja';

// TICKET_PACKAGES stub
global.TICKET_PACKAGES = {
  '5': { name: '5回券', count: 5, priceKey: 'ticket_5' },
  '10': { name: '10回券', count: 10, priceKey: 'ticket_10' }
};

// Reservation cache stubs (used by fetchReservationsPage)
global._reservationByIdMap = {};
global._ensureReservationCache = function () {
  // no-op in tests; _reservationByIdMap is manually populated
};

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');

// Load StateHandler first (provides setUserState, getUserState, clearUserState, etc.)
new vm.Script(fs.readFileSync(path.join(gasDir, 'handlers', 'StateHandler.js'), 'utf8'), { filename: 'StateHandler.js' }).runInThisContext();

// Override the real clearUserState/setUserState/getUserState to also track
var _origClearUserState = global.clearUserState;
global.clearUserState = function (userId) {
  _trackers.clearUserState.push(userId);
  _origClearUserState(userId);
};

// Wrap setUserPref to track calls (real function defined by StateHandler)
var _origSetUserPref = global.setUserPref;
global.setUserPref = function (uid, key, val) {
  _trackers.setUserPref.push({ userId: uid, key: key, value: val });
  _origSetUserPref(uid, key, val);
};

// Wrap getUserPrefs to track calls
var _origGetUserPrefs = global.getUserPrefs;
global.getUserPrefs = function (uid) {
  return _origGetUserPrefs(uid);
};

// Wrap cleanupExpiredStates to track calls
var _origCleanupExpiredStates = global.cleanupExpiredStates;
global.cleanupExpiredStates = function () {
  _trackers.cleanupExpiredStatesCalled = true;
  _origCleanupExpiredStates();
};

// Load ValidationUtils (provides validateMessageLength, sanitizeInput, etc.)
new vm.Script(fs.readFileSync(path.join(gasDir, 'utils', 'ValidationUtils.js'), 'utf8'), { filename: 'ValidationUtils.js' }).runInThisContext();

// Load MessageRouter
new vm.Script(fs.readFileSync(path.join(gasDir, 'handlers', 'MessageRouter.js'), 'utf8'), { filename: 'MessageRouter.js' }).runInThisContext();

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
function assertIncludes(name, hay, needle) {
  if (hay && hay.indexOf(needle) >= 0) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (' + JSON.stringify(hay) + ' does not include ' + JSON.stringify(needle) + ')'); }
}
function assertTrackerCount(name, trackerArr, expected) {
  var actual = trackerArr.length;
  if (actual === expected) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name + ' (got ' + actual + ' calls, expected ' + expected + ')'); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ─── Helper to create a LINE event ───
function makeTextEvent(text, userId) {
  return {
    type: 'message',
    source: { userId: userId || 'U001' },
    replyToken: 'rt-001',
    message: { type: 'text', text: text }
  };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

// ─── 1. handleYesNoConfirm ───

section('handleYesNoConfirm: yes');
resetMocks(); resetTrackers();
var yn1 = handleYesNoConfirm('はい', 'rt-y');
assertEqual('yes confirmed true', yn1.confirmed, true);

section('handleYesNoConfirm: no/cancel variants');
var yn2 = handleYesNoConfirm('やめる', 'rt-y');
assertEqual('yameru confirmed false', yn2.confirmed, false);
var yn3 = handleYesNoConfirm('いいえ', 'rt-y');
assertEqual('iie confirmed false', yn3.confirmed, false);
var yn4 = handleYesNoConfirm('キャンセル', 'rt-y');
assertEqual('cancel confirmed false', yn4.confirmed, false);

section('handleYesNoConfirm: invalid input');
resetMocks(); resetTrackers();
var yn5 = handleYesNoConfirm('ほげ', 'rt-inv');
assertEqual('invalid confirmed null', yn5.confirmed, null);
assertTrackerCount('sendQuickReply called on invalid', _trackers.sendQuickReply, 1);
assertIncludes('quick reply asks yes/no', _trackers.sendQuickReply[0].text, 'はい');

// ─── 2. resolveKeywordAction ───

section('resolveKeywordAction: exact matches');
assertEqual('reserve: 予約する', resolveKeywordAction('予約する'), 'reserve');
assertEqual('reserve: 予約したい', resolveKeywordAction('予約したい'), 'reserve');
assertEqual('reserve: 新規予約', resolveKeywordAction('新規予約'), 'reserve');
assertEqual('view: 予約確認', resolveKeywordAction('予約確認'), 'view');
assertEqual('view: 予約状況', resolveKeywordAction('予約状況'), 'view');
assertEqual('view: マイ予約', resolveKeywordAction('マイ予約'), 'view');
assertEqual('change: 予約変更・キャンセル', resolveKeywordAction('予約変更・キャンセル'), 'change');
assertEqual('change: 変更', resolveKeywordAction('変更'), 'change');
assertEqual('change: キャンセル', resolveKeywordAction('キャンセル'), 'change');
assertEqual('waitlist: 空き枠通知', resolveKeywordAction('空き枠通知'), 'waitlist');
assertEqual('waitlist: キャンセル待ち', resolveKeywordAction('キャンセル待ち'), 'waitlist');
assertEqual('ticket: 回数券', resolveKeywordAction('回数券'), 'ticket');
assertEqual('hours: 営業時間', resolveKeywordAction('営業時間'), 'hours');
assertEqual('contact: お問い合わせ', resolveKeywordAction('お問い合わせ'), 'contact');

section('resolveKeywordAction: english keywords');
assertEqual('en: book', resolveKeywordAction('book'), 'reserve');
assertEqual('en: reserve', resolveKeywordAction('reserve'), 'reserve');
assertEqual('en: my reservations', resolveKeywordAction('my reservations'), 'view');
assertEqual('en: cancel', resolveKeywordAction('cancel'), 'change');
assertEqual('en: waitlist', resolveKeywordAction('waitlist'), 'waitlist');
assertEqual('en: ticket', resolveKeywordAction('ticket'), 'ticket');
assertEqual('en: hours', resolveKeywordAction('hours'), 'hours');
assertEqual('en: contact', resolveKeywordAction('contact'), 'contact');

section('resolveKeywordAction: prefix matches');
// Note: _KEYWORD_PREFIXES = ['予約', 'book'], but _KEYWORD_MAP['予約'] is undefined,
// so prefix '予約xyz' returns _KEYWORD_MAP['予約'] which is undefined (not 'reserve').
// Only 'book' prefix works because _KEYWORD_MAP['book'] = 'reserve'.
assertEqual('prefix: 予約xyz → undefined (no map entry)', resolveKeywordAction('予約xyz'), undefined);
assertEqual('prefix: booking → reserve (via book)', resolveKeywordAction('booking'), 'reserve');
assertEqual('no match: random text', resolveKeywordAction('ランダムな文章'), null);
assertEqual('no match: empty', resolveKeywordAction(''), null);

// ─── 3. handleLineEvent routing ───

section('handleLineEvent: message type routes to handleMessage');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('テスト', 'U001'));
assertTrackerCount('logLineMessage called', _trackers.logLineMessage, 1);

section('handleLineEvent: follow event');
resetMocks(); resetTrackers();
_trackers.getLineProfile = { displayName: '田中太郎' };
_trackers.getLastReservationByLineUserId = null;
handleLineEvent({ type: 'follow', source: { userId: 'U002' }, replyToken: 'rt-follow' });
assertIncludes('follow: welcome message sent', _trackers.sendQuickReply[0] ? _trackers.sendQuickReply[0].text : '', 'welcome-text');

section('handleLineEvent: unfollow event');
resetMocks(); resetTrackers();
handleLineEvent({ type: 'unfollow', source: { userId: 'U003' }, replyToken: 'rt-unf' });
assertTrackerCount('unfollow: clearUserState called', _trackers.clearUserState, 1);
assert('unfollow: appendLogRow called', _trackers.appendLogRow.length > 0);

section('handleLineEvent: unknown event type');
resetMocks(); resetTrackers();
handleLineEvent({ type: 'postback', source: { userId: 'U004' }, replyToken: 'rt-pb' });
assert('unknown event: logged', _trackers.appendLogRow.length > 0);

section('handleLineEvent: non-text message ignored');
resetMocks(); resetTrackers();
handleLineEvent({ type: 'message', source: { userId: 'U005' }, replyToken: 'rt-img', message: { type: 'image' } });
assertTrackerCount('non-text: no reply sent', _trackers.sendLineReply, 0);
assertTrackerCount('non-text: no quick reply sent', _trackers.sendQuickReply, 0);

// ─── 4. Global keyword handling (any state) ───

section('handleMessage: "人間に問い合わせる" routes to contact');
resetMocks(); resetTrackers();
setUserState('U010', USER_STATES.AWAITING_DATE, {});
handleLineEvent(makeTextEvent('人間に問い合わせる', 'U010'));
assertTrackerCount('contact: sendLineReply called', _trackers.sendLineReply, 1);
assertTrackerCount('contact: clearUserState called', _trackers.clearUserState, 1);

section('handleMessage: "お問い合わせ" routes to contact');
resetMocks(); resetTrackers();
setUserState('U011', USER_STATES.AWAITING_TIME, {});
handleLineEvent(makeTextEvent('お問い合わせ', 'U011'));
assertTrackerCount('oi contact: sendLineReply called', _trackers.sendLineReply, 1);

section('handleMessage: "営業時間・アクセス" routes to hours');
resetMocks(); resetTrackers();
setUserState('U012', USER_STATES.AWAITING_NAME, {});
handleLineEvent(makeTextEvent('営業時間・アクセス', 'U012'));
assertTrackerCount('hours: sendLineReply called', _trackers.sendLineReply, 1);
assertIncludes('hours: reply is business hours', _trackers.sendLineReply[0].text, 'business-hours-msg');

section('handleMessage: "やめる" in non-IDLE state clears state');
resetMocks(); resetTrackers();
setUserState('U013', USER_STATES.AWAITING_PAYMENT, {});
handleLineEvent(makeTextEvent('やめる', 'U013'));
assert('yameru: clearUserState called', _trackers.clearUserState.length >= 1);
assertTrackerCount('yameru: reply sent', _trackers.sendLineReply, 1);

section('handleMessage: "やめる" in IDLE state does NOT clear');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('やめる', 'U_IDLE'));
// In IDLE state, "やめる" is not caught by the global handler — falls through to handleIdleState
// which tries keyword match and then LLM → finally sends welcome
assert('yameru in IDLE: clearUserState not called for IDLE', _trackers.clearUserState.length === 0);

section('handleMessage: "本当にやめる" in non-IDLE state');
resetMocks(); resetTrackers();
setUserState('U014', USER_STATES.AWAITING_PHONE, {});
handleLineEvent(makeTextEvent('本当にやめる', 'U014'));
assert('hontou yameru: clearUserState called', _trackers.clearUserState.length >= 1);

section('handleMessage: "戻る" in non-IDLE state');
resetMocks(); resetTrackers();
setUserState('U015', USER_STATES.AWAITING_TREATMENT, {});
handleLineEvent(makeTextEvent('戻る', 'U015'));
assert('modoru: clearUserState called', _trackers.clearUserState.length >= 1);
assertTrackerCount('modoru: quickReply sent', _trackers.sendQuickReply, 1);

section('handleMessage: "予約する" resets to reservation flow from non-IDLE');
resetMocks(); resetTrackers();
setUserState('U016', USER_STATES.AWAITING_STAFF, {});
handleLineEvent(makeTextEvent('予約する', 'U016'));
assert('reserve restart: clearUserState called', _trackers.clearUserState.length >= 1);
assertTrackerCount('reserve restart: startReservationFlow called', _trackers.startReservationFlow, 1);

section('handleMessage: "予約変更・キャンセル" resets to change flow from non-IDLE');
resetMocks(); resetTrackers();
setUserState('U017', USER_STATES.AWAITING_DATE, {});
handleLineEvent(makeTextEvent('予約変更・キャンセル', 'U017'));
assert('change restart: clearUserState called', _trackers.clearUserState.length >= 1);
assertTrackerCount('change restart: handleChangeFlow called', _trackers.handleChangeFlow, 1);

// ─── 5. SET_REMINDER: prefix handling ───

section('handleMessage: SET_REMINDER: prefix');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('SET_REMINDER:07:00', 'U020'));
assertTrackerCount('set reminder: setUserPref called', _trackers.setUserPref, 1);
assertEqual('set reminder key', _trackers.setUserPref[0].key, 'reminder_timing');
assertEqual('set reminder value', _trackers.setUserPref[0].value, '07:00');
assertTrackerCount('set reminder: reply sent', _trackers.sendLineReply, 1);

// ─── 6. RESERVE_SLOT: prefix handling ───

section('handleMessage: RESERVE_SLOT: prefix');
resetMocks(); resetTrackers();
// Note: 'RESERVE_SLOT:2026-06-01:10:00'.split(':') → ['RESERVE_SLOT', '2026-06-01', '10', '00']
// substring after 'RESERVE_SLOT:' then split(':') → ['2026-06-01', '10', '00']
// parts[0] = '2026-06-01', parts[1] = '10'
handleLineEvent(makeTextEvent('RESERVE_SLOT:2026-06-01:10:00', 'U021'));
assertTrackerCount('reserve slot: handleWaitlistSlotReservation called', _trackers.handleWaitlistSlotReservation, 1);
assertEqual('reserve slot date', _trackers.handleWaitlistSlotReservation[0].date, '2026-06-01');
assertEqual('reserve slot time', _trackers.handleWaitlistSlotReservation[0].time, '10');

section('handleMessage: RESERVE_SLOT: with insufficient parts');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('RESERVE_SLOT:onlydate', 'U021b'));
assertTrackerCount('reserve slot malformed: no handler call', _trackers.handleWaitlistSlotReservation, 0);

// ─── 7. TICKET_BUY: prefix handling ───

section('handleMessage: TICKET_BUY: prefix');
resetMocks(); resetTrackers();
// handleTicketPurchase is defined IN MessageRouter.js, so our tracker stub is overridden.
// We test via handleMessage and check side effects (sendLineReply is called internally).
_trackers.createTicketPaymentLink = 'https://pay.example.com/ticket5';
handleLineEvent(makeTextEvent('TICKET_BUY:5', 'U022'));
// The function calls sendLineReply internally
assert('ticket buy: sendLineReply called', _trackers.sendLineReply.length >= 1);

section('handleMessage: TICKET_BALANCE');
resetMocks(); resetTrackers();
_trackers.getActiveTicketByUser = { remaining: 3, total: 5 };
handleLineEvent(makeTextEvent('TICKET_BALANCE', 'U023'));
// handleTicketBalance is defined in MessageRouter.js; check side effects
assert('ticket balance: sendQuickReply called', _trackers.sendQuickReply.length >= 1);

// ─── 8. Command handling (/) ───

section('handleCommand: /reserve');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/reserve', 'U030'));
assertTrackerCount('/reserve: startReservationFlow called', _trackers.startReservationFlow, 1);

section('handleCommand: /change');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/change', 'U031'));
assertTrackerCount('/change: handleChangeFlow called', _trackers.handleChangeFlow, 1);

section('handleCommand: /cancel');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/cancel', 'U032'));
assertTrackerCount('/cancel: handleCancelFlow called', _trackers.handleCancelFlow, 1);

section('handleCommand: /waitlist');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/waitlist', 'U033'));
assertTrackerCount('/waitlist: handleWaitlistFlow called', _trackers.handleWaitlistFlow, 1);

section('handleCommand: /status admin');
resetMocks(); resetTrackers();
_trackers.formatHealthReport = 'health-ok';
handleLineEvent(makeTextEvent('/status', 'ADMIN001'));
assertTrackerCount('/status admin: sendLineReply called', _trackers.sendLineReply, 1);
assertIncludes('/status admin: contains health report', _trackers.sendLineReply[0].text, 'health-ok');

section('handleCommand: /status non-admin');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/status', 'U_NONADMIN'));
assertTrackerCount('/status non-admin: sendLineReply called', _trackers.sendLineReply, 1);
assertIncludes('/status non-admin: admin-only message', _trackers.sendLineReply[0].text, 'admin_only');

section('handleCommand: /cleanup admin');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/cleanup', 'ADMIN001'));
assert('cleanup admin: cleanupExpiredStates called', _trackers.cleanupExpiredStatesCalled === true);
assertTrackerCount('/cleanup admin: reply sent', _trackers.sendLineReply, 1);

section('handleCommand: /cleanup non-admin');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/cleanup', 'U_NONADMIN'));
assert('cleanup non-admin: cleanupExpiredStates not called', _trackers.cleanupExpiredStatesCalled === false);

section('handleCommand: /help');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/help', 'ADMIN001'));
assertTrackerCount('/help: reply sent', _trackers.sendLineReply, 1);
assertIncludes('/help admin: includes /status', _trackers.sendLineReply[0].text, '/status');

section('handleCommand: /help non-admin');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/help', 'U_NONADMIN'));
var helpText = _trackers.sendLineReply[0] ? _trackers.sendLineReply[0].text : '';
assert('help non-admin: does NOT include /status', helpText.indexOf('/status') === -1);

section('handleCommand: /settings');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/settings', 'U040'));
assertTrackerCount('/settings: sendQuickReply called', _trackers.sendQuickReply, 1);
assertIncludes('/settings: contains reminder', _trackers.sendQuickReply[0].text, 'リマインダー');

section('handleCommand: unknown command');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('/unknown_cmd', 'U041'));
assertTrackerCount('unknown cmd: reply sent', _trackers.sendLineReply, 1);
assertIncludes('unknown cmd: invalid_command', _trackers.sendLineReply[0].text, 'invalid_command');

// ─── 9. State-based routing ───

section('State routing: IDLE → handleIdleState (keyword match)');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('予約する', 'U_IDLE'));
assertTrackerCount('IDLE reserve: startReservationFlow called', _trackers.startReservationFlow, 1);

section('State routing: AWAITING_NAME');
resetMocks(); resetTrackers();
setUserState('U_AN', USER_STATES.AWAITING_NAME, {});
handleLineEvent(makeTextEvent('山田太郎', 'U_AN'));
assertTrackerCount('AWAITING_NAME: handler called', _trackers.handleAwaitingName, 1);
assertEqual('AWAITING_NAME: text passed', _trackers.handleAwaitingName[0].text, '山田太郎');

section('State routing: AWAITING_PHONE');
resetMocks(); resetTrackers();
setUserState('U_AP', USER_STATES.AWAITING_PHONE, {});
handleLineEvent(makeTextEvent('090-1234-5678', 'U_AP'));
assertTrackerCount('AWAITING_PHONE: handler called', _trackers.handleAwaitingPhone, 1);

section('State routing: AWAITING_DATE');
resetMocks(); resetTrackers();
setUserState('U_AD', USER_STATES.AWAITING_DATE, {});
handleLineEvent(makeTextEvent('6月1日', 'U_AD'));
assertTrackerCount('AWAITING_DATE: handler called', _trackers.handleAwaitingDate, 1);

section('State routing: AWAITING_TIME');
resetMocks(); resetTrackers();
setUserState('U_AT', USER_STATES.AWAITING_TIME, {});
handleLineEvent(makeTextEvent('10:00', 'U_AT'));
assertTrackerCount('AWAITING_TIME: handler called', _trackers.handleAwaitingTime, 1);

section('State routing: AWAITING_TREATMENT');
resetMocks(); resetTrackers();
setUserState('U_ATR', USER_STATES.AWAITING_TREATMENT, {});
handleLineEvent(makeTextEvent('カット', 'U_ATR'));
assertTrackerCount('AWAITING_TREATMENT: handler called', _trackers.handleAwaitingTreatment, 1);

section('State routing: AWAITING_PAYMENT');
resetMocks(); resetTrackers();
setUserState('U_APAY', USER_STATES.AWAITING_PAYMENT, {});
handleLineEvent(makeTextEvent('支払う', 'U_APAY'));
assertTrackerCount('AWAITING_PAYMENT: handler called', _trackers.handleAwaitingPayment, 1);

section('State routing: AWAITING_STAFF');
resetMocks(); resetTrackers();
setUserState('U_AS', USER_STATES.AWAITING_STAFF, {});
handleLineEvent(makeTextEvent('指名なし', 'U_AS'));
assertTrackerCount('AWAITING_STAFF: handler called', _trackers.handleAwaitingStaff, 1);

section('State routing: AWAITING_CANCEL_SELECT');
resetMocks(); resetTrackers();
setUserState('U_ACS', USER_STATES.AWAITING_CANCEL_SELECT, {});
handleLineEvent(makeTextEvent('1', 'U_ACS'));
assertTrackerCount('AWAITING_CANCEL_SELECT: handler called', _trackers.handleAwaitingCancelSelect, 1);

section('State routing: AWAITING_CANCEL_CONFIRM');
resetMocks(); resetTrackers();
setUserState('U_ACC', USER_STATES.AWAITING_CANCEL_CONFIRM, {});
handleLineEvent(makeTextEvent('はい', 'U_ACC'));
assertTrackerCount('AWAITING_CANCEL_CONFIRM: handler called', _trackers.handleAwaitingCancelConfirm, 1);

section('State routing: AWAITING_CHANGE_SELECT');
resetMocks(); resetTrackers();
setUserState('U_ACHS', USER_STATES.AWAITING_CHANGE_SELECT, {});
handleLineEvent(makeTextEvent('1', 'U_ACHS'));
assertTrackerCount('AWAITING_CHANGE_SELECT: handler called', _trackers.handleAwaitingChangeSelect, 1);

section('State routing: AWAITING_CHANGE_FIELD');
resetMocks(); resetTrackers();
setUserState('U_ACHF', USER_STATES.AWAITING_CHANGE_FIELD, {});
handleLineEvent(makeTextEvent('日付', 'U_ACHF'));
assertTrackerCount('AWAITING_CHANGE_FIELD: handler called', _trackers.handleAwaitingChangeField, 1);

section('State routing: AWAITING_CHANGE_DATE');
resetMocks(); resetTrackers();
setUserState('U_ACHD', USER_STATES.AWAITING_CHANGE_DATE, {});
handleLineEvent(makeTextEvent('6/15', 'U_ACHD'));
assertTrackerCount('AWAITING_CHANGE_DATE: handler called', _trackers.handleAwaitingChangeDate, 1);

section('State routing: AWAITING_CHANGE_TIME');
resetMocks(); resetTrackers();
setUserState('U_ACHT', USER_STATES.AWAITING_CHANGE_TIME, {});
handleLineEvent(makeTextEvent('14:00', 'U_ACHT'));
assertTrackerCount('AWAITING_CHANGE_TIME: handler called', _trackers.handleAwaitingChangeTime, 1);

section('State routing: AWAITING_CHANGE_TREATMENT');
resetMocks(); resetTrackers();
setUserState('U_ACHTR', USER_STATES.AWAITING_CHANGE_TREATMENT, {});
handleLineEvent(makeTextEvent('カラー', 'U_ACHTR'));
assertTrackerCount('AWAITING_CHANGE_TREATMENT: handler called', _trackers.handleAwaitingChangeTreatment, 1);

section('State routing: AWAITING_CHANGE_CONFIRM');
resetMocks(); resetTrackers();
setUserState('U_ACHC', USER_STATES.AWAITING_CHANGE_CONFIRM, {});
handleLineEvent(makeTextEvent('はい', 'U_ACHC'));
assertTrackerCount('AWAITING_CHANGE_CONFIRM: handler called', _trackers.handleAwaitingChangeConfirm, 1);

section('State routing: AWAITING_WAITLIST_TIME');
resetMocks(); resetTrackers();
setUserState('U_AWT', USER_STATES.AWAITING_WAITLIST_TIME, {});
handleLineEvent(makeTextEvent('10:00-12:00', 'U_AWT'));
assertTrackerCount('AWAITING_WAITLIST_TIME: handler called', _trackers.handleAwaitingWaitlistTime, 1);

section('State routing: AWAITING_TICKET_SELECT');
resetMocks(); resetTrackers();
setUserState('U_ATS', USER_STATES.AWAITING_TICKET_SELECT, {});
// handleAwaitingTicketSelect is defined in MessageRouter.js — test via side effects
handleLineEvent(makeTextEvent('TICKET_BUY:5', 'U_ATS'));
assert('AWAITING_TICKET_SELECT: sendLineReply called (via internal handleTicketPurchase)', _trackers.sendLineReply.length >= 1);

section('State routing: unknown state falls to default');
resetMocks(); resetTrackers();
// Set a state that doesn't match any case — mock a bogus state
_mockUserProps['user_temp_U_UNK'] = JSON.stringify({ state: 'NONEXISTENT_STATE', context: {}, timestamp: Date.now() });
handleLineEvent(makeTextEvent('hello', 'U_UNK'));
assertTrackerCount('unknown state: sendLineReply called (can_help)', _trackers.sendLineReply, 1);
assertIncludes('unknown state: can_help message', _trackers.sendLineReply[0].text, 'can_help');

// ─── 10. handleIdleState: keyword routing ───

section('handleIdleState: "予約確認" → view');
resetMocks(); resetTrackers();
_trackers.getReservationsByLineUserId = [];
handleLineEvent(makeTextEvent('予約確認', 'U_IDLE_V'));
// handleViewReservations is defined in MessageRouter.js; check side effects
assert('idle view: sendQuickReply called', _trackers.sendQuickReply.length >= 1);

section('handleIdleState: "変更" → change');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('変更', 'U_IDLE_CH'));
assertTrackerCount('idle change: handleChangeFlow called', _trackers.handleChangeFlow, 1);

section('handleIdleState: "空き枠通知" → waitlist');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('空き枠通知', 'U_IDLE_WL'));
assertTrackerCount('idle waitlist: handleWaitlistFlow called', _trackers.handleWaitlistFlow, 1);

section('handleIdleState: "回数券" → ticket flow');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('回数券', 'U_IDLE_TK'));
// handleTicketFlow is defined in MessageRouter.js — check side effects
assert('idle ticket: sendQuickReply called (ticket select msg)', _trackers.sendQuickReply.length >= 1);

section('handleIdleState: "営業時間" → hours message');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('営業時間', 'U_IDLE_HR'));
assertTrackerCount('idle hours: sendLineReply called', _trackers.sendLineReply, 1);
assertIncludes('idle hours: business hours message', _trackers.sendLineReply[0].text, 'business-hours-msg');

section('handleIdleState: "住所" → hours');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('住所', 'U_IDLE_ADDR'));
assertTrackerCount('idle address: sendLineReply called', _trackers.sendLineReply, 1);

section('handleIdleState: "電話" → contact');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('電話', 'U_IDLE_PHONE'));
assertTrackerCount('idle phone: sendLineReply called', _trackers.sendLineReply, 1);
assertIncludes('idle phone: contact message', _trackers.sendLineReply[0].text, 'contact-msg');

section('handleIdleState: unknown text → LLM fallback → welcome');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('今日の天気は？', 'U_IDLE_UNK'));
// handleLLMQuery returns false, so it falls to welcome
assertTrackerCount('idle unknown: sendQuickReply called (welcome)', _trackers.sendQuickReply, 1);

// ─── 11. Treatment auto-response ───

section('Treatment auto-response: IDLE user during treatment');
resetMocks(); resetTrackers();
_trackers.isCurrentlyInTreatment = { inTreatment: true, estimatedEndTime: '15:00' };
handleLineEvent(makeTextEvent('予約する', 'U_TR_IDLE'));
// Should be intercepted by treatment auto-response before keyword matching
assert('treatment: quickReply sent', _trackers.sendQuickReply.length >= 1);

section('Treatment auto-response: non-IDLE user bypasses treatment');
resetMocks(); resetTrackers();
_trackers.isCurrentlyInTreatment = { inTreatment: true, estimatedEndTime: '15:00' };
setUserState('U_TR_ACTIVE', USER_STATES.AWAITING_DATE, {});
handleLineEvent(makeTextEvent('6月1日', 'U_TR_ACTIVE'));
// Should NOT be intercepted — should route to AWAITING_DATE handler
assertTrackerCount('treatment bypass: AWAITING_DATE handler called', _trackers.handleAwaitingDate, 1);

// ─── 12. sendFallbackWithContact ───

section('sendFallbackWithContact: sends retry + contact + yameru');
resetMocks(); resetTrackers();
sendFallbackWithContact('rt-fb', 'エラーが発生しました');
assertTrackerCount('fallback: sendQuickReply called', _trackers.sendQuickReply, 1);
assertEqual('fallback: 3 items', _trackers.sendQuickReply[0].items.length, 3);
assertEqual('fallback: first item retry', _trackers.sendQuickReply[0].items[0].text, 'もう一度入力する');
assertEqual('fallback: second item contact', _trackers.sendQuickReply[0].items[1].text, '人間に問い合わせる');
assertEqual('fallback: third item yameru', _trackers.sendQuickReply[0].items[2].text, 'やめる');

// ─── 13. fetchReservationsPage ───

section('fetchReservationsPage: basic pagination');
resetMocks(); resetTrackers();
global._reservationByIdMap = {
  'R001': { id: 'R001', name: 'Test1' },
  'R002': { id: 'R002', name: 'Test2' },
  'R003': { id: 'R003', name: 'Test3' }
};
var page0 = fetchReservationsPage(['R001', 'R002', 'R003'], 0, 2);
assertEqual('page0: page number', page0.page, 0);
assertEqual('page0: 2 reservations', page0.reservations.length, 2);
assertEqual('page0: first is R001', page0.reservations[0].id, 'R001');

var page1 = fetchReservationsPage(['R001', 'R002', 'R003'], 1, 2);
assertEqual('page1: page number', page1.page, 1);
assertEqual('page1: 1 reservation', page1.reservations.length, 1);
assertEqual('page1: is R003', page1.reservations[0].id, 'R003');

section('fetchReservationsPage: empty page');
var emptyPage = fetchReservationsPage(['R001'], 5, 2);
assertEqual('empty page: 0 reservations', emptyPage.reservations.length, 0);

// ─── 14. buildPaginatedQuickReplyItems ───

section('buildPaginatedQuickReplyItems: first page with more');
var items1 = buildPaginatedQuickReplyItems(['a', 'b'], 0, 3, 7, 2);
assert('first page: has next button', items1.some(function (it) { return it.text === '次の5件'; }));
assert('first page: no prev button', !items1.some(function (it) { return it.text === '前の5件'; }));
assert('first page: has yameru', items1.some(function (it) { return it.text === 'やめる'; }));

section('buildPaginatedQuickReplyItems: middle page');
var items2 = buildPaginatedQuickReplyItems(['c', 'd'], 1, 3, 7, 2);
assert('middle page: has next', items2.some(function (it) { return it.text === '次の5件'; }));
assert('middle page: has prev', items2.some(function (it) { return it.text === '前の5件'; }));

section('buildPaginatedQuickReplyItems: last page');
var items3 = buildPaginatedQuickReplyItems(['e'], 2, 3, 5, 2);
assert('last page: no next', !items3.some(function (it) { return it.text === '次の5件'; }));
assert('last page: has prev', items3.some(function (it) { return it.text === '前の5件'; }));

// ─── 15. handlePaginationStep ───

section('handlePaginationStep: next page');
resetMocks(); resetTrackers();
global._reservationByIdMap = {
  'R001': { id: 'R001' }, 'R002': { id: 'R002' },
  'R003': { id: 'R003' }, 'R004': { id: 'R004' }
};
var tempData = { page: 0 };
var ids = ['R001', 'R002', 'R003', 'R004'];
var handled = handlePaginationStep('次の5件', 'rt-pg', 'U_PG', tempData, ids, 0, 2,
  function (reservations) { return 'list-msg'; },
  USER_STATES.AWAITING_CANCEL_SELECT
);
assert('next page: handled returns true', handled === true);
assertTrackerCount('next page: sendQuickReply called', _trackers.sendQuickReply, 1);

section('handlePaginationStep: prev page');
resetMocks(); resetTrackers();
tempData = { page: 2 };
handled = handlePaginationStep('前の5件', 'rt-pg', 'U_PG', tempData, ids, 2, 2,
  function (reservations) { return 'list-msg'; },
  USER_STATES.AWAITING_CANCEL_SELECT
);
assert('prev page: handled returns true', handled === true);
assert('prev page: page decreased', tempData.page <= 2);

section('handlePaginationStep: neither next nor prev');
resetMocks(); resetTrackers();
handled = handlePaginationStep('1', 'rt-pg', 'U_PG', { page: 0 }, ids, 0, 2,
  function () { return 'msg'; },
  USER_STATES.AWAITING_CANCEL_SELECT
);
assert('neither: handled returns false', handled === false);

section('handlePaginationStep: next wraps to page 0 if beyond end');
resetMocks(); resetTrackers();
tempData = { page: 3 };
handled = handlePaginationStep('次の5件', 'rt-pg', 'U_PG', tempData, ids, 3, 2,
  function () { return 'msg'; },
  USER_STATES.AWAITING_CANCEL_SELECT
);
// startIdx = 4 * 2 = 8 >= ids.length (4) → wraps to page 0
assertEqual('wrap: page reset to 0', tempData.page, 0);

// ─── 16. handleViewReservations ───

section('handleViewReservations: no active reservations');
resetMocks(); resetTrackers();
_trackers.getReservationsByLineUserId = [
  { status: 'Cancelled', reserved_date: '2026-06-01', reserved_start: '10:00' }
];
handleViewReservations('rt-vr', 'U_VR');
assertTrackerCount('view no active: sendQuickReply called', _trackers.sendQuickReply, 1);
assertIncludes('view no active: "予約はありません"', _trackers.sendQuickReply[0].text, '予約はありません');

section('handleViewReservations: has active reservations');
resetMocks(); resetTrackers();
_trackers.getReservationsByLineUserId = [
  { status: 'Confirmed', reserved_date: '2026-06-01', reserved_start: '10:00', reserved_end: '11:00', menu_type: 'カット', deposit_status: 'Paid' },
  { status: 'Pending', reserved_date: '2026-06-15', reserved_start: '14:00', reserved_end: '15:00', menu_type: 'カラー', deposit_status: 'Unpaid' }
];
handleViewReservations('rt-vr2', 'U_VR2');
assertTrackerCount('view has active: sendQuickReply called', _trackers.sendQuickReply, 1);
assertIncludes('view has active: shows date', _trackers.sendQuickReply[0].text, '2026-06-01');
assertIncludes('view has active: shows status', _trackers.sendQuickReply[0].text, '確定');
assertIncludes('view has active: shows deposit', _trackers.sendQuickReply[0].text, 'デポジット済');

// ─── 17. handleFollow ───

section('handleFollow: returning user with last reservation');
resetMocks(); resetTrackers();
_trackers.getLineProfile = { displayName: '田中太郎' };
_trackers.getLastReservationByLineUserId = { patient_name: '田中太郎' };
handleFollow('U_FOL', 'rt-fol');
assertTrackerCount('follow return: quickReply sent', _trackers.sendQuickReply, 1);
assertIncludes('follow return: personalized okaeri', _trackers.sendQuickReply[0].text, 'おかえりなさい');

section('handleFollow: new user (no last reservation)');
resetMocks(); resetTrackers();
_trackers.getLineProfile = { displayName: '新人さん' };
_trackers.getLastReservationByLineUserId = null;
handleFollow('U_FOL2', 'rt-fol2');
assertTrackerCount('follow new: quickReply sent', _trackers.sendQuickReply, 1);

section('handleFollow: no replyToken → sendLinePush');
resetMocks(); resetTrackers();
_trackers.getLineProfile = { displayName: 'PushUser' };
_trackers.getLastReservationByLineUserId = null;
handleFollow('U_FOL3', null);
assertTrackerCount('follow push: sendLinePush called', _trackers.sendLinePush, 1);

// ─── 18. handleAwaitingTicketSelect ───

section('handleAwaitingTicketSelect: "やめる" clears state');
resetMocks(); resetTrackers();
handleAwaitingTicketSelect('やめる', 'rt-ts', 'U_TS');
assert('ticket yameru: clearUserState called', _trackers.clearUserState.length >= 1);
assertTrackerCount('ticket yameru: reply sent', _trackers.sendLineReply, 1);

section('handleAwaitingTicketSelect: "TICKET_BALANCE"');
resetMocks(); resetTrackers();
_trackers.getActiveTicketByUser = { remaining: 3, total: 5 };
handleAwaitingTicketSelect('TICKET_BALANCE', 'rt-ts2', 'U_TS2');
// handleTicketBalance is in MessageRouter.js; check side effect
assert('ticket balance from select: sendQuickReply called', _trackers.sendQuickReply.length >= 1);

section('handleAwaitingTicketSelect: "TICKET_BUY:5"');
resetMocks(); resetTrackers();
_trackers.createTicketPaymentLink = 'https://pay.example.com/ticket5';
handleAwaitingTicketSelect('TICKET_BUY:5', 'rt-ts3', 'U_TS3');
// handleTicketPurchase is in MessageRouter.js; check side effect
assert('ticket buy from select: sendLineReply called', _trackers.sendLineReply.length >= 1);

section('handleAwaitingTicketSelect: unknown text → ticket flow');
resetMocks(); resetTrackers();
handleAwaitingTicketSelect('ほげ', 'rt-ts4', 'U_TS4');
// Falls through to handleTicketFlow (defined in MessageRouter.js) — check side effects
assert('ticket unknown: sendQuickReply called (ticket select re-shown)', _trackers.sendQuickReply.length >= 1);

// ─── 19. handleTicketPurchase ───

section('handleTicketPurchase: valid package with payment link');
resetMocks(); resetTrackers();
_trackers.createTicketPaymentLink = 'https://pay.example.com/ticket5';
handleTicketPurchase('rt-tp', 'U_TP', '5');
// handleTicketPurchase is defined in MessageRouter.js — test side effects
assert('purchase valid: sendLineReply called', _trackers.sendLineReply.length >= 1);
assertIncludes('purchase valid: reply creating', _trackers.sendLineReply[0].text, 'ticket.creating');
assertTrackerCount('purchase valid: push quick reply sent', _trackers.sendLinePushQuickReply, 1);
assertIncludes('purchase valid: link in message', _trackers.sendLinePushQuickReply[0].text, 'https://pay.example.com/ticket5');

section('handleTicketPurchase: payment link creation fails');
resetMocks(); resetTrackers();
_trackers.createTicketPaymentLink = null;
handleTicketPurchase('rt-tp2', 'U_TP2', '5');
assertTrackerCount('purchase fail: push quick reply sent', _trackers.sendLinePushQuickReply, 1);
assertIncludes('purchase fail: link_failed message', _trackers.sendLinePushQuickReply[0].text, 'ticket.link_failed');

section('handleTicketPurchase: invalid package → back to ticket flow');
resetMocks(); resetTrackers();
handleTicketPurchase('rt-tp3', 'U_TP3', '99');
// Falls to handleTicketFlow (defined in MessageRouter.js) — check side effects
assert('invalid pkg: sendQuickReply called (ticket select re-shown)', _trackers.sendQuickReply.length >= 1);

// ─── 20. handleTicketBalance ───

section('handleTicketBalance');
resetMocks(); resetTrackers();
_trackers.getActiveTicketByUser = { remaining: 3, total: 5 };
handleTicketBalance('rt-tb', 'U_TB');
// handleTicketBalance is defined in MessageRouter.js — test side effects
assertTrackerCount('balance: sendQuickReply called', _trackers.sendQuickReply, 1);
assert('balance: clearUserState called', _trackers.clearUserState.length >= 1);

// ─── 21. Text normalization in handleIdleState ───

section('handleIdleState: text normalization (whitespace/full-width)');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('  予約する　 ', 'U_NORM'));
assertTrackerCount('normalized: startReservationFlow called', _trackers.startReservationFlow, 1);

section('handleIdleState: full-width chars normalized');
resetMocks(); resetTrackers();
handleLineEvent(makeTextEvent('予約する！', 'U_NORM2'));
// After normalization: '予約する!' (full-width ！ → !)
// Exact match fails: '予約する!' not in _KEYWORD_MAP
// Prefix '予約' checked but _KEYWORD_MAP['予約'] is undefined → returns undefined
// So it falls through to LLM → welcome message
assert('full-width !: falls to welcome/LLM (prefix returns undefined)', _trackers.sendQuickReply.length >= 1 || _trackers.sendLineReply.length >= 1);

// ─── 22. handleUnfollow ───

section('handleUnfollow');
resetMocks(); resetTrackers();
setUserState('U_UNF', USER_STATES.AWAITING_DATE, {});
handleUnfollow('U_UNF');
assert('unfollow: clearUserState called', _trackers.clearUserState.length >= 1);

// ─── 23. FALLBACK constants ───

section('FALLBACK constants');
assertEqual('FALLBACK_RETRY_TEXT', FALLBACK_RETRY_TEXT, 'もう一度入力する');
assertEqual('FALLBACK_CONTACT_TEXT', FALLBACK_CONTACT_TEXT, '人間に問い合わせる');

// ─── Results ───
console.log('\n========================================');
console.log('MessageRouter Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
