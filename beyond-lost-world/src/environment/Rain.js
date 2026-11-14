// GPU rain: instanced camera-facing streaks that wrap inside a box around the camera.
// All motion happens in the vertex shader, so there is no per-frame CPU work except uniforms.
import * as THREE from 'three';

const VERT = /* glsl */`
attribute vec4 aSeed;
uniform vec3 uCam, uBox, uVel, uColor;
uniform float uTime, uLen, uWidth, uAlpha;
varying float vA;
varying vec2 vP;
void main() {
  vec3 q = aSeed.xyz * uBox + uVel * uTime * (0.85 + 0.3 * aSeed.w);
  vec3 rel = mod(q - uCam, uBox) - uBox * 0.5;
  vec3 head = uCam + rel;
  vec3 tail = head - normalize(uVel) * uLen * (0.7 + 0.6 * aSeed.w);
  vec4 a = viewMatrix * vec4(head, 1.0);
  vec4 b = viewMatrix * vec4(tail, 1.0);
  vec3 dir = b.xyz - a.xyz;
  vec3 side = normalize(cross(dir, a.xyz)) * max(uWidth, -a.z * 0.0016) * (0.7 + 0.6 * aSeed.w);
  vec3 vp = mix(a.xyz, b.xyz, position.y) + side * position.x;
  gl_Position = projectionMatrix * vec4(vp, 1.0);
  float dist = length(rel);
  float edge = 1.0 - smoothstep(0.3, 0.5, max(abs(rel.x), abs(rel.z)) / uBox.x);
  vA = uAlpha * edge * smoothstep(0.8, 2.5, dist) * (0.5 + 0.5 * aSeed.w);
  vP = vec2(position.x * 2.0, position.y);
}`;
const FRAG = /* glsl */`
uniform vec3 uColor;
varying float vA;
varying vec2 vP;
void main() {
  float a = vA * (1.0 - vP.y * 0.85) * (1.0 - abs(vP.x));
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const COUNTS = { low: 1500, medium: 3200, high: 5500 };
const MAX = 5500;

/** Creates the rain streak system. */
export function createRain(quality = 'medium') {
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  const seeds = new Float32Array(MAX * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = COUNTS[quality] || COUNTS.medium;

  const uniforms = {
    uCam: { value: new THREE.Vector3() },
    uBox: { value: new THREE.Vector3(34, 22, 34) },
    uVel: { value: new THREE.Vector3(0, -16, 0) },
    uColor: { value: new THREE.Color(0.75, 0.82, 0.92) },
    uTime: { value: 0 }, uLen: { value: 0.55 }, uWidth: { value: 0.006 }, uAlpha: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 50;
  mesh.visible = false;
  mesh.name = 'Rain';
  let count = geo.instanceCount;

  return {
    mesh,
    setQuality(q) { count = COUNTS[q] || COUNTS.medium; },
    /** intensity 0..1 (already faded for interiors), wind 0..1, light 0..1 brightness of the day */
    update(time, cam, intensity, wind, light, tint) {
      mesh.visible = intensity > 0.01;
      if (!mesh.visible) return;
      const u = uniforms;
      u.uTime.value = time;
      u.uCam.value.copy(cam);
      u.uVel.value.set(wind * 7, -16 - intensity * 3, wind * 2.5);
      u.uAlpha.value = 0.55 * Math.min(1, intensity * 1.2);
      u.uColor.value.copy(tint).multiplyScalar(0.25 + light * 0.9);
      geo.instanceCount = Math.max(1, Math.floor(count * (0.25 + 0.75 * intensity)));
    },
    dispose() { geo.dispose(); quad.dispose(); material.dispose(); },
  };
}
