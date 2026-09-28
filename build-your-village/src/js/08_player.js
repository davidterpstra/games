/* =====================================================================
   CLIENT: input, player controller, camera
   ===================================================================== */
const Input = {
  keys: new Set(), joy: { x: 0, z: 0, id: null }, ptrs: new Map(), pinchD: 0, hover: { x: 0, y: 0, in: false },
  typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); },
  init(canvas) {
    addEventListener('keydown', (e) => {
      if (this.typing()) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) UI.onKey(k, e);
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); if (e.key.toLowerCase() === 'e') Interact.release(); });
    addEventListener('blur', () => { this.keys.clear(); Interact.release(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: now(), moved: false, button: e.button, type: e.pointerType });
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinchD = Math.hypot(a.x - b.x, a.y - b.y); }
      Audio.unlock();
    });
    canvas.addEventListener('pointermove', (e) => {
      this.hover.x = e.clientX; this.hover.y = e.clientY; this.hover.in = true;
      const p = this.ptrs.get(e.pointerId);
      if (!p) { BuildCtl.onHover(e.clientX, e.clientY); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 7) p.moved = true;
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchD) CameraCtl.zoom((this.pinchD - d) * 0.06);
        this.pinchD = d; return;
      }
      if (BuildCtl.active && p.button === 0 && BuildCtl.onDrag(e.clientX, e.clientY, p)) return;
      if (p.moved) CameraCtl.rotate(dx, dy);
      BuildCtl.onHover(e.clientX, e.clientY);
    });
    const up = (e) => {
      const p = this.ptrs.get(e.pointerId);
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) this.pinchD = 0;
      if (!p) return;
      if (!p.moved && now() - p.t < 0.6) Game.onClick(e.clientX, e.clientY, p.button, p.type);
      BuildCtl.onUp();
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', (e) => { this.ptrs.delete(e.pointerId); BuildCtl.onUp(); });
    canvas.addEventListener('pointerleave', () => { this.hover.in = false; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (BuildCtl.active && e.shiftKey) { BuildCtl.rotate(); return; } CameraCtl.zoom(e.deltaY * 0.012); }, { passive: false });
    // virtual joystick (touch)
    const joy = $('#joy'), knob = $('#joy-knob');
    if (joy) {
      const setJ = (cx, cy) => {
        const r = joy.getBoundingClientRect();
        let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
        const m = Math.hypot(dx, dy), lim = r.width * 0.36;
        if (m > lim) { dx *= lim / m; dy *= lim / m; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joy.x = dx / lim; this.joy.z = dy / lim;
      };
      joy.addEventListener('pointerdown', (e) => { e.stopPropagation(); joy.setPointerCapture(e.pointerId); this.joy.id = e.pointerId; setJ(e.clientX, e.clientY); Audio.unlock(); });
      joy.addEventListener('pointermove', (e) => { if (e.pointerId === this.joy.id) setJ(e.clientX, e.clientY); });
      const end = (e) => { if (e.pointerId !== this.joy.id) return; this.joy.id = null; this.joy.x = 0; this.joy.z = 0; knob.style.transform = ''; };
      joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    }
  },
  moveVec() {
    let x = 0, z = 0;
    if (this.typing()) return [0, 0];
    const K = this.keys;
    if (K.has('w') || K.has('arrowup')) z -= 1;
    if (K.has('s') || K.has('arrowdown')) z += 1;
    if (K.has('a') || K.has('arrowleft')) x -= 1;
    if (K.has('d') || K.has('arrowright')) x += 1;
    x += this.joy.x; z += this.joy.z;
    const m = Math.hypot(x, z);
    if (m > 1) { x /= m; z /= m; }
    return [x, z];
  },
};

