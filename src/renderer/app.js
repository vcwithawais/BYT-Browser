// ===== Secure Browser — Renderer Process (Browser Chrome) =====
// This UI runs in the Electron renderer process AND in the web preview (Vite dev server).
// In Electron, page navigation is handled via BrowserView; in the web preview,
// an <iframe> is used as a fallback (some sites block embedding via X-Frame-Options).

const STORAGE_KEY = 'secure-browser-state';

// ----- State -----
let state = {
  tabs: [],
  activeTabId: null,
};

let nextTabId = 1;

// ----- Icon set (inline SVG — Chromium-family look) -----
const ICONS = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',
  forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>',
  reload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L21 10"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17z"/></svg>',
  tor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 0 1 9 9"/><path d="M12 7a5 5 0 0 1 5 5"/><path d="M12 11.5a.5.5 0 0 1 .5.5"/><path d="M12 21a9 9 0 0 1-9-9"/><path d="M12 17a5 5 0 0 1-5-5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 9 5.5 12l3 3"/><path d="M15.5 9l3 3-3 3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7l1 13h9l1-13"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 17l-5.3 2.6 1-5.8L3.5 9.7l5.9-.9L12 3.5z"/></svg>'
};

// ----- Persistence (session-only, cleared on close) -----
// Per spec: strictly stateless. We use sessionStorage so nothing survives a restart.
function saveState() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore quota errors
  }
}

function loadState() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.tabs && parsed.tabs.length > 0) {
        state = parsed;
        nextTabId = Math.max(...parsed.tabs.map(t => t.id)) + 1;
        return true;
      }
    }
  } catch (e) {
    // ignore
  }
  return false;
}

// ----- Tab Model -----
function createTab(mode = 'standard', url = '') {
  const tab = {
    id: nextTabId++,
    mode,         // 'standard' | 'tor'
    url,
    title: url ? url : 'New Tab',
    history: url ? [url] : [],
    historyIndex: url ? 0 : -1,
    canGoBack: false,
    canGoForward: false,
  };
  state.tabs.push(tab);
  state.activeTabId = tab.id;
  saveState();
  return tab;
}

function getActiveTab() {
  return state.tabs.find(t => t.id === state.activeTabId);
}

function closeTab(tabId) {
  const idx = state.tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  state.tabs.splice(idx, 1);
  if (state.activeTabId === tabId) {
    if (state.tabs.length > 0) {
      // Activate the previous tab, or the first one
      const newIdx = Math.min(idx, state.tabs.length - 1);
      state.activeTabId = state.tabs[newIdx].id;
    } else {
      // No tabs left — create a fresh one
      createTab('standard');
    }
  }
  saveState();
}

function activateTab(tabId) {
  state.activeTabId = tabId;
  saveState();
}

function navigateTo(url) {
  const tab = getActiveTab();
  if (!tab) return;
  // Normalize URL
  let finalUrl = url.trim();
  if (!finalUrl) return;
  if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith('about:')) {
    // Check if it looks like a domain
    if (/\.[a-z]{2,}/i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    } else {
      // Treat as search query
      finalUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(finalUrl);
    }
  }
  tab.url = finalUrl;
  tab.title = finalUrl;
  // Reset forward history
  tab.history = tab.history.slice(0, tab.historyIndex + 1);
  tab.history.push(finalUrl);
  tab.historyIndex = tab.history.length - 1;
  tab.canGoBack = tab.historyIndex > 0;
  tab.canGoForward = false;
  saveState();
}

function goBack() {
  const tab = getActiveTab();
  if (!tab || !tab.canGoBack) return;
  tab.historyIndex--;
  tab.url = tab.history[tab.historyIndex];
  tab.title = tab.url;
  tab.canGoBack = tab.historyIndex > 0;
  tab.canGoForward = true;
  saveState();
}

function goForward() {
  const tab = getActiveTab();
  if (!tab || !tab.canGoForward) return;
  tab.historyIndex++;
  tab.url = tab.history[tab.historyIndex];
  tab.title = tab.url;
  tab.canGoBack = true;
  tab.canGoForward = tab.historyIndex < tab.history.length - 1;
  saveState();
}

