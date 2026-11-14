// Verlaten dorp Valdris: abandoned houses of the vanished civilisation around a central square (pad 'village').
import * as THREE from 'three';
import { getPad } from '../layout.js';
import { roomWalls, gableRoof, floorSlab, ivy, wall } from './arch.js';
import * as P from './props.js';
import { makeObject } from './core.js';
import { placeBeacon } from './beacons.js';

const TAU = Math.PI * 2;

const HOUSES = [
  // x, z relative to the village centre; w along the facade, d depth
  { id: 'elder', x: 0, z: -27, w: 9.2, d: 7.2, elder: true },
  { id: 'h1', x: -25, z: -18, w: 6.2, d: 5.0, roof: 'tile', collapse: [[-1.5, 1.6]], kind: 'dwelling', ivy: true },
  { id: 'h2', x: 26, z: -19, w: 6.6, d: 5.2, roof: 'shingle', kind: 'dwelling', cloth: 'cloth_s4' },
  { id: 'h3', x: 36, z: -2, w: 5.6, d: 5.0, roof: 'slate', kind: 'storage' },
  { id: 'h4', x: 27, z: 19, w: 6.2, d: 5.0, roof: 'tile', kind: 'dwelling', note: true, cloth: 'cloth_s3' },
  { id: 'h5', x: 4, z: 31, w: 7.2, d: 5.6, roof: 'tile', kind: 'bedroom', ivy: true },
  { id: 'h6', x: -23, z: 24, w: 5.6, d: 5.0, roof: 'shingle', collapse: [[-2.2, 0.6]], kind: 'storage' },
  { id: 'h7', x: -35, z: -4, w: 5.0, d: 4.6, roof: 'tile', kind: 'dwelling' },
  { id: 'h8', x: -12, z: -42, w: 5.6, d: 4.8, roof: 'slate', kind: 'bedroom', ruin: true },
  { id: 'h9', x: 43, z: 15, w: 5.2, d: 4.6, roof: 'shingle', kind: 'storage', ruin: true },
  { id: 'h10', x: 47, z: -24, w: 5.0, d: 4.6, roof: 'tile', kind: 'dwelling', collapse: [[-1.6, 2.5]], ruin: true },
];

