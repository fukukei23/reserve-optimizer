/**
 * Unit Tests - ScriptProperties (rotateAuthToken)
 *
 * Run: node tests/unit-script-properties.test.js
 *
 * Verifies GAS_AUTH_TOKEN rotation:
 *  - returns a new non-empty token
 *  - new token differs from the old one (immediate invalidation)
 *  - ScriptProperties is updated to the new token
 *  - new token is UUID-derived (dashes stripped)
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ─── Mock state ───
var _props = {};

global.PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function (k) { return _props[k] != null ? _props[k] : null; },
      setProperty: function (k, v) { _props[k] = String(v); }
    };
  }
};

var _uuidSeq = 0;
global.Utilities = {
  getUuid: function () {
    _uuidSeq += 1;
    // mimic UUID v4 shape (dashes), rotateAuthToken strips them
    return '11112222-3333-4444-5555-' + ('000000000000' + _uuidSeq).slice(-12);
  }
};

// Stubs referenced by ScriptProperties.js
global.appendLogRow = function () {};

// ─── Load source ───
var gasDir = path.join(__dirname, '..', 'gas-project');
new vm.Script(
  fs.readFileSync(path.join(gasDir, 'config', 'ScriptProperties.js'), 'utf8'),
  { filename: 'ScriptProperties.js' }
).runInThisContext();

// ─── Test framework ───
var passed = 0, failed = 0, errors = [];
function assert(name, cond) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name); }
}

// ─── Tests: rotateAuthToken ───

console.log('\n== rotateAuthToken ==');

// Seed an existing (old) token
_props['GAS_AUTH_TOKEN'] = 'old-token-seeded-value';
var oldToken = _props['GAS_AUTH_TOKEN'];

var newToken = rotateAuthToken();
assert('rotateAuthToken returns a string', typeof newToken === 'string');
assert('returned token is non-empty', typeof newToken === 'string' && newToken.length > 0);
assert('new token differs from old (immediate invalidation)', newToken !== oldToken);
assert('ScriptProperties updated to new token', _props['GAS_AUTH_TOKEN'] === newToken);
assert('new token has dashes stripped (uuid-derived)', typeof newToken === 'string' && newToken.indexOf('-') < 0);

// Rotating again produces yet another distinct token (not idempotent on value)
var newToken2 = rotateAuthToken();
assert('second rotation produces a distinct token', newToken2 !== newToken);
assert('ScriptProperties reflects second rotation', _props['GAS_AUTH_TOKEN'] === newToken2);

// ─── Results ───
console.log('\n========================================');
console.log('ScriptProperties Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) {
  console.log('\nFailed:');
  for (var i = 0; i < errors.length; i++) console.log('  FAIL ' + errors[i]);
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
