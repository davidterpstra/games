// First-person torch: warm flickering point light (parented to the camera) and a held view model
// with a shader flame, glow and ember particles. Raise/lower animation, sway from camera motion.
import * as THREE from 'three';

const FLAME_VERT = /* glsl */`
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * uSize;
  gl_Position = projectionMatrix * c;
}`;
const FLAME_FRAG = /* glsl */`
uniform float uTime, uIntensity, uSeed;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vec2((vUv.x - .5) * 2., vUv.y);
  float t = uTime * 2.4 + uSeed;
  float n = vn(vec2(p.x * 2.6 + uSeed, p.y * 2.2 - t)) * .65 + vn(vec2(p.x * 5.1, p.y * 4. - t * 1.7)) * .35;
  p.x += (n - .5) * .75 * p.y;
  float w = mix(.62, .0, pow(p.y, .85)) + .04;
  float d = abs(p.x) / max(w, .001);
  float shape = smoothstep(1., .15, d) * smoothstep(1., .02, p.y) * smoothstep(0., .07, p.y);
  shape *= .75 + .5 * n;
  float core = smoothstep(.6, 0., d) * smoothstep(.62, 0., p.y);
  vec3 col = mix(vec3(1., .30, .04), vec3(1., .72, .22), smoothstep(0., .8, core + (1. - p.y) * .25));
  col = mix(col, vec3(1., .95, .75), core * core);
  gl_FragColor = vec4(col * 1.25, clamp(shape, 0., 1.) * uIntensity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const GLOW_FRAG = /* glsl */`
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float d = length(vUv - .5) * 2.;
  float a = pow(max(1. - d, 0.), 2.4) * .55 * uIntensity;
  gl_FragColor = vec4(1., .52, .18, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function canvasTexture(size, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

function woodTexture() {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#5a3d25'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * s, w = 1 + Math.random() * 3;
      g.fillStyle = `rgba(${20 + Math.random() * 40},${12 + Math.random() * 22},${6 + Math.random() * 12},${0.15 + Math.random() * 0.35})`;
      g.fillRect(x, 0, w, s);
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(30,18,8,0.5)';
      g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 5 + Math.random() * 7, 0, 0, 6.3); g.fill();
    }
  }, [1, 2]);
}

