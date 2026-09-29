/* =====================================================================
   EMPIRE CONQUEST — audio
   Everything is synthesised with the Web Audio API: an original,
   generative medieval-modal soundtrack (D Dorian: drone, pad, lute-like
   plucks and a frame drum) and all sound effects. Off by default.
   ===================================================================== */
'use strict';

const Sound = {
  ctx: null, master: null, music: null, sfx: null, noiseBuf: null,
  settings: { audio: false, master: 0.7, music: 0.5, sfx: 0.8 },
  playing: false, timer: null, nextTime: 0, step: 0, motif: null,

  init(settings) { this.settings = settings; },

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      // gentle reverb-ish echo for the music
      const delay = this.ctx.createDelay(1);
      delay.delayTime.value = 0.33;
      const fb = this.ctx.createGain(); fb.gain.value = 0.28;
      const wet = this.ctx.createGain(); wet.gain.value = 0.22;
      this.music.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.master);
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.audio ? s.master : 0, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
  },

  setEnabled(on) {
    this.settings.audio = on;
    if (on) { if (!this.ensure()) return; this.applyVolumes(); this.startMusic(); }
    else { this.applyVolumes(); this.stopMusic(); }
  },

  /* ---------- primitives ---------- */
  tone(freq, dur, { type = 'sine', vol = 0.2, when = 0, attack = 0.005, release = null, dest = null, slide = null, filter = null, detune = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    o.detune.value = detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (release || dur));
    let node = o;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7;
      o.connect(f); node = f;
    }
    node.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + (release || dur) + 0.05);
  },
  noise(dur, { vol = 0.2, when = 0, freq = 1200, q = 1, type = 'bandpass', dest = null, attack = 0.002 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  },

  /* ---------- sound effects ---------- */
  play(name) {
    if (!this.settings.audio || !this.ctx) return;
    try {
      switch (name) {
        case 'click': this.tone(900, 0.06, { slide: 650, vol: 0.08, type: 'triangle' }); break;
        case 'open': this.tone(520, 0.09, { slide: 780, vol: 0.07, type: 'triangle' }); break;
        case 'close': this.tone(700, 0.08, { slide: 480, vol: 0.06, type: 'triangle' }); break;
        case 'error': this.tone(180, 0.18, { type: 'square', vol: 0.05, filter: { freq: 900 } }); this.tone(150, 0.2, { type: 'square', vol: 0.05, when: 0.09, filter: { freq: 900 } }); break;
        case 'coin': this.tone(1318, 0.12, { type: 'triangle', vol: 0.1 }); this.tone(1760, 0.25, { type: 'triangle', vol: 0.1, when: 0.07 }); break;
        case 'notify': this.tone(988, 0.5, { vol: 0.08 }); this.tone(1318, 0.7, { vol: 0.07, when: 0.1 }); break;
        case 'alert': this.tone(392, 0.18, { type: 'square', vol: 0.05, filter: { freq: 1400 } }); this.tone(311, 0.3, { type: 'square', vol: 0.05, when: 0.2, filter: { freq: 1400 } }); break;
        case 'build':
          for (let i = 0; i < 3; i++) { this.noise(0.07, { vol: 0.25, when: i * 0.16, freq: 1800, q: 2 }); this.tone(140, 0.08, { vol: 0.12, when: i * 0.16, slide: 70 }); }
          break;
        case 'march':
          for (let i = 0; i < 3; i++) this.drum(i * 0.2, 0.22);
          break;
        case 'war':
          this.tone(110, 1.4, { type: 'sawtooth', vol: 0.09, attack: 0.25, filter: { freq: 600 } });
          this.tone(165, 1.2, { type: 'sawtooth', vol: 0.06, attack: 0.3, when: 0.15, filter: { freq: 700 } });
          this.drum(0, 0.4); this.drum(0.45, 0.35);
          break;
        case 'battle':
          for (let i = 0; i < 5; i++) {
            const w = i * 0.13 + Math.random() * 0.05;
            this.noise(0.12, { vol: 0.22, when: w, freq: 2500 + Math.random() * 1500, q: 3 });
            for (const f of [1210, 1873, 2461]) this.tone(f * (0.95 + Math.random() * 0.1), 0.25, { vol: 0.025, when: w, type: 'sine' });
          }
          this.drum(0, 0.4);
          break;
        case 'fanfare': {
          const notes = [587.3, 740, 880, 1174.7];
          notes.forEach((f, i) => this.tone(f, i === 3 ? 0.9 : 0.22, { type: 'sawtooth', vol: 0.07, when: i * 0.13, attack: 0.02, filter: { freq: 2200 } }));
          this.tone(293.7, 1.1, { type: 'sawtooth', vol: 0.05, when: 0.39, attack: 0.03, filter: { freq: 900 } });
          break;
        }
        case 'conquest': {
          const notes = [440, 554.4, 659.3, 880, 659.3, 880];
          const times = [0, 0.12, 0.24, 0.36, 0.6, 0.72];
          notes.forEach((f, i) => this.tone(f, i === 5 ? 1.1 : 0.2, { type: 'sawtooth', vol: 0.075, when: times[i], attack: 0.02, filter: { freq: 2400 } }));
          this.drum(0, 0.4); this.drum(0.36, 0.35); this.drum(0.72, 0.45);
          break;
        }
        case 'defeat': {
          [392, 349.2, 311.1, 293.7].forEach((f, i) => this.tone(f, i === 3 ? 1.2 : 0.35, { type: 'sawtooth', vol: 0.06, when: i * 0.3, filter: { freq: 1000 } }));
          break;
        }
      }
    } catch (e) { /* audio is best-effort */ }
  },
  drum(when, vol, dest) {
    this.tone(120, 0.35, { vol, when, slide: 45, dest });
    this.noise(0.08, { vol: vol * 0.35, when, freq: 400, q: 0.8, dest });
  },

  /* ---------- generative music ---------- */
  startMusic() {
    if (this.playing || !this.ctx) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 60);
  },
  stopMusic() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },
  schedule() {
    if (!this.playing || !this.ctx) return;
    const c = this.ctx;
    const eighth = 60 / 76 / 2;
    // D dorian chord progression (8 bars of 8 eighths)
    const prog = [
      [146.8, 174.6, 220.0], [130.8, 164.8, 196.0], [98.0, 123.5, 146.8], [146.8, 174.6, 220.0],
      [174.6, 220.0, 261.6], [130.8, 164.8, 196.0], [98.0, 123.5, 146.8], [110.0, 138.6, 164.8],
    ];
    const scale = [293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.3, 587.3, 659.3];
    while (this.nextTime < c.currentTime + 0.25) {
      const st = this.step;
      const bar = Math.floor(st / 8) % prog.length, beat = st % 8;
      const when = this.nextTime - c.currentTime;
      const chord = prog[bar];
      if (beat === 0) {
        // pad + drone
        for (const f of chord) this.tone(f, eighth * 8.4, { type: 'triangle', vol: 0.035, when, attack: 0.6, release: eighth * 8.6, dest: this.music, detune: (Math.random() - 0.5) * 8 });
        this.tone(chord[0] / 2, eighth * 8.2, { type: 'sine', vol: 0.05, when, attack: 0.4, dest: this.music });
        if (bar % 4 === 0 || !this.motif) this.motif = this.makeMotif(scale);
      }
      // frame drum
      if (beat === 0 || beat === 4) this.drum(when, beat === 0 ? 0.09 : 0.06, this.music);
      if (beat === 6 && Math.random() < 0.5) this.drum(when, 0.035, this.music);
      if (beat % 2 === 1) this.noise(0.04, { vol: 0.012, when, freq: 6000, q: 1, dest: this.music });
      // melody (lute pluck)
      const n = this.motif[(st + (bar % 2) * 3) % this.motif.length];
      if (n >= 0 && !(bar === 7 && beat > 4)) {
        const f = scale[n] * (bar >= 4 && bar < 6 ? 1 : 1);
        this.tone(f, eighth * 1.6, { type: 'triangle', vol: 0.05, when, attack: 0.004, release: eighth * 2.2, dest: this.music });
        this.tone(f * 2, eighth * 0.6, { type: 'sine', vol: 0.012, when, attack: 0.003, dest: this.music });
      }
      this.nextTime += eighth;
      this.step++;
    }
  },
  makeMotif(scale) {
    const m = [];
    let n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < 16; i++) {
      if (Math.random() < 0.32) { m.push(-1); continue; }
      n = clamp(n + Math.floor(Math.random() * 5) - 2, 0, scale.length - 1);
      m.push(n);
    }
    return m;
  },
};
