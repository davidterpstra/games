/* =====================================================================
   Audio. Everything except the radio is synthesised with WebAudio, so no
   sample can fail to load: engine (rpm-driven oscillators + intake noise),
   tyre squeal, gravel/grass rumble, wind, impacts, exhaust pops, UI
   blips, race cues and countryside ambience (birds by day, crickets at
   night, rain). The festival radio plays audio/chasing_the_edge.mp3.
   ===================================================================== */
const Audio = {
  ctx: null, master: null, buses: {}, noise: null, eng: null, ai: null, tyre: null, roll: null, wind: null, rain: null,
  music: null, musicOn: true, birdT: 2, cricketT: 1, lastThrottle: 0, started: false,
};

function audioStart() {
  if (Audio.started) { if (Audio.ctx.state === 'suspended') Audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  Audio.ctx = ctx; Audio.started = true;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 4;
  comp.connect(ctx.destination);
  Audio.master = ctx.createGain(); Audio.master.connect(comp);
  for (const b of ['engine', 'sfx', 'ambient', 'ui']) { const g = ctx.createGain(); g.connect(Audio.master); Audio.buses[b] = g; }
  // noise buffer
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  Audio.noise = nb;
  Audio.eng = makeEngineVoice(Audio.buses.engine, 1);
  Audio.ai = makeEngineVoice(Audio.buses.engine, 0.6, true);
  Audio.tyre = filteredNoise('bandpass', 1500, 6, Audio.buses.sfx);
  Audio.tyre2 = filteredNoise('bandpass', 2300, 9, Audio.buses.sfx);
  Audio.roll = filteredNoise('lowpass', 420, 0.7, Audio.buses.sfx);
  Audio.road = filteredNoise('lowpass', 180, 0.7, Audio.buses.sfx);
  Audio.wind = filteredNoise('bandpass', 700, 0.4, Audio.buses.sfx);
  Audio.rain = filteredNoise('highpass', 1800, 0.3, Audio.buses.ambient);
  Audio.breeze = filteredNoise('lowpass', 300, 0.5, Audio.buses.ambient);
  applyVolumes();
}
function filteredNoise(type, f, q, out) {
  const ctx = Audio.ctx;
  const src = ctx.createBufferSource(); src.buffer = Audio.noise; src.loop = true;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(fl); fl.connect(g); g.connect(out);
  src.start();
  return { src, f: fl, g };
}
function makeEngineVoice(out, level, panned) {
  const ctx = Audio.ctx;
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'square';
  const o3 = ctx.createOscillator(); o3.type = 'sawtooth';
  const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
  g1.gain.value = 0.5; g2.gain.value = 0.35; g3.gain.value = 0.18;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.2); }
  shaper.curve = curve;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2.5;
  const intake = filteredNoise('bandpass', 900, 1.2, lp);
  const g = ctx.createGain(); g.gain.value = 0;
  o1.connect(g1); o2.connect(g2); o3.connect(g3);
  g1.connect(shaper); g2.connect(shaper); g3.connect(shaper);
  shaper.connect(lp);
  let tail = g;
  lp.connect(g);
  if (panned && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); g.connect(p); p.connect(out); tail = p; }
  else g.connect(out);
  o1.start(); o2.start(); o3.start();
  return { o1, o2, o3, lp, g, intake, pan: tail !== g ? tail : null, level };
}

function applyVolumes() {
  if (!Audio.started) return;
  const s = Game.settings;
  const t = Audio.ctx.currentTime;
  Audio.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
  Audio.buses.engine.gain.setTargetAtTime(s.engine, t, 0.05);
  Audio.buses.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
  Audio.buses.ambient.gain.setTargetAtTime(s.ambient, t, 0.05);
  Audio.buses.ui.gain.setTargetAtTime(Math.max(s.sfx, 0.5), t, 0.05);
  musicVolume();
}