export function buildVillage(S) {
  const pad = getPad('village');
  const b = S.builder('village', 21);
  const R = b.rand;
  const oy = pad.y;
  const world = (lx, lz) => [pad.x + lx, pad.z + lz];

  b.at(pad.x, oy, pad.z, 0, () => {
    // ----------------------------------------------------------------- central square
    b.cyl('cobble', 0, 0.0, 0, 11.5, 11.8, 0.12, 28, { tile: 3, tint: [0.95, 0.95, 0.9] });
    for (let i = 0; i < 26; i++) { // irregular cobbled edge + weeds
      const a = (i / 26) * TAU + R() * 0.2, r = 11.2 + R() * 0.8;
      b.geo('stone', new THREE.DodecahedronGeometry(0.28 + R() * 0.2, 0), Math.cos(a) * r, 0.02, Math.sin(a) * r, { sy: 0.45, ry: R() * 3, uv: [0.3, 0.3], tint: [0.8, 0.8, 0.76] });
    }
    P.well(b, 0, 0, { y: 0.06 });
    // market stalls (overgrown)
    const stalls = [[0.9, 8.4, -0.0], [2.45, 8.0, 0], [3.9, 7.8, 0], [5.4, 8.2, 0]];
    stalls.forEach(([ang, r], i) => {
      const a = ang + 0.2, sx = Math.cos(a) * r, sz = Math.sin(a) * r;
      P.stall(b, sx, sz, Math.atan2(-sx, -sz), { y: 0.06, cloth: [[0.72, 0.42, 0.32], [0.45, 0.55, 0.62], [0.62, 0.58, 0.4], [0.65, 0.35, 0.3]][i] });
    });
    b.clutter = true;
    for (const [sx, sz] of [[5, 6.6], [-5.5, 6.2], [-3, -8.8], [8.6, -3.4], [-8.9, -1.2]]) ivy(b, sx, 1.2, sz, 1.6, 1.8, { ry: R() * 6 });
    b.clutter = false;
    P.cart(b, -7.5, 11.2, 0.4, { load: true }); P.cart(b, 12.5, -6.5, -0.7);
    for (const [bx, bz] of [[-6, 4.4], [-6.7, 5.2], [7.1, -5.2], [6.3, -6.1], [-1.5, -8.8]]) P.barrel(b, bx, bz, { y: 0.06, tint: [0.8 + R() * 0.2, 0.8, 0.75] });
    P.sack(b, -5.4, 6.2, { y: 0.06 }); P.sack(b, 6.9, -6.7, { y: 0.06, tint: [0.7, 0.75, 0.6] });
    P.woodPile(b, 14.5, 4, 0.6, { y: 0.06 });

    // ----------------------------------------------------------------- shrine (sun motifs)
    b.at(-16, 0, -9, Math.atan2(16, 9), () => {
      b.box('temple', 0, 0.12, 0, 3.0, 0.24, 3.0, { c: { surface: 'stone' } });
      b.box('temple', 0, 0.36, 0, 2.5, 0.24, 2.5, { c: { surface: 'stone' } });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('templeCarved', sx * 1.0, 1.55, sz * 0.85, 0.34, 2.4, 0.34, { tint: [0.95, 0.95, 0.9], c: { surface: 'stone' } });
      b.box('temple', 0, 2.85, 0, 2.5, 0.22, 2.1, { tint: [0.9, 0.9, 0.85] });
      b.box('temple', 0, 3.1, 0, 1.8, 0.3, 1.5, { tint: [0.9, 0.95, 0.85] });
      b.box('temple', 0, 1.0, -0.7, 1.7, 1.5, 0.3, { c: { surface: 'stone' }, tint: [0.9, 0.9, 0.85] });
      b.quad('sunRelief', 0, 1.35, -0.545, 1.1, 1.1, { j: 0, uv: [1, 1] });
      b.box('temple', 0, 0.78, 0.2, 0.9, 0.5, 0.6, { c: { surface: 'stone' } });
      b.cyl('rust', -0.2, 1.05, 0.2, 0.18, 0.1, 0.07, 10, { tint: [0.7, 0.6, 0.45] });
      b.cyl('woodDark', 0.25, 1.1, 0.2, 0.025, 0.025, 0.15, 6, { tint: [1, 0.9, 0.7] });
      b.clutter = true;
      ivy(b, 1.0, 1.6, 0.9, 1.0, 2.0, { ry: 0 }); ivy(b, -1.05, 1.6, -0.5, 1.0, 2.0, { ry: 0.3 });
      for (let i = 0; i < 6; i++) b.cyl('wood', (R() - 0.5) * 2, 0.5, 1.6 + R() * 0.5, 0.03, 0.03, 0.08, 5, { tint: [1, 0.9, 0.5] });
      b.clutter = false;
    });

    // ----------------------------------------------------------------- workshop / blacksmith (open shed)
    b.at(20, 0.05, 9, Math.atan2(-20, -9), () => {
      const w = 6.4, d = 4.6;
      wall(b, -w / 2, -d / 2, w / 2, -d / 2, { h: 2.7, t: 0.4, y: -0.05, layers: [{ mat: 'stone', tint: [0.85, 0.82, 0.78] }] });
      wall(b, -w / 2, -d / 2, -w / 2, d / 2 - 1.2, { h: 2.7, t: 0.4, y: -0.05, layers: [{ to: 1.0, mat: 'stone' }, { mat: 'wood', tint: [0.7, 0.62, 0.55] }] });
      wall(b, w / 2, -d / 2, w / 2, d / 2 - 1.2, { h: 2.7, t: 0.4, y: -0.05, layers: [{ to: 1.0, mat: 'stone' }, { mat: 'wood', tint: [0.7, 0.62, 0.55] }] });
      floorSlab(b, 0, 0, w, d, 0, 'cobble', 'stone', { tint: [0.7, 0.68, 0.64] });
      for (const sx of [-1, 1]) b.box('woodDark', sx * (w / 2 - 0.1), 1.3, d / 2 - 0.1, 0.22, 2.7, 0.22, { c: { surface: 'wood' } });
      b.box('woodDark', 0, 2.78, d / 2 - 0.1, w, 0.24, 0.22);
      b.at(0, 0, 0, 0, () => {
        for (const s of [-1, 1]) {
          b.box('shingle', 0, 3.25 + 0.0, s * (d / 4 + 0.12), w + 0.8, 0.1, d / 2 + 0.7, { rx: s * 0.42, tint: [0.85, 0.8, 0.75] });
        }
        b.box('shingle', 0, 3.72, 0, w + 0.9, 0.12, 0.3, { tint: [0.7, 0.68, 0.64] });
      });
      b.geo('stone', new THREE.BoxGeometry(1.8, 0.9, 1.4), -w / 2 + 1.2, 0.45, -d / 2 + 1.0, { tint: [0.85, 0.8, 0.75], uv: [0.5, 0.5], cc: { surface: 'stone' }, cr: 1.1, ch: 1 });
      b.box('stone', -w / 2 + 1.2, 1.9, -d / 2 + 0.7, 1.0, 2.0, 0.8, { c: { surface: 'stone' } });
      b.box('black', -w / 2 + 1.2, 0.98, -d / 2 + 1.0, 1.2, 0.08, 0.9); b.box('ember', -w / 2 + 1.2, 1.03, -d / 2 + 1.05, 0.6, 0.02, 0.4, { tint: [0.4, 0.2, 0.1] });
      b.box('woodDark', -w / 2 + 0.7, 0.5, -d / 2 + 2.0, 0.6, 0.35, 0.25, { rx: 0.2 });
      P.anvil(b, 0.6, -0.4, 0.3);
      P.table(b, w / 2 - 1.0, -d / 2 + 0.9, 0, { w: 1.7, d: 0.7 });
      b.clutter = true;
      for (let i = 0; i < 6; i++) b.box('steel', w / 2 - 1.5 + i * 0.22, 0.88, -d / 2 + 0.9 + (R() - 0.5) * 0.3, 0.04, 0.04, 0.35, { ry: R() * 3 });
      for (let i = 0; i < 7; i++) b.box('rust', 2.5 + (R() - 0.5) * 1.2, 0.05, 2.3 + (R() - 0.5) * 1.2, 0.5 + R() * 0.4, 0.04, 0.25 + R() * 0.3, { ry: R() * 3, tile: 1 });
      b.clutter = false;
      P.barrel(b, -w / 2 + 0.6, d / 2 - 0.4, { mat: 'rust' }); P.barrel(b, -w / 2 + 1.35, d / 2 - 0.35);
      b.cyl('stone', 1.9, 0.5, -1.0, 0.45, 0.45, 0.2, 12, { rz: Math.PI / 2, cc: { surface: 'stone' }, cr: 0.5 }); b.box('woodDark', 1.9, 0.4, -1.0, 0.9, 0.08, 0.6);
      b.clutter = true; ivy(b, w / 2 + 0.25, 1.6, -0.6, 1.4, 2.0, { ry: Math.PI / 2 }); b.clutter = false;
      S.anchor('village.scrap1', b.wp(2.6, 0.12, 2.4));
      S.anchor('village.scrap2', b.wp(-1.9, 0.12, 0.9));
      S.resource('scrap_s2', 'scrap', b.wp(0.2, 0.15, 3.0));
      S.zone('village.workshop', b.wp(0, 0, 0).x, b.wp(0, 0, 0).z, w / 2, d / 2, b.yaw, oy - 1, oy + 3.4, 0.15);
    });

    // houses
    for (const spec of HOUSES) house(S, b, spec, R, oy);

    // ----------------------------------------------------------------- scattered fences, wood piles, barrels, carts
    P.fence(b, -10, -34, -2.5, -34.5, { h: 1.1, decay: 0.12 }); P.fence(b, 6, -33, 14, -33, { h: 1.1, decay: 0.12 });
    P.fence(b, 22, 4, 22, 16, { h: 1.1, holeAt: 2 }); P.fence(b, -33, 14, -22, 18, { h: 1.1 });
    P.fence(b, 10, 26, 18, 30, { h: 1.1, decay: 0.15 });
    P.woodPile(b, 30.5, -9, 1.0); P.woodPile(b, -28, -9, 0.2, { rows: 3, cols: 5 }); P.woodPile(b, 12, 33, 0.1);
    P.barrel(b, 31.5, -14); P.barrel(b, 32.3, -13.6); P.crate(b, 22.8, 6.5, 0.3); P.crate(b, 15, -16, 0.1);
    P.cart(b, 22, 30, 0.8, { load: false }); P.bucket(b, -13, 3);
    P.sack(b, -20, 13.5); P.crate(b, -29, -13, 0.4, { w: 0.7, d: 0.7, h: 0.6 });
    // standing stones near the entrance road & overgrowth
    for (let i = 0; i < 4; i++) {
      const a = 2.2 + i * 0.35, r = 46;
      b.geo('stone', new THREE.BoxGeometry(0.7, 2.2 + R(), 0.5), Math.cos(a) * r - 14 * 0, 1.1, Math.sin(a) * r, { ry: R() * 3, rz: (R() - 0.5) * 0.2, tint: [0.8, 0.82, 0.78], uv: [0.4, 0.4], cc: { surface: 'stone' }, cr: 0.5, ch: 2.2 });
    }
  });

  placeBeacon(S, 'village.beacon', pad.x - 32.2, oy + 0.2, pad.z + 7.0, -0.8, 0.6, 2);
  S.commit(b);
}

