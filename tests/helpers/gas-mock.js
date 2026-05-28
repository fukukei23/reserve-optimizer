/**
 * Shared test helpers for reserve-optimizer unit tests.
 * Provides GAS environment mocks and assertion utilities.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _mockCache = {};
var _mockUserCache = {};
var _mockUserProps = {};
var _mockSheets = {};

function resetMocks() {
  _mockCache = {};
  _mockUserCache = {};
  _mockUserProps = {};
  _mockSheets = {};
}

function addMockSheet(name, headers, rows) {
  _mockSheets[name] = { headers: headers || [], rows: rows || [] };
}

function getMockSheet(name) {
  return _mockSheets[name] || null;
}

// ─── Mock GAS globals ───

function makeSheetProxy(name) {
  var sheet = _mockSheets[name];
  if (!sheet) return null;
  return {
    getDataRange: function() {
      return { getValues: function() { return [sheet.headers].concat(sheet.rows); } };
    },
    appendRow: function(row) { sheet.rows.push(row); },
    getLastRow: function() { return sheet.rows.length + 1; },
    getRange: function(row, col, optNumRows, optNumCols) {
      if (optNumCols !== undefined) {
        // Range for setValues with width
        return {
          getValues: function() {
            var result = [];
            for (var r = 0; r < optNumRows; r++) {
              var rowData = [];
              for (var c = 0; c < optNumCols; c++) {
                rowData.push(sheet.rows[row - 2 + r] ? sheet.rows[row - 2 + r][col - 1 + c] : '');
              }
              result.push(rowData);
            }
            return result;
          },
          setValues: function(vals) {
            for (var r = 0; r < vals.length; r++) {
              if (!sheet.rows[row - 2 + r]) sheet.rows[row - 2 + r] = [];
              for (var c = 0; c < vals[r].length; c++) {
                sheet.rows[row - 2 + r][col - 1 + c] = vals[r][c];
              }
            }
          },
          getValue: function() { return sheet.rows[row - 2] ? sheet.rows[row - 2][col - 1] : ''; },
          setValue: function(val) {
            if (sheet.rows[row - 2]) sheet.rows[row - 2][col - 1] = val;
          }
        };
      }
      return {
        getValue: function() { return sheet.rows[row - 2] ? sheet.rows[row - 2][col - 1] : ''; },
        setValue: function(val) {
          if (sheet.rows[row - 2]) sheet.rows[row - 2][col - 1] = val;
        },
        setValues: function(vals) {
          for (var r = 0; r < vals.length; r++) {
            if (!sheet.rows[row - 2 + r]) sheet.rows[row - 2 + r] = [];
            for (var c = 0; c < vals[r].length; c++) {
              sheet.rows[row - 2 + r][col - 1 + c] = vals[r][c];
            }
          }
        }
      };
    }
  };
}

function installGASGlobals() {
  global.SpreadsheetApp = {
    openById: function() {
      return {
        getSheetByName: function(name) { return makeSheetProxy(name); },
        insertSheet: function(name) {
          _mockSheets[name] = { headers: [], rows: [] };
          return makeSheetProxy(name);
        }
      };
    }
  };

  global.CacheService = {
    getScriptCache: function() {
      return {
        get: function(key) { return _mockCache[key] || null; },
        put: function(key, val, ttl) { _mockCache[key] = val; },
        remove: function(key) { delete _mockCache[key]; }
      };
    },
    getUserCache: function() {
      return {
        get: function(key) { return _mockUserCache[key] || null; },
        put: function(key, val, ttl) { _mockUserCache[key] = val; },
        remove: function(key) { delete _mockUserCache[key]; }
      };
    }
  };

  global.PropertiesService = {
    getScriptProperties: function() {
      var props = {
        'SPREADSHEET_ID': 'mock', 'LINE_CHANNEL_ACCESS_TOKEN': 'mock',
        'STRIPE_API_KEY': 'mock', 'BUSINESS_START_TIME': '09:00', 'BUSINESS_END_TIME': '18:00',
        'MAX_CONCURRENT_BOOKINGS': '3', 'DEPOSIT_AMOUNT': '1000', 'CANCELLATION_DEADLINE_HOURS': '24',
        'BOOKING_LEAD_TIME_MINUTES': '30', 'MAX_RESERVATIONS_PER_USER': '5',
        'FOLLOW_UP_HOURS_AFTER': '24',
        'TICKET_EXPIRY_DAYS': '180', 'TICKET_5_PRICE': '25000', 'TICKET_10_PRICE': '45000'
      };
      return {
        getProperty: function(k) { return props[k] || null; },
        setProperty: function(k, v) { props[k] = v; }
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
      if (fmt === 'yyyy/MM/dd') {
        return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
      }
      return d.toISOString();
    },
    newBlob: function(s) { return { getBytes: function() { return []; } }; },
    base64Encode: function() { return ''; },
    getUuid: function() {
      return Math.random().toString(36).substring(2, 10) +
             Math.random().toString(36).substring(2, 10) + '-' +
             Math.random().toString(36).substring(2, 6) + '-' +
             Math.random().toString(36).substring(2, 6);
    }
  };

  global.UrlFetchApp = { fetch: function() { return { getResponseCode: function() { return 200; } }; } };
  global.ContentService = {
    createTextOutput: function(text) { return { setMimeType: function() { return text; } }; },
    MimeType: { JSON: 'application/json' }
  };
  global.LockService = {
    getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; }
  };
  global.Logger = { log: function() {} };
}

// ─── Stub functions ───

function installCommonStubs() {
  global.appendLogRow = function() {};
  global.getSpreadsheetId = function() { return 'mock'; };
  global.getLineAccessToken = function() { return 'mock'; };
  global.getStripeApiKey = function() { return 'mock'; };
  global.getStripeWebhookSecret = function() { return ''; };
  global.getDepositAmount = function() { return 1000; };
  global.getAverageUnitPrice = function() { return 5000; };
  global.getCancellationDeadlineHours = function() { return 24; };
  global.getMaxConcurrentBookings = function() { return 3; };
  global.getMaxReservationsPerUser = function() { return 5; };
  global.getBookingLeadTimeMinutes = function() { return 30; };
  global.isFirebaseConfigured = function() { return false; };
  global.getLineAdminUserId = function() { return 'admin'; };
  global.getLineChannelSecret = function() { return 'mock-secret'; };
  global.validateRequiredProperties = function() { return { valid: true, missing: [] }; };
  global.getProperty = function(k) { return global.PropertiesService.getScriptProperties().getProperty(k); };
  global.notifyReservationAdmin = function() {};
  global.sendLinePush = function() {};
  global.sendLineReply = function() {};
  global.sendQuickReply = function() {};
  global.normalizeTimeInput = function(t) { return t; };
  global.validateTime = function(t) { return /^\d{2}:\d{2}$/.test(t); };
  global.validateDateForBooking = function(d) { return { valid: true }; };
  global.calculateEndTime = function(start, duration) {
    var parts = start.split(':');
    var mins = parseInt(parts[0]) * 60 + parseInt(parts[1]) + duration;
    return ('0' + Math.floor(mins / 60)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2);
  };
  global.sendLinePushQuickReply = function() {};
  global.logLineMessage = function() {};
}

// ─── File loader ───

var _gasDir = path.join(__dirname, '..', '..', 'gas-project');

function loadSourceFile(/* paths */) {
  for (var i = 0; i < arguments.length; i++) {
    var filepath = path.join(_gasDir, arguments[i]);
    var code = fs.readFileSync(filepath, 'utf8');
    var script = new vm.Script(code, { filename: path.basename(filepath) });
    script.runInThisContext();
  }
}

