// De Kristalgrot: enclosed crystal cave behind the waterfall (pads 'cave_tunnel' + 'cave_chamber').
// Built in the tunnel pad's frame (rotation = pad.rot): local +z leads to the mouth, the dome chamber lies at -z.
import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { getPad, WATERFALL } from '../layout.js';
import * as P from './props.js';
import { placeBeacon } from './beacons.js';

const TAU = Math.PI * 2;
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildCave(S) {
  const tun = getPad('cave_tunnel'), cha = getPad('cave_chamber');
  const b = S.builder('cave', 51);
  const R = b.rand;
  const noise = new SimplexNoise({ random: R });
  const oy = tun.y, th = tun.rot;
  const c = Math.cos(th), s = Math.sin(th);
  // chamber centre in the tunnel frame
  const dx = cha.x - tun.x, dz = cha.z - tun.z;
  const CX = dx * c - dz * s, CZ = dx * s + dz * c;
  const CR = 13.2;
  const MOUTH = 21, TEND = -11.2;
  const Wd = (lz) => 4.35 + 0.45 * noise.noise(lz * 0.12, 3.1) + 1.6 * sm(13, 21, lz);
  const Hh = (lz) => 4.0 + 0.8 * noise.noise(lz * 0.1, 7.7) + 1.4 * sm(13, 21, lz);
  const world = (lx, lz) => [tun.x + lx * c + lz * s, tun.z - lx * s + lz * c];
  const disp = (x, y, z, amt = 1) => noise.noise3d(x * 0.28, y * 0.28, z * 0.28) * 0.75 * amt + noise.noise3d(x * 0.9, y * 0.9, z * 0.9) * 0.22 * amt;

  // ------------------------------------------------------------ tunnel tube
  const ringPts = (lz) => {
    const W = Wd(lz), H = Hh(lz), pts = [[-W, -1.8], [-W, 0.3]];
    for (let i = 1; i < 16; i++) { const a = Math.PI - (i / 16) * Math.PI; pts.push([W * Math.cos(a), 0.3 + H * Math.sin(a)]); }
    pts.push([W, 0.3], [W, -1.8]);
    return { pts, W, H };
  };
  const tubePoint = (lz, k) => {
    const { pts, H } = ringPts(lz);
    const [x, y] = pts[k];
    let nx = x, ny = y - H * 0.5; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const d = y < -0.2 ? 0 : disp(x, y, lz);
    return [x + nx * d * 0.9, Math.max(-1.8, y + ny * d), lz];
  };
  const geoPos = [], geoCol = [], geoUv = [], geoIdx = [];
  const shade = (x, y, z) => { const v = 0.75 + noise.noise3d(x * 0.15, y * 0.15, z * 0.15) * 0.25; return [v * 0.95, v, v * 1.08]; };
  const pushV = (x, y, z) => { geoPos.push(x, y, z); geoCol.push(...shade(x, y, z)); return geoPos.length / 3 - 1; };
  const steps = Math.round((MOUTH - TEND) / 1.2), NR = 19;
  const base = geoPos.length / 3;
  for (let i = 0; i <= steps; i++) {
    const lz = MOUTH - (i / steps) * (MOUTH - TEND);
    for (let k = 0; k < NR; k++) { const p = tubePoint(lz, k); pushV(p[0], p[1], p[2]); }
  }
  for (let i = 0; i < steps; i++) for (let k = 0; k < NR - 1; k++) {
    const a = base + i * NR + k, bb = a + 1, cc = a + NR, d = cc + 1;
    geoIdx.push(a, cc, bb, bb, cc, d);
  }

  // ------------------------------------------------------------ chamber dome (opening cut towards the tunnel)
  const NA = 32, NY = 15, ybase = geoPos.length / 3;
  const rAt = (y) => (y < 1.6 ? CR : CR * Math.sqrt(Math.max(0.015, 1 - ((y - 1.6) / 9.8) ** 2)));
  const domePt = (j, i) => {
    const y = -1.8 + (j / NY) * 12.8, a = (i / NA) * TAU, r = rAt(y);
    const x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
    const d = y < -0.2 ? 0 : disp(x0 + CX, y, z0 + CZ, 1.1);
    const rr = Math.max(0.1, r + d * 0.9 * (r > 1 ? 1 : 0));
    return [CX + Math.cos(a) * rr, y + (y > 8 ? d * 0.5 : 0), CZ + Math.sin(a) * rr];
  };
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NA; i++) { const p = domePt(j, i); pushV(p[0], p[1], p[2]); }
  const inMouth = (x, y, z) => z > CZ + 5 && Math.abs(x) < Wd(z) + 1.2 && y < Hh(z) + 1.2;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) {
    const a = ybase + j * (NA + 1) + i, bb = a + 1, cc = a + NA + 1, d = cc + 1;
    const mx = (geoPos[a * 3] + geoPos[d * 3]) / 2, my = (geoPos[a * 3 + 1] + geoPos[d * 3 + 1]) / 2, mz = (geoPos[a * 3 + 2] + geoPos[d * 3 + 2]) / 2;
    if (inMouth(mx, my, mz)) continue;
    geoIdx.push(a, cc, bb, bb, cc, d);
  }
  // triplanar-ish uv + final geometry
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(geoPos, 3));
  g.setIndex(geoIdx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let i = 0; i < geoPos.length / 3; i++) {
    const x = geoPos[i * 3], y = geoPos[i * 3 + 1], z = geoPos[i * 3 + 2], ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    if (ay > ax && ay > az) geoUv.push(x / 4, z / 4); else if (ax > az) geoUv.push(z / 4, y / 4); else geoUv.push(x / 4, y / 4);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(geoUv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(geoCol, 3));

  b.at(tun.x, oy, tun.z, th, () => {
    b.geo('rock', g, 0, 0, 0, { keepColor: true });

    // ------------------------------------------------------------ colliders along the walls
    for (let lz = TEND + 0.5; lz < MOUTH; lz += 3.8) {
      const W = Wd(lz) - 0.7;
      for (const sx of [-1, 1]) b.solid(sx * (W + 1.0), 3, lz, 2.0, 7, 4.6, { surface: 'stone' });
    }
    const gapA = Math.atan2(13, -CX); // direction chamber → tunnel
    const NRING = 20;
    for (let k = 0; k < NRING; k++) {
      const a = (k / NRING) * TAU;
      let da = Math.abs(((a - gapA + Math.PI) % TAU + TAU) % TAU - Math.PI);
      if (da < 0.52) continue;
      const rr = CR - 0.8;
      b.at(CX, 0, CZ, -a, () => b.solid(rr + 1.1, 3, 0, 2.2, 7, 4.4, { surface: 'stone' }));
    }
    // back of the mouth: seal beyond the entrance (rock face)
    b.solid(0, 3, MOUTH + 1.2, 16, 7, 1.0, { surface: 'stone' });

    // ------------------------------------------------------------ boulders, stalactites, stalagmites
    const rockBlob = (r, seed) => {
      const ge = new THREE.IcosahedronGeometry(r, 1), p = ge.attributes.position;
      for (let i = 0; i < p.count; i++) { const f = 1 + noise.noise3d(p.getX(i) * 1.3 + seed, p.getY(i) * 1.3, p.getZ(i) * 1.3) * 0.32; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.8, p.getZ(i) * f); }
      ge.computeVertexNormals();
      return ge;
    };
    const boulders = [[-2.6, 14, 0.9], [3.3, 9, 0.8], [-3.2, 3, 0.7], [2.8, -4, 1.0], [-3, -8, 0.8], [CX + 6, CZ + 4, 1.2], [CX - 7, CZ - 3, 1.4], [CX + 4, CZ - 9, 1.0], [CX - 3, CZ + 8, 0.9], [CX + 8, CZ - 2, 0.7], [CX - 9, CZ + 4, 1.1], [CX, CZ - 11, 1.3]];
    for (const [bx, bz, br] of boulders) {
      b.geo('rock', rockBlob(br, bx), bx, br * 0.35, bz, { ry: R() * 6, uv: [0.4, 0.4], tint: [0.8, 0.85, 0.9], cc: { surface: 'stone' }, cr: br * 0.95, ch: br });
    }
    for (let i = 0; i < 38; i++) { // stalactites
      const lz = TEND + 2 + R() * (MOUTH - TEND - 6), inChamber = i % 3 === 0;
      let px, pz, py;
      if (inChamber) { const a = R() * TAU, r = R() * 9; px = CX + Math.cos(a) * r; pz = CZ + Math.sin(a) * r; py = 1.6 + 9.8 * Math.sqrt(Math.max(0.05, 1 - (r / CR) ** 2)) - 0.6; }
      else { px = (R() - 0.5) * Wd(lz) * 1.4; pz = lz; py = 0.3 + Hh(lz) * Math.sqrt(Math.max(0.1, 1 - (px / Wd(lz)) ** 2)) - 0.4; }
      const h = 0.8 + R() * 2.0;
      b.cyl('rock', px, py - h / 2, pz, 0.3 + R() * 0.15, 0.03, h, 7, { tint: [0.85, 0.9, 1] });
    }
    for (let i = 0; i < 26; i++) { // stalagmites
      const inChamber = i % 2 === 0;
      let px, pz;
      if (inChamber) { const a = R() * TAU, r = 3 + R() * 8; px = CX + Math.cos(a) * r; pz = CZ + Math.sin(a) * r; if (Math.hypot(px - CX, pz - (CZ + 5.6)) < 3) continue; if (pz > CZ + 6 && Math.abs(px) < 5.5) continue; }
      else { pz = TEND + 2 + R() * 26; const W = Wd(pz); px = (R() < 0.5 ? -1 : 1) * (W * 0.55 + R() * W * 0.3); }
      const h = 0.5 + R() * 1.1;
      b.cyl('rock', px, h / 2, pz, 0.03, 0.2 + R() * 0.14, h, 7, { tint: [0.8, 0.9, 1], cc: h > 0.9 ? { surface: 'stone' } : undefined, cr: 0.3 });
    }

    // ------------------------------------------------------------ mouth: standing stones + wet rock portal
    for (const sx of [-1, 1]) {
      const sxp = sx * (Wd(MOUTH - 3) + 0.2);
      b.box('templeCarved', sxp, 2.4, MOUTH - 2.4, 1.1, 4.8, 1.1, { ry: sx * 0.1, c: { surface: 'stone' }, tint: [0.9, 0.95, 0.9] });
      b.box('temple', sxp, 0.2, MOUTH - 2.4, 1.6, 0.4, 1.6, { tint: [0.8, 0.85, 0.8] });
      b.geo('rock', rockBlob(2.1, sx * 3), sx * (Wd(MOUTH) + 1.6), 1.4, MOUTH - 0.5, { ry: R() * 5, uv: [0.5, 0.5], tint: [0.85, 0.9, 0.95], cc: { surface: 'stone' }, cr: 2.0, ch: 4 });
      b.geo('rock', rockBlob(1.5, sx * 5), sx * (Wd(MOUTH) + 2.9), 0.8, MOUTH - 4, { ry: R() * 5, uv: [0.5, 0.5], tint: [0.8, 0.85, 0.9], cc: { surface: 'stone' }, cr: 1.4, ch: 3 });
    }
    b.box('templeCarved', 0, 5.5, MOUTH - 2.4, Wd(MOUTH - 2.4) * 2 + 1.4, 0.9, 1.1, { tint: [0.9, 0.95, 0.9] }); // lintel (above head)
    b.clutter = true;
    for (let i = 0; i < 14; i++) b.quad('ivy', (R() - 0.5) * 14, 1 + R() * 4, MOUTH - 2.0 + R() * 0.5, 1.6, 1.6, { rz: (R() - 0.5) * 0.7, tint: [0.45 + R() * 0.3, 0.7, 0.5], uv: [1, 1], j: 0.2 });
    b.clutter = false;

    // ------------------------------------------------------------ pedestal with the sun disc, notes, props
    b.at(CX, 0, CZ - 6.2, 0, () => {
      b.cyl('rock', 0, 0.2, 0, 1.25, 1.4, 0.4, 14, { tint: [0.9, 0.95, 1] });
      b.cyl('temple', 0, 0.9, 0, 0.7, 0.85, 1.0, 12, { cc: { surface: 'stone' }, cr: 0.95, tint: [0.9, 0.95, 0.9] });
      b.cyl('templeCarved', 0, 1.46, 0, 0.9, 0.9, 0.14, 12, { tint: [0.95, 1, 0.95] });
      b.cyl('black', 0, 1.54, 0, 0.5, 0.5, 0.02, 20, { tint: [0.6, 0.65, 0.65] });
      S.anchor('cave.sundisc', b.wp(0, 1.58, 0));
    });
    b.at(3.2, 0, 11.5, 0.4, () => { // ledge with the note
      b.geo('rock', rockBlob(0.9, 7), 0, 0.2, 0, { uv: [0.4, 0.4], tint: [0.9, 0.9, 0.95] });
      P.crate(b, 0.0, 0.1, 0.0, { w: 0.6, d: 0.5, h: 0.4, y: 0.35, nc: true });
      S.anchor('note.cave', b.wp(0, 0.83, 0.1));
    });
    P.backpack(b, -2.8, 15.0, 1.0); P.lantern(b, -3.4, 14.3);
    b.clutter = true;
    for (let i = 0; i < 4; i++) b.box('paper', 3.6 + R() * 1.2, 0.02, 11 + R() * 1.2, 0.2, 0.005, 0.28, { ry: R() * 3, tile: 0.3 });
    b.clutter = false;
  });

  // ------------------------------------------------------------ crystals (instanced, emissive) + glow sprites
  buildCrystals(S, { oy, tun, noise, R, tubePoint, ringPts, Wd, Hh, CX, CZ, CR, TEND, MOUTH, world, th });

  // ------------------------------------------------------------ pool side: beacon + note
  const pool = WATERFALL.pool;
  const bx = pool.x + 15.5, bz = pool.z - 2.0;
  placeBeacon(S, 'waterfall.beacon', bx, S.terrain.getHeightAt(bx, bz), bz, -1, 0.15, 5);
  const nb = S.builder('cave_pool', 52);
  const nx = bx - 2.0, nz = bz + 2.4, ny = S.terrain.getHeightAt(nx, nz);
  nb.at(nx, ny, nz, 0.5, () => {
    P.crate(nb, 0, 0, 0, { w: 0.7, d: 0.55, h: 0.45, nc: false });
    S.anchor('note.waterfall', nb.wp(0, 0.5, 0));
    P.barrel(nb, 0.9, 0.4); P.sack(nb, -0.8, 0.5);
  });
  S.commit(nb);

  // ------------------------------------------------------------ interior zones
  const [tzx, tzz] = world(0, (MOUTH - 3 + TEND) / 2);
  S.zone('cave.tunnel', tzx, tzz, 7.5, (MOUTH - 3 - TEND) / 2, th, oy - 2, oy + 9, 0.95);
  S.zone('cave.chamber', cha.x, cha.z, 12.8, 12.8, th, oy - 2, oy + 12, 0.95);
  S.commit(b);
}

