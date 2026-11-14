// Interactive world objects driven by anchors: beacons, elder's door, altar, glyph pillars, temple gate and the
// bunker (reader, blast door, generator, inner door, terminal). All state lives in `flags` (saved);
// `applyAll()` puts every visual into the state described by the flags instantly (used for load / new game),
// the interaction handlers animate towards the same state.
import * as THREE from 'three';
import { createItemObject } from './ItemModels.js';
import { ease } from './tween.js';
import { BEACON_NAMES } from './Checkpoints.js';

export const BEACON_IDS = Object.keys(BEACON_NAMES);
export const GLYPHS = ['Zon', 'Maan', 'Golf', 'Berg'];
export const PILLAR_SOLUTION = [3, 0, 2];
const PILLAR_IDS = ['temple.pillar1', 'temple.pillar2', 'temple.pillar3'];

const defaultFlags = () => ({
  beacons: Object.fromEntries(BEACON_IDS.map((id) => [id, false])),
  pillars: [0, 0, 0],
  elderDoorOpen: false, discPlaced: false, gateOpen: false,
  bunkerDoorOpen: false, powered: false, innerDoorOpen: false, chapterComplete: false,
});

/**
 * @param {{scene, world, bus, inventory, interaction, documents, checkpoints, tweens, requestSave:()=>void}} deps
 */
