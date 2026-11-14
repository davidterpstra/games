// Preview of all procedural item / document models. ?item=wood (single, close up) or ?docs (documents) or nothing (all items).
import * as THREE from 'three';
import { createItemObject } from '../src/gameplay/ItemModels.js';
import { createGlint } from '../src/gameplay/Pickups.js';
import { createDocumentModel } from '../src/gameplay/DocumentModels.js';

const params = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8aa0b0);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.02, 50);
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x4a3c2a, 1.1));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
sun.position.set(-2, 3, 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 12 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x5c4a34, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const items = ['wood', 'stone', 'fiber', 'resin', 'cloth', 'scrap', 'sundisc', 'keycard'];
const docs = ['notebook', 'paper', 'journal', 'recorder', 'tablet'];
const single = params.get('item') || params.get('doc');
const list = single ? [single] : params.has('docs') ? docs : items;
const make = (t) => (docs.includes(t) ? createDocumentModel(t) : createItemObject(t));
const spacing = single ? 0 : 0.55;
list.forEach((t, i) => { const o = make(t); o.position.x = (i - (list.length - 1) / 2) * spacing; scene.add(o); });
if (single) {
  const d = Number(params.get('d') || 0.7);
  camera.position.set(d * 0.6, d * 0.75, d * 0.9); camera.lookAt(0, 0.04, 0);
} else {
  const w = list.length * spacing;
  camera.position.set(0, w * 0.35, w * 0.55); camera.lookAt(0, 0.04, 0);
}
if (params.has('glint')) { list.forEach((t, i) => { const g = createGlint(); g.position.x = (i - (list.length - 1) / 2) * spacing; scene.add(g); }); scene.background = new THREE.Color(0x10141a); }
renderer.render(scene, camera);
window.__ready = true;
