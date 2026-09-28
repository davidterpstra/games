/* =====================================================================
   CLIENT FX: particles, ambient motes/fireflies, rain, lamps & glow,
   chimney smoke, sky dome + day/night cycle, clouds, quest marker.
   ===================================================================== */
const FX = {
  MAX: 1400, pts: null, alive: 0, pos: null, col: null, size: null, P: [], lampsDirty: true, smokeT: 0, fireT: 0,
  init(scene) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.MAX * 3); this.col = new Float32Array(this.MAX * 4); this.size = new Float32Array(this.MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: innerHeight / 2 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; varying vec4 vCol; uniform float uScale;
        void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = abs(aSize) * uScale / -mv.z; gl_Position = projectionMatrix * mv; if (aSize < 0.0) vCol.a = -vCol.a; }`,
      fragmentShader: `varying vec4 vCol; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float a = vCol.a;
        if (a < 0.0) { if (d > 0.5) discard; a = -a * smoothstep(0.5, 0.1, d); }
        else { if (max(abs(c.x), abs(c.y)) > 0.42) discard; }
        gl_FragColor = vec4(vCol.rgb, a); }`,
      transparent: true, depthWrite: false,
    });
    this.mat = m;
    this.pts = new THREE.Points(g, m);
    this.pts.frustumCulled = false; this.pts.renderOrder = 6;
    scene.add(this.pts);
    for (let i = 0; i < this.MAX; i++) this.P.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1, s: 0.3, grav: 9, kind: 0, grow: 0, drag: 0 });
    this.initAmbient(scene); this.initRain(scene); this.initLamps(scene); this.initMarker(scene);
  },
  spawn(o) {
    if (this.alive >= this.MAX) return;
    const p = this.P[this.alive++];
    Object.assign(p, o);
    p.life = o.life; p.max = o.life;
  },
  burst(pos, o) {
    const n = Math.ceil((o.n || 8) * (Game.quality === 'low' ? 0.5 : 1));
    const cols = Array.isArray(o.color) ? o.color : [o.color || 0xffffff];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.set(cols[i % cols.length]);
      const a = Math.random() * TAU, sp = (o.speed || 3) * (0.4 + Math.random() * 0.8);
      this.spawn({ x: pos.x + (Math.random() - 0.5) * (o.spread || 0.4), y: pos.y + (Math.random() - 0.5) * (o.spread || 0.4), z: pos.z + (Math.random() - 0.5) * (o.spread || 0.4), vx: Math.cos(a) * sp, vy: (o.up || 2) * (0.5 + Math.random()), vz: Math.sin(a) * sp, life: (o.life || 1) * (0.7 + Math.random() * 0.6), r: c.r, g: c.g, b: c.b, s: (o.size || 0.3) * (0.7 + Math.random() * 0.6), grav: o.gravity == null ? 9 : o.gravity, kind: o.kind || 0, grow: o.grow || 0, drag: o.drag || 0 });
    }
  },
  dust(pos, n = 10) { this.burst(pos, { n, color: [0xd9c8a4, 0xc9b58f, 0xe8dcc0], speed: 2.4, up: 1.2, gravity: 0.6, life: 1.1, size: 0.8, kind: 1, grow: 1.2, drag: 2 }); },
  sparkle(pos, n = 16) { this.burst(pos, { n, color: [0xfff1a8, 0xffffff, 0xffd166], speed: 2.5, up: 3, gravity: -0.5, life: 1.3, size: 0.4, kind: 1, drag: 1.5 }); },
  confetti(pos, n = 40) { this.burst(pos, { n, color: [0xef6f6c, 0xffd166, 0x6fc3df, 0x9b7fe6, 0x7fd17a, 0xffffff], speed: 5, up: 7, gravity: 6, life: 2.4, size: 0.32, drag: 1.2, spread: 1 }); },
  smoke(pos) { this.spawn({ x: pos.x + (Math.random() - 0.5) * 0.2, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.2, vx: 0.25 + Math.random() * 0.3, vy: 0.9 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.3, life: 3.2, r: 0.86, g: 0.86, b: 0.88, s: 0.7, grav: -0.05, kind: 1, grow: 1.1, drag: 0.3 }); },
  flame(pos, big = 1) { const c = new THREE.Color(pick([0xff9a3c, 0xffc766, 0xff6a2a])); this.spawn({ x: pos.x + (Math.random() - 0.5) * 0.35 * big, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.35 * big, vx: (Math.random() - 0.5) * 0.4, vy: 1.4 + Math.random() * big, vz: (Math.random() - 0.5) * 0.4, life: 0.55, r: c.r, g: c.g, b: c.b, s: 0.5 * big, grav: -1, kind: 1, grow: -0.6, drag: 0.5 }); },
  update(dt, cam) {
    const P = this.P;
    for (let i = 0; i < this.alive; i++) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { const last = P[--this.alive]; P[this.alive] = p; P[i] = last; i--; continue; }
      p.vy -= p.grav * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vz *= k; if (p.grav <= 1) p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.grav > 2) { const gy = World.heightAt(p.x, p.z); if (p.y < gy + 0.05) { p.y = gy + 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } }
      p.s = Math.max(0.02, p.s + p.grow * dt);
    }
    const n = this.alive;
    for (let i = 0; i < n; i++) {
      const p = P[i], k = p.life / p.max;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const a = Math.min(1, k * 2.2) * (p.kind === 1 ? 0.75 : 1);
      this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.g; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = p.kind === 1 ? -a : a;
      this.size[i] = p.s;
    }
    const g = this.pts.geometry;
    g.setDrawRange(0, n);
    if (n) { g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true; }
    this.mat.uniforms.uScale.value = innerHeight / 2 / Math.tan((cam.fov * Math.PI) / 360) * 0.5;
    // emitters: chimney smoke, forges, campfire (only near the camera)
    this.smokeT -= dt; this.fireT -= dt;
    const cx = Player.x, cz = Player.z, night = DayNight.night;
    if (this.smokeT <= 0) {
      this.smokeT = 0.45;
      for (const [id, pts] of BuildRender.smokes) {
        const b = BuildingService.byId(id); if (!b || Math.abs(b.x - cx) > 70 || Math.abs(b.z - cz) > 70) continue;
        const cfg = BUILDINGS[b.type];
        const active = cfg.house ? Village.residentsOf(id).length > 0 || b.type === 'home' : Village.workersOf(id).length > 0 || b.type === 'home';
        if (active && Math.random() < 0.8) for (const p of pts) this.smoke(p);
      }
    }
    if (this.fireT <= 0) {
      this.fireT = 0.07;
      for (const [id, pts] of BuildRender.fires) { const b = BuildingService.byId(id); if (!b || Math.abs(b.x - cx) > 50 || Math.abs(b.z - cz) > 50) continue; for (const p of pts) if (Math.random() < 0.5) this.flame(p, 0.5); }
      if (Props.fires) for (const p of Props.fires) if (Math.abs(p.x - cx) < 50 && Math.abs(p.z - cz) < 50) this.flame(p, 0.8);
    }
    this.updateAmbient(dt, cam, night);
    this.updateRain(dt, cam);
    this.updateLamps(dt, cam, night);
    this.updateMarker(dt);
  },

  /* ---- ambient motes (day pollen / night fireflies), GPU animated ---- */
  initAmbient(scene) {
    const N = 360, p = new Float32Array(N * 3), s = new Float32Array(N);
    for (let i = 0; i < N; i++) { p[i * 3] = Math.random() * 70; p[i * 3 + 1] = Math.random() * 12; p[i * 3 + 2] = Math.random() * 70; s[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    this.ambMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uNight: { value: 0 }, uScale: { value: 300 } },
      vertexShader: `attribute float aSeed; uniform float uTime; uniform vec3 uCam; uniform float uNight; uniform float uScale; varying float vA; varying float vSeed;
        void main(){ vec3 p = position; p.x += sin(uTime * 0.3 + aSeed * 30.0) * 2.0 + uTime * 0.4; p.z += cos(uTime * 0.25 + aSeed * 20.0) * 2.0; p.y += sin(uTime * (0.5 + aSeed) + aSeed * 9.0) * 0.8;
          vec3 w = mod(p - uCam + 35.0, 70.0) - 35.0 + uCam; w.y = uCam.y - 6.0 + mod(p.y, 12.0);
          vec4 mv = modelViewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5 * sin(uTime * (2.0 + aSeed * 3.0) + aSeed * 40.0);
          vA = mix(0.35, tw, uNight) * smoothstep(60.0, 20.0, -mv.z); vSeed = aSeed;
          gl_PointSize = mix(0.12, 0.28, uNight) * uScale / -mv.z; }`,
      fragmentShader: `uniform float uNight; varying float vA; varying float vSeed; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          vec3 c = mix(vec3(1.0, 0.97, 0.85), vec3(0.85, 1.0, 0.45), uNight); gl_FragColor = vec4(c, vA * smoothstep(0.5, 0.0, d) * (uNight > 0.5 ? 1.0 : step(0.55, vSeed))); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.amb = new THREE.Points(g, this.ambMat); this.amb.frustumCulled = false; scene.add(this.amb);
  },
  updateAmbient(dt, cam, night) {
    this.ambMat.uniforms.uCam.value.set(Player.x, Player.y + 3, Player.z);
    this.ambMat.uniforms.uNight.value = night;
    this.ambMat.uniforms.uScale.value = innerHeight / 2 / Math.tan((cam.fov * Math.PI) / 360);
    this.amb.visible = Game.quality !== 'low' || night > 0.5;
  },

  /* ---- rain ---- */
  rainAmt: 0,
  initRain(scene) {
    const N = 900, p = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = Math.random() * 60, y = Math.random() * 30, z = Math.random() * 60; p.set([x, y, z, x - 0.08, y + 0.9, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.rainMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 } },
      vertexShader: `uniform float uTime; uniform vec3 uCam; varying float vA; void main(){ vec3 p = position; p.y -= uTime * 26.0; p.x -= uTime * 2.0;
        vec3 w = mod(p - uCam + vec3(30.0, 15.0, 30.0), vec3(60.0, 30.0, 60.0)) - vec3(30.0, 15.0, 30.0) + uCam; vec4 mv = modelViewMatrix * vec4(w, 1.0); vA = smoothstep(45.0, 5.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uAmt; varying float vA; void main(){ gl_FragColor = vec4(0.75, 0.82, 0.92, 0.45 * uAmt * vA); }`,
      transparent: true, depthWrite: false,
    });
    this.rain = new THREE.LineSegments(g, this.rainMat); this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
  },
  updateRain(dt, cam) {
    const want = EventService.is('rain') ? 1 : 0;
    this.rainAmt += (want - this.rainAmt) * Math.min(1, dt * 0.5);
    this.rain.visible = this.rainAmt > 0.02;
    this.rainMat.uniforms.uAmt.value = this.rainAmt;
    this.rainMat.uniforms.uCam.value.copy(cam.position);
    U.uWind.value = 1 + this.rainAmt * 1.4;
  },

  /* ---- lamps: glow sprites + a small pool of real point lights ---- */
  initLamps(scene) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'); const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,230,170,1)'); gr.addColorStop(0.25, 'rgba(255,200,110,0.55)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    this.glowMat = new THREE.PointsMaterial({ map: tex, size: 3.2, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.glowPts = new THREE.Points(new THREE.BufferGeometry(), this.glowMat); this.glowPts.frustumCulled = false; this.glowPts.renderOrder = 7;
    scene.add(this.glowPts);
    this.plights = [];
    const n = Game.quality === 'high' ? 4 : Game.quality === 'medium' ? 2 : 0;
    for (let i = 0; i < n; i++) { const L = new THREE.PointLight(0xffb45a, 0, 16, 1.6); scene.add(L); this.plights.push(L); }
  },
  allLamps() {
    const out = World.lanterns.slice();
    for (const pts of BuildRender.lights.values()) for (const p of pts) out.push(p);
    return out;
  },
  updateLamps(dt, cam, night) {
    if (this.lampsDirty) {
      this.lampsDirty = false;
      const L = this.allLamps();
      const arr = new Float32Array(L.length * 3); L.forEach((p, i) => arr.set([p.x, p.y, p.z], i * 3));
      this.glowPts.geometry.dispose();
      this.glowPts.geometry = new THREE.BufferGeometry(); this.glowPts.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this._lamps = L;
    }
    this.glowMat.opacity = night * (0.85 + Math.sin(U.uTime.value * 7) * 0.04);
    this.glowPts.visible = night > 0.02;
    // assign point lights to the nearest lamps
    this._plT = (this._plT || 0) - dt;
    if (this.plights.length && this._plT <= 0) {
      this._plT = 0.25;
      const L = this._lamps || [];
      const px = Player.x, pz = Player.z;
      const near = L.map((p) => [p, (p.x - px) ** 2 + (p.z - pz) ** 2]).sort((a, b) => a[1] - b[1]);
      const ev = EventService.active;
      let fireLight = null;
      if (ev && ev.id === 'fire' && ev.b && !ev.done) { const b = BuildingService.byId(ev.b); if (b) fireLight = new THREE.Vector3(b.x, b.y + 3, b.z); }
      this.plights.forEach((l, i) => {
        if (i === 0 && fireLight) { l.position.copy(fireLight); l.intensity = 30 + Math.random() * 15; l.color.setHex(0xff7a2a); l.distance = 22; return; }
        const q = near[i];
        l.color.setHex(0xffb45a); l.distance = 16;
        if (q && night > 0.05) { l.position.copy(q[0]); l.intensity = night * 14 * (0.93 + Math.random() * 0.07); } else l.intensity = 0;
      });
    }
  },

  /* ---- quest marker (floating gem over the current target) ---- */
  initMarker(scene) {
    const g = new THREE.OctahedronGeometry(0.45, 0); g.scale(1, 1.5, 1);
    this.marker = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false }));
    this.marker.visible = false; this.marker.renderOrder = 8;
    scene.add(this.marker);
  },
  markerTarget: null,
  updateMarker(dt) {
    const m = this.marker, t = this.markerTarget;
    if (!t) { m.visible = false; return; }
    m.visible = true;
    m.position.set(t.x, t.y + 1.2 + Math.sin(U.uTime.value * 3) * 0.25, t.z);
    m.rotation.y += dt * 2;
  },
};

