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
  AWAITING_STAFF: 'AWAITING_STAFF',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  AWAITING_CANCEL_SELECT: 'AWAITING_CANCEL_SELECT',
  AWAITING_CANCEL_CONFIRM: 'AWAITING_CANCEL_CONFIRM',
  AWAITING_CHANGE_SELECT: 'AWAITING_CHANGE_SELECT',
  AWAITING_CHANGE_FIELD: 'AWAITING_CHANGE_FIELD',
  AWAITING_CHANGE_DATE: 'AWAITING_CHANGE_DATE',
  AWAITING_CHANGE_TIME: 'AWAITING_CHANGE_TIME',
  AWAITING_CHANGE_TREATMENT: 'AWAITING_CHANGE_TREATMENT',
  AWAITING_CHANGE_CONFIRM: 'AWAITING_CHANGE_CONFIRM',
  AWAITING_WAITLIST_TIME: 'AWAITING_WAITLIST_TIME',
  AWAITING_TICKET_SELECT: 'AWAITING_TICKET_SELECT'
};

// Temporary data storage key prefix (24-hour TTL)
var TEMP_DATA_KEY_PREFIX = 'user_temp_';
// CacheService TTL for user state (6 hours — auto-expire reduces cleanup need)
var USER_STATE_CACHE_TTL = 21600;

/**
 * Set user state with temporary data
 * Primary: CacheService (fast, auto-TTL). Fallback: PropertiesService (persistent across eviction).
 */
function setUserState(userId, state, context) {
  var key = TEMP_DATA_KEY_PREFIX + userId;
  var data = {
    state: state,
    context: context || {},
    timestamp: Date.now()
  };
  var json = JSON.stringify(data);

  var cache = CacheService.getUserCache();
  cache.put(key, json, USER_STATE_CACHE_TTL);

  PropertiesService.getUserProperties().setProperty(key, json);
}

/**
 * Get user state
 * Check CacheService first, then fallback to PropertiesService.
 */
function getUserState(userId) {
  var key = TEMP_DATA_KEY_PREFIX + userId;

  var cache = CacheService.getUserCache();
  var data = cache.get(key);

  if (!data) {
    data = PropertiesService.getUserProperties().getProperty(key);
    if (data) {
      cache.put(key, data, USER_STATE_CACHE_TTL);
    }
  }

  if (!data) {
    return {state: USER_STATES.IDLE, context: {}};
  }

  var parsed = JSON.parse(data);

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

  CacheService.getUserCache().remove(key);
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

// --- User Preferences ---

var PREFS_KEY_PREFIX = 'user_prefs_';

var USER_PREFS_DEFAULTS = {
  language: 'ja',
  reminder_timing: '08:00'
};

/**
 * Get user preference value
 */
function getUserPref(userId, key) {
  var props = PropertiesService.getUserProperties();
  var allPrefs = props.getProperty(PREFS_KEY_PREFIX + userId);
  if (!allPrefs) return USER_PREFS_DEFAULTS[key] || null;
  try {
    var parsed = JSON.parse(allPrefs);
    return parsed[key] !== undefined ? parsed[key] : (USER_PREFS_DEFAULTS[key] || null);
  } catch (e) {
    return USER_PREFS_DEFAULTS[key] || null;
  }
}

/**
 * Set user preference value
 */
function setUserPref(userId, key, value) {
  var props = PropertiesService.getUserProperties();
  var allPrefs = {};
  var stored = props.getProperty(PREFS_KEY_PREFIX + userId);
  if (stored) {
    try { allPrefs = JSON.parse(stored); } catch (e) { allPrefs = {}; }
  }
  allPrefs[key] = value;
  props.setProperty(PREFS_KEY_PREFIX + userId, JSON.stringify(allPrefs));
}

/**
 * Get all user preferences
 */
function getUserPrefs(userId) {
  var props = PropertiesService.getUserProperties();
  var stored = props.getProperty(PREFS_KEY_PREFIX + userId);
  if (!stored) return JSON.parse(JSON.stringify(USER_PREFS_DEFAULTS));
  try {
    var parsed = JSON.parse(stored);
    var result = JSON.parse(JSON.stringify(USER_PREFS_DEFAULTS));
    for (var key in parsed) {
      result[key] = parsed[key];
    }
    return result;
  } catch (e) {
    return JSON.parse(JSON.stringify(USER_PREFS_DEFAULTS));
  }
}
