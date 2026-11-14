// Data-driven missions of chapter 1. Objectives are checks against a read-only world snapshot `s`,
// they complete in any order and stay done once reached (so consuming items never un-completes anything).

/**
 * Snapshot passed to the checks: count(itemId), flag(name), doc(id), crafted(id), collected(id),
 * discovered(id), distanceFromStation(). A check returns boolean or [current, max].
 */
export const MISSION_DEFS = [
  {
    id: 'm1', title: 'Ontwaakt',
    description: 'Je komt bij in een verlaten onderzoeksstation. Zoek uit wat hier is gebeurd en maak je klaar om te vertrekken.',
    objectives: [
      { id: 'logbook', text: 'Lees het logboek van Dr. Vos', check: (s) => s.doc('logbook') },
      { id: 'beacon', text: 'Activeer de noodbaken van het station', check: (s) => s.flag('beacon.station') },
      { id: 'leave', text: 'Verlaat het onderzoeksstation', check: (s) => s.distanceFromStation() > 40 },
    ],
  },
  {
    id: 'm2', title: 'Licht in het duister',
    description: 'Het volgende deel van de reis voert door donkere plekken. Verzamel materiaal en maak een toorts.',
    objectives: [
      { id: 'wood', text: 'Verzamel hout', check: (s) => [s.count('wood'), 2] },
      { id: 'resin', text: 'Verzamel hars', check: (s) => [s.count('resin'), 1] },
      { id: 'cloth', text: 'Vind een lap stof', check: (s) => [s.count('cloth'), 1] },
      { id: 'torch', text: 'Maak een toorts (Tab → Crafting)', check: (s) => s.crafted('torch') },
    ],
  },
  {
    id: 'm3', title: 'Het stille dorp',
    description: 'Dr. Vos noemt het dorp Valdris en het huis van de ouderling. Zoek een manier om binnen te komen.',
    objectives: [
      { id: 'village', text: 'Bereik het verlaten dorp Valdris', check: (s) => s.discovered('village') },
      { id: 'scrap', text: 'Verzamel metaalschroot', check: (s) => [s.count('scrap'), 2] },
      { id: 'fiber', text: 'Verzamel plantvezel', check: (s) => [s.count('fiber'), 3] },
      { id: 'rope', text: 'Maak touw', check: (s) => s.crafted('rope') },
      { id: 'crowbar', text: 'Maak een koevoet', check: (s) => s.crafted('crowbar') },
      { id: 'door', text: 'Breek de planken van het huis van de ouderling open', check: (s) => s.flag('elderDoorOpen') },
      { id: 'journal', text: 'Lees het dagboek van de ouderling', check: (s) => s.doc('elder_journal') },
    ],
  },
  {
    id: 'm4', title: 'De Kristalgrot',
    description: 'De Zonneschijf ligt verborgen in de grot achter de Zilveren Waterval. Neem je toorts mee.',
    objectives: [
      { id: 'cave', text: 'Vind de Kristalgrot bij de waterval', check: (s) => s.discovered('cave') },
      { id: 'disc', text: 'Neem de Zonneschijf mee', check: (s) => s.collected('cave.sundisc') },
    ],
  },
  {
    id: 'm5', title: 'De Zonnetempel',
    description: 'Breng de Zonneschijf naar het altaar en los het raadsel van de pilaren op: eerst de Berg, dan de Zon, als laatste de Golf.',
    objectives: [
      { id: 'temple', text: 'Bereik de Zonnetempel', check: (s) => s.discovered('temple') },
      { id: 'place', text: 'Plaats de Zonneschijf op het altaar', check: (s) => s.flag('discPlaced') },
      { id: 'pillars', text: 'Draai de pilaren in de juiste volgorde', check: (s) => s.flag('gateOpen') },
      { id: 'keycard', text: 'Neem de sleutelkaart mee', check: (s) => s.collected('temple.keycard') },
      { id: 'recording', text: 'Luister naar de laatste opname van Dr. Vos', check: (s) => s.doc('recording') },
    ],
  },
  {
    id: 'm6', title: 'Bunker K-7',
    description: 'Ten westen van de kruising ligt een verborgen bunker. Daar liggen de antwoorden over Project BEYOND.',
    objectives: [
      { id: 'door', text: 'Open de zware deur met de sleutelkaart', check: (s) => s.flag('bunkerDoorOpen') },
      { id: 'power', text: 'Herstel de stroom met de generator', check: (s) => s.flag('powered') },
      { id: 'inner', text: 'Open de controlekamer', check: (s) => s.flag('innerDoorOpen') },
      { id: 'terminal', text: 'Lees de terminal', check: (s) => s.doc('terminal') },
    ],
  },
];

/**
 * @param {{bus, snapshot: object}} deps  `snapshot` implements the check interface above.
 */
