/* =====================================================================
   BUILDING MODELS — every building is composed from low-poly parts
   with one shared palette, so the whole village reads as one style.
   Local space: footprint centred on (0,0), front (door) faces +z.
   ===================================================================== */
const P = {
  wall: 0xf3e3c3, wall2: 0xefe6d8, plaster: 0xf5ead2, warm: 0xf1d3a8, sage: 0xdbe4cd, rose: 0xf0cfc4, sky: 0xd4e2ee,
  beam: 0x6e4a2b, wood: 0x9c6b3f, woodL: 0xb58150, woodD: 0x7a5230, log: 0x8b5a2b, logL: 0x9d6a39,
  roofR: 0xc8553d, roofR2: 0xa94436, roofB: 0x4f6d8a, roofT: 0x3f7f7a, roofG: 0x5f8f4e, thatch: 0xd9b45a, slate: 0x56606c, roofBr: 0x8a5a3c,
  stone: 0xb0ada3, stoneD: 0x8f8c84, stoneL: 0xc9c5b8, cobble: 0xb8b2a3,
  door: 0x6b3f22, frame: 0x5a3a22, shutter: 0x4f7d5a, shutterB: 0x4f6d8a, shutterR: 0xa8432f,
  fR: 0xe8505b, fY: 0xffd166, fP: 0xf28bb0, fW: 0xf7f3ea, fB: 0x8aa6ff,
  gold: 0xf2c230, metal: 0x6f7780, metalD: 0x464c55, red: 0xc0392b, white: 0xf7f3ea, leaf: 0x6fae47, leafD: 0x4f9036, soil: 0x8a6240, hay: 0xe2c35a, water: 0x5fb8d6,
};

/* --- reusable parts --- */
function pWindow(g, x, y, z, ry = 0, o = {}) {
  const w = o.w || 0.7, hh = o.h || 0.75;
  g.push(x, y, z, ry);
  g.box(w + 0.2, hh + 0.2, 0.08, o.frame || P.frame, 0, 0, 0.0);
  g.win(w, hh, 0.1, 0, 0, 0.03);
  g.box(0.06, hh, 0.12, o.frame || P.frame, 0, 0, 0.04).box(w, 0.06, 0.12, o.frame || P.frame, 0, 0, 0.04);
  if (o.shutters !== false) { g.box(0.32, hh + 0.1, 0.06, o.shutter || P.shutter, -(w / 2 + 0.3), 0, 0.03).box(0.32, hh + 0.1, 0.06, o.shutter || P.shutter, w / 2 + 0.3, 0, 0.03); }
  if (o.flowers) { g.box(w + 0.2, 0.2, 0.3, P.woodD, 0, -hh / 2 - 0.18, 0.15); for (let i = 0; i < 3; i++) g.ico(0.13, [P.fR, P.fY, P.fP][i], -w / 3 + (i * w) / 3, -hh / 2 - 0.02, 0.18, 1, 0.8, 1, 0, 0.2); }
  g.pop();
}
function pDoor(g, x, y, z, ry = 0, o = {}) {
  const w = o.w || 0.95, hh = o.h || 1.7;
  g.push(x, y, z, ry);
  g.boxB(w + 0.25, hh + 0.14, 0.08, o.frame || P.frame, 0, 0, 0);
  g.boxB(w, hh, 0.12, o.col || P.door, 0, 0, 0.03);
  g.box(0.08, 0.08, 0.08, P.gold, w * 0.32, hh * 0.5, 0.12);
  g.boxB(w + 0.6, 0.14, 0.6, P.stoneL, 0, -0.14, 0.35);
  g.pop();
}
function pChimney(g, x, y, z, hh) { g.boxB(0.62, hh, 0.62, P.stoneD, x, y, z).boxB(0.74, 0.16, 0.74, P.stone, x, y + hh, z); g.smoke(x, y + hh + 0.25, z); }
function pLamp(g, x, y, z) { g.box(0.3, 0.42, 0.3, P.metalD, x, y, z); g.glowBox(0.22, 0.3, 0.22, 0xffd27a, x, y, z); g.light(x, y, z); }
function pBarrel(g, x, y, z) { g.cyl(0.36, 0.36, 0.85, 8, P.woodL, x, y, z).cyl(0.38, 0.38, 0.08, 8, P.metalD, x, y + 0.15, z).cyl(0.38, 0.38, 0.08, 8, P.metalD, x, y + 0.65, z); }
function pCrate(g, x, y, z, s = 0.7, ry = 0) { g.boxB(s, s, s, P.woodL, x, y, z, ry).boxB(s + 0.04, 0.08, s + 0.04, P.woodD, x, y + s * 0.5, z, ry); }
function pFence(g, x0, z0, x1, z1, col = P.woodL) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.5)), ry = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i++) g.boxB(0.14, 0.9, 0.14, col, lerp(x0, x1, i / n), 0, lerp(z0, z1, i / n));
  g.box(0.07, 0.09, len, col, (x0 + x1) / 2, 0.4, (z0 + z1) / 2, ry).box(0.07, 0.09, len, col, (x0 + x1) / 2, 0.72, (z0 + z1) / 2, ry);
}
function pFoundation(g, w, d, col = P.stone, top = 0.4) { g.box(w, 2.8, d, col, 0, top - 1.4, 0); }
function pCrops(g, x0, z0, x1, z1, col, rows = 4) {
  g.boxB(x1 - x0, 0.14, z1 - z0, P.soil, (x0 + x1) / 2, -0.05, (z0 + z1) / 2);
  for (let r = 0; r < rows; r++) {
    const z = lerp(z0 + 0.5, z1 - 0.5, r / Math.max(1, rows - 1));
    g.box(x1 - x0 - 0.3, 0.12, 0.35, 0x7a5436, (x0 + x1) / 2, 0.1, z);
    const n = Math.floor((x1 - x0) / 0.9);
    for (let i = 0; i < n; i++) { const x = x0 + 0.45 + i * 0.9; g.boxB(0.28, 0.55 + ((i + r) % 3) * 0.12, 0.28, col, x, 0.1, z, i); }
  }
}
function pTree(g, x, z, s = 1) { g.cyl(0.14 * s, 0.2 * s, 1.2 * s, 5, P.woodD, x, 0, z).ico(0.9 * s, P.leaf, x, 1.7 * s, z, 1, 0.9, 1, 0, 0.28).ico(0.6 * s, P.leafD, x + 0.4 * s, 2.1 * s, z + 0.2 * s, 1, 0.9, 1, 0, 0.3); }