function clothTexture() {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#8a7650'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 3) { g.fillStyle = `rgba(60,45,25,${0.18 + Math.random() * 0.2})`; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 3) { g.fillStyle = `rgba(190,170,125,${0.12 + Math.random() * 0.2})`; g.fillRect(x, 0, 1, s); }
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(20,12,6,${Math.random() * 0.35})`; g.fillRect(Math.random() * s, Math.random() * s, 4 + Math.random() * 10, 3 + Math.random() * 8); }
  }, [2, 1]);
}

function dotTexture() {
  return canvasTexture(32, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
}

const EMBERS = 16;
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _wp = new THREE.Vector3();

/**
 * @param {{camera: THREE.Camera, quality?: string}} o
 * @returns torch controller with set(on), update(dt, speed, time), light, root
 */
export function createTorch({ camera }) {
  const root = new THREE.Group();   // anchored to the camera, carries bob/sway/raise animation
  root.name = 'TorchViewModel';
  const model = new THREE.Group();  // the torch itself, leaning forward
  root.add(model);
  camera.add(root);

  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // --- wooden handle (slightly gnarled) ---
  const wood = track(new THREE.MeshStandardMaterial({ map: track(woodTexture()), roughness: 0.9, metalness: 0, depthTest: false }));
  const hg = track(new THREE.CylinderGeometry(0.021, 0.016, 0.52, 12, 10, true));
  const hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    const k = 1 + 0.07 * Math.sin(y * 31 + hp.getX(i) * 90) + 0.05 * Math.sin(y * 13);
    hp.setX(i, hp.getX(i) * k); hp.setZ(i, hp.getZ(i) * k);
  }
  hg.computeVertexNormals();
  const handle = new THREE.Mesh(hg, wood);
  handle.position.y = 0.26;
  handle.renderOrder = 1000;
  // end cap
  const cap = new THREE.Mesh(track(new THREE.CircleGeometry(0.016, 12)), wood);
  cap.rotation.x = Math.PI / 2; cap.position.y = 0; cap.renderOrder = 1000;

  // --- cloth wrap + rope binding + charred head ---
  const clothMat = track(new THREE.MeshStandardMaterial({ map: track(clothTexture()), roughness: 1, metalness: 0, depthTest: false }));
  const prof = [[0.019, 0.46], [0.028, 0.49], [0.037, 0.53], [0.041, 0.57], [0.038, 0.61], [0.030, 0.64], [0.020, 0.655], [0.004, 0.66]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const wg = track(new THREE.LatheGeometry(prof, 14));
  const wp = wg.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const a = Math.atan2(wp.getZ(i), wp.getX(i)), y = wp.getY(i);
    const k = 1 + 0.09 * Math.sin(a * 5 + y * 40) + 0.05 * Math.sin(a * 9 - y * 22);
    wp.setX(i, wp.getX(i) * k); wp.setZ(i, wp.getZ(i) * k);
  }
  wg.computeVertexNormals();
  const wrap = new THREE.Mesh(wg, clothMat);
  wrap.renderOrder = 1001;
  const ropeMat = track(new THREE.MeshStandardMaterial({ color: 0x6b5030, roughness: 1, depthTest: false }));
  const ropes = [];
  for (const [y, r] of [[0.495, 0.03], [0.535, 0.038]]) {
    const rope = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.0045, 6, 18)), ropeMat);
    rope.rotation.x = Math.PI / 2; rope.position.y = y; rope.renderOrder = 1002; ropes.push(rope);
  }
  const headMat = track(new THREE.MeshStandardMaterial({ color: 0x1a0f08, emissive: 0xff4d10, emissiveIntensity: 1.1, roughness: 1, depthTest: false }));
  const headGeo = track(new THREE.IcosahedronGeometry(0.034, 2));
  const hgp = headGeo.attributes.position;
  for (let i = 0; i < hgp.count; i++) {
    const n = 1 + 0.18 * Math.sin(hgp.getX(i) * 150 + hgp.getY(i) * 90) * Math.cos(hgp.getZ(i) * 130);
    hgp.setXYZ(i, hgp.getX(i) * n, hgp.getY(i) * n * 0.9, hgp.getZ(i) * n);
  }
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.665; head.renderOrder = 1003;
  model.add(handle, cap, wrap, ...ropes, head);

  // --- flame: three billboard layers + glow ---
  const tip = new THREE.Group();
  tip.position.y = 0.68;
  model.add(tip);
  const flameGeo = track(new THREE.PlaneGeometry(1, 1));
  flameGeo.translate(0, 0.5, 0);
  const flames = [];
  const mkFlame = (sx, sy, seed) => {
    const mat = track(new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
      uniforms: { uSize: { value: new THREE.Vector2(sx, sy) }, uTime: { value: 0 }, uIntensity: { value: 1 }, uSeed: { value: seed } },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    const m = new THREE.Mesh(flameGeo, mat);
    m.frustumCulled = false; m.renderOrder = 1010 + flames.length;
    tip.add(m); flames.push(m);
    return m;
  };
  mkFlame(0.115, 0.27, 0.0).position.y = -0.02;
  mkFlame(0.085, 0.21, 3.7).position.set(0.004, 0.0, 0);
  mkFlame(0.06, 0.15, 8.1).position.set(-0.003, 0.0, 0);
  const glowMat = track(new THREE.ShaderMaterial({
    vertexShader: FLAME_VERT, fragmentShader: GLOW_FRAG,
    uniforms: { uSize: { value: new THREE.Vector2(0.55, 0.55) }, uIntensity: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  const glow = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1).translate(0, 0.0, 0)), glowMat);
  glow.position.y = 0.07; glow.frustumCulled = false; glow.renderOrder = 1009;
  tip.add(glow);
  // fix: glow quad centred on the tip (plane is centred, FLAME_VERT offsets by position.xy)

  // --- embers ---
  const ePos = new Float32Array(EMBERS * 3);
  const eCol = new Float32Array(EMBERS * 3);
  const eVel = new Float32Array(EMBERS * 3);
  const eLife = new Float32Array(EMBERS);
  const eGeo = track(new THREE.BufferGeometry());
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  const eMat = track(new THREE.PointsMaterial({
    size: 0.011, map: track(dotTexture()), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, sizeAttenuation: true,
  }));
  const embers = new THREE.Points(eGeo, eMat);
  embers.frustumCulled = false; embers.renderOrder = 1020;
  tip.add(embers);
  for (let i = 0; i < EMBERS; i++) eLife[i] = Math.random();
  const resetEmber = (i) => {
    ePos[i * 3] = (Math.random() - 0.5) * 0.04; ePos[i * 3 + 1] = Math.random() * 0.04; ePos[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    eVel[i * 3] = (Math.random() - 0.5) * 0.05; eVel[i * 3 + 1] = 0.08 + Math.random() * 0.14; eVel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    eLife[i] = 0.7 + Math.random() * 1.1;
  };
  for (let i = 0; i < EMBERS; i++) { resetEmber(i); eLife[i] *= Math.random(); }

  // --- light ---
  const light = new THREE.PointLight(0xff9440, 0, 14, 2);
  light.name = 'TorchLight';
  light.castShadow = false;
  light.position.set(0.18, 0.02, -0.7);
  camera.add(light);

  // --- state ---
  const BASE_POS = new THREE.Vector3(0.27, -0.30, -0.5);
  let on = false;
  let anim = 0;            // 0 lowered .. 1 raised
  let phase = 0, lastYaw = 0, lastPitch = 0, swayX = 0, swayY = 0, bob = 0;
  let initialised = false;
  root.visible = false;

  function flicker(t) {
    return 0.82 + 0.1 * Math.sin(t * 17.3) * Math.sin(t * 5.1 + 1.2) + 0.07 * Math.sin(t * 41.7 + 0.5) + 0.06 * Math.sin(t * 9.7);
  }

  return {
    root, light,
    get on() { return on; },
    set(v) { on = !!v; },
    /** Immediately jump to the raised/lowered pose (used by deserialize). */
    snap(v) { on = !!v; anim = v ? 1 : 0; },
    /** @param speed horizontal player speed (m/s); @param interior unused; time: seconds since start */
    update(dt, speed, time, boost = 1) {
      const target = on ? 1 : 0;
      anim += (target - anim) * (1 - Math.exp(-dt * (on ? 7 : 9)));
      if (Math.abs(target - anim) < 0.002) anim = target;
      const show = anim > 0.01;
      root.visible = show;
      const f = flicker(time);
      light.intensity = show ? 34 * anim * f * boost : 0;
      light.color.setRGB(1, 0.55 + 0.06 * (f - 0.8), 0.22 + 0.05 * (f - 0.8));
      if (!show) { initialised = false; return; }

      _e.setFromQuaternion(camera.quaternion, 'YXZ');
      if (!initialised) { lastYaw = _e.y; lastPitch = _e.x; initialised = true; }
      let dy = _e.y - lastYaw; if (dy > Math.PI) dy -= 6.2832; else if (dy < -Math.PI) dy += 6.2832;
      const dp = _e.x - lastPitch;
      lastYaw = _e.y; lastPitch = _e.x;
      const inv = 1 / Math.max(dt, 1e-3);
      const tx = THREE.MathUtils.clamp(dy * inv * 0.012, -0.05, 0.05);
      const ty = THREE.MathUtils.clamp(-dp * inv * 0.012, -0.04, 0.04);
      const k = 1 - Math.exp(-dt * 7);
      swayX += (tx - swayX) * k; swayY += (ty - swayY) * k;
      const sp = Math.min(speed, 8);
      phase += dt * (3 + sp * 1.1);
      bob += (Math.min(sp / 6, 1) - bob) * (1 - Math.exp(-dt * 6));
      const idle = Math.sin(time * 1.3) * 0.002;

      const down = 1 - anim;
      root.position.set(
        BASE_POS.x + swayX + Math.cos(phase * 0.5) * 0.012 * bob + down * 0.12,
        BASE_POS.y + swayY + Math.abs(Math.sin(phase)) * 0.016 * bob + idle - down * 0.5,
        BASE_POS.z + down * 0.1 + Math.sin(phase) * 0.004 * bob,
      );
      root.rotation.set(-0.12 - down * 0.5, 0, 0.1 + swayX * 1.5 + down * 0.5);
      model.rotation.set(-0.34, 0.0, -0.1);

      // flame
      const inten = anim * (0.88 + 0.12 * f);
      for (let i = 0; i < flames.length; i++) {
        const m = flames[i].material.uniforms;
        m.uTime.value = time; m.uIntensity.value = inten;
        flames[i].scale.setScalar(0.92 + 0.12 * Math.sin(time * (11 + i * 4) + i));
      }
      glowMat.uniforms.uIntensity.value = inten * (0.8 + 0.4 * f);
      headMat.emissiveIntensity = 0.8 + 0.8 * f;

      // embers
      for (let i = 0; i < EMBERS; i++) {
        eLife[i] -= dt;
        if (eLife[i] <= 0) resetEmber(i);
        const j = i * 3;
        eVel[j] += (Math.random() - 0.5) * 0.4 * dt;
        ePos[j] += eVel[j] * dt; ePos[j + 1] += eVel[j + 1] * dt; ePos[j + 2] += eVel[j + 2] * dt;
        const l = Math.min(1, eLife[i] * 1.5) * inten;
        eCol[j] = 1.0 * l; eCol[j + 1] = 0.45 * l; eCol[j + 2] = 0.1 * l;
      }
      eGeo.attributes.position.needsUpdate = true;
      eGeo.attributes.color.needsUpdate = true;
    },
    /** World position of the flame tip (for particles/gameplay). */
    getTipWorld(target = _wp) { return tip.getWorldPosition(target); },
    dispose() {
      camera.remove(root); camera.remove(light);
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