// ------------------------------------------------------------------------------------------------

function house(S, b, o, R, oy) {
  const { x, z, w, d } = o;
  const elder = !!o.elder;
  const H = elder ? 3.2 : 2.9, T = elder ? 0.4 : 0.32;
  const yaw = Math.atan2(-x, -z) + (o.yawOff ?? 0);
  const rise = (d / 2) * (elder ? 1.05 : 1.2);
  const roofMat = o.roof ?? 'tile';
  const stoneTint = elder ? [0.95, 0.92, 0.86] : [0.8 + R() * 0.2, 0.8 + R() * 0.12, 0.76];
  const walls = [{ to: elder ? 1.5 : 1.15, mat: 'stone', tint: stoneTint }, { mat: 'timber', tint: elder ? [1, 0.96, 0.9] : [0.9 + R() * 0.12, 0.88 + R() * 0.1, 0.85] }];
  const win = (at, sh) => ({ at, w: 0.95, h: 1.05, sill: 1.2, kind: 'window', frame: 'woodDark', shutter: sh });
  const sh = () => (R() < 0.5 ? 'broken' : 'open');
  const door = { at: 0, w: elder ? 1.6 : 1.4, h: 2.35, kind: 'door', frame: 'woodDark' };
  const fx = elder ? 3.4 : w / 2 - 1.2;
  const sides = {
    s: [door, win(-fx, sh()), win(fx, sh())].concat(elder ? [win(-1.9, sh()), win(1.9, sh())].filter(() => false) : []),
    n: [win(-w / 4, sh()), win(w / 4, sh())],
    e: [win(0, sh())],
    w: [win(R() < 0.5 ? 0 : 0.4, sh())],
  };
  if (o.ruin) sides.n = [];

  b.at(x, 0.05, z, yaw, () => {
    roomWalls(b, { w, d, h: H, t: T, y: -0.05, layers: walls, sides });
    // corner quoins / timber posts
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box('stone', sx * (w / 2 + 0.03), 0.8, sz * (d / 2 + 0.03), T + 0.12, 1.7, T + 0.12, { tint: [0.95, 0.95, 0.9] });
      b.box('woodDark', sx * (w / 2 + 0.03), H / 2 + 0.85, sz * (d / 2 + 0.03), 0.18, H - 1.7, 0.18);
    }
    floorSlab(b, 0, 0, w - 0.1, d - 0.1, 0, 'wood', 'wood', { tint: [0.7, 0.66, 0.62] });
    // step + threshold
    b.box('stone', 0, -0.05, d / 2 + 0.55, 1.9, 0.2, 0.9, { c: { surface: 'stone', yMin: -0.4, yMax: 0.0 }, tint: [0.85, 0.85, 0.8] });
    // roof
    const gaps = o.collapse;
    gableRoof(b, { w, d, y: H - 0.05, rise, mat: roofMat, wallMat: 'timber', ridgeX: true, gaps, over: 0.5, tint: roofMat === 'tile' ? [0.95, 0.92, 0.9] : undefined, wallTint: [0.95, 0.92, 0.88] });
    // tie beams and ridge purlin
    for (let i = -1; i <= 1; i++) b.box('woodDark', i * (w / 3), H - 0.15, 0, 0.16, 0.2, d - 0.1);
    b.box('woodDark', 0, H + rise - 0.3, 0, w - 0.1, 0.16, 0.16);
    for (const sx of [-1, 1]) b.box('woodDark', sx * (w / 3), H + rise * 0.5, 0, 0.12, rise, 0.12);
    // chimney
    if (!elder && R() < 0.7) {
      b.box('stone', w / 2 - 1.2, H + rise * 0.6, -d / 2 + 0.3, 0.8, rise + 1.4, 0.7, { tint: [0.8, 0.78, 0.74] });
      b.box('stone', w / 2 - 1.2, H + rise + 1.45, -d / 2 + 0.3, 1.0, 0.18, 0.9, { tint: [0.7, 0.7, 0.68] });
    }
    // door leaf (hanging ajar / fallen) unless boarded
    if (!elder) {
      if (R() < 0.7) b.at(-0.7, 0, d / 2, 1.1 + R() * 0.5, () => { b.box('wood', 0.62, 1.1, 0, 1.25, 2.2, 0.06, { tint: [0.7, 0.62, 0.55] }); b.box('woodDark', 0.62, 0.5, 0.04, 1.2, 0.08, 0.03); b.box('woodDark', 0.62, 1.6, 0.04, 1.2, 0.08, 0.03); });
    }
    // damage: debris below collapsed sections
    if (gaps) for (const [g0, g1] of gaps) {
      b.clutter = true;
      for (let i = 0; i < 5; i++) b.box(i % 2 ? 'tile' : 'wood', (g0 + g1) / 2 + (R() - 0.5) * (g1 - g0 + 0.5), 0.1 + R() * 0.15, (R() - 0.5) * (d - 1.2), 0.9 + R(), 0.08, 0.2 + R() * 0.2, { ry: R() * 3, rz: (R() - 0.5) * 0.5, tint: [0.8, 0.8, 0.8], tile: 1 });
      b.box('woodDark', (g0 + g1) / 2, 1.0, d / 4, 0.14, 0.14, 2.8, { rx: 0.9, ry: 0.3, tint: [0.7, 0.7, 0.7] });
      b.clutter = false;
    }
    if (o.ivy || o.ruin) {
      b.clutter = true;
      ivy(b, w / 4, 1.6, d / 2 + T / 2 + 0.05, 2.2, 2.4, {});
      ivy(b, -w / 2 - T / 2 - 0.05, 1.7, -d / 6, 2.4, 2.4, { ry: -Math.PI / 2 });
      b.clutter = false;
    }
    // exterior: barrels and bits by the door
    if (R() < 0.6) P.barrel(b, w / 2 - 0.5, d / 2 + 0.9, {});
    if (R() < 0.5) P.crate(b, -w / 2 + 0.6, d / 2 + 0.8, R(), { w: 0.7, d: 0.7, h: 0.6 });

    // ------------- elder specifics
    if (elder) elderExtras(S, b, o, R, oy, H, T, rise);
    // ------------- interior
    const inter = { onTable: null };
    if (elder) furnishElder(S, b, w, d, R, oy);
    else furnish(S, b, o, R, oy);

    // interior zone
    const c = b.wp(0, 0, 0);
    S.zone('village.' + o.id, c.x, c.z, w / 2 + 0.05, d / 2 + 0.05, b.yaw, oy - 1, oy + H + rise * 0.7, elder ? 0.35 : 0.3);
    void inter;
  });
}