function buildCrystals(S, o) {
  const { oy, tun, noise, R, tubePoint, Wd, Hh, CX, CZ, CR, TEND, th } = o;
  const geoC = new THREE.CylinderGeometry(0.0, 0.14, 1, 6, 1); geoC.translate(0, 0.5, 0);
  const geoTop = new THREE.CylinderGeometry(0.1, 0.12, 0.4, 6, 1); geoTop.translate(0, 0.2, 0);
  const mk = (color) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.4), emissive: color, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
    return m;
  };
  const matT = mk(0x22ffd6), matV = mk(0xa070ff);
  const N = 190;
  const iT = new THREE.InstancedMesh(geoC, matT, N), iV = new THREE.InstancedMesh(geoC, matV, N);
  let nt = 0, nv = 0;
  const d = new THREE.Object3D(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const glowPos = [], glowCol = [];
  const cluster = (lx, ly, lz, nx, ny, nz, violet) => {
    const cnt = 4 + Math.floor(R() * 4);
    for (let i = 0; i < cnt; i++) {
      dir.set(nx + (R() - 0.5) * 0.9, ny + (R() - 0.5) * 0.9, nz + (R() - 0.5) * 0.9).normalize();
      q.setFromUnitVectors(up, dir);
      const len = 0.5 + R() * 1.1 * (i === 0 ? 1.5 : 1), w = 0.6 + R() * 0.9;
      d.position.set(lx + (R() - 0.5) * 0.4, ly + (R() - 0.5) * 0.4, lz + (R() - 0.5) * 0.4);
      d.quaternion.copy(q); d.scale.set(w, len, w); d.updateMatrix();
      // frame (tunnel local) → world
      d.matrix.premultiply(frame);
      const isV = violet || R() < 0.2;
      if (isV ? nv < N : nt < N) (isV ? iV : iT).setMatrixAt(isV ? nv++ : nt++, d.matrix);
    }
    const wp = new THREE.Vector3(lx, ly, lz).applyMatrix4(frame);
    glowPos.push(wp.x + nx * 0.5, wp.y + ny * 0.5, wp.z + nz * 0.5);
    violet ? glowCol.push(0.6, 0.4, 1) : glowCol.push(0.2, 1, 0.85);
  };
  const frame = new THREE.Matrix4().compose(new THREE.Vector3(tun.x, oy, tun.z), new THREE.Quaternion().setFromAxisAngle(up, th), new THREE.Vector3(1, 1, 1));
  // tunnel clusters: on walls/ceiling
  for (let i = 0; i < 20; i++) {
    const lz = TEND + 1 + R() * (o.MOUTH - TEND - 6), k = 3 + Math.floor(R() * 13);
    const p = tubePoint(lz, k);
    const cy = Hh(lz) * 0.5 + 0.3, nx = -p[0], ny = cy - p[1], nlen = Math.hypot(nx, ny) || 1;
    cluster(p[0], p[1], p[2], nx / nlen, ny / nlen, 0, i % 4 === 0);
  }
  for (let i = 0; i < 4; i++) cluster((R() < 0.5 ? -1 : 1) * (Wd(14) - 0.6), 0.1, 14 + R() * 4, 0, 1, 0, false); // near the mouth, faint
  // chamber clusters
  for (let i = 0; i < 20; i++) {
    const a = R() * TAU, y = R() * 7, r = CR * 0.98 * (y < 1.6 ? 1 : Math.sqrt(Math.max(0.05, 1 - ((y - 1.6) / 9.8) ** 2)));
    const lx = CX + Math.cos(a) * (r - 0.4), lz = CZ + Math.sin(a) * (r - 0.4);
    if (lz > CZ + 6 && Math.abs(lx) < 5.5) continue;
    const nx = -Math.cos(a), nz = -Math.sin(a);
    cluster(lx, y, lz, nx, 0.45, nz, i % 3 === 0);
  }
  for (let i = 0; i < 6; i++) { const a = R() * TAU, r = 3 + R() * 6; cluster(CX + Math.cos(a) * r, 0.05, CZ + Math.sin(a) * r - 2, 0, 1, 0, i % 2 === 0); }
  iT.count = nt; iV.count = nv;
  iT.instanceMatrix.needsUpdate = true; iV.instanceMatrix.needsUpdate = true;
  iT.frustumCulled = false; iV.frustumCulled = false;
  S.root.add(iT, iV);
  // glow sprites
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(glowCol, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 4.2, map: tex, vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  pts.frustumCulled = false;
  S.root.add(pts);
  S.anim.push((dt, t) => {
    matT.emissiveIntensity = 1.0 + Math.sin(t * 1.3) * 0.35;
    matV.emissiveIntensity = 1.1 + Math.sin(t * 1.1 + 1.7) * 0.4;
    pts.material.opacity = 0.5 + Math.sin(t * 0.9) * 0.12;
  });
  void noise;
}
