/**
 * CRM Service - Customer Relationship Management (minimal)
 *
 * Manages customer tags, post-visit followup, and external CRM webhook.
 * Firestore-first with Sheet fallback.
 */

// Per-execution cache
var _customerCache = null;
var _customerByPhoneMap = null;

/**
 * Ensure customer cache is loaded
 */
function _ensureCustomerCache() {
  if (_customerCache !== null) return;
  _customerCache = [];
  _customerByPhoneMap = {};

  if (isFirebaseConfigured()) {
    try {
      var docs = fsGetCollection('customers');
      for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        if (!doc.customer_id) continue;
        var customer = {
          customer_id: doc.customer_id,
          phone: doc.phone || doc.customer_id,
          line_user_id: doc.line_user_id || '',
          name: doc.name || '',
          visit_count: parseInt(doc.visit_count) || 0,
          no_show_count: parseInt(doc.no_show_count) || 0,
          last_visit: doc.last_visit || '',
          tags: doc.tags || 'new',
          notes: doc.notes || ''
        };
        _customerCache.push(customer);
        _customerByPhoneMap[customer.phone] = customer;
      }
      return;
    } catch (e) {
      appendLogRow('WARN', 'Firestore customer load failed, falling back to Sheet: ' + e.message);
    }
  }

  // Sheet fallback
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var customer = _buildCustomer(row);
    _customerCache.push(customer);
    _customerByPhoneMap[customer.phone] = customer;
  }
}

/**
 * Invalidate customer cache (call after mutations)
 */
function _invalidateCustomerCache() {
  _customerCache = null;
  _customerByPhoneMap = null;
}

/**
 * Build customer object from sheet row
 */
function _buildCustomer(row) {
  return {
    customer_id: row[0],
    phone: row[1],
    line_user_id: row[2],
    name: row[3],
    visit_count: parseInt(row[4]) || 0,
    no_show_count: parseInt(row[5]) || 0,
    last_visit: row[6],
    tags: row[7] || '',
    notes: row[8] || ''
  };
}

/**
 * Get or create customer by phone number
 *
 * NOTE: phone は顧客の照合キー（lookup key）。永続識別子は戻り値の
 * customer_id（UUID）。主キー（Firestore doc id / Sheet 行キー）はUUID。
 */
function getOrCreateCustomer(phone, name, lineUserId) {
  _ensureCustomerCache();

  var existing = _customerByPhoneMap[phone];
  if (existing) {
    var updated = false;
    if (name && !existing.name) { existing.name = name; updated = true; }
    if (lineUserId && !existing.line_user_id) { existing.line_user_id = lineUserId; updated = true; }
    if (updated) _updateCustomerRow(existing);
    return existing;
  }

  var uuid = Utilities.getUuid();
  if (!/^[a-f0-9-]{36}$/.test(uuid)) {
    throw new Error('Invalid UUID generated for customer_id: ' + uuid);
  }
  var customer = {
    customer_id: uuid,
    phone: phone,
    line_user_id: lineUserId || '',
    name: name || '',
    visit_count: 0,
    no_show_count: 0,
    last_visit: '',
    tags: 'new',
    notes: ''
  };

  _appendCustomerRow(customer);
  _invalidateCustomerCache();
  return customer;
}

/**
 * Get customer by phone (照合キー). 戻り値の customer_id（UUID）が永続識別子。
 */
function getCustomerByPhone(phone) {
  _ensureCustomerCache();
  return _customerByPhoneMap[phone] || null;
}

/**
 * Increment visit count and update tags. phone は照合キー（顧客特定は customer_id=UUID）。
 */
function incrementVisitCount(phone) {
  var customer = getOrCreateCustomer(phone);
  customer.visit_count++;
  customer.last_visit = new Date().toISOString().split('T')[0];

  _updateTags(customer);
  _updateCustomerRow(customer);

  _fireCrmWebhook('customer.tag_changed', {
    customer_id: customer.customer_id,
    tags: customer.tags,
    visit_count: customer.visit_count
  });

  return customer;
}

/**
 * Increment no-show count and update tags. phone は照合キー（顧客特定は customer_id=UUID）。
 */
function incrementNoShowCount(phone) {
  var customer = getOrCreateCustomer(phone);
  customer.no_show_count++;

  _updateTags(customer);
  _updateCustomerRow(customer);

  _fireCrmWebhook('customer.tag_changed', {
    customer_id: customer.customer_id,
    tags: customer.tags,
    no_show_count: customer.no_show_count
  });

  return customer;
}

