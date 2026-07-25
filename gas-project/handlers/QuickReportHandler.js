/**
 * QuickReport Handler
 *
 * QUICK_REPORT_AWAITING 状態のユーザーからの数字返信を処理。
 * MessageRouter._handleGlobalInput からディスパッチされる。
 *
 * 関連: docs/superpowers/specs/2026-07-26-reserve-optimizer-quickreport-design.md
 */

/**
 * QuickReport 待ち状態からの数字返信を処理。
 * @param {string} text 返信テキスト
 * @param {string} userId LINE userId
 * @param {string} replyToken
 * @return {{handled: boolean, reply: string}} handled=false 时は既存フローへ
 */
function handleQuickReportReply(text, userId, replyToken) {
  var state = getUserState(userId);
  if (!state || state.state !== 'QUICK_REPORT_AWAITING') {
    return { handled: false, reply: '' };
  }

  var dateStr = (state.context && state.context.date) || getYesterdayDateStr();

  if (!isValidVisitsInput(text)) {
    return { handled: true, reply: '数字で返信してください（例: 25）' };
  }

  var visits = parseInt(String(text).trim(), 10);
  var ok = recordDailyReport(dateStr, visits, userId);
  clearUserState(userId);

  return {
    handled: true,
    reply: ok
      ? '記録しました（' + dateStr + '・来院数 ' + visits + '）'
      : '記録に失敗しました。再度返信するか管理者に連絡してください。'
  };
}
