// Bunker K-7: concrete bunker built into a hill (pad 'bunker'). Local frame: origin = pad centre at pad.y, +x = east (facade side).
import * as THREE from 'three';
import { getPad } from '../layout.js';
import { wall, floorSlab } from './arch.js';
import * as P from './props.js';
import { makeObject } from './core.js';
import { placeBeacon } from './beacons.js';

const TAU = Math.PI * 2;
const signRect = (i) => [0, 1 - (i + 1) / 8, 1, 1 - i / 8];
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const HMAX = 8.4;
function moundH(x, z) {
  const e = Math.sqrt(((x + 2) / 20) ** 2 + (z / 25) ** 2);
  const D = HMAX * Math.pow(Math.max(0, 1 - e * e), 0.7);
  const F = 1 - sm(4, 16, x) * sm(7, 12, Math.abs(z));
  const bump = Math.sin(x * 0.45 + 1.3) * Math.cos(z * 0.38) * 0.35;
  return Math.max(0, D * F + (D > 0.3 ? bump : 0));
}

export function buildBunker(S) {
  const pad = getPad('bunker');
  const b = S.builder('bunker', 41);
  const R = b.rand;
  const oy = pad.y, ox = pad.x, oz = pad.z;
  const wx = (lx) => ox + lx, wz = (lz) => oz + lz;
  const lampKey = 'bunkerLamp';
  S.M[lampKey] = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, emissive: 0xffe6b0, emissiveIntensity: 0, roughness: 0.4 });
  S.lib.tile[lampKey] = 1;
  const FH = moundH(9.2, 0) - 0.12; // facade height matches the hill
  const CH = 3.25; // wall height (floor 0.05 → ceiling)

  b.at(ox, oy, oz, 0, () => {
    b.at(0, 0.05, 0, 0, () => {
      const cw = { h: CH, t: 0.4, y: -0.05, layers: [{ mat: 'concrete' }], tint: [0.9, 0.9, 0.88] };
      // corridor
      wall(b, -3.2, -1.8, 7.8, -1.8, { ...cw, openings: [{ at: 0.8, w: 1.5, h: 2.35, kind: 'door', frame: 'steel' }] });
      wall(b, -3.2, 1.8, 7.8, 1.8, { ...cw, openings: [{ at: 0.8, w: 1.5, h: 2.35, kind: 'door', frame: 'steel' }] });
      // generator room (south) and bunk room (north)
      wall(b, 0.2, 1.8, 0.2, 12.2, cw); wall(b, 0.2, 12.2, 7.8, 12.2, cw);
      wall(b, 0.2, -12.2, 0.2, -1.8, cw); wall(b, 0.2, -12.2, 7.8, -12.2, cw);
      // control room (west) with inner door at x=-3.4
      wall(b, -3.4, -6.6, -3.4, 6.6, { ...cw, openings: [{ at: 0, w: 1.8, h: 2.5, kind: 'door', frame: 'steel' }] });
      wall(b, -14.2, -6.6, -14.2, 6.6, cw);
      wall(b, -14.2, -6.6, -3.4, -6.6, cw); wall(b, -14.2, 6.6, -3.4, 6.6, cw);
      // facade
      b.box('concrete', 8.5, FH / 2 - 0.05, -6.8, 1.4, FH, 11.2, { c: { surface: 'stone', yMin: -0.1, yMax: FH }, tint: [0.88, 0.88, 0.85], tile: 3 });
      b.box('concrete', 8.5, FH / 2 - 0.05, 6.8, 1.4, FH, 11.2, { c: { surface: 'stone', yMin: -0.1, yMax: FH }, tint: [0.88, 0.88, 0.85], tile: 3 });
      b.box('concrete', 8.5, 2.9 + (FH - 2.9) / 2 - 0.05, 0, 1.4, FH - 2.9, 2.4, { tint: [0.85, 0.85, 0.82] });
      for (const s of [-1, 1]) { b.box('steel', 9.25, 1.4, s * 1.28, 0.2, 2.9, 0.16, { tint: [0.75, 0.6, 0.5] }); }
      b.box('steel', 9.25, 2.92, 0, 0.3, 0.2, 2.8, { tint: [0.75, 0.6, 0.5] });
      b.box('concrete', 8.5, FH / 2 - 0.05, -12.0, 1.4, FH, 0.8, { tint: [0.8, 0.8, 0.78] });
      // door track rails on the facade
      b.box('steel', 9.5, 3.1, -2.4, 0.16, 0.14, 4.6, { tint: [0.6, 0.55, 0.5] }); b.box('steel', 9.5, 0.1, -2.4, 0.16, 0.12, 4.6, { tint: [0.6, 0.55, 0.5] });
      // retaining wings
      for (const s of [-1, 1]) {
        b.box('concrete', 11.0, 1.6, s * 12.4, 4.6, 3.3, 0.8, { c: { surface: 'stone', yMin: -0.1, yMax: 3.2 }, tint: [0.8, 0.82, 0.78] });
        b.box('concrete', 14.2, 0.9, s * 12.4, 2.2, 1.9, 0.8, { c: { surface: 'stone', yMin: -0.1, yMax: 1.8 }, tint: [0.78, 0.8, 0.76] });
      }
      // painted signs on the facade
      b.quad('signs', 9.22, 3.7, 0, 3.4, 0.43, { ry: Math.PI / 2, uvRect: signRect(3), j: 0 });
      b.quad('signs', 9.22, 2.0, 5.5, 2.6, 0.33, { ry: Math.PI / 2, uvRect: signRect(6), j: 0 });
      b.quad('signs', 9.22, 2.0, -5.5, 2.6, 0.33, { ry: Math.PI / 2, uvRect: signRect(7), j: 0 });
      // apron and steps
      b.box('concrete', 13.4, -0.07, 0, 8.4, 0.2, 9, { c: { surface: 'stone', yMin: -0.4, yMax: 0.04 }, tint: [0.8, 0.8, 0.78], tile: 3 });
      b.box('concrete', 17.5, -0.09, 0, 5, 0.2, 3.4, { tint: [0.7, 0.7, 0.66], tile: 3 });
      // exterior: sandbags, fence, watch post, drums
      P.sandbags(b, 11.5, 5.8, 0.15, 5, 3); P.sandbags(b, 11.5, -5.8, -0.15, 5, 3); P.sandbags(b, 15.2, 2.8, Math.PI / 2, 3, 2);
      P.fence(b, 18.5, -24, 18.5, 24, { kind: 'wire', h: 2.0, holeAt: 10, spacing: 3, decay: 0.12 });
      P.fence(b, 18.5, -24, 9.6, -24, { kind: 'wire', h: 2.0, spacing: 3 }); P.fence(b, 18.5, 24, 9.6, 24, { kind: 'wire', h: 2.0, spacing: 3 });
      b.quad('signs', 18.3, 1.5, 3.4, 2.0, 0.25, { ry: Math.PI / 2, uvRect: signRect(7), j: 0 });
      b.quad('signs', 18.3, 1.5, -3.4, 2.0, 0.25, { ry: Math.PI / 2, uvRect: signRect(6), j: 0 });
      b.at(15.5, 0, -15, -0.3, () => watchPost(b));
      for (let i = 0; i < 3; i++) P.drum(b, 13.5 + (i % 2) * 0.65, 8.6 + (i >> 1) * 0.65, { tint: [[0.7, 0.9, 0.6], [1, 0.7, 0.6], [0.6, 0.7, 1]][i] });
      P.crate(b, 14.5, -9.4, 0.3); P.crate(b, 13.6, -9.0, -0.2, { w: 0.7, d: 0.7, h: 0.6 });
      b.clutter = true;
      for (let i = 0; i < 7; i++) b.box('rust', 13 + R() * 3, 0.05, 6.5 + R() * 2.5, 0.5 + R() * 0.4, 0.04, 0.3 + R() * 0.3, { ry: R() * 3, tile: 1 });
      b.clutter = false;
      S.resource('scrap_s3', 'scrap', [wx(13.8), oy + 0.12, wz(7.3)]);
      S.resource('scrap_s4', 'scrap', [wx(16.2), oy + 0.12, wz(-12.0)]);
      lightFixtures(b, lampKey);
      interiorRooms(S, b, R, oy, wx, wz);
      // ceiling slab (roof)
      b.box('concrete', -3.2, 3.85, 0, 22, 1.2, 25.2, { tint: [0.65, 0.66, 0.62] });
    });

    // ----------------------------------------------------------------- earth mound
    mound(S, b, oy, ox, oz);
  });

  // ------------------------------------------------------------------ dynamic objects
  blastDoor(S, ox + 9.4, oy + 0.05, oz);
  reader(S, ox + 9.3, oy + 0.05 + 1.25, oz + 1.9);
  generator(S, ox + 5.6, oy + 0.05, oz + 9.2);
  terminal(S, ox - 13.15, oy + 0.05, oz);
  innerDoor(S, ox - 3.4, oy + 0.05, oz);
  placeBeacon(S, 'bunker.beacon', ox + 16.0, oy, oz - 4.0, 1, 0.4, 4);

  // zones (darkness 1.0 unpowered, 0.35 powered)
  const zs = [
    S.zone('bunker.corridor', ox + 2.2, oz, 5.6, 1.9, 0, oy - 1, oy + 3.4, 1.0),
    S.zone('bunker.generator', ox + 4, oz + 7, 3.9, 5.2, 0, oy - 1, oy + 3.4, 1.0),
    S.zone('bunker.bunkroom', ox + 4, oz - 7, 3.9, 5.2, 0, oy - 1, oy + 3.4, 1.0),
    S.zone('bunker.control', ox - 8.8, oz, 5.5, 6.8, 0, oy - 1, oy + 3.4, 1.0),
  ];
  // lights
  const lights = [[2.5, 0], [5.0, 7.0], [-8.5, 0]].map(([lx, lz]) => {
    const l = new THREE.PointLight(0xffe0ae, 0, 13, 2);
    l.position.set(ox + lx, oy + 2.7, oz + lz); l.visible = false; l.castShadow = false; S.root.add(l); return l;
  });
  S.setBunkerPower = (on) => {
    S.M[lampKey].emissiveIntensity = on ? 1.8 : 0;
    lights.forEach((l) => { l.visible = on; l.intensity = on ? 11 : 0; });
    zs.forEach((z) => { z.darkness = on ? 0.35 : 1.0; });
  };
  S.commit(b);
}

