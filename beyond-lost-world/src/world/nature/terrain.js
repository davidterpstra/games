// Terrain rendering: chunk meshes sharing one patched MeshStandardMaterial that blends procedural
// grass / forest floor / dirt path / sand / rock from a baked control map and the surface slope.
import * as THREE from 'three';
import { WORLD_SIZE, WORLD_HALF } from '../layout.js';
import { forestDensity } from './heightfield.js';
import { clamp } from './noise.js';

const CHUNKS = 4;
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Bakes the splat/control maps (dirt, sand, ruts, litter | grass mask) and the float height texture. */
async function bakeMaps(hf, size, onProgress) {
  const ctrl = new Uint8Array(size * size * 4);
  const grassMask = new Uint8Array(size * size);
  // coarse forest density grid (4 m) for the litter channel
  const G = 161, gStep = WORLD_SIZE / (G - 1), fg = new Float32Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) fg[j * G + i] = forestDensity(-WORLD_HALF + i * gStep, -WORLD_HALF + j * gStep);
  const forestAt = (x, z) => {
    const fx = clamp((x + WORLD_HALF) / gStep, 0, G - 1.001), fz = clamp((z + WORLD_HALF) / gStep, 0, G - 1.001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const a = fg[j * G + i], b = fg[j * G + i + 1], c = fg[(j + 1) * G + i], d = fg[(j + 1) * G + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const texel = WORLD_SIZE / size;
  const out = { dirt: 0, sand: 0, rut: 0, litter: 0, grass: 1, ny: 1 };
  for (let j = 0; j < size; j++) {
    const z = -WORLD_HALF + (j + 0.5) * texel;
    for (let i = 0; i < size; i++) {
      const x = -WORLD_HALF + (i + 0.5) * texel;
      const h = hf.getHeightAt(x, z);
      const f = forestAt(x, z);
      const litter = clamp((f - 0.38) / 0.35, 0, 1);
      hf.control(x, z, h, litter, out);
      const k = (j * size + i) * 4;
      ctrl[k] = out.dirt * 255; ctrl[k + 1] = out.sand * 255; ctrl[k + 2] = out.rut * 255; ctrl[k + 3] = out.litter * 255;
      grassMask[j * size + i] = out.grass * 255;
    }
    if (j % 32 === 31) { onProgress?.(j / size); await tick(); }
  }
  const ctrlTex = new THREE.DataTexture(ctrl, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  ctrlTex.minFilter = THREE.LinearMipmapLinearFilter; ctrlTex.magFilter = THREE.LinearFilter; ctrlTex.generateMipmaps = true;
  ctrlTex.wrapS = ctrlTex.wrapT = THREE.ClampToEdgeWrapping; ctrlTex.needsUpdate = true;
  const maskTex = new THREE.DataTexture(grassMask, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  maskTex.minFilter = THREE.LinearFilter; maskTex.magFilter = THREE.LinearFilter; maskTex.generateMipmaps = false;
  maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping; maskTex.needsUpdate = true;
  const heightTex = new THREE.DataTexture(hf.data, hf.W, hf.W, THREE.RedFormat, THREE.FloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.NearestFilter; heightTex.generateMipmaps = false;
  heightTex.wrapS = heightTex.wrapT = THREE.ClampToEdgeWrapping; heightTex.needsUpdate = true;
  return { ctrlTex, maskTex, heightTex };
}

function buildChunkGeometry(hf, ci, cj) {
  const n = hf.N / CHUNKS, W = n + 1;
  const pos = new Float32Array(W * W * 3), nor = new Float32Array(W * W * 3);
  const tmp = new THREE.Vector3();
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const gi = ci * n + i, gj = cj * n + j, k = (j * W + i) * 3;
    pos[k] = -WORLD_HALF + gi * hf.cell; pos[k + 1] = hf.data[gj * hf.W + gi]; pos[k + 2] = -WORLD_HALF + gj * hf.cell;
    hf.vertexNormal(gi, gj, tmp);
    nor[k] = tmp.x; nor[k + 1] = tmp.y; nor[k + 2] = tmp.z;
  }
  const idx = new (W * W > 65535 ? Uint32Array : Uint16Array)(n * n * 6);
  let t = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p00 = j * W + i, p10 = p00 + 1, p01 = p00 + W, p11 = p01 + 1;
    // same diagonal (p00-p11) as HeightField.getHeightAt
    idx[t++] = p00; idx[t++] = p01; idx[t++] = p11;
    idx[t++] = p00; idx[t++] = p11; idx[t++] = p10;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

function makeMaterial(tex, ctrlTex) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, metalness: 0 });
  const uniforms = {
    uCtrl: { value: ctrlTex }, uGrass: { value: tex.grass }, uForest: { value: tex.forest }, uDirt: { value: tex.dirt },
    uRock: { value: tex.rock }, uSand: { value: tex.sand }, uMacro: { value: tex.macro },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = position;\nvWNrm = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uCtrl, uGrass, uForest, uDirt, uRock, uSand, uMacro;
varying vec3 vWPos;
varying vec3 vWNrm;
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
vec3 tile2(sampler2D t, vec2 p, float s, float mixer) {
  vec3 a = texture2D(t, p * s).rgb;
  vec3 b = texture2D(t, ROT * p * s * 0.377 + vec2(0.37, 0.11)).rgb;
  return mix(a, b, mixer);
}
vec3 rockTri(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 c = texture2D(uRock, p.zy * 0.12).rgb * w.x + texture2D(uRock, p.xz * 0.12).rgb * w.y + texture2D(uRock, p.xy * 0.12).rgb * w.z;
  vec3 d = texture2D(uRock, ROT * p.zy * 0.031).rgb * w.x + texture2D(uRock, ROT * p.xz * 0.031).rgb * w.y + texture2D(uRock, ROT * p.xy * 0.031).rgb * w.z;
  return c * (0.55 + d * 0.9);
}`)
      .replace('#include <map_fragment>', `
vec3 tn = normalize(vWNrm);
vec2 tp = vWPos.xz;
vec4 tc = texture2D(uCtrl, (tp + 320.0) / 640.0);
float m1 = texture2D(uMacro, tp * 0.0021).r;
float m2 = texture2D(uMacro, tp * 0.0113 + 0.31).g;
float m3 = texture2D(uMacro, tp * 0.071).b;
float mixer = smoothstep(0.3, 0.7, texture2D(uMacro, tp * 0.0047 + 0.5).r);
vec3 grassC = tile2(uGrass, tp, 0.16, mixer);
grassC *= mix(vec3(0.78, 1.0, 0.7), vec3(1.2, 1.05, 0.62), smoothstep(0.35, 0.68, m1)) * (0.8 + 0.4 * m2);
vec3 albedo = grassC;
float lw = smoothstep(0.2, 0.75, tc.a + (m3 - 0.5) * 0.35);
if (lw > 0.01) albedo = mix(albedo, tile2(uForest, tp, 0.2, mixer) * (0.8 + 0.4 * m2), lw);
float sw = smoothstep(0.38, 0.66, tc.g + (m3 - 0.5) * 0.3);
if (sw > 0.01) albedo = mix(albedo, tile2(uSand, tp, 0.22, mixer), sw);
float dw = smoothstep(0.4, 0.62, tc.r + (m3 - 0.5) * 0.34);
if (dw > 0.01) {
  vec3 dc = tile2(uDirt, tp, 0.26, mixer) * (0.85 + 0.3 * m2);
  dc *= 1.0 - 0.42 * tc.b;
  albedo = mix(albedo, dc, dw);
}
float slope = 1.0 - tn.y;
float rw = smoothstep(0.15, 0.27, slope + (m2 - 0.5) * 0.09);
rw = max(rw, smoothstep(55.0, 88.0, vWPos.y + (m2 - 0.5) * 18.0) * 0.9);
if (rw > 0.01) albedo = mix(albedo, rockTri(vWPos, tn) * (0.9 + 0.3 * m1), rw);
diffuseColor.rgb *= albedo;
`);
  };
  mat.customProgramCacheKey = () => 'nature-terrain-v1';
  return mat;
}

/**
 * Builds the terrain meshes. Returns { group, material, maps, setQuality() }.
 */
export async function createTerrainMesh({ hf, textures, quality, onProgress }) {
  const ctrlSize = quality === 'low' ? 512 : 1024;
  const maps = await bakeMaps(hf, ctrlSize, (p) => onProgress?.(p));
  const material = makeMaterial(textures, maps.ctrlTex);
  const group = new THREE.Group(); group.name = 'terrain';
  for (let cj = 0; cj < CHUNKS; cj++) for (let ci = 0; ci < CHUNKS; ci++) {
    const mesh = new THREE.Mesh(buildChunkGeometry(hf, ci, cj), material);
    mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = `terrain_${ci}_${cj}`;
    group.add(mesh);
    if ((cj * CHUNKS + ci) % 4 === 3) await tick();
  }
  return { group, material, maps };
}
