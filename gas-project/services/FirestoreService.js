/**
 * Firestore Service - REST API + JWT authentication
 *
 * GAS-compatible Firestore client using UrlFetchApp.
 * Manages access tokens, document CRUD, and value conversion.
 */

var FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/';
var FIRESTORE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
var FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
var FIRESTORE_TOKEN_CACHE_KEY = 'fs_access_token';
var FIRESTORE_TOKEN_TTL = 3000; // 50 min (token expires in 60)

// ─── Access Token ───

/**
 * Get Firebase access token (cached for 50 min)
 */
function _getFsAccessToken() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(FIRESTORE_TOKEN_CACHE_KEY);
  if (cached) return cached;

  var privateKey = getFirebasePrivateKey();
  if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY not set');

  // Handle escaped newlines from Script Properties
  var pk = privateKey.replace(/\\n/g, '\n');

  var now = Math.floor(Date.now() / 1000);
  var header = _b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var payload = _b64url(JSON.stringify({
    iss: getFirebaseClientEmail(),
    scope: FIRESTORE_SCOPE,
    aud: FIRESTORE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));

  var toSign = header + '.' + payload;
  var signature = Utilities.computeRsaSha256Signature(toSign, pk);
  var jwt = toSign + '.' + _b64urlFromBytes(signature);

  var resp = UrlFetchApp.fetch(FIRESTORE_TOKEN_URL, {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions: true
  });

  var data = JSON.parse(resp.getContentText());
  if (!data.access_token) {
    throw new Error('Firestore token error: ' + (data.error_description || data.error || resp.getContentText()));
  }

  cache.put(FIRESTORE_TOKEN_CACHE_KEY, data.access_token, FIRESTORE_TOKEN_TTL);
  return data.access_token;
}

// ─── Document CRUD ───

/**
 * Get a single document by ID
 * @param {string} collection - e.g. 'reservations'
 * @param {string} docId - document ID
 * @returns {object|null} plain JS object or null if not found
 */
function fsGet(collection, docId) {
  var url = _fsDocUrl(collection, docId);
  var resp = _fsFetch(url, 'get');

  if (resp.getResponseCode() === 404) return null;
  _fsCheck(resp);

  return _fromDoc(JSON.parse(resp.getContentText()));
}

/**
 * Set (create or overwrite) a document
 * @param {string} collection
 * @param {string} docId
 * @param {object} data - plain JS object
 */
function fsSet(collection, docId, data) {
  var url = _fsDocUrl(collection, docId);
  var resp = _fsFetch(url, 'patch', { fields: _toFields(data) });
  _fsCheck(resp);
  return _fromDoc(JSON.parse(resp.getContentText()));
}

/**
 * Update specific fields (merge)
 * @param {string} collection
 * @param {string} docId
 * @param {object} data - fields to update
 */
function fsUpdate(collection, docId, data) {
  var url = _fsDocUrl(collection, docId) + '?updateMask.fieldPaths=' +
    Object.keys(data).map(encodeURIComponent).join('&updateMask.fieldPaths=');
  var resp = _fsFetch(url, 'patch', { fields: _toFields(data) });
  _fsCheck(resp);
  return _fromDoc(JSON.parse(resp.getContentText()));
}

/**
 * Delete a document
 * @param {string} collection
 * @param {string} docId
 */
function fsDelete(collection, docId) {
  var url = _fsDocUrl(collection, docId);
  var resp = _fsFetch(url, 'delete');
  if (resp.getResponseCode() !== 200 && resp.getResponseCode() !== 204) {
    throw new Error('Firestore delete failed: ' + resp.getContentText());
  }
}

/**
 * Add document with auto-generated ID
 * @param {string} collection
 * @param {object} data
 * @returns {string} generated document ID
 */
function fsAdd(collection, data) {
  var url = _fsCollectionUrl(collection);
  var resp = _fsFetch(url, 'post', { fields: _toFields(data) });
  _fsCheck(resp);
  var doc = JSON.parse(resp.getContentText());
  // Extract ID from document name: projects/.../documents/{collection}/{id}
  var parts = doc.name.split('/');
  return parts[parts.length - 1];
}

/**
 * Get all documents in a collection
 * @param {string} collection
 * @returns {Array<object>} array of plain JS objects (each has _id field)
 */
function fsGetCollection(collection) {
  var url = _fsCollectionUrl(collection);
  var resp = _fsFetch(url, 'get');
  _fsCheck(resp);

  var result = JSON.parse(resp.getContentText());
  if (!result.documents) return [];

  return result.documents.map(function(doc) {
    var obj = _fromDoc(doc);
    var parts = doc.name.split('/');
    obj._id = parts[parts.length - 1];
    return obj;
  });
}