function mound(S, b, oy, ox, oz) {
  const x0 = -18, x1 = 16, z0 = -24, z1 = 24, st = 0.8;
  const nx = Math.round((x1 - x0) / st), nz = Math.round((z1 - z0) / st);
  const pos = [], uv = [], col = [], idx = [], keep = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const hAt = (x, z) => moundH(x, z);
  const cellOk = (i, j) => {
    const cx = x0 + (i + 0.5) * st, cz = z0 + (j + 0.5) * st;
    if (cx > 9.15 && Math.abs(cz) < 7.2) return false; // flush with facade
    return hAt(cx, cz) > 0.02 || hAt(cx - st, cz) > 0.02 || hAt(cx + st, cz) > 0.02 || hAt(cx, cz - st) > 0.02 || hAt(cx, cz + st) > 0.02;
  };
  const vid = (i, j) => {
    const k = j * (nx + 1) + i;
    if (keep[k] >= 0) return keep[k];
    const x = x0 + i * st, z = z0 + j * st, h = hAt(x, z);
    const tg = S.terrain.getHeightAt(ox + x, oz + z) - oy;
    let y = Math.max(h, tg) - (h < 0.4 ? 0.35 : 0);
    if (h < 0.02) y = tg - 0.4;
    pos.push(x, y, z); uv.push(x / 6, z / 6);
    const v = 0.85 + Math.sin(x * 1.7) * Math.cos(z * 1.3) * 0.12 + (b.rand() - 0.5) * 0.1, rock = sm(5, 8, h) * 0.25;
    col.push(v - rock * 0.2, v - rock * 0.05, v - rock * 0.35);
    return (keep[k] = pos.length / 3 - 1);
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!cellOk(i, j)) continue;
    const a = vid(i, j), c = vid(i + 1, j), d = vid(i, j + 1), e = vid(i + 1, j + 1);
    idx.push(a, d, c, c, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // add() overwrites the colour attribute; push directly into the earth bucket instead
  const mesh = new THREE.Mesh(g, S.M.earth);
  mesh.position.set(ox, oy, oz); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'bunker:mound';
  S.root.add(mesh);
  // rocks / boulders on the hill + bushes
  b.clutter = true;
  for (let i = 0; i < 16; i++) {
    const x = -16 + b.rand() * 24, z = (b.rand() - 0.5) * 40, h = moundH(x, z);
    if (h < 1 || (x > 6 && Math.abs(z) < 9)) continue;
    b.geo('stone', new THREE.DodecahedronGeometry(0.4 + b.rand() * 0.7, 0), x, h - 0.15, z, { sy: 0.7, ry: b.rand() * 3, uv: [0.4, 0.4], tint: [0.7, 0.75, 0.7] });
  }
  b.clutter = false;
  // vent chimneys on top of the hill
  for (const [vx, vz] of [[-6, -5], [-9, 7]]) { const h = moundH(vx, vz); b.box('concrete', vx, h + 0.4, vz, 1.0, 1.4, 1.0, { tint: [0.75, 0.75, 0.72] }); b.box('steel', vx, h + 1.15, vz, 1.2, 0.12, 1.2); }
  // colliders: the hill itself (rim strips) so nobody walks into it
  const strip = (x, z, hx, hz) => S.box(ox + x, oz + z, hx, hz, 0, oy - 0.2, oy + 1.8, { surface: 'dirt' });
  strip(-16.0, 0, 1.4, 21); strip(-3, 18.2, 12.4, 3.8); strip(-3, -18.2, 12.4, 3.8);
  strip(12.0, 18.0, 5.0, 3.0); strip(12.0, -18.0, 5.0, 3.0);
  strip(2.3, 14.2, 7.0, 1.7); strip(2.3, -14.2, 7.0, 1.7);
}

function watchPost(b) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('woodDark', sx * 1.0, 1.6, sz * 1.0, 0.2, 3.3, 0.2, { c: { surface: 'wood' } });
  b.box('wood', 0, 3.1, 0, 2.5, 0.12, 2.5, { c: { surface: 'wood', yMin: 2.9, yMax: 3.16 } });
  for (const [x, z, w, d] of [[0, 1.2, 2.5, 0.08], [0, -1.2, 2.5, 0.08], [1.2, 0, 0.08, 2.5]]) b.box('wood', x, 3.65, z, w, 0.9, d, { tint: [0.75, 0.7, 0.65] });
  for (const sx of [-1, 1]) b.box('woodDark', sx * 1.15, 4.4, -1.15, 0.12, 1.3, 0.12);
  b.box('corrugated', 0, 4.95, 0, 3.0, 0.1, 3.0, { rx: 0.08 });
  b.box('woodDark', -1.0, 1.5, 1.0, 0.07, 3.2, 0.5, { rz: 0.0, tint: [0.7, 0.7, 0.7] });
  for (let i = 0; i < 9; i++) b.box('woodDark', -1.15, 0.35 + i * 0.33, 1.0, 0.04, 0.05, 0.5);
  b.box('black', 0, 3.5, 1.1, 0.7, 0.3, 0.4); b.box('woodDark', 0.3, 3.25, -0.8, 0.8, 0.5, 0.5);
}