/* standard house body: walls + timber + gable roof + door + windows + chimney */
function pBody(g, o) {
  const w = o.w, d = o.d, h = o.h, y0 = o.y0 == null ? 0.4 : o.y0, floors = o.floors || 1;
  const roofH = o.roofH == null ? Math.min(w, d) * 0.5 : o.roofH, oh = o.oh == null ? 0.35 : o.oh;
  g.push(o.x || 0, 0, o.z || 0, o.ry || 0);
  if (o.foundation !== false) g.box(w + 0.3, 2.8, d + 0.3, o.base || P.stone, 0, y0 - 1.4, 0);
  g.boxB(w, h, d, o.wall || P.wall, 0, y0, 0);
  if (o.ground) g.boxB(w + 0.04, Math.min(h, o.groundH || 1.6), d + 0.04, o.ground, 0, y0, 0);
  if (o.timber !== false) {
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.boxB(0.22, h, 0.22, P.beam, x, y0, z);
    for (let f = 1; f <= floors; f++) {
      const yy = y0 + (h * f) / floors - 0.08;
      g.box(w + 0.12, 0.18, 0.12, P.beam, 0, yy, d / 2 + 0.03).box(w + 0.12, 0.18, 0.12, P.beam, 0, yy, -d / 2 - 0.03).box(0.12, 0.18, d + 0.12, P.beam, w / 2 + 0.03, yy, 0).box(0.12, 0.18, d + 0.12, P.beam, -w / 2 - 0.03, yy, 0);
    }
    if (o.braces) for (const s of [-1, 1]) g.box(0.12, Math.hypot(w * 0.2, h / floors) , 0.1, P.beam, s * w * 0.38, y0 + h / floors / 2, d / 2 + 0.05, 0, 0, s * 0.6);
  }
  if (o.roof !== false) {
    const rc = o.roof || P.roofR;
    if (o.hip) g.pyr(w + oh * 2, d + oh * 2, roofH, rc, 0, y0 + h, 0);
    else if (o.axis === 'z') g.roof(w + oh * 2, d + oh * 2, roofH, rc, 0, y0 + h, 0, 0, o.wall || P.wall);
    else g.roof(d + oh * 2, w + oh * 2, roofH, rc, 0, y0 + h, 0, Math.PI / 2, o.wall || P.wall);
    // ridge beam
    if (!o.hip) { if (o.axis === 'z') g.box(0.16, 0.16, d + oh * 2 + 0.1, P.beam, 0, y0 + h + roofH, 0); else g.box(w + oh * 2 + 0.1, 0.16, 0.16, P.beam, 0, y0 + h + roofH, 0); }
  }
  if (o.door !== false) pDoor(g, o.doorX || 0, y0, d / 2 + 0.04, 0, o.doorO || {});
  const fl = floors;
  for (let f = 0; f < fl; f++) {
    const wy = y0 + (h / fl) * (f + 0.58);
    const nf = o.winFront == null ? 2 : o.winFront;
    for (let i = 0; i < nf; i++) {
      let x = nf === 1 ? 0 : lerp(-w / 2 + 0.95, w / 2 - 0.95, i / (nf - 1));
      if (f === 0 && o.door !== false && Math.abs(x - (o.doorX || 0)) < 1.1) continue;
      pWindow(g, x, wy, d / 2 + 0.05, 0, { shutter: o.shutter, flowers: o.flowers && f === 0, w: o.winW, h: o.winH, shutters: o.shutters });
    }
    const ns = o.winSide == null ? 1 : o.winSide;
    for (let i = 0; i < ns; i++) {
      const z = ns === 1 ? 0 : lerp(-d / 2 + 0.9, d / 2 - 0.9, i / (ns - 1));
      pWindow(g, w / 2 + 0.05, wy, z, Math.PI / 2, { shutter: o.shutter, w: o.winW, h: o.winH, shutters: o.shutters });
      pWindow(g, -w / 2 - 0.05, wy, z, -Math.PI / 2, { shutter: o.shutter, w: o.winW, h: o.winH, shutters: o.shutters });
    }
    const nb = o.winBack == null ? 1 : o.winBack;
    for (let i = 0; i < nb; i++) { const x = nb === 1 ? 0 : lerp(-w / 2 + 0.9, w / 2 - 0.9, i / (nb - 1)); pWindow(g, x, wy, -d / 2 - 0.05, Math.PI, { shutter: o.shutter, w: o.winW, h: o.winH, shutters: o.shutters }); }
  }
  if (o.chimney !== false) pChimney(g, o.chimX == null ? w * 0.28 : o.chimX, y0 + h - 0.2, o.chimZ == null ? -d * 0.12 : o.chimZ, roofH + 0.9);
  g.pop();
}

