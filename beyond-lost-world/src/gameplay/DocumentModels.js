// Procedural models for readable objects (logbook, paper notes, leather journal, tape recorder, stone tablet).
// All models rest on y = 0 and are roughly 0.2-0.45 m wide, so they look right on a desk or the floor.
import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mulberry32 } from '../world/layout.js';
import { notebookCoverTexture, paperTexture, journalCoverTexture, leatherTexture, tabletTexture, reelTexture } from './ModelTextures.js';

const mats = {};
const mat = (key, make) => (mats[key] ||= make());
const std = (o) => new THREE.MeshStandardMaterial(o);

function mesh(geo, material, { cast = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = true; return m; }

function displace(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}

function notebook() {
  const g = new THREE.Group();
  const cover = mat('nb_cover', () => std({ map: notebookCoverTexture(), roughness: 0.75 }));
  const coverSide = mat('nb_side', () => std({ color: 0x1d3140, roughness: 0.8 }));
  const pages = mat('nb_pages', () => std({ color: 0xd9d1b8, roughness: 0.95 }));
  const W = 0.2, D = 0.27;
  // BoxGeometry: +x -x +y -y +z -z ; pages visible on three sides
  const back = mesh(new THREE.BoxGeometry(W, 0.006, D), coverSide); back.position.y = 0.003;
  const block = mesh(new THREE.BoxGeometry(W - 0.012, 0.03, D - 0.01), pages); block.position.set(0.002, 0.021, 0);
  const top = mesh(new THREE.BoxGeometry(W, 0.007, D), [coverSide, coverSide, cover, coverSide, coverSide, coverSide]); top.position.y = 0.0395;
  const spine = mesh(new THREE.BoxGeometry(0.014, 0.043, D + 0.002), coverSide); spine.position.set(-W / 2 + 0.002, 0.0215, 0);
  const band = mesh(new THREE.BoxGeometry(0.014, 0.047, D + 0.004), mat('nb_band', () => std({ color: 0x14100e, roughness: 0.6 }))); band.position.set(0.045, 0.0225, 0);
  g.add(back, block, top, spine, band);
  const pen = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.15, 10), mat('pen', () => std({ color: 0xb02e22, roughness: 0.4, metalness: 0.2 })));
  pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.3; pen.position.set(0.02, 0.052, 0.04);
  g.add(pen);
  const tip = mesh(new THREE.ConeGeometry(0.0055, 0.016, 10), mat('pen_tip', () => std({ color: 0x222222, roughness: 0.4 })));
  tip.rotation.z = Math.PI / 2; tip.rotation.y = 0.3; tip.position.set(0.098, 0.052, 0.0165); g.add(tip);
  g.rotation.y = 0.35;
  return g;
}

function paper() {
  const noise = new SimplexNoise({ random: mulberry32(71) });
  const group = new THREE.Group();
  const m = mat('paper', () => std({ map: paperTexture(), roughness: 0.95, side: THREE.DoubleSide }));
  const m2 = mat('paper2', () => std({ map: paperTexture('#cbbf9d'), roughness: 0.95, side: THREE.DoubleSide }));
  [[0.2, 0.28, 0.0, 0.2, m2], [0.2, 0.27, 0.012, -0.12, m]].forEach(([w, d, y, rot, material], i) => {
    const geo = new THREE.PlaneGeometry(w, d, 10, 12);
    geo.rotateX(-Math.PI / 2);
    displace(geo, (v) => {
      v.y += 0.006 * noise.noise3d(v.x * 9 + i * 5, 0, v.z * 9) + 0.02 * Math.max(0, Math.abs(v.x) / (w / 2) - 0.7) ** 2 * (v.z > 0 ? 1 : 0.4);
      v.y += y + 0.001;
    });
    geo.rotateY(rot);
    group.add(mesh(geo, material));
  });
  // a small pebble keeps the paper down
  const pebble = new THREE.DodecahedronGeometry(0.03, 1);
  displace(pebble, (v) => { v.y *= 0.55; v.multiplyScalar(1 + 0.12 * noise.noise3d(v.x * 30, v.y * 30, v.z * 30)); });
  const p = mesh(pebble, mat('pebble', () => std({ color: 0x7a766e, roughness: 0.9, flatShading: true })));
  p.position.set(-0.05, 0.026, -0.07); group.add(p);
  return group;
}

