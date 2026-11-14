// Water: lake, river ribbon, waterfall pool, waterfall sheet, splash foam and mist.
// One custom shader (animated procedural normals, fresnel, sun glint, depth colour, shore foam, fog)
// is shared by lake/river/pool; each mesh has its own flow uniforms.
import * as THREE from 'three';
import { LAKE, RIVER, WATERFALL } from '../layout.js';
import { createSoftSprite } from './textures.js';
import { PLUNGE, FALL, inPool } from './heightfield.js';
import { sstep } from './noise.js';

const POOL = WATERFALL.pool;
const HALF_W = RIVER.width / 2;

const WATER_VERT = /* glsl */`
attribute float aDepth;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepth;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz; vUv = uv; vDepth = aDepth;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const NOISE = /* glsl */`
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}`;

const WATER_FRAG = /* glsl */`
uniform float uTime, uScale, uFoam, uStretch;
uniform vec2 uFlow;
uniform vec3 uSunDir, uSunCol, uAmb, uSkyTop, uSkyHor, uShallow, uDeep;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepth;
#include <common>
#include <fog_pars_fragment>
${NOISE}
const vec4 WV[5] = vec4[5](vec4(0.83, 0.56, 1.9, 1.3), vec4(-0.45, 0.89, 3.1, 1.7), vec4(0.2, -0.98, 4.7, 2.1), vec4(-0.93, -0.36, 7.3, 2.9), vec4(0.62, 0.78, 11.0, 3.6));
void main() {
  vec2 p = vUv * uScale - uFlow * uTime;
  p.y *= uStretch;
  vec2 q = p + vec2(sin(p.y * 0.9 + uTime * 0.3), cos(p.x * 0.8 - uTime * 0.25)) * 0.25;
  float dx = 0.0, dz = 0.0;
  for (int i = 0; i < 5; i++) {
    vec4 w = WV[i];
    float ph = dot(w.xy, q) * w.z + uTime * w.w * (uFoam > 0.5 ? 0.35 : 1.0);
    float a = 0.045 / (0.6 + w.z);
    float c = cos(ph) * a * w.z;
    dx += c * w.x; dz += c * w.y;
  }
  float e = 0.04;
  float n0 = vnoise(q * 9.0 + uTime * 0.2);
  dx += (vnoise(q * 9.0 + vec2(e, 0.0) + uTime * 0.2) - n0) * 0.9;
  dz += (vnoise(q * 9.0 + vec2(0.0, e) + uTime * 0.2) - n0) * 0.9;
  float dist = distance(cameraPosition, vWorld);
  float calm = smoothstep(70.0, 260.0, dist);
  vec3 N = normalize(vec3(-dx * (1.0 - 0.7 * calm), 1.0, -dz * (1.0 - 0.7 * calm)));
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(N, V), 0.001);
  float fres = clamp(0.03 + 0.97 * pow(1.0 - ndv, 5.0), 0.0, 0.9);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uSkyHor, uSkyTop, clamp(R.y * 1.6, 0.0, 1.0));
  float d = max(vDepth, 0.0);
  vec3 body = mix(uShallow, uDeep, 1.0 - exp(-d * 0.55));
  vec3 lit = (uAmb + uSunCol * max(dot(N, uSunDir), 0.0) * 0.55) / 3.14159;
  vec3 col = body * lit * (1.0 - fres) + sky * fres * 0.9;
  float spec = pow(max(dot(R, uSunDir), 0.0), 700.0) * 7.0 + pow(max(dot(R, uSunDir), 0.0), 70.0) * 0.35;
  col += uSunCol * spec * 0.28 * (1.0 - 0.6 * calm);
  float alpha = smoothstep(0.0, 0.3, vDepth) * (0.5 + 0.42 * (1.0 - exp(-d * 0.9)) + fres * 0.35);
  // shore foam + rapids
  float fn = vnoise(vUv * uScale * vec2(5.0, 5.0 * uStretch) - uFlow * uTime * 2.0 + 7.0);
  float shore = (1.0 - smoothstep(0.04, 0.42, vDepth)) * smoothstep(0.38, 0.72, fn) * smoothstep(0.0, 0.06, vDepth);
  float rapids = uFoam * smoothstep(0.62, 0.86, vnoise(vec2(vUv.x * uScale * 2.6, vUv.y * uScale * 0.5 * uStretch - uTime * uFlow.y * 3.0))) * 0.8;
  float foam = clamp(shore * 0.85 + rapids, 0.0, 1.0);
  col = mix(col, vec3(0.92, 0.96, 0.96) * (0.55 + 0.6 * lit), foam);
  alpha = clamp(max(alpha, foam * 0.9), 0.0, 0.96);
  gl_FragColor = vec4(col, alpha * smoothstep(0.0, 0.02, vDepth + 0.02));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const FALLS_FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uAmb, uSunCol;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepth;
