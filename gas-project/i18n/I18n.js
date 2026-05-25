/**
 * I18n - Internationalization helper
 *
 * t(key, locale) → localized string
 * getUserLocale(userId) → 'ja' or 'en'
 */

var DEFAULT_LOCALE = 'ja';

/**
 * Get translated message by key.
 * Falls back to DEFAULT_LOCALE if key missing for requested locale.
 *
 * @param {string} key - dot-notation key in MESSAGES catalog
 * @param {string} [locale] - 'ja' or 'en'
 * @returns {string} translated string (or key itself if not found)
 */
function t(key, locale) {
  var loc = locale || DEFAULT_LOCALE;
  var entry = MESSAGES[key];
  if (!entry) return key;
  return entry[loc] !== undefined ? entry[loc] : (entry[DEFAULT_LOCALE] || key);
}

/**
 * Get user's preferred locale.
 * Reads from user prefs (stored by StateHandler), defaults to 'ja'.
 *
 * @param {string} userId - LINE user ID
 * @returns {string} 'ja' or 'en'
 */
function getUserLocale(userId) {
  if (typeof getUserPrefs === 'function') {
    var prefs = getUserPrefs(userId);
    if (prefs && prefs.language) return prefs.language;
  }
  return DEFAULT_LOCALE;
}

/**
 * t() with placeholder fill.
 * Combines translation and {key} substitution in one call.
 *
 * @param {string} key - message catalog key
 * @param {Object} values - { placeholder: value } pairs
 * @param {string} [locale] - 'ja' or 'en'
 * @returns {string}
 */
function tf(key, values, locale) {
  var template = t(key, locale);
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, function(m, k) {
    return values[k] !== undefined ? values[k] : m;
  });
}