/* --- per-building models --- */
const MODEL_FNS = {
  home(g) {
    pBody(g, { w: 5.2, d: 4.6, h: 2.9, z: -0.5, wall: P.wall, roof: P.roofR, roofH: 2.2, flowers: true, braces: true, winFront: 2 });
    pLamp(g, 0.9, 2.2, 1.95);
    g.boxB(1.6, 0.12, 0.5, P.woodL, -1.8, 0.62, 2.35).boxB(0.1, 0.5, 0.1, P.woodD, -2.4, 0.1, 2.35).boxB(0.1, 0.5, 0.1, P.woodD, -1.2, 0.1, 2.35);
    g.boxB(0.12, 1.1, 0.12, P.woodD, 2.8, 0, 2.9).boxB(0.5, 0.35, 0.35, 0x4f6d8a, 2.8, 1.1, 2.9);
    g.ico(0.5, P.leaf, 2.8, 0.4, 1.8, 1, 0.8, 1, 0, 0.3).ico(0.45, P.leafD, -2.9, 0.35, 1.8, 1, 0.8, 1, 0, 0.3);
  },
  small_house(g) {
    pBody(g, { w: 4.4, d: 4.0, h: 2.5, wall: 0xf1dfc0, roof: P.roofR, axis: 'z', roofH: 2.0, winFront: 2, winSide: 1, flowers: true });
    g.ico(0.45, P.leaf, 2.4, 0.35, 1.9, 1, 0.8, 1, 0, 0.3);
  },
  cottage(g) {
    pBody(g, { w: 5.4, d: 4.6, h: 3.8, floors: 2, wall: P.plaster, roof: P.roofB, roofH: 2.4, shutter: P.shutterB, flowers: true, braces: true, winFront: 2, winSide: 1 });
    g.shed(2.4, 1.3, 0.5, 0.1, P.roofB, 0, 2.5, 2.9).boxB(0.12, 2.1, 0.12, P.beam, -1.05, 0.4, 3.4).boxB(0.12, 2.1, 0.12, P.beam, 1.05, 0.4, 3.4);
  },
  manor(g) {
    pBody(g, { w: 7.4, d: 5.2, h: 5.0, z: -0.8, floors: 2, wall: P.wall2, roof: P.roofT, roofH: 2.6, base: P.stoneD, winFront: 4, winSide: 2, shutter: P.shutterB, chimX: 2.6, braces: false });
    pChimney(g, -2.6, 5.2, -1.4, 3.4);
    pBody(g, { w: 2.8, d: 1.6, h: 4.0, z: 2.2, wall: P.wall2, roof: P.roofT, axis: 'z', roofH: 1.6, winFront: 1, winSide: 0, winBack: 0, chimney: false, door: true, foundation: true, timber: false });
    g.boxB(3.2, 0.12, 1.0, P.woodD, 0, 2.9, 3.5);
    for (const s of [-1, 1]) g.boxB(0.1, 0.7, 0.1, P.beam, s * 1.5, 3.0, 3.95);
    g.box(3.1, 0.08, 0.08, P.beam, 0, 3.65, 3.95);
  },
  townhouse(g) {
    pBody(g, { w: 5.4, d: 5.6, h: 7.2, floors: 3, wall: P.rose, ground: P.stoneL, groundH: 2.4, roof: P.slate, roofH: 2.8, winFront: 2, winSide: 2, shutter: P.shutterR, timber: false });
    pChimney(g, -1.8, 7.4, -1.4, 3.3);
    g.box(1.2, 0.9, 0.9, P.rose, 0, 8.3, 2.3).roof(1.5, 1.2, 0.7, P.slate, 0, 8.75, 2.3);
    g.win(0.5, 0.5, 0.06, 0, 8.3, 2.78);
  },
  woodcutter(g) {
    g.push(0, 0, -0.9);
    pFoundation(g, 4.9, 4.2, P.stoneD, 0.3);
    for (let i = 0; i < 6; i++) {
      const y = 0.55 + i * 0.42, c = i % 2 ? P.log : P.logL;
      g.cylC(0.22, 0.22, 4.9, 6, c, 0, y, 1.9, 0, 0, Math.PI / 2).cylC(0.22, 0.22, 4.9, 6, c, 0, y, -1.9, 0, 0, Math.PI / 2);
      g.cylC(0.22, 0.22, 4.1, 6, c, 2.25, y + 0.2, 0, Math.PI / 2, 0, 0).cylC(0.22, 0.22, 4.1, 6, c, -2.25, y + 0.2, 0, Math.PI / 2, 0, 0);
    }
    g.boxB(4.2, 2.6, 3.5, P.woodD, 0, 0.3, 0);
    g.roof(5.0, 5.8, 1.9, P.roofG, 0, 2.9, 0, Math.PI / 2, P.logL);
    pDoor(g, -0.6, 0.35, 2.1);
    pWindow(g, 1.2, 1.8, 2.12, 0, { shutter: P.shutterR });
    pChimney(g, 1.4, 2.8, -0.8, 2.3);
    g.pop();
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) g.cylC(0.26, 0.26, 2.2, 7, i % 2 ? P.log : P.logL, 2.9, 0.28 + r * 0.46, 0.6 + i * 0.52 + r * 0.26, 0, 0, Math.PI / 2 + Math.PI / 2);
    g.cyl(0.45, 0.5, 0.6, 8, P.log, -1.6, 0, 2.0).cyl(0.42, 0.42, 0.02, 8, 0xc49a66, -1.6, 0.6, 2.0);
    g.box(0.07, 0.8, 0.07, P.woodD, -1.5, 0.95, 2.0, 0, 0, 0.3).box(0.35, 0.22, 0.05, P.metal, -1.37, 1.3, 2.0, 0, 0, 0.3);
  },
  storage_shed(g) {
    pFoundation(g, 5.6, 4.6, P.stoneD, 0.25);
    g.boxB(5.2, 2.6, 0.2, P.wood, 0, 0.25, -2.0).boxB(0.2, 2.6, 4.2, P.wood, -2.5, 0.25, 0).boxB(0.2, 2.6, 4.2, P.wood, 2.5, 0.25, 0);
    for (let i = 0; i < 6; i++) g.box(0.06, 2.5, 0.05, P.woodD, -2.2 + i * 0.88, 1.5, -1.88);
    g.shed(5.8, 4.8, 0.9, 0.25, P.roofBr, 0, 2.85, 0);
    for (const x of [-2.5, 2.5]) g.boxB(0.2, 2.6, 0.2, P.beam, x, 0.25, 2.1);
    pCrate(g, -1.4, 0.25, -1.2, 0.9); pCrate(g, -1.4, 1.15, -1.2, 0.7, 0.4); pCrate(g, 0, 0.25, -1.3, 0.8, 0.2);
    pBarrel(g, 1.5, 0.25, -1.2); pBarrel(g, 1.6, 0.25, 0.0); g.boxB(1.2, 0.5, 0.8, P.hay, -0.4, 0.25, 0.6);
  },
  well(g) {
    g.cyl(1.15, 1.25, 0.95, 10, P.stone, 0, 0, 0).cyl(0.9, 0.9, 0.05, 10, 0x2b5f7a, 0, 0.8, 0).cyl(1.2, 1.2, 0.12, 10, P.stoneL, 0, 0.95, 0);
    g.boxB(0.18, 2.2, 0.18, P.beam, -1.05, 0.9, 0).boxB(0.18, 2.2, 0.18, P.beam, 1.05, 0.9, 0);
    g.cylC(0.08, 0.08, 2.3, 6, P.woodD, 0, 2.4, 0, 0, 0, Math.PI / 2);
    g.roof(1.7, 2.6, 0.9, P.roofR, 0, 3.05, 0, Math.PI / 2);
    g.box(0.03, 0.9, 0.03, 0x444444, 0, 1.95, 0).cyl(0.18, 0.15, 0.3, 7, P.woodL, 0, 1.4, 0);
  },
  lantern(g) {
    g.boxB(0.34, 0.3, 0.34, P.stoneD, 0, 0, 0).boxB(0.14, 2.4, 0.14, P.metalD, 0, 0.3, 0).boxB(0.5, 0.1, 0.5, P.metalD, 0, 2.7, 0);
    g.glowBox(0.34, 0.42, 0.34, 0xffd27a, 0, 3.0, 0); g.light(0, 3.0, 0);
    g.pyr(0.56, 0.56, 0.3, P.metalD, 0, 3.22, 0);
  },
  flower_bed(g) {
    g.boxB(1.9, 0.38, 1.9, P.woodL, 0, 0, 0).boxB(1.7, 0.06, 1.7, P.soil, 0, 0.36, 0);
    const cols = [P.fR, P.fY, P.fP, P.fW, P.fB];
    for (let i = 0; i < 9; i++) { const x = -0.55 + (i % 3) * 0.55, z = -0.55 + Math.floor(i / 3) * 0.55; g.box(0.05, 0.35, 0.05, 0x5d9a3a, x, 0.58, z).ico(0.17, cols[i % 5], x, 0.8, z, 1, 0.7, 1, 0, 0.2); }
  },
  bench(g) {
    g.boxB(1.8, 0.1, 0.55, P.woodL, 0, 0.45, 0).box(1.8, 0.45, 0.08, P.woodL, 0, 0.85, -0.26, 0, -0.15);
    for (const x of [-0.75, 0.75]) g.boxB(0.1, 0.45, 0.5, P.metalD, x, 0, 0);
  },
  planted_tree(g) {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.dodec(0.2, P.stoneD, Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75, 1, 0.7, 1, 0.2); }
    g.cyl(0.62, 0.62, 0.05, 8, P.soil, 0, 0, 0);
    pTree(g, 0, 0, 1.35);
  },
  stonecutter(g) {
    pBody(g, { x: -1.8, z: -1.5, w: 3.6, d: 3.0, h: 2.4, wall: P.stoneL, roof: P.roofR2, axis: 'z', roofH: 1.5, timber: false, winFront: 1, winSide: 0, winBack: 0, doorX: -0.8, base: P.stoneD });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3 - r; i++) g.boxB(1.0, 0.7, 0.8, i % 2 ? P.stone : P.stoneL, 2.0 + i * 1.05 + r * 0.5, r * 0.7, -2.2);
    g.boxB(1.6, 0.8, 1.0, P.woodD, 1.5, 0, 1.6).boxB(0.9, 0.6, 0.7, P.stoneL, 1.5, 0.8, 1.6);
    g.boxB(0.12, 3.8, 0.12, P.beam, 3.3, 0, 0.4).box(2.2, 0.12, 0.12, P.beam, 2.4, 3.8, 0.4).box(0.03, 1.5, 0.03, 0x333333, 1.4, 3.05, 0.4).boxB(0.6, 0.5, 0.6, P.stone, 1.4, 1.8, 0.4);
  },
  farm(g) {
    pBody(g, { x: -3.8, z: -2.7, w: 3.8, d: 3.4, h: 2.5, wall: P.warm, roof: P.thatch, roofH: 1.8, winFront: 1, winSide: 1, doorX: 0.6, oh: 0.45 });
    pCrops(g, -0.6, -4.2, 5.4, -0.6, P.hay, 4);
    pCrops(g, -5.4, 0.6, 5.4, 4.2, 0x8fbf4f, 4);
    pFence(g, -5.9, 4.8, -1.2, 4.8); pFence(g, 1.2, 4.8, 5.9, 4.8); pFence(g, 5.9, -4.8, 5.9, 4.8); pFence(g, -5.9, -0.2, -5.9, 4.8);
    g.boxB(0.1, 1.9, 0.1, P.woodD, 2.6, 0, 2.4).box(1.3, 0.1, 0.1, P.woodD, 2.6, 1.45, 2.4).boxB(0.5, 0.7, 0.34, P.shutterB, 2.6, 0.95, 2.4).boxB(0.36, 0.36, 0.36, 0xe9c98f, 2.6, 1.68, 2.4).cyl(0.52, 0.52, 0.05, 8, P.hay, 2.6, 2.03, 2.4).cone(0.28, 0.28, 8, P.hay, 2.6, 2.06, 2.4);
  },
  large_farm(g) {
    g.push(-3.6, 0, -2.6);
    pFoundation(g, 6.6, 5.4, P.stoneD, 0.3);
    g.boxB(6.2, 3.4, 5.0, 0xb5413a, 0, 0.3, 0);
    for (const x of [-3.1, 3.1]) for (const z of [-2.5, 2.5]) g.boxB(0.2, 3.4, 0.2, P.white, x, 0.3, z);
    g.roof(7.0, 5.8, 1.1, 0x5b3a2e, 0, 3.7, 0, 0, 0xb5413a).roof(5.2, 5.8, 1.9, 0x6b4636, 0, 4.4, 0, 0, 0xb5413a);
    g.boxB(2.4, 2.4, 0.12, 0x8e2f2a, 0, 0.3, 2.56).box(2.4, 0.14, 0.14, P.white, 0, 1.5, 2.62).box(0.14, 2.9, 0.14, P.white, 0, 1.5, 2.64, 0, 0, 0.78).box(0.14, 2.9, 0.14, P.white, 0, 1.5, 2.64, 0, 0, -0.78);
    g.win(0.8, 0.6, 0.1, 0, 3.6, 2.56);
    g.pop();
    g.cyl(1.2, 1.2, 6.4, 10, P.stoneL, 3.1, 0, -3.8).cyl(1.28, 1.28, 0.2, 10, P.metal, 3.1, 2.2, -3.8).cyl(1.28, 1.28, 0.2, 10, P.metal, 3.1, 4.4, -3.8);
    g._add(new THREE.SphereGeometry(1.25, 10, 5, 0, TAU, 0, Math.PI / 2), 0xa94436, g._m(3.1, 6.4, -3.8));
    pCrops(g, -7.4, 1.0, -0.6, 5.4, P.hay, 4);
    pCrops(g, 0.6, 1.0, 7.4, 5.4, 0x8fbf4f, 4);
    pCrops(g, 5.4, -2.0, 7.6, 0.4, P.hay, 2);
    pFence(g, -7.9, 5.9, -1.4, 5.9); pFence(g, 1.4, 5.9, 7.9, 5.9); pFence(g, 7.9, 5.9, 7.9, -1);
  },
  mine(g) {
    g.dodec(3.4, 0x8a877f, 0, 1.2, -1.2, 1.2, 0.95, 0.95, 0.3).dodec(2.3, 0x77746d, -2.2, 0.8, -2.2, 1, 0.9, 1, 0.3).dodec(2.1, 0x9a9790, 2.3, 0.7, -2.4, 1, 0.9, 1, 0.3);
    g.boxB(2.6, 2.8, 1.2, 0x2a2622, 0, 0, 1.3);
    g.boxB(0.34, 3.0, 0.34, P.beam, -1.45, 0, 1.95).boxB(0.34, 3.0, 0.34, P.beam, 1.45, 0, 1.95).box(3.5, 0.4, 0.45, P.beam, 0, 3.1, 1.95);
    g.box(1.4, 0.4, 0.06, P.woodL, 0, 3.6, 2.2);
    pLamp(g, 1.45, 2.4, 2.3);
    for (let i = 0; i < 6; i++) g.box(1.7, 0.1, 0.3, P.woodD, 0, 0.05, 1.9 + i * 0.4);
    g.box(0.07, 0.1, 2.4, P.metal, -0.55, 0.14, 3.0).box(0.07, 0.1, 2.4, P.metal, 0.55, 0.14, 3.0);
    g.boxB(1.2, 0.6, 1.4, P.metalD, 0, 0.3, 3.2);
    for (let i = 0; i < 4; i++) g.dodec(0.22, i % 2 ? 0xc9703a : 0x77746d, -0.3 + (i % 2) * 0.5, 0.95, 2.9 + Math.floor(i / 2) * 0.5, 1, 0.8, 1, 0.3);
    for (const s of [-1, 1]) g.cylC(0.18, 0.18, 0.1, 8, P.metalD, s * 0.62, 0.35, 3.2, 0, 0, Math.PI / 2);
  },
  fisher_hut(g) {
    for (const [x, z] of [[-1.6, -1.8], [1.6, -1.8], [-1.6, 1.0], [1.6, 1.0]]) g.cyl(0.14, 0.16, 3.0, 5, P.woodD, x, -1.8, z);
    g.boxB(3.8, 0.2, 3.4, P.wood, 0, 1.0, -0.4);
    g.boxB(3.4, 2.2, 2.8, P.woodL, 0, 1.2, -0.5);
    g.roof(3.4, 4.3, 1.5, P.thatch, 0, 3.4, -0.5, Math.PI / 2, P.woodL);
    pDoor(g, -0.6, 1.2, -1.95, Math.PI);
    pWindow(g, 0.7, 2.3, 0.92, 0, { shutter: P.shutterB });
    for (let i = 0; i < 5; i++) g.boxB(1.4, 0.12, 0.6, i % 2 ? P.wood : P.woodL, 0.8, 1.0, 1.4 + i * 0.6);
    for (const z of [1.4, 3.8]) g.cyl(0.1, 0.12, 3.0, 5, P.woodD, 1.4, -1.8, z);
    pBarrel(g, -1.0, 1.2, 1.4);
    g.boxB(0.08, 1.4, 0.08, P.woodD, -1.4, 1.2, 2.2).boxB(0.08, 1.4, 0.08, P.woodD, -0.2, 1.2, 2.2).box(1.3, 0.06, 0.06, P.woodD, -0.8, 2.55, 2.2);
    for (let i = 0; i < 3; i++) g.box(0.12, 0.4, 0.05, 0x7fa6b8, -1.2 + i * 0.4, 2.25, 2.2);
    g.boxB(3.2, 0.3, 0.3, P.woodD, 0, 1.2, -2.3);
    for (let i = 0; i < 3; i++) g.boxB(0.8, 0.14, 0.5, P.woodL, 0, 0.9 - i * 0.35, -2.3 - 0.3 - i * 0.4);
  },
  windmill(g) {
    g.cyl(1.5, 2.2, 6.2, 8, P.plaster, 0, 0, 0).cyl(2.35, 2.35, 0.5, 8, P.stoneD, 0, -0.2, 0);
    g.cyl(1.7, 1.7, 0.3, 8, P.beam, 0, 6.2, 0).cone(1.9, 2.4, 8, P.roofR, 0, 6.45, 0);
    pDoor(g, 0, 0.3, 2.05, 0, { w: 0.9, h: 1.7 });
    pWindow(g, 0, 3.8, 1.78, 0, { shutters: false, w: 0.5, h: 0.6 });
    g.cylC(0.2, 0.2, 1.0, 6, P.beam, 0, 5.4, 1.6, Math.PI / 2, 0, 0);
  },
  bakery(g) {
    pBody(g, { w: 5.2, d: 4.4, h: 3.1, z: -0.4, wall: 0xf6e0c4, roof: P.roofR, roofH: 2.0, winFront: 2, winSide: 1, shutter: P.shutterR, flowers: false, chimX: -1.6 });
    for (let i = 0; i < 7; i++) g.shed(0.72, 1.1, 0.5, 0.1, i % 2 ? P.white : P.red, -2.2 + i * 0.73, 2.35, 2.35);
    g.boxB(0.08, 0.8, 0.08, P.metalD, 0, 3.4, 1.9).box(1.2, 0.08, 0.08, P.metalD, 0, 4.2, 1.9 + 0.3);
    g.box(1.2, 0.6, 0.1, P.woodL, 0, 3.8, 2.25).cylC(0.2, 0.28, 0.7, 6, 0xc98a45, 0, 3.8, 2.33, 0, 0, Math.PI / 2);
    g._add(new THREE.SphereGeometry(1.1, 8, 5, 0, TAU, 0, Math.PI / 2), 0xb5653f, g._m(3.1, 0.4, -0.6));
    g.glowBox(0.6, 0.45, 0.2, 0xff9a3c, 3.1, 0.7, 0.45); g.fire(3.1, 0.7, 0.5);
    pChimney(g, 3.3, 1.0, -1.2, 1.4);
    pBarrel(g, -2.8, 0.4, 2.0);
  },
  market_stall(g) {
    for (const [x, z] of [[-1.5, -1.2], [1.5, -1.2], [-1.5, 1.2], [1.5, 1.2]]) g.boxB(0.14, 2.4, 0.14, P.woodD, x, 0, z);
    for (let i = 0; i < 5; i++) g.shed(0.66, 3.0, 0.5, 0.12, i % 2 ? P.white : 0x3f8f5b, -1.33 + i * 0.66, 2.35, 0);
    g.boxB(3.0, 0.9, 1.0, P.woodL, 0, 0, 0.9).boxB(3.1, 0.1, 1.1, P.woodD, 0, 0.9, 0.9);
    const fruit = [P.fR, 0xf29e3d, P.leaf, P.fY, 0x8a4fb7];
    for (let i = 0; i < 5; i++) { g.boxB(0.5, 0.2, 0.5, P.woodL, -1.2 + i * 0.6, 1.0, 0.9); for (let k = 0; k < 3; k++) g.ico(0.1, fruit[i], -1.3 + i * 0.6 + k * 0.1, 1.3, 0.85 + (k % 2) * 0.12, 1, 1, 1, 0, 0); }
    pCrate(g, 1.2, 0, -0.6, 0.6); pBarrel(g, -1.1, 0, -0.6);
  },
  general_store(g) {
    pBody(g, { w: 6.4, d: 4.8, h: 4.6, z: -0.6, floors: 2, wall: P.sage, roof: P.roofG, roofH: 2.2, winFront: 2, winSide: 1, shutter: P.shutter, braces: true, chimX: 2 });
    g.push(0, 0, -0.6);
    for (const s of [-1, 1]) { g.box(1.8, 1.2, 0.08, P.frame, s * 1.9, 1.5, 2.44); g.win(1.6, 1.0, 0.1, s * 1.9, 1.5, 2.46); }
    for (let i = 0; i < 8; i++) g.shed(0.8, 1.2, 0.5, 0.1, i % 2 ? P.white : 0x3f8f5b, -2.8 + i * 0.8, 2.5, 3.0);
    g.box(2.6, 0.7, 0.12, P.woodL, 0, 3.05, 2.52);
    g.pop();
    pCrate(g, -2.8, 0, 2.6, 0.7); pCrate(g, -2.1, 0, 2.8, 0.55, 0.4); pBarrel(g, 2.8, 0, 2.6);
  },
  blacksmith(g) {
    pBody(g, { z: -1.5, w: 5.4, d: 3.4, h: 3.0, wall: P.stoneL, roof: P.slate, roofH: 1.6, timber: false, winFront: 0, winSide: 1, door: false, chimney: false, base: P.stoneD });
    g.shed(5.8, 3.3, 0.45, 0.15, P.slate, 0, 2.55, 1.35);
    for (const x of [-2.6, 2.6]) g.boxB(0.22, 2.5, 0.22, P.beam, x, 0.1, 2.8);
    g.boxB(5.6, 0.14, 3.4, P.stoneD, 0, 0.0, 1.3);
    g.boxB(1.6, 1.0, 1.2, P.stoneD, -1.5, 0.1, 0.3).glowBox(1.1, 0.14, 0.8, 0xff7b2e, -1.5, 1.12, 0.3); g.fire(-1.5, 1.2, 0.3);
    g.boxB(0.9, 4.4, 0.9, P.stoneD, -1.8, 0.1, -0.7); g.smoke(-1.8, 4.7, -0.7);
    g.boxB(0.5, 0.5, 0.4, P.woodD, 0.8, 0.1, 1.2).boxB(0.9, 0.3, 0.35, P.metalD, 0.8, 0.6, 1.2).box(0.3, 0.18, 0.2, P.metalD, 1.33, 0.82, 1.2);
    pBarrel(g, 2.2, 0.1, 2.0);
    g.boxB(0.1, 1.1, 0.1, P.woodD, 2.4, 1.8, 2.95).box(0.6, 0.4, 0.06, P.metalD, 2.4, 2.9, 3.0);
  },
  town_hall(g) {
    pBody(g, { z: -1.0, w: 10.4, d: 6.4, h: 4.8, wall: P.stoneL, roof: P.roofR2, roofH: 2.8, timber: false, winFront: 4, winSide: 2, winBack: 3, door: false, chimney: false, base: P.stoneD, shutters: false, winH: 1.3 });
    pDoor(g, 0, 0.4, 2.22, 0, { w: 1.5, h: 2.4, col: 0x5a3a22 });
    for (const x of [-2.2, -1.1, 1.1, 2.2]) g.cyl(0.26, 0.3, 4.6, 8, P.white, x, 0.4, 3.2);
    g.boxB(5.4, 0.3, 2.2, P.stone, 0, 0.1, 3.2).boxB(5.6, 0.25, 0.9, P.stoneL, 0, -0.1, 4.6);
    g.roof(5.4, 2.6, 1.2, P.roofR2, 0, 5.0, 3.1, 0, P.white);
    g.boxB(3.0, 5.2, 3.0, P.stoneL, 0, 5.2, -1.0).pyr(3.6, 3.6, 3.2, P.roofR2, 0, 10.4, -1.0);
    g.cylC(0.8, 0.8, 0.12, 12, P.white, 0, 8.2, 0.52, Math.PI / 2, 0, 0); g.box(0.07, 0.6, 0.05, 0x333333, 0, 8.4, 0.6).box(0.45, 0.07, 0.05, 0x333333, 0.18, 8.2, 0.6);
    g.win(0.6, 1.0, 0.1, 0, 6.4, 0.52);
    g.box(0.07, 2.4, 0.07, P.metalD, 0, 14.8, -1.0).box(1.2, 0.7, 0.04, P.red, 0.62, 15.6, -1.0);
    for (const x of [-4.2, 4.2]) pLamp(g, x, 2.5, 2.35);
  },
  inn(g) {
    pBody(g, { z: -0.6, w: 8.2, d: 5.6, h: 6.6, floors: 3, wall: P.wall, roof: P.roofR, roofH: 3.0, winFront: 4, winSide: 2, winBack: 2, braces: true, flowers: true, chimX: 2.8 });
    pChimney(g, -2.8, 6.8, -1.2, 3.6);
    g.boxB(0.1, 1.3, 0.1, P.metalD, 3.5, 2.6, 2.4).box(0.1, 0.1, 1.0, P.metalD, 3.5, 3.9, 2.8).box(1.1, 0.8, 0.08, P.woodL, 3.5, 3.4, 3.2, Math.PI / 2);
    for (const x of [-1.2, 1.2]) pLamp(g, x, 2.3, 2.4);
    g.boxB(8.4, 0.14, 1.0, P.woodD, 0, 2.6, 2.7);
    for (let i = 0; i < 8; i++) g.boxB(0.07, 0.7, 0.07, P.beam, -3.9 + i * 1.12, 2.74, 3.15);
    g.box(8.2, 0.08, 0.08, P.beam, 0, 3.44, 3.15);
  },
  tavern(g) {
    pBody(g, { z: -1.0, w: 7.2, d: 5.0, h: 3.6, wall: 0x8b6240, roof: P.thatch, roofH: 2.6, oh: 0.55, winFront: 2, winSide: 2, shutter: P.shutterR, timber: true, flowers: true, chimX: -2.4 });
    g.box(1.6, 1.0, 0.1, P.woodL, 2.2, 3.1, 1.62).cyl(0.22, 0.2, 0.45, 7, P.hay, 2.2, 2.9, 1.72).box(0.08, 0.3, 0.08, P.white, 2.46, 3.12, 1.72);
    for (const x of [-2.2, 2.2]) {
      g.boxB(1.6, 0.1, 0.9, P.woodL, x, 0.75, 3.4);
      g.boxB(0.12, 0.75, 0.12, P.woodD, x - 0.6, 0, 3.4).boxB(0.12, 0.75, 0.12, P.woodD, x + 0.6, 0, 3.4);
      g.boxB(1.6, 0.08, 0.35, P.woodD, x, 0.45, 2.7).boxB(1.6, 0.08, 0.35, P.woodD, x, 0.45, 4.1);
      g.cyl(0.08, 0.08, 0.2, 6, 0xe8c45a, x + 0.3, 0.85, 3.4);
    }
    pBarrel(g, -3.2, 0, 1.8); pBarrel(g, -3.2, 0, 2.6); pBarrel(g, -3.2, 0.85, 2.2);
    pLamp(g, 0.9, 2.3, 1.62);
  },
  stable(g) {
    pFoundation(g, 8.4, 3.6, P.stoneD, 0.2);
    g.boxB(8.2, 2.6, 0.2, P.wood, 0, 0.2, -1.6).boxB(0.2, 2.6, 3.2, P.wood, -4.0, 0.2, 0).boxB(0.2, 2.6, 3.2, P.wood, 4.0, 0.2, 0);
    for (let i = -1; i <= 1; i++) g.boxB(0.16, 1.4, 2.6, P.woodL, i * 2.0, 0.2, -0.2);
    for (let i = -2; i <= 2; i++) g.boxB(0.2, 2.5, 0.2, P.beam, i * 2.0, 0.2, 1.5);
    g.roof(4.4, 9.0, 1.6, P.roofR, 0, 2.7, -0.1, Math.PI / 2, P.wood);
    g.boxB(1.0, 0.6, 0.8, P.hay, -3.0, 0.2, -0.8).boxB(1.0, 0.6, 0.8, P.hay, 3.0, 0.2, -0.8);
    const horse = (x, z, ry, c) => {
      g.push(x, 0, z, ry);
      g.boxB(0.7, 0.7, 1.7, c, 0, 1.0, 0);
      for (const [lx, lz] of [[-0.24, -0.6], [0.24, -0.6], [-0.24, 0.6], [0.24, 0.6]]) g.boxB(0.18, 1.0, 0.18, c, lx, 0, lz);
      g.box(0.36, 0.9, 0.4, c, 0, 1.9, 0.85, 0, -0.5).box(0.34, 0.34, 0.72, c, 0, 2.3, 1.2).box(0.1, 0.8, 0.5, 0x3b2a1e, 0, 2.0, 0.7, 0, -0.5).box(0.1, 0.6, 0.12, 0x3b2a1e, 0, 1.4, -0.9, 0, 0.5);
      g.pop();
    };
    horse(-2.2, 2.6, 1.2, 0x8b5a2b); horse(1.8, 2.4, -0.4, 0xe8e0d0);
    pFence(g, -4.8, 3.4, 4.8, 3.4); pFence(g, -4.8, 1.6, -4.8, 3.4); pFence(g, 4.8, 1.6, 4.8, 3.4);
  },
  chapel(g) {
    pBody(g, { z: -1.4, w: 5.2, d: 7.4, h: 4.2, wall: P.stoneL, roof: P.slate, axis: 'z', roofH: 3.2, timber: false, winFront: 0, winSide: 3, winBack: 0, door: false, chimney: false, shutters: false, winW: 0.6, winH: 1.5, base: P.stoneD });
    g.push(0, 0, 3.1);
    pFoundation(g, 2.8, 2.8, P.stoneD);
    g.boxB(2.6, 8.4, 2.6, P.stoneL, 0, 0.4, 0);
    pDoor(g, 0, 0.4, 1.34, 0, { w: 1.2, h: 2.2, col: 0x5a3a22 });
    g.cylC(0.55, 0.55, 0.1, 10, P.frame, 0, 4.2, 1.33, Math.PI / 2, 0, 0); g.glowBox(0.7, 0.7, 0.08, 0xffc86b, 0, 4.2, 1.36);
    g.boxB(2.9, 0.3, 2.9, P.stone, 0, 6.2, 0);
    for (const s of [-1, 1]) { g.box(0.1, 1.4, 1.0, 0x2a2a2a, s * 1.31, 7.6, 0); g.box(1.0, 1.4, 0.1, 0x2a2a2a, 0, 7.6, s * 1.31); }
    g.cone(0.4, 0.6, 8, P.gold, 0, 7.1, 0);
    g.cone(2.0, 4.2, 4, P.slate, 0, 8.8, 0, Math.PI / 4);
    g.box(0.1, 1.2, 0.1, P.gold, 0, 13.5, 0).box(0.6, 0.1, 0.1, P.gold, 0, 13.7, 0);
    g.pop();
  },
  marketplace(g) {
    g.boxB(11.6, 0.2, 11.6, P.cobble, 0, -0.05, 0);
    for (let i = 0; i < 36; i++) { const x = -5 + (i % 6) * 2, z = -5 + Math.floor(i / 6) * 2; g.boxB(1.85, 0.06, 1.85, (i + Math.floor(i / 6)) % 2 ? P.stoneL : P.stone, x, 0.15, z); }
    const cols = [0x3f8f5b, P.red, 0x4f6d8a, 0xd98a2b];
    [[-3.6, -3.6, 0], [3.6, -3.6, 0], [-3.6, 3.2, Math.PI], [3.6, 3.2, Math.PI]].forEach(([x, z, ry], k) => {
      g.push(x, 0.2, z, ry);
      for (const [px, pz] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) g.boxB(0.12, 2.3, 0.12, P.woodD, px, 0, pz);
      for (let i = 0; i < 4; i++) g.shed(0.7, 2.6, 0.45, 0.12, i % 2 ? P.white : cols[k], -1.05 + i * 0.7, 2.25, 0);
      g.boxB(2.6, 0.9, 0.8, P.woodL, 0, 0, 0.8);
      for (let i = 0; i < 4; i++) g.ico(0.18, [P.fR, P.fY, P.leaf, 0xf29e3d][(i + k) % 4], -0.9 + i * 0.6, 1.05, 0.8, 1, 0.8, 1, 0, 0.2);
      g.pop();
    });
    g.cyl(0.9, 1.0, 0.7, 8, P.stone, 0, 0.2, 0);
    pTree(g, 0, 0, 1.4);
    for (const [x, z] of [[-5.4, 0], [5.4, 0]]) pLamp(g, x, 2.6, z), g.boxB(0.14, 2.4, 0.14, P.metalD, x, 0.2, z);
  },
  fountain(g) {
    g.cyl(2.3, 2.45, 0.75, 8, P.stone, 0, 0, 0).cyl(2.0, 2.0, 0.08, 8, P.water, 0, 0.62, 0);
    g.cyl(0.45, 0.55, 1.6, 8, P.stoneL, 0, 0.6, 0).cyl(1.1, 0.6, 0.35, 8, P.stone, 0, 2.1, 0).cyl(0.95, 0.95, 0.06, 8, P.water, 0, 2.38, 0);
    g.cyl(0.18, 0.25, 0.7, 6, P.stoneL, 0, 2.4, 0).ico(0.28, P.stoneL, 0, 3.25, 0, 1, 1, 1, 0, 0.1);
    g.glowBox(0.12, 0.6, 0.12, 0xbfefff, 0, 3.6, 0);
  },
  warehouse(g) {
    pBody(g, { z: -0.8, w: 10.2, d: 6.6, h: 4.6, wall: P.wood, roof: P.roofBr, roofH: 2.4, timber: true, winFront: 2, winSide: 2, winBack: 2, door: false, chimney: false, base: P.stoneD, shutters: false });
    g.boxB(3.0, 3.4, 0.12, P.woodD, 0, 0.4, 2.52).box(3.0, 0.14, 0.14, P.woodL, 0, 2.0, 2.6).box(0.12, 3.6, 0.14, P.woodL, 0, 2.1, 2.62, 0, 0, 0.72).box(0.12, 3.6, 0.14, P.woodL, 0, 2.1, 2.62, 0, 0, -0.72);
    for (let i = 0; i < 4; i++) pCrate(g, -4.5 + (i % 2) * 0.9, (Math.floor(i / 2)) * 0.8, 3.2, 0.8, i * 0.2);
    pBarrel(g, 4.2, 0, 3.2); pBarrel(g, 4.2, 0, 4.0);
    g.box(0.18, 0.18, 2.4, P.beam, 3.5, 4.2, 3.4).box(0.03, 1.4, 0.03, 0x333333, 3.5, 3.5, 4.5);
  },
  town_square(g) {
    g.boxB(15.6, 0.2, 15.6, P.stoneD, 0, -0.08, 0);
    for (let i = 0; i < 64; i++) { const x = -6.8 + (i % 8) * 1.95, z = -6.8 + Math.floor(i / 8) * 1.95; g.boxB(1.85, 0.08, 1.85, ((i % 8) + Math.floor(i / 8)) % 2 ? P.stoneL : P.cobble, x, 0.12, z); }
    g.cyl(2.2, 2.4, 0.5, 8, P.stone, 0, 0.2, 0).cyl(1.6, 1.8, 0.5, 8, P.stoneL, 0, 0.7, 0);
    g.push(0, 1.2, 0); pTree(g, 0, 0, 2.0); g.pop();
    for (const [x, z, ry] of [[-4.6, 0, Math.PI / 2], [4.6, 0, -Math.PI / 2], [0, -4.6, 0], [0, 4.6, Math.PI]]) { g.push(x, 0.2, z, ry); MODEL_FNS.bench(g); g.pop(); }
    for (const [x, z] of [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]]) { g.push(x, 0.2, z); MODEL_FNS.lantern(g); g.pop(); }
    for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) { g.push(x, 0.2, z); MODEL_FNS.flower_bed(g); g.pop(); }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.box(0.5, 0.4, 0.04, [P.red, P.fY, 0x3f8f5b, 0x4f6d8a][i % 4], Math.cos(a) * 7.6, 3.2, Math.sin(a) * 7.6, -a + Math.PI / 2); }
  },
  workshop(g) {
    pBody(g, { z: -1.0, w: 7.4, d: 5.0, h: 3.9, wall: P.woodL, roof: P.roofBr, roofH: 2.2, winFront: 1, winSide: 1, door: false, braces: true, chimX: 2.4 });
    g.boxB(2.6, 2.8, 0.12, 0x2d241c, -1.2, 0.4, 1.56);
    g.boxB(2.2, 0.8, 0.9, P.woodD, 1.8, 0, 2.6).cylC(0.35, 0.35, 0.04, 12, P.metal, 1.8, 1.0, 2.6, 0, 0, Math.PI / 2);
    for (let i = 0; i < 5; i++) g.boxB(2.8, 0.14, 0.34, P.woodL, -2.0, i * 0.15, 3.0 + (i % 2) * 0.05);
    g.boxB(0.14, 4.6, 0.14, P.beam, 3.6, 0, 3.4).box(2.0, 0.14, 0.14, P.beam, 2.7, 4.6, 3.4).box(0.03, 1.4, 0.03, 0x333333, 1.8, 3.9, 3.4).boxB(1.2, 0.2, 0.3, P.woodL, 1.8, 3.0, 3.4);
  },
  guard_tower(g) {
    pFoundation(g, 3.8, 3.8, P.stoneD);
    g.boxB(3.4, 7.6, 3.4, P.stone, 0, 0.4, 0);
    for (let y = 1.6; y < 7.6; y += 1.5) g.box(3.45, 0.12, 3.45, P.stoneD, 0, y, 0);
    g.boxB(4.0, 0.4, 4.0, P.stoneD, 0, 8.0, 0);
    for (let i = 0; i < 12; i++) { const k = i % 3, side = Math.floor(i / 3), t = -1.4 + k * 1.4; const [x, z] = [[t, 1.9], [t, -1.9], [1.9, t], [-1.9, t]][side]; g.boxB(0.6, 0.7, 0.6, P.stone, x, 8.4, z); }
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) g.boxB(0.18, 2.2, 0.18, P.beam, x, 8.4, z);
    g.pyr(4.4, 4.4, 1.8, P.roofR2, 0, 10.5, 0);
    pDoor(g, 0, 0.4, 1.74);
    g.win(0.4, 0.8, 0.08, 0, 5, 1.72);
    g.box(0.07, 2.0, 0.07, P.metalD, 0, 13.2, 0).box(1.0, 0.6, 0.04, 0x3b5f9e, 0.52, 13.8, 0);
    for (const s of [-1, 1]) { g.box(0.12, 0.6, 0.12, P.woodD, s * 1.1, 2.2, 1.85); g.glowBox(0.22, 0.3, 0.22, 0xff9a3c, s * 1.1, 2.62, 1.85); g.light(s * 1.1, 2.62, 1.9); }
  },
  library(g) {
    pBody(g, { z: -0.8, w: 8.8, d: 6.0, h: 5.0, wall: P.stoneL, roof: P.roofB, roofH: 2.4, hip: true, timber: false, winFront: 4, winSide: 2, winBack: 3, door: false, chimney: false, base: P.stoneD, shutters: false, winH: 1.5 });
    pDoor(g, 0, 0.4, 2.24, 0, { w: 1.4, h: 2.4 });
    for (const x of [-2.6, -1.3, 1.3, 2.6]) g.cyl(0.25, 0.28, 4.4, 8, P.white, x, 0.4, 3.1);
    g.boxB(6.4, 0.3, 1.9, P.stone, 0, 0.1, 3.1).boxB(6.4, 0.4, 1.9, P.white, 0, 4.8, 3.1).roof(6.6, 2.0, 1.2, P.roofB, 0, 5.2, 3.1, Math.PI / 2, P.white);
    g.cyl(1.2, 1.2, 1.2, 10, P.white, 0, 7.6, -0.8)._add(new THREE.SphereGeometry(1.3, 10, 5, 0, TAU, 0, Math.PI / 2), P.roofB, g._m(0, 8.8, -0.8));
    g.box(0.08, 0.8, 0.08, P.gold, 0, 10.4, -0.8);
  },
  harbor(g) {
    // land side (back): warehouse shed. water side (front): dock platform
    pBody(g, { z: -3.6, w: 6.4, d: 4.2, h: 3.4, wall: P.wood, roof: P.roofB, roofH: 1.8, winFront: 2, winSide: 1, door: false, chimney: false, shutter: P.shutterB, base: P.stoneD });
    pDoor(g, 0, 0.4, -5.75, Math.PI);
    for (let i = 0; i < 10; i++) g.boxB(13.6, 0.22, 0.95, i % 2 ? P.wood : P.woodL, 0, 0.35, -1.2 + i * 0.75);
    for (let i = 0; i < 6; i++) for (const z of [-0.8, 2.6, 6.0]) g.cyl(0.2, 0.22, 4.5, 6, P.woodD, -6.4 + i * 2.56, -4.0, z);
    for (const x of [-6.4, -2, 2, 6.4]) g.cyl(0.18, 0.2, 0.6, 6, P.metalD, x, 0.55, 6.2);
    g.boxB(0.3, 6.5, 0.3, P.beam, 5.2, 0.5, 0.4).box(0.3, 0.3, 4.6, P.beam, 5.2, 6.9, 2.4).box(0.03, 3.0, 0.03, 0x333333, 5.2, 5.4, 4.4);
    pCrate(g, 5.2, 3.4, 4.4 - 0.35, 0.7);
    for (let i = 0; i < 4; i++) pCrate(g, -5.2 + (i % 2) * 0.8, 0.55 + Math.floor(i / 2) * 0.7, 0.2, 0.7);
    pBarrel(g, -3.2, 0.55, 0.4); pBarrel(g, -2.4, 0.55, 0.2);
    g.push(-1, -0.2, 8.4, Math.PI / 2);
    g.boxB(1.8, 0.6, 5.2, P.woodD, 0, 0, 0).boxB(1.5, 0.12, 4.8, P.woodL, 0, 0.5, 0);
    g.boxB(0.16, 4.2, 0.16, P.beam, 0, 0.5, 0.4).box(0.05, 2.6, 1.8, P.white, 0.15, 3.0, 1.2);
    g.pop();
    for (const x of [-6, 6]) pLamp(g, x, 2.2, 5.8), g.boxB(0.12, 1.8, 0.12, P.metalD, x, 0.45, 5.8);
  },
  large_market(g) {
    g.boxB(15.6, 0.25, 11.6, P.cobble, 0, -0.05, 0);
    for (let i = 0; i < 5; i++) for (const z of [-5, 0, 5]) g.cyl(0.32, 0.36, 5.2, 8, P.stoneL, -7 + i * 3.5, 0.2, z * 0.95);
    g.boxB(15.8, 0.5, 11.2, P.stoneL, 0, 5.3, 0).roof(12.0, 16.4, 3.4, P.roofR, 0, 5.8, 0, Math.PI / 2, P.stoneL);
    g.win(2.4, 1.2, 0.1, 0, 7.0, 5.62); g.win(2.4, 1.2, 0.1, 0, 7.0, -5.62);
    const cols = [0x3f8f5b, P.red, 0x4f6d8a, 0xd98a2b, 0x8a4fb7, 0x3f7f7a];
    for (let k = 0; k < 6; k++) {
      const x = -5.2 + (k % 3) * 5.2, z = k < 3 ? -2.4 : 2.4;
      g.boxB(3.0, 0.9, 1.0, P.woodL, x, 0.2, z).boxB(3.0, 0.08, 1.2, cols[k], x, 2.8, z);
      for (let i = 0; i < 4; i++) g.ico(0.2, [P.fR, P.fY, P.leaf, 0xf29e3d, P.gold][(i + k) % 5], x - 1 + i * 0.66, 1.3, z, 1, 0.8, 1, 0, 0.2);
      g.boxB(0.1, 1.7, 0.1, P.woodD, x - 1.4, 1.1, z).boxB(0.1, 1.7, 0.1, P.woodD, x + 1.4, 1.1, z);
    }
    for (let i = 0; i < 6; i++) g.box(0.9, 1.4, 0.04, cols[i], -6.5 + i * 2.6, 4.2, 5.75);
  },
  statue(g) {
    g.boxB(3.2, 0.5, 3.2, P.stoneD, 0, 0, 0).boxB(2.4, 1.4, 2.4, P.stoneL, 0, 0.5, 0).boxB(2.7, 0.2, 2.7, P.stone, 0, 1.9, 0);
    const c = 0xc9a14a;
    g.boxB(0.3, 1.1, 0.34, c, -0.2, 2.1, 0).boxB(0.3, 1.1, 0.34, c, 0.2, 2.1, 0).boxB(0.85, 1.0, 0.5, c, 0, 3.2, 0).boxB(0.6, 0.6, 0.6, c, 0, 4.2, 0);
    g.box(0.26, 1.0, 0.26, c, 0.6, 4.3, 0, 0, 0, -0.25).box(0.26, 0.9, 0.26, c, -0.55, 3.35, 0, 0, 0, 0.12).cone(0.45, 0.35, 5, P.gold, 0, 4.8, 0);
  },
  clock_tower(g) {
    pFoundation(g, 4.6, 4.6, P.stoneD);
    g.boxB(4.2, 11.0, 4.2, P.stoneL, 0, 0.4, 0);
    for (let y = 2.4; y < 11; y += 2.2) g.box(4.3, 0.18, 4.3, P.stone, 0, y, 0);
    g.boxB(4.7, 2.4, 4.7, P.stone, 0, 11.4, 0);
    for (let s = 0; s < 4; s++) {
      g.push(0, 12.6, 0, (s * Math.PI) / 2);
      g.cylC(1.0, 1.0, 0.12, 14, P.frame, 0, 0, 2.36, Math.PI / 2, 0, 0);
      g._add(new THREE.CylinderGeometry(0.88, 0.88, 0.06, 14), 0xfff6dc, g._m(0, 0, 2.42, 0, Math.PI / 2, 0), 'glow');
      g.box(0.08, 0.7, 0.05, 0x222222, 0, 0.25, 2.47).box(0.5, 0.08, 0.05, 0x222222, 0.2, 0, 2.47);
      g.pop();
    }
    pDoor(g, 0, 0.4, 2.14, 0, { w: 1.2, h: 2.2 });
    g.pyr(5.0, 5.0, 4.6, P.roofT, 0, 13.8, 0).box(0.1, 1.6, 0.1, P.gold, 0, 19.0, 0).ico(0.2, P.gold, 0, 19.9, 0, 1, 1, 1, 0, 0);
  },
  lighthouse(g) {
    pFoundation(g, 4.2, 4.2, P.stoneD);
    for (let i = 0; i < 6; i++) g.cyl(1.7 - i * 0.12, 1.82 - i * 0.12, 1.6, 10, i % 2 ? P.red : P.white, 0, 0.4 + i * 1.6, 0);
    g.cyl(1.5, 1.5, 0.25, 10, P.metalD, 0, 10, 0).glowBox(1.4, 1.3, 1.4, 0xfff1b8, 0, 10.9, 0);
    g.light(0, 10.9, 0);
    g.cone(1.3, 1.4, 10, P.red, 0, 11.6, 0);
    pDoor(g, 0, 0.4, 1.8);
  },
  palace(g) {
    pBody(g, { z: -1.0, w: 11.0, d: 8.0, h: 7.4, floors: 2, wall: P.stoneL, roof: P.roofB, roofH: 3.8, hip: true, timber: false, winFront: 4, winSide: 3, winBack: 4, door: false, chimney: false, shutters: false, base: P.stoneD, winH: 1.3 });
    pDoor(g, 0, 0.4, 3.04, 0, { w: 2.0, h: 3.2, col: 0x5a3a22 });
    for (const x of [-7.6, 7.6]) {
      g.cyl(2.2, 2.4, 11.0, 10, P.stoneL, x, 0, -1.2).cyl(2.5, 2.5, 0.8, 10, P.stone, x, 11.0, -1.2).cone(2.6, 5.0, 10, P.roofB, x, 11.8, -1.2).cone(0.3, 1.2, 6, P.gold, x, 16.6, -1.2);
      for (let k = 0; k < 3; k++) g.win(0.6, 1.1, 0.1, x, 3 + k * 3, 1.18);
      g.box(0.08, 1.8, 0.08, P.metalD, x, 18.6, -1.2).box(1.2, 0.7, 0.04, P.red, x + 0.64, 19.2, -1.2);
    }
    g.boxB(4.4, 9.8, 3.6, P.stoneL, 0, 0.4, -1.4).pyr(5.0, 4.2, 3.6, P.roofB, 0, 10.2, -1.4).cone(0.3, 1.4, 6, P.gold, 0, 13.6, -1.4);
    for (let i = 0; i < 4; i++) g.boxB(6.0 - i * 0.6, 0.25, 1.0, P.stoneL, 0, 0.1 + i * 0.1, 3.9 + (3 - i) * 0.9 - 2.4);
    for (const x of [-3.5, 3.5]) { g.box(1.0, 2.6, 0.06, P.red, x, 5.0, 3.06); g.box(1.0, 0.25, 0.08, P.gold, x, 3.8, 3.07); }
    g.cylC(0.7, 0.7, 0.1, 12, P.gold, 0, 8.4, 0.44, Math.PI / 2, 0, 0);
    for (const x of [-5, 5]) pLamp(g, x, 2.8, 3.1), g.boxB(0.14, 2.5, 0.14, P.metalD, x, 0.4, 3.1);
  },
  dirt_road(g) {
    g.box(4.0, 1.4, 4.0, 0xa98458, 0, -0.64, 0);
    g.boxB(3.9, 0.02, 3.9, 0xb89363, 0, 0.06, 0);
    for (let i = 0; i < 5; i++) g.dodec(0.12, 0x8f8c84, -1.4 + i * 0.7, 0.1, Math.sin(i * 2.3) * 1.3, 1, 0.5, 1, 0.2);
  },
  stone_road(g) {
    g.box(4.0, 1.4, 4.0, P.stoneD, 0, -0.64, 0);
    for (let i = 0; i < 16; i++) { const x = -1.5 + (i % 4), z = -1.5 + Math.floor(i / 4); g.boxB(0.92, 0.1, 0.92, [P.cobble, P.stoneL, P.stone][(i * 7) % 3], x + (Math.floor(i / 4) % 2) * 0.1, 0.02, z); }
  },
};

