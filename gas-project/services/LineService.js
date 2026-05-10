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
  var statusCode = response.getResponseCode();
  var responseBody = response.getContentText();

  if (statusCode !== 200) {
    appendLogRow('ERROR', '[LINE API] Reply failed - status: ' + statusCode + ', body: ' + responseBody.substring(0, 300));
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
  var statusCode = response.getResponseCode();
  var responseBody = response.getContentText();

  appendLogRow('INFO', '[LINE Push] userId: ' + userId.substring(0, 10) + '... status: ' + statusCode);

  if (statusCode !== 200) {
    appendLogRow('ERROR', '[LINE Push] Failed - status: ' + statusCode + ', body: ' + responseBody.substring(0, 300));
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
    appendLogRow('ERROR', '[LINE Profile] Error: ' + response.getContentText().substring(0, 300));
    return null;
  }

  return JSON.parse(response.getContentText());
}

/**
 * Create LINE Rich Menu structure via API
 * 2x2 grid: 予約する | 予約変更・キャンセル | 営業時間・アクセス | お問い合わせ
 */
function createLineRichMenu() {
  var accessToken = getLineAccessToken();
  var url = 'https://api.line.me/v2/bot/richmenu';

  var payload = {
    size: { width: 2500, height: 1686 },
    selected: false,
    name: 'reserve-bot-menu',
    chatBarText: 'メニュー',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: { type: 'message', text: '予約する' }
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: { type: 'message', text: '予約変更・キャンセル' }
      },
      {
        bounds: { x: 0, y: 843, width: 1250, height: 843 },
        action: { type: 'message', text: '営業時間・アクセス' }
      },
      {
        bounds: { x: 1250, y: 843, width: 1250, height: 843 },
        action: { type: 'message', text: 'お問い合わせ' }
      }
    ]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (statusCode !== 200) {
    appendLogRow('ERROR', '[RichMenu] Create failed: ' + statusCode + ' ' + response.getContentText().substring(0, 300));
    return null;
  }

  appendLogRow('INFO', '[RichMenu] Created: ' + body.richMenuId);
  return body.richMenuId;
}

/**
 * Upload image to LINE Rich Menu
 */
function uploadRichMenuImage(richMenuId, imageBlob) {
  var accessToken = getLineAccessToken();
  var url = 'https://api-data.line.me/v2/bot/richmenu/' + richMenuId + '/content';

  var options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'image/png'
    },
    payload: imageBlob,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    appendLogRow('ERROR', '[RichMenu] Image upload failed: ' + statusCode + ' ' + response.getContentText().substring(0, 300));
    return { ok: false, status: statusCode, body: response.getContentText().substring(0, 500) };
  }

  appendLogRow('INFO', '[RichMenu] Image uploaded to: ' + richMenuId);
  return { ok: true };
}

/**
 * Set default Rich Menu for all users
 */
function setDefaultRichMenu(richMenuId) {
  var accessToken = getLineAccessToken();
  var url = 'https://api.line.me/v2/bot/user/all/richmenu/' + richMenuId;

  var options = {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    appendLogRow('ERROR', '[RichMenu] Set default failed: ' + statusCode + ' ' + response.getContentText().substring(0, 300));
    return false;
  }

  appendLogRow('INFO', '[RichMenu] Set default: ' + richMenuId);
  return true;
}

/**
 * Get current default Rich Menu ID
 */
function getDefaultRichMenuId() {
  var accessToken = getLineAccessToken();
  var url = 'https://api.line.me/v2/bot/user/all/richmenu';

  var options = {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    appendLogRow('ERROR', '[RichMenu] Get default failed: ' + statusCode);
    return null;
  }

  var body = JSON.parse(response.getContentText());
  return body.richMenuId || null;
}

/**
 * Delete a LINE Rich Menu
 */
