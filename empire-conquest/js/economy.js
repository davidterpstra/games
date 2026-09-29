/* =====================================================================
   EMPIRE CONQUEST — economy: production, upkeep, population, happiness
   ===================================================================== */
'use strict';

const Economy = {
  happyFactor(h) { return 0.6 + 0.5 * (h / 100); },

  rulerEco(k) { return 1 + 0.03 * k.ruler.eco; },

  distancePenalty(kid, tid) {
    const cd = Game.cache.capDist[kid];
    const hops = cd ? cd[tid] : 99;
    const k = Game.state.kingdoms[kid];
    let p = Math.min(0.35, Math.max(0, hops - 2) * 0.05);
    if (k.techs.roads) p *= 0.5;
    if (k.techs.administration) p *= 0.5;
    return p;
  },

  /* overall output multiplier of an owned territory */
  territoryMult(tid) {
    const s = Game.state, ts = s.terr[tid];
    const kid = ts.owner;
    let m = (1 + 0.05 * ts.dev) * this.happyFactor(ts.happy);
    if (kid >= 0) {
      const k = s.kingdoms[kid];
      m *= this.rulerEco(k) * (1 - this.distancePenalty(kid, tid));
      if (k.techs.administration) m *= 1.1;
      if (!k.isPlayer) m *= DIFFICULTY[s.difficulty].aiIncome;
      else m *= DIFFICULTY[s.difficulty].playerBonus;
    }
    return m;
  },

  /* per-day output of a territory (before kingdom upkeep) */
  yieldOf(tid, detail = false) {
    const s = Game.state, ts = s.terr[tid], wt = Game.world.territories[tid];
    const kid = ts.owner;
    const k = kid >= 0 ? s.kingdoms[kid] : null;
    const tech = (id) => !!(k && k.techs[id]);
    const T = TERRAIN[wt.terrain];
    const b = ts.b;
    const river = wt.river ? 1.2 : 1;
    const mult = this.territoryMult(tid);
    const pm = mult * TIERS[ts.tier].mult; // settlement size boosts production
    const food = (T.food + 6 * lvlCurve(b.farm) * T.farm * river) * (tech('farming') ? 1.3 : 1);
    const wood = T.wood + 4 * lvlCurve(b.lumber) * T.lumber;
    const iron = (T.iron + 3 * lvlCurve(b.mine) * T.mine) * (tech('mining') ? 1.3 : 1);
    const taxRate = TAX_LEVELS[ts.tax].gold * (tech('taxation') ? 1.25 : 1);
    const g = {
      land: T.gold + TIERS[ts.tier].gold,
      tax: ts.pop * 0.006 * taxRate,
      mine: 1.2 * lvlCurve(b.mine) * T.mine * (tech('mining') ? 1.3 : 1),
      market: 4 * lvlCurve(b.market) * T.market * (tech('trade') ? 1.3 : 1),
      castle: 3 * b.castle,
    };
    const gold = g.land + g.tax + g.mine + g.market + g.castle;
    const rp = ((k && k.capital === tid) ? 1 : 0) + b.castle + 2.5 * lvlCurve(b.academy);
    const out = {
      gold: gold * mult, food: food * pm, wood: wood * pm, iron: iron * pm,
      rp: rp * (0.7 + 0.3 * this.happyFactor(ts.happy)) * (k && !k.isPlayer ? DIFFICULTY[s.difficulty].aiIncome : 1),
    };
    if (detail) out.goldParts = Object.fromEntries(Object.entries(g).map(([a, v]) => [a, v * mult])), out.mult = mult;
    return out;
  },

  popCap(tid) {
    const s = Game.state, ts = s.terr[tid], wt = Game.world.territories[tid];
    const k = ts.owner >= 0 ? s.kingdoms[ts.owner] : null;
    let cap = TIERS[ts.tier].popCap * TERRAIN[wt.terrain].pop + 150 * lvlCurve(ts.b.houses) + ts.dev * 25;
    if (k && k.techs.cities) cap *= 1.25;
    return Math.round(cap);
  },

  /* storage limits: treasury, granaries, lumber yards and iron stores */
  caps(kid) {
    const s = Game.state, k = s.kingdoms[kid];
    let n = 0, market = 0, tier = 0, farm = 0, lumber = 0, mine = 0;
    for (const tid of Game.territoriesOf(kid)) {
      const b = s.terr[tid].b;
      n++; market += b.market; tier += s.terr[tid].tier; farm += b.farm; lumber += b.lumber; mine += b.mine;
    }
    const castle = s.terr[k.capital] ? s.terr[k.capital].b.castle : 0;
    return {
      gold: 2000 + 1500 * castle + 600 * market + 250 * tier,
      food: 1500 + 250 * n + 200 * farm + 400 * castle,
      wood: 1500 + 250 * n + 200 * lumber + 400 * castle,
      iron: 1000 + 150 * n + 200 * mine + 300 * castle,
      rp: Infinity,
    };
  },

  garrisonCount(ts) { let n = 0; for (const u of UNIT_ORDER) n += ts.gar[u]; return n; },

  /* happiness target with a breakdown for the UI */
  happyTarget(tid, withParts = false, capOpt) {
    const s = Game.state, ts = s.terr[tid];
    const kid = ts.owner;
    const parts = [];
    const add = (label, v) => { if (v) parts.push([label, v]); };
    add('Base', 55);
    if (kid >= 0) {
      const k = s.kingdoms[kid];
      if (k.capital === tid) add('Capital', 10);
      add('Temple', ts.b.temple * 7);
      add('Market', ts.b.market * 2);
      let tax = TAX_LEVELS[ts.tax].happy;
      if (ts.tax === 2 && k.techs.taxation) tax = -10;
      add('Taxes (' + TAX_LEVELS[ts.tax].name + ')', tax);
      add('Recently conquered', -Math.round(ts.unrest));
      if (k.starving) add('Starvation', -30);
      if (k.broke) add('Unpaid soldiers', -12);
      const wars = this._wars && !withParts ? this._wars[kid] : Diplomacy.warsOf(kid).length;
      add('War weariness', -Math.min(12, wars * 3));
      add('Garrison', Math.min(6, Math.floor(this.garrisonCount(ts) / 40)));
      if (ts.pop > (capOpt || this.popCap(tid)) * 1.01) add('Overcrowded', -10);
      add('Settlement size', -ts.tier * 2);
      if (k.techs.administration) add('Administration', 5);
      add('Ruler diplomacy', Math.round((k.ruler.dip - 3) * 1));
    }
    let v = 0;
    for (const p of parts) v += p[1];
    v = clamp(v, 0, 100);
    return withParts ? { v, parts } : v;
  },

  tradeIncome(kid) {
    const s = Game.state;
    let g = 0;
    const k = s.kingdoms[kid];
    for (const o of s.kingdoms) {
      if (o.id === kid || !o.alive) continue;
      if (!Diplomacy.trading(kid, o.id)) continue;
      g += (2 + 0.25 * Math.min(20, Game.territoriesOf(o.id).length)) * (k.techs.trade ? 1.5 : 1);
    }
    return g;
  },

  /* the main economic tick (dt in days) */
  tick(dt) {
    const s = Game.state, c = Game.cache;
    const nk = s.kingdoms.length;
    const inc = [], up = [], soldiers = new Array(nk).fill(0), power = new Array(nk).fill(0);
    const pop = new Array(nk).fill(0), popCap = new Array(nk).fill(0), happyW = new Array(nk).fill(0);
    for (let i = 0; i < nk; i++) { inc.push({ gold: 0, food: 0, wood: 0, iron: 0, rp: 0 }); up.push({ gold: 0, food: 0 }); }
    this._wars = s.kingdoms.map((k) => (k.alive ? Diplomacy.warsOf(k.id).length : 0));
    const smith = new Array(nk).fill(0);
    for (const ts of s.terr) if (ts.owner >= 0 && ts.b.blacksmith > smith[ts.owner]) smith[ts.owner] = ts.b.blacksmith;
    c.smith = smith;
    const addUnits = (kid, units) => {
      for (const u of UNIT_ORDER) {
        const n = units[u];
        if (!n) continue;
        soldiers[kid] += n;
        power[kid] += n * unitPower(u);
        up[kid].gold += n * UNITS[u].upkeep;
        up[kid].food += n * UNITS[u].food;
      }
    };
    for (const a of s.armies) addUnits(a.owner, a.units);

    for (let tid = 0; tid < s.terr.length; tid++) {
      const ts = s.terr[tid];
      const kid = ts.owner;
      const cap = this.popCap(tid);
      if (kid < 0) {
        // independent lands grow slowly and rebuild their militia
        if (ts.pop < cap) ts.pop += ts.pop * 0.004 * dt * (1 - ts.pop / cap);
        continue;
      }
      const k = s.kingdoms[kid];
      addUnits(kid, ts.gar);
      const y = this.yieldOf(tid);
      inc[kid].gold += y.gold; inc[kid].food += y.food; inc[kid].wood += y.wood; inc[kid].iron += y.iron; inc[kid].rp += y.rp;
      up[kid].food += ts.pop * 0.008;

      // population
      if (k.starving) ts.pop -= ts.pop * 0.006 * dt;
      else if (ts.pop > cap) ts.pop -= (ts.pop - cap) * 0.02 * dt;
      else {
        const g = ts.pop * 0.012 * clamp(ts.happy / 60, 0.2, 1.5) * (1 - ts.pop / cap) + 0.3;
        ts.pop = Math.min(cap, ts.pop + g * dt);
      }
      if (ts.happy < 20) ts.pop -= ts.pop * 0.002 * dt;
      ts.pop = Math.max(10, ts.pop);

      // happiness drifts toward its target
      const target = this.happyTarget(tid, false, cap);
      ts.happy += (target - ts.happy) * Math.min(1, 0.06 * dt);
      if (ts.unrest > 0) ts.unrest = Math.max(0, ts.unrest - (k.techs.administration ? 0.24 : 0.12) * dt);

      pop[kid] += ts.pop; popCap[kid] += cap; happyW[kid] += ts.happy * ts.pop;
    }

    for (let kid = 0; kid < nk; kid++) {
      const k = s.kingdoms[kid];
      if (!k.alive) continue;
      const trade = this.tradeIncome(kid);
      inc[kid].gold += trade;
      const r = k.res;
      const net = {
        gold: inc[kid].gold - up[kid].gold, food: inc[kid].food - up[kid].food,
        wood: inc[kid].wood, iron: inc[kid].iron, rp: inc[kid].rp,
      };
      const caps = this.caps(kid);
      c.caps[kid] = caps;
      for (const key of RES_KEYS) {
        const v = net[key] * dt;
        if (v < 0) r[key] += v;
        else if (r[key] < caps[key]) r[key] = Math.min(caps[key], r[key] + v);
      }
      if (r.food < 0) { r.food = 0; if (!k.starving) { k.starving = true; if (kid === 0) Game.notify('Famine!', 'Your granaries are empty. People are starving and leaving. Build farms or conquer fertile land.', { icon: '🌾', kind: 'bad', sound: 'alert' }); } }
      else if (r.food > 5) k.starving = false;
      if (r.gold < 0) {
        r.gold = 0;
        if (!k.broke) { k.broke = true; if (kid === 0) Game.notify('Treasury empty!', 'You cannot pay your soldiers. Morale drops and some troops desert.', { icon: '💰', kind: 'bad', sound: 'alert' }); }
      } else if (r.gold > 5) k.broke = false;
      if (k.broke && soldiers[kid] > 0) this.desert(kid, 0.004 * dt);
      c.rates[kid] = { ...net, income: inc[kid], upkeep: up[kid], trade };
      c.soldiers[kid] = soldiers[kid];
      c.power[kid] = Math.round(power[kid] * (1 + Battle.atkBonus(kid)));
      c.pop[kid] = pop[kid];
      c.popCap[kid] = popCap[kid];
      c.happy[kid] = pop[kid] > 0 ? happyW[kid] / pop[kid] : 0;
    }
  },

  /* unpaid troops slowly leave */
  desert(kid, frac) {
    const s = Game.state;
    const cut = (units) => { for (const u of UNIT_ORDER) if (units[u] > 0 && Math.random() < units[u] * frac) units[u] = Math.max(0, units[u] - 1); };
    for (const a of s.armies) if (a.owner === kid) cut(a.units);
    for (const tid of Game.territoriesOf(kid)) cut(s.terr[tid].gar);
  },
};
