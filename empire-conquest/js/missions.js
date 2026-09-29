/* =====================================================================
   EMPIRE CONQUEST — missions / objectives and victory
   ===================================================================== */
'use strict';

const Missions = {
  timer: 0,
  context() {
    const s = Game.state, k = Game.player();
    const ids = Game.territoriesOf(0);
    const territories = ids.map((id) => ({ id, ...s.terr[id] }));
    const rank = Game.ranking();
    return {
      k, territories,
      pop: Game.cache.pop[0] || territories.reduce((a, t) => a + t.pop, 0),
      explored: Game.exploredCount(),
      trades: s.kingdoms.filter((o) => o.id !== 0 && Diplomacy.trading(0, o.id)).length,
      alliances: Diplomacy.alliesOf(0).length,
      rank: rank.findIndex((r) => r.id === 0) + 1,
      victoryTarget: Math.ceil(s.terr.length * 0.6),
    };
  },
  progress(m, P = this.context()) {
    const [cur, target] = m.goal(P);
    return { cur: Math.min(cur, target), target, pct: clamp(cur / target, 0, 1) };
  },
  claimable() { return MISSIONS.filter((m) => Game.state.missions[m.id] === 1).length; },
  tick(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1;
    const s = Game.state;
    const P = this.context();
    let changed = false;
    for (const m of MISSIONS) {
      if (s.missions[m.id]) continue;
      const p = this.progress(m, P);
      if (p.pct >= 1) {
        s.missions[m.id] = 1;
        changed = true;
        Game.notify('Objective complete!', `${m.name}: ${m.desc} Claim your reward in Missions.`, { icon: m.icon, kind: 'good', sound: 'fanfare', mission: m.id });
        Game.log(`Objective complete: ${m.name}.`, m.icon, 'good');
      }
    }
    if (changed) Bus.emit('missions');
    // victory & defeat
    if (!s.victory && P.territories.length >= P.victoryTarget) {
      s.victory = true;
      Bus.emit('victory');
    }
    if (!s.over && !Game.player().alive) {
      s.over = true;
      Bus.emit('defeat');
    }
  },
  claim(id) {
    const s = Game.state;
    const m = MISSIONS.find((x) => x.id === id);
    if (!m || s.missions[id] !== 1) return { ok: false, msg: 'Nothing to claim yet.' };
    s.missions[id] = 2;
    Game.gain(0, m.reward);
    Game.rulerXp(0, m.xp);
    Bus.emit('missions');
    Bus.emit('reward', { reward: m.reward, xp: m.xp });
    return { ok: true, msg: `Reward claimed: ${m.name}.` };
  },
};