function furnish(S, b, o, R, oy) {
  const { w, d } = o;
  const hw = w / 2 - 0.45, hd = d / 2 - 0.45;
  const kind = o.kind ?? 'dwelling';
  if (kind === 'dwelling' || kind === 'bedroom') {
    if (kind === 'dwelling') P.hearth(b, 0, -d / 2 + 0.42, 0);
    P.bed(b, -hw + 0.1, -hd + 0.9, 0, { tint: [0.6 + R() * 0.2, 0.55, 0.45], blanket: [0.45 + R() * 0.2, 0.35, 0.3] });
    if (o.cloth) S.resource(o.cloth, 'cloth', b.wp(-hw + 0.1, 0.62, -hd + 1.1));
    if (kind === 'bedroom') P.bed(b, hw - 0.1, -hd + 0.9, 0, { tint: [0.55, 0.6, 0.5] });
    P.table(b, w / 6, 0.5, 0.2, { w: 1.4, d: 0.8 });
    P.chair(b, w / 6 - 0.2, -0.45, Math.PI + 0.2); P.chair(b, w / 6 + 0.1, 1.5, 0.4); P.stool(b, w / 6 + 1.1, 0.4);
    b.clutter = true; b.cyl('rust', w / 6 + 0.2, 0.84, 0.4, 0.07, 0.06, 0.08, 8, { tint: [0.9, 0.85, 0.8] }); b.cyl('woodDark', w / 6 - 0.3, 0.8, 0.6, 0.12, 0.12, 0.02, 8); b.clutter = false;
    if (o.note) { const p = b.wp(w / 6 - 0.45, 0.82, 0.3); S.anchor('note.village_house', p); b.box('paper', w / 6 - 0.45, 0.8, 0.3, 0.22, 0.01, 0.3, { ry: 0.3, tile: 0.3 }); }
    P.shelf(b, hw + 0.15, -0.9, -Math.PI / 2, { w: 1.3, n: 4 });
    P.crate(b, hw - 0.1, hd - 0.6, 0.3, { w: 0.8, d: 0.8, h: 0.6 });
    P.barrel(b, -hw + 0.1, hd - 0.2);
  } else {
    P.shelf(b, 0, -d / 2 + 0.3, 0, { w: Math.min(2.4, w - 1.6), n: 5 });
    P.shelf(b, hw + 0.15, 0.6, -Math.PI / 2, { w: 1.5, n: 4 });
    P.crate(b, -hw + 0.1, -hd + 0.4, 0.2); P.crate(b, -hw + 0.1, -hd + 1.3, -0.1, { w: 0.7, d: 0.7, h: 0.6 });
    P.crate(b, -hw + 0.2, 0.2, 0.4, { w: 0.9, d: 0.8, h: 0.7 }); P.crate(b, -hw + 0.2, 0.2, 0.7, { w: 0.6, d: 0.6, h: 0.5, y: 0.7 });
    P.barrel(b, hw - 0.1, hd - 0.2); P.barrel(b, hw - 0.9, hd - 0.1); P.sack(b, -hw + 0.4, hd - 0.4); P.sack(b, -hw + 1.1, hd - 0.2);
    P.table(b, w / 6, 0.3, 0.0, { w: 1.2, d: 0.7 });
  }
  P.papers(b, 0, 0.4, 0.05, 3, 2);
  // cobwebs / dirt
  b.clutter = true;
  for (let i = 0; i < 3; i++) b.box('woodDark', (R() - 0.5) * (w - 1.5), 0.1, (R() - 0.5) * (d - 1.5), 0.4 + R() * 0.5, 0.04, 0.1, { ry: R() * 3, tint: [0.7, 0.7, 0.7] });
  b.clutter = false;
}

