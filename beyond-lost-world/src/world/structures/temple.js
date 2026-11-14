// De Zonnetempel: monumental temple of the vanished civilisation (pad 'temple').
// Local frame: origin = pad centre at pad.y, +z = south (towards the path end at (0,-146)).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getPad } from '../layout.js';
import { ivy } from './arch.js';
import * as P from './props.js';
import { makeObject } from './core.js';
import { placeBeacon } from './beacons.js';

const TAU = Math.PI * 2;
const F = 4.8; // podium top (forecourt floor)
const ST = { surface: 'stone' };

export function buildTemple(S) {
  const pad = getPad('temple');
  const b = S.builder('temple', 31);
  const R = b.rand;
  const oy = pad.y;
  const L = (lx, ly, lz) => [pad.x + lx, oy + ly, pad.z + lz];

  b.at(pad.x, oy, pad.z, 0, () => {
    // ------------------------------------------------------------ podium (two tiers) + colliders
    b.box('temple', 0, 1.2, -7.5, 62, 2.4, 59, { tint: [0.9, 0.88, 0.8] });
    b.box('templeCarved', 0, 3.6, -7.4, 58, 2.4, 57.2, { tint: [0.95, 0.93, 0.86] });
    b.quad('flag', 0, F + 0.008, 4.5, 58, 33, { rx: -Math.PI / 2, uv: [58 / 3, 33 / 3], j: 0.03, noOffset: true });
    b.quad('flag', 0, F + 0.008, -23, 58, 22, { rx: -Math.PI / 2, uv: [58 / 3, 22 / 3], j: 0.03 });
    // solid mass colliders (leave the stair width free)
    b.solid(-19.5, F / 2, -7.5, 23, F, 59, ST); b.solid(19.5, F / 2, -7.5, 23, F, 59, ST);
    b.solid(0, F / 2, -7.9, 16, F, 58.6, ST);
    // parapet around the podium edge (blocks falling off)
    const par = (x, z, w, d) => b.box('temple', x, F + 0.5, z, w, 1.0, d, { c: ST, tint: [0.88, 0.9, 0.82] });
    par(-29.6, -7.4, 0.8, 57.4); par(29.6, -7.4, 0.8, 57.4); par(0, -35.6, 59.2, 0.8);
    par(-18.5, 20.8, 21, 0.8); par(18.5, 20.8, 21, 0.8);

    // ------------------------------------------------------------ ceremonial stairs (south side)
    for (let i = 0; i < 16; i++) {
      const top = 0.3 * (i + 1), zc = 30 - 0.55 * (i + 0.5);
      b.box(i % 4 === 3 ? 'templeCarved' : 'temple', 0, top / 2, zc, 16, top, 0.55, { c: { surface: 'stone', yMin: 0, yMax: top }, tint: [0.92, 0.9, 0.84], tile: 2 });
      for (const s of [-1, 1]) b.box('temple', s * 8.5, (top + 0.7) / 2, zc, 1.0, top + 0.7, 0.55, { c: { surface: 'stone', yMin: 0, yMax: top + 0.7 }, tint: [0.85, 0.88, 0.8] });
    }
    // guardian statues at the top of the stairs
    for (const s of [-1, 1]) guardian(b, s * 8.5, F + 0.7, 18.8, s > 0 ? Math.PI * 0.0 : 0);
    // obelisks at the bottom
    for (const s of [-1, 1]) {
      b.box('temple', s * 10.5, 0.25, 31.5, 1.7, 0.5, 1.7, { c: ST });
      b.box('templeCarved', s * 10.5, 3.2, 31.5, 1.15, 5.6, 1.15, { c: ST, tint: [0.95, 0.95, 0.88] });
      b.cyl('temple', s * 10.5, 6.2, 31.5, 0.0, 0.8, 0.9, 4, { ry: Math.PI / 4 });
    }

    // ------------------------------------------------------------ facade, sanctum shell, upper tiers
    const FH = 11; // facade height above podium
    b.box('temple', -12.1, F + FH / 2, -12, 19.8, FH, 3, { c: { surface: 'stone', yMin: F, yMax: F + FH }, tint: [0.92, 0.9, 0.84] });
    b.box('temple', 12.1, F + FH / 2, -12, 19.8, FH, 3, { c: { surface: 'stone', yMin: F, yMax: F + FH }, tint: [0.92, 0.9, 0.84] });
    b.box('templeCarved', 0, F + 4.6 + (FH - 4.6) / 2, -12, 4.4, FH - 4.6, 3, { tint: [0.95, 0.92, 0.85] });
    for (const s of [-1, 1]) { // frieze bands, pilasters
      b.box('templeCarved', s * 12.6, F + 7.3, -10.45, 18.8, 2.6, 0.12, { tint: [1, 0.98, 0.9] });
      for (const px of [3.4, 8.6, 14.6, 20.4]) b.box('templeCarved', s * px, F + 3.2, -10.5, 1.5, 6.4, 0.4, { tint: [0.95, 0.93, 0.86] });
    }
    b.box('temple', 0, F + FH + 0.35, -12, 46, 0.7, 3.4, { tint: [0.85, 0.83, 0.78] });
    b.quad('sunRelief', 0, F + 8.6, -10.38, 4.6, 4.6, { j: 0, uv: [1, 1] });
    // sides and back of the mass (inner faces form the sanctum walls)
    b.box('temple', -14.5, F + FH / 2, -24.5, 15, FH, 23, { c: { surface: 'stone', yMin: F, yMax: F + FH }, tint: [0.9, 0.88, 0.82] });
    b.box('temple', 14.5, F + FH / 2, -24.5, 15, FH, 23, { c: { surface: 'stone', yMin: F, yMax: F + FH }, tint: [0.9, 0.88, 0.82] });
    b.box('temple', 0, F + FH / 2, -33.5, 14, FH, 5, { c: { surface: 'stone', yMin: F, yMax: F + FH }, tint: [0.9, 0.88, 0.82] });
    b.box('temple', 0, F + 6.4 + (FH - 6.4) / 2, -22, 14, FH - 6.4, 18, { tint: [0.8, 0.8, 0.78] }); // roof of the sanctum
    // upper tiers
    b.box('templeCarved', 0, F + FH + 2.7, -26, 32, 4.0, 20, { tint: [0.93, 0.91, 0.84] });
    b.box('temple', 0, F + FH + 6.0, -27, 22, 2.6, 14, { tint: [0.9, 0.88, 0.82] });
    b.box('templeCarved', 0, F + FH + 8.6, -27, 14, 2.6, 9, { tint: [0.95, 0.93, 0.86] });
    b.quad('sunRelief', 0, F + FH + 6.0, -19.95, 4.2, 4.2, { j: 0, uv: [1, 1] });
    for (const s of [-1, 1]) b.box('temple', s * 12.6, F + FH + 1.2, -16.2, 1.6, 2.4, 1.6, { tint: [0.9, 0.9, 0.84] });
    // gate stones around opening
    for (const s of [-1, 1]) b.box('templeCarved', s * 2.5, F + 2.3, -10.45, 0.6, 4.6, 0.3, { tint: [0.95, 0.9, 0.82] });

    // ------------------------------------------------------------ forecourt columns, braziers
    const cols = [];
    for (const sx of [-12, 12]) for (const z of [16, 10, 4, -2, -8]) cols.push([sx, z]);
    cols.forEach(([cx, cz], i) => {
      const broken = i === 1 || i === 6;
      const h = broken ? 2.6 + R() * 1.4 : 6.6;
      column(b, cx, cz, h, broken, R);
      if (broken) for (let k = 0; k < 4; k++) b.cyl('temple', cx + (R() - 0.5) * 3.5, F + 0.3, cz + 1.2 + R() * 2, 0.55, 0.55, 0.6 + R() * 0.5, 10, { rz: Math.PI / 2, ry: R() * 3, tint: [0.85, 0.9, 0.8], cc: ST, cr: 0.55 });
    });
    for (const sx of [-12, 12]) { // entablature (broken in places)
      b.box('temple', sx, F + 7.2, 6.0, 1.7, 0.7, 11.2, { tint: [0.9, 0.9, 0.84] });
      b.box('templeCarved', sx, F + 7.2, -5.2, 1.7, 0.7, 5.2, { tint: [0.95, 0.93, 0.86] });
      b.box('templeCarved', sx, F + 7.9, 6.0, 1.3, 0.4, 11.0, { tint: [0.9, 0.9, 0.84] });
    }
    for (const [bx, bz] of [[-4.5, 16.5], [4.5, 16.5], [-7, 0], [7, 0], [-4.5, -9], [4.5, -9]]) brazier(b, bx, F, bz);

    // ------------------------------------------------------------ vegetation
    b.clutter = true;
    for (let i = 0; i < 20; i++) ivy(b, (R() - 0.5) * 40, F + 1 + R() * 6, -10.3, 2.4, 3.0, {});
    for (const [vx, vz] of [[-12, 16], [12, 10], [-12, -2], [12, -8], [-12, 4]]) ivy(b, vx, F + 2.5, vz + 0.62, 1.2, 4, {});
    for (let i = 0; i < 24; i++) { const a = R() * TAU; b.quad('ivy', (R() - 0.5) * 54, F + 0.05, 20 - R() * 54, 1.6, 1.6, { rx: -Math.PI / 2, rz: a, tint: [0.6 + R() * 0.3, 0.8, 0.5], uv: [1, 1], j: 0.2 }); }
    for (let i = 0; i < 12; i++) ivy(b, (R() < 0.5 ? -1 : 1) * (8 + R() * 8), 1.1 + R() * 2, 28.0 - R() * 3, 3, 2.4, {});
    b.clutter = false;

    // ------------------------------------------------------------ sanctum interior
    b.box('flag', 0, F - 0.05, -22, 14, 0.1, 18.4, { tint: [0.55, 0.58, 0.55], tile: 3 });
    b.box('flag', 0, F - 0.05, -12, 4.4, 0.1, 3.2, { tint: [0.6, 0.62, 0.58], tile: 3 });
    b.solid(0, F - 0.2, -22, 14, 0.4, 18.4, ST);
    for (const s of [-1, 1]) {
      b.box('templeCarved', s * 6.93, F + 2.4, -22, 0.14, 2.2, 14, { tint: [0.8, 0.78, 0.7] });
      b.box('templeCarved', s * 6.93, F + 4.9, -22, 0.14, 1.1, 14, { tint: [0.8, 0.78, 0.7] });
      b.box('templeCarved', s * 3.6, F + 3.1, -19.5, 1.4, 6.2, 1.4, { c: { surface: 'stone', yMin: F, yMax: F + 6.2 }, tint: [0.85, 0.84, 0.78] });
    }
    b.box('templeCarved', 0, F + 3.5, -30.93, 10, 5.0, 0.14, { tint: [0.85, 0.82, 0.75] });
    b.quad('sunRelief', 0, F + 3.4, -30.8, 3.4, 3.4, { j: 0, uv: [1, 1], tint: [0.7, 0.7, 0.7] });
    // keycard plinth + recorder bench, backpack, lantern
    P.plinth(b, 0, -27, 1.0, 1.1, 'temple', { y: F });
    S.anchor('temple.keycard', L(0, F + 1.18, -27));
    b.box('temple', -3.6, F + 0.3, -27.4, 1.6, 0.6, 0.9, { c: ST, tint: [0.85, 0.85, 0.8] });
    S.anchor('temple.recording', L(-3.8, F + 0.62, -27.4));
    b.box('black', -3.8, F + 0.65, -27.4, 0.22, 0.06, 0.14, { ry: 0.5 }); b.cyl('steel', -3.75, F + 0.7, -27.35, 0.025, 0.025, 0.01, 8);
    P.backpack(b, -5.2, -26.6, 0.6, { y: F }); P.lantern(b, -3.2, -27.5, { y: F + 0.6 });
    b.clutter = true;
    for (let i = 0; i < 5; i++) b.box('paper', -4.4 + R() * 1.4, F + 0.02, -28.2 + R() * 1.6, 0.2, 0.005, 0.28, { ry: R() * 3, tile: 0.3 });
    b.clutter = false;
  });

  // ------------------------------------------------------------ glyph pillars (separate meshes)
  const pillars = [];
  [-6, 0, 6].forEach((px, i) => {
    const g = makePillar(S);
    g.position.set(pad.x + px, oy + F, pad.z - 1);
    g.rotation.y = Math.PI;
    S.root.add(g);
    S.anchor(`temple.pillar${i + 1}`, g.position, Math.PI, g);
    S.box(g.position.x, g.position.z, 0.7, 0.7, 0, oy + F, oy + F + 3.4, { surface: 'stone' });
    pillars.push(g);
  });

  // ------------------------------------------------------------ altar (with horizontal socket)
  const altar = makeObject(S.lib, S.rand(77), 'temple.altar', (a) => {
    a.box('temple', 0, 0.15, 0, 3.0, 0.3, 2.0, { tint: [0.9, 0.9, 0.85] });
    a.box('templeCarved', 0, 0.62, 0, 2.5, 0.7, 1.6, { tint: [0.95, 0.93, 0.86] });
    a.box('temple', 0, 1.06, 0, 2.7, 0.16, 1.8, { tint: [0.92, 0.9, 0.84] });
    a.quad('sunRelief', 0, 0.62, 0.805, 1.2, 0.62, { j: 0, uv: [1, 1] });
    a.cyl('black', 0, 1.145, 0, 0.5, 0.5, 0.012, 24, { tint: [0.6, 0.6, 0.6] });
    for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; a.box('temple', Math.cos(an) * 0.6, 1.15, Math.sin(an) * 0.6, 0.14, 0.05, 0.1, { ry: -an }); }
    for (const sx of [-1, 1]) a.box('templeCarved', sx * 1.0, 1.25, 0, 0.3, 0.2, 1.3, { tint: [0.9, 0.9, 0.85] });
  });
  altar.position.set(pad.x, oy + F, pad.z + 9);
  altar.rotation.y = 0;
  const socket = new THREE.Object3D();
  socket.name = 'socket'; socket.position.set(0, 1.16, 0);
  altar.add(socket);
  altar.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  S.root.add(altar);
  S.anchor('temple.altar', altar.position, 0, altar);
  S.box(pad.x, pad.z + 9, 1.5, 1.0, 0, oy + F, oy + F + 1.2, ST);

  // ------------------------------------------------------------ gate slab
  const gate = makeObject(S.lib, S.rand(78), 'temple.gate', (g) => {
    g.box('templeCarved', 0, 2.28, 0, 4.3, 4.55, 1.0, { tint: [0.95, 0.92, 0.84], tile: 2.5 });
    g.quad('sunRelief', 0, 2.5, 0.505, 3.4, 3.4, { j: 0, uv: [1, 1] });
    g.quad('sunRelief', 0, 2.5, -0.505, 3.4, 3.4, { j: 0, uv: [1, 1], ry: Math.PI });
    g.box('temple', 0, 0.2, 0.52, 4.3, 0.4, 0.06); g.box('temple', 0, 4.4, 0.52, 4.3, 0.3, 0.06);
  });
  gate.position.set(pad.x, oy + F + 0.02, pad.z - 12);
  gate.userData.colliderId = 'temple.gate';
  gate.userData.openOffset = new THREE.Vector3(0, -4.6, 0);
  gate.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  S.root.add(gate);
  S.anchor('temple.gate', gate.position, 0, gate);
  S.box(pad.x, pad.z - 12, 2.2, 0.6, 0, oy + F, oy + F + 4.8, { id: 'temple.gate', surface: 'stone' });

  placeBeacon(S, 'temple.beacon', pad.x + 6, oy, pad.z + 33.5, 0.1, 1, 3);
  S.zone('temple_sanctum', pad.x, pad.z - 21, 7.2, 10.5, 0, oy + F - 0.6, oy + F + 6.4, 0.9);
  S.commit(b);
  return { pillars, altar, gate };
}

