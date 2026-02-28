/**
 * LINE Service - LINE Messaging API Integration
 *
 * Handles sending messages and managing LINE API calls
 */

var LINE_API_URL = 'https://api.line.me/v2/bot/message/reply';

/**
 * Send reply message to LINE
 */
function sendLineReply(replyToken, text) {
  var message = {
    type: 'text',
    text: text
  };

  return sendLineMessages(replyToken, [message]);
}

/**
 * Send multiple messages to LINE
 */
function sendLineMessages(replyToken, messages) {
  var accessToken = getLineAccessToken();

  var payload = {
    replyToken: replyToken,
    messages: messages
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(LINE_API_URL, options);

  if (response.getResponseCode() !== 200) {
    Logger.log('LINE API Error: ' + response.getContentText());
    return false;
  }

  return true;
}

/**
 * Send push message to LINE user
 */
function sendLinePush(userId, text) {
  var accessToken = getLineAccessToken();
  var url = 'https://api.line.me/v2/bot/message/push';

  var message = {
    type: 'text',
    text: text
  };

  var payload = {
    to: userId,
    messages: [message]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() !== 200) {
    Logger.log('LINE Push Error: ' + response.getContentText());
    return false;
  }

  return true;
}

/**
 * Get LINE user profile
 */
function getLineProfile(userId) {
  var accessToken = getLineAccessToken();
  var url = 'https://api.line.me/v2/bot/profile/' + userId;

  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() !== 200) {
    Logger.log('LINE Profile Error: ' + response.getContentText());
    return null;
  }

  return JSON.parse(response.getContentText());
}

/**
 * Create rich menu buttons
 */
function createRichMenu(label, text, action) {
  return {
    type: 'message',
    label: label,
    text: text
  };
}

/**
 * Send template message with buttons
 */
function sendTemplateMessage(replyToken, altText, template) {
  var message = {
    type: 'template',
    altText: altText,
    template: template
  };

  return sendLineMessages(replyToken, [message]);
}

/**
 * Send quick reply buttons
 */
function sendQuickReply(replyToken, text, quickReplies) {
  var message = {
    type: 'text',
    text: text,
    quickReply: {
      items: quickReplies.map(function(qr) {
        return {
          type: 'action',
          action: {
            type: 'message',
            label: qr.label,
            text: qr.text
          }
        };
      })
    }
  };

  return sendLineMessages(replyToken, [message]);
}

/**
 * Log LINE message for debugging
 */
function logLineMessage(source, message) {
  Logger.log('LINE Message from ' + source.userId + ': ' + message);
}
