/* =====================================================================
   AUDIO — everything is synthesised with WebAudio, so there are no
   asset files that can fail to load. Ambience (wind, water, birds,
   crickets, rain, village murmur), sfx, and a soft generative tune.
   ===================================================================== */
const Audio = {
  ctx: null, ok: false, master: null, sfxG: null, musG: null, ambG: null, noise: null, amb: {}, birdT: 2, crickT: 0, musT: 0, musStep: 0, chord: 0, waterT: 0, waterNear: 0, stepAlt: 0,
  unlock() {
    if (this.ok) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.connect(this.master);
      this.sfxG = c.createGain(); this.sfxG.connect(this.comp);
      this.musG = c.createGain(); this.musG.connect(this.comp);
      this.ambG = c.createGain(); this.ambG.connect(this.comp);
      // shared noise buffer
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
      this.noise = buf;
      // a small echo for the music
      this.delay = c.createDelay(1); this.delay.delayTime.value = 0.36; this.fb = c.createGain(); this.fb.gain.value = 0.28;
      this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.musG);
      // ambience beds
      this.amb.wind = this.bed('bandpass', 420, 0.6);
      this.amb.water = this.bed('lowpass', 650, 0.7);
      this.amb.rain = this.bed('highpass', 1400, 0.4);
      this.amb.murmur = this.bed('bandpass', 380, 3);
      this.ok = true;
      this.applyVolumes();
    } catch (e) { console.warn('Audio unavailable', e); }
  },
  bed(type, freq, q) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.ambG); src.start();
    return { f, g };
  },
  applyVolumes() {
    if (!this.ok || !S) return;
    const s = S.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.1);
    this.sfxG.gain.setTargetAtTime(s.sfx, t, 0.1);
    this.musG.gain.setTargetAtTime(s.music * 0.55, t, 0.1);
    this.ambG.gain.setTargetAtTime(s.amb, t, 0.1);
  },
  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, attack = 0.005, delay = 0, dest = null, release = null } = {}) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + (release || dur));
    o.connect(g); g.connect(dest || this.sfxG);
    o.start(t); o.stop(t + (release || dur) + 0.05);
  },
  hiss(dur, { type = 'bandpass', freq = 1000, q = 1, vol = 0.3, delay = 0, slide = 0, dest = null } = {}) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  sfx(name) {
    if (!this.ok) return;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'chop': this.tone(r(150, 190), 0.12, { type: 'triangle', vol: 0.45, slide: 0.5 }); this.hiss(0.09, { freq: 1800, q: 0.8, vol: 0.35 }); break;
      case 'mine': this.tone(r(900, 1200), 0.18, { type: 'square', vol: 0.08, slide: 0.9 }); this.tone(r(1800, 2300), 0.12, { vol: 0.12 }); this.hiss(0.06, { freq: 3000, vol: 0.25 }); break;
      case 'harvest': this.hiss(0.18, { freq: 2600, q: 1.2, vol: 0.3, slide: 0.5 }); this.tone(r(600, 700), 0.1, { type: 'triangle', vol: 0.08, delay: 0.05 }); break;
      case 'treefall': this.hiss(0.9, { type: 'lowpass', freq: 900, vol: 0.5, slide: 0.2, delay: 0.1 }); this.tone(70, 0.5, { type: 'sine', vol: 0.5, slide: 0.6, delay: 0.55 }); break;
      case 'coin': this.tone(1320, 0.09, { type: 'square', vol: 0.06 }); this.tone(1760, 0.2, { type: 'square', vol: 0.06, delay: 0.07 }); break;
      case 'click': this.tone(700, 0.05, { type: 'triangle', vol: 0.15 }); break;
      case 'tick': this.tone(1100, 0.03, { type: 'triangle', vol: 0.1 }); break;
      case 'open': this.tone(520, 0.12, { type: 'sine', vol: 0.14, slide: 1.5 }); break;
      case 'close': this.tone(620, 0.1, { type: 'sine', vol: 0.12, slide: 0.66 }); break;
      case 'error': this.tone(200, 0.16, { type: 'square', vol: 0.08, slide: 0.8 }); this.tone(150, 0.2, { type: 'square', vol: 0.08, delay: 0.1 }); break;
      case 'place': this.tone(220, 0.15, { type: 'triangle', vol: 0.3, slide: 0.6 }); this.hiss(0.25, { type: 'lowpass', freq: 600, vol: 0.4 }); break;
      case 'build': for (let i = 0; i < 4; i++) { this.tone(r(260, 320), 0.07, { type: 'triangle', vol: 0.35, slide: 0.6, delay: i * 0.16 }); this.hiss(0.05, { freq: 1500, vol: 0.2, delay: i * 0.16 }); } [523, 659, 784].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: 0.7 + i * 0.08 })); break;
      case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.16, delay: i * 0.1 })); this.tone(1568, 0.9, { type: 'sine', vol: 0.1, delay: 0.55 }); break;
      case 'quest': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.14, delay: i * 0.09 })); break;
      case 'unlock': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.7, { type: 'sine', vol: 0.14, delay: i * 0.12 })); this.hiss(1.4, { freq: 3000, q: 0.5, vol: 0.12, slide: 0.3 }); break;
      case 'chest': [659, 784, 988, 1318].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.13, delay: i * 0.07 })); break;
      case 'step': this.hiss(0.06, { type: 'lowpass', freq: r(500, 800), vol: 0.14 }); break;
      case 'stepHard': this.hiss(0.05, { type: 'bandpass', freq: r(900, 1400), q: 2, vol: 0.16 }); this.tone(r(120, 160), 0.04, { vol: 0.08 }); break;
      case 'splash': this.hiss(0.25, { type: 'bandpass', freq: 1200, q: 0.7, vol: 0.25, slide: 0.4 }); break;
      case 'jump': this.tone(300, 0.12, { type: 'sine', vol: 0.08, slide: 1.6 }); break;
      case 'hit': this.tone(120, 0.15, { type: 'square', vol: 0.12, slide: 0.5 }); this.hiss(0.1, { freq: 800, vol: 0.3 }); break;
      case 'wolf': this.tone(320, 1.3, { type: 'sawtooth', vol: 0.05, slide: 1.35, attack: 0.3 }); this.tone(330, 1.3, { type: 'sine', vol: 0.08, slide: 1.3, attack: 0.3 }); break;
      case 'bell': [880, 1108].forEach((f, i) => this.tone(f, 1.6, { type: 'sine', vol: 0.12, delay: i * 0.4 })); break;
      case 'fanfare': [523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { type: 'square', vol: 0.05, delay: i * 0.12 })); break;
      case 'resident': [659, 880, 1046].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: i * 0.1 })); break;
    }
  },
  update(dt) {
    if (!this.ok || !S) return;
    const t = this.ctx.currentTime, night = DayNight.night, rain = FX.rainAmt;
    const forest = [1, 7].includes(areaIdxAt(Player.x, Player.z)) ? 1 : 0.4;
    this.waterT -= dt;
    if (this.waterT <= 0) {
      this.waterT = 0.5;
      let best = 99;
      for (let a = 0; a < 8; a++) for (const d of [3, 7, 12, 18]) { if (World.groundY(Player.x + Math.cos(a * 0.785) * d, Player.z + Math.sin(a * 0.785) * d) < -0.5) { best = Math.min(best, d); break; } }
      this.waterNear = best < 99 ? 1 - best / 20 : 0;
    }
    let nearby = 0; for (const r of NPCService.rt.values()) if (!r.ent.hidden && Math.abs(r.ent.x - Player.x) < 20 && Math.abs(r.ent.z - Player.z) < 20) nearby++;
    const alt = clamp((Player.y - 8) / 25, 0, 1);
    this.amb.wind.g.gain.setTargetAtTime(0.05 + alt * 0.2 + rain * 0.1 + Math.sin(t * 0.3) * 0.02, t, 0.5);
    this.amb.water.g.gain.setTargetAtTime(this.waterNear * 0.35, t, 0.4);
    this.amb.rain.g.gain.setTargetAtTime(rain * 0.35, t, 0.6);
    this.amb.murmur.g.gain.setTargetAtTime(Math.min(0.12, nearby * 0.02) * (1 - night * 0.7), t, 0.8);
    // birds by day, crickets by night
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = randRange(1.5, 5) / forest;
      if (night < 0.4 && rain < 0.3) { const f = randRange(2200, 3600); const n = randInt(2, 5); for (let i = 0; i < n; i++) this.tone(f * randRange(0.9, 1.15), 0.07, { type: 'sine', vol: 0.035 * forest, slide: randRange(0.7, 1.4), delay: i * 0.11, dest: this.ambG }); }
    }
    this.crickT -= dt;
    if (this.crickT <= 0) {
      this.crickT = randRange(0.4, 1.2);
      if (night > 0.5 && rain < 0.3) for (let i = 0; i < 3; i++) this.tone(randRange(4200, 4600), 0.03, { type: 'sine', vol: 0.02 * night, delay: i * 0.06, dest: this.ambG });
    }
    // gentle generative music (pentatonic plucks + soft pads)
    this.musT -= dt;
    if (this.musT <= 0 && S.settings.music > 0.01) {
      const slow = night > 0.5 ? 1.6 : 1;
      this.musT = 0.36 * slow;
      const scale = [0, 2, 4, 7, 9, 12, 14, 16];
      const chords = [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]];
      if (this.musStep % 16 === 0) {
        this.chord = (this.chord + 1) % chords.length;
        for (const s of chords[this.chord]) this.tone(261.6 * Math.pow(2, (s - 12) / 12) * (night > 0.5 ? 0.5 : 1), 5.5 * slow, { type: 'sine', vol: 0.035, attack: 1.2, dest: this.musG });
      }
      if (Math.random() < (night > 0.5 ? 0.35 : 0.55)) {
        const deg = scale[Math.floor(Math.random() * scale.length)];
        const f = 523.2 * Math.pow(2, (deg + chords[this.chord][0] * 0) / 12) * (night > 0.5 ? 0.5 : 1);
        this.tone(f, 0.9, { type: 'triangle', vol: 0.05, dest: this.musG });
        this.tone(f, 0.9, { type: 'triangle', vol: 0.025, dest: this.delay });
      }
      this.musStep++;
    }
  },
};
