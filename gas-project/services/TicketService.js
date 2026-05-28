/**
 * TicketService - 回数券パッケージ管理
 *
 * 5回券/10回券の販売・管理・消費を行う。
 * 予約時にアクティブなチケットがあればデポジット不要で自動確定。
 */

var TICKET_PACKAGES = {
  '5': { label: '5回券', sessions: 5, priceKey: 'TICKET_5_PRICE' },
  '10': { label: '10回券', sessions: 10, priceKey: 'TICKET_10_PRICE' }
};

var TICKET_STATUS = {
  ACTIVE: 'Active',
  EXHAUSTED: 'Exhausted',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled'
};

/**
 * Get ticket price by package type
 */
function getTicketPrice(packageType) {
  var key = TICKET_PACKAGES[packageType] ? TICKET_PACKAGES[packageType].priceKey : null;
  if (!key) return 0;
  return parseInt(getProperty(key, packageType === '5' ? '25000' : '45000'));
}

/**
 * Get ticket expiry days
 */
function getTicketExpiryDays() {
  return parseInt(getProperty('TICKET_EXPIRY_DAYS', '180'));
}

/**
 * Create ticket record (called after Stripe payment confirmed)
 */
function createTicket(ticketData) {
  var ticketId = 'TK' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();
  var now = new Date();
  var expiryDays = getTicketExpiryDays();
  var expiryDate = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
  var pkg = TICKET_PACKAGES[ticketData.package_type];

  var ticket = {
    ticket_id: ticketId,
    created_at: now.toISOString(),
    line_user_id: ticketData.line_user_id || '',
    package_type: ticketData.package_type,
    total_sessions: pkg ? pkg.sessions : parseInt(ticketData.total_sessions) || 0,
    remaining_sessions: pkg ? pkg.sessions : parseInt(ticketData.total_sessions) || 0,
    expiry_date: Utilities.formatDate(expiryDate, 'Asia/Tokyo', 'yyyy/MM/dd'),
    status: TICKET_STATUS.ACTIVE,
    stripe_session_id: ticketData.stripe_session_id || '',
    stripe_payment_intent: ticketData.stripe_payment_intent || '',
    notes: ticketData.notes || ''
  };

  if (isFirebaseConfigured()) {
    fsSet('tickets', ticketId, ticket);
  } else {
    var sheet = getTicketsSheet();
    sheet.appendRow([
      ticketId, now, ticket.line_user_id, ticket.package_type,
      ticket.total_sessions, ticket.remaining_sessions, expiryDate,
      ticket.status, ticket.stripe_session_id, ticket.stripe_payment_intent, ticket.notes
    ]);
  }

  appendLogRow('INFO', 'Ticket created: ' + ticketId + ' package=' + ticket.package_type);
  return ticket;
}

/**
 * Get active ticket for a LINE user
 */
function getActiveTicketByUser(lineUserId) {
  var tickets = _getAllTickets();
  for (var i = 0; i < tickets.length; i++) {
    if (tickets[i].line_user_id === lineUserId && tickets[i].status === TICKET_STATUS.ACTIVE) {
      return tickets[i];
    }
  }
  return null;
}

/**
 * Get ticket by ID
 */
function getTicketById(ticketId) {
  var tickets = _getAllTickets();
  for (var i = 0; i < tickets.length; i++) {
    if (tickets[i].ticket_id === ticketId) return tickets[i];
  }
  return null;
}

/**
 * Deduct one session from ticket (called when reservation is created with ticket)
 */
function deductSession(ticketId) {
  var ticket = getTicketById(ticketId);
  if (!ticket) return false;

  var remaining = ticket.remaining_sessions - 1;
  var newStatus = remaining <= 0 ? TICKET_STATUS.EXHAUSTED : ticket.status;
  _updateTicket(ticketId, { remaining_sessions: remaining, status: newStatus });

  appendLogRow('INFO', 'Ticket session deducted: ' + ticketId + ' remaining=' + remaining);
  return true;
}