const Player = {
  x: 0, z: 0, y: 0, yaw: 0, vy: 0, ent: null, auto: null, lockHintT: 0, stepT: 0, moving: false,
  init() {
    this.x = S.player.x; this.z = S.player.z;
    if (!World.inPlay(this.x, this.z) || !Village.isUnlockedAt(this.x, this.z) || World.isWater(this.x, this.z)) { this.x = START.spawn[0]; this.z = START.spawn[1]; }
    this.y = World.heightAt(this.x, this.z);
    this.ent = Chars.spawn(this.look(), this.x, this.z);
    this.ent.yaw = Math.PI;
  },
  look() {
    const hat = COSMETICS[S.inv.hat] || COSMETICS.hat_none, sh = COSMETICS[S.inv.shirt] || COSMETICS.shirt_leaf;
    return { shirt: sh.col, pants: 0x5a4636, skin: 0xe8b98f, hair: 0x6b4428, hat: hat.hat, hatCol: hat.col };
  },
  refreshLook() { Chars.setLook(this.ent, this.look()); },
  pos() { return new THREE.Vector3(this.x, this.y + 2.2, this.z); },
  speedMul() { return S.buildings.some((b) => b.type === 'stable') ? 1.2 : 1; },
  blocked(nx, nz) {
    if (!World.inPlay(nx, nz)) return 'edge';
    if (!Village.isUnlockedAt(nx, nz)) return 'locked';
    const onB = World.bridgeAt(nx, nz) != null;
    if (!onB && World.groundY(nx, nz) < -0.6) return 'water';
    if (!onB && World.slopeAt(nx, nz) > 1.5 && World.groundY(nx, nz) > World.groundY(this.x, this.z) + 0.05) return 'steep';
    const R = 0.38;
    for (const b of S.buildings) {
      if (BUILDINGS[b.type].road || Math.abs(b.x - nx) > 14 || Math.abs(b.z - nz) > 14) continue;
      const r = BuildingService.rect(b.type, b.x, b.z, b.rot);
      const shrink = ['farm', 'large_farm', 'town_square', 'marketplace', 'large_market', 'harbor'].includes(b.type) ? 99 : 0.25;
      if (shrink === 99) { // open-plan buildings: only their core blocks you
        const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
        if (b.type === 'farm' || b.type === 'large_farm') { const [lx, lz] = BUILDINGS[b.type].size; const [hx, hz] = BuildingService.toWorld(b, -lx * 0.3, -lz * 0.26); if (Math.abs(nx - hx) < 2.4 && Math.abs(nz - hz) < 2.4) return 'building'; }
        else if (b.type === 'town_square' || b.type === 'marketplace') { if (Math.hypot(nx - cx, nz - cz) < 2.2) return 'building'; }
        else if (b.type === 'harbor') { const [hx, hz] = BuildingService.toWorld(b, 0, -3.6); if (Math.abs(nx - hx) < 3.6 && Math.abs(nz - hz) < 3.6) return 'building'; }
        continue;
      }
      if (nx > r.x0 + shrink - R && nx < r.x1 - shrink + R && nz > r.z0 + shrink - R && nz < r.z1 - shrink + R) return 'building';
    }
    const sb = World.blockedStatic(nx, nz, R - 0.15); if (sb && sb.solid) return 'prop';
    for (const n of Nodes.near(nx, nz, 1.2)) {
      const T = NODE_TYPES[n.type];
      if (n.gone || T.soft || T.fish) continue;
      if (Math.hypot(n.x - nx, n.z - nz) < T.r * 0.55 * n.s + R) return 'node';
    }
    for (const c of CAVES) {
      const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz);
      if (d > 10.4 && d < 13.2 && (dx / d) * c.dx + (dz / d) * c.dz < 0.86) return 'wall';
    }
    return null;
  },
  tryMove(dx, dz) {
    const nx = this.x + dx, nz = this.z + dz;
    let why = this.blocked(nx, nz);
    if (!why) { this.x = nx; this.z = nz; return null; }
    if (!this.blocked(this.x + dx, this.z)) { this.x += dx; return why; }
    if (!this.blocked(this.x, this.z + dz)) { this.z += dz; return why; }
    return why;
  },
  update(dt) {
    const [ix, iz] = Input.moveVec();
    const cy = CameraCtl.yaw;
    const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    let mx = rx * ix - fx * iz, mz = rz * ix - fz * iz;
    const inputOn = Math.hypot(mx, mz) > 0.05;
    if (inputOn) { this.auto = null; Interact.cancelAuto(); }
    if (!inputOn && this.auto) {
      const dx = this.auto.x - this.x, dz = this.auto.z - this.z, d = Math.hypot(dx, dz);
      if (d < (this.auto.r || 0.5)) { const cb = this.auto.then; this.auto = null; if (cb) cb(); }
      else { mx = dx / d; mz = dz / d; this.auto.t = (this.auto.t || 0) + dt; if (this.auto.t > 14) this.auto = null; }
    }
    const sprint = Input.keys.has('shift') || Math.hypot(Input.joy.x, Input.joy.z) > 0.92;
    const sp = (sprint ? 9.6 : 6.4) * this.speedMul();
    const m = Math.hypot(mx, mz);
    let speed = 0;
    if (m > 0.05 && !Interact.busy()) {
      const k = Math.min(1, m);
      const why = this.tryMove((mx / m) * sp * k * dt, (mz / m) * sp * k * dt);
      speed = sp * k;
      const ty = Math.atan2(mx, mz);
      let d = ty - this.ent.yaw; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      this.ent.yaw += d * Math.min(1, dt * 12);
      if (why === 'locked' && now() - this.lockHintT > 6) { this.lockHintT = now(); const a = AREAS[areaIdxAt(this.x + (mx / m) * 2, this.z + (mz / m) * 2)]; UI.hint(a && !a.hidden ? `🔒 ${a.name} is locked. Buy it at a For Sale sign (Level ${a.level}).` : '🌊 The world ends here.'); }
      if (why && this.auto) { this.auto.stuck = (this.auto.stuck || 0) + dt; if (this.auto.stuck > 0.8) { const cb = this.auto.near; this.auto = null; if (cb) cb(); } }
    }
    // jump + gravity
    const ground = World.heightAt(this.x, this.z);
    if ((Input.keys.has(' ')) && this.y <= ground + 0.02 && !Input.typing()) { this.vy = 7.5; Audio.sfx('jump'); }
    this.vy -= 24 * dt;
    this.y += this.vy * dt;
    if (this.y < ground) { if (this.vy < -9) { FX.dust(new THREE.Vector3(this.x, ground, this.z), 6); Audio.sfx('step'); } this.y = ground; this.vy = 0; }
    this.moving = speed > 0.1;
    const e = this.ent;
    e.x = this.x; e.z = this.z; e.y = this.y;
    Chars.animate(e, this.y > ground + 0.05 ? 0 : speed, dt);
    // footsteps synced to the walk cycle
    if (this.moving && this.y <= ground + 0.05) {
      const ph = Math.floor(e.anim.ph / Math.PI);
      if (ph !== this.stepT) { this.stepT = ph; Audio.sfx(World.onRoad(this.x, this.z) || World.bridgeAt(this.x, this.z) != null ? 'stepHard' : World.groundY(this.x, this.z) < 0 ? 'splash' : 'step'); }
    }
    // cave shells fade when you are inside
    for (const s of Props.caveShells) {
      const inside = Math.hypot(this.x - s.cave.x, this.z - s.cave.z) < 12.5;
      s.fade = lerp(s.fade, inside ? 0.18 : 1, Math.min(1, dt * 5));
      s.mesh.material.opacity = s.fade; s.mesh.material.depthWrite = s.fade > 0.9;
    }
  },
  walkTo(x, z, r = 0.6, then = null, near = null) { this.auto = { x, z, r, then, near: near || then }; },
};

