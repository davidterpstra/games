/* =====================================================================
   02_data.js — PlayerData (defaults + validation) and SaveService
   ===================================================================== */

const _sdMAXNUM = 1e300;
const _sdMAXPETS = 5000;

function _sdNum(v, def = 0) { return isNum(v) && v >= 0 ? Math.min(v, _sdMAXNUM) : def; }
function _sdInt(v, lo, hi, def = lo) {
  if (!isNum(v)) return def;
  return clamp(Math.floor(v), lo, hi);
}
function _sdBool(v, def) { return typeof v === 'boolean' ? v : def; }
function _sdKeys(o) { return isObj(o) ? Object.keys(o) : []; }
function _sdHas(map, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(map, k); }

/** Upgrades older save data to the current version (currently identity). */
function _sdMigrate(data) {
  if (!isObj(data)) return data;
  // let v = isNum(data.version) ? data.version : 1;
  // if (v < 2) { ...; v = 2; }
  return data;
}

function _sdInvSlotsMax() {
  try {
    const it = GEM_SHOP.find((g) => g && g.kind === 'invSlots');
    if (it && isNum(it.max) && it.max >= 0) return Math.floor(it.max);
  } catch (e) { /* ignore */ }
  return 20;
}

function _sdValidPit(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  const seen = new Set();
  for (const e of list) {
    if (out.length >= ECONOMY.pitMax) break;
    if (!isObj(e) || !_sdHas(ANIMAL_BY_ID, e.id) || !_sdHas(VARIANTS, e.variant)) continue;
    let pid = e.pid;
    if (!isStr(pid) || seen.has(pid)) pid = uid('a');
    seen.add(pid);
    out.push({ pid, id: e.id, variant: e.variant });
  }
  return out;
}

