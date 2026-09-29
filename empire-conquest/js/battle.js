/* =====================================================================
   EMPIRE CONQUEST — battles
   Round-based resolution (max 8 rounds). Damage depends on unit counts,
   unit types (counters), attack/defense, upgrades, terrain, walls,
   siege engines, generals and the ruler. Randomness is only ±10% per
   round, so good preparation decides battles, not luck.
   ===================================================================== */
'use strict';

const Battle = {
  ROUNDS: 8,

  atkBonus(kid) {
    if (kid < 0) return 0;
    const k = Game.state.kingdoms[kid];
    let b = 0.03 * k.ruler.mil + 0.04 * Game.bestBuilding(kid, 'blacksmith');
    if (k.techs.weapons) b += 0.15;
    return b;
  },
  defBonus(kid) {
    if (kid < 0) return 0;
    const k = Game.state.kingdoms[kid];
    let b = 0.02 * k.ruler.lead + 0.04 * Game.bestBuilding(kid, 'blacksmith');
    if (k.techs.armor) b += 0.15;
    return b;
  },

  /* modifiers for one side */
  mods(kid, general) {
    const k = kid >= 0 ? Game.state.kingdoms[kid] : null;
    const m = {
      atk: 1 + this.atkBonus(kid), def: 1 + this.defBonus(kid), hp: k && k.techs.armor ? 1.1 : 1,
      cav: k && k.techs.cavalry ? 1.25 : 1, siege: k && k.techs.siege ? 1.5 : 1, rout: 0.3, kid,
    };
    if (general) {
      const lvl = (general.level || 1) - 1;
      m.atk += lvl * 0.02; m.def += lvl * 0.02;
      switch (general.trait) {
        case 'tactician': m.atk += 0.12; break;
        case 'ironwall': m.def += 0.15; break;
        case 'horselord': m.cav *= 1.25; break;
        case 'siegebreaker': m.siege *= 1.6; break;
        case 'inspiring': m.atk += 0.05; m.rout -= 0.12; break;
      }
    }
    return m;
  },

  total(units) { let n = 0; for (const u of UNIT_ORDER) n += units[u] || 0; return n; },
  strength(units, kid = -1) {
    let p = 0;
    for (const u of UNIT_ORDER) p += (units[u] || 0) * unitPower(u);
    return p * (1 + this.atkBonus(kid) * 0.5 + this.defBonus(kid) * 0.5);
  },

  /* defenders of a territory: garrison + armies of the owner and its allies standing there */
  defenders(tid) {
    const s = Game.state, ts = s.terr[tid];
    const owner = ts.owner;
    const units = { ...ts.gar };
    const sources = [{ kind: 'gar', tid, units: { ...ts.gar } }];
    let general = null;
    for (const a of s.armies) {
      if (a.loc !== tid || a.move) continue;
      if (!(a.owner === owner || (owner >= 0 && Diplomacy.allied(a.owner, owner)))) continue;
      for (const u of UNIT_ORDER) units[u] += a.units[u];
      sources.push({ kind: 'army', id: a.id, units: { ...a.units } });
      if (a.general && (!general || (a.general.level || 1) > (general.level || 1))) general = a.general;
    }
    return { owner, units, sources, general };
  },

  context(tid, amphibious) {
    const s = Game.state, ts = s.terr[tid];
    const wt = Game.world.territories[tid];
    const isCap = ts.owner >= 0 && s.kingdoms[ts.owner].capital === tid;
    return { terrain: wt.terrain, fort: ts.fort + (isCap ? ts.b.castle * 0.5 : 0), amphibious: !!amphibious };
  },

  /* pure simulation — no game state is changed */
  simulate(attUnits, am, defUnits, dm, ctx, rand = Math.random) {
    const A = {}, D = {};
    for (const u of UNIT_ORDER) { A[u] = attUnits[u] || 0; D[u] = defUnits[u] || 0; }
    const T = TERRAIN[ctx.terrain];
    const pw = (X) => { let p = 0; for (const u of UNIT_ORDER) p += X[u] * unitPower(u); return p; };
    const a0 = pw(A), d0 = pw(D);
    let fort = ctx.fort;
    const rounds = [[this.total(A), this.total(D)]];
    let result = null;
    if (a0 <= 0) return { win: false, rounds, A, D, reason: 'no attackers' };
    if (d0 <= 0) return { win: true, rounds, A, D, reason: 'undefended' };

    const hit = (S, sm, O, om, role, r, fortBonus) => {
      const kills = {};
      for (const v of UNIT_ORDER) kills[v] = 0;
      let wsum = 0;
      const w = {};
      for (const v of UNIT_ORDER) {
        let wt = O[v] * UNITS[v].weight;
        if (v === 'archers' && r <= 2) wt *= 0.6;
        w[v] = wt; wsum += wt;
      }
      if (wsum <= 0) return kills;
      for (const u of UNIT_ORDER) {
        const n = S[u];
        if (n <= 0) continue;
        const U = UNITS[u];
        let atk = n * U.atk * sm.atk;
        if (u === 'cavalry' || u === 'knights') {
          atk *= u === 'cavalry' ? sm.cav : 1 + (sm.cav - 1) * 0.5;
          atk *= 1 + T.cav * (u === 'knights' ? 0.5 : 1);
          if (u === 'cavalry' && r === 1 && role === 'att') atk *= 1.4; // the charge
        }
        if (u === 'archers') {
          if (r === 1) atk *= 1.6; // opening volley
          if (role === 'def') atk *= 1 + T.arch;
        }
        if (role === 'def') atk *= 1 + fortBonus * 0.3; // shooting from the walls
        if (role === 'att' && ctx.amphibious && r <= 3) atk *= 0.75;
        atk *= 0.9 + rand() * 0.2;
        for (const v of UNIT_ORDER) {
          if (!w[v]) continue;
          const dmg = atk * (w[v] / wsum) * (U.vs[v] || 1) * 0.11;
          let def = UNITS[v].def * om.def;
          let eff = dmg * 30 / (30 + def);
          if (role === 'att') eff /= 1 + T.defense + fortBonus;
          kills[v] += eff / (UNITS[v].hp / 10 * om.hp);
        }
      }
      return kills;
    };

    for (let r = 1; r <= this.ROUNDS; r++) {
      // siege engines batter the walls before the fighting
      if (A.siege > 0 && fort > 0) fort = Math.max(0, fort - A.siege * 0.045 * am.siege);
      const fortBonus = fort * 0.18;
      const kD = hit(A, am, D, dm, 'att', r, fortBonus);
      const kA = hit(D, dm, A, am, 'def', r, fortBonus);
      for (const u of UNIT_ORDER) { D[u] = Math.max(0, D[u] - kD[u]); A[u] = Math.max(0, A[u] - kA[u]); }
      rounds.push([this.total(A), this.total(D)]);
      const ar = pw(A) / a0, dr = pw(D) / d0;
      const dRout = Math.max(0.05, dm.rout - 0.1); // defenders fight for their homes
      if (dr <= dRout || this.total(D) < 0.5) { result = true; break; }
      if (ar <= am.rout || this.total(A) < 0.5) { result = false; break; }
    }
    if (result === null) result = false; // attacker could not break through and withdraws
    return { win: result, rounds, A, D, fortLeft: fort };
  },

  /* prediction for the UI and the AI (runs several simulations) */
  predict(kid, units, general, tid, amphibious = false, runs = 16) {
    const def = this.defenders(tid);
    const am = this.mods(kid, general), dm = this.mods(def.owner, def.general);
    const ctx = this.context(tid, amphibious);
    let wins = 0, aLoss = 0, dLoss = 0;
    const a0 = this.total(units), d0 = this.total(def.units);
    for (let i = 0; i < runs; i++) {
      const r = this.simulate(units, am, def.units, dm, ctx);
      if (r.win) wins++;
      aLoss += a0 - this.total(r.A);
      dLoss += d0 - this.total(r.D);
    }
    return {
      chance: wins / runs, attLoss: Math.round(aLoss / runs), defLoss: Math.round(dLoss / runs),
      attTotal: a0, defTotal: d0, attStr: this.strength(units, kid), defStr: this.strength(def.units, def.owner),
      fort: ctx.fort, terrain: ctx.terrain, defUnits: def.units,
    };
  },

  /* a real battle: army attacks territory tid (called by Army on arrival) */
  fight(army, tid, amphibious) {
    const s = Game.state;
    const ts = s.terr[tid];
    const def = this.defenders(tid);
    const attKid = army.owner, defKid = def.owner;
    const am = this.mods(attKid, army.general), dm = this.mods(defKid, def.general);
    const ctx = this.context(tid, amphibious);
    const attStart = { ...army.units }, defStart = { ...def.units };
    const r = this.simulate(army.units, am, def.units, dm, ctx);
    // losses → round to whole soldiers
    const attAfter = {}, defAfter = {};
    for (const u of UNIT_ORDER) { attAfter[u] = Math.round(r.A[u]); defAfter[u] = Math.round(r.D[u]); }
    army.units = attAfter;
    const attLoss = this.total(attStart) - this.total(attAfter);
    const defLoss = this.total(defStart) - this.total(defAfter);
    // defenders: survivors keep fighting only if they won
    for (const src of def.sources) {
      const left = {};
      for (const u of UNIT_ORDER) left[u] = def.units[u] > 0 ? Math.round((src.units[u] || 0) * (r.D[u] / def.units[u])) : 0;
      if (src.kind === 'gar') ts.gar = r.win ? emptyUnits() : left;
      else {
        const a = s.armies.find((x) => x.id === src.id);
        if (!a) continue;
        a.units = left;
        if (r.win) Army.retreat(a, tid);
      }
    }
    // generals learn
    if (army.general) this.generalXp(army.general, r.win ? 30 : 12);
    if (def.general) this.generalXp(def.general, r.win ? 12 : 30);
    army.lastBattle = s.day;
    army.morale = r.win ? Math.min(1, army.morale + 0.1) : Math.max(0.4, army.morale - 0.2);

    const ak = s.kingdoms[attKid], dk = defKid >= 0 ? s.kingdoms[defKid] : null;
    if (r.win) { ak.battlesWon++; if (dk) dk.battlesLost++; } else { ak.battlesLost++; if (dk) dk.battlesWon++; }
    if (attKid === 0 || defKid === 0) Game.rulerXp(0, (attKid === 0) === r.win ? 15 : 4);
    else if (r.win) Game.rulerXp(attKid, 10);

    const report = {
      id: s.nextId++, day: Math.floor(s.day), tid, att: attKid, def: defKid, army: army.name,
      attStart, defStart, attEnd: attAfter, defEnd: r.win ? emptyUnits() : defAfter,
      attLoss, defLoss, win: r.win, rounds: r.rounds.map((x) => [Math.round(x[0]), Math.round(x[1])]),
      terrain: ctx.terrain, fort: Math.round(ctx.fort * 10) / 10, amphibious: !!amphibious,
      general: army.general ? army.general.name : null,
    };
    if (attKid === 0 || defKid === 0) {
      s.battles.unshift(report);
      if (s.battles.length > 30) s.battles.length = 30;
    }
    Bus.emit('battle', report);
    return report;
  },

  generalXp(g, xp) {
    g.xp = (g.xp || 0) + xp;
    const need = 60 * (g.level || 1);
    if (g.xp >= need && (g.level || 1) < 10) { g.xp -= need; g.level = (g.level || 1) + 1; }
  },
};
