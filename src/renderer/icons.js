// ===== Icon set =====
// Inline SVG shapes + glyphs, drawn on a 24x24 grid, sized by CSS.
// Stroke-based for a clean, minimal, modern browser look.

const S = (inner, opts = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${opts}>${inner}</svg>`;

const F = (inner) =>
  `<svg viewBox="0 0 24 24" fill="currentColor">${inner}</svg>`;

export const ICONS = {
  // --- navigation ---
  back: S('<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>'),
  forward: S('<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>'),
  reload: S('<path d="M21 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L21 10"/>'),
  stop: S('<path d="M18 6 6 18"/><path d="M6 6l12 12"/>'),
  home: S('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
  plus: S('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  close: S('<path d="M18 6 6 18"/><path d="M6 6l12 12"/>'),
  chevronDown: S('<path d="M6 9l6 6 6-6"/>'),
  chevronRight: S('<path d="M9 6l6 6-6 6"/>'),

  // --- chrome controls ---
  menu: F('<circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/>'),
  menuH: S('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'),
  grid: F('<circle cx="6" cy="6" r="1.9"/><circle cx="12" cy="6" r="1.9"/><circle cx="18" cy="6" r="1.9"/><circle cx="6" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18" cy="12" r="1.9"/><circle cx="6" cy="18" r="1.9"/><circle cx="12" cy="18" r="1.9"/><circle cx="18" cy="18" r="1.9"/>'),
  tabs: S('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>'),

  // --- security / privacy ---
  shield: S('<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z"/>'),
  shieldOff: S('<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z"/><path d="M5 19 19 5"/>'),
  lock: S('<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  unlock: S('<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 7.5-2"/>'),
  globe: S('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17z"/>'),
  tor: S('<path d="M12 3a9 9 0 0 1 9 9"/><path d="M12 7a5 5 0 0 1 5 5"/><path d="M12 11.5a.5.5 0 0 1 .5.5"/><path d="M12 21a9 9 0 0 1-9-9"/><path d="M12 17a5 5 0 0 1-5-5"/>'),
  incognito: S('<circle cx="12" cy="10" r="4"/><path d="M12 6c-1.6 0-3-2-5-2-1.7 0-3 1.3-3 3v7h16V7c0-1.7-1.3-3-3-3-2 0-3.4 2-5 2z"/>'),
  eye: S('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  eyeOff: S('<path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 3.9"/><path d="M6.3 7.7A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.3 0 2.5-.3 3.6-.7"/>'),

  // --- actions ---
  search: S('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  star: S('<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.6 9.7l5.8-.8L12 3.6z"/>'),
  starFilled: F('<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.6 9.7l5.8-.8L12 3.6z"/>'),
  bookmark: S('<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z"/>'),
  history: S('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 5v4h4"/><path d="M12 7.5V12l3.2 2"/>'),
  download: S('<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>'),
  settings: S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.6 7.4l2 1.2M17.4 15.4l2 1.2M4.6 16.6l2-1.2M17.4 8.6l2-1.2"/>'),
  user: S('<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>'),
  sync: S('<path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9"/><path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9"/><path d="M18 2.5v4h-4"/><path d="M6 21.5v-4h4"/>'),
  key: S('<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8"/><path d="M17 4l3 3"/><path d="M15 6l3 3"/>'),
  card: S('<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/>'),
  mapPin: S('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>'),
  trash: S('<path d="M4 7h16"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7l1 13h9l1-13"/>'),
  edit: S('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14.5 5.5l4 4"/>'),
  check: S('<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>'),
  external: S('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  zoomIn: S('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8.5v5"/><path d="M8.5 11h5"/>'),
  zoomOut: S('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8.5 11h5"/>'),
  pin: S('<path d="M9 4h6l-1 6 3.5 3.5H6.5L10 10 9 4z"/><path d="M12 13.5V20"/>'),
  volume: S('<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: S('<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M16 9.5l5 5"/><path d="M21 9.5l-5 5"/>'),
  copy: S('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5"/>'),
  palette: S('<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 2-.8 2-1.8 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-1 .8-1.8 1.8-1.8h1.7a4.2 4.2 0 0 0 4.2-4.2c0-3.6-3.8-6.4-8.5-6.4z"/><circle cx="7.8" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="7.9" r="1.1" fill="currentColor" stroke="none"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>'),
  moon: S('<path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8z"/>'),
  layout: S('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M9 4.5v15"/>'),
  keyboard: S('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 13.5h8"/>'),
  command: S('<path d="M7.5 3.5a3 3 0 1 0 3 3v11a3 3 0 1 0 3-3h-11a3 3 0 1 0 3 3h11a3 3 0 1 0-3-3z"/>'),
  sparkle: S('<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5z"/>'),
  image: S('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l5-5 4 4 3-2.5 4 4"/>'),
  arrowUpRight: S('<path d="M7 17 17 7"/><path d="M9 7h8v8"/>'),
  info: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none"/>'),
  refresh: S('<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3v5h-5"/>'),
  folder: S('<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z"/>'),
};

export default ICONS;
