// Ambience layers (wind, birds, crickets, owl, rain, thunder, water, interior drips/hum, torch fire).
// All synthesised; layers crossfade smoothly by writing eased gain values every frame.
import { riverInfo, RIVER, LAKE, WATERFALL } from '../../world/layout.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const R = (a, b) => a + Math.random() * (b - a);

/**
 * @param core { ctx, noise, ambIn (GainNode), sfxBus (GainNode), wet(out, amt), panner(x,y,z) → PannerNode, setReverb(v) }
 */
export function createAmbience(core) {
  const { ctx, noise: B, ambIn } = core;

  const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 1.5); return s; };
  const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
  const ease = (cur, target, k) => cur + (target - cur) * k;

  // ---- continuous layers ----
  const wind1 = { g: gain(), f: filt('bandpass', 400, 0.9) };
  chain(loop(B.pink), wind1.f, wind1.g, ambIn);
  const wind2 = { g: gain(), f: filt('lowpass', 220, 0.5) };
  chain(loop(B.brown), wind2.f, wind2.g, ambIn);
  const wind3 = { g: gain(), f: filt('bandpass', 1400, 2.2) }; // whistle in strong wind
  chain(loop(B.white), wind3.f, wind3.g, ambIn);

  const rainG = gain();
  chain(loop(B.white), filt('highpass', 600), filt('lowpass', 8000), rainG, ambIn);
  const rainLow = gain();
  chain(loop(B.pink), filt('bandpass', 1400, 0.4), rainLow, ambIn);

  // water layers are panned towards their source
  const mkWater = (...nodesBefore) => {
    const g = gain(); const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const last = chain(...nodesBefore, g);
    if (p) { last.connect(p); p.connect(ambIn); } else last.connect(ambIn);
    return { g, p };
  };
  const river = mkWater(loop(B.pink), filt('bandpass', 900, 0.5), filt('lowpass', 3800));
  const fall = mkWater(loop(B.pink), filt('lowpass', 2400, 0.4));
  const fallLow = mkWater(loop(B.brown), filt('lowpass', 420));
  const lake = mkWater(loop(B.brown), filt('lowpass', 650));

  // crickets: amplitude-modulated sine voices, grouped into chirp bursts
  const cricketG = gain();
  cricketG.connect(ambIn);
  [4300, 4650, 5050].forEach((f, i) => {
    const o = ctx.createOscillator(); o.frequency.value = f; o.type = 'sine';
    const am = gain(0.5);
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 13 + i * 2.1;
    const lg = gain(0.5); lfo.connect(lg); lg.connect(am.gain);
    const grp = gain(0.5);
    const lfo2 = ctx.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 0.8 + i * 0.31;
    const lg2 = gain(0.5); lfo2.connect(lg2); lg2.connect(grp.gain);
    o.connect(am); am.connect(grp); grp.connect(cricketG);
    o.start(); lfo.start(); lfo2.start();
  });

  // interior drones: temple/cave air, bunker mains hum
  const caveAir = gain();
  [55, 82.5, 110.4].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = gain(0.3); o.connect(g); g.connect(caveAir); o.start(); });
  chain(loop(B.brown), filt('lowpass', 160), caveAir);
  caveAir.connect(ambIn);
  const hum = gain();
  { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50; const lp = filt('lowpass', 260); const g = gain(0.5);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 100; const g2 = gain(0.35);
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 150; const g3 = gain(0.1);
    o.connect(lp); lp.connect(g); g.connect(hum); o2.connect(g2); g2.connect(hum); o3.connect(g3); g3.connect(hum);
    o.start(); o2.start(); o3.start();
    chain(loop(B.pink), filt('bandpass', 2400, 4), gain(0.03), hum); }
  hum.connect(ambIn);

  // torch fire hiss (kept on the sfx bus so it is never muffled by the ambience filter)
  const fireG = gain();
  chain(loop(B.pink), filt('bandpass', 1300, 0.45), fireG, core.sfxBus);
  const fireLow = gain();
  chain(loop(B.brown), filt('lowpass', 260), fireLow, core.sfxBus);

  // ---- smoothed state ----
  const cur = { wind: 0, rain: 0, river: 0, fall: 0, lake: 0, cricket: 0, cave: 0, hum: 0, fire: 0, riverPan: 0, fallPan: 0, lakePan: 0 };
  let gust = 0.5;
  let t = 0;
  let birdTimer = 2, owlTimer = 20, dripTimer = 1.5, crackleTimer = 0.2;
  let torchOn = false;

  // ---- one-shot generators ----
  function osc(type, f, t0, dur, vol, out, f2) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  const spawnPanner = (x, y, z, life) => {
    const p = core.panner(x, y, z);
    p.connect(ambIn);
    setTimeout(() => { try { p.disconnect(); } catch { /* already gone */ } }, (life + 0.5) * 1000);
    return p;
  };

  function bird(s) {
    const ang = Math.random() * Math.PI * 2, d = R(14, 45);
    const x = s.camX + Math.cos(ang) * d, z = s.camZ + Math.sin(ang) * d, y = s.camY + R(3, 14);
    const t0 = ctx.currentTime + 0.02;
    const vol = R(0.5, 1) * 0.55;
    const kind = Math.random();
    if (kind < 0.4) { // songbird: phrase of glissando notes
      const p = spawnPanner(x, y, z, 2.5);
      const base = R(2600, 4200), n = 3 + Math.floor(Math.random() * 4);
      let tt = t0;
      for (let i = 0; i < n; i++) {
        const f = base * R(0.85, 1.3), dur = R(0.05, 0.11);
        osc('sine', f, tt, dur, vol * 0.5, p, f * R(0.7, 1.5));
        osc('sine', f * 2, tt, dur, vol * 0.08, p, f * 2.4);
        tt += dur + R(0.03, 0.09);
      }
    } else if (kind < 0.65) { // trilling warbler
      const p = spawnPanner(x, y, z, 1.6);
      const base = R(3200, 4600);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base, t0); o.frequency.linearRampToValueAtTime(base * R(0.8, 1.25), t0 + 0.7);
      const mod = ctx.createOscillator(); mod.frequency.value = R(18, 30);
      const mg = ctx.createGain(); mg.gain.value = 500; mod.connect(mg); mg.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol * 0.35, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
      o.connect(g); g.connect(p); o.start(t0); mod.start(t0); o.stop(t0 + 0.8); mod.stop(t0 + 0.8);
    } else if (kind < 0.85) { // dove / cuckoo: two soft low notes
      const p = spawnPanner(x, y, z, 1.5);
      const f = R(420, 640);
      osc('sine', f * 1.12, t0, 0.22, vol * 0.5, p, f * 1.05);
      osc('sine', f, t0 + 0.32, 0.4, vol * 0.5, p, f * 0.93);
      osc('sine', f * 2, t0 + 0.32, 0.3, vol * 0.05, p);
    } else { // chirp pair
      const p = spawnPanner(x, y, z, 1);
      const f = R(3800, 5200);
      for (let i = 0; i < 2; i++) osc('triangle', f, t0 + i * 0.16, 0.07, vol * 0.4, p, f * 1.4);
    }
  }

  function owl(s) {
    const ang = Math.random() * Math.PI * 2, d = R(30, 70);
    const p = spawnPanner(s.camX + Math.cos(ang) * d, s.camY + 6, s.camZ + Math.sin(ang) * d, 3);
    const t0 = ctx.currentTime + 0.02;
    const f = R(330, 400);
    const hoot = (tt, dur, v) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.06, tt); o.frequency.exponentialRampToValueAtTime(f * 0.94, tt + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(v, tt + 0.05); g.gain.setValueAtTime(v, tt + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
      const lp = filt('lowpass', 900);
      o.connect(lp); lp.connect(g); g.connect(p);
      o.start(tt); o.stop(tt + dur + 0.05);
    };
    hoot(t0, 0.28, 0.5); hoot(t0 + 0.42, 0.7, 0.55);
    if (Math.random() < 0.5) { hoot(t0 + 1.7, 0.25, 0.35); hoot(t0 + 2.1, 0.6, 0.4); }
    core.wet(p, 0.25);
  }

  function drip(s, reverb) {
    const ang = Math.random() * Math.PI * 2, d = R(2, 9);
    const p = spawnPanner(s.camX + Math.cos(ang) * d, s.camY + R(-1, 2), s.camZ + Math.sin(ang) * d, 2);
    const t0 = ctx.currentTime + 0.01;
    const f = R(1100, 2300);
    osc('sine', f, t0, 0.07, R(0.25, 0.5), p, f * 0.45);
    osc('sine', f * 1.5, t0 + 0.005, 0.04, 0.08, p);
    core.wet(p, reverb);
  }

  function thunder(delay = 0.5, intensity = 1) {
    const t0 = ctx.currentTime + delay;
    const dur = 3.5 + intensity * 3;
    const s = ctx.createBufferSource(); s.buffer = B.brown; s.loop = true;
    const f = filt('lowpass', 900); f.frequency.setValueAtTime(1100, t0); f.frequency.exponentialRampToValueAtTime(70, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(2.2 * intensity, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.7 * intensity, t0 + 0.5);
    // rolling rumble
    for (let i = 1; i < 5; i++) g.gain.linearRampToValueAtTime((0.5 + Math.random() * 0.6) * intensity * (1 - i / 6), t0 + 0.5 + i * dur / 6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(core.sfxBus);
    s.start(t0, Math.random()); s.stop(t0 + dur + 0.1);
    const c = ctx.createBufferSource(); c.buffer = B.white; c.loop = true;
    const cf = filt('bandpass', 1800, 0.5); const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t0); cg.gain.linearRampToValueAtTime(0.5 * intensity, t0 + 0.01); cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    c.connect(cf); cf.connect(cg); cg.connect(core.sfxBus); c.start(t0); c.stop(t0 + 0.4);
    core.wet(g, 0.2);
  }

  // ---- per-frame update ----
  /**
   * s: { camX, camY, camZ, rightX, rightZ, wind, rain, storm, fog, day, night, indoor, zoneId, zoneDark, powered }
   */
  function update(dt, s) {
    t += dt;
    const k = 1 - Math.exp(-dt * 1.6);
    const out = 1 - 0.55 * s.indoor;           // outdoor layers shrink indoors (also muffled by the ambience LP)

    // wind
    gust = ease(gust, 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1.3) + 0.15 * Math.sin(t * 1.3), 1 - Math.exp(-dt * 0.9));
    const height = clamp01((s.camY - 12) / 45);
    const windT = (0.04 + 0.62 * s.wind) * (0.65 + 0.7 * gust) * (1 + 0.5 * height) * out;
    cur.wind = ease(cur.wind, windT, k);
    wind1.g.gain.value = cur.wind * 0.55;
    wind1.f.frequency.value = 280 + 700 * s.wind * (0.4 + gust);
    wind2.g.gain.value = cur.wind * (0.7 + 0.5 * s.storm);
    wind2.f.frequency.value = 180 + 200 * s.wind * gust;
    wind3.g.gain.value = cur.wind * cur.wind * 0.12 * (0.3 + gust);
    wind3.f.frequency.value = 900 + 1800 * gust * s.wind;

    // rain
    cur.rain = ease(cur.rain, s.rain, k);
    rainG.gain.value = cur.rain * 0.42 * (1 - 0.1 * s.indoor);
    rainLow.gain.value = cur.rain * 0.34;

    // water by distance
    const ri = riverInfo(s.camX, s.camZ);
    const dr = Math.max(0, ri.dist - RIVER.width / 2);
    cur.river = ease(cur.river, Math.pow(1 - clamp01(dr / 55), 2) * 0.4 * (s.camY - 0 < 80 ? 1 : 0.4), k * 1.5);
    river.g.gain.value = cur.river * (0.8 + 0.2 * Math.sin(t * 0.9));
    const pan = (px, pz) => {
      const dx = px - s.camX, dz = pz - s.camZ, l = Math.hypot(dx, dz) || 1;
      return Math.max(-0.85, Math.min(0.85, ((dx * s.rightX + dz * s.rightZ) / l) * Math.min(1, l / 6)));
    };
    if (river.p) river.p.pan.value = pan(ri.x, ri.z);
    const dfall = Math.hypot(s.camX - WATERFALL.pool.x, s.camZ - WATERFALL.pool.z);
    cur.fall = ease(cur.fall, Math.pow(clamp01(1 - (dfall - 10) / 170), 1.7) * 0.9, k * 1.5);
    fall.g.gain.value = cur.fall * 0.75;
    fallLow.g.gain.value = cur.fall * 0.7;
    const fp = pan(WATERFALL.pool.x, WATERFALL.pool.z);
    if (fall.p) { fall.p.pan.value = fp; fallLow.p.pan.value = fp * 0.6; }
    const dlake = Math.hypot(s.camX - LAKE.x, s.camZ - LAKE.z) - LAKE.radius;
    cur.lake = ease(cur.lake, Math.pow(1 - clamp01(dlake / 32), 2) * 0.28, k);
    lake.g.gain.value = cur.lake * (0.7 + 0.3 * Math.sin(t * 0.55) * Math.sin(t * 0.31));
    if (lake.p) lake.p.pan.value = pan(LAKE.x, LAKE.z) * 0.7;

    // night: crickets
    const cr = s.night * (1 - s.rain * 0.9) * (1 - s.storm) * out * (1 - clamp01(s.wind * 0.5));
    cur.cricket = ease(cur.cricket, cr, k);
    cricketG.gain.value = cur.cricket * 0.028;

    // interior layers
    const zone = s.zoneId || '';
    const isCave = /cave|grot/i.test(zone), isTemple = /temple|tempel|sanct/i.test(zone), isBunker = /bunker/i.test(zone);
    const deep = s.indoor * s.zoneDark;
    cur.cave = ease(cur.cave, (isCave || isTemple ? 1 : 0) * deep, k);
    caveAir.gain.value = cur.cave * 0.09;
    cur.hum = ease(cur.hum, s.powered && isBunker ? s.indoor : 0, k);
    hum.gain.value = cur.hum * 0.09;
    const reverb = s.indoor * (isCave ? 0.8 : isTemple ? 0.6 : isBunker ? 0.4 : 0.2);
    core.setReverb(0.04 + reverb);
    // muffling of everything outdoors while inside
    core.setMuffle(s.indoor * (0.5 + 0.5 * Math.max(s.zoneDark, 0.3)));

    // torch fire
    cur.fire = ease(cur.fire, torchOn ? 1 : 0, 1 - Math.exp(-dt * 6));
    fireG.gain.value = cur.fire * 0.05 * (0.7 + 0.3 * Math.sin(t * 13) * Math.sin(t * 5.3));
    fireLow.gain.value = cur.fire * 0.1;

    // random events
    const now = ctx.currentTime;
    birdTimer -= dt;
    if (birdTimer <= 0) {
      const activity = s.day * (1 - s.rain) * (1 - s.fog * 0.5) * (1 - s.storm) * (1 - s.wind * 0.45) * out;
      birdTimer = R(0.9, 3.6) / Math.max(0.15, activity);
      if (activity > 0.2 && Math.random() < activity + 0.1) bird(s);
    }
    owlTimer -= dt;
    if (owlTimer <= 0) {
      owlTimer = R(14, 38);
      if (s.night > 0.6 && s.rain < 0.3 && s.indoor < 0.5) owl(s);
    }
    dripTimer -= dt;
    if (dripTimer <= 0) {
      dripTimer = R(0.5, 3.2);
      if (cur.cave > 0.4) drip(s, isCave ? 0.9 : 0.6);
      else if (s.indoor > 0.5 && s.zoneDark > 0.5 && !isBunker && Math.random() < 0.3) drip(s, 0.4);
    }
    crackleTimer -= dt;
    if (crackleTimer <= 0) {
      crackleTimer = R(0.05, 0.3);
      if (torchOn && Math.random() < 0.75) {
        const src = ctx.createBufferSource(); src.buffer = B.white; src.loop = true;
        const hp = filt('highpass', R(1800, 4200), 1);
        const g = ctx.createGain();
        const dur = R(0.008, 0.03);
        g.gain.setValueAtTime(R(0.03, 0.11), now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        src.connect(hp); hp.connect(g); g.connect(core.sfxBus);
        src.start(now, Math.random()); src.stop(now + dur + 0.02);
      }
    }
  }

  return { update, thunder, setTorch(on) { torchOn = !!on; } };
}
