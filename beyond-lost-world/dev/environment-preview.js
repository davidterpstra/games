// Environment preview: stand-in world (hills, trees, ruins, huts with interior zones) to test sky, light,
// weather, torch and audio. URL: ?t=18.5&w=rain&cam=x,z,yawDeg,pitchDeg&torch=1&q=high&sim=1
import * as THREE from 'three';
import { bus } from '../src/core/EventBus.js';
import { Settings } from '../src/core/Settings.js';
import { QUALITY_PRESETS } from '../src/core/quality.js';
import { createEnvironment } from '../src/environment/Environment.js';
import { SFX_NAMES } from '../src/environment/audio/sfx.js';

const params = new URLSearchParams(location.search);
const qualityName = params.get('q') || 'medium';
const preset = QUALITY_PRESETS[qualityName];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, preset.viewDistance);
scene.add(camera);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---- stand-in world -------------------------------------------------------------------------
const hillY = (x, z) => 5 * Math.sin(x * 0.02) * Math.cos(z * 0.025) + 2.2 * Math.sin(x * 0.07 + z * 0.05) + 0.8 * Math.sin(x * 0.19) * Math.sin(z * 0.17);
const zones = [
  { id: 'hut', x: 30, z: -10, hx: 6, hz: 5, rot: 0, yMin: -50, yMax: 100, darkness: 0.3 },
  { id: 'cave', x: -30, z: -10, hx: 6, hz: 5, rot: 0, yMin: -50, yMax: 100, darkness: 1.0 },
];
const world = {
  interiorZones: zones,
  getHeightAt: (x, z) => hillY(x, z),
  interiorAt(p) {
    for (const z of zones) {
      if (p.y < z.yMin || p.y > z.yMax) continue;
      const c = Math.cos(z.rot), s = Math.sin(z.rot), dx = p.x - z.x, dz = p.z - z.z;
      if (Math.abs(dx * c - dz * s) <= z.hx && Math.abs(dx * s + dz * c) <= z.hz) return z;
    }
    return null;
  },
  setPowered() {},
};
{
  const N = 220, size = 640;
  const g = new THREE.PlaneGeometry(size, size, N, N);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, hillY(x, z));
    const n = 0.5 + 0.5 * Math.sin(x * 0.31) * Math.sin(z * 0.27) + 0.3 * Math.sin(x * 0.9 + z * 0.7);
    c.setHSL(0.27 + n * 0.04, 0.45, 0.2 + n * 0.07);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = true;
  scene.add(m);
}
const stone = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.95 });
const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
const addBox = (x, y, z, sx, sy, sz, mat, ry = 0) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; scene.add(b); return b;
};
// trees
{
  const trunkG = new THREE.CylinderGeometry(0.25, 0.4, 5, 8).translate(0, 2.5, 0);
  const leafG = new THREE.ConeGeometry(2.6, 7, 9).translate(0, 7.5, 0);
  const rnd = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  const pts = [];
  while (pts.length < 260) { const x = (rnd() - 0.5) * 360, z = (rnd() - 0.5) * 360; if (Math.hypot(x - 30, z + 10) > 14 && Math.hypot(x + 30, z + 10) > 14 && Math.hypot(x, z) > 8) pts.push([x, z, 0.7 + rnd() * 0.8]); }
  const tm = new THREE.InstancedMesh(trunkG, wood, pts.length), lm = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: 0x2c5a2a, roughness: 0.9 }), pts.length);
  const d = new THREE.Object3D();
  pts.forEach(([x, z, s], i) => { d.position.set(x, hillY(x, z), z); d.scale.setScalar(s); d.updateMatrix(); tm.setMatrixAt(i, d.matrix); lm.setMatrixAt(i, d.matrix); });
  tm.castShadow = lm.castShadow = true; tm.receiveShadow = lm.receiveShadow = true;
  scene.add(tm, lm);
}
// ruins + a standing stone ring
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 9, z = 18 + Math.sin(a) * 9;
  addBox(x, hillY(x, z) + 2, z, 1.4, 4, 1.4, stone, a);
}
addBox(0, hillY(0, 18) + 0.4, 18, 5, 0.8, 5, stone);
// hut (zone 'hut') and cave-like closed room
function room(cx, cz, hx, hz, h, mat) {
  const y = hillY(cx, cz);
  addBox(cx, y + h / 2, cz - hz, hx * 2, h, 0.4, mat);
  addBox(cx - hx, y + h / 2, cz, 0.4, h, hz * 2, mat);
  addBox(cx + hx, y + h / 2, cz, 0.4, h, hz * 2, mat);
  addBox(cx - hx * 0.62, y + h / 2, cz + hz, hx * 0.76, h, 0.4, mat);
  addBox(cx + hx * 0.62, y + h / 2, cz + hz, hx * 0.76, h, 0.4, mat);
  addBox(cx, y + h + 0.2, cz, hx * 2 + 1, 0.4, hz * 2 + 1, mat);
  addBox(cx, y + 0.05, cz, hx * 2, 0.1, hz * 2, stone);
  addBox(cx, y + 0.6, cz - hz + 1.2, 2.6, 1.2, 1, wood);
}
room(30, -10, 6, 5, 3.5, wood);
room(-30, -10, 6, 5, 3.5, stone);