export function createMissions({ bus, snapshot }) {
  /** @type {Map<string, {status:string, done:Set<string>, progress:Map<string,[number,number]>, sig:string}>} */
  const st = new Map();
  let suspended = false, evaluating = false, again = false;
  const reset = () => { st.clear(); for (const d of MISSION_DEFS) st.set(d.id, { status: 'locked', done: new Set(), progress: new Map(), sig: '' }); };
  reset();

  const view = (def) => {
    const m = st.get(def.id);
    return {
      id: def.id, title: def.title, description: def.description, status: m.status,
      objectives: def.objectives.map((o) => {
        const done = m.done.has(o.id);
        const pr = m.progress.get(o.id);
        const out = { id: o.id, text: o.text, done };
        if (pr) out.progress = done ? [pr[1], pr[1]] : [Math.min(pr[0], pr[1]), pr[1]];
        return out;
      }),
    };
  };
  const notify = (text, type) => bus.emit('notify', { text, type });

  function startMission(def, silent) {
    const m = st.get(def.id);
    m.status = 'active';
    if (!silent) {
      notify(`Nieuwe missie: ${def.title}`, 'info');
      bus.emit('mission:started', { mission: view(def) });
    }
  }

  function evaluate() {
    if (suspended) return;
    if (evaluating) { again = true; return; }
    evaluating = true;
    try {
      do {
        again = false;
        for (const def of MISSION_DEFS) {
          const m = st.get(def.id);
          if (m.status !== 'active') continue;
          let changed = false;
          for (const o of def.objectives) {
            if (m.done.has(o.id)) continue;
            const r = o.check(snapshot);
            let done, pr = null;
            if (Array.isArray(r)) { pr = [r[0], r[1]]; done = r[0] >= r[1]; } else done = !!r;
            if (pr) { const old = m.progress.get(o.id); if (!old || old[0] !== pr[0] || old[1] !== pr[1]) { m.progress.set(o.id, pr); changed = true; } }
            if (done) {
              m.done.add(o.id); changed = true;
              bus.emit('sfx', { name: 'objective' });
              notify(`Doel voltooid: ${o.text}`, 'success');
              bus.emit('objective:completed', { mission: view(def), objective: view(def).objectives.find((x) => x.id === o.id) });
            }
          }
          if (changed) bus.emit('mission:updated', { mission: view(def) });
          if (def.objectives.every((o) => m.done.has(o.id))) {
            m.status = 'done';
            bus.emit('sfx', { name: 'mission_complete' });
            notify(`Missie voltooid: ${def.title}`, 'success');
            bus.emit('mission:completed', { mission: view(def) });
            const next = MISSION_DEFS[MISSION_DEFS.indexOf(def) + 1];
            if (next && st.get(next.id).status === 'locked') startMission(next, false);
            again = true;
          }
        }
      } while (again);
    } finally { evaluating = false; }
  }

  return {
    list: () => MISSION_DEFS.map(view),
    active: () => { const d = MISSION_DEFS.find((x) => st.get(x.id).status === 'active'); return d ? view(d) : null; },
    evaluate,
    /** Starts the first mission (new game). */
    begin() { reset(); startMission(MISSION_DEFS[0], false); evaluate(); },
    reset,
    set suspended(v) { suspended = v; },
    serialize() {
      const o = { status: {}, done: {} };
      for (const d of MISSION_DEFS) { const m = st.get(d.id); o.status[d.id] = m.status; o.done[d.id] = [...m.done]; }
      return o;
    },
    /** Restores saved state silently, then re-evaluates against the restored world so nothing is stale. */
    restore(data) {
      reset();
      suspended = false;
      if (data && data.status) {
        for (const d of MISSION_DEFS) {
          const m = st.get(d.id);
          const status = data.status[d.id];
          m.status = ['locked', 'active', 'done'].includes(status) ? status : 'locked';
          const ids = new Set(d.objectives.map((o) => o.id));
          for (const id of (data.done && data.done[d.id]) || []) if (ids.has(id)) m.done.add(id);
          if (m.status === 'done') for (const o of d.objectives) m.done.add(o.id);
        }
        if (!MISSION_DEFS.some((d) => st.get(d.id).status === 'active')) { // consistent chain: first unfinished mission is active
          const next = MISSION_DEFS.find((d) => st.get(d.id).status !== 'done');
          if (next) st.get(next.id).status = 'active';
        }
      }
      // silent recompute (progress counters, objectives that are satisfied by the restored state)
      for (const d of MISSION_DEFS) {
        const m = st.get(d.id);
        if (m.status !== 'active') continue;
        for (const o of d.objectives) {
          const r = o.check(snapshot);
          if (Array.isArray(r)) m.progress.set(o.id, [r[0], r[1]]);
          if (!m.done.has(o.id) && (Array.isArray(r) ? r[0] >= r[1] : r)) m.done.add(o.id);
        }
      }
      const a = MISSION_DEFS.find((d) => st.get(d.id).status === 'active');
      if (a) {
        if (a.objectives.every((o) => st.get(a.id).done.has(o.id))) { st.get(a.id).status = 'done'; const n = MISSION_DEFS[MISSION_DEFS.indexOf(a) + 1]; if (n) st.get(n.id).status = 'active'; }
        bus.emit('mission:updated', { mission: this.active() || view(a) });
      }
    },
  };
}
