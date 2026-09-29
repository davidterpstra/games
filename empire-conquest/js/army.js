/* =====================================================================
   EMPIRE CONQUEST — recruiting, armies, generals, movement & conquest
   Soldiers are trained into a territory's garrison. Armies are formed
   from a garrison and march along the territory graph (land borders
   and sea routes). Marching into a hostile territory starts a battle;
   winning it captures the territory.
   ===================================================================== */
'use strict';

const Army = {
  maxArmies(kid) {
    const k = Game.k(kid);
    return 2 + Math.floor(k.ruler.lead / 2) + (k.techs.administration ? 1 : 0);
  },
  of(kid) { return Game.state.armies.filter((a) => a.owner === kid); },
  byId(id) { return Game.state.armies.find((a) => a.id === id) || null; },
  at(tid, kid) { return Game.state.armies.filter((a) => a.loc === tid && !a.move && (kid === undefined || a.owner === kid)); },
  total(units) { return Battle.total(units); },

  /* ---------------- recruiting ---------------- */
  unitReq(kid, tid, u) {
    const ts = Game.t(tid);
    const R = UNITS[u].req || {};
    if (ts.owner !== kid) return { ok: false, reason: 'You do not own this territory.' };
    const bl = ts.b.barracks;
    if (u === 'archers' && bl < 1) return { ok: false, reason: 'Needs a Barracks here.' };
    if (R.barracks && bl < R.barracks) return { ok: false, reason: `Needs Barracks level ${R.barracks} here.` };
    if (R.blacksmith && Game.bestBuilding(kid, 'blacksmith') < R.blacksmith) return { ok: false, reason: `Needs a level ${R.blacksmith} Blacksmith in your kingdom.` };
    if (R.tech && !Game.hasTech(kid, R.tech)) return { ok: false, reason: `Research ${TECH_BY_ID[R.tech].name} first.` };
    return { ok: true, reason: '' };
  },
  trainRate(kid, tid) {
    const ts = Game.t(tid);
    const bl = ts.b.barracks;
    return (bl ? 1 + 0.6 * (bl - 1) : 0.5) * TIERS[ts.tier].recruit * (1 + 0.03 * Game.k(kid).ruler.lead);
  },
  availablePop(tid) {
    const ts = Game.t(tid);
    return Math.max(0, Math.floor(ts.pop - 40));
  },
  maxTrain(kid, tid, u) {
    const U = UNITS[u];
    const r = Game.k(kid).res;
    let n = Math.floor(this.availablePop(tid) / U.pop);
    for (const key in U.cost) n = Math.min(n, Math.floor((r[key] || 0) / U.cost[key]));
    return Math.max(0, Math.min(n, 2000));
  },
  train(kid, tid, u, n) {
    n = Math.floor(n);
    const ts = Game.t(tid);
    const req = this.unitReq(kid, tid, u);
    if (!req.ok) return { ok: false, msg: req.reason };
    if (n < 1) return { ok: false, msg: 'Choose how many soldiers to train.' };
    if (ts.queue.length >= 5) return { ok: false, msg: 'The training queue here is full (5 orders).' };
    const U = UNITS[u];
    if (n * U.pop > this.availablePop(tid)) return { ok: false, msg: `Not enough people in ${Game.wt(tid).name} (${this.availablePop(tid)} can be recruited).` };
    const cost = costScale(U.cost, n);
    if (!Game.canAfford(kid, cost)) return { ok: false, msg: Game.missing(kid, cost) };
    Game.pay(kid, cost);
    ts.pop -= n * U.pop;
    ts.queue.push({ u, n, done: 0, prog: 0 });
    Bus.emit('training', { tid, kid });
    return { ok: true, msg: `Training ${n} ${U.name} in ${Game.wt(tid).name}.` };
  },
  cancelTraining(kid, tid, idx) {
    const ts = Game.t(tid);
    const q = ts.queue[idx];
    if (ts.owner !== kid || !q) return { ok: false, msg: 'Nothing to cancel.' };
    const left = q.n - q.done;
    Game.gain(kid, costScale(UNITS[q.u].cost, left));
    ts.pop += left * UNITS[q.u].pop;
    ts.queue.splice(idx, 1);
    Bus.emit('training', { tid, kid });
    return { ok: true, msg: `Cancelled ${left} ${UNITS[q.u].name}. Resources refunded.` };
  },
  queueDays(kid, tid) {
    const ts = Game.t(tid);
    const rate = this.trainRate(kid, tid);
    let d = 0;
    for (const q of ts.queue) d += ((q.n - q.done) - q.prog) * UNITS[q.u].time / rate;
    return d;
  },
  tickTraining(dt) {
    const s = Game.state;
    for (let tid = 0; tid < s.terr.length; tid++) {
      const ts = s.terr[tid];
      if (!ts.queue.length || ts.owner < 0) continue;
      const kid = ts.owner, k = s.kingdoms[kid];
      const q = ts.queue[0];
      q.prog += this.trainRate(kid, tid) / UNITS[q.u].time * dt;
      while (q.prog >= 1 && q.done < q.n) { q.prog -= 1; q.done++; ts.gar[q.u]++; k.trained++; }
      if (q.done >= q.n) {
        ts.queue.shift();
        if (kid === 0) Game.notify('Training complete', `${q.n} ${UNITS[q.u].name} joined the garrison of ${Game.wt(tid).name}.`, { icon: UNITS[q.u].icon, kind: 'good', tid, sound: 'notify' });
        Bus.emit('training', { tid, kid });
      }
    }
  },

  /* ---------------- army management ---------------- */
  pickUnits(from, units) {
    for (const u of UNIT_ORDER) if ((units[u] || 0) > (from[u] || 0) || (units[u] || 0) < 0) return false;
    return true;
  },
  create(kid, tid, units, silent = false) {
    const s = Game.state, ts = s.terr[tid];
    if (ts.owner !== kid) return { ok: false, msg: 'You can only raise armies in your own territories.' };
    if (this.of(kid).length >= this.maxArmies(kid)) return { ok: false, msg: `You can command at most ${this.maxArmies(kid)} armies. Improve your ruler's Leadership for more.` };
    const clean = {};
    for (const u of UNIT_ORDER) clean[u] = Math.max(0, Math.floor(units[u] || 0));
    if (this.total(clean) < 1) return { ok: false, msg: 'An army needs at least one soldier.' };
    if (!this.pickUnits(ts.gar, clean)) return { ok: false, msg: 'Not enough soldiers in the garrison.' };
    for (const u of UNIT_ORDER) ts.gar[u] -= clean[u];
    const a = Game.makeArmy(s, kid, tid, clean);
    s.armies.push(a);
    Bus.emit('armies');
    return { ok: true, msg: `${a.name} raised in ${Game.wt(tid).name}.`, army: a };
  },
  checkHome(a) {
    if (a.move) return 'The army is on the march.';
    const ts = Game.t(a.loc);
    if (ts.owner !== a.owner) return 'The army must stand in one of your own territories.';
    return '';
  },
  reinforce(kid, id, units) {
    const a = this.byId(id);
    if (!a || a.owner !== kid) return { ok: false, msg: 'Unknown army.' };
    const why = this.checkHome(a); if (why) return { ok: false, msg: why };
    const ts = Game.t(a.loc);
    if (!this.pickUnits(ts.gar, units)) return { ok: false, msg: 'Not enough soldiers in the garrison.' };
    for (const u of UNIT_ORDER) { const n = Math.floor(units[u] || 0); ts.gar[u] -= n; a.units[u] += n; }
    Bus.emit('armies');
    return { ok: true, msg: `${a.name} reinforced.` };
  },
  station(kid, id, units) {
    const a = this.byId(id);
    if (!a || a.owner !== kid) return { ok: false, msg: 'Unknown army.' };
    const why = this.checkHome(a); if (why) return { ok: false, msg: why };
    if (!this.pickUnits(a.units, units)) return { ok: false, msg: 'The army does not have that many soldiers.' };
    const ts = Game.t(a.loc);
    for (const u of UNIT_ORDER) { const n = Math.floor(units[u] || 0); a.units[u] -= n; ts.gar[u] += n; }
    this.cleanup();
    Bus.emit('armies');
    return { ok: true, msg: `Troops stationed in ${Game.wt(a.loc).name}.` };
  },
  disband(kid, id) {
    const a = this.byId(id);
    if (!a || a.owner !== kid) return { ok: false, msg: 'Unknown army.' };
    const why = this.checkHome(a); if (why) return { ok: false, msg: why };
    const ts = Game.t(a.loc);
    for (const u of UNIT_ORDER) ts.gar[u] += a.units[u];
    Game.state.armies = Game.state.armies.filter((x) => x !== a);
    Bus.emit('armies');
    return { ok: true, msg: `${a.name} joined the garrison of ${Game.wt(a.loc).name}.` };
  },
  split(kid, id, units) {
    const a = this.byId(id);
    if (!a || a.owner !== kid) return { ok: false, msg: 'Unknown army.' };
    if (a.move) return { ok: false, msg: 'Wait until the army stops marching.' };
    if (this.of(kid).length >= this.maxArmies(kid)) return { ok: false, msg: `You can command at most ${this.maxArmies(kid)} armies.` };
    if (!this.pickUnits(a.units, units) || this.total(units) < 1) return { ok: false, msg: 'Choose soldiers for the new army.' };
    if (this.total(units) >= this.total(a.units)) return { ok: false, msg: 'Leave at least one soldier in the old army.' };
    for (const u of UNIT_ORDER) a.units[u] -= Math.floor(units[u] || 0);
    const b = Game.makeArmy(Game.state, kid, a.loc, units);
    Game.state.armies.push(b);
    Bus.emit('armies');
    return { ok: true, msg: `${b.name} split off from ${a.name}.`, army: b };
  },
  merge(kid, id, otherId) {
    const a = this.byId(id), b = this.byId(otherId);
    if (!a || !b || a.owner !== kid || b.owner !== kid || a === b) return { ok: false, msg: 'Unknown army.' };
    if (a.move || b.move || a.loc !== b.loc) return { ok: false, msg: 'Both armies must stand in the same territory.' };
    for (const u of UNIT_ORDER) a.units[u] += b.units[u];
    if (!a.general && b.general) a.general = b.general;
    Game.state.armies = Game.state.armies.filter((x) => x !== b);
    Bus.emit('armies');
    return { ok: true, msg: `${b.name} merged into ${a.name}.` };
  },
  generalCost(kid) { return Math.round(GENERAL_COST * (1 + 0.5 * this.of(kid).filter((a) => a.general).length)); },
  newGeneral(rng = Math) {
    const r = () => (rng.next ? rng.next() : rng.random());
    const traits = Object.keys(GENERAL_TRAITS);
    return {
      name: GENERAL_FIRST[Math.floor(r() * GENERAL_FIRST.length)] + ' ' + GENERAL_LAST[Math.floor(r() * GENERAL_LAST.length)],
      trait: traits[Math.floor(r() * traits.length)], level: 1, xp: 0,
    };
  },
  hireGeneral(kid, id) {
    const a = this.byId(id);
    if (!a || a.owner !== kid) return { ok: false, msg: 'Unknown army.' };
    if (a.general) return { ok: false, msg: `${a.general.name} already leads this army.` };
    const cost = { gold: this.generalCost(kid) };
    if (!Game.canAfford(kid, cost)) return { ok: false, msg: Game.missing(kid, cost) };
    Game.pay(kid, cost);
    a.general = this.newGeneral();
    Bus.emit('armies');
    return { ok: true, msg: `General ${a.general.name} (${GENERAL_TRAITS[a.general.trait].name}) takes command of ${a.name}.` };
  },
  rename(kid, id, name) {
    const a = this.byId(id);
    if (!a || a.owner !== kid) return { ok: false, msg: 'Unknown army.' };
    const n = String(name || '').trim().slice(0, 28);
    if (!n) return { ok: false, msg: 'Enter a name.' };
    a.name = n;
    Bus.emit('armies');
    return { ok: true, msg: 'Army renamed.' };
  },

  /* ---------------- movement ---------------- */
  speed(a) {
    let sp = Infinity;
    for (const u of UNIT_ORDER) if (a.units[u] > 0) sp = Math.min(sp, UNITS[u].speed);
    if (!Number.isFinite(sp)) sp = 1;
    const k = Game.k(a.owner);
    if (k.techs.roads) sp *= 1.25;
    if (k.techs.cavalry) sp *= 1.1;
    if (a.general && a.general.trait === 'swift') sp *= 1.2;
    return sp;
  },
  legDays(spd, from, to, sea) {
    const A = Game.wt(from), B = Game.wt(to);
    const d = dist(A.cx, A.cy, B.cx, B.cy);
    return d / (55 * spd) * (0.6 + 0.4 * TERRAIN[B.terrain].move) * (sea ? 1.6 : 1);
  },
  /* Dijkstra over territories. Only own/allied lands can be crossed; the
     destination may also be hostile (that is an attack). */
  findPath(kid, from, to, spd) {
    const s = Game.state;
    if (from === to) return { path: [], days: 0 };
    const owner = s.terr[to].owner;
    const friendlyTo = Game.isFriendly(kid, owner);
    const hostileTo = Game.isHostile(kid, owner);
    if (!friendlyTo && !hostileTo) return { error: `You are at peace with ${Game.ownerName(owner)}. Declare war first.` };
    const T = s.terr.length;
    const cost = new Float64Array(T).fill(Infinity), prev = new Int32Array(T).fill(-1), prevSea = new Uint8Array(T);
    const heap = new MinHeap();
    cost[from] = 0; heap.push(0, from);
    while (heap.size) {
      const t = heap.pop();
      if (heap.lastKey > cost[t]) continue;
      if (t === to) break;
      if (t !== from && !Game.isFriendly(kid, s.terr[t].owner)) continue; // cannot pass through
      for (const a of Game.wt(t).adj) {
        const n = a.t;
        if (n !== to && !Game.isFriendly(kid, s.terr[n].owner)) continue;
        const c = cost[t] + this.legDays(spd, t, n, a.sea);
        if (c < cost[n]) { cost[n] = c; prev[n] = t; prevSea[n] = a.sea ? 1 : 0; heap.push(c, n); }
      }
    }
    if (!Number.isFinite(cost[to])) return { error: hostileTo ? 'No route: you need a territory next to it (or a sea route) to attack.' : 'No route to that territory.' };
    const path = [];
    let sea = false;
    for (let t = to; t !== from; t = prev[t]) { path.unshift(t); if (prevSea[t]) sea = true; }
    return { path, days: cost[to], attack: hostileTo, sea };
  },
  order(kid, id, to) {
    const a = this.byId(id);
    if (!a || a.owner !== kid) return { ok: false, msg: 'Unknown army.' };
    if (this.total(a.units) < 1) return { ok: false, msg: 'This army has no soldiers.' };
    const start = a.move ? a.move.to : a.loc;
    if (start === to) { a.path = []; return { ok: true, msg: `${a.name} holds position.` }; }
    const r = this.findPath(kid, start, to, this.speed(a));
    if (r.error) return { ok: false, msg: r.error };
    a.path = r.path;
    a.target = to;
    Bus.emit('armies');
    return { ok: true, msg: r.attack ? `${a.name} marches to attack ${Game.wt(to).name} (${Math.ceil(r.days + (a.move ? a.move.days * (1 - a.move.t) : 0))} days).` : `${a.name} marches to ${Game.wt(to).name} (${Math.ceil(r.days)} days).`, days: r.days };
  },
  stop(kid, id) {
    const a = this.byId(id);
    if (!a || a.owner !== kid) return { ok: false, msg: 'Unknown army.' };
    a.path = [];
    Bus.emit('armies');
    return { ok: true, msg: a.move ? `${a.name} will halt in ${Game.wt(a.move.to).name}.` : `${a.name} halts.` };
  },
  eta(a) {
    let d = a.move ? a.move.days * (1 - a.move.t) : 0;
    let cur = a.move ? a.move.to : a.loc;
    const spd = this.speed(a);
    for (const n of a.path) {
      if (a.move && n === a.move.to) continue;
      const adj = Game.wt(cur).adj.find((x) => x.t === n);
      d += this.legDays(spd, cur, n, adj && adj.sea);
      cur = n;
    }
    return d;
  },

  /* move to the nearest friendly territory, or disband if there is none */
  retreat(a, fromTid) {
    const s = Game.state;
    a.path = []; a.move = null;
    if (this.total(a.units) < 1) { a.dead = true; this.cleanup(); return; }
    const d = Game.hops(fromTid);
    let best = -1, bd = 99;
    for (let t = 0; t < s.terr.length; t++) {
      if (t === fromTid) continue;
      if (s.terr[t].owner === a.owner && d[t] < bd) { bd = d[t]; best = t; }
    }
    if (best < 0) for (let t = 0; t < s.terr.length; t++) if (t !== fromTid && Game.isFriendly(a.owner, s.terr[t].owner) && d[t] < bd) { bd = d[t]; best = t; }
    if (best < 0) { a.dead = true; this.cleanup(); return; }
    a.loc = best;
  },
  cleanup() {
    const s = Game.state;
    const before = s.armies.length;
    s.armies = s.armies.filter((a) => !a.dead && this.total(a.units) >= 1);
    if (s.armies.length !== before) Bus.emit('armies');
  },
  /* after peace or a broken alliance: armies standing in foreign land go home */
  evictForeign() {
    for (const a of Game.state.armies) {
      if (!Game.isFriendly(a.owner, Game.t(a.loc).owner)) this.retreat(a, a.loc);
      if (a.path.length) {
        const bad = a.path.some((t, i) => i < a.path.length - 1 && !Game.isFriendly(a.owner, Game.t(t).owner));
        if (bad) a.path = [];
      }
    }
  },

  tick(dt) {
    this.tickTraining(dt);
    const s = Game.state;
    for (const a of s.armies.slice()) {
      if (a.dead) continue;
      if (!a.move && a.path.length) {
        const next = a.path[0];
        const owner = s.terr[next].owner;
        const isLast = a.path.length === 1;
        const friendly = Game.isFriendly(a.owner, owner), hostile = Game.isHostile(a.owner, owner);
        const adj = Game.wt(a.loc).adj.find((x) => x.t === next);
        if (!adj || (!friendly && !hostile)) { a.path = []; continue; }
        if (!friendly && !isLast) {
          // an unexpected hostile territory on the way: attack it and stop there
          a.path = [next];
        }
        a.move = { from: a.loc, to: next, t: 0, days: Math.max(0.5, this.legDays(this.speed(a), a.loc, next, adj.sea)), sea: adj.sea };
        if (hostile && owner === 0 && a.owner !== 0 && s.explored[next]) {
          Game.notify('Enemy army approaching!', `${a.name} of ${Game.k(a.owner).short} (${fmt(this.total(a.units))} soldiers) is marching on ${Game.wt(next).name}. It arrives in ${Math.ceil(a.move.days)} days.`, { icon: '⚠️', kind: 'bad', tid: next, sound: 'alert' });
        }
      }
      if (a.move) {
        a.move.t += dt / a.move.days;
        if (a.move.t >= 1) this.arrive(a);
      }
    }
    this.cleanup();
  },

  arrive(a) {
    const s = Game.state;
    const leg = a.move;
    a.move = null;
    const to = leg.to;
    if (a.path[0] === to) a.path.shift();
    const ts = s.terr[to];
    if (Game.isFriendly(a.owner, ts.owner)) {
      a.loc = to;
      if (a.owner === 0) Game.exploreAround(to);
      if (!a.path.length) Bus.emit('armyArrived', a);
      return;
    }
    if (!Game.isHostile(a.owner, ts.owner)) { a.path = []; return; }
    const oldOwner = ts.owner;
    const rep = Battle.fight(a, to, leg.sea);
    if (rep.win) {
      a.loc = to;
      Game.setOwner(to, a.owner, a.owner);
      const k = s.kingdoms[a.owner];
      k.captured++;
      Game.rulerXp(a.owner, a.owner === 0 ? 40 : 15);
      Diplomacy.onConquest(a.owner, oldOwner, to);
      const nm = Game.wt(to).name;
      if (a.owner === 0) {
        Game.log(`${a.name} captured ${nm}${oldOwner >= 0 ? ' from ' + Game.k(oldOwner).short : ''}.`, '🚩', 'good', to);
      } else if (oldOwner === 0) {
        Game.log(`${k.short} captured ${nm}!`, '🔥', 'bad', to);
        Game.notify('Territory lost!', `${k.short} has captured ${nm}.`, { icon: '🔥', kind: 'bad', tid: to, sound: 'alert' });
      } else if (s.explored[to]) {
        Game.log(`${k.short} captured ${nm}${oldOwner >= 0 ? ' from ' + Game.k(oldOwner).short : ''}.`, '⚔️', 'war', to);
      }
      Bus.emit('conquest', { tid: to, kid: a.owner, old: oldOwner, army: a.id, report: rep });
    } else {
      a.path = [];
      if (Game.isFriendly(a.owner, s.terr[leg.from].owner)) a.loc = leg.from;
      else this.retreat(a, to);
      if (oldOwner === 0 && a.owner !== 0) Game.log(`${Game.wt(to).name} held against ${Game.k(a.owner).short}!`, '🛡️', 'good', to);
      else if (a.owner === 0) Game.log(`${a.name} was repulsed at ${Game.wt(to).name}.`, '💥', 'bad', to);
    }
    this.cleanup();
  },

  /* world position (for rendering) */
  position(a) {
    if (a.move) {
      const A = Game.wt(a.move.from), B = Game.wt(a.move.to);
      const t = smooth(clamp(a.move.t, 0, 1));
      return { x: lerp(A.cx, B.cx, t), y: lerp(A.cy, B.cy, t), moving: true };
    }
    const T = Game.wt(a.loc);
    return { x: T.cx, y: T.cy, moving: false };
  },
};
