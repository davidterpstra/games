/* =====================================================================
   08_fx.js — 3D + screen effects (particles, rings, confetti, float text,
   fly-to-HUD icons, flash, camera shake). Public: FX. Private prefix: _fx.
   ===================================================================== */

const _fxCap = 1500;
const _fxVert = `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(0.1, -mv.z);
  gl_PointSize = clamp(aSize * uScale / d, 0.0, 192.0);
  gl_Position = projectionMatrix * mv;
}`;
const _fxFrag = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  float a = smoothstep(1.0, 0.15, d);
  float core = smoothstep(0.45, 0.0, d);
  gl_FragColor = vec4(vColor + core * 0.6, a * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const _fxIcons = { coins: '🪙', gems: '💎', strength: '💪' };
const _fxTargets = { coins: '#hud-coins', gems: '#hud-gems', strength: '#hud-strength' };
const _fxConfettiColors = ['#ff4d6d', '#ffd23f', '#3fd0ff', '#6bff6b', '#c77dff', '#ff9f1c', '#ffffff', '#ff6bd6'];

/* internal state (plain data, no side effects) */
const _fxS = {
  ready: false,
  layer: null, flashEl: null,
  // particles
  points: null, geo: null, mat: null,
  pos: null, col: null, size: null, alpha: null,
  vel: new Float32Array(_fxCap * 3),
  grav: new Float32Array(_fxCap),
  drag: new Float32Array(_fxCap),
  ttl: new Float32Array(_fxCap),
  maxLife: new Float32Array(_fxCap),
  baseSize: new Float32Array(_fxCap),
  baseAlpha: new Float32Array(_fxCap),
  kind: new Uint8Array(_fxCap),
  phase: new Float32Array(_fxCap),
  next: 0, alive: 0, dirty: false,
  time: 0,
  // rings
  rings: [], ringNext: 0,
  // float texts
  texts: [],
  // icons
  icons: [],
  bumpTimers: new Map(),
  lastCoinSfx: 0,
  // confetti
  cCanvas: null, cCtx: null, pieces: [], cW: 0, cH: 0,
  // flash
  flashT: 0, flashDur: 0.35, flashStr: 0,
  // shake
  shakeAmt: 0,
  // misc
  trainN: 0, repN: 0,
  col3: null, v3: null, v3b: null, v2: null,
};

function _fxRand(a, b) { return a + Math.random() * (b - a); }

function _fxCamOk() {
  return _fxS.ready && typeof Scene3D !== 'undefined' && Scene3D && Scene3D.camera;
}
function _fxPresetScale() {
  const p = (typeof Scene3D !== 'undefined' && Scene3D && Scene3D.preset) ? Scene3D.preset.particles : 1;
  return isNum(p) ? clamp(p, 0, 1) : 1;
}
function _fxCount(n) {
  const p = _fxPresetScale();
  if (p <= 0) return 0;
  return Math.max(1, Math.round(n * p));
}
function _fxToScreen(v3) {
  if (typeof Scene3D === 'undefined' || !Scene3D.toScreen) return null;
  return Scene3D.toScreen(v3);
}

function _fxEmit(x, y, z, vx, vy, vz, c, size, life, grav, drag, kind, alpha) {
  const s = _fxS;
  const i = s.next;
  s.next = (i + 1) % _fxCap;
  const k = i * 3;
  s.pos[k] = x; s.pos[k + 1] = y; s.pos[k + 2] = z;
  s.vel[k] = vx; s.vel[k + 1] = vy; s.vel[k + 2] = vz;
  s.col[k] = c.r; s.col[k + 1] = c.g; s.col[k + 2] = c.b;
  s.grav[i] = grav; s.drag[i] = drag;
  s.ttl[i] = life; s.maxLife[i] = life;
  s.baseSize[i] = size; s.size[i] = size;
  s.baseAlpha[i] = alpha; s.alpha[i] = alpha;
  s.kind[i] = kind;
  s.phase[i] = Math.random() * TAU;
  s.dirty = true;
}

function _fxParseColor(color) {
  const c = _fxS.col3;
  try { c.set(color == null ? '#ffffff' : color); } catch (e) { c.set('#ffffff'); }
  return c;
}

function _fxPosXYZ(pos) {
  return pos && isNum(pos.x) ? pos : _fxS.v3.set(0, 1, 0);
}

function _fxAcquireRingMesh() {
  const geo = new THREE.RingGeometry(0.82, 1, 48, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  return mesh;
}

function _fxBump(el) {
  if (!el) return;
  const t = _fxS.bumpTimers.get(el);
  if (t) clearTimeout(t);
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  _fxS.bumpTimers.set(el, setTimeout(() => { el.classList.remove('bump'); _fxS.bumpTimers.delete(el); }, 250));
}

function _fxHeadPos(out) {
  if (typeof Player !== 'undefined' && Player && Player.getHeadWorldPos) {
    try { return Player.getHeadWorldPos(out); } catch (e) { /* ignore */ }
  }
  return null;
}
function _fxChutePos(out) {
  if (typeof Machines !== 'undefined' && Machines && Machines.active && Machines.active.getChuteWorldPos) {
    try { const p = Machines.active.getChuteWorldPos(); if (p) return out.copy(p); } catch (e) { /* ignore */ }
  }
  return null;
}
function _fxMachineTop(out) {
  return toWorldMachine(out.set(0, MACHINE_DIMS.glassTop, 0), out);
}
function _fxCenter() {
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.5 };
}

/* ------------------------------------------------------------------ */

const FX = {
  shakeOffset: new THREE.Vector3(),

  init() {
    const s = _fxS;
    if (s.ready) return;
    s.col3 = new THREE.Color();
    s.v3 = new THREE.Vector3();
    s.v3b = new THREE.Vector3();
    s.v2 = new THREE.Vector2();

    /* (a) particle system */
    s.pos = new Float32Array(_fxCap * 3);
    s.col = new Float32Array(_fxCap * 3);
    s.size = new Float32Array(_fxCap);
    s.alpha = new Float32Array(_fxCap);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(s.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(s.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(s.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(s.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: _fxVert, fragmentShader: _fxFrag,
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 30;
    s.geo = geo; s.mat = mat; s.points = pts;
    if (typeof Scene3D !== 'undefined' && Scene3D && Scene3D.scene) Scene3D.scene.add(pts);

    /* (c) ring pool */
    for (let i = 0; i < 6; i++) {
      const mesh = _fxAcquireRingMesh();
      if (typeof Scene3D !== 'undefined' && Scene3D && Scene3D.scene) Scene3D.scene.add(mesh);
      s.rings.push({ mesh, t: 0, dur: 0.7, active: false, delay: 0, size: 1.6 });
    }

    /* (b) DOM layer */
    let layer = document.getElementById('fx-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'fx-layer';
      document.body.appendChild(layer);
    }
    layer.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:40;overflow:hidden;';
    s.layer = layer;
    const fl = document.createElement('div');
    fl.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none;';
    layer.appendChild(fl);
    s.flashEl = fl;

    s.ready = true;
    FX._subscribe();
  },

  /* ---------------- 3D particles ---------------- */
  burst(pos, color, count = 24, opts) {
    if (!_fxS.ready) return;
    const n = _fxCount(count);
    if (!n) return;
    const o = opts || {};
    const speed = o.speed != null ? o.speed : 3.5;
    const size = o.size != null ? o.size : 0.18;
    const grav = o.gravity != null ? o.gravity : 6;
    const life = o.life != null ? o.life : 0.9;
    const up = !!o.up || (isNum(o.spread) && o.spread < 0);
    const p = _fxPosXYZ(pos);
    const c = _fxParseColor(color);
    const br = c.r, bg = c.g, bb = c.b;
    for (let i = 0; i < n; i++) {
      // random direction on a sphere
      const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u);
      const sp = speed * _fxRand(0.35, 1);
      let vx = r * Math.cos(a) * sp, vy = u * sp, vz = r * Math.sin(a) * sp;
      if (up) vy = Math.abs(vy) + speed * 0.45;
      const j = _fxRand(0.8, 1.25);
      c.setRGB(Math.min(1.6, br * j), Math.min(1.6, bg * j), Math.min(1.6, bb * j));
      _fxEmit(p.x, p.y, p.z, vx, vy, vz, c, size * _fxRand(0.6, 1.3), life * _fxRand(0.6, 1.1), grav, 1.6, 0, 1);
    }
  },

  sparkle(pos, color, count = 12) {
    if (!_fxS.ready) return;
    const n = _fxCount(count);
    if (!n) return;
    const p = _fxPosXYZ(pos);
    const c = _fxParseColor(color);
    const br = c.r, bg = c.g, bb = c.b;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, rad = Math.sqrt(Math.random()) * 0.45;
      const m = _fxRand(0.9, 1.4);
      c.setRGB(Math.min(1.8, br * m + 0.25), Math.min(1.8, bg * m + 0.25), Math.min(1.8, bb * m + 0.25));
      _fxEmit(p.x + Math.cos(a) * rad, p.y + _fxRand(-0.15, 0.3), p.z + Math.sin(a) * rad,
        _fxRand(-0.15, 0.15), _fxRand(0.35, 1.0), _fxRand(-0.15, 0.15),
        c, _fxRand(0.1, 0.22), _fxRand(0.9, 1.7), -0.05, 0.4, 1, 1);
    }
  },

  ring(pos, color, delay) {
    const s = _fxS;
    if (!s.ready || !s.rings.length) return;
    const p = _fxPosXYZ(pos);
    const r = s.rings[s.ringNext];
    s.ringNext = (s.ringNext + 1) % s.rings.length;
    r.mesh.position.set(p.x, p.y, p.z);
    r.mesh.material.color.set(color == null ? '#ffffff' : color);
    r.t = 0; r.dur = 0.7; r.delay = delay || 0; r.active = true; r.size = 1.7;
    r.mesh.scale.setScalar(0.01);
    r.mesh.material.opacity = 0;
    r.mesh.visible = r.delay <= 0;
  },

  /* ---------------- screen effects ---------------- */
  flash(color, strength = 0.6) {
    const s = _fxS;
    if (!s.ready) return;
    s.flashEl.style.background = color || '#ffffff';
    s.flashStr = clamp(strength, 0, 1);
    s.flashT = s.flashDur;
    s.flashEl.style.opacity = String(s.flashStr);
  },

  shake(amount) {
    if (!isNum(amount)) return;
    _fxS.shakeAmt = Math.min(1.5, Math.max(_fxS.shakeAmt, amount));
  },

  confetti(intensity = 1) {
    const s = _fxS;
    if (!s.ready) return;
    const W = window.innerWidth, H = window.innerHeight;
    if (!s.cCanvas) {
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
      s.cCanvas = cv;
      s.cCtx = cv.getContext('2d');
    }
    if (!s.cCanvas.parentNode) s.layer.insertBefore(s.cCanvas, s.layer.firstChild);
    FX._sizeConfetti();
    const n = Math.min(Math.round(120 * intensity), Math.max(0, 600 - s.pieces.length));
    for (let i = 0; i < n; i++) {
      const cannon = i % 5 < 2; // 40% shot from the bottom corners
      const pc = {
        x: 0, y: 0, vx: 0, vy: 0, rot: Math.random() * TAU, vr: _fxRand(-8, 8),
        flip: Math.random() * TAU, vf: _fxRand(4, 11),
        w: _fxRand(7, 13), h: _fxRand(11, 19),
        color: _fxConfettiColors[(Math.random() * _fxConfettiColors.length) | 0],
        sway: Math.random() * TAU, swayF: _fxRand(2, 4.5), swayA: _fxRand(30, 90),
        t: 0, life: _fxRand(2.6, 3.4), delay: 0, drag: 0.9, term: _fxRand(190, 300),
      };
      if (cannon) {
        const left = i % 2 === 0;
        pc.x = left ? W * 0.02 : W * 0.98; pc.y = H * 0.92;
        const ang = _fxRand(-1.45, -0.95); // up-ish
        const sp = _fxRand(700, 1250) * Math.min(1.4, Math.max(0.7, H / 800));
        pc.vx = (left ? 1 : -1) * Math.abs(Math.cos(ang)) * sp;
        pc.vy = Math.sin(ang) * sp;
        pc.drag = 2.2;
      } else {
        pc.x = _fxRand(0, W); pc.y = _fxRand(-40, -10);
        pc.vx = _fxRand(-60, 60); pc.vy = _fxRand(40, 200);
        pc.delay = _fxRand(0, 0.9);
      }
      s.pieces.push(pc);
    }
  },

  _sizeConfetti() {
    const s = _fxS;
    if (!s.cCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(window.innerWidth * dpr), hh = Math.round(window.innerHeight * dpr);
    if (s.cCanvas.width !== w || s.cCanvas.height !== hh) {
      s.cCanvas.width = w; s.cCanvas.height = hh;
    }
    s.cW = window.innerWidth; s.cH = window.innerHeight;
  },

  floatText(pos, text, color) {
    const s = _fxS;
    if (!s.ready) return;
    let slot = null;
    for (let i = 0; i < s.texts.length; i++) if (!s.texts[i].active) { slot = s.texts[i]; break; }
    if (!slot) {
      if (s.texts.length < 30) {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;font-weight:900;font-size:28px;' +
          "font-family:var(--font-d,'Fredoka One','Baloo 2','Arial Rounded MT Bold',system-ui,sans-serif);" +
          'letter-spacing:0.5px;will-change:transform,opacity;display:none;' +
          '-webkit-text-stroke:7px #1d1230;paint-order:stroke fill;' +
          'text-shadow:0 3px 0 #1d1230,0 0 14px rgba(0,0,0,0.35);';
        s.layer.appendChild(el);
        slot = { el, active: false, pos: new THREE.Vector3(), t: 0, dur: 1.1, ox: 0 };
        s.texts.push(slot);
      } else { // reuse the oldest
        slot = s.texts[0];
        for (let i = 1; i < s.texts.length; i++) if (s.texts[i].t > slot.t) slot = s.texts[i];
      }
    }
    const p = _fxPosXYZ(pos);
    slot.pos.set(p.x, p.y, p.z);
    slot.t = 0; slot.dur = 1.1; slot.active = true; slot.ox = _fxRand(-14, 14);
    slot.el.textContent = String(text);
    slot.el.style.color = color || '#ffffff';
    slot.el.style.display = 'block';
    slot.el.style.opacity = '0';
  },

  flyToHud(kind, from, amount) {
    const s = _fxS;
    if (!s.ready) return;
    const icon = _fxIcons[kind];
    if (!icon) return;
    // origin on screen
    let sx, sy;
    if (from && from.isVector3 && _fxCamOk()) {
      const sc = _fxToScreen(from);
      if (sc && sc.visible) { sx = sc.x; sy = sc.y; }
    } else if (from && isNum(from.x) && isNum(from.y) && !from.isVector3) { sx = from.x; sy = from.y; }
    if (sx === undefined) { const c = _fxCenter(); sx = c.x; sy = c.y; }
    // target
    let ex = 40, ey = 40;
    const tEl = document.querySelector(_fxTargets[kind]);
    if (tEl) {
      const r = tEl.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) { ex = r.left + r.width / 2; ey = r.top + r.height / 2; }
    }
    const amt = isNum(amount) ? Math.max(0, amount) : 1;
    const n = Math.min(10, Math.round(3 + Math.log2(amt + 1)));
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.textContent = icon;
      el.style.cssText = 'position:absolute;left:0;top:0;font-size:30px;line-height:1;will-change:transform,opacity;opacity:0;' +
        'filter:drop-shadow(0 2px 0 rgba(20,10,40,0.6)) drop-shadow(0 0 8px rgba(255,230,120,0.7));';
      s.layer.appendChild(el);
      const ang = Math.random() * TAU, dist = _fxRand(40, 120);
      const bx = sx + Math.cos(ang) * dist, by = sy + Math.sin(ang) * dist * 0.8 - 30;
      const mx = (bx + ex) / 2, my = (by + ey) / 2;
      const dx = ex - bx, dy = ey - by, len = Math.hypot(dx, dy) || 1;
      const side = (Math.random() < 0.5 ? -1 : 1) * _fxRand(0.15, 0.45) * len;
      s.icons.push({
        el, kind, sx, sy, bx, by, ex, ey,
        cx: mx + (-dy / len) * side, cy: my + (dx / len) * side,
        t: 0, delay: i * 0.06 + Math.random() * 0.03, burstDur: 0.28, flyDur: _fxRand(0.55, 0.75), done: false,
      });
    }
  },

  /* ---------------- per-frame ---------------- */
  update(dt) {
    const s = _fxS;
    if (!s.ready) return;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    s.time += dt;
    FX._updateParticles(dt);
    FX._updateRings(dt);
    FX._updateTexts(dt);
    FX._updateIcons(dt);
    FX._updateConfetti(dt);
    FX._updateFlash(dt);
    FX._updateShake(dt);
  },

  _updateParticles(dt) {
    const s = _fxS;
    if (s.alive === 0 && !s.dirty) return;
    // keep the point-size scale in sync with the render target
    const cam = (typeof Scene3D !== 'undefined' && Scene3D) ? Scene3D.camera : null;
    if (cam && Scene3D.renderer) {
      Scene3D.renderer.getDrawingBufferSize(s.v2);
      s.mat.uniforms.uScale.value = s.v2.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5));
    }
    const pos = s.pos, vel = s.vel, ttl = s.ttl, ml = s.maxLife, grav = s.grav, drag = s.drag;
    const size = s.size, alpha = s.alpha, bs = s.baseSize, ba = s.baseAlpha, kind = s.kind, ph = s.phase;
    const T = s.time;
    let alive = 0;
    for (let i = 0; i < _fxCap; i++) {
      const life = ttl[i];
      if (life <= 0) continue;
      const nl = life - dt;
      const k = i * 3;
      if (nl <= 0) {
        ttl[i] = 0; alpha[i] = 0; size[i] = 0;
        continue;
      }
      ttl[i] = nl;
      alive++;
      const dr = Math.max(0, 1 - drag[i] * dt);
      vel[k] *= dr; vel[k + 1] = (vel[k + 1] - grav[i] * dt) * dr; vel[k + 2] *= dr;
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
      const t = 1 - nl / ml[i];
      if (kind[i] === 0) {
        const fade = 1 - t;
        alpha[i] = ba[i] * (t < 0.08 ? t / 0.08 : fade * (0.5 + 0.5 * fade) + 0.0);
        size[i] = bs[i] * (1 - 0.55 * t);
      } else {
        const tw = 0.5 + 0.5 * Math.sin(T * 16 + ph[i] * 3);
        const env = Math.sin(Math.PI * t);
        alpha[i] = ba[i] * env * (0.45 + 0.55 * tw);
        size[i] = bs[i] * (0.6 + 0.7 * tw) * (0.5 + 0.5 * env);
      }
    }
    const was = s.alive;
    s.alive = alive;
    if (alive > 0 || was > 0 || s.dirty) {
      s.geo.attributes.position.needsUpdate = true;
      s.geo.attributes.aColor.needsUpdate = true;
      s.geo.attributes.aSize.needsUpdate = true;
      s.geo.attributes.aAlpha.needsUpdate = true;
    }
    s.dirty = false;
    // count freshly emitted particles on the next frame: emit() sets dirty, which keeps us running
    if (alive === 0 && was === 0) s.dirty = false;
  },

  _updateRings(dt) {
    const rs = _fxS.rings;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (!r.active) continue;
      if (r.delay > 0) { r.delay -= dt; if (r.delay > 0) continue; r.mesh.visible = true; }
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const e = Ease.outCubic(k);
      r.mesh.scale.setScalar(0.25 + e * r.size);
      r.mesh.material.opacity = 0.95 * (1 - k) * (1 - k * 0.4);
    }
  },

  _updateTexts(dt) {
    const s = _fxS;
    const texts = s.texts;
    if (!_fxCamOk()) return;
    for (let i = 0; i < texts.length; i++) {
      const tx = texts[i];
      if (!tx.active) continue;
      tx.t += dt;
      const k = tx.t / tx.dur;
      if (k >= 1) { tx.active = false; tx.el.style.display = 'none'; continue; }
      const sc = _fxToScreen(tx.pos);
      if (!sc || !sc.visible) { tx.el.style.opacity = '0'; continue; }
      const rise = Ease.outQuad(k) * 70;
      const pop = k < 0.15 ? Ease.outBack(k / 0.15) : 1;
      const op = k < 0.1 ? k / 0.1 : k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      tx.el.style.opacity = op.toFixed(3);
      tx.el.style.transform = 'translate3d(' + (sc.x + tx.ox).toFixed(1) + 'px,' + (sc.y - rise).toFixed(1) +
        'px,0) translate(-50%,-100%) scale(' + (0.4 + 0.6 * pop).toFixed(3) + ')';
    }
  },

  _updateIcons(dt) {
    const s = _fxS;
    const icons = s.icons;
    for (let i = icons.length - 1; i >= 0; i--) {
      const ic = icons[i];
      ic.t += dt;
      const local = ic.t - ic.delay;
      let x, y, sc, op = 1;
      if (local < 0) { continue; }
      if (local < ic.burstDur) {
        const u = local / ic.burstDur;
        const e = Ease.outCubic(u);
        x = ic.sx + (ic.bx - ic.sx) * e; y = ic.sy + (ic.by - ic.sy) * e;
        sc = 0.3 + 0.9 * Ease.outBack(u);
      } else {
        const v = (local - ic.burstDur) / ic.flyDur;
        if (v >= 1) {
          // arrival
          ic.el.remove();
          icons[i] = icons[icons.length - 1]; icons.pop();
          const tEl = document.querySelector(_fxTargets[ic.kind]);
          if (tEl) _fxBump(tEl.parentElement);
          const now = performance.now();
          if (now - s.lastCoinSfx >= 70) {
            s.lastCoinSfx = now;
            if (typeof Sfx !== 'undefined' && Sfx && Sfx.play) {
              try { Sfx.play(ic.kind === 'coins' ? 'coin' : ic.kind === 'gems' ? 'gem' : 'strength'); } catch (e) { /* ignore */ }
            }
          }
          continue;
        }
        const k = Math.pow(v, 1.7), m = 1 - k;
        x = m * m * ic.bx + 2 * m * k * ic.cx + k * k * ic.ex;
        y = m * m * ic.by + 2 * m * k * ic.cy + k * k * ic.ey;
        sc = lerp(1.2, 0.7, k);
        op = v > 0.9 ? (1 - v) / 0.1 * 0.5 + 0.5 : 1;
      }
      ic.el.style.opacity = op.toFixed(2);
      ic.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + sc.toFixed(2) + ')';
    }
  },

  _updateConfetti(dt) {
    const s = _fxS;
    const ps = s.pieces;
    if (!s.cCanvas || !s.cCtx) return;
    if (ps.length === 0) {
      if (s.cCanvas.parentNode) s.cCanvas.parentNode.removeChild(s.cCanvas);
      return;
    }
    if (s.cW !== window.innerWidth || s.cH !== window.innerHeight) FX._sizeConfetti();
    const ctx = s.cCtx;
    const dpr = s.cCanvas.width / Math.max(1, s.cW);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.cCanvas.width, s.cCanvas.height);
    const H = s.cH;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.t += dt;
      if (p.t >= p.life || p.y > H + 40) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr + 520 * dt;
      if (p.vy > p.term) p.vy += (p.term - p.vy) * Math.min(1, 6 * dt);
      p.sway += p.swayF * dt;
      p.x += (p.vx + Math.sin(p.sway) * p.swayA) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt; p.flip += p.vf * dt;
      const f = Math.cos(p.flip);
      const c = Math.cos(p.rot), sn = Math.sin(p.rot);
      const rem = p.life - p.t;
      ctx.globalAlpha = rem < 0.6 ? rem / 0.6 : 1;
      ctx.setTransform(c * dpr, sn * dpr, -sn * f * dpr, c * f * dpr, p.x * dpr, p.y * dpr);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  },

  _updateFlash(dt) {
    const s = _fxS;
    if (s.flashT <= 0) return;
    s.flashT -= dt;
    if (s.flashT <= 0) { s.flashT = 0; s.flashEl.style.opacity = '0'; return; }
    const k = s.flashT / s.flashDur;
    s.flashEl.style.opacity = (s.flashStr * k * k).toFixed(3);
  },

  _updateShake(dt) {
    const s = _fxS;
    const o = FX.shakeOffset;
    if (s.shakeAmt <= 0.001) {
      s.shakeAmt = 0;
      if (o.x !== 0 || o.y !== 0 || o.z !== 0) o.set(0, 0, 0);
      return;
    }
    const a = s.shakeAmt;
    o.set((Math.random() * 2 - 1) * a * 0.3, (Math.random() * 2 - 1) * a * 0.22, (Math.random() * 2 - 1) * a * 0.12);
    s.shakeAmt *= Math.exp(-7 * dt);
  },

  /* ---------------- Bus wiring ---------------- */
  _subscribe() {
    const s = _fxS;
    const v = s.v3b;

    Bus.on('reward', (d) => {
      if (!_fxCamOk() || !d) return;
      const src = d.source;
      let origin = null;
      if (src === 'catch') origin = _fxChutePos(v);
      else if (src === 'train') origin = _fxHeadPos(v);
      if (!origin) origin = _fxCenter();
      if (d.coins > 0) FX.flyToHud('coins', origin, d.coins);
      if (d.gems > 0) FX.flyToHud('gems', origin, d.gems);
      if (d.strength > 0 && src === 'train') {
        s.trainN++;
        const auto = !!(Game.player && Game.player.training && Game.player.training.auto);
        if (!auto || s.trainN % 4 === 0) FX.flyToHud('strength', origin, 1);
      } else if (d.strength > 0) {
        FX.flyToHud('strength', origin, Math.min(d.strength, 5));
      }
    });

    Bus.on('claw:result', (d) => {
      if (!_fxCamOk() || !d) return;
      const type = d.type;
      if (type === 'win') {
        const animal = (typeof ANIMAL_BY_ID !== 'undefined' && d.entry) ? ANIMAL_BY_ID[d.entry.id] : null;
        const rar = (animal && typeof RARITY_BY_ID !== 'undefined') ? RARITY_BY_ID[animal.rarity] : null;
        const color = rar ? rar.color : '#ffd23f';
        const p = _fxChutePos(v) || _fxMachineTop(v);
        FX.burst(p, color, 40, { speed: 4, up: true });
        FX.sparkle(p, color, 20);
        const id = rar ? rar.id : '';
        if (id === 'legendary' || id === 'mythical' || id === 'secret') {
          FX.confetti(1.5);
          FX.flash(color, 0.5);
          FX.shake(0.25);
        }
      } else {
        const top = _fxMachineTop(v);
        if (type === 'slip') FX.floatText(top, 'Slipped!', '#ff9a2e');
        else if (type === 'miss') FX.floatText(top, 'Missed!', '#b8bcc8');
        else if (type === 'empty') FX.floatText(top, 'Nothing!', '#b8bcc8');
      }
    });

    Bus.on('upgrade:bought', () => {
      if (!_fxCamOk()) return;
      const p = _fxMachineTop(v);
      FX.ring(p, '#ffe14d');
      FX.ring(v.set(p.x, p.y - 0.7, p.z), '#7dfcff', 0.12);
      FX.sparkle(p, '#fff07a', 22);
      FX.shake(0.12);
    });

    Bus.on('world:unlocked', () => {
      if (!_fxCamOk()) return;
      FX.confetti(2);
      FX.flash('#ffffff', 0.5);
    });

    Bus.on('train:rep', (d) => {
      if (!_fxCamOk() || !d) return;
      s.repN++;
      if (d.auto && s.repN % 3 !== 0) return;
      const hp = _fxHeadPos(v);
      if (!hp) return;
      hp.y += 0.45;
      FX.floatText(hp, '+' + fmt(d.gain) + ' 💪', '#ffa63d');
    });

    Bus.on('pet:added', (d) => {
      if (!_fxCamOk() || !d || !d.isNew) return;
      const p = _fxChutePos(v);
      if (p) FX.sparkle(p, '#ffffff', 18);
    });
  },
};
