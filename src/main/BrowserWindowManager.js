// ===== BrowserWindowManager =====
// Manages spawning Standard and Tor-enabled windows with distinct, isolated,
// in-memory sessions. No session data is ever persisted to disk.

const { BrowserWindow, BrowserView, session } = require('electron');
const path = require('path');
const fs = require('fs');

let windowCounter = 0;
let tabCounter = 0;

class BrowserWindowManager {
  constructor(torManager) {
    this.torManager = torManager;
    this.windows = new Map(); // windowId -> { window, views: Map(tabId -> BrowserView) }
  }

  /**
   * Create a new browser window in the specified mode.
   * @param {string} mode - 'standard' | 'tor'
   * @returns {number} windowId
   */
  createWindow(mode = 'standard') {
    const windowId = ++windowCounter;

    // Create an isolated, in-memory session (no persist: prefix → nothing saved to disk)
    const partition = `${mode}-${windowId}`;
    const ses = session.fromPartition(partition, { cache: false });

    // Configure session for Tor mode
    if (mode === 'tor' && this.torManager) {
      // Start Tor if not already running
      if (!this.torManager.isRunning()) {
        this.torManager.start().catch(err => {
          console.error('[BrowserWindowManager] Failed to start Tor:', err);
        });
      }

      // Set SOCKS5 proxy pointing to the local Tor process
      // This routes ALL traffic (including DNS) through Tor, preventing DNS leaks
      ses.setProxy({
        proxyRules: 'socks5://127.0.0.1:9050',
        proxyBypassRules: '',
      }).catch(err => {
        console.error('[BrowserWindowManager] Failed to set Tor proxy:', err);
      });
    }

    // App icon (also what Windows shows in the taskbar and title bar)
    const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 600,
      minHeight: 400,
      titleBarStyle: 'hiddenInset',
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        session: ses,
      },
    });

    // Load the renderer UI
    const isDev = !app.isPackaged;
    if (isDev) {
      win.loadURL('http://localhost:3000');
    } else {
      win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
    }

    // Store window info
    this.windows.set(windowId, { window: win, views: new Map(), mode });

    // Handle window close — destroy all views and session data
    win.on('closed', () => {
      const info = this.windows.get(windowId);
      if (info) {
        // Destroy all BrowserViews
        for (const [, view] of info.views) {
          view.webContents.destroy();
        }
        info.views.clear();
      }
      // Destroy the in-memory session completely
      ses.clearStorageData().then(() => ses.clearCache());
      this.windows.delete(windowId);
    });

    return windowId;
  }

  /**
   * Create a new tab (BrowserView) in the specified window.
   */
  createTab(win, mode = 'standard', url = '') {
    const windowId = this._getWindowId(win);
    const info = this.windows.get(windowId);
    if (!info) return null;

    const tabId = ++tabCounter;
    const tabSession = session.fromPartition(`${mode}-${windowId}-${tabId}`, { cache: false });

    // Tor proxy for this tab's session
    if (mode === 'tor' && this.torManager) {
      tabSession.setProxy({
        proxyRules: 'socks5://127.0.0.1:9050',
      }).catch(err => console.error('[BrowserWindowManager] Tab proxy error:', err));
    }

    const view = new BrowserView({
      webPreferences: {
        session: tabSession,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.addBrowserView(view);
    info.views.set(tabId, { view, mode, url, history: [], historyIndex: -1 });

    if (url) {
      view.webContents.loadURL(url);
    }

    return tabId;
  }

  /**
   * Close a tab and destroy its BrowserView and session.
   */
  closeTab(win, tabId) {
    const windowId = this._getWindowId(win);
    const info = this.windows.get(windowId);
    if (!info) return;

    const tabInfo = info.views.get(tabId);
    if (!tabInfo) return;

    win.removeBrowserView(tabInfo.view);
    tabInfo.view.webContents.destroy();
    // Clear session data for this tab
    tabInfo.view.webContents.session.clearStorageData();
    info.views.delete(tabId);
  }

  /**
   * Navigate a tab to a URL.
   */
  navigateTab(win, tabId, url) {
    const windowId = this._getWindowId(win);
    const info = this.windows.get(windowId);
    if (!info) return;

    const tabInfo = info.views.get(tabId);
    if (!tabInfo) return;

    tabInfo.url = url;
    tabInfo.history.push(url);
    tabInfo.historyIndex = tabInfo.history.length - 1;
    tabInfo.view.webContents.loadURL(url);
  }

  goBack(win, tabId) {
    const windowId = this._getWindowId(win);
    const info = this.windows.get(windowId);
    if (!info) return;
    const tabInfo = info.views.get(tabId);
    if (!tabInfo || tabInfo.historyIndex <= 0) return;
    tabInfo.historyIndex--;
    tabInfo.view.webContents.loadURL(tabInfo.history[tabInfo.historyIndex]);
  }

  goForward(win, tabId) {
    const windowId = this._getWindowId(win);
    const info = this.windows.get(windowId);
    if (!info) return;
    const tabInfo = info.views.get(tabId);
    if (!tabInfo || tabInfo.historyIndex >= tabInfo.history.length - 1) return;
    tabInfo.historyIndex++;
    tabInfo.view.webContents.loadURL(tabInfo.history[tabInfo.historyIndex]);
  }

  /* ------------------------------------------------------------------ */
  /*  Native page views (desktop build)                                  */
  /*                                                                     */
  /*  The renderer draws the browser chrome; the page itself is a real   */
  /*  Chromium view painted over the content area. That is what lets     */
  /*  Google, YouTube and every other site open normally, which an       */
  /*  <iframe> can never do (X-Frame-Options / CSP frame-ancestors).     */
  /* ------------------------------------------------------------------ */

  /**
   * Show (or refresh) the page view for a tab.
   * @param {BrowserWindow} win
   * @param {{tabId:string,url:string,mode?:string,zoom?:number,bounds:{x,y,width,height}}} opts
   */
  showNativeView(win, opts = {}) {
    const windowId = this._getWindowId(win);
    const info = this.windows.get(windowId);
    if (!info || !opts.tabId || !opts.bounds) return null;

    let tab = info.views.get(opts.tabId);
    if (!tab) {
      const ses = session.fromPartition(`${opts.mode || 'standard'}-${windowId}-${opts.tabId}`, { cache: false });
      if (opts.mode === 'tor' && this.torManager) {
        ses.setProxy({ proxyRules: 'socks5://127.0.0.1:9050' })
          .catch(err => console.error('[BrowserWindowManager] Native view proxy error:', err));
      }
      const view = new BrowserView({
        webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false },
      });

      // Report the favicon the page itself declares, so the tab strip shows the
      // site's real icon rather than a guess.
      view.webContents.on('page-favicon-updated', (_event, favicons) => {
        if (!win.isDestroyed() && favicons && favicons.length) {
          win.webContents.send('native:favicon', {
            tabId: opts.tabId,
            favicon: favicons[favicons.length - 1],
          });
        }
      });

      tab = { view, mode: opts.mode || 'standard', url: '', native: true, attached: false };
      info.views.set(opts.tabId, tab);
    }

    if (opts.url && opts.url !== tab.url) {
      tab.url = opts.url;
      tab.view.webContents.loadURL(opts.url).catch(err => {
        // Aborted navigations (a redirect, a stop) are normal — only report others.
        if (err && !/ERR_ABORTED/.test(err.message)) {
          console.error('[BrowserWindowManager] Native view failed to load:', opts.url, err.message);
        }
      });
    }
    if (opts.zoom) {
      tab.view.webContents.setZoomFactor(Math.max(0.25, Math.min(5, opts.zoom)));
    }

    // Only the active tab's view stays attached, so a hidden tab can never
    // paint over the one in front of the user.
    for (const [id, other] of info.views) {
      if (id !== opts.tabId && other.native && other.attached) {
        win.removeBrowserView(other.view);
        other.attached = false;
      }
    }

    const b = opts.bounds;
    tab.view.setBounds({
      x: Math.round(b.x),
      y: Math.round(b.y),
      width: Math.max(0, Math.round(b.width)),
      height: Math.max(0, Math.round(b.height)),
    });
    if (!tab.attached) {
      win.addBrowserView(tab.view);
      tab.attached = true;
    } else {
      win.setTopBrowserView(tab.view);
    }

    return opts.tabId;
  }

  /** Detach every native view (panel open, new tab page, window gone). */
  hideNativeViews(win) {
    const windowId = this._getWindowId(win);
    const info = this.windows.get(windowId);
    if (!info || win.isDestroyed()) return;
    for (const [, tab] of info.views) {
      if (tab.native && tab.attached) {
        win.removeBrowserView(tab.view);
        tab.attached = false;
      }
    }
  }

  /** Close one tab's native view and drop its in-memory session. */
  closeNativeView(win, tabId) {
    const windowId = this._getWindowId(win);
    const info = this.windows.get(windowId);
    if (!info) return;
    const tab = info.views.get(tabId);
    if (!tab) return;
    if (tab.attached && !win.isDestroyed()) win.removeBrowserView(tab.view);
    tab.view.webContents.destroy();
    info.views.delete(tabId);
  }

  closeWindow(windowId) {
    const info = this.windows.get(windowId);
    if (info) {
      info.window.close();
    }
  }

  _getWindowId(win) {
    for (const [id, info] of this.windows) {
      if (info.window === win) return id;
    }
    return null;
  }
}

// Workaround: app is needed but we don't want to import it at module level
// to avoid circular dependency issues in some Electron versions.
const { app } = require('electron');

module.exports = BrowserWindowManager;