/**
 * Refund one session to ticket (called when reservation is cancelled)
 */
function refundSession(ticketId) {
  var ticket = getTicketById(ticketId);
  if (!ticket) return false;

  var remaining = Math.min(ticket.remaining_sessions + 1, ticket.total_sessions);
  var newStatus = ticket.status === TICKET_STATUS.EXHAUSTED ? TICKET_STATUS.ACTIVE : ticket.status;
  _updateTicket(ticketId, { remaining_sessions: remaining, status: newStatus });

  appendLogRow('INFO', 'Ticket session refunded: ' + ticketId + ' remaining=' + remaining);
  return true;
}

/**
 * Check and expire tickets past their expiry date (trigger: daily)
 */
function checkExpiredTickets() {
  var tickets = _getAllTickets();
  var now = new Date();
  var expiredCount = 0;

  for (var i = 0; i < tickets.length; i++) {
    var t = tickets[i];
    if (t.status !== TICKET_STATUS.ACTIVE) continue;
    if (!t.expiry_date) continue;

    var expParts = t.expiry_date.split('/');
    var expDate = new Date(parseInt(expParts[0]), parseInt(expParts[1]) - 1, parseInt(expParts[2]));
    if (now > expDate) {
      _updateTicket(t.ticket_id, { status: TICKET_STATUS.EXPIRED });
      expiredCount++;
      appendLogRow('INFO', 'Ticket expired: ' + t.ticket_id);
    }
  }

  if (expiredCount > 0) {
    appendLogRow('INFO', 'Expired tickets: ' + expiredCount);
  }
}

/**
 * Get session count for user (remaining on active ticket)
 */
function getSessionCountForUser(lineUserId) {
  var ticket = getActiveTicketByUser(lineUserId);
  if (!ticket) return 0;
  return ticket.remaining_sessions;
}

/**
 * Get ticket status message
 */
function getTicketStatusMessage(ticketId, locale) {
  var loc = locale || 'ja';
  var ticket = getTicketById(ticketId);
  if (!ticket) return t('ticket.not_found', loc);

  var pkg = TICKET_PACKAGES[ticket.package_type];
  var label = pkg ? pkg.label : ticket.package_type;
  return tf('ticket.status_detail', {
    id: ticket.ticket_id,
    package: label,
    remaining: String(ticket.remaining_sessions),
    total: String(ticket.total_sessions),
    expiry: ticket.expiry_date,
    status: ticket.status
  }, loc);
}

// --- Internal helpers ---

function _getAllTickets() {
  if (isFirebaseConfigured()) {
    return fsGetCollection('tickets');
  }

  var sheet = getTicketsSheet();
  var data = sheet.getDataRange().getValues();
  var tickets = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    tickets.push(_buildTicketObj(row));
  }
  return tickets;
}

function _buildTicketObj(row) {
  return {
    ticket_id: row[0],
    created_at: row[1],
    line_user_id: row[2],
    package_type: String(row[3]),
    total_sessions: parseInt(row[4]) || 0,
    remaining_sessions: parseInt(row[5]) || 0,
    expiry_date: formatDateObj(row[6]),
    status: row[7],
    stripe_session_id: row[8] || '',
    stripe_payment_intent: row[9] || '',
    notes: row[10] || ''
  };
}

function _updateTicket(ticketId, updates) {
  if (isFirebaseConfigured()) {
    fsUpdate('tickets', ticketId, updates);
    return;
  }

  var sheet = getTicketsSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === ticketId) {
      var colOffset = 0;
      for (var key in updates) {
        var colIdx = _ticketColumnIndex(key);
        if (colIdx >= 0) {
          sheet.getRange(i + 1, colIdx + 1).setValue(updates[key]);
        }
      }
      return;
    }
  }
}

function _ticketColumnIndex(key) {
  var map = {
    remaining_sessions: 5,
    status: 7,
    notes: 10
  };
  return map[key] !== undefined ? map[key] : -1;
}
