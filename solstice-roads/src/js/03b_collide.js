/* =====================================================================
   Static collision world: circles (trees, posts) and oriented boxes
   (buildings, walls, rails) in a uniform spatial hash.
   ===================================================================== */
const Col = {
  cell: 16,
  map: new Map(),
  key(i, j) { return (i + 512) * 2048 + (j + 512); },
  insert(c, minX, minZ, maxX, maxZ) {
    const s = this.cell;
    for (let i = Math.floor(minX / s); i <= Math.floor(maxX / s); i++)
      for (let j = Math.floor(minZ / s); j <= Math.floor(maxZ / s); j++) {
        const k = this.key(i, j);
        let a = this.map.get(k);
        if (!a) { a = []; this.map.set(k, a); }
        a.push(c);
      }
  },
  circle(x, z, r, kind = 'tree') {
    const c = { t: 0, x, z, r, kind, q: 0 };
    this.insert(c, x - r, z - r, x + r, z + r);
    return c;
  },
  // box centred at x,z with half extents hx (local x) and hz (local z), rotated by heading `a`
  box(x, z, hx, hz, a, kind = 'wall') {
    const c = { t: 1, x, z, hx, hz, c: Math.cos(a), s: Math.sin(a), kind, q: 0 };
    const R = Math.hypot(hx, hz);
    this.insert(c, x - R, z - R, x + R, z + R);
    return c;
  },
  // segment-shaped wall from (ax,az) to (bx,bz) with half thickness th
  wall(ax, az, bx, bz, th, kind = 'wall') {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
    if (l < 0.01) return null;
    return this.box((ax + bx) / 2, (az + bz) / 2, th, l / 2 + th * 0.5, Math.atan2(dx, dz), kind);
  },
  _q: 0,
  query(x, z, r, out) {
    out.length = 0;
    const s = this.cell, q = ++this._q;
    for (let i = Math.floor((x - r) / s); i <= Math.floor((x + r) / s); i++)
      for (let j = Math.floor((z - r) / s); j <= Math.floor((z + r) / s); j++) {
        const a = this.map.get(this.key(i, j));
        if (!a) continue;
        for (const c of a) if (c.q !== q) { c.q = q; out.push(c); }
      }
    return out;
  },
};

/* Oriented box (car) vs collider. Box: centre cx,cz, heading h, half width hw, half length hl.
   Returns penetration depth and normal (pointing from obstacle towards the car) or null. */
const _colRes = { n: [0, 0], d: 0, px: 0, pz: 0 };
function boxVsCollider(cx, cz, h, hw, hl, c) {
  const fs = Math.sin(h), fc = Math.cos(h); // forward = (fs, fc), left = (fc, -fs)
  if (c.t === 0) {
    const dx = c.x - cx, dz = c.z - cz;
    const lx = dx * fc - dz * fs, lz = dx * fs + dz * fc; // local: x=left, z=forward
    const qx = clamp(lx, -hw, hw), qz = clamp(lz, -hl, hl);
    let ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
    if (d > c.r) return null;
    let nx, nz, pen;
    if (d > 1e-4) { nx = -ex / d; nz = -ez / d; pen = c.r - d; }
    else { // centre inside box: push along the shallow axis
      const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
      if (px < pz) { nx = -Math.sign(lx); nz = 0; pen = px + c.r; } else { nx = 0; nz = -Math.sign(lz); pen = pz + c.r; }
    }
    // back to world (local x axis = left (fc,-fs), local z = forward (fs,fc))
    _colRes.n[0] = nx * fc + nz * fs; _colRes.n[1] = -nx * fs + nz * fc;
    _colRes.d = pen;
    _colRes.px = c.x - _colRes.n[0] * c.r; _colRes.pz = c.z - _colRes.n[1] * c.r;
    return _colRes;
  }
  // SAT between two oriented rectangles
  const ax = [[fc, -fs], [fs, fc], [c.c, -c.s], [c.s, c.c]];
  const ext = (axx, axz, ux, uz, wx, wz, a, b) => Math.abs(ux * axx + uz * axz) * a + Math.abs(wx * axx + wz * axz) * b;
  const dx = cx - c.x, dz = cz - c.z;
  let best = 1e9, bn0 = 0, bn1 = 0;
  for (const [axx, axz] of ax) {
    const ra = ext(axx, axz, fc, -fs, fs, fc, hw, hl);
    const rb = ext(axx, axz, c.c, -c.s, c.s, c.c, c.hx, c.hz);
    const dist = dx * axx + dz * axz;
    const o = ra + rb - Math.abs(dist);
    if (o <= 0) return null;
    if (o < best) { best = o; const sg = dist < 0 ? -1 : 1; bn0 = axx * sg; bn1 = axz * sg; }
  }
  _colRes.n[0] = bn0; _colRes.n[1] = bn1; _colRes.d = best;
  _colRes.px = cx - bn0 * hw; _colRes.pz = cz - bn1 * hw;
  return _colRes;
}
