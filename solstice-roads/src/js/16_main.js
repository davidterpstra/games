/* =====================================================================
   Boot, render loop, quality presets, game state.
   ===================================================================== */
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.08 }, uCon: { value: 1.05 }, uVig: { value: 0.28 }, uWarm: { value: 0.02 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uCon, uVig, uWarm, uTime; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.5) * uCon + 0.5;
      // split-tone: warm highlights, cool shadows
      c.rgb += vec3(uWarm, uWarm * 0.4, -uWarm) * smoothstep(0.45, 1.0, l) + vec3(-0.01, 0.0, 0.015) * (1.0 - smoothstep(0.0, 0.35, l));
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      // fine film grain against banding
      float n = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.012;
      gl_FragColor = c;
    }`,
};

const Game = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null, grade: null,
  settings: { ...DEFAULT_SETTINGS, music: 0.55, difficulty: 'normal', touch: 'auto' },
  mode: 'loading', paused: false, started: false,
  player: null, playerModel: null, carIdx: 0, paint: 0, ai: [], acc: 0, clock: new THREE.Clock(),
  dprNow: 1, perf: { t: 0, n: 0, low: 0, high: 0 }, lodT: 0, menuSpot: null, displayCars: [], stuckT: 0, waterT: 0,
};

function setupRenderer() {
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.setSize(innerWidth, innerHeight);
  $('game').replaceWith(r.domElement);
  r.domElement.id = 'game';
  Game.renderer = r;
  Game.scene = new THREE.Scene();
  Game.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.25, 2200);
  Game.scene.add(Game.camera);
  addEventListener('resize', onResize);
}
function onResize() {
  const r = Game.renderer;
  r.setSize(innerWidth, innerHeight);
  Game.camera.aspect = innerWidth / innerHeight;
  Game.camera.updateProjectionMatrix();
  if (Game.composer) Game.composer.setSize(innerWidth, innerHeight);
  if (Game.bloom) Game.bloom.setSize(innerWidth, innerHeight);
}
function buildComposer(q) {
  if (Game.composer) { Game.composer.renderTarget1.dispose(); Game.composer.renderTarget2.dispose(); Game.composer = null; }
  if (!q.post) return;
  const r = Game.renderer;
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: q.msaa });
  const c = new EffectComposer(r, rt);
  c.setPixelRatio(r.getPixelRatio());
  c.setSize(innerWidth, innerHeight);
  c.addPass(new RenderPass(Game.scene, Game.camera));
  Game.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.6, 0.92);
  c.addPass(Game.bloom);
  c.addPass(new OutputPass());
  Game.grade = new ShaderPass(GRADE_SHADER);
  c.addPass(Game.grade);
  Game.composer = c;
}
Game.applySettings = function () {
  const s = Game.settings, q = QUALITY[s.quality] || QUALITY.high;
  const r = Game.renderer;
  Game.q = q;
  Sky.q = q;
  const base = Math.min(devicePixelRatio || 1, q.dpr) * s.resScale;
  Game.dprBase = base;
  if (!s.autoRes || !Game.dprNow || Game.dprNow > base) Game.dprNow = base;
  r.setPixelRatio(Game.dprNow);
  const wantShadows = q.shadows > 0;
  if (r.shadowMap.enabled !== wantShadows || Sky.sun.shadow.mapSize.x !== q.shadows) {
    r.shadowMap.enabled = wantShadows;
    Sky.sun.castShadow = wantShadows;
    if (wantShadows) {
      Sky.sun.shadow.mapSize.set(q.shadows, q.shadows);
      const ext = q.shadows >= 4096 ? 120 : q.shadows >= 2048 ? 90 : 65;
      Object.assign(Sky.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 700 });
      Sky.sun.shadow.camera.updateProjectionMatrix();
      if (Sky.sun.shadow.map) { Sky.sun.shadow.map.dispose(); Sky.sun.shadow.map = null; }
    }
    Game.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  }
  if (Game.q !== Game.lastQ) { buildComposer(q); Game.lastQ = q; }
  if (Game.composer) Game.composer.setPixelRatio(Game.dprNow);
  setGrassCount(q.grass, q.grass >= 60000 ? 72 : q.grass >= 30000 ? 58 : 44);
  Game.camera.far = q.view + 300;
  Game.camera.updateProjectionMatrix();
  updateVegetation(Game.camera.position.x, Game.camera.position.z, q);
  for (const c of Terrain.chunks) c.lod = -1;
  if (Sky.target && Sky.target.id !== s.weather) setWeather(s.weather);
  camSetMode(s.camera | 0, Game.camera);
  $('fps').hidden = !s.showFps;
  updateTouchUI();
  applyVolumes();
};

Game.spawnAI = function (spec, paint) {
  const v = new Vehicle(spec, false);
  v.id = 10 + Game.ai.length;
  const model = makeCar(spec, paint);
  Game.scene.add(model.root);
  v.model = model;
  v.driverName = ['A. Hale', 'R. Okafor', 'M. Lindqvist', 'S. Patel', 'J. Moreau', 'K. Tanaka', 'E. Byrne'][Game.ai.length % 7];
  Game.ai.push(v);
  return v;
};
Game.clearAI = function () {
  for (const v of Game.ai) { Game.scene.remove(v.model.root); v.model.dispose(); }
  Game.ai = [];
  Race.ai = [];
  Race.cars = [];
};
Game.setPlayerCar = function (idx, paint) {
  const spec = CARS[idx];
  const old = Game.player;
  Game.carIdx = idx; Game.paint = paint;
  if (Game.playerModel) { Game.scene.remove(Game.playerModel.root); Game.playerModel.dispose(); }
  const v = new Vehicle(spec, true);
  v.id = 1;
  if (old) v.reset(old.x, old.z, old.h);
  Game.player = v;
  Game.playerModel = makeCar(spec, paint, { lights: true });
  Game.scene.add(Game.playerModel.root);
  v.sync(Game.playerModel, 1, Cam.mode);
};

function startFreeRoam(silent) {
  Game.started = true;
  const s = Game.menuSpot;
  Game.player.reset(s.x, s.z, s.h);
  camReset(Game.player);
  clearSkids();
  if (!silent) {
    resumeGame();
    setTimeout(() => notify('Welcome to the Solstice Festival', 'Drive to a light column and press E to start an event', 'info', 5200), 600);
    setTimeout(() => notify(`Now playing: ${TRACKS[0].title}`, 'Festival radio · N to toggle', 'radio', 4000), 2200);
  }
}
function resetPlayer() {
  const p = Game.player;
  if (Race.ev) {
    if (Race.phase === 'countdown') return;
    const R = Race.route;
    const i = nearestRouteIdx(R, p.x, p.z, Race.pIdx ?? 0, 30, 30).i;
    const pt = routeAt(R, R.cum[i]);
    p.reset(pt.x, pt.z, pt.h);
    p.race.px = p.x; p.race.pz = p.z;
  } else resetToRoad(p);
  camReset(p);
  breakChain();
}
function interact() {
  const p = Game.player;
  if (Race.ev) return;
  const m = nearestMarker(p, 16);
  if (!m) return;
  if (m.garage) { Game.paused = true; openGarage(); return; }
  if (m.ev && m.ev.route) fadeTo(() => raceSetup(m.ev));
}
function nearestMarker(p, R) {
  let best = null, bd = R;
  for (const m of Events.markers) { const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < bd) { bd = d; best = m; } }
  return best;
}

/* ---------- boot ---------- */
async function boot() {
  Save.load();
  if (Save.data.settings) Object.assign(Game.settings, Save.data.settings);
  Game.carIdx = clamp(Save.data.car | 0, 0, CARS.length - 1);
  const bar = $('loadBar'), txt = $('loadTxt');
  const progress = (f, t) => { bar.style.width = Math.round(f * 100) + '%'; if (t) txt.textContent = t; };
  setupRenderer();
  initSky(Game.scene, Game.renderer);
  setWeather(Game.settings.weather, true);
  initPropMaterials();
  initCarMaterials();
  await generateWorld(progress);
  progress(0.7, 'Mapping woodland'); await frameYield();
  buildTreeDensityGrid();
  progress(0.72, 'Building terrain'); await frameYield();
  buildTerrainMesh();
  Game.scene.add(Terrain.group);
  progress(0.78, 'Painting roads'); await frameYield();
  buildRoadMeshes();
  Game.scene.add(RoadGfx.group);
  progress(0.82, 'Planting woodland'); await frameYield();
  buildVegetation(QUALITY[Game.settings.quality] || QUALITY.high);
  buildGrass();
  progress(0.87, 'Building villages'); await frameYield();
  buildVillages();
  buildLamps();
  buildWater();
  Game.scene.add(Props.group);
  progress(0.9, 'Setting up the festival'); await frameYield();
  buildFestival();
  Game.scene.add(Festival.group);
  prepareEvents();
  buildMarkers(Game.scene);
  progress(0.94, 'Drawing maps'); await frameYield();
  buildWorldMap();
  initHud();
  initFX(Game.scene);
  // display cars on the festival turntables + in the second garage
  const pick = [2, 4, 5, 6, 1];
  Festival.turntables.forEach((t, i) => {
    const c = CARS[pick[i % pick.length]];
    const m = makeCar(c, c.col);
    m.root.position.set(t.x, t.y, t.z);
    t.car = m.root;
    m.blob.visible = false;
    Game.scene.add(m.root);
  });
  if (Festival.displaySpots[1]) { const sp = Festival.displaySpots[1]; const m = makeCar(CARS[3], 0xff2d78); m.root.position.set(sp.x, sp.y, sp.z); m.root.rotation.y = sp.h + Math.PI + 0.5; Game.scene.add(m.root); }
  // player
  const ms = { x: PLAZA.x + 22, z: PLAZA.z - 30 };
  Game.menuSpot = { x: ms.x, z: ms.z, h: Math.atan2(NODES.FS[0] - ms.x, NODES.FS[1] - ms.z) };
  Game.paint = Save.data.paint[CARS[Game.carIdx].id] ?? CARS[Game.carIdx].col;
  Game.setPlayerCar(Game.carIdx, Game.paint);
  Game.player.reset(Game.menuSpot.x, Game.menuSpot.z, Game.menuSpot.h);
  // world materials: the sky environment should add reflections, not wash out sun shadows
  Game.scene.traverse((o) => {
    if (!o.material || o === Game.playerModel.root) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.userData.keepEnv && m.envMapIntensity === 1) m.envMapIntensity = 0.32;
    }
  });
  Terrain.material.envMapIntensity = 0.22;
  for (const m of RoadGfx.materials) m.envMapIntensity = 0.45;
  for (const m of Props.waterMats) m.envMapIntensity = 1.3;
  Game.applySettings();
  progress(0.98, 'Warming up engines'); await frameYield();
  Bus.on('hit', (e) => {
    if (e.car === Game.player || e.other === Game.player) {
      SFX.hit(e.v); Cam.trauma = Math.min(1, Cam.trauma + e.v / 25);
      if (e.v > 6) { sparks(Game.player.x, Game.player.y + 0.5, Game.player.z, Math.min(30, e.v * 2)); breakChain(); }
    }
  });
  Bus.on('land', (e) => { if (e.car === Game.player) { SFX.land(e.v); Cam.trauma = Math.min(1, Cam.trauma + e.v / 30); } });
  Bus.on('shift', (e) => { if (e.car === Game.player) SFX.shift(); });
  initInput();
  initMenus();
  $('bigMap').addEventListener('click', mapClick);
  progress(1, 'Ready');
  // first render compiles shaders
  Game.camera.position.set(Game.menuSpot.x + 8, World.plazaH + 3, Game.menuSpot.z + 8);
  Game.camera.lookAt(Game.menuSpot.x, World.plazaH + 1, Game.menuSpot.z);
  updateSky(0.016, Game.scene, Game.renderer, Game.camera, Game.player, Game.settings);
  try { Game.renderer.compile(Game.scene, Game.camera); } catch (e) { /* not fatal */ }
  $('loading').classList.add('done');
  setTimeout(() => $('loading').remove(), 900);
  openMain();
  updateRadioBtn();
  // start audio + radio on the first user gesture
  const firstGesture = () => { audioStart(); musicPlay(); removeEventListener('pointerdown', firstGesture); removeEventListener('keydown', firstGesture); };
  addEventListener('pointerdown', firstGesture);
  addEventListener('keydown', firstGesture);
  window.SR = Game; // debugging/automation hook
  Object.assign(window.SR, { makeCar, Festival, Menu, EVENTS, raceUpdate, AIDriver, collideCars, racePositions, raceEnd, Vehicle, World, Race, Events, CARS, Sky, Cam, Skill, raceSetup, resetPlayer, setWeather, startFreeRoam, openGarage, openEvents, openSettings, openPause, resumeGame, Save, camSetMode });
  requestAnimationFrame(loop);
}

/* ---------- main loop ---------- */
function loop() {
  requestAnimationFrame(loop);
  try { frame(); } catch (e) { showErr(e); }
}
const _focus = new THREE.Vector3();
function frame() {
  const dt = Math.min(0.1, Game.clock.getDelta());
  Props.uTime.value += dt;
  const cam = Game.camera, p = Game.player, pm = Game.playerModel;
  const playing = (Game.mode === 'drive' || Game.mode === 'race') && !Game.paused;
  if (playing) {
    readControls(dt, p);
    if (Race.ev) raceUpdate(dt);
    const frozen = Race.ev && Race.phase === 'countdown';
    Game.acc += dt;
    let steps = 0;
    const cars = [p, ...Game.ai];
    while (Game.acc >= PH_DT && steps < 10) {
      for (const c of cars) { c.savePrev(); c.prevX = c.x; c.prevZ = c.z; }
      for (const c of cars) { c.frozen = frozen; c.step(PH_DT, Game.settings); }
      if (frozen) for (const c of cars) { c.x = c.prev.x; c.z = c.prev.z; c.h = c.prev.h; c.vx = c.vz = 0; c.w = 0; }
      collideCars(cars);
      if (!Race.ev) { updateStunts(PH_DT, p); }
      Game.acc -= PH_DT; steps++;
    }
    if (steps >= 10) Game.acc = 0;
    const alpha = Game.acc / PH_DT;
    p.sync(pm, alpha, Cam.mode);
    for (const a of Game.ai) a.sync(a.model, alpha, 0);
    if (!Race.ev || Race.phase === 'run') updateSkills(dt, p);
    camUpdate(dt, cam, p, pm, Game.settings);
    pm.root.visible = true;
    carEffects(p, dt, true);
    for (const a of Game.ai) carEffects(a, dt, Math.hypot(a.x - p.x, a.z - p.z) < 150);
    hudUpdate(dt, p);
    // markers / interaction prompt
    const m = Race.ev ? null : nearestMarker(p, 30);
    showPrompt(m && (m.garage || m.ev) ? m : null);
    // water recovery and stuck hints
    if (p.water > 0.9) { Game.waterT += dt; if (Game.waterT > 1.4) { SFX.splash(); notify('Splash!', 'Recovered to the road', 'bad'); resetPlayer(); Game.waterT = 0; } } else Game.waterT = 0;
    if (p.speed < 1 && p.input.throttle > 0 && !Race.ev) { Game.stuckT += dt; if (Game.stuckT > 3.5) { notify('Stuck?', 'Press R to return to the road', 'info'); Game.stuckT = -6; } } else if (Game.stuckT > 0) Game.stuckT = 0;
    Save.data.stats.km = (Save.data.stats.km || 0) + p.speed * dt / 1000;
  } else if (Game.mode === 'menu') {
    // cinematic orbit around the player's car on the plaza
    const s = Game.menuSpot;
    p.reset(s.x, s.z, s.h);
    p.sync(pm, 1, 0);
    Menu.orbit += dt * 0.12;
    const a = Menu.orbit, r = 7.2 + Math.sin(a * 0.7) * 1.2;
    cam.position.set(s.x + Math.sin(a) * r, World.plazaH + 1.4 + Math.sin(a * 0.5) * 0.5, s.z + Math.cos(a) * r);
    cam.lookAt(s.x, World.plazaH + 0.7, s.z);
    if (innerWidth > 700) cam.rotateY(0.2); // frame the car to the right of the menu
    if (cam.fov !== 42) { cam.fov = 42; cam.near = 0.25; cam.updateProjectionMatrix(); }
    showPrompt(null);
  } else if (Game.mode === 'garage' && Menu.preview) {
    const spot = Festival.previewSpot;
    Menu.preview.a += dt * 0.35;
    Menu.preview.model.root.rotation.y = Menu.preview.a;
    // camera on the plaza side, looking out at the car with the hangars behind it
    const ix = PLAZA.x - spot.x, iz = PLAZA.z - spot.z, l = Math.hypot(ix, iz), ux = ix / l, uz = iz / l;
    cam.position.set(spot.x + ux * 8.2, spot.y + 1.5, spot.z + uz * 8.2);
    cam.lookAt(spot.x, spot.y + 0.55, spot.z);
    if (innerWidth > 900) cam.rotateY(-0.02);
    if (cam.fov !== 38) { cam.fov = 38; cam.near = 0.25; cam.updateProjectionMatrix(); }
    pm.root.visible = false;
  }
  if (Game.mode !== 'garage') pm.root.visible = true;
  if (Game.paused && Game.mode !== 'garage' && Game.mode !== 'menu') { /* frozen frame */ }
  // world systems
  _focus.set(p.x, p.y, p.z);
  if (Game.mode === 'garage') _focus.set(Festival.previewSpot.x, Festival.previewSpot.y, Festival.previewSpot.z);
  const nightGlow = updateSky(dt, Game.scene, Game.renderer, cam, _focus, Game.settings);
  updateLightPool(cam.position, nightGlow);
  Game.lodT -= dt;
  if (Game.lodT <= 0) {
    Game.lodT = 0.3;
    updateTerrainLod(cam.position.x, cam.position.z, Game.q);
    updateVegetation(cam.position.x, cam.position.z, Game.q);
  }
  if (Props.grass) Props.grass.u.uCam.value.copy(cam.position);
  updateFestival(dt, nightGlow);
  updateMarkers(cam.position, !!Race.ev || Game.mode === 'garage');
  updateFX(dt, Game.scene);
  audioUpdate(dt, p, cam, Game.ai);
  if (Game.grade) { Game.grade.uniforms.uTime.value = Props.uTime.value % 10; Game.grade.uniforms.uWarm.value = 0.02 + (Sky.cur.time > 17 && Sky.cur.time < 21 ? 0.02 : 0); }
  if (Game.bloom) Game.bloom.strength = 0.28 + Sky.night * 0.35;
  // render
  if (Game.composer) Game.composer.render(); else Game.renderer.render(Game.scene, cam);
  autoResolution(dt);
}
function autoResolution(dt) {
  const s = Game.settings;
  if (!s.autoRes) return;
  const P = Game.perf;
  P.t += dt; P.n++;
  if (P.t < 1) return;
  const fps = P.n / P.t;
  P.t = 0; P.n = 0;
  if (fps < 45) P.low++; else P.low = 0;
  if (fps > 58) P.high++; else P.high = 0;
  let changed = false;
  if (P.low >= 2 && Game.dprNow > Game.dprBase * 0.55) { Game.dprNow = Math.max(Game.dprBase * 0.55, Game.dprNow - 0.1); P.low = 0; changed = true; }
  if (P.high >= 5 && Game.dprNow < Game.dprBase) { Game.dprNow = Math.min(Game.dprBase, Game.dprNow + 0.05); P.high = 0; changed = true; }
  if (changed) {
    Game.renderer.setPixelRatio(Game.dprNow);
    if (Game.composer) { Game.composer.setPixelRatio(Game.dprNow); Game.composer.setSize(innerWidth, innerHeight); }
  }
}

boot().catch(showErr);