export function createWorldObjects({ scene, world, bus, inventory, interaction, documents, checkpoints, tweens, requestSave }) {
  let flags = defaultFlags();
  const sfx = (name, position) => bus.emit('sfx', position ? { name, position } : { name });
  const notify = (text, type = 'info') => bus.emit('notify', { text, type });
  const anchor = (id) => { const a = world.anchors.get(id); if (!a) console.warn(`[gameplay] missing anchor ${id}`); return a || null; };
  const setCollider = (id, enabled) => { if (id) world.setColliderEnabled(id, enabled); };
  const applyList = [];       // instant appliers
  const frameList = [];       // per-frame updaters (dt, t)

  /** A sliding/sinking door object (userData.openOffset, userData.colliderId). */
  function makeDoor(obj) {
    const base = obj.position.clone();
    const offset = (obj.userData.openOffset ? obj.userData.openOffset.clone() : new THREE.Vector3(0, -4, 0)).applyQuaternion(obj.quaternion);
    const colliderId = obj.userData.colliderId;
    return {
      obj, colliderId,
      set(p) { obj.position.copy(base).addScaledVector(offset, p); },
      /** animate; the collider is switched off once `colliderAt` of the way is reached. */
      slide(duration, colliderAt = 0.5, done) {
        let off = false;
        tweens.add({ duration, ease: ease.inOut, update: (e) => { this.set(e); if (!off && e >= colliderAt) { off = true; setCollider(colliderId, false); } }, done: () => { this.set(1); setCollider(colliderId, false); done?.(); } });
      },
    };
  }

  // ---- beacons -------------------------------------------------------------------------------
  for (const id of BEACON_IDS) {
    const a = anchor(id);
    if (!a || !a.object) continue;
    const lamp = a.object.getObjectByName('lamp');
    const m = lamp && lamp.material;
    if (m && m.emissive && m.emissive.getHex() === 0) m.emissive.set(0xff8a2a);
    const b = { id, lamp, level: 0, phase: Math.random() * 6 };
    applyList.push(() => { b.level = flags.beacons[id] ? 3 : 0; if (m) m.emissiveIntensity = b.level; });
    frameList.push((dt, t) => {
      if (!m) return;
      const target = flags.beacons[id] ? 3 : 0;
      b.level += (target - b.level) * Math.min(1, dt * 3);
      const pulse = flags.beacons[id] ? 0.3 * Math.sin(t * 2.2 + b.phase) : 0;
      m.emissiveIntensity = Math.max(0, b.level + pulse);
    });
    interaction.register({
      id, object: a.object, position: a.position, radius: 2.6,
      prompt: () => (flags.beacons[id] ? 'Checkpoint opslaan: Noodbaken' : 'Activeren: Noodbaken'),
      onInteract() {
        const first = !flags.beacons[id];
        flags.beacons[id] = true;
        checkpoints.set(id);
        sfx('beacon', a.position);
        notify(first ? 'Noodbaken geactiveerd. Checkpoint opgeslagen.' : 'Checkpoint opgeslagen.', 'success');
        bus.emit('beacon:activated', { id });
        requestSave();
      },
    });
  }

  // ---- elder's door --------------------------------------------------------------------------
  {
    const a = anchor('village.elderDoor');
    if (a && a.object) {
      const o = a.object;
      const base = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
      const colliderId = o.userData.colliderId;
      applyList.push(() => {
        o.position.copy(base.p); o.quaternion.copy(base.q); o.scale.copy(base.s);
        o.visible = !flags.elderDoorOpen;
        setCollider(colliderId, !flags.elderDoorOpen);
      });
      interaction.register({
        id: 'village.elderDoor', object: o, position: a.position, radius: 2.6,
        prompt: 'Openbreken: Planken (koevoet)',
        enabled: () => !flags.elderDoorOpen,
        onInteract() {
          if (!inventory.has('crowbar')) { sfx('error'); notify('Je hebt een koevoet nodig.', 'warning'); return; }
          flags.elderDoorOpen = true;
          setCollider(colliderId, false);
          sfx('boards_break', a.position);
          notify('De planken kraken en vallen uit elkaar.', 'success');
          const axis = new THREE.Vector3(1, 0, 0), tilt = new THREE.Quaternion();
          tweens.add({
            duration: 1.1, ease: ease.in,
            update: (e) => { o.position.y = base.p.y - e * 1.6; tilt.setFromAxisAngle(axis, 0.9 * e); o.quaternion.copy(base.q).multiply(tilt); o.scale.copy(base.s).multiplyScalar(1 - 0.35 * e); },
            done: () => { o.visible = false; },
          });
        },
      });
    }
  }

  // ---- temple: altar, pillars, gate -----------------------------------------------------------
  let discModel = null;
  const altar = anchor('temple.altar');
  const gate = anchor('temple.gate');
  const gateDoor = gate && gate.object ? makeDoor(gate.object) : null;
  const pillars = PILLAR_IDS.map((id, i) => {
    const a = anchor(id);
    if (!a || !a.object) return null;
    return { id, i, a, o: a.object, turns: 0, busy: false, baseY: a.rotationY || 0 };
  });
  const pillarAngle = (p, turns) => p.baseY + turns * (Math.PI / 2);
  const solved = () => flags.pillars.every((s, i) => s === PILLAR_SOLUTION[i]);

  function showDisc(animate) {
    if (!altar || !altar.object || discModel) return;
    const socket = altar.object.getObjectByName('socket') || altar.object;
    discModel = createItemObject('sundisc');
    discModel.position.set(0, 0.02, 0);
    socket.add(discModel);
    if (animate) {
      const y0 = 0.45;
      tweens.add({ duration: 0.9, ease: ease.out, update: (e) => { discModel.position.y = 0.02 + (1 - e) * y0; discModel.rotation.y = (1 - e) * 2.4; } });
    }
  }
  function hideDisc() { if (discModel) { discModel.parent?.remove(discModel); discModel = null; } }

  function openGate(animate) {
    if (!gateDoor) return;
    if (!animate) { gateDoor.set(1); setCollider(gateDoor.colliderId, false); return; }
    sfx('stone_grind', gate.position);
    notify('Met een diep gerommel zakt de poort weg.', 'success');
    gateDoor.slide(3, 0.9);
  }

  if (altar && altar.object) {
    applyList.push(() => { hideDisc(); if (flags.discPlaced) showDisc(false); });
    interaction.register({
      id: 'temple.altar', object: altar.object, position: altar.position, radius: 2.6,
      prompt: 'Plaatsen: Zonneschijf',
      enabled: () => !flags.discPlaced,
      onInteract() {
        if (!inventory.has('sundisc')) { sfx('error'); notify('Je hebt de Zonneschijf nodig.', 'warning'); return; }
        inventory.remove('sundisc', 1);
        flags.discPlaced = true;
        showDisc(true);
        sfx('stone_grind', altar.position);
        notify('De Zonneschijf past precies. De pilaren beginnen zacht te gonzen.', 'success');
      },
    });
  }

  for (const p of pillars) {
    if (!p) continue;
    applyList.push(() => {
      p.turns = flags.pillars[p.i]; p.busy = false;
      p.o.rotation.y = pillarAngle(p, p.turns);
    });
    interaction.register({
      id: p.id, object: p.o, position: p.a.position, radius: 2.6,
      prompt: () => `Draaien: Pilaar (${GLYPHS[((p.turns % 4) + 4) % 4]})`,
      enabled: () => !flags.gateOpen,
      onInteract() {
        if (!flags.discPlaced) { sfx('error'); notify('De pilaren zitten muurvast…', 'info'); return; }
        if (p.busy) return;
        p.busy = true;
        const from = pillarAngle(p, p.turns);
        p.turns += 1;
        const to = pillarAngle(p, p.turns);
        sfx('stone_grind', p.a.position);
        tweens.add({
          duration: 0.8, ease: ease.inOut,
          update: (e) => { p.o.rotation.y = from + (to - from) * e; },
          done: () => {
            p.busy = false;
            flags.pillars[p.i] = ((p.turns % 4) + 4) % 4;
            if (!flags.gateOpen && solved() && pillars.every((q) => q && !q.busy)) { flags.gateOpen = true; openGate(true); }
          },
        });
      },
    });
  }
  applyList.push(() => { if (flags.gateOpen) openGate(false); else if (gateDoor) { gateDoor.set(0); setCollider(gateDoor.colliderId, true); } });

  // ---- bunker --------------------------------------------------------------------------------
  const ledMat = (() => { const r = anchor('bunker.reader'); const led = r && r.object && r.object.getObjectByName('led'); return led ? led.material : null; })();
  const setLed = (ok) => {
    if (!ledMat) return;
    const c = ok ? 0x2cff6a : 0xff2a1a;
    ledMat.color?.set(c); ledMat.emissive?.set(c); ledMat.emissiveIntensity = ok ? 2.4 : 1.6;
  };
  const blast = (() => { const a = anchor('bunker.door'); return a && a.object ? makeDoor(a.object) : null; })();
  const inner = (() => { const a = anchor('bunker.innerDoor'); return a && a.object ? makeDoor(a.object) : null; })();
  const lever = (() => { const g = anchor('bunker.generator'); return g && g.object ? g.object.getObjectByName('lever') : null; })();
  const screen = (() => { const t = anchor('bunker.terminal'); const s = t && t.object && t.object.getObjectByName('screen'); return s ? s.material : null; })();
  let screenBase = null;
  if (screen) screenBase = { c: screen.color?.clone(), e: screen.emissive?.clone() };
  const setScreen = (on) => {
    if (!screen) return;
    if (on) { screen.emissive?.set(0x3dffb0); screen.color?.set(0x0c2a20); screen.emissiveIntensity = 1.4; }
    else { if (screenBase.e) screen.emissive.copy(screenBase.e); if (screenBase.c) screen.color.copy(screenBase.c); screen.emissiveIntensity = 0; }
  };

  applyList.push(() => {
    setLed(flags.bunkerDoorOpen);
    if (blast) { blast.set(flags.bunkerDoorOpen ? 1 : 0); setCollider(blast.colliderId, !flags.bunkerDoorOpen); }
    if (inner) { inner.set(flags.innerDoorOpen ? 1 : 0); setCollider(inner.colliderId, !flags.innerDoorOpen); }
    if (lever) lever.rotation.x = flags.powered ? -1.2 : 0;
    setScreen(flags.powered);
    world.setPowered('bunker', flags.powered);
  });
  frameList.push((dt, t) => { if (screen && flags.powered) screen.emissiveIntensity = 1.3 + 0.12 * Math.sin(t * 13) * Math.sin(t * 3.1); });

  {
    const a = anchor('bunker.reader');
    if (a && a.object) {
      interaction.register({
        id: 'bunker.reader', object: a.object, position: a.position, radius: 2.6,
        prompt: 'Sleutelkaart gebruiken',
        enabled: () => !flags.bunkerDoorOpen,
        onInteract() {
          if (!inventory.has('keycard')) { sfx('keycard_denied', a.position); notify('Toegang geweigerd. Sleutelkaart vereist.', 'warning'); return; }
          flags.bunkerDoorOpen = true;
          setLed(true);
          sfx('keycard_ok', a.position);
          notify('Toegang verleend.', 'success');
          if (blast) { tweens.add({ duration: 0.5, update: () => {}, done: () => { sfx('metal_door', blast.obj.position); blast.slide(4, 0.5); } }); }
        },
      });
    }
  }
  {
    const a = anchor('bunker.generator');
    if (a && a.object) {
      interaction.register({
        id: 'bunker.generator', object: a.object, position: a.position, radius: 2.6,
        prompt: 'Hendel overhalen',
        enabled: () => !flags.powered,
        onInteract() {
          flags.powered = true;
          sfx('lever', a.position);
          const done = () => {
            sfx('power_on', a.position);
            setScreen(true);
            world.setPowered('bunker', true);
            notify('De generator slaat aan. De bunker komt tot leven.', 'success');
          };
          if (lever) tweens.add({ duration: 0.9, ease: ease.inOut, update: (e) => { lever.rotation.x = -1.2 * e; }, done });
          else done();
        },
      });
    }
  }
  {
    const a = anchor('bunker.innerDoor');
    if (a && a.object && inner) {
      interaction.register({
        id: 'bunker.innerDoor', object: a.object, position: a.position, radius: 2.6,
        prompt: 'Openen: Controlekamer',
        enabled: () => !flags.innerDoorOpen,
        onInteract() {
          if (!flags.powered) { sfx('error'); notify('Geen stroom.', 'warning'); return; }
          flags.innerDoorOpen = true;
          sfx('door_open', a.position);
          inner.slide(2.5, 0.5);
        },
      });
    }
  }
  {
    const a = anchor('bunker.terminal');
    if (a && a.object) {
      interaction.register({
        id: 'bunker.terminal', object: a.object, position: a.position, radius: 2.6,
        prompt: 'Gebruiken: Terminal',
        onInteract() {
          if (!flags.powered) { sfx('error'); notify('Geen stroom.', 'warning'); return; }
          documents.open('terminal');
        },
      });
    }
  }

  function applyAll() { for (const f of applyList) f(); }
  applyAll();

  return {
    get flags() { return flags; },
    pillarCount: pillars.filter(Boolean).length,
    /** Mission-facing flag lookup: 'beacon.station', 'elderDoorOpen', ... */
    has(name) {
      if (name.startsWith('beacon.')) return !!flags.beacons[`${name.slice(7)}.beacon`];
      return !!flags[name];
    },
    update(dt, t) { for (const f of frameList) f(dt, t); },
    reset() { tweens.clear(); flags = defaultFlags(); applyAll(); },
    serialize() { return JSON.parse(JSON.stringify(flags)); },
    restore(data) {
      tweens.clear();
      const f = defaultFlags();
      if (data && typeof data === 'object') {
        for (const id of BEACON_IDS) f.beacons[id] = !!(data.beacons && data.beacons[id]);
        for (const k of ['elderDoorOpen', 'discPlaced', 'gateOpen', 'bunkerDoorOpen', 'powered', 'innerDoorOpen', 'chapterComplete']) f[k] = !!data[k];
        if (Array.isArray(data.pillars)) f.pillars = [0, 1, 2].map((i) => { const s = Math.floor(Number(data.pillars[i])); return Number.isFinite(s) ? ((s % 4) + 4) % 4 : 0; });
      }
      flags = f;
      applyAll();
    },
    setChapterComplete(v = true) { flags.chapterComplete = v; },
  };
}
