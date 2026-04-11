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
      '【時間】 ' + reservation.reserved_start + (reservation.reserved_end && reservation.reserved_end.indexOf('NaN') === -1 ? ' - ' + reservation.reserved_end : '') + '\n' +
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
   * No cancellable reservations found
   */
  getNoCancellableReservationsMessage: function() {
    return 'キャンセル可能な予約がありません。\n\n' +
      '予約状況は /reserve で確認するか、' +
      '管理者にお問い合わせください。';
  },

  /**
   * Cancel reservation list (show active reservations for selection)
   * Now supports pagination: shows page+1 / totalPages
   */
  getCancelListMessage: function(reservations, page, totalPages) {
    var pageNum = (page || 0) + 1;
    var tp = totalPages || 1;
    var msg = 'キャンセル可能な予約が' + (reservations.length > 0 ? '' : '') + 'あります。';
    if (tp > 1) {
      msg += '（' + pageNum + '/' + tp + 'ページ目）';
    }
    msg += '\n\n';
    for (var i = 0; i < reservations.length; i++) {
      var r = reservations[i];
      msg += (i + 1) + '. 【' + r.id + '】\n' +
        '   ' + r.reserved_date + ' ' + r.reserved_start + (r.reserved_end && r.reserved_end.indexOf('NaN') === -1 ? ' - ' + r.reserved_end : '') + '\n' +
        '   ' + r.menu_type + ' / デポジット: ' + r.deposit_status + '\n\n';
    }
    msg += 'キャンセルする予約の番号を返信してください。';
    return msg;
  },

  /**
   * Cancel confirmation message (before executing)
   */
  getCancelConfirmMessage: function(reservation) {
    var msg = '以下の予約をキャンセルします。よろしいですか？\n\n' +
      '【予約ID】 ' + reservation.id + '\n' +
      '【日時】 ' + reservation.reserved_date + ' ' + reservation.reserved_start + (reservation.reserved_end && reservation.reserved_end.indexOf('NaN') === -1 ? ' - ' + reservation.reserved_end : '') + '\n' +
      '【施術】 ' + reservation.menu_type + '\n';

    if (reservation.deposit_status === DEPOSIT_STATUS.PAID) {
      msg += '【デポジット】 ' + reservation.deposit_amount + '円 → 返金されます\n';
    } else if (reservation.deposit_status === DEPOSIT_STATUS.UNPAID) {
      msg += '【デポジット】 未払い → 返金はありません\n';
    } else {
      msg += '【デポジット】 ' + reservation.deposit_status + '\n';
    }

    msg += '\n「はい」でキャンセル、「いいえ」で中止します。';
    return msg;
  },

  /**
   * Cancel deadline exceeded message
   */
  getCancelDeadlineExceededMessage: function(reservation) {
    var deadline = getCancellationDeadlineHours();
    return 'キャンセル締切（予約の' + deadline + '時間前）を過ぎています。\n\n' +
      '【予約ID】 ' + reservation.id + '\n' +
      '【日時】 ' + reservation.reserved_date + ' ' + reservation.reserved_start + '\n\n' +
      'どうしてもキャンセルが必要な場合は、管理者にお問い合わせください。';
  },

  /**
   * Cancel completed message (with refund info)
   */
  getCancelCompletedMessage: function(reservation, refunded) {
    var msg = '予約をキャンセルしました。\n\n' +
      '【予約ID】 ' + reservation.id + '\n' +
      '【日時】 ' + reservation.reserved_date + ' ' + reservation.reserved_start + '\n';
    if (refunded) {
      msg += '【返金】 ' + reservation.deposit_amount + '円を返金しました（3〜5営業日）\n';
    }
    msg += '\nまたのご利用をお待ちしております。';
    return msg;
  },

  /**
   * Cancel refund failed message
   */
  getCancelRefundFailedMessage: function(reservation) {
    return 'キャンセル処理中に返金エラーが発生しました。\n\n' +
      '【予約ID】 ' + reservation.id + '\n\n' +
      '予約はキャンセルされましたが、返金処理が完了していません。\n' +
      '管理者が確認いたしますので、しばらくお待ちください。';
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
   * Business hours and access info for "営業時間・アクセス" (rich menu)
   */
  getBusinessHoursMessage: function() {
    var hours = getBusinessHours();
    var address = getBusinessAddress();
    var msg = '【営業時間・アクセス】\n\n';
    msg += '営業時間:\n' + (hours || 'お問い合わせください') + '\n\n';
    msg += 'アクセス:\n' + (address || 'お問い合わせください');
    return msg;
  },

  /**
   * Contact message for "人間に問い合わせる" (human contact fallback)
   */
  getContactMessage: function() {
    var phone = getContactPhone();
    var url = getContactUrl();
    var msg = 'お問い合わせありがとうございます。\n\n担当者から折り返しご連絡いたします。';
    if (phone) {
      msg += '\n\n【電話】 ' + phone;
    }
    if (url) {
      msg += '\n【URL】 ' + url;
    }
    if (!phone && !url) {
      msg += '\n\nご不明な点はお気軽にご連絡ください。';
    }
    return msg;
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
  },

  /**
   * No changeable reservations found
   */
  getNoChangeableReservationsMessage: function() {
    return '変更可能な予約がありません。\n\n' +
      '予約状況は /reserve で新規予約するか、' +
      '管理者にお問い合わせください。';
  },

  /**
   * Change reservation list (show active reservations for selection)
   * Now supports pagination: shows page+1 / totalPages
   */
  getChangeListMessage: function(reservations, page, totalPages) {
    var pageNum = (page || 0) + 1;
    var tp = totalPages || 1;
    var msg = '変更可能な予約があります。';
    if (tp > 1) {
      msg += '（' + pageNum + '/' + tp + 'ページ目）';
    }
    msg += '\n\n';
    for (var i = 0; i < reservations.length; i++) {
      var r = reservations[i];
      msg += (i + 1) + '. 【' + r.id + '】\n' +
        '   ' + r.reserved_date + ' ' + r.reserved_start + (r.reserved_end && r.reserved_end.indexOf('NaN') === -1 ? ' - ' + r.reserved_end : '') + '\n' +
        '   ' + r.menu_type + '\n\n';
    }
    msg += '変更する予約の番号を返信してください。';
    return msg;
  },

  /**
   * Change field selection message (what to change: date / time / treatment)
   */
  getChangeFieldSelectMessage: function(reservation) {
    return '以下の予約を変更します。\n\n' +
      '【予約ID】 ' + reservation.id + '\n' +
      '【日付】 ' + reservation.reserved_date + '\n' +
      '【時間】 ' + reservation.reserved_start + (reservation.reserved_end && reservation.reserved_end.indexOf('NaN') === -1 ? ' - ' + reservation.reserved_end : '') + '\n' +
      '【施術】 ' + reservation.menu_type + '\n\n' +
      '何を変更しますか？\n' +
      '「日付」「時間」「施術」のいずれかを返信してください。';
  },

  /**
   * Change confirmation message (before executing)
   */
  getChangeConfirmMessage: function(reservation, field, newValue) {
    var fieldLabel = {date: '日付', time: '時間', treatment: '施術'}[field] || field;
    return '以下の変更を行います。よろしいですか？\n\n' +
      '【予約ID】 ' + reservation.id + '\n' +
      '【変更項目】 ' + fieldLabel + '\n' +
      '【変更後】 ' + newValue + '\n\n' +
      '「はい」で変更、「いいえ」で中止します。';
  },

  /**
   * Change completed message
   */
  getChangeCompletedMessage: function(reservation, changeLabel) {
    return '予約を変更しました。\n\n' +
      '【予約ID】 ' + reservation.id + '\n' +
      '【日付】 ' + reservation.reserved_date + '\n' +
      '【時間】 ' + reservation.reserved_start + ' - ' + reservation.reserved_end + '\n' +
      '【施術】 ' + reservation.menu_type + '\n\n' +
      'またのご利用をお待ちしております。';
  }
};
