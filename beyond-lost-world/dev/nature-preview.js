// Preview page for the nature module: stand-in sun / sky / fog, URL-param camera, test helpers on window.
// ?x=&y=&z=&lx=&ly=&lz=&q=high|medium|low  (y omitted → eye height above terrain), &fov=, &time=sun elevation (deg)
import * as THREE from 'three';
import { createNature } from '../src/world/nature/index.js';
import { QUALITY_PRESETS } from '../src/core/quality.js';

const P = new URLSearchParams(location.search);
const num = (k, d) => (P.has(k) ? parseFloat(P.get(k)) : d);
const q = P.get('q') || 'high';
const preset = QUALITY_PRESETS[q];
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, num('pr', 1)));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x9cc4e4);
scene.background = skyColor;
scene.fog = new THREE.Fog(0xb4cfe0, 80, P.has('nofog') ? 1e5 : preset.viewDistance);
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a4630, 1.0);
scene.add(hemi);
const elev = THREE.MathUtils.degToRad(num('sun', 48));
const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
const sd = preset.shadowDistance;
Object.assign(sun.shadow.camera, { left: -sd, right: sd, top: sd, bottom: -sd, near: 1, far: 500 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
const sunDir = new THREE.Vector3(Math.cos(elev) * 0.6, Math.sin(elev), Math.cos(elev) * 0.8).normalize();
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(num('fov', 70), innerWidth / innerHeight, 0.1, 1500);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const t0 = performance.now();
const nature = await createNature({ scene, renderer, quality: q, onProgress: (p, label) => { hud.textContent = `${(p * 100) | 0}% ${label}`; } });
window.__nature = nature; window.__scene = scene; window.__renderer = renderer; window.__camera = camera; window.THREE = THREE;
const loadMs = performance.now() - t0;

const x = num('x', 20), z = num('z', 215);
const ground = nature.terrain.getHeightAt(x, z);
const y = P.has('y') ? num('y', 0) : ground + 1.7;
camera.position.set(x, y, z);
const lx = num('lx', 20), lz = num('lz', 120);
camera.lookAt(lx, P.has('ly') ? num('ly', 0) : nature.terrain.getHeightAt(lx, lz) + 4, lz);

let frames = 0;
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  sun.position.copy(camera.position).addScaledVector(sunDir, 200);
  sun.target.position.copy(camera.position);
  nature.update(dt, clock.elapsedTime, camera.position);
  renderer.render(scene, camera);
  frames++;
  if (frames % 10 === 0) {
    const i = renderer.info.render;
    hud.textContent = `load ${(loadMs / 1000).toFixed(1)}s  calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(0)}k  q=${q}`;
  }
  if (!P.has('frames') || frames < num('frames', 3)) requestAnimationFrame(frame); else window.__done = true;
}
window.__ready = true;
frame();
