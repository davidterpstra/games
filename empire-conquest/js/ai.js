/* =====================================================================
   EMPIRE CONQUEST — AI kingdoms
   Every AI kingdom plays by the same rules as the player: it builds,
   researches, trains soldiers, forms armies, attacks weak neighbours,
   defends threatened lands and makes war, peace, trade and alliances.
   Each kingdom thinks every few days (staggered, so the cost is tiny).
   ===================================================================== */
'use strict';

const AI = {
  tick(dt) {
    const s = Game.state;
    for (const k of s.kingdoms) {
      if (k.isPlayer || !k.alive) continue;
      k.ai.timer -= dt;
      if (k.ai.timer <= 0) {
        k.ai.timer = 2.5 + Math.random() * 1.5;
        try { this.think(k); } catch (e) { console.error('AI error', k.short, e); }
      }
      k.ai.dipTimer -= dt;
      if (k.ai.dipTimer <= 0) {
        k.ai.dipTimer = 6 + Math.random() * 5;
        try { this.diplomacy(k); } catch (e) { console.error('AI diplomacy error', k.short, e); }
      }
    }
  },

  think(k) {
    this.taxes(k);
    this.economy(k);
    this.research(k);
    this.recruit(k);
    this.armies(k);
  },

  atWar(k) { return Diplomacy.warsOf(k.id).length > 0; },

  /* territories that touch hostile or foreign land */
  isBorder(kid, tid) {
    return Game.wt(tid).adj.some((a) => {
      const o = Game.t(a.t).owner;
      return o !== kid && !(o >= 0 && Diplomacy.allied(kid, o));
    });
  },
  threat(kid, tid) {
    // strongest enemy force standing next to this territory
    let th = 0;
    for (const a of Game.wt(tid).adj) {
      const o = Game.t(a.t).owner;
      if (o >= 0 && Diplomacy.atWar(kid, o)) {
        th = Math.max(th, Battle.strength(Game.t(a.t).gar, o) * 0.3);
        for (const ar of Game.state.armies) if (ar.owner === o && (ar.loc === a.t || (ar.move && ar.move.to === tid))) th += Battle.strength(ar.units, o);
      }
    }
    return th;
  },

  taxes(k) {
    const rates = Game.cache.rates[k.id];
    for (const tid of Game.territoriesOf(k.id)) {
      const ts = Game.t(tid);
      if (ts.happy < 38 || ts.unrest > 15) ts.tax = 0;
      else if (ts.happy > 68 && rates && rates.gold < 6) ts.tax = 2;
      else ts.tax = 1;
    }
  },

  economy(k) {
    const kid = k.id, s = Game.state;
    const rates = Game.cache.rates[kid];
    if (!rates) return;
    const war = this.atWar(k);
    const reserve = (war ? 140 : 70) + Math.max(0, rates.gold) * 4;
    const maxStart = 2 + Math.floor(Game.territoriesOf(kid).length / 6);
    const terr = Game.territoriesOf(kid);
    let started = 0;
    const cands = [];
    for (const tid of terr) {
      const ts = s.terr[tid];
      if (ts.proj) continue;
      const T = TERRAIN[Game.wt(tid).terrain];
      const isCap = k.capital === tid;
      const add = (kind, id, score) => cands.push({ tid, kind, id, score: score * (0.85 + Math.random() * 0.3) });
      const cap = Economy.popCap(tid);
      add('tier', null, 70);
      if (isCap) { add('build', 'castle', 38); add('build', 'academy', 22 + s.day * 0.02); add('build', 'blacksmith', s.day > 50 ? 26 : 5); }
      add('build', 'farm', (rates.food < 3 ? 60 : rates.food < 8 ? 25 : 6) * T.farm);
      add('build', 'houses', ts.pop > cap * 0.8 ? 38 : 8);
      add('build', 'lumber', (k.res.wood < 200 || rates.wood < 4 ? 32 : 6) * T.lumber);
      add('build', 'mine', (rates.iron < 4 ? 30 : 10) * T.mine);
      add('build', 'market', rates.gold < 10 ? 34 : 20);
      add('build', 'barracks', isCap ? 30 : (ts.tier >= 1 && this.isBorder(kid, tid) ? 16 : 3));
      add('build', 'temple', ts.happy < 45 ? 40 : 4);
      add('develop', null, 14 + (k.res.gold > 800 ? 15 : 0));
      if (this.isBorder(kid, tid)) add('fortify', null, (war ? 30 : 8) * (1.2 - k.p.aggression * 0.5) * (isCap ? 1.6 : 1));
    }
    cands.sort((a, b) => b.score - a.score);
    for (const c of cands) {
      if (started >= maxStart) break;
      const ts = s.terr[c.tid];
      if (ts.proj) continue;
      let info;
      if (c.kind === 'tier') info = Kingdom.tierInfo(kid, c.tid);
      else if (c.kind === 'build') info = Kingdom.buildInfo(kid, c.tid, c.id);
      else if (c.kind === 'develop') info = Kingdom.developInfo(kid, c.tid);
      else info = Kingdom.fortifyInfo(kid, c.tid);
      if (!info.ok) continue;
      if ((k.res.gold - (info.cost.gold || 0)) < reserve) continue;
      if (c.kind === 'tier') Kingdom.upgradeTier(kid, c.tid);
      else if (c.kind === 'build') Kingdom.build(kid, c.tid, c.id);
      else if (c.kind === 'develop') Kingdom.develop(kid, c.tid);
      else Kingdom.fortify(kid, c.tid);
      started++;
    }
  },

  research(k) {
    if (k.research) return;
    const order = k.p.aggression > 0.6
      ? ['weapons', 'farming', 'armor', 'cities', 'mining', 'cavalry', 'roads', 'siege', 'trade', 'administration', 'taxation', 'architecture']
      : ['farming', 'cities', 'weapons', 'mining', 'roads', 'armor', 'trade', 'administration', 'cavalry', 'taxation', 'siege', 'architecture'];
    for (const id of order) {
      const inf = Tech.info(k.id, id);
      if (inf.st !== 'available') continue;
      if (inf.ok && k.res.gold - (inf.cost.gold || 0) > 100) Tech.start(k.id, id);
      return;
    }
  },

  desiredSoldiers(k) {
    const s = Game.state;
    const n = Game.territoriesOf(k.id).length;
    const income = Math.max(0, (Game.cache.rates[k.id] || { gold: 0 }).gold);
    const want = (60 + n * 30 + s.day * 0.3) * (0.7 + k.p.aggression * 0.6) * DIFFICULTY[s.difficulty].aiAggro + (this.atWar(k) ? 150 : 0) + income * 5;
    return Math.min(want, (Game.cache.pop[k.id] || 0) * 0.15 + 120);
  },

  recruit(k) {
    const kid = k.id, s = Game.state;
    const rates = Game.cache.rates[kid];
    if (!rates || rates.gold < -1 || k.starving) return;
    const have = Game.cache.soldiers[kid] || 0;
    const want = this.desiredSoldiers(k);
    if (have >= want) return;
    let budget = k.res.gold * (this.atWar(k) || k.res.gold > 2000 ? 0.7 : 0.45);
    const places = Game.territoriesOf(kid).filter((t) => s.terr[t].b.barracks > 0 && s.terr[t].queue.length < 2)
      .sort((a, b) => (b === k.capital) - (a === k.capital) || s.terr[b].b.barracks - s.terr[a].b.barracks);
    if (!places.length) places.push(k.capital);
    const mix = { infantry: 0.4, archers: 0.26, cavalry: 0.16, knights: 0.1, siege: this.atWar(k) ? 0.12 : 0.04 };
    let orders = 0;
    for (const tid of places) {
      if (orders >= 3 || budget < 40) break;
      const opts = UNIT_ORDER.filter((u) => Army.unitReq(kid, tid, u).ok);
      if (!opts.length) continue;
      let r = Math.random() * opts.reduce((a, u) => a + mix[u], 0);
      let u = opts[0];
      for (const o of opts) { r -= mix[o]; if (r <= 0) { u = o; break; } }
      const n = Math.min(Army.maxTrain(kid, tid, u), Math.floor(budget / UNITS[u].cost.gold), Math.ceil((want - have) * 0.6), 40 + Math.floor(s.day * 0.15) + Math.floor(budget / 60));
      if (n < 5) continue;
      const res = Army.train(kid, tid, u, n);
      if (res.ok) { budget -= n * UNITS[u].cost.gold; orders++; }
    }
  },

  minGarrison(k, tid) {
    const s = Game.state;
    const border = this.isBorder(k.id, tid);
    let m = border ? 22 + s.day * 0.04 : 8;
    if (tid === k.capital) m += 25;
    if (border && Game.wt(tid).adj.some((a) => { const o = s.terr[a.t].owner; return o >= 0 && Diplomacy.atWar(k.id, o); })) m *= 1.6;
    return Math.round(m);
  },

  takeExcess(k, tid, frac = 1) {
    const ts = Game.t(tid);
    const keep = this.minGarrison(k, tid);
    const total = Battle.total(ts.gar);
    const extra = Math.max(0, total - keep) * frac;
    if (extra < 1) return null;
    const f = extra / total;
    const out = {};
    for (const u of UNIT_ORDER) out[u] = Math.floor(ts.gar[u] * f);
    return Battle.total(out) >= 1 ? out : null;
  },

  armies(k) {
    const kid = k.id, s = Game.state;
    let mine = Army.of(kid);
    // raise a new field army from a big garrison
    if (mine.length < Army.maxArmies(kid)) {
      let best = -1, bestN = 0;
      for (const tid of Game.territoriesOf(kid)) {
        const ex = this.takeExcess(k, tid);
        const n = ex ? Battle.total(ex) : 0;
        if (n > bestN) { bestN = n; best = tid; }
      }
      if (best >= 0 && bestN >= 40) {
        const r = Army.create(kid, best, this.takeExcess(k, best));
        if (r.ok && Math.random() < 0.5 && k.res.gold > Army.generalCost(kid) + 150) Army.hireGeneral(kid, r.army.id);
      }
      mine = Army.of(kid);
    }

    // threatened territories
    const threats = [];
    for (const tid of Game.territoriesOf(kid)) {
      const th = this.threat(kid, tid);
      if (th > 0) {
        const def = Battle.strength(Battle.defenders(tid).units, kid);
        if (th > def * 0.8) threats.push({ tid, need: th - def, cap: tid === k.capital });
      }
    }
    threats.sort((a, b) => (b.cap - a.cap) || b.need - a.need);

    for (const a of mine) {
      if (a.move || a.dead) continue;
      const here = Game.t(a.loc);
      if (here.owner === kid) {
        // leave troops behind in freshly conquered or thin territories
        const g = Battle.total(here.gar), need = this.minGarrison(k, a.loc) * 0.7;
        if (g < need && Battle.total(a.units) > 40) {
          const f = Math.min(0.3, (need - g) / Battle.total(a.units));
          const st = {};
          for (const u of UNIT_ORDER) st[u] = Math.floor(a.units[u] * f);
          if (Battle.total(st) >= 1) Army.station(kid, a.id, st);
        } else {
          const ex = this.takeExcess(k, a.loc, 0.8);
          if (ex) Army.reinforce(kid, a.id, ex);
        }
      }
      if (a.dead || Battle.total(a.units) < 1) continue;
      if (a.path.length) continue;

      // 1. defend
      const myStr = Battle.strength(a.units, kid);
      let done = false;
      for (const th of threats) {
        if (th.handled) continue;
        const r = Army.findPath(kid, a.loc, th.tid, Army.speed(a));
        if (r.error || r.days > 14) continue;
        if (a.loc === th.tid) { th.handled = true; done = true; break; }
        Army.order(kid, a.id, th.tid);
        th.handled = myStr > th.need;
        done = true;
        break;
      }
      if (done) continue;

      // 2. attack the best reachable target (after resting from the last battle)
      if (Battle.total(a.units) < 30 || s.day - a.lastBattle < 6) continue;
      const target = this.pickTarget(k, a);
      if (target >= 0) { Army.order(kid, a.id, target); continue; }

      // 3. otherwise gather at a border territory near enemies
      if (!this.isBorder(kid, a.loc)) {
        let best = -1, bd = Infinity;
        for (const tid of Game.territoriesOf(kid)) {
          if (!this.isBorder(kid, tid)) continue;
          const d = dist(Game.wt(tid).cx, Game.wt(tid).cy, Game.wt(a.loc).cx, Game.wt(a.loc).cy);
          if (d < bd) { bd = d; best = tid; }
        }
        if (best >= 0) Army.order(kid, a.id, best);
      }
    }

    // merge small armies standing together
    mine = Army.of(kid);
    for (const a of mine) {
      if (a.move || a.dead) continue;
      const b = mine.find((x) => x !== a && !x.dead && !x.move && x.loc === a.loc && !x.path.length);
      if (b && Battle.total(b.units) < 60) { Army.merge(kid, a.id, b.id); b.dead = true; }
    }
  },

  pickTarget(k, a) {
    const kid = k.id, s = Game.state;
    const cands = new Set();
    for (const tid of Game.territoriesOf(kid)) {
      for (const adj of Game.wt(tid).adj) {
        const o = s.terr[adj.t].owner;
        if (Game.isHostile(kid, o)) cands.add(adj.t);
      }
    }
    // armies standing in allied land may also attack from there
    for (const adj of Game.wt(a.loc).adj) if (Game.isHostile(kid, s.terr[adj.t].owner)) cands.add(adj.t);
    const mine = Game.territoriesOf(kid);
    const restless = mine.filter((t) => s.terr[t].unrest > 15).length;
    // consolidate before expanding further when many lands are still restless
    const minChance = restless > Math.max(2, mine.length * 0.3) ? 0.9 : 0.72 - k.p.aggression * 0.15;
    let best = -1, bestScore = 0;
    const spd = Army.speed(a);
    for (const t of cands) {
      // don't pile several armies onto one target
      if (s.armies.some((x) => x !== a && x.owner === kid && x.target === t && (x.move || x.path.length))) continue;
      const r = Army.findPath(kid, a.loc, t, spd);
      if (r.error || r.days > 22) continue;
      const pred = Battle.predict(kid, a.units, a.general, t, r.sea, 6);
      if (pred.chance < minChance) continue;
      const ts = s.terr[t];
      const o = ts.owner;
      let value = 12 + ts.pop / 40 + ts.tier * 12;
      if (o >= 0 && s.kingdoms[o].capital === t) value += 35;
      if (o < 0) value += 10 * k.p.expansion;
      if (o === 0) value *= DIFFICULTY[s.difficulty].aiAggro;
      const score = value * pred.chance / (1 + r.days / 8) * (1 - pred.attLoss / Math.max(1, pred.attTotal) * 0.8);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
  },

  diplomacy(k) {
    const s = Game.state, kid = k.id;
    const D = DIFFICULTY[s.difficulty];
    const myPow = Game.cache.power[kid] || 0;
    const wars = Diplomacy.warsOf(kid);
    for (const o of s.kingdoms) {
      if (o.id === kid || !o.alive) continue;
      const r = Diplomacy.rel(kid, o.id);
      const oPow = Game.cache.power[o.id] || 0;
      if (r.st === 'war') {
        const days = s.day - r.since;
        const ws = Diplomacy.warScore(kid, o.id);
        if (days > 40 && (ws < -12 || (days > 180 && ws < 15) || (Game.territoriesOf(kid).length <= 2))) {
          if (o.isPlayer) Diplomacy.offer('peace', kid);
          else if (Diplomacy.evaluate('peace', kid, o.id).accept) Diplomacy.makePeace(kid, o.id);
        }
        continue;
      }
      // declare war?
      const maxWars = k.p.aggression > 0.7 ? 2 : 1;
      if (r.truce <= 0 && r.st !== 'alliance' && wars.length < maxWars && Diplomacy.borders(kid, o.id)) {
        const graceOk = !o.isPlayer || s.day > D.grace;
        const hate = r.v < -5 + k.p.aggression * 30;
        const strong = myPow > oPow * (1.35 - k.p.aggression * 0.5);
        const noEasyLand = Game.territoriesOf(kid).every((t) => Game.wt(t).adj.every((a) => s.terr[a.t].owner !== -1)) ? 1.6 : 1;
        if (graceOk && hate && strong && Math.random() < 0.22 * k.p.aggression * D.aiAggro * noEasyLand) {
          Diplomacy.declareWar(kid, o.id);
          return;
        }
      }
      // trade
      if (!r.trade && r.st === 'peace' && r.v > 10) {
        if (o.isPlayer) { if (r.v > 25 && Math.random() < 0.25) Diplomacy.offer('trade', kid); }
        else if (Math.random() < 0.4 * k.p.diplomacy) Diplomacy.setTrade(kid, o.id, true);
      }
      // alliance
      if (r.st === 'peace' && r.v > 55 && Math.random() < 0.25 * k.p.diplomacy) {
        if (o.isPlayer) { if (r.v > 65) Diplomacy.offer('alliance', kid); }
        else {
          const common = s.kingdoms.some((c) => c.alive && Diplomacy.atWar(kid, c.id) && Diplomacy.atWar(o.id, c.id));
          if (common || r.v > 72) Diplomacy.formAlliance(kid, o.id);
        }
      }
    }
  },
};
