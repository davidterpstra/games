// WebAudio engine: master chain, noise buffers, reverb, positional one-shots, volume settings,
// footsteps from player events, and the ambience layers. Everything silently no-ops without WebAudio.
import * as THREE from 'three';
import { createSfx } from './sfx.js';
import { createAmbience } from './ambience.js';

const MAX_VOICES = 28;
const STEP_SURFACE = { grass: 'step_grass', dirt: 'step_dirt', sand: 'step_dirt', stone: 'step_stone', wood: 'step_wood', metal: 'step_metal', water: 'step_water' };

function makeNoise(ctx, kind, seconds = 3) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const d = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  // crossfade the loop seam so loops never click: the final buffer is the first n-f samples
  const f = Math.floor(ctx.sampleRate * 0.05), m = n - f;
  const out = ctx.createBuffer(1, m, ctx.sampleRate);
  const o = out.getChannelData(0);
  for (let i = 0; i < m; i++) o[i] = i < f ? d[i] * (i / f) + d[m + i] * (1 - i / f) : d[i];
  return out;
}

function makeImpulse(ctx, seconds = 2.8) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const decay = Math.pow(1 - t, 3.2);
      const k = 0.15 + 0.8 * t;                 // later reflections get darker
      lp += ((Math.random() * 2 - 1) - lp) * (1 - k);
      d[i] = lp * decay * (i < 200 ? i / 200 : 1);
    }
  }
  return buf;
}

/**
 * Creates the audio engine.
 * @returns {{unlock():void, play(name:string, o?:{position?:THREE.Vector3, volume?:number, impact?:number}):void, setListener(camera:THREE.Camera):void,
 *   update(dt:number, s:object):void, thunder(delay:number, intensity:number):void, setPowered(on:boolean):void, setTorch(on:boolean):void, readonly ready:boolean}}
 */
