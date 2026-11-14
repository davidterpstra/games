// Contract checks for src/world/structures: required anchors, children, door userData, spawn clearance, zone names.
import * as THREE from 'three';

const REQUIRED = {
  'player.start': 0, 'station.logbook': 0, 'station.cloth': 0, 'station.beacon': 1, 'village.beacon': 1, 'waterfall.beacon': 1, 'temple.beacon': 1, 'bunker.beacon': 1,
  'village.elderDoor': 1, 'village.journal': 0, 'village.scrap1': 0, 'village.scrap2': 0, 'note.forest_camp': 0, 'note.village_house': 0, 'note.waterfall': 0, 'note.cave': 0,
  'cave.sundisc': 0, 'temple.altar': 1, 'temple.pillar1': 1, 'temple.pillar2': 1, 'temple.pillar3': 1, 'temple.gate': 1, 'temple.keycard': 0, 'temple.recording': 0,
  'bunker.door': 1, 'bunker.reader': 1, 'bunker.generator': 1, 'bunker.innerDoor': 1, 'bunker.terminal': 1,
};

function inside(c, x, z, r) {
  if (c.type === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + r;
  const cs = Math.cos(c.rot), sn = Math.sin(c.rot), dx = x - c.x, dz = z - c.z;
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  return Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r;
}

/** Returns { errors: string[], warnings: string[], stats }. */
export function runChecks(structures, renderer) {
  const errors = [], warnings = [];
  const A = structures.anchors, C = structures.colliders;
  for (const [id, needsObj] of Object.entries(REQUIRED)) {
    const a = A.get(id);
    if (!a) { errors.push(`missing anchor ${id}`); continue; }
    if (!(a.position && Number.isFinite(a.position.x + a.position.y + a.position.z))) errors.push(`${id}: bad position`);
    if (needsObj && !a.object) errors.push(`${id}: missing object`);
  }
  const child = (id, name) => { const o = A.get(id)?.object; const c = o?.getObjectByName(name); if (!c) errors.push(`${id}: missing child "${name}"`); return c; };
  const lampMats = new Set();
  for (const id of ['station.beacon', 'village.beacon', 'waterfall.beacon', 'temple.beacon', 'bunker.beacon']) {
    const l = child(id, 'lamp');
    if (l) {
      if (!l.material?.isMeshStandardMaterial) errors.push(`${id}.lamp: not MeshStandardMaterial`);
      if (l.material.emissiveIntensity !== 0) errors.push(`${id}.lamp: emissiveIntensity != 0`);
      if (lampMats.has(l.material)) errors.push(`${id}.lamp: material shared`); lampMats.add(l.material);
    }
  }
  child('temple.altar', 'socket'); child('bunker.reader', 'led'); child('bunker.generator', 'lever'); child('bunker.terminal', 'screen');
  const led = A.get('bunker.reader')?.object?.getObjectByName('led'); if (led && !led.material) errors.push('led has no material');
  const scr = A.get('bunker.terminal')?.object?.getObjectByName('screen'); if (scr && !scr.material?.isMeshStandardMaterial) errors.push('screen material');
  const lever = A.get('bunker.generator')?.object?.getObjectByName('lever'); if (lever && lever.rotation.x !== 0) errors.push('lever.rotation.x != 0');
  for (const id of ['village.elderDoor', 'temple.gate', 'bunker.door', 'bunker.innerDoor']) {
    const o = A.get(id)?.object; if (!o) continue;
    if (!(o.userData.openOffset instanceof THREE.Vector3)) errors.push(`${id}: openOffset not Vector3`);
    const cid = o.userData.colliderId;
    if (!cid) errors.push(`${id}: no colliderId`);
    else if (!C.some((c) => c.id === cid)) errors.push(`${id}: collider "${cid}" not found`);
  }
  // pillars: rotation.y == anchor.rotationY initially
  for (const n of [1, 2, 3]) { const a = A.get(`temple.pillar${n}`); if (a && Math.abs(a.object.rotation.y - a.rotationY) > 1e-6) errors.push(`pillar${n}: initial rotation != anchor.rotationY`); }
  // player start clearance
  const ps = A.get('player.start');
  if (ps) {
    const hit = C.filter((c) => c.enabled !== false && c.yMin < ps.position.y + 1.6 && c.yMax > ps.position.y + 0.45 && inside(c, ps.position.x, ps.position.z, 0.35));
    if (hit.length) errors.push(`player.start inside ${hit.length} collider(s): ${JSON.stringify(hit[0])}`);
    // within the station zone?
    const z = structures.interiorZones.find((q) => q.id === 'station_main');
    if (z) { const c = Math.cos(z.rot), s = Math.sin(z.rot), dx = ps.position.x - z.x, dz = ps.position.z - z.z; if (Math.abs(dx * c - dz * s) > z.hx || Math.abs(dx * s + dz * c) > z.hz) errors.push('player.start outside station zone'); }
  }
  // item spots must not be buried in colliders
  for (const [id, a] of A) {
    if (a.object) continue;
    const hit = C.find((c) => c.enabled !== false && a.position.y > c.yMin + 0.02 && a.position.y < c.yMax - 0.02 && inside(c, a.position.x, a.position.z, 0));
    if (hit) warnings.push(`${id} is inside a collider (y ${a.position.y.toFixed(2)} in ${hit.yMin.toFixed(2)}..${hit.yMax.toFixed(2)})`);
  }
  // resource spots
  const rs = structures.resourceSpots;
  const nScrap = rs.filter((r) => r.type === 'scrap').length, nCloth = rs.filter((r) => r.type === 'cloth').length;
  if (nScrap < 6) errors.push(`only ${nScrap} scrap spots`);
  if (nCloth < 4) errors.push(`only ${nCloth} cloth spots`);
  for (const r of rs) {
    if (!/^(scrap|cloth)_s\d+$/.test(r.id)) errors.push(`resource id ${r.id}`);
    const hit = C.find((c) => c.enabled !== false && r.position.y > c.yMin + 0.02 && r.position.y < c.yMax - 0.02 && inside(c, r.position.x, r.position.z, 0));
    if (hit) warnings.push(`resource ${r.id} is inside a collider`);
  }
  // zones
  for (const z of structures.interiorZones) {
    const n = z.id;
    if (/cave/.test(n) === !!(/cave/.test(n))) { /* ok */ }
    const bad = (/(cave|temple|bunker)/.test(n)) && !(n.startsWith('cave') || n.startsWith('temple') || n.startsWith('bunker'));
    if (bad) errors.push(`zone ${n}: reserved word in wrong zone`);
    for (const k of ['x', 'z', 'hx', 'hz', 'rot', 'yMin', 'yMax', 'darkness']) if (!Number.isFinite(z[k])) errors.push(`zone ${n}: bad ${k}`);
  }
  for (const k of ['cave', 'temple', 'bunker']) if (!structures.interiorZones.some((z) => z.id.includes(k))) errors.push(`no zone containing "${k}"`);
  // colliders sanity
  C.forEach((c, i) => { const ok = c.type === 'circle' ? [c.x, c.z, c.r] : [c.x, c.z, c.hx, c.hz, c.rot]; if (![...ok, c.yMin, c.yMax].every(Number.isFinite) || c.yMax <= c.yMin) errors.push(`collider #${i} invalid ${JSON.stringify(c)}`); });
  // draw calls
  let meshes = 0, tris = 0;
  structures.root.traverse((o) => { if ((o.isMesh || o.isPoints) && o.visible) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
  if (meshes > 150) warnings.push(`draw calls (meshes) ${meshes} > 150`);
  return { errors, warnings, stats: { colliders: C.length, anchors: A.size, zones: structures.interiorZones.length, resources: rs.length, meshes, tris: Math.round(tris) } };
}
