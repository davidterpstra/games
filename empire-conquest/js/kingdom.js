/* =====================================================================
   EMPIRE CONQUEST — kingdom management: buildings, territory projects
   (develop / fortify / grow settlement), taxes, scouting, the ruler.
   Every action validates first and returns { ok, msg }.
   ===================================================================== */
'use strict';

const Kingdom = {
  maxFort(kid) { return Game.hasTech(kid, 'architecture') ? 6 : 5; },

  maxLevel(kid, tid, bid) {
    const ts = Game.t(tid);
    if (bid === 'castle') return Math.min(BUILDINGS.castle.maxLevel, ts.tier + 1);
    const isCap = Game.k(kid).capital === tid;
    return TIERS[ts.tier].maxLvl + (isCap ? 1 : 0);
  },

  /* ---------- buildings ---------- */
  buildInfo(kid, tid, bid) {
    const s = Game.state, ts = s.terr[tid], k = s.kingdoms[kid];
    const B = BUILDINGS[bid];
    const level = ts.b[bid] + 1;
    const cost = costScale(buildingCost(bid, level), Game.buildCostMult(kid));
    const time = buildingTime(bid, level);
    const info = { level, cost, time, ok: false, reason: '' };
    if (ts.owner !== kid) { info.reason = 'You do not own this territory.'; return info; }
    if (B.capitalOnly && k.capital !== tid) { info.reason = 'Only your capital has a castle.'; return info; }
    const max = this.maxLevel(kid, tid, bid);
    if (ts.b[bid] >= (B.maxLevel || 5)) { info.reason = 'Maximum level reached.'; info.maxed = true; return info; }
    if (level > max) {
      info.reason = bid === 'castle'
        ? `Grow the capital to a ${TIERS[Math.min(4, level - 1)].name} first.`
        : `A ${TIERS[ts.tier].name} allows level ${max}. Grow the settlement first.`;
      return info;
    }
    if (ts.proj) { info.reason = 'Builders are busy with another project here.'; return info; }
    if (!Game.canAfford(kid, cost)) { info.reason = Game.missing(kid, cost); info.poor = true; return info; }
    info.ok = true;
    return info;
  },
  build(kid, tid, bid) {
    const info = this.buildInfo(kid, tid, bid);
    if (!info.ok) return { ok: false, msg: info.reason };
    Game.pay(kid, info.cost);
    Game.t(tid).proj = { type: 'build', id: bid, level: info.level, left: info.time, total: info.time, cost: info.cost };
    Bus.emit('project', { tid, kid });
    return { ok: true, msg: `${BUILDINGS[bid].name} ${info.level > 1 ? 'upgrade to level ' + info.level : 'construction'} started (${info.time} days).` };
  },

  /* ---------- develop / fortify / settlement ---------- */
  developInfo(kid, tid) {
    const ts = Game.t(tid);
    const cost = costScale(developCost(ts.dev), Game.buildCostMult(kid));
    const info = { cost, time: developTime(ts.dev), ok: false, reason: '' };
    if (ts.owner !== kid) info.reason = 'You do not own this territory.';
    else if (ts.dev >= 10) { info.reason = 'Fully developed.'; info.maxed = true; }
    else if (ts.proj) info.reason = 'Builders are busy with another project here.';
    else if (!Game.canAfford(kid, cost)) { info.reason = Game.missing(kid, cost); info.poor = true; }
    else info.ok = true;
    return info;
  },
  develop(kid, tid) {
    const info = this.developInfo(kid, tid);
    if (!info.ok) return { ok: false, msg: info.reason };
    Game.pay(kid, info.cost);
    Game.t(tid).proj = { type: 'develop', left: info.time, total: info.time, cost: info.cost };
    Bus.emit('project', { tid, kid });
    return { ok: true, msg: `Development started (${info.time} days).` };
  },
  fortifyInfo(kid, tid) {
    const ts = Game.t(tid);
    const cost = costScale(fortifyCost(ts.fort), Game.buildCostMult(kid));
    const info = { cost, time: fortifyTime(ts.fort), ok: false, reason: '' };
    if (ts.owner !== kid) info.reason = 'You do not own this territory.';
    else if (ts.fort >= this.maxFort(kid)) { info.reason = 'Walls are as strong as they can be.'; info.maxed = true; }
    else if (ts.proj) info.reason = 'Builders are busy with another project here.';
    else if (!Game.canAfford(kid, cost)) { info.reason = Game.missing(kid, cost); info.poor = true; }
    else info.ok = true;
    return info;
  },
  fortify(kid, tid) {
    const info = this.fortifyInfo(kid, tid);
    if (!info.ok) return { ok: false, msg: info.reason };
    Game.pay(kid, info.cost);
    Game.t(tid).proj = { type: 'fortify', left: info.time, total: info.time, cost: info.cost };
    Bus.emit('project', { tid, kid });
    return { ok: true, msg: `Fortification started (${info.time} days).` };
  },
  tierInfo(kid, tid) {
    const s = Game.state, ts = s.terr[tid], k = s.kingdoms[kid];
    const next = TIERS[ts.tier + 1];
    const info = { next, ok: false, reason: '', reqs: [] };
    if (!next) { info.reason = 'This is already the largest settlement type.'; info.maxed = true; return info; }
    if (next.req.capitalOnly && k.capital !== tid) { info.reason = 'Only your capital can become a Capital.'; info.maxed = true; return info; }
    info.cost = costScale(next.cost, Game.buildCostMult(kid));
    info.time = next.time;
    const capCastle = s.terr[k.capital] ? s.terr[k.capital].b.castle : 0;
    const r = next.req;
    info.reqs.push({ text: `Population ${fmtInt(r.pop)}`, ok: ts.pop >= r.pop });
    info.reqs.push({ text: `Development ${r.dev}`, ok: ts.dev >= r.dev });
    if (r.castle) info.reqs.push({ text: `Castle level ${r.castle} in your capital`, ok: capCastle >= r.castle });
    if (r.tech) info.reqs.push({ text: `Technology: ${TECH_BY_ID[r.tech].name}`, ok: !!k.techs[r.tech] });
    if (ts.owner !== kid) info.reason = 'You do not own this territory.';
    else if (info.reqs.some((q) => !q.ok)) info.reason = 'Requirements not met.';
    else if (ts.proj) info.reason = 'Builders are busy with another project here.';
    else if (!Game.canAfford(kid, info.cost)) { info.reason = Game.missing(kid, info.cost); info.poor = true; }
    else info.ok = true;
    return info;
  },
  upgradeTier(kid, tid) {
    const info = this.tierInfo(kid, tid);
    if (!info.ok) return { ok: false, msg: info.reason };
    Game.pay(kid, info.cost);
    Game.t(tid).proj = { type: 'tier', left: info.time, total: info.time, cost: info.cost };
    Bus.emit('project', { tid, kid });
    return { ok: true, msg: `${Game.wt(tid).name} starts growing into a ${info.next.name} (${info.time} days).` };
  },
  cancelProject(kid, tid) {
    const ts = Game.t(tid);
    if (ts.owner !== kid || !ts.proj) return { ok: false, msg: 'Nothing to cancel.' };
    Game.gain(kid, ts.proj.cost || {}, 0.5);
    ts.proj = null;
    Bus.emit('project', { tid, kid });
    return { ok: true, msg: 'Project cancelled. Half of the cost was refunded.' };
  },
  projectName(p) {
    if (!p) return '';
    if (p.type === 'build') return `${BUILDINGS[p.id].icon} ${BUILDINGS[p.id].name} → level ${p.level}`;
    if (p.type === 'develop') return '📈 Developing the land';
    if (p.type === 'fortify') return '🧱 Strengthening the walls';
    if (p.type === 'tier') return '🏗️ Growing the settlement';
    return '';
  },

  tickProjects(dt) {
    const s = Game.state;
    for (let tid = 0; tid < s.terr.length; tid++) {
      const ts = s.terr[tid];
      if (!ts.proj || ts.owner < 0) continue;
      ts.proj.left -= dt;
      if (ts.proj.left > 0) continue;
      const p = ts.proj;
      ts.proj = null;
      const kid = ts.owner;
      const name = Game.wt(tid).name;
      let msg = '';
      if (p.type === 'build') { ts.b[p.id] = p.level; msg = `${BUILDINGS[p.id].name} ${p.level > 1 ? 'upgraded to level ' + p.level : 'built'} in ${name}.`; }
      else if (p.type === 'develop') { ts.dev++; msg = `${name} is now development level ${ts.dev}.`; }
      else if (p.type === 'fortify') { ts.fort++; msg = `The walls of ${name} reached level ${ts.fort}.`; }
      else if (p.type === 'tier') {
        ts.tier++;
        msg = `${name} has grown into a ${TIERS[ts.tier].name}!`;
        Game.rulerXp(kid, 25);
        if (kid === 0) Game.log(msg, TIERS[ts.tier].icon, 'good', tid);
      }
      if (kid === 0) {
        Game.notify('Construction complete', msg, { icon: p.type === 'build' ? BUILDINGS[p.id].icon : '🏗️', kind: 'good', tid, sound: 'build' });
      }
      Bus.emit('projectDone', { tid, kid, p });
    }
  },

  /* ---------- taxes ---------- */
  setTax(kid, tid, level) {
    const ts = Game.t(tid);
    if (ts.owner !== kid) return { ok: false, msg: 'You do not own this territory.' };
    ts.tax = clamp(level | 0, 0, 2);
    Bus.emit('territory', tid);
    return { ok: true, msg: `Taxes in ${Game.wt(tid).name} set to ${TAX_LEVELS[ts.tax].name}.` };
  },
  setTaxAll(kid, level) {
    for (const tid of Game.territoriesOf(kid)) Game.t(tid).tax = clamp(level | 0, 0, 2);
    Bus.emit('territory', -1);
    return { ok: true, msg: `Taxes set to ${TAX_LEVELS[level].name} everywhere.` };
  },

  /* ---------- scouting ---------- */
  scoutInfo(kid, tid) {
    const s = Game.state;
    const info = { cost: SCOUT_COST, ok: false, reason: '' };
    if (s.explored[tid]) info.reason = 'Already explored.';
    else if (!Game.wt(tid).adj.some((a) => s.explored[a.t])) info.reason = 'Too far away. Explore the lands next to it first.';
    else if (!Game.canAfford(kid, SCOUT_COST)) { info.reason = Game.missing(kid, SCOUT_COST); info.poor = true; }
    else info.ok = true;
    return info;
  },
  scout(kid, tid) {
    const info = this.scoutInfo(kid, tid);
    if (!info.ok) return { ok: false, msg: info.reason };
    Game.pay(kid, SCOUT_COST);
    Game.explore([tid], true);
    // scouts also glimpse the lands beyond (only the territory itself is guaranteed)
    const n = Game.wt(tid).adj.filter(() => Math.random() < 0.5).map((a) => a.t);
    Game.explore(n, true);
    return { ok: true, msg: `Scouts mapped ${Game.wt(tid).name}.` };
  },

  /* ---------- the ruler ---------- */
  spendPoint(kid, stat) {
    const r = Game.k(kid).ruler;
    if (r.points <= 0) return { ok: false, msg: 'No skill points left. Your ruler earns them by gaining experience.' };
    if (r[stat] >= 10) return { ok: false, msg: 'This skill is already at its maximum (10).' };
    r[stat]++; r.points--;
    Bus.emit('ruler');
    return { ok: true, msg: `${RULER_STATS.find((x) => x.id === stat).name} increased to ${r[stat]}.` };
  },
};
