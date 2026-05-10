/**
 * Message Templates - LINE Message Templates
 *
 * Uses placeholder-based templates with _fill() for string construction.
 * Repeated patterns are extracted into shared helpers.
 */

/**
 * Fill template placeholders: {key} → values[key]
 */
function _fill(template, values) {
  return template.replace(/\{(\w+)\}/g, function(m, key) {
    return values[key] !== undefined ? values[key] : m;
  });
}

/**
 * Format start-end time range, handling missing/NaN end times
 */
function _fmtTimeRange(start, end) {
  if (end && end.indexOf('NaN') === -1) return start + ' - ' + end;
  return start;
}

var MessageTemplates = {
  getWelcomeMessage: function() {
    return {
      text: '整骨院へようこそ！\n\n以下から選択してください：',
      quickReplies: [
        {label: '予約する', text: '予約する'},
        {label: '予約確認', text: '予約確認'},
        {label: '予約変更・キャンセル', text: '予約変更・キャンセル'},
        {label: '当日空き枠通知を受け取る', text: '当日空き枠通知を受け取る'}
      ]
    };
  },

  getDepositRequestMessage: function(reservationId, date, time, menu, paymentLink) {
    return _fill(
      '以下の内容で予約を受け付けました。\n\n' +
      '【予約ID】 {reservationId}\n' +
      '【日付】 {date}\n' +
      '【時間】 {time}\n' +
      '【施術】 {menu}\n\n' +
      'デポジット（{depositAmount}円）のお支払いをお願いします。\n' +
      '※施術当日にお会計から差し引かれます\n' +
      '※キャンセルは{deadline}時間前まで全額返金\n\n' +
      '{paymentLink}\n\n' +
      '決済完了後、自動的に予約が確定します。\n' +
      '数分経っても確定通知が来ない場合は「支払完了」と返信してください。',
      {
        reservationId: reservationId,
        date: date,
        time: time,
        menu: menu,
        depositAmount: getDepositAmount(),
        deadline: getCancellationDeadlineHours(),
        paymentLink: paymentLink
      }
    );
  },

  getConfirmationMessage: function(reservation) {
    var timeRange = _fmtTimeRange(reservation.reserved_start, reservation.reserved_end);
    return _fill(
      '予約が確定しました！\n\n' +
      '【予約ID】 {id}\n' +
      '【氏名】 {name}\n' +
      '【日付】 {date}\n' +
      '【時間】 {time}\n' +
      '【施術】 {menu}\n\n' +
      '【注意事項】\n' +
      '・遅刻は15分までにお願いします\n' +
      '・キャンセルは2時間前までにお願いします\n' +
      '・無断キャンセルの場合、デポジットは没収されます\n\n' +
      '当日、{startTime}にお待ちしております！',
      {
        id: reservation.id,
        name: reservation.patient_name,
        date: reservation.reserved_date,
        time: timeRange,
        menu: reservation.menu_type,
        startTime: reservation.reserved_start
      }
    );
  },

  getReminderMessage: function(date, time, menu) {
    return {
      text: _fill(
        '明日はご予約の日です。\n\n' +
        '【日時】 {date} {time}\n' +
        '【施術】 {menu}\n\n' +
        '来院できますか？',
        { date: date, time: time, menu: menu }
      ),
      quickReplies: [
        { label: 'はい、行きます', text: 'はい、行きます' },
        { label: '変更したい', text: '予約変更・キャンセル' },
        { label: 'キャンセル', text: 'キャンセル' }
      ]
    };
  },

  getSameDayConfirmationMessage: function(date, time) {
    return _fill(
      '本日は {date} の {time} にご予約です。\n\nご来院予定でよろしいでしょうか？',
      { date: date, time: time }
    );
  },

  getResaleNotificationMessage: function(date, time, menu) {
    return {
      text: _fill(
        '【当日空き枠のご案内】\n\n' +
        '急な空き枠が出ました！\n\n' +
        '【日時】 {date} {time}\n' +
        '【施術】 {menu}\n\n' +
        'ご希望の方は下のボタンからお申し込みください。\n' +
        '先着順で確定させていただきます。',
        { date: date, time: time, menu: menu }
      ),
      quickReplies: [
        { label: 'この枠を予約する', text: 'RESERVE_SLOT:' + date + ':' + time },
        { label: 'また今度', text: 'また今度' }
      ]
    };
  },

  getNoShowPenaltyMessage: function(depositAmount) {
    return _fill(
      '予約に来院されなかったため、デポジットを没収させていただきました。\n\n' +
      '【没収金額】 {depositAmount}円\n\n' +
      '次回以降は必ずキャンセル連絡をお願いします。\n' +
      '無断キャンセルが{threshold}回以上の場合、次回以降は{noShowDeposit}円のデポジットが必須となります。\n\n' +
      '何かご不明な点がございましたら、ご連絡ください。',
      {
        depositAmount: depositAmount,
        threshold: getNoShowThreshold(),
        noShowDeposit: getNoShowDepositAmount()
      }
    );
  },

  getPaymentFailedMessage: function(errorMessage) {
    return _fill(
      'お支払いに失敗しました。\n\n' +
      '【エラー】 {error}\n\n' +
      '再度決済リンクからお支払いをお願いします。\n' +
      '何度も失敗する場合は、管理者にお問い合わせください。',
      { error: errorMessage || '原因不明のエラー' }
    );
  },

  getRefundConfirmationMessage: function(reservationId) {
    return _fill(
      'デポジットを返金いたしました。\n\n' +
      '【予約ID】 {reservationId}\n' +
      '【返金額】 {depositAmount}円\n\n' +
      '返金処理には3〜5営業日かかります。\n' +
      'ご了承ください。',
      { reservationId: reservationId, depositAmount: getDepositAmount() }
    );
  },

  getCancellationConfirmationMessage: function(reservationId) {
    return _fill(
      '予約をキャンセルしました。\n\n' +
      '【予約ID】 {reservationId}\n\n' +
      'またのご予約をお待ちしております。',
      { reservationId: reservationId }
    );
  },

  getMenuOptionsMessage: function() {
    return '施術の種類を選択してください。\n\n' +
      '1. 初診（30分）\n' +
      '2. 再診（30分）\n' +
      '3. 再診（60分）\n\n' +
      '番号（1〜3）または施術名で返信してください。';
  },

  getChangePromptMessage: function() {
    return '変更したい予約の電話番号を入力してください。\n\n該当する予約を検索します。';
  },

  getCancelPromptMessage: function() {
    return 'キャンセルしたい予約の電話番号を入力してください。\n\n' +
      '該当する予約を検索します。\n' +
      '※キャンセルは2時間前まで無料です。';
  },

  getNoCancellableReservationsMessage: function() {
    return 'キャンセル可能な予約がありません。\n\n新規予約は「予約する」からお手続きください。';
  },

  getCancelListMessage: function(reservations, page, totalPages) {
    var pageNum = (page || 0) + 1;
    var tp = totalPages || 1;
    var msg = 'キャンセル可能な予約があります。';
    if (tp > 1) msg += '（' + pageNum + '/' + tp + 'ページ目）';
    msg += '\n\n';
    for (var i = 0; i < reservations.length; i++) {
      var r = reservations[i];
      msg += (i + 1) + '. 【' + r.id + '】\n' +
        '   ' + r.reserved_date + ' ' + _fmtTimeRange(r.reserved_start, r.reserved_end) + '\n' +
        '   ' + r.menu_type + ' / デポジット: ' + r.deposit_status + '\n\n';
    }
    msg += 'キャンセルする予約の番号を返信してください。';
    return msg;
  },

  getCancelConfirmMessage: function(reservation) {
    var timeRange = _fmtTimeRange(reservation.reserved_start, reservation.reserved_end);
    var msg = '以下の予約をキャンセルします。よろしいですか？\n\n' +
      '【予約ID】 ' + reservation.id + '\n' +
      '【日時】 ' + reservation.reserved_date + ' ' + timeRange + '\n' +
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

  getCancelDeadlineExceededMessage: function(reservation) {
    var deadline = getCancellationDeadlineHours();
    return _fill(
      'キャンセル締切（予約の{deadline}時間前）を過ぎています。\n\n' +
      '【予約ID】 {reservationId}\n' +
      '【日時】 {date} {time}\n\n' +
      'どうしてもキャンセルが必要な場合は、管理者にお問い合わせください。',
      {
        deadline: deadline,
        reservationId: reservation.id,
        date: reservation.reserved_date,
        time: reservation.reserved_start
      }
    );
  },

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

  getCancelRefundFailedMessage: function(reservation) {
    return _fill(
      'キャンセル処理中に返金エラーが発生しました。\n\n' +
      '【予約ID】 {reservationId}\n\n' +
      '予約はキャンセルされましたが、返金処理が完了していません。\n' +
      '管理者が確認いたしますので、しばらくお待ちください。',
      { reservationId: reservation.id }
    );
  },

  getWaitlistRegistrationMessage: function() {
    return '待機リストに登録します。\n\n' +
      '以下の情報を入力してください。\n\n' +
      '1. 電話番号\n' +
      '2. 希望時間（Morning/Afternoon/Evening/Any）\n' +
      '3. 当日空き枠でよいか（Y/N）';
  },

  getBusinessHoursMessage: function() {
    var hours = getBusinessHours();
    var address = getBusinessAddress();
    var msg = '【営業時間・アクセス】\n\n';
    msg += '営業時間:\n' + (hours || 'お問い合わせください') + '\n\n';
    msg += 'アクセス:\n' + (address || 'お問い合わせください');
    return msg;
  },

  getContactMessage: function() {
    var phone = getContactPhone();
    var url = getContactUrl();
    var msg = 'お問い合わせありがとうございます。\n\n担当者から折り返しご連絡いたします。';
    if (phone) msg += '\n\n【電話】 ' + phone;
    if (url) msg += '\n【URL】 ' + url;
    if (!phone && !url) msg += '\n\nご不明な点はお気軽にご連絡ください。';
    return msg;
  },

  getWeeklySummaryMessage: function(weekData) {
    return _fill(
      '【週次サマリー】\n\n' +
      '集計期間: {weekStart}\n\n' +
      '総予約件数: {totalReservations}\n' +
      '無断件数: {totalNoShows}\n' +
      '無断率: {noShowRate}%\n' +
      '当日キャンセル: {sameDayCancellations}\n' +
      '再販通知回数: {resaleNotifications}\n' +
      '再販成功数: {resaleSuccessCount}\n' +
      '推定回収額: {recoveredRevenue}円\n\n' +
      '詳細はスプレッドシートをご確認ください。',
      {
        weekStart: weekData.week_start,
        totalReservations: weekData.total_reservations,
        totalNoShows: weekData.total_no_shows,
        noShowRate: weekData.no_show_rate,
        sameDayCancellations: weekData.same_day_cancellations,
        resaleNotifications: weekData.resale_notifications,
        resaleSuccessCount: weekData.resale_success_count,
        recoveredRevenue: weekData.estimated_recovered_revenue
      }
    );
  },

  getNoChangeableReservationsMessage: function() {
    return '変更・キャンセル可能な予約がありません。\n\n新規予約は「予約する」からお手続きください。';
  },

  getChangeListMessage: function(reservations, page, totalPages) {
    var pageNum = (page || 0) + 1;
    var tp = totalPages || 1;
    var msg = '変更可能な予約があります。';
    if (tp > 1) msg += '（' + pageNum + '/' + tp + 'ページ目）';
    msg += '\n\n';
    for (var i = 0; i < reservations.length; i++) {
      var r = reservations[i];
      msg += (i + 1) + '. 【' + r.id + '】\n' +
        '   ' + r.reserved_date + ' ' + _fmtTimeRange(r.reserved_start, r.reserved_end) + '\n' +
        '   ' + r.menu_type + '\n\n';
    }
    msg += '変更する予約の番号を返信してください。';
    return msg;
  },

  getChangeFieldSelectMessage: function(reservation) {
    var timeRange = _fmtTimeRange(reservation.reserved_start, reservation.reserved_end);
    return _fill(
      '以下の予約を変更します。\n\n' +
      '【予約ID】 {id}\n' +
      '【日付】 {date}\n' +
      '【時間】 {time}\n' +
      '【施術】 {menu}\n\n' +
      '何を変更しますか？\n' +
      '「日付」「時間」「施術」のいずれかを返信してください。',
      {
        id: reservation.id,
        date: reservation.reserved_date,
        time: timeRange,
        menu: reservation.menu_type
      }
    );
  },

  getChangeConfirmMessage: function(reservation, field, newValue) {
    var fieldLabel = {date: '日付', time: '時間', treatment: '施術'}[field] || field;
    var currentValue = {date: reservation.reserved_date, time: _fmtTimeRange(reservation.reserved_start, reservation.reserved_end), treatment: reservation.menu_type}[field] || '';
    return _fill(
      '以下の変更を行います。よろしいですか？\n\n' +
      '【予約ID】 {id}\n\n' +
      '【変更項目】 {fieldLabel}\n' +
      '【変更前】 {currentValue}\n' +
      '【変更後】 {newValue}\n\n' +
      '「はい」で変更、「いいえ」で中止します。',
      { id: reservation.id, fieldLabel: fieldLabel, currentValue: currentValue, newValue: newValue }
    );
  },

  getChangeCompletedMessage: function(reservation, changeLabel) {
    return _fill(
      '予約を変更しました。\n\n' +
      '【予約ID】 {id}\n' +
      '【日付】 {date}\n' +
      '【時間】 {time}\n' +
      '【施術】 {menu}\n\n' +
      'またのご利用をお待ちしております。',
      {
        id: reservation.id,
        date: reservation.reserved_date,
        time: _fmtTimeRange(reservation.reserved_start, reservation.reserved_end),
        menu: reservation.menu_type
      }
    );
  }
};
