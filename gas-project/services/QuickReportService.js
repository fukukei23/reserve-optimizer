/**
 * QuickReport Service
 *
 * 毎朝の「実際の来院数」報告をLINEで収集し DAILY_REPORT シートへ記録。
 * 純粋ロジック（GAS API 非依存）と GAS API 依存部分で構成。
 *
 * 関連: docs/superpowers/specs/2026-07-26-reserve-optimizer-quickreport-design.md
 */

/**
 * 来院数入力のバリデーション（非負整数）。
 * @param {string} text スタッフの返信テキスト
 * @return {boolean}
 */
function isValidVisitsInput(text) {
  if (!text) return false;
  var trimmed = String(text).trim();
  if (trimmed === '') return false;
  return /^\d+$/.test(trimmed);
}

/**
 * 電話/窓口経由来院数 = 報告来院数 − Bot経由来店完了数（下限0）。
 * @param {number} reportedVisits スタッフ報告の実際の来院数
 * @param {number} botCompletedVisits Bot経由来店完了数
 * @return {number}
 */
function calcPhoneWindowVisits(reportedVisits, botCompletedVisits) {
  var diff = (reportedVisits || 0) - (botCompletedVisits || 0);
  return diff > 0 ? diff : 0;
}

/**
 * 指定日が営業日か（WORKING_DAYS はカンマ区切り曜日番号 0=日..6=土）。
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} workingDays '1,2,3,4,5'
 * @return {boolean}
 */
function isWorkingDay(dateStr, workingDays) {
  if (!dateStr || !workingDays) return false;
  var days = workingDays.split(',');
  var dow = new Date(dateStr + 'T00:00:00').getDay();
  return days.indexOf(String(dow)) !== -1;
}
