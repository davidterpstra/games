// In-world pickups: one per world.resourceSpots entry plus the anchored mission items.
// Resource types are rendered with one InstancedMesh per model part (collected = zero-scale instance).
import * as THREE from 'three';
import { mulberry32 } from '../world/layout.js';
import { ITEMS } from './items.js';
import { getItemParts, createItemObject } from './ItemModels.js';
import { shaftTexture, glowTexture } from './ModelTextures.js';

/** Mission items placed at anchors: [anchorId, itemType]. */
export const MISSION_PICKUPS = [
  ['station.cloth', 'cloth'], ['village.scrap1', 'scrap'], ['village.scrap2', 'scrap'],
  ['cave.sundisc', 'sundisc'], ['temple.keycard', 'keycard'],
];
/** Items given by one pickup (default 1). */
const YIELD = { fiber: 2 };

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function createGlint() {
  const g = new THREE.Group();
  g.name = 'glint';
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.2, 2.2, 14, 1, true),
    new THREE.MeshBasicMaterial({ map: shaftTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.3, fog: false }),
  );
  shaft.position.y = 1.1; shaft.renderOrder = 3; shaft.userData.base = 0.5;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  glow.scale.setScalar(0.45); glow.position.y = 0.1; glow.renderOrder = 4;
  g.add(shaft, glow);
  g.userData.shaft = shaft; g.userData.glow = glow;
  return g;
}

/**
 * @param {object} deps { scene, world, inventory, interaction, bus }
 */
