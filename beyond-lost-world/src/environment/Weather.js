// Weather state machine: smooth transitions between clear / cloudy / rain / fog / storm,
// automatic changes with weighted randomness, gusty wind and lightning with delayed thunder.

export const WEATHER_TYPES = ['clear', 'cloudy', 'rain', 'fog', 'storm'];

const TARGETS = {
  clear:  { cloud: 0.30, overcast: 0.00, fog: 0.00, rain: 0.0, wind: 0.16, storm: 0 },
  cloudy: { cloud: 0.66, overcast: 0.35, fog: 0.06, rain: 0.0, wind: 0.34, storm: 0 },
  rain:   { cloud: 0.88, overcast: 0.72, fog: 0.38, rain: 0.8, wind: 0.50, storm: 0 },
  fog:    { cloud: 0.70, overcast: 0.40, fog: 1.00, rain: 0.0, wind: 0.07, storm: 0 },
  storm:  { cloud: 1.00, overcast: 0.96, fog: 0.50, rain: 1.0, wind: 0.95, storm: 1 },
};
// which states may follow which (weights)
const NEXT = {
  clear:  { clear: 0, cloudy: 5, rain: 1, fog: 1.2, storm: 0 },
  cloudy: { clear: 5, cloudy: 0, rain: 3, fog: 1, storm: 1 },
  rain:   { clear: 1, cloudy: 5, rain: 0, fog: 0.5, storm: 2.5 },
  fog:    { clear: 5, cloudy: 3, rain: 0.5, fog: 0, storm: 0 },
  storm:  { clear: 0, cloudy: 4, rain: 5, fog: 0, storm: 0 },
};
const KEYS = ['cloud', 'overcast', 'fog', 'rain', 'wind', 'storm'];

/**
 * @param {object} o
 * @param {(delay:number, intensity:number)=>void} o.onThunder called when lightning strikes (play thunder after delay seconds)
 */
export function createWeather({ onThunder = () => {} } = {}) {
  const values = { cloud: 0.3, overcast: 0, fog: 0, rain: 0, wind: 0.16, storm: 0, windNow: 0.16 };
  const w = {
    name: 'clear',
    values,
    flash: 0,
    hoursToChange: 3 + Math.random() * 3,
    autoChange: true,
  };
  let rate = 0.07;
  let lightningTimer = 8;
  let flashT = -1;
  let flashPattern = 0;
  let gustPhase = Math.random() * 100;

  w.set = (name, instant = false, fast = false) => {
    if (!TARGETS[name]) return;
    w.name = name;
    rate = fast ? 0.25 : 0.07;
    if (instant) { const t = TARGETS[name]; for (const k of KEYS) values[k] = t[k]; values.windNow = t.wind; }
    w.hoursToChange = 3 + Math.random() * 3.5;
  };

  const pickNext = (hour) => {
    const row = NEXT[w.name];
    let sum = 0;
    const weights = WEATHER_TYPES.map((n) => {
      let wt = row[n];
      if (n === 'fog' && hour > 4 && hour < 9) wt *= 3; // morning mist
      if (n === 'fog' && hour > 11 && hour < 18) wt *= 0.2;
      sum += wt; return wt;
    });
    let r = Math.random() * sum;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return WEATHER_TYPES[i]; }
    return 'clear';
  };

  /**
   * @param dt real seconds; @param dtHours game hours elapsed (0 when the clock is frozen); @param hour time of day
   */
  w.update = (dt, dtHours, hour) => {
    if (w.autoChange && dtHours > 0) {
      w.hoursToChange -= dtHours;
      if (w.hoursToChange <= 0) w.set(pickNext(hour));
    }
    const t = TARGETS[w.name];
    const k = 1 - Math.exp(-dt * rate);
    for (const key of KEYS) values[key] += (t[key] - values[key]) * k;
    // gusty wind
    gustPhase += dt;
    const g = Math.sin(gustPhase * 0.31) * Math.sin(gustPhase * 0.17 + 1.3) + 0.5 * Math.sin(gustPhase * 0.83);
    values.windNow = Math.min(1, Math.max(0, values.wind * (1 + 0.28 * g) + 0.03 * g));

    // lightning
    if (values.storm > 0.6) {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningTimer = 5 + Math.random() * 14;
        flashT = 0; flashPattern = Math.random();
        onThunder(0.4 + Math.random() * 3.6, 0.5 + Math.random() * 0.5);
      }
    }
    if (flashT >= 0) {
      flashT += dt;
      // double flash: sharp pulses at 0 and ~0.18 s, afterglow
      const p = (a, d) => Math.exp(-Math.pow((flashT - a) / d, 2));
      w.flash = Math.min(1, p(0.05, 0.04) * 1.0 + p(0.2, 0.06) * (0.5 + 0.5 * flashPattern) + p(0.35, 0.1) * 0.25);
      if (flashT > 0.8) { flashT = -1; w.flash = 0; }
    } else w.flash = 0;
  };

  return w;
}