function lightFixtures(b, key) {
  for (const [lx, lz, rot] of [[-1, 0, 0], [2.5, 0, 0], [5.8, 0, 0], [4, 7, Math.PI / 2], [4, 10, Math.PI / 2], [4, -5, Math.PI / 2], [4, -9, Math.PI / 2], [-6, -3, 0], [-9.5, 0, 0], [-6, 3, 0], [-11.5, -3, 0]]) P.lampStrip(b, lx, 3.2, lz, 1.3, rot, key);
  // pipes and cable trays
  b.cyl('rust', 2.2, 3.0, -1.35, 0.1, 0.1, 11, 8, { rz: Math.PI / 2, tint: [0.8, 0.7, 0.6] });
  b.cyl('steel', 2.2, 2.85, 1.35, 0.06, 0.06, 11, 6, { rz: Math.PI / 2 });
  b.box('steel', 2.2, 3.1, 0, 11, 0.04, 0.4, { tint: [0.6, 0.6, 0.6] });
  for (const px of [-2, 0.5, 3, 5.5, 7.3]) b.box('steel', px, 3.0, -1.35, 0.1, 0.3, 0.12);
  b.cyl('rust', 4.0, 3.05, 7, 0.09, 0.09, 10, 8, { rx: Math.PI / 2, tint: [0.8, 0.7, 0.6] });
  b.cyl('rust', -8.5, 3.05, -5.9, 0.08, 0.08, 10, 8, { rz: Math.PI / 2, tint: [0.8, 0.7, 0.6] });
}

