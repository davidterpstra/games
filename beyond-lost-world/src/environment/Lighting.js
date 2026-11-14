// Sun/moon directional light with texel-snapped shadows centred on the player, plus hemisphere light.
import * as THREE from 'three';
import { QUALITY_PRESETS } from '../core/quality.js';
import { installShadowHook } from '../perf/shadowHook.js';
import { tuning } from '../perf/tuning.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Creates sun + hemisphere lights and adds them to the scene. */
export function createLighting({ scene, quality, shadows, renderer }) {
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = !!shadows;
  sun.name = 'Sun';
  const hemi = new THREE.HemisphereLight(0xaaccff, 0x665544, 1);
  hemi.name = 'Hemisphere';
  scene.add(sun, sun.target, hemi);

  const L = new THREE.Vector3(0, 1, 0);
  const R = new THREE.Vector3();
  const U = new THREE.Vector3();
  const snapped = new THREE.Vector3();
  let extent = 70, mapSize = 2048, lightDist = 200, interval = 0;
  // Shadow-map scheduling: the map is a world-fixed texture, so it only has to be re-rendered when the player
  // has moved a few metres, the sun has turned noticeably, or a refresh interval (quality preset) elapsed.
  // Skipping most of those renders is the biggest single CPU/GPU saving on low/medium.
  const sm = renderer && renderer.shadowMap;
  if (sm) { sm.autoUpdate = false; installShadowHook(renderer); }
  const lastL = new THREE.Vector3(0, 1, 0), lastSnap = new THREE.Vector3(1e9, 0, 0);
  let force = true, lastShadowAt = 0, moveThr2 = 9;

  function configure(preset) {
    extent = preset.shadowDistance;
    mapSize = preset.shadowMapSize;
    lightDist = extent * 1.5 + 90;
    interval = preset.shadowInterval || 0;
    moveThr2 = (extent * 0.05) * (extent * 0.05);
    force = true;
    const sh = sun.shadow;
    if (sh.mapSize.x !== mapSize) {
      sh.mapSize.set(mapSize, mapSize);
      if (sh.map) { sh.map.dispose(); sh.map = null; }
    }
    const cam = sh.camera;
    cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent;
    cam.near = 1; cam.far = lightDist + extent * 1.5 + 60;
    cam.updateProjectionMatrix();
    const texel = (extent * 2) / mapSize;
    sh.bias = -0.0003;
    sh.normalBias = texel * 1.6 + 0.02;
    sh.radius = 1.5;
  }
  configure(QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium);

  return {
    sun, hemi,
    setQuality(name) { configure(QUALITY_PRESETS[name] || QUALITY_PRESETS.medium); },
    setShadows(on) { sun.castShadow = !!on; force = true; },
    /** Forces the shadow map to re-render on the next frame (call after moving casters). */
    refreshShadows() { force = true; },
    /**
     * @param dn DayNight, @param wx weather values, @param dark interior darkness 0..1,
     * @param flash lightning 0..1, @param focus Vector3 (player position)
     */
    update(dn, wx, dark, flash, focus) {
      const useSun = dn.elev > -0.04;
      L.copy(useSun ? dn.sunDir : dn.moonDir);
      if (L.y < 0.1) { L.y = 0.1; L.normalize(); }
      const dim = 1 - wx.overcast * 0.82;
      sun.intensity = useSun ? dn.sunIntensity * dim * (1 - dark) : dn.moonIntensity * (1 - wx.overcast * 0.5) * (1 - dark);
      if (useSun) sun.color.copy(dn.sunColor);
      else sun.color.setRGB(0.55, 0.68, 1.0);

      hemi.color.copy(dn.hemiSky);
      hemi.groundColor.copy(dn.hemiGround);
      // overcast skies give soft, bluish-grey fill; interiors lose almost all ambient light
      // lightly shaded interiors (dark < 1) get extra fill since the roof blocks the sun; caves stay black
      const fill = (dn.hemiIntensity * (1 + wx.overcast * 0.12)) * (1 - 0.97 * dark) * (1 + 4.3 * dark * (1 - dark));
      hemi.intensity = fill + flash * 2.6 * (1 - dark);

      // snap the shadow frustum centre to shadow-map texels (no shimmering when moving)
      const texel = (extent * 2) / mapSize;
      R.crossVectors(UP, L).normalize();
      U.crossVectors(L, R);
      const cr = Math.round(focus.dot(R) / texel) * texel;
      const cu = Math.round(focus.dot(U) / texel) * texel;
      snapped.set(0, 0, 0).addScaledVector(R, cr).addScaledVector(U, cu).addScaledVector(L, focus.dot(L));
      sun.target.position.copy(snapped);
      sun.position.copy(snapped).addScaledVector(L, lightDist);

      if (sm) {
        // no point rendering shadows when the sun is off (interiors, caves) – the stale map is invisible
        const active = sun.castShadow && sun.intensity > 0.02 && dark < 0.985;
        if (!active) force = true;
        else {
          const now = performance.now();
          if (force || now - lastShadowAt >= interval * tuning.shadowInterval || snapped.distanceToSquared(lastSnap) > moveThr2 || L.dot(lastL) < 0.99998) {
            sm.needsUpdate = true; force = false; lastShadowAt = now; lastSnap.copy(snapped); lastL.copy(L);
          }
        }
      }
    },
  };
}
