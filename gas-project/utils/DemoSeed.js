/**
 * DemoSeed — 固定seed決定的疑似データ生成（Phase α E11）
 *
 * 純JS・GAS API 非依存。Node（seed-demo-data.js / 単体テスト）と
 * GAS（resetDemoData）の両方から vm/直接評価で利用（DRY一元化）。
 *
 * 安全要件:
 *  - 本番 Spreadsheet ID を硬コードしない（実注入は呼び出し側が SPREADSHEET_ID から取得）
 *  - すべて架空のデモデータ（個人情報完全偽装・再現性あり）
 *  - 列定義は SheetConfig.js の HEADERS に準拠
 */

var DemoSeed = (function () {
  // mulberry32: 固定seed決定的PRNG（外部依存ゼロ・再現性保証）
  function mulberry32(seed) {
    var a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var DEMO_CLINIC = {
    name: 'デモ鍼灸サロン',
    customers: 30,
    days: 90
  };

  // 固定seed（再現性）。2026-08-02 Phase α 設定。
  var DEFAULT_SEED = 20260802;

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function rngInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // 顧客生成（SheetConfig CUSTOMERS_HEADERS 準拠: 9カラム）
  function generateCustomers(rng) {
    var surnames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', 'デモ', 'テスト', 'サンプル'];
    var given = ['太郎', '花子', '一郎', '美咲', '健太', '陽子', '大輔', '次郎', '由美', '翔太'];
    var list = [];
    for (var i = 0; i < DEMO_CLINIC.customers; i++) {
      var phone = '090' + pad(rngInt(rng, 10, 99)) + pad(rngInt(rng, 1000, 9999)) + pad(rngInt(rng, 10, 99));
      list.push({
        customer_id: phone,            // phone-based（実本番仕様に合わせる）
        phone: phone,
        line_user_id: 'U' + (1000000000 + i).toString(36),
        name: pick(rng, surnames) + pick(rng, given),
        visit_count: rngInt(rng, 0, 12),
        no_show_count: rngInt(rng, 0, 2),
        last_visit: '2026-0' + rngInt(rng, 1, 7) + '-' + pad(rngInt(rng, 1, 28)),
        tags: pick(rng, ['新規', 'リピーター', 'VIP', '']),
        notes: pick(rng, ['デモ顧客', 'サンプル', ''])
      });
    }
    return list;
  }

  // 予約生成（SheetConfig RESERVATIONS_HEADERS 準拠: 24カラム）
  function generateReservations(rng, customers) {
    var menus = ['初診（30分）', '再診（30分）', '再診（60分）'];
    var statuses = ['Pending', 'Confirmed', 'Visited', 'Cancelled', 'NoShow'];
    var times = ['9:00', '9:30', '10:00', '10:30', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    var months = ['2026-05', '2026-06', '2026-07'];
    var list = [];
    for (var d = 0; d < DEMO_CLINIC.days; d++) {
      var count = rngInt(rng, 0, 4); // 1日あたり0〜4件
      for (var r = 0; r < count; r++) {
        var cust = pick(rng, customers);
        var month = months[Math.floor(d / 30)] || months[0];
        var day = pad((d % 30) + 1);
        var start = pick(rng, times);
        list.push({
          reservation_id: 'DEMO-' + (1000 + list.length),
          created_at: month + '-' + day + 'T' + start + ':00',
          patient_name: cust.name,
          phone: cust.phone,
          line_display_name: cust.name,
          visit_type: pick(rng, ['First', 'Repeat']),
          menu_type: pick(rng, menus),
          reserved_date: month + '-' + day,
          reserved_start: start,
          reserved_end: start,    // デモ表示用（実枠計算はSheet注入側で不要）
          status: pick(rng, statuses),
          deposit_required: rng() > 0.5 ? 'true' : 'false',
          deposit_amount: '1000',
          deposit_status: pick(rng, ['Unpaid', 'Paid', 'Refunded']),
          reminder_sent: pick(rng, ['true', 'false']),
          reminder_response: '',
          cancel_time: '',
          resale_notified: '',
          resale_success: '',
          average_unit_price: '5000',
          notes: 'デモ予約',
          payment_intent_id: 'pi_demo_' + list.length,
          follow_up_sent: '',
          used_ticket: ''
        });
      }
    }
    return list;
  }

  function generateDemoSeed(seed) {
    var s = seed || DEFAULT_SEED;
    var rng = mulberry32(s);
    var customers = generateCustomers(rng);
    var reservations = generateReservations(rng, customers);
    return {
      meta: { clinic: DEMO_CLINIC.name, purpose: 'Phase α demo', seed: s, generated_at: '2026-08-02' },
      customers: customers,
      reservations: reservations,
      stats: { customers: customers.length, reservations: reservations.length }
    };
  }

  return {
    generateDemoSeed: generateDemoSeed,
    mulberry32: mulberry32,
    DEMO_CLINIC: DEMO_CLINIC,
    DEFAULT_SEED: DEFAULT_SEED
  };
})();
