/* =====================================================================
   EMPIRE CONQUEST — world map renderer & input (HTML canvas)
   Layers:
     1. terrain tiles — painted once per zoom level (LOD) and cached
     2. political overlay — one low-res canvas, redrawn only when owners
        or exploration change (territory colours + fog of war)
     3. vector borders — Path2D strokes (crisp at every zoom)
     4. cities, labels, armies, effects — drawn each frame in screen space
   ===================================================================== */
'use strict';

const MapView = {
  canvas: null, ctx: null, dpr: 1, w: 0, h: 0,
  cam: { x: 2000, y: 1300, z: 0.4 }, anim: null, minZ: 0.2, maxZ: 3.2,
  world: null, mode: 'political',
  hover: -1, sel: null, orderTarget: -1,
  tiles: new Map(), LEVELS: [0.25, 0.5, 1, 2], TILE: 512,
  overlay: null, OV: 0.35, overlayDirty: true, bordersDirty: true,
  terrPaths: [], coastPath: null, lakePath: null, internalPath: null, kingdomPaths: new Map(), lanePath: null,
  kingdomLabels: [], edgeBuckets: null, riverLines: [],
  particles: [], rings: [], flashes: [], battlesFx: [], floats: [], clouds: [],
  armyHits: [], time: 0, keys: new Set(), sprites: new Map(),
  pointers: new Map(), drag: null, pinch: null, vel: { x: 0, y: 0 },
  showTitle: false,

  /* ---------------- setup ---------------- */
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    Bus.on('ownership', () => { this.overlayDirty = true; this.bordersDirty = true; });
    Bus.on('explored', (e) => {
      this.overlayDirty = true;
      if (e && e.fx) for (const t of e.tids) this.ring(t, '#f7e7b0', 1.2);
    });
    Bus.on('battle', (r) => { if (Game.state.explored[r.tid]) this.battleFx(r.tid); });
    Bus.on('conquest', (c) => this.conquestFx(c.tid, c.kid));
    Bus.on('projectDone', (p) => { if (p.kid === 0) this.sparkle(p.tid, '#ffe28a'); });
  },

  setWorld(world) {
    this.world = world;
    this.tiles.clear();
    this.sprites.clear();
    const S = world.S;
    // territory outlines
    this.terrPaths = world.territories.map((t) => {
      const p = new Path2D();
      for (const loop of t.loops) {
        p.moveTo(loop[0], loop[1]);
        for (let i = 2; i < loop.length; i += 2) p.lineTo(loop[i], loop[i + 1]);
        p.closePath();
      }
      return p;
    });
    const edgePath = (list) => {
      const p = new Path2D();
      for (const it of list) {
        const pts = world.edges[it.e].pts;
        p.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
      }
      return p;
    };
    this.coastPath = edgePath(world.coastEdges.filter((c) => !c.lake));
    this.lakePath = edgePath(world.coastEdges.filter((c) => c.lake));
    this.internalPath = edgePath(world.borderEdges);
    // sea lanes
    this.lanePath = new Path2D();
    for (const l of world.lanes) {
      const mx = (l.ax + l.bx) / 2, my = (l.ay + l.by) / 2;
      const nx = -(l.by - l.ay) * 0.12, ny = (l.bx - l.ax) * 0.12;
      this.lanePath.moveTo(l.ax, l.ay);
      this.lanePath.quadraticCurveTo(mx + nx, my + ny, l.bx, l.by);
    }
    // spatial buckets for coast edges (tile rendering)
    this.edgeBuckets = new Map();
    const bk = (x, y) => Math.floor(x / 200) * 1000 + Math.floor(y / 200);
    for (const c of world.coastEdges) {
      const e = world.edges[c.e];
      const k = bk((e.ax + e.bx) / 2, (e.ay + e.by) / 2);
      if (!this.edgeBuckets.has(k)) this.edgeBuckets.set(k, []);
      this.edgeBuckets.get(k).push(c);
    }
    // rivers as smooth polylines with bounding boxes
    this.riverLines = world.rivers.map((path) => {
      const pts = [];
      for (let i = 0; i < path.length; i++) {
        const c = world.cells[path[i]];
        if (!c.land && i > 0) {
          const p = world.cells[path[i - 1]];
          pts.push((p.x + c.x) / 2, (p.y + c.y) / 2);
        } else {
          const j = (hashInts(world.seed, c.id) % 1000) / 1000 - 0.5;
          pts.push(c.x + j * 14, c.y - j * 12);
        }
      }
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (let i = 0; i < pts.length; i += 2) { minx = Math.min(minx, pts[i]); maxx = Math.max(maxx, pts[i]); miny = Math.min(miny, pts[i + 1]); maxy = Math.max(maxy, pts[i + 1]); }
      return { pts, bbox: [minx - 20, miny - 20, maxx + 20, maxy + 20] };
    });
    // overlay canvas
    this.overlay = document.createElement('canvas');
    this.overlay.width = Math.ceil(world.W * this.OV);
    this.overlay.height = Math.ceil(world.H * this.OV);
    this.overlayDirty = true; this.bordersDirty = true;
    this.makePatterns();
    // clouds
    const r = new Rng(world.seed + 5);
    this.clouds = [];
    for (let i = 0; i < 9; i++) this.clouds.push({ x: r.range(0, world.W), y: r.range(0, world.H), s: r.range(0.8, 1.6), a: r.range(0.5, 1), v: r.range(6, 12) });
    this.cloudSprite = this.makeCloud();
    this.fitZoom();
    // paint the coarsest level right away; finer tiles appear progressively
    for (const k of this.tileKeysForLevel(0)) this.renderTile(k.level, k.tx, k.ty);
  },

  fitZoom() {
    if (!this.world) return;
    this.minZ = Math.min(this.w / this.world.W, this.h / this.world.H) * 0.92;
    this.cam.z = clamp(this.cam.z, this.minZ, this.maxZ);
  },

  resize() {
    const c = this.canvas;
    if (!c) return;
    const r = c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr);
    this.fitZoom();
  },

  makePatterns() {
    // paper grain
    const g = document.createElement('canvas');
    g.width = g.height = 128;
    const gx = g.getContext('2d');
    const img = gx.createImageData(128, 128);
    const r = new Rng(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r.next() - 0.5) * 70;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    gx.putImageData(img, 0, 0);
    this.grain = g;
    // fog of war
    const f = document.createElement('canvas');
    f.width = f.height = 256;
    const fx = f.getContext('2d');
    fx.fillStyle = '#1b1a20';
    fx.fillRect(0, 0, 256, 256);
    const r2 = new Rng(99);
    for (let i = 0; i < 60; i++) {
      const x = r2.range(0, 256), y = r2.range(0, 256), rad = r2.range(20, 60);
      const grd = fx.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(70,66,80,0.35)');
      grd.addColorStop(1, 'rgba(70,66,80,0)');
      fx.fillStyle = grd;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { fx.save(); fx.translate(ox, oy); fx.fillRect(x - rad, y - rad, rad * 2, rad * 2); fx.restore(); }
    }
    this.fogCanvas = f;
    // neutral hatch
    const h = document.createElement('canvas');
    h.width = h.height = 24;
    const hx = h.getContext('2d');
    hx.strokeStyle = 'rgba(40,34,26,0.22)';
    hx.lineWidth = 3;
    hx.beginPath(); hx.moveTo(-6, 24); hx.lineTo(24, -6); hx.moveTo(6, 30); hx.lineTo(30, 6); hx.stroke();
    this.hatchCanvas = h;
  },

  makeCloud() {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 160;
    const x = c.getContext('2d');
    const r = new Rng(3);
    for (let i = 0; i < 14; i++) {
      const cx = r.range(70, 250), cy = r.range(55, 105), rad = r.range(30, 60);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    return c;
  },

  /* ---------------- terrain tiles ---------------- */
  tileKeysForLevel(li) {
    const sc = this.LEVELS[li], ws = this.TILE / sc;
    const out = [];
    for (let ty = 0; ty * ws < this.world.H; ty++) for (let tx = 0; tx * ws < this.world.W; tx++) out.push({ level: li, tx, ty });
    return out;
  },

  cellColor(c) {
    const TC = {
      plains: [169, 185, 106], forest: [92, 134, 70], mountains: [150, 141, 124], desert: [220, 197, 140], snow: [229, 236, 241],
    };
    let [r, g, b] = TC[c.terrain] || TC.plains;
    const n = ((hashInts(this.world.seed, c.id * 7) % 1000) / 1000 - 0.5) * 0.07;
    // hill shading: light from the north-west
    const W = this.world, cells = W.cells;
    const left = cells[c.id - 1], up = cells[c.id - W.COLS];
    let sh = 0;
    if (left && up) sh = ((c.elev - left.elev) + (c.elev - up.elev)) * (c.terrain === 'mountains' ? 1.6 : 0.9);
    sh = clamp(sh, -0.12, 0.12);
    // gentle blends: forests near deserts get drier, plains near snow paler
    if (c.terrain === 'plains' && c.temp > 0.66) { r += 12; g += 4; b -= 4; }
    if (c.terrain === 'plains' && c.temp < 0.28) { r += 10; g += 10; b += 16; }
    if (c.terrain === 'forest' && c.temp < 0.3) { r -= 14; g -= 6; b += 6; }
    const f = 1 + n + sh;
    return `rgb(${clamp(r * f, 0, 255) | 0},${clamp(g * f, 0, 255) | 0},${clamp(b * f, 0, 255) | 0})`;
  },
  waterColor(c) {
    if (c.lake) return '#4d8fb5';
    const d = c.coast;
    return d <= 1 ? '#3b7aa0' : d === 2 ? '#326d94' : d === 3 ? '#2b6188' : '#26577c';
  },

  polyPath(ctx, poly) {
    ctx.moveTo(poly[0], poly[1]);
    for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
    ctx.closePath();
  },
  pip(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  },

  renderTile(li, tx, ty) {
    const key = li + ':' + tx + ':' + ty;
    const sc = this.LEVELS[li], T = this.TILE, ws = T / sc;
    const wx0 = tx * ws, wy0 = ty * ws;
    const cv = document.createElement('canvas');
    cv.width = T; cv.height = T;
    const ctx = cv.getContext('2d');
    const W = this.world, S = W.S;
    ctx.setTransform(sc, 0, 0, sc, -wx0 * sc, -wy0 * sc);
    ctx.fillStyle = '#26577c';
    ctx.fillRect(wx0, wy0, ws, ws);
    const gx0 = Math.max(0, Math.floor(wx0 / S) - 2), gx1 = Math.min(W.COLS - 1, Math.floor((wx0 + ws) / S) + 2);
    const gy0 = Math.max(0, Math.floor(wy0 / S) - 2), gy1 = Math.min(W.ROWS - 1, Math.floor((wy0 + ws) / S) + 2);
    const cells = [];
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) cells.push(W.cells[gy * W.COLS + gx]);
    const px = 1 / sc; // one screen pixel in world units

    // water
    for (const c of cells) {
      if (c.land) continue;
      ctx.fillStyle = this.waterColor(c);
      ctx.beginPath(); this.polyPath(ctx, c.poly); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = px; ctx.stroke();
    }
    // waves
    if (sc >= 0.5) {
      ctx.strokeStyle = 'rgba(190,225,240,0.16)';
      ctx.lineWidth = 1.2 * px;
      ctx.beginPath();
      for (const c of cells) {
        if (c.land || c.lake || c.coast < 2) continue;
        const h = hashInts(W.seed, c.id, 3);
        if (h % 3 !== 0) continue;
        const x = c.x + ((h >> 4) % 30) - 15, y = c.y + ((h >> 9) % 30) - 15;
        ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x - 3.5, y - 3, x, y); ctx.quadraticCurveTo(x + 3.5, y - 3, x + 7, y);
      }
      ctx.stroke();
    }
    // coast: shallow glow + beach, drawn under the land
    const coastList = [];
    const b0x = Math.floor((wx0 - 120) / 200), b1x = Math.floor((wx0 + ws + 120) / 200);
    const b0y = Math.floor((wy0 - 120) / 200), b1y = Math.floor((wy0 + ws + 120) / 200);
    for (let by = b0y; by <= b1y; by++) for (let bx = b0x; bx <= b1x; bx++) {
      const arr = this.edgeBuckets.get(bx * 1000 + by);
      if (arr) coastList.push(...arr);
    }
    const strokeEdges = (list) => {
      ctx.beginPath();
      for (const it of list) {
        const p = W.edges[it.e].pts;
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      }
      ctx.stroke();
    };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const sea = coastList.filter((c) => !c.lake);
    ctx.strokeStyle = 'rgba(120,190,215,0.22)'; ctx.lineWidth = 34; strokeEdges(sea);
    ctx.strokeStyle = 'rgba(140,205,225,0.35)'; ctx.lineWidth = 16; strokeEdges(sea);
    ctx.strokeStyle = '#e3d3a4'; ctx.lineWidth = 7; strokeEdges(sea);
    ctx.strokeStyle = 'rgba(160,210,230,0.5)'; ctx.lineWidth = 8; strokeEdges(coastList.filter((c) => c.lake));

    // land
    for (const c of cells) {
      if (!c.land) continue;
      ctx.fillStyle = this.cellColor(c);
      ctx.beginPath(); this.polyPath(ctx, c.poly); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = px * 1.2; ctx.stroke();
    }
    // rivers
    for (const rl of this.riverLines) {
      const b = rl.bbox;
      if (b[2] < wx0 || b[0] > wx0 + ws || b[3] < wy0 || b[1] > wy0 + ws) continue;
      const p = rl.pts;
      const n = p.length / 2;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n - 1; i++) {
          const w = (1.6 + (i / n) * 4.2) * (pass ? 0.55 : 1);
          ctx.strokeStyle = pass ? '#7fb6d6' : '#4a86ae';
          ctx.lineWidth = Math.max(w, px * (pass ? 0.8 : 1.4));
          ctx.beginPath();
          const x0 = i === 0 ? p[0] : (p[i * 2 - 2] + p[i * 2]) / 2, y0 = i === 0 ? p[1] : (p[i * 2 - 1] + p[i * 2 + 1]) / 2;
          const x2 = i === n - 2 ? p[i * 2 + 2] : (p[i * 2] + p[i * 2 + 2]) / 2, y2 = i === n - 2 ? p[i * 2 + 3] : (p[i * 2 + 1] + p[i * 2 + 3]) / 2;
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(p[i * 2], p[i * 2 + 1], x2, y2);
          ctx.stroke();
        }
      }
    }
    // decorations
    this.decorate(ctx, cells, sc);
    // coastline ink
    ctx.strokeStyle = 'rgba(38,58,66,0.55)'; ctx.lineWidth = Math.max(1.1, px * 1.1); strokeEdges(coastList);
    // paper grain
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(this.grain, 'repeat');
    ctx.fillRect(0, 0, T, T);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.tiles.set(key, { cv, level: li });
    if (this.tiles.size > 56) {
      for (const [k, v] of this.tiles) { if (v.level > 0) { this.tiles.delete(k); break; } }
    }
    return cv;
  },

  decorate(ctx, cells, sc) {
    const W = this.world;
    const detail = sc >= 0.9 ? 2 : sc >= 0.45 ? 1 : 0;
    // collect glyphs, then draw back-to-front (sorted by y)
    const glyphs = [];
    for (const c of cells) {
      if (!c.land) continue;
      let h = hashInts(W.seed, c.id, 17);
      const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9 | 0; h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000; };
      const inside = (x, y) => this.pip(c.poly, x, y);
      if (c.terrain === 'forest') {
        const n = detail === 2 ? 7 : detail === 1 ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const x = c.x + (rnd() - 0.5) * W.S * 0.95, y = c.y + (rnd() - 0.5) * W.S * 0.95;
          if (inside(x, y)) glyphs.push({ k: c.temp < 0.32 ? 'pine' : 'tree', x, y, s: 0.8 + rnd() * 0.5, v: rnd() });
        }
      } else if (c.terrain === 'mountains') {
        const n = c.coast >= 3 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const x = c.x + (rnd() - 0.5) * W.S * 0.5, y = c.y + (rnd() - 0.5) * W.S * 0.4;
          glyphs.push({ k: 'mtn', x, y, s: 0.85 + rnd() * 0.5 + (c.elev > 0.9 ? 0.25 : 0), snow: c.temp < 0.45 || c.elev > 0.85, v: rnd() });
        }
      } else if (c.terrain === 'desert' && detail >= 1) {
        const n = detail === 2 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const x = c.x + (rnd() - 0.5) * W.S * 0.8, y = c.y + (rnd() - 0.5) * W.S * 0.8;
          if (inside(x, y)) glyphs.push({ k: 'dune', x, y, s: 0.7 + rnd() * 0.6 });
        }
        if (rnd() < 0.05) glyphs.push({ k: 'cactus', x: c.x, y: c.y, s: 1 });
      } else if (c.terrain === 'plains' && detail >= 1) {
        const n = detail === 2 ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const x = c.x + (rnd() - 0.5) * W.S * 0.9, y = c.y + (rnd() - 0.5) * W.S * 0.9;
          if (inside(x, y)) glyphs.push({ k: rnd() < 0.25 ? 'bush' : 'grass', x, y, s: 0.7 + rnd() * 0.6 });
        }
        if (detail === 2 && c.river && rnd() < 0.7) glyphs.push({ k: 'field', x: c.x + (rnd() - 0.5) * 20, y: c.y + (rnd() - 0.5) * 20, s: 1, v: rnd() });
      } else if (c.terrain === 'snow' && detail >= 1) {
        const n = detail === 2 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const x = c.x + (rnd() - 0.5) * W.S * 0.9, y = c.y + (rnd() - 0.5) * W.S * 0.9;
          if (inside(x, y)) glyphs.push({ k: rnd() < 0.35 ? 'pine' : 'drift', x, y, s: 0.7 + rnd() * 0.5, v: rnd(), snowy: true });
        }
      }
    }
    glyphs.sort((a, b) => a.y - b.y);
    for (const g of glyphs) this.drawGlyph(ctx, g, sc);
  },

  drawGlyph(ctx, g, sc) {
    const s = g.s;
    switch (g.k) {
      case 'tree': {
        ctx.fillStyle = 'rgba(30,45,20,0.28)';
        ctx.beginPath(); ctx.ellipse(g.x + 2, g.y + 5 * s, 6 * s, 2.6 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = g.v < 0.5 ? '#3f6a2f' : '#4a7735';
        ctx.beginPath(); ctx.arc(g.x, g.y, 6 * s, 0, TAU); ctx.fill();
        ctx.fillStyle = g.v < 0.5 ? '#5a8a42' : '#669848';
        ctx.beginPath(); ctx.arc(g.x - 1.8 * s, g.y - 2 * s, 3.4 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'pine': {
        ctx.fillStyle = 'rgba(30,40,40,0.25)';
        ctx.beginPath(); ctx.ellipse(g.x + 1.5, g.y + 6 * s, 5 * s, 2 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = g.snowy ? '#4d6b5c' : '#2f5a3c';
        ctx.beginPath(); ctx.moveTo(g.x, g.y - 10 * s); ctx.lineTo(g.x + 5.5 * s, g.y + 6 * s); ctx.lineTo(g.x - 5.5 * s, g.y + 6 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = g.snowy ? '#e8eff3' : '#44744f';
        ctx.beginPath(); ctx.moveTo(g.x, g.y - 10 * s); ctx.lineTo(g.x + 2.5 * s, g.y - 3 * s); ctx.lineTo(g.x - 3 * s, g.y - 2 * s); ctx.closePath(); ctx.fill();
        break;
      }
      case 'mtn': {
        const w = 17 * s, hgt = 20 * s;
        ctx.fillStyle = 'rgba(40,34,28,0.25)';
        ctx.beginPath(); ctx.ellipse(g.x + 3, g.y + 2, w * 1.05, 4 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b3a896';
        ctx.beginPath(); ctx.moveTo(g.x - w, g.y + 2); ctx.lineTo(g.x - w * 0.1, g.y - hgt); ctx.lineTo(g.x + 2 * s, g.y + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7d7262';
        ctx.beginPath(); ctx.moveTo(g.x - w * 0.1, g.y - hgt); ctx.lineTo(g.x + w, g.y + 2); ctx.lineTo(g.x + 2 * s, g.y + 2); ctx.closePath(); ctx.fill();
        if (g.snow) {
          ctx.fillStyle = '#f3f6f8';
          ctx.beginPath(); ctx.moveTo(g.x - w * 0.1, g.y - hgt); ctx.lineTo(g.x + w * 0.3, g.y - hgt * 0.55); ctx.lineTo(g.x + w * 0.05, g.y - hgt * 0.62);
          ctx.lineTo(g.x - w * 0.18, g.y - hgt * 0.5); ctx.lineTo(g.x - w * 0.42, g.y - hgt * 0.55); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(60,50,40,0.35)'; ctx.lineWidth = Math.max(0.6, 0.7 / sc);
        ctx.beginPath(); ctx.moveTo(g.x - w, g.y + 2); ctx.lineTo(g.x - w * 0.1, g.y - hgt); ctx.lineTo(g.x + w, g.y + 2); ctx.stroke();
        break;
      }
      case 'dune': {
        ctx.strokeStyle = 'rgba(170,135,70,0.45)'; ctx.lineWidth = Math.max(1, 1.3 * s);
        ctx.beginPath(); ctx.moveTo(g.x - 9 * s, g.y + 2); ctx.quadraticCurveTo(g.x, g.y - 5 * s, g.x + 9 * s, g.y + 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,200,0.4)';
        ctx.beginPath(); ctx.moveTo(g.x - 7 * s, g.y); ctx.quadraticCurveTo(g.x - 1, g.y - 5 * s, g.x + 5 * s, g.y - 1); ctx.stroke();
        break;
      }
      case 'cactus': {
        ctx.strokeStyle = '#5f7a3a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(g.x, g.y + 5); ctx.lineTo(g.x, g.y - 7); ctx.moveTo(g.x, g.y - 1); ctx.lineTo(g.x - 3.5, g.y - 3); ctx.lineTo(g.x - 3.5, g.y - 6);
        ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + 3.5, g.y - 2); ctx.lineTo(g.x + 3.5, g.y - 5); ctx.stroke();
        break;
      }
      case 'grass': {
        ctx.strokeStyle = 'rgba(95,120,55,0.55)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(g.x - 2, g.y); ctx.lineTo(g.x - 3, g.y - 4 * s); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x, g.y - 5 * s); ctx.moveTo(g.x + 2, g.y); ctx.lineTo(g.x + 3, g.y - 4 * s); ctx.stroke();
        break;
      }
      case 'bush': {
        ctx.fillStyle = 'rgba(88,120,58,0.8)';
        ctx.beginPath(); ctx.arc(g.x, g.y, 3 * s, 0, TAU); ctx.arc(g.x + 3 * s, g.y + 1, 2.4 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'field': {
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.v * 1.2 - 0.6);
        const cols = ['#c9bf6e', '#b9b562', '#d4c47a', '#a7ae5c'];
        for (let i = 0; i < 3; i++) { ctx.fillStyle = cols[(i + Math.floor(g.v * 4)) % 4]; ctx.fillRect(-12 + i * 8, -7, 7.5, 14); }
        ctx.strokeStyle = 'rgba(120,110,60,0.35)'; ctx.lineWidth = 0.6; ctx.strokeRect(-12, -7, 23.5, 14);
        ctx.restore();
        break;
      }
      case 'drift': {
        ctx.fillStyle = 'rgba(190,208,222,0.6)';
        ctx.beginPath(); ctx.ellipse(g.x, g.y, 7 * s, 2.2 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.ellipse(g.x - 1, g.y - 1, 5 * s, 1.4 * s, 0, 0, TAU); ctx.fill();
        break;
      }
    }
  },

  /* ---------------- political overlay ---------------- */
  rebuildOverlay() {
    const s = Game.state, W = this.world;
    const o = this.overlay, x = o.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, o.width, o.height);
    x.setTransform(this.OV, 0, 0, this.OV, 0, 0);
    x.lineJoin = 'round';
    const hatch = x.createPattern(this.hatchCanvas, 'repeat');
    for (let t = 0; t < W.territories.length; t++) {
      const ts = s.terr[t];
      const p = this.terrPaths[t];
      if (!s.explored[t]) continue;
      if (ts.owner >= 0) {
        const col = Game.ownerColor(ts.owner);
        x.fillStyle = rgba(col, ts.owner === 0 ? 0.34 : 0.3);
        x.fill(p);
        x.save(); x.clip(p);
        x.strokeStyle = rgba(col, 0.6); x.lineWidth = 30; x.stroke(p);
        x.strokeStyle = rgba(col, 0.5); x.lineWidth = 12; x.stroke(p);
        x.restore();
      } else {
        x.fillStyle = 'rgba(70,60,48,0.12)';
        x.fill(p);
        x.fillStyle = hatch;
        x.fill(p);
      }
    }
    // fog of war
    const fog = x.createPattern(this.fogCanvas, 'repeat');
    x.save();
    x.beginPath();
    let any = false;
    for (let t = 0; t < W.territories.length; t++) if (!s.explored[t]) { any = true; }
    if (any) {
      x.fillStyle = fog;
      x.globalAlpha = 0.86;
      for (let t = 0; t < W.territories.length; t++) if (!s.explored[t]) x.fill(this.terrPaths[t]);
      x.globalAlpha = 1;
      x.strokeStyle = 'rgba(27,26,32,0.86)'; x.lineWidth = 6;
      for (let t = 0; t < W.territories.length; t++) if (!s.explored[t]) x.stroke(this.terrPaths[t]);
    }
    x.restore();
    this.overlayDirty = false;
  },

  rebuildBorders() {
    const s = Game.state, W = this.world;
    this.kingdomPaths = new Map();
    const add = (kid, pts) => {
      if (!this.kingdomPaths.has(kid)) this.kingdomPaths.set(kid, new Path2D());
      const p = this.kingdomPaths.get(kid);
      p.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
    };
    for (const b of W.borderEdges) {
      const oa = s.terr[b.a].owner, ob = s.terr[b.b].owner;
      if (oa === ob) continue;
      const pts = W.edges[b.e].pts;
      if (oa >= 0 && s.explored[b.a]) add(oa, pts);
      if (ob >= 0 && s.explored[b.b]) add(ob, pts);
    }
    for (const c of W.coastEdges) {
      const o = s.terr[c.t] ? s.terr[c.t].owner : -1;
      if (o >= 0 && s.explored[c.t]) add(o, W.edges[c.e].pts);
    }
    // kingdom name labels: centroid of the largest connected block
    this.kingdomLabels = [];
    for (const k of s.kingdoms) {
      if (!k.alive) continue;
      const own = Game.territoriesOf(k.id).filter((t) => s.explored[t]);
      if (!own.length) continue;
      const set = new Set(own), seen = new Set();
      let best = null;
      for (const t0 of own) {
        if (seen.has(t0)) continue;
        const comp = [t0]; seen.add(t0);
        for (let i = 0; i < comp.length; i++) for (const a of W.territories[comp[i]].nb) if (set.has(a) && !seen.has(a)) { seen.add(a); comp.push(a); }
        const area = comp.reduce((acc, t) => acc + W.territories[t].area, 0);
        if (!best || area > best.area) best = { comp, area };
      }
      let x = 0, y = 0;
      for (const t of best.comp) { x += W.territories[t].cx * W.territories[t].area; y += W.territories[t].cy * W.territories[t].area; }
      x /= best.area; y /= best.area;
      this.kingdomLabels.push({ kid: k.id, x, y, size: clamp(Math.sqrt(best.area) * 9, 40, 150), n: best.comp.length });
    }
    this.bordersDirty = false;
  },

  /* ---------------- camera ---------------- */
  worldToScreen(x, y) { return { x: (x - this.cam.x) * this.cam.z + this.w / 2, y: (y - this.cam.y) * this.cam.z + this.h / 2 }; },
  screenToWorld(x, y) { return { x: (x - this.w / 2) / this.cam.z + this.cam.x, y: (y - this.h / 2) / this.cam.z + this.cam.y }; },
  clampCam() {
    if (!this.world) return;
    this.cam.z = clamp(this.cam.z, this.minZ, this.maxZ);
    this.cam.x = clamp(this.cam.x, 0, this.world.W);
    this.cam.y = clamp(this.cam.y, 0, this.world.H);
  },
  zoomAt(sx, sy, f) {
    const before = this.screenToWorld(sx, sy);
    this.cam.z = clamp(this.cam.z * f, this.minZ, this.maxZ);
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
    this.anim = null;
    this.clampCam();
  },
  flyTo(x, y, z, dur = 0.7) {
    this.anim = { x0: this.cam.x, y0: this.cam.y, z0: this.cam.z, x1: x, y1: y, z1: clamp(z || this.cam.z, this.minZ, this.maxZ), t: 0, dur };
  },
  focusTerritory(tid, z) {
    const t = this.world.territories[tid];
    this.flyTo(t.cx, t.cy, z || Math.max(this.cam.z, 0.9));
  },

  /* ---------------- input ---------------- */
  bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (this.showTitle) return;
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      this.vel.x = this.vel.y = 0;
      if (this.pointers.size === 1) {
        this.drag = { x: e.offsetX, y: e.offsetY, cx: this.cam.x, cy: this.cam.y, moved: false, button: e.button, t: performance.now(), lx: e.offsetX, ly: e.offsetY };
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z };
        if (this.drag) this.drag.moved = true;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (this.showTitle) return;
      const p = this.pointers.get(e.pointerId);
      if (p) { p.x = e.offsetX; p.y = e.offsetY; }
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const target = clamp(this.pinch.z * d / Math.max(10, this.pinch.d), this.minZ, this.maxZ);
        this.zoomAt(mx, my, target / this.cam.z);
        return;
      }
      if (this.drag && this.pointers.size === 1) {
        const dx = e.offsetX - this.drag.x, dy = e.offsetY - this.drag.y;
        if (!this.drag.moved && Math.hypot(dx, dy) > 6) this.drag.moved = true;
        if (this.drag.moved) {
          this.cam.x = this.drag.cx - dx / this.cam.z;
          this.cam.y = this.drag.cy - dy / this.cam.z;
          const now = performance.now(), dt = Math.max(1, now - this.drag.t);
          this.vel.x = -(e.offsetX - this.drag.lx) / this.cam.z / dt * 16;
          this.vel.y = -(e.offsetY - this.drag.ly) / this.cam.z / dt * 16;
          this.drag.t = now; this.drag.lx = e.offsetX; this.drag.ly = e.offsetY;
          this.anim = null;
          this.clampCam();
          c.style.cursor = 'grabbing';
        }
        return;
      }
      if (e.pointerType === 'mouse') this.updateHover(e.offsetX, e.offsetY, e.clientX, e.clientY);
    });
    const end = (e) => {
      if (this.showTitle) return;
      const wasPinch = !!this.pinch;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.drag && this.pointers.size === 0) {
        if (!this.drag.moved && !wasPinch) this.click(e.offsetX, e.offsetY, this.drag.button);
        if (performance.now() - this.drag.t > 80) this.vel.x = this.vel.y = 0;
        this.drag = null;
        c.style.cursor = '';
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => { if (!this.drag) { this.hover = -1; Bus.emit('mapHover', null); } });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.showTitle) return;
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
      this.zoomAt(e.offsetX, e.offsetY, f);
    }, { passive: false });
    c.addEventListener('dblclick', (e) => { if (!this.showTitle) this.zoomAt(e.offsetX, e.offsetY, 1.8); });
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  },

  updateHover(sx, sy, cx, cy) {
    if (!this.world || !Game.state) return;
    const armyHit = this.pickArmy(sx, sy);
    const w = this.screenToWorld(sx, sy);
    const t = this.world.territoryAt(w.x, w.y);
    this.hover = t;
    this.canvas.style.cursor = armyHit || t >= 0 ? 'pointer' : '';
    Bus.emit('mapHover', armyHit ? { army: armyHit.id, x: cx, y: cy } : t >= 0 ? { tid: t, x: cx, y: cy } : null);
  },

  pickArmy(sx, sy) {
    for (let i = this.armyHits.length - 1; i >= 0; i--) {
      const h = this.armyHits[i];
      if (sx >= h.x && sx <= h.x + h.w && sy >= h.y && sy <= h.y + h.h) return Army.byId(h.id);
    }
    return null;
  },

  click(sx, sy, button) {
    if (!this.world || !Game.state) return;
    const w = this.screenToWorld(sx, sy);
    const tid = this.world.territoryAt(w.x, w.y);
    const selArmy = this.sel && this.sel.type === 'army' ? Army.byId(this.sel.id) : null;
    if (button === 2) {
      if (selArmy && selArmy.owner === 0 && tid >= 0) Bus.emit('orderArmy', { army: selArmy.id, tid });
      return;
    }
    const a = this.pickArmy(sx, sy);
    if (a) { this.select({ type: 'army', id: a.id }); Sound.play('click'); return; }
    if (selArmy && selArmy.owner === 0 && tid >= 0 && tid !== (selArmy.move ? selArmy.move.to : selArmy.loc)) {
      this.orderTarget = tid;
      Bus.emit('orderPreview', { army: selArmy.id, tid });
      Sound.play('click');
      return;
    }
    if (tid >= 0) { this.select({ type: 'terr', id: tid }); Sound.play('click'); }
    else this.select(null);
  },

  select(sel) {
    this.sel = sel;
    this.orderTarget = -1;
    Bus.emit('select', sel);
  },

  /* ---------------- effects ---------------- */
  ring(tid, color, dur = 1.4) {
    const t = this.world.territories[tid];
    this.rings.push({ x: t.cx, y: t.cy, color, t: 0, dur });
  },
  battleFx(tid) {
    const t = this.world.territories[tid];
    this.battlesFx.push({ x: t.cx, y: t.cy, t: 0, dur: 2.6 });
    for (let i = 0; i < 26; i++) this.particles.push({ x: t.cx, y: t.cy, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90 - 30, life: 0, max: 0.6 + Math.random() * 0.8, kind: 'spark', size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#ffd166' : '#ff7b39' });
    for (let i = 0; i < 12; i++) this.particles.push({ x: t.cx + (Math.random() - 0.5) * 30, y: t.cy + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 12, vy: -8 - Math.random() * 12, life: 0, max: 1.6 + Math.random() * 1.2, kind: 'smoke', size: 8 + Math.random() * 10 });
  },
  conquestFx(tid, kid) {
    const col = Game.ownerColor(kid);
    this.flashes.push({ tid, color: col, t: 0, dur: 1.6 });
    this.ring(tid, col, 1.6);
    if (kid === 0) {
      const t = this.world.territories[tid];
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * TAU, v = 40 + Math.random() * 120;
        this.particles.push({ x: t.cx, y: t.cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0, max: 1 + Math.random(), kind: 'confetti', size: 2.5 + Math.random() * 2.5, color: Math.random() < 0.5 ? '#ffd76a' : col, rot: Math.random() * TAU });
      }
    }
  },
  sparkle(tid, color) {
    const t = this.world.territories[tid];
    for (let i = 0; i < 18; i++) this.particles.push({ x: t.cx + (Math.random() - 0.5) * 30, y: t.cy + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 16, vy: -20 - Math.random() * 30, life: 0, max: 0.8 + Math.random() * 0.8, kind: 'spark', size: 1.6 + Math.random() * 1.8, color });
  },
  floatText(tid, text, color = '#ffe28a') {
    const t = this.world.territories[tid];
    this.floats.push({ x: t.cx, y: t.cy, text, color, t: 0, dur: 1.8 });
  },

  /* ---------------- sprites ---------------- */
  citySprite(kind, color) {
    const key = kind + color;
    if (this.sprites.has(key)) return this.sprites.get(key);
    const S = 72;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const x = c.getContext('2d');
    x.translate(S / 2, S / 2 + 6);
    const wall = '#e9dfc8', wallD = '#b9ab8c', roof = '#b5523b', roofD = '#8d3b2a', stone = '#c9c1b0', stoneD = '#8f877a';
    const house = (hx, hy, w, h, r = roof) => {
      x.fillStyle = wallD; x.fillRect(hx - w / 2 + w * 0.55, hy - h, w * 0.45, h);
      x.fillStyle = wall; x.fillRect(hx - w / 2, hy - h, w * 0.55, h);
      x.fillStyle = r; x.beginPath(); x.moveTo(hx - w / 2 - 1.5, hy - h); x.lineTo(hx, hy - h - w * 0.55); x.lineTo(hx + w / 2 + 1.5, hy - h); x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.beginPath(); x.moveTo(hx, hy - h - w * 0.55); x.lineTo(hx + w / 2 + 1.5, hy - h); x.lineTo(hx, hy - h); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(40,25,15,0.55)'; x.lineWidth = 1; x.strokeRect(hx - w / 2, hy - h, w, h);
    };
    const tower = (tx, ty, w, h, flag) => {
      x.fillStyle = stoneD; x.fillRect(tx, ty - h, w / 2, h);
      x.fillStyle = stone; x.fillRect(tx - w / 2, ty - h, w / 2 + 0.5, h);
      x.fillStyle = stone;
      for (let i = 0; i < 3; i++) x.fillRect(tx - w / 2 + i * (w / 3), ty - h - 3, w / 3 - 1.2, 3);
      x.strokeStyle = 'rgba(40,30,20,0.6)'; x.lineWidth = 1; x.strokeRect(tx - w / 2, ty - h, w, h);
      if (flag) {
        x.strokeStyle = '#3a2d20'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(tx, ty - h - 3); x.lineTo(tx, ty - h - 15); x.stroke();
        x.fillStyle = color; x.beginPath(); x.moveTo(tx, ty - h - 15); x.lineTo(tx + 10, ty - h - 12); x.lineTo(tx, ty - h - 9); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.4)'; x.stroke();
      }
    };
    // ground shadow
    x.fillStyle = 'rgba(0,0,0,0.28)';
    x.beginPath(); x.ellipse(0, 4, kind === 'v' ? 15 : kind === 't' ? 20 : 26, kind === 'v' ? 5 : 7, 0, 0, TAU); x.fill();
    if (kind === 'v') {
      house(-6, 2, 11, 8); house(6, 4, 10, 7, '#a0643a');
      x.fillStyle = color; x.fillRect(-1, -20, 1.4, 12); x.beginPath(); x.moveTo(0.4, -20); x.lineTo(8, -17.5); x.lineTo(0.4, -15); x.fill();
    } else if (kind === 't') {
      tower(0, -2, 9, 18, true);
      house(-11, 3, 11, 9); house(11, 3, 11, 8, '#a0643a'); house(-3, 8, 10, 7); house(6, 9, 9, 6, roofD);
    } else if (kind === 'c' || kind === 'm') {
      const R = kind === 'c' ? 21 : 25;
      x.fillStyle = stoneD; x.beginPath(); x.ellipse(0, 2, R, R * 0.42, 0, 0, TAU); x.fill();
      x.fillStyle = '#9fae6a'; x.beginPath(); x.ellipse(0, 0, R - 3, R * 0.42 - 3, 0, 0, TAU); x.fill();
      house(-9, 0, 10, 9); house(8, 1, 10, 8, '#a0643a'); house(-1, 6, 11, 8); house(-14, 7, 8, 6, roofD); house(14, 7, 8, 6);
      if (kind === 'm') { house(3, -5, 9, 9, roofD); }
      tower(0, -4, 10, kind === 'm' ? 26 : 20, true);
      x.strokeStyle = stone; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 2, R, R * 0.42, 0, 0.05 * Math.PI, 0.95 * Math.PI); x.stroke();
      if (kind === 'm') { tower(-R + 2, 6, 7, 12, false); tower(R - 2, 6, 7, 12, false); }
    } else if (kind === 'cap') {
      // castle with keep, towers, banner and crown
      x.fillStyle = stoneD; x.fillRect(-20, -12, 40, 16);
      x.fillStyle = stone; x.fillRect(-20, -12, 24, 16);
      for (let i = 0; i < 7; i++) x.fillRect(-20 + i * 6, -15, 4, 3);
      x.strokeStyle = 'rgba(40,30,20,0.6)'; x.lineWidth = 1; x.strokeRect(-20, -12, 40, 16);
      tower(-18, 4, 9, 24, false); tower(18, 4, 9, 24, false);
      tower(0, -6, 12, 26, true);
      x.fillStyle = '#3b2f24'; x.beginPath(); x.moveTo(-4, 4); x.lineTo(-4, -2); x.arc(0, -2, 4, Math.PI, 0); x.lineTo(4, 4); x.fill();
      // crown
      x.fillStyle = '#ffd24a'; x.strokeStyle = '#8a5a12'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(-8, -40); x.lineTo(-8, -46); x.lineTo(-4, -43); x.lineTo(0, -49); x.lineTo(4, -43); x.lineTo(8, -46); x.lineTo(8, -40); x.closePath(); x.fill(); x.stroke();
    }
    this.sprites.set(key, c);
    return c;
  },

  /* ---------------- main render ---------------- */
  frame(dt) {
    if (!this.world || !this.ctx) return;
    this.time += dt;
    const ctx = this.ctx, dpr = this.dpr, cam = this.cam, W = this.world;
    // camera animation, keyboard pan, inertia
    if (this.anim) {
      const a = this.anim;
      a.t += dt / a.dur;
      const e = smooth(clamp(a.t, 0, 1));
      cam.x = lerp(a.x0, a.x1, e); cam.y = lerp(a.y0, a.y1, e); cam.z = Math.exp(lerp(Math.log(a.z0), Math.log(a.z1), e));
      if (a.t >= 1) this.anim = null;
    } else if (!this.drag && (Math.abs(this.vel.x) > 0.01 || Math.abs(this.vel.y) > 0.01)) {
      cam.x += this.vel.x * dt * 60; cam.y += this.vel.y * dt * 60;
      this.vel.x *= Math.pow(0.9, dt * 60); this.vel.y *= Math.pow(0.9, dt * 60);
    }
    const k = this.keys, pan = 700 * dt / cam.z;
    if (!this.showTitle) {
      if (k.has('a') || k.has('arrowleft')) cam.x -= pan;
      if (k.has('d') || k.has('arrowright')) cam.x += pan;
      if (k.has('w') || k.has('arrowup')) cam.y -= pan;
      if (k.has('s') || k.has('arrowdown')) cam.y += pan;
      if (k.has('+') || k.has('=')) this.zoomAt(this.w / 2, this.h / 2, Math.exp(dt * 1.6));
      if (k.has('-') || k.has('_')) this.zoomAt(this.w / 2, this.h / 2, Math.exp(-dt * 1.6));
    }
    if (this.showTitle) { cam.x += dt * 14; if (cam.x > W.W * 0.8) cam.x = W.W * 0.2; }
    this.clampCam();
    const s = Game.state;
    if (s && this.overlayDirty) this.rebuildOverlay();
    if (s && this.bordersDirty) this.rebuildBorders();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1d4868';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const z = cam.z;
    const ox = this.w / 2 - cam.x * z, oy = this.h / 2 - cam.y * z;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    const v0 = this.screenToWorld(0, 0), v1 = this.screenToWorld(this.w, this.h);

    this.drawTerrain(ctx, v0, v1, z);

    if (s) {
      // political layer
      ctx.globalAlpha = this.mode === 'political' ? 1 : 0.35;
      ctx.drawImage(this.overlay, 0, 0, W.W, W.H);
      ctx.globalAlpha = 1;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // sea lanes
      if (z > 0.3) {
        ctx.save();
        ctx.setLineDash([6 / z, 7 / z]);
        ctx.strokeStyle = 'rgba(225,240,250,0.35)'; ctx.lineWidth = 1.4 / z;
        ctx.stroke(this.lanePath);
        ctx.restore();
      }
      // borders
      ctx.strokeStyle = this.mode === 'political' ? 'rgba(30,24,18,0.32)' : 'rgba(30,24,18,0.22)';
      ctx.lineWidth = 1 / z;
      ctx.stroke(this.internalPath);
      for (const [kid, p] of this.kingdomPaths) {
        const col = Game.ownerColor(kid);
        ctx.strokeStyle = 'rgba(15,12,10,0.6)'; ctx.lineWidth = 4.2 / z; ctx.stroke(p);
        ctx.strokeStyle = shade(col, 0.15); ctx.lineWidth = 2.2 / z; ctx.stroke(p);
      }
      // conquest flashes
      for (const f of this.flashes) {
        const a = 1 - f.t / f.dur;
        ctx.fillStyle = rgba(f.color, 0.55 * a);
        ctx.fill(this.terrPaths[f.tid]);
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`; ctx.lineWidth = 3 / z; ctx.stroke(this.terrPaths[f.tid]);
      }
      // hover
      if (this.hover >= 0 && !this.drag) {
        ctx.fillStyle = 'rgba(255,248,220,0.1)';
        ctx.fill(this.terrPaths[this.hover]);
        ctx.strokeStyle = 'rgba(255,248,220,0.55)'; ctx.lineWidth = 1.5 / z; ctx.stroke(this.terrPaths[this.hover]);
      }
      // selection glow
      const selT = this.sel && this.sel.type === 'terr' ? this.sel.id : -1;
      if (selT >= 0) this.drawGlow(ctx, selT, '#ffd76a', z);
      if (this.orderTarget >= 0) {
        const hostile = Game.isHostile(0, s.terr[this.orderTarget].owner);
        this.drawGlow(ctx, this.orderTarget, hostile ? '#ff5a4a' : '#7fe0a0', z);
      }
      this.drawPaths(ctx, z);
      // clouds (only when zoomed out)
      const ca = clamp((0.85 - z) / 0.5, 0, 1) * 0.5;
      if (ca > 0.02) {
        ctx.globalAlpha = ca;
        for (const c of this.clouds) {
          c.x += c.v * dt; if (c.x > W.W + 300) c.x = -300;
          ctx.drawImage(this.cloudSprite, c.x - 160 * c.s * 1.8, c.y - 80 * c.s * 1.8, 320 * c.s * 1.8, 160 * c.s * 1.8);
        }
        ctx.globalAlpha = 1;
      }
    }

    // screen-space layer
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s) {
      this.drawKingdomLabels(ctx, z);
      this.drawCities(ctx, z, v0, v1);
      this.drawArmies(ctx, z);
      this.drawFx(ctx, dt, z);
    }
  },

  drawTerrain(ctx, v0, v1, z) {
    const W = this.world;
    const need = z * this.dpr;
    let li = this.LEVELS.findIndex((l) => l >= need * 0.85);
    if (li < 0) li = this.LEVELS.length - 1;
    // coarse base always (never missing)
    const base = this.tileKeysForLevel(0);
    const ws0 = this.TILE / this.LEVELS[0];
    const pad = 0.8 / z;
    for (const k of base) {
      const t = this.tiles.get('0:' + k.tx + ':' + k.ty) || { cv: this.renderTile(0, k.tx, k.ty) };
      ctx.drawImage(t.cv, k.tx * ws0, k.ty * ws0, ws0 + pad, ws0 + pad);
    }
    if (li === 0) return;
    const ws = this.TILE / this.LEVELS[li];
    const tx0 = Math.max(0, Math.floor(v0.x / ws)), tx1 = Math.min(Math.ceil(W.W / ws) - 1, Math.floor(v1.x / ws));
    const ty0 = Math.max(0, Math.floor(v0.y / ws)), ty1 = Math.min(Math.ceil(W.H / ws) - 1, Math.floor(v1.y / ws));
    const t0 = performance.now();
    const missing = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = li + ':' + tx + ':' + ty;
        let t = this.tiles.get(key);
        if (t) { this.tiles.delete(key); this.tiles.set(key, t); }
        else missing.push([tx, ty]);
        if (t) ctx.drawImage(t.cv, tx * ws, ty * ws, ws + pad, ws + pad);
      }
    }
    // render missing tiles within a small time budget (nearest to the centre first)
    if (missing.length) {
      const cx = (v0.x + v1.x) / 2, cy = (v0.y + v1.y) / 2;
      missing.sort((a, b) => dist((a[0] + 0.5) * ws, (a[1] + 0.5) * ws, cx, cy) - dist((b[0] + 0.5) * ws, (b[1] + 0.5) * ws, cx, cy));
      for (const [tx, ty] of missing) {
        if (performance.now() - t0 > 14) break;
        // an intermediate level may already exist; otherwise the base shows through
        const cv = this.renderTile(li, tx, ty);
        ctx.drawImage(cv, tx * ws, ty * ws, ws + pad, ws + pad);
      }
    }
  },

  drawGlow(ctx, tid, color, z) {
    const p = this.terrPaths[tid];
    const pulse = 0.65 + Math.sin(this.time * 4) * 0.25;
    ctx.save();
    ctx.fillStyle = rgba(color, 0.1 * pulse);
    ctx.fill(p);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * this.dpr;
    ctx.strokeStyle = rgba(color, pulse);
    ctx.lineWidth = 2.6 / z;
    ctx.stroke(p);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1 / z;
    ctx.stroke(p);
    ctx.restore();
  },

  /* planned routes of the player's armies and approaching enemies */
  drawPaths(ctx, z) {
    const s = Game.state, W = this.world;
    const selArmy = this.sel && this.sel.type === 'army' ? Army.byId(this.sel.id) : null;
    ctx.save();
    ctx.lineCap = 'round';
    for (const a of s.armies) {
      const mine = a.owner === 0;
      const isSel = selArmy === a;
      if (!mine && !(a.move && (s.explored[a.move.to] || s.explored[a.move.from]))) continue;
      const pts = [];
      const pos = Army.position(a);
      pts.push([pos.x, pos.y]);
      if (a.move) pts.push([W.territories[a.move.to].cx, W.territories[a.move.to].cy]);
      if (mine) for (const t of a.path) { if (a.move && t === a.move.to) continue; pts.push([W.territories[t].cx, W.territories[t].cy]); }
      if (pts.length < 2) continue;
      const last = mine ? (a.path.length ? a.path[a.path.length - 1] : a.move ? a.move.to : -1) : a.move.to;
      const hostile = last >= 0 && Game.isHostile(a.owner, s.terr[last].owner);
      const col = mine ? (hostile ? '#ff6b5a' : '#fff1c1') : rgba(Game.ownerColor(a.owner), 0.9);
      ctx.setLineDash([9 / z, 7 / z]);
      ctx.lineDashOffset = -this.time * 26 / z;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = (isSel ? 5 : 4) / z;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = (isSel ? 2.6 : 2) / z;
      ctx.stroke();
      ctx.setLineDash([]);
      // arrow head
      const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
      const ang = Math.atan2(by - ay, bx - ax), L = 12 / z;
      const tipx = bx - Math.cos(ang) * 16 / z, tipy = by - Math.sin(ang) * 16 / z;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.lineTo(tipx - Math.cos(ang - 0.45) * L, tipy - Math.sin(ang - 0.45) * L); ctx.lineTo(tipx - Math.cos(ang + 0.45) * L, tipy - Math.sin(ang + 0.45) * L); ctx.closePath(); ctx.fill();
    }
    // preview of a pending order
    if (selArmy && selArmy.owner === 0 && this.orderTarget >= 0) {
      const r = Army.findPath(0, selArmy.move ? selArmy.move.to : selArmy.loc, this.orderTarget, Army.speed(selArmy));
      if (!r.error) {
        const pos = Army.position(selArmy);
        ctx.setLineDash([4 / z, 6 / z]);
        ctx.strokeStyle = r.attack ? 'rgba(255,110,90,0.9)' : 'rgba(150,240,170,0.9)';
        ctx.lineWidth = 2.4 / z;
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
        if (selArmy.move) ctx.lineTo(W.territories[selArmy.move.to].cx, W.territories[selArmy.move.to].cy);
        for (const t of r.path) ctx.lineTo(W.territories[t].cx, W.territories[t].cy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  },

  drawKingdomLabels(ctx, z) {
    const a = clamp((0.62 - z) / 0.22, 0, 1);
    if (a <= 0.01) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const L of this.kingdomLabels) {
      const k = Game.state.kingdoms[L.kid];
      const p = this.worldToScreen(L.x, L.y);
      const size = clamp(L.size * z, 11, 40);
      ctx.font = `700 ${size}px Cinzel, Georgia, serif`;
      const text = k.short.toUpperCase();
      const sp = size * 0.28;
      const widths = [...text].map((ch) => ctx.measureText(ch).width);
      const total = widths.reduce((x, y) => x + y, 0) + sp * (text.length - 1);
      let x = p.x - total / 2;
      ctx.globalAlpha = a * 0.92;
      ctx.lineWidth = Math.max(2, size * 0.16);
      ctx.strokeStyle = 'rgba(12,10,8,0.7)';
      ctx.fillStyle = shade(k.color, 0.35);
      for (let i = 0; i < text.length; i++) {
        const cx = x + widths[i] / 2;
        ctx.strokeText(text[i], cx, p.y);
        ctx.fillText(text[i], cx, p.y);
        x += widths[i] + sp;
      }
    }
    ctx.restore();
  },

  drawCities(ctx, z, v0, v1) {
    const s = Game.state, W = this.world;
    const showNames = z > 0.5;
    const showBadges = z > 0.95;
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of W.territories) {
      if (t.cx < v0.x - 80 || t.cx > v1.x + 80 || t.cy < v0.y - 80 || t.cy > v1.y + 80) continue;
      const ts = s.terr[t.id];
      if (!s.explored[t.id]) continue;
      const isCap = ts.owner >= 0 && s.kingdoms[ts.owner].capital === t.id;
      if (!isCap && ts.tier === 0 && z < 0.34) continue;
      const kind = isCap ? 'cap' : ['v', 't', 'c', 'm', 'm'][ts.tier];
      const spr = this.citySprite(kind, Game.ownerColor(ts.owner));
      const base = isCap ? 1.15 + ts.tier * 0.08 : [0.62, 0.8, 0.95, 1.08, 1.15][ts.tier];
      const size = clamp(46 * z, 20, 62) * base;
      const p = this.worldToScreen(t.cx, t.cy);
      ctx.drawImage(spr, p.x - size / 2, p.y - size / 2 - size * 0.12, size, size);
      if (showNames || isCap) {
        const fs = clamp(11 + z * 2.5, 10, 15) * (isCap ? 1.08 : 1);
        ctx.font = `${isCap ? 700 : 600} ${fs}px Inter, system-ui, sans-serif`;
        ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(10,10,14,0.85)';
        ctx.fillStyle = ts.owner === 0 ? '#fff4d0' : '#f1ece0';
        const ty = p.y + size * 0.44 + fs * 0.6;
        ctx.strokeText(t.name, p.x, ty);
        ctx.fillText(t.name, p.x, ty);
      }
      if (showBadges) {
        const g = Battle.total(ts.gar);
        const bx = p.x + size * 0.42, by = p.y - size * 0.36;
        ctx.font = '700 10px Inter, system-ui, sans-serif';
        const label = fmt(g);
        const bw = ctx.measureText(label).width + 16;
        ctx.fillStyle = 'rgba(14,16,22,0.82)';
        this.roundRect(ctx, bx - 4, by - 8, bw, 15, 7); ctx.fill();
        ctx.strokeStyle = rgba(Game.ownerColor(ts.owner), 0.9); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#e8e2d2'; ctx.textAlign = 'left';
        ctx.fillText('🛡' + label, bx, by + 3.5);
        ctx.textAlign = 'center';
        if (ts.fort > 0) {
          ctx.fillStyle = 'rgba(14,16,22,0.82)';
          this.roundRect(ctx, bx - 4, by + 9, 30, 14, 7); ctx.fill();
          ctx.fillStyle = '#d6c9a8'; ctx.textAlign = 'left';
          ctx.fillText('🧱' + ts.fort, bx, by + 19.5);
          ctx.textAlign = 'center';
        }
      }
      if (ts.owner === 0 && (ts.proj || ts.queue.length) && z > 0.45) {
        const bx = p.x - size * 0.5, by = p.y - size * 0.4;
        ctx.font = `${clamp(12 * z, 10, 15)}px sans-serif`;
        ctx.fillText(ts.proj ? '🔨' : '🪖', bx, by);
      }
    }
    ctx.restore();
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  drawArmies(ctx, z) {
    const s = Game.state;
    this.armyHits = [];
    const groups = new Map();
    for (const a of s.armies) {
      const visible = a.owner === 0 || (a.move ? s.explored[a.move.to] || s.explored[a.move.from] : s.explored[a.loc]);
      if (!visible) continue;
      // keep the zoomed-out world view readable: only marching foreign armies
      if (z < 0.42 && a.owner !== 0 && !a.move && !(this.sel && this.sel.type === 'army' && this.sel.id === a.id)) continue;
      const key = a.move ? 'm' + a.id : 'l' + a.loc;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    }
    const selId = this.sel && this.sel.type === 'army' ? this.sel.id : -1;
    ctx.save();
    ctx.textBaseline = 'middle';
    for (const [key, list] of groups) {
      list.sort((a, b) => a.owner - b.owner || a.id - b.id);
      list.forEach((a, i) => {
        const pos = Army.position(a);
        const p = this.worldToScreen(pos.x, pos.y);
        const n = list.length;
        let x = p.x, y = p.y;
        if (!pos.moving) {
          const citySize = clamp(46 * z, 20, 62);
          x += (i - (n - 1) / 2) * 52;
          y += citySize * 0.44 + (z > 0.5 ? 28 : 12);
        } else y -= 6;
        const total = Battle.total(a.units);
        const label = fmt(total);
        ctx.font = '700 11px Inter, system-ui, sans-serif';
        const w = Math.max(40, ctx.measureText(label).width + 28), h = 20;
        const bx = x - w / 2, by = y - h / 2;
        const col = Game.ownerColor(a.owner);
        const isSel = a.id === selId;
        if (isSel) {
          ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 14;
        }
        // banner body
        ctx.fillStyle = 'rgba(12,12,16,0.88)';
        this.roundRect(ctx, bx, by, w, h, 5); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = col;
        this.roundRect(ctx, bx + 2, by + 2, 18, h - 4, 3); ctx.fill();
        ctx.strokeStyle = isSel ? '#ffd76a' : a.owner === 0 ? '#fff6dc' : shade(col, 0.2);
        ctx.lineWidth = isSel ? 2 : 1.2;
        this.roundRect(ctx, bx, by, w, h, 5); ctx.stroke();
        // crossed swords glyph
        ctx.strokeStyle = 'rgba(15,12,10,0.85)'; ctx.lineWidth = 1.6;
        const gx = bx + 11, gy = y;
        ctx.beginPath(); ctx.moveTo(gx - 5, gy - 5); ctx.lineTo(gx + 5, gy + 5); ctx.moveTo(gx + 5, gy - 5); ctx.lineTo(gx - 5, gy + 5); ctx.stroke();
        ctx.fillStyle = '#f4efe2';
        ctx.textAlign = 'left';
        ctx.fillText(label, bx + 24, y + 0.5);
        if (a.general) { ctx.font = '10px sans-serif'; ctx.fillText('★', bx + w - 11, by + 6); }
        if (pos.moving && a.move) {
          // progress bar
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx + 3, by + h - 3, w - 6, 2);
          ctx.fillStyle = col; ctx.fillRect(bx + 3, by + h - 3, (w - 6) * clamp(a.move.t, 0, 1), 2);
        }
        this.armyHits.push({ id: a.id, x: bx, y: by, w, h });
      });
    }
    ctx.restore();
  },

  drawFx(ctx, dt, z) {
    // rings
    for (const r of this.rings) {
      r.t += dt;
      const k = r.t / r.dur;
      const p = this.worldToScreen(r.x, r.y);
      ctx.strokeStyle = rgba(r.color, 0.9 * (1 - k));
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10 + k * 90 * clamp(z, 0.4, 1.6), 0, TAU); ctx.stroke();
    }
    this.rings = this.rings.filter((r) => r.t < r.dur);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
    // battles: pulsing crossed swords
    for (const b of this.battlesFx) {
      b.t += dt;
      const p = this.worldToScreen(b.x, b.y);
      const a = b.t < 0.3 ? b.t / 0.3 : 1 - Math.max(0, (b.t - b.dur + 0.6) / 0.6);
      const sc = 1 + Math.sin(b.t * 14) * 0.08;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(p.x, p.y - 30);
      ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(160,20,10,0.8)';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
      ctx.restore();
      if (Math.random() < dt * 14) {
        this.particles.push({ x: b.x + (Math.random() - 0.5) * 30, y: b.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, life: 0, max: 0.5 + Math.random() * 0.5, kind: 'spark', size: 1.5 + Math.random() * 2, color: '#ffc34a' });
      }
    }
    this.battlesFx = this.battlesFx.filter((b) => b.t < b.dur);
    // particles
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
    for (const pt of this.particles) {
      pt.life += dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.kind === 'confetti') { pt.vy += 90 * dt; pt.vx *= 0.98; pt.rot += dt * 6; }
      else if (pt.kind === 'spark') { pt.vy += 40 * dt; }
      const k = pt.life / pt.max;
      const p = this.worldToScreen(pt.x, pt.y);
      if (pt.kind === 'smoke') {
        ctx.fillStyle = `rgba(60,55,50,${0.35 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, pt.size * (1 + k * 1.5) * clamp(z, 0.5, 1.5), 0, TAU); ctx.fill();
      } else if (pt.kind === 'confetti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(pt.rot);
        ctx.globalAlpha = 1 - k; ctx.fillStyle = pt.color; ctx.fillRect(-pt.size / 2, -pt.size / 4, pt.size, pt.size / 2);
        ctx.restore();
      } else {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, pt.size, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    // floating texts
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      f.t += dt;
      const p = this.worldToScreen(f.x, f.y);
      const k = f.t / f.dur;
      ctx.globalAlpha = 1 - k;
      ctx.font = '800 16px Inter, system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, p.x, p.y - 40 - k * 40);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, p.x, p.y - 40 - k * 40);
      ctx.globalAlpha = 1;
    }
    this.floats = this.floats.filter((f) => f.t < f.dur);
  },

  /* ---------------- minimap ---------------- */
  drawMinimap(mc) {
    if (!this.world || !Game.state) return;
    const W = this.world;
    const x = mc.getContext('2d');
    const w = mc.width, h = mc.height;
    const sx = w / W.W, sy = h / W.H;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#1d4868'; x.fillRect(0, 0, w, h);
    x.setTransform(sx, 0, 0, sy, 0, 0);
    const ws0 = this.TILE / this.LEVELS[0];
    for (const k of this.tileKeysForLevel(0)) {
      const t = this.tiles.get('0:' + k.tx + ':' + k.ty);
      if (t) x.drawImage(t.cv, k.tx * ws0, k.ty * ws0, ws0 + 2, ws0 + 2);
    }
    x.drawImage(this.overlay, 0, 0, W.W, W.H);
    // armies
    for (const a of Game.state.armies) {
      if (a.owner !== 0 && !Game.state.explored[a.loc]) continue;
      const p = Army.position(a);
      x.fillStyle = a.owner === 0 ? '#fff' : Game.ownerColor(a.owner);
      x.fillRect(p.x - 22, p.y - 22, 44, 44);
    }
    // viewport
    const v0 = this.screenToWorld(0, 0), v1 = this.screenToWorld(this.w, this.h);
    x.strokeStyle = '#ffd76a'; x.lineWidth = 2 / sx;
    x.strokeRect(v0.x, v0.y, v1.x - v0.x, v1.y - v0.y);
  },
};