export function createPickups({ scene, world, inventory, interaction, bus }) {
  const root = new THREE.Group();
  root.name = 'pickups';
  scene.add(root);
  const entries = new Map();          // id -> entry
  const collected = new Set();
  // one InstancedMesh set per (type, 64 m cell): a single map-wide set would never be frustum-culled
  const instanced = new Map();        // 'type@cx,cz' -> { meshes: InstancedMesh[], next }
  const CELL = 64;
  const cellKey = (s) => `${s.type}@${Math.floor(s.position.x / CELL)},${Math.floor(s.position.z / CELL)}`;
  const glints = [];
  let focusedEntry = null;
  let time = 0;

  // ---- collect the entries -----------------------------------------------------------------
  const specs = [];
  for (const spot of world.resourceSpots || []) specs.push({ id: spot.id, type: spot.type, position: spot.position, mission: false });
  for (const [anchorId, type] of MISSION_PICKUPS) {
    const a = world.anchors.get(anchorId);
    if (!a) { console.warn(`[gameplay] missing anchor ${anchorId}`); continue; }
    specs.push({ id: anchorId, type, position: a.position, mission: true, rotationY: a.rotationY });
  }

  const counts = {};
  for (const s of specs) if (!s.mission) counts[cellKey(s)] = (counts[cellKey(s)] || 0) + 1;

  for (const key of Object.keys(counts)) {
    const type = key.split('@')[0];
    const parts = getItemParts(type);
    const meshes = parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, counts[key]);
      im.name = `pickups_${type}`;
      im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      root.add(im);
      return im;
    });
    instanced.set(key, { meshes, next: 0 });
  }

  function placeMatrix(spec, out) {
    const rng = mulberry32(hash(spec.id));
    const yaw = spec.mission && spec.rotationY !== undefined && spec.type !== 'scrap' && spec.type !== 'cloth' ? spec.rotationY : rng() * Math.PI * 2;
    _qy.setFromAxisAngle(_up, yaw);
    _q.identity();
    if (!spec.mission && world.getNormalAt) {
      _n.copy(world.getNormalAt(spec.position.x, spec.position.z)); _n.lerp(_up, 0.35).normalize();
      _q.setFromUnitVectors(_up, _n);
    }
    _q.multiply(_qy);
    const k = 0.9 + rng() * 0.25;
    _s.set(k * (0.92 + rng() * 0.16), k, k * (0.92 + rng() * 0.16));
    _p.copy(spec.position); _p.y -= spec.mission ? 0 : 0.03;
    return out.compose(_p, _q, _s);
  }

  for (const spec of specs) {
    const entry = { id: spec.id, type: spec.type, itemId: spec.type, count: YIELD[spec.type] || 1, position: spec.position, collected: false, matrix: new THREE.Matrix4(), index: -1, object: null, glint: null, baseScale: 1 };
    placeMatrix(spec, entry.matrix);
    const inst = !spec.mission ? instanced.get(cellKey(spec)) : null;
    if (inst) {
      entry.index = inst.next++;
      entry.inst = inst;
      for (const im of inst.meshes) im.setMatrixAt(entry.index, entry.matrix);
    } else {
      const obj = createItemObject(spec.type);
      obj.matrixAutoUpdate = true;
      entry.matrix.decompose(obj.position, obj.quaternion, obj.scale);
      entry.baseScale = obj.scale.x;
      if (spec.type === 'sundisc') obj.position.y += 0.03;
      root.add(obj);
      entry.object = obj;
      const glint = createGlint();
      glint.position.copy(obj.position);
      root.add(glint);
      entry.glint = glint;
      glints.push(glint);
    }
    entries.set(entry.id, entry);

    interaction.register({
      id: entry.id,
      position: spec.position,
      radius: 0.45,
      prompt: () => `Oppakken: ${ITEMS[entry.itemId].name}`,
      enabled: () => !entry.collected,
      onInteract: () => pick(entry),
    });
  }
  for (const inst of instanced.values()) {
    for (const im of inst.meshes) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.computeBoundingBox?.(); }
    // instance colours (used for the focus highlight)
    for (const im of inst.meshes) { for (let i = 0; i < im.count; i++) im.setColorAt(i, new THREE.Color(1, 1, 1)); im.instanceColor.needsUpdate = true; }
  }

  function setVisible(entry, visible) {
    entry.collected = !visible;
    if (entry.inst) {
      for (const im of entry.inst.meshes) { im.setMatrixAt(entry.index, visible ? entry.matrix : ZERO); im.instanceMatrix.needsUpdate = true; }
    } else {
      entry.object.visible = visible; entry.glint.visible = visible;
    }
  }

  function pick(entry) {
    if (entry.collected) return false;
    const added = inventory.add(entry.itemId, entry.count);
    if (added <= 0) { bus.emit('sfx', { name: 'error' }); return false; }
    if (added < entry.count) { entry.count -= added; } // partly taken: remainder stays
    else { collected.add(entry.id); setVisible(entry, false); }
    bus.emit('sfx', { name: 'pickup', position: entry.position });
    bus.emit('item:picked', { itemId: entry.itemId, count: added, name: ITEMS[entry.itemId].name });
    return true;
  }

  const tint = new THREE.Color();
  function highlight(entry, k) {
    if (entry.inst) {
      tint.setScalar(k);
      for (const im of entry.inst.meshes) { im.setColorAt(entry.index, tint); im.instanceColor.needsUpdate = true; }
    } else {
      const s = entry.baseScale * (1 + (k - 1) * 0.05);
      entry.object.scale.setScalar(s);
    }
  }

  return {
    entries,
    /** Pickup id → whether it has been collected. */
    isCollected: (id) => collected.has(id),
    update(dt) {
      time += dt;
      const f = interaction.focused;
      const entry = f ? entries.get(f.id) || null : null;
      if (focusedEntry && focusedEntry !== entry) highlight(focusedEntry, 1);
      focusedEntry = entry;
      if (entry && !entry.collected) highlight(entry, 1.55 + 0.45 * Math.sin(time * 5));
      const pulse = 0.75 + 0.25 * Math.sin(time * 2.2);
      for (const g of glints) {
        if (!g.visible) continue;
        g.userData.shaft.material.opacity = 0.35 * pulse + (focusedEntry && focusedEntry.glint === g ? 0.2 : 0);
        g.userData.glow.material.opacity = 0.35 + 0.3 * pulse;
      }
    },
    serialize() { return [...collected]; },
    /** Makes everything visible again. */
    reset() {
      collected.clear();
      for (const e of entries.values()) {
        const need = YIELD[e.type] || 1; e.count = need;
        setVisible(e, true);
        if (e.object) e.object.scale.setScalar(e.baseScale); else highlight(e, 1);
      }
      focusedEntry = null;
    },
    restore(ids) {
      this.reset();
      if (!Array.isArray(ids)) return;
      for (const id of ids) { const e = entries.get(id); if (e) { collected.add(id); setVisible(e, false); } }
    },
    dispose() { scene.remove(root); },
  };
}