/**
 * Query documents by a single field equality
 * @param {string} collection
 * @param {string} field
 * @param {string} op - '==', '!=', '<', '<=', '>', '>='
 * @param {*} value
 * @returns {Array<object>}
 */
function fsQuery(collection, field, op, value) {
  var structuredQuery = {
    from: [{ collectionId: collection }],
    where: {
      fieldFilter: {
        field: { fieldPath: field },
        op: _fsOp(op),
        value: _toFsValue(value)
      }
    }
  };

  var projectId = getFirebaseProjectId();
  var url = FIRESTORE_BASE + projectId + '/databases/(default)/documents:runQuery';
  var resp = _fsFetch(url, 'post', { structuredQuery: structuredQuery });
  _fsCheck(resp);

  var results = JSON.parse(resp.getContentText());
  if (!results) return [];

  var docs = [];
  for (var i = 0; i < results.length; i++) {
    if (results[i].document) {
      var obj = _fromDoc(results[i].document);
      var parts = results[i].document.name.split('/');
      obj._id = parts[parts.length - 1];
      docs.push(obj);
    }
  }
  return docs;
}

// ─── Internal helpers ───

function _fsDocUrl(collection, docId) {
  return FIRESTORE_BASE + getFirebaseProjectId() + '/databases/(default)/documents/' + collection + '/' + docId;
}

function _fsCollectionUrl(collection) {
  return FIRESTORE_BASE + getFirebaseProjectId() + '/databases/(default)/documents/' + collection;
}

function _fsFetch(url, method, body) {
  var token = _getFsAccessToken();
  var options = {
    method: method,
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
    contentType: 'application/json'
  };
  if (body) options.payload = JSON.stringify(body);
  return UrlFetchApp.fetch(url, options);
}

function _fsCheck(resp) {
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Firestore error (' + code + '): ' + resp.getContentText().substring(0, 300));
  }
}

function _fsOp(op) {
  var map = { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL' };
  return map[op] || 'EQUAL';
}

// ─── Value conversion: JS ↔ Firestore ───

/**
 * Convert plain JS object to Firestore fields map
 */
function _toFields(obj) {
  var fields = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      fields[key] = _toFsValue(obj[key]);
    }
  }
  return fields;
}

/**
 * Convert single JS value to Firestore value
 */
function _toFsValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    var arr = {};
    for (var i = 0; i < val.length; i++) {
      arr['_v' + i] = _toFsValue(val[i]);
    }
    return { arrayValue: { values: val.map(function(v) { return _toFsValue(v); }) } };
  }
  if (typeof val === 'object') return { mapValue: { fields: _toFields(val) } };
  return { stringValue: String(val) };
}

/**
 * Convert Firestore document to plain JS object
 */
function _fromDoc(doc) {
  if (!doc || !doc.fields) return {};
  var result = {};
  for (var key in doc.fields) {
    if (doc.fields.hasOwnProperty(key)) {
      result[key] = _fromFsValue(doc.fields[key]);
    }
  }
  return result;
}

/**
 * Convert single Firestore value to JS value
 */
function _fromFsValue(fv) {
  if (fv.nullValue !== undefined) return null;
  if (fv.stringValue !== undefined) return fv.stringValue;
  if (fv.booleanValue !== undefined) return fv.booleanValue;
  if (fv.integerValue !== undefined) return parseInt(fv.integerValue, 10);
  if (fv.doubleValue !== undefined) return parseFloat(fv.doubleValue);
  if (fv.timestampValue !== undefined) return new Date(fv.timestampValue);
  if (fv.arrayValue) {
    if (!fv.arrayValue.values) return [];
    return fv.arrayValue.values.map(function(v) { return _fromFsValue(v); });
  }
  if (fv.mapValue) {
    if (!fv.mapValue.fields) return {};
    return _fromDoc(fv.mapValue);
  }
  return null;
}

// ─── Base64URL helpers ───

function _b64url(str) {
  return Utilities.base64EncodeWebSafe(str).replace(/=+$/, '');
}

function _b64urlFromBytes(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

/**
 * Health check: verify Firestore connectivity
 */
function firestoreHealthCheck() {
  if (!isFirebaseConfigured()) {
    return { ok: false, error: 'Firebase not configured' };
  }
  try {
    var token = _getFsAccessToken();
    return { ok: true, project: getFirebaseProjectId() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
