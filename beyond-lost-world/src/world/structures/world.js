// Props along the paths and out in the world: crossroads signpost, research camp, ancient ruins, old lamp posts.
import * as THREE from 'three';
import { PADS, padDistance, nearestPath, riverInfo, LAKE, getPad } from '../layout.js';
import * as P from './props.js';
import { buildBridges } from './bridges.js';

const TAU = Math.PI * 2;
const signRect = (i) => [0, 1 - (i + 1) / 8, 1, 1 - i / 8];

export function buildWorldProps(S) {
  const b = S.builder('world', 71);
  const R = b.rand;
  const T = S.terrain;
  const gh = (x, z) => T.getHeightAt(x, z);
  const ground = (x, z, yaw, fn) => b.at(x, gh(x, z), z, yaw, fn);

  // ------------------------------------------------------------------ crossroads signpost
  const cp = getPad('crossroads');
  b.at(cp.x, cp.y, cp.z, 0, () => {
    b.cyl('woodDark', 0, 1.9, 0, 0.1, 0.13, 3.8, 8, { cc: { surface: 'wood' }, cr: 0.3, tile: 1.2 });
    b.box('stone', 0, 0.15, 0, 0.9, 0.3, 0.9, { tint: [0.8, 0.8, 0.76] });
    const boards = [[0, 1, 0, 2.9], [1, -0.08, 1, 2.45], [0, -1, 2, 2.0], [-1, 0.12, 3, 1.6]]; // dir x, dir z, sign row, height
    for (const [dx, dz, row, h] of boards) {
      const l = Math.hypot(dx, dz);
      b.at(0, h, 0, Math.atan2(-dz / l, dx / l), () => {
        b.box('wood', 0.95, 0, 0, 1.7, 0.3, 0.06, { tint: [0.9, 0.85, 0.8], tile: 1.2 });
        const tip = new THREE.Shape(); tip.moveTo(0, -0.15); tip.lineTo(0.32, 0); tip.lineTo(0, 0.15); tip.closePath();
        const tg = new THREE.ExtrudeGeometry(tip, { depth: 0.06, bevelEnabled: false }); tg.translate(1.8, 0, -0.03);
        b.geo('wood', tg, 0, 0, 0, { uv: [0.6, 0.6], tint: [0.9, 0.85, 0.8] });
        b.quad('signs', 0.92, 0, 0.034, 1.6, 0.26, { uvRect: signRect(row), j: 0 });
        b.quad('signs', 0.92, 0, -0.034, 1.6, 0.26, { ry: Math.PI, uvRect: signRect(row), j: 0 });
        b.box('steel', 0.05, 0, 0, 0.14, 0.05, 0.12);
      });
    }
    b.box('woodDark', 0, 3.85, 0, 0.3, 0.12, 0.3);
  });

  // ------------------------------------------------------------------ abandoned research camp near (-30,130)
  const cx = -30, cz = 130, cy = gh(cx, cz);
  ground(cx, cz, 0.5, () => {
    P.tent(b, 0, 0, 0, { tint: [0.5, 0.58, 0.45] });
  });
  ground(cx + 4.6, cz + 2.0, 0, () => P.campfire(b, 0, 0));
  ground(cx + 3.0, cz - 3.4, 0.2, () => {
    P.crate(b, 0, 0, 0.2, { w: 0.9, d: 0.7, h: 0.7 });
    P.crate(b, 1.1, 0.2, -0.3, { w: 0.8, d: 0.8, h: 0.6 });
    P.crate(b, 0.3, -0.1, 0.5, { w: 0.6, d: 0.6, h: 0.5, y: 0.7 });
    S.anchor('note.forest_camp', b.wp(1.1, 0.64, 0.2));
    b.box('paper', 1.1, 0.62, 0.2, 0.22, 0.01, 0.3, { ry: 0.4, tile: 0.3 });
  });
  ground(cx + 7.0, cz + 0.2, 0.9, () => { P.chair(b, 0, 0, 0.3); P.stool(b, 1, 0.8); P.barrel(b, -1.2, 1.1); });
  ground(cx - 3.8, cz + 3.8, 0.6, () => { P.sack(b, 0, 0); P.backpack(b, 1.0, 0.4, 0.7); P.bucket(b, -1.0, 0.3); });
  // clothesline with hanging cloth (animated)
  const lp = [[cx + 8.0, cz - 2.2], [cx + 2.0, cz - 6.6]];
  for (const [px, pz] of lp) ground(px, pz, 0, () => { b.cyl('woodDark', 0, 1.3, 0, 0.04, 0.05, 2.6, 6, { cc: { surface: 'wood' }, cr: 0.15 }); });
  P.rod(b, 'black', [lp[0][0], gh(...lp[0]) + 2.4, lp[0][1]], [lp[1][0], gh(...lp[1]) + 2.4, lp[1][1]], 0.01, 4);
  const cloths = [];
  for (let i = 0; i < 2; i++) {
    const t = 0.3 + i * 0.4, x = lp[0][0] + (lp[1][0] - lp[0][0]) * t, z = lp[0][1] + (lp[1][1] - lp[0][1]) * t;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1, 4, 4), S.M.cloth.clone());
    m.material.vertexColors = false; m.material.color = new THREE.Color(i ? 0x8c9a70 : 0xa07a5a);
    m.position.set(x, gh(lp[0][0], lp[0][1]) + 1.8, z); m.rotation.y = Math.atan2(lp[1][0] - lp[0][0], lp[1][1] - lp[0][1]) + Math.PI / 2;
    m.castShadow = true; S.root.add(m); cloths.push(m);
  }
  S.anim.push((dt, t) => cloths.forEach((m, i) => { m.rotation.x = Math.sin(t * 1.6 + i * 1.7) * 0.12; m.rotation.z = Math.sin(t * 1.1 + i) * 0.05; }));
  S.resource('cloth_s2', 'cloth', [cx + 1.05, gh(cx + 1.05, cz + 2.4) + 0.12, cz + 2.4]);
  S.resource('scrap_s6', 'scrap', [cx + 5.2, gh(cx + 5.2, cz - 1.4) + 0.1, cz - 1.4]);
  b.clutter = true;
  for (let i = 0; i < 5; i++) ground(cx + 3 + R() * 4, cz - 3 + R() * 4, R() * 3, () => b.box('paper', 0, 0.02, 0, 0.21, 0.005, 0.3, { tile: 0.3 }));
  b.clutter = false;

  // ------------------------------------------------------------------ old lamp posts near the station and along the road
  for (const [lx, lz] of [[16.8, 176], [24.6, 168], [14.6, 158], [20.4, 148]]) {
    ground(lx, lz, Math.atan2(20 - lx, 0), () => lampPost(b));
  }

  // ------------------------------------------------------------------ ruins in the forest
  const spots = [];
  const okSpot = (x, z) => {
    if (PADS.some((p) => padDistance(p, x, z) < 34)) return false;
    if (nearestPath(x, z).dist < 14) return false;
    if (riverInfo(x, z).dist < 24) return false;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 18) return false;
    if (T.getWaterSurfaceAt(x, z) !== null) return false;
    if (T.getNormalAt(x, z).y < 0.94) return false;
    return !spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 36) && Math.hypot(x - cx, z - cz) > 20;
  };
  let tries = 0;
  while (spots.length < 8 && tries++ < 4000) {
    const x = -200 + R() * 400, z = -100 + R() * 330;
    if (okSpot(x, z)) spots.push([x, z, spots.length]);
  }
  S.ruinSpots = spots;
  spots.forEach(([x, z, i]) => {
    const kind = i % 6;
    ground(x, z, R() * TAU, () => ruin(b, kind, R));
  });

  buildBridges(S, b);
  S.commit(b);
}

