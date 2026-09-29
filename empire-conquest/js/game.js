/* =====================================================================
   EMPIRE CONQUEST — game state, setup and core queries
   Game.state is the only thing that gets saved. Game.world is rebuilt
   from the seed. Game.cache holds derived data (rebuilt when dirty).
   ===================================================================== */
'use strict';

const Game = {
  world: null,
  state: null,
  cache: { dirty: true, kTerr: [], capDist: [], rates: [], power: [], soldiers: [], popCap: [], pop: [], happy: [], rank: [], caps: [], smith: [] },
  STEP: 0.1,
  acc: 0,

  /* ---------------- setup ---------------- */
  newState(opts) {
    const world = this.world;
    const seed = opts.seed;
    const rng = new Rng(seed ^ 0x5bd1e995);
    const diff = opts.difficulty || 'normal';
    const WT = world.territories;
    const s = {
      version: 1, seed, difficulty: diff, day: 0, speed: 1, nextId: 1,
      kingdoms: [], terr: [], armies: [], rel: {}, explored: [], log: [], battles: [], offers: [],
      missions: {}, victory: false, over: false, created: Date.now(), tutorial: true,
    };

    // ---- territories ----
    for (const t of WT) {
      s.terr.push({
        owner: -1, tier: 0, pop: 0, happy: 55, dev: 0, fort: 0, tax: 1, unrest: 0,
        b: { castle: 0, farm: 0, lumber: 0, mine: 0, houses: 0, market: 0, barracks: 0, blacksmith: 0, academy: 0, temple: 0 },
        proj: null, gar: emptyUnits(), queue: [], since: 0,
      });
      s.explored.push(false);
    }

    // ---- capitals: spread out with farthest-point sampling ----
    const cand = WT.filter((t) => t.terrain !== 'island' && t.area >= 12 && t.nb.length >= 3);
    const caps = [];
    caps.push(rng.pick(cand).id);
    while (caps.length < 7) {
      let best = -1, bd = -1;
      for (const t of cand) {
        if (caps.includes(t.id)) continue;
        let md = Infinity;
        for (const c of caps) md = Math.min(md, dist(t.cx, t.cy, WT[c].cx, WT[c].cy));
        // stay away from the map rim a little
        const rim = Math.min(t.cx, world.W - t.cx, t.cy, world.H - t.cy);
        const score = md + Math.min(rim, 300) * 0.4 + rng.next() * 60;
        if (score > bd) { bd = score; best = t.id; }
      }
      if (best < 0) break;
      caps.push(best);
    }
    // player's start: prefer plains/forest with several neighbours
    const startScore = (id) => {
      const t = WT[id];
      return (t.terrain === 'plains' ? 30 : t.terrain === 'forest' ? 18 : 0) + t.nb.length * 4 + (t.river ? 8 : 0) + rng.next() * 10;
    };
    const playerCap = caps.slice().sort((a, b) => startScore(b) - startScore(a))[0];
    const aiCaps = rng.shuffle(caps.filter((c) => c !== playerCap));

    // ---- kingdoms ----
    const pk = {
      id: 0, name: opts.kingdomName || 'Kingdom of Avalon', short: opts.kingdomShort || (opts.kingdomName || 'Avalon').replace(/^Kingdom of /, ''),
      color: opts.color || PLAYER_COLORS[0], isPlayer: true, alive: true, capital: playerCap,
      ruler: { name: opts.rulerName || 'Aldric', title: opts.rulerTitle || 'King', mil: 3, eco: 3, dip: 3, lead: 3, xp: 0, level: 1, points: 0 },
      res: { gold: 500, food: 250, wood: 200, iron: 100, rp: 0 },
      techs: {}, research: null, p: null,
      trained: 0, captured: 0, battlesWon: 0, battlesLost: 0, capitalsTaken: 0, kingdomsDestroyed: 0, armyNo: 1,
      starving: false, broke: false, ai: null,
    };
    s.kingdoms.push(pk);
    for (let i = 0; i < 6; i++) {
      const d = KINGDOM_DEFS[i];
      s.kingdoms.push({
        id: i + 1, name: 'Kingdom of ' + d.name, short: d.name, color: d.color, isPlayer: false, alive: true, capital: aiCaps[i],
        ruler: { name: d.ruler, title: d.title, mil: d.mil[0], eco: d.mil[1], dip: d.mil[2], lead: d.mil[3], xp: 0, level: 1, points: 0 },
        res: { gold: 600, food: 400, wood: 300, iron: 150, rp: 0 },
        techs: {}, research: null, p: { ...d.p },
        trained: 0, captured: 0, battlesWon: 0, battlesLost: 0, capitalsTaken: 0, kingdomsDestroyed: 0, armyNo: 1,
        starving: false, broke: false, ai: { timer: rng.range(0.5, 3), dipTimer: rng.range(2, 8), goal: null },
      });
    }
    // relations
    for (let a = 0; a < s.kingdoms.length; a++) {
      for (let b = a + 1; b < s.kingdoms.length; b++) {
        s.rel[a + ',' + b] = { v: rng.int(-15, 20), st: 'peace', trade: false, truce: 0, since: 0, gainA: 0, gainB: 0, gift: [0, 0] };
      }
    }

    // ---- hop distance from the player's capital (keep a neutral buffer) ----
    const hopsFromPlayer = this.hops(playerCap);

    // ---- neutral lands ----
    for (const t of WT) {
      const ts = s.terr[t.id];
      const T = TERRAIN[t.terrain];
      const far = Math.min(hopsFromPlayer[t.id], 8);
      ts.tier = rng.chance(0.12 + far * 0.015) ? 1 : 0;
      ts.pop = Math.round((ts.tier ? rng.range(300, 430) : rng.range(120, 230)) * T.pop);
      ts.happy = 50;
      if (rng.chance(0.4)) ts.b.farm = 1;
      if (t.terrain === 'mountains' && rng.chance(0.5)) ts.b.mine = 1;
      if (t.terrain === 'forest' && rng.chance(0.4)) ts.b.lumber = 1;
      if (ts.tier) { ts.b.houses = 1; ts.fort = rng.chance(0.5) ? 1 : 0; }
      const str = (1 + far * 0.13) * (ts.tier ? 1.5 : 1) * (1 + T.defense * 0.5);
      ts.gar.infantry = Math.round(rng.range(12, 26) * str);
      ts.gar.archers = Math.round(rng.range(4, 12) * str);
      if (far >= 4 && rng.chance(0.3)) ts.gar.cavalry = Math.round(rng.range(3, 8) * str);
    }

    // ---- AI heartlands ----
    const claim = (tid, kid) => {
      const ts = s.terr[tid];
      ts.owner = kid; ts.since = 0;
      ts.happy = 62;
      ts.gar = { infantry: rng.int(16, 26), archers: rng.int(6, 12), cavalry: 0, knights: 0, siege: 0 };
      if (!ts.b.farm && rng.chance(0.6)) ts.b.farm = 1;
    };
    const aiTarget = s.kingdoms.slice(1).map((k) => 3 + Math.round(k.p.expansion * 2 + rng.next()));
    const frontier = s.kingdoms.slice(1).map((k) => [k.capital]);
    s.kingdoms.slice(1).forEach((k) => claim(k.capital, k.id));
    let progress = true;
    const owned = s.kingdoms.slice(1).map(() => 1);
    while (progress) {
      progress = false;
      for (let i = 0; i < 6; i++) {
        if (owned[i] >= aiTarget[i]) continue;
        const kid = i + 1;
        // grow toward the nearest unclaimed land neighbour
        let best = -1, bd = Infinity;
        for (const f of frontier[i]) {
          for (const n of WT[f].nb) {
            if (s.terr[n].owner !== -1 || hopsFromPlayer[n] < 3) continue;
            const d = dist(WT[n].cx, WT[n].cy, WT[s.kingdoms[kid].capital].cx, WT[s.kingdoms[kid].capital].cy);
            if (d < bd) { bd = d; best = n; }
          }
        }
        if (best >= 0) { claim(best, kid); frontier[i].push(best); owned[i]++; progress = true; }
      }
    }
    // AI capitals
    for (const k of s.kingdoms.slice(1)) {
      const ts = s.terr[k.capital];
      ts.tier = 1; ts.pop = rng.int(430, 520); ts.happy = 66; ts.fort = 1;
      Object.assign(ts.b, { castle: 1, farm: 1, lumber: 1, houses: 1, barracks: 1, market: rng.chance(0.5) ? 1 : 0 });
      ts.gar = { infantry: 45, archers: 20, cavalry: 0, knights: 0, siege: 0 };
      for (const tid of this.ownedBy(k.id, s)) if (tid !== k.capital) s.terr[tid].pop = Math.max(s.terr[tid].pop, rng.int(170, 260));
      s.armies.push(this.makeArmy(s, k.id, k.capital, { infantry: rng.int(55, 70), archers: rng.int(20, 30), cavalry: 0, knights: 0, siege: 0 }));
    }

    // ---- the player ----
    {
      const ts = s.terr[playerCap];
      ts.owner = 0; ts.tier = 1; ts.pop = 380; ts.happy = 66; ts.fort = 0;
      Object.assign(ts.b, { castle: 1, farm: 0, lumber: 1, mine: 0, houses: 1, market: 0, barracks: 1, blacksmith: 0, academy: 0, temple: 0 });
      ts.gar = { infantry: 25, archers: 10, cavalry: 0, knights: 0, siege: 0 };
      // make the first neighbours beatable
      for (const n of WT[playerCap].nb) {
        const g = s.terr[n].gar;
        if (s.terr[n].owner === -1) { g.infantry = Math.min(g.infantry, rng.int(14, 24)); g.archers = Math.min(g.archers, rng.int(4, 9)); g.cavalry = 0; s.terr[n].fort = 0; }
      }
      s.armies.push(this.makeArmy(s, 0, playerCap, { infantry: 50, archers: 20, cavalry: 0, knights: 0, siege: 0 }));
      if (DIFFICULTY[diff].playerBonus > 1) { pk.res.gold += 250; pk.res.food += 100; }
    }
    // exploration: 2 steps around the capital
    for (const [tid, h] of hopsFromPlayer.entries()) if (h <= 2) s.explored[tid] = true;

    s.log.push({ d: 0, i: '👑', t: `${pk.ruler.title} ${pk.ruler.name} founds the ${pk.name}.`, k: 'good' });
    for (const m of MISSIONS) s.missions[m.id] = 0; // 0 active, 1 complete, 2 claimed
    return s;
  },

  makeArmy(s, kid, tid, units, general = null) {
    const k = s.kingdoms[kid];
    const no = k.armyNo++;
    const suffix = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
    return {
      id: s.nextId++, owner: kid, name: `${no}${suffix(no)} Army`, units: { ...units }, loc: tid,
      path: [], move: null, general, morale: 1, lastBattle: -99, mission: null,
    };
  },

  hops(from, filter) {
    const WT = this.world.territories;
    const d = new Array(WT.length).fill(99);
    d[from] = 0;
    const q = [from];
    for (let h = 0; h < q.length; h++) {
      const t = q[h];
      for (const a of WT[t].adj) {
        if (d[a.t] <= d[t] + 1) continue;
        if (filter && !filter(a.t)) continue;
        d[a.t] = d[t] + 1; q.push(a.t);
      }
    }
    return d;
  },

  ownedBy(kid, s = this.state) {
    const out = [];
    for (let i = 0; i < s.terr.length; i++) if (s.terr[i].owner === kid) out.push(i);
    return out;
  },

  /* ---------------- derived caches ---------------- */
  rebuildCache() {
    const s = this.state, c = this.cache;
    c.kTerr = s.kingdoms.map(() => []);
    s.terr.forEach((t, i) => { if (t.owner >= 0) c.kTerr[t.owner].push(i); });
    c.capDist = s.kingdoms.map((k) => {
      if (!k.alive) return null;
      // hops through own territory (sea counts double)
      const own = (tid) => s.terr[tid].owner === k.id;
      return this.hops(k.capital, own);
    });
    c.dirty = false;
    Diplomacy.computeBorders();
    Bus.emit('ownership');
  },

  /* ---------------- queries ---------------- */
  k(id) { return this.state.kingdoms[id]; },
  player() { return this.state.kingdoms[0]; },
  t(tid) { return this.state.terr[tid]; },
  wt(tid) { return this.world.territories[tid]; },
  ownerName(owner) { return owner < 0 ? 'Independent' : this.state.kingdoms[owner].short; },
  ownerColor(owner) { return owner < 0 ? NEUTRAL_COLOR : this.state.kingdoms[owner].color; },
  isAdjacent(a, b) { return this.world.territories[a].adj.some((x) => x.t === b); },
  territoriesOf(kid) { if (this.cache.dirty) this.rebuildCache(); return this.cache.kTerr[kid] || []; },
  hasTech(kid, id) { return !!this.state.kingdoms[kid].techs[id]; },
  maxBuildingLevel(tid) {
    const ts = this.state.terr[tid];
    return TIERS[ts.tier].maxLvl;
  },
  bestBuilding(kid, id) {
    if (id === 'blacksmith' && this.cache.smith[kid] !== undefined && !this.cache.dirty) return this.cache.smith[kid];
    let best = 0;
    for (const tid of this.territoriesOf(kid)) best = Math.max(best, this.state.terr[tid].b[id]);
    return best;
  },
  canAfford(kid, cost) {
    const r = this.state.kingdoms[kid].res;
    for (const k in cost) if ((r[k] || 0) < cost[k] - 1e-9) return false;
    return true;
  },
  pay(kid, cost) {
    const r = this.state.kingdoms[kid].res;
    for (const k in cost) r[k] = (r[k] || 0) - cost[k];
    if (kid === 0) Bus.emit('resources');
  },
  gain(kid, cost, f = 1) {
    const r = this.state.kingdoms[kid].res;
    for (const k in cost) r[k] = (r[k] || 0) + cost[k] * f;
    if (kid === 0) Bus.emit('resources');
  },
  missing(kid, cost) {
    const r = this.state.kingdoms[kid].res;
    const out = [];
    for (const k in cost) if ((r[k] || 0) < cost[k]) out.push(`${fmt(cost[k] - (r[k] || 0))} ${RES_NAME[k].toLowerCase()}`);
    return out.length ? 'Not enough resources: need ' + out.join(', ') + ' more.' : '';
  },
  buildCostMult(kid) { return this.hasTech(kid, 'architecture') ? 0.8 : 1; },

  isHostile(kid, owner) {
    if (owner === kid) return false;
    if (owner < 0) return true;
    return Diplomacy.atWar(kid, owner);
  },
  isFriendly(kid, owner) { return owner === kid || (owner >= 0 && Diplomacy.allied(kid, owner)); },

  /* ---------------- events / log ---------------- */
  log(text, icon = '📜', kind = 'info', tid = -1) {
    const s = this.state;
    s.log.push({ d: Math.floor(s.day), i: icon, t: text, k: kind, tid });
    if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
    Bus.emit('log');
  },
  notify(title, text, opts = {}) { Bus.emit('notify', { title, text, ...opts }); },

  explore(tids, fx = false) {
    const s = this.state;
    const newly = [];
    for (const t of tids) if (t >= 0 && !s.explored[t]) { s.explored[t] = true; newly.push(t); }
    if (newly.length) Bus.emit('explored', { tids: newly, fx });
    return newly.length;
  },
  exploreAround(tid, fx = false) {
    const WT = this.world.territories;
    return this.explore([tid, ...WT[tid].adj.map((a) => a.t)], fx);
  },
  exploredCount() { return this.state.explored.reduce((a, b) => a + (b ? 1 : 0), 0); },

  rulerXp(kid, xp) {
    const r = this.state.kingdoms[kid].ruler;
    r.xp += xp;
    while (r.xp >= rulerXpFor(r.level)) {
      r.xp -= rulerXpFor(r.level);
      r.level++;
      r.points++;
      if (kid === 0) {
        this.notify('Ruler level up!', `${r.title} ${r.name} reached level ${r.level}. Spend your skill point in the Kingdom screen.`, { icon: '👑', kind: 'good', sound: 'fanfare' });
        this.log(`${r.title} ${r.name} grows wiser (level ${r.level}).`, '👑', 'good');
      } else {
        // AI spends points right away
        const k = this.state.kingdoms[kid];
        const pref = k.p.aggression > 0.6 ? ['mil', 'lead', 'eco', 'dip'] : ['eco', 'dip', 'lead', 'mil'];
        for (const st of pref) if (r[st] < 10) { r[st]++; r.points--; break; }
      }
    }
  },

  /* ---------------- ownership changes ---------------- */
  setOwner(tid, kid, byKid = kid) {
    const s = this.state;
    const ts = s.terr[tid];
    const old = ts.owner;
    if (old === kid) return;
    const wasCapital = old >= 0 && s.kingdoms[old].capital === tid;
    ts.owner = kid;
    ts.since = s.day;
    ts.proj = null;
    // cancel training (half refund to the old owner)
    if (old >= 0 && ts.queue.length) {
      for (const q of ts.queue) this.gain(old, costScale(UNITS[q.u].cost, (q.n - q.done) * 0.5), 1);
    }
    ts.queue = [];
    ts.gar = emptyUnits();
    if (kid >= 0) {
      ts.pop = Math.max(40, ts.pop * 0.8);
      ts.happy = Math.min(ts.happy, 35);
      ts.unrest = old < 0 ? 22 : 38;
      if (ts.tax === 2) ts.tax = 1;
    }
    if (wasCapital) {
      // the castle becomes a fortress for the new owner
      ts.fort = Math.min(6, ts.fort + Math.ceil(ts.b.castle / 2));
      ts.b.castle = 0;
      if (ts.tier >= 4) ts.tier = 3;
    }
    this.cache.dirty = true;
    if (old >= 0) {
      const ok = s.kingdoms[old];
      const rest = this.ownedBy(old);
      if (!rest.length) {
        ok.alive = false;
        for (const a of s.armies) if (a.owner === old) a.dead = true;
        s.armies = s.armies.filter((a) => !a.dead);
        if (byKid >= 0) s.kingdoms[byKid].kingdomsDestroyed++;
        for (const k of s.kingdoms) if (k.id !== old) {
          const r = Diplomacy.rel(k.id, old);
          if (r) { r.st = 'peace'; r.trade = false; }
        }
        this.log(`The ${ok.name} has fallen!`, '💀', old === 0 ? 'bad' : 'war');
        Bus.emit('kingdomFallen', old);
      } else if (wasCapital) {
        // move the capital to the most populous remaining territory
        let best = rest[0];
        for (const r of rest) if (s.terr[r].pop > s.terr[best].pop) best = r;
        ok.capital = best;
        s.terr[best].b.castle = Math.max(1, s.terr[best].b.castle);
        if (byKid >= 0) s.kingdoms[byKid].capitalsTaken++;
        this.log(`${ok.short} moves its capital to ${this.wt(best).name}.`, '🏰', old === 0 ? 'bad' : 'info', best);
      }
    }
    if (kid === 0) this.exploreAround(tid, true);
    Bus.emit('ownerChanged', { tid, old, kid });
  },

  /* ---------------- power & ranking ---------------- */
  powerScore(kid) {
    const c = this.cache;
    const k = this.state.kingdoms[kid];
    if (!k.alive) return 0;
    return Math.round(this.territoriesOf(kid).length * 60 + (c.pop[kid] || 0) * 0.05 + (c.power[kid] || 0) * 0.35 + Object.keys(k.techs).length * 30);
  },
  ranking() {
    return this.state.kingdoms.filter((k) => k.alive).map((k) => ({ id: k.id, score: this.powerScore(k.id) })).sort((a, b) => b.score - a.score);
  },

  /* ---------------- simulation ---------------- */
  step(dt) {
    if (this.cache.dirty) this.rebuildCache();
    Economy.tick(dt);
    Kingdom.tickProjects(dt);
    Tech.tick(dt);
    Army.tick(dt);
    Diplomacy.tick(dt);
    AI.tick(dt);
    Missions.tick(dt);
    this.state.day += dt;
  },
  update(realDt) {
    const s = this.state;
    if (!s || s.over || !s.speed) return;
    this.acc += Math.min(realDt, 0.25) * s.speed;
    let n = 0;
    while (this.acc >= this.STEP && n < 12) { this.step(this.STEP); this.acc -= this.STEP; n++; }
    if (n >= 12) this.acc = 0;
  },
};
