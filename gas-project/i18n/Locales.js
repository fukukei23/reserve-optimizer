/**
 * Locales - i18n Message Catalog
 *
 * All user-facing strings keyed by dot-notation.
 * ja = existing Japanese, en = English translation.
 * Add new keys to both objects to keep them in sync.
 */

var MESSAGES = {
  // --- Welcome / Top Menu ---
  'welcome.text': {
    ja: '整骨院へようこそ！\n\n以下から選択してください：',
    en: 'Welcome to our clinic!\n\nPlease select from below:'
  },
  'welcome.reserve': {
    ja: '予約する',
    en: 'Book'
  },
  'welcome.view': {
    ja: '予約確認',
    en: 'My Reservations'
  },
  'welcome.change': {
    ja: '予約変更・キャンセル',
    en: 'Change / Cancel'
  },
  'welcome.waitlist': {
    ja: '当日空き枠通知を受け取る',
    en: 'Get same-day slot alerts'
  },

  // --- Deposit ---
  'deposit.header': {
    ja: '以下の内容で予約を受け付けました。',
    en: 'Your reservation has been received.'
  },
  'deposit.reservation_id': { ja: '予約ID', en: 'Reservation ID' },
  'deposit.date': { ja: '日付', en: 'Date' },
  'deposit.time': { ja: '時間', en: 'Time' },
  'deposit.treatment': { ja: '施術', en: 'Treatment' },
  'deposit.request': {
    ja: 'デポジット（{depositAmount}円）のお支払いをお願いします。',
    en: 'Please pay the deposit ({depositAmount} yen).'
  },
  'deposit.note_deducted': {
    ja: '※施術当日にお会計から差し引かれます',
    en: '* Deducted from your total on the day of treatment'
  },
  'deposit.note_refund': {
    ja: '※キャンセルは{deadline}時間前まで全額返金',
    en: '* Full refund if cancelled {deadline}+ hours before'
  },
  'deposit.auto_confirm': {
    ja: '決済完了後、自動的に予約が確定します。',
    en: 'Your reservation will be confirmed automatically after payment.'
  },
  'deposit.manual_check': {
    ja: '数分経っても確定通知が来ない場合は「支払完了」と返信してください。',
    en: 'If you don\'t receive confirmation in a few minutes, reply "paid".'
  },

  // --- Confirmation ---
  'confirm.title': {
    ja: '予約が確定しました！',
    en: 'Your reservation is confirmed!'
  },
  'confirm.name': { ja: '氏名', en: 'Name' },
  'confirm.notes_title': { ja: '注意事項', en: 'Important notes' },
  'confirm.note_late': {
    ja: '・遅刻は15分までにお願いします',
    en: '- Please arrive within 15 min of your appointment'
  },
  'confirm.note_cancel': {
    ja: '・キャンセルは2時間前までにお願いします',
    en: '- Please cancel at least 2 hours before'
  },
  'confirm.note_noshow': {
    ja: '・無断キャンセルの場合、デポジットは没収されます',
    en: '- No-shows will forfeit the deposit'
  },
  'confirm.see_you': {
    ja: '当日、{startTime}にお待ちしております！',
    en: 'See you at {startTime}!'
  },

  // --- Reminder ---
  'reminder.title': {
    ja: '明日はご予約の日です。',
    en: 'Tomorrow is your appointment.'
  },
  'reminder.confirm_attendance': {
    ja: '来院できますか？',
    en: 'Can you make it?'
  },
  'reminder.yes': { ja: 'はい、行きます', en: 'Yes, I\'ll come' },
  'reminder.want_change': { ja: '変更したい', en: 'Want to change' },
  'reminder.cancel': { ja: 'キャンセル', en: 'Cancel' },

  // --- Same Day ---
  'sameday.confirm': {
    ja: '本日は {date} の {time} にご予約です。\n\nご来院予定でよろしいでしょうか？',
    en: 'You have a reservation today at {time} on {date}.\n\nAre you still planning to visit?'
  },

  // --- Resale / Waitlist ---
  'resale.title': {
    ja: '【当日空き枠のご案内】\n\n急な空き枠が出ました！',
    en: '[Same-day slot available]\n\nA slot just opened up!'
  },
  'resale.book': { ja: 'この枠を予約する', en: 'Book this slot' },
  'resale.later': { ja: 'また今度', en: 'Maybe next time' },
  'resale.fcfs': {
    ja: 'ご希望の方は下のボタンからお申し込みください。\n先着順で確定させていただきます。',
    en: 'Tap the button below to book. First come, first served.'
  },

  // --- No-show ---
  'noshow.forfeit': {
    ja: '予約に来院されなかったため、デポジットを没収させていただきました。',
    en: 'You did not show up for your reservation. The deposit has been forfeited.'
  },
  'noshow.amount': { ja: '没収金額', en: 'Forfeited amount' },
  'noshow.next_time': {
    ja: '次回以降は必ずキャンセル連絡をお願いします。',
    en: 'Please cancel in advance next time.'
  },
  'noshow.threshold_warning': {
    ja: '無断キャンセルが{threshold}回以上の場合、次回以降は{noShowDeposit}円のデポジットが必須となります。',
    en: 'After {threshold}+ no-shows, a {noShowDeposit} yen deposit will be required for future bookings.'
  },
  'noshow.questions': {
    ja: '何かご不明な点がございましたら、ご連絡ください。',
    en: 'Please contact us if you have any questions.'
  },

  // --- Payment Failed ---
  'payment.failed': {
    ja: 'お支払いに失敗しました。',
    en: 'Payment failed.'
  },
  'payment.error': { ja: 'エラー', en: 'Error' },
  'payment.retry': {
    ja: '再度決済リンクからお支払いをお願いします。',
    en: 'Please try again from the payment link.'
  },
  'payment.contact_admin': {
    ja: '何度も失敗する場合は、管理者にお問い合わせください。',
    en: 'If it keeps failing, please contact us.'
  },
  'payment.unknown_error': {
    ja: '原因不明のエラー',
    en: 'Unknown error'
  },

  // --- Refund ---
  'refund.title': {
    ja: 'デポジットを返金いたしました。',
    en: 'Your deposit has been refunded.'
  },
  'refund.amount': { ja: '返金額', en: 'Refund amount' },
  'refund.timeline': {
    ja: '返金処理には3〜5営業日かかります。\nご了承ください。',
    en: 'Refunds take 3-5 business days. Thank you for your patience.'
  },

  // --- Cancel ---
  'cancel.done': {
    ja: '予約をキャンセルしました。',
    en: 'Your reservation has been cancelled.'
  },
  'cancel.thank_you': {
    ja: 'またのご予約をお待ちしております。',
    en: 'We look forward to your next visit.'
  },
  'cancel.prompt': {
    ja: 'キャンセルしたい予約の電話番号を入力してください。\n\n該当する予約を検索します。\n※キャンセルは2時間前まで無料です。',
    en: 'Enter the phone number for the reservation you want to cancel.\n\nWe\'ll search for matching reservations.\n* Free cancellation up to 2 hours before.'
  },
  'cancel.no_cancellable': {
    ja: 'キャンセル可能な予約がありません。\n\n新規予約は「予約する」からお手続きください。',
    en: 'No cancellable reservations found.\n\nBook a new one from "Book".'
  },
  'cancel.list_title': {
    ja: 'キャンセル可能な予約があります。',
    en: 'You have cancellable reservations.'
  },
  'cancel.select_number': {
    ja: 'キャンセルする予約の番号を返信してください。',
    en: 'Reply with the number of the reservation to cancel.'
  },
  'cancel.confirm': {
    ja: '以下の予約をキャンセルします。よろしいですか？',
    en: 'Cancel this reservation?'
  },
  'cancel.yes_no': {
    ja: '「はい」でキャンセル、「いいえ」で中止します。',
    en: 'Reply "yes" to cancel, "no" to keep it.'
  },
  'cancel.deposit_refund': {
    ja: '{amount}円 → 返金されます',
    en: '{amount} yen → will be refunded'
  },
  'cancel.deposit_unpaid': {
    ja: '未払い → 返金はありません',
    en: 'Unpaid → no refund'
  },
  'cancel.deadline_exceeded': {
    ja: 'キャンセル締切（予約の{deadline}時間前）を過ぎています。',
    en: 'Cancellation deadline ({deadline} hours before) has passed.'
  },
  'cancel.deadline_contact': {
    ja: 'どうしてもキャンセルが必要な場合は、管理者にお問い合わせください。',
    en: 'If you must cancel, please contact us directly.'
  },
  'cancel.refund_note': {
    ja: '{amount}円を返金しました（3〜5営業日）',
    en: '{amount} yen refunded (3-5 business days)'
  },
  'cancel.refund_error': {
    ja: 'キャンセル処理中に返金エラーが発生しました。',
    en: 'A refund error occurred during cancellation.'
  },
  'cancel.refund_error_note': {
    ja: '予約はキャンセルされましたが、返金処理が完了していません。\n管理者が確認いたしますので、しばらくお待ちください。',
    en: 'The reservation was cancelled but the refund is pending.\nOur staff will follow up shortly.'
  },
  'cancel.we_look_forward': {
    ja: 'またのご利用をお待ちしております。',
    en: 'We look forward to serving you again.'
  },

  // --- Change ---
  'change.prompt': {
    ja: '変更したい予約の電話番号を入力してください。\n\n該当する予約を検索します。',
    en: 'Enter the phone number for the reservation you want to change.\n\nWe\'ll search for matching reservations.'
  },
  'change.no_changeable': {
    ja: '変更・キャンセル可能な予約がありません。\n\n新規予約は「予約する」からお手続きください。',
    en: 'No changeable reservations found.\n\nBook a new one from "Book".'
  },
  'change.list_title': {
    ja: '変更可能な予約があります。',
    en: 'You have changeable reservations.'
  },
  'change.select_number': {
    ja: '変更する予約の番号を返信してください。',
    en: 'Reply with the number of the reservation to change.'
  },
  'change.field_select': {
    ja: '何を変更しますか？\n「日付」「時間」「施術」のいずれかを返信してください。',
    en: 'What would you like to change?\nReply "date", "time", or "treatment".'
  },
  'change.confirm': {
    ja: '以下の変更を行います。よろしいですか？',
    en: 'Apply this change?'
  },
  'change.field_label': { ja: '変更項目', en: 'Field' },
  'change.before': { ja: '変更前', en: 'Before' },
  'change.after': { ja: '変更後', en: 'After' },
  'change.done': {
    ja: '予約を変更しました。',
    en: 'Your reservation has been changed.'
  },
  'change.we_look_forward': {
    ja: 'またのご利用をお待ちしております。',
    en: 'We look forward to serving you again.'
  },
  'change.field.date': { ja: '日付', en: 'Date' },
  'change.field.time': { ja: '時間', en: 'Time' },
  'change.field.treatment': { ja: '施術', en: 'Treatment' },

  // --- Menu ---
  'menu.prompt': {
    ja: '施術の種類を選択してください。\n\n1. 初診（30分）\n2. 再診（30分）\n3. 再診（60分）\n\n番号（1〜3）または施術名で返信してください。',
    en: 'Select a treatment.\n\n1. First visit (30 min)\n2. Follow-up (30 min)\n3. Follow-up (60 min)\n\nReply with a number (1-3) or treatment name.'
  },

  // --- Waitlist ---
  'waitlist.register': {
    ja: '待機リストに登録します。\n\n以下の情報を入力してください。\n\n1. 電話番号\n2. 希望時間（Morning/Afternoon/Evening/Any）\n3. 当日空き枠でよいか（Y/N）',
    en: 'Register for the waitlist.\n\nPlease provide:\n\n1. Phone number\n2. Preferred time (Morning/Afternoon/Evening/Any)\n3. Same-day slots OK? (Y/N)'
  },

  // --- Business Hours ---
  'hours.title': {
    ja: '【営業時間・アクセス】',
    en: '[Hours & Access]'
  },
  'hours.hours': { ja: '営業時間', en: 'Hours' },
  'hours.access': { ja: 'アクセス', en: 'Access' },
  'hours.contact_us': { ja: 'お問い合わせください', en: 'Contact us for details' },

  // --- Contact ---
  'contact.title': {
    ja: 'お問い合わせありがとうございます。\n\n担当者から折り返しご連絡いたします。',
    en: 'Thank you for your inquiry.\n\nOur staff will get back to you.'
  },
  'contact.phone': { ja: '電話', en: 'Phone' },
  'contact.url_label': { ja: 'URL', en: 'URL' },
  'contact.any_questions': {
    ja: 'ご不明な点はお気軽にご連絡ください。',
    en: 'Feel free to contact us with any questions.'
  },

  // --- Weekly Summary ---
  'weekly.title': { ja: '【週次サマリー】', en: '[Weekly Summary]' },
  'weekly.period': { ja: '集計期間', en: 'Period' },
  'weekly.total': { ja: '総予約件数', en: 'Total reservations' },
  'weekly.noshows': { ja: '無断件数', en: 'No-shows' },
  'weekly.noshow_rate': { ja: '無断率', en: 'No-show rate' },
  'weekly.same_day_cancel': { ja: '当日キャンセル', en: 'Same-day cancellations' },
  'weekly.resale_notified': { ja: '再販通知回数', en: 'Resale notifications' },
  'weekly.resale_success': { ja: '再販成功数', en: 'Resale successes' },
  'weekly.recovered': { ja: '推定回捕集額', en: 'Recovered revenue' },
  'weekly.check_sheet': {
    ja: '詳細はスプレッドシートをご確認ください。',
    en: 'See the spreadsheet for details.'
  },

  // --- Deposit status labels ---
  'status.deposit_paid': { ja: 'Paid', en: 'Paid' },
  'status.deposit_unpaid': { ja: 'Unpaid', en: 'Unpaid' },

  // --- Slot full ---
  'api.slot_full': {
    ja: 'この時間は既に予約で埋まっています',
    en: 'This time slot is fully booked'
  },
  'api.reservation_failed': {
    ja: '予約の作成に失敗しました',
    en: 'Failed to create reservation'
  },

  // --- MessageRouter specific ---
  'router.yes_no_prompt': {
    ja: '「はい」または「いいえ」で答えてください。',
    en: 'Please reply "yes" or "no".'
  },
  'router.cancelled': {
    ja: '操作をキャンセルしました。\n\n「予約する」でまた始められます。',
    en: 'Operation cancelled.\n\nTap "Book" to start again.'
  },
  'router.back_to_menu': {
    ja: '操作を中止し、メニューに戻ります。',
    en: 'Returning to menu.'
  },
  'router.can_help': {
    ja: '何かお手伝いしましょうか？',
    en: 'How can I help you?'
  },
  'router.admin_only': {
    ja: 'このコマンドは管理者のみ利用可能です。',
    en: 'This command is admin-only.'
  },
  'router.cleanup_done': {
    ja: '期限切れ状態のクリーンアップを実行しました。',
    en: 'Expired states cleaned up.'
  },
  'router.no_reservations': {
    ja: '現在予約はありません。\n\n「予約する」から新しく予約できます。',
    en: 'No reservations found.\n\nBook a new one from "Book".'
  },
  'router.current_reservations': {
    ja: '【現在の予約】',
    en: '[Current Reservations]'
  },
  'router.status_confirmed': { ja: '確定', en: 'Confirmed' },
  'router.status_pending': { ja: '支払待ち', en: 'Pending payment' },
  'router.deposit_paid': { ja: 'デポジット済', en: 'Deposit paid' },
  'router.change_cancel_prompt': {
    ja: '変更・キャンセルは「予約変更・キャンセル」からどうぞ。',
    en: 'Use "Change / Cancel" to modify or cancel.'
  },
  'router.welcome_back': {
    ja: 'さん、おかえりなさい！\n\n前回は「',
    en: ', welcome back!\n\nLast time you visited as '
  },
  'router.welcome_back_cont': {
    ja: '」様としてご来院いただきました。\n引き続き「予約する」からご予約いただけます。',
    en: '.\nYou can book again from "Book".'
  },
  'router.reminder_changed': {
    ja: 'リマインダー時刻を ',
    en: 'Reminder time changed to '
  },
  'router.reminder_changed_suffix': {
    ja: ' に変更しました。',
    en: '.'
  },
  'router.invalid_command': {
    ja: '無効なコマンドです。/help でコマンド一覧を確認してください。',
    en: 'Invalid command. Type /help for a list.'
  },
  'router.settings_title': {
    ja: '【現在の設定】\nリマインダー時刻: ',
    en: '[Settings]\nReminder time: '
  },
  'router.settings_change': {
    ja: 'リマインダー時刻を変更する場合は下から選択してください。',
    en: 'Select a new reminder time below.'
  },
  'router.back_to_menu_label': { ja: 'メニューに戻る', en: 'Back to menu' }
};
