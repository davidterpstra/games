// Checkpoints: the player's start or an activated beacon. Respawn puts the player 2 m in front of the beacon.
import * as THREE from 'three';

export const BEACON_NAMES = {
  'station.beacon': 'Onderzoeksstation Kestrel',
  'village.beacon': 'Valdris',
  'waterfall.beacon': 'De Zilveren Waterval',
  'temple.beacon': 'De Zonnetempel',
  'bunker.beacon': 'Bunker K-7',
};

/** @param {{world, player, bus}} deps */
export function createCheckpoints({ world, player, bus }) {
  let current = 'player.start';
  const names = (id) => (id === 'player.start' ? 'Startpunt' : `Noodbaken – ${BEACON_NAMES[id] || id}`);

  const api = {
    get id() { return current; },
    get name() { return names(current); },
    set(id) {
      if (!world.anchors.has(id)) return false;
      current = id;
      bus.emit('checkpoint:set', { id, name: names(id) });
      return true;
    },
    /** Silent set (loading / resetting). */
    restore(id) { current = world.anchors.has(id) ? id : 'player.start'; },
    reset() { current = 'player.start'; },
    respawn() {
      const start = world.anchors.get('player.start');
      const a = world.anchors.get(current);
      if (!a || current === 'player.start') {
        if (start) player.teleport(start.position.clone(), start.rotationY || 0, 0);
        return;
      }
      // "front" of the beacon = the direction its rotationY faces; the player looks away from the beacon
      const yaw = a.rotationY || 0;
      const x = a.position.x - Math.sin(yaw) * 2, z = a.position.z - Math.cos(yaw) * 2;
      const y = Math.max(world.getHeightAt(x, z), a.position.y);
      player.teleport(new THREE.Vector3(x, y, z), yaw, 0);
    },
  };
  return api;
}