const PlayerData = {
  create() {
    const upgrades = {};
    for (const u of UPGRADES) upgrades[u.id] = 0;
    const machines = {};
    for (const w of WORLDS) machines[w.id] = { pit: [], plays: 0 };
    return {
      version: 1,
      createdAt: Date.now(), lastSaved: 0,
      coins: ECONOMY.startCoins, gems: ECONOMY.startGems, strength: 0,
      pets: [],
      equipped: [],
      upgrades,
      worlds: { unlocked: ['starter'], current: 'starter' },
      machines,
      discovered: {},
      indexClaimed: {},
      shop: { equipSlots: 0, invSlots: 0, autoTrain: false },
      boosts: { luck: 0, coins: 0 },
      training: { selected: TRAINING_EQUIPMENT[0].id, auto: false },
      daily: { last: 0, streak: 0 },
      stats: { plays: 0, wins: 0, slips: 0, misses: 0, reps: 0, coinsEarned: 0, bestRarity: null, playTime: 0 },
      settings: { quality: 'auto', sound: true, music: true, volume: 0.8 },
    };
  },

  validate(raw) {
    const d = PlayerData.create();
    try {
      if (!isObj(raw)) return d;
      raw = _sdMigrate(raw);
      if (!isObj(raw)) return d;
      const r = raw;

      d.createdAt = _sdNum(r.createdAt, d.createdAt);
      d.lastSaved = _sdNum(r.lastSaved, 0);
      d.coins = _sdNum(r.coins, d.coins);
      d.gems = _sdNum(r.gems, d.gems);
      d.strength = _sdNum(r.strength, 0);

      // shop (needed for equip slots)
      const rs = isObj(r.shop) ? r.shop : {};
      d.shop.equipSlots = _sdInt(rs.equipSlots, 0, Math.max(0, ECONOMY.maxEquipSlots - ECONOMY.baseEquipSlots), 0);
      d.shop.invSlots = _sdInt(rs.invSlots, 0, _sdInvSlotsMax(), 0);
      d.shop.autoTrain = _sdBool(rs.autoTrain, false);

      // pets
      const seenUid = new Set();
      if (Array.isArray(r.pets)) {
        for (const p of r.pets) {
          if (d.pets.length >= _sdMAXPETS) break;
          if (!isObj(p) || !_sdHas(ANIMAL_BY_ID, p.id) || !_sdHas(VARIANTS, p.variant)) continue;
          let u = p.uid;
          if (!isStr(u) || seenUid.has(u)) u = uid('p');
          seenUid.add(u);
          d.pets.push({ uid: u, id: p.id, variant: p.variant, locked: p.locked === true, t: isNum(p.t) ? p.t : 0 });
        }
      }

      // equipped
      const slots = Math.max(0, Math.floor(ECONOMY.baseEquipSlots + d.shop.equipSlots));
      if (Array.isArray(r.equipped)) {
        const eq = new Set();
        for (const u of r.equipped) {
          if (d.equipped.length >= slots) break;
          if (typeof u === 'string' && seenUid.has(u) && !eq.has(u)) { eq.add(u); d.equipped.push(u); }
        }
      }

      // upgrades
      const ru = isObj(r.upgrades) ? r.upgrades : {};
      for (const u of UPGRADES) d.upgrades[u.id] = _sdInt(ru[u.id], 0, Math.max(0, Math.floor(u.maxLevel)), 0);

      // worlds
      const rw = isObj(r.worlds) ? r.worlds : {};
      const unl = new Set(['starter']);
      if (Array.isArray(rw.unlocked)) for (const w of rw.unlocked) if (_sdHas(WORLD_BY_ID, w)) unl.add(w);
      d.worlds.unlocked = WORLDS.map((w) => w.id).filter((id) => unl.has(id));
      if (!d.worlds.unlocked.includes('starter')) d.worlds.unlocked.unshift('starter');
      d.worlds.current = typeof rw.current === 'string' && d.worlds.unlocked.includes(rw.current) ? rw.current : 'starter';

      // machines
      const rm = isObj(r.machines) ? r.machines : {};
      for (const w of WORLDS) {
        const m = isObj(rm[w.id]) ? rm[w.id] : {};
        d.machines[w.id] = { pit: _sdValidPit(m.pit), plays: _sdInt(m.plays, 0, Number.MAX_SAFE_INTEGER, 0) };
      }

      // index
      const rd = isObj(r.discovered) ? r.discovered : {};
      for (const k of _sdKeys(rd)) if (_sdHas(ANIMAL_BY_ID, k) && isNum(rd[k]) && rd[k] >= 0) d.discovered[k] = Math.floor(Math.min(rd[k], Number.MAX_SAFE_INTEGER));
      const ri = isObj(r.indexClaimed) ? r.indexClaimed : {};
      for (const k of _sdKeys(ri)) if (_sdHas(WORLD_BY_ID, k) && ri[k] === true) d.indexClaimed[k] = true;

      // boosts / training
      const rb = isObj(r.boosts) ? r.boosts : {};
      d.boosts.luck = _sdNum(rb.luck, 0);
      d.boosts.coins = _sdNum(rb.coins, 0);
      const rt = isObj(r.training) ? r.training : {};
      if (typeof rt.selected === 'string' && _sdHas(EQUIPMENT_BY_ID, rt.selected)) d.training.selected = rt.selected;
      d.training.auto = d.shop.autoTrain && rt.auto === true;

      // daily
      const rdl = isObj(r.daily) ? r.daily : {};
      d.daily.last = _sdNum(rdl.last, 0);
      d.daily.streak = _sdInt(rdl.streak, 0, Number.MAX_SAFE_INTEGER, 0);

      // stats
      const rst = isObj(r.stats) ? r.stats : {};
      for (const k of ['plays', 'wins', 'slips', 'misses', 'reps', 'coinsEarned', 'playTime']) d.stats[k] = _sdNum(rst[k], 0);
      d.stats.bestRarity = typeof rst.bestRarity === 'string' && _sdHas(RARITY_BY_ID, rst.bestRarity) ? rst.bestRarity : null;

      // settings
      const rse = isObj(r.settings) ? r.settings : {};
      if (['auto', 'low', 'medium', 'high'].includes(rse.quality)) d.settings.quality = rse.quality;
      d.settings.sound = _sdBool(rse.sound, true);
      d.settings.music = _sdBool(rse.music, true);
      d.settings.volume = isNum(rse.volume) ? clamp(rse.volume, 0, 1) : 0.8;

      d.version = 1;
      return d;
    } catch (e) {
      console.warn('[PlayerData.validate] failed, using what was sanitized so far', e);
      try { return PlayerData.validate(null); } catch (e2) { return d; }
    }
  },
};

