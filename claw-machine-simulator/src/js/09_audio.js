/* =====================================================================
   CLAW MACHINE SIMULATOR — audio
   Every sound is synthesised with WebAudio (oscillators, a noise buffer,
   gain envelopes, filters). Public API: Sfx (see ARCHITECTURE.md section 6).
   Private top-level names use the _au prefix. Nothing runs at load time.
   ===================================================================== */

const _auMaxVoices = 24;
const _auGestureEvents = ['pointerdown', 'keydown', 'touchstart'];

/** MIDI note number -> Hz. */
const _auHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* Generative background music per world. Degrees index into `scale`;
   `prog` gives one scale degree per bar (16 sixteenth-note steps). */
const _auWorldMusic = {
  starter: { bpm: 124, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], offs: [0, 2, 4, 2, 5], density: 0.45, lead: 'pluck', leadVol: 0.07, bass: 'triangle', bassVol: 0.11 },
  jungle: { bpm: 104, root: 57, scale: [0, 2, 4, 7, 9], prog: [0, 3, 0, 4], offs: [0, 1, 2, 3, 4], density: 0.5, lead: 'marimba', leadVol: 0.12, bass: 'triangle', bassVol: 0.1 },
  frozen: { bpm: 70, root: 62, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 4, 3, 0], offs: [0, 2, 4, 6], density: 0.25, lead: 'bell', leadVol: 0.07, bass: 'sine', bassVol: 0.1 },
  desert: { bpm: 96, root: 52, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], offs: [0, 1, 3, 4], density: 0.4, lead: 'pluck', leadWave: 'sawtooth', leadLp: 1400, leadVol: 0.06, bass: 'triangle', bassVol: 0.1 },
  space: { bpm: 80, root: 57, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 5, 3, 6], offs: [0, 2, 4, 6], density: 0.3, lead: 'soft', leadVol: 0.05, pad: true, bass: 'sine', bassVol: 0.12 },
};

/* ---------- low-level synthesis helpers ---------- */

/** Track a playing source so the voice cap works and nodes are released when it ends. */
function _auTrack(src, nodes) {
  Sfx._voices++;
  src.onended = () => {
    Sfx._voices--;
    for (const n of nodes) { try { n.disconnect(); } catch (e) { /* already gone */ } }
  };
}

/** One oscillator with a gain envelope. o: { type, f, to, dur, vol, att, lp } */
function _auBeep(c, out, t, o) {
  if (Sfx._voices > 40) return;
  const att = o.att || 0.006;
  const v = o.vol == null ? 0.2 : o.vol;
  const src = c.createOscillator();
  const g = c.createGain();
  src.type = o.type || 'triangle';
  src.frequency.setValueAtTime(o.f, t);
  if (o.to) src.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  const nodes = [src, g];
  src.connect(g);
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = 0.7;
    g.connect(f); f.connect(out); nodes.push(f);
  } else {
    g.connect(out);
  }
  src.start(t);
  src.stop(t + o.dur + 0.03);
  _auTrack(src, nodes);
}

/** Filtered noise burst. o: { type, f, to, q, dur, vol } */
function _auNoise(c, out, t, o) {
  if (Sfx._voices > 40 || !Sfx._nbuf) return;
  const src = c.createBufferSource();
  src.buffer = Sfx._nbuf;
  src.loop = true;
  const flt = c.createBiquadFilter();
  flt.type = o.type || 'bandpass';
  flt.frequency.setValueAtTime(o.f, t);
  if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  flt.Q.value = o.q || 1;
  const g = c.createGain();
  const v = o.vol == null ? 0.1 : o.vol;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(flt); flt.connect(g); g.connect(out);
  src.start(t, Math.random() * 0.8);
  src.stop(t + o.dur + 0.03);
  _auTrack(src, [src, flt, g]);
}

/** Notes in quick succession. */
function _auArp(c, out, t, ms, step, o) {
  ms.forEach((m, i) => _auBeep(c, out, t + i * step, Object.assign({ type: 'triangle', f: _auHz(m), dur: 0.2, vol: 0.15 }, o)));
}

