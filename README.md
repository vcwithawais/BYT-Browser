# Context
You are an expert desktop application developer specializing in Electron, Node.js, and web security. We are building a custom, highly secure web browser. 

# Project Architecture & Tech Stack
*   **Framework:** Electron.js (using Chromium/Blink under the hood).
*   **Frontend UI:** React (or vanilla HTML/CSS/JS) for the browser chrome (tabs, address bar, navigation buttons).
*   **Browser Views:** Use `BrowserView` or `<webview>` for rendering target web pages.
*   **Networking:** Bundled Tor executable for proxying.

# Core Requirements & Features

1.  **Strictly Stateless (No History):**
    *   The browser must not save any browsing history, cache, or permanent cookies to the disk.
    *   Force all Electron `Session` objects to be in-memory only (do not use the `persist:` prefix).
    *   Destroy session data completely when a tab or window is closed.

2.  **Dual Window Modes:**
    *   **Standard Mode:** A normal stateless browsing window.
    *   **Tor Privacy Mode:** A specialized window that routes 100% of its traffic (including DNS requests) through a local Tor network.

3.  **Tor Integration (No System VPN):**
    *   The application must bundle the Tor binary.
    *   Write a background process manager in Node.js (Main Process) that spawns the Tor daemon on a local port (e.g., `127.0.0.1:9050`) when a Tor window is requested.
    *   Configure the Electron `Session` for the Tor window to use a SOCKS5 proxy pointing to the spawned Tor process. Ensure DNS leaks are blocked.

4.  **Developer Tools:**
    *   Expose standard Chromium DevTools.
    *   Implement keyboard shortcut listeners (F12, Ctrl+Shift+I) to toggle DevTools for the active `webContents`.
    *   Implement a right-click context menu with an "Inspect Element" option that triggers `webContents.inspectElement(x, y)`.

# Initialization Tasks

Please execute the following steps sequentially to bootstrap the project:
1.  Initialize the standard Electron boilerplate and configure the main and renderer processes.
2.  Create a `BrowserWindowManager` module to handle spawning Standard and Tor-enabled windows with distinct, isolated, in-memory sessions.
3.  Write the Tor daemon spawner utility that securely launches the Tor binary and handles its lifecycle (startup, graceful shutdown on app exit).
4.  Implement the DevTools keyboard shortcuts and right-click context menu for the web views.

Please start by providing the project structure and the `main.js` setup for the isolated sessions and window management.
