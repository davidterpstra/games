/* =====================================================================
   Effects: pooled particles (tyre smoke, dust, spray, sparks, splashes)
   in one Points draw call, and tyre marks in one ring-buffer mesh.
   ===================================================================== */
const FX = { points: null, n: 2400, head: 0, p: null, skid: null };

function initFX(scene) {
  const n = FX.n;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('pcol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('psize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const tex = canvasTex(64, 64, (x) => {
    const gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  }, { repeat: false, srgb: false });
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tMap: { value: tex }, uScale: { value: 600 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, uLight: { value: 1 } },
    vertexShader: `attribute vec4 pcol; attribute float psize; uniform float uScale; varying vec4 vC; varying float vFog;
      void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; vFog = -mv.z; }`,
    fragmentShader: `uniform sampler2D tMap; uniform vec3 fogColor; uniform float fogDensity, uLight; varying vec4 vC; varying float vFog;
      void main(){ vec4 t = texture2D(tMap, gl_PointCoord); float a = t.a * vC.a; if (a < 0.01) discard;
        float f = 1.0 - exp(-fogDensity * fogDensity * vFog * vFog);
        vec3 c = mix(vC.rgb * uLight, fogColor, f); gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });
  FX.points = new THREE.Points(g, m);
  FX.points.frustumCulled = false;
  scene.add(FX.points);
  FX.p = [];
  for (let i = 0; i < n; i++) FX.p.push({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 1 });
  initSkids(scene);
}
const _pc = new THREE.Color();
function emit(x, y, z, vx, vy, vz, life, s0, s1, color, alpha, grav = 0, drag = 1.5) {
  const p = FX.p[FX.head]; FX.head = (FX.head + 1) % FX.n;
  p.life = life; p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1;
  _pc.set(color); p.r = _pc.r; p.g = _pc.g; p.b = _pc.b; p.a = alpha; p.grav = grav; p.drag = drag;
}
function updateFX(dt, scene) {
  const g = FX.points.geometry;
  const pos = g.attributes.position.array, col = g.attributes.pcol.array, size = g.attributes.psize.array;
  for (let i = 0; i < FX.n; i++) {
    const p = FX.p[i];
    if (p.life <= 0) { if (col[i * 4 + 3] !== 0) col[i * 4 + 3] = 0; continue; }
    p.life -= dt;
    const k = Math.exp(-p.drag * dt);
    p.vx *= k; p.vy = p.vy * k - p.grav * dt; p.vz *= k;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const t = 1 - p.life / p.max;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    col[i * 4] = p.r; col[i * 4 + 1] = p.g; col[i * 4 + 2] = p.b;
    col[i * 4 + 3] = p.a * Math.min(1, t * 6) * (1 - t);
    size[i] = lerp(p.s0, p.s1, t);
  }
  g.attributes.position.needsUpdate = g.attributes.pcol.needsUpdate = g.attributes.psize.needsUpdate = true;
  const u = FX.points.material.uniforms;
  u.fogColor.value.copy(scene.fog.color); u.fogDensity.value = scene.fog.density;
  u.uLight.value = 0.25 + 0.75 * (1 - Sky.night);
  u.uScale.value = innerHeight * 0.9;
}

/* ---------- tyre marks ---------- */
const SKQ = 6000;
function initSkids(scene) {
  const pos = new Float32Array(SKQ * 4 * 3), col = new Float32Array(SKQ * 4 * 4), idx = new Uint32Array(SKQ * 6);
  for (let q = 0; q < SKQ; q++) { const o = q * 4; idx.set([o, o + 1, o + 2, o + 2, o + 1, o + 3], q * 6); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  FX.skid = { mesh, q: 0, last: new Map(), dirtyFrom: SKQ, dirtyTo: 0 };
}
function skidMark(key, x, y, z, on, strength, rgb) {
  const S = FX.skid;
  if (!on) { S.last.delete(key); return; }
  const L = S.last.get(key);
  S.last.set(key, [x, y, z]);
  if (!L) return;
  const dx = x - L[0], dz = z - L[2], l = Math.hypot(dx, dz);
  if (l < 0.25) { S.last.set(key, L); return; }
  if (l > 5) return;
  const w = 0.13, nx = -dz / l * w, nz = dx / l * w;
  const q = S.q++ % SKQ;
  const g = S.mesh.geometry, P = g.attributes.position.array, C = g.attributes.color.array;
  P.set([L[0] - nx, L[1], L[2] - nz, L[0] + nx, L[1], L[2] + nz, x - nx, y, z - nz, x + nx, y, z + nz], q * 12);
  const a = clamp(strength, 0.15, 0.75);
  for (let v = 0; v < 4; v++) C.set([rgb[0], rgb[1], rgb[2], a], q * 16 + v * 4);
  g.attributes.position.needsUpdate = true;
  g.attributes.color.needsUpdate = true;
}
function clearSkids() {
  const g = FX.skid.mesh.geometry;
  g.attributes.color.array.fill(0);
  g.attributes.color.needsUpdate = true;
  FX.skid.last.clear();
}

/* Per-car effects: called once per frame for each visible car. */
function carEffects(car, dt, near) {
  const sp = car.spec;
  const v = car.speed;
  const surfC = car.surface;
  const S = SURF[surfC];
  const fs = Math.sin(car.h), fc = Math.cos(car.h);
  for (let i = 0; i < 4; i++) {
    const wp = car.wheelPos[i];
    const s = car.wheelSurf[i], WS = SURF[s];
    const paved = s === S_ASPHALT || s === S_PAVED;
    const slip = car.wheelSlip[i];
    const rear = i >= 2;
    const sliding = !car.air && v > 4 && (slip > 0.16 || (rear && car.wheelspin > 0.15 && v < 30) || (car.input.handbrake > 0 && rear && v > 6));
    const key = car.id * 8 + i;
    const onRoad = paved;
    const markY = wp[1] + (onRoad ? 0.11 : 0.05);
    if (near) {
      if (paved) skidMark(key, wp[0], markY, wp[2], sliding, slip * 1.8 + car.wheelspin, [0.03, 0.03, 0.03]);
      else skidMark(key, wp[0], markY, wp[2], !car.air && v > 3 && s !== S_WATER, 0.25 + Math.min(0.4, v / 60), s === S_SNOW ? [0.75, 0.78, 0.82] : [0.18, 0.13, 0.08]);
    }
    if (!near && Math.random() > 0.3) continue;
    // tyre smoke on tarmac
    if (paved && sliding && rear && Math.random() < 0.9 * dt * 60) {
      const k = clamp(slip * 2 + car.wheelspin, 0.3, 1.2);
      emit(wp[0], wp[1] + 0.3, wp[2], car.vx * 0.25 + (Math.random() - 0.5) * 2, 0.6 + Math.random() * 1.2, car.vz * 0.25 + (Math.random() - 0.5) * 2, 1.6 + Math.random() * 1.4, 0.9, 5.5 * k, 0xe8e8ea, 0.32 * k, -0.25, 0.9);
    }
    // dust / dirt / snow roost
    const snowy = (Sky.snowCover || 0) > 0.5;
    if ((!paved || (snowy && v > 15)) && s !== S_WATER && !car.air && v > 6 && rear && Math.random() < Math.min(1, v / 25) * dt * 60 * 0.8) {
      const back = -1.5;
      emit(wp[0], wp[1] + 0.25, wp[2], car.vx * 0.15 - fs * back * 2 + (Math.random() - 0.5) * 2.5, 1 + Math.random() * 2, car.vz * 0.15 - fc * back * 2 + (Math.random() - 0.5) * 2.5, 1.2 + Math.random() * 1.6, 0.8, 4.5 + v * 0.05, snowy ? 0xf4f8ff : WS.dust ?? S.dust ?? 0x9a7a55, snowy ? 0.5 : 0.35, -0.15, 1.1);
      if (Math.random() < 0.4) emit(wp[0], wp[1] + 0.2, wp[2], -fs * v * 0.1 + (Math.random() - 0.5) * 3, 2 + Math.random() * 3, -fc * v * 0.1 + (Math.random() - 0.5) * 3, 0.8, 0.12, 0.12, s === S_SNOW ? 0xffffff : 0x4a3a2a, 0.9, 9.8, 0.4);
    }
    // wet spray
    if (paved && Sky.wet > 0.3 && v > 12 && Math.random() < Sky.wet * dt * 60 * 0.7) {
      emit(wp[0], wp[1] + 0.25, wp[2], car.vx * 0.4 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), car.vz * 0.4 + (Math.random() - 0.5) * 2, 0.7 + Math.random() * 0.6, 0.5, 3 + v * 0.05, 0xc8d0d8, 0.22 * Sky.wet, 1, 1.5);
    }
  }
  // water splash
  if (car.water > 0.1 && v > 3 && Math.random() < dt * 60) {
    for (let k = 0; k < 3; k++) emit(car.x + (Math.random() - 0.5) * 2, car.y + 0.3, car.z + (Math.random() - 0.5) * 2, car.vx * 0.3 + (Math.random() - 0.5) * 4, 3 + Math.random() * 4, car.vz * 0.3 + (Math.random() - 0.5) * 4, 1.0, 0.4, 2.2, 0xdde8ee, 0.55, 9.8, 0.6);
  }
  // exhaust backfire flames on lift-off (player only, see audio pops)
  if (car.pop > 0) {
    car.pop -= dt;
    if (Math.random() < 0.5) emit(car.x - fs * (sp.len / 2 + 0.2), car.y + 0.35, car.z - fc * (sp.len / 2 + 0.2), car.vx - fs * 3, 0.3, car.vz - fc * 3, 0.12, 0.35, 0.05, 0xff9a3a, 0.9, 0, 3);
  }
}
function sparks(x, y, z, n) {
  for (let i = 0; i < n; i++) emit(x, y, z, (Math.random() - 0.5) * 9, 1 + Math.random() * 4, (Math.random() - 0.5) * 9, 0.3 + Math.random() * 0.4, 0.15, 0.04, 0xffc060, 1, 12, 0.5);
}
