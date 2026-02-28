/**
 * Message Templates - LINE Message Templates
 *
 * Defines all 7 types of LINE messages for the reservation system
 */

var MessageTemplates = {
  /**
   * Template 1: Welcome message (after friend added)
   */
  getWelcomeMessage: function() {
    var message = '整骨院へようこそ！\n\n' +
      '以下から選択してください：';

    var quickReplies = [
      {label: '予約する', text: '予約する'},
      {label: '予約変更・キャンセル', text: '予約変更・キャンセル'},
      {label: '当日空き枠通知を受け取る', text: '当日空き枠通知を受け取る'}
    ];

    return {text: message, quickReplies: quickReplies};
  },

  /**
   * Template 2: Reservation confirmation with deposit request
   */
  getDepositRequestMessage: function(reservationId, date, time, menu, paymentLink) {
    return '以下の内容で予約を受け付けました。\n\n' +
      '【予約ID】 ' + reservationId + '\n' +
      '【日付】 ' + date + '\n' +
      '【時間】 ' + time + '\n' +
      '【施術】 ' + menu + '\n\n' +
      'デポジット（' + getDepositAmount() + '円）のお支払いをお願いします。\n\n' +
      paymentLink + '\n\n' +
      'お支払い完了後、「支払完了」と返信してください。';
  },

  /**
   * Template 3: Reservation confirmed (after payment)
   */
  getConfirmationMessage: function(reservation) {
    return '予約が確定しました！\n\n' +
      '【予約ID】 ' + reservation.id + '\n' +
      '【氏名】 ' + reservation.patient_name + '\n' +
      '【日付】 ' + reservation.reserved_date + '\n' +
      '【時間】 ' + reservation.reserved_start + ' - ' + reservation.reserved_end + '\n' +
      '【施術】 ' + reservation.menu_type + '\n\n' +
      '【注意事項】\n' +
      '・遅刻は15分までにお願いします\n' +
      '・キャンセルは2時間前までにお願いします\n' +
      '・無断キャンセルの場合、デポジットは没収されます\n\n' +
      '当日、' + reservation.reserved_start + 'にお待ちしております！';
  },

  /**
   * Template 4: Day-before reminder (24 hours before)
   */
  getReminderMessage: function(date, time, menu) {
    return '明日はご予約の日です。\n\n' +
      '【日時】 ' + date + ' ' + time + '\n' +
      '【施術】 ' + menu + '\n\n' +
      '来院できますか？\n\n' +
      '返信してください：\n' +
      '「行きます」または「変更したい」または「キャンセル」';
  },

  /**
   * Template 5: Same-day morning (no response to reminder)
   */
  getSameDayConfirmationMessage: function(date, time) {
    return '本日は ' + date + ' の ' + time + ' にご予約です。\n\n' +
      'ご来院予定でよろしいでしょうか？';
  },

  /**
   * Template 6: Vacancy resale notification (same-day opening)
   */
  getResaleNotificationMessage: function(date, time, menu) {
    return '【当日空き枠のご案内】\n\n' +
      '急な空き枠が出ました！\n\n' +
      '【日時】 ' + date + ' ' + time + '\n' +
      '【施術】 ' + menu + '\n\n' +
      'ご希望の方は「希望」と返信してください。\n' +
      '先着順で確定させていただきます。';
  },

  /**
   * Template 7: No-show penalty notice
   */
  getNoShowPenaltyMessage: function(depositAmount) {
    return '予約に来院されなかったため、デポジットを没収させていただきました。\n\n' +
      '【没収金額】 ' + depositAmount + '円\n\n' +
      '次回以降は必ずキャンセル連絡をお願いします。\n' +
      '無断キャンセルが' + getNoShowThreshold() + '回以上の場合、次回以降は' +
      getNoShowDepositAmount() + '円のデポジットが必須となります。\n\n' +
      '何かご不明な点がございましたら、ご連絡ください。';
  },

  /**
   * Payment failed message
   */
  getPaymentFailedMessage: function(errorMessage) {
    return 'お支払いに失敗しました。\n\n' +
      '【エラー】 ' + (errorMessage || '原因不明のエラー') + '\n\n' +
      '再度決済リンクからお支払いをお願いします。\n' +
      '何度も失敗する場合は、管理者にお問い合わせください。';
  },

  /**
   * Refund confirmation
   */
  getRefundConfirmationMessage: function(reservationId) {
    return 'デポジットを返金いたしました。\n\n' +
      '【予約ID】 ' + reservationId + '\n' +
      '【返金額】 ' + getDepositAmount() + '円\n\n' +
      '返金処理には3〜5営業日かかります。\n' +
      'ご了承ください。';
  },

  /**
   * Cancellation confirmation
   */
  getCancellationConfirmationMessage: function(reservationId) {
    return '予約をキャンセルしました。\n\n' +
      '【予約ID】 ' + reservationId + '\n\n' +
      'またのご予約をお待ちしております。';
  },

  /**
   * Menu options message
   */
  getMenuOptionsMessage: function() {
    return '施術の種類を選択してください。\n\n' +
      '1. 初診（30分）\n' +
      '2. 再診（30分）\n' +
      '3. 再診（60分）\n\n' +
      '番号（1〜3）または施術名で返信してください。';
  },

  /**
   * Change reservation prompt
   */
  getChangePromptMessage: function() {
    return '変更したい予約の電話番号を入力してください。\n\n' +
      '該当する予約を検索します。';
  },

  /**
   * Cancel reservation prompt
   */
  getCancelPromptMessage: function() {
    return 'キャンセルしたい予約の電話番号を入力してください。\n\n' +
      '該当する予約を検索します。\n' +
      '※キャンセルは2時間前まで無料です。';
  },

  /**
   * Waitlist registration prompt
   */
  getWaitlistRegistrationMessage: function() {
    return '待機リストに登録します。\n\n' +
      '以下の情報を入力してください。\n\n' +
      '1. 電話番号\n' +
      '2. 希望時間（Morning/Afternoon/Evening/Any）\n' +
      '3. 当日空き枠でよいか（Y/N）';
  },

  /**
   * Weekly summary for admin
   */
  getWeeklySummaryMessage: function(weekData) {
    return '【週次サマリー】\n\n' +
      '集計期間: ' + weekData.week_start + '\n\n' +
      '総予約件数: ' + weekData.total_reservations + '\n' +
      '無断件数: ' + weekData.total_no_shows + '\n' +
      '無断率: ' + weekData.no_show_rate + '%\n' +
      '当日キャンセル: ' + weekData.same_day_cancellations + '\n' +
      '再販通知回数: ' + weekData.resale_notifications + '\n' +
      '再販成功数: ' + weekData.resale_success_count + '\n' +
      '推定回収額: ' + weekData.estimated_recovered_revenue + '円\n\n' +
      '詳細はスプレッドシートをご確認ください。';
  }
};