function interiorRooms(S, b, R, oy, wx, wz) {
  const tintF = [0.62, 0.64, 0.62];
  floorSlab(b, 2.2, 0, 11.4, 3.6, 0, 'concrete', 'stone', { tint: tintF, tile: 3 });
  floorSlab(b, 4.0, 7.0, 7.6, 10.4, 0, 'concrete', 'metal', { tint: [0.5, 0.52, 0.5], tile: 3 });
  floorSlab(b, 4.0, -7.0, 7.6, 10.4, 0, 'wood', 'wood', { tint: [0.55, 0.52, 0.5] });
  floorSlab(b, -8.8, 0, 10.8, 13.2, 0, 'concrete', 'stone', { tint: [0.7, 0.72, 0.7], tile: 3 });
  // hazard stripes along the corridor
  for (let i = 0; i < 9; i++) b.box('lampOff', 0.0 + i * 0.9, 0.012, -1.3, 0.35, 0.01, 0.12, { ry: 0.6, tint: [0.9, 0.75, 0.1], j: 0 });
  b.quad('signs', 2.5, 2.1, -1.59, 1.8, 0.23, { uvRect: signRect(6), j: 0 });
  b.quad('signs', 2.5, 2.1, 1.59, 1.8, 0.23, { ry: Math.PI, uvRect: signRect(7), j: 0 });
  P.cable(b, [[7.6, 2.9, 1.5], [6, 2.4, 1.6], [4, 0.9, 1.65], [3.5, 0.05, 1.5], [1.5, 0.05, 1.2]], 0.03);
  b.cyl('rust', 7.4, 0.9, -1.5, 0.08, 0.08, 0.5, 8, { tint: [1, 0.3, 0.25] }); // extinguisher
  b.box('lampOff', 6.5, 1.8, -1.57, 0.4, 0.4, 0.02, { tint: [1, 0.2, 0.1] });

  // ---- bunk room
  for (let i = 0; i < 3; i++) P.bunk(b, 1.5 + i * 2.2, -11.2, Math.PI / 2, { tint: [[0.5, 0.58, 0.5], [0.58, 0.5, 0.45], [0.5, 0.52, 0.6]][i] });
  P.locker(b, 1.3, -2.3, Math.PI, { n: 3, ajar: 1 }); P.locker(b, 6.6, -2.3, Math.PI, { n: 2, tint: [0.6, 0.62, 0.58] });
  P.table(b, 4.2, -6.6, 0.1, { w: 1.8, d: 0.9 }); P.chair(b, 3.6, -5.6, Math.PI + 0.3); P.chair(b, 4.9, -7.6, 0.4); P.stool(b, 2.9, -7.0);
  b.clutter = true; b.box('black', 4.7, 0.83, -6.5, 0.32, 0.18, 0.14, { ry: 0.3 }); b.cyl('rust', 3.7, 0.84, -6.8, 0.045, 0.04, 0.09, 8); b.clutter = false;
  P.papers(b, 4.2, -6.6, 0.79, 4, 0.8); P.papers(b, 5.5, -8.5, 0.05, 5, 3);
  b.quad('map', 7.55, 1.7, -7, 1.6, 1.2, { ry: -Math.PI / 2, uv: [1, 1] });
  P.shelf(b, 7.3, -9.5, -Math.PI / 2, { w: 1.6, n: 4 });
  b.box('cloth', 4.2, 0.012, -7.0, 2.6, 0.015, 2.0, { tint: [0.4, 0.45, 0.35], tile: 1.5 });

  // ---- generator room extras
  P.drum(b, 1.4, 10.8, { tint: [1, 0.7, 0.6] }); P.drum(b, 2.1, 11.0, { tint: [0.7, 0.8, 1] }); P.drum(b, 1.2, 10.0, {});
  P.crate(b, 7.0, 10.9, 0.2); P.crate(b, 6.9, 10.9, 0.5, { w: 0.7, d: 0.7, h: 0.6, y: 0.8 });
  P.shelf(b, 0.65, 6.5, Math.PI / 2, { w: 1.7, n: 4, mat: 'steel' });
  b.box('panel', 7.45, 1.5, 5.0, 0.12, 1.4, 1.0, { tint: [0.6, 0.65, 0.58], c: { surface: 'metal' } }); // breaker panel
  for (let i = 0; i < 6; i++) b.box('black', 7.37, 1.1 + (i >> 1) * 0.3, 4.65 + (i % 2) * 0.35, 0.04, 0.12, 0.1);
  b.cyl('rust', 7.2, 1.2, 8.0, 0.22, 0.22, 0.05, 12, { rz: Math.PI / 2, tint: [0.9, 0.3, 0.25] });
  b.quad('signs', 0.37, 2.1, 7.0, 1.8, 0.23, { ry: Math.PI / 2, uvRect: signRect(7), j: 0 });
  P.papers(b, 3, 5.0, 0.05, 6, 2.5);
  P.cable(b, [[4.3, 1.2, 9.4], [3.2, 0.2, 9.0], [2.0, 0.04, 8.2], [1.0, 0.04, 7.0]], 0.04);
  S.resource('scrap_s5', 'scrap', [wx(2.7), oy + 0.12, wz(8.4)]);

  // ---- control room
  b.quad('map', -6, 1.9, -6.38, 2.4, 1.7, { uv: [1, 1] }); b.quad('map', -10.5, 1.8, -6.38, 1.6, 1.2, { uv: [1, 1], rz: 0.03 });
  b.quad('map', -9, 1.9, 6.38, 2.2, 1.6, { ry: Math.PI, uv: [1, 1] });
  P.locker(b, -4.2, 6.1, Math.PI, { n: 3 }); P.locker(b, -12.4, 6.1, Math.PI, { n: 2, ajar: 0 });
  for (const [cx, cz, rot, len] of [[-9.5, -6.0, 0, 3.6], [-6.2, 6.0, Math.PI, 2.4], [-12.2, 4.4, Math.PI / 2, 2.2]]) consoleDesk(b, cx, cz, rot, len);
  P.table(b, -7.8, 0.4, 0.0, { w: 2.6, d: 1.3 });
  b.quad('map', -7.8, 0.82, 0.4, 2.3, 1.0, { rx: -Math.PI / 2, uv: [1, 1] });
  P.chair(b, -9.4, 1.8, Math.PI + 0.2); P.chair(b, -6.2, -1.2, 0.0); P.stool(b, -7.3, 2.3);
  P.papers(b, -7.8, 0.4, 0.83, 3, 0.8); P.papers(b, -9.0, 3.0, 0.05, 7, 3.5);
  P.chair(b, -12.0, 0.0, -Math.PI / 2, { nc: false });
  b.box('black', -3.7, 1.8, -4.5, 0.08, 0.5, 0.8, { tint: [0.9, 0.9, 0.9] }); b.box('glass', -3.65, 1.8, -4.5, 0.02, 0.4, 0.7, { tint: [0.4, 0.55, 0.5] });
  b.box('black', -3.7, 1.8, 4.5, 0.08, 0.5, 0.8); b.box('glass', -3.65, 1.8, 4.5, 0.02, 0.4, 0.7, { tint: [0.4, 0.55, 0.5] });
  S.resource('cloth_s5', 'cloth', [wx(-4.5), oy + 0.15, wz(5.0)]);
}

