// ===== Secure Browser — renderer =====
// Chromium-family chrome: Chromium tab strip + omnibox, Brave-style privacy
// shield, Edge-style vertical tabs, Opera-style sidebar, Google app launcher.
//
// Architecture: the static shell is built once; dynamic regions (tab strip,
// toolbar state, bookmarks bar, content area, status bar) are updated
// independently so that changing a preference never reloads the open page.

import { ICONS } from './icons.js';
import { SEARCH_ENGINES, DEFAULT_SEARCH_ENGINE, GOOGLE_APPS, DEFAULT_SHORTCUTS, ACCENTS, hostBlocksFraming } from './data.js';
import * as store from './store.js';
import { renderNewTab, renderPanel } from './panels.js';
import {
  escapeHtml, uid, hostOf, prettyUrl, normalizeInput, looksLikeUrl,
  faviconColor, faviconLetter, faviconHost, faviconImg, faviconSources, relativeTime, initials,
} from './util.js';

// The desktop build injects `secureBrowser` from the preload script. When it is
// present, real pages are rendered by a native Chromium view instead of an
// <iframe>, so sites that forbid embedding (Google, YouTube, …) work normally.
const electron = (typeof window !== 'undefined' && window.secureBrowser) || null;

const icon = k => ICONS[k] || '';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let prefs = store.getPrefs();

const savedTabs = store.getSession('tabs', null);
const savedActive = store.getSession('activeTabId', null);

const state = {
  tabs: savedTabs && savedTabs.length ? savedTabs : [],
  activeTabId: savedActive,
  panel: null,
  history: store.getSession('history', []),
  closedTabs: store.getSession('closedTabs', []),
  bookmarks: store.getList('bookmarks', []),
  shortcuts: store.getList('shortcuts', null) || DEFAULT_SHORTCUTS.map(s => ({ ...s })),
  addresses: store.getList('addresses', []),
  cards: store.getList('cards', []),
  logins: store.getList('logins', []),
  downloads: store.getList('downloads', []),
  profile: store.getList('profile', null),
  syncEnabled: store.getList('profile', null) ? true : false,
  syncScopes: { bookmarks: true, shortcuts: true, autofill: true, settings: true },
  lastSync: null,
  suggestions: [],
  suggestIndex: -1,
  ui: { historyQuery: '' },
};

let nextId = 1;
let contentKey = '';
let loadingTimer = null;

function tabId() { return `t${nextId++}`; }

function persistSession() {
  store.setSession('tabs', state.tabs);
  store.setSession('activeTabId', state.activeTabId);
  store.setSession('history', state.history);
  store.setSession('closedTabs', state.closedTabs);
}