function lampPost(b) {
  b.cyl('rust', 0, 0.15, 0, 0.16, 0.2, 0.3, 8, { tint: [0.5, 0.5, 0.5], cc: { surface: 'metal' }, cr: 0.2 });
  b.cyl('steel', 0, 1.9, 0, 0.05, 0.08, 3.5, 8, { tint: [0.6, 0.55, 0.5] });
  b.cyl('steel', 0, 3.55, 0.3, 0.035, 0.035, 0.8, 6, { rx: Math.PI / 2.4 });
  b.box('steel', 0, 3.7, 0.6, 0.34, 0.06, 0.34, { tint: [0.6, 0.55, 0.5] });
  b.cyl('glass', 0, 3.58, 0.6, 0.12, 0.15, 0.25, 6, { tint: [1, 0.9, 0.6] });
  b.cyl('steel', 0, 3.38, 0.6, 0.15, 0.1, 0.05, 6);
  b.cyl('steel', 0, 3.78, 0.6, 0.01, 0.2, 0.14, 6, { tint: [0.55, 0.5, 0.45] });
}

function menhir(b, x, z, h, ry, R) {
  b.at(x, 0, z, ry, () => {
    b.box('templeCarved', 0, h / 2, 0, 0.9, h, 0.7, { rz: (R() - 0.5) * 0.12, c: { surface: 'stone' }, tint: [0.75 + R() * 0.2, 0.85, 0.7], tile: 1.8 });
    b.box('temple', 0, 0.08, 0, 1.3, 0.2, 1.1, { tint: [0.7, 0.8, 0.65] });
  });
}

