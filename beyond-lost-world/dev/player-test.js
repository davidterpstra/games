// Self-contained test world for the player module (flat ground, hill, stairs, platform, room with
// doorway + door + ceiling, tree row, pond, steep ramp). Exposes window.TEST for dev/player-test.mjs.
import * as THREE from 'three';
import { bus } from '../src/core/EventBus.js';
import { Input } from '../src/player/Input.js';
import { PlayerController } from '../src/player/PlayerController.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const HILL = { x: -35, z: 12, a: 5, s: 8 };
const POND = { x: 0, z: 42, a: 2.5, s2: 50 };

function height(x, z) {
  let y = HILL.a * Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / (2 * HILL.s * HILL.s));
  y -= POND.a * Math.exp(-((x - POND.x) ** 2 + (z - POND.z) ** 2) / POND.s2);
  if (Math.abs(z) < 8) y += Math.min(6, Math.max(0, (x - 30) * 1.8));   // steep ramp (~61°)
  return y;
}

const colliders = [];
const meshes = [];
const boxMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
function addBox(id, x, z, hx, hz, yMin, yMax, color, surface = 'stone', rot = 0) {
  const c = { id, type: 'box', x, z, hx, hz, rot, yMin, yMax, enabled: true, surface };
  colliders.push(c);
  const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, yMax - yMin, hz * 2), boxMat(color));
  m.position.set(x, (yMin + yMax) / 2, z);
  m.rotation.y = rot;
  meshes.push(m);
  return { c, m };
}
// stairs (6 × 0.3 m) climbing towards +x, then a platform
for (let i = 0; i < 6; i++) addBox(`step${i}`, 10.4 + i * 0.8, -10, 0.4, 1.2, 0, 0.3 * (i + 1), 0x8d8578, 'stone');
addBox('platform', 17.3, -10, 2.5, 2.5, 0, 1.8, 0x7a7266, 'wood');
// room (−24..−16 × −29..−21): doorway (1.4 m) in the south wall, door in the north wall, ceiling
const W = 0xb8a98a;
addBox('wallN1', -22.35, -29, 1.65, 0.2, 0, 2.4, W); addBox('wallN2', -17.65, -29, 1.65, 0.2, 0, 2.4, W);
const door = addBox('door1', -20, -29, 0.7, 0.15, 0, 2.4, 0x6b4a2b, 'wood');
addBox('wallS1', -22.35, -21, 1.65, 0.2, 0, 2.4, W); addBox('wallS2', -17.65, -21, 1.65, 0.2, 0, 2.4, W);
addBox('wallW', -24, -25, 0.2, 4.2, 0, 2.4, W); addBox('wallE', -16, -25, 0.2, 4.2, 0, 2.4, W);
addBox('ceiling', -20, -25, 4.2, 4.2, 2.4, 2.7, 0x9c8f75, 'stone');
// tree row (gap 0.4 m: not passable)
const trunkGeo = new THREE.CylinderGeometry(0.5, 0.6, 5, 10);
const crownGeo = new THREE.ConeGeometry(1.8, 4, 10);
const trunkMat = boxMat(0x5a3d22), crownMat = boxMat(0x2f5d34);
for (let i = 0; i < 8; i++) {
  const x = -5 + i * 1.4, z = 12;
  colliders.push({ id: `tree${i}`, type: 'circle', x, z, r: 0.5, yMin: 0, yMax: 5, enabled: true, surface: 'dirt' });
  const t = new THREE.Mesh(trunkGeo, trunkMat); t.position.set(x, 2.5, z); meshes.push(t);
  const c = new THREE.Mesh(crownGeo, crownMat); c.position.set(x, 6, z); meshes.push(c);
}
// a stump to stand on
colliders.push({ id: 'stump', type: 'circle', x: 4, z: -4, r: 0.6, yMin: 0, yMax: 0.4, enabled: true, surface: 'wood' });
{ const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12), trunkMat); m.position.set(4, 0.2, -4); meshes.push(m); }
// a rotated wall
addBox('rotWall', 0, -20, 12, 0.2, 0, 2.4, 0x998877, 'stone', Math.PI / 4);

