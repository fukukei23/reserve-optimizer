/**
 * State Handler
 *
 * Manages conversation state and temporary data for LINE users
 */

// Conversation states
var USER_STATES = {
  IDLE: 'IDLE',
  AWAITING_NAME: 'AWAITING_NAME',
  AWAITING_PHONE: 'AWAITING_PHONE',
  AWAITING_DATE: 'AWAITING_DATE',
  AWAITING_TIME: 'AWAITING_TIME',
  AWAITING_TREATMENT: 'AWAITING_TREATMENT',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  AWAITING_CANCEL_SELECT: 'AWAITING_CANCEL_SELECT',
  AWAITING_CANCEL_CONFIRM: 'AWAITING_CANCEL_CONFIRM',
  AWAITING_CHANGE_SELECT: 'AWAITING_CHANGE_SELECT',
  AWAITING_CHANGE_FIELD: 'AWAITING_CHANGE_FIELD',
  AWAITING_CHANGE_DATE: 'AWAITING_CHANGE_DATE',
  AWAITING_CHANGE_TIME: 'AWAITING_CHANGE_TIME',
  AWAITING_CHANGE_TREATMENT: 'AWAITING_CHANGE_TREATMENT',
  AWAITING_CHANGE_CONFIRM: 'AWAITING_CHANGE_CONFIRM',
  AWAITING_WAITLIST_TIME: 'AWAITING_WAITLIST_TIME'
};

// Temporary data storage key prefix (24-hour TTL)
var TEMP_DATA_KEY_PREFIX = 'user_temp_';

/**
 * Set user state with temporary data
 */
function setUserState(userId, state, context) {
  var key = TEMP_DATA_KEY_PREFIX + userId;
  var data = {
    state: state,
    context: context || {},
    timestamp: Date.now()
  };

  PropertiesService.getUserProperties().setProperty(key, JSON.stringify(data));
}

/**
 * Get user state
 */
function getUserState(userId) {
  var key = TEMP_DATA_KEY_PREFIX + userId;
  var data = PropertiesService.getUserProperties().getProperty(key);

  if (!data) {
    return {state: USER_STATES.IDLE, context: {}};
  }

  var parsed = JSON.parse(data);

  // Check TTL (24 hours)
  if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
    clearUserState(userId);
    return {state: USER_STATES.IDLE, context: {}};
  }

  return parsed;
}

/**
 * Clear user state
 */
function clearUserState(userId) {
  var key = TEMP_DATA_KEY_PREFIX + userId;
  PropertiesService.getUserProperties().deleteProperty(key);
}

/**
 * Clean up expired user states (call from scheduled trigger)
 * Scans all user properties and removes entries older than 24 hours
 */
function cleanupExpiredStates() {
  var props = PropertiesService.getUserProperties();
  var allProps = props.getProperties();
  var now = Date.now();
  var ttlMs = 24 * 60 * 60 * 1000;
  var removed = 0;

  for (var key in allProps) {
    if (key.indexOf(TEMP_DATA_KEY_PREFIX) !== 0) continue;
    try {
      var data = JSON.parse(allProps[key]);
      if (data.timestamp && (now - data.timestamp > ttlMs)) {
        props.deleteProperty(key);
        removed++;
      }
    } catch (e) {
      // Malformed entry — remove it
      props.deleteProperty(key);
      removed++;
    }
  }

  appendLogRow('INFO', 'cleanupExpiredStates: removed ' + removed + ' expired states');
}
