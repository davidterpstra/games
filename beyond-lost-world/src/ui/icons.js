// Inline SVG icon set (24x24, stroke = currentColor). One icon per item id plus UI / weather icons.
// No emoji anywhere: every glyph in the interface is drawn here.

const wrap = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

function gear() {
  const teeth = 8, ro = 9.6, ri = 7.4;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth;
    const pts = [[a - w * 0.55, ri], [a - w * 0.3, ro], [a + w * 0.3, ro], [a + w * 0.55, ri]];
    for (const [ang, r] of pts) d += `${d ? 'L' : 'M'}${(12 + Math.cos(ang) * r).toFixed(2)} ${(12 + Math.sin(ang) * r).toFixed(2)}`;
  }
  return wrap(`<path d="${d}Z"/><circle cx="12" cy="12" r="3"/>`);
}

function sunRays(cx, cy, r1, r2, n) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    d += `M${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cy + Math.sin(a) * r2).toFixed(2)}`;
  }
  return d;
}

const cloud = '<path d="M7 17.5a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 17.2 8.6 4.5 4.5 0 0 1 17 17.5z"/>';

export const icons = {
  // ---- items ---------------------------------------------------------------------------------
  wood: wrap('<g transform="rotate(-38 12 12)"><path d="M5.500 8h12.500a3 4 0 0 1 0 8H5.500" fill="currentColor" fill-opacity=".14"/><ellipse cx="5.500" cy="12" rx="3" ry="4"/><ellipse cx="5.500" cy="12" rx="1.500" ry="2" opacity=".6"/><path d="M10 9.800v1.400M13 13.200v1.500M16 10v1.200M20 12.800" opacity=".5"/><path d="M11.500 8V5.500l2-1.500" opacity=".8"/></g>'),
  stone: wrap('<path d="M3.5 16.5 6.8 9 12 5.5l5.7 2.3 2.8 6.2-3.5 4.7H7z"/><path d="M6.8 9l4.4 3.4L12 5.5M11.2 12.4l6.5-4.6M11.2 12.4 9.6 18.7M11.2 12.4l9.3 1.6" opacity=".6"/>'),
  fiber: wrap('<path d="M7 21C5 15 9.5 9.5 7 3M12 21.5c-2-6 2.5-11.5 0-18M17 21c-2-6 2.5-11.5 0-18"/><path d="M5 14.5h14" stroke-width="2.4" opacity=".75"/>'),
  resin: wrap('<path d="M12 3s-6.5 7-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10 12 3 12 3z" fill="currentColor" fill-opacity=".18"/><path d="M9 14.6a3 3 0 0 0 2.3 2.9" opacity=".7"/>'),
  cloth: wrap('<path d="M3.5 7.2c4-2.2 7.2 2 11 .2 2-.9 4.200-1.200 5.500-.700V17c-1.300-.5-3.500-.2-5.500.8-3.800 1.800-7-2.400-11-.2z" fill="currentColor" fill-opacity=".14"/><path d="M3.500 12.200c4-2.200 7.200 2 11 .5 2-.8 3.800-1.100 5.500-.700" opacity=".6"/>'),
  scrap: wrap('<path d="M3.500 8.500 14 4l6.200 5.200-2.100 9L7.200 20.500z" fill="currentColor" fill-opacity=".14"/><circle cx="12" cy="12.200" r="2.300"/><path d="M6 9.500l1.500 1M17.500 15.500l1-.5" opacity=".6"/>'),
  rope: wrap('<circle cx="11" cy="13" r="7.200"/><circle cx="11" cy="13" r="3.800"/><path d="M4.300 11.300l13.200 4.700M5.300 16.800 16.700 9.700M13.500 6.200C16 3 20 3.500 21 7.500" opacity=".7"/>'),
  torch: wrap('<path d="M8.500 21.500 12.800 11.800" stroke-width="2.600"/><path d="M10 17.200l3.200 1.300M11 14.200l3 1.200" opacity=".6"/><path d="M14.800 2.500c2.600 3.600 4.200 5.400 1.700 8.800-1 1.300-3.600 1.400-4.300-.8-.8-2.300.8-4.500 2.600-8z" fill="currentColor" fill-opacity=".25"/>'),
  crowbar: wrap('<path d="M5 19.500 17.200 7.300c1.500-1.500 3.300-1.600 3.300-3.800"/><path d="M5 19.500l-1.800.8 1.100-1.900zM17.200 7.300l2.300 2.300" /><path d="M20.500 3.500l-2.800.4" opacity=".7"/>', ''),
  sundisc: wrap(`<circle cx="12" cy="12" r="5.200" fill="currentColor" fill-opacity=".16"/><circle cx="12" cy="12" r="2.400"/><path d="${sunRays(12, 12, 7.200, 10.200, 12)}"/>`),
  keycard: wrap('<rect x="2.800" y="5.800" width="18.400" height="12.400" rx="2.200" fill="currentColor" fill-opacity=".1"/><path d="M2.800 9.800h18.400" stroke-width="2.600" opacity=".7"/><rect x="5.500" y="12.800" width="4.200" height="3" rx=".8"/><path d="M13 14.300h5.500" opacity=".7"/>'),

  // ---- ui ------------------------------------------------------------------------------------
  mission: wrap('<path d="M6 21V3.500"/><path d="M6 4.500h11.500l-2.700 3.800 2.700 3.700H6" fill="currentColor" fill-opacity=".15"/>'),
  map: wrap('<path d="M3 6.200 9 4l6 2.200L21 4v13.800L15 20l-6-2.200L3 20z" fill="currentColor" fill-opacity=".08"/><path d="M9 4v13.800M15 6.200V20"/>'),
  journal: wrap('<path d="M5 4.500A1.500 1.500 0 0 1 6.500 3H18a1 1 0 0 1 1 1v13H7a2 2 0 0 0-2 2z"/><path d="M5 19a2 2 0 0 0 2 2h12v-4"/><path d="M9 7.500h6M9 10.500h4" opacity=".7"/>'),
  settings: gear(),
  inventory: wrap('<path d="M7.500 9.500a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3V20h-9z" transform="translate(-0.5 0)"/><path d="M9 6.500V5a3 3 0 0 1 6 0v1.500"/><path d="M8 14h8M8 20h8" opacity=".7"/>', ''),
  crafting: wrap('<path d="M14.500 4.500 20 10l-2.500 1-1.800-1.800L8 17a2 2 0 0 1-3-3l7.800-7.700-1.800-1.800z" fill="currentColor" fill-opacity=".12"/>'),
  stamina: wrap('<path d="M13 2.500 5 13.500h6l-1 8 8-11h-6z" fill="currentColor" fill-opacity=".18"/>'),
  checkpoint: wrap('<circle cx="12" cy="8.500" r="1.800" fill="currentColor"/><path d="M12 10.500V21M8.500 21h7M8.500 5a5 5 0 0 0 0 7M15.500 5a5 5 0 0 1 0 7M5.800 3a8.500 8.500 0 0 0 0 11M18.200 3a8.500 8.500 0 0 1 0 11" opacity=".9"/>'),
  close: wrap('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: wrap('<path d="M5 12.500 10 17.500 19 7"/>', 'stroke-width="2"'),
  lock: wrap('<rect x="5" y="10.500" width="14" height="10" rx="2"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>'),
  arrow: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.500 19 20.500 12 16.500 5 20.500z"/></svg>',
  chevron: wrap('<path d="M9 5l7 7-7 7"/>'),
  play: wrap('<path d="M7 4.500v15l12-7.500z" fill="currentColor" fill-opacity=".2"/>'),
  save: wrap('<path d="M12 3.500v11M7.500 10.500l4.500 4.500 4.500-4.500M4.500 19.500h15"/>'),
  home: wrap('<path d="M3.500 11 12 4l8.500 7M6 9.500V20h12V9.500M10 20v-5.500h4V20"/>'),
  info: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.600v.1"/>'),
  controls: wrap('<rect x="3" y="7" width="18" height="11" rx="3"/><path d="M7 12.500h4M9 10.500v4M15.500 11.500v.1M17.500 13.500v.1"/>'),
  restart: wrap('<path d="M20 12a8 8 0 1 1-2.500-5.800M20 4v4.500h-4.500"/>'),
  checkpointLoad: wrap('<path d="M12 21s-6.500-5.500-6.500-11a6.500 6.500 0 0 1 13 0c0 5.500-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.200"/>'),
  compass: wrap('<circle cx="12" cy="12" r="9"/><path d="m15.500 8.500-2 5-5 2 2-5z" fill="currentColor" fill-opacity=".2"/>'),
  eye: wrap('<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="3"/>'),
  skip: wrap('<path d="M5 5.500 13 12l-8 6.500zM17.500 5.500v13"/>'),
  tape: wrap('<rect x="2.500" y="6" width="19" height="12" rx="2"/><circle cx="8.500" cy="12" r="2.200"/><circle cx="15.500" cy="12" r="2.200"/><path d="M8.500 15.500h7" opacity=".6"/>'),
  terminal: wrap('<rect x="3" y="4.500" width="18" height="15" rx="2"/><path d="M7 10l3 2.500-3 2.500M12.500 15.500H17"/>'),
  // ---- weather / time ----------------------------------------------------------------------
  w_clear: wrap(`<circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity=".2"/><path d="${sunRays(12, 12, 6.800, 9.200, 8)}"/>`),
  w_night: wrap('<path d="M19.500 14.500A8 8 0 0 1 9.500 4.500 8 8 0 1 0 19.500 14.500z" fill="currentColor" fill-opacity=".15"/>'),
  w_cloudy: wrap(cloud.replace('<path ', '<path fill="currentColor" fill-opacity=".12" ')),
  w_rain: wrap('<path d="M7 14.500a4 4 0 0 1-.4-7.980A5.500 5.500 0 0 1 17.200 5.600 4.500 4.500 0 0 1 17 14.500z"/><path d="M8 20l1-2.500M12 20.500l1-2.500M16 20l1-2.500"/>'),
  w_fog: wrap('<path d="M7 11a4.500 4.500 0 0 1 9.500-1A3.500 3.500 0 0 1 17 17H7a3 3 0 0 1 0-6z" opacity=".5"/><path d="M3.500 19.500h17M6 22h12" opacity=".8"/>'),
  w_storm: wrap('<path d="M7 14.500a4 4 0 0 1-.4-7.980A5.500 5.500 0 0 1 17.200 5.100 4.500 4.500 0 0 1 17 14.500"/><path d="m12.500 11-2.500 4.500h3.500L11.500 21" fill="none"/>'),
};
