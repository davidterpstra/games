// Map tab: terrain relief rendered once (chunked over several frames) from world.getHeightAt /
// getWaterSurfaceAt plus layout.PATHS. Markers and the player arrow are DOM overlays (crisp labels).
import { h, icon } from './dom.js';

const EXTENT = 300;      // map covers -EXTENT..EXTENT metres
const RES = 300;         // terrain sampling resolution (cells per side)
const ROWS_PER_FRAME = 24;

export function createMapTab(ctx) {
  const { game } = ctx;
  const canvas = h('canvas', { class: 'map-canvas', width: 720, height: 720 });
  const markers = h('div', { class: 'map-markers' });
  const arrow = icon('arrow');
  const player = h('div', { class: 'map-player', 'aria-label': 'Jouw positie' }, arrow);
  const loadingNote = h('div', { class: 'map-loading', text: 'Kaart wordt getekend…' });
  const frame = h('div', { class: 'map-frame' }, canvas, markers, player, loadingNote,
    h('div', { class: 'map-compass', 'aria-hidden': 'true' }, h('span', { text: 'N' })));
  const side = h('aside', { class: 'map-side scroll' });
  const el = h('div', { class: 'map-tab' }, h('div', { class: 'map-stage' }, frame), side);

  let base = null, building = false, builtFor = null;
  let markerEls = new Map(), sideSig = '', lastPos = '', acc = 0;

  const toPct = (x, z) => [((x + EXTENT) / (2 * EXTENT)) * 100, ((z + EXTENT) / (2 * EXTENT)) * 100];

  function buildBase() {
    const world = game.world;
    if (!world || building || builtFor === world) return;
    building = true; loadingNote.classList.add('is-on');
    const img = document.createElement('canvas'); img.width = img.height = RES;
    const g = img.getContext('2d');
    const data = g.createImageData(RES, RES);
    const H = new Float32Array(RES * RES), W = new Uint8Array(RES * RES);
    let row = 0, minH = Infinity, maxH = -Infinity;
    const cell = (2 * EXTENT) / RES;
    const sample = () => {
      const end = Math.min(RES, row + ROWS_PER_FRAME);
      for (; row < end; row++) {
        for (let i = 0; i < RES; i++) {
          const x = -EXTENT + (i + 0.5) * cell, z = -EXTENT + (row + 0.5) * cell;
          const hh = world.getHeightAt(x, z);
          const ws = world.getWaterSurfaceAt(x, z);
          H[row * RES + i] = hh;
          W[row * RES + i] = ws != null && ws > hh + 0.05 ? 1 : 0;
          if (hh < minH) minH = hh; if (hh > maxH) maxH = hh;
        }
      }
      if (row < RES) { requestAnimationFrame(sample); return; }
      shade();
    };
    const lerp = (a, b, t) => a + (b - a) * t;
    const ramp = [[0, [72, 98, 70]], [0.25, [96, 122, 80]], [0.5, [142, 140, 98]], [0.75, [150, 124, 92]], [1, [214, 206, 188]]];
    const colorAt = (t) => {
      for (let k = 1; k < ramp.length; k++) if (t <= ramp[k][0]) {
        const [t0, c0] = ramp[k - 1], [t1, c1] = ramp[k], u = (t - t0) / (t1 - t0);
        return [lerp(c0[0], c1[0], u), lerp(c0[1], c1[1], u), lerp(c0[2], c1[2], u)];
      }
      return ramp[ramp.length - 1][1];
    };
    function shade() {
      const span = Math.max(1, maxH - minH);
      for (let r = 0; r < RES; r++) for (let i = 0; i < RES; i++) {
        const idx = r * RES + i, o = idx * 4;
        const hh = H[idx];
        const hx = H[r * RES + Math.min(RES - 1, i + 1)] - H[r * RES + Math.max(0, i - 1)];
        const hz = H[Math.min(RES - 1, r + 1) * RES + i] - H[Math.max(0, r - 1) * RES + i];
        const slopeLight = Math.max(-1, Math.min(1, (-hx - hz) * 0.18)); // light from north-west
        let c;
        if (W[idx]) {
          const depth = 0.55 + 0.25 * Math.sin((i + r) * 0.4);
          c = [30 + depth * 12, 78 + depth * 24, 112 + depth * 30];
        } else {
          c = colorAt((hh - minH) / span);
          const k = 1 + slopeLight * 0.45;
          c = [c[0] * k, c[1] * k, c[2] * k];
        }
        data.data[o] = c[0]; data.data[o + 1] = c[1]; data.data[o + 2] = c[2]; data.data[o + 3] = 255;
      }
      g.putImageData(data, 0, 0);
      // upscale smoothly and draw paths on top
      base = document.createElement('canvas'); base.width = base.height = canvas.width;
      const b = base.getContext('2d');
      b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high';
      b.drawImage(img, 0, 0, canvas.width, canvas.height);
      const k = canvas.width / (2 * EXTENT);
      b.lineCap = 'round'; b.lineJoin = 'round';
      for (const path of game.layout?.PATHS || []) {
        b.beginPath();
        path.points.forEach((p, i) => { const x = (p.x + EXTENT) * k, y = (p.z + EXTENT) * k; i ? b.lineTo(x, y) : b.moveTo(x, y); });
        b.strokeStyle = 'rgba(30,22,12,0.35)'; b.lineWidth = path.width * k * 1.1 + 2; b.stroke();
        b.strokeStyle = 'rgba(226,200,150,0.85)'; b.lineWidth = Math.max(1.6, path.width * k * 0.7); b.stroke();
      }
      // subtle grid
      b.strokeStyle = 'rgba(255,255,255,0.05)'; b.lineWidth = 1;
      for (let m = -250; m <= 250; m += 100) { const p = (m + EXTENT) * k; b.beginPath(); b.moveTo(p, 0); b.lineTo(p, canvas.height); b.moveTo(0, p); b.lineTo(canvas.width, p); b.stroke(); }
      // play-area boundary
      const pb = game.layout?.PLAY_BOUNDS;
      if (pb) { b.setLineDash([6, 6]); b.strokeStyle = 'rgba(217,178,106,0.35)'; b.strokeRect((pb.minX + EXTENT) * k, (pb.minZ + EXTENT) * k, (pb.maxX - pb.minX) * k, (pb.maxZ - pb.minZ) * k); b.setLineDash([]); }
      canvas.getContext('2d').drawImage(base, 0, 0);
      builtFor = world; building = false; loadingNote.classList.remove('is-on');
    }
    requestAnimationFrame(sample);
  }

  function renderMarkers() {
    const locs = game.gameplay?.locations?.list?.() || [];
    const sig = JSON.stringify(locs.map((l) => [l.id, l.discovered]));
    if (sig === sideSig) return;
    sideSig = sig;
    markers.replaceChildren(); markerEls = new Map();
    for (const l of locs) {
      const [x, y] = toPct(l.x, l.z);
      const m = h('button', { class: `map-marker ${l.discovered ? 'found' : 'unknown'}`, type: 'button', style: { left: x + '%', top: y + '%' }, 'aria-label': l.discovered ? l.name : 'Onbekende locatie', 'data-nosfx': '' },
        h('span', { class: 'mk-dot' }, l.discovered ? null : h('i', { text: '?' })), l.discovered ? h('span', { class: 'mk-label', text: l.name }) : null);
      if (l.x > 90 || l.id === 'cave') m.classList.add('label-left');
      m.addEventListener('click', () => m.classList.toggle('show-label'));
      markers.append(m); markerEls.set(l.id, m);
    }
    const found = locs.filter((l) => l.discovered).length;
    const regions = game.layout?.REGIONS || [];
    side.replaceChildren(
      h('h3', { class: 'sec-title', text: `Locaties ${found}/${locs.length}` }),
      h('ul', { class: 'loc-list' }, locs.map((l) => h('li', { class: l.discovered ? 'found' : 'unknown' }, icon(l.discovered ? 'checkpointLoad' : 'lock'), h('span', { text: l.discovered ? l.name : '???' })))),
      h('h3', { class: 'sec-title', text: 'Regio’s' }),
      h('ul', { class: 'loc-list' }, regions.map((r) => h('li', { class: r.unlocked ? 'found' : 'locked' }, icon(r.unlocked ? 'compass' : 'lock'), h('span', { text: r.name }), r.unlocked ? null : h('em', { text: 'Vergrendeld' })))),
      h('div', { class: 'map-legend' },
        h('span', { class: 'lg lg-path' }), h('span', { text: 'Pad' }), h('span', { class: 'lg lg-water' }), h('span', { text: 'Water' }), h('span', { class: 'lg lg-me' }), h('span', { text: 'Jij' })));
  }

  function updatePlayer() {
    const p = game.player?.state;
    if (!p) return;
    const sig = Math.round(p.position.x) + ',' + Math.round(p.position.z) + ',' + Math.round((p.yaw || 0) * 20);
    if (sig === lastPos) return;
    lastPos = sig;
    const [x, y] = toPct(p.position.x, p.position.z);
    player.style.left = x + '%'; player.style.top = y + '%';
    arrow.style.transform = `rotate(${-(p.yaw || 0)}rad)`;
  }

  return {
    el,
    onShow() { sideSig = ''; lastPos = ''; if (builtFor !== game.world) buildBase(); else if (base) canvas.getContext('2d').drawImage(base, 0, 0); renderMarkers(); updatePlayer(); },
    update(dt) { acc += dt; if (acc < 0.15) return; acc = 0; renderMarkers(); updatePlayer(); },
  };
}