function elderExtras(S, b, o, R, oy, H, T, rise) {
  const { w, d } = o;
  // porch: carved posts, roof, stone floor
  const pz = d / 2 + 1.5;
  b.box('stone', 0, -0.05, pz, 4.4, 0.24, 2.4, { c: { surface: 'stone', yMin: -0.4, yMax: 0.07 }, tint: [0.95, 0.92, 0.88] });
  for (const sx of [-1, 1]) {
    b.box('templeCarved', sx * 1.95, 1.6, pz + 0.9, 0.38, 3.0, 0.38, { c: { surface: 'wood' }, tint: [0.95, 0.9, 0.85] });
    b.box('stone', sx * 1.95, 0.15, pz + 0.9, 0.62, 0.3, 0.62); b.box('stone', sx * 1.95, 3.15, pz + 0.9, 0.62, 0.22, 0.62);
  }
  b.box('woodDark', 0, 3.3, pz + 0.9, 4.6, 0.3, 0.4);
  b.box('tile', 0, 3.8, pz + 0.2, 5.0, 0.12, 2.8, { rx: 0.26, tint: [0.95, 0.92, 0.9] });
  b.box('woodDark', 0, 3.5, pz + 0.5, 4.2, 0.12, 0.14, { rx: 0.26 });
  // sun emblem above the door
  b.quad('sunRelief', 0, H - 0.2 + 0.5, d / 2 + T / 2 + 0.06, 1.4, 1.4, { j: 0, uv: [1, 1] });
  // second chimney, dormer
  b.box('stone', -w / 2 + 1.4, H + rise * 0.55, -d / 2 + 0.4, 1.0, rise + 1.6, 0.9, { tint: [0.85, 0.82, 0.78] });
  b.box('stone', -w / 2 + 1.4, H + rise + 1.65, -d / 2 + 0.4, 1.3, 0.2, 1.1);
  b.box('woodDark', w / 2 - 0.1, H + rise + 0.9, 0, 0.1, 2.2, 0.1);
  b.box('cloth', w / 2 - 0.1, H + rise + 1.4, 0.0, 0.03, 0.55, 0.9, { tint: [0.75, 0.3, 0.2], tile: 1.2 });
  b.clutter = true;
  ivy(b, -w / 2 + 1.5, 2.0, d / 2 + T / 2 + 0.05, 2.2, 3.0, {}); ivy(b, w / 2 + T / 2 + 0.05, 1.8, 0, 3.0, 2.6, { ry: Math.PI / 2 });
  b.clutter = false;
  // boarded door (separate object so gameplay can hide it) + blocking collider
  const rand = S.rand(333);
  const boards = makeObject(S.lib, rand, 'village.elderDoor', (bb) => {
    const defs = [[0.1, 0.12], [0.55, -0.1], [1.0, 0.16], [1.45, -0.12], [1.9, 0.09]];
    defs.forEach(([y, a], i) => {
      bb.box('wood', (rand() - 0.5) * 0.1, y + 0.12, 0, 1.95 + rand() * 0.1, 0.19, 0.05, { rz: a, tint: [0.85 + i * 0.03, 0.8, 0.75], tile: 1 });
      for (const nx of [-0.7, 0.7]) bb.cyl('steel', nx, y + 0.12 + nx * Math.tan(a), 0.035, 0.018, 0.018, 0.04, 5, { rx: Math.PI / 2 });
    });
    bb.box('woodDark', -0.75, 1.1, -0.01, 0.12, 2.3, 0.04, { rz: 0.04 });
  });
  const p = b.wp(0, 0.0, d / 2 + T / 2 + 0.2);
  boards.position.set(p.x, p.y, p.z);
  boards.rotation.y = b.yaw;
  boards.userData.colliderId = 'village.elderDoor';
  boards.userData.openOffset = new THREE.Vector3(0, 0, 0);
  boards.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  S.root.add(boards);
  S.anchor('village.elderDoor', p, b.yaw, boards);
  const c = b.wp(0, 1.2, d / 2);
  S.box(c.x, c.z, 0.95, 0.35, b.yaw, p.y - 0.1, p.y + 2.6, { id: 'village.elderDoor', surface: 'wood' });
}