/* ---------- save envelope helpers ---------- */
function _sdChecksum(str) {
  let hv = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hv ^= str.charCodeAt(i);
    hv = Math.imul(hv, 0x01000193) >>> 0;
  }
  return (hv >>> 0).toString(16).padStart(8, '0');
}
function _sdPack(data) { return JSON.stringify({ v: 1, sum: _sdChecksum(JSON.stringify(data)), data }); }
/** string -> raw data object when the envelope + checksum are intact, else null. */
function _sdUnpack(str) {
  try {
    if (typeof str !== 'string' || !str) return null;
    const env = JSON.parse(str);
    if (!isObj(env) || !isObj(env.data) || typeof env.sum !== 'string') return null;
    if (env.sum !== _sdChecksum(JSON.stringify(env.data))) return null;
    return env.data;
  } catch (e) { return null; }
}
function _sdToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function _sdFromB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const SaveService = {
  KEY: 'clawsim_save_v1',
  BACKUP_KEY: 'clawsim_save_v1_bak',
  recovered: false,
  _locked: false,        // set by reset()/importCode(): no more writes this page life
  _warned: false,
  _autosaveOn: false,
  _lastBackup: 0,
  _debounce: null,

  _get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },

  load() {
    this.recovered = false;
    const main = this._get(this.KEY);
    let data = _sdUnpack(main);
    if (data) return PlayerData.validate(data);
    if (main != null) console.warn('[SaveService] main save is corrupt');
    const bak = this._get(this.BACKUP_KEY);
    data = _sdUnpack(bak);
    if (data) {
      console.warn('[SaveService] restored from backup save');
      this.recovered = true;
      return PlayerData.validate(data);
    }
    if (main != null || bak != null) console.warn('[SaveService] no usable save, starting fresh');
    return PlayerData.create();
  },

  save(reason) {
    if (this._locked || !Game.player) return false;
    try {
      const now = Date.now();
      Game.player.lastSaved = now;
      const str = _sdPack(Game.player);
      const prev = localStorage.getItem(this.KEY);
      if (prev && now - this._lastBackup >= 60000 && _sdUnpack(prev)) {
        localStorage.setItem(this.BACKUP_KEY, prev);
        this._lastBackup = now;
      }
      localStorage.setItem(this.KEY, str);
      Bus.emit('save:done', { time: now });
      return true;
    } catch (e) {
      if (!this._warned) {
        this._warned = true;
        console.warn('[SaveService] save failed', e);
        Bus.emit('toast', { text: 'Could not save (storage unavailable)', kind: 'bad' });
      }
      return false;
    }
  },

  startAutosave() {
    if (this._autosaveOn) return;
    this._autosaveOn = true;
    setInterval(() => this.save('interval'), 15000);
    Bus.on('save:request', (d) => {
      if (this._debounce) clearTimeout(this._debounce);
      this._debounce = setTimeout(() => { this._debounce = null; this.save((d && d.reason) || 'request'); }, 1000);
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.save('hidden'); });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.save('pagehide'));
      window.addEventListener('beforeunload', () => this.save('unload'));
    }
  },

  exportCode() {
    try {
      if (Game.player) Game.player.lastSaved = Date.now();
      return _sdToB64(_sdPack(PlayerData.validate(Game.player)));
    } catch (e) { return ''; }
  },

  importCode(str) {
    const bad = { ok: false, err: 'Invalid save code' };
    try {
      if (typeof str !== 'string') return bad;
      const code = str.replace(/\s+/g, '');
      if (!code) return bad;
      const data = _sdUnpack(_sdFromB64(code));
      if (!data) return bad;
      const packed = _sdPack(PlayerData.validate(data));
      this._locked = true;           // block pagehide autosave from overwriting the import
      if (this._debounce) { clearTimeout(this._debounce); this._debounce = null; }
      try {
        const old = localStorage.getItem(this.KEY);
        if (old) localStorage.setItem(this.BACKUP_KEY, old);
        localStorage.setItem(this.KEY, packed);
      } catch (e) {
        this._locked = false;
        return { ok: false, err: 'Could not store the save (storage unavailable)' };
      }
      return { ok: true };
    } catch (e) { return bad; }
  },

  reset() {
    this._locked = true;
    if (this._debounce) { clearTimeout(this._debounce); this._debounce = null; }
    try { localStorage.removeItem(this.KEY); localStorage.removeItem(this.BACKUP_KEY); } catch (e) { /* ignore */ }
  },
};
