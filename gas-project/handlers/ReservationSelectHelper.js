/**
 * Reservation Select Helper
 *
 * Shared utilities for paginated reservation list display and selection
 * used by CancelHandler and ChangeHandler.
 */

/**
 * Show paginated reservation list with quick reply items
 * @param {string} replyToken - LINE reply token
 * @param {string} userId - LINE user ID
 * {function} listMessageFn - MessageTemplates function for list message
 * @param {string} awaitingState - USER_STATES constant to set
 */
function _showPaginatedReservationList(replyToken, userId, reservations, listMessageFn, awaitingState) {
  var allIds = reservations.map(function(r) { return r.id; });
  var pageSize = PAGE_SIZE;
  var pageReservations = reservations.slice(0, pageSize);

  setUserState(userId, awaitingState, {
    reservation_ids: allIds,
    page: 0,
    page_size: pageSize
  });

  var msg = listMessageFn(pageReservations, 0, Math.ceil(allIds.length / pageSize));
  var items = _buildPageItems(pageReservations.length, allIds.length, pageSize, 0);
  sendQuickReply(replyToken, msg, items);
}

/**
 * Build quick reply items for a page of reservations
 */
function _buildPageItems(pageCount, totalCount, pageSize, currentPage) {
  var items = [];
  for (var i = 0; i < pageCount; i++) {
    items.push({ label: String(i + 1), text: String(i + 1) });
  }
  if (totalCount > pageSize * (currentPage + 1)) {
    var totalP = Math.ceil(totalCount / pageSize);
    items.push({ label: '次の5件 ▶ (' + (currentPage + 2) + '/' + totalP + ')', text: '次の5件' });
  }
  items.push({ label: 'やめる', text: 'やめる' });
  return items;
}

/**
 * Handle user selection from paginated reservation list
 * Returns { handled: true } if the input was processed (pagination/cancel/error),
 * or { handled: false, selectedId: string } if a valid selection was made.
 */
function _handleReservationSelection(text, replyToken, userId, tempData, listMessageFn, awaitingState) {
  var reservationIds = tempData.reservation_ids || [];
  var page = tempData.page || 0;
  var pageSize = tempData.page_size || PAGE_SIZE;

  if (text === 'やめる') {
    return { handled: true, action: 'cancel' };
  }

  // Handle pagination
  if (handlePaginationStep(text, replyToken, userId, tempData, reservationIds, page, pageSize,
      listMessageFn, awaitingState)) {
    return { handled: true, action: 'paginated' };
  }

  var selection = parseInt(text);
  var currentStartIdx = page * pageSize;

  if (isNaN(selection) || selection < 1 || selection > pageSize || (currentStartIdx + selection - 1) >= reservationIds.length) {
    var maxOnPage = Math.min(pageSize, reservationIds.length - currentStartIdx);
    var errorItems = _buildPageItems(maxOnPage, reservationIds.length, pageSize, page);
    sendQuickReply(replyToken, '番号を選択してください（1〜' + maxOnPage + '）。', errorItems);
    return { handled: true, action: 'invalid' };
  }

  var selectedId = reservationIds[currentStartIdx + selection - 1];
  var reservation = getReservationById(selectedId);

  if (!reservation) {
    return { handled: true, action: 'not_found' };
  }

  return { handled: false, selectedId: selectedId, reservation: reservation };
}
