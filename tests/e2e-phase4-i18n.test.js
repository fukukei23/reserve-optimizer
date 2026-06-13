/**
 * Phase 4-1 E2E Tests - i18n module
 *
 * Run: node tests/e2e-phase4-i18n.test.js
 *
 * Tests Locales.js catalog, I18n.js t()/tf()/getUserLocale(),
 * and MessageTemplates i18n output.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals ───
var mockUserProps = {};

global.PropertiesService = {
  getUserProperties: function() {
    return {
      getProperty: function(k) { return mockUserProps[k] || null; },
      setProperty: function(k, v) { mockUserProps[k] = v; }
    };
  },
  getScriptProperties: function() {
    return {
      getProperty: function(k) { return null; },
      setProperty: function() {}
    };
  }
};

global.CacheService = {
  getScriptCache: function() {
    return { get: function() { return null; }, put: function() {} };
  }
};

global.ContentService = {
  createTextOutput: function(t) { return { setMimeType: function() { return t; } }; },
  MimeType: { JSON: 'application/json' }
};

global.Logger = { log: function() {} };
global.Utilities = { formatDate: function(d) { return d.toISOString(); } };
global.SpreadsheetApp = { openById: function() { return { getSheetByName: function() { return null; } }; } };
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };

// Stub functions
global.getDepositAmount = function() { return 1000; };
global.getCancellationDeadlineHours = function() { return 24; };
global.getNoShowThreshold = function() { return 3; };
global.getNoShowDepositAmount = function() { return 3000; };
global.getBusinessHours = function() { return '09:00-18:00'; };
global.getBusinessAddress = function() { return 'Tokyo'; };
global.getContactPhone = function() { return '03-1234-5678'; };
global.getContactUrl = function() { return 'https://example.com'; };
global.appendLogRow = function() {};

// DEPOSIT_STATUS and RESERVATION_STATUS
global.DEPOSIT_STATUS = { UNPAID: 'Unpaid', PAID: 'Paid', REFUNDED: 'Refunded', FAILED: 'Failed' };
global.RESERVATION_STATUS = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', NO_SHOW: 'NoShow' };
global.VISIT_TYPE = { FIRST: 'First', REPEAT: 'Repeat' };
global.TREATMENT_DURATIONS = { '初診（30分）': 30, '再診（30分）': 30, '再診（60分）': 60 };

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');

function loadFile(filepath) {
  var code = fs.readFileSync(filepath, 'utf8');
  var script = new vm.Script(code, { filename: path.basename(filepath) });
  script.runInThisContext();
}

loadFile(path.join(gasDir, 'i18n', 'Locales.js'));
loadFile(path.join(gasDir, 'i18n', 'I18n.js'));
loadFile(path.join(gasDir, 'handlers', 'StateHandler.js'));

// Stub functions needed by MessageTemplates (loaded later)
global.getClinicMapUrl = function() { return ''; };

// ─── Test framework ───
var passed = 0;
var failed = 0;
var errors = [];

function assert(name, condition, detail) {
  if (condition) {
    passed++;
    console.log('  PASS ' + name);
  } else {
    failed++;
    errors.push(name + (detail ? ' -- ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? ' (' + detail + ')' : ''));
  }
}

function section(title) { console.log('\n== ' + title + ' =='); }

// ─── Tests ───

section('Locales: MESSAGES catalog structure');

assert('MESSAGES is an object', typeof MESSAGES === 'object');
assert('MESSAGES has welcome.text', MESSAGES['welcome.text'] !== undefined);
assert('welcome.text has ja', MESSAGES['welcome.text'].ja !== undefined);
assert('welcome.text has en', MESSAGES['welcome.text'].en !== undefined);
assert('welcome.text ja is Japanese', MESSAGES['welcome.text'].ja.indexOf('整骨院') >= 0);
assert('welcome.text en is English', MESSAGES['welcome.text'].en.indexOf('Welcome') >= 0);

section('I18n: t() function');

assert('t() ja returns Japanese', t('welcome.text', 'ja').indexOf('整骨院') >= 0);
assert('t() en returns English', t('welcome.text', 'en').indexOf('Welcome') >= 0);
assert('t() defaults to ja', t('welcome.text') === t('welcome.text', 'ja'));
assert('t() unknown key returns key', t('nonexistent.key', 'ja') === 'nonexistent.key');
assert('t() missing locale falls back to ja', t('welcome.text', 'zh') === t('welcome.text', 'ja'));

section('I18n: tf() function with placeholders');

assert('tf() fills placeholders ja', tf('confirm.see_you', {startTime: '10:00'}, 'ja').indexOf('10:00') >= 0);
assert('tf() fills placeholders en', tf('confirm.see_you', {startTime: '10:00'}, 'en').indexOf('10:00') >= 0);
assert('tf() without values returns template', tf('welcome.text', null, 'ja') === t('welcome.text', 'ja'));

section('I18n: getUserLocale()');

assert('getUserLocale returns ja by default', getUserLocale('unknown_user') === 'ja');

// Set user preference to English
var prefsData = JSON.stringify({ language: 'en', reminder_timing: '08:00' });
mockUserProps['user_prefs_test_en_user'] = prefsData;
assert('getUserLocale returns en when set', getUserLocale('test_en_user') === 'en');

// Set back to Japanese
mockUserProps['user_prefs_test_ja_user'] = JSON.stringify({ language: 'ja' });
assert('getUserLocale returns ja when set', getUserLocale('test_ja_user') === 'ja');

section('I18n: catalog coverage check');

var jaKeys = Object.keys(MESSAGES);
var missingEn = [];
for (var i = 0; i < jaKeys.length; i++) {
  if (!MESSAGES[jaKeys[i]].en) {
    missingEn.push(jaKeys[i]);
  }
}
assert('All keys have en translation', missingEn.length === 0,
  'Missing en: ' + missingEn.join(', '));
assert('Catalog has 50+ keys', jaKeys.length >= 50, 'got ' + jaKeys.length);

section('MessageTemplates: i18n output');

loadFile(path.join(gasDir, 'templates', 'MessageTemplates.js'));

var welcomeJa = MessageTemplates.getWelcomeMessage('ja');
assert('Welcome ja has quickReplies', Array.isArray(welcomeJa.quickReplies));
assert('Welcome ja first reply is Japanese', welcomeJa.quickReplies[0].label === '予約する');

var welcomeEn = MessageTemplates.getWelcomeMessage('en');
assert('Welcome en first reply is English', welcomeEn.quickReplies[0].label === 'Book');
assert('Welcome en has 5 quickReplies', welcomeEn.quickReplies.length === 5);

var menuJa = MessageTemplates.getMenuOptionsMessage('ja');
assert('Menu ja has Japanese', menuJa.indexOf('初診') >= 0);

var menuEn = MessageTemplates.getMenuOptionsMessage('en');
assert('Menu en has English', menuEn.indexOf('First visit') >= 0);

var mockReservation = {
  id: 'R0001',
  patient_name: 'Test',
  reserved_date: '2026/06/15',
  reserved_start: '10:00',
  reserved_end: '10:30',
  menu_type: '再診（30分）',
  deposit_status: 'Unpaid',
  deposit_amount: 1000
};

var confirmJa = MessageTemplates.getConfirmationMessage(mockReservation, 'ja');
assert('Confirm ja has Japanese title', confirmJa.indexOf('確定') >= 0);
assert('Confirm ja has reservation ID', confirmJa.indexOf('R0001') >= 0);

var confirmEn = MessageTemplates.getConfirmationMessage(mockReservation, 'en');
assert('Confirm en has English title', confirmEn.indexOf('confirmed') >= 0);
assert('Confirm en has reservation ID', confirmEn.indexOf('R0001') >= 0);

var contactJa = MessageTemplates.getContactMessage('ja');
assert('Contact ja has Japanese', contactJa.indexOf('お問い合わせ') >= 0);

var contactEn = MessageTemplates.getContactMessage('en');
assert('Contact en has English', contactEn.indexOf('Thank you') >= 0);

var hoursJa = MessageTemplates.getBusinessHoursMessage('ja');
assert('Hours ja has 営業時間', hoursJa.indexOf('営業時間') >= 0);

var hoursEn = MessageTemplates.getBusinessHoursMessage('en');
assert('Hours en has Hours', hoursEn.indexOf('Hours') >= 0);

var reminderJa = MessageTemplates.getReminderMessage('2026/06/15', '10:00', '再診（30分）', 'ja');
assert('Reminder ja has quickReplies', Array.isArray(reminderJa.quickReplies));
assert('Reminder ja text has Japanese', reminderJa.text.indexOf('ご予約') >= 0);

var reminderEn = MessageTemplates.getReminderMessage('2026/06/15', '10:00', '再診（30分）', 'en');
assert('Reminder en text has English', reminderEn.text.indexOf('appointment') >= 0);

var refundJa = MessageTemplates.getRefundConfirmationMessage('R0001', 'ja');
assert('Refund ja has Japanese', refundJa.indexOf('返金') >= 0);

var refundEn = MessageTemplates.getRefundConfirmationMessage('R0001', 'en');
assert('Refund en has English', refundEn.indexOf('refunded') >= 0);

section('MessageTemplates: backward compatibility (no locale)');

var welcomeDefault = MessageTemplates.getWelcomeMessage();
assert('Welcome default is ja', welcomeDefault.quickReplies[0].label === '予約する');

var menuDefault = MessageTemplates.getMenuOptionsMessage();
assert('Menu default is ja', menuDefault.indexOf('初診') >= 0);

// ─── Results ───

console.log('\n========================================');
console.log('Phase 4-1 i18n E2E Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var fi = 0; fi < errors.length; fi++) {
    console.log('  FAIL ' + errors[fi]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
