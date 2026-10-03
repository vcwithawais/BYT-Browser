# Secure Browser — Base44 Dev Environment

## Overview
An Electron-based stateless web browser with Tor support. The repo was imported as a spec-only README; the full project was scaffolded here.

## Architecture
- **Renderer** (`src/renderer/`): Browser chrome UI (tabs, address bar, navigation, context menu). Vanilla JS + CSS, served by Vite on port 3000.
- **Main process** (`src/main/`): Electron main process — `main.js` (entry), `BrowserWindowManager.js` (isolated in-memory sessions, BrowserView tabs), `torManager.js` (Tor daemon lifecycle).
- **Preload** (`src/preload/preload.js`): contextBridge IPC bridge between main and renderer.

## Running in the preview
The preview shows the Vite dev server (renderer UI only) on port 3000. The Electron-specific features (BrowserView, Tor proxy, DevTools IPC) are active only when running as a desktop app via `npm run electron:dev`.

### Key command
```
docker compose -f docker-compose.base44.yml up -d
```

## Stateless design
- All Electron sessions use `session.fromPartition()` without the `persist:` prefix → in-memory only, nothing written to disk.
- The renderer uses `sessionStorage` for tab state — cleared on close.
- Tor data directory is created in the OS temp dir and wiped on shutdown.

## Tor
Tor is not bundled in this dev environment. The `torManager.js` expects a `tor` binary on PATH or bundled at `./tor/tor`. In the web preview, Tor mode shows the UI but does not proxy traffic.

## Page rendering: web preview vs desktop build
The renderer has two paths, chosen at runtime by the presence of `window.secureBrowser` (injected by `src/preload/preload.js`):

- **Web preview** — an `<iframe>` renders the page. Sites that send `X-Frame-Options` / CSP `frame-ancestors` cannot be embedded by *any* page; `FRAME_BLOCKED_HOSTS` in `src/renderer/data.js` lists the common ones so the renderer shows the explanation page immediately instead of a blank frame, with an "Open in your browser" (`window.open`) escape hatch. Unknown blockers still fall back to the 3 s "iframe never fired load" timeout.
- **Desktop build** — the renderer reports the content-area rectangle plus the active tab over IPC (`native:show` / `native:hide` / `native:close`) and `BrowserWindowManager.showNativeView()` paints a real Chromium `BrowserView` there. Nothing can refuse to load, and `page-favicon-updated` is forwarded back as `native:favicon` so the tab strip shows the icon the page declared. Only the active tab's view stays attached.

Changes to the content area (layout toggles, panel open, zoom, resize) must keep the view in sync — `syncNativeView()` in `app.js` is called from `renderContent`, `applyLayout` and the window `resize` listener.

## Favicons & logo
- `public/logo.png` is the browser logo (transparent PNG, 432×391). Referenced at runtime with the **relative** path `logo.png` so it resolves both from the dev server and from `dist/` under `file://`. `build/icon.png` is the padded 512×512 square version electron-builder turns into the Windows `.ico`.
- Real site favicons come from `faviconSources()` in `src/renderer/util.js` (Google's favicon service, then DuckDuckGo's icon service). `handleFaviconError()` in `app.js` walks that chain on `<img>` error (captured, since error events do not bubble) and finally swaps in a coloured letter tile with the `web` class removed from the wrapper.

## Packaging (desktop)
Electron + `electron-builder`. `npm run dist:win` produces an NSIS installer and a portable `.exe` in `release/` (also `dist:mac` / `dist:linux`). `vite.config.js` sets `base: './'` **only for `vite build`**, because the packaged window loads `dist/index.html` over `file://`. Run packaging on the target OS (or a machine with the matching toolchain) — it cannot be produced inside this Linux dev container.