function getActiveTab() {
  return state.tabs.find(t => t.id === state.activeTabId) || null;
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

function createTab(mode = 'standard', url = '', opts = {}) {
  const tab = {
    id: tabId(),
    mode,
    url,
    title: url ? prettyUrl(url) : 'New Tab',
    pinned: false,
    muted: false,
    zoom: 1,
    history: url ? [url] : [],
    historyIndex: url ? 0 : -1,
  };
  const insertAt = tab.pinned ? 0 : state.tabs.length;
  state.tabs.splice(insertAt, 0, tab);
  if (opts.activate !== false) state.activeTabId = tab.id;
  if (url && mode !== 'private') recordHistory(url, tab.title);
  orderPinned();
  persistSession();
  renderAll();
  return tab;
}

function orderPinned() {
  state.tabs.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
}

function closeTab(id) {
  const idx = state.tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [closed] = state.tabs.splice(idx, 1);
  if (electron && electron.closeNativeTab) electron.closeNativeTab(id);
  if (closed.url && closed.mode !== 'private') {
    state.closedTabs.unshift({ url: closed.url, title: closed.title });
    state.closedTabs = state.closedTabs.slice(0, 25);
  }
  if (state.activeTabId === id) {
    const next = state.tabs[Math.min(idx, state.tabs.length - 1)];
    state.activeTabId = next ? next.id : null;
  }
  if (!state.tabs.length) { createTab('standard'); return; }
  persistSession();
  renderAll();
}

function activateTab(id) {
  state.activeTabId = id;
  state.panel = null;
  persistSession();
  renderAll();
}

function duplicateTab(id) {
  const t = state.tabs.find(x => x.id === id);
  if (!t) return;
  createTab(t.mode, t.url);
  toast('Tab duplicated');
}

function togglePin(id) {
  const t = state.tabs.find(x => x.id === id);
  if (!t) return;
  t.pinned = !t.pinned;
  orderPinned();
  persistSession();
  renderTabs();
  toast(t.pinned ? 'Tab pinned' : 'Tab unpinned');
}

function toggleMute(id) {
  const t = state.tabs.find(x => x.id === id);
  if (!t) return;
  t.muted = !t.muted;
  renderTabs();
}

function reopenClosedTab() {
  const last = state.closedTabs.shift();
  if (!last) { toast('No recently closed tabs'); return; }
  persistSession();
  createTab('standard', last.url);
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

function recordHistory(url, title) {
  state.history.unshift({ id: uid('h'), url, title: title || hostOf(url) || url, at: Date.now() });
  state.history = state.history.slice(0, 500);
}

function navigate(rawInputOrUrl, opts = {}) {
  const tab = getActiveTab();
  if (!tab) return;
  const url = /^[a-z]+:\/\//i.test(rawInputOrUrl) || /^chrome:/i.test(rawInputOrUrl)
    ? rawInputOrUrl
    : normalizeInput(rawInputOrUrl, prefs.searchEngine);
  if (!url) return;
  state.panel = null;
  tab.url = url;
  tab.title = prettyUrl(url);
  tab.history = tab.history.slice(0, tab.historyIndex + 1);
  tab.history.push(url);
  tab.historyIndex = tab.history.length - 1;
  if (tab.mode !== 'private') recordHistory(url, tab.title);
  startLoading();
  persistSession();
  renderAll();
}

function goBack() {
  const t = getActiveTab();
  if (!t || t.historyIndex <= 0) return;
  t.historyIndex--;
  t.url = t.history[t.historyIndex];
  t.title = prettyUrl(t.url);
  state.panel = null;
  persistSession();
  renderAll();
}

function goForward() {
  const t = getActiveTab();
  if (!t || t.historyIndex >= t.history.length - 1) return;
  t.historyIndex++;
  t.url = t.history[t.historyIndex];
  t.title = prettyUrl(t.url);
  state.panel = null;
  persistSession();
  renderAll();
}

function goHome() {
  const t = getActiveTab();
  if (!t) return;
  t.url = '';
  t.title = 'New Tab';
  state.panel = null;
  persistSession();
  renderAll();
}

function reloadContent(force = false) {
  const t = getActiveTab();
  if (!t || (!t.url && !state.panel)) return;
  startLoading();
  contentKey = '';           // force the content area to rebuild
  renderContent(true);
}

function startLoading() {
  clearTimeout(loadingTimer);
  const btn = $('#reload-btn');
  if (btn) { btn.innerHTML = icon('stop'); btn.dataset.loading = '1'; btn.title = 'Stop'; }
  loadingTimer = setTimeout(stopLoading, 4000);
}

function stopLoading() {
  clearTimeout(loadingTimer);
  const btn = $('#reload-btn');
  if (btn) { btn.innerHTML = icon('reload'); delete btn.dataset.loading; btn.title = 'Reload'; }
}

/* ------------------------------------------------------------------ */
/*  Omnibox                                                            */
/* ------------------------------------------------------------------ */

function omniboxValue() {
  if (state.panel) return `chrome://${state.panel}`;
  const t = getActiveTab();
  return t ? t.url : '';
}

function buildSuggestions(query) {
  const q = query.trim();
  const out = [];
  if (!q) return out;
  const engine = SEARCH_ENGINES[prefs.searchEngine] || SEARCH_ENGINES.google;

  if (looksLikeUrl(q)) {
    out.push({ kind: 'url', label: q, sub: 'Open URL', url: normalizeInput(q, prefs.searchEngine), icon: 'globe' });
  } else {
    out.push({ kind: 'search', label: q, sub: `Search ${engine.name}`, url: normalizeInput(q, prefs.searchEngine), icon: 'search' });
  }

  if (prefs.suggestFromHistory) {
    const seen = new Set(out.map(o => o.url));
    const pool = [...state.history, ...state.bookmarks, ...state.shortcuts];
    for (const item of pool) {
      if (out.length >= 6) break;
      const title = item.title || '';
      const url = item.url || '';
      if (!url || seen.has(url)) continue;
      if (title.toLowerCase().includes(q.toLowerCase()) || url.toLowerCase().includes(q.toLowerCase())) {
        seen.add(url);
        out.push({ kind: 'local', label: title || hostOf(url), sub: prettyUrl(url), url, icon: 'history' });
      }
    }
  }
  return out;
}

function renderSuggestions() {
  const box = $('#omnibox-suggest');
  if (!box) return;
  if (!state.suggestions.length) { box.classList.remove('open'); box.innerHTML = ''; return; }
  box.innerHTML = state.suggestions.map((s, i) => `
    <div class="suggest ${i === state.suggestIndex ? 'sel' : ''}" data-suggest="${i}">
      <span class="suggest-ico">${icon(s.icon)}</span>
      <span class="suggest-text"><span class="suggest-label">${escapeHtml(s.label)}</span><span class="suggest-sub">${escapeHtml(s.sub)}</span></span>
      <span class="suggest-go">${icon('arrowUpRight')}</span>
    </div>`).join('');
  box.classList.add('open');
}

function closeSuggestions() {
  state.suggestions = [];
  state.suggestIndex = -1;
  const box = $('#omnibox-suggest');
  if (box) { box.classList.remove('open'); box.innerHTML = ''; }
}

function openSuggestions(query) {
  state.suggestions = buildSuggestions(query);
  state.suggestIndex = -1;
  renderSuggestions();
}

/* ------------------------------------------------------------------ */
/*  Shell (built once)                                                 */
/* ------------------------------------------------------------------ */

function ensureShell() {
  const root = document.getElementById('app');
  if (root.querySelector('#browser')) return;

  root.innerHTML = `
    <div class="browser" id="browser">
      <header class="title-bar" id="title-bar">
        <div class="tab-strip" id="tab-strip"></div>
        <div class="title-actions">
          <button class="icon-btn" id="vtabs-toggle" title="Toggle vertical tabs">${icon('layout')}</button>
        </div>
      </header>

      <div class="toolbar" id="toolbar">
        <div class="nav-group">
          <button class="icon-btn" id="back-btn" data-action="back" title="Back (Alt+←)">${icon('back')}</button>
          <button class="icon-btn" id="fwd-btn" data-action="forward" title="Forward (Alt+→)">${icon('forward')}</button>
          <button class="icon-btn" id="reload-btn" data-action="reload" title="Reload (Ctrl+R)">${icon('reload')}</button>
          <button class="icon-btn" id="home-btn" data-action="home" title="Home">${icon('home')}</button>
        </div>

        <div class="omnibox-wrap">
          <div class="omnibox" id="omnibox">
            <span class="security-indicator" id="sec-ind"></span>
            <input id="url-input" type="text" placeholder="Search Google or type a URL"
                   autocomplete="off" spellcheck="false" aria-label="Address and search bar" />
            <button class="icon-btn sm" id="star-btn" data-action="toggle-star" title="Bookmark this page">${icon('star')}</button>
          </div>
          <div class="omnibox-suggest" id="omnibox-suggest"></div>
        </div>

        <div class="tool-group">
          <button class="icon-btn" id="shield-btn" data-action="toggle-shield" title="Privacy shield">${icon('shield')}</button>
          <button class="icon-btn" id="apps-btn" title="Google apps">${icon('grid')}</button>
          <button class="profile-btn" id="profile-btn" title="Account"></button>
          <button class="icon-btn" id="menu-btn" title="Menu">${icon('menu')}</button>
        </div>
      </div>

      <div class="bookmarks-bar" id="bookmarks-bar"></div>

      <div class="browser-body" id="browser-body">
        <nav class="vtabs" id="vtabs" aria-label="Vertical tabs"></nav>
        <nav class="sidebar" id="sidebar" aria-label="Sidebar">
          <button class="rail-btn" data-action="open-panel" data-panel="tabs" title="Tabs">${icon('tabs')}</button>
          <button class="rail-btn" data-action="open-panel" data-panel="bookmarks" title="Bookmarks">${icon('bookmark')}</button>
          <button class="rail-btn" data-action="open-panel" data-panel="history" title="History">${icon('history')}</button>
          <button class="rail-btn" data-action="open-panel" data-panel="downloads" title="Downloads">${icon('download')}</button>
          <button class="rail-btn" data-action="open-panel" data-panel="autofill" title="Autofill & passwords">${icon('key')}</button>
          <span class="rail-divider"></span>
          <button class="rail-btn" data-action="open-panel" data-panel="apps" title="Google apps">${icon('grid')}</button>
          <button class="rail-btn" data-action="new-tor-tab" title="New Tor tab">${icon('tor')}</button>
          <button class="rail-btn" data-action="new-private-tab" title="New private tab">${icon('incognito')}</button>
          <span class="rail-spacer"></span>
          <button class="rail-btn" data-action="open-palette" title="Command palette (Ctrl+K)">${icon('command')}</button>
          <button class="rail-btn" data-action="open-panel" data-panel="settings" title="Settings">${icon('settings')}</button>
        </nav>
        <main class="content-area" id="content-area"></main>
      </div>

      <div class="status-bar" id="status-bar"></div>

      <div class="dropdown" id="dropdown"></div>
      <div class="popover apps-popover" id="apps-popover"></div>
      <div class="overlay" id="palette"></div>
      <div class="overlay" id="modal"></div>
      <div class="toasts" id="toasts"></div>
    </div>
  `;

  attachStaticListeners();
  renderDropdown();
  renderAppsPopover();
}

/* ------------------------------------------------------------------ */
/*  Region renderers                                                   */
/* ------------------------------------------------------------------ */

function renderAll(force = false) {
  ensureShell();
  renderTabs();
  renderToolbar();
  renderBookmarksBar();
  renderContent(force);
  renderStatusBar();
  applyLayout();
}

function tabMarkup(t) {
  const active = t.id === state.activeTabId ? 'active' : '';
  const host = faviconHost(t.url);
  const img = t.mode === 'standard' && t.url ? faviconImg(host, 'fav-img', t.favicon) : '';
  const fav = t.mode === 'tor'
    ? `<span class="tab-favicon tor">${icon('tor')}</span>`
    : t.mode === 'private'
      ? `<span class="tab-favicon private">${icon('incognito')}</span>`
      : img
        ? `<span class="tab-favicon web" style="--fav:${faviconColor(host)}">${img}</span>`
        : `<span class="tab-favicon" style="--fav:${faviconColor(host || 'new')}">${t.url ? escapeHtml(faviconLetter(host)) : icon('globe')}</span>`;
  return `
    <div class="tab ${active} ${t.mode} ${t.pinned ? 'pinned' : ''}" data-tab-id="${t.id}" draggable="true" title="${escapeHtml(t.title)}">
      ${fav}
      ${t.pinned ? '' : `<span class="tab-title">${escapeHtml(t.title || 'New Tab')}</span>`}
      ${t.muted ? `<span class="tab-muted">${icon('mute')}</span>` : ''}
      ${t.pinned ? '' : `<span class="tab-close" data-close="${t.id}" title="Close tab">${icon('close')}</span>`}
    </div>`;
}

function renderTabs() {
  const strip = $('#tab-strip');
  const vtabs = $('#vtabs');
  const html = state.tabs.map(tabMarkup).join('');
  if (strip) {
    strip.innerHTML = html + `<button class="tab-new" id="new-tab-btn" title="New tab (Ctrl+T)">${icon('plus')}</button>`;
  }
  if (vtabs) vtabs.innerHTML = html;
}

function renderToolbar() {
  const t = getActiveTab();
  $('#back-btn').disabled = !t || t.historyIndex <= 0;
  $('#fwd-btn').disabled = !t || t.historyIndex >= t.history.length - 1;
  $('#home-btn').style.display = prefs.showHomeButton ? '' : 'none';

  const omnibox = $('#omnibox');
  const input = $('#url-input');
  const sec = $('#sec-ind');
  const mode = state.panel ? 'internal' : (t ? t.mode : 'standard');
  omnibox.className = `omnibox ${mode}`;
  if (document.activeElement !== input) input.value = omniboxValue();

  const secure = t && t.url && t.url.startsWith('https://');
  const secIcon = mode === 'tor' ? icon('tor')
    : mode === 'private' ? icon('incognito')
    : state.panel ? icon('settings')
    : t && t.url ? (secure ? icon('lock') : icon('unlock'))
    : icon('search');
  sec.innerHTML = secIcon;
  sec.className = `security-indicator ${mode}`;

  // Star
  const star = $('#star-btn');
  const isBookmarked = t && t.url && state.bookmarks.some(b => b.url === t.url);
  star.innerHTML = isBookmarked ? icon('starFilled') : icon('star');
  star.classList.toggle('on', !!isBookmarked);

  // Shield
  const shield = $('#shield-btn');
  shield.innerHTML = prefs.shield ? icon('shield') : icon('shieldOff');
  shield.classList.toggle('on', prefs.shield);
  shield.title = prefs.shield ? 'Privacy shield on' : 'Privacy shield off';

  // Profile
  const profileBtn = $('#profile-btn');
  profileBtn.innerHTML = state.profile
    ? `<span class="avatar">${escapeHtml(initials(state.profile.name))}</span>`
    : `<span class="avatar ghost">${icon('user')}</span>`;
}

function renderBookmarksBar() {
  const bar = $('#bookmarks-bar');
  const show = prefs.bookmarksBar && state.bookmarks.length > 0;
  bar.classList.toggle('hidden', !show);
  if (!show) { bar.innerHTML = ''; return; }
  bar.innerHTML = `
    <div class="bm-scroll">
      ${state.bookmarks.map(b => `
        <button class="bm-item" data-action="open-url" data-url="${escapeHtml(b.url)}" title="${escapeHtml(b.url)}">
          <span class="fav-dot" style="--fav:${b.color || faviconColor(hostOf(b.url))}">${faviconLetter(hostOf(b.url))}</span>
          <span class="bm-label">${escapeHtml(b.title || hostOf(b.url))}</span>
        </button>`).join('')}
    </div>
    <button class="icon-btn sm" data-action="open-panel" data-panel="bookmarks" title="All bookmarks">${icon('menuH')}</button>`;
}

function renderStatusBar() {
  const bar = $('#status-bar');
  const t = getActiveTab();
  let content = '';
  if (t && t.mode === 'tor') {
    content = `<span class="dot tor"></span><span>Tor routing active — all traffic proxied through the Tor network, DNS included. Nothing is written to disk.</span>`;
    bar.className = 'status-bar visible tor';
  } else if (t && t.mode === 'private') {
    content = `<span class="dot private"></span><span>Private tab — history, cookies and cache for this tab are discarded when it closes.</span>`;
    bar.className = 'status-bar visible private';
  } else {
    bar.className = 'status-bar';
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = content;
}

function applyLayout() {
  const body = $('#browser-body');
  body.classList.toggle('vtabs-on', prefs.verticalTabs);
  body.classList.toggle('sidebar-off', !prefs.sidebar);
  body.classList.toggle('compact', prefs.density === 'compact');
  $('#vtabs-toggle').classList.toggle('on', prefs.verticalTabs);
  syncNativeView();
}

/* ------------------------------ Content ---------------------------- */

function currentContentKey() {
  const t = getActiveTab();
  if (state.panel) return `panel:${state.panel}`;
  if (!t) return 'none';
  return `tab:${t.id}:${t.url}:${t.mode}:${t.zoom}`;
}

function renderContent(force = false) {
  const area = $('#content-area');
  if (!area) return;
  const key = currentContentKey();
  if (!force && key === contentKey) return;
  contentKey = key;

  if (state.panel) {
    area.innerHTML = renderPanel(state.panel, ctx());
    syncNativeView();
    return;
  }

  const t = getActiveTab();
  if (!t) { area.innerHTML = ''; syncNativeView(); return; }
  if (!t.url) { area.innerHTML = renderNewTab(ctx()); syncNativeView(); return; }
  if (electron) {
    // Desktop build: a native Chromium view is painted over this area, so no
    // site can refuse to be displayed the way it can inside an <iframe>.
    area.innerHTML = `<div class="native-host"></div>`;
    syncNativeView();
    stopLoading();
    return;
  }

  stopLoading();

  // Known to forbid embedding — say so immediately instead of flashing an
  // empty frame that will never load.
  if (hostBlocksFraming(faviconHost(t.url))) {
    area.innerHTML = blockedMarkup(t.url, t.title, true);
    return;
  }

  area.innerHTML = `
    <div class="page-wrap">
      <iframe class="content-frame" id="content-frame" src="${escapeHtml(t.url)}" style="zoom:${t.zoom}"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerpolicy="${prefs.shield ? 'no-referrer' : 'strict-origin-when-cross-origin'}"
              title="${escapeHtml(t.title)}"></iframe>
    </div>
    ${blockedMarkup(t.url, t.title, false)}`;

  const frame = $('#content-frame');
  let loaded = false;
  frame.addEventListener('load', () => { loaded = true; });
  setTimeout(() => {
    if (!loaded) {
      const ov = $('#blocked-overlay');
      if (ov) ov.style.display = 'flex';
    }
  }, 3000);
}

// Shown when a site refuses to be embedded in a web page (X-Frame-Options /
// CSP frame-ancestors). Nothing outside the browser engine can override it, so
// the way through is the desktop build or the user's own browser.
function blockedMarkup(url, title, visible) {
  const host = hostOf(url) || title || 'This site';
  return `
    <div class="blocked-overlay" id="blocked-overlay" style="display:${visible ? 'flex' : 'none'}">
      <span class="blocked-icon">${icon('globe')}</span>
      <h2>This site can’t be shown inside a web page</h2>
      <p><strong>${escapeHtml(host)}</strong> sends <code>X-Frame-Options</code> or a CSP <code>frame-ancestors</code> rule that forbids other pages from embedding it — Google, YouTube and most large sites do this.</p>
      <div class="blocked-actions">
        <button class="btn btn-primary" data-action="open-external" data-url="${escapeHtml(url)}">${icon('external')} Open in your browser</button>
        <button class="btn btn-ghost" data-action="reload">${icon('reload')} Try again</button>
      </div>
      <p class="blocked-note">In the desktop app these pages render natively and open normally.</p>
    </div>`;
}

// Desktop build only: keep the native page view aligned with the content area
// and pointed at the active tab.
function syncNativeView() {
  if (!electron || !electron.showNativeView) return;
  const area = $('#content-area');
  const t = getActiveTab();
  if (!area) return;
  if (state.panel || !t || !t.url) { electron.hideNativeView(); return; }
  const r = area.getBoundingClientRect();
  electron.showNativeView({
    tabId: t.id,
    url: t.url,
    mode: t.mode,
    zoom: t.zoom,
    bounds: { x: r.left, y: r.top, width: r.width, height: r.height },
  });
}

function ctx() {
  return {
    prefs,
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    bookmarks: state.bookmarks,
    shortcuts: state.shortcuts,
    addresses: state.addresses,
    cards: state.cards,
    logins: state.logins,
    downloads: state.downloads,
    history: state.history,
    profile: state.profile,
    syncEnabled: state.syncEnabled,
    syncScopes: state.syncScopes,
    lastSync: state.lastSync,
    ui: state.ui,
  };
}

/* ------------------------------------------------------------------ */
/*  Dropdown / popovers / palette / modal / toast                      */
/* ------------------------------------------------------------------ */

function menuItem(action, label, iconKey, extra = '') {
  return `<button class="menu-item" data-action="${action}" ${extra}>${icon(iconKey)}<span>${escapeHtml(label)}</span></button>`;
}

function renderDropdown() {
  const t = getActiveTab();
  const zoom = t ? Math.round(t.zoom * 100) : 100;
  $('#dropdown').innerHTML = `
    ${menuItem('new-tab', 'New tab', 'plus', 'data-shortcut="Ctrl+T"')}
    ${menuItem('new-private-tab', 'New private tab', 'incognito')}
    ${menuItem('new-tor-tab', 'New Tor privacy tab', 'tor')}
    <div class="menu-sep"></div>
    ${menuItem('open-panel', 'Bookmarks', 'bookmark', 'data-panel="bookmarks"')}
    ${menuItem('open-panel', 'History', 'history', 'data-panel="history"')}
    ${menuItem('open-panel', 'Downloads', 'download', 'data-panel="downloads"')}
    ${menuItem('open-panel', 'Autofill & passwords', 'key', 'data-panel="autofill"')}
    ${menuItem('open-panel', 'Your account', 'user', 'data-panel="account"')}
    <div class="menu-sep"></div>
    <div class="menu-zoom">
      <button class="icon-btn sm" data-action="zoom-out" title="Zoom out">${icon('zoomOut')}</button>
      <button class="zoom-val" data-action="zoom-reset">${zoom}%</button>
      <button class="icon-btn sm" data-action="zoom-in" title="Zoom in">${icon('zoomIn')}</button>
    </div>
    ${menuItem('toggle-pref', prefs.sidebar ? 'Hide sidebar' : 'Show sidebar', 'layout', 'data-pref="sidebar"')}
    ${menuItem('toggle-pref', prefs.bookmarksBar ? 'Hide bookmarks bar' : 'Show bookmarks bar', 'bookmark', 'data-pref="bookmarksBar"')}
    ${menuItem('toggle-pref', prefs.verticalTabs ? 'Horizontal tabs' : 'Vertical tabs', 'tabs', 'data-pref="verticalTabs"')}
    <div class="menu-sep"></div>
    ${menuItem('open-palette', 'Command palette', 'command', 'data-shortcut="Ctrl+K"')}
    ${menuItem('open-panel', 'Settings', 'settings', 'data-panel="settings" data-shortcut="Ctrl+,"')}
    ${menuItem('open-panel', 'About', 'info', 'data-panel="about"')}
    <div class="menu-sep"></div>
    ${menuItem('keyboard-help', 'Keyboard shortcuts', 'keyboard')}
  `;
}

function renderAppsPopover() {
  $('#apps-popover').innerHTML = `
    <div class="popover-head">Google apps</div>
    <div class="apps-grid small">
      ${GOOGLE_APPS.map(a => `
        <button class="app-tile" data-action="open-url-new" data-url="${escapeHtml(a.href)}" title="${escapeHtml(a.name)}">
          <span class="app-ico" style="--a:${a.color}">${escapeHtml(a.letter)}</span>
          <span class="app-name">${escapeHtml(a.name)}</span>
        </button>`).join('')}
    </div>`;
}

function openPalette() {
  const overlay = $('#palette');
  const commands = [
    { label: 'New tab', action: 'new-tab', icon: 'plus' },
    { label: 'New private tab', action: 'new-private-tab', icon: 'incognito' },
    { label: 'New Tor privacy tab', action: 'new-tor-tab', icon: 'tor' },
    { label: 'Reopen last closed tab', action: 'reopen-tab', icon: 'refresh' },
    { label: 'Bookmarks', action: 'open-panel', panel: 'bookmarks', icon: 'bookmark' },
    { label: 'History', action: 'open-panel', panel: 'history', icon: 'history' },
    { label: 'Downloads', action: 'open-panel', panel: 'downloads', icon: 'download' },
    { label: 'Autofill & passwords', action: 'open-panel', panel: 'autofill', icon: 'key' },
    { label: 'Your account', action: 'open-panel', panel: 'account', icon: 'user' },
    { label: 'Google apps', action: 'open-panel', panel: 'apps', icon: 'grid' },
    { label: 'Settings', action: 'open-panel', panel: 'settings', icon: 'settings' },
    { label: 'Toggle vertical tabs', action: 'toggle-pref', pref: 'verticalTabs', icon: 'layout' },
    { label: 'Toggle privacy shield', action: 'toggle-pref', pref: 'shield', icon: 'shield' },
    { label: 'Toggle theme', action: 'cycle-theme', icon: 'palette' },
    { label: 'Export all data', action: 'data-export', icon: 'download' },
    { label: 'Zoom in', action: 'zoom-in', icon: 'zoomIn' },
    { label: 'Zoom out', action: 'zoom-out', icon: 'zoomOut' },
    { label: 'Reset zoom', action: 'zoom-reset', icon: 'refresh' },
  ];
  overlay.innerHTML = `
    <div class="palette">
      <div class="palette-input">
        <span>${icon('command')}</span>
        <input id="palette-input" placeholder="Type a command or search…" autocomplete="off" />
      </div>
      <div class="palette-list" id="palette-list"></div>
    </div>`;
  overlay.classList.add('open');

  const list = $('#palette-list');
  const renderList = (q = '') => {
    const items = commands.filter(c => c.label.toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = items.length
      ? items.map((c, i) => `<button class="palette-item ${i === 0 ? 'sel' : ''}" data-action="${c.action}" ${c.panel ? `data-panel="${c.panel}"` : ''} ${c.pref ? `data-pref="${c.pref}"` : ''}>${icon(c.icon)}<span>${escapeHtml(c.label)}</span></button>`).join('')
      : `<div class="palette-empty">No matching commands</div>`;
  };
  renderList('');
  const input = $('#palette-input');
  input.focus();
  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeOverlays();
    if (e.key === 'Enter') { const first = list.querySelector('.palette-item'); if (first) first.click(); }
  });
}

function closeOverlays() {
  $('#palette').classList.remove('open');
  $('#modal').classList.remove('open');
  $('#dropdown').classList.remove('open');
  $('#apps-popover').classList.remove('open');
  closeSuggestions();
}

function openModal({ title, fields = [], submitLabel = 'Save', onSubmit, danger = false }) {
  const overlay = $('#modal');
  overlay.innerHTML = `
    <div class="modal">
      <header class="modal-head"><h3>${escapeHtml(title)}</h3>
        <button class="icon-btn sm" data-action="close-modal">${icon('close')}</button></header>
      <form class="modal-body" id="modal-form">
        ${fields.map(f => `
          <label class="field">
            <span>${escapeHtml(f.label)}</span>
            ${f.type === 'select'
              ? `<select name="${f.name}">${(f.options || []).map(o => `<option value="${escapeHtml(o.value)}" ${o.value === f.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>`
              : `<input name="${f.name}" type="${f.type || 'text'}" value="${escapeHtml(f.value || '')}" placeholder="${escapeHtml(f.placeholder || '')}" ${f.required ? 'required' : ''} />`}
          </label>`).join('')}
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(submitLabel)}</button>
        </div>
      </form>
    </div>`;
  overlay.classList.add('open');
  const form = $('#modal-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const values = {};
    fields.forEach(f => {
      const el = form.elements[f.name];
      if (el) values[f.name] = el.value.trim();
    });
    onSubmit(values);
    closeOverlays();
  });
  const first = form.querySelector('input, select');
  if (first) first.focus();
}

function toast(message, kind = 'info') {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'error' ? 'info' : 'check')}<span>${escapeHtml(message)}</span>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 2600);
}

/* ------------------------------------------------------------------ */
/*  Theme                                                             */
/* ------------------------------------------------------------------ */

function resolveTheme() {
  if (prefs.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return prefs.theme;
}

function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme();
  document.documentElement.style.setProperty('--accent', prefs.accent);
  document.documentElement.style.setProperty('--accent-soft', hexToRgba(prefs.accent, 0.14));
}

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(251,84,43,${alpha})`;
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------ */
/*  Actions                                                           */
/* ------------------------------------------------------------------ */

const ACTIONS = {
  'new-tab': () => createTab('standard'),
  'new-private-tab': () => createTab('private'),
  'new-tor-tab': () => createTab('tor'),
  'reopen-tab': reopenClosedTab,
  'close-tab': el => closeTab(el.dataset.id),
  'activate-tab': el => activateTab(el.dataset.id),
  'duplicate-tab': el => duplicateTab(el.dataset.id),
  'pin-tab': el => togglePin(el.dataset.id),
  'mute-tab': el => toggleMute(el.dataset.id),
  'close-tabs-others': el => {
    state.tabs = state.tabs.filter(t => t.id === el.dataset.id || t.pinned);
    if (!state.tabs.some(t => t.id === state.activeTabId)) state.activeTabId = state.tabs[0].id;
    persistSession(); renderAll();
  },

  back: goBack,
  forward: goForward,
  reload: () => reloadContent(true),
  home: goHome,
  'zoom-in': () => setZoom(0.1),
  'zoom-out': () => setZoom(-0.1),
  'zoom-reset': () => { const t = getActiveTab(); if (t) { t.zoom = 1; renderContent(true); renderDropdown(); } },

  'toggle-star': toggleBookmarkCurrent,
  'toggle-shield': () => {
    prefs = store.setPrefs({ shield: !prefs.shield });
    renderToolbar();
    const frame = $('#content-frame');
    if (frame) frame.setAttribute('referrerpolicy', prefs.shield ? 'no-referrer' : 'strict-origin-when-cross-origin');
    toast(prefs.shield ? 'Privacy shield on' : 'Privacy shield off');
  },

  'open-panel': el => { state.panel = el.dataset.panel; contentKey = ''; closeOverlays(); renderAll(); },
  'close-panel': () => { state.panel = null; contentKey = ''; renderAll(); },
  'open-url': el => { navigate(el.dataset.url); closeOverlays(); },
  'open-url-new': el => { createTab('standard', el.dataset.url); closeOverlays(); },
  // Escape hatch for sites that forbid being embedded: hand the URL to the
  // user's real browser.
  'open-external': el => { window.open(el.dataset.url, '_blank', 'noopener,noreferrer'); },

  'add-shortcut': () => shortcutModal(),
  'edit-shortcut': el => shortcutModal(state.shortcuts.find(s => s.id === el.dataset.id)),
  'delete-shortcut': el => { state.shortcuts = state.shortcuts.filter(s => s.id !== el.dataset.id); store.setList('shortcuts', state.shortcuts); renderContent(true); toast('Shortcut removed'); },

  'bookmark-current': () => { const t = getActiveTab(); if (t && t.url) { addBookmark(t.url, t.title); renderContent(true); } else toast('Open a page first', 'error'); },
  'bookmark-edit': el => bookmarkEditModal(el.dataset.id),
  'bookmark-delete': el => { state.bookmarks = state.bookmarks.filter(b => b.id !== el.dataset.id); store.setList('bookmarks', state.bookmarks); renderAll(true); toast('Bookmark removed'); },
  'bookmarks-open-all': () => { state.bookmarks.forEach(b => createTab('standard', b.url, { activate: false })); state.activeTabId = state.tabs[state.tabs.length - 1].id; persistSession(); renderAll(true); },
  'bookmarks-export': () => exportJSON('bookmarks.json', { bookmarks: state.bookmarks }),
  'bookmarks-import': () => importJSON(restored => { state.bookmarks = store.getList('bookmarks', []); renderAll(true); toast(`Imported ${restored.length} section(s)`); }),

  'history-delete': el => { state.history = state.history.filter(h => h.id !== el.dataset.id); persistSession(); renderContent(true); },
  'history-clear': () => { state.history = []; persistSession(); renderContent(true); toast('History cleared'); },

  'download-remove': el => { state.downloads = state.downloads.filter(d => d.id !== el.dataset.id); store.setList('downloads', state.downloads); renderContent(true); },
  'downloads-clear': () => { state.downloads = []; store.setList('downloads', state.downloads); renderContent(true); toast('Downloads cleared'); },

  'set-pref': el => { prefs = store.setPrefs({ [el.dataset.pref]: el.dataset.value }); applyTheme(); applyLayout(); renderContent(true); renderDropdown(); if (state.panel === 'settings') renderContent(true); },
  'toggle-pref': el => {
    const key = el.dataset.pref;
    prefs = store.setPrefs({ [key]: !prefs[key] });
    applyTheme(); applyLayout(); renderToolbar(); renderDropdown();
    if (state.panel) renderContent(true);
  },
  'cycle-theme': () => { const order = ['light', 'dark', 'system']; prefs = store.setPrefs({ theme: order[(order.indexOf(prefs.theme) + 1) % 3] }); applyTheme(); renderDropdown(); if (state.panel === 'settings') renderContent(true); toast(`Theme: ${prefs.theme}`); },

  'clear-browsing-data': () => { store.clearBrowsingData(); state.history = []; state.closedTabs = []; toast('Browsing data cleared'); renderContent(true); },
  'data-export': () => exportJSON('secure-browser-data.json', store.exportAll()),
  'data-import': () => importJSON(() => { hydrateFromStore(); renderAll(true); toast('Data imported'); }),
  'data-wipe': () => openModal({
    title: 'Reset browser?', submitLabel: 'Reset everything', danger: true,
    fields: [{ name: 'confirm', label: 'Type RESET to confirm', placeholder: 'RESET', required: true }],
    onSubmit: v => {
      if (v.confirm !== 'RESET') { toast('Type RESET to confirm', 'error'); return; }
      store.wipeAll();
      state.bookmarks = []; state.shortcuts = DEFAULT_SHORTCUTS.map(s => ({ ...s }));
      state.addresses = []; state.cards = []; state.logins = []; state.downloads = [];
      state.profile = null; state.history = []; state.closedTabs = [];
      prefs = store.getPrefs(); applyTheme(); applyLayout(); renderAll(true);
      toast('Browser reset');
    },
  }),

  'autofill-export': () => exportJSON('autofill.json', { addresses: state.addresses, cards: state.cards, logins: state.logins }),
  'autofill-edit': el => autofillModal(el.dataset.kind, state[el.dataset.kind].find(x => x.id === el.dataset.id)),
  'autofill-delete': el => { const k = el.dataset.kind; state[k] = state[k].filter(x => x.id !== el.dataset.id); store.setList(k, state[k]); renderContent(true); toast('Entry removed'); },
  'address-add': () => autofillModal('addresses'),
  'card-add': () => autofillModal('cards'),
  'login-add': () => autofillModal('logins'),
  'login-reveal': el => {
    const l = state.logins.find(x => x.id === el.dataset.id);
    if (l) toast(`${l.site} — ${l.username} / ${l.password}`);
  },

  'account-signout': () => { state.profile = null; store.setList('profile', null); state.syncEnabled = false; renderAll(true); toast('Signed out'); },
  'toggle-sync': el => { const s = el.dataset.scope; state.syncScopes[s] = !state.syncScopes[s]; renderContent(true); },
  'sync-now': () => { state.lastSync = new Date().toLocaleTimeString(); toast('Everything is up to date'); renderContent(true); },

  'open-palette': () => openPalette(),
  'close-modal': () => closeOverlays(),
  'keyboard-help': () => openModal({ title: 'Keyboard shortcuts', fields: [], submitLabel: 'Got it', onSubmit: () => {} }),
};

function setZoom(delta) {
  const t = getActiveTab();
  if (!t || !t.url) { toast('Open a page to zoom', 'error'); return; }
  t.zoom = Math.min(2.5, Math.max(0.5, Math.round((t.zoom + delta) * 10) / 10));
  renderContent(true);
  renderDropdown();
}

function toggleBookmarkCurrent() {
  const t = getActiveTab();
  if (!t || !t.url) { toast('Open a page to bookmark it', 'error'); return; }
  const existing = state.bookmarks.find(b => b.url === t.url);
  if (existing) {
    state.bookmarks = state.bookmarks.filter(b => b.url !== t.url);
    toast('Bookmark removed');
  } else {
    addBookmark(t.url, t.title);
    toast('Bookmark added');
  }
  store.setList('bookmarks', state.bookmarks);
  renderToolbar();
  renderBookmarksBar();
  if (state.panel === 'bookmarks') renderContent(true);
}

function addBookmark(url, title) {
  state.bookmarks.unshift({ id: uid('b'), url, title: title || hostOf(url), color: faviconColor(hostOf(url)), at: Date.now() });
  store.setList('bookmarks', state.bookmarks);
}

function shortcutModal(existing) {
  openModal({
    title: existing ? 'Edit shortcut' : 'Add shortcut',
    submitLabel: existing ? 'Save' : 'Add',
    fields: [
      { name: 'title', label: 'Name', value: existing?.title || '', placeholder: 'GitHub', required: true },
      { name: 'url', label: 'URL', value: existing?.url || '', placeholder: 'https://github.com', required: true },
      { name: 'color', label: 'Colour', type: 'select', value: existing?.color || '#4285f4', options: ACCENTS.map(c => ({ value: c, label: c })) },
    ],
    onSubmit: v => {
      const url = normalizeInput(v.url, prefs.searchEngine);
      if (existing) {
        Object.assign(existing, { title: v.title, url, color: v.color });
      } else {
        state.shortcuts.push({ id: uid('s'), title: v.title, url, color: v.color });
      }
      store.setList('shortcuts', state.shortcuts);
      renderContent(true);
      toast(existing ? 'Shortcut updated' : 'Shortcut added');
    },
  });
}

function bookmarkEditModal(id) {
  const b = state.bookmarks.find(x => x.id === id);
  if (!b) return;
  openModal({
    title: 'Edit bookmark',
    fields: [
      { name: 'title', label: 'Name', value: b.title, required: true },
      { name: 'url', label: 'URL', value: b.url, required: true },
    ],
    onSubmit: v => {
      Object.assign(b, { title: v.title, url: normalizeInput(v.url, prefs.searchEngine) });
      store.setList('bookmarks', state.bookmarks);
      renderAll(true);
      toast('Bookmark updated');
    },
  });
}

const AUTOFILL_FIELDS = {
  addresses: [
    { name: 'name', label: 'Full name', placeholder: 'Ada Lovelace' },
    { name: 'email', label: 'Email', placeholder: 'ada@example.com' },
    { name: 'line1', label: 'Address', placeholder: '12 Analytical Way' },
    { name: 'city', label: 'City', placeholder: 'London' },
    { name: 'postal', label: 'Postal code', placeholder: 'N1 9AB' },
    { name: 'country', label: 'Country', placeholder: 'United Kingdom' },
  ],
  cards: [
    { name: 'name', label: 'Cardholder', placeholder: 'Ada Lovelace' },
    { name: 'last4', label: 'Last 4 digits', placeholder: '4242' },
    { name: 'expiry', label: 'Expiry (MM/YY)', placeholder: '08/29' },
  ],
  logins: [
    { name: 'site', label: 'Site', placeholder: 'github.com' },
    { name: 'username', label: 'Username', placeholder: 'ada' },
    { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
  ],
};

function autofillModal(kind, existing) {
  openModal({
    title: existing ? 'Edit entry' : 'Add entry',
    submitLabel: existing ? 'Save' : 'Add',
    fields: AUTOFILL_FIELDS[kind].map(f => ({ ...f, value: existing?.[f.name] || '' })),
    onSubmit: v => {
      if (existing) Object.assign(existing, v);
      else state[kind].unshift({ id: uid(kind[0]), ...v });
      store.setList(kind, state[kind]);
      renderContent(true);
      toast(existing ? 'Entry updated' : 'Entry added');
    },
  });
}

function signIn(values) {
  state.profile = { name: values.name, email: values.email, at: Date.now() };
  store.setList('profile', state.profile);
  state.syncEnabled = true;
  state.lastSync = new Date().toLocaleTimeString();
  renderAll(true);
  toast(`Signed in as ${values.name}`);
}

/* ---------------------- file import / export ---------------------- */

function exportJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Exported ' + filename);
}

function importJSON(onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        const restored = store.importAll(obj);
        hydrateFromStore();
        onDone(restored);
      } catch (err) {
        toast('Could not read that file', 'error');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

function hydrateFromStore() {
  prefs = store.getPrefs();
  state.bookmarks = store.getList('bookmarks', []);
  state.shortcuts = store.getList('shortcuts', null) || DEFAULT_SHORTCUTS.map(s => ({ ...s }));
  state.addresses = store.getList('addresses', []);
  state.cards = store.getList('cards', []);
  state.logins = store.getList('logins', []);
  state.downloads = store.getList('downloads', []);
  state.profile = store.getList('profile', null);
  state.syncEnabled = !!state.profile;
  applyTheme();
}

/* ------------------------------------------------------------------ */
/*  Event wiring                                                      */
/* ------------------------------------------------------------------ */

/* --------------------------- real favicons ------------------------- */

// <img> error events do not bubble, so listen in the capture phase: first retry
// through the second icon service, then fall back to a coloured letter tile.
function handleFaviconError(e) {
  const img = e.target;
  if (!img || img.tagName !== 'IMG' || !img.classList.contains('fav-img')) return;
  const host = img.dataset.host || '';
  const secondSource = faviconSources(host)[1];
  if (secondSource && !img.dataset.retried) {
    img.dataset.retried = '1';
    img.src = secondSource;
    return;
  }
  const tile = img.closest('.web');
  const letter = document.createElement('span');
  letter.className = 'fav-letter';
  letter.textContent = faviconLetter(host);
  if (tile) tile.classList.remove('web');
  img.replaceWith(letter);
}

function attachStaticListeners() {
  // Global action delegation
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el && ACTIONS[el.dataset.action]) {
      e.preventDefault();
      ACTIONS[el.dataset.action](el, e);
      return;
    }
    const sug = e.target.closest('[data-suggest]');
    if (sug) {
      const s = state.suggestions[Number(sug.dataset.suggest)];
      if (s) { navigate(s.url); closeSuggestions(); }
      return;
    }
    const tab = e.target.closest('.tab[data-tab-id]');
    if (tab) {
      if (e.target.closest('.tab-close')) { closeTab(e.target.closest('.tab-close').dataset.close); return; }
      activateTab(tab.dataset.tabId);
    }
  });

  // Omnibox
  const input = $('#url-input');
  input.addEventListener('focus', () => { input.select(); openSuggestions(input.value); });
  input.addEventListener('input', () => openSuggestions(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && state.suggestions.length) {
      e.preventDefault();
      state.suggestIndex = Math.min(state.suggestIndex + 1, state.suggestions.length - 1);
      renderSuggestions();
    } else if (e.key === 'ArrowUp' && state.suggestions.length) {
      e.preventDefault();
      state.suggestIndex = Math.max(state.suggestIndex - 1, -1);
      renderSuggestions();
    } else if (e.key === 'Enter') {
      const pick = state.suggestIndex >= 0 ? state.suggestions[state.suggestIndex] : null;
      const target = pick ? pick.url : input.value;
      input.blur();               // drop focus first so the omnibox re-renders with the resolved URL
      if (e.altKey) { createTab('standard', normalizeInput(target, prefs.searchEngine)); }
      else { navigate(target); }
      closeSuggestions();
    } else if (e.key === 'Escape') {
      closeSuggestions();
      input.value = omniboxValue();
      input.blur();
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.omnibox-wrap')) closeSuggestions();
    if (!e.target.closest('#dropdown') && !e.target.closest('#menu-btn')) $('#dropdown').classList.remove('open');
    if (!e.target.closest('#apps-popover') && !e.target.closest('#apps-btn')) $('#apps-popover').classList.remove('open');
    if (e.target.classList.contains('overlay')) closeOverlays();
  });

  $('#menu-btn').addEventListener('click', e => { e.stopPropagation(); $('#apps-popover').classList.remove('open'); $('#dropdown').classList.toggle('open'); });
  $('#apps-btn').addEventListener('click', e => { e.stopPropagation(); $('#dropdown').classList.remove('open'); $('#apps-popover').classList.toggle('open'); });
  $('#profile-btn').addEventListener('click', () => { state.panel = state.profile ? 'account' : 'account'; contentKey = ''; closeOverlays(); renderAll(); });
  $('#vtabs-toggle').addEventListener('click', () => { prefs = store.setPrefs({ verticalTabs: !prefs.verticalTabs }); applyLayout(); renderTabs(); renderDropdown(); });

  // New tab button lives inside the tab strip (re-rendered), so delegate:
  document.addEventListener('click', e => {
    if (e.target.closest('#new-tab-btn')) createTab('standard');
  }, true);

  // Tab drag reordering
  let dragId = null;
  document.addEventListener('dragstart', e => {
    const tab = e.target.closest('.tab[data-tab-id]');
    if (tab) { dragId = tab.dataset.tabId; tab.classList.add('dragging'); }
  });
  document.addEventListener('dragover', e => {
    if (dragId && e.target.closest('.tab[data-tab-id]')) e.preventDefault();
  });
  document.addEventListener('drop', e => {
    const over = e.target.closest('.tab[data-tab-id]');
    if (!dragId || !over || over.dataset.tabId === dragId) return;
    e.preventDefault();
    const from = state.tabs.findIndex(t => t.id === dragId);
    const to = state.tabs.findIndex(t => t.id === over.dataset.tabId);
    if (from === -1 || to === -1) return;
    const [moved] = state.tabs.splice(from, 1);
    state.tabs.splice(to, 0, moved);
    dragId = null;
    persistSession();
    renderTabs();
  });
  document.addEventListener('dragend', () => { dragId = null; $$('.tab.dragging').forEach(t => t.classList.remove('dragging')); });

  // Tab context menu
  document.addEventListener('contextmenu', e => {
    const tab = e.target.closest('.tab[data-tab-id]');
    if (tab) { e.preventDefault(); showTabMenu(tab.dataset.tabId, e.clientX, e.clientY); return; }
    e.preventDefault();
    showPageMenu(e.clientX, e.clientY);
  });

  // Selects & inputs inside panels
  document.addEventListener('change', e => {
    const sel = e.target.closest('select[data-action="set-pref-select"]');
    if (sel) {
      const val = sel.dataset.pref === 'wallpaper' ? Number(sel.value) : sel.value;
      prefs = store.setPrefs({ [sel.dataset.pref]: val });
      applyTheme(); renderToolbar(); renderContent(true); renderDropdown();
    }
  });
  document.addEventListener('input', e => {
    const inp = e.target.closest('[data-input="history-search"]');
    if (inp) { state.ui.historyQuery = inp.value; renderContent(true); const again = $('#history-search'); if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); } }
  });

  // New tab page search
  document.addEventListener('submit', e => {
    if (e.target.id === 'ntp-search-form') {
      e.preventDefault();
      const q = $('#ntp-search').value;
      if (q.trim()) navigate(q);
    }
    if (e.target.id === 'signin-form') {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      const email = e.target.elements.email.value.trim();
      if (name && email) signIn({ name, email });
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeys);

  // Real site favicons (see handleFaviconError)
  document.addEventListener('error', handleFaviconError, true);

  // Desktop build: the native page view follows the window geometry
  window.addEventListener('resize', syncNativeView);

  // React to OS theme changes when following the system
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (prefs.theme === 'system') applyTheme(); });
}