function reload() {
  const tab = getActiveTab();
  if (!tab || !tab.url) return;
  // Force a re-render by toggling a reload counter
  render();
}

function goHome() {
  const tab = getActiveTab();
  if (tab) {
    tab.url = '';
    tab.title = 'New Tab';
    saveState();
    render();
  }
}

function toggleMenu() {
  const dropdown = document.getElementById('dropdown');
  if (dropdown) dropdown.classList.toggle('open');
}

// ----- Rendering -----
const app = document.getElementById('app');

function render() {
  const tab = getActiveTab();
  if (!tab) return;

  app.innerHTML = `
    <!-- Tab strip -->
    <header class="title-bar">
      <div class="tab-strip">
        ${state.tabs.map(t => `
          <div class="tab ${t.id === state.activeTabId ? 'active' : ''} ${t.mode}-mode"
               data-tab-id="${t.id}" title="${escapeHtml(t.title)}">
            <span class="tab-favicon ${t.mode}">${t.mode === 'tor' ? ICONS.tor : ICONS.globe}</span>
            <span class="tab-title">${escapeHtml(t.title)}</span>
            <span class="tab-close" data-close-id="${t.id}" title="Close tab">${ICONS.close}</span>
          </div>
        `).join('')}
        <button class="tab-new" id="new-tab-btn" title="New tab">${ICONS.plus}</button>
      </div>
    </header>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="nav-group">
        <button class="icon-btn" id="back-btn" title="Back" ${!tab.canGoBack ? 'disabled' : ''}>${ICONS.back}</button>
        <button class="icon-btn" id="fwd-btn" title="Forward" ${!tab.canGoForward ? 'disabled' : ''}>${ICONS.forward}</button>
        <button class="icon-btn" id="reload-btn" title="Reload">${ICONS.reload}</button>
        <button class="icon-btn" id="home-btn" title="Home">${ICONS.home}</button>
      </div>

      <div class="omnibox ${tab.mode}">
        <span class="security-indicator ${tab.mode}"
              title="${tab.mode === 'tor' ? 'Tor routing active — DNS proxied' : 'Connection security'}">
          ${tab.mode === 'tor' ? ICONS.tor : (tab.url && tab.url.startsWith('https') ? ICONS.lock : ICONS.globe)}
        </span>
        <input type="text" id="url-input" placeholder="Search or enter address"
               value="${escapeHtml(tab.url || '')}" spellcheck="false" autocomplete="off" />
        <span class="omnibox-trailing" title="${tab.mode === 'tor' ? 'Privacy shield: Tor' : 'Privacy shield: on'}">
          <span class="shield ${tab.mode}">${ICONS.shield}</span>
        </span>
      </div>

      <div class="tool-group">
        <button class="icon-btn" id="menu-btn" title="Menu">${ICONS.menu}</button>
      </div>
    </div>

    <!-- Body: sidebar + content -->
    <div class="browser-body">
      <nav class="sidebar" aria-label="Sidebar">
        <button class="rail-btn" id="rail-home" title="Home">${ICONS.home}</button>
        <button class="rail-btn" id="rail-tor" title="Tor privacy tab">${ICONS.tor}</button>
        <span class="rail-divider"></span>
        <button class="rail-btn" id="rail-menu" title="Menu">${ICONS.menu}</button>
      </nav>

      <main class="content-area" id="content-area">
        ${renderContent(tab)}
      </main>
    </div>

    <!-- Tor status bar -->
    <div class="tor-status ${tab.mode === 'tor' ? 'visible' : ''}">
      <span class="dot"></span>
      Tor routing active — all traffic proxied through the Tor network (DNS included). No history, cookies, or cache are persisted.
    </div>

    <!-- Dropdown menu -->
    <div class="dropdown" id="dropdown">
      <div class="dropdown-item" id="menu-new-standard">
        ${ICONS.globe}<span>New Standard Window</span>
      </div>
      <div class="dropdown-item" id="menu-new-tor">
        ${ICONS.tor}<span>New Tor Privacy Window</span>
      </div>
      <div class="dropdown-separator"></div>
      <div class="dropdown-item" id="menu-devtools">
        ${ICONS.code}<span>Toggle DevTools (F12)</span>
      </div>
      <div class="dropdown-item" id="menu-inspect">
        ${ICONS.search}<span>Inspect Element</span>
      </div>
      <div class="dropdown-separator"></div>
      <div class="dropdown-item" id="menu-clear">
        ${ICONS.trash}<span>Clear Session Data</span>
      </div>
    </div>
  `;

  attachEventListeners();
}