const world = {
  colliders,
  bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
  getHeightAt: height,
  getNormalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.5;
    return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
  },
  getSurfaceAt(x, z) { return this.getWaterSurfaceAt(x, z) !== null ? 'water' : height(x, z) > 1 ? 'dirt' : 'grass'; },
  getWaterSurfaceAt(x, z) { return height(x, z) < -0.15 ? 0 : null; },
  setColliderEnabled(id, on) { const c = colliders.find((k) => k.id === id); if (c) { c.enabled = on; if (id === 'door1') door.m.visible = on; } },
};

// ---- scene -------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4dd);
scene.fog = new THREE.Fog(0x9fc4dd, 40, 140);
scene.add(new THREE.HemisphereLight(0xdfeeff, 0x4a5a3a, 1.0));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.2); sun.position.set(30, 50, 20); scene.add(sun);

const SEG = 240, SIZE = 130;
const gGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
gGeo.rotateX(-Math.PI / 2);
{
  const pos = gGeo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = height(x, z);
    pos.setY(i, y);
    c.setHSL(0.27 - Math.min(0.1, Math.max(0, y) * 0.015), 0.4, y < -0.3 ? 0.22 : 0.3 + Math.random() * 0.03);
    col.set([c.r, c.g, c.b], i * 3);
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  gGeo.computeVertexNormals();
}
scene.add(new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.7, roughness: 0.2 }));
water.position.y = 0.0; scene.add(water);
water.position.set(POND.x, 0.0, POND.z); water.scale.set(0.2, 1, 0.2); // pond-sized patch
meshes.forEach((m) => scene.add(m));

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 300);
scene.add(camera);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const input = new Input({ domElement: renderer.domElement, bus });
input.enabled = true;
const player = new PlayerController({ camera, input, world, bus });
player.teleport(new THREE.Vector3(0, 0, 0), 0);
input.lock();

const events = [];
for (const n of ['player:step', 'player:jump', 'player:land']) bus.on(n, (e) => events.push({ n, ...e }));
const actions = [];
bus.on('input:action', (e) => actions.push(e.action));

const TEST = window.TEST = {
  THREE, world, player, input, camera, bus, events, actions, auto: true,
  reset(x, z, yaw = 0, y = 0) {
    input.keys.clear(); input.touchMove.x = input.touchMove.z = 0; input.touchSprint = false; input.touchRun = false;
    player.teleport(new THREE.Vector3(x, y, z), yaw, 0);
    player.state.stamina = 1; player._exhausted = false; player._sinceSprint = 10;
    events.length = 0; actions.length = 0;
  },
  key(code, down = true) {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }));
  },
  /** Steps the controller `seconds` of game time at fixed dt; returns the trace extremes. */
  run(seconds, dt = 1 / 60, each) {
    const n = Math.round(seconds / dt);
    const s = player.state;
    const t = { maxY: s.position.y, minY: s.position.y };
    for (let i = 0; i < n; i++) {
      player.update(dt);
      t.maxY = Math.max(t.maxY, s.position.y); t.minY = Math.min(t.minY, s.position.y);
      if (each) each(s);
    }
    return t;
  },
  /** Holds keys for `seconds` then releases them. */
  hold(codes, seconds, dt = 1 / 60) {
    codes.forEach((c) => TEST.key(c, true));
    const t = TEST.run(seconds, dt);
    codes.forEach((c) => TEST.key(c, false));
    return t;
  },
  snap() {
    const s = player.state;
    return { x: s.position.x, y: s.position.y, z: s.position.z, vx: s.velocity.x, vy: s.velocity.y, vz: s.velocity.z, yaw: s.yaw, onGround: s.onGround, sprinting: s.sprinting, stamina: s.stamina, surface: s.surface, inWater: s.inWater };
  },
};

const hud = document.getElementById('hud');
let last = performance.now();
let frames = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (TEST.auto) player.update(dt);
  renderer.render(scene, camera);
  if (++frames % 10 === 0) {
    const s = player.state;
    hud.textContent = `pos ${s.position.x.toFixed(2)} ${s.position.y.toFixed(2)} ${s.position.z.toFixed(2)}  ${s.surface}${s.inWater ? ' (water)' : ''}\nground ${s.onGround}  stamina ${(s.stamina * 100).toFixed(0)}%  sprint ${s.sprinting}\ntouch ${input.isTouch}  locked ${input.isLocked}`;
  }
});
window.TEST_READY = true;
