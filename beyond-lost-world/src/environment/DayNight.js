// Day/night clock and keyframed atmosphere colours.
// One full day = 24 real minutes. Colours are keyed on the sun's elevation (smooth through dawn,
// day, golden hour, dusk and night); the clock only advances when asked to.
import * as THREE from 'three';

export const HOURS_PER_SECOND = 24 / (24 * 60);

const c = (hex) => new THREE.Color(hex);
// e = sun elevation (sine of altitude). zen/hor = sky zenith/horizon, sun = sunlight colour, hemS/hemG = hemisphere.
const KEYS = [
  { e: -0.40, zen: c(0x050a1e), hor: c(0x142241), sun: c(0xffffff), sunI: 0, hemS: c(0x4a62a6), hemG: c(0x1a2238), hemI: 0.80, exp: 1.30 },
  { e: -0.20, zen: c(0x080f28), hor: c(0x1d2d52), sun: c(0xffffff), sunI: 0, hemS: c(0x4a62a6), hemG: c(0x1a2238), hemI: 0.78, exp: 1.28 },
  { e: -0.10, zen: c(0x0f1c44), hor: c(0x4a4068), sun: c(0xff8a5a), sunI: 0, hemS: c(0x5a64a0), hemG: c(0x2a2838), hemI: 0.78, exp: 1.18 },
  { e: -0.035, zen: c(0x1c3068), hor: c(0xb06a82), sun: c(0xff7a44), sunI: 0.0, hemS: c(0x7078b0), hemG: c(0x3a3036), hemI: 0.95, exp: 1.12 },
  { e: 0.00, zen: c(0x2c4c92), hor: c(0xff9262), sun: c(0xff7a3c), sunI: 0.7, hemS: c(0x8a92c0), hemG: c(0x4a3a30), hemI: 1.0, exp: 1.06 },
  { e: 0.07, zen: c(0x3868b4), hor: c(0xffb078), sun: c(0xff9d52), sunI: 1.7, hemS: c(0x93a8d6), hemG: c(0x54463a), hemI: 1.02, exp: 1.02 },
  { e: 0.18, zen: c(0x3a70c4), hor: c(0xf2bc82), sun: c(0xffc47e), sunI: 2.5, hemS: c(0x9ab8e2), hemG: c(0x5a4e3c), hemI: 0.98, exp: 1.0 },
  { e: 0.40, zen: c(0x3374cf), hor: c(0xb8d0e8), sun: c(0xffe3bc), sunI: 2.7, hemS: c(0xa2c4f0), hemG: c(0x625a42), hemI: 1.04, exp: 0.98 },
  { e: 0.95, zen: c(0x2a6bd0), hor: c(0xa8cdf2), sun: c(0xfff6ea), sunI: 2.9, hemS: c(0xa6c8f5), hemG: c(0x6a6048), hemI: 1.08, exp: 0.96 },
];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export { smooth as smoothstep };

/** Day/night clock plus sampling of the atmosphere keyframes. */
export class DayNight {
  constructor() {
    this.time = 7.5;
    this.day = 0;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(0, -1, 0);
    this.elev = 0.3;
    this.night = 0;          // 0 day .. 1 full night (stars, crickets)
    this.dayFactor = 1;      // 0 night .. 1 day (birds)
    this.twilight = 0;       // 1 around sunrise/sunset
    this.moonIntensity = 0;
    this.zenith = new THREE.Color();
    this.horizon = new THREE.Color();
    this.sunColor = new THREE.Color();
    this.sunIntensity = 0;
    this.hemiSky = new THREE.Color();
    this.hemiGround = new THREE.Color();
    this.hemiIntensity = 1;
    this.exposure = 1;
    this.compute();
  }

  /** Advance the clock by dt real seconds. Returns true when midnight passed. */
  advance(dt) {
    this.time += dt * HOURS_PER_SECOND;
    let wrapped = false;
    if (this.time >= 24) { this.time -= 24; this.day++; wrapped = true; }
    this.compute();
    return wrapped;
  }

  setTime(h) { this.time = ((h % 24) + 24) % 24; this.compute(); }

  compute() {
    const t = this.time;
    const a = t >= 6 && t < 19.5
      ? ((t - 6) / 13.5) * Math.PI
      : Math.PI + (((t >= 19.5 ? t - 19.5 : t + 4.5)) / 10.5) * Math.PI;
    this.sunDir.set(Math.cos(a), 0.88 * Math.sin(a), 0.36).normalize();
    this.moonDir.set(-this.sunDir.x, -this.sunDir.y, 0.25).normalize();
    const e = this.sunDir.y;
    this.elev = e;
    this.night = smooth(-0.02, -0.22, e);
    this.dayFactor = smooth(-0.02, 0.12, e);
    this.twilight = smooth(-0.2, 0.0, e) * (1 - smooth(0.05, 0.3, e));
    this.moonIntensity = 0.5 * smooth(-0.06, -0.3, e);

    let i = 0;
    while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
    const k0 = KEYS[i], k1 = KEYS[i + 1];
    const u = Math.min(1, Math.max(0, (e - k0.e) / (k1.e - k0.e)));
    this.zenith.copy(k0.zen).lerp(k1.zen, u);
    this.horizon.copy(k0.hor).lerp(k1.hor, u);
    this.sunColor.copy(k0.sun).lerp(k1.sun, u);
    this.hemiSky.copy(k0.hemS).lerp(k1.hemS, u);
    this.hemiGround.copy(k0.hemG).lerp(k1.hemG, u);
    this.sunIntensity = (k0.sunI + (k1.sunI - k0.sunI) * u) * smooth(-0.035, 0.03, e);
    this.hemiIntensity = k0.hemI + (k1.hemI - k0.hemI) * u;
    this.exposure = k0.exp + (k1.exp - k0.exp) * u;
  }
}
