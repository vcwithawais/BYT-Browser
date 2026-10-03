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

## Iframe limitation in web preview
The renderer uses `<iframe>` to display web pages in the preview. Sites with `X-Frame-Options` or CSP `frame-ancestors` headers cannot be embedded — a fallback overlay is shown. This limitation does not exist in the Electron app (BrowserView renders pages natively).