/* ---------- radio ---------- */
const TRACKS = [{ file: 'audio/chasing_the_edge.mp3', title: 'Chasing the Edge' }];
function musicInit() {
  if (Audio.music) return;
  const a = new window.Audio();
  a.src = TRACKS[0].file;
  a.loop = true;
  a.preload = 'auto';
  a.addEventListener('error', () => { Audio.musicFailed = true; });
  Audio.music = a;
  musicVolume();
}
function musicVolume() {
  if (!Audio.music) return;
  const s = Game.settings;
  const duck = Game.mode === 'race' && Game.race && Game.race.phase === 'countdown' ? 0.5 : 1;
  Audio.music.volume = clamp((s.muted || !Audio.musicOn ? 0 : s.master * (s.music ?? 0.55)) * duck, 0, 1);
}
function musicPlay() {
  musicInit();
  if (!Audio.musicOn || Audio.musicFailed) return;
  const p = Audio.music.play();
  if (p && p.catch) p.catch(() => {});
}
function musicToggle() {
  musicInit();
  Audio.musicOn = !Audio.musicOn;
  if (Audio.musicOn) { musicPlay(); notify('Radio on', `Now playing: ${TRACKS[0].title}`, 'radio'); }
  else { Audio.music.pause(); notify('Radio off', '', 'radio'); }
  musicVolume();
}

