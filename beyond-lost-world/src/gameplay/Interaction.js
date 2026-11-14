// Interaction focus: every frame picks the best interactable in front of the player and announces it
// on the bus ('interaction:focus'). Pressing E calls onInteract of the focused interactable.
import * as THREE from 'three';

const MAX_REACH = 2.6;     // metres from the eye to the closest point of the object
const MAX_ANGLE = 0.85;    // radians between view direction and the object

const _eye = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _ray = new THREE.Ray();

/**
 * @typedef {{ id:string, position:THREE.Vector3, radius?:number, box?:THREE.Box3, object?:THREE.Object3D,
 *   prompt:string|(()=>string), enabled?:()=>boolean, onInteract:()=>void }} Interactable
 * Either `box` (world-space bounds), `object` (bounds computed once) or `position`+`radius` define the target volume.
 */
export function createInteraction({ bus, player }) {
  /** @type {Map<string, Interactable & {_box:THREE.Box3, _reach:number}>} */
  const registry = new Map();
  let focused = null;
  let lastId = undefined;
  let lastPrompt = undefined;

  function register(def) {
    const d = def;
    if (d.box) d._box = d.box.clone();
    else if (d.object) { d.object.updateWorldMatrix(true, true); d._box = new THREE.Box3().setFromObject(d.object); if (d._box.isEmpty()) d._box.setFromCenterAndSize(d.position, new THREE.Vector3(0.6, 0.6, 0.6)); }
    else { const r = Math.min(d.radius ?? 0.35, 0.6); d._box = new THREE.Box3().setFromCenterAndSize(d.position, new THREE.Vector3(r * 2, r * 2, r * 2)); }
    d._reach = Math.max(MAX_REACH, d.radius ?? 0);
    registry.set(d.id, d);
    return d;
  }

  const promptOf = (d) => (typeof d.prompt === 'function' ? d.prompt() : d.prompt);

  function announce(d) {
    const id = d ? d.id : null;
    const prompt = d ? promptOf(d) : null;
    if (id === lastId && prompt === lastPrompt) return;
    lastId = id; lastPrompt = prompt;
    bus.emit('interaction:focus', d ? { id, prompt, key: 'E' } : null);
  }

  const api = {
    register,
    unregister(id) { registry.delete(id); },
    get(id) { return registry.get(id) || null; },
    list() { return [...registry.values()]; },
    get focused() { return focused; },
    /** Picks the best interactable and announces focus changes. Call once per frame. */
    update() {
      // getEyePosition/getForward may fill our vectors or return their own
      const eye = player.getEyePosition(_eye) || _eye;
      const fwd = player.getForward(_fwd) || _fwd;
      _ray.set(eye, fwd);
      let best = null, bestScore = Infinity;
      for (const d of registry.values()) {
        if (d.enabled && !d.enabled()) continue;
        d._box.clampPoint(eye, _pt);
        const dist = eye.distanceTo(_pt);
        if (dist > d._reach) continue;
        let angle;
        if (dist < 0.05 || _ray.intersectBox(d._box, _hit)) angle = 0;
        else { _dir.subVectors(_pt, eye).normalize(); angle = Math.acos(Math.max(-1, Math.min(1, _dir.dot(fwd)))); }
        if (angle > MAX_ANGLE) continue;
        const score = angle + dist * 0.2;
        if (score < bestScore) { bestScore = score; best = d; }
      }
      focused = best;
      announce(best);
    },
    /** Triggers the focused interactable (called for the E key while playing). */
    trigger() {
      if (!focused) return false;
      if (focused.enabled && !focused.enabled()) return false;
      focused.onInteract();
      return true;
    },
    /** Forget the current focus (after load / new game) so the UI is told about the next one. */
    resetFocus() { focused = null; announce(null); },
  };
  return api;
}
