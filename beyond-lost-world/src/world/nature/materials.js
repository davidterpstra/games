// Shared materials for instanced nature: flora (atlas + wind), rock (triplanar) and the wind uniforms.
import * as THREE from 'three';

/** Uniforms shared by every swaying material (updated once per frame). */
export const wind = { uTime: { value: 0 }, uWind: { value: 1 } };

/** Atlas material for trees, bushes, ferns, flowers, logs… alpha tested, double sided, wind sway. */
export function createFloraMaterial(atlasTexture) {
  const mat = new THREE.MeshStandardMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime; shader.uniforms.uWind = wind.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aWind;
attribute float aTint;
uniform float uTime;
uniform float uWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
  vec3 iPos = vec3(0.0);
  #endif
  float ph = uTime * 1.25 + iPos.x * 0.11 + iPos.z * 0.09;
  float gust = sin(uTime * 0.43 + iPos.x * 0.021 + iPos.z * 0.017) * 0.5 + 0.5;
  float amp = aWind * (0.05 + 0.11 * gust) * uWind;
  transformed.x += (sin(ph) + 0.45 * sin(ph * 2.7 + position.y * 0.6)) * amp;
  transformed.z += cos(ph * 0.87 + 1.3) * amp * 0.7;
  transformed.y += sin(uTime * 6.3 + position.x * 3.1 + position.z * 4.7 + iPos.x) * 0.012 * aWind * uWind * step(0.35, aTint);
}`)
      .replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, aTint);');
    // normals of cards point outwards from the crown: do not flip them on back faces
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => 'nature-flora-v1';
  return mat;
}

/** Rock material: vertex colours (moss) × object-space triplanar rock texture. */
export function createRockMaterial(rockTexture) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRock = { value: rockTexture };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRP;\nvarying vec3 vRN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
vRP = position * vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)) + instanceMatrix[3].xyz * 0.37;
#else
vRP = position;
#endif
vRN = normal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uRock;
varying vec3 vRP;
varying vec3 vRN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 w = pow(abs(normalize(vRN)), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 t = texture2D(uRock, vRP.zy * 0.3).rgb * w.x + texture2D(uRock, vRP.xz * 0.3).rgb * w.y + texture2D(uRock, vRP.xy * 0.3).rgb * w.z;
  diffuseColor.rgb *= t * 1.7;
}`);
  };
  mat.customProgramCacheKey = () => 'nature-rock-v1';
  return mat;
}
