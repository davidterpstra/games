/* =====================================================================
   EMPIRE CONQUEST — procedural world generator
   1. jittered grid of ~4k sites → Voronoi cells (half-plane clipping)
   2. continents + islands from noise, lakes, coast distance
   3. terrain per cell (mountain ridges, snowy north, southern deserts,
      forests), rivers flowing to the sea
   4. territories grown from Poisson seeds (mountains make borders),
      sea routes between landmasses
   5. noisy (organic) edges shared by neighbouring cells
   The world is fully determined by the seed, so saves only store the
   seed and the dynamic territory state.
   ===================================================================== */
'use strict';

const MapGen = (() => {
  const W = 4000, H = 2600, S = 50;
  const COLS = Math.round(W / S), ROWS = Math.round(H / S);

  /* Clip convex polygon (xs, ys, es: edge labels) to the half-plane of points
     closer to (px,py) than to (qx,qy). New edges on the bisector get label j. */
  function clip(xs, ys, es, px, py, qx, qy, j) {
    const nx = qx - px, ny = qy - py;
    const mx = (px + qx) * 0.5, my = (py + qy) * 0.5;
    const n = xs.length;
    const d = new Array(n);
    let anyOut = false;
    for (let k = 0; k < n; k++) {
      d[k] = (xs[k] - mx) * nx + (ys[k] - my) * ny;
      if (d[k] > 0) anyOut = true;
    }
    if (!anyOut) return null;
    const ox = [], oy = [], oe = [];
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const da = d[k], db = d[k2];
      const ain = da <= 0, bin = db <= 0;
      if (ain) { ox.push(xs[k]); oy.push(ys[k]); oe.push(es[k]); }
      if (ain !== bin) {
        const t = da / (da - db);
        const ix = xs[k] + (xs[k2] - xs[k]) * t, iy = ys[k] + (ys[k2] - ys[k]) * t;
        ox.push(ix); oy.push(iy); oe.push(ain ? j : es[k]);
      }
    }
    return [ox, oy, oe];
  }

  const vkey = (x, y) => Math.round(x * 20) * 100000 + Math.round(y * 20);

  function inTri(x, y, ax, ay, bx, by, cx, cy) {
    const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
    const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
    const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  }

  /* organic edge between Voronoi vertices A,B staying inside triangles (P,A,B) ∪ (Q,A,B) */
  function noisyEdge(ax, ay, bx, by, p, q, rng, amp) {
    const out = [ax, ay];
    const A0x = ax, A0y = ay, B0x = bx, B0y = by;
    const inside = (x, y) => {
      // shrink the triangles slightly toward the sites for safety
      return inTri(x, y, p[0], p[1], lerp(A0x, p[0], 0.08), lerp(A0y, p[1], 0.08), lerp(B0x, p[0], 0.08), lerp(B0y, p[1], 0.08))
        || inTri(x, y, q[0], q[1], lerp(A0x, q[0], 0.08), lerp(A0y, q[1], 0.08), lerp(B0x, q[0], 0.08), lerp(B0y, q[1], 0.08))
        || false;
    };
    const sub = (x1, y1, x2, y2, depth) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      if (len < 7 || depth > 4) { out.push(x2, y2); return; }
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const nx = -dy / len, ny = dx / len;
      let dd = rng.range(-1, 1) * len * amp;
      let cx = mx + nx * dd, cy = my + ny * dd;
      let tries = 0;
      while (!inside(cx, cy) && tries < 4) { dd *= 0.5; cx = mx + nx * dd; cy = my + ny * dd; tries++; }
      if (!inside(cx, cy)) { cx = mx; cy = my; }
      sub(x1, y1, cx, cy, depth + 1);
      sub(cx, cy, x2, y2, depth + 1);
    };
    sub(ax, ay, bx, by, 0);
    return out;
  }

  function makeName(rng, used, terrain) {
    for (let tries = 0; tries < 60; tries++) {
      let pre = rng.pick(NAME_PARTS.pre);
      let suf = rng.pick(NAME_PARTS.suf);
      if (terrain === 'snow' && rng.chance(0.55)) pre = rng.pick(NAME_PARTS.snowPre);
      if (terrain === 'desert' && rng.chance(0.55)) pre = rng.pick(NAME_PARTS.desertPre);
      if (NAME_PARTS[terrain] && rng.chance(0.45)) suf = rng.pick(NAME_PARTS[terrain]);
      let name = pre + suf;
      if (rng.chance(0.18) && terrain !== 'island') name = rng.pick(['Upper ', 'Lower ', 'New ', 'Old ', 'Fort ', 'Saint ']) + name;
      if (terrain === 'island' && rng.chance(0.3)) name = 'Isle of ' + pre + rng.pick(['mere', 'wind', 'haven', 'rock']);
      name = name.charAt(0).toUpperCase() + name.slice(1);
      if (!used.has(name)) { used.add(name); return name; }
    }
    const n = 'Land ' + used.size; used.add(n); return n;
  }

  function generate(seed) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const rng = new Rng(seed);
    const N = COLS * ROWS;
    const px = new Float64Array(N), py = new Float64Array(N);
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        const i = gy * COLS + gx;
        px[i] = (gx + 0.5) * S + rng.range(-0.4, 0.4) * S;
        py[i] = (gy + 0.5) * S + rng.range(-0.4, 0.4) * S;
      }
    }

    /* ---------- 1. Voronoi ---------- */
    const polyX = new Array(N), polyY = new Array(N), polyE = new Array(N);
    for (let i = 0; i < N; i++) {
      const gx = i % COLS, gy = (i / COLS) | 0;
      const x0 = Math.max(0, px[i] - 3 * S), x1 = Math.min(W, px[i] + 3 * S);
      const y0 = Math.max(0, py[i] - 3 * S), y1 = Math.min(H, py[i] + 3 * S);
      let xs = [x0, x1, x1, x0], ys = [y0, y0, y1, y1], es = [-1, -1, -1, -1];
      for (let dy = -3; dy <= 3; dy++) {
        const yy = gy + dy; if (yy < 0 || yy >= ROWS) continue;
        for (let dx = -3; dx <= 3; dx++) {
          const xx = gx + dx; if (xx < 0 || xx >= COLS) continue;
          const j = yy * COLS + xx; if (j === i) continue;
          const r = clip(xs, ys, es, px[i], py[i], px[j], py[j], j);
          if (r) { xs = r[0]; ys = r[1]; es = r[2]; }
        }
      }
      // drop duplicate vertices
      const fx = [], fy = [], fe = [];
      for (let k = 0; k < xs.length; k++) {
        const k2 = (k + 1) % xs.length;
        if (vkey(xs[k], ys[k]) === vkey(xs[k2], ys[k2])) continue;
        fx.push(xs[k]); fy.push(ys[k]); fe.push(es[k]);
      }
      polyX[i] = fx; polyY[i] = fy; polyE[i] = fe;
    }

    /* ---------- shared edges ---------- */
    const edges = [];
    const edgeMap = new Map();
    const cellEdges = new Array(N);
    for (let i = 0; i < N; i++) {
      const xs = polyX[i], ys = polyY[i];
      const list = [];
      for (let k = 0; k < xs.length; k++) {
        const k2 = (k + 1) % xs.length;
        const ka = vkey(xs[k], ys[k]), kb = vkey(xs[k2], ys[k2]);
        if (ka === kb) continue;
        const mk = ka < kb ? ka + '_' + kb : kb + '_' + ka;
        let e = edgeMap.get(mk);
        if (e === undefined) {
          e = edges.length;
          edges.push({ ka, kb, ax: xs[k], ay: ys[k], bx: xs[k2], by: ys[k2], c0: i, c1: -1, pts: null });
          edgeMap.set(mk, e);
        } else if (edges[e].c1 === -1 && edges[e].c0 !== i) {
          edges[e].c1 = i;
        }
        list.push({ e, fwd: edges[e].ka === ka });
      }
      cellEdges[i] = list;
    }
    const nbr = Array.from({ length: N }, () => []);
    for (const e of edges) {
      if (e.c1 >= 0) { nbr[e.c0].push(e.c1); nbr[e.c1].push(e.c0); }
    }

    /* ---------- 2. land & water ---------- */
    const nA = makeNoise(seed + 11), nB = makeNoise(seed + 23), nC = makeNoise(seed + 37), nD = makeNoise(seed + 51), nE = makeNoise(seed + 67);
    const blobs = [];
    const nCont = rng.int(3, 4);
    for (let tries = 0; blobs.length < nCont && tries < 400; tries++) {
      const bx = rng.range(0.16, 0.84) * W, by = rng.range(0.24, 0.76) * H;
      const r = rng.range(nCont === 3 ? 0.19 : 0.16, nCont === 3 ? 0.25 : 0.21) * W;
      if (blobs.every((b) => dist(b.x, b.y, bx, by) > (b.r + r) * 0.72)) blobs.push({ x: bx, y: by, r });
    }
    // a few satellite blobs make coastlines less round
    const nSat = rng.int(4, 7);
    for (let k = 0; k < nSat; k++) {
      const b = rng.pick(blobs);
      const a = rng.range(0, TAU);
      blobs.push({ x: b.x + Math.cos(a) * b.r * 0.85, y: b.y + Math.sin(a) * b.r * 0.8, r: b.r * rng.range(0.35, 0.55) });
    }
    const elev = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const x = px[i], y = py[i];
      let e = -0.4;
      for (const b of blobs) {
        const dx = (x - b.x) / b.r, dy = (y - b.y) / (b.r * 0.82);
        e = Math.max(e, 1 - Math.sqrt(dx * dx + dy * dy));
      }
      e += fbm(nA, x / 780, y / 780, 4) * 0.75 + fbm(nB, x / 240, y / 240, 3) * 0.2;
      const m = Math.min(x / W, 1 - x / W, (y / H) * 1.4, (1 - y / H) * 1.4);
      if (m < 0.075) e -= ((0.075 - m) / 0.075) * 1.4;
      elev[i] = e;
    }
    const sorted = Array.from(elev).sort((a, b) => a - b);
    const sea = sorted[Math.floor(N * 0.52)];
    const land = new Uint8Array(N);
    for (let i = 0; i < N; i++) land[i] = elev[i] > sea ? 1 : 0;

    // islands: small blobs in open ocean
    const nIsl = rng.int(7, 11);
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < nIsl; tries++) {
      const ix = rng.range(0.08, 0.92) * W, iy = rng.range(0.1, 0.9) * H;
      const gx = Math.floor(ix / S), gy = Math.floor(iy / S);
      // must be far from land
      let ok = true;
      for (let dy = -5; dy <= 5 && ok; dy++) for (let dx = -5; dx <= 5 && ok; dx++) {
        const xx = gx + dx, yy = gy + dy;
        if (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS) continue;
        if (land[yy * COLS + xx]) ok = false;
      }
      if (!ok) continue;
      const r = rng.range(75, 150);
      const stretch = rng.range(0.6, 1.5);
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const xx = gx + dx, yy = gy + dy;
        if (xx < 1 || yy < 1 || xx >= COLS - 1 || yy >= ROWS - 1) continue;
        const i = yy * COLS + xx;
        const ddx = (px[i] - ix) / (r * stretch), ddy = (py[i] - iy) / (r / stretch);
        const v = 1 - Math.sqrt(ddx * ddx + ddy * ddy) + nE(px[i] / 90, py[i] / 90) * 0.35;
        if (v > 0.1) { land[i] = 1; elev[i] = Math.max(elev[i], sea + v * 0.3); }
      }
      placed++;
    }

    // components helper
    const components = (pred) => {
      const comp = new Int32Array(N).fill(-1);
      const list = [];
      for (let i = 0; i < N; i++) {
        if (comp[i] >= 0 || !pred(i)) continue;
        const id = list.length, cells = [i];
        comp[i] = id;
        for (let h = 0; h < cells.length; h++) {
          for (const j of nbr[cells[h]]) if (comp[j] < 0 && pred(j)) { comp[j] = id; cells.push(j); }
        }
        list.push(cells);
      }
      return { comp, list };
    };
    const onBorder = (i) => { const gx = i % COLS, gy = (i / COLS) | 0; return gx === 0 || gy === 0 || gx === COLS - 1 || gy === ROWS - 1; };

    // fill tiny lakes, remove tiny islets
    {
      const wc = components((i) => !land[i]);
      for (const cells of wc.list) {
        if (!cells.some(onBorder) && cells.length < 4) for (const i of cells) land[i] = 1;
      }
      const lc = components((i) => land[i] === 1);
      for (const cells of lc.list) if (cells.length < 6) for (const i of cells) land[i] = 0;
    }
    const ocean = new Uint8Array(N);
    const lake = new Uint8Array(N);
    {
      const wc = components((i) => !land[i]);
      for (const cells of wc.list) {
        const isOcean = cells.some(onBorder);
        for (const i of cells) { if (isOcean) ocean[i] = 1; else lake[i] = 1; }
      }
    }
    const landComp = components((i) => land[i] === 1);

    // distance to coast (land) and to land (water)
    const coastDist = new Int32Array(N).fill(-1);
    {
      const q = [];
      for (let i = 0; i < N; i++) {
        if (nbr[i].some((j) => land[j] !== land[i])) { coastDist[i] = land[i] ? 1 : 1; q.push(i); }
      }
      for (let h = 0; h < q.length; h++) {
        const i = q[h];
        for (const j of nbr[i]) {
          if (coastDist[j] < 0 && land[j] === land[i]) { coastDist[j] = coastDist[i] + 1; q.push(j); }
        }
      }
      for (let i = 0; i < N; i++) if (coastDist[i] < 0) coastDist[i] = 9;
    }

    /* ---------- 3. terrain ---------- */
    const TER = new Array(N).fill('water');
    const landIdx = [];
    for (let i = 0; i < N; i++) if (land[i]) landIdx.push(i);
    const mscore = new Float64Array(N);
    for (const i of landIdx) {
      const x = px[i], y = py[i];
      const ridge = 1 - Math.abs(fbm(nC, x / 560, y / 560, 3)) * 2.6;
      mscore[i] = ridge * 0.85 + (elev[i] - sea) * 0.45 + nD(x / 150, y / 150) * 0.12;
    }
    const inland = landIdx.filter((i) => coastDist[i] >= 2);
    const ms = inland.map((i) => mscore[i]).sort((a, b) => b - a);
    const mThresh = ms[Math.floor(ms.length * 0.15)] ?? 9;
    const temp = new Float64Array(N), moist = new Float64Array(N);
    for (const i of landIdx) {
      const x = px[i], y = py[i];
      temp[i] = y / H + fbm(nD, x / 900 + 7, y / 900, 3) * 0.32;
      moist[i] = 0.5 + fbm(nE, x / 620 + 31, y / 620 - 11, 4) * 0.9 + (coastDist[i] <= 1 ? 0.06 : 0);
      let t;
      if (coastDist[i] >= 2 && mscore[i] >= mThresh) t = 'mountains';
      else if (temp[i] < 0.2) t = 'snow';
      else if (temp[i] > 0.73 && moist[i] < 0.6) t = 'desert';
      else if (moist[i] > 0.54) t = 'forest';
      else t = 'plains';
      TER[i] = t;
    }

    /* ---------- rivers ---------- */
    const riverCell = new Uint8Array(N);
    const rivers = [];
    {
      const cands = landIdx.filter((i) => coastDist[i] >= 4).sort((a, b) => (mscore[b] + coastDist[b] * 0.05) - (mscore[a] + coastDist[a] * 0.05));
      const srcs = [];
      for (const i of cands) {
        if (srcs.length >= 16) break;
        if (TER[i] === 'desert' && rng.chance(0.7)) continue;
        if (srcs.every((s) => dist(px[s], py[s], px[i], py[i]) > 360)) srcs.push(i);
      }
      for (const s of srcs) {
        const path = [s];
        let cur = s;
        for (let step = 0; step < 80; step++) {
          let best = -1, bestV = Infinity;
          for (const j of nbr[cur]) {
            const v = (land[j] ? coastDist[j] : 0) + elev[j] * 0.3 + rng.next() * 0.2;
            if ((!land[j] || coastDist[j] < coastDist[cur] || (coastDist[j] === coastDist[cur] && elev[j] < elev[cur])) && v < bestV && !path.includes(j)) {
              bestV = v; best = j;
            }
          }
          if (best < 0) break;
          path.push(best);
          if (!land[best] || riverCell[best]) break;
          cur = best;
        }
        const last = path[path.length - 1];
        if (path.length >= 5 && (!land[last] || riverCell[last])) {
          for (const c of path) if (land[c]) riverCell[c] = 1;
          rivers.push(path);
        }
      }
    }

    /* ---------- 4. territories ---------- */
    const terrOf = new Int32Array(N).fill(-1);
    const seeds = [];
    {
      const R = 172;
      const order = rng.shuffle(landIdx.slice());
      const bucket = new Map();
      const bk = (x, y) => Math.floor(x / R) * 1000 + Math.floor(y / R);
      for (const i of order) {
        const bx = Math.floor(px[i] / R), by = Math.floor(py[i] / R);
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) {
          const arr = bucket.get((bx + dx) * 1000 + (by + dy));
          if (arr) for (const s of arr) if (dist(px[s], py[s], px[i], py[i]) < R) { ok = false; break; }
        }
        if (!ok) continue;
        seeds.push(i);
        const k = bk(px[i], py[i]);
        if (!bucket.has(k)) bucket.set(k, []);
        bucket.get(k).push(i);
      }
    }
    // every landmass needs at least one seed
    {
      const hasSeed = new Set(seeds.map((s) => landComp.comp[s]));
      for (let l = 0; l < landComp.list.length; l++) {
        if (hasSeed.has(l)) continue;
        const cells = landComp.list[l];
        let best = cells[0];
        for (const c of cells) if (coastDist[c] > coastDist[best]) best = c;
        seeds.push(best);
      }
    }
    {
      // multi-source Dijkstra: mountains are expensive, so ranges become borders
      const heap = new MinHeap();
      const cost = new Float64Array(N).fill(Infinity);
      const done = new Uint8Array(N);
      for (let t = 0; t < seeds.length; t++) { cost[seeds[t]] = 0; terrOf[seeds[t]] = t; heap.push(0, seeds[t]); }
      while (heap.size) {
        const i = heap.pop();
        if (done[i]) continue;
        done[i] = 1;
        for (const j of nbr[i]) {
          if (!land[j] || done[j]) continue;
          const tc = TER[j] === 'mountains' ? 2.2 : (riverCell[j] && riverCell[i] ? 0.8 : 1);
          const c = cost[i] + dist(px[i], py[i], px[j], py[j]) * tc * (1 + 0.35 * (nA(px[j] / 120, py[j] / 120) + 0.5));
          if (c < cost[j]) { cost[j] = c; terrOf[j] = terrOf[i]; heap.push(c, j); }
        }
      }
    }
    const seedList = seeds;
    // collect & merge tiny territories
    let tcells = Array.from({ length: seedList.length }, () => []);
    for (let i = 0; i < N; i++) if (terrOf[i] >= 0) tcells[terrOf[i]].push(i);
    for (let pass = 0; pass < 3; pass++) {
      for (let t = 0; t < tcells.length; t++) {
        const cells = tcells[t];
        if (!cells.length || cells.length >= 7) continue;
        const counts = new Map();
        for (const c of cells) for (const j of nbr[c]) {
          const u = terrOf[j];
          if (u >= 0 && u !== t) counts.set(u, (counts.get(u) || 0) + 1);
        }
        if (!counts.size) continue;
        let best = -1, bestSize = Infinity;
        for (const [u] of counts) if (tcells[u].length < bestSize) { bestSize = tcells[u].length; best = u; }
        for (const c of cells) { terrOf[c] = best; tcells[best].push(c); }
        tcells[t] = [];
      }
    }
    // reindex
    const remap = new Int32Array(tcells.length).fill(-1);
    const terrCells = [];
    for (let t = 0; t < tcells.length; t++) if (tcells[t].length) { remap[t] = terrCells.length; terrCells.push(tcells[t]); }
    for (let i = 0; i < N; i++) if (terrOf[i] >= 0) terrOf[i] = remap[terrOf[i]];

    const T = terrCells.length;
    const territories = [];
    const usedNames = new Set(KINGDOM_DEFS.map((k) => k.capital));
    for (let t = 0; t < T; t++) {
      const cells = terrCells[t];
      // interior distance → pole of inaccessibility
      const inT = new Set(cells);
      const dIn = new Map();
      const q = [];
      for (const c of cells) if (nbr[c].some((j) => !inT.has(j)) || nbr[c].length < 4) { dIn.set(c, 0); q.push(c); }
      for (let h = 0; h < q.length; h++) {
        const c = q[h];
        for (const j of nbr[c]) if (inT.has(j) && !dIn.has(j)) { dIn.set(j, dIn.get(c) + 1); q.push(j); }
      }
      let mx = 0, my = 0;
      for (const c of cells) { mx += px[c]; my += py[c]; }
      mx /= cells.length; my /= cells.length;
      let pole = cells[0], bestScore = -Infinity;
      for (const c of cells) {
        const sc = (dIn.get(c) || 0) * 100 - dist(px[c], py[c], mx, my) * 0.5;
        if (sc > bestScore) { bestScore = sc; pole = c; }
      }
      const counts = {};
      let river = false, coastal = false;
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (const c of cells) {
        const w = TER[c] === 'mountains' ? 1.9 : 1;
        counts[TER[c]] = (counts[TER[c]] || 0) + w;
        if (riverCell[c]) river = true;
        if (nbr[c].some((j) => ocean[j])) coastal = true;
        for (let k = 0; k < polyX[c].length; k++) {
          minx = Math.min(minx, polyX[c][k]); maxx = Math.max(maxx, polyX[c][k]);
          miny = Math.min(miny, polyY[c][k]); maxy = Math.max(maxy, polyY[c][k]);
        }
      }
      let terrain = 'plains', bc = -1;
      for (const k in counts) if (counts[k] > bc) { bc = counts[k]; terrain = k; }
      const lm = landComp.comp[pole];
      const lmSize = landComp.list[lm].length;
      if (lmSize <= 70) terrain = 'island';
      territories.push({
        id: t, cells, cx: px[pole], cy: py[pole], pole, area: cells.length, terrain, river, coastal,
        landmass: lm, bbox: [minx, miny, maxx, maxy], nb: [], sea: [], adj: [],
        name: makeName(rng, usedNames, terrain),
      });
    }
    // land adjacency
    for (const e of edges) {
      if (e.c1 < 0) continue;
      const a = terrOf[e.c0], b = terrOf[e.c1];
      if (a >= 0 && b >= 0 && a !== b) {
        if (!territories[a].nb.includes(b)) territories[a].nb.push(b);
        if (!territories[b].nb.includes(a)) territories[b].nb.push(a);
      }
    }
    // sea lanes
    const lanes = [];
    {
      const coastCells = Array.from({ length: T }, () => []);
      for (let i = 0; i < N; i++) {
        if (terrOf[i] >= 0 && nbr[i].some((j) => ocean[j])) coastCells[terrOf[i]].push(i);
      }
      const cand = [];
      for (let a = 0; a < T; a++) {
        if (!coastCells[a].length) continue;
        for (let b = a + 1; b < T; b++) {
          if (!coastCells[b].length) continue;
          if (territories[a].landmass === territories[b].landmass) continue;
          const ta = territories[a], tb = territories[b];
          if (dist(ta.cx, ta.cy, tb.cx, tb.cy) > 1400) continue;
          let best = Infinity, ba = -1, bb = -1;
          for (const ca of coastCells[a]) for (const cb of coastCells[b]) {
            const d = dist(px[ca], py[ca], px[cb], py[cb]);
            if (d < best) { best = d; ba = ca; bb = cb; }
          }
          cand.push({ a, b, d: best, ax: px[ba], ay: py[ba], bx: px[bb], by: py[bb] });
        }
      }
      cand.sort((x, y) => x.d - y.d);
      // MST over landmasses guarantees connectivity
      const lmParent = new Map();
      const find = (x) => { while (lmParent.has(x) && lmParent.get(x) !== x) x = lmParent.get(x); return x; };
      for (const t of territories) if (!lmParent.has(t.landmass)) lmParent.set(t.landmass, t.landmass);
      const keep = new Set();
      for (const c of cand) {
        const ra = find(territories[c.a].landmass), rb = find(territories[c.b].landmass);
        if (ra !== rb) { lmParent.set(ra, rb); keep.add(c); }
      }
      const perT = new Int32Array(T);
      for (const c of cand) {
        if (keep.has(c)) continue;
        if (c.d < 330 && perT[c.a] < 2 && perT[c.b] < 2) keep.add(c);
      }
      for (const c of keep) {
        perT[c.a]++; perT[c.b]++;
        lanes.push(c);
        territories[c.a].sea.push(c.b);
        territories[c.b].sea.push(c.a);
      }
    }
    for (const t of territories) {
      for (const n of t.nb) t.adj.push({ t: n, sea: false, d: dist(t.cx, t.cy, territories[n].cx, territories[n].cy) });
      for (const n of t.sea) t.adj.push({ t: n, sea: true, d: dist(t.cx, t.cy, territories[n].cx, territories[n].cy) });
    }

    /* ---------- 5. noisy edges & cell outlines ---------- */
    for (const e of edges) {
      if (e.c1 < 0) { e.pts = new Float32Array([e.ax, e.ay, e.bx, e.by]); continue; }
      const er = new Rng(hashInts(seed, e.ka % 2147483647, e.kb % 2147483647));
      const sameTerr = terrOf[e.c0] === terrOf[e.c1] && TER[e.c0] === TER[e.c1];
      const amp = sameTerr ? 0.22 : 0.3;
      e.pts = new Float32Array(noisyEdge(e.ax, e.ay, e.bx, e.by, [px[e.c0], py[e.c0]], [px[e.c1], py[e.c1]], er, amp));
    }
    const cells = new Array(N);
    for (let i = 0; i < N; i++) {
      const out = [];
      for (const ref of cellEdges[i]) {
        const p = edges[ref.e].pts;
        const n = p.length / 2;
        if (ref.fwd) { for (let k = out.length ? 1 : 0; k < n; k++) out.push(p[k * 2], p[k * 2 + 1]); }
        else { for (let k = out.length ? n - 2 : n - 1; k >= 0; k--) out.push(p[k * 2], p[k * 2 + 1]); }
      }
      cells[i] = {
        id: i, x: px[i], y: py[i], poly: new Float32Array(out), nb: nbr[i],
        land: !!land[i], ocean: !!ocean[i], lake: !!lake[i], terrain: TER[i], territory: terrOf[i],
        coast: coastDist[i], elev: elev[i] - sea, river: !!riverCell[i],
        temp: temp[i], moist: moist[i],
      };
    }

    // territory outlines (closed loops) — used for fills, selection and hit glow
    for (const t of territories) {
      const inT = new Set(t.cells);
      const segs = [];
      for (const c of t.cells) {
        for (const ref of cellEdges[c]) {
          const e = edges[ref.e];
          const other = e.c0 === c ? e.c1 : e.c0;
          if (other >= 0 && inT.has(other)) continue;
          segs.push({ s: ref.fwd ? e.ka : e.kb, t: ref.fwd ? e.kb : e.ka, pts: e.pts, fwd: ref.fwd, used: false });
        }
      }
      const byStart = new Map();
      for (const s of segs) { if (!byStart.has(s.s)) byStart.set(s.s, []); byStart.get(s.s).push(s); }
      const loops = [];
      for (const s0 of segs) {
        if (s0.used) continue;
        const loop = [];
        let s = s0;
        for (let guard = 0; s && !s.used && guard < 5000; guard++) {
          s.used = true;
          const p = s.pts, n = p.length / 2;
          if (s.fwd) { for (let k = loop.length ? 1 : 0; k < n; k++) loop.push(p[k * 2], p[k * 2 + 1]); }
          else { for (let k = loop.length ? n - 2 : n - 1; k >= 0; k--) loop.push(p[k * 2], p[k * 2 + 1]); }
          const next = (byStart.get(s.t) || []).find((x) => !x.used);
          s = next;
        }
        loops.push(new Float32Array(loop));
      }
      t.loops = loops;
    }

    // borders between territories and coastlines
    const borderEdges = [], coastEdges = [];
    for (let k = 0; k < edges.length; k++) {
      const e = edges[k];
      if (e.c1 < 0) continue;
      const a = terrOf[e.c0], b = terrOf[e.c1];
      if (land[e.c0] && land[e.c1]) { if (a !== b && a >= 0 && b >= 0) borderEdges.push({ a, b, e: k }); }
      else if (land[e.c0] !== land[e.c1]) coastEdges.push({ t: land[e.c0] ? a : b, e: k, lake: lake[e.c0] || lake[e.c1] });
    }

    const world = {
      seed, W, H, S, COLS, ROWS, cells, edges, territories, lanes, rivers, borderEdges, coastEdges,
      genMs: 0,
    };
    world.cellAt = (x, y) => {
      const gx = Math.floor(x / S), gy = Math.floor(y / S);
      let best = -1, bd = Infinity;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = gx + dx, yy = gy + dy;
        if (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS) continue;
        const i = yy * COLS + xx;
        const d = (px[i] - x) ** 2 + (py[i] - y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    world.territoryAt = (x, y) => {
      if (x < 0 || y < 0 || x > W || y > H) return -1;
      const c = world.cellAt(x, y);
      return c >= 0 ? cells[c].territory : -1;
    };
    world.genMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return world;
  }

  return { generate, W, H, S };
})();
