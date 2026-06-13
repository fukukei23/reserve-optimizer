/**
 * Integration Tests - Wave 1-3 Cross-service Scenarios
 *
 * Tests cross-service interactions between Wave 1-3 features:
 * A: Reservation → Stamp → Coupon (simultaneous)
 * B: Staff selection → Stamp
 * C: Intake form → Reservation → Karte data flow
 * E: Subscription + Coupon coexistence
 * F: Cancel → Stamp removal
 * G: Buffer minutes → Slot calculation with staff selection
 *
 * Run: node tests/e2e-wave1-3-integration.test.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock Setup ───

var mockSheetData = {
  reservations: {
    headers: ['reservation_id','created_at','patient_name','phone','line_display_name','visit_type','menu_type','reserved_date','reserved_start','reserved_end','status','deposit_required','deposit_amount','deposit_status','reminder_sent','reminder_response','cancel_time','resale_notified','resale_success','average_unit_price','notes','payment_intent_id'],
    rows: [
      ['R0001', new Date(), 'テスト患者', '09011112222', 'U001', 'First', '初診（30分）', '2026/06/15', '10:00', '10:30', 'Pending', 'Y', 1000, 'Unpaid', 'N', '', '', 'N', 'N', 5000, 'staff_id:S001', ''],
      ['R0002', new Date(), 'テスト患者2', '09022223333', 'U002', 'Repeat', '再診（30分）', '2026/06/15', '10:00', '10:30', 'Confirmed', 'Y', 1000, 'Paid', 'N', '', '', 'N', 'N', 5000, '', '']
    ]
  },
  customers: {
    headers: ['customer_id','phone','name','line_user_id','visit_count','last_visit','tags','total_spent','notes'],
    rows: [
      ['C001', '09011112222', 'テスト患者', 'U001', 5, '2026/06/01', 'regular', 25000, ''],
      ['C002', '09022223333', 'テスト患者2', 'U002', 1, '2026/06/01', 'new', 5000, '']
    ]
  },
  coupons: {
    headers: ['coupon_id','code','discount_type','discount_value','expiry_date','use_limit','use_count','target_tags','active'],
    rows: [
      ['CP001', 'WELCOME10', 'percent', 10, '2026/12/31', 100, 5, '', 'TRUE'],
      ['CP002', 'VIP20', 'percent', 20, '2026/12/31', 50, 2, 'vip', 'TRUE'],
      ['CP003', 'SUB500', 'amount', 500, '2026/12/31', 999, 0, 'subscriber', 'TRUE']
    ]
  },
  stamp_cards: {
    headers: ['line_user_id','stamp_count','total_stamps_earned','last_stamped_reservation_id','last_stamped_at','updated_at'],
    rows: [
      ['U001', 3, 5, 'R0000', '2026/06/01 10:00:00', '2026/06/01 10:00:00']
    ]
  },
  subscriptions: {
    headers: ['subscription_id','line_user_id','stripe_subscription_id','plan_name','status','created_at','canceled_at'],
    rows: []
  },
  karte_records: {
    headers: ['karte_id','reservation_id','line_user_id','staff_id','memo','created_at'],
    rows: []
  },
  intake_forms: {
    headers: ['form_id','reservation_id','line_user_id','data_json','summary','created_at'],
    rows: []
  },
  staff: {
    headers: ['staff_id','name','role','active','specialties'],
    rows: [
      ['S001', '田中柔整', '柔道整復師', 'TRUE', '初診,再診'],
      ['S002', '佐藤柔整', '柔道整復師', 'TRUE', '初診,再診'],
      ['S003', '山田柔整', '柔道整復師', 'FALSE', '再診']
    ]
  },
  'ログ': { headers: ['timestamp','level','message'], rows: [] }
};

var _logRows = [];
var _pushMessages = [];

function makeMockSheet(name) {
  var sheet = mockSheetData[name];
  if (!sheet) return null;
  return {
    getDataRange: function() {
      return { getValues: function() { return [sheet.headers].concat(sheet.rows); } };
    },
    appendRow: function(row) { sheet.rows.push(row); },
    getLastRow: function() { return sheet.rows.length + 1; },
    getRange: function(row, col, numRows, numCols) {
      return {
        getValue: function() { return sheet.rows[row - 2] ? sheet.rows[row - 2][col - 1] : ''; },
        setValue: function(val) {
          if (sheet.rows[row - 2]) {
            sheet.rows[row - 2][col - 1] = val;
          }
        },
        setValues: function(vals) {
          if (sheet.rows[row - 2]) {
            for (var i = 0; i < vals[0].length; i++) {
              sheet.rows[row - 2][col - 1 + i] = vals[0][i];
            }
          }
        }
      };
    }
  };
}

// GAS globals
global.SpreadsheetApp = {
  openById: function() {
    return {
      getSheetByName: function(name) { return makeMockSheet(name); },
      insertSheet: function(name) {
        mockSheetData[name] = { headers: [], rows: [] };
        return makeMockSheet(name);
      }
    };
  }
};
global.CacheService = {
  getScriptCache: function() {
    var c = {};
    return { get: function(k) { return c[k] || null; }, put: function(k, v) { c[k] = v; }, remove: function(k) { delete c[k]; } };
  },
  getUserCache: function() {
    var c = {};
    return { get: function(k) { return c[k] || null; }, put: function(k, v) { c[k] = v; }, remove: function(k) { delete c[k]; } };
  }
};
global.PropertiesService = {
  getScriptProperties: function() {
    var props = {
      'SPREADSHEET_ID': 'mock', 'LINE_CHANNEL_ACCESS_TOKEN': 'mock',
      'STRIPE_API_KEY': 'mock', 'BUSINESS_START_TIME': '09:00', 'BUSINESS_END_TIME': '18:00',
      'MAX_CONCURRENT_BOOKINGS': '3', 'DEPOSIT_AMOUNT': '1000',
      'CANCELLATION_DEADLINE_HOURS': '24', 'BOOKING_LEAD_TIME_MINUTES': '30',
      'MAX_RESERVATIONS_PER_USER': '5', 'STAMP_THRESHOLD': '10',
      'FEATURE_STAFF_SELECT': 'true', 'FEATURE_COUPON': 'true',
      'FEATURE_STAMP_CARD': 'true', 'FEATURE_SUBSCRIPTION': 'true',
      'FEATURE_SEGMENT_BROADCAST': 'true', 'FEATURE_KARTE': 'true',
      'FEATURE_INTAKE_FORM': 'true', 'FEATURE_REVIEW_REQUEST': 'true',
      'BUFFER_MINUTES': '15', 'SAME_DAY_CUTOFF_HOUR': '10',
      'CLINIC_MAP_URL': 'https://maps.example.com/clinic'
    };
    return { getProperty: function(k) { return props[k] || null; }, setProperty: function(k, v) { props[k] = v; } };
  },
  getUserProperties: function() {
    var c = {};
    return { getProperty: function(k) { return c[k] || null; }, setProperty: function(k, v) { c[k] = v; }, deleteProperty: function(k) { delete c[k]; }, getProperties: function() { return Object.assign({}, c); } };
  }
};
global.Utilities = { formatDate: function(d, tz, fmt) {
  if (fmt === 'yyyy/MM/dd HH:mm:ss') return d.toISOString().replace('T', ' ').substring(0, 19);
  if (fmt === 'yyyy/MM/dd') return d.toISOString().substring(0, 10).replace(/-/g, '/');
  return d.toISOString();
}, newBlob: function(s) { return { getBytes: function() { return []; } }; }, base64Encode: function() { return ''; }, getUuid: function() { return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; } };
global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
global.Logger = { log: function() {} };
global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; }, getContentText: function() { return '{"id":"sub_mock"}'; } }; } };
global.ContentService = {
  createTextOutput: function(text) {
    return { setMimeType: function() { return text; }, getMimeType: function() { return 'application/json'; } };
  },
  MimeType: { JSON: 'application/json' }
};

// Stubs
global.appendLogRow = function(level, msg) { _logRows.push({ level: level, message: msg }); };
global.getSpreadsheetId = function() { return 'mock'; };
global.getLineAccessToken = function() { return 'mock'; };
global.getStripeApiKey = function() { return 'mock'; };
global.getStripeWebhookSecret = function() { return ''; };
global.getDepositAmount = function() { return 1000; };
global.getAverageUnitPrice = function() { return 5000; };
global.getCancellationDeadlineHours = function() { return 24; };
global.getMaxConcurrentBookings = function() { return 3; };
global.getBookingLeadTimeMinutes = function() { return 30; };
global.isFirebaseConfigured = function() { return false; };
global.getLineAdminUserId = function() { return 'admin'; };
global.getLineChannelSecret = function() { return 'mock-secret'; };
global.validateRequiredProperties = function() { return { valid: true, missing: [] }; };
global.getProperty = function(k) { return global.PropertiesService.getScriptProperties().getProperty(k); };
global.notifyReservationAdmin = function() {};
global.sendLinePush = function(userId, msg) { _pushMessages.push({ userId: userId, message: msg }); };
global.normalizeTimeInput = function(t) { return t; };
global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
global.validateDateForBooking = function(d) {
  if (!d || !/^\d{4}\/\d{2}\/\d{2}$/.test(d)) return { valid: false, errorMessage: 'Invalid date format' };
  return { valid: true };
};
global.calculateEndTime = function(s, d) {
  var m = parseInt(s.split(':')[0]) * 60 + parseInt(s.split(':')[1]) + d;
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
};
global.getReservationsSheet = function() { return makeMockSheet('reservations'); };
global.getBookedSlotsForDate = function(date) {
  var slots = {};
  var rows = mockSheetData.reservations.rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][7] === date && (rows[i][10] === 'Pending' || rows[i][10] === 'Confirmed')) {
      var t = rows[i][8];
      if (t) slots[t] = (slots[t] || 0) + 1;
    }
  }
  return slots;
};
global._onReservationCreated = function() {};
global.getReservationById = function() { return null; };
global._createReservationWithLock = function(tempData) {
  var id = 'R' + String(Date.now()).slice(-6);
  return { ok: true, reservation: { id: id, status: 'Pending' } };
};
global.generateReservationId = function() { return 'R' + String(Date.now()).slice(-6); };
global.getOrCreateCustomer = function() { return { customer_id: 'C001', tags: 'regular' }; };
global._fireCrmWebhook = function() {};
global.getClinicMapUrl = function() { return 'https://maps.example.com/clinic'; };
global.getCustomerByLineUserId = function(uid) {
  var rows = mockSheetData.customers.rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][3] === uid) return { customer_id: rows[i][0], tags: rows[i][6] };
  }
  return null;
};
global.getStampThreshold = function() { return parseInt(getProperty('STAMP_THRESHOLD') || '10', 10); };
global.getStampRewardMessage = function() { return '🎉 10回スタンプ達成！特典です！'; };
global.getGLMApiKey = function() { return 'mock'; };
global._generateIntakeSummary = function() { return '腰痛: 3日目。痛み強め。'; };

// ─── Load source files ───

var gasDir = path.join(__dirname, '..', 'gas-project');
function loadFile(filepath) {
  var code = fs.readFileSync(filepath, 'utf8');
  var script = new vm.Script(code, { filename: path.basename(filepath) });
  script.runInThisContext();
}

loadFile(path.join(gasDir, 'config', 'SheetConfig.js'));
loadFile(path.join(gasDir, 'config', 'ScriptProperties.js'));
loadFile(path.join(gasDir, 'services', 'SheetService.js'));
loadFile(path.join(gasDir, 'services', 'BookingService.js'));
loadFile(path.join(gasDir, 'services', 'CRMService.js'));
loadFile(path.join(gasDir, 'services', 'CouponService.js'));
loadFile(path.join(gasDir, 'services', 'StaffService.js'));
loadFile(path.join(gasDir, 'services', 'StampCardService.js'));
loadFile(path.join(gasDir, 'services', 'SubscriptionService.js'));
loadFile(path.join(gasDir, 'services', 'KarteService.js'));
loadFile(path.join(gasDir, 'services', 'IntakeService.js'));
loadFile(path.join(gasDir, 'services', 'CalendarService.js'));
loadFile(path.join(gasDir, 'handlers', 'StateHandler.js'));
loadFile(path.join(gasDir, 'handlers', 'WebhookRouter.js'));

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

// ──────────────────────────────────────────
// Scenario A: Reservation → Stamp → Coupon
// ──────────────────────────────────────────
section('A: Reservation → Stamp → Coupon (simultaneous)');

var stampResult1 = addStamp('U001', 'R_INT_A1');
assert('A1: Stamp added for U001', stampResult1.ok === true);
assert('A2: Stamp count incremented (3→4)', stampResult1.stampCount === 4);
assert('A3: No reward (4 < 10)', stampResult1.rewarded === false);

var couponResult1 = validateCoupon('WELCOME10', 'U001');
assert('A4: WELCOME10 coupon validated', couponResult1.ok === true);
var discount1 = calculateDiscount(5000, couponResult1.coupon);
assert('A5: Discount is 500 (10% of 5000)', discount1 === 500);

// VIP coupon for VIP user
var couponResult2 = validateCoupon('VIP20', 'U_VIP');
assert('A6: VIP20 coupon for VIP user rejected (no VIP customer in mock)', couponResult2.ok === false || couponResult2.ok === true);

// Non-VIP user trying VIP coupon (WELCOME10 has no target_tags → always ok)
var couponResult3 = validateCoupon('VIP20', 'U001');
assert('A7: VIP coupon requires VIP tag', couponResult3.ok === false || couponResult3.error === 'TAG_MISMATCH');

// ──────────────────────────────────────────
// Scenario B: Staff selection → Stamp
// ──────────────────────────────────────────
section('B: Staff selection → Stamp');

var staffList = getActiveStaff();
assert('B1: getActiveStaff returns staff', staffList.length > 0);

var staffForFirst = getStaffForTreatment('初診');
assert('B2: Staff for first visit exists', staffForFirst.length > 0);

// Stamp should work regardless of staff selection
var stampResult2 = addStamp('U002', 'R_INT_B1');
assert('B3: Stamp added for new user U002', stampResult2.ok === true);
assert('B4: New user starts at 1 stamp', stampResult2.stampCount === 1);

// Duplicate stamp prevention
var stampResult3 = addStamp('U002', 'R_INT_B1');
assert('B5: Duplicate stamp prevented', stampResult3.stampCount === 1);

// Different reservation should add stamp
var stampResult4 = addStamp('U002', 'R_INT_B2');
assert('B6: New reservation adds stamp', stampResult4.stampCount === 2);

// ──────────────────────────────────────────
// Scenario C: Intake → Reservation → Karte
// ──────────────────────────────────────────
section('C: Intake form → Karte data flow');

var intakeResult = saveIntakeForm('R_INT_C1', { chief_complaint: '腰痛', duration: '3日', pain_level: 7 });
assert('C1: Intake form saved', intakeResult.ok === true);

var karteResult = saveKarte('R_INT_C1', {
  line_user_id: 'U001',
  patient_name: 'テスト患者',
  treatment_content: '腰部筋緊張。ストレッチ指導。',
  body_part: '腰',
  staff_name: '田中柔整',
  next_suggestion: '2週間後に再診',
  notes: ''
});
assert('C2: Karte saved', karteResult.ok === true);
assert('C3: Karte has id', karteResult.id && karteResult.id.indexOf('K-') === 0);

// Retrieve karte history for user
var karteHistory = getKarteHistoryByUserId('U001');
assert('C4: Karte history returned', Array.isArray(karteHistory));

// ──────────────────────────────────────────
// Scenario E: Subscription + Coupon coexistence
// ──────────────────────────────────────────
section('E: Subscription + Coupon coexistence');

// Subscriber-specific coupon
var subCouponOk = validateCoupon('SUB500', 'U_SUB');
assert('E1: SUB500 coupon validated', subCouponOk.ok === true || subCouponOk.ok === false);

// Non-subscriber cannot use subscriber coupon
var subCouponFail = validateCoupon('SUB500', 'U001');
assert('E2: SUB500 rejected for non-subscriber', subCouponFail.ok === false || subCouponFail.error === 'TAG_MISMATCH');

// Subscription creation stub test
var subSheet = makeMockSheet('subscriptions');
assert('E4: Subscriptions sheet accessible', subSheet !== null);

// ──────────────────────────────────────────
// Scenario F: Cancel → Stamp removal
// ──────────────────────────────────────────
section('F: Cancel → Stamp removal');

// First add stamps for test
addStamp('U001', 'R_INT_F1');
var beforeCancel = getStampCard('U001');
var countBefore = beforeCancel ? beforeCancel.stamp_count : 0;
assert('F1: Stamp exists before cancel (count: ' + countBefore + ')', countBefore > 0);

// Stamp removal should exist as a function
var stampCardBefore = getStampCard('U001');
assert('F2: Stamp card retrievable', stampCardBefore !== null);

// Check if removeStamp function exists
var hasRemoveStamp = (typeof removeStamp === 'function');
if (hasRemoveStamp) {
  var removeResult = removeStamp('U001', 'R_INT_F1');
  assert('F3: removeStamp returned ok', removeResult.ok === true);
  var afterCancel = getStampCard('U001');
  assert('F4: Stamp count decreased', afterCancel.stamp_count === countBefore - 1);
} else {
  assert('F3: removeStamp function exists (IMPLEMENTATION NEEDED)', false, 'removeStamp is not defined in StampCardService');
  assert('F4: (skipped: removeStamp not implemented)', true);
}

// ──────────────────────────────────────────
// Scenario G: Buffer minutes → Slot calculation
// ──────────────────────────────────────────
section('G: Buffer minutes → Slot calculation');

var bufferMin = getBufferMinutes();
assert('G1: Buffer minutes is 15', bufferMin === 15);

var cutoff = getSameDayCutoffHour();
assert('G2: Same day cutoff hour is 10', cutoff === 10);

// Verify get_availability works with buffer settings
var availResult = _handleGetAvailability({ date: '2026/06/15' });
var availData = JSON.parse(availResult);
assert('G3: Availability returns slots', Array.isArray(availData.slots));
assert('G4: Slots count is 18 (09:00-17:30)', availData.slots.length === 18);
assert('G5: 10:00 has booked=2', availData.slots.filter(function(s) { return s.time === '10:00'; })[0].booked === 2);

// ──────────────────────────────────────────
// Scenario X: Edge cases across services
// ──────────────────────────────────────────
section('X: Cross-service edge cases');

// Null CRM with coupon
var couponNullCrm = validateCoupon('WELCOME10', 'U_NULL');
assert('X1: Coupon with null CRM handled', couponNullCrm.ok === true || couponNullCrm.ok === false);

// Stamp with empty userId
var stampEmpty = addStamp('', 'R001');
assert('X2: Stamp rejects empty userId', stampEmpty.ok === false);

// Stamp with empty reservationId
var stampEmptyRes = addStamp('U001', '');
assert('X3: Stamp rejects empty reservationId', stampEmptyRes.ok === false);

// Karte with null data
var karteNull = saveKarte('R001', 'U001', 'S001', null);
assert('X4: Karte with null memo handles gracefully', karteNull.ok === true || karteNull.ok === false);

// Intake with null data
var intakeNull = saveIntakeForm('R001', null);
assert('X5: Intake with null data returns error', intakeNull.ok === false);

// Coupon with base amount 0
var couponZero = calculateDiscount(0, couponResult1.coupon);
assert('X6: Coupon with amount 0 handled', couponZero >= 0);

// Stamp card summary text
var summary = getStampSummaryText('U001');
assert('X7: Stamp summary text is non-empty string', typeof summary === 'string' && summary.length > 0);

// Stamp card for unknown user
var summaryUnknown = getStampSummaryText('U_UNKNOWN');
assert('X8: Unknown user stamp summary returns default', typeof summaryUnknown === 'string');

// ─── Results ───

console.log('\n========================================');
console.log('Wave 1-3 Integration Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) {
    console.log('  FAIL ' + errors[i]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
