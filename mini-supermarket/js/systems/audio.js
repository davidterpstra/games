/* Sound: tiny synthesised sound effects (WebAudio), so there are no audio
 * files to load. Starts after the first click, as browsers require. */
(function (MS) {
  'use strict';

  class Sound {
    constructor() {
      this.enabled = true;
      this.ctx = null;
      this.last = {};
    }

    unlock() {
      if (this.ctx || !this.enabled) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.18;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
      }
    }

    setEnabled(on) {
      this.enabled = on;
      if (on) this.unlock();
    }

    tone(freq, dur, { type = 'sine', vol = 1, delay = 0, slide = 0 } = {}) {
      const ctx = this.ctx;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    noise(dur, { vol = 0.5, delay = 0, freq = 1800 } = {}) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(ctx.currentTime + delay);
    }

    /** Plays a named effect; `gap` stops rapid repeats. */
    play(name, gap = 0.05) {
      if (!this.enabled || !this.ctx) return;
      const now = performance.now() / 1000;
      if (this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now;
      try {
        switch (name) {
          case 'scan': this.tone(1320, 0.07, { type: 'square', vol: 0.25 }); break;
          case 'coin':
            this.tone(988, 0.09, { type: 'square', vol: 0.3 });
            this.tone(1319, 0.22, { type: 'square', vol: 0.3, delay: 0.08 });
            break;
          case 'pop': this.tone(520, 0.12, { type: 'sine', vol: 0.6, slide: 380 }); break;
          case 'click': this.tone(700, 0.05, { type: 'triangle', vol: 0.4 }); break;
          case 'error': this.tone(180, 0.18, { type: 'sawtooth', vol: 0.3, slide: -60 }); break;
          case 'build':
            this.noise(0.12, { vol: 0.5, freq: 900 });
            this.noise(0.12, { vol: 0.5, freq: 700, delay: 0.16 });
            this.tone(660, 0.2, { type: 'triangle', vol: 0.4, delay: 0.3 });
            break;
          case 'upgrade':
            [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.45, delay: i * 0.07 }));
            break;
          case 'levelup':
            [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.28, delay: i * 0.09 }));
            break;
          case 'truck':
            this.tone(392, 0.18, { type: 'sawtooth', vol: 0.22 });
            this.tone(330, 0.26, { type: 'sawtooth', vol: 0.22, delay: 0.2 });
            break;
          case 'clean': this.noise(0.25, { vol: 0.35, freq: 3500 }); break;
          case 'angry': this.tone(240, 0.25, { type: 'triangle', vol: 0.4, slide: -90 }); break;
          case 'box': this.noise(0.08, { vol: 0.6, freq: 400 }); break;
        }
      } catch {
        /* audio is optional */
      }
    }
  }

  MS.Sound = Sound;
})((window.MS = window.MS || {}));
