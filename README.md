<div align="center">

# BYT Browser

**A stateless, privacy-first desktop browser — Chromium-family UX, zero history on disk.**

<p>
  <img alt="Electron 33" src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white" />
  <img alt="Vite 6" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" />
  <img alt="Tor" src="https://img.shields.io/badge/Tor-SOCKS5-7D4698?logo=torproject&logoColor=white" />
  <img alt="Platforms" src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-0078D6" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green" />
  <img alt="Status" src="https://img.shields.io/badge/status-active%20development-yellow" />
</p>

</div>

---

## Why BYT Browser?

Most browsers keep a detailed record of everywhere you go. BYT Browser is built the other way around: **browsing data lives in memory only** and disappears the moment a window closes.

- **Strictly stateless** — no history, cache or persistent cookies written to disk.
- **Real Tor privacy mode** — a dedicated window that routes 100% of its traffic, DNS included, through a bundled Tor daemon.
- **Familiar chrome** — tabs, omnibox, bookmarks, vertical tabs, sidebar and a privacy shield, so privacy doesn't cost you usability.
- **Native page rendering** — every tab is a real Chromium view, so sites that refuse to be embedded (Google, YouTube, banking portals) work normally.
- **Full DevTools** — F12 / Ctrl+Shift+I and "Inspect Element" on right-click, just like you're used to.

## Features

### Privacy by design

| Feature | What it does |
| --- | --- |
| **In-memory sessions** | Every window and tab gets its own isolated session created without the `persist:` prefix, with the disk cache disabled. |
| **Burn on close** | Closing a tab or window destroys its view and clears all storage data and cache. |
| **Tor mode** | A separate window type sets a SOCKS5 proxy to the local Tor process — the proxy handles DNS too, so no DNS leaks. |
| **Privacy shield** | Tracker blocking, third-party cookie blocking and Do Not Track, all toggleable. |
| **No VPN required** | Tor is spawned and managed by the app itself, then shut down gracefully on exit. |

### Browser experience

- **Tab strip & omnibox** — pin, mute, duplicate and reopen recently closed tabs; search suggestions from history.
- **Vertical tabs & sidebar** — Edge-style vertical tabs and an Opera-style sidebar when you want them.
- **Internal pages** — new tab speed dial, bookmarks, history, downloads, autofill, profile, app launcher, tab switcher and about.
- **Bookmarks bar & status bar** — the familiar layout, no surprises.
- **Search engines** — Google, DuckDuckGo, Bing, Brave Search and Wikipedia.

### Make it yours

- Light, dark or system theme
- Eight accent colors, eight gradient wallpapers
- Comfortable or compact density
- Editable speed-dial shortcuts and per-site zoom

## Tech stack

| Layer | Choice |
| --- | --- |
| Desktop shell | Electron 33 (`BrowserWindow` + `BrowserView`) |
| Renderer UI | Vanilla ES modules + HTML/CSS, bundled with Vite 6 |
| Networking | Chromium sessions + bundled Tor (SOCKS5 on `127.0.0.1:9050`) |
| Persistence | `localStorage` for settings · `sessionStorage` for the live session |
| Packaging | electron-builder → NSIS & portable (Windows), DMG (macOS), AppImage (Linux) |

## Getting started

**Prerequisites:** Node.js 18+ and npm. Tor mode needs a Tor binary — either bundled in `tor/`, `bin/`, `resources/tor/`, or available on your `PATH`.

```bash
# 1. Clone
git clone https://github.com/vcwithawais/BYT-Browser.git
cd BYT-Browser

# 2. Install dependencies
npm install

# 3. Run the app (Vite dev server + Electron with live reload)
npm run electron:dev
```

### Available scripts

| Command | Description |
| --- | --- |
| `npm run electron:dev` | Vite dev server on port 3000 + Electron, with hot reload |
| `npm run dev` | Renderer only, in the browser |
| `npm run electron` | Launch Electron against the current build |
| `npm run build` | Build the renderer into `dist/` |
| `npm run dist` | Package the app for your current platform |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Package for a specific platform |

Artifacts are written to `release/`.

## Project structure

```
BYT-Browser/
├── build/                  # App icon used by electron-builder
├── public/                 # Static assets (logo)
├── src/
│   ├── main/
│   │   ├── main.js             # App lifecycle, IPC handlers, graceful shutdown
│   │   ├── BrowserWindowManager.js  # Windows, tabs, isolated sessions, native views
│   │   └── torManager.js       # Tor daemon: locate, spawn, monitor, stop
│   ├── preload/
│   │   └── preload.js          # Context-isolated bridge exposed as `window.secureBrowser`
│   └── renderer/
│       ├── app.js              # Chrome shell, tabs, navigation, omnibox
│       ├── panels.js           # Internal pages (new tab, bookmarks, settings, …)
│       ├── data.js             # Search engines, apps, wallpapers, accents
│       ├── store.js            # Preferences & session persistence
│       ├── style.css           # Theming (light/dark, accents, density)
│       ├── icons.js  util.js
├── index.html
└── vite.config.js
```

## Architecture at a glance

```
Renderer (chrome UI)  ──IPC──▶  Main process
  tabs, omnibox, panels            BrowserWindowManager
                                   ├─ one in-memory session per window
                                   ├─ one BrowserView (+ session) per tab
                                   └─ TorManager ──▶ tor (SOCKS5 :9050)
```

- **Main process** owns window and tab lifecycles, session isolation, the Tor daemon and DevTools.
- **Preload** exposes a minimal, context-isolated API — `contextIsolation: true`, `nodeIntegration: false`.
- **Renderer** draws the browser chrome and every internal page, and swaps the content area between native views.

## Privacy model

| Data | Where it lives | Lifetime |
| --- | --- | --- |
| Tabs, session history, recently closed | `sessionStorage` | Until the browser closes |
| Cookies, cache, site storage | In-memory Chromium session | Until the tab/window closes |
| Preferences, bookmarks, shortcuts, autofill | `localStorage` (device only) | Until you clear it |

Nothing is synced to a server. There is no account and no telemetry.

## Roadmap

- [ ] Bundle the Tor binary in release builds
- [ ] Extension support
- [ ] Per-site privacy rules
- [ ] Automatic updates

## Contributing

Issues and pull requests are welcome. Please keep the privacy guarantees intact: no disk-persisted browsing data, no telemetry.

## License

Released under the [MIT License](LICENSE).

<div align="center">

Built by **[Awais](https://github.com/vcwithawais)**

</div>