function deleteLineRichMenu(richMenuId) {
  var accessToken = getLineAccessToken();
  var url = 'https://api.line.me/v2/bot/richmenu/' + richMenuId;

  var options = {
    method: 'delete',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    appendLogRow('ERROR', '[RichMenu] Delete failed: ' + statusCode);
    return false;
  }

  appendLogRow('INFO', '[RichMenu] Deleted: ' + richMenuId);
  return true;
}

/**
 * One-shot Rich Menu setup: create → upload image → set default
 * @param {string} driveFileId - Google Drive file ID of the rich menu image (PNG)
 */
function setupRichMenu(driveFileId) {
  var file = DriveApp.getFileById(driveFileId);
  var imageBlob = file.getBlob();

  var oldMenuId = getDefaultRichMenuId();
  if (oldMenuId) {
    setDefaultRichMenu('');
    deleteLineRichMenu(oldMenuId);
  }

  var richMenuId = createLineRichMenu();
  if (!richMenuId) {
    return { ok: false, error: 'Failed to create rich menu' };
  }

  var uploaded = uploadRichMenuImage(richMenuId, imageBlob);
  if (!uploaded || !uploaded.ok) {
    deleteLineRichMenu(richMenuId);
    return { ok: false, error: 'Failed to upload image', detail: uploaded };
  }

  var setDefault = setDefaultRichMenu(richMenuId);
  if (!setDefault) {
    return { ok: false, error: 'Failed to set default' };
  }

  return {
    ok: true,
    richMenuId: richMenuId,
    message: 'Rich menu set up successfully'
  };
}

/**
 * Setup Rich Menu from base64 stored in ScriptProperties (key: RICHMENU_IMAGE_B64)
 * Called via gas-run.sh as allowedFunction (no args)
 */
function setupRichMenuFromProperty() {
  var b64 = PropertiesService.getScriptProperties().getProperty('RICHMENU_IMAGE_B64');
  if (!b64) {
    return { ok: false, error: 'RICHMENU_IMAGE_B64 not set in ScriptProperties' };
  }
  PropertiesService.getScriptProperties().deleteProperty('RICHMENU_IMAGE_B64');
  return setupRichMenuFromBase64(b64, 'line_rich_menu.png');
}

/**
 * Upload base64 image to Drive and setup Rich Menu in one shot
 * @param {string} base64Image - Base64 encoded PNG image data
 * @param {string} fileName - File name for Drive
 */
function setupRichMenuFromBase64(base64Image, fileName) {
  var decoded = Utilities.base64Decode(base64Image);
  var blob = Utilities.newBlob(decoded, 'image/png', fileName || 'rich_menu.png');
  appendLogRow('INFO', '[RichMenu] Decoded blob size: ' + blob.getBytes().length + ' bytes');

  var oldMenuId = getDefaultRichMenuId();
  if (oldMenuId) {
    setDefaultRichMenu('');
    deleteLineRichMenu(oldMenuId);
  }

  var richMenuId = createLineRichMenu();
  if (!richMenuId) {
    return { ok: false, error: 'Failed to create rich menu' };
  }

  var uploaded = uploadRichMenuImage(richMenuId, blob);
  if (!uploaded || !uploaded.ok) {
    deleteLineRichMenu(richMenuId);
    return { ok: false, error: 'Failed to upload image', detail: uploaded };
  }

  var setDefault = setDefaultRichMenu(richMenuId);
  if (!setDefault) {
    return { ok: false, error: 'Failed to set default' };
  }

  return {
    ok: true,
    richMenuId: richMenuId,
    message: 'Rich menu set up successfully'
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
 * Send push message with quick reply buttons
 */
function sendLinePushQuickReply(userId, text, quickReplies) {
  var accessToken = getLineAccessToken();
  var url = 'https://api.line.me/v2/bot/message/push';

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
  var statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    appendLogRow('ERROR', '[LINE Push QR] Failed - status: ' + statusCode + ', body: ' + response.getContentText().substring(0, 300));
    return false;
  }

  return true;
}

/**
 * Log LINE message for debugging
 */
function logLineMessage(source, message) {
  appendLogRow('DEBUG', '[LINE Message] from ' + source.userId + ': ' + message);
}
