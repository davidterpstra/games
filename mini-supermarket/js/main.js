/* Boot: create the game, renderer, UI and input, then run the frame loop. */
(function (MS) {
  'use strict';

  function boot() {
    const game = new MS.Game();
    const hadSave = game.start();
    const renderer = new MS.Renderer(game, document.getElementById('world'));
    const ui = new MS.UI(game, renderer);
    const input = new MS.Input(game, renderer, ui);
    MS.app = { game, renderer, ui, input };

    if (!hadSave) ui.openModal(MS.Panels.intro());
    else ui.toast('👋 Welkom terug! Je spel is geladen.', 'success');
    if (!game.saveSystem.available) ui.toast('Let op: deze browser blokkeert localStorage, dus opslaan werkt niet.', 'warn', 6000);

    const errors = new Set();
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      try {
        const steps = game.paused ? 0 : game.speed;
        for (let i = 0; i < steps; i++) game.update(dt);
        game.tickRealtime(dt);
        renderer.update(dt);
        renderer.draw();
        ui.update(dt);
      } catch (err) {
        const key = String(err && err.message);
        if (!errors.has(key)) { errors.add(key); console.error('[MS] frame error', err); }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const saveNow = () => game.save(false);
    document.addEventListener('visibilitychange', () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden) saveNow();
      game.music.setHidden(hidden);
    });
    window.addEventListener('pagehide', saveNow);
    window.addEventListener('beforeunload', saveNow);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})((window.MS = window.MS || {}));
