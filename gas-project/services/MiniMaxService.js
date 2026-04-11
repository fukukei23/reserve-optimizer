/**
 * MiniMax LLM Service - AI Chat Integration
 *
 * Routes unrecognized user input to MiniMax M2.7 for clinic-related Q&A.
 * Guardrails: system prompt restricts to clinic topics, scope detection
 * rejects off-topic input before API call.
 */

var MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
var MINIMAX_MODEL = 'M2.7';

/**
 * System prompt for clinic-only topic restriction + context injection
 */
function getMiniMaxSystemPrompt() {
  var hours = getBusinessHours() || 'お問い合わせください';
  var address = getBusinessAddress() || 'お問い合わせください';
  var phone = getContactPhone() || '';
  var leadTime = getBookingLeadTimeMinutes();
  var cancelDeadline = getCancellationDeadlineHours();

  var prompt = 'あなたは整骨院の受付アシスタントです。' +
    '以下の範囲内の質問にのみ丁寧に日本語で答えてください。\n\n' +
    '【対応範囲】\n' +
    '・施術内容（マッサージ、整体、鍼など）に関する説明\n' +
    '・予約方法の案内\n' +
    '・営業時間・アクセス・電話番号\n' +
    '・キャンセル・変更ポリシー\n' +
    '・初診・再診の違い\n' +
    '・料金の一般的な案内\n' +
    '・来院時の注意事項（服装、持参物など）\n\n' +
    '【対応外の場合】\n' +
    '整骨院と無関係な質問には「整骨院に関するご質問をお願いします。」と返答してください。\n\n' +
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
    '予約', '施術', 'マッサージ', '整体', '鍼', 'はり', 'きゅう', '灸',
    '肩', '腰', '首', '背中', '膝', 'ひざ', '足', '腕', '手',
    '痛い', '痛み', 'こり', '凝り', 'しびれ', '痺れ', 'だるい',
    '整体', '整骨', '接骨', 'カイロ', 'リハビリ',
    '時間', '営業', 'アクセス', '住所', '電話', '料金', '初診', '再診',
    'キャンセル', '変更', '何時', 'いつ', 'いくら', '円',
    '今日', '明日', '空き', '枠', '診察', '治療', '怪我', 'ケガ',
    '交通事故', 'むちうち', 'ねんざ', '捻挫', '骨折',
    '保険', '健康保険', '労災', '自賠責',
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
 * Call MiniMax API and get response
 * @param {string} userMessage - User's text input
 * @returns {string|null} AI response text, or null on failure
 */
function callMiniMaxAPI(userMessage) {
  var apiKey = getProperty('MINIMAX_API_KEY');
  if (!apiKey) {
    console.error('[MiniMaxService] API key not set');
    return null;
  }

  var systemPrompt = getMiniMaxSystemPrompt();

  var payload = {
    model: MINIMAX_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 300
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(MINIMAX_API_URL, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    if (responseCode !== 200) {
      console.error('[MiniMaxService] API error: ' + responseCode + ' ' + responseBody.substring(0, 200));
      return null;
    }

    var json = JSON.parse(responseBody);

    // MiniMax API response format (OpenAI-compatible)
    if (json.choices && json.choices.length > 0 && json.choices[0].message) {
      return json.choices[0].message.content.trim();
    }

    // Fallback: check alternative response structures
    if (json.reply) {
      return json.reply.trim();
    }

    console.error('[MiniMaxService] Unexpected response format: ' + responseBody.substring(0, 200));
    return null;
  } catch (e) {
    console.error('[MiniMaxService] Exception: ' + e.message);
    return null;
  }
}

/**
 * Handle unrecognized user input with LLM
 * Returns true if LLM handled the message, false if it should fall through
 */
function handleLLMQuery(replyToken, text) {
  // Scope check — skip API call for obviously unrelated input
  if (!isClinicRelatedInput(text)) {
    return false;
  }

  var aiResponse = callMiniMaxAPI(text);

  if (aiResponse) {
    sendQuickReply(replyToken, aiResponse, [
      { label: '予約する', text: '予約する' },
      { label: 'お問い合わせ', text: 'お問い合わせ' }
    ]);
    return true;
  }

  // API failed — fall through to default welcome message
  return false;
}
