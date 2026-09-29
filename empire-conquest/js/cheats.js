/* =====================================================================
   EMPIRE CONQUEST — cheat menu
   Open it in a running game by typing "cheats" on the keyboard (outside
   text fields) or with Ctrl+Shift+C.
   ===================================================================== */
'use strict';

const Cheats = {
  typed: '',

  list: [
    ['res', '💰 Resources', '+50,000 gold, food, wood, iron and +5,000 research'],
    ['map', '🗺️ Reveal the map', 'Removes the fog of war everywhere'],
    ['army', '🪖 Army', '+500 infantry, +300 archers, +200 cavalry and +100 knights in your capital'],
    ['siege', '⚙️ Siege engines', '+50 siege engines in your capital'],
    ['tech', '🔬 All technology', 'Research every technology instantly'],
    ['build', '🏗️ Max capital', 'Every building in your capital at its highest level, plus walls and development'],
    ['finish', '⏩ Finish projects', 'Complete all construction and training right now'],
    ['ruler', '👑 Ruler points', '+10 skill points for your ruler'],
    ['happy', '😄 Happy people', 'All your lands at 100% happiness, no unrest'],
    ['conquer', '🚩 Capture selected', 'Take the territory selected on the map'],
    ['peace', '🕊️ Peace with all', 'End every war you are in'],
    ['missions', '🎯 Complete missions', 'Mark every mission as complete (claim the rewards yourself)'],
  ],

  // cheats that can stay switched on ("∞"): they are applied again every quarter second
  INF: {
    res: 'Unlimited gold, food, wood, iron and research',
    map: 'The map stays revealed',
    army: 'Your capital garrison refills itself',
    siege: 'Always 50 siege engines in your capital',
    tech: 'Every technology stays researched',
    build: 'Every territory you own is fully built',
    finish: 'Construction, training and research finish instantly',
    ruler: 'Always 10 skill points',
    happy: 'Happiness always 100%',
    peace: 'Nobody can stay at war with you',
    missions: 'Missions complete themselves',
  },
  on(id) { return !!(Game.state && Game.state.cheats && Game.state.cheats.includes(id)); },
  toggle(id) {
    const s = Game.state;
    s.cheats = s.cheats || [];
    if (this.on(id)) s.cheats = s.cheats.filter((x) => x !== id);
    else s.cheats.push(id);
    return this.on(id);
  },

  open() {
    if (!Game.state || Game.state.over) return;
    const row = ([id, name, desc]) => `<div class="row" style="gap:6px">
        <button class="btn block grow" data-cheat="${id}" data-tip="${escapeHtml(desc)}" style="justify-content:flex-start">${name}</button>
        ${this.INF[id] ? `<button class="btn ${this.on(id) ? 'primary' : ''}" data-inf="${id}" data-tip="${escapeHtml('Infinite: ' + this.INF[id] + (this.on(id) ? ' (on — click to switch off)' : ''))}" style="min-width:46px;font-size:18px">∞</button>` : '<span style="min-width:46px"></span>'}
      </div>`;
    const body = `<p class="small muted" style="margin-top:0">Cheats change your current game. The autosave keeps the result. Switch on <b>∞</b> to keep a cheat active all the time.</p>
      <div class="grid2">${this.list.map(row).join('')}</div>`;
    const m = UI.modal({ title: 'Cheats', icon: '🧙', body, cls: 'wide', foot: '<button class="btn primary" data-close>Close</button>' });
    m.root.querySelectorAll('[data-cheat]').forEach((b) => b.addEventListener('click', () => {
      const msg = this.run(b.dataset.cheat);
      UI.result({ ok: !msg.startsWith('!'), msg: msg.replace(/^!/, '') }, 'coin');
    }));
    m.root.querySelectorAll('[data-inf]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.inf;
      const now = this.toggle(id);
      if (now) this.apply(id);
      b.classList.toggle('primary', now);
      b.dataset.tip = 'Infinite: ' + this.INF[id] + (now ? ' (on — click to switch off)' : '');
      UI.hideTip();
      UI.result({ ok: true, msg: `∞ ${this.INF[id]}: ${now ? 'on' : 'off'}.` }, 'coin');
    }));
  },

  /* keep the infinite cheats applied */
  apply(id) {
    const s = Game.state, k = Game.player();
    if (!k.alive) return;
    const cap = k.capital, g = s.terr[cap].gar;
    switch (id) {
      case 'res': for (const r of RES_KEYS) k.res[r] = INFINITE_RES; k.starving = false; k.broke = false; break;
      case 'map': if (s.explored.some((e) => !e)) this.run('map'); break;
      case 'army': g.infantry = Math.max(g.infantry, 500); g.archers = Math.max(g.archers, 300); g.cavalry = Math.max(g.cavalry, 200); g.knights = Math.max(g.knights, 100); break;
      case 'siege': g.siege = Math.max(g.siege, 50); break;
      case 'tech': if (TECHS.some((t) => !k.techs[t.id])) this.run('tech'); break;
      case 'build':
        for (const tid of Game.territoriesOf(0)) {
          const ts = s.terr[tid];
          ts.tier = Math.max(ts.tier, tid === cap ? 4 : 3);
          for (const b of BUILDING_ORDER) if (b !== 'castle' || tid === cap) ts.b[b] = BUILDINGS[b].maxLevel || 5;
          ts.fort = Math.max(ts.fort, Kingdom.maxFort(0)); ts.dev = 10;
        }
        break;
      case 'finish': this.run('finish'); break;
      case 'ruler': k.ruler.points = Math.max(k.ruler.points, 10); break;
      case 'happy': this.run('happy'); break;
      case 'peace': if (Diplomacy.warsOf(0).length) this.run('peace'); break;
      case 'missions': for (const m of MISSIONS) if (!s.missions[m.id]) s.missions[m.id] = 1; break;
    }
  },
  tick() {
    const s = Game.state;
    if (!s || s.over || !s.cheats || !s.cheats.length) return;
    for (const id of s.cheats) { try { this.apply(id); } catch (e) { console.error('cheat', id, e); } }
  },

  run(id) {
    const s = Game.state, k = Game.player(), cap = k.capital;
    switch (id) {
      case 'res':
        for (const r of ['gold', 'food', 'wood', 'iron']) k.res[r] += 50000;
        k.res.rp += 5000;
        Bus.emit('resources');
        return 'Resources added.';
      case 'map':
        s.explored.fill(true);
        Bus.emit('explored', { tids: [] });
        MapView.overlayDirty = true; MapView.bordersDirty = true;
        return 'The whole world is revealed.';
      case 'army': {
        const g = s.terr[cap].gar;
        g.infantry += 500; g.archers += 300; g.cavalry += 200; g.knights += 100;
        return `1,100 soldiers joined the garrison of ${Game.wt(cap).name}.`;
      }
      case 'siege':
        s.terr[cap].gar.siege += 50;
        return `50 siege engines arrived in ${Game.wt(cap).name}.`;
      case 'tech':
        for (const t of TECHS) k.techs[t.id] = true;
        k.research = null;
        Bus.emit('research', { kid: 0 });
        return 'All technologies researched.';
      case 'build': {
        const ts = s.terr[cap];
        ts.tier = Math.max(ts.tier, 4);
        for (const b of BUILDING_ORDER) ts.b[b] = BUILDINGS[b].maxLevel || 5;
        ts.fort = Kingdom.maxFort(0);
        ts.dev = 10;
        ts.proj = null;
        Game.cache.dirty = true;
        return `${Game.wt(cap).name} is now a fully built Capital.`;
      }
      case 'finish':
        for (const tid of Game.territoriesOf(0)) {
          const ts = s.terr[tid];
          if (ts.proj) ts.proj.left = 0;
          for (const q of ts.queue) { ts.gar[q.u] += q.n - q.done; k.trained += q.n - q.done; }
          ts.queue = [];
        }
        if (k.research) k.research.left = 0;
        return 'Projects, training and research finished.';
      case 'ruler':
        k.ruler.points += 10;
        Bus.emit('ruler');
        return '+10 skill points. Spend them in the Kingdom screen.';
      case 'happy':
        for (const tid of Game.territoriesOf(0)) { s.terr[tid].happy = 100; s.terr[tid].unrest = 0; }
        return 'Your people are overjoyed.';
      case 'conquer': {
        const sel = MapView.sel;
        if (!sel || sel.type !== 'terr') return '!Select a territory on the map first.';
        if (s.terr[sel.id].owner === 0) return '!That territory is already yours.';
        Game.setOwner(sel.id, 0, 0);
        k.captured++;
        return `${Game.wt(sel.id).name} is now yours.`;
      }
      case 'peace': {
        const wars = Diplomacy.warsOf(0);
        if (!wars.length) return '!You are not at war.';
        for (const e of wars) Diplomacy.makePeace(0, e);
        return `Peace signed with ${wars.length} ${plural(wars.length, 'kingdom')}.`;
      }
      case 'missions':
        for (const m of MISSIONS) if (!s.missions[m.id]) s.missions[m.id] = 1;
        Bus.emit('missions');
        return 'All missions complete. Claim the rewards in Missions.';
    }
    return '!Unknown cheat.';
  },
};

window.addEventListener('keydown', (e) => {
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); Cheats.open(); return; }
  if (e.key.length !== 1) return;
  Cheats.typed = (Cheats.typed + e.key.toLowerCase()).slice(-6);
  if (Cheats.typed === 'cheats') { Cheats.typed = ''; Cheats.open(); }
});
window.Cheats = Cheats;
setInterval(() => Cheats.tick(), 250);
