/* =====================================================================
   EMPIRE CONQUEST — core interface: top bar, navigation, tooltips,
   toasts, modals, banners, chronicle, keyboard shortcuts and the
   click-action dispatcher used by every panel.
   ===================================================================== */
'use strict';

/* ---------- small HTML helpers shared by all panels ---------- */
const H = {
  cost(cost, kid = 0, extra = '') {
    const r = Game.state ? Game.k(kid).res : {};
    const parts = [];
    for (const k of ['gold', 'food', 'wood', 'iron', 'rp']) {
      if (!cost[k]) continue;
      const miss = (r[k] || 0) < cost[k];
      parts.push(`<span class="${miss ? 'miss' : ''}">${RES_ICON[k]} ${fmt(cost[k])}</span>`);
    }
    return `<span class="cost">${parts.join('')}${extra}</span>`;
  },
  bar(p, cls = '', anim = false) { return `<div class="bar ${cls} ${anim ? 'anim' : ''}"><i style="width:${clamp(p, 0, 1) * 100}%"></i></div>`; },
  pips(l, max) { let s = ''; for (let i = 1; i <= max; i++) s += `<i class="${i <= l ? 'on' : ''}"></i>`; return `<span class="pips">${s}</span>`; },
  btn(label, act, data = {}, o = {}) {
    let attrs = '';
    for (const k in data) attrs += ` data-${k}="${escapeHtml(String(data[k]))}"`;
    const dis = o.disabled ? ' disabled' : '';
    const why = o.disabled && o.why ? ` data-why="${escapeHtml(o.why)}"` : '';
    const tip = o.tip ? ` data-tip="${escapeHtml(o.tip)}"` : (o.disabled && o.why ? ` data-tip="${escapeHtml(o.why)}"` : '');
    return `<button class="btn ${o.cls || ''}${dis}" data-act="${act}"${attrs}${why}${tip}>${label}</button>`;
  },
  units(u, showZero = false) {
    const out = [];
    for (const k of UNIT_ORDER) if (u[k] > 0 || showZero) out.push(`<span class="chip" data-tip="${UNITS[k].name}">${UNITS[k].icon} ${fmt(u[k])}</span>`);
    return `<div class="uchips">${out.join('') || '<span class="muted small">No soldiers</span>'}</div>`;
  },
  face(h) { return h >= 75 ? '😄' : h >= 55 ? '🙂' : h >= 40 ? '😐' : h >= 25 ? '😟' : '😠'; },
  kdot(kid) { return `<span class="dot" style="background:${Game.ownerColor(kid)}"></span>`; },
  kname(kid) { return `${this.kdot(kid)} ${escapeHtml(kid < 0 ? 'Independent' : Game.k(kid).short)}`; },
  days(d) { d = Math.max(0, Math.ceil(d)); return d + (d === 1 ? ' day' : ' days'); },
  pctColor(p) { return p >= 0.75 ? 'var(--good)' : p >= 0.45 ? 'var(--warn)' : 'var(--bad)'; },
  tname(tid) { return escapeHtml(Game.wt(tid).name); },
  terrain(tid) { const T = TERRAIN[Game.wt(tid).terrain]; return `${T.icon} ${T.name}`; },
};