function handleKeys(e) {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (key === 'escape') { closeOverlays(); return; }

  if (mod && key === 'l') { e.preventDefault(); $('#url-input').focus(); return; }
  if (mod && key === 'k') { e.preventDefault(); openPalette(); return; }
  if (mod && key === 't' && e.shiftKey) { e.preventDefault(); reopenClosedTab(); return; }
  if (mod && key === 't') { e.preventDefault(); createTab('standard'); return; }
  if (mod && key === 'w') { e.preventDefault(); if (state.activeTabId) closeTab(state.activeTabId); return; }
  if (mod && key === 'r') { e.preventDefault(); reloadContent(true); return; }
  if (mod && key === 'j') { e.preventDefault(); state.panel = 'downloads'; contentKey = ''; renderAll(); return; }
  if (mod && key === 'h') { e.preventDefault(); state.panel = 'history'; contentKey = ''; renderAll(); return; }
  if (mod && key === 'b') { e.preventDefault(); state.panel = 'bookmarks'; contentKey = ''; renderAll(); return; }
  if (mod && key === 'n' && e.shiftKey) { e.preventDefault(); createTab('tor'); return; }
  if (mod && key === 'n') { e.preventDefault(); createTab('private'); return; }
  if (mod && key === ',') { e.preventDefault(); state.panel = 'settings'; contentKey = ''; renderAll(); return; }
  if (mod && (key === '=' || key === '+')) { e.preventDefault(); setZoom(0.1); return; }
  if (mod && key === '-') { e.preventDefault(); setZoom(-0.1); return; }
  if (mod && key === '0') { e.preventDefault(); ACTIONS['zoom-reset'](); return; }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); return; }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward(); return; }
  if (e.key === 'F5') { e.preventDefault(); reloadContent(true); }
}

/* ----------------------------- menus ------------------------------ */

function showMenu(items, x, y) {
  const existing = $('#context-menu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';
  menu.style.top = `${y}px`;
  menu.style.left = `${x}px`;
  menu.innerHTML = items === 'separator'
    ? ''
    : items.map(i => i === '-' ? '<div class="menu-sep"></div>' : `<button class="menu-item" data-action="${i.action}" ${i.id ? `data-id="${i.id}"` : ''} ${i.panel ? `data-panel="${i.panel}"` : ''} ${i.pref ? `data-pref="${i.pref}"` : ''}>${icon(i.icon)}<span>${escapeHtml(i.label)}</span></button>`).join('');
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;
  const close = e => {
    if (!e.target.closest('#context-menu')) { menu.remove(); document.removeEventListener('click', close, true); }
  };
  setTimeout(() => document.addEventListener('click', close, true), 0);
}

function showTabMenu(id, x, y) {
  const t = state.tabs.find(v => v.id === id);
  if (!t) return;
  const items = [
    { action: 'duplicate-tab', id, label: 'Duplicate', icon: 'copy' },
    { action: 'pin-tab', id, label: t.pinned ? 'Unpin tab' : 'Pin tab', icon: 'pin' },
    { action: 'mute-tab', id, label: t.muted ? 'Unmute site' : 'Mute site', icon: t.muted ? 'volume' : 'mute' },
    { action: 'reload', label: 'Reload', icon: 'reload' },
    '-',
    { action: 'toggle-star', label: 'Bookmark this page', icon: 'star' },
    { action: 'new-tab', label: 'New tab to the right', icon: 'plus' },
    '-',
    { action: 'close-tab', id, label: 'Close tab', icon: 'close' },
    { action: 'close-tabs-others', id, label: 'Close other tabs', icon: 'close' },
  ];
  showMenu(items, x, y);
}

function showPageMenu(x, y) {
  const items = [
    { action: 'back', label: 'Back', icon: 'back' },
    { action: 'forward', label: 'Forward', icon: 'forward' },
    { action: 'reload', label: 'Reload', icon: 'reload' },
    '-',
    { action: 'toggle-star', label: 'Bookmark this page', icon: 'star' },
    { action: 'open-url-new', label: 'Open address in new tab', icon: 'external' },
    '-',
    { action: 'zoom-in', label: 'Zoom in', icon: 'zoomIn' },
    { action: 'zoom-out', label: 'Zoom out', icon: 'zoomOut' },
    { action: 'zoom-reset', label: 'Reset zoom', icon: 'refresh' },
    '-',
    { action: 'open-panel', panel: 'settings', label: 'Settings', icon: 'settings' },
    { action: 'open-panel', panel: 'about', label: 'About', icon: 'info' },
  ];
  showMenu(items, x, y);
}

/* ------------------------------------------------------------------ */
/*  Boot                                                              */
/* ------------------------------------------------------------------ */

function boot() {
  ensureShell();
  applyTheme();

  // Desktop build: use the favicon the open page actually declared.
  if (electron && electron.onTabFavicon) {
    electron.onTabFavicon(({ tabId, favicon }) => {
      const t = state.tabs.find(x => x.id === tabId);
      if (!t || !favicon || t.favicon === favicon) return;
      t.favicon = favicon;
      renderTabs();
    });
  }

  if (!state.tabs.length) {
    createTab('standard');
  } else {
    if (!state.tabs.some(t => t.id === state.activeTabId)) state.activeTabId = state.tabs[0].id;
    renderAll();
  }

  persistSession();

  // Keep the status/omnibox honest as time passes
  setInterval(() => { if (state.panel === 'history') renderContent(true); }, 60000);
}

boot();