function ruin(b, kind, R) {
  const mossy = () => [0.6 + R() * 0.2, 0.78 + R() * 0.15, 0.55];
  b.clutter = false;
  if (kind === 0) { // broken arch
    for (const s of [-1, 1]) {
      const h = s < 0 ? 5.0 : 2.8;
      b.box('temple', s * 2.2, h / 2, 0, 1.1, h, 1.1, { c: { surface: 'stone' }, tint: mossy(), tile: 2 });
      b.box('templeCarved', s * 2.2, 0.35, 0, 1.4, 0.7, 1.4, { tint: mossy() });
    }
    for (let i = 0; i < 4; i++) { const a = 0.35 + i * 0.3; b.box('temple', -2.2 + 2.2 * (1 - Math.cos(a * 2.4)) * 0.0 + (i + 0.5) * 0.55 - 0.2, 5.1 + Math.sin(i * 0.85) * 0.5, 0, 0.7, 0.55, 1.0, { rz: 0.5 - i * 0.3, tint: mossy() }); }
    for (let i = 0; i < 5; i++) b.geo('temple', new THREE.BoxGeometry(0.6 + R() * 0.5, 0.5, 0.6), 1 + R() * 3, 0.25, 1.5 + R() * 2, { ry: R() * 3, rz: R() * 0.4, uv: [0.4, 0.4], tint: mossy(), cc: { surface: 'stone' }, cr: 0.4, ch: 0.5 });
  } else if (kind === 1) { // standing stone ring
    const n = 6 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; menhir(b, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 2.2 + R() * 1.6, -a, R); }
    b.cyl('temple', 0, 0.1, 0, 1.2, 1.3, 0.2, 10, { c: undefined, tint: mossy(), cc: { surface: 'stone' }, cr: 1.3 });
    b.cyl('rust', 0, 0.28, 0, 0.5, 0.5, 0.15, 10, { tint: [0.3, 0.3, 0.3] });
  } else if (kind === 2) { // toppled statue
    b.box('temple', 0, 0.5, 0, 1.6, 1.0, 1.6, { c: { surface: 'stone' }, tint: mossy() }); b.box('templeCarved', 0, 1.05, 0, 1.8, 0.2, 1.8, { tint: mossy() });
    b.at(2.6, 0, 1.2, 0.8, () => {
      b.geo('temple', new THREE.SphereGeometry(0.55, 10, 8), 0, 0.5, 0, { sy: 1.4, uv: [0.5, 0.5], tint: mossy(), rz: Math.PI / 2 });
      b.cyl('temple', 1.2, 0.45, 0, 0.35, 0.5, 1.6, 9, { rz: Math.PI / 2, tint: mossy(), tile: 1.5 });
      b.geo('temple', new THREE.SphereGeometry(0.34, 9, 7), -1.2, 0.35, 0.5, { uv: [0.4, 0.4], tint: mossy() });
      b.box('temple', 0.6, 0.35, 0.9, 1.2, 0.3, 0.3, { ry: 0.4, tint: mossy() });
      b.cyl('templeCarved', -0.8, 0.5, -0.4, 0.55, 0.55, 0.1, 12, { rx: Math.PI / 2, tint: mossy() });
      b.circleCollider(0.2, 0.5, 0, 1.6, 1.0, { surface: 'stone' });
    });
  } else if (kind === 3) { // ruined walls with a doorway stub
    for (const [x, w, h] of [[-2.2, 3.2, 2.6], [1.6, 2.0, 1.4], [3.9, 1.4, 2.2]]) b.box('stone', x, h / 2, 0, w, h, 0.7, { c: { surface: 'stone' }, tint: mossy(), tile: 2 });
    b.box('stone', -3.7, 1.0, 2.0, 0.7, 2.0, 3.6, { c: { surface: 'stone' }, tint: mossy(), tile: 2 });
    b.box('templeCarved', 0.2, 2.15, 0, 1.4, 0.4, 0.8, { tint: mossy() });
    for (let i = 0; i < 6; i++) b.geo('stone', new THREE.BoxGeometry(0.5, 0.4, 0.5), -2 + R() * 6, 0.2, 1 + R() * 2.5, { ry: R() * 3, uv: [0.4, 0.4], tint: mossy() });
    b.clutter = true; for (let i = 0; i < 5; i++) b.quad('ivy', -2.2 + R() * 4, 0.9 + R() * 1.2, 0.4, 1.4, 1.4, { rz: (R() - 0.5) * 0.6, uv: [1, 1], tint: [0.6 + R() * 0.3, 0.8, 0.5], j: 0.2 }); b.clutter = false;
  } else if (kind === 4) { // platform with steps and column stumps
    b.box('temple', 0, 0.35, 0, 7, 0.7, 6, { c: { surface: 'stone' }, tint: mossy() });
    for (let i = 0; i < 3; i++) b.box('temple', 0, 0.12 + i * 0.0 + 0.12, 3.4 + i * 0.4 - 0.4, 3.6, 0.24 + (2 - i) * 0.2, 0.4, { c: { surface: 'stone', yMin: 0, yMax: 0.24 + (2 - i) * 0.2 }, tint: mossy() });
    for (const [x, z, h] of [[-2.4, -1.8, 3.4], [2.4, -1.8, 1.6], [-2.4, 1.8, 0.9], [2.4, 1.8, 2.6]]) {
      b.cyl('temple', x, 0.7 + h / 2, z, 0.5, 0.58, h, 10, { cc: { surface: 'stone' }, cr: 0.6, tint: mossy(), tile: 2.5 });
    }
    b.cyl('templeCarved', 0, 0.74, 0, 1.2, 1.2, 0.08, 16, { tint: mossy() });
  } else { // leaning obelisk with glyphs
    b.box('temple', 0, 0.2, 0, 2.0, 0.4, 2.0, { c: { surface: 'stone' }, tint: mossy() });
    b.box('templeCarved', 0, 3.4, 0, 0.9, 6.0, 0.9, { rz: 0.08, tint: mossy(), tile: 1.6, cc: undefined });
    b.circleCollider(0, 1.5, 0, 0.9, 3, { surface: 'stone' });
    b.cyl('temple', 0.5, 6.7, 0, 0.0, 0.6, 0.8, 4, { rz: 0.08, ry: Math.PI / 4 });
    b.cyl('temple', 4.0, 0.3, 2.4, 0.4, 0.4, 2.6, 8, { rz: Math.PI / 2, ry: 0.6, tint: mossy(), cc: { surface: 'stone' }, cr: 0.5, tile: 2 });
  }
}
