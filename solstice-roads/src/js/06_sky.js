/* =====================================================================
   Sky, lighting, weather and time of day.
   One sky shader (gradient + sun/moon + fbm clouds + stars) is used both
   for the visible dome and to capture the PMREM environment map, so car
   paint, wet roads and water reflect the actual sky.
   ===================================================================== */
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FS = `
uniform vec3 uSunDir, uZenith, uHorizon, uGround, uSunCol, uCloudCol, uCloudShade;
uniform float uClouds, uTime, uNight, uSunVis, uHaze;
varying vec3 vDir;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<5;i++){ s += a*vn(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
  // ground side of the sphere (seen in reflections)
  col = mix(col, uGround, smoothstep(0.0, -0.12, h));
  float sd = max(dot(d, uSunDir), 0.0);
  // horizon glow around the sun at dawn/dusk
  col += uSunCol * pow(sd, 6.0) * 0.35 * uHaze * (1.0 - uClouds * 0.7);
  col += uSunCol * pow(sd, 64.0) * 0.5 * uSunVis * (1.0 - uClouds * 0.8);
  // sun / moon disc
  float disc = smoothstep(0.9993, 0.99965, sd) * uSunVis;
  col += mix(uSunCol * 18.0, vec3(0.9, 0.95, 1.1) * 2.0, uNight) * disc * (1.0 - uClouds * 0.95);
  // stars
  if (uNight > 0.01 && h > 0.0) {
    vec2 sp = d.xz / (d.y + 0.3) * 260.0;
    float st = step(0.9965, h21(floor(sp))) * h21(floor(sp) + 3.1);
    col += vec3(st) * uNight * (1.0 - uClouds) * smoothstep(0.0, 0.25, h) * 1.4;
  }
  // clouds on a plane
  if (h > -0.02) {
    vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.008, uTime * 0.003);
    float n = fbm(uv * 1.3);
    float cov = mix(0.62, 0.22, uClouds);
    float c = smoothstep(cov, cov + 0.28, n);
    float thick = smoothstep(cov, cov + 0.6, fbm(uv * 1.3 + 0.08 * uSunDir.xz));
    vec3 cc = mix(uCloudCol, uCloudShade, thick * 0.9);
    cc += uSunCol * pow(sd, 8.0) * 0.5 * (1.0 - thick) * uSunVis;
    float fade = smoothstep(-0.02, 0.18, h);
    col = mix(col, cc, c * fade * 0.97);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const Sky = {
  mat: null, mesh: null, envScene: null, envRT: null, pmrem: null,
  sun: null, hemi: null, lights: [], rain: null,
  cur: { time: 15, clouds: 0.2, rain: 0, fog: 0 }, target: null,
  wet: 0, night: 0, sunDir: new THREE.Vector3(0.5, 0.7, 0.3), envTimer: 0, envDirty: true,
  fogColor: new THREE.Color(), q: null,
};

function initSky(scene, renderer) {
  const u = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color(0x3a4030) },
    uSunCol: { value: new THREE.Color() }, uCloudCol: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
    uClouds: { value: 0.2 }, uTime: Props.uTime, uNight: { value: 0 }, uSunVis: { value: 1 }, uHaze: { value: 0.3 },
  };
  Sky.mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false });
  Sky.mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), Sky.mat);
  Sky.mesh.frustumCulled = false;
  Sky.mesh.renderOrder = -10;
  scene.add(Sky.mesh);
  // env capture scene (separate mesh, same material)
  Sky.envScene = new THREE.Scene();
  Sky.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), Sky.mat));
  Sky.pmrem = new THREE.PMREMGenerator(renderer);

  Sky.sun = new THREE.DirectionalLight(0xffffff, 3);
  Sky.sun.shadow.normalBias = 0.06;
  Sky.sun.shadow.bias = -0.0003;
  scene.add(Sky.sun, Sky.sun.target);
  Sky.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a4a3a, 0.8);
  scene.add(Sky.hemi);
  // pooled point lights for street lamps / tunnel (fixed count: no shader recompiles)
  for (let i = 0; i < 8; i++) {
    const l = new THREE.PointLight(0xffc77a, 0, 26, 1.6);
    scene.add(l);
    Sky.lights.push(l);
  }
  scene.fog = new THREE.FogExp2(0xbfd0e0, 0.0006);
  // rain streaks
  const N = 16000;
  const pos = new Float32Array(N * 2 * 3), rnd = new Float32Array(N * 2);
  const r = mulberry32(5);
  for (let i = 0; i < N; i++) {
    const x = (r() - 0.5) * 70, y = r() * 34, z = (r() - 0.5) * 70, k = r();
    pos.set([x, y, z, x, y, z], i * 6);
    rnd[i * 2] = 0; rnd[i * 2 + 1] = 1;
    void k;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tip', new THREE.BufferAttribute(rnd, 1));
  const rm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: Props.uTime, uAmt: { value: 0 }, uVel: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0xaab4c0) }, uSnowMode: { value: 0 } },
    vertexShader: `attribute float tip; uniform vec3 uCam, uVel; uniform float uTime, uAmt, uSnowMode; varying float vA;
      void main(){
        vec3 p = position;
        float spd = mix(22.0, 2.2, uSnowMode);
        p.y = mod(p.y - uTime * spd + position.x * 3.1, 34.0);
        // snow flakes drift sideways
        p.x += sin(uTime * 0.9 + position.z * 0.7) * 0.8 * uSnowMode;
        p.z += cos(uTime * 0.7 + position.x * 0.5) * 0.8 * uSnowMode;
        vec3 w = vec3(mod(p.x - uCam.x + 35.0, 70.0) - 35.0, p.y - 12.0, mod(p.z - uCam.z + 35.0, 70.0) - 35.0) + uCam;
        vec3 fall = normalize(vec3(-uVel.x * 0.03 + 0.15, -1.0, -uVel.z * 0.03 + 0.05));
        w += fall * tip * -mix(0.6, 0.07, uSnowMode);
        vA = step(fract(position.z * 7.31 + position.x * 3.7), uAmt) * mix(0.12 + 0.2 * tip, 0.85, uSnowMode) * smoothstep(1.5, 6.0, length(w - uCam));
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uCol, vA); }`,
  });
  Sky.rain = new THREE.LineSegments(g, rm);
  Sky.rain.frustumCulled = false;
  Sky.rain.visible = false;
  Sky.rain.material.linewidth = 1;
  scene.add(Sky.rain);
}

function setWeather(id, instant = false) {
  const w = WEATHERS.find((x) => x.id === id) || WEATHERS[0];
  Sky.target = { ...w };
  Sky.target.snow = w.snow || 0;
  if (instant) { Object.assign(Sky.cur, w); Sky.cur.snow = w.snow || 0; Sky.wet = w.rain; Sky.snapSnow = true; }
  Sky.envDirty = true;
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function computeAtmosphere() {
  const { time, clouds, rain, fog } = Sky.cur;
  const t = ((time % 24) + 24) % 24;
  const dayPhase = (t - 5.6) / 14.8;
  let elev;
  if (dayPhase >= 0 && dayPhase <= 1) elev = Math.sin(dayPhase * Math.PI) * 0.95 - 0.04;
  else { const np = (((t - 20.4) % 24) + 24) % 24 / 9.2; elev = -Math.sin(clamp(np, 0, 1) * Math.PI) * 0.6 - 0.04; }
  const az = lerp(Math.PI / 2 + 0.45, -Math.PI / 2 - 0.45, clamp(dayPhase, 0, 1));
  const sd = Sky.sunDir.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
  const day = smoothstep(-0.12, 0.12, elev);
  const golden = smoothstep(0.42, 0.04, elev) * day;
  Sky.night = 1 - smoothstep(-0.16, 0.02, elev);
  const u = Sky.mat.uniforms;
  // light direction: sun by day, moon by night
  const moon = Sky.night > 0.5;
  const ld = moon ? new THREE.Vector3(-sd.x, Math.max(0.35, -sd.y), -sd.z).normalize() : sd;
  u.uSunDir.value.copy(moon ? ld : sd);
  u.uSunVis.value = moon ? 0.7 : smoothstep(-0.05, 0.02, elev);
  u.uNight.value = Sky.night;
  u.uClouds.value = clouds;
  u.uHaze.value = 0.25 + golden * 1.4;
  const zen = _c1.set(0x2f6cc0).lerp(new THREE.Color(0x3c4a7a), golden * 0.6).lerp(new THREE.Color(0x03060d), Sky.night);
  const hor = _c2.set(0xb8d3ea).lerp(new THREE.Color(0xffa25e), golden * 0.85).lerp(new THREE.Color(0x0b1220), Sky.night);
  const grey = new THREE.Color(0x8d969e).lerp(new THREE.Color(0x0a0d12), Sky.night);
  const greyH = new THREE.Color(0xb7bdc2).lerp(new THREE.Color(0x10141a), Sky.night).lerp(new THREE.Color(0xc89a7a), golden * 0.3);
  zen.lerp(grey, clouds * 0.75 + rain * 0.2);
  hor.lerp(greyH, clouds * 0.6 + rain * 0.2);
  const snowy = Sky.cur.snow || 0;
  if (snowy > 0) { zen.lerp(new THREE.Color(0x8fa4bd).lerp(new THREE.Color(0x05070c), Sky.night), snowy * 0.35); hor.lerp(new THREE.Color(0xdde6ee).lerp(new THREE.Color(0x141a24), Sky.night), snowy * 0.45); }
  if (fog > 0) { const fc = new THREE.Color(0xd6dce0).lerp(new THREE.Color(0x0e1218), Sky.night); hor.lerp(fc, fog * 0.85); zen.lerp(fc, fog * 0.45); }
  u.uZenith.value.copy(zen); u.uHorizon.value.copy(hor);
  u.uGround.value.set(0x45503a).multiplyScalar(0.35 + 0.65 * day);
  const sunCol = new THREE.Color(0xfff1dc).lerp(new THREE.Color(0xff8a3a), golden).lerp(new THREE.Color(0xe6f0ff), (Sky.cur.snow || 0) * 0.5);
  u.uSunCol.value.copy(sunCol);
  u.uCloudCol.value.set(0xffffff).lerp(new THREE.Color(0xffc49a), golden * 0.7).lerp(new THREE.Color(0x9aa1a8), clouds * 0.5 + rain * 0.3).multiplyScalar(0.12 + 0.88 * day);
  u.uCloudShade.value.set(0x9aa3ae).lerp(new THREE.Color(0x6c6f78), clouds * 0.6 + rain * 0.3).lerp(new THREE.Color(0xa06a5a), golden * 0.4).multiplyScalar(0.08 + 0.92 * day);
  // lights
  const s = Sky.sun;
  s.color.copy(moon ? new THREE.Color(0x9fb6ff) : sunCol);
  s.intensity = moon ? 0.35 * (1 - clouds * 0.6) : 3.6 * day * (1 - clouds * 0.7) * (1 - fog * 0.45) * (1 - golden * 0.2);
  Sky.hemi.color.copy(hor).lerp(zen, 0.5).lerp(new THREE.Color(0xffffff), 0.2);
  Sky.hemi.groundColor.set(0x5a5040).multiplyScalar(0.3 + 0.7 * day);
  Sky.hemi.intensity = lerp(0.12, 0.22 + clouds * 0.45, day);
  // fog
  const view = Sky.q ? Sky.q.view : 1600;
  let dens = 0.00016 + golden * 0.00012 + clouds * 0.00015 + rain * 0.0012 + fog * 0.0042;
  dens = Math.max(dens, 1.6 / view); // the whole of Wendmoor stays readable on every preset
  Sky.fogColor.copy(hor).lerp(zen, 0.12);
  return { dens, day, golden };
}

function updateSky(dt, scene, renderer, camera, focus, settings) {
  const T = Sky.target;
  const c = Sky.cur;
  if (T) {
    const k = 1 - Math.exp(-dt * 0.6);
    if (settings.dynamicTime) T.time = c.time + dt * settings.timeSpeed * (24 / 1440) * 60 / 60; // 24 min per day at 1x
    let dtm = T.time - c.time;
    if (dtm > 12) dtm -= 24; if (dtm < -12) dtm += 24;
    if (settings.dynamicTime) c.time = (T.time + 24) % 24;
    else c.time = (c.time + dtm * k + 24) % 24;
    c.clouds = lerp(c.clouds, T.clouds, k); c.rain = lerp(c.rain, T.rain, k); c.fog = lerp(c.fog, T.fog, k);
    c.snow = lerp(c.snow || 0, T.snow || 0, k);
  }
  Sky.wet = c.rain > Sky.wet ? Math.min(c.rain, Sky.wet + dt * 0.08) : Math.max(c.rain, Sky.wet - dt * 0.01);
  const a = computeAtmosphere();
  scene.fog.color.copy(Sky.fogColor);
  scene.fog.density = a.dens;
  renderer.toneMappingExposure = lerp(1.0, 1.35, Sky.night) * lerp(1, 1.08, c.clouds) * lerp(1, 0.95, a.golden);
  Sky.mesh.position.copy(camera.position);
  // shadows follow the focus point, snapped to texels to avoid shimmering
  const s = Sky.sun, sc = s.shadow.camera;
  const L = Sky.night > 0.5 ? Sky.mat.uniforms.uSunDir.value : Sky.sunDir;
  const ext = sc.right - sc.left || 1;
  const texel = ext / (s.shadow.mapSize.x || 1024);
  const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
  s.target.position.set(fx, focus.y, fz);
  s.position.set(fx + L.x * 300, focus.y + Math.max(0.15, L.y) * 300, fz + L.z * 300);
  s.target.updateMatrixWorld();
  // rain
  const rm = Sky.rain.material.uniforms;
  const fall = Math.max(c.rain, (c.snow || 0) * clamp(c.clouds * 1.3 - 0.2, 0, 1));
  rm.uAmt.value = fall * (Sky.q ? Sky.q.rain / 16000 : 0.5);
  rm.uSnowMode.value = c.snow || 0;
  Sky.rain.visible = fall > 0.02;
  rm.uCam.value.copy(camera.position);
  rm.uCol.value.setScalar(lerp(0.55 + 0.35 * (1 - Sky.night), 0.6 + 0.4 * (1 - Sky.night), c.snow || 0));
  // materials that react to wetness / night
  for (const m of RoadGfx.materials) m.userData.u.uWet.value = Sky.wet;
  if (Terrain.material) { Terrain.material.userData.u.uWet.value = Sky.wet * 0.8; }
  const nightGlow = smoothstep(0.25, 0.8, Sky.night + c.clouds * c.rain * 0.3 + c.fog * 0.15);
  for (const m of Props.buildingMats) m.emissiveIntensity = nightGlow * 1.1;
  PropMat.lamp.emissiveIntensity = nightGlow * 4;
  Props.uWind.value = 0.6 + c.rain * 1.2 + c.clouds * 0.4;
  updateSnow(dt);
  // environment map refresh
  Sky.envTimer -= dt;
  const changing = settings.dynamicTime || Math.abs(T.clouds - c.clouds) > 0.01 || Math.abs(wrapAngle((T.time - c.time) / 24 * TAU)) > 0.005;
  if (Sky.envDirty || (changing && Sky.envTimer <= 0)) {
    Sky.envTimer = 2.5;
    Sky.envDirty = false;
    const old = Sky.envRT;
    Sky.envRT = Sky.pmrem.fromScene(Sky.envScene, 0.02, 1, 200);
    scene.environment = Sky.envRT.texture;
    if (old) old.dispose();
  }
  return nightGlow;
}

/* Assign pooled point lights to the nearest street lamps / tunnel lights. */
const _lampTmp = [];
function updateLightPool(cam, nightGlow) {
  const pts = _lampTmp; pts.length = 0;
  if (nightGlow > 0.02) for (const p of Props.lampSpots) { const d = p.distanceToSquared(cam); if (d < 160 * 160) pts.push([d, p, 1]); }
  for (const p of RoadGfx.tunnelLights) { const d = p.distanceToSquared(cam); if (d < 90 * 90) pts.push([d, p, 0]); }
  pts.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < Sky.lights.length; i++) {
    const l = Sky.lights[i], e = pts[i];
    if (!e) { l.intensity = 0; continue; }
    l.position.copy(e[1]);
    if (e[2]) { l.color.set(0xffc77a); l.intensity = 60 * nightGlow; l.distance = 30; }
    else { l.color.set(0xffe2b0); l.intensity = 45; l.distance = 20; l.position.y -= 1.2; }
  }
}
