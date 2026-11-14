// Frame timing, FPS statistics and adaptive resolution.
// perf.begin()/perf.end(dt) wrap each frame; perf.fps, perf.frameMs, perf.stats() feed the HUD.

export function createPerformance({ renderer, bus, settings, quality, onResolutionChange }) {
  const samples = new Float32Array(120);
  let index = 0;
  let filled = 0;
  let frameStart = 0;
  let adaptTimer = 0;

  const perf = {
    quality,
    fps: 60,
    frameMs: 16.7,
    cpuMs: 0,
    resolutionScale: 1,
    adaptive: true,
    begin() { frameStart = performance.now(); },
    end(dt) {
      perf.cpuMs = performance.now() - frameStart;
      samples[index] = dt * 1000;
      index = (index + 1) % samples.length;
      filled = Math.min(filled + 1, samples.length);
      let sum = 0;
      for (let i = 0; i < filled; i++) sum += samples[i];
      perf.frameMs = sum / filled;
      perf.fps = 1000 / perf.frameMs;

      // Adaptive resolution: drop render scale when consistently slow, recover when fast.
      adaptTimer += dt;
      if (perf.adaptive && filled === samples.length && adaptTimer > 2) {
        adaptTimer = 0;
        let next = perf.resolutionScale;
        if (perf.fps < 40) next = Math.max(0.6, perf.resolutionScale - 0.1);
        else if (perf.fps > 57) next = Math.min(1, perf.resolutionScale + 0.05);
        if (Math.abs(next - perf.resolutionScale) > 0.001) {
          perf.resolutionScale = next;
          onResolutionChange?.();
        }
      }
    },
    stats() {
      const info = renderer.info;
      return {
        fps: Math.round(perf.fps), frameMs: +perf.frameMs.toFixed(1), cpuMs: +perf.cpuMs.toFixed(2),
        drawCalls: info.render.calls, triangles: info.render.triangles,
        geometries: info.memory.geometries, textures: info.memory.textures,
        resolutionScale: +perf.resolutionScale.toFixed(2), quality: perf.quality,
      };
    },
  };

  bus.on('settings:changed', ({ key }) => { if (key === 'renderScale') { perf.resolutionScale = 1; } });
  void settings;
  return perf;
}
