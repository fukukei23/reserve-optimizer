/**
 * Message Templates - LINE Message Templates (i18n-ready)
 *
 * All user-facing strings are pulled from the MESSAGES catalog via t()/tf().
 * Pass `locale` to each function to get localized output.
 */

/**
 * Format start-end time range, handling missing/NaN end times
 */
function _fmtTimeRange(start, end) {
  if (end && end.indexOf('NaN') === -1) return start + ' - ' + end;
  return start;
}

/**
 * Format a label like 【日付】 or [Date] depending on locale
 */
function _label(key, locale) {
  return locale === 'en' ? '[' + t(key, locale) + ']' : '【' + t(key, locale) + '】';
}

var MessageTemplates = {
  getWelcomeMessage: function(locale) {
    return {
      text: t('welcome.text', locale),
      quickReplies: [
        {label: t('welcome.reserve', locale), text: t('welcome.reserve', locale)},
        {label: t('welcome.view', locale), text: t('welcome.view', locale)},
        {label: t('welcome.change', locale), text: t('welcome.change', locale)},
        {label: t('welcome.waitlist', locale), text: t('welcome.waitlist', locale)}
      ]
    };
  },

  getDepositRequestMessage: function(reservationId, date, time, menu, paymentLink, locale) {
    var loc = locale || 'ja';
    return tf('deposit.header', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservationId + '\n' +
      _label('deposit.date', loc) + ' ' + date + '\n' +
      _label('deposit.time', loc) + ' ' + time + '\n' +
      _label('deposit.treatment', loc) + ' ' + menu + '\n\n' +
      tf('deposit.request', {depositAmount: getDepositAmount()}, loc) + '\n' +
      tf('deposit.note_deducted', null, loc) + '\n' +
      tf('deposit.note_refund', {deadline: getCancellationDeadlineHours()}, loc) + '\n\n' +
      paymentLink + '\n\n' +
      tf('deposit.auto_confirm', null, loc) + '\n' +
      tf('deposit.manual_check', null, loc);
  },

  getConfirmationMessage: function(reservation, locale) {
    var loc = locale || 'ja';
    var timeRange = _fmtTimeRange(reservation.reserved_start, reservation.reserved_end);
    return tf('confirm.title', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservation.id + '\n' +
      _label('confirm.name', loc) + ' ' + reservation.patient_name + '\n' +
      _label('deposit.date', loc) + ' ' + reservation.reserved_date + '\n' +
      _label('deposit.time', loc) + ' ' + timeRange + '\n' +
      _label('deposit.treatment', loc) + ' ' + reservation.menu_type + '\n\n' +
      _label('confirm.notes_title', loc) + '\n' +
      tf('confirm.note_late', null, loc) + '\n' +
      tf('confirm.note_cancel', null, loc) + '\n' +
      tf('confirm.note_noshow', null, loc) + '\n\n' +
      tf('confirm.see_you', {startTime: reservation.reserved_start}, loc);
  },

  getReminderMessage: function(date, time, menu, locale) {
    var loc = locale || 'ja';
    return {
      text: tf('reminder.title', null, loc) + '\n\n' +
        _label('deposit.date', loc) + ' ' + date + ' ' + time + '\n' +
        _label('deposit.treatment', loc) + ' ' + menu + '\n\n' +
        tf('reminder.confirm_attendance', null, loc),
      quickReplies: [
        { label: tf('reminder.yes', null, loc), text: tf('reminder.yes', null, loc) },
        { label: tf('reminder.want_change', null, loc), text: t('welcome.change', loc) },
        { label: tf('reminder.cancel', null, loc), text: tf('reminder.cancel', null, loc) }
      ]
    };
  },

  getSameDayConfirmationMessage: function(date, time, locale) {
    return tf('sameday.confirm', {date: date, time: time}, locale);
  },

  getResaleNotificationMessage: function(date, time, menu, locale) {
    var loc = locale || 'ja';
    return {
      text: tf('resale.title', null, loc) + '\n\n' +
        _label('deposit.date', loc) + ' ' + date + ' ' + time + '\n' +
        _label('deposit.treatment', loc) + ' ' + menu + '\n\n' +
        tf('resale.fcfs', null, loc),
      quickReplies: [
        { label: tf('resale.book', null, loc), text: 'RESERVE_SLOT:' + date + ':' + time },
        { label: tf('resale.later', null, loc), text: tf('resale.later', null, loc) }
      ]
    };
  },

  getNoShowPenaltyMessage: function(depositAmount, locale) {
    var loc = locale || 'ja';
    return tf('noshow.forfeit', null, loc) + '\n\n' +
      _label('noshow.amount', loc) + ' ' + depositAmount + (loc === 'en' ? ' yen' : '円') + '\n\n' +
      tf('noshow.next_time', null, loc) + '\n' +
      tf('noshow.threshold_warning', {threshold: getNoShowThreshold(), noShowDeposit: getNoShowDepositAmount()}, loc) + '\n\n' +
      tf('noshow.questions', null, loc);
  },

  getPaymentFailedMessage: function(errorMessage, locale) {
    var loc = locale || 'ja';
    return tf('payment.failed', null, loc) + '\n\n' +
      _label('payment.error', loc) + ' ' + (errorMessage || tf('payment.unknown_error', null, loc)) + '\n\n' +
      tf('payment.retry', null, loc) + '\n' +
      tf('payment.contact_admin', null, loc);
  },

  getRefundConfirmationMessage: function(reservationId, locale) {
    var loc = locale || 'ja';
    return tf('refund.title', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservationId + '\n' +
      _label('refund.amount', loc) + ' ' + getDepositAmount() + (loc === 'en' ? ' yen' : '円') + '\n\n' +
      tf('refund.timeline', null, loc);
  },

  getCancellationConfirmationMessage: function(reservationId, locale) {
    var loc = locale || 'ja';
    return tf('cancel.done', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservationId + '\n\n' +
      tf('cancel.thank_you', null, loc);
  },

  getMenuOptionsMessage: function(locale) {
    return t('menu.prompt', locale);
  },

  getChangePromptMessage: function(locale) {
    return t('change.prompt', locale);
  },

  getCancelPromptMessage: function(locale) {
    return t('cancel.prompt', locale);
  },

  getNoCancellableReservationsMessage: function(locale) {
    return t('cancel.no_cancellable', locale);
  },

  getCancelListMessage: function(reservations, page, totalPages, locale) {
    var loc = locale || 'ja';
    var pageNum = (page || 0) + 1;
    var tp = totalPages || 1;
    var msg = tf('cancel.list_title', null, loc);
    if (tp > 1) msg += '(' + pageNum + '/' + tp + ')';
    msg += '\n\n';
    for (var i = 0; i < reservations.length; i++) {
      var r = reservations[i];
      msg += (i + 1) + '. ' + _label('deposit.reservation_id', loc).replace(/【|】|\[|\]/g, '') + ' ' + r.id + '\n' +
        '   ' + r.reserved_date + ' ' + _fmtTimeRange(r.reserved_start, r.reserved_end) + '\n' +
        '   ' + r.menu_type + ' / ' + t('deposit.treatment', loc) + ': ' + r.deposit_status + '\n\n';
    }
    msg += tf('cancel.select_number', null, loc);
    return msg;
  },

  getCancelConfirmMessage: function(reservation, locale) {
    var loc = locale || 'ja';
    var timeRange = _fmtTimeRange(reservation.reserved_start, reservation.reserved_end);
    var msg = tf('cancel.confirm', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservation.id + '\n' +
      _label('deposit.date', loc) + ' ' + reservation.reserved_date + ' ' + timeRange + '\n' +
      _label('deposit.treatment', loc) + ' ' + reservation.menu_type + '\n';

    if (reservation.deposit_status === DEPOSIT_STATUS.PAID) {
      msg += _label('deposit.treatment', loc).replace(t('deposit.treatment', loc), t('deposit.treatment', loc)) + ' ' +
        reservation.deposit_amount + (loc === 'en' ? ' yen' : '円') + ' ' +
        tf('cancel.deposit_refund', {amount: ''}, loc).replace('{amount}', '').trim() + '\n';
    } else if (reservation.deposit_status === DEPOSIT_STATUS.UNPAID) {
      msg += tf('cancel.deposit_unpaid', null, loc) + '\n';
    }

    msg += '\n' + tf('cancel.yes_no', null, loc);
    return msg;
  },

  getCancelDeadlineExceededMessage: function(reservation, locale) {
    var loc = locale || 'ja';
    return tf('cancel.deadline_exceeded', {deadline: getCancellationDeadlineHours()}, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservation.id + '\n' +
      _label('deposit.date', loc) + ' ' + reservation.reserved_date + ' ' + reservation.reserved_start + '\n\n' +
      tf('cancel.deadline_contact', null, loc);
  },

  getCancelCompletedMessage: function(reservation, refunded, locale) {
    var loc = locale || 'ja';
    var msg = tf('cancel.done', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservation.id + '\n' +
      _label('deposit.date', loc) + ' ' + reservation.reserved_date + ' ' + reservation.reserved_start + '\n';
    if (refunded) {
      msg += tf('cancel.refund_note', {amount: reservation.deposit_amount + (loc === 'en' ? ' yen' : '円')}, loc) + '\n';
    }
    msg += '\n' + tf('cancel.we_look_forward', null, loc);
    return msg;
  },

  getCancelRefundFailedMessage: function(reservation, locale) {
    return tf('cancel.refund_error', null, locale) + '\n\n' +
      _label('deposit.reservation_id', locale) + ' ' + reservation.id + '\n\n' +
      tf('cancel.refund_error_note', null, locale);
  },

  getWaitlistRegistrationMessage: function(locale) {
    return t('waitlist.register', locale);
  },

  getBusinessHoursMessage: function(locale) {
    var loc = locale || 'ja';
    var hours = getBusinessHours();
    var address = getBusinessAddress();
    var msg = tf('hours.title', null, loc) + '\n\n';
    msg += tf('hours.hours', loc) + ':\n' + (hours || tf('hours.contact_us', loc)) + '\n\n';
    msg += tf('hours.access', loc) + ':\n' + (address || tf('hours.contact_us', loc));
    return msg;
  },

  getContactMessage: function(locale) {
    var loc = locale || 'ja';
    var phone = getContactPhone();
    var url = getContactUrl();
    var msg = tf('contact.title', null, loc);
    if (phone) msg += '\n\n' + _label('contact.phone', loc) + ' ' + phone;
    if (url) msg += '\n' + _label('contact.url_label', loc) + ' ' + url;
    if (!phone && !url) msg += '\n\n' + tf('contact.any_questions', null, loc);
    return msg;
  },

  getWeeklySummaryMessage: function(weekData, locale) {
    var loc = locale || 'ja';
    return tf('weekly.title', null, loc) + '\n\n' +
      tf('weekly.period', loc) + ': ' + weekData.week_start + '\n\n' +
      tf('weekly.total', loc) + ': ' + weekData.total_reservations + '\n' +
      tf('weekly.noshows', loc) + ': ' + weekData.total_no_shows + '\n' +
      tf('weekly.noshow_rate', loc) + ': ' + weekData.no_show_rate + '%\n' +
      tf('weekly.same_day_cancel', loc) + ': ' + weekData.same_day_cancellations + '\n' +
      tf('weekly.resale_notified', loc) + ': ' + weekData.resale_notifications + '\n' +
      tf('weekly.resale_success', loc) + ': ' + weekData.resale_success_count + '\n' +
      tf('weekly.recovered', loc) + ': ' + weekData.estimated_recovered_revenue + (loc === 'en' ? ' yen' : '円') + '\n\n' +
      tf('weekly.check_sheet', null, loc);
  },

  getNoChangeableReservationsMessage: function(locale) {
    return t('change.no_changeable', locale);
  },

  getChangeListMessage: function(reservations, page, totalPages, locale) {
    var loc = locale || 'ja';
    var pageNum = (page || 0) + 1;
    var tp = totalPages || 1;
    var msg = tf('change.list_title', null, loc);
    if (tp > 1) msg += '(' + pageNum + '/' + tp + ')';
    msg += '\n\n';
    for (var i = 0; i < reservations.length; i++) {
      var r = reservations[i];
      msg += (i + 1) + '. ' + _label('deposit.reservation_id', loc).replace(/【|】|\[|\]/g, '') + ' ' + r.id + '\n' +
        '   ' + r.reserved_date + ' ' + _fmtTimeRange(r.reserved_start, r.reserved_end) + '\n' +
        '   ' + r.menu_type + '\n\n';
    }
    msg += tf('change.select_number', null, loc);
    return msg;
  },

  getChangeFieldSelectMessage: function(reservation, locale) {
    var loc = locale || 'ja';
    var timeRange = _fmtTimeRange(reservation.reserved_start, reservation.reserved_end);
    return tf('confirm.title', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservation.id + '\n' +
      _label('deposit.date', loc) + ' ' + reservation.reserved_date + '\n' +
      _label('deposit.time', loc) + ' ' + timeRange + '\n' +
      _label('deposit.treatment', loc) + ' ' + reservation.menu_type + '\n\n' +
      tf('change.field_select', null, loc);
  },

  getChangeConfirmMessage: function(reservation, field, newValue, locale) {
    var loc = locale || 'ja';
    var fieldLabel = {
      date: t('change.field.date', loc),
      time: t('change.field.time', loc),
      treatment: t('change.field.treatment', loc)
    }[field] || field;
    var currentValue = {
      date: reservation.reserved_date,
      time: _fmtTimeRange(reservation.reserved_start, reservation.reserved_end),
      treatment: reservation.menu_type
    }[field] || '';
    return tf('change.confirm', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservation.id + '\n\n' +
      _label('change.field_label', loc) + ' ' + fieldLabel + '\n' +
      _label('change.before', loc) + ' ' + currentValue + '\n' +
      _label('change.after', loc) + ' ' + newValue + '\n\n' +
      tf('cancel.yes_no', null, loc);
  },

  getChangeCompletedMessage: function(reservation, changeLabel, locale) {
    var loc = locale || 'ja';
    return tf('change.done', null, loc) + '\n\n' +
      _label('deposit.reservation_id', loc) + ' ' + reservation.id + '\n' +
      _label('deposit.date', loc) + ' ' + reservation.reserved_date + '\n' +
      _label('deposit.time', loc) + ' ' + _fmtTimeRange(reservation.reserved_start, reservation.reserved_end) + '\n' +
      _label('deposit.treatment', loc) + ' ' + reservation.menu_type + '\n\n' +
      tf('change.we_look_forward', null, loc);
  },

  getTreatmentAutoResponseMessage: function(estimatedEndTime, locale) {
    var loc = locale || 'ja';
    var text = t('treatment_auto.header', loc) + '\n';
    if (estimatedEndTime) {
      text += tf('treatment_auto.estimated_end', {endTime: estimatedEndTime}, loc) + '\n';
    }
    text += t('treatment_auto.will_contact', loc);
    return {
      text: text,
      quickReplies: [
        {label: t('treatment_auto.reserve_link', loc), text: t('welcome.reserve', loc)},
        {label: t('treatment_auto.contact', loc), text: t('treatment_auto.contact', loc)}
      ]
    };
  },

  getPostVisitFollowUpMessage: function(locale) {
    var loc = locale || 'ja';
    return {
      text: t('followup.title', loc) + '\n\n' + t('followup.next_booking', loc),
      quickReplies: [
        {label: t('welcome.reserve', loc), text: t('welcome.reserve', loc)},
        {label: t('followup.contact', loc), text: 'お問い合わせ'}
      ]
    };
  }
};
