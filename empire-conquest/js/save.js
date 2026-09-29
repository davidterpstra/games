/* =====================================================================
   EMPIRE CONQUEST — saving & loading (localStorage)
   Slots: an autosave plus three manual slots. The world geometry is
   regenerated from the seed, so a save is small (≈50 KB).
   ===================================================================== */
'use strict';

const Save = {
  PREFIX: 'empireConquest.v1.',
  SLOTS: [
    { id: 'auto', name: 'Autosave' },
    { id: 'slot1', name: 'Slot 1' },
    { id: 'slot2', name: 'Slot 2' },
    { id: 'slot3', name: 'Slot 3' },
  ],
  lastSave: 0,

  storage() {
    try { const ls = window.localStorage; ls.setItem(this.PREFIX + 'test', '1'); ls.removeItem(this.PREFIX + 'test'); return ls; } catch (e) { return null; }
  },
  available() { return !!this.storage(); },

  meta(state) {
    const k = state.kingdoms[0];
    return {
      savedAt: Date.now(), day: Math.floor(state.day), kingdom: k.name, color: k.color,
      ruler: `${k.ruler.title} ${k.ruler.name}`,
      territories: state.terr.filter((t) => t.owner === 0).length,
      difficulty: state.difficulty, seed: state.seed,
    };
  },

  write(slot = 'auto') {
    const ls = this.storage();
    const s = Game.state;
    if (!ls) return { ok: false, msg: 'Saving is not available in this browser (storage blocked).' };
    if (!s) return { ok: false, msg: 'No game to save.' };
    try {
      const data = JSON.stringify(s);
      ls.setItem(this.PREFIX + slot, data);
      ls.setItem(this.PREFIX + slot + '.meta', JSON.stringify(this.meta(s)));
      this.lastSave = Date.now();
      Bus.emit('saved', slot);
      return { ok: true, msg: slot === 'auto' ? 'Game saved.' : `Saved to ${this.SLOTS.find((x) => x.id === slot).name}.` };
    } catch (e) {
      return { ok: false, msg: 'Saving failed: ' + (e && e.name === 'QuotaExceededError' ? 'the browser storage is full.' : e.message) };
    }
  },

  readMeta(slot) {
    const ls = this.storage();
    if (!ls) return null;
    try { return JSON.parse(ls.getItem(this.PREFIX + slot + '.meta') || 'null'); } catch (e) { return null; }
  },
  exists(slot) { const ls = this.storage(); return !!(ls && ls.getItem(this.PREFIX + slot)); },
  latestSlot() {
    let best = null, bt = 0;
    for (const sl of this.SLOTS) { const m = this.readMeta(sl.id); if (m && this.exists(sl.id) && m.savedAt > bt) { bt = m.savedAt; best = sl.id; } }
    return best;
  },

  read(slot) {
    const ls = this.storage();
    if (!ls) return { ok: false, msg: 'Storage is not available.' };
    const raw = ls.getItem(this.PREFIX + slot);
    if (!raw) return { ok: false, msg: 'This slot is empty.' };
    let s;
    try { s = JSON.parse(raw); } catch (e) { return { ok: false, msg: 'The save file is damaged and cannot be read.' }; }
    const err = this.validate(s);
    if (err) return { ok: false, msg: 'The save file is invalid: ' + err };
    this.migrate(s);
    return { ok: true, state: s };
  },

  validate(s) {
    if (!s || typeof s !== 'object') return 'no data';
    if (s.version !== 1) return 'unknown version';
    if (!Number.isFinite(s.seed)) return 'missing world seed';
    if (!Array.isArray(s.kingdoms) || s.kingdoms.length < 2) return 'missing kingdoms';
    if (!Array.isArray(s.terr) || !s.terr.length) return 'missing territories';
    if (!Array.isArray(s.armies)) return 'missing armies';
    return '';
  },

  /* fill in fields added in later versions */
  migrate(s) {
    s.offers = s.offers || [];
    s.battles = s.battles || [];
    s.log = s.log || [];
    s.missions = s.missions || {};
    for (const m of MISSIONS) if (s.missions[m.id] === undefined) s.missions[m.id] = 0;
    for (const t of s.terr) {
      t.gar = { ...emptyUnits(), ...(t.gar || {}) };
      t.queue = t.queue || [];
      for (const id of BUILDING_ORDER) if (t.b[id] === undefined) t.b[id] = 0;
    }
    for (const a of s.armies) { a.units = { ...emptyUnits(), ...a.units }; a.path = a.path || []; }
    for (const k in s.rel) { const r = s.rel[k]; r.gift = r.gift || [0, 0]; }
  },

  remove(slot) {
    const ls = this.storage();
    if (!ls) return;
    ls.removeItem(this.PREFIX + slot);
    ls.removeItem(this.PREFIX + slot + '.meta');
  },
  wipeAll() {
    for (const sl of this.SLOTS) this.remove(sl.id);
  },

  /* audio & UI preferences */
  loadSettings() {
    const ls = this.storage();
    const def = { audio: false, master: 0.7, music: 0.5, sfx: 0.8, battleReports: true, autosave: true };
    if (!ls) return def;
    try { return { ...def, ...JSON.parse(ls.getItem(this.PREFIX + 'settings') || '{}') }; } catch (e) { return def; }
  },
  saveSettings(st) {
    const ls = this.storage();
    if (ls) try { ls.setItem(this.PREFIX + 'settings', JSON.stringify(st)); } catch (e) { /* ignore */ }
  },
};