function consoleDesk(b, x, z, rot, len) {
  b.at(x, 0, z, rot, () => {
    b.box('panel', 0, 0.45, 0, len, 0.9, 0.8, { tint: [0.45, 0.5, 0.48], c: { surface: 'metal' } });
    b.box('black', 0, 0.98, 0.08, len - 0.1, 0.1, 0.65, { rx: -0.25 });
    for (let i = 0; i < len / 0.25; i++) b.box(i % 5 ? 'steel' : 'lampOff', -len / 2 + 0.2 + i * 0.25, 1.01, 0.12 - (i % 3) * 0.07, 0.1, 0.03, 0.08, { rx: -0.25, tint: i % 5 ? [0.7, 0.7, 0.7] : [0.2, 1, 0.4], j: 0 });
    for (let i = 0; i < 3 && len > 2; i++) { P.monitor(b, -len / 2 + 0.7 + i * 1.0, 1.0, -0.15, 0, 0.9); }
  });
}

// ------------------------------------------------------------------------------------------------
// Dynamic objects

function blastDoor(S, x, y, z) {
  const rand = S.rand(401);
  const g = makeObject(S.lib, rand, 'bunker.door', (d) => {
    d.box('rust', 0, 1.45, 0, 2.7, 2.9, 0.32, { tint: [0.55, 0.5, 0.48], tile: 1.6 });
    d.box('steel', 0, 1.45, 0.17, 2.3, 0.1, 0.04); d.box('steel', 0, 0.3, 0.17, 2.3, 0.1, 0.04); d.box('steel', 0, 2.6, 0.17, 2.3, 0.1, 0.04);
    for (const sx of [-1, 1]) d.box('steel', sx * 1.15, 1.45, 0.17, 0.1, 2.4, 0.04);
    for (let i = 0; i < 5; i++) d.box('lampOff', -1.2 + i * 0.6, 0.12, 0.18, 0.3, 0.12, 0.01, { tint: [0.9, 0.75, 0.1], ry: 0, j: 0 });
    d.cyl('steel', 0, 1.5, 0.25, 0.32, 0.32, 0.12, 16, { rx: Math.PI / 2, tint: [0.6, 0.55, 0.5] });
    for (let i = 0; i < 4; i++) d.box('steel', 0, 1.5, 0.3, 0.7, 0.07, 0.07, { rz: (i / 4) * Math.PI });
    for (let i = 0; i < 12; i++) d.cyl('steel', -1.2 + (i % 6) * 0.48, i < 6 ? 2.75 : 0.14, 0.2, 0.04, 0.04, 0.03, 6, { rx: Math.PI / 2 });
  });
  g.position.set(x, y, z);
  g.rotation.y = Math.PI / 2; // local +x slides along world -z, local +z faces east
  g.userData.colliderId = 'bunker.door';
  g.userData.openOffset = new THREE.Vector3(2.9, 0, 0);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  S.root.add(g);
  S.anchor('bunker.door', [x, y, z], g.rotation.y, g);
  S.box(x - 0.9, z, 0.8, 1.3, 0, y - 0.1, y + 2.95, { id: 'bunker.door', surface: 'metal' });
}

