/* Music: looping background track ("The Sunlit Shelf"). Browsers only allow
 * sound after the player interacts, so it starts on the first click or tap
 * and fades in. MP3 plays in every current browser; add another entry to
 * SOURCES to offer an alternative format. */
(function (MS) {
  'use strict';

  const SOURCES = [
    { src: 'assets/music/supermarkt-music.mp3', type: 'audio/mpeg' },
  ];

  class Music {
    constructor() {
      this.enabled = true;
      this.volume = 0.3;
      this.el = null;
      this.allowed = false; // true after the first user gesture
      this.sourceIndex = -1;
      this.fadeId = 0;
    }

    /** Creates the <audio> element with the first format this browser can play. */
    ensure() {
      if (this.el) return this.el;
      const probe = document.createElement('audio');
      this.sourceIndex = SOURCES.findIndex((s) => probe.canPlayType && probe.canPlayType(s.type));
      if (this.sourceIndex < 0) return null;
      const a = new Audio();
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      a.src = SOURCES[this.sourceIndex].src;
      a.addEventListener('error', () => this.tryNextSource());
      this.el = a;
      return a;
    }

    tryNextSource() {
      const a = this.el;
      if (!a) return;
      const next = SOURCES.findIndex((s, i) => i > this.sourceIndex && a.canPlayType(s.type));
      if (next < 0) return;
      this.sourceIndex = next;
      a.src = SOURCES[next].src;
      if (this.enabled && this.allowed) this.play();
    }

    /** Call from a click/tap handler: the first call starts the music. */
    start() {
      this.allowed = true;
      if (this.enabled) this.play();
    }

    play() {
      const a = this.ensure();
      if (!a) return;
      if (!a.paused) {
        // Already playing (maybe fading out after a quick off/on): fade back in.
        if (a.volume < this.volume - 0.01) this.fadeTo(this.volume, 0.6);
        return;
      }
      let p;
      try { p = a.play(); } catch { return; }
      const fadeIn = () => this.fadeTo(this.volume, 1.6);
      if (p && p.then) p.then(fadeIn).catch(() => { /* blocked or not loaded yet; next gesture retries */ });
      else fadeIn();
    }

    pause() {
      if (this.el && !this.el.paused) this.el.pause();
    }

    setEnabled(on) {
      this.enabled = on;
      if (!on) this.fadeTo(0, 0.35, () => this.pause());
      else if (this.allowed) this.play();
    }

    /** Pauses while the tab is hidden and resumes when it is shown again. */
    setHidden(hidden) {
      if (hidden) this.pause();
      else if (this.enabled && this.allowed) this.play();
    }

    fadeTo(target, sec, done) {
      const a = this.el;
      if (!a) return;
      const id = ++this.fadeId;
      const from = a.volume;
      const t0 = performance.now();
      const step = (now) => {
        if (id !== this.fadeId) return;
        const k = Math.min(1, (now - t0) / (sec * 1000));
        try { a.volume = from + (target - from) * k; } catch { /* some browsers lock the volume */ }
        if (k < 1) requestAnimationFrame(step);
        else if (done) done();
      };
      requestAnimationFrame(step);
    }
  }

  MS.Music = Music;
})((window.MS = window.MS || {}));