function renderContent(tab) {
  if (!tab.url) {
    // New tab page — Opera-style speed dial
    return `
      <div class="new-tab-page">
        <div class="ntp-inner">
          <div class="ntp-brand">
            <span class="ntp-logo ${tab.mode}">${tab.mode === 'tor' ? ICONS.tor : ICONS.shield}</span>
            <h1>Secure Browser</h1>
            <p class="ntp-sub">
              ${tab.mode === 'tor' ? 'Tor Privacy Mode — all traffic routed through Tor' : 'Standard Mode — stateless browsing, no history saved'}
            </p>
          </div>
          <div class="speed-dial">
            <a class="dial-tile" data-url="https://duckduckgo.com">
              <span class="dial-icon" style="--tile:#de5833">${ICONS.search}</span>
              <span class="dial-label">DuckDuckGo</span>
            </a>
            <a class="dial-tile" data-url="https://en.wikipedia.org">
              <span class="dial-icon" style="--tile:#8b8b8b">${ICONS.globe}</span>
              <span class="dial-label">Wikipedia</span>
            </a>
            <a class="dial-tile" data-url="https://example.com">
              <span class="dial-icon" style="--tile:#4c8bf5">${ICONS.globe}</span>
              <span class="dial-label">Example.com</span>
            </a>
            <a class="dial-tile" data-url="https://httpbin.org">
              <span class="dial-icon" style="--tile:#16b981">${ICONS.code}</span>
              <span class="dial-label">HTTPBin</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // In the web preview, we use an iframe. In Electron, a BrowserView would be used instead.
  // Many sites send X-Frame-Options/CSP headers that block embedding — we handle that gracefully.
  return `<iframe class="content-frame" src="${escapeHtml(tab.url)}" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
           referrerpolicy="no-referrer" id="content-frame"></iframe>
          <div class="blocked-overlay" id="blocked-overlay" style="display:none">
            <span class="blocked-icon">${ICONS.shield}</span>
            <h2>This site can't be embedded</h2>
            <p>The site has security headers (X-Frame-Options or CSP) that prevent it from loading inside the browser preview.
               In the full Electron app, pages render in an isolated BrowserView and are not subject to this limitation.</p>
            <a href="${escapeHtml(tab.url)}" target="_blank" rel="noopener noreferrer" class="blocked-link">Open in new tab ↗</a>
          </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ----- Event Handling -----
function attachEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab[data-tab-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.tab-close')) return;
      activateTab(parseInt(el.dataset.tabId));
      render();
    });
  });

  // Tab close
  document.querySelectorAll('.tab-close[data-close-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(parseInt(el.dataset.closeId));
      render();
    });
  });

  // New tab
  document.getElementById('new-tab-btn').addEventListener('click', () => {
    const active = getActiveTab();
    createTab(active ? active.mode : 'standard');
    render();
  });

  // Navigation buttons
  document.getElementById('back-btn').addEventListener('click', goBack);
  document.getElementById('fwd-btn').addEventListener('click', goForward);
  document.getElementById('reload-btn').addEventListener('click', reload);
  document.getElementById('home-btn').addEventListener('click', goHome);

  // Address bar
  const urlInput = document.getElementById('url-input');
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigateTo(urlInput.value);
      render();
    }
  });

  // Speed dial shortcuts
  document.querySelectorAll('.dial-tile[data-url]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.url);
      render();
    });
  });

  // Sidebar rail
  document.getElementById('rail-home').addEventListener('click', goHome);
  document.getElementById('rail-tor').addEventListener('click', () => {
    createTab('tor');
    render();
  });
  document.getElementById('rail-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Menu
  const menuBtn = document.getElementById('menu-btn');
  const dropdown = document.getElementById('dropdown');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => dropdown.classList.remove('open'));

  // Menu items
  document.getElementById('menu-new-standard').addEventListener('click', () => {
    createTab('standard');
    render();
  });
  document.getElementById('menu-new-tor').addEventListener('click', () => {
    createTab('tor');
    render();
  });
  document.getElementById('menu-devtools').addEventListener('click', () => {
    // In Electron, this toggles DevTools via IPC. In web preview, show a note.
    alert('DevTools: In the Electron app, press F12 or Ctrl+Shift+I to toggle DevTools for the active webContents.\n\nIn the web preview, use your browser\'s DevTools (F12).');
  });
  document.getElementById('menu-inspect').addEventListener('click', () => {
    alert('Inspect Element: In the Electron app, right-click any element and select "Inspect Element" to open DevTools at that position.');
  });
  document.getElementById('menu-clear').addEventListener('click', () => {
    sessionStorage.clear();
    state = { tabs: [], activeTabId: null };
    nextTabId = 1;
    createTab('standard');
    render();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Detect blocked iframe
  const frame = document.getElementById('content-frame');
  if (frame) {
    let loaded = false;
    frame.addEventListener('load', () => { loaded = true; });
    setTimeout(() => {
      if (!loaded) {
        const overlay = document.getElementById('blocked-overlay');
        if (overlay) overlay.style.display = 'flex';
      }
    }, 3000);
  }
}

function handleKeyboardShortcuts(e) {
  // F12 or Ctrl+Shift+I — toggle DevTools
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    e.preventDefault();
    alert('DevTools: In the Electron app, this toggles Chromium DevTools for the active webContents.');
  }
  // Ctrl+T — new tab
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    const active = getActiveTab();
    createTab(active ? active.mode : 'standard');
    render();
  }
  // Ctrl+W — close tab
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    if (state.activeTabId) {
      closeTab(state.activeTabId);
      render();
    }
  }
}