function reader(S, x, y, z) {
  const rand = S.rand(402);
  const g = makeObject(S.lib, rand, 'bunker.reader', (r) => {
    r.box('steel', 0, 0, 0, 0.32, 0.5, 0.08, { tint: [0.45, 0.48, 0.5] });
    r.box('black', 0, 0.02, 0.045, 0.24, 0.14, 0.01);
    r.box('black', 0, -0.08, 0.045, 0.2, 0.025, 0.012);
    for (let i = 0; i < 6; i++) r.box('steel', -0.06 + (i % 3) * 0.06, -0.18 + (i >> 1) * -0.0, 0.05, 0.04, 0.03, 0.01, { tint: [0.9, 0.9, 0.9], j: 0 });
    r.box('steel', 0, 0.28, -0.0, 0.1, 0.06, 0.05);
  });
  const mat = new THREE.MeshStandardMaterial({ color: 0x300808, emissive: 0xff1a10, emissiveIntensity: 1.6, roughness: 0.4 });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), mat);
  led.name = 'led'; led.position.set(0, 0.17, 0.05);
  g.add(led);
  g.position.set(x, y, z);
  g.rotation.y = Math.PI / 2;
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  S.root.add(g);
  S.anchor('bunker.reader', [x, y, z], g.rotation.y, g);
}