/* spinning parts (windmill sails) */
const SPIN_FNS = {
  windmill: {
    pivot: [0, 5.4, 2.15], speed: 0.9,
    build(g) {
      for (let k = 0; k < 4; k++) {
        g.push(0, 0, 0, 0);
        const a = (k * Math.PI) / 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        g.box(0.18, 4.4, 0.12, P.beam, -sa * 2.2, ca * 2.2, 0, 0, 0, a);
        g.box(0.9, 3.6, 0.05, P.white, -sa * 2.4 + ca * 0.5, ca * 2.4 + sa * 0.5, 0.02, 0, 0, a);
        g.pop();
      }
      g.cylC(0.35, 0.35, 0.3, 8, P.beam, 0, 0, 0, Math.PI / 2, 0, 0);
    },
  },
};

/* work spots (local x, z, facing yaw, action) and door placement */
const MODEL_META = {
  woodcutter: { work: [[-1.6, 2.75, Math.PI, 1]] },
  stonecutter: { work: [[1.5, 2.6, Math.PI, 1]] },
  farm: { work: [[2.0, -2.4, 0, 4], [-2.2, 2.4, 0, 4]] },
  large_farm: { work: [[-4, 3.2, 0, 4], [3, 3.2, 0, 4], [-2, 2.0, Math.PI, 4], [6.5, -0.8, 0, 4]] },
  fisher_hut: { work: [[0.8, 4.0, 0, 5]], doorBack: true },
  blacksmith: { work: [[0.8, 1.9, Math.PI, 4]] },
  general_store: { work: [[0, 2.9, 0, 5]] },
  market_stall: { work: [[0, -0.2, 0, 5]] },
  marketplace: { work: [[-3.6, -3.6, 0, 5], [3.6, -3.6, 0, 5], [-3.6, 3.2, Math.PI, 5]] },
  large_market: { work: [[-5.2, -3.4, 0, 5], [0, -3.4, 0, 5], [5.2, -3.4, 0, 5], [0, 3.4, Math.PI, 5]] },
  workshop: { work: [[1.8, 3.4, Math.PI, 4], [-2.0, 3.8, Math.PI, 4]] },
  guard_tower: { work: [[1.8, 3.2, 0, 0], [-1.8, 3.2, 0, 0]] },
  harbor: { work: [[-3, 4.8, 0, 5], [0, 5.5, 0, 5], [3, 4.8, 0, 4]], doorBack: true },
  stable: { work: [[0.2, 2.6, 0, 4]] },
  lighthouse: {},
};

const Models = {
  cache: {},
  get(type) {
    if (this.cache[type]) return this.cache[type];
    const g = new GB();
    MODEL_FNS[type](g);
    const b = g.build();
    const cfg = BUILDINGS[type];
    b.size = cfg.size;
    b.meta = MODEL_META[type] || {};
    if (SPIN_FNS[type]) { const sg = new GB(); SPIN_FNS[type].build(sg); b.spin = { geo: sg.build().main, pivot: SPIN_FNS[type].pivot, speed: SPIN_FNS[type].speed }; }
    b.height = b.main.boundingBox.max.y;
    this.cache[type] = b;
    return b;
  },
};
