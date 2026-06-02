/**
 * AI Chat Service - GLM (Z.AI) Integration
 *
 * Routes unrecognized user input to GLM-4.7 for clinic-related Q&A.
 * Uses Z.AI's Anthropic-compatible Messages API.
 * Guardrails: system prompt restricts to clinic topics, scope detection
 * rejects off-topic input before API call.
 *
 * Previously used MiniMax — switched to GLM for more accurate Japanese output.
 */

var GLM_API_URL = 'https://api.z.ai/api/anthropic/v1/messages';
var GLM_MODEL = 'GLM-4.7';

/** AIチャットログシート名 */
var AI_LOG_SHEET_NAME = 'AI_Chat_Log';

/**
 * System prompt for clinic-only topic restriction + context injection
 */
function getAISystemPrompt() {
  var hours = getBusinessHours() || 'お問い合わせください';
  var address = getBusinessAddress() || 'お問い合わせください';
  var phone = getContactPhone() || '';
  var cancelDeadline = getCancellationDeadlineHours();

  var prompt = 'あなたはディズ院の受付アシスタントです。' +
    '以下の範囲内の質問にのみ丁寧に日本語で答えてください。\n\n' +
    '【対応範囲】\n' +
    '・蒸し灸内容（マッサージ、整体、柔道等）に関する説明\n' +
    '・予約方法の案内\n' +
    '・営業時間・アクセス・電話番号\n' +
    '・キャンセル・変更ポリシー\n' +
    '・初診・再診の違い\n' +
    '・料金の一般的な案内\n' +
    '・来院時の注意事項（服装、持参物など）\n\n' +
    '【対応外の場合】\n' +
    'ディズ院と無関係な質問には「ディズ院に関するご質問をお願いします。」と返答してください。\n\n' +
    '【施設情報】\n' +
    '営業時間: ' + hours + '\n' +
    'アクセス: ' + address + '\n';

  if (phone) {
    prompt += '電話番号: ' + phone + '\n';
  }

  prompt += 'キャンセル: 予約の' + cancelDeadline + '時間前まで無料\n' +
    '予約方法: LINEで「予約する」をタップ\n' +
    '回答は3〜5文程度で簡潔に。医学的診断は行わないこと。';

  return prompt;
}

/**
 * Quick scope check — reject obviously off-topic input before API call
 * Returns true if the input might be clinic-related
 */
function isClinicRelatedInput(text) {
  var clinicKeywords = [
    '予約', '蒸し灸', 'マッサージ', '整体', '柔道', 'きり', 'きり', 'きゅう', '灸',
    '肩', '腰', '首', '背中', '膝', 'ひざ', '足', '腕', '手',
    '痛い', '痛み', 'こり', '凝り', 'しびれ', '痺れ', 'だるい',
    '整体', '整骨', '接骨', 'カイロ', '<delete_file>',
    '時間', '営業', 'アクセス', '住所', '電話', '料金', '初診', '再診',
    'キャンセル', '変更', '何時', 'いつ', 'いくら', '円',
    '今日', '明日', '空き', '枠', '診察', '治療', '怪我', 'キズ',
    '交通事故', 'むちうち', 'ねんざ', '捻挫', '骨折',
    '保険', '健康保険', '労務者', '自賠責',
    '服', '服装', '着替え', 'タオル', '持参',
    '駐車', '駐輪', '駅', '近く'
  ];

  var lowerText = text.toLowerCase();
  for (var i = 0; i < clinicKeywords.length; i++) {
    if (lowerText.indexOf(clinicKeywords[i]) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * AIチャットログをスプレッドシートの専用シートに記録
 * 時系列で完全保存（文字数制限なし）
 * @param {string} userMessage - ユーザーの質問（全文）
 * @param {string} aiResponse - AIの応答（全文）
 * @param {string} status - success / error / fallback
 * @param {number} latencyMs - 応答時間（ミリ秒）
 * @param {string} errorDetail - エラー時詳細（空文字ならなし）
 */
function logAIChat(userMessage, aiResponse, status, latencyMs, errorDetail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AI_LOG_SHEET_NAME);

    // シートがなければ作成してヘッダーも追加
    if (!sheet) {
      sheet = ss.insertSheet(AI_LOG_SHEET_NAME);
      sheet.appendRow([
        'タイムスタンプ',
        'ステータス',
        'モデル',
        '応答時間(ms)',
        'ユーザーの質問',
        'AIの応答',
        'エラーの詳細'
      ]);
      // ヘッダー行を太字に
      var headerRange = sheet.getRange(1, 1, 1, 7);
      headerRange.setFontWeight('bold');
      // 折り返し設定
      sheet.getRange('A:A').setNumberFormat('yyyy/MM/dd HH:mm:ss');
      sheet.getRange('E:G').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    }

    // 1行追加（全文記録）
    sheet.appendRow([
      new Date(),
      status,
      GLM_MODEL,
      latencyMs,
      userMessage,
      aiResponse,
      errorDetail || ''
    ]);

    appendLogRow('INFO', '[AIService] Chat logged: ' + userMessage.substring(0, 50) + '... | status=' + status);
  } catch (e) {
    appendLogRow('ERROR', '[AIService] Failed to log AI chat: ' + e.message);
  }
}

/**
 * Call GLM API (Z.AI Anthropic-compatible) and get response
 * @param {string} userMessage - User's text input
 * @returns {string|null} AI response text, or null on failure
 */
function callAIAPI(userMessage) {
  var apiKey = getProperty('GLM_API_KEY');
  if (!apiKey) {
    appendLogRow('ERROR', '[AIService] GLM API key not set');
    logAIChat(userMessage, '', 'error', 0, 'GLM_API_KEY not set');
    return null;
  }

  var systemPrompt = getAISystemPrompt();
  var startTime = Date.now();

  var payload = {
    model: GLM_MODEL,
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(GLM_API_URL, options);
    var latencyMs = Date.now() - startTime;
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    if (responseCode !== 200) {
      var errMsg = 'HTTP ' + responseCode + ': ' + responseBody.substring(0, 300);
      appendLogRow('ERROR', '[AIService] GLM API error: ' + errMsg);
      logAIChat(userMessage, '', 'error', latencyMs, errMsg);
      return null;
    }

    var json = JSON.parse(responseBody);

    // Anthropic Messages format: content[].text
    if (json.content && json.content.length > 0) {
      for (var i = 0; i < json.content.length; i++) {
        if (json.content[i].type === 'text') {
          var aiText = json.content[i].text.trim();
          // 全文をログシートに記録
          logAIChat(userMessage, aiText, 'success', latencyMs, '');
          return aiText;
        }
      }
    }

    var formatErr = 'Unexpected response format: ' + responseBody.substring(0, 300);
    appendLogRow('ERROR', '[AIService] ' + formatErr);
    logAIChat(userMessage, '', 'error', latencyMs, formatErr);
    return null;
  } catch (e) {
    var latencyMsErr = Date.now() - startTime;
    appendLogRow('ERROR', '[AIService] Exception: ' + e.message);
    logAIChat(userMessage, '', 'error', latencyMsErr, e.message);
    return null;
  }
}

/**
 * Handle unrecognized user input with LLM
 * Returns true if LLM handled the message, false if it should fall through
 */
function handleLLMQuery(replyToken, text) {
  var aiResponse = callAIAPI(text);

  if (aiResponse) {
    sendQuickReply(replyToken, aiResponse, [
      { label: '予約する', text: '予約する' },
      { label: 'お問い合わせ', text: 'お問い合わせ' }
    ]);
    return true;
  }

  return false;
}