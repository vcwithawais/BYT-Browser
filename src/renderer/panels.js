// ===== Internal pages =====
// Every internal surface (new tab / speed dial, bookmarks, history, downloads,
// settings, autofill, account, apps, tab switcher, shortcuts, about) is rendered
// here as a pure function of the current state passed in as `ctx`.

import { ICONS } from './icons.js';
import { SEARCH_ENGINES, GOOGLE_APPS, WALLPAPERS, ACCENTS } from './data.js';
import { escapeHtml, hostOf, prettyUrl, faviconColor, faviconLetter, relativeTime, initials } from './util.js';

const icon = k => ICONS[k] || '';

function faviconTile(item) {
  const host = hostOf(item.url) || item.title || '';
  const color = item.color || faviconColor(host);
  const letter = faviconLetter(host);
  return `<span class="fav-badge" style="--fav:${color}">${escapeHtml(letter)}</span>`;
}

/* ------------------------------------------------------------------ */
/*  New tab page — speed dial                                          */
/* ------------------------------------------------------------------ */

export function renderNewTab(ctx) {
  const wallpaper = WALLPAPERS[ctx.prefs.wallpaper % WALLPAPERS.length];
  const engine = SEARCH_ENGINES[ctx.prefs.searchEngine] || SEARCH_ENGINES.google;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = ctx.profile ? ctx.profile.name.split(' ')[0] : '';

  const tiles = ctx.shortcuts.map(s => `
    <div class="sc-tile" data-action="open-url" data-url="${escapeHtml(s.url)}" title="${escapeHtml(s.title)}">
      ${faviconTile(s)}
      <span class="sc-label">${escapeHtml(s.title)}</span>
      <button class="sc-edit" data-action="edit-shortcut" data-id="${escapeHtml(s.id)}" title="Edit shortcut" aria-label="Edit shortcut">${icon('edit')}</button>
      <button class="sc-del" data-action="delete-shortcut" data-id="${escapeHtml(s.id)}" title="Remove shortcut" aria-label="Remove shortcut">${icon('close')}</button>
    </div>
  `).join('');

  return `
    <div class="ntp" style="--wall:${wallpaper.css}">
      <div class="ntp-veil"></div>
      <div class="ntp-body">
        <div class="ntp-head">
          <span class="ntp-logo">${icon('shield')}</span>
          <h1>Secure Browser</h1>
          <p>${greeting}${name ? ', ' + escapeHtml(name) : ''} — type a URL or search ${escapeHtml(engine.name)}</p>
        </div>

        <form class="ntp-search" id="ntp-search-form">
          <span class="ntp-search-ico">${icon('search')}</span>
          <input id="ntp-search" type="text" placeholder="Search ${escapeHtml(engine.name)} or enter a URL" autocomplete="off" spellcheck="false" />
          <button type="submit" class="ntp-search-go" aria-label="Go">${icon('chevronRight')}</button>
        </form>

        <div class="sc-grid">
          ${tiles}
          <button class="sc-tile sc-add" data-action="add-shortcut">
            <span class="sc-plus">${icon('plus')}</span>
            <span class="sc-label">Add shortcut</span>
          </button>
        </div>

        <div class="ntp-foot">
          ${ctx.prefs.verticalTabs ? '' : `<button class="link-btn" data-action="open-panel" data-panel="tabs">${icon('tabs')} Tabs</button>`}
          <button class="link-btn" data-action="open-panel" data-panel="bookmarks">${icon('bookmark')} Bookmarks</button>
          <button class="link-btn" data-action="open-panel" data-panel="history">${icon('history')} History</button>
          <button class="link-btn" data-action="open-panel" data-panel="apps">${icon('grid')} Apps</button>
        </div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  Panel shell + individual internal pages                            */
/* ------------------------------------------------------------------ */

const PANEL_TITLES = {
  bookmarks: 'Bookmarks',
  history: 'History',
  downloads: 'Downloads',
  settings: 'Settings',
  autofill: 'Autofill & passwords',
  account: 'Your account',
  apps: 'Google apps',
  tabs: 'Open tabs',
  shortcuts: 'Speed dial',
  about: 'About this browser',
};

function shell(title, body, actions = '') {
  return `
    <div class="panel">
      <header class="panel-head">
        <button class="icon-btn" data-action="close-panel" title="Close">${icon('back')}</button>
        <h2 class="panel-title">${escapeHtml(title)}</h2>
        <div class="panel-actions">${actions}</div>
      </header>
      <div class="panel-body">${body}</div>
    </div>
  `;
}

function empty(iconKey, title, text) {
  return `<div class="empty"><span class="empty-ico">${icon(iconKey)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
}

function listItem({ favicon = '', title, sub, actions = '' }) {
  return `
    <li class="list-item">
      <span class="li-main">
        ${favicon}
        <span class="li-text">
          <span class="li-title">${escapeHtml(title)}</span>
          ${sub ? `<span class="li-sub">${escapeHtml(sub)}</span>` : ''}
        </span>
      </span>
      <span class="li-actions">${actions}</span>
    </li>
  `;
}

export function renderPanel(name, ctx) {
  switch (name) {
    case 'bookmarks': return renderBookmarks(ctx);
    case 'history': return renderHistory(ctx);
    case 'downloads': return renderDownloads(ctx);
    case 'settings': return renderSettings(ctx);
    case 'autofill': return renderAutofill(ctx);
    case 'account': return renderAccount(ctx);
    case 'apps': return renderApps(ctx);
    case 'tabs': return renderTabSwitcher(ctx);
    case 'shortcuts': return renderShortcutsPanel(ctx);
    case 'about': return renderAbout(ctx);
    default: return shell(PANEL_TITLES[name] || 'Page', '');
  }
}

/* ---------------------------- Bookmarks ---------------------------- */

function renderBookmarks(ctx) {
  const actions = `
    <button class="btn btn-ghost" data-action="bookmarks-import">Import</button>
    <button class="btn btn-ghost" data-action="bookmarks-export">Export</button>
    <button class="btn" data-action="bookmark-current">${icon('plus')} Add current page</button>`;
  if (!ctx.bookmarks.length) {
    return shell('Bookmarks', empty('bookmark', 'No bookmarks yet', 'Star any page from the address bar to keep it here.'), actions);
  }
  const body = `<ul class="list">${ctx.bookmarks.map(b => listItem({
    favicon: faviconTile(b),
    title: b.title || hostOf(b.url),
    sub: prettyUrl(b.url),
    actions: `
      <button class="icon-btn sm" data-action="open-url" data-url="${escapeHtml(b.url)}" title="Open">${icon('external')}</button>
      <button class="icon-btn sm" data-action="bookmark-edit" data-id="${escapeHtml(b.id)}" title="Edit">${icon('edit')}</button>
      <button class="icon-btn sm" data-action="bookmark-delete" data-id="${escapeHtml(b.id)}" title="Delete">${icon('trash')}</button>`,
  })).join('')}</ul>
  <div class="panel-foot"><button class="btn btn-ghost" data-action="bookmarks-open-all">${icon('external')} Open all (${ctx.bookmarks.length})</button></div>`;
  return shell('Bookmarks', body, actions);
}

/* ----------------------------- History ----------------------------- */

function renderHistory(ctx) {
  const q = (ctx.ui.historyQuery || '').toLowerCase();
  const items = q
    ? ctx.history.filter(h => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q))
    : ctx.history;
  const actions = `<button class="btn btn-ghost" data-action="history-clear">${icon('trash')} Clear history</button>`;
  const search = `
    <div class="search-row">
      <span>${icon('search')}</span>
      <input id="history-search" data-input="history-search" placeholder="Search history" value="${escapeHtml(ctx.ui.historyQuery || '')}" />
    </div>`;
  const body = search + (items.length
    ? `<ul class="list">${items.map(h => listItem({
        favicon: faviconTile({ url: h.url, title: h.title }),
        title: h.title || hostOf(h.url),
        sub: `${prettyUrl(h.url)} · ${relativeTime(h.at)}`,
        actions: `
          <button class="icon-btn sm" data-action="open-url" data-url="${escapeHtml(h.url)}" title="Open">${icon('external')}</button>
          <button class="icon-btn sm" data-action="history-delete" data-id="${escapeHtml(h.id)}" title="Remove">${icon('close')}</button>`,
      })).join('')}</ul>`
    : empty('history', q ? 'No matches' : 'No history yet', q ? 'Try a different search term.' : 'Pages you visit are listed here for this session only — nothing is written to disk.'));
  return shell('History', body, actions);
}