function column(b, x, z, h, broken, R) {
  b.at(x, F, z, 0, () => {
    b.box('temple', 0, 0.2, 0, 1.9, 0.4, 1.9, { c: ST, tint: [0.88, 0.9, 0.82] });
    b.cyl('temple', 0, 0.4 + h / 2, 0, 0.62, 0.7, h, 14, { cc: ST, cr: 0.7, tint: [0.92, 0.92, 0.85], tile: 3 });
    b.cyl('templeCarved', 0, 1.2, 0, 0.74, 0.74, 0.8, 14, { tint: [0.95, 0.93, 0.86], tile: 2.5 });
    if (!broken) {
      b.cyl('templeCarved', 0, h - 0.4, 0, 0.7, 0.7, 0.7, 14, { tint: [0.95, 0.93, 0.86], tile: 2.5 });
      b.box('temple', 0, h + 0.55, 0, 1.7, 0.4, 1.7, { tint: [0.92, 0.9, 0.84] });
    } else {
      b.geo('temple', new THREE.DodecahedronGeometry(0.5, 0), 0.1, 0.4 + h, 0, { sy: 0.5, uv: [0.3, 0.3], tint: [0.9, 0.95, 0.85] });
    }
  });
  void R;
}

function brazier(b, x, y, z) {
  b.at(x, y, z, 0, () => {
    b.cyl('temple', 0, 0.15, 0, 0.5, 0.55, 0.3, 8, { c: undefined, tint: [0.9, 0.9, 0.85] });
    b.cyl('rust', 0, 0.55, 0, 0.12, 0.2, 0.8, 8, { tint: [0.6, 0.55, 0.5] });
    b.cyl('rust', 0, 1.1, 0, 0.55, 0.25, 0.4, 12, { tint: [0.7, 0.6, 0.5], open: true });
    b.cyl('ember', 0, 1.28, 0, 0.45, 0.45, 0.05, 12);
    b.circleCollider(0, 0.6, 0, 0.55, 1.3, ST);
  });
}

