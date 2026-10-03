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

// ----- Rendering -----
const app = document.getElementById('app');

function render() {
  const tab = getActiveTab();
  if (!tab) return;

  app.innerHTML = `
    <!-- Tab Bar -->
    <div class="tab-bar">
      ${state.tabs.map(t => `
        <div class="tab ${t.id === state.activeTabId ? 'active' : ''} ${t.mode}-mode"
             data-tab-id="${t.id}">
          ${t.mode === 'tor' ? '<span style="font-size:11px">🧅</span>' : ''}
          <span class="tab-title">${escapeHtml(t.title)}</span>
          <span class="tab-close" data-close-id="${t.id}">×</span>
        </div>
      `).join('')}
      <button class="tab-new" id="new-tab-btn" title="New Tab">+</button>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <button class="nav-btn" id="back-btn" ${!tab.canGoBack ? 'disabled' : ''} title="Back">←</button>
      <button class="nav-btn" id="fwd-btn" ${!tab.canGoForward ? 'disabled' : ''} title="Forward">→</button>
      <button class="nav-btn" id="reload-btn" title="Reload">⟳</button>
      <button class="nav-btn" id="home-btn" title="Home">⌂</button>
      <div class="address-bar ${tab.mode}">
        <span class="security-indicator ${tab.mode}">
          ${tab.mode === 'tor' ? '🧅 TOR' : (tab.url && tab.url.startsWith('https') ? '🔒' : '⚠')}
        </span>
        <input type="text" id="url-input" placeholder="Search or enter address"
               value="${escapeHtml(tab.url || '')}" />
      </div>
      <button class="menu-btn" id="menu-btn" title="Menu">☰</button>
    </div>

    <!-- Content Area -->
    <div class="content-area" id="content-area">
      ${renderContent(tab)}
    </div>

    <!-- Tor Status Bar -->
    <div class="tor-status ${tab.mode === 'tor' ? 'visible' : ''}">
      <span class="dot"></span>
      Tor routing active — all traffic proxied through the Tor network (DNS included). No history, cookies, or cache are persisted.
    </div>

    <!-- Dropdown Menu -->
    <div class="dropdown" id="dropdown">
      <div class="dropdown-item" id="menu-new-standard">
        <span>🌐</span> New Standard Window
      </div>
      <div class="dropdown-item" id="menu-new-tor">
        <span>🧅</span> New Tor Privacy Window
      </div>
      <div class="dropdown-separator"></div>
      <div class="dropdown-item" id="menu-devtools">
        <span>🔧</span> Toggle DevTools (F12)
      </div>
      <div class="dropdown-item" id="menu-inspect">
        <span>🔍</span> Inspect Element
      </div>
      <div class="dropdown-separator"></div>
      <div class="dropdown-item" id="menu-clear">
        <span>🗑</span> Clear Session Data
      </div>
    </div>
  `;

  attachEventListeners();
}

function renderContent(tab) {
  if (!tab.url) {
    // New tab page
    return `
      <div class="new-tab-page">
        <div class="logo">${tab.mode === 'tor' ? '🧅' : '🛡'}</div>
        <h1>Secure Browser</h1>
        <p style="color:var(--text-dim);font-size:14px">
          ${tab.mode === 'tor' ? 'Tor Privacy Mode — all traffic routed through Tor' : 'Standard Mode — stateless browsing, no history saved'}
        </p>
        <div class="shortcuts">
          <a class="shortcut" data-url="https://duckduckgo.com">
            <span class="shortcut-icon">🦆</span>
            <span class="shortcut-label">DuckDuckGo</span>
          </a>
          <a class="shortcut" data-url="https://en.wikipedia.org">
            <span class="shortcut-icon">📚</span>
            <span class="shortcut-label">Wikipedia</span>
          </a>
          <a class="shortcut" data-url="https://example.com">
            <span class="shortcut-icon">🌐</span>
            <span class="shortcut-label">Example.com</span>
          </a>
          <a class="shortcut" data-url="https://httpbin.org">
            <span class="shortcut-icon">🔧</span>
            <span class="shortcut-label">HTTPBin</span>
          </a>
        </div>
      </div>
    `;
  }

  // In the web preview, we use an iframe. In Electron, a BrowserView would be used instead.
  // Many sites send X-Frame-Options/CSP headers that block embedding — we handle that gracefully.
  return `<iframe class="content-frame" src="${escapeHtml(tab.url)}" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
           referrerpolicy="no-referrer" id="content-frame"></iframe>
          <div class="blocked-overlay" id="blocked-overlay" style="display:none">
            <span class="icon">🚫</span>
            <h2>This site can't be embedded</h2>
            <p>The site has security headers (X-Frame-Options or CSP) that prevent it from loading inside the browser preview.
               In the full Electron app, pages render in an isolated BrowserView and are not subject to this limitation.</p>
            <a href="${escapeHtml(tab.url)}" target="_blank" rel="noopener noreferrer"
               style="color:var(--accent);text-decoration:none;font-size:14px;margin-top:8px">Open in new tab ↗</a>
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
      if (e.target.classList.contains('tab-close')) return;
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
  document.getElementById('home-btn').addEventListener('click', () => {
    const tab = getActiveTab();
    if (tab) {
      tab.url = '';
      tab.title = 'New Tab';
      saveState();
      render();
    }
  });

  // Address bar
  const urlInput = document.getElementById('url-input');
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigateTo(urlInput.value);
      render();
    }
  });

  // Shortcuts
  document.querySelectorAll('.shortcut[data-url]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.url);
      render();
    });
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
  menu.style.cssText = `
    position: fixed; top: ${y}px; left: ${x}px;
    background: var(--bg-light); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    padding: 8px 0; min-width: 180px; z-index: 2000;
  `;
  menu.innerHTML = `
    <div class="dropdown-item" id="ctx-back"><span>←</span> Back</div>
    <div class="dropdown-item" id="ctx-forward"><span>→</span> Forward</div>
    <div class="dropdown-item" id="ctx-reload"><span>⟳</span> Reload</div>
    <div class="dropdown-separator"></div>
    <div class="dropdown-item" id="ctx-inspect"><span>🔍</span> Inspect Element</div>
    <div class="dropdown-separator"></div>
    <div class="dropdown-item" id="ctx-newtab"><span>+</span> New Tab</div>
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