function generator(S, x, y, z) {
  const rand = S.rand(403);
  const g = makeObject(S.lib, rand, 'bunker.generator', (d) => {
    d.box('rust', 0, 0.15, 0, 2.6, 0.3, 1.5, { tint: [0.5, 0.5, 0.5] });
    d.box('steel', 0, 0.9, 0.1, 2.2, 1.2, 0.95, { tint: [0.45, 0.6, 0.5] });
    d.cyl('rust', -0.5, 1.5, 0.1, 0.45, 0.45, 0.4, 14, { tint: [0.7, 0.7, 0.7] });
    d.cyl('steel', 0.7, 1.55, 0.1, 0.3, 0.3, 0.3, 12);
    d.cyl('steel', 1.0, 1.9, 0.3, 0.09, 0.09, 1.2, 8, { tint: [0.4, 0.38, 0.36] });
    d.box('rust', 0, 0.9, 0.62, 2.0, 1.0, 0.08, { tint: [0.5, 0.55, 0.5] }); // front panel at +z? panel faces -z below
    d.box('panel', 0, 0.85, -0.5, 2.0, 0.95, 0.12, { tint: [0.4, 0.5, 0.42] });
    for (const gx of [-0.7, -0.2, 0.3]) { d.cyl('black', gx, 1.05, -0.58, 0.12, 0.12, 0.04, 14, { rx: Math.PI / 2 }); d.cyl('lampOff', gx, 1.05, -0.605, 0.1, 0.1, 0.01, 14, { rx: Math.PI / 2, tint: [0.9, 0.9, 0.8], j: 0 }); }
    d.box('black', -0.2, 0.55, -0.58, 1.6, 0.14, 0.03);
    d.cyl('steel', 0, 0.2, -0.85, 0.05, 0.05, 1.5, 6, { rz: Math.PI / 2 });
    for (const sx of [-1, 1]) d.cyl('black', sx * 1.0, 0.2, -0.85, 0.12, 0.12, 0.1, 8, { rx: Math.PI / 2 });
  });
  const lever = new THREE.Group();
  lever.name = 'lever'; lever.position.set(0.95, 0.9, -0.62);
  const armMat = S.M.steel;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 8), armMat); arm.position.y = 0.31;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0xaa1a12, roughness: 0.5 })); knob.position.y = 0.66;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), armMat); hub.rotation.z = Math.PI / 2;
  lever.add(arm, knob, hub);
  g.add(lever);
  g.position.set(x, y, z);
  g.rotation.y = 0; // front panel/lever on local -z → faces the room entrance (north)
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  S.root.add(g);
  S.anchor('bunker.generator', [x, y, z], 0, g);
  S.box(x, z, 1.3, 0.85, 0, y - 0.1, y + 1.7, { surface: 'metal' });
}

