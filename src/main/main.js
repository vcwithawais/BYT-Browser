// ===== Secure Browser — Electron Main Process =====
// Entry point for the Electron desktop application.
// Manages window lifecycle, isolated in-memory sessions, and IPC.

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const BrowserWindowManager = require('./BrowserWindowManager');
const TorManager = require('./torManager');

let windowManager = null;
let torManager = null;

// ---- App Lifecycle ----
app.whenReady().then(() => {
  torManager = new TorManager();
  windowManager = new BrowserWindowManager(torManager);

  // Create the first standard window
  windowManager.createWindow('standard');

  // On macOS, re-create a window when the dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow('standard');
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ---- Graceful Shutdown ----
app.on('before-quit', async (event) => {
  if (torManager && torManager.isRunning()) {
    event.preventDefault();
    console.log('[Main] Shutting down Tor daemon...');
    await torManager.stop();
    app.quit();
  }
});

// ---- IPC Handlers ----
ipcMain.handle('window:create', (event, mode) => {
  return windowManager.createWindow(mode);
});

ipcMain.handle('window:close', (event, windowId) => {
  return windowManager.closeWindow(windowId);
});

ipcMain.handle('tab:create', (event, mode, url) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return windowManager.createTab(win, mode, url);
});

ipcMain.handle('tab:close', (event, tabId) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return windowManager.closeTab(win, tabId);
});

ipcMain.handle('tab:navigate', (event, tabId, url) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return windowManager.navigateTab(win, tabId, url);
});

ipcMain.handle('tab:goBack', (event, tabId) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return windowManager.goBack(win, tabId);
});

ipcMain.handle('tab:goForward', (event, tabId) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return windowManager.goForward(win, tabId);
});

// ---- Native page views (the renderer's content area) ----
ipcMain.handle('native:show', (event, opts) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return windowManager.showNativeView(win, opts);
});

ipcMain.handle('native:hide', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return windowManager.hideNativeViews(win);
});

ipcMain.handle('native:close', (event, tabId) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return windowManager.closeNativeView(win, tabId);
});

ipcMain.handle('devtools:toggle', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win.webContents.isDevToolsOpened()) {
    win.webContents.closeDevTools();
  } else {
    win.webContents.openDevTools({ mode: 'detach' });
  }
});

ipcMain.handle('devtools:inspect', (event, x, y) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.webContents.inspectElement(x, y);
  if (!win.webContents.isDevToolsOpened()) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
});

ipcMain.handle('session:clear', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  // Clear all session data — in-memory only, nothing persisted to disk
  return win.webContents.session.clearStorageData().then(() => {
    return win.webContents.session.clearCache();
  });
});

ipcMain.handle('tor:status', (event) => {
  return torManager ? torManager.getStatus() : { running: false };
});
