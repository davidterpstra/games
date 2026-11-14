// Ground-cover grass: one instanced draw call of blade clumps in a ring around the camera.
// Positions are computed entirely in the vertex shader from a toroidal grid (instances are re-used
// as the camera moves); heights come from the float height texture, placement from the grass mask.
import * as THREE from 'three';
import { QUALITY_PRESETS } from '../../core/quality.js';
import { WORLD_SIZE } from '../layout.js';
import { wind } from './materials.js';

function bladeGeometry() {
  const pos = [], blade = [], idx = [];
  const NB = 5;
  for (let b = 0; b < NB; b++) {
    const a = (b / NB) * Math.PI * 2 + b * 0.7;
    const ox = Math.cos(a) * 0.09 * (0.5 + (b % 3) * 0.3), oz = Math.sin(a) * 0.09 * (0.5 + (b % 2) * 0.6);
    const ang = a * 1.7 + 0.4, wx = Math.cos(ang), wz = Math.sin(ang);
    const lean = [Math.cos(a) * (0.35 + (b % 2) * 0.25), Math.sin(a) * (0.35 + (b % 3) * 0.1)];
    const w = 0.028 + (b % 3) * 0.006, shade = 0.75 + (b % 4) * 0.12;
    const base = pos.length / 3;
    const rows = [[0, w], [0.55, w * 0.75], [1, 0.0]];
    for (const [y, hw] of rows) {
      if (hw > 0) {
        pos.push(ox - wx * hw, y, oz - wz * hw, ox + wx * hw, y, oz + wz * hw);
        blade.push(lean[0], lean[1], shade, lean[0], lean[1], shade);
      } else { pos.push(ox, y, oz); blade.push(lean[0], lean[1], shade); }
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aBlade', new THREE.Float32BufferAttribute(blade, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}

/**
 * @param {{ scene: THREE.Scene, hf: object, maps: {heightTex, maskTex}, quality: string }} o
 */
export function createGrass({ scene, hf, maps, quality }) {
  const geo = bladeGeometry();
  const uniforms = {
    uCam: { value: new THREE.Vector3() }, uCell: { value: 0.6 }, uM: { value: 100 }, uRadius: { value: 30 }, uDensity: { value: 1 },
    uHeight: { value: maps.heightTex }, uMask: { value: maps.maskTex }, uGrid: { value: new THREE.Vector3(hf.W, hf.cell, hf.N) },
    uTime: wind.uTime, uWind: wind.uWind,
  };
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aBlade;
uniform vec3 uCam;
uniform float uCell, uM, uRadius, uDensity, uTime, uWind;
uniform sampler2D uHeight, uMask;
uniform vec3 uGrid;
varying vec3 vGrassCol;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float terrainH(vec2 w) {
  float fx = clamp((w.x + ${(WORLD_SIZE / 2).toFixed(1)}) / uGrid.y, 0.0, uGrid.z - 0.001);
  float fz = clamp((w.y + ${(WORLD_SIZE / 2).toFixed(1)}) / uGrid.y, 0.0, uGrid.z - 0.001);
  int i = int(floor(fx)), j = int(floor(fz));
  float u = fx - float(i), v = fz - float(j);
  float h00 = texelFetch(uHeight, ivec2(i, j), 0).r, h10 = texelFetch(uHeight, ivec2(i + 1, j), 0).r;
  float h01 = texelFetch(uHeight, ivec2(i, j + 1), 0).r, h11 = texelFetch(uHeight, ivec2(i + 1, j + 1), 0).r;
  return v >= u ? h00 + u * (h11 - h01) + v * (h01 - h00) : h00 + u * (h10 - h00) + v * (h11 - h10);
}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(1.0, 0.0, 0.0);\n#endif')
      .replace('#include <begin_vertex>', `
float k = float(gl_InstanceID);
vec2 slot = vec2(mod(k, uM), floor(k / uM));
vec2 camCell = floor(uCam.xz / uCell);
vec2 baseCell = camCell - floor(uM * 0.5);
vec2 cellIdx = baseCell + mod(slot - baseCell, uM);
float h1 = h21(cellIdx), h2 = h21(cellIdx + 17.3), h3 = h21(cellIdx + 41.7), h4 = h21(cellIdx + 5.9), h5 = h21(cellIdx + 88.1);
vec2 wp = (cellIdx + vec2(h1, h2)) * uCell;
float dist = length(wp - uCam.xz);
float fade = 1.0 - smoothstep(uRadius * 0.6, uRadius, dist);
float mask = texture2D(uMask, (wp + ${(WORLD_SIZE / 2).toFixed(1)}) / ${WORLD_SIZE.toFixed(1)}).r;
float keep = step(h3, uDensity) * smoothstep(0.25, 0.75, mask + (h4 - 0.5) * 0.35);
float gh = terrainH(wp);
float hgt = (0.2 + 0.34 * h4 * h4 + 0.08 * h5) * fade * keep * (0.8 + 0.3 * mask);
float s = 0.8 + 0.7 * h2;
float sway = (sin(uTime * 1.7 + wp.x * 0.33 + wp.y * 0.27) + 0.5 * sin(uTime * 3.1 + wp.x * 0.9)) * 0.5;
float y = position.y;
vec3 transformed = vec3(wp.x + position.x * s, gh - 0.03 + y * hgt, wp.y + position.z * s);
transformed.xz += (aBlade.xy * 0.3 + vec2(sway * 0.35, sway * 0.22) * uWind) * y * y * hgt;
transformed.y -= y * y * hgt * 0.12 * length(aBlade.xy);
float dry = smoothstep(0.55, 1.0, h5) * 0.5;
vec3 baseC = vec3(0.03, 0.06, 0.014), tipC = mix(vec3(0.12, 0.22, 0.05), vec3(0.3, 0.28, 0.1), dry);
vGrassCol = mix(baseC, tipC, y) * aBlade.z * (0.85 + 0.3 * h1);
`);
    shader.vertexShader = shader.vertexShader.replace('void main() {', 'void main() {');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrassCol;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGrassCol;')
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => 'nature-grass-v1';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'grass';
  scene.add(mesh);

  function setQuality(name) {
    const q = QUALITY_PRESETS[name] || QUALITY_PRESETS.high;
    const dens = Math.max(q.grassDensity, 0.0);
    const perM2 = 3.0 * dens;
    const cell = 1 / Math.sqrt(Math.max(perM2, 0.05));
    const radius = 14 + 22 * Math.sqrt(dens);
    const M = Math.ceil((2 * radius) / cell) + 2;
    uniforms.uCell.value = cell; uniforms.uM.value = M; uniforms.uRadius.value = radius; uniforms.uDensity.value = 1;
    geo.instanceCount = M * M;
    mesh.visible = dens > 0;
  }
  setQuality(quality);
  return { mesh, setQuality, update(cam) { uniforms.uCam.value.copy(cam); }, get instances() { return geo.instanceCount; } };
}