function journal() {
  const g = new THREE.Group();
  const cover = mat('jr_cover', () => std({ map: journalCoverTexture(), roughness: 0.7 }));
  const leather = mat('jr_leather', () => std({ map: leatherTexture(), roughness: 0.7 }));
  const pages = mat('jr_pages', () => std({ color: 0xd2c6a4, roughness: 0.95 }));
  const metal = mat('jr_metal', () => std({ color: 0xb08a3c, roughness: 0.4, metalness: 0.7 }));
  const W = 0.22, D = 0.3;
  const bottom = mesh(new THREE.BoxGeometry(W, 0.008, D), leather); bottom.position.y = 0.004;
  const block = mesh(new THREE.BoxGeometry(W - 0.016, 0.046, D - 0.014), pages); block.position.set(0.004, 0.031, 0);
  const top = mesh(new THREE.BoxGeometry(W, 0.01, D), [leather, leather, cover, leather, leather, leather]); top.position.y = 0.059;
  g.add(bottom, block, top);
  const sp = mesh(new THREE.BoxGeometry(0.018, 0.068, D + 0.002), leather); sp.position.set(-W / 2 + 0.002, 0.034, 0); g.add(sp);
  for (let i = 0; i < 4; i++) { const r = mesh(new THREE.BoxGeometry(0.022, 0.07, 0.008), metal); r.position.set(-W / 2 + 0.002, 0.034, -0.1 + i * 0.066); g.add(r); }
  const strap = mesh(new THREE.BoxGeometry(0.1, 0.004, 0.026), leather); strap.position.set(W / 2 - 0.04, 0.066, 0); g.add(strap);
  const clasp = mesh(new THREE.BoxGeometry(0.018, 0.008, 0.03), metal); clasp.position.set(W / 2 - 0.006, 0.066, 0); g.add(clasp);
  g.rotation.y = -0.4;
  return g;
}

function recorder() {
  const g = new THREE.Group();
  const body = mat('rec_body', () => std({ color: 0x5b6460, roughness: 0.55, metalness: 0.35 }));
  const dark = mat('rec_dark', () => std({ color: 0x1b1d1e, roughness: 0.6 }));
  const reel = mat('rec_reel', () => std({ map: reelTexture(), roughness: 0.5, metalness: 0.2 }));
  const b = mesh(new THREE.BoxGeometry(0.3, 0.075, 0.2, 1, 1, 1), body); b.position.y = 0.0375; g.add(b);
  const panel = mesh(new THREE.BoxGeometry(0.28, 0.004, 0.18), dark); panel.position.y = 0.077; g.add(panel);
  for (const x of [-0.07, 0.07]) {
    const r = mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 32), [dark, reel, dark]); r.position.set(x, 0.087, -0.025); g.add(r);
    const hub = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10), mat('rec_hub', () => std({ color: 0xcfcfcf, metalness: 0.8, roughness: 0.3 }))); hub.position.set(x, 0.093, -0.025); g.add(hub);
  }
  const keys = [0xb9b2a0, 0xb9b2a0, 0xb9b2a0, 0xb02e22];
  keys.forEach((c, i) => { const k = mesh(new THREE.BoxGeometry(0.036, 0.012, 0.02), mat('rec_key' + i, () => std({ color: c, roughness: 0.5 }))); k.position.set(-0.075 + i * 0.05, 0.083, 0.07); g.add(k); });
  const led = mesh(new THREE.SphereGeometry(0.006, 10, 8), mat('rec_led', () => new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a12, emissiveIntensity: 1.6 })), { cast: false });
  led.position.set(0.12, 0.081, 0.07); g.add(led);
  const mic = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.06, 12), dark); mic.rotation.z = Math.PI / 2; mic.position.set(-0.19, 0.03, 0.05); g.add(mic);
  const cord = mesh(new THREE.TorusGeometry(0.04, 0.003, 6, 18, Math.PI * 1.4), dark, { cast: false }); cord.rotation.x = Math.PI / 2; cord.position.set(-0.165, 0.004, 0.05); g.add(cord);
  const handle = mesh(new THREE.TorusGeometry(0.06, 0.006, 6, 16, Math.PI), dark); handle.rotation.set(0, 0, 0); handle.position.set(0, 0.075, 0.1); handle.rotation.x = Math.PI / 2; g.add(handle);
  g.rotation.y = 0.5;
  return g;
}

function tablet() {
  const noise = new SimplexNoise({ random: mulberry32(81) });
  const geo = new THREE.BoxGeometry(0.42, 0.07, 0.54, 10, 2, 12);
  displace(geo, (v) => {
    const k = 0.012 * noise.noise3d(v.x * 8, v.y * 8, v.z * 8);
    v.x += k; v.z += k; v.y += 0.008 * noise.noise3d(v.x * 12, 1, v.z * 12);
    if (v.y > 0.02) { v.x *= 0.97; v.z *= 0.97; }
  });
  const face = mat('tab_face', () => std({ map: tabletTexture(), roughness: 0.9, emissive: 0x2a5a66, emissiveMap: tabletTexture(), emissiveIntensity: 0.0 }));
  const side = mat('tab_side', () => std({ color: 0x6a655d, roughness: 0.95 }));
  geo.translate(0, 0.035, 0);
  const m = mesh(geo, [side, side, face, side, side, side]);
  const g = new THREE.Group(); g.add(m);
  g.rotation.y = 0.2;
  return g;
}

const MODELS = { notebook, paper, journal, recorder, tablet };

/** Creates the model for a readable object. `type`: notebook | paper | journal | recorder | tablet. */
export function createDocumentModel(type) {
  const fn = MODELS[type];
  if (!fn) throw new Error(`No document model "${type}"`);
  const g = fn();
  g.name = `doc_${type}`;
  return g;
}