/** Notes sounding together. */
function _auChord(c, out, t, ms, dur, o) {
  for (const m of ms) _auBeep(c, out, t, Object.assign({ type: 'triangle', f: _auHz(m), dur, vol: 0.1 }, o));
}

/** Bright little bell: triangle plus a quiet octave-up sine. */
function _auDing(c, out, t, m, dur, vol) {
  _auBeep(c, out, t, { type: 'triangle', f: _auHz(m), dur, vol });
  _auBeep(c, out, t, { type: 'sine', f: _auHz(m) * 2, dur: dur * 0.6, vol: vol * 0.25 });
}

function _auNoiseBuffer(c) {
  const len = c.sampleRate;
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** Smooth parameter change (avoids clicks). */
function _auRamp(c, param, v) {
  try { param.cancelScheduledValues(c.currentTime); param.setTargetAtTime(v, c.currentTime, 0.05); } catch (e) { /* ignore */ }
}

/* ---------- sound effects: (ctx, out, startTime) ---------- */
const _auSounds = {
  click: (c, o, t) => _auBeep(c, o, t, { type: 'square', f: 1800, to: 900, dur: 0.03, vol: 0.05, lp: 3000 }),
  open: (c, o, t) => _auArp(c, o, t, [76, 83], 0.07, { dur: 0.12, vol: 0.16 }),
  close: (c, o, t) => _auArp(c, o, t, [83, 76], 0.07, { dur: 0.12, vol: 0.16 }),
  coin: (c, o, t) => {
    _auDing(c, o, t, 88, 0.3, 0.2);
    _auDing(c, o, t + 0.075, 93, 0.35, 0.2);
  },
  gem: (c, o, t) => {
    _auArp(c, o, t, [84, 88, 91, 96, 100], 0.045, { type: 'sine', dur: 0.25, vol: 0.14 });
    _auNoise(c, o, t, { type: 'highpass', f: 8000, dur: 0.2, vol: 0.02 });
  },
  strength: (c, o, t) => {
    _auBeep(c, o, t, { type: 'sine', f: 280, to: 620, dur: 0.14, vol: 0.25 });
    _auNoise(c, o, t, { type: 'bandpass', f: 900, q: 2, dur: 0.05, vol: 0.08 });
  },
  play: (c, o, t) => {
    _auNoise(c, o, t, { type: 'highpass', f: 4000, dur: 0.02, vol: 0.12 });
    _auBeep(c, o, t + 0.03, { type: 'sine', f: 2000, to: 1500, dur: 0.08, vol: 0.15 });
    _auArp(c, o, t + 0.2, [72, 76, 79, 84], 0.1, { dur: 0.3, vol: 0.17 });
  },
  move: (c, o, t) => _auBeep(c, o, t, { type: 'sine', f: 1200, dur: 0.02, vol: 0.07 }),
  drop: (c, o, t) => {
    _auNoise(c, o, t, { type: 'bandpass', f: 2400, to: 250, q: 1.2, dur: 0.5, vol: 0.14 });
    _auBeep(c, o, t, { type: 'sine', f: 520, to: 140, dur: 0.5, vol: 0.1 });
  },
  grab: (c, o, t) => {
    _auNoise(c, o, t, { type: 'highpass', f: 1400, dur: 0.035, vol: 0.25 });
    _auBeep(c, o, t, { type: 'square', f: 190, to: 95, dur: 0.06, vol: 0.08, lp: 900 });
    _auBeep(c, o, t + 0.05, { type: 'square', f: 260, to: 130, dur: 0.05, vol: 0.06, lp: 900 });
  },
  slip: (c, o, t) => _auBeep(c, o, t, { type: 'triangle', f: 1300, to: 260, dur: 0.6, vol: 0.16 }),
  miss: (c, o, t) => {
    // sad "wah-wah"
    _auBeep(c, o, t, { type: 'sawtooth', f: 392, dur: 0.28, vol: 0.1, lp: 900 });
    _auBeep(c, o, t + 0.3, { type: 'sawtooth', f: 349, dur: 0.28, vol: 0.1, lp: 900 });
    _auBeep(c, o, t + 0.6, { type: 'sawtooth', f: 330, to: 262, dur: 0.7, vol: 0.1, lp: 900 });
  },
  win: (c, o, t) => {
    _auArp(c, o, t, [60, 64, 67, 72], 0.11, { dur: 0.2, vol: 0.2 });
    _auChord(c, o, t + 0.44, [72, 76, 79, 84], 0.7, { vol: 0.14 });
  },
  rare: (c, o, t) => {
    _auChord(c, o, t, [72, 76, 79], 0.9, { type: 'sine', att: 0.03, vol: 0.1 });
    _auArp(c, o, t, [91, 96, 100, 103], 0.05, { type: 'sine', dur: 0.3, vol: 0.08 });
    _auNoise(c, o, t, { type: 'highpass', f: 6000, dur: 0.8, vol: 0.03 });
  },
  epic: (c, o, t) => {
    _auChord(c, o, t, [72, 76, 79, 84], 1.2, { type: 'sine', att: 0.03, vol: 0.11 });
    _auArp(c, o, t, [84, 88, 91, 96, 100, 103], 0.06, { type: 'sine', dur: 0.3, vol: 0.09 });
    _auNoise(c, o, t, { type: 'highpass', f: 6000, dur: 1.0, vol: 0.035 });
  },
  legendary: (c, o, t) => {
    const br = { type: 'sawtooth', lp: 1700, vol: 0.11 };
    _auBeep(c, o, t, Object.assign({ f: _auHz(67), dur: 0.12 }, br));
    _auBeep(c, o, t + 0.12, Object.assign({ f: _auHz(67), dur: 0.12 }, br));
    _auBeep(c, o, t + 0.24, Object.assign({ f: _auHz(67), dur: 0.12 }, br));
    _auBeep(c, o, t + 0.36, Object.assign({ f: _auHz(72), dur: 0.45 }, br));
    _auBeep(c, o, t + 0.36, { type: 'sawtooth', f: _auHz(48), dur: 1.8, vol: 0.1, lp: 500 });
    _auBeep(c, o, t + 0.85, Object.assign({ f: _auHz(71), dur: 0.12 }, br));
    _auBeep(c, o, t + 0.97, Object.assign({ f: _auHz(72), dur: 0.9 }, br));
    _auChord(c, o, t + 0.97, [60, 64, 67, 72], 1.0, { type: 'sine', vol: 0.07 });
    _auArp(c, o, t + 0.97, [84, 88, 91, 96], 0.07, { type: 'sine', dur: 0.3, vol: 0.09 });
  },
  mythical: (c, o, t) => {
    // magical swelling chord with sparkles
    _auChord(c, o, t, [60, 64, 67, 71, 74], 1.6, { type: 'sine', att: 0.6, vol: 0.12 });
    _auChord(c, o, t, [48, 55], 1.6, { type: 'sawtooth', att: 0.6, vol: 0.05, lp: 800 });
    _auArp(c, o, t + 0.5, [96, 100, 103, 107, 108, 103, 100], 0.12, { type: 'sine', dur: 0.2, vol: 0.1 });
    _auNoise(c, o, t, { type: 'highpass', f: 7000, dur: 1.4, vol: 0.03 });
  },
  secret: (c, o, t) => {
    // dark minor chord resolving to a bright major one
    _auChord(c, o, t, [50, 53, 57], 0.55, { type: 'sawtooth', att: 0.08, vol: 0.07, lp: 700 });
    _auChord(c, o, t + 0.55, [62, 66, 69, 74], 0.9, { type: 'triangle', att: 0.01, vol: 0.12 });
    _auArp(c, o, t + 0.6, [86, 90, 93], 0.08, { type: 'sine', dur: 0.25, vol: 0.09 });
  },
  reveal: (c, o, t) => {
    _auNoise(c, o, t, { type: 'bandpass', f: 400, to: 3000, q: 1.5, dur: 0.3, vol: 0.12 });
    _auBeep(c, o, t + 0.27, { type: 'sine', f: 500, to: 1000, dur: 0.12, vol: 0.22 });
  },
  capsule: (c, o, t) => {
    // rattle: a quick run of random clicks
    for (let i = 0; i < 8; i++) {
      const at = t + i * 0.045 + Math.random() * 0.01;
      _auNoise(c, o, at, { type: 'bandpass', f: 2500 + Math.random() * 1500, q: 3, dur: 0.03, vol: 0.15 });
    }
  },
  upgrade: (c, o, t) => {
    _auBeep(c, o, t, { type: 'square', f: 300, to: 1200, dur: 0.35, vol: 0.1, lp: 2500 });
    _auArp(c, o, t + 0.3, [72, 76, 79, 84, 88], 0.06, { dur: 0.2, vol: 0.16 });
  },
  train: (c, o, t) => {
    // grunt-like thump plus a pop
    _auBeep(c, o, t, { type: 'sawtooth', f: 180, to: 70, dur: 0.18, vol: 0.22, lp: 600 });
    _auNoise(c, o, t, { type: 'bandpass', f: 700, q: 1, dur: 0.1, vol: 0.14 });
    _auBeep(c, o, t + 0.12, { type: 'sine', f: 600, to: 1300, dur: 0.08, vol: 0.16 });
  },
  error: (c, o, t) => {
    _auBeep(c, o, t, { type: 'sawtooth', f: 110, dur: 0.32, vol: 0.16, lp: 420 });
    _auBeep(c, o, t, { type: 'square', f: 116.5, dur: 0.32, vol: 0.06, lp: 420 });
    _auBeep(c, o, t + 0.36, { type: 'sawtooth', f: 98, dur: 0.25, vol: 0.12, lp: 420 });
  },
  unlock: (c, o, t) => {
    _auArp(c, o, t, [60, 64, 67, 72, 76, 79, 84], 0.065, { dur: 0.18, vol: 0.16 });
    _auChord(c, o, t + 0.5, [72, 76, 79, 84], 1.0, { vol: 0.1 });
    _auArp(c, o, t + 0.5, [96, 100, 103, 108], 0.08, { type: 'sine', dur: 0.3, vol: 0.09 });
    _auNoise(c, o, t + 0.5, { type: 'highpass', f: 7000, dur: 0.5, vol: 0.05 });
  },
  travel: (c, o, t) => {
    // warp sweep
    _auBeep(c, o, t, { type: 'sine', f: 80, to: 1600, dur: 0.75, vol: 0.22, att: 0.1 });
    _auBeep(c, o, t, { type: 'triangle', f: 160, to: 3200, dur: 0.75, vol: 0.05 });
    _auNoise(c, o, t, { type: 'bandpass', f: 500, to: 6000, q: 2, dur: 0.7, vol: 0.1 });
  },
  equip: (c, o, t) => {
    _auBeep(c, o, t, { type: 'sine', f: 400, to: 800, dur: 0.12, vol: 0.2 });
    _auNoise(c, o, t, { type: 'bandpass', f: 1200, dur: 0.04, vol: 0.06 });
  },
  sell: (c, o, t) => {
    // cash register "ka-ching"
    _auNoise(c, o, t, { type: 'highpass', f: 2500, dur: 0.02, vol: 0.12 });
    _auDing(c, o, t + 0.04, 96, 0.5, 0.14);
    _auDing(c, o, t + 0.1, 103, 0.45, 0.12);
  },
  evolve: (c, o, t) => {
    // rising magical sweep
    _auBeep(c, o, t, { type: 'sine', f: 200, to: 1600, dur: 0.9, vol: 0.16, att: 0.05 });
    _auBeep(c, o, t, { type: 'triangle', f: 300, to: 2400, dur: 0.9, vol: 0.05 });
    _auArp(c, o, t + 0.4, [84, 88, 91, 96, 100], 0.09, { type: 'sine', dur: 0.25, vol: 0.1 });
    _auChord(c, o, t + 0.95, [72, 76, 79, 84], 0.8, { vol: 0.1 });
  },
  tick: (c, o, t) => _auBeep(c, o, t, { type: 'sine', f: 1000, dur: 0.05, vol: 0.12 }),
};

/* ---------- motor hum ---------- */
function _auMotorStart() {
  const c = Sfx._ctx;
  if (!c || Sfx._mot) return;
  const now = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(0, now);
  out.gain.linearRampToValueAtTime(0.08, now + 0.08);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 2.5;
  lp.connect(out); out.connect(Sfx._sfxG);
  const saw = c.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 92;
  const tri = c.createOscillator(); tri.type = 'triangle'; tri.frequency.value = 46;
  const tg = c.createGain(); tg.gain.value = 0.6;
  const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.5;
  const depth = c.createGain(); depth.gain.value = 5;
  lfo.connect(depth); depth.connect(saw.frequency);
  saw.connect(lp); tri.connect(tg); tg.connect(lp);
  saw.start(now); tri.start(now); lfo.start(now);
  Sfx._mot = { saw, tri, lfo, out, lp, depth, tg };
}

function _auMotorStop() {
  const c = Sfx._ctx;
  const m = Sfx._mot;
  if (!c || !m) return;
  Sfx._mot = null;
  const now = c.currentTime;
  m.out.gain.cancelScheduledValues(now);
  m.out.gain.setValueAtTime(m.out.gain.value, now);
  m.out.gain.linearRampToValueAtTime(0, now + 0.08);
  const end = now + 0.1;
  m.saw.stop(end); m.tri.stop(end); m.lfo.stop(end);
  m.saw.onended = () => {
    for (const k of ['saw', 'tri', 'lfo', 'depth', 'tg', 'lp', 'out']) { try { m[k].disconnect(); } catch (e) { /* ignore */ } }
  };
}

/* ---------- generative music ---------- */
function _auLead(c, out, t, cfg, f) {
  if (cfg.lead === 'marimba') {
    _auBeep(c, out, t, { type: 'sine', f, dur: 0.3, vol: cfg.leadVol, att: 0.004 });
    _auBeep(c, out, t, { type: 'sine', f: f * 4, dur: 0.08, vol: cfg.leadVol * 0.25, att: 0.002 });
  } else if (cfg.lead === 'bell') {
    _auBeep(c, out, t, { type: 'sine', f, dur: 1.4, vol: cfg.leadVol });
    _auBeep(c, out, t, { type: 'sine', f: f * 2.76, dur: 0.6, vol: cfg.leadVol * 0.3 });
  } else if (cfg.lead === 'soft') {
    _auBeep(c, out, t, { type: 'triangle', f, dur: 1.0, vol: cfg.leadVol, att: 0.08, lp: 1800 });
  } else {
    _auBeep(c, out, t, { type: cfg.leadWave || 'triangle', f, dur: 0.35, vol: cfg.leadVol, lp: cfg.leadLp || 3000 });
  }
}

/** One sixteenth-note step of a world's tune. */
function _auMusicStep(c, t, step, cfg, out) {
  const n = cfg.scale.length;
  const pitch = (idx) => cfg.root + cfg.scale[((idx % n) + n) % n] + 12 * Math.floor(idx / n);
  const sd = Sfx._mStepDur;
  const s16 = step % 16;
  const deg = cfg.prog[Math.floor(step / 16) % cfg.prog.length];
  if (s16 === 0 && cfg.pad) {
    for (const k of [0, 2, 4]) _auBeep(c, out, t, { type: 'sawtooth', f: _auHz(pitch(deg + k)), dur: sd * 16, att: 0.5, vol: 0.03, lp: 900 });
  }
  if (s16 % 8 === 0) {
    _auBeep(c, out, t, { type: cfg.bass, f: _auHz(pitch(deg) - 12), dur: sd * 6, vol: cfg.bassVol, att: 0.01 });
  }
  if (s16 % 2 === 0 && Sfx._voices < 16 && Math.random() < cfg.density) {
    _auLead(c, out, t, cfg, _auHz(pitch(deg + pick(cfg.offs)) + 12));
  }
}

function _auMusicTick() {
  const c = Sfx._ctx;
  if (!c || !Sfx._mLayer || !Sfx._mCfg) return;
  if (c.currentTime > Sfx._mNext + 0.5) Sfx._mNext = c.currentTime + 0.05; // woke up late
  while (Sfx._mNext < c.currentTime + 0.25) {
    _auMusicStep(c, Sfx._mNext, Sfx._mStep, Sfx._mCfg, Sfx._mLayer);
    Sfx._mNext += Sfx._mStepDur;
    Sfx._mStep++;
  }
}

/** Starts or stops the lookahead scheduler to match the current state. */
function _auMusicRun() {
  const c = Sfx._ctx;
  const want = !!(c && Sfx._music && Sfx._mLayer);
  if (want && !Sfx._mTimer) {
    Sfx._mNext = c.currentTime + 0.1;
    Sfx._mTimer = setInterval(_auMusicTick, 100);
  } else if (!want && Sfx._mTimer) {
    clearInterval(Sfx._mTimer);
    Sfx._mTimer = null;
  }
}

/** Starts a world's layer and crossfades from the previous one. */
function _auMusicBegin(key) {
  const c = Sfx._ctx;
  if (!c) return;
  const cfg = _auWorldMusic[key] || _auWorldMusic.starter;
  const now = c.currentTime;
  const old = Sfx._mLayer;
  if (old) {
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(old.gain.value, now);
    old.gain.linearRampToValueAtTime(0, now + 1.2);
    setTimeout(() => { try { old.disconnect(); } catch (e) { /* ignore */ } }, 1500);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(1, now + 1.2);
  g.connect(Sfx._musicG);
  Sfx._mLayer = g;
  Sfx._mCfg = cfg;
  Sfx._mKey = key;
  Sfx._mStepDur = 60 / cfg.bpm / 4;
  Sfx._mStep = 0;
  Sfx._mNext = now + 0.12;
  _auMusicRun();
}

/* ---------- context creation / visibility / gestures ---------- */
function _auEnsureCtx() {
  if (Sfx._ctx) {
    if (Sfx._ctx.state === 'suspended' && !document.hidden) Sfx._ctx.resume().catch(() => {});
    return true;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  let c;
  try { c = new AC(); } catch (e) { return false; }
  Sfx._readSettings();
  const master = c.createGain();
  master.gain.value = Sfx._volume;
  master.connect(c.destination);
  const sfxG = c.createGain();
  sfxG.gain.value = Sfx._sound ? 0.9 : 0;
  sfxG.connect(master);
  const musicG = c.createGain();
  musicG.gain.value = Sfx._music ? 0.25 : 0;
  musicG.connect(master);
  Sfx._ctx = c;
  Sfx._master = master;
  Sfx._sfxG = sfxG;
  Sfx._musicG = musicG;
  Sfx._nbuf = _auNoiseBuffer(c);
  if (document.hidden) c.suspend().catch(() => {});
  if (Sfx._motorWant) _auMotorStart();
  if (Sfx._mWorld) _auMusicBegin(Sfx._mWorld);
  _auMusicRun();
  return true;
}

function _auOnGesture() {
  if (!_auEnsureCtx()) return;
  for (const ev of _auGestureEvents) window.removeEventListener(ev, _auOnGesture);
}

function _auOnVisibility() {
  const c = Sfx._ctx;
  if (!c) return;
  if (document.hidden) {
    if (c.state === 'running') c.suspend().catch(() => {});
  } else if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }
}

const Sfx = {
  _ctx: null, _master: null, _sfxG: null, _musicG: null, _nbuf: null,
  _sound: true, _music: true, _volume: 0.8,
  _inited: false, _entered: false,
  _motorWant: false, _mot: null,
  _mWorld: null, _mKey: null, _mLayer: null, _mCfg: null,
  _mStepDur: 0.1, _mStep: 0, _mNext: 0, _mTimer: null,
  _voices: 0, _last: {},

  /** Reads settings, arms the first-gesture unlock and subscribes to Bus events. Safe to call once. */
  init() {
    if (this._inited) return;
    this._inited = true;
    this._readSettings();
    for (const ev of _auGestureEvents) window.addEventListener(ev, _auOnGesture, { passive: true });
    document.addEventListener('visibilitychange', _auOnVisibility);

    Bus.on('claw:result', (d) => {
      const t = d && d.type;
      if (t === 'win') Sfx.play('win');
      else if (t === 'miss' || t === 'empty') Sfx.play('miss');
      else if (t === 'slip') Sfx.play('slip');
    });
    Bus.on('upgrade:bought', () => Sfx.play('upgrade'));
    Bus.on('world:unlocked', () => Sfx.play('unlock'));
    Bus.on('world:entered', (d) => {
      if (Sfx._entered) Sfx.play('travel');
      Sfx._entered = true;
      Sfx.startMusic(d && d.id);
    });
    Bus.on('train:rep', (d) => { if (d && !d.auto) Sfx.play('train'); });
    Bus.on('equip:changed', () => Sfx.play('equip'));
    Bus.on('shop:bought', () => Sfx.play('gem'));
    Bus.on('daily:claimed', () => Sfx.play('gem'));
    Bus.on('index:claimed', () => Sfx.play('gem'));
    Bus.on('toast', (d) => { if (d && d.kind === 'bad') Sfx.play('error'); });
    Bus.on('settings:changed', (d) => {
      if (!d) return;
      if (d.key === 'sound') Sfx.setSound(d.value);
      else if (d.key === 'music') Sfx.setMusic(d.value);
      else if (d.key === 'volume') Sfx.setVolume(d.value);
    });
  },

  /** Copies sound/music/volume from Game.player.settings (no-op when not loaded yet). */
  _readSettings() {
    try {
      const s = Game.player && Game.player.settings;
      if (!s) return;
      if (typeof s.sound === 'boolean') this._sound = s.sound;
      if (typeof s.music === 'boolean') this._music = s.music;
      if (isNum(s.volume)) this._volume = clamp(s.volume, 0, 1);
    } catch (e) { /* settings unreadable: keep defaults */ }
  },

  /** Plays a one-shot sound by name. Unknown names, sound off, no context yet: no-op. */
  play(name) {
    if (!Object.prototype.hasOwnProperty.call(_auSounds, name)) return;
    const c = this._ctx;
    if (!c || !this._sound || document.hidden || c.state !== 'running') return;
    const now = performance.now();
    const last = this._last[name];
    if (last !== undefined && now - last < 40) return;
    this._last[name] = now;
    if (this._voices >= _auMaxVoices) return;
    try { _auSounds[name](c, this._sfxG, c.currentTime + 0.01); } catch (e) { console.warn('[Sfx]', name, e); }
  },

  /** Claw motor hum loop. Idempotent; fades in/out over ~80 ms. */
  motor(on) {
    this._motorWant = !!on;
    if (!this._ctx) return;
    if (on) _auMotorStart(); else _auMotorStop();
  },

  /** Crossfades to the generative tune of a world. Remembered until the context exists. */
  startMusic(worldId) {
    const key = Object.prototype.hasOwnProperty.call(_auWorldMusic, worldId) ? worldId : 'starter';
    if (this._mWorld === key && this._mLayer) return;
    this._mWorld = key;
    if (this._ctx) _auMusicBegin(key);
  },

  setSound(b) {
    this._sound = !!b;
    if (this._ctx) _auRamp(this._ctx, this._sfxG.gain, this._sound ? 0.9 : 0);
  },

  setMusic(b) {
    this._music = !!b;
    if (!this._ctx) return;
    _auRamp(this._ctx, this._musicG.gain, this._music ? 0.25 : 0);
    if (this._music && this._mWorld && !this._mLayer) _auMusicBegin(this._mWorld);
    _auMusicRun();
  },

  /** Master volume 0..1 (smooth ramp). */
  setVolume(v) {
    this._volume = clamp(isNum(v) ? v : 0.8, 0, 1);
    if (this._ctx) _auRamp(this._ctx, this._master.gain, this._volume);
  },
};