/**
 * Update tags based on visit/no-show counts
 */
function _updateTags(customer) {
  var tags = [];

  if (customer.visit_count >= CRM_TAG_THRESHOLDS.VIP) {
    tags.push('vip');
  } else if (customer.visit_count >= CRM_TAG_THRESHOLDS.REGULAR) {
    tags.push('regular');
  } else {
    tags.push('new');
  }

  if (customer.no_show_count >= CRM_TAG_THRESHOLDS.NO_SHOW_WARN) {
    tags.push('no_show_warn');
  }

  customer.tags = tags.join(',');
}

/**
 * Get tag display label (localized)
 */
function getCustomerTagLabels(tags, locale) {
  if (!tags) return '';
  var parts = tags.split(',');
  var labels = [];
  for (var i = 0; i < parts.length; i++) {
    var tag = parts[i].trim();
    var key = 'crm.tag.' + tag;
    labels.push(t(key, locale) !== key ? t(key, locale) : tag);
  }
  return labels.join(', ');
}

/**
 * Send post-visit followup message
 */
function sendFollowupMessage(lineUserId, locale) {
  if (!lineUserId || lineUserId === 'WEB') return;

  var loc = locale || 'ja';
  var msg = tf('crm.followup.title', null, loc) + '\n\n' +
    tf('crm.followup.next_booking', null, loc) + '\n' +
    tf('crm.followup.feedback', null, loc);

  sendLinePush(lineUserId, msg);
  appendLogRow('INFO', 'CRM followup sent to: ' + lineUserId);
}

/**
 * Check for recently visited reservations and send followups
 */
function processFollowups(minutesAgo) {
  var sent = 0;

  try {
    _ensureReservationCache();
  } catch (e) {
    appendLogRow('ERROR', 'processFollowups cache load error: ' + e.message);
    return 0;
  }

  if (!_reservationCache) return 0;
  for (var i = 0; i < _reservationCache.length; i++) {
    var r = _reservationCache[i];
    if (r.status !== RESERVATION_STATUS.VISITED) continue;
    if (r.notes && r.notes.indexOf('followup_sent') >= 0) continue;

    var reservedDate = r.reserved_date;
    if (!reservedDate) continue;
    var today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd');
    if (reservedDate !== today) continue;

    var loc = getUserLocale(r.line_display_name);
    sendFollowupMessage(r.line_display_name, loc);

    var newNotes = (r.notes || '') + ',followup_sent';
    updateReservation(r.id, { notes: newNotes });
    sent++;
  }

  if (sent > 0) {
    appendLogRow('INFO', 'CRM followups sent: ' + sent);
  }
  return sent;
}

/**
 * Fire external CRM webhook (fire-and-forget)
 */
function _fireCrmWebhook(eventType, data) {
  var webhookUrl = getProperty('CRM_WEBHOOK_URL');
  if (!webhookUrl) return;

  var payload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: data
  };

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    appendLogRow('INFO', 'CRM webhook fired: ' + eventType);
  } catch (e) {
    appendLogRow('WARN', 'CRM webhook failed: ' + e.message);
  }
}

/**
 * Append customer row (Firestore or Sheet)
 */
function _appendCustomerRow(customer) {
  if (isFirebaseConfigured()) {
    fsSet('customers', customer.customer_id, customer);
    return;
  }
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.CUSTOMERS);
    sheet.appendRow(CUSTOMERS_HEADERS);
  }
  sheet.appendRow([
    customer.customer_id, customer.phone, customer.line_user_id,
    customer.name, customer.visit_count, customer.no_show_count,
    customer.last_visit, customer.tags, customer.notes
  ]);
}

/**
 * Update customer row (Firestore or Sheet)
 */
function _updateCustomerRow(customer) {
  if (isFirebaseConfigured()) {
    fsUpdate('customers', customer.customer_id, {
      phone: customer.phone,
      line_user_id: customer.line_user_id,
      name: customer.name,
      visit_count: customer.visit_count,
      no_show_count: customer.no_show_count,
      last_visit: customer.last_visit,
      tags: customer.tags,
      notes: customer.notes
    });
    return;
  }
  var ss = _getCachedSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === customer.customer_id) {
      sheet.getRange(i + 1, 1, 1, CUSTOMERS_HEADERS.length).setValues([[
        customer.customer_id, customer.phone, customer.line_user_id,
        customer.name, customer.visit_count, customer.no_show_count,
        customer.last_visit, customer.tags, customer.notes
      ]]);
      return;
    }
  }
}