// ---- environment -------------------------------------------------------------------------------
const env = createEnvironment({ scene, renderer, camera, world, bus, settings: Settings, quality: qualityName });
env.autoWeather = false;
env.setTimeOfDay(parseFloat(params.get('t') ?? '7.5'));
env.setWeather(params.get('w') || 'clear', true);
if (params.get('torch') === '1') { env.setTorch(true); }
window.__env = env; window.__camera = camera; window.__scene = scene; window.__renderer = renderer; window.__bus = bus;

// ---- camera / free fly --------------------------------------------------------------------------
const cam = (params.get('cam') || '0,40,200,-8').split(',').map(Number);
const player = new THREE.Vector3(cam[0], 0, cam[1]);
let yaw = THREE.MathUtils.degToRad(cam[2] ?? 0), pitch = THREE.MathUtils.degToRad(cam[3] ?? 0);
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code === 'KeyF') env.setTorch(!env.torchOn); if (e.code === 'KeyH') document.getElementById('panel').classList.toggle('hidden'); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
let drag = false;
renderer.domElement.addEventListener('pointerdown', () => { drag = true; });
addEventListener('pointerup', () => { drag = false; });
addEventListener('pointermove', (e) => { if (!drag) return; yaw -= e.movementX * 0.004; pitch = Math.max(-1.4, Math.min(1.4, pitch - e.movementY * 0.004)); });
const feet = new THREE.Vector3();
let stepAcc = 0;
const clock = new THREE.Clock();
let sim = params.get('sim') === '1';
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const sp = (keys.ShiftLeft ? 12 : 5) * dt;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let mx = 0, mz = 0;
  if (keys.KeyW) { mx += fx; mz += fz; } if (keys.KeyS) { mx -= fx; mz -= fz; }
  if (keys.KeyA) { mx += fz; mz -= fx; } if (keys.KeyD) { mx -= fz; mz += fx; }
  player.x += mx * sp; player.z += mz * sp;
  if (mx || mz) { stepAcc += sp; if (stepAcc > 2.2) { stepAcc = 0; bus.emit('player:step', { surface: 'grass', sprint: !!keys.ShiftLeft }); } }
  player.y = hillY(player.x, player.z);
  camera.position.set(player.x, player.y + 1.7, player.z);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  feet.copy(player);
  env.update(dt, feet, { simulate: sim });
  document.getElementById('tl').textContent = env.getTimeOfDay().toFixed(2) + ' u · ' + env.weather;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
// UI
const $ = (id) => document.getElementById(id);
$('time').value = env.getTimeOfDay();
$('time').oninput = (e) => env.setTimeOfDay(parseFloat(e.target.value));
$('wsel').value = env.weather; $('wsel').onchange = (e) => env.setWeather(e.target.value);
$('torch').onclick = () => env.setTorch(!env.torchOn);
$('audio').onclick = () => { env.audio.unlock(); $('audio').textContent = 'Audio actief'; };
$('sim').checked = sim; $('sim').onchange = (e) => { sim = e.target.checked; };
SFX_NAMES.forEach((n) => { const o = document.createElement('option'); o.textContent = n; $('sfx').appendChild(o); });
$('playsfx').onclick = () => { env.audio.unlock(); env.audio.play($('sfx').value); };
loop();