const CameraCtl = {
  yaw: 0.75, pitch: 0.78, dist: 21, tDist: 21, t: new THREE.Vector3(), shakeT: 0, shakeA: 0, mode: 'title', orbit: 0,
  rotate(dx, dy) {
    const s = S ? S.settings.sens : 1;
    this.yaw -= dx * 0.0065 * s;
    this.pitch = clamp(this.pitch + dy * 0.005 * s, 0.28, 1.36);
  },
  zoom(d) { const max = BuildCtl.active ? 75 : 48; this.tDist = clamp(this.tDist * (1 + d * 0.09), 7, max); },
  shake(a = 0.4, t = 0.4) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); },
  update(dt, cam) {
    if (this.mode === 'title') {
      this.orbit += dt * 0.05;
      const r = 70, x = Math.sin(this.orbit) * r, z = Math.cos(this.orbit) * r;
      cam.position.set(x, 38, z);
      cam.lookAt(0, 3, 0);
      return;
    }
    const tx = Player.x, ty = Player.y + 1.5, tz = Player.z;
    const k = Math.min(1, dt * 9);
    this.t.x += (tx - this.t.x) * k; this.t.y += (ty - this.t.y) * k; this.t.z += (tz - this.t.z) * k;
    this.dist += (this.tDist - this.dist) * Math.min(1, dt * 7);
    const cp = Math.cos(this.pitch);
    let x = this.t.x + Math.sin(this.yaw) * cp * this.dist, z = this.t.z + Math.cos(this.yaw) * cp * this.dist, y = this.t.y + Math.sin(this.pitch) * this.dist;
    const gy = World.heightAt(x, z) + 1.4;
    if (y < gy) y = gy;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, this.shakeT) * 2;
      x += (Math.random() - 0.5) * a; y += (Math.random() - 0.5) * a; z += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeA = 0;
    }
    cam.position.set(x, y, z);
    cam.lookAt(this.t.x, this.t.y, this.t.z);
  },
  snap() { this.t.set(Player.x, Player.y + 1.5, Player.z); this.dist = this.tDist; },
};
