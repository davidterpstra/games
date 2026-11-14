// One-shot sound effects, all synthesised with WebAudio (oscillators + filtered noise).
// Every effect is a function (t, out, o) → duration in seconds. `out` is a GainNode owned by the call,
// `o` = { vol, rate (pitch multiplier), impact }. Nothing is allocated for longer than the sound lasts.

/** Builds the sfx table for an AudioContext. `core` = { ctx, noise: {white,pink,brown}, wet(out, amount) }. */
export function createSfx(core) {
  const { ctx, noise: B } = core;
  const R = (a, b) => a + Math.random() * (b - a);

  function env(out, t, dur, vol, atk = 0.004) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(vol, 0.0002), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    return g;
  }
  /** Oscillator voice with pitch glide + decay envelope. */
  function tone(out, { type = 'sine', f, f2, t, dur, vol = 0.3, atk = 0.004, detune = 0 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    o.detune.value = detune;
    o.connect(env(out, t, dur, vol, atk));
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  /** Filtered noise burst with sweep + decay envelope. */
  function puff(out, { buf = 'white', type = 'bandpass', f, f2, q = 1, t, dur, vol = 0.3, atk = 0.004 }) {
    const s = ctx.createBufferSource();
    s.buffer = B[buf]; s.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
    s.connect(flt); flt.connect(env(out, t, dur, vol, atk));
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  /** Inharmonic metallic ring (bell/clank). */
  function ring(out, t, base, vol, dur, ratios = [1, 1.59, 2.14, 2.92, 4.1]) {
    ratios.forEach((r, i) => tone(out, { f: base * r, t, dur: dur / (1 + i * 0.6), vol: vol / (1 + i * 0.7), atk: 0.001 }));
  }
  const sendWet = (out, amt) => core.wet(out, amt);
  const N = { C4: 261.63, E4: 329.63, G4: 392, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568 };

  /** Soft bell/pluck note: sine + overtone, long decay. */
  const chime = (out, t, f, vol, dur) => {
    tone(out, { f, t, dur, vol, atk: 0.006 });
    tone(out, { f: f * 2.01, t, dur: dur * 0.5, vol: vol * 0.28, atk: 0.004 });
    tone(out, { type: 'triangle', f: f * 0.5, t, dur: dur * 0.7, vol: vol * 0.25, atk: 0.01 });
  };

  const step = (type) => (t, out, o) => {
    const r = o.rate, v = o.vol;
    switch (type) {
      case 'grass':
        puff(out, { f: 1900 * r, q: 0.7, t, dur: 0.11, vol: 0.42 * v, atk: 0.012 });
        puff(out, { buf: 'brown', type: 'lowpass', f: 260 * r, t, dur: 0.1, vol: 0.55 * v, atk: 0.006 });
        return 0.2;
      case 'dirt':
        puff(out, { type: 'lowpass', f: 900 * r, t, dur: 0.1, vol: 0.5 * v, atk: 0.004 });
        puff(out, { buf: 'brown', type: 'lowpass', f: 200 * r, t, dur: 0.12, vol: 0.7 * v, atk: 0.004 });
        puff(out, { type: 'highpass', f: 3500, t: t + 0.02, dur: 0.04, vol: 0.12 * v, atk: 0.002 });
        return 0.22;
      case 'stone':
        puff(out, { f: 2600 * r, q: 1.4, t, dur: 0.05, vol: 0.5 * v, atk: 0.001 });
        tone(out, { f: 900 * r, f2: 600 * r, t, dur: 0.06, vol: 0.18 * v, atk: 0.001 });
        puff(out, { buf: 'brown', type: 'lowpass', f: 300, t, dur: 0.09, vol: 0.45 * v, atk: 0.002 });
        return 0.18;
      case 'wood':
        tone(out, { f: 190 * r, f2: 110 * r, t, dur: 0.14, vol: 0.5 * v, atk: 0.002 });
        puff(out, { f: 700 * r, q: 2, t, dur: 0.07, vol: 0.4 * v, atk: 0.001 });
        tone(out, { f: 410 * r, t, dur: 0.09, vol: 0.12 * v, atk: 0.001 });
        return 0.25;
      case 'metal':
        ring(out, t, 330 * r, 0.22 * v, 0.28);
        puff(out, { type: 'highpass', f: 3000, t, dur: 0.03, vol: 0.3 * v, atk: 0.001 });
        puff(out, { buf: 'brown', type: 'lowpass', f: 250, t, dur: 0.08, vol: 0.4 * v, atk: 0.002 });
        return 0.4;
      case 'water':
      default:
        puff(out, { f: 1400 * r, f2: 500, q: 0.8, t, dur: 0.32, vol: 0.5 * v, atk: 0.01 });
        puff(out, { type: 'highpass', f: 2500, t, dur: 0.18, vol: 0.2 * v, atk: 0.005 });
        for (let i = 0; i < 3; i++) tone(out, { f: R(500, 900), f2: R(1200, 1900), t: t + 0.04 + i * 0.05, dur: 0.07, vol: 0.07 * v });
        return 0.5;
    }
  };

  const lib = {
    pickup(t, out, o) {
      tone(out, { type: 'triangle', f: 620 * o.rate, f2: 940 * o.rate, t, dur: 0.14, vol: 0.28 });
      tone(out, { f: 1240 * o.rate, t: t + 0.07, dur: 0.22, vol: 0.2 });
      puff(out, { f: 3200, q: 1, t, dur: 0.1, vol: 0.12, atk: 0.01 });
      return 0.4;
    },
    craft(t, out) {
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.16;
        puff(out, { f: 900 + i * 60, q: 1.6, t: tt, dur: 0.06, vol: 0.5, atk: 0.001 });
        tone(out, { f: 170, f2: 90, t: tt, dur: 0.1, vol: 0.45, atk: 0.001 });
        ring(out, tt, 1200, 0.05, 0.15, [1, 2.4]);
      }
      chime(out, t + 0.5, N.E6, 0.16, 0.9);
      chime(out, t + 0.58, N.G6, 0.12, 0.9);
      sendWet(out, 0.2);
      return 1.6;
    },
    door_open(t, out) {
      puff(out, { buf: 'brown', type: 'lowpass', f: 300, t, dur: 0.15, vol: 0.4, atk: 0.003 });
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t + 0.06);
      o.frequency.linearRampToValueAtTime(150, t + 0.5);
      o.frequency.linearRampToValueAtTime(95, t + 1.0);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 17;
      const lg = ctx.createGain(); lg.gain.value = 9;
      lfo.connect(lg); lg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 5;
      f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1100, t + 0.5); f.frequency.linearRampToValueAtTime(600, t + 1.0);
      o.connect(f); f.connect(env(out, t + 0.06, 1.0, 0.35, 0.15));
      o.start(t + 0.06); o.stop(t + 1.15); lfo.start(t); lfo.stop(t + 1.15);
      puff(out, { buf: 'pink', type: 'lowpass', f: 400, t: t + 0.1, dur: 0.9, vol: 0.2, atk: 0.1 });
      puff(out, { buf: 'brown', type: 'lowpass', f: 200, t: t + 0.95, dur: 0.2, vol: 0.35, atk: 0.002 });
      return 1.3;
    },
    stone_grind(t, out) {
      const dur = 3.4;
      const s = ctx.createBufferSource(); s.buffer = B.brown; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(520, t + 1.2); f.frequency.linearRampToValueAtTime(240, t + dur);
      const g = env(out, t, dur, 1.4, 0.35);
      const am = ctx.createGain(); am.gain.value = 0.65;
      const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 6.5;
      const lg = ctx.createGain(); lg.gain.value = 0.35; lfo.connect(lg); lg.connect(am.gain);
      s.connect(f); f.connect(am); am.connect(g);
      s.start(t, 0); s.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
      puff(out, { buf: 'white', type: 'bandpass', f: 900, f2: 1300, q: 2.5, t, dur, vol: 0.14, atk: 0.4 });
      tone(out, { f: 46, f2: 38, t, dur, vol: 0.5, atk: 0.3 });
      tone(out, { type: 'triangle', f: 92, f2: 70, t, dur, vol: 0.12, atk: 0.4 });
      puff(out, { buf: 'brown', type: 'lowpass', f: 150, t: t + dur - 0.1, dur: 0.35, vol: 0.7, atk: 0.003 });
      sendWet(out, 0.25);
      return dur + 0.5;
    },
    metal_door(t, out) {
      ring(out, t, 150, 0.45, 0.9);
      puff(out, { type: 'highpass', f: 2500, t, dur: 0.06, vol: 0.35, atk: 0.001 });
      puff(out, { buf: 'brown', type: 'lowpass', f: 180, t, dur: 0.2, vol: 0.9, atk: 0.002 });
      // slide
      puff(out, { buf: 'pink', f: 500, f2: 1100, q: 4, t: t + 0.2, dur: 1.4, vol: 0.28, atk: 0.2 });
      tone(out, { type: 'sawtooth', f: 85, f2: 120, t: t + 0.2, dur: 1.4, vol: 0.07, atk: 0.3 });
      ring(out, t + 1.55, 190, 0.3, 0.8, [1, 1.5, 2.3, 3.7]);
      puff(out, { buf: 'brown', type: 'lowpass', f: 150, t: t + 1.55, dur: 0.25, vol: 0.7, atk: 0.002 });
      sendWet(out, 0.3);
      return 2.5;
    },
    lever(t, out) {
      ring(out, t, 420, 0.3, 0.35, [1, 1.7, 2.8]);
      puff(out, { buf: 'brown', type: 'lowpass', f: 220, t, dur: 0.12, vol: 0.6, atk: 0.002 });
      ring(out, t + 0.28, 250, 0.4, 0.5);
      puff(out, { type: 'highpass', f: 2500, t: t + 0.28, dur: 0.04, vol: 0.3, atk: 0.001 });
      puff(out, { buf: 'brown', type: 'lowpass', f: 160, t: t + 0.28, dur: 0.25, vol: 0.9, atk: 0.002 });
      return 1.0;
    },
    keycard_ok(t, out) {
      puff(out, { type: 'highpass', f: 3000, t, dur: 0.05, vol: 0.2 });
      tone(out, { type: 'square', f: 880, t: t + 0.08, dur: 0.1, vol: 0.09, atk: 0.003 });
      tone(out, { type: 'square', f: 1320, t: t + 0.19, dur: 0.22, vol: 0.09, atk: 0.003 });
      tone(out, { f: 1760, t: t + 0.19, dur: 0.3, vol: 0.07 });
      return 0.6;
    },
    keycard_denied(t, out) {
      for (let i = 0; i < 2; i++) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 150;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        const tt = t + 0.05 + i * 0.24;
        o.connect(f); f.connect(env(out, tt, 0.18, 0.28, 0.005));
        o.start(tt); o.stop(tt + 0.25);
      }
      return 0.6;
    },
    beacon(t, out) {
      puff(out, { f: 2000, q: 0.6, t, dur: 0.35, vol: 0.18, atk: 0.02 });
      for (let i = 0; i < 3; i++) {
        tone(out, { f: 520, f2: 1040, t: t + 0.25 + i * 0.5, dur: 0.38, vol: 0.2, atk: 0.01 });
        tone(out, { f: 1040, f2: 2080, t: t + 0.25 + i * 0.5, dur: 0.3, vol: 0.05, atk: 0.01 });
      }
      chime(out, t + 1.8, N.C6, 0.15, 1.4);
      chime(out, t + 1.9, N.G6, 0.1, 1.4);
      sendWet(out, 0.35);
      return 3.4;
    },
    discover(t, out) {
      [N.C5, N.E5, N.G5, N.B5, N.D6].forEach((f, i) => chime(out, t + i * 0.12, f, 0.2 - i * 0.015, 1.8));
      chime(out, t + 0.7, N.G6, 0.1, 2);
      sendWet(out, 0.5);
      return 3;
    },
    mission_complete(t, out) {
      const seq = [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5];
      seq.forEach((f, i) => chime(out, t + i * 0.1, f, 0.2, 2.2));
      [N.C5, N.E5, N.G5, N.C6].forEach((f) => chime(out, t + 0.75, f, 0.13, 3));
      tone(out, { type: 'triangle', f: N.C4 / 2, t: t + 0.5, dur: 3, vol: 0.18, atk: 0.1 });
      puff(out, { type: 'highpass', f: 5500, t: t + 0.75, dur: 1.5, vol: 0.05, atk: 0.2 });
      sendWet(out, 0.55);
      return 4;
    },
    objective(t, out) {
      chime(out, t, N.G5, 0.2, 1.1);
      chime(out, t + 0.14, N.D6, 0.22, 1.5);
      sendWet(out, 0.4);
      return 1.8;
    },
    ui_click(t, out) {
      tone(out, { type: 'triangle', f: 1500, f2: 900, t, dur: 0.045, vol: 0.22, atk: 0.001 });
      puff(out, { f: 3000, q: 1, t, dur: 0.02, vol: 0.12, atk: 0.001 });
      return 0.1;
    },
    ui_hover(t, out) { tone(out, { f: 2200, t, dur: 0.03, vol: 0.05, atk: 0.003 }); return 0.08; },
    ui_open(t, out) {
      puff(out, { f: 300, f2: 1800, q: 1.2, t, dur: 0.22, vol: 0.14, atk: 0.06 });
      tone(out, { f: 520, f2: 780, t, dur: 0.18, vol: 0.1, atk: 0.01 });
      return 0.35;
    },
    ui_close(t, out) {
      puff(out, { f: 1800, f2: 300, q: 1.2, t, dur: 0.2, vol: 0.12, atk: 0.03 });
      tone(out, { f: 780, f2: 480, t, dur: 0.16, vol: 0.09, atk: 0.005 });
      return 0.3;
    },
    error(t, out) {
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.13;
        tone(out, { type: 'square', f: 190, f2: 150, t: tt, dur: 0.11, vol: 0.12, atk: 0.003 });
      }
      return 0.35;
    },
    page(t, out) {
      for (let i = 0; i < 4; i++) puff(out, { type: 'highpass', f: 2500 + i * 400, t: t + i * 0.055 + Math.random() * 0.02, dur: 0.06 + Math.random() * 0.05, vol: 0.18, atk: 0.01 });
      puff(out, { buf: 'pink', f: 5000, q: 0.5, t, dur: 0.3, vol: 0.1, atk: 0.05 });
      return 0.45;
    },
    step_grass: step('grass'), step_dirt: step('dirt'), step_stone: step('stone'),
    step_wood: step('wood'), step_metal: step('metal'), step_water: step('water'),
    jump(t, out, o) {
      puff(out, { buf: 'pink', type: 'bandpass', f: 500, f2: 1400, q: 0.8, t, dur: 0.2, vol: 0.22 * o.vol, atk: 0.04 });
      puff(out, { buf: 'brown', type: 'lowpass', f: 250, t, dur: 0.08, vol: 0.25 * o.vol, atk: 0.003 });
      return 0.3;
    },
    land(t, out, o) {
      const k = Math.min(1.6, 0.5 + (o.impact || 0.4) * 0.6);
      puff(out, { buf: 'brown', type: 'lowpass', f: 300 * o.rate, t, dur: 0.22, vol: 0.9 * k * o.vol, atk: 0.002 });
      puff(out, { f: 1400, q: 0.7, t, dur: 0.1, vol: 0.3 * k * o.vol, atk: 0.002 });
      tone(out, { f: 110, f2: 55, t, dur: 0.18, vol: 0.5 * k * o.vol, atk: 0.002 });
      return 0.4;
    },
    boards_break(t, out) {
      const hits = [0, 0.06, 0.14, 0.27, 0.41];
      hits.forEach((d, i) => {
        const tt = t + d;
        puff(out, { f: 1100 + i * 250, q: 2.5, t: tt, dur: 0.09, vol: 0.55, atk: 0.001 });
        tone(out, { type: 'sawtooth', f: 160 + i * 40, f2: 80, t: tt, dur: 0.1, vol: 0.2, atk: 0.001 });
        puff(out, { type: 'highpass', f: 3500, t: tt, dur: 0.04, vol: 0.3, atk: 0.001 });
      });
      puff(out, { buf: 'brown', type: 'lowpass', f: 180, t, dur: 0.35, vol: 0.9, atk: 0.002 });
      for (let i = 0; i < 4; i++) tone(out, { f: R(300, 520), f2: R(150, 250), t: t + 0.5 + i * 0.07 + Math.random() * 0.05, dur: 0.09, vol: 0.18, atk: 0.001 });
      return 1.0;
    },
    torch_on(t, out) {
      puff(out, { type: 'highpass', f: 3000, t, dur: 0.03, vol: 0.2, atk: 0.001 });
      puff(out, { buf: 'pink', type: 'lowpass', f: 200, f2: 1800, q: 0.8, t: t + 0.03, dur: 0.45, vol: 0.55, atk: 0.1 });
      puff(out, { buf: 'brown', type: 'lowpass', f: 120, t: t + 0.05, dur: 0.4, vol: 0.5, atk: 0.12 });
      puff(out, { type: 'highpass', f: 4500, t: t + 0.1, dur: 0.4, vol: 0.07, atk: 0.1 });
      return 0.7;
    },
    torch_off(t, out) {
      puff(out, { type: 'highpass', f: 1800, f2: 4000, t, dur: 0.5, vol: 0.28, atk: 0.02 });
      puff(out, { buf: 'pink', type: 'lowpass', f: 900, f2: 150, t, dur: 0.35, vol: 0.35, atk: 0.02 });
      return 0.6;
    },
    power_on(t, out) {
      // contactor thunk, relays, rising generator spin, then a stable mains hum
      puff(out, { buf: 'brown', type: 'lowpass', f: 140, t, dur: 0.4, vol: 1.0, atk: 0.002 });
      ring(out, t, 110, 0.3, 0.5, [1, 1.7, 2.6]);
      for (let i = 0; i < 4; i++) puff(out, { type: 'highpass', f: 3500, t: t + 0.35 + i * 0.09 + Math.random() * 0.03, dur: 0.02, vol: 0.28, atk: 0.001 });
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(30, t + 0.3); o.frequency.exponentialRampToValueAtTime(100, t + 1.8);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(150, t + 0.3); f.frequency.exponentialRampToValueAtTime(1400, t + 1.8);
      o.connect(f); f.connect(env(out, t + 0.3, 2.2, 0.32, 0.8));
      o.start(t + 0.3); o.stop(t + 2.6);
      tone(out, { f: 300, f2: 2200, t: t + 0.5, dur: 1.5, vol: 0.05, atk: 0.6 });
      tone(out, { type: 'square', f: 50, t: t + 1.8, dur: 0.7, vol: 0.12, atk: 0.05 });
      tone(out, { f: 100, t: t + 1.8, dur: 0.7, vol: 0.1, atk: 0.05 });
      sendWet(out, 0.35);
      return 2.8;
    },
  };
  return lib;
}

export const SFX_NAMES = ['pickup', 'craft', 'door_open', 'stone_grind', 'metal_door', 'lever', 'keycard_ok', 'keycard_denied', 'beacon', 'discover', 'mission_complete', 'objective', 'ui_click', 'ui_hover', 'ui_open', 'ui_close', 'error', 'page', 'step_grass', 'step_dirt', 'step_stone', 'step_wood', 'step_metal', 'step_water', 'jump', 'land', 'boards_break', 'torch_on', 'torch_off', 'power_on'];
