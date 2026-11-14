// Emergency radio beacons (checkpoints): one factory used by every site.
import { makeBeacon } from './props.js';

/**
 * Places a beacon at world (x,y,z) with its radio panel facing (fx,fz); registers anchor `id` and a collider.
 * @returns {THREE.Group}
 */
export function placeBeacon(S, id, x, y, z, fx, fz, seed = 1) {
  const rand = S.rand(900 + seed);
  const g = makeBeacon(S.lib, rand, id);
  const yaw = Math.atan2(-fz, fx);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  S.root.add(g);
  S.circle(x, z, 0.55, y, y + 1.2, { surface: 'metal' });
  S.anchor(id, [x, y, z], yaw, g);
  return g;
}
