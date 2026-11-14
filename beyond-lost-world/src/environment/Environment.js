// BEYOND – THE LOST WORLD · Environment: sky, sun/moon lighting + shadows, day/night, fog, weather,
// interior darkness, the player's torch and all audio. Contract: docs/ARCHITECTURE.md → Environment API.
import * as THREE from 'three';
import { QUALITY_PRESETS } from '../core/quality.js';
import { DayNight, HOURS_PER_SECOND } from './DayNight.js';
import { createSky } from './Sky.js';
import { createLighting } from './Lighting.js';
import { createWeather, WEATHER_TYPES } from './Weather.js';
import { createRain } from './Rain.js';
import { createTorch } from './Torch.js';
import { createAudio } from './audio/Audio.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * @param {{scene:THREE.Scene, renderer:THREE.WebGLRenderer, camera:THREE.PerspectiveCamera, world:object, bus:object, settings:object, quality:string}} o
 */
export function createEnvironment({ scene, renderer, camera, world, bus, settings, quality = 'medium' }) {
  let qualityName = QUALITY_PRESETS[quality] ? quality : 'medium';
  let preset = QUALITY_PRESETS[qualityName];

  const dn = new DayNight();
  const sky = createSky(qualityName);
  scene.add(sky.mesh);
  const lighting = createLighting({ scene, quality: qualityName, shadows: settings.get('shadows'), renderer });
  const rain = createRain(qualityName);
  scene.add(rain.mesh);
  const torch = createTorch({ camera });
  const audio = createAudio({ bus, settings });
  audio.setListener(camera);

  const weather = createWeather({ onThunder: (delay, intensity) => audio.thunder(delay, intensity) });
  const wx = weather.values;

  scene.fog = new THREE.Fog(0xaaccee, 30, preset.viewDistance * 0.9);
  scene.background = new THREE.Color(0x000000);

  // interior state
  let dark = 0, indoor = 0, zone = null;
  let time = 0;
  let torchOn = false;
  const lastPlayer = new THREE.Vector3();
  let havePlayer = false;
  const fogColor = new THREE.Color();
  const rainTint = new THREE.Color();
  const ambient = {
    camX: 0, camY: 0, camZ: 0, rightX: 1, rightZ: 0, wind: 0, rain: 0, storm: 0, fog: 0, day: 1, night: 0,
    indoor: 0, zoneId: '', zoneDark: 0, powered: false,
  };

  // track the bunker power state for the hum (world.setPowered is called by gameplay)
  if (world && typeof world.setPowered === 'function') {
    const orig = world.setPowered.bind(world);
    world.setPowered = (group, on) => { orig(group, on); if (group === 'bunker') audio.setPowered(on); };
  }
  bus.on('sfx', (p) => { if (p && p.name === 'power_on') audio.setPowered(true); });

  bus.on('settings:changed', ({ key, value }) => { if (key === 'shadows') lighting.setShadows(value); });

  function findZone(p) {
    if (!world) return null;
    if (typeof world.interiorAt === 'function') return world.interiorAt(p);
    return null;
  }

  function applyFog() {
    const vf = preset.viewDistance;
    const mist = 0.25 * dn.twilight + 0.18 * clamp01(1 - Math.abs(dn.time - 6.5) / 2.2);
    const f = Math.max(wx.fog, wx.rain * 0.15);
    let far = Math.max(48, vf * 0.92 * (1 - 0.8 * f) * (1 - 0.3 * mist));
    // pitch-black interiors (caves, unpowered bunker): nothing beyond a few dozen metres can be seen anyway
    const deep = clamp01((dark - 0.8) / 0.15);
    far += (Math.min(far, 70) - far) * deep;
    const near = Math.max(0.5, vf * 0.22 * (1 - 0.97 * f) * (1 - 0.4 * mist));
    const fog = scene.fog;
    fog.near = Math.min(near, far * 0.8); fog.far = far;
    // everything beyond the fog's far distance is pure fog colour, so the camera never needs to see further:
    // objects past it are skipped by frustum culling (saves draw calls in haze, rain, fog and at dusk)
    const wantFar = Math.max(130, far + 12);
    if (Math.abs(camera.far - wantFar) > 2) { camera.far = wantFar; camera.updateProjectionMatrix(); }
    fogColor.copy(sky.uniforms.uHorizon.value);
    if (wx.fog > 0.01) fogColor.lerp(sky.uniforms.uZenith.value, 0.15 * wx.fog);
    fogColor.multiplyScalar(1 - 0.95 * dark);
    fog.color.copy(fogColor);
    scene.background.copy(fogColor);
  }

  const env = {
    /** Frame update. simulate=false freezes the clock and weather timers (paused/menus). */
    update(dt, playerPosition, { simulate = true } = {}) {
      time += dt;
      const dtHours = simulate ? dt * HOURS_PER_SECOND : 0;
      if (simulate) dn.advance(dt);
      weather.update(dt, dtHours, dn.time);
      wx.windNow = Math.min(1, wx.windNow);

      // interior detection & smooth darkness
      zone = findZone(camera.position);
      const k = 1 - Math.exp(-dt * 3);
      dark += ((zone ? zone.darkness : 0) - dark) * k;
      indoor += ((zone ? 1 : 0) - indoor) * k;

      sky.update(dt, dn, wx, weather.flash * (1 - indoor), camera, time);
      sky.mesh.visible = dark < 0.985;
      applyFog();
      lighting.update(dn, wx, dark, weather.flash, playerPosition);
      renderer.toneMappingExposure = dn.exposure * (1 - 0.08 * wx.overcast) * (1 - 0.1 * dark);

      // rain
      rainTint.copy(sky.uniforms.uHorizon.value).lerp(_white, 0.35);
      rain.update(time, camera.position, wx.rain * (1 - clamp01(indoor * 1.4)), wx.windNow, 0.15 + 0.85 * dn.dayFactor, rainTint);

      // torch
      let speed = 0;
      if (havePlayer && dt > 0) {
        const dx = playerPosition.x - lastPlayer.x, dz = playerPosition.z - lastPlayer.z;
        speed = Math.hypot(dx, dz) / dt;
        if (speed > 25) speed = 0;
      }
      lastPlayer.copy(playerPosition); havePlayer = true;
      torch.update(dt, speed, time, 1);

      // audio
      const a = ambient;
      a.camX = camera.position.x; a.camY = camera.position.y; a.camZ = camera.position.z;
      a.wind = wx.windNow; a.rain = wx.rain; a.storm = wx.storm; a.fog = wx.fog;
      a.day = dn.dayFactor; a.night = dn.night;
      a.indoor = indoor; a.zoneId = zone ? String(zone.id) : ''; a.zoneDark = zone ? zone.darkness : 0;
      audio.update(dt, a);
    },

    /** Interior darkness 0..1 (smoothed). 1 = pitch black room/cave. */
    get darkness() { return dark; },
    /** 0..1 how far the camera is inside an interior zone (smoothed). */
    get indoor() { return indoor; },

    getTimeOfDay() { return dn.time; },
    setTimeOfDay(h) { dn.setTime(Number(h) || 0); },
    get day() { return dn.day; },
    set day(v) { dn.day = v | 0; },

    get weather() { return weather.name; },
    setWeather(name, instant = false) {
      if (!WEATHER_TYPES.includes(name)) { console.warn(`[environment] unknown weather "${name}"`); return; }
      weather.set(name, instant, true);
    },
    /** Auto weather changes can be disabled (tests, cutscenes). */
    set autoWeather(v) { weather.autoChange = !!v; },
    get autoWeather() { return weather.autoChange; },

    /** Wind strength 0..1 (gusty) for vegetation, water, particles. */
    get wind() { return wx.windNow; },
    get night() { return dn.night; },
    get sunDirection() { return dn.sunDir; },
    get interior() { return zone; },

    setTorch(on) {
      on = !!on;
      if (on === torchOn) return;
      torchOn = on;
      torch.set(on);
      audio.setTorch(on);
      audio.play(on ? 'torch_on' : 'torch_off');
      bus.emit('torch:changed', { on });
    },
    get torchOn() { return torchOn; },

    audio: {
      unlock: () => audio.unlock(),
      play: (name, o) => audio.play(name, o),
      setListener: (cam) => audio.setListener(cam),
      get ready() { return audio.ready; },
    },

    setQuality(name) {
      if (!QUALITY_PRESETS[name]) return;
      qualityName = name; preset = QUALITY_PRESETS[name];
      lighting.setQuality(name); rain.setQuality(name); sky.setQuality(name);
    },

    serialize() { return { time: dn.time, day: dn.day, weather: weather.name }; },
    deserialize(data) {
      if (!data) return;
      if (typeof data.time === 'number') dn.setTime(data.time);
      if (typeof data.day === 'number') dn.day = data.day | 0;
      if (WEATHER_TYPES.includes(data.weather)) weather.set(data.weather, true);
    },

    dispose() {
      scene.remove(sky.mesh, rain.mesh); sky.dispose(); rain.dispose(); torch.dispose();
    },
  };
  const _white = new THREE.Color(1, 1, 1);
  return env;
}