// ----- Context Menu (right-click) -----
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  // In Electron, this would call webContents.inspectElement(x, y)
  // In web preview, we show a custom context menu
  showContextMenu(e.clientX, e.clientY);
});

function showContextMenu(x, y) {
  // Remove any existing context menu
  const existing = document.getElementById('context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';
  menu.style.top = `${y}px`;
  menu.style.left = `${x}px`;
  menu.innerHTML = `
    <div class="dropdown-item" id="ctx-back">${ICONS.back}<span>Back</span></div>
    <div class="dropdown-item" id="ctx-forward">${ICONS.forward}<span>Forward</span></div>
    <div class="dropdown-item" id="ctx-reload">${ICONS.reload}<span>Reload</span></div>
    <div class="dropdown-separator"></div>
    <div class="dropdown-item" id="ctx-inspect">${ICONS.search}<span>Inspect Element</span></div>
    <div class="dropdown-separator"></div>
    <div class="dropdown-item" id="ctx-newtab">${ICONS.plus}<span>New Tab</span></div>
  `;
  document.body.appendChild(menu);

  document.getElementById('ctx-back').addEventListener('click', () => { goBack(); render(); menu.remove(); });
  document.getElementById('ctx-forward').addEventListener('click', () => { goForward(); render(); menu.remove(); });
  document.getElementById('ctx-reload').addEventListener('click', () => { reload(); menu.remove(); });
  document.getElementById('ctx-inspect').addEventListener('click', () => {
    menu.remove();
    alert('Inspect Element: In the Electron app, this opens DevTools at position (' + x + ', ' + y + ') via webContents.inspectElement().');
  });
  document.getElementById('ctx-newtab').addEventListener('click', () => {
    const active = getActiveTab();
    createTab(active ? active.mode : 'standard');
    render();
    menu.remove();
  });

  // Close on click elsewhere
  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 0);
}

// ----- Init -----
function init() {
  if (!loadState()) {
    createTab('standard');
  }
  render();
}

init();