function furnishElder(S, b, w, d, R, oy) {
  const hw = w / 2 - 0.5, hd = d / 2 - 0.5;
  P.hearth(b, 0, -d / 2 + 0.42, 0);
  b.quad('sunRelief', 0, 2.2, -d / 2 + 0.17, 1.1, 1.1, { j: 0, uv: [1, 1] });
  // great table with the journal
  P.table(b, -1.6, 0.6, 0.0, { w: 2.5, d: 1.1 });
  P.chair(b, -2.4, -0.4, Math.PI); P.chair(b, -0.9, -0.4, Math.PI - 0.15); P.chair(b, -2.2, 1.65, 0.1); P.chair(b, -0.8, 1.7, -0.3); P.chair(b, -3.45, 0.6, Math.PI / 2 + 0.2);
  const jp = b.wp(-1.5, 0.82, 0.55);
  b.box('woodDark', -1.5, 0.815, 0.55, 0.3, 0.04, 0.4, { ry: 0.25, tint: [0.45, 0.28, 0.2], tile: 0.5 });
  b.box('paper', -1.5, 0.84, 0.55, 0.27, 0.02, 0.37, { ry: 0.25, tile: 0.3 });
  S.anchor('village.journal', [jp.x, jp.y + 0.04, jp.z]);
  P.papers(b, -0.8, 0.9, 0.79, 4, 0.8);
  b.clutter = true;
  b.cyl('rust', -2.3, 0.85, 0.3, 0.06, 0.05, 0.1, 8); b.cyl('lampOff', -0.6, 0.85, 0.5, 0.05, 0.06, 0.12, 8, { tint: [0.6, 0.5, 0.35] });
  b.clutter = false;
  // beds, shelves, chests
  P.bed(b, -hw + 0.1, -hd + 1.1, 0, { tint: [0.65, 0.58, 0.5], blanket: [0.5, 0.25, 0.2] });
  P.bed(b, -hw + 1.3, -hd + 1.1, 0, { tint: [0.6, 0.62, 0.55] });
  P.shelf(b, hw + 0.2, -1.4, -Math.PI / 2, { w: 1.6, n: 5 }); P.shelf(b, hw + 0.2, 1.1, -Math.PI / 2, { w: 1.4, n: 5 });
  b.at(hw - 0.3, 0, hd - 0.4, -0.15, () => {
    b.box('woodDark', 0, 0.3, 0, 1.1, 0.6, 0.6, { c: { surface: 'wood' }, tint: [0.7, 0.65, 0.6] }); b.box('steel', 0, 0.45, 0.31, 0.12, 0.1, 0.02); b.box('woodDark', 0, 0.66, -0.0, 1.15, 0.12, 0.65, { rx: -0.05 });
  });
  P.barrel(b, -hw + 0.3, hd - 0.3); P.barrel(b, -hw + 1.0, hd - 0.2); P.sack(b, -hw + 0.4, hd - 1.1);
  // rug and banner
  b.box('cloth', -1.6, 0.012, 0.7, 3.2, 0.015, 2.4, { tint: [0.55, 0.22, 0.18], tile: 1.5, c: undefined });
  b.box('cloth', -1.6, 0.02, 0.7, 2.4, 0.015, 1.6, { tint: [0.75, 0.6, 0.35], tile: 1.2 });
  b.box('cloth', hw - 0.6, 2.0, -d / 2 + 0.2, 0.9, 2.0, 0.03, { tint: [0.65, 0.25, 0.2], tile: 1.5 });
  b.quad('map', hw - 0.6, 1.8, -d / 2 + 0.17, 0.7, 0.7, { uv: [1, 1] });
  P.papers(b, 2.5, 1.5, 0.05, 6, 2.5);
  P.crate(b, hw - 0.2, -hd + 0.3, 0.1, { w: 0.8, d: 0.8, h: 0.7 });
  // hanging herbs
  b.clutter = true;
  for (let i = 0; i < 5; i++) b.cyl('ivy', -2.5 + i * 0.35, 2.55, -d / 2 + 1.2, 0.05, 0.12, 0.35, 5, { tint: [0.6, 0.7, 0.4] });
  b.clutter = false;
  void oy;
}
