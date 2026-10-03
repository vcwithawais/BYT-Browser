// ===== Static data: search engines, Google apps, wallpapers, accents =====

export const SEARCH_ENGINES = {
  google: {
    name: 'Google',
    search: 'https://www.google.com/search?q=%s',
    home: 'https://www.google.com',
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    search: 'https://duckduckgo.com/?q=%s',
    home: 'https://duckduckgo.com',
  },
  bing: {
    name: 'Bing',
    search: 'https://www.bing.com/search?q=%s',
    home: 'https://www.bing.com',
  },
  brave: {
    name: 'Brave Search',
    search: 'https://search.brave.com/search?q=%s',
    home: 'https://search.brave.com',
  },
  wikipedia: {
    name: 'Wikipedia',
    search: 'https://en.wikipedia.org/w/index.php?search=%s',
    home: 'https://en.wikipedia.org',
  },
};

export const DEFAULT_SEARCH_ENGINE = 'google';

// Build a search URL for a query using the given engine key.
export function searchUrl(engineKey, query) {
  const engine = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE];
  return engine.search.replace('%s', encodeURIComponent(query));
}

// Google apps launcher entries (waffle grid), mirroring the real Google apps drawer.
export const GOOGLE_APPS = [
  { name: 'Search',     href: 'https://www.google.com',            color: '#4285f4', letter: 'G' },
  { name: 'Gmail',      href: 'https://mail.google.com',           color: '#ea4335', letter: 'M' },
  { name: 'Drive',      href: 'https://drive.google.com',          color: '#1a73e8', letter: 'D' },
  { name: 'Docs',       href: 'https://docs.google.com',           color: '#4285f4', letter: 'W' },
  { name: 'Sheets',     href: 'https://sheets.google.com',         color: '#0f9d58', letter: 'S' },
  { name: 'Slides',     href: 'https://slides.google.com',         color: '#f4b400', letter: 'P' },
  { name: 'Calendar',   href: 'https://calendar.google.com',       color: '#4285f4', letter: '31' },
  { name: 'Meet',       href: 'https://meet.google.com',           color: '#00ac47', letter: 'V' },
  { name: 'Photos',     href: 'https://photos.google.com',         color: '#ea4335', letter: 'Ph' },
  { name: 'Maps',       href: 'https://maps.google.com',           color: '#34a853', letter: 'M' },
  { name: 'News',       href: 'https://news.google.com',           color: '#4285f4', letter: 'N' },
  { name: 'Translate',  href: 'https://translate.google.com',      color: '#4285f4', letter: '文' },
  { name: 'Keep',       href: 'https://keep.google.com',           color: '#f4b400', letter: 'K' },
  { name: 'YouTube',    href: 'https://www.youtube.com',           color: '#ff0000', letter: 'Y' },
  { name: 'Play',       href: 'https://play.google.com',           color: '#34a853', letter: '▶' },
  { name: 'Contacts',   href: 'https://contacts.google.com',       color: '#4285f4', letter: 'C' },
];

// Default speed-dial shortcuts (seeded on first run; fully user-editable).
export const DEFAULT_SHORTCUTS = [
  { id: 's-google',   title: 'Google',     url: 'https://www.google.com',        color: '#4285f4' },
  { id: 's-youtube',  title: 'YouTube',    url: 'https://www.youtube.com',       color: '#ff0000' },
  { id: 's-gmail',    title: 'Gmail',      url: 'https://mail.google.com',       color: '#ea4335' },
  { id: 's-github',   title: 'GitHub',     url: 'https://github.com',            color: '#24292f' },
  { id: 's-wiki',     title: 'Wikipedia',  url: 'https://en.wikipedia.org',      color: '#636e72' },
  { id: 's-reddit',   title: 'Reddit',     url: 'https://www.reddit.com',        color: '#ff4500' },
  { id: 's-maps',     title: 'Maps',       url: 'https://maps.google.com',       color: '#34a853' },
  { id: 's-drive',    title: 'Drive',      url: 'https://drive.google.com',      color: '#1a73e8' },
];

// New-tab wallpapers — flat gradient washes (never photographic).
export const WALLPAPERS = [
  { name: 'Aurora',   css: 'linear-gradient(140deg, #1f2a44 0%, #33456b 45%, #6c5ce7 100%)' },
  { name: 'Ember',    css: 'linear-gradient(140deg, #3a1f1f 0%, #7a2f2a 50%, #fb542b 100%)' },
  { name: 'Mint',     css: 'linear-gradient(140deg, #0f2f2a 0%, #1d5c4d 55%, #34d399 100%)' },
  { name: 'Slate',    css: 'linear-gradient(140deg, #16181d 0%, #2b2f36 60%, #4b5563 100%)' },
  { name: 'Dawn',     css: 'linear-gradient(140deg, #fdf6f0 0%, #f6dfd2 50%, #f4b8a0 100%)' },
  { name: 'Cloud',    css: 'linear-gradient(140deg, #f5f7fb 0%, #e3e9f5 55%, #cdd8ee 100%)' },
  { name: 'Plum',     css: 'linear-gradient(140deg, #241735 0%, #45286b 55%, #a78bfa 100%)' },
  { name: 'Nord',     css: 'linear-gradient(140deg, #2e3440 0%, #3b4252 55%, #5e81ac 100%)' },
];

// Hosts that send `X-Frame-Options` / a CSP `frame-ancestors` rule, so a web
// page is not allowed to embed them at all (a browser rule, not a bug). The
// desktop build renders these natively in a Chromium view, where it applies.
export const FRAME_BLOCKED_HOSTS = [
  'google.com', 'youtube.com', 'gmail.com', 'facebook.com', 'instagram.com',
  'x.com', 'twitter.com', 'linkedin.com', 'reddit.com', 'amazon.com',
  'github.com', 'netflix.com', 'tiktok.com', 'whatsapp.com', 'twitch.tv',
  'pinterest.com', 'chatgpt.com', 'openai.com', 'soundcloud.com', 'spotify.com',
];

export function hostBlocksFraming(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  return FRAME_BLOCKED_HOSTS.some(d => h === d || h.endsWith(`.${d}`));
}

export const ACCENTS = [
  '#fb542b', '#4285f4', '#0f9d58', '#f4b400',
  '#7c3aed', '#db2777', '#0891b2', '#ea4335',
];
