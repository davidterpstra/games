/* =====================================================================
   EMPIRE CONQUEST — screens & dialogs: title, new game, menu,
   save / load, army composer, battle reports, victory, defeat, help.
   ===================================================================== */
'use strict';

const Screens = {
  /* ---------------- title screen ---------------- */
  title() {
    const ts = document.getElementById('title-screen');
    ts.classList.remove('hidden');
    MapView.showTitle = true;
    document.getElementById('app').classList.add('behind-title');
    const latest = Save.latestSlot();
    const meta = latest ? Save.readMeta(latest) : null;
    let h = '';
    if (meta) h += `<button class="btn primary big" data-act="titleContinue" data-slot="${latest}">▶ Continue<br><span class="meta">${escapeHtml(meta.kingdom)} · Day ${meta.day + 1} · ${meta.territories} ${plural(meta.territories, 'territory', 'territories')}</span></button>`;
    h += `<button class="btn ${meta ? '' : 'primary'} big" data-act="titleNew">⚔️ New Game</button>`;
    h += `<button class="btn big" data-act="titleLoad">📂 Load Game</button>`;
    h += `<div class="row" style="gap:10px"><button class="btn grow" data-act="help">📖 How to play</button><button class="btn grow" data-act="titleAudio">${UI.settings.audio ? '🔊 Sound on' : '🔇 Sound off'}</button></div>`;
    document.getElementById('title-buttons').innerHTML = h;
  },
  hideTitle() {
    document.getElementById('title-screen').classList.add('hidden');
    MapView.showTitle = false;
    document.getElementById('app').classList.remove('behind-title');
  },

  /* ---------------- new game ---------------- */
  newGame() {
    const st = {
      kingdom: 'Avalon', ruler: 'Aldric', title: 'King', color: PLAYER_COLORS[0], difficulty: 'normal',
      seed: Math.floor(Math.random() * 1e6),
    };
    const titles = ['King', 'Queen', 'Emperor', 'Empress', 'Lord', 'Lady', 'Prince', 'Princess'];
    const body = `
      <div class="grid2">
        <div class="field"><label>Kingdom name</label><input type="text" id="ng-kingdom" maxlength="20" value="${st.kingdom}"></div>
        <div class="field"><label>Ruler</label><div class="row"><select id="ng-title" style="width:110px">${titles.map((t) => `<option ${t === st.title ? 'selected' : ''}>${t}</option>`).join('')}</select><input type="text" id="ng-ruler" maxlength="16" value="${st.ruler}" class="grow"></div></div>
      </div>
      <div class="field"><label>Banner colour</label><div class="swatches">${PLAYER_COLORS.map((c) => `<div class="swatch ${c === st.color ? 'on' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}</div></div>
      <div class="field"><label>Difficulty</label><div class="choice-row">${Object.entries(DIFFICULTY).map(([id, d]) => `<div class="choice ${id === st.difficulty ? 'on' : ''}" data-diff="${id}"><div class="cn">${d.name}</div><div class="cd">${id === 'easy' ? 'Slower, weaker rivals. Extra starting gold.' : id === 'normal' ? 'A fair fight for the throne.' : 'Rich, aggressive kingdoms.'}</div></div>`).join('')}</div></div>
      <div class="field"><label>World</label><div class="row"><input type="text" id="ng-seed" value="${st.seed}" class="grow" style="font-variant-numeric:tabular-nums"><button class="btn" id="ng-reroll" data-tip="New random world">🎲 New world</button></div><div class="small muted" style="margin-top:4px">The map behind this window shows the world you will play in. Same number = same world.</div></div>`;
    const m = UI.modal({ title: 'Found your kingdom', icon: '👑', body, cls: 'wide', foot: '<button class="btn" data-close>Back</button><button class="btn primary big" id="ng-start">⚔️ Begin conquest</button>' });
    const root = m.root;
    const preview = () => {
      const seed = Math.abs(Math.floor(+root.querySelector('#ng-seed').value)) || 1;
      if (!MapView.world || MapView.world.seed !== seed) {
        Main.ensureWorld(seed);
        Game.state = null;
      }
    };
    preview();
    root.querySelectorAll('.swatch').forEach((el) => el.addEventListener('click', () => {
      st.color = el.dataset.color;
      root.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === el));
      Sound.play('click');
    }));
    root.querySelectorAll('.choice').forEach((el) => el.addEventListener('click', () => {
      st.difficulty = el.dataset.diff;
      root.querySelectorAll('.choice').forEach((x) => x.classList.toggle('on', x === el));
      Sound.play('click');
    }));
    root.querySelector('#ng-reroll').addEventListener('click', () => {
      root.querySelector('#ng-seed').value = Math.floor(Math.random() * 1e6);
      preview();
      Sound.play('click');
    });
    root.querySelector('#ng-seed').addEventListener('change', preview);
    root.querySelector('#ng-start').addEventListener('click', () => {
      const name = root.querySelector('#ng-kingdom').value.trim().slice(0, 20) || 'Avalon';
      const opts = {
        seed: Math.abs(Math.floor(+root.querySelector('#ng-seed').value)) || 1,
        kingdomName: 'Kingdom of ' + name, kingdomShort: name,
        rulerName: root.querySelector('#ng-ruler').value.trim().slice(0, 16) || 'Aldric',
        rulerTitle: root.querySelector('#ng-title').value,
        color: st.color, difficulty: st.difficulty,
      };
      m.close();
      Main.startNew(opts);
    });
  },

  welcome() {
    const k = Game.player();
    const body = `<p style="margin-top:0;line-height:1.6">Hail, <b>${escapeHtml(k.ruler.title)} ${escapeHtml(k.ruler.name)}</b>! The <b>${escapeHtml(k.name)}</b> is small: one town, a few hundred people and a handful of soldiers. Around you lie independent lands — and six rival kingdoms with the same dream.</p>
      <div class="grid2">
        <div class="card"><b>🏰 1. Build</b><div class="small muted mt">Open <b>Kingdom</b> and build a <b>Farm</b> and a <b>Mine</b> in your capital. Resources flow in automatically.</div></div>
        <div class="card"><b>🪖 2. Train</b><div class="small muted mt">Select your capital → <b>Military</b> tab to train soldiers. Raise armies from garrisons.</div></div>
        <div class="card"><b>⚔️ 3. Conquer</b><div class="small muted mt">Select the <b>1st Army</b>, click a grey neighbouring land and check the <b>win chance</b>. Then ATTACK!</div></div>
        <div class="card"><b>🌍 4. Expand</b><div class="small muted mt">Develop conquered lands, research technology, make friends — or war — through <b>Diplomacy</b>.</div></div>
      </div>
      <p class="small muted" style="margin-bottom:0">Follow the <b>Missions</b> for rewards. The game saves automatically. Rival kingdoms leave you alone for the first months — use that time well.</p>`;
    const m = UI.modal({ title: 'Your reign begins', icon: '📜', body, cls: 'wide', foot: '<button class="btn primary big" data-close>To glory! ⚔️</button>' });
    return m;
  },

  /* ---------------- game menu ---------------- */
  menu() {
    if (!Game.state) return;
    const wasSpeed = Game.state.speed;
    Game.state.speed = 0;
    UI.refreshDate();
    const st = UI.settings;
    const body = `
      <div class="grid2">
        <button class="btn big" data-act="menuSave">💾 Save game</button>
        <button class="btn big" data-act="menuLoad">📂 Load game</button>
        <button class="btn big" data-act="menuNew">⚔️ New game</button>
        <button class="btn big" data-act="help">📖 How to play</button>
      </div>
      <h3 class="sec">🔊 Audio</h3>
      <div class="row between"><span>Sound & music</span><span class="seg"><button class="${st.audio ? 'on' : ''}" data-act="setAudio" data-v="1">On</button><button class="${st.audio ? '' : 'on'}" data-act="setAudio" data-v="0">Off</button></span></div>
      ${['master', 'music', 'sfx'].map((k) => `<div class="range-row"><span>${{ master: 'Volume', music: 'Music', sfx: 'Effects' }[k]}</span><input type="range" min="0" max="1" step="0.05" value="${st[k]}" data-vol="${k}"><span class="muted" data-volv="${k}">${Math.round(st[k] * 100)}%</span></div>`).join('')}
      <h3 class="sec">⚙️ Game</h3>
      <div class="row between"><span>Show a battle report after your attacks</span><span class="seg"><button class="${st.battleReports ? 'on' : ''}" data-act="setOpt" data-k="battleReports" data-v="1">On</button><button class="${st.battleReports ? '' : 'on'}" data-act="setOpt" data-k="battleReports" data-v="0">Off</button></span></div>
      <div class="row between mt"><span>Autosave every 30 seconds</span><span class="seg"><button class="${st.autosave ? 'on' : ''}" data-act="setOpt" data-k="autosave" data-v="1">On</button><button class="${st.autosave ? '' : 'on'}" data-act="setOpt" data-k="autosave" data-v="0">Off</button></span></div>
      <div class="small muted mt">${Save.lastSave ? 'Last saved ' + new Date(Save.lastSave).toLocaleTimeString() : 'Not saved yet this session.'}${Save.available() ? '' : ' <span class="bad">Storage is blocked in this browser — saving is unavailable.</span>'}</div>
      <h3 class="sec">⚠️ Danger zone</h3>
      <div class="row between"><span class="small muted">Delete every save and start over.</span><button class="btn danger small" data-act="menuReset">🗑️ Reset progress</button></div>
      <div class="row between mt"><span class="small muted">Leave to the title screen (your game is saved first).</span><button class="btn small" data-act="menuTitle">🏠 Title screen</button></div>`;
    const m = UI.modal({ title: 'Menu', icon: '⚙️', body, cls: 'wide', onClose: () => { if (Game.state && !Game.state.over) { Game.state.speed = wasSpeed || 0; UI.refreshDate(); } } });
    m.root.querySelectorAll('[data-vol]').forEach((el) => el.addEventListener('input', () => {
      st[el.dataset.vol] = +el.value;
      m.root.querySelector(`[data-volv="${el.dataset.vol}"]`).textContent = Math.round(+el.value * 100) + '%';
      Sound.applyVolumes();
      Save.saveSettings(st);
    }));
    this.menuModal = m;
    return m;
  },

  /* ---------------- save / load ---------------- */
  slots(mode) {
    const rows = Save.SLOTS.map((sl) => {
      const meta = Save.readMeta(sl.id);
      const exists = meta && Save.exists(sl.id);
      const info = exists ? `<div class="small muted">${escapeHtml(meta.kingdom)} · ${escapeHtml(meta.ruler)} · Day ${meta.day + 1} · ${meta.territories} ${plural(meta.territories, 'territory', 'territories')} · ${DIFFICULTY[meta.difficulty] ? DIFFICULTY[meta.difficulty].name : ''}<br>${new Date(meta.savedAt).toLocaleString()}</div>` : '<div class="small muted">Empty</div>';
      let btn = '';
      if (mode === 'save') btn = sl.id === 'auto' ? '<span class="chip">Automatic</span>' : `<button class="btn small primary" data-slot="${sl.id}" data-do="save">${exists ? 'Overwrite' : 'Save here'}</button>`;
      else btn = exists ? `<button class="btn small primary" data-slot="${sl.id}" data-do="load">Load</button>` : '';
      const del = exists && mode === 'load' ? `<button class="btn small ghost" data-slot="${sl.id}" data-do="del" data-tip="Delete this save">🗑️</button>` : '';
      return `<div class="slot"><div style="font-size:24px">${sl.id === 'auto' ? '⏱️' : '💾'}</div><div class="grow"><div class="sn">${sl.name}</div>${info}</div>${del}${btn}</div>`;
    }).join('');
    const m = UI.modal({ title: mode === 'save' ? 'Save game' : 'Load game', icon: mode === 'save' ? '💾' : '📂', body: rows, cls: 'wide' });
    m.root.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', () => {
      const slot = b.dataset.slot;
      if (b.dataset.do === 'save') {
        const doSave = () => { const r = Save.write(slot); UI.result(r, 'coin'); m.close(); };
        if (Save.exists(slot)) UI.confirm({ title: 'Overwrite save?', text: 'The existing save in this slot will be replaced.', ok: 'Overwrite', onOk: doSave });
        else doSave();
      } else if (b.dataset.do === 'load') {
        const go = () => { m.close(); if (this.menuModal) this.menuModal.close(); Main.loadSlot(slot); };
        const inGame = Game.state && document.getElementById('title-screen').classList.contains('hidden');
        if (inGame) UI.confirm({ title: 'Load game?', text: 'Unsaved progress in the current game will be lost.', ok: 'Load', onOk: go });
        else go();
      } else if (b.dataset.do === 'del') {
        UI.confirm({ title: 'Delete save?', text: 'This cannot be undone.', ok: 'Delete', danger: true, onOk: () => { Save.remove(slot); m.close(); this.slots(mode); if (!document.getElementById('title-screen').classList.contains('hidden')) this.title(); } });
      }
    }));
    return m;
  },

  /* ---------------- army composer ---------------- */
  compose(o) {
    const s = Game.state;
    let source, title, confirmLabel, pick;
    let tid = o.tid;
    const a = o.id !== undefined ? Army.byId(o.id) : null;
    if (o.mode === 'create') {
      const own = Game.territoriesOf(0).filter((t) => Battle.total(s.terr[t].gar) > 0).sort((x, y) => Battle.total(s.terr[y].gar) - Battle.total(s.terr[x].gar));
      if (!own.length) { UI.toast({ title: 'No soldiers available', text: 'Train soldiers in a territory first (select it → Military tab).', kind: 'warn', icon: '🪖' }); return; }
      if (tid === undefined || !own.includes(tid)) tid = own[0];
      title = 'Raise a new army'; confirmLabel = '⚔️ Raise army';
      pick = own;
      source = () => s.terr[tid].gar;
    } else if (o.mode === 'reinforce') {
      if (!a) return;
      tid = a.loc; title = `Reinforce ${escapeHtml(a.name)}`; confirmLabel = '➕ Reinforce';
      source = () => s.terr[tid].gar;
    } else if (o.mode === 'station') {
      if (!a) return;
      tid = a.loc; title = `Station troops in ${H.tname(a.loc)}`; confirmLabel = '🏠 Station';
      source = () => a.units;
    } else if (o.mode === 'split') {
      if (!a) return;
      title = `Split ${escapeHtml(a.name)}`; confirmLabel = '✂️ Split';
      source = () => a.units;
    }
    const sel = {};
    const initAll = o.mode === 'create' || o.mode === 'reinforce';
    const reset = () => { const src = source(); for (const u of UNIT_ORDER) sel[u] = initAll ? src[u] : (o.mode === 'split' ? Math.floor(src[u] / 2) : 0); };
    reset();
    const rows = () => {
      const src = source();
      return UNIT_ORDER.filter((u) => src[u] > 0).map((u) => `<div class="compose-row"><span class="ui">${UNITS[u].icon}</span><span><b>${UNITS[u].name}</b><br><span class="small muted">available ${fmt(src[u])}</span></span>
        <input type="range" min="0" max="${src[u]}" value="${sel[u]}" data-r="${u}"><input type="number" min="0" max="${src[u]}" value="${sel[u]}" data-n="${u}"></div>`).join('') || '<div class="muted">No soldiers here.</div>';
    };
    const body = `${pick ? `<div class="field"><label>From the garrison of</label><select id="cmp-src">${pick.map((t) => `<option value="${t}" ${t === tid ? 'selected' : ''}>${escapeHtml(Game.wt(t).name)} — ${fmt(Battle.total(s.terr[t].gar))} soldiers</option>`).join('')}</select></div>` : ''}
      <div id="cmp-rows">${rows()}</div>
      <div class="row between mt"><div class="row"><button class="btn small" data-all="1">All</button><button class="btn small" data-all="0">None</button><button class="btn small" data-all="h">Half</button></div><div id="cmp-sum" class="small"></div></div>
      ${o.mode === 'create' ? '<div class="small muted mt">Keep some soldiers behind: the garrison defends the territory while your army is away.</div>' : ''}`;
    const m = UI.modal({ title, icon: '🪖', body, cls: 'wide', foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="cmp-ok">${confirmLabel}</button>` });
    const root = m.root;
    const sum = () => {
      const n = Battle.total(sel);
      root.querySelector('#cmp-sum').innerHTML = `Selected <b>${fmtInt(n)}</b> soldiers · strength <b>${fmt(Battle.strength(sel, 0))}</b>`;
    };
    const bind = () => {
      root.querySelectorAll('[data-r]').forEach((el) => el.addEventListener('input', () => { sel[el.dataset.r] = +el.value; root.querySelector(`[data-n="${el.dataset.r}"]`).value = el.value; sum(); }));
      root.querySelectorAll('[data-n]').forEach((el) => el.addEventListener('input', () => { const src = source(); const v = clamp(Math.floor(+el.value || 0), 0, src[el.dataset.n]); sel[el.dataset.n] = v; root.querySelector(`[data-r="${el.dataset.n}"]`).value = v; sum(); }));
    };
    bind(); sum();
    root.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => {
      const src = source();
      for (const u of UNIT_ORDER) sel[u] = b.dataset.all === '1' ? src[u] : b.dataset.all === 'h' ? Math.floor(src[u] / 2) : 0;
      root.querySelector('#cmp-rows').innerHTML = rows(); bind(); sum();
    }));
    const srcSel = root.querySelector('#cmp-src');
    if (srcSel) srcSel.addEventListener('change', () => { tid = +srcSel.value; reset(); root.querySelector('#cmp-rows').innerHTML = rows(); bind(); sum(); });
    root.querySelector('#cmp-ok').addEventListener('click', () => {
      let r;
      if (o.mode === 'create') r = Army.create(0, tid, sel);
      else if (o.mode === 'reinforce') r = Army.reinforce(0, a.id, sel);
      else if (o.mode === 'station') r = Army.station(0, a.id, sel);
      else r = Army.split(0, a.id, sel);
      if (UI.result(r, o.mode === 'create' ? 'march' : 'click')) {
        m.close();
        if (r.army) { MapView.select({ type: 'army', id: r.army.id }); const p = Army.position(r.army); MapView.flyTo(p.x, p.y, Math.max(MapView.cam.z, 0.9)); UI.hint('Click a territory to plan a march — <b>right-click</b> to march at once', 5); }
      }
    });
  },

  /* ---------------- battle report ---------------- */
  battleReport(r, animate = true) {
    const s = Game.state;
    const mine = r.att === 0 || r.def === 0;
    const youWon = r.att === 0 ? r.win : r.def === 0 ? !r.win : r.win;
    const place = Game.wt(r.tid).name;
    const side = (kid, start, end, label, loss) => {
      const col = Game.ownerColor(kid);
      return `<div class="bside" style="--kc:${col}"><div class="bn">${H.kdot(kid)} ${escapeHtml(Game.ownerName(kid))} <span class="muted small">${label}</span></div>
        ${UNIT_ORDER.filter((u) => start[u] > 0).map((u) => `<div class="bline"><span>${UNITS[u].icon} ${UNITS[u].name}</span><span>${fmtInt(end[u] || 0)} <span class="loss">(−${fmtInt(start[u] - (end[u] || 0))})</span></span></div>`).join('') || '<div class="muted small">No defenders</div>'}
        <div class="bstrength"><i data-bs="${label}" style="width:100%"></i></div>
        <div class="bline"><span class="muted">Losses</span><b class="loss">${fmtInt(loss)}</b></div></div>`;
    };
    const body = `<div class="battle-head"><div class="battle-result ${youWon || !mine ? 'win' : 'lose'}" id="br-res">${animate ? '⚔️ Battle!' : (mine ? (youWon ? 'Victory!' : 'Defeat') : r.win ? 'Attacker wins' : 'Defender wins')}</div>
        <div class="muted">Battle of ${escapeHtml(place)} · Day ${r.day + 1} · ${TERRAIN[r.terrain].icon} ${TERRAIN[r.terrain].name}${r.fort ? ` · 🧱 walls ${r.fort}` : ''}${r.amphibious ? ' · ⛵ sea landing' : ''}${r.general ? ` · ★ ${escapeHtml(r.general)}` : ''}</div></div>
      <div class="battle-anim" id="br-anim"><span class="clash">⚔️</span><span class="round" id="br-round"></span></div>
      <div class="battle-sides">${side(r.att, r.attStart, r.attEnd, 'Attacker', r.attLoss)}${side(r.def, r.defStart, r.defEnd, 'Defender', r.defLoss)}</div>
      ${r.win && r.att === 0 ? `<div class="card hl mt" style="text-align:center"><b class="gold-t" style="font-size:16px">🚩 Territory captured! ${escapeHtml(place)} is now yours.</b><div class="small muted">Station some troops there and develop it to make it useful.</div></div>` : ''}
      ${!r.win && r.att === 0 ? `<div class="card mt small">Your army fell back. Try more soldiers, better units (archers vs infantry, cavalry vs archers), siege engines against walls, or a general.</div>` : ''}`;
    const m = UI.modal({ title: 'Battle report', icon: '📜', body, cls: 'wide', foot: `<button class="btn" data-act="focus" data-tid="${r.tid}" data-close>📍 Show on map</button><button class="btn primary" data-close>Continue</button>` });
    const a0 = r.rounds[0][0] || 1, d0 = r.rounds[0][1] || 1;
    const setBars = (i) => {
      const [a, d] = r.rounds[Math.min(i, r.rounds.length - 1)];
      const ab = m.root.querySelector('[data-bs="Attacker"]'), db = m.root.querySelector('[data-bs="Defender"]');
      if (ab) ab.style.width = (a / a0) * 100 + '%';
      if (db) db.style.width = (d / d0) * 100 + '%';
      const rd = m.root.querySelector('#br-round');
      if (rd) rd.textContent = i === 0 ? 'THE ARMIES CLASH' : `ROUND ${Math.min(i, r.rounds.length - 1)}`;
    };
    if (animate) {
      setBars(0);
      let i = 0;
      const iv = setInterval(() => {
        i++;
        if (!m.root.isConnected) { clearInterval(iv); return; }
        setBars(i);
        if (i % 2) Sound.play('battle');
        if (i >= r.rounds.length) {
          clearInterval(iv);
          const res = m.root.querySelector('#br-res');
          res.textContent = mine ? (youWon ? 'Victory!' : 'Defeat') : (r.win ? 'Attacker wins' : 'Defender wins');
          res.className = 'battle-result ' + (youWon || !mine ? 'win' : 'lose');
          const anim = m.root.querySelector('#br-anim');
          anim.innerHTML = youWon ? '<span>🏆</span>' : '<span>💀</span>';
          if (mine && !youWon) Sound.play('defeat');
        }
      }, 320);
    } else {
      setBars(r.rounds.length - 1);
      const anim = m.root.querySelector('#br-anim');
      anim.innerHTML = youWon ? '<span>🏆</span>' : '<span>💀</span>';
    }
    return m;
  },

  /* ---------------- end of game ---------------- */
  victory() {
    const s = Game.state, k = Game.player();
    Sound.play('conquest');
    UI.modal({
      title: 'Emperor of the World!', icon: '🌟', cls: 'wide',
      body: `<div class="battle-head"><div class="battle-result win">Victory!</div><p>${escapeHtml(k.ruler.title)} ${escapeHtml(k.ruler.name)} rules ${Game.territoriesOf(0).length} of ${s.terr.length} territories. The ${escapeHtml(k.name)} is the greatest empire the world has ever seen.</p></div>
        <div class="grid3"><div class="stat"><div class="k">Days</div><div class="v">${Math.floor(s.day)}</div></div><div class="stat"><div class="k">Battles won</div><div class="v">${k.battlesWon}</div></div><div class="stat"><div class="k">Kingdoms destroyed</div><div class="v">${k.kingdomsDestroyed}</div></div></div>`,
      foot: '<button class="btn" data-act="menuNew" data-close>New game</button><button class="btn primary" data-close>Keep ruling</button>',
    });
  },
  defeat() {
    Sound.play('defeat');
    const latest = Save.latestSlot();
    UI.modal({
      title: 'Your kingdom has fallen', icon: '💀', cls: 'wide', closable: false,
      body: `<div class="battle-head"><div class="battle-result lose">Defeat</div><p>Your last territory has been conquered. History will remember your name — briefly.</p></div>`,
      foot: `${latest && latest !== 'auto' ? `<button class="btn" data-act="titleContinue" data-slot="${latest}" data-close>📂 Load last save</button>` : ''}<button class="btn primary" data-act="menuNew" data-close>⚔️ New game</button>`,
    });
  },

  help() {
    UI.modal({
      title: 'How to play', icon: '📖', cls: 'xwide',
      body: `<div class="grid2">
        <div><h3 class="sec">🎯 Goal</h3><p class="small" style="line-height:1.6">Grow from a single town into a world empire. Control <b>60%</b> of all territories to become <b>Emperor of the World</b>. Missions guide you along the way.</p>
          <h3 class="sec">🏰 Kingdom</h3><ul class="tip-list"><li>Resources are produced every day by your territories. Hover a resource at the top for details.</li><li>Build and upgrade <b>buildings</b> (one project per territory at a time). Settlements grow Village → Town → City → Major City → Capital.</li><li><b>Develop</b> for more output, <b>Fortify</b> for walls, set <b>Taxes</b> per territory.</li><li>Your <b>ruler</b> gains experience; spend skill points in the Kingdom screen.</li></ul>
          <h3 class="sec">🔬 Technology</h3><ul class="tip-list"><li>Research points come from your castle and Academies. Each technology costs research points and resources.</li></ul></div>
        <div><h3 class="sec">⚔️ War</h3><ul class="tip-list"><li>Train soldiers in a territory (Military tab). They join its <b>garrison</b>, which defends it.</li><li>Raise an <b>army</b> from a garrison. Select it and click a territory to see the route and the <b>win chance</b>; right-click to march at once.</li><li>Battles last up to 8 rounds. Counters matter: archers beat infantry, infantry beats cavalry, cavalry beats archers and siege engines.</li><li>Defenders get bonuses from <b>terrain</b> (mountains +40%) and <b>walls</b>. Bring siege engines against strong walls.</li><li>Generals, blacksmiths, technologies and the ruler's Military skill make armies stronger.</li></ul>
          <h3 class="sec">🤝 Diplomacy</h3><ul class="tip-list"><li>Declare war, propose peace, trade and alliances. Hover a proposal to see how the other ruler weighs it.</li><li>Rival kingdoms fight each other too — the world keeps changing.</li></ul></div>
      </div>
      <h3 class="sec">⌨️ Controls</h3>
      <div class="grid3 small">
        <div><kbd>Drag</kbd> / <kbd>W A S D</kbd> move map</div><div><kbd>Wheel</kbd> / <kbd>+ −</kbd> / pinch zoom</div><div><kbd>Right-click</kbd> march selected army</div>
        <div><kbd>Space</kbd> pause · <kbd>1 2 3</kbd> speed</div><div><kbd>K</kbd> Kingdom · <kbd>R</kbd> Army · <kbd>X</kbd> War</div><div><kbd>P</kbd> Diplomacy · <kbd>T</kbd> Tech · <kbd>O</kbd> Missions</div>
        <div><kbd>H</kbd> go to capital</div><div><kbd>Esc</kbd> close / menu</div><div><kbd>Ctrl</kbd>+<kbd>S</kbd> save</div>
      </div>`,
      foot: '<button class="btn primary" data-close>Got it</button>',
    });
  },
};

