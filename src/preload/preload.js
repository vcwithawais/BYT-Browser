// ===== Preload Script =====
// Runs in an isolated context with access to Node.js APIs.
// Exposes a safe, minimal API to the renderer via contextBridge.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('secureBrowser', {
  // Window management
  createWindow: (mode) => ipcRenderer.invoke('window:create', mode),
  closeWindow: (windowId) => ipcRenderer.invoke('window:close', windowId),

  // Tab management
  createTab: (mode, url) => ipcRenderer.invoke('tab:create', mode, url),
  closeTab: (tabId) => ipcRenderer.invoke('tab:close', tabId),
  navigateTab: (tabId, url) => ipcRenderer.invoke('tab:navigate', tabId, url),
  goBack: (tabId) => ipcRenderer.invoke('tab:goBack', tabId),
  goForward: (tabId) => ipcRenderer.invoke('tab:goForward', tabId),

  // DevTools
  toggleDevTools: () => ipcRenderer.invoke('devtools:toggle'),
  inspectElement: (x, y) => ipcRenderer.invoke('devtools:inspect', x, y),

  // Session
  clearSession: () => ipcRenderer.invoke('session:clear'),

  // Tor
  getTorStatus: () => ipcRenderer.invoke('tor:status'),

  // Platform info
  platform: process.platform,
});
