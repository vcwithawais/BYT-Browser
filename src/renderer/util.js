// ===== Shared helpers =====

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// Hostname without the leading "www."
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// A readable short form of a URL for display.
export function prettyUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    const short = `${u.hostname.replace(/^www\./, '')}${path}`;
    return short.length > 46 ? short.slice(0, 46) + '…' : short;
  } catch {
    return url;
  }
}

// Deterministic colour derived from a string — used for favicon placeholders.
export function faviconColor(seed) {
  let hash = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${hash}, 58%, 46%)`;
}

export function faviconLetter(seed) {
  const s = String(seed || '?').replace(/^www\./, '');
  const m = s.match(/[a-z0-9]/i);
  return (m ? m[0] : '?').toUpperCase();
}

// Is this string a URL (rather than a search query)?
export function looksLikeUrl(input) {
  const s = input.trim();
  if (!s) return false;
  if (/^(https?|about|chrome|file|ftp):/i.test(s)) return true;
  if (/\s/.test(s)) return false;
  return /^[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i.test(s) || s === 'localhost' || /^localhost[:/]/.test(s);
}

// Normalise a URL- or query-like input into a navigable URL.
export function normalizeInput(input, engineKey) {
  const s = input.trim();
  if (!s) return '';
  if (/^[a-z]+:\/\//i.test(s) || /^(about|chrome|data|file):/i.test(s)) return s;
  if (looksLikeUrl(s)) return 'https://' + s.replace(/^\/+/, '');
  return searchUrlFor(engineKey, s);
}

// Local alias to avoid a circular import with data.js
function searchUrlFor(engineKey, query) {
  const map = {
    google: 'https://www.google.com/search?q=%s',
    duckduckgo: 'https://duckduckgo.com/?q=%s',
    bing: 'https://www.bing.com/search?q=%s',
    brave: 'https://search.brave.com/search?q=%s',
    wikipedia: 'https://en.wikipedia.org/w/index.php?search=%s',
  };
  return (map[engineKey] || map.google).replace('%s', encodeURIComponent(query));
}

export function relativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || '?';
}