/* ---------------- screen actions ---------------- */
UI.act('titleNew', () => Screens.newGame());
UI.act('titleLoad', () => Screens.slots('load'));
UI.act('titleContinue', (d) => Main.loadSlot(d.slot));
UI.act('titleAudio', () => {
  UI.settings.audio = !UI.settings.audio;
  Sound.setEnabled(UI.settings.audio);
  Save.saveSettings(UI.settings);
  UI.updateAudioBtn();
  Screens.title();
});
UI.act('help', () => Screens.help());
UI.act('menuSave', () => Screens.slots('save'));
UI.act('menuLoad', () => Screens.slots('load'));
UI.act('menuNew', () => {
  const go = () => { for (const m of UI.modalStack.slice()) m.close(); Screens.newGame(); };
  if (Game.state && !Game.state.over) UI.confirm({ title: 'Start a new game?', text: 'Your current game stays in its save slots (the autosave will be replaced once the new game saves).', ok: 'New game', onOk: go });
  else go();
});
UI.act('menuReset', () => UI.confirm({
  title: 'Reset all progress?', icon: '🗑️', danger: true, ok: 'Delete everything',
  text: 'This deletes <b>all</b> save slots, including the autosave. This cannot be undone.',
  onOk: () => {
    Save.wipeAll();
    for (const m of UI.modalStack.slice()) m.close();
    Main.toTitle(false);
    UI.toast({ title: 'All progress deleted', icon: '🗑️', kind: 'warn' });
  },
}));
UI.act('menuTitle', () => { for (const m of UI.modalStack.slice()) m.close(); Main.toTitle(true); });
UI.act('setAudio', (d) => {
  UI.settings.audio = d.v === '1';
  Sound.setEnabled(UI.settings.audio);
  Save.saveSettings(UI.settings);
  UI.updateAudioBtn();
  if (Screens.menuModal) { Screens.menuModal.close(); Screens.menu(); }
});
UI.act('setOpt', (d) => {
  UI.settings[d.k] = d.v === '1';
  Save.saveSettings(UI.settings);
  if (Screens.menuModal) { Screens.menuModal.close(); Screens.menu(); }
});