function terminal(S, x, y, z) {
  const rand = S.rand(404);
  const g = makeObject(S.lib, rand, 'bunker.terminal', (d) => {
    d.box('panel', 0, 0.4, 0, 0.9, 0.8, 1.7, { tint: [0.45, 0.5, 0.48] });
    d.box('black', 0.1, 0.84, 0, 0.7, 0.08, 1.5);
    d.box('black', 0.15, 0.95, 0.0, 0.4, 0.03, 0.9, { rz: -0.2 });
    d.box('black', -0.25, 1.35, 0, 0.12, 0.85, 1.35);
    for (let i = 0; i < 12; i++) d.box('lampOff', 0.28, 0.88, -0.7 + i * 0.12, 0.08, 0.02, 0.07, { tint: i % 4 ? [0.7, 0.7, 0.7] : [1, 0.5, 0.2], j: 0 });
  });
  // screen canvas (own material, emissive off until gameplay powers it)
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const gc = c.getContext('2d');
  gc.fillStyle = '#000'; gc.fillRect(0, 0, 512, 288);
  gc.fillStyle = '#8fe8c0'; gc.font = 'bold 26px monospace';
  ['K-7 BEHEERSTERMINAL', '', '> STATUS ........ ONLINE', '> NOODSTROOM ..... ACTIEF', '> LOGBOEK ........ 14 ITEMS', '', '[ENTER] OPENEN'].forEach((t, i) => gc.fillText(t, 22, 46 + i * 34));
  for (let y = 0; y < 288; y += 3) { gc.fillStyle = 'rgba(0,0,0,0.25)'; gc.fillRect(0, y, 512, 1); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ color: 0x061210, emissive: 0x000000, emissiveMap: tex, emissiveIntensity: 1.0, roughness: 0.3 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.68), mat);
  screen.name = 'screen'; screen.position.set(-0.185, 1.35, 0); screen.rotation.y = Math.PI / 2;
  g.add(screen);
  g.position.set(x, y, z);
  g.rotation.y = 0; // monitor faces +x (toward the door)
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  S.root.add(g);
  S.anchor('bunker.terminal', [x, y, z], 0, g);
  S.box(x, z, 0.5, 0.9, 0, y - 0.1, y + 1.0, { surface: 'metal' });
}

function innerDoor(S, x, y, z) {
  const rand = S.rand(405);
  const g = makeObject(S.lib, rand, 'bunker.innerDoor', (d) => {
    d.box('steel', 0, 1.25, 0, 1.9, 2.5, 0.28, { tint: [0.6, 0.62, 0.58] });
    d.box('rust', 0, 1.25, 0.145, 1.6, 2.2, 0.02, { tint: [0.6, 0.6, 0.6], tile: 1.2 });
    for (let i = 0; i < 6; i++) d.box('lampOff', -0.8 + i * 0.32, 2.3, 0.16, 0.2, 0.2, 0.01, { ry: 0, tint: [0.9, 0.75, 0.1], j: 0, rz: 0.6 });
    d.cyl('steel', 0.6, 1.2, 0.2, 0.12, 0.12, 0.08, 12, { rx: Math.PI / 2 });
  });
  g.position.set(x, y, z);
  g.rotation.y = Math.PI / 2; // local x → world -z (slides into the north wall)
  g.userData.colliderId = 'bunker.innerDoor';
  g.userData.openOffset = new THREE.Vector3(1.95, 0, 0);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  S.root.add(g);
  S.anchor('bunker.innerDoor', [x, y, z], g.rotation.y, g);
  S.box(x, z, 0.2, 0.95, 0, y - 0.1, y + 2.6, { id: 'bunker.innerDoor', surface: 'metal' });
}