const UI = {
  settings: null,
  actions: {},
  shown: {},
  prevSpeed: 1,
  refreshT: 0,
  logSig: '',
  battleQueue: [],
  modalStack: [],
  hoverInfo: null,
  pointerDown: false,

  $(id) { return document.getElementById(id); },

  init() {
    this.buildResources();
    this.bindGlobal();
    this.bindBus();
    const chron = this.$('chronicle');
    if (window.innerWidth < 1200) chron.classList.add('collapsed');
  },

  act(name, fn) { this.actions[name] = fn; },

  /* show the outcome of an action */
  result(r, sound = 'click') {
    if (!r) return false;
    if (r.ok) {
      if (r.msg) this.toast({ title: r.msg, kind: 'good', icon: '✔️', dur: 3200 });
      Sound.play(sound);
    } else {
      this.toast({ title: r.rejected ? 'Rejected' : 'Not possible', text: r.msg, kind: r.rejected ? 'bad' : 'warn', icon: r.rejected ? '✉️' : '⛔', dur: 4500 });
      Sound.play('error');
    }
    this.refresh(true);
    return r.ok;
  },

  /* ---------------- top bar ---------------- */
  buildResources() {
    const list = [
      ['gold', '💰', 'Gold'], ['food', '🌾', 'Food'], ['wood', '🪵', 'Wood'], ['iron', '⛏️', 'Iron'],
      ['pop', '👥', 'Population'], ['happiness', '😊', 'Happiness'], ['rp', '📜', 'Research'],
    ];
    this.$('resources').innerHTML = list.map(([id, ico, name]) => `
      <div class="res" id="res-${id}" data-tipfn="res" data-arg="${id}">
        <span class="res-icon">${ico}</span>
        <div class="res-body"><span class="res-val" id="val-${id}">0</span><span class="res-rate" id="rate-${id}"></span></div>
        ${['gold', 'food', 'wood', 'iron'].includes(id) ? `<div class="res-cap" id="cap-${id}"><i></i></div>` : ''}
      </div>`).join('');
  },

  refreshTop(dt) {
    const s = Game.state;
    if (!s) return;
    const k = Game.player();
    const c = Game.cache;
    const r = c.rates[0] || { gold: 0, food: 0, wood: 0, iron: 0, rp: 0 };
    const caps = c.caps[0] || {};
    const vals = {
      gold: k.res.gold, food: k.res.food, wood: k.res.wood, iron: k.res.iron, rp: k.res.rp,
      pop: c.pop[0] || 0, happiness: c.happy[0] || 0,
    };
    for (const id in vals) {
      const target = vals[id];
      const prev = this.shown[id];
      if (prev === undefined || !Number.isFinite(prev)) { this.shown[id] = target; }
      else {
        const diff = target - prev;
        const el = this.$('res-' + id);
        if (Math.abs(diff) > Math.max(20, Math.abs(prev) * 0.05) && el && !el._flashT) {
          el.classList.add(diff > 0 ? 'flash-up' : 'flash-down', 'pulse');
          el._flashT = setTimeout(() => { el.classList.remove('flash-up', 'flash-down', 'pulse'); el._flashT = null; }, 700);
        }
        this.shown[id] = Math.abs(diff) < 0.5 ? target : prev + diff * Math.min(1, dt * 7);
      }
      const v = this.shown[id];
      const valEl = this.$('val-' + id);
      if (!valEl) continue;
      if (id === 'pop') valEl.textContent = `${fmt(v)} / ${fmt(c.popCap[0] || 0)}`;
      else if (id === 'happiness') {
        valEl.textContent = `${Math.round(v)}%`;
        this.$('res-happiness').querySelector('.res-icon').textContent = H.face(v);
      } else valEl.textContent = fmt(v);
    }
    const setRate = (id, val, suffix = '') => {
      const el = this.$('rate-' + id);
      if (!el) return;
      el.textContent = fmtRate(val) + suffix;
      el.className = 'res-rate ' + (val > 0.05 ? 'pos' : val < -0.05 ? 'neg' : '');
    };
    for (const id of ['gold', 'food', 'wood', 'iron', 'rp']) setRate(id, r[id] || 0, '/d');
    // population growth ≈ sum over territories (estimate)
    const growth = this.popGrowth();
    setRate('pop', growth, '/d');
    const hEl = this.$('rate-happiness');
    const hv = c.happy[0] || 0;
    hEl.textContent = hv >= 75 ? 'Joyful' : hv >= 55 ? 'Content' : hv >= 40 ? 'Uneasy' : hv >= 25 ? 'Unhappy' : 'Rebellious';
    hEl.className = 'res-rate ' + (hv >= 55 ? 'pos' : hv < 40 ? 'neg' : '');
    for (const id of ['gold', 'food', 'wood', 'iron']) {
      const cap = caps[id];
      const el = this.$('cap-' + id);
      if (!el || !cap) continue;
      const p = clamp(k.res[id] / cap, 0, 1);
      el.firstElementChild.style.width = p * 100 + '%';
      el.classList.toggle('full', p >= 0.98);
    }
  },
  popGrowth() {
    const s = Game.state;
    if (!this._pg || s.day - this._pg.day >= 1 || s.day < this._pg.day) {
      const pop = Game.cache.pop[0] || 0;
      this._pg = { day: s.day, rate: this._pg && this._pg.pop !== undefined && s.day - this._pg.day < 3 ? (pop - this._pg.pop) / Math.max(0.1, s.day - this._pg.day) : 0, pop };
    }
    return this._pg.rate;
  },

  refreshDate() {
    const s = Game.state;
    if (!s) return;
    const d = Math.floor(s.day);
    const year = Math.floor(d / 360) + 1, doy = d % 360;
    const seasons = [['🌸', 'Spring'], ['☀️', 'Summer'], ['🍂', 'Autumn'], ['❄️', 'Winter']];
    const [ic, sn] = seasons[Math.floor(doy / 90)];
    this.$('date').innerHTML = `${ic} ${sn}, Year ${year}<small>Day ${d + 1}</small>`;
    for (const b of document.querySelectorAll('#speed button')) b.classList.toggle('active', +b.dataset.speed === s.speed);
  },

  setSpeed(v) {
    const s = Game.state;
    if (!s) return;
    if (v > 0) this.prevSpeed = v;
    s.speed = v;
    this.refreshDate();
    this.hint(v === 0 ? '⏸ <b>Paused</b> — press Space to continue' : '', v === 0 ? 0 : 1);
  },

  badges() {
    const s = Game.state;
    if (!s) return;
    const set = (id, n) => {
      const el = this.$(id);
      if (!el) return;
      const txt = n ? String(n) : '';
      if (el.textContent !== txt) { el.textContent = txt; el.classList.toggle('show', !!n); }
    };
    set('badge-missions', Missions.claimable());
    set('badge-diplomacy', s.offers.length);
    set('badge-war', Diplomacy.warsOf(0).length);
    const k = Game.player();
    const idleTech = !k.research && TECHS.some((t) => Tech.info(0, t.id).ok);
    set('badge-tech', idleTech ? '!' : '');
    const threats = s.armies.filter((a) => a.owner !== 0 && a.move && s.terr[a.move.to].owner === 0 && s.explored[a.move.to]).length;
    set('badge-army', threats ? '⚠' : '');
    const armyBadge = this.$('badge-army');
    if (armyBadge) armyBadge.classList.toggle('danger', !!threats);
  },

  /* ---------------- chronicle ---------------- */
  refreshChronicle(force) {
    const s = Game.state;
    if (!s) return;
    const sig = s.log.length + ':' + (s.log.length ? s.log[s.log.length - 1].t : '');
    if (sig === this.logSig && !force) return;
    const fresh = this.logLen === undefined ? 0 : Math.max(0, s.log.length - this.logLen);
    this.logSig = sig;
    this.logLen = s.log.length;
    const rows = s.log.slice(-40).reverse().map((l, i) => `
      <div class="log-row ${l.k} ${l.tid >= 0 ? 'link' : ''} ${i < fresh ? 'new' : ''}" ${l.tid >= 0 ? `data-act="focus" data-tid="${l.tid}"` : ''}>
        <span class="d">D${l.d + 1}</span><span>${l.i}</span><span class="t">${escapeHtml(l.t)}</span>
      </div>`).join('');
    this.$('chronicle-list').innerHTML = rows;
  },

  /* ---------------- periodic refresh ---------------- */
  refresh(force = false) {
    if (!Game.state) return;
    this.refreshDate();
    this.badges();
    this.refreshChronicle();
    Panels.refresh(force);
    Context.refresh(force);
  },
  tick(dt) {
    if (!Game.state) return;
    this.refreshTop(dt);
    this.refreshT -= dt;
    if (this.refreshT <= 0) { this.refreshT = 0.25; this.refresh(false); }
    if (this.minimapT === undefined) this.minimapT = 0;
    this.minimapT -= dt;
    if (this.minimapT <= 0) { this.minimapT = 0.25; MapView.drawMinimap(this.$('minimap')); }
    if (this.hoverInfo) this.showMapTip(this.hoverInfo);
  },

  /* ---------------- tooltips ---------------- */
  tipFns: {
    res(id) {
      const s = Game.state, k = Game.player(), c = Game.cache;
      const r = c.rates[0];
      if (!r) return '';
      const caps = c.caps[0] || {};
      const row = (a, b, cls = '') => `<div class="tt-row"><span>${a}</span><b class="${cls}">${b}</b></div>`;
      if (id === 'gold') {
        const civ = r.income.gold - r.trade;
        return `<b>💰 Gold</b> — pays for buildings, soldiers and diplomacy.<hr>${row('Territories', fmtRate(civ))}${row('Trade agreements', fmtRate(r.trade))}${row('Army upkeep', fmtRate(-r.upkeep.gold), 'bad')}<hr>${row('Net per day', fmtRate(r.gold), r.gold >= 0 ? 'good' : 'bad')}${row('Treasury limit', fmtInt(caps.gold || 0))}<div class="muted small">Markets, your castle and bigger settlements raise the limit.</div>`;
      }
      if (id === 'food') {
        const civ = (c.pop[0] || 0) * 0.008;
        return `<b>🌾 Food</b> — feeds your people and soldiers.<hr>${row('Farms & land', fmtRate(r.income.food))}${row('Population', fmtRate(-civ), 'bad')}${row('Soldiers', fmtRate(-(r.upkeep.food - civ)), 'bad')}<hr>${row('Net per day', fmtRate(r.food), r.food >= 0 ? 'good' : 'bad')}${row('Granary limit', fmtInt(caps.food || 0))}${k.starving ? '<div class="bad">Your people are starving!</div>' : ''}`;
      }
      if (id === 'wood') return `<b>🪵 Wood</b> — for buildings, archers and siege engines.<hr>${row('Production', fmtRate(r.wood))}${row('Storage limit', fmtInt(caps.wood || 0))}<div class="muted small">Lumber Camps in forests produce the most.</div>`;
      if (id === 'iron') return `<b>⛏️ Iron</b> — for weapons, knights and fortifications.<hr>${row('Production', fmtRate(r.iron))}${row('Storage limit', fmtInt(caps.iron || 0))}<div class="muted small">Mines in the mountains produce the most.</div>`;
      if (id === 'rp') {
        const res = k.research ? `<hr>Researching <b>${TECH_BY_ID[k.research.id].name}</b> — ${H.days(k.research.left)} left` : '<hr><span class="warn">No research in progress.</span>';
        return `<b>📜 Research points</b> — spent on technologies.<hr>${row('Per day', fmtRate(r.rp))}<div class="muted small">Your castle and Academies produce research.</div>${res}`;
      }
      if (id === 'pop') return `<b>👥 Population</b> — pays taxes and provides recruits.<hr>${row('People', fmtInt(c.pop[0] || 0))}${row('Capacity', fmtInt(c.popCap[0] || 0))}${row('Soldiers', fmtInt(c.soldiers[0] || 0))}<div class="muted small">Houses, bigger settlements and development raise the capacity. Happy people grow faster.</div>`;
      if (id === 'happiness') return `<b>${H.face(c.happy[0] || 0)} Happiness</b> — average over your lands.<hr><div class="small">Happy lands produce more and grow faster. Temples, markets, low taxes and peace help; high taxes, war, hunger and fresh conquests hurt.</div>`;
      return '';
    },
  },
  showTip(el, html) {
    const tip = this.$('tooltip');
    tip.innerHTML = html;
    tip.classList.add('show');
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.bottom + 8;
    if (y + th > window.innerHeight - 6) y = r.top - th - 8;
    x = clamp(x, 6, window.innerWidth - tw - 6);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  },
  hideTip() { this.$('tooltip').classList.remove('show'); this.tipEl = null; },
  showMapTip(info) {
    const tip = this.$('tooltip');
    const s = Game.state;
    if (!s || !info) return;
    let html = '';
    if (info.army !== undefined) {
      const a = Army.byId(info.army);
      if (!a) return;
      html = `<b>${escapeHtml(a.name)}</b> ${H.kdot(a.owner)} ${escapeHtml(Game.ownerName(a.owner))}<br>${fmtInt(Battle.total(a.units))} soldiers${a.general ? ' · ★ ' + escapeHtml(a.general.name) : ''}${a.move ? `<br><span class="muted">Marching to ${H.tname(a.move.to)}</span>` : ''}`;
    } else {
      const t = info.tid, ts = s.terr[t];
      if (!s.explored[t]) html = `<b>Unexplored land</b><br><span class="muted">Send scouts to learn more.</span>`;
      else {
        const isCap = ts.owner >= 0 && Game.k(ts.owner).capital === t;
        html = `<b>${H.tname(t)}</b>${isCap ? ' 👑' : ''}<br>${H.kname(ts.owner)} · ${TIERS[ts.tier].name}<br><span class="muted">${H.terrain(t)} · 👥 ${fmt(ts.pop)} · 🛡 ${fmt(Battle.total(ts.gar))}</span>`;
        if (ts.owner !== 0 && ts.owner >= 0) {
          const st = Diplomacy.status(0, ts.owner);
          html += `<br><span class="${st === 'war' ? 'bad' : st === 'alliance' ? 'good' : 'muted'}">${st === 'war' ? '⚔️ At war' : st === 'alliance' ? '🤝 Ally' : '🕊️ At peace'}</span>`;
        }
      }
    }
    tip.innerHTML = html;
    tip.classList.add('show');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = info.x + 16, y = info.y + 18;
    if (x + tw > window.innerWidth - 6) x = info.x - tw - 12;
    if (y + th > window.innerHeight - 6) y = info.y - th - 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  },

  /* ---------------- toasts ---------------- */
  toast(o) {
    const box = this.$('toasts');
    const el = document.createElement('div');
    el.className = `toast ${o.kind || 'info'} ${o.tid >= 0 ? 'link' : ''}`;
    let actions = '';
    if (o.offer) actions = `<div class="ta">${H.btn('Accept', 'offerAnswer', { id: o.offer, v: 1 }, { cls: 'good small' })}${H.btn('Decline', 'offerAnswer', { id: o.offer, v: 0 }, { cls: 'small' })}</div>`;
    else if (o.mission) actions = `<div class="ta">${H.btn('🎁 Claim reward', 'claimMission', { id: o.mission }, { cls: 'primary small' })}</div>`;
    else if (o.report) actions = `<div class="ta">${H.btn('📜 View report', 'battleReport', { id: o.report }, { cls: 'small' })}</div>`;
    el.innerHTML = `<div class="ti">${o.icon || 'ℹ️'}</div><div class="grow"><div class="tt">${escapeHtml(o.title || '')}</div>${o.text ? `<div class="tx">${escapeHtml(o.text)}</div>` : ''}${actions}</div>`;
    if (o.tid >= 0) el.addEventListener('click', (e) => { if (!e.target.closest('[data-act]')) { MapView.focusTerritory(o.tid); MapView.select({ type: 'terr', id: o.tid }); } });
    box.prepend(el);
    while (box.children.length > 5) box.lastChild.remove();
    const dur = o.dur || (o.offer ? 20000 : o.mission ? 9000 : 6000);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, dur);
  },

  /* ---------------- banner ---------------- */
  banner(title, sub = '', kind = '') {
    const b = this.$('banner');
    b.className = 'banner ' + kind;
    b.innerHTML = `<div class="b-title">${escapeHtml(title)}</div>${sub ? `<div class="b-sub">${escapeHtml(sub)}</div>` : ''}<div class="b-line"></div>`;
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.remove('show'), 3100);
  },

  hint(html, t = 0) {
    const el = this.$('map-hint');
    el.innerHTML = html;
    el.classList.toggle('show', !!html);
    clearTimeout(this._hintT);
    if (html && t > 0) this._hintT = setTimeout(() => el.classList.remove('show'), t * 1000);
  },

  /* ---------------- modals ---------------- */
  modal(o) {
    const root = this.$('modal-root');
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${o.cls || ''}" role="dialog" aria-modal="true">
      <div class="modal-head">${o.icon ? `<span style="font-size:24px">${o.icon}</span>` : ''}<h2>${o.title || ''}</h2>${o.closable === false ? '' : '<button class="close-btn" data-close>✕</button>'}</div>
      <div class="modal-body">${o.body || ''}</div>
      ${o.foot ? `<div class="modal-foot">${o.foot}</div>` : ''}
    </div>`;
    root.appendChild(back);
    const m = {
      root: back, body: back.querySelector('.modal-body'),
      close: () => {
        if (!back.isConnected) return;
        back.remove();
        this.modalStack = this.modalStack.filter((x) => x !== m);
        if (o.onClose) o.onClose();
      },
      closable: o.closable !== false,
    };
    back.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { m.close(); Sound.play('close'); }
      else if (e.target === back && m.closable && o.backdropClose !== false) m.close();
    });
    this.modalStack.push(m);
    Sound.play('open');
    return m;
  },
  topModal() { return this.modalStack[this.modalStack.length - 1]; },
  confirm({ title, text, ok = 'Confirm', danger = false, icon = '❓', onOk }) {
    const m = this.modal({
      title, icon, body: `<p style="margin:0;line-height:1.55">${text}</p>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${ok}</button>`,
    });
    m.root.querySelector('[data-ok]').addEventListener('click', () => { m.close(); onOk && onOk(); });
    return m;
  },

  /* ---------------- panels ---------------- */
  openPanel(name) {
    if (name === 'map' || !name) { Panels.close(); }
    else if (Panels.current === name) Panels.close();
    else {
      Panels.open(name);
      // on narrow screens the side panel and the context sheet share the space
      if (window.innerWidth < 1080) this.$('context').classList.remove('open');
    }
    for (const b of document.querySelectorAll('#sidebar button')) b.classList.toggle('active', b.dataset.panel === (Panels.current || 'map'));
  },

  /* ---------------- global input ---------------- */
  bindGlobal() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.classList.contains('disabled')) {
        if (el.dataset.why) this.toast({ title: 'Not possible yet', text: el.dataset.why, kind: 'warn', icon: '⛔', dur: 3800 });
        Sound.play('error');
        return;
      }
      const fn = this.actions[el.dataset.act];
      if (fn) fn(el.dataset, el, e);
    });
    document.addEventListener('pointerdown', () => { this.pointerDown = true; }, true);
    document.addEventListener('pointerup', () => { this.pointerDown = false; }, true);
    // tooltips
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-tip],[data-tipfn]');
      if (!el || el === this.tipEl) return;
      this.tipEl = el;
      const html = el.dataset.tipfn ? this.tipFns[el.dataset.tipfn](el.dataset.arg) : el.dataset.tip;
      if (html) this.showTip(el, html);
    });
    document.addEventListener('mouseout', (e) => {
      if (!this.tipEl) return;
      const to = e.relatedTarget;
      if (to && this.tipEl.contains(to)) return;
      if (e.target.closest('[data-tip],[data-tipfn]') === this.tipEl) this.hideTip();
    });
    document.addEventListener('pointerdown', () => this.hideTip());
    // sidebar
    for (const b of document.querySelectorAll('#sidebar button')) b.addEventListener('click', () => { this.openPanel(b.dataset.panel); Sound.play('click'); });
    // speed
    for (const b of document.querySelectorAll('#speed button')) b.addEventListener('click', () => { this.setSpeed(+b.dataset.speed); Sound.play('click'); });
    // audio
    this.$('btn-audio').addEventListener('click', () => {
      this.settings.audio = !this.settings.audio;
      Sound.setEnabled(this.settings.audio);
      Save.saveSettings(this.settings);
      this.updateAudioBtn();
      Sound.play('click');
      this.toast({ title: this.settings.audio ? 'Sound on' : 'Sound off', icon: this.settings.audio ? '🔊' : '🔇', dur: 1800 });
    });
    this.$('btn-menu').addEventListener('click', () => Screens.menu());
    // map controls
    for (const b of document.querySelectorAll('.map-modes button')) b.addEventListener('click', () => {
      MapView.mode = b.dataset.mode;
      for (const x of document.querySelectorAll('.map-modes button')) x.classList.toggle('active', x === b);
      Sound.play('click');
    });
    for (const b of document.querySelectorAll('.zoom-btns button')) b.addEventListener('click', () => {
      const z = b.dataset.zoom;
      if (z === 'in') MapView.zoomAt(MapView.w / 2, MapView.h / 2, 1.4);
      else if (z === 'out') MapView.zoomAt(MapView.w / 2, MapView.h / 2, 1 / 1.4);
      else if (z === 'home') this.goHome();
      else if (z === 'world') MapView.flyTo(MapView.world.W / 2, MapView.world.H / 2, MapView.minZ);
      Sound.play('click');
    });
    // minimap
    const mm = this.$('minimap');
    const jump = (e) => {
      const r = mm.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * MapView.world.W, y = (e.clientY - r.top) / r.height * MapView.world.H;
      MapView.anim = null; MapView.cam.x = x; MapView.cam.y = y; MapView.clampCam();
    };
    let mmDown = false;
    mm.addEventListener('pointerdown', (e) => { mmDown = true; mm.setPointerCapture(e.pointerId); jump(e); });
    mm.addEventListener('pointermove', (e) => { if (mmDown) jump(e); });
    mm.addEventListener('pointerup', () => { mmDown = false; });
    // keyboard
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === 'escape' && this.topModal()) { if (this.topModal().closable) this.topModal().close(); return; }
      if (!Game.state || !document.getElementById('title-screen').classList.contains('hidden')) return;
      if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); this.result(Save.write('auto')); return; }
      if (key === 'escape') {
        if (MapView.orderTarget >= 0) { MapView.orderTarget = -1; Context.refresh(true); return; }
        if (Panels.current) { this.openPanel('map'); return; }
        if (MapView.sel) { MapView.select(null); return; }
        Screens.menu();
        return;
      }
      if (this.topModal()) return;
      if (key === ' ') { e.preventDefault(); this.setSpeed(Game.state.speed ? 0 : this.prevSpeed || 1); return; }
      if (key === '1') this.setSpeed(1);
      else if (key === '2') this.setSpeed(2);
      else if (key === '3') this.setSpeed(4);
      else if (key === 'k') this.openPanel('kingdom');
      else if (key === 'm') this.openPanel('map');
      else if (key === 'r') this.openPanel('army');
      else if (key === 'x') this.openPanel('war');
      else if (key === 'p') this.openPanel('diplomacy');
      else if (key === 't') this.openPanel('tech');
      else if (key === 'o') this.openPanel('missions');
      else if (key === 'h') this.goHome();
    });
    // generic actions
    this.act('focus', (d) => { const t = +d.tid; MapView.focusTerritory(t); MapView.select({ type: 'terr', id: t }); if (window.innerWidth < 900) this.openPanel('map'); });
    this.act('focusArmy', (d) => { const a = Army.byId(+d.id); if (!a) return; const p = Army.position(a); MapView.flyTo(p.x, p.y, Math.max(MapView.cam.z, 0.9)); MapView.select({ type: 'army', id: a.id }); if (window.innerWidth < 900) this.openPanel('map'); });
    this.act('openPanel', (d) => this.openPanel(d.p));
    this.act('toggleChronicle', () => this.$('chronicle').classList.toggle('collapsed'));
    this.act('claimMission', (d) => this.result(Missions.claim(d.id), 'coin'));
    this.act('offerAnswer', (d, el) => {
      const r = Diplomacy.answerOffer(+d.id, d.v === '1');
      const t = el.closest('.toast'); if (t) t.remove();
      this.result(r, d.v === '1' ? 'fanfare' : 'click');
    });
    this.act('battleReport', (d) => { const r = Game.state.battles.find((b) => b.id === +d.id); if (r) Screens.battleReport(r, false); });
  },

  goHome() {
    const k = Game.player();
    if (!k || !k.alive) return;
    MapView.focusTerritory(k.capital, 1.1);
    MapView.select({ type: 'terr', id: k.capital });
  },

  updateAudioBtn() { this.$('btn-audio').textContent = this.settings.audio ? '🔊' : '🔇'; },

  /* ---------------- game events ---------------- */
  bindBus() {
    Bus.on('notify', (n) => {
      this.toast({ title: n.title, text: n.text, icon: n.icon, kind: n.kind, tid: n.tid === undefined ? -1 : n.tid, offer: n.offer, mission: n.mission });
      if (n.sound) Sound.play(n.sound);
    });
    Bus.on('log', () => this.refreshChronicle());
    Bus.on('mapHover', (h) => {
      this.hoverInfo = h;
      if (!h) this.hideTip();
    });
    Bus.on('select', () => {
      Context.show();
      if (window.innerWidth < 1080) {
        this.$('context').classList.toggle('open', !!MapView.sel);
        if (MapView.sel && Panels.current) this.openPanel('map');
      }
    });
    Bus.on('orderPreview', () => { Context.refresh(true); if (window.innerWidth < 1080) this.$('context').classList.add('open'); });
    Bus.on('orderArmy', (o) => {
      const r = Army.order(0, o.army, o.tid);
      if (this.result(r, 'march')) { MapView.orderTarget = -1; }
    });
    Bus.on('battle', (r) => {
      if (r.att !== 0 && r.def !== 0) return;
      Sound.play('battle');
      if (r.att === 0 && this.settings.battleReports) this.battleQueue.push(r);
      else if (r.def === 0) {
        this.toast({ title: r.win ? `Battle lost at ${Game.wt(r.tid).name}` : `Victory at ${Game.wt(r.tid).name}!`, text: `${Game.ownerName(r.att)} attacked with ${fmt(Battle.total(r.attStart))} soldiers. Losses: you ${fmt(r.defLoss)}, enemy ${fmt(r.attLoss)}.`, icon: r.win ? '💥' : '🛡️', kind: r.win ? 'bad' : 'good', tid: r.tid, report: r.id });
      } else if (r.att === 0) {
        this.toast({ title: r.win ? `Victory at ${Game.wt(r.tid).name}!` : `Defeat at ${Game.wt(r.tid).name}`, text: `Losses: you ${fmt(r.attLoss)}, enemy ${fmt(r.defLoss)}.`, icon: r.win ? '🏆' : '💥', kind: r.win ? 'good' : 'bad', tid: r.tid, report: r.id });
      }
    });
    Bus.on('conquest', (c) => {
      if (c.kid === 0) {
        setTimeout(() => { this.banner('Territory captured!', `${Game.wt(c.tid).name} is now part of your kingdom`); Sound.play('conquest'); }, this.settings.battleReports ? 50 : 0);
      } else if (c.old === 0) {
        this.banner('Territory lost', `${Game.k(c.kid).short} captured ${Game.wt(c.tid).name}`, 'bad');
      }
    });
    Bus.on('kingdomFallen', (kid) => {
      if (kid === 0) return;
      this.toast({ title: `${Game.k(kid).name} has fallen!`, text: 'Its last territory was conquered.', icon: '💀', kind: 'gold', dur: 8000 });
      Sound.play('war');
    });
    Bus.on('reward', (r) => {
      const parts = Object.entries(r.reward).map(([k, v]) => `+${fmt(v)} ${RES_ICON[k]}`).join('  ');
      this.banner('Reward!', parts);
      const cap = Game.player().capital;
      if (cap >= 0) MapView.floatText(cap, parts);
    });
    Bus.on('projectDone', (p) => {
      if (p.kid !== 0) return;
      this.refresh(true);
      const key = p.p.type === 'build' ? `${p.tid}:${p.p.id}` : null;
      if (key) for (const el of document.querySelectorAll(`[data-bcard="${key}"]`)) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    });
    Bus.on('victory', () => Screens.victory());
    Bus.on('defeat', () => Screens.defeat());
    Bus.on('offers', () => this.badges());
    Bus.on('missions', () => this.badges());
  },
};
