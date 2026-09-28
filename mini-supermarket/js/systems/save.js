/* SaveSystem: stores the whole game in localStorage as JSON. Loading is
 * defensive — every value is validated by the class that owns it, so an old
 * or hand-edited save cannot crash the game. */
(function (MS) {
  'use strict';

  const KEY = 'miniSupermarket.save.v1';
  const BACKUP_KEY = 'miniSupermarket.save.corrupt';
  const VERSION = 1;

  class SaveSystem {
    constructor(game) {
      this.game = game;
      this.lastSaved = 0;
      this.available = SaveSystem.storageWorks();
    }

    static storageWorks() {
      try {
        const k = '__ms_test__';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        return true;
      } catch {
        return false;
      }
    }

    hasSave() {
      if (!this.available) return false;
      try { return !!window.localStorage.getItem(KEY); } catch { return false; }
    }

    save() {
      if (!this.available) return false;
      try {
        const data = this.game.serialize();
        data.version = VERSION;
        data.savedAt = Date.now();
        window.localStorage.setItem(KEY, JSON.stringify(data));
        this.lastSaved = Date.now();
        MS.bus.emit('saved');
        return true;
      } catch (e) {
        console.warn('[MS] save failed', e);
        return false;
      }
    }

    /** Returns the saved object, or null when there is none or it is unreadable. */
    load() {
      if (!this.available) return null;
      let raw = null;
      try {
        raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || !data.version) throw new Error('not a save');
        return data;
      } catch (e) {
        console.warn('[MS] save unreadable, starting fresh', e);
        try { if (raw) window.localStorage.setItem(BACKUP_KEY, raw); } catch { /* ignore */ }
        return null;
      }
    }

    clear() {
      if (!this.available) return;
      try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    }
  }

  SaveSystem.KEY = KEY;
  MS.SaveSystem = SaveSystem;
})((window.MS = window.MS || {}));