// ─── Test framework ───

var _passed = 0;
var _failed = 0;
var _errors = [];

function assert(name, condition, detail) {
  if (condition) {
    _passed++;
  } else {
    _failed++;
    _errors.push(name + (detail ? ' -- ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? ' (' + detail + ')' : ''));
    return;
  }
  console.log('  PASS ' + name);
}

function assertEqual(name, actual, expected) {
  if (actual === expected) {
    _passed++;
    console.log('  PASS ' + name);
  } else {
    _failed++;
    var detail = 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual);
    _errors.push(name + ' -- ' + detail);
    console.log('  FAIL ' + name + ' (' + detail + ')');
  }
}

function assertIncludes(name, haystack, needle) {
  if (haystack && haystack.indexOf(needle) >= 0) {
    _passed++;
    console.log('  PASS ' + name);
  } else {
    _failed++;
    var detail = JSON.stringify(haystack) + ' does not include ' + JSON.stringify(needle);
    _errors.push(name + ' -- ' + detail);
    console.log('  FAIL ' + name + ' (' + detail + ')');
  }
}

function assertNotIncludes(name, haystack, needle) {
  if (!haystack || haystack.indexOf(needle) < 0) {
    _passed++;
    console.log('  PASS ' + name);
  } else {
    _failed++;
    var detail = JSON.stringify(haystack) + ' should not include ' + JSON.stringify(needle);
    _errors.push(name + ' -- ' + detail);
    console.log('  FAIL ' + name + ' (' + detail + ')');
  }
}

function assertNull(name, val) {
  if (val === null || val === undefined) {
    _passed++;
    console.log('  PASS ' + name);
  } else {
    _failed++;
    _errors.push(name + ' -- expected null, got ' + JSON.stringify(val));
    console.log('  FAIL ' + name + ' (expected null, got ' + JSON.stringify(val) + ')');
  }
}

function section(title) { console.log('\n== ' + title + ' =='); }

function printResults(testName) {
  console.log('\n========================================');
  console.log(testName);
  console.log('Total: ' + (_passed + _failed) + '  Passed: ' + _passed + '  Failed: ' + _failed);
  if (_errors.length > 0) {
    console.log('\nFailed:');
    for (var i = 0; i < _errors.length; i++) {
      console.log('  FAIL ' + _errors[i]);
    }
  }
  console.log('========================================');
  return _failed;
}

function resetCounters() {
  _passed = 0;
  _failed = 0;
  _errors = [];
}

// ─── Export ───
module.exports = {
  resetMocks: resetMocks,
  addMockSheet: addMockSheet,
  getMockSheet: getMockSheet,
  installGASGlobals: installGASGlobals,
  installCommonStubs: installCommonStubs,
  loadSourceFile: loadSourceFile,
  assert: assert,
  assertEqual: assertEqual,
  assertIncludes: assertIncludes,
  assertNotIncludes: assertNotIncludes,
  assertNull: assertNull,
  section: section,
  printResults: printResults,
  resetCounters: resetCounters,
  _mockUserProps: function() { return _mockUserProps; },
  _mockSheets: function() { return _mockSheets; }
};
