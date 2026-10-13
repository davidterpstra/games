/* =====================================================================
   Winter: a snow layer that settles on upward-facing surfaces of any
   material (roofs, walls, rocks, leaves, festival tents...) plus snow
   cover on terrain and roads. One shared uniform drives everything.
   ===================================================================== */
const Snow = { u: { value: 0 }, mats: [] };

/* Inject a world-space "up-facing" snow blend into a standard material.
   Chains any onBeforeCompile the material already has. */
function addSnow(mat, amount = 1) {
  if (!mat || mat.userData.snowed) return mat;
  mat.userData.snowed = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uSnow = Snow.u;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSnowUp;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec3 wn = objectNormal;
  #ifdef USE_INSTANCING
  wn = mat3(instanceMatrix) * wn;
  #endif
  vec3 wn2 = mat3(modelMatrix) * wn;
  float wl = dot(wn2, wn2);
  vSnowUp = wl > 1e-10 ? wn2.y * inversesqrt(wl) : 0.0; // degenerate normals must not produce NaN
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow; varying float vSnowUp;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
float snowK = clamp(uSnow * ${amount.toFixed(2)} * smoothstep(0.25, 0.75, vSnowUp), 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), snowK);
roughnessFactor = mix(roughnessFactor, 0.75, snowK);`);
  };
  // three.js caches programs by the onBeforeCompile source; keep variants apart
  const key = (prev ? prev.toString() : 'none') + '|snow' + amount;
  mat.customProgramCacheKey = () => key;
  mat.needsUpdate = true;
  Snow.mats.push(mat);
  return mat;
}

/* Called once after the world is built: snow on everything static. */
function applySnowToWorld(scene) {
  const skip = new Set([Terrain.material, ...RoadGfx.materials, ...Props.waterMats]);
  const inCar = (o) => { for (let p = o; p; p = p.parent) if (p.userData.isCar) return true; return false; };
  scene.traverse((o) => {
    if (!o.isMesh || !o.material || inCar(o)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (skip.has(m) || !m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.transparent) continue;
      if (m.emissive && m.emissive.getHex() !== 0 && !m.emissiveMap) continue; // lamps and glowing signs
      if (Object.values(CarMats).includes(m) || m.userData.lamp) continue;
      addSnow(m, m.vertexColors ? 0.85 : 1);
    }
  });
}

function updateSnow(dt) {
  const target = Sky.cur.snow || 0;
  // snow settles slowly and melts slower still; instant when the weather was set instantly
  const s = Snow.u.value;
  Snow.u.value = target > s ? Math.min(target, s + dt * 0.06) : Math.max(target, s - dt * 0.03);
  if (Sky.snapSnow) { Snow.u.value = target; Sky.snapSnow = false; }
  const k = Snow.u.value;
  if (Terrain.material) Terrain.material.userData.u.uSnowCover.value = k;
  for (const m of RoadGfx.materials) if (m.userData.u.uSnowRoad) m.userData.u.uSnowRoad.value = k;
  if (Props.grass && Props.grass.mesh) Props.grass.mesh.visible = Props.grass.count > 0 && k < 0.45;
  Sky.snowCover = k;
}
