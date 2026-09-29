/* =====================================================================
   EMPIRE CONQUEST — technology tree
   Research points (from castle and academies) plus resources start a
   research project; it completes after a number of days.
   ===================================================================== */
'use strict';

const Tech = {
  status(kid, id) {
    const k = Game.k(kid);
    if (k.techs[id]) return 'done';
    if (k.research && k.research.id === id) return 'researching';
    const T = TECH_BY_ID[id];
    if (T.req && !k.techs[T.req]) return 'locked';
    return 'available';
  },
  info(kid, id) {
    const k = Game.k(kid), T = TECH_BY_ID[id];
    const cost = { ...T.cost, rp: T.rp };
    const st = this.status(kid, id);
    const out = { cost, st, ok: false, reason: '' };
    if (st === 'done') out.reason = 'Already researched.';
    else if (st === 'researching') out.reason = 'Being researched.';
    else if (st === 'locked') out.reason = `Requires ${TECH_BY_ID[T.req].name}.`;
    else if (k.research) out.reason = `Your scholars are busy with ${TECH_BY_ID[k.research.id].name}.`;
    else if (!Game.canAfford(kid, cost)) { out.reason = Game.missing(kid, cost); out.poor = true; }
    else out.ok = true;
    return out;
  },
  start(kid, id) {
    const inf = this.info(kid, id);
    if (!inf.ok) return { ok: false, msg: inf.reason };
    const T = TECH_BY_ID[id];
    Game.pay(kid, inf.cost);
    Game.k(kid).research = { id, left: T.time, total: T.time };
    Bus.emit('research', { kid });
    return { ok: true, msg: `Research started: ${T.name} (${T.time} days).` };
  },
  cancel(kid) {
    const k = Game.k(kid);
    if (!k.research) return { ok: false, msg: 'Nothing is being researched.' };
    const T = TECH_BY_ID[k.research.id];
    Game.gain(kid, { ...T.cost, rp: T.rp }, 0.5);
    k.research = null;
    Bus.emit('research', { kid });
    return { ok: true, msg: 'Research cancelled. Half of the cost was refunded.' };
  },
  tick(dt) {
    for (const k of Game.state.kingdoms) {
      if (!k.alive || !k.research) continue;
      k.research.left -= dt;
      if (k.research.left > 0) continue;
      const T = TECH_BY_ID[k.research.id];
      k.techs[T.id] = true;
      k.research = null;
      Game.rulerXp(k.id, 20);
      if (k.isPlayer) {
        Game.notify('Research complete!', `${T.name}: ${T.desc}`, { icon: T.icon, kind: 'good', sound: 'fanfare' });
        Game.log(`Your scholars mastered ${T.name}.`, T.icon, 'good');
      }
      Bus.emit('research', { kid: k.id, done: T.id });
    }
  },
  count(kid) { return Object.keys(Game.k(kid).techs).length; },
};
