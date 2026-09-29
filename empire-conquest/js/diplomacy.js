/* =====================================================================
   EMPIRE CONQUEST — diplomacy: relations, war, peace, trade, alliances
   Relations run from -100 (hatred) to +100 (friendship) and change over
   time: shared borders cause friction, trade and alliances build trust,
   conquests scare everybody.
   ===================================================================== */
'use strict';

const Diplomacy = {
  key(a, b) { return a < b ? a + ',' + b : b + ',' + a; },
  rel(a, b) { return a === b || a < 0 || b < 0 ? null : Game.state.rel[this.key(a, b)] || null; },
  value(a, b) { const r = this.rel(a, b); return r ? r.v : 0; },
  atWar(a, b) { const r = this.rel(a, b); return !!r && r.st === 'war'; },
  allied(a, b) { const r = this.rel(a, b); return !!r && r.st === 'alliance'; },
  trading(a, b) { const r = this.rel(a, b); return !!r && r.trade && r.st !== 'war'; },
  status(a, b) { const r = this.rel(a, b); return r ? r.st : 'none'; },
  alive(kid) { return kid >= 0 && Game.state.kingdoms[kid].alive; },
  warsOf(kid) { return Game.state.kingdoms.filter((k) => k.id !== kid && k.alive && this.atWar(kid, k.id)).map((k) => k.id); },
  alliesOf(kid) { return Game.state.kingdoms.filter((k) => k.id !== kid && k.alive && this.allied(kid, k.id)).map((k) => k.id); },
  change(a, b, d) { const r = this.rel(a, b); if (r) r.v = clamp(r.v + d, -100, 100); },
  borders(a, b) {
    if (Game.cache.dirty) Game.rebuildCache();
    return !!(Game.cache.borders && Game.cache.borders.has(this.key(a, b)));
  },
  relationLabel(v) {
    if (v >= 60) return { text: 'Friendly', cls: 'good' };
    if (v >= 20) return { text: 'Cordial', cls: 'good' };
    if (v > -20) return { text: 'Neutral', cls: 'neutral' };
    if (v > -60) return { text: 'Hostile', cls: 'bad' };
    return { text: 'Hatred', cls: 'bad' };
  },

  computeBorders() {
    const s = Game.state, set = new Set();
    for (let t = 0; t < s.terr.length; t++) {
      const o = s.terr[t].owner;
      if (o < 0) continue;
      for (const a of Game.wt(t).adj) {
        const p = s.terr[a.t].owner;
        if (p >= 0 && p !== o) set.add(this.key(o, p));
      }
    }
    Game.cache.borders = set;
  },

  /* ---------------- actions ---------------- */
  declareWar(a, b, silent = false) {
    const s = Game.state;
    const r = this.rel(a, b);
    if (!r || r.st === 'war' || !this.alive(a) || !this.alive(b)) return { ok: false, msg: 'Cannot declare war.' };
    const truceBreak = r.truce > 0;
    r.st = 'war'; r.trade = false; r.since = s.day; r.gain = { [a]: 0, [b]: 0 }; r.truce = 0; r.by = a;
    r.v = Math.min(r.v - 35, -30);
    const A = Game.k(a), B = Game.k(b);
    for (const c of s.kingdoms) {
      if (!c.alive || c.id === a || c.id === b) continue;
      this.change(a, c.id, truceBreak ? -20 : -4);
    }
    Game.log(`${A.short} declared war on ${B.short}!`, '⚔️', a === 0 || b === 0 ? 'bad' : 'war');
    if (b === 0) Game.notify('War declared!', `${A.name} has declared war on you! Prepare your defenses.`, { icon: '⚔️', kind: 'bad', sound: 'war' });
    // allies of the defender join the war
    for (const c of this.alliesOf(b)) {
      if (c === a || this.atWar(c, a)) continue;
      if (this.allied(c, a)) { this.rel(c, a).st = 'peace'; }
      this.joinWar(c, a, b);
    }
    // allies of the attacker may join if they dislike the victim
    for (const c of this.alliesOf(a)) {
      if (c === b || this.atWar(c, b) || this.allied(c, b)) continue;
      if (c === 0) continue; // the player decides for themselves
      if (this.value(c, b) < 20) this.joinWar(c, b, a);
    }
    Army.evictForeign();
    Bus.emit('diplomacy');
    return { ok: true, msg: `War declared on ${B.short}.` };
  },
  joinWar(c, enemy, friend) {
    const s = Game.state;
    const r = this.rel(c, enemy);
    if (!r) return;
    r.st = 'war'; r.trade = false; r.since = s.day; r.gain = { [c]: 0, [enemy]: 0 }; r.truce = 0; r.by = c;
    r.v = Math.min(r.v - 25, -25);
    Game.log(`${Game.k(c).short} joins the war against ${Game.k(enemy).short} to help ${Game.k(friend).short}.`, '🛡️', c === 0 || enemy === 0 ? 'bad' : 'war');
    if (enemy === 0) Game.notify('New enemy!', `${Game.k(c).name} joined the war against you as an ally of ${Game.k(friend).short}.`, { icon: '⚔️', kind: 'bad', sound: 'war' });
    if (c === 0) Game.notify('Called to arms', `As an ally of ${Game.k(friend).short} you are now at war with ${Game.k(enemy).short}.`, { icon: '🛡️', kind: 'warn', sound: 'war' });
  },
  makePeace(a, b) {
    const r = this.rel(a, b);
    if (!r || r.st !== 'war') return { ok: false, msg: 'Not at war.' };
    r.st = 'peace'; r.truce = 90; r.v = Math.max(r.v + 12, -20); r.since = Game.state.day;
    Game.log(`${Game.k(a).short} and ${Game.k(b).short} signed a peace treaty.`, '🕊️', a === 0 || b === 0 ? 'good' : 'info');
    Army.evictForeign();
    Bus.emit('diplomacy');
    return { ok: true, msg: `Peace with ${Game.k(a === 0 ? b : a).short}.` };
  },
  formAlliance(a, b) {
    const r = this.rel(a, b);
    if (!r) return { ok: false, msg: '' };
    r.st = 'alliance'; r.trade = true;
    Game.log(`${Game.k(a).short} and ${Game.k(b).short} formed an alliance.`, '🤝', a === 0 || b === 0 ? 'good' : 'info');
    // allies share their maps
    if (a === 0 || b === 0) {
      const other = a === 0 ? b : a;
      for (const t of Game.territoriesOf(other)) Game.exploreAround(t);
    }
    Bus.emit('diplomacy');
    return { ok: true, msg: 'Alliance formed!' };
  },
  breakAlliance(a, b) {
    const r = this.rel(a, b);
    if (!r || r.st !== 'alliance') return { ok: false, msg: 'You are not allied.' };
    r.st = 'peace'; r.v -= 30;
    Game.log(`${Game.k(a).short} broke the alliance with ${Game.k(b).short}.`, '💔', 'bad');
    Army.evictForeign();
    Bus.emit('diplomacy');
    return { ok: true, msg: 'Alliance ended.' };
  },
  setTrade(a, b, on) {
    const r = this.rel(a, b);
    if (!r) return { ok: false, msg: '' };
    r.trade = on;
    if (on) {
      Game.log(`${Game.k(a).short} and ${Game.k(b).short} signed a trade agreement.`, '⚖️', a === 0 || b === 0 ? 'good' : 'info');
      if (a === 0 || b === 0) Game.explore([Game.k(a === 0 ? b : a).capital]);
    }
    Bus.emit('diplomacy');
    return { ok: true, msg: on ? 'Trade agreement signed.' : 'Trade agreement cancelled.' };
  },
  gift(from, to) {
    const r = this.rel(from, to);
    if (!r) return { ok: false, msg: '' };
    const day = Game.state.day;
    const idx = from < to ? 0 : 1;
    if (r.gift[idx] > day) return { ok: false, msg: `They received a gift recently. Wait ${Math.ceil(r.gift[idx] - day)} more days.` };
    const cost = { gold: GIFT_AMOUNT };
    if (!Game.canAfford(from, cost)) return { ok: false, msg: Game.missing(from, cost) };
    Game.pay(from, cost);
    const d = (r.st === 'war' ? 4 : 8) + (Game.k(from).ruler.dip - 3) * 2;
    this.change(from, to, d);
    r.gift[idx] = day + 30;
    Bus.emit('diplomacy');
    return { ok: true, msg: `${Game.k(to).short} appreciates your gift (+${d} relations).` };
  },

  onConquest(att, old, tid) {
    const s = Game.state;
    if (old >= 0) {
      this.change(att, old, -6);
      const r = this.rel(att, old);
      if (r && r.gain) r.gain[att] = (r.gain[att] || 0) + 1;
      for (const c of s.kingdoms) if (c.alive && c.id !== att && c.id !== old && !this.allied(c.id, att)) this.change(att, c.id, -1.5);
    } else {
      const near = new Set(Game.wt(tid).adj.map((a) => s.terr[a.t].owner).filter((o) => o >= 0 && o !== att));
      for (const c of near) this.change(att, c, -0.8);
    }
  },

  warScore(a, b) {
    const r = this.rel(a, b);
    if (!r) return 0;
    const g = r.gain || {};
    const pa = Game.cache.power[a] || 0, pb = Game.cache.power[b] || 0;
    const ratio = (pa - pb) / Math.max(1, pa + pb);
    return ((g[a] || 0) - (g[b] || 0)) * 12 + ratio * 40;
  },

  /* ---------------- proposals ---------------- */
  evaluate(type, from, to) {
    const s = Game.state;
    const K = Game.k(to), F = Game.k(from), r = this.rel(from, to);
    const out = { accept: false, score: 0, reasons: [], blocked: '' };
    if (!r || !K.alive) { out.blocked = 'Unavailable.'; return out; }
    const add = (text, v) => { v = Math.round(v); if (v) out.reasons.push([text, v]); out.score += v; };
    const nature = K.p || { aggression: 0.5, diplomacy: 0.5 };
    if (type === 'peace') {
      if (r.st !== 'war') { out.blocked = 'You are not at war.'; return out; }
      add('Base', 5);
      add('Relations', r.v * 0.3);
      add('War situation', -this.warScore(to, from));
      const days = s.day - r.since;
      add('War weariness', Math.min(35, days / 6));
      if (days > 120 && Math.abs(this.warScore(to, from)) < 12) add('Stalemate', 15);
      add('Their warlike nature', -nature.aggression * 25);
      add('Your diplomacy', (F.ruler.dip - 3) * 4);
    } else if (type === 'trade') {
      if (r.st === 'war') { out.blocked = 'You are at war.'; return out; }
      if (r.trade) { out.blocked = 'You already trade.'; return out; }
      if (r.v < -25) { out.blocked = 'They distrust you too much (relations below -25).'; return out; }
      add('Mutual profit', 12);
      add('Relations', r.v * 0.5);
      add('Your diplomacy', (F.ruler.dip - 3) * 4);
      add('Their nature', (nature.diplomacy - 0.5) * 20);
    } else if (type === 'alliance') {
      if (r.st === 'war') { out.blocked = 'You are at war.'; return out; }
      if (r.st === 'alliance') { out.blocked = 'You are already allied.'; return out; }
      if (r.v < 30) { out.blocked = 'Relations must be at least +30.'; return out; }
      add('Relations', r.v - 50);
      add('Your diplomacy', (F.ruler.dip - 3) * 5);
      const common = s.kingdoms.filter((c) => c.alive && c.id !== from && c.id !== to && this.atWar(from, c.id) && this.atWar(to, c.id)).length;
      add('Common enemies', common * 20);
      const pf = Game.cache.power[from] || 0, pt = Game.cache.power[to] || 1;
      add(pf > pt * 0.7 ? 'Your military strength' : 'You are weak', pf > pt * 0.7 ? 10 : -10);
      add('Their nature', (nature.diplomacy - 0.5) * 20);
      const conflict = this.alliesOf(from).some((c) => this.atWar(c, to)) || this.warsOf(from).some((c) => this.allied(c, to));
      if (conflict) add('Conflicting alliances', -40);
    }
    const cdKey = from + ':' + type;
    if (r.cd && r.cd[cdKey] > s.day) { out.blocked = `They refused recently. Try again in ${Math.ceil(r.cd[cdKey] - s.day)} days.`; return out; }
    out.accept = out.score >= 0;
    return out;
  },
  chanceLabel(score) {
    if (score >= 15) return { text: 'Very likely', cls: 'good' };
    if (score >= 0) return { text: 'Likely', cls: 'good' };
    if (score >= -12) return { text: 'Unlikely', cls: 'warn' };
    return { text: 'Will refuse', cls: 'bad' };
  },
  propose(type, from, to) {
    const ev = this.evaluate(type, from, to);
    if (ev.blocked) return { ok: false, msg: ev.blocked };
    const K = Game.k(to);
    const r = this.rel(from, to);
    if (!ev.accept) {
      r.cd = r.cd || {};
      r.cd[from + ':' + type] = Game.state.day + 15;
      this.change(from, to, -1);
      Bus.emit('diplomacy');
      return { ok: false, msg: `${K.short} rejects your ${type === 'peace' ? 'peace offer' : type === 'trade' ? 'trade proposal' : 'alliance proposal'}.`, rejected: true };
    }
    if (type === 'peace') return this.makePeace(from, to);
    if (type === 'trade') return this.setTrade(from, to, true);
    if (type === 'alliance') return this.formAlliance(from, to);
    return { ok: false, msg: '' };
  },

  /* offers from AI kingdoms to the player */
  offer(type, from) {
    const s = Game.state;
    if (s.offers.some((o) => o.type === type && o.from === from)) return;
    s.offers.push({ id: s.nextId++, type, from, day: s.day, expires: s.day + 25 });
    const K = Game.k(from);
    const text = { peace: `${K.name} offers peace.`, trade: `${K.name} proposes a trade agreement.`, alliance: `${K.name} proposes an alliance.` }[type];
    Game.notify('Diplomatic offer', text, { icon: type === 'peace' ? '🕊️' : type === 'trade' ? '⚖️' : '🤝', kind: 'info', offer: s.offers[s.offers.length - 1].id, sound: 'notify' });
    Bus.emit('offers');
  },
  answerOffer(id, accept) {
    const s = Game.state;
    const o = s.offers.find((x) => x.id === id);
    if (!o) return { ok: false, msg: 'This offer has expired.' };
    s.offers = s.offers.filter((x) => x !== o);
    Bus.emit('offers');
    if (!Game.k(o.from).alive) return { ok: false, msg: 'That kingdom no longer exists.' };
    if (!accept) { this.change(0, o.from, -3); return { ok: true, msg: 'Offer declined.' }; }
    if (o.type === 'peace') return this.atWar(0, o.from) ? this.makePeace(0, o.from) : { ok: false, msg: 'No longer at war.' };
    if (o.type === 'trade') return this.atWar(0, o.from) ? { ok: false, msg: 'You are at war.' } : this.setTrade(0, o.from, true);
    if (o.type === 'alliance') return this.atWar(0, o.from) ? { ok: false, msg: 'You are at war.' } : this.formAlliance(0, o.from);
    return { ok: false, msg: '' };
  },

  /* ---------------- time ---------------- */
  tick(dt) {
    const s = Game.state;
    const K = s.kingdoms;
    for (let a = 0; a < K.length; a++) {
      if (!K[a].alive) continue;
      for (let b = a + 1; b < K.length; b++) {
        if (!K[b].alive) continue;
        const r = s.rel[a + ',' + b];
        if (r.truce > 0) r.truce = Math.max(0, r.truce - dt);
        let d = 0;
        if (r.st === 'war') d -= r.v > -60 ? 0.03 : 0;
        if (r.trade && r.st !== 'war') d += 0.08;
        if (r.st === 'alliance') d += 0.1;
        if (r.st !== 'alliance' && this.borders(a, b)) {
          const ag = ((K[a].p ? K[a].p.aggression : 0.4) + (K[b].p ? K[b].p.aggression : 0.4)) / 2;
          d -= 0.025 * (0.5 + ag);
        }
        if (r.st !== 'war' && r.v < -30) d += 0.03;
        if (r.v > 50 && r.st === 'peace' && !r.trade) d -= 0.02;
        r.v = clamp(r.v + d * dt, -100, 100);
      }
    }
    // expire offers
    if (s.offers.length) {
      const before = s.offers.length;
      s.offers = s.offers.filter((o) => o.expires > s.day && Game.k(o.from).alive);
      if (s.offers.length !== before) Bus.emit('offers');
    }
  },
};