/* ---------- per-frame update ---------- */
function audioUpdate(dt, player, cam, aiCars) {
  if (!Audio.started) return;
  const ctx = Audio.ctx, t = ctx.currentTime;
  const playing = Game.mode === 'drive' || Game.mode === 'race';
  const e = Audio.eng;
  if (player && playing) {
    const sp = player.spec.eng;
    const f = player.rpm / 60 * sp.cyl / 2;
    const thr = player.input.throttle * (player.shiftT > 0 ? 0.3 : 1);
    e.o1.frequency.setTargetAtTime(f, t, 0.02);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.02);
    e.o3.frequency.setTargetAtTime(f * 2.01, t, 0.02);
    e.lp.frequency.setTargetAtTime(380 + thr * 2600 + player.rpm * 0.25, t, 0.04);
    e.intake.g.gain.setTargetAtTime(0.08 + thr * 0.5, t, 0.05);
    e.intake.f.frequency.setTargetAtTime(f * 3, t, 0.05);
    e.g.gain.setTargetAtTime(0.11 + thr * 0.11 + player.rpm / sp.red * 0.05, t, 0.04);
    // lift-off pops
    if (Audio.lastThrottle > 0.7 && thr < 0.1 && player.rpm > sp.red * 0.6) { player.pop = 0.35; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) pop(t + 0.05 + i * (0.06 + Math.random() * 0.08)); }
    Audio.lastThrottle = thr;
    // tyres
    const paved = player.surface === S_ASPHALT || player.surface === S_PAVED;
    const slip = clamp((Math.abs(player.slip) - 0.1) * 2.5 + player.wheelspin * 0.8 + (player.input.handbrake && player.speed > 6 ? 0.4 : 0), 0, 1);
    const sq = paved && !player.air && player.speed > 5 ? slip : 0;
    Audio.tyre.g.gain.setTargetAtTime(sq * 0.14 * (1 - Sky.wet * 0.6), t, 0.05);
    Audio.tyre2.g.gain.setTargetAtTime(sq * 0.05, t, 0.05);
    Audio.tyre.f.frequency.setTargetAtTime(1200 + slip * 600 + Math.sin(t * 13) * 80, t, 0.05);
    const v = player.speed;
    const rough = !paved && !player.air ? Math.min(1, v / 25) : 0;
    Audio.roll.g.gain.setTargetAtTime(rough * (player.surface === S_GRASS ? 0.12 : 0.22), t, 0.08);
    Audio.road.g.gain.setTargetAtTime(paved && !player.air ? Math.min(0.12, v / 400) * (1 + Sky.wet * 2) : 0, t, 0.1);
    Audio.wind.g.gain.setTargetAtTime(Math.min(0.25, (v / 85) ** 2 * 0.25), t, 0.1);
  } else {
    e.g.gain.setTargetAtTime(0, t, 0.1);
    for (const n of [Audio.tyre, Audio.tyre2, Audio.roll, Audio.road, Audio.wind]) n.g.gain.setTargetAtTime(0, t, 0.1);
  }
  // nearest opponent
  let near = null, nd = 1e9;
  if (playing) for (const a of aiCars) { const d = Math.hypot(a.x - cam.position.x, a.z - cam.position.z); if (d < nd) { nd = d; near = a; } }
  const ai = Audio.ai;
  if (near && nd < 120) {
    const f = near.rpm / 60 * near.spec.eng.cyl / 2;
    ai.o1.frequency.setTargetAtTime(f, t, 0.03); ai.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); ai.o3.frequency.setTargetAtTime(f * 2, t, 0.03);
    ai.lp.frequency.setTargetAtTime(500 + near.input.throttle * 1800, t, 0.05);
    ai.g.gain.setTargetAtTime(0.16 * Math.max(0, 1 - nd / 120) ** 1.5, t, 0.05);
    if (ai.pan) {
      const dx = near.x - cam.position.x, dz = near.z - cam.position.z;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      ai.pan.pan.setTargetAtTime(clamp((dx * right.x + dz * right.z) / Math.max(nd, 1), -1, 1) * 0.8, t, 0.05);
    }
  } else ai.g.gain.setTargetAtTime(0, t, 0.1);
  // ambience
  const day = 1 - Sky.night;
  Audio.rain.g.gain.setTargetAtTime(Sky.cur.rain * 0.16, t, 0.3);
  Audio.breeze.g.gain.setTargetAtTime(0.03 + Sky.cur.clouds * 0.03, t, 0.5);
  Audio.birdT -= dt; Audio.cricketT -= dt;
  if (Audio.birdT <= 0) { Audio.birdT = 1.5 + Math.random() * 5; if (day > 0.5 && Sky.cur.rain < 0.3) bird(t); }
  if (Audio.cricketT <= 0) { Audio.cricketT = 0.4 + Math.random() * 1.2; if (Sky.night > 0.6 && Sky.cur.rain < 0.3) cricket(t); }
}
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function tone(freq, dur, type = 'sine', vol = 0.2, bus = 'ui', when = 0, glide = 0) {
  if (!Audio.started) return;
  const ctx = Audio.ctx, t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.005, vol, dur);
  o.connect(g); g.connect(Audio.buses[bus]);
  o.start(t); o.stop(t + dur + 0.05);
}
function noiseBurst(dur, f, vol, bus = 'sfx', when = 0, type = 'lowpass') {
  if (!Audio.started) return;
  const ctx = Audio.ctx, t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = Audio.noise;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
  const g = ctx.createGain(); env(g, t, 0.003, vol, dur);
  s.connect(fl); fl.connect(g); g.connect(Audio.buses[bus]);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function pop(at) {
  const ctx = Audio.ctx, dt = Math.max(0, at - ctx.currentTime);
  noiseBurst(0.06, 900, 0.35, 'engine', dt, 'bandpass');
  tone(70, 0.05, 'square', 0.15, 'engine', dt);
}
function bird(t0) {
  const n = 2 + (Math.random() * 4 | 0), base = 2200 + Math.random() * 2400;
  for (let i = 0; i < n; i++) tone(base * (0.9 + Math.random() * 0.25), 0.07 + Math.random() * 0.06, 'sine', 0.025, 'ambient', i * 0.11, 1.2 + Math.random() * 0.3);
}
function cricket() { for (let i = 0; i < 4; i++) tone(4600, 0.025, 'triangle', 0.012, 'ambient', i * 0.045); }
const SFX = {
  hover: () => tone(1400, 0.03, 'sine', 0.04),
  click: () => { tone(880, 0.06, 'triangle', 0.12); tone(1320, 0.08, 'sine', 0.06, 'ui', 0.04); },
  back: () => tone(520, 0.08, 'triangle', 0.1, 'ui', 0, 0.7),
  count: (go) => go ? (tone(1046, 0.6, 'square', 0.12), tone(1568, 0.6, 'sine', 0.08)) : tone(523, 0.25, 'square', 0.1),
  checkpoint: () => { tone(988, 0.12, 'sine', 0.14); tone(1318, 0.2, 'sine', 0.12, 'ui', 0.08); },
  finish: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.14, 'ui', i * 0.11)),
  stunt: () => { tone(784, 0.1, 'sine', 0.12); tone(1175, 0.18, 'sine', 0.12, 'ui', 0.07); tone(1568, 0.25, 'sine', 0.08, 'ui', 0.14); },
  hit: (v) => { const k = clamp(v / 20, 0.15, 1); noiseBurst(0.18 + k * 0.25, 900 + k * 1600, 0.25 + k * 0.4); tone(60 + k * 20, 0.2, 'sine', 0.4 * k, 'sfx', 0, 0.5); },
  land: (v) => { const k = clamp(v / 10, 0.2, 1); noiseBurst(0.12, 300, 0.3 * k); tone(50, 0.18, 'sine', 0.35 * k, 'sfx', 0, 0.6); },
  shift: () => { noiseBurst(0.04, 2400, 0.04, 'engine', 0, 'bandpass'); },
  splash: () => noiseBurst(0.6, 1200, 0.3, 'sfx', 0, 'bandpass'),
};