function guardian(b, x, y, z, rot) {
  b.at(x, y, z, rot, () => {
    b.box('temple', 0, 0.4, 0, 1.8, 0.8, 2.6, { c: ST, tint: [0.88, 0.9, 0.82] });
    b.geo('temple', new THREE.SphereGeometry(0.75, 10, 8), 0, 1.45, 0.2, { sx: 0.8, sy: 0.9, sz: 1.3, uv: [0.5, 0.5], tint: [0.92, 0.92, 0.86] });
    for (const s of [-1, 1]) b.box('temple', s * 0.35, 1.0, 1.0, 0.28, 0.9, 0.3, { tint: [0.9, 0.9, 0.84] });
    b.geo('temple', new THREE.SphereGeometry(0.4, 10, 8), 0, 2.15, 0.9, { sz: 1.1, uv: [0.4, 0.4] });
    b.box('temple', 0, 2.05, 1.3, 0.34, 0.26, 0.4, { tint: [0.9, 0.9, 0.84] });
    b.cyl('templeCarved', 0, 2.2, 0.55, 0.62, 0.62, 0.12, 14, { rx: Math.PI / 2, tint: [0.95, 0.93, 0.86] });
  });
}

/** Rotatable glyph pillar: four glyph faces, separate mesh (not merged). */
function makePillar(S) {
  const g = new THREE.Group();
  const mats = [S.lib.glyph[1], S.lib.glyph[3], S.lib.pillarStone, S.lib.pillarStone, S.lib.glyph[2], S.lib.glyph[0]];
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 1.2), mats);
  shaft.position.y = 0.3 + 1.3;
  const base = new THREE.BoxGeometry(1.7, 0.3, 1.7); base.translate(0, 0.15, 0);
  const cap = new THREE.BoxGeometry(1.5, 0.28, 1.5); cap.translate(0, 0.3 + 2.6 + 0.14, 0);
  const cap2 = new THREE.BoxGeometry(1.7, 0.18, 1.7); cap2.translate(0, 0.3 + 2.6 + 0.37, 0);
  const trim = mergeGeometries([base, cap, cap2].map((q) => q.toNonIndexed()), false);
  const trimMesh = new THREE.Mesh(trim, S.lib.pillarStone);
  for (const m of [shaft, trimMesh]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.name = 'pillar';
  return g;
}