#include <common>
#include <fog_pars_fragment>
${NOISE}
void main() {
  // vUv.x across (0..1), vUv.y = metres travelled down the face / 4
  float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
  float speed = 3.0 + vDepth;
  float s1 = vnoise(vec2(vUv.x * 22.0, vUv.y * 1.6 - uTime * speed));
  float s2 = vnoise(vec2(vUv.x * 55.0 + 3.0, vUv.y * 0.9 - uTime * speed * 1.4));
  float streak = smoothstep(0.25, 0.85, s1 * 0.6 + s2 * 0.55);
  float white = clamp(streak * 0.9 + vDepth * 0.1, 0.0, 1.0);
  vec3 lit = (uAmb + uSunCol * 0.45) / 3.14159;
  vec3 deep = vec3(0.30, 0.50, 0.52), foam = vec3(0.95, 0.98, 0.98);
  vec3 col = mix(deep, foam, white) * (0.45 + 0.9 * lit);
  float alpha = edge * (0.5 + 0.42 * white);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const MIST_VERT = /* glsl */`
uniform float uTime, uPx;
attribute vec4 aSeed;
varying float vAlpha;
#include <common>
#include <fog_pars_vertex>
void main() {
  float age = fract(uTime * (0.12 + aSeed.w * 0.1) + aSeed.x);
  vec3 p = position;
  p.xz += (aSeed.yz - 0.5) * age * 9.0;
  p.y += age * (4.0 + aSeed.w * 8.0);
  vec4 mvPosition = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = (14.0 + 40.0 * age) * (0.6 + aSeed.w) * uPx / max(-mvPosition.z, 1.0);
  vAlpha = sin(age * 3.14159) * 0.32;
  #include <fog_vertex>
}`;
const MIST_FRAG = /* glsl */`
uniform sampler2D uMap;
uniform vec3 uTint;
varying float vAlpha;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(uTint, t.a * vAlpha);
  #include <fog_fragment>
}`;

/** Builds a polar mesh (rings × sectors) whose outline radius is radiusAt(theta). */
function polarWater(cx, cz, y, radiusAt, rings, sectors, getH, uvScale = 1) {
  const pos = [], uv = [], depth = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    for (let s = 0; s <= sectors; s++) {
      const th = (s % sectors) / sectors * Math.PI * 2;
      const rad = radiusAt(th) * (r / rings);
      const x = cx + Math.cos(th) * rad, z = cz + Math.sin(th) * rad;
      pos.push(x, y, z); uv.push(x * uvScale, z * uvScale); depth.push(y - getH(x, z));
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < sectors; s++) {
    const a = r * (sectors + 1) + s, b = a + 1, c = a + sectors + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  return makeGeo(pos, uv, depth, idx);
}
function makeGeo(pos, uv, depth, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * Creates all water meshes.
 * @returns {{ group: THREE.Group, update(dt, t, cam), poolOutline: Array, plunge }}
 */
export function createWater({ hf, scene, renderer, quality }) {
  const group = new THREE.Group(); group.name = 'water';
  const getH = hf.getHeightAt;

  const shared = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
    uSunCol: { value: new THREE.Color(1.0, 0.92, 0.8).multiplyScalar(3.0) },
    uAmb: { value: new THREE.Color(0.8, 0.9, 1.0) },
    uSkyTop: { value: new THREE.Color(0.25, 0.5, 0.85) },
    uSkyHor: { value: new THREE.Color(0.6, 0.75, 0.85) },
    uShallow: { value: new THREE.Color(0.12, 0.42, 0.36) },
    uDeep: { value: new THREE.Color(0.02, 0.17, 0.2) },
  };
  const fogU = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  const mkWater = (flow, scale, foam, stretch = 1) => new THREE.ShaderMaterial({
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, fog: true,
    uniforms: {
      ...fogU, ...shared,
      uFlow: { value: new THREE.Vector2(flow[0], flow[1]) }, uScale: { value: scale }, uFoam: { value: foam }, uStretch: { value: stretch },
    },
  });

  // ---- lake -----------------------------------------------------------------------------------------
  const lake = new THREE.Mesh(
    polarWater(LAKE.x, LAKE.z, LAKE.waterY, () => LAKE.radius + 0.5, 44, 112, getH, 1 / 9),
    mkWater([0.02, 0.012], 1.0, 0),
  );
  lake.name = 'lake'; lake.renderOrder = 2; group.add(lake);

  // ---- pool (disc ∪ plunge basin) ----------------------------------------------------------------------
  const cx = (POOL.x + PLUNGE.x) / 2, cz = (POOL.z + PLUNGE.z) / 2;
  const poolRadius = (th) => {
    let r = 0;
    for (let s = 0; s < 70; s++) { const t = s * 0.5, x = cx + Math.cos(th) * t, z = cz + Math.sin(th) * t; if (inPool(x, z)) r = t; else if (t > r + 3) break; }
    return r + 0.35;
  };
  const radii = new Float32Array(129);
  for (let s = 0; s < 128; s++) radii[s] = poolRadius(s / 128 * Math.PI * 2);
  radii[128] = radii[0];
  const radiusAtTheta = (th) => radii[Math.round(th / (Math.PI * 2) * 128) % 128];
  const pool = new THREE.Mesh(polarWater(cx, cz, POOL.waterY, radiusAtTheta, 18, 128, getH, 1 / 7), mkWater([0.0, 0.0], 1.0, 0));
  pool.name = 'pool'; pool.renderOrder = 2; group.add(pool);
  const poolOutline = [];
  for (let s = 0; s < 128; s++) { const th = s / 128 * Math.PI * 2, r = radii[s] - 0.35; poolOutline.push({ x: cx + Math.cos(th) * r, z: cz + Math.sin(th) * r, th }); }

  // ---- river ribbon -------------------------------------------------------------------------------------
  {
    const P = RIVER.points, samples = [];
    let acc = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(len / 2.5);
      for (let k = (i === 0 ? 0 : 1); k <= n; k++) {
        const t = k / n;
        samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, wy: a.waterY + (b.waterY - a.waterY) * t, s: acc + len * t });
      }
      acc += len;
    }
    // start where the river leaves the pool
    let start = 0;
    while (start < samples.length - 1 && inPool(samples[start].x, samples[start].z)) start++;
    const S = samples.slice(start);
    const M = 12, hw = HALF_W + 3.2;
    const pos = [], uv = [], depth = [], idx = [];
    const s0 = S[0].s;
    for (let i = 0; i < S.length; i++) {
      const a = S[Math.max(i - 1, 0)], b = S[Math.min(i + 1, S.length - 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const nx = -tz, nz = tx;
      let y = hf.riverSurface(S[i].x, S[i].z, S[i].wy);
      const ramp = sstep(0, 5, S[i].s - s0);
      y = POOL.waterY + (y - POOL.waterY) * ramp;
      for (let m = 0; m <= M; m++) {
        const o = (m / M * 2 - 1) * hw;
        const x = S[i].x + nx * o, z = S[i].z + nz * o;
        pos.push(x, y, z); uv.push(o / 9, (S[i].s) / 9); depth.push(y - getH(x, z));
      }
    }
    for (let i = 0; i < S.length - 1; i++) for (let m = 0; m < M; m++) {
      const a = i * (M + 1) + m, b = a + 1, c = a + M + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const river = new THREE.Mesh(makeGeo(pos, uv, depth, idx), mkWater([0, 0.55], 1.0, 1, 1));
    river.name = 'river'; river.renderOrder = 2; group.add(river);
  }

  // ---- waterfall sheet (draped over the cliff) --------------------------------------------------------------
  const fallsU = { ...fogU, uTime: shared.uTime, uAmb: shared.uAmb, uSunCol: shared.uSunCol };
  {
    const top = WATERFALL.top, dX = FALL.dirX, dZ = FALL.dirZ, nX = -dZ, nZ = dX;
    const rows = [];
    // from the calm stream on the plateau (s<0) over the lip (s=0) down to the pool surface
    for (let s = -20; s <= 15.0; s += (s < -2 ? 1.5 : 0.5)) rows.push(s);
    const cols = 9, pos = [], uv = [], depth = [], idx = [];
    let travel = 0, prevY = null;
    for (let r = 0; r < rows.length; r++) {
      const s = rows[r];
      const width = s < 0 ? 3.6 + (s + 20) * 0.01 : 4.2 + Math.min(s, 11) * 0.28;
      const px = top.x + dX * s, pz = top.z + dZ * s;
      const hc = getH(px, pz);
      if (prevY !== null) travel += Math.abs(prevY - hc) * 0.9 + 0.5;
      prevY = hc;
      const speedHint = Math.max(0, Math.min(1, (hc < 41 ? (42 - hc) / 24 : 0)));
      for (let c = 0; c <= cols; c++) {
        const o = (c / cols - 0.5) * width;
        const x = px + nX * o, z = pz + nZ * o;
        const h = getH(x, z);
        // hug the face: lift by a bit along the horizontal normal-ish direction (towards the pool)
        const lift = 0.28 + 0.5 * speedHint;
        pos.push(x + dX * lift * 0.6, Math.max(h, POOL.waterY - 0.2) + 0.2, z + dZ * lift * 0.6);
        uv.push(c / cols, travel / 4); depth.push(speedHint * 3.0);
      }
    }
    for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, cc = a + cols + 1, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
    // keep only rows still above the pool surface (the sheet ends where it meets the water)
    const g = makeGeo(pos, uv, depth, idx);
    const falls = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: WATER_VERT, fragmentShader: FALLS_FRAG, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, uniforms: fallsU,
    }));
    falls.name = 'waterfall'; falls.renderOrder = 3; group.add(falls);
  }

  // ---- splash foam + mist at the foot ------------------------------------------------------------------------
  const mistPx = { value: 60 };
  const foot = { x: WATERFALL.top.x + FALL.dirX * 11.5, z: WATERFALL.top.z + FALL.dirZ * 11.5 };
  {
    const sprite = createSoftSprite();
    const N = 140, pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 3.4;
      pos[i * 3] = foot.x + Math.cos(a) * r; pos[i * 3 + 1] = POOL.waterY + 0.2; pos[i * 3 + 2] = foot.z + Math.sin(a) * r;
      seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(foot.x, POOL.waterY + 5, foot.z), 22);
    const mist = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false, fog: true,
      uniforms: { ...fogU, uTime: shared.uTime, uPx: mistPx, uMap: { value: sprite }, uTint: { value: new THREE.Color(0.93, 0.97, 0.98) } },
    }));
    mist.name = 'mist'; mist.renderOrder = 4; group.add(mist);
    group.userData.mist = mist;

    // churning foam where the sheet hits the pool
    const foamGeo = new THREE.CircleGeometry(4.6, 40); foamGeo.rotateX(-Math.PI / 2);
    const fpos = foamGeo.attributes.position, fdepth = new Float32Array(fpos.count), fuv = [];
    for (let i = 0; i < fpos.count; i++) { fdepth[i] = Math.hypot(fpos.getX(i), fpos.getZ(i)) / 4.6; fuv.push(fpos.getX(i) / 4.6 * 0.5 + 0.5, fpos.getZ(i) / 4.6 * 0.5 + 0.5); }
    foamGeo.setAttribute('aDepth', new THREE.BufferAttribute(fdepth, 1)); foamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
    const foam = new THREE.Mesh(foamGeo, new THREE.ShaderMaterial({
      vertexShader: WATER_VERT, fragmentShader: /* glsl */`
uniform float uTime; uniform vec3 uAmb;
varying vec2 vUv; varying vec3 vWorld; varying float vDepth;
#include <common>
#include <fog_pars_fragment>
${NOISE}
void main() {
  float r = vDepth;
  vec2 p = (vUv - 0.5) * 2.0;
  float a = atan(p.y, p.x);
  float n = vnoise(vec2(a * 3.0 + uTime * 0.4, r * 9.0 - uTime * 2.2)) * 0.6 + vnoise(vec2(a * 7.0 - uTime * 0.7, r * 18.0 - uTime * 3.4)) * 0.4;
  float f = smoothstep(0.42, 0.78, n) * (1.0 - smoothstep(0.35, 1.0, r));
  vec3 col = vec3(0.93, 0.97, 0.97) * (0.55 + uAmb * 0.25);
  gl_FragColor = vec4(col, f * 0.85);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`, transparent: true, depthWrite: false, fog: true, uniforms: { ...fogU, uTime: shared.uTime, uAmb: shared.uAmb },
    }));
    foam.position.set(foot.x, POOL.waterY + 0.06, foot.z); foam.renderOrder = 3; foam.name = 'splash'; group.add(foam);
  }

  scene.add(group);

  // ---- per-frame: follow the scene's real lighting ---------------------------------------------------------------
  let sun = null, hemi = null, lastScan = -10;
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  function scan() {
    sun = null; hemi = null;
    scene.traverse((o) => { if (o.isDirectionalLight && (!sun || o.castShadow)) sun = o; if (o.isHemisphereLight && !hemi) hemi = o; });
  }
  function update(dt, t, cam) {
    shared.uTime.value = t;
    if (t - lastScan > 1 || t < lastScan) { lastScan = t; scan(); }
    if (sun) {
      shared.uSunDir.value.subVectors(sun.position, sun.target.position).normalize();
      shared.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
    }
    if (hemi) shared.uAmb.value.copy(hemi.color).lerp(hemi.groundColor, 0.25).multiplyScalar(hemi.intensity);
    else if (scene.fog) shared.uAmb.value.copy(scene.fog.color).multiplyScalar(1.0);
    if (scene.fog) { shared.uSkyHor.value.copy(scene.fog.color); }
    if (scene.background && scene.background.isColor) shared.uSkyTop.value.copy(scene.background); else if (scene.fog) shared.uSkyTop.value.copy(scene.fog.color).multiplyScalar(0.8);
    // deep colours dim with the light level so water does not glow at night
    const lum = Math.min(1, (shared.uAmb.value.r + shared.uAmb.value.g + shared.uAmb.value.b) / 1.0);
    if (scene.fog) shared.uSkyHor.value.multiplyScalar(0.55 + 0.45 * lum);
    mistPx.value = renderer.domElement.height * 0.086;
  }
  return { group, update, poolOutline, foot, mistMaterial: group.userData.mist.material };
}