/* ---------------------------- Downloads ---------------------------- */

function renderDownloads(ctx) {
  const actions = ctx.downloads.length ? `<button class="btn btn-ghost" data-action="downloads-clear">${icon('trash')} Clear list</button>` : '';
  const body = ctx.downloads.length
    ? `<ul class="list">${ctx.downloads.map(d => listItem({
        favicon: `<span class="fav-badge" style="--fav:#1a73e8">${icon('download')}</span>`,
        title: d.name,
        sub: `${d.status} · ${relativeTime(d.at)}`,
        actions: `<button class="icon-btn sm" data-action="download-remove" data-id="${escapeHtml(d.id)}" title="Remove">${icon('close')}</button>`,
      })).join('')}</ul>`
    : empty('download', 'No downloads', 'Files you download appear here. Downloading arbitrary remote files is available in the desktop build.');
  return shell('Downloads', body, actions);
}

/* ----------------------------- Settings ---------------------------- */

function renderSettings(ctx) {
  const p = ctx.prefs;
  const seg = (name, values, current) => `
    <div class="seg">${values.map(v => `
      <button class="seg-btn ${v.value === current ? 'on' : ''}" data-action="set-pref" data-pref="${name}" data-value="${v.value}">
        ${v.icon ? icon(v.icon) : ''}<span>${escapeHtml(v.label)}</span>
      </button>`).join('')}</div>`;

  const toggle = (prefKey, label, hint) => `
    <div class="row">
      <span class="row-text"><span class="row-title">${escapeHtml(label)}</span>${hint ? `<span class="row-hint">${escapeHtml(hint)}</span>` : ''}</span>
      <button class="switch ${p[prefKey] ? 'on' : ''}" data-action="toggle-pref" data-pref="${prefKey}" role="switch" aria-checked="${!!p[prefKey]}"><span></span></button>
    </div>`;

  const engineOpts = Object.entries(SEARCH_ENGINES).map(([k, v]) => `<option value="${k}" ${p.searchEngine === k ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('');
  const wallOpts = WALLPAPERS.map((w, i) => `<option value="${i}" ${p.wallpaper === i ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('');

  const body = `
    <section class="panel-section">
      <h3>Appearance</h3>
      <div class="row"><span class="row-text"><span class="row-title">Theme</span></span>
        ${seg('theme', [{ value: 'light', label: 'Light', icon: 'sun' }, { value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'system', label: 'System' }], p.theme)}
      </div>
      <div class="row"><span class="row-text"><span class="row-title">Accent colour</span></span>
        <div class="swatches">${ACCENTS.map(c => `<button class="swatch ${p.accent === c ? 'on' : ''}" style="--c:${c}" data-action="set-pref" data-pref="accent" data-value="${c}" aria-label="${c}"></button>`).join('')}</div>
      </div>
      <div class="row"><span class="row-text"><span class="row-title">New tab wallpaper</span></span>
        <select class="select" data-action="set-pref-select" data-pref="wallpaper">${wallOpts}</select>
      </div>
      <div class="row"><span class="row-text"><span class="row-title">Density</span></span>
        ${seg('density', [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }], p.density)}
      </div>
    </section>

    <section class="panel-section">
      <h3>Layout</h3>
      ${toggle('verticalTabs', 'Vertical tabs', 'Stack tabs down the left edge, Edge-style')}
      ${toggle('bookmarksBar', 'Show bookmarks bar', '')}
      ${toggle('sidebar', 'Show sidebar', 'Quick access rail on the left')}
      ${toggle('showHomeButton', 'Show home button', '')}
    </section>

    <section class="panel-section">
      <h3>Search</h3>
      <div class="row"><span class="row-text"><span class="row-title">Search engine</span><span class="row-hint">Used by the address bar and new tab</span></span>
        <select class="select" data-action="set-pref-select" data-pref="searchEngine">${engineOpts}</select>
      </div>
      ${toggle('suggestFromHistory', 'Suggest from history & bookmarks', 'Show local suggestions as you type')}
    </section>

    <section class="panel-section">
      <h3>Privacy &amp; security</h3>
      ${toggle('shield', 'Privacy shield', 'Block known trackers where the page allows it')}
      ${toggle('blockThirdPartyCookies', 'Block third-party cookies', '')}
      ${toggle('doNotTrack', 'Send “Do Not Track”', '')}
      <div class="row"><span class="row-text"><span class="row-title">Browsing data</span><span class="row-hint">Session history, closed tabs</span></span>
        <button class="btn btn-ghost" data-action="clear-browsing-data">${icon('trash')} Clear</button>
      </div>
      <div class="row"><span class="row-text"><span class="row-title">Tor privacy mode</span><span class="row-hint">Route a tab through the Tor network (desktop build)</span></span>
        <button class="btn" data-action="new-tor-tab">${icon('tor')} New Tor tab</button>
      </div>
    </section>

    <section class="panel-section">
      <h3>Your data</h3>
      <div class="row"><span class="row-text"><span class="row-title">Export everything</span><span class="row-hint">Bookmarks, shortcuts, autofill, settings</span></span>
        <button class="btn btn-ghost" data-action="data-export">${icon('download')} Export</button>
      </div>
      <div class="row"><span class="row-text"><span class="row-title">Import data</span><span class="row-hint">Restore a previous export</span></span>
        <button class="btn btn-ghost" data-action="data-import">${icon('folder')} Import</button>
      </div>
      <div class="row danger"><span class="row-text"><span class="row-title">Reset browser</span><span class="row-hint">Erase all settings, bookmarks and saved data</span></span>
        <button class="btn btn-danger" data-action="data-wipe">${icon('trash')} Reset</button>
      </div>
    </section>
  `;
  return shell('Settings', body);
}

/* ---------------------------- Autofill ----------------------------- */

function renderAutofill(ctx) {
  const addBtn = (action, label) => `<button class="btn" data-action="${action}">${icon('plus')} ${label}</button>`;

  const addr = ctx.addresses.length
    ? `<ul class="list">${ctx.addresses.map(a => listItem({
        favicon: `<span class="fav-badge" style="--fav:#0f9d58">${icon('mapPin')}</span>`,
        title: a.name || a.email || 'Address',
        sub: [a.line1, a.city, a.postal, a.country].filter(Boolean).join(', '),
        actions: `<button class="icon-btn sm" data-action="autofill-edit" data-kind="addresses" data-id="${escapeHtml(a.id)}" title="Edit">${icon('edit')}</button>
                  <button class="icon-btn sm" data-action="autofill-delete" data-kind="addresses" data-id="${escapeHtml(a.id)}" title="Delete">${icon('trash')}</button>`,
      })).join('')}</ul>`
    : `<p class="muted">No saved addresses.</p>`;

  const cards = ctx.cards.length
    ? `<ul class="list">${ctx.cards.map(c => listItem({
        favicon: `<span class="fav-badge" style="--fav:#f4b400">${icon('card')}</span>`,
        title: c.name || 'Card',
        sub: `•••• •••• •••• ${escapeHtml(c.last4 || '----')} · expires ${escapeHtml(c.expiry || '--/--')}`,
        actions: `<button class="icon-btn sm" data-action="autofill-edit" data-kind="cards" data-id="${escapeHtml(c.id)}" title="Edit">${icon('edit')}</button>
                  <button class="icon-btn sm" data-action="autofill-delete" data-kind="cards" data-id="${escapeHtml(c.id)}" title="Delete">${icon('trash')}</button>`,
      })).join('')}</ul>`
    : `<p class="muted">No saved payment methods.</p>`;

  const logins = ctx.logins.length
    ? `<ul class="list">${ctx.logins.map(l => listItem({
        favicon: faviconTile({ url: l.site }),
        title: l.site,
        sub: `${l.username} · ${'•'.repeat(Math.min(12, (l.password || '').length || 8))}`,
        actions: `<button class="icon-btn sm" data-action="login-reveal" data-id="${escapeHtml(l.id)}" title="Reveal">${icon('eye')}</button>
                  <button class="icon-btn sm" data-action="autofill-edit" data-kind="logins" data-id="${escapeHtml(l.id)}" title="Edit">${icon('edit')}</button>
                  <button class="icon-btn sm" data-action="autofill-delete" data-kind="logins" data-id="${escapeHtml(l.id)}" title="Delete">${icon('trash')}</button>`,
      })).join('')}</ul>`
    : `<p class="muted">No saved logins.</p>`;

  const body = `
    <div class="notice">${icon('info')}<span>Autofill data is stored locally in this browser and follows your account when sync is enabled. Nothing is uploaded unless you sign in.</span></div>
    <section class="panel-section">
      <div class="section-head"><h3>${icon('mapPin')} Addresses &amp; profiles</h3>${addBtn('address-add', 'Add')}</div>
      ${addr}
    </section>
    <section class="panel-section">
      <div class="section-head"><h3>${icon('card')} Payment methods</h3>${addBtn('card-add', 'Add')}</div>
      ${cards}
    </section>
    <section class="panel-section">
      <div class="section-head"><h3>${icon('key')} Passwords</h3>${addBtn('login-add', 'Add')}</div>
      ${logins}
    </section>
    <section class="panel-section">
      <div class="section-head"><h3>${icon('download')} Backup</h3>
        <button class="btn btn-ghost" data-action="autofill-export">Export autofill</button></div>
    </section>
  `;
  return shell('Autofill & passwords', body);
}

/* ----------------------------- Account ----------------------------- */

function renderAccount(ctx) {
  const p = ctx.profile;
  if (!p) {
    const body = `
      <div class="account-hero">
        <span class="account-avatar big">${icon('user')}</span>
        <h3>Sign in to Secure Browser</h3>
        <p>One account keeps your bookmarks, speed dial, autofill and settings in step across every device.</p>
      </div>
      <div class="notice">${icon('info')}<span>This build stores your profile locally. Real cross-device sync needs a sync service — see “About” for details.</span></div>
      <form class="form" id="signin-form">
        <label class="field"><span>Name</span><input name="name" placeholder="Ada Lovelace" required /></label>
        <label class="field"><span>Email</span><input name="email" type="email" placeholder="you@example.com" required /></label>
        <button class="btn btn-primary wide" type="submit">${icon('user')} Create account &amp; sign in</button>
      </form>`;
    return shell('Your account', body);
  }

  const synced = ctx.syncEnabled;
  const body = `
    <div class="account-hero">
      <span class="account-avatar big">${escapeHtml(initials(p.name))}</span>
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.email)}</p>
      <span class="sync-pill ${synced ? 'on' : ''}">${icon('sync')} ${synced ? 'Sync on' : 'Sync off'}</span>
    </div>

    <section class="panel-section">
      <h3>Sync</h3>
      <p class="muted">Choose what follows you between devices.</p>
      ${['bookmarks', 'shortcuts', 'autofill', 'settings'].map(k => `
        <div class="row"><span class="row-text"><span class="row-title">${escapeHtml(k[0].toUpperCase() + k.slice(1))}</span></span>
          <button class="switch ${ctx.syncScopes[k] ? 'on' : ''}" data-action="toggle-sync" data-scope="${k}" role="switch" aria-checked="${!!ctx.syncScopes[k]}"><span></span></button>
        </div>`).join('')}
      <div class="row"><span class="row-text"><span class="row-title">Sync now</span><span class="row-hint">Last sync ${escapeHtml(ctx.lastSync || 'never')}</span></span>
        <button class="btn" data-action="sync-now">${icon('sync')} Sync</button>
      </div>
    </section>

    <section class="panel-section">
      <h3>Account</h3>
      <div class="row"><span class="row-text"><span class="row-title">Backup all data</span></span>
        <button class="btn btn-ghost" data-action="data-export">${icon('download')} Export</button></div>
      <div class="row danger"><span class="row-text"><span class="row-title">Sign out</span></span>
        <button class="btn btn-ghost" data-action="account-signout">Sign out</button></div>
    </section>
  `;
  return shell('Your account', body);
}

/* --------------------------- Google apps --------------------------- */

function renderApps(ctx) {
  const body = `
    <div class="apps-grid">
      ${GOOGLE_APPS.map(a => `
        <button class="app-tile" data-action="open-url-new" data-url="${escapeHtml(a.href)}" title="${escapeHtml(a.name)}">
          <span class="app-ico" style="--a:${a.color}">${escapeHtml(a.letter)}</span>
          <span class="app-name">${escapeHtml(a.name)}</span>
        </button>`).join('')}
    </div>`;
  return shell('Google apps', body);
}

/* --------------------------- Tab switcher -------------------------- */

function renderTabSwitcher(ctx) {
  const body = ctx.tabs.length
    ? `<ul class="list">${ctx.tabs.map(t => `
        <li class="list-item ${t.id === ctx.activeTabId ? 'current' : ''}">
          <button class="li-main as-button" data-action="activate-tab" data-id="${t.id}">
            <span class="fav-badge" style="--fav:${t.mode === 'tor' ? '#7c3aed' : '#4285f4'}">${t.mode === 'tor' ? icon('tor') : faviconLetter(hostOf(t.url) || 'New')}</span>
            <span class="li-text">
              <span class="li-title">${escapeHtml(t.title || 'New tab')}</span>
              <span class="li-sub">${escapeHtml(t.url ? prettyUrl(t.url) : 'New tab page')}</span>
            </span>
          </button>
          <span class="li-actions">
            <button class="icon-btn sm" data-action="mute-tab" data-id="${t.id}" title="${t.muted ? 'Unmute' : 'Mute'}">${t.muted ? icon('mute') : icon('volume')}</button>
            <button class="icon-btn sm" data-action="close-tab" data-id="${t.id}" title="Close">${icon('close')}</button>
          </span>
        </li>`).join('')}</ul>`
    : empty('tabs', 'No open tabs', 'Open a new tab to get started.');
  return shell('Open tabs', body, `<button class="btn" data-action="new-tab">${icon('plus')} New tab</button>`);
}

/* --------------------------- Speed dial ---------------------------- */

function renderShortcutsPanel(ctx) {
  const body = ctx.shortcuts.length
    ? `<ul class="list">${ctx.shortcuts.map(s => listItem({
        favicon: faviconTile(s),
        title: s.title,
        sub: s.url,
        actions: `<button class="icon-btn sm" data-action="edit-shortcut" data-id="${escapeHtml(s.id)}" title="Edit">${icon('edit')}</button>
                  <button class="icon-btn sm" data-action="delete-shortcut" data-id="${escapeHtml(s.id)}" title="Delete">${icon('trash')}</button>`,
      })).join('')}</ul>`
    : `<p class="muted">No shortcuts yet.</p>`;
  return shell('Speed dial', body, `<button class="btn" data-action="add-shortcut">${icon('plus')} Add shortcut</button>`);
}

/* ------------------------------ About ------------------------------ */

function renderAbout(ctx) {
  const rows = [
    ['Engine', 'Chromium (Electron)'],
    ['Renderer', 'Vanilla JS + ES modules'],
    ['Search', (SEARCH_ENGINES[ctx.prefs.searchEngine] || SEARCH_ENGINES.google).name],
    ['Storage', 'Bookmarks / settings on device · browsing session in memory'],
    ['Tor', 'Desktop build: bundled Tor daemon, SOCKS5 on 127.0.0.1:9050'],
    ['Sync', ctx.syncEnabled ? 'Enabled (local profile)' : 'Local profile only'],
  ];
  const body = `
    <div class="account-hero">
      <span class="ntp-logo small">${icon('shield')}</span>
      <h3>Secure Browser</h3>
      <p>Stateless by design — no history, cache or cookies written to disk.</p>
    </div>
    <section class="panel-section">
      <h3>Details</h3>
      <ul class="kv">${rows.map(([k, v]) => `<li><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></li>`).join('')}</ul>
    </section>
    <section class="panel-section">
      <h3>Keyboard</h3>
      <ul class="kv">
        <li><span>New tab</span><span>Ctrl + T</span></li>
        <li><span>Close tab</span><span>Ctrl + W</span></li>
        <li><span>Reopen closed tab</span><span>Ctrl + Shift + T</span></li>
        <li><span>Focus address bar</span><span>Ctrl + L</span></li>
        <li><span>Command palette</span><span>Ctrl + K</span></li>
        <li><span>Open a Tor tab</span><span>Ctrl + Shift + N</span></li>
        <li><span>Downloads</span><span>Ctrl + J</span></li>
        <li><span>Settings</span><span>Ctrl + ,</span></li>
      </ul>
    </section>
  `;
  return shell('About this browser', body);
}