export function createAudio({ bus, settings }) {
  let ctx = null, sfx = null, amb = null;
  let master = null, sfxBus = null, ambBus = null, ambLP = null, wetIn = null, wetGain = null, sfxSend = null;
  let listenerCam = null;
  let voices = 0;
  let powered = false;
  let failed = false;
  const fwd = new THREE.Vector3(), upv = new THREE.Vector3(), pos = new THREE.Vector3(), right = new THREE.Vector3();
  let torchWanted = false;

  const vol = (key, def = 1) => { const v = settings && settings.get ? settings.get(key) : def; return typeof v === 'number' ? v : def; };
  const applyVolumes = () => {
    if (!ctx) return;
    master.gain.value = vol('masterVolume', 0.8);
    sfxBus.gain.value = vol('sfxVolume', 1);
    ambBus.gain.value = vol('ambientVolume', 0.8);
  };

  function build() {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { failed = true; return; }
    try {
      ctx = new AC({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
      master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      ambBus = ctx.createGain(); ambBus.connect(master);
      ambLP = ctx.createBiquadFilter(); ambLP.type = 'lowpass'; ambLP.frequency.value = 18000; ambLP.Q.value = 0.4; ambLP.connect(ambBus);
      const ambIn = ctx.createGain(); ambIn.connect(ambLP);
      // reverb: sfxBus (and anything wet-sent) → convolver → master
      const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx);
      wetIn = ctx.createGain(); wetIn.connect(conv);
      wetGain = ctx.createGain(); wetGain.gain.value = 0.05; conv.connect(wetGain); wetGain.connect(master);
      sfxSend = ctx.createGain(); sfxSend.gain.value = 0.3; sfxBus.connect(sfxSend); sfxSend.connect(wetIn);
      const noise = { white: makeNoise(ctx, 'white'), pink: makeNoise(ctx, 'pink'), brown: makeNoise(ctx, 'brown') };
      const core = {
        ctx, noise, ambIn, sfxBus,
        wet(node, amt) { const g = ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(wetIn); },
        panner(x, y, z) {
          const p = ctx.createPanner();
          p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
          p.refDistance = 4; p.rolloffFactor = 1.1; p.maxDistance = 120;
          if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
          return p;
        },
        setReverb(v) { wetGain.gain.value = v; },
        setMuffle(ind) { ambLP.frequency.value = 18000 * Math.pow(800 / 18000, Math.min(1, Math.max(0, ind))); },
      };
      sfx = createSfx(core);
      amb = createAmbience(core);
      amb.setTorch(torchWanted);
      applyVolumes();
    } catch (err) {
      console.warn('[audio] WebAudio unavailable', err);
      ctx = null; sfx = null; amb = null; failed = true;
    }
  }

  // Browsers refuse to start audio before the first user activation and warn on every attempt, so the
  // context is created/resumed only once the page has been activated (click/key/touch), never per sfx/frame.
  const activated = () => (typeof navigator !== 'undefined' && navigator.userActivation ? navigator.userActivation.hasBeenActive : true);
  let gestureSeen = false;
  function unlock() {
    if (failed) return;
    if (!gestureSeen && !activated()) return;   // wait for a real gesture (listeners below call unlock again)
    gestureSeen = true;
    if (!ctx) build();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function play(name, o = {}) {
    if (!ctx || !sfx) return;
    const fn = sfx[name];
    if (!fn) { console.warn(`[audio] unknown sfx "${name}"`); return; }
    if (ctx.state !== 'running') return;
    if (voices >= MAX_VOICES && !name.startsWith('ui_')) return;
    const g = ctx.createGain();
    g.gain.value = o.volume === undefined ? 1 : o.volume;
    let panner = null;
    if (o.position) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
      panner.refDistance = 3; panner.rolloffFactor = 1.2; panner.maxDistance = 100;
      const p = o.position;
      if (panner.positionX) { panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z; } else panner.setPosition(p.x, p.y, p.z);
      g.connect(panner); panner.connect(sfxBus);
    } else g.connect(sfxBus);
    const params = { vol: 1, rate: 1, impact: o.impact };
    if (name.startsWith('step_')) { params.rate = 0.92 + Math.random() * 0.17; params.vol = 0.8 + Math.random() * 0.3; }
    else if (name === 'jump' || name === 'land') { params.rate = 0.93 + Math.random() * 0.14; }
    else if (name === 'pickup') params.rate = 0.97 + Math.random() * 0.08;
    let dur = 0.5;
    try { dur = fn(ctx.currentTime + 0.005, g, params) || 0.5; } catch (err) { console.warn('[audio] sfx failed', name, err); }
    voices++;
    setTimeout(() => {
      voices--;
      try { g.disconnect(); if (panner) panner.disconnect(); } catch { /* already disconnected */ }
    }, (dur + 0.4) * 1000);
  }

  function setListener(camera) { listenerCam = camera; }

  function updateListener() {
    if (!ctx || !listenerCam) return;
    const l = ctx.listener;
    listenerCam.updateMatrixWorld();
    pos.setFromMatrixPosition(listenerCam.matrixWorld);
    fwd.set(0, 0, -1).transformDirection(listenerCam.matrixWorld);
    upv.set(0, 1, 0).transformDirection(listenerCam.matrixWorld);
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
      l.upX.value = upv.x; l.upY.value = upv.y; l.upZ.value = upv.z;
    } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, upv.x, upv.y, upv.z); }
    right.crossVectors(fwd, upv);
  }

  /** Per-frame: listener pose + ambience. `s` is filled by the Environment (see ambience.js). */
  function update(dt, s) {
    if (!ctx || !amb || ctx.state !== 'running') return;
    updateListener();
    s.rightX = right.x; s.rightZ = right.z;
    s.powered = powered;
    amb.update(dt, s);
  }

  // ---- bus wiring ----
  bus.on('sfx', (p) => { if (p && p.name) play(p.name, p); });
  bus.on('player:step', (p) => {
    const name = STEP_SURFACE[p && p.surface] || 'step_grass';
    play(name, { volume: p && p.sprint ? 1.25 : 0.8 });
  });
  bus.on('player:jump', () => play('jump', { volume: 0.8 }));
  bus.on('player:land', (p) => play('land', { volume: 0.9, impact: p && typeof p.impact === 'number' ? p.impact : 0.5 }));
  bus.on('settings:changed', ({ key }) => { if (key === 'masterVolume' || key === 'sfxVolume' || key === 'ambientVolume') applyVolumes(); });
  if (typeof window !== 'undefined') {
    const gesture = () => { gestureSeen = true; unlock(); if (ctx && ctx.state === 'running') { window.removeEventListener('pointerdown', gesture, true); window.removeEventListener('keydown', gesture, true); } };
    window.addEventListener('pointerdown', gesture, true);
    window.addEventListener('keydown', gesture, true);
  }

  return {
    unlock, play, setListener, update,
    thunder(delay, intensity) { if (amb && ctx && ctx.state === 'running') amb.thunder(delay, intensity); },
    setPowered(on) { powered = !!on; },
    setTorch(on) { torchWanted = !!on; if (amb) amb.setTorch(torchWanted); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    get context() { return ctx; },
  };
}
