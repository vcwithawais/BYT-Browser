// ===== Store =====
// Persistence layer for the browser.
//
// Two tiers, deliberately:
//   • localStorage  — user configuration that must survive restarts:
//                     preferences, bookmarks, speed-dial shortcuts, autofill
//                     entries, saved logins, profile, downloads.
//   • sessionStorage — the browsing session itself: open tabs, session history
//                      and recently-closed tabs. Per the app spec browsing data
//                      is stateless and is discarded when the browser closes.

const NS = 'sb:';

const LOCAL_KEYS = ['prefs', 'bookmarks', 'shortcuts', 'addresses', 'cards', 'logins', 'profile', 'downloads'];
const SESSION_KEYS = ['tabs', 'activeTabId', 'history', 'closedTabs'];

export const DEFAULT_PREFS = {
  theme: 'system',            // light | dark | system
  accent: '#fb542b',
  searchEngine: 'google',
  wallpaper: 0,
  verticalTabs: false,
  bookmarksBar: true,
  sidebar: true,
  density: 'comfortable',     // comfortable | compact
  shield: true,               // privacy shield (tracker blocking)
  blockThirdPartyCookies: true,
  doNotTrack: true,
  autofillEnabled: true,
  suggestFromHistory: true,
  openLinksInNewTab: false,
  rememberDownloads: true,
  showHomeButton: true,
};

function readJSON(storage, key, fallback) {
  try {
    const raw = storage.getItem(NS + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(storage, key, value) {
  try {
    storage.setItem(NS + key, JSON.stringify(value));
  } catch {
    /* quota / private-mode — ignore */
  }
}

// ----- Preferences -----
export function getPrefs() {
  return { ...DEFAULT_PREFS, ...readJSON(localStorage, 'prefs', {}) };
}

export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  writeJSON(localStorage, 'prefs', next);
  return next;
}

// ----- Persistent collections -----
export function getList(name, fallback = []) {
  return readJSON(localStorage, name, fallback);
}

export function setList(name, value) {
  writeJSON(localStorage, name, value);
  return value;
}

// ----- Session state -----
export function getSession(key, fallback) {
  const value = readJSON(sessionStorage, key, fallback);
  return value === null || value === undefined ? fallback : value;
}

export function setSession(key, value) {
  writeJSON(sessionStorage, key, value);
}

// ----- Bulk operations -----

// Clear browsing data only (session: tabs history, recently closed).
// User configuration is intentionally preserved.
export function clearBrowsingData() {
  SESSION_KEYS.forEach(k => sessionStorage.removeItem(NS + k));
}

// Export every piece of user configuration as a portable object.
export function exportAll() {
  const data = { _app: 'secure-browser', _version: 1, _exportedAt: new Date().toISOString() };
  LOCAL_KEYS.forEach(k => { data[k] = readJSON(localStorage, k, null); });
  return data;
}

// Import a previously exported object. Returns the list of restored keys.
export function importAll(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Invalid data file');
  const restored = [];
  LOCAL_KEYS.forEach(k => {
    if (obj[k] !== undefined && obj[k] !== null) {
      writeJSON(localStorage, k, obj[k]);
      restored.push(k);
    }
  });
  return restored;
}

// Wipe absolutely everything this browser has stored.
export function wipeAll() {
  LOCAL_KEYS.forEach(k => localStorage.removeItem(NS + k));
  SESSION_KEYS.forEach(k => sessionStorage.removeItem(NS + k));
}

export const KEYS = { LOCAL_KEYS, SESSION_KEYS };