/* =====================================================================
   Sky + day/night cycle
   ===================================================================== */
const DayNight = {
  night: 0, sun: null, hemi: null, sky: null, stars: null, clouds: null, moon: null, shadowT: 0,
  keys: [
    // hour, skyTop, skyHorizon, fog, sunColor, sunInt, hemiSky, hemiGround, hemiInt
    [0, 0x0f1c40, 0x2a3a62, 0x1f2c4a, 0xa6b8ff, 0.8, 0x7082c0, 0x2c2e40, 1.15],
    [4.8, 0x14224a, 0x33436c, 0x26345a, 0xa6b8ff, 0.75, 0x7082c0, 0x2c2e40, 1.1],
    [6.0, 0x3f5f9a, 0xf2a66a, 0xe7b08a, 0xffb070, 1.2, 0x9ab4d8, 0x6a5a48, 0.8],
    [7.5, 0x5b9fe0, 0xcfe6f5, 0xcfe3ee, 0xfff0d6, 2.3, 0xbfe0ff, 0x7a6a4a, 1.05],
    [12, 0x4a94e0, 0xd5ebf7, 0xd4e8f2, 0xfff6e6, 2.7, 0xc7e4ff, 0x7d6c4c, 1.15],
    [17, 0x5a9adb, 0xe6e4d6, 0xe0e0d4, 0xffe6c0, 2.3, 0xc0dcf5, 0x7a6a4a, 1.05],
    [19.2, 0x4a5c9c, 0xf59a5c, 0xe9a27a, 0xff9a5a, 1.3, 0x9aa4c8, 0x5e4c40, 0.85],
    [20.6, 0x22306a, 0x5e5288, 0x3a3e64, 0xa6b8ff, 0.8, 0x7a86c0, 0x30303e, 1.1],
    [22, 0x0f1c40, 0x2a3a62, 0x1f2c4a, 0xa6b8ff, 0.8, 0x7082c0, 0x2c2e40, 1.15],
    [24, 0x0f1c40, 0x2a3a62, 0x1f2c4a, 0xa6b8ff, 0.8, 0x7082c0, 0x2c2e40, 1.15],
  ],
  init(scene) {
    this.hemi = new THREE.HemisphereLight(0xc7e4ff, 0x7d6c4c, 1.1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff6e6, 2.6);
    this.sun.castShadow = Game.quality !== 'low';
    const sz = Game.quality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun); scene.add(this.sun.target);
    // sky dome
    const sg = new THREE.SphereGeometry(900, 24, 12);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uNight; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y, -0.2, 1.0); vec3 c = mix(uHor, uTop, pow(smoothstep(-0.05, 0.6, h), 0.8));
          float s = max(dot(normalize(vDir), normalize(uSun)), 0.0);
          c += uSunCol * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.25) * (1.0 - uNight * 0.6);
          vec3 moonDir = normalize(-uSun + vec3(0.0, 0.3, 0.0)); float m = max(dot(normalize(vDir), moonDir), 0.0);
          c += vec3(0.9, 0.93, 1.0) * smoothstep(0.9993, 0.9996, m) * uNight;
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(sg, this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; scene.add(this.sky);
    // stars
    const N = 900, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = Math.random() * TAU, v = Math.random() * 0.9 + 0.08; const r = 800; sp.set([Math.cos(u) * Math.cos(Math.asin(v)) * r, v * r, Math.sin(u) * Math.cos(Math.asin(v)) * r], i * 3); }
    const stg = new THREE.BufferGeometry(); stg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(stg, this.starMat); this.stars.frustumCulled = false; scene.add(this.stars);
    // low-poly clouds
    const cg = new GB();
    cg.ico(4, 0xffffff, 0, 0, 0, 1.4, 0.7, 1, 0, 0.2).ico(3, 0xf4f7fb, 3.5, 0.6, 0.5, 1.2, 0.8, 1, 0, 0.2).ico(3.2, 0xf4f7fb, -3.8, 0.2, -0.4, 1.2, 0.7, 1, 0, 0.2).ico(2.4, 0xffffff, 1, 1.9, -0.6, 1, 0.8, 1, 0, 0.2);
    this.cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.92, emissive: 0x404850, fog: false });
    this.clouds = new THREE.InstancedMesh(cg.build().main, this.cloudMat, 16);
    this.cloudData = [];
    for (let i = 0; i < 16; i++) this.cloudData.push({ x: randRange(-300, 300), z: randRange(-300, 300), y: randRange(70, 95), s: randRange(1.2, 2.6), sp: randRange(1.5, 3) });
    this.clouds.frustumCulled = false; scene.add(this.clouds);
    this.fog = new THREE.Fog(0xd4e8f2, 110, 380);
    scene.fog = this.fog;
  },
  sample(h) {
    const K = this.keys;
    let i = 0; while (i < K.length - 2 && K[i + 1][0] <= h) i++;
    const a = K[i], b = K[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    const c = (k) => new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
    return { top: c(1), hor: c(2), fog: c(3), sunCol: c(4), sunInt: lerp(a[5], b[5], t), hs: c(6), hg: c(7), hi: lerp(a[8], b[8], t) };
  },
  update(dt, cam) {
    const h = S.time.hour;
    const k = this.sample(h);
    const rain = FX.rainAmt;
    const grey = new THREE.Color(0x8c96a0);
    if (rain > 0.01) { k.top.lerp(grey, rain * 0.6); k.hor.lerp(grey, rain * 0.6); k.fog.lerp(grey, rain * 0.6); k.sunInt *= 1 - rain * 0.55; }
    this.night = 1 - Clock.daylight();
    // sun travels east -> west; at night the same light becomes the moon
    const a = ((h - 6) / 12) * Math.PI;
    const day = Math.sin(a) > -0.05;
    const dir = day ? new THREE.Vector3(Math.cos(a) * 0.85, Math.max(0.12, Math.sin(a)), 0.45) : new THREE.Vector3(-Math.cos(a) * 0.7, Math.max(0.25, -Math.sin(a) * 0.9), -0.35);
    dir.normalize();
    this.sun.color.copy(k.sunCol); this.sun.intensity = k.sunInt;
    const tx = Math.round(Player.x / 4) * 4, tz = Math.round(Player.z / 4) * 4;
    this.sun.position.set(tx + dir.x * 120, dir.y * 120, tz + dir.z * 120);
    this.sun.target.position.set(tx, 0, tz);
    this.sun.target.updateMatrixWorld();
    this.hemi.color.copy(k.hs); this.hemi.groundColor.copy(k.hg); this.hemi.intensity = k.hi;
    this.skyMat.uniforms.uTop.value.copy(k.top); this.skyMat.uniforms.uHor.value.copy(k.hor);
    this.skyMat.uniforms.uSun.value.copy(new THREE.Vector3(Math.cos(a) * 0.85, Math.sin(a), 0.45).normalize());
    this.skyMat.uniforms.uSunCol.value.copy(k.sunCol); this.skyMat.uniforms.uNight.value = this.night;
    this.sky.position.copy(cam.position); this.stars.position.copy(cam.position);
    this.starMat.opacity = this.night * (1 - rain);
    this.fog.color.copy(k.fog);
    Game.renderer.setClearColor(k.fog);
    this.cloudMat.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x7c86a8), this.night * 0.8).lerp(grey, rain * 0.5);
    this.cloudMat.emissive.copy(k.hor).multiplyScalar(0.25 + (1 - this.night) * 0.2);
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      c.x += c.sp * dt; if (c.x > 360) c.x = -360;
      composeM(c.x, c.y, c.z, i, c.s, c.s * 0.8); this.clouds.setMatrixAt(i, _cm);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    // windows light up at night
    Mats.windowGlow.color.setRGB(0.24, 0.3, 0.38).lerp(new THREE.Color(1.0, 0.82, 0.5), this.night);
    // shadows only refresh when something moved (big win on weak GPUs)
    this.shadowT -= dt;
    const moved = Math.abs(tx - (this._stx || 0)) + Math.abs(tz - (this._stz || 0)) > 0;
    if (this.sun.castShadow && (moved || this.shadowT <= 0 || BuildRender.animating() || Nodes.dynamic.length)) {
      Game.renderer.shadowMap.needsUpdate = true; this.shadowT = 0.3; this._stx = tx; this._stz = tz;
    }
  },
};
