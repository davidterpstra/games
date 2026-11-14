// Player settings, persisted in localStorage. Emits 'settings:changed' on the bus.
import { bus } from './EventBus.js';

const KEY = 'beyond.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  mouseSensitivity: 1.0,   // multiplier, 0.2 – 3
  invertY: false,
  fov: 75,                 // degrees, 60 – 100
  headBob: true,
  masterVolume: 0.8,       // 0 – 1
  sfxVolume: 1.0,          // 0 – 1
  ambientVolume: 0.8,      // 0 – 1
  quality: 'auto',         // 'auto' | 'low' | 'medium' | 'high'
  shadows: true,
  renderScale: 1.0,        // 0.5 – 1 (multiplies the preset's pixel ratio)
  showFps: false,
  language: 'nl',
});

function storageGet() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function storageSet(value) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private mode: settings just won't persist */ }
}

class SettingsStore {
  constructor() {
    const saved = storageGet();
    this.values = { ...DEFAULT_SETTINGS };
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (k in saved && typeof saved[k] === typeof DEFAULT_SETTINGS[k]) this.values[k] = saved[k];
      }
    }
  }
  get(key) { return this.values[key]; }
  all() { return { ...this.values }; }
  set(key, value) {
    if (!(key in DEFAULT_SETTINGS)) throw new Error(`Unknown setting "${key}"`);
    if (typeof value !== typeof DEFAULT_SETTINGS[key]) throw new Error(`Setting "${key}" expects ${typeof DEFAULT_SETTINGS[key]}`);
    if (this.values[key] === value) return;
    this.values[key] = value;
    storageSet(this.values);
    bus.emit('settings:changed', { key, value, settings: this.all() });
  }
  reset() {
    this.values = { ...DEFAULT_SETTINGS };
    storageSet(this.values);
    for (const key of Object.keys(DEFAULT_SETTINGS)) bus.emit('settings:changed', { key, value: this.values[key], settings: this.all() });
  }
}

export const Settings = new SettingsStore();
