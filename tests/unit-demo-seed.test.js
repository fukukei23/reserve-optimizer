/**
 * Unit Tests - DemoSeed 再現性・安全性（Phase α E11）
 *
 * Run: node tests/unit-demo-seed.test.js
 *
 * 検証:
 *  - 固定seedで決定的再現（同一seed→同一データ）
 *  - 件数・形状（customers 30 / reservations >0）
 *  - 安全性（本番Spreadsheet ID を含まない）
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var gasDir = path.join(__dirname, '..', 'gas-project');
var ctx = vm.createContext({});
['config/SheetConfig.js', 'utils/DemoSeed.js'].forEach(function (rel) {
  vm.runInContext(fs.readFileSync(path.join(gasDir, rel), 'utf8'), ctx, { filename: rel });
});

var DemoSeed = ctx.DemoSeed;

var passed = 0, failed = 0, errors = [];
function assert(name, cond) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; errors.push(name); console.log('  FAIL ' + name); }
}

console.log('\n== DemoSeed 再現性・安全性 ==');

var seedDefault1 = DemoSeed.generateDemoSeed();
var seedDefault2 = DemoSeed.generateDemoSeed();
var seedA = DemoSeed.generateDemoSeed(12345);
var seedB = DemoSeed.generateDemoSeed(12345);

assert('default seed で customers 30件生成', seedDefault1.customers.length === 30);
assert('reservations 1件以上生成', seedDefault1.reservations.length > 0);
assert('同一 default seed で customers 再現', JSON.stringify(seedDefault1.customers) === JSON.stringify(seedDefault2.customers));
assert('同一 default seed で reservations 再現', JSON.stringify(seedDefault1.reservations) === JSON.stringify(seedDefault2.reservations));
assert('明示 seed(12345) で customers 再現', JSON.stringify(seedA.customers) === JSON.stringify(seedB.customers));
assert('異 seed で customers が変わる', JSON.stringify(seedDefault1.customers) !== JSON.stringify(seedA.customers));
assert('meta.seed が生成結果に記録される', seedDefault1.meta.seed === DemoSeed.DEFAULT_SEED);
assert('顧客 phone が10-11桁の数字', /^\d{10,11}$/.test(seedDefault1.customers[0].phone));
assert('reservation_id が DEMO- prefix', /^DEMO-/.test(seedDefault1.reservations[0].reservation_id));
assert('顧客名が空でない', seedDefault1.customers[0].name.length > 0);

// 安全性: 本番 Spreadsheet ID の硬コード混入がないこと
var serialized = JSON.stringify(seedDefault1);
assert('本番 Spreadsheet ID(18grw9Mv) を含まない', serialized.indexOf('18grw9Mv') < 0);

console.log('\n========================================');
console.log('DemoSeed Unit Tests');
console.log('Total: ' + (passed + failed) + '  Passed: ' + passed + '  Failed: ' + failed);
if (errors.length > 0) { console.log('\nFailed:'); errors.forEach(function (e) { console.log('  FAIL ' + e); }); }
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
