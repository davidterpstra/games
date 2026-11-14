// localStorage save slot (`beyond.save.v1`). Never touches storage when the URL contains `?nosave`.

export const SAVE_KEY = 'beyond.save.v1';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStrArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Structural validation of a parsed save. */
export function validateSave(d) {
  return isObj(d) && d.version === 1 && Number.isFinite(d.timestamp) && Number.isFinite(d.playTime)
    && isObj(d.player) && isObj(d.environment) && Array.isArray(d.inventory) && isObj(d.missions)
    && isObj(d.world) && isStrArr(d.world.collected) && isObj(d.world.flags)
    && isStrArr(d.documents) && isStrArr(d.discovered) && typeof d.checkpoint === 'string';
}

/**
 * @param {{bus, collect:()=>object, apply:(data:object)=>void}} deps
 */
export function createSaveSystem({ bus, collect, apply }) {
  const disabled = (() => { try { return new URLSearchParams(location.search).has('nosave'); } catch { return false; } })();
  const readRaw = () => {
    if (disabled) return null;
    try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const d = JSON.parse(raw); return validateSave(d) ? d : null; } catch { return null; }
  };

  return {
    disabled,
    hasSave: () => readRaw() !== null,
    getInfo() {
      const d = readRaw();
      return d ? { timestamp: d.timestamp, missionTitle: typeof d.missionTitle === 'string' ? d.missionTitle : '', playTime: d.playTime } : null;
    },
    save() {
      if (disabled) return false;
      try {
        const data = collect();
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        bus.emit('game:saved', { timestamp: data.timestamp });
        return true;
      } catch (err) { console.warn('[save] failed', err); return false; }
    },
    load() {
      const d = readRaw();
      if (!d) return false;
      try { apply(d); } catch (err) { console.error('[save] load failed', err); return false; }
      bus.emit('game:loaded', { timestamp: d.timestamp });
      return true;
    },
    deleteSave() { if (disabled) return; try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } },
  };
}
