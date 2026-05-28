/**
 * Phase 4-3 E2E Tests - Firestore Service
 *
 * Run: node tests/e2e-phase4-firestore.test.js
 *
 * Tests value conversion (_toFsValue/_fromFsValue/_toFields/_fromDoc),
 * FirestoreService function existence, ScriptProperties Firebase keys,
 * and URL construction.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock GAS globals ───
var mockCache = {};
var mockUserProps = {};
var mockFetchLog = [];

global.SpreadsheetApp = {
  openById: function() {
    return {
      getSheetByName: function() { return null; },
      insertSheet: function() { return { appendRow: function() {} }; }
    };
  }
};

global.CacheService = {
  getScriptCache: function() {
    return {
      get: function(key) { return mockCache[key] || null; },
      put: function(key, val, ttl) { mockCache[key] = val; },
      remove: function(key) { delete mockCache[key]; }
    };
  },
  getUserCache: function() {
    return { get: function() { return null; }, put: function() {}, remove: function() {} };
  }
};

global.PropertiesService = {
  getScriptProperties: function() {
    var props = {
      'SPREADSHEET_ID': 'mock', 'LINE_CHANNEL_ACCESS_TOKEN': 'mock',
      'STRIPE_API_KEY': 'mock', 'BUSINESS_START_TIME': '09:00', 'BUSINESS_END_TIME': '18:00',
      'FIREBASE_PROJECT_ID': 'test-project',
      'FIREBASE_CLIENT_EMAIL': 'test@test-project.iam.gserviceaccount.com',
      'FIREBASE_PRIVATE_KEY': '-----BEGIN PRIVATE KEY-----\nMOCKKEY\n-----END PRIVATE KEY-----\n'
    };
    return {
      getProperty: function(k) { return props[k] || null; },
      setProperty: function() {}
    };
  },
  getUserProperties: function() {
    return {
      getProperty: function(k) { return mockUserProps[k] || null; },
      setProperty: function(k, v) { mockUserProps[k] = v; }
    };
  }
};

global.Utilities = {
  formatDate: function(d, tz, fmt) { return d.toISOString(); },
  base64EncodeWebSafe: function(str) {
    var b = Buffer.from(str, 'utf8').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_');
  },
  computeRsaSha256Signature: function() { return new Uint8Array(32); },
  getUuid: function() { return 'mock-uuid'; }
};

global.LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
global.Logger = { log: function() {} };
global.ContentService = { createTextOutput: function(t) { return { setMimeType: function() { return t; } }; }, MimeType: { JSON: 'application/json' } };
global.ScriptApp = { newTrigger: function() { return { timeBased: function() { return { after: function() { return { create: function() {} }; } }; } }; } };

// Mock UrlFetchApp to log calls
global.UrlFetchApp = {
  fetch: function(url, opts) {
    mockFetchLog.push({ url: url, method: opts ? opts.method : 'get' });
    return {
      getResponseCode: function() { return 200; },
      getContentText: function() {
        return JSON.stringify({
          access_token: 'mock_token_123',
          token_type: 'Bearer',
          expires_in: 3600
        });
      }
    };
  }
};

// Stubs
global.appendLogRow = function() {};
global.getSpreadsheetId = function() { return 'mock'; };
global.getProperty = function(k) { return global.PropertiesService.getScriptProperties().getProperty(k); };
global.sendLinePush = function() { return true; };
global._reservationCache = [];
global._getCachedSpreadsheet = function() { return global.SpreadsheetApp.openById(); };

// ─── Load source files ───
var gasDir = path.join(__dirname, '..', 'gas-project');

function loadFile(filepath) {
  var code = fs.readFileSync(filepath, 'utf8');
  var script = new vm.Script(code, { filename: path.basename(filepath) });
  script.runInThisContext();
}

loadFile(path.join(gasDir, 'config', 'SheetConfig.js'));
loadFile(path.join(gasDir, 'config', 'ScriptProperties.js'));
loadFile(path.join(gasDir, 'services', 'FirestoreService.js'));

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

section('ScriptProperties: Firebase keys');

assert('FIREBASE_PROJECT_ID key exists', PROPERTY_KEYS.FIREBASE_PROJECT_ID === 'FIREBASE_PROJECT_ID');
assert('FIREBASE_CLIENT_EMAIL key exists', PROPERTY_KEYS.FIREBASE_CLIENT_EMAIL === 'FIREBASE_CLIENT_EMAIL');
assert('FIREBASE_PRIVATE_KEY key exists', PROPERTY_KEYS.FIREBASE_PRIVATE_KEY === 'FIREBASE_PRIVATE_KEY');
assert('getFirebaseProjectId returns value', getFirebaseProjectId() === 'test-project');
assert('getFirebaseClientEmail returns value', getFirebaseClientEmail() === 'test@test-project.iam.gserviceaccount.com');
assert('getFirebasePrivateKey returns value', getFirebasePrivateKey().indexOf('BEGIN PRIVATE KEY') >= 0);
assert('isFirebaseConfigured returns true', isFirebaseConfigured() === true);

section('FirestoreService: function existence');

assert('_getFsAccessToken exists', typeof _getFsAccessToken === 'function');
assert('fsGet exists', typeof fsGet === 'function');
assert('fsSet exists', typeof fsSet === 'function');
assert('fsUpdate exists', typeof fsUpdate === 'function');
assert('fsDelete exists', typeof fsDelete === 'function');
assert('fsAdd exists', typeof fsAdd === 'function');
assert('fsGetCollection exists', typeof fsGetCollection === 'function');
assert('fsQuery exists', typeof fsQuery === 'function');
assert('firestoreHealthCheck exists', typeof firestoreHealthCheck === 'function');
assert('_toFsValue exists', typeof _toFsValue === 'function');
assert('_fromFsValue exists', typeof _fromFsValue === 'function');
assert('_toFields exists', typeof _toFields === 'function');
assert('_fromDoc exists', typeof _fromDoc === 'function');
assert('_b64url exists', typeof _b64url === 'function');
assert('_fsDocUrl exists', typeof _fsDocUrl === 'function');
assert('_fsCollectionUrl exists', typeof _fsCollectionUrl === 'function');
assert('_fsOp exists', typeof _fsOp === 'function');

section('Value conversion: _toFsValue');

var strVal = _toFsValue('hello');
assert('string value', strVal.stringValue === 'hello', JSON.stringify(strVal));

var intVal = _toFsValue(42);
assert('integer value', intVal.integerValue === '42', JSON.stringify(intVal));

var floatVal = _toFsValue(3.14);
assert('double value', floatVal.doubleValue === 3.14, JSON.stringify(floatVal));

var boolVal = _toFsValue(true);
assert('boolean value', boolVal.booleanValue === true, JSON.stringify(boolVal));

var nullVal = _toFsValue(null);
assert('null value', nullVal.nullValue === null, JSON.stringify(nullVal));

var undefinedVal = _toFsValue(undefined);
assert('undefined value', undefinedVal.nullValue === null, JSON.stringify(undefinedVal));

var dateVal = _toFsValue(new Date('2026-05-27T10:00:00Z'));
assert('date value', dateVal.timestampValue === '2026-05-27T10:00:00.000Z', JSON.stringify(dateVal));

var arrVal = _toFsValue([1, 'a', true]);
assert('array value has values', arrVal.arrayValue && arrVal.arrayValue.values && arrVal.arrayValue.values.length === 3, JSON.stringify(arrVal));
assert('array value[0] is int', arrVal.arrayValue.values[0].integerValue === '1');
assert('array value[1] is string', arrVal.arrayValue.values[1].stringValue === 'a');
assert('array value[2] is bool', arrVal.arrayValue.values[2].booleanValue === true);

var mapVal = _toFsValue({ name: 'Test', count: 5 });
assert('map value has fields', mapVal.mapValue && mapVal.mapValue.fields, JSON.stringify(mapVal));
assert('map value name', mapVal.mapValue.fields.name.stringValue === 'Test');
assert('map value count', mapVal.mapValue.fields.count.integerValue === '5');

section('Value conversion: _fromFsValue');

assert('from string', _fromFsValue({ stringValue: 'hello' }) === 'hello');
assert('from integer', _fromFsValue({ integerValue: '42' }) === 42);
assert('from double', _fromFsValue({ doubleValue: 3.14 }) === 3.14);
assert('from boolean', _fromFsValue({ booleanValue: true }) === true);
assert('from null', _fromFsValue({ nullValue: null }) === null);
assert('from array', _fromFsValue({ arrayValue: { values: [{ integerValue: '1' }, { stringValue: 'a' }] } }).length === 2);
assert('from array[0]', _fromFsValue({ arrayValue: { values: [{ integerValue: '1' }, { stringValue: 'a' }] } })[0] === 1);
assert('from empty array', _fromFsValue({ arrayValue: {} }).length === 0);
assert('from map', _fromFsValue({ mapValue: { fields: { x: { stringValue: 'y' } } } }).x === 'y');
assert('from empty map', Object.keys(_fromFsValue({ mapValue: {} })).length === 0);

section('Value conversion: _toFields / _fromDoc');

var testObj = {
  id: 'R001',
  patient_name: 'Test User',
  phone: '09011112222',
  visit_count: 5,
  active: true,
  notes: ''
};

var fields = _toFields(testObj);
assert('toFields has id', fields.id.stringValue === 'R001');
assert('toFields has patient_name', fields.patient_name.stringValue === 'Test User');
assert('toFields has visit_count', fields.visit_count.integerValue === '5');
assert('toFields has active', fields.active.booleanValue === true);
assert('toFields has notes', fields.notes.stringValue === '');

var firestoreDoc = {
  name: 'projects/test/databases/(default)/documents/reservations/R001',
  fields: {
    id: { stringValue: 'R001' },
    status: { stringValue: 'Visited' },
    count: { integerValue: '10' },
    price: { doubleValue: 3500.5 },
    done: { booleanValue: false }
  }
};

var restored = _fromDoc(firestoreDoc);
assert('fromDoc id', restored.id === 'R001');
assert('fromDoc status', restored.status === 'Visited');
assert('fromDoc count', restored.count === 10);
assert('fromDoc price', restored.price === 3500.5);
assert('fromDoc done', restored.done === false);
assert('fromDoc empty', Object.keys(_fromDoc(null)).length === 0);
assert('fromDoc empty fields', Object.keys(_fromDoc({})).length === 0);

// Round-trip test
var roundTrip = _fromDoc({ fields: _toFields(testObj) });
assert('roundtrip id', roundTrip.id === 'R001');
assert('roundtrip patient_name', roundTrip.patient_name === 'Test User');
assert('roundtrip visit_count', roundTrip.visit_count === 5);
assert('roundtrip active', roundTrip.active === true);

section('URL construction');

var docUrl = _fsDocUrl('reservations', 'R001');
assert('doc URL contains project', docUrl.indexOf('test-project') >= 0, docUrl);
assert('doc URL contains collection', docUrl.indexOf('/reservations/') >= 0, docUrl);
assert('doc URL contains docId', docUrl.indexOf('/R001') >= 0, docUrl);
assert('doc URL has correct base', docUrl.indexOf('firestore.googleapis.com') >= 0, docUrl);

var collUrl = _fsCollectionUrl('customers');
assert('collection URL contains project', collUrl.indexOf('test-project') >= 0, collUrl);
assert('collection URL contains collection', collUrl.indexOf('/customers') >= 0, collUrl);
assert('collection URL no trailing slash', collUrl[ collUrl.length - 1 ] !== '/', collUrl);

section('_fsOp mapping');

assert('== maps to EQUAL', _fsOp('==') === 'EQUAL');
assert('!= maps to NOT_EQUAL', _fsOp('!=') === 'NOT_EQUAL');
assert('< maps to LESS_THAN', _fsOp('<') === 'LESS_THAN');
assert('<= maps to LESS_THAN_OR_EQUAL', _fsOp('<=') === 'LESS_THAN_OR_EQUAL');
assert('> maps to GREATER_THAN', _fsOp('>') === 'GREATER_THAN');
assert('>= maps to GREATER_THAN_OR_EQUAL', _fsOp('>=') === 'GREATER_THAN_OR_EQUAL');
assert('unknown maps to EQUAL', _fsOp('xxx') === 'EQUAL');

section('Base64URL helpers');

var encoded = _b64url('hello world');
assert('b64url encodes', typeof encoded === 'string' && encoded.length > 0, encoded);
assert('b64url no padding', encoded.indexOf('=') === -1, encoded);
assert('b64url no +/', encoded.indexOf('+') === -1 && encoded.indexOf('/') === -1, encoded);

section('Access token (mock)');

mockFetchLog = [];
mockCache = {}; // clear cache to force new token
var token = _getFsAccessToken();
assert('token returned', token === 'mock_token_123', token);
assert('UrlFetchApp was called', mockFetchLog.length >= 1, 'calls: ' + mockFetchLog.length);
assert('called token endpoint', mockFetchLog[0].url === 'https://oauth2.googleapis.com/token', mockFetchLog[0].url);
assert('token cached', mockCache[FIRESTORE_TOKEN_CACHE_KEY] === 'mock_token_123');

// Second call should use cache (no new fetch)
var fetchCountBefore = mockFetchLog.length;
var token2 = _getFsAccessToken();
assert('token from cache', token2 === 'mock_token_123');
assert('no additional fetch', mockFetchLog.length === fetchCountBefore, 'before: ' + fetchCountBefore + ' after: ' + mockFetchLog.length);

section('Health check');

var health = firestoreHealthCheck();
assert('health check ok', health.ok === true, JSON.stringify(health));
assert('health check has project', health.project === 'test-project', JSON.stringify(health));

// ─── Results ───

console.log('\n========================================');
console.log('Phase 4-3 Firestore E2E Test Results');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) {
    console.log('  FAIL ' + errors[i]);
  }
}
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
