/**
 * run-all.js — 全テストを順番に実行し結果サマリーを表示
 * Usage: node tests/run-all.js
 */

var { execFileSync } = require('child_process');
var path = require('path');
var fs = require('fs');

var testDir = path.join(__dirname);
var files = fs.readdirSync(testDir)
  .filter(function(f) { return f.endsWith('.test.js'); })
  .sort();

var results = [];
var totalPassed = 0;
var totalFailed = 0;

console.log('=== reserve-optimizer テスト実行 ===\n');

files.forEach(function(file) {
  var filePath = path.join(testDir, file);
  try {
    var output = execFileSync('node', [filePath], { encoding: 'utf8', timeout: 30000 });
    var match = output.match(/Passed:\s*(\d+)\s+Failed:\s*(\d+)/);
    if (!match) {
      // Alternate format: "PASS: 33\nFAIL: 0"
      var pMatch = output.match(/PASS:\s*(\d+)/);
      var fMatch = output.match(/FAIL:\s*(\d+)/);
      if (pMatch) match = [null, pMatch[1], fMatch ? fMatch[1] : '0'];
    }
    var passed = match ? parseInt(match[1]) : 0;
    var failed = match ? parseInt(match[2]) : 0;
    totalPassed += passed;
    totalFailed += failed;
    results.push({ file: file, passed: passed, failed: failed, ok: true });
    console.log('[PASS] ' + file + ' (' + passed + '/' + (passed + failed) + ')');
  } catch (e) {
    var output = e.stdout || '';
    var match = output.match(/Passed:\s*(\d+)\s+Failed:\s*(\d+)/);
    var passed = match ? parseInt(match[1]) : 0;
    var failed = match ? parseInt(match[2]) : '?';
    totalFailed += (typeof failed === 'number' ? failed : 1);
    results.push({ file: file, passed: passed, failed: failed, ok: false, detail: e.stdout });
    console.log('[FAIL] ' + file);
    if (e.stdout) {
      e.stdout.split('\n').filter(function(l) { return l.indexOf('FAIL') >= 0; })
        .forEach(function(l) { console.log('       ' + l.trim()); });
    }
  }
});

console.log('\n========================================');
console.log('合計: ' + (totalPassed + (typeof totalFailed === 'number' ? totalFailed : 0)));
console.log('通過: ' + totalPassed + '  失敗: ' + totalFailed);
console.log('========================================');

process.exit(totalFailed > 0 ? 1 : 0);
