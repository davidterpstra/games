// Structures module: research station, village, temple, bunker, cave, bridges, beacons, props.
// See docs/ARCHITECTURE.md → createStructures.
import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { createSite } from './site.js';
import { buildStation } from './station.js';
import { buildVillage } from './village.js';
import { buildTemple } from './temple.js';
import { buildBunker } from './bunker.js';
import { buildCave } from './cave.js';
import { buildWorldProps } from './world.js';

const nextFrame = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

/**
 * Builds every structure and returns the world-facing API.
 * @param {{scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: string, terrain: object, onProgress?: (p:number,label:string)=>void}} opts
 */
export async function createStructures({ scene, renderer, quality = 'medium', terrain, onProgress = () => {} }) {
  const root = new THREE.Group();
  root.name = 'structures';
  scene.add(root);
  onProgress(0.0, 'Materialen en texturen maken…');
  await nextFrame();
  const lib = createMaterials({ renderer, quality });
  const S = createSite(lib, terrain, root);

  const steps = [
    ['Onderzoeksstation Kestrel bouwen…', buildStation],
    ['Verlaten dorp Valdris bouwen…', buildVillage],
    ['De Zonnetempel oprichten…', buildTemple],
    ['Bunker K-7 graven…', buildBunker],
    ['De Kristalgrot uithollen…', buildCave],
    ['Bruggen, kampen en ruïnes plaatsen…', buildWorldProps],
  ];
  for (let i = 0; i < steps.length; i++) {
    onProgress(0.08 + (i / steps.length) * 0.9, steps[i][0]);
    await nextFrame();
    steps[i][1](S);
  }
  onProgress(1, 'Bouwwerken klaar');

  const setQuality = (name) => {
    const hide = name === 'low';
    for (const m of S.clutter) m.visible = !hide;
  };
  setQuality(quality);

  return {
    root,
    ruinSpots: S.ruinSpots,
    colliders: S.colliders,
    anchors: S.anchors,
    interiorZones: S.zones,
    resourceSpots: S.resources,
    /** @param {'bunker'} group @param {boolean} on */
    setPowered(group, on) { if (group === 'bunker') S.setBunkerPower?.(!!on); },
    update(dt, elapsed, camPos) { for (const f of S.anim) f(dt, elapsed, camPos); },
    setQuality,
  };
}
