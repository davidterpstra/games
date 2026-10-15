/* =====================================================================
   Configuration: cars, paints, surfaces, weather presets, quality presets
   ===================================================================== */

/* Every car is fictional. Physical values feed the physics directly:
   power (kW) + vmax set acceleration and aerodynamic drag, mu is tyre
   grip, rearGrip < 1 makes the tail looser (easier to drift), steer is
   the low-speed steering lock in radians. */
const CARS = [
  {
    id: 'kestrel', price: 0, name: 'Kestrel RS', maker: 'Kestrel Automotive', year: 2024, style: 'wedge',
    desc: 'Mid-engined V10 wedge. Sharp turn-in, all-wheel drive traction.',
    power: 470, mass: 1450, vmax: 325, mu: 1.16, rearGrip: 1.0, steer: 0.56, brake: 1.15,
    drive: 'AWD', front: 0.32, offroad: 0.25, len: 4.55, wid: 1.98, hgt: 1.17, wb: 2.62, track: 1.68,
    cg: 0.46, tyreR: 0.355, wing: 0, col: 0xf2b705, eng: { cyl: 10, idle: 1000, red: 8500 },
  },
  {
    id: 'aurelia', price: 38000, name: 'Aurelia Strada GT', maker: 'Aurelia', year: 2022, style: 'gt',
    desc: 'Long-bonnet V12 grand tourer. Stable, fast, a little heavy.',
    power: 440, mass: 1680, vmax: 318, mu: 1.06, rearGrip: 0.97, steer: 0.52, brake: 1.05,
    drive: 'RWD', front: 0, offroad: 0.15, len: 4.75, wid: 1.96, hgt: 1.28, wb: 2.8, track: 1.66,
    cg: 0.5, tyreR: 0.36, wing: 0, col: 0x8c1020, eng: { cyl: 12, idle: 850, red: 7800 },
  },
  {
    id: 'furia', price: 85000, name: 'Halcyon Furia', maker: 'Halcyon', year: 2025, style: 'hyper',
    desc: 'Hypercar with active aero. Brutal power, huge downforce wing.',
    power: 730, mass: 1380, vmax: 362, mu: 1.24, rearGrip: 1.0, steer: 0.52, brake: 1.3,
    drive: 'RWD', front: 0, offroad: 0.1, len: 4.7, wid: 2.04, hgt: 1.12, wb: 2.7, track: 1.72,
    cg: 0.42, tyreR: 0.36, wing: 1, col: 0x1e6bff, eng: { cyl: 8, idle: 1100, red: 9200 },
  },
  {
    id: 'brisa', price: 0, name: 'Brisa 86', maker: 'Brisa', year: 1988, style: 'coupe',
    desc: 'Light, rear-drive classic coupe. Low power, endless drifts.',
    power: 175, mass: 1120, vmax: 228, mu: 0.98, rearGrip: 0.9, steer: 0.62, brake: 0.95,
    drive: 'RWD', front: 0, offroad: 0.2, len: 4.25, wid: 1.7, hgt: 1.3, wb: 2.42, track: 1.46,
    cg: 0.5, tyreR: 0.31, wing: 0, col: 0xf4f4f0, eng: { cyl: 4, idle: 900, red: 7600 },
  },
  {
    id: 'marauder', price: 16000, name: 'Marauder 69', maker: 'Marauder Motor Co.', year: 1969, style: 'muscle',
    desc: 'Big-block muscle car. Massive torque and a lively tail.',
    power: 350, mass: 1620, vmax: 268, mu: 0.93, rearGrip: 0.88, steer: 0.55, brake: 0.85,
    drive: 'RWD', front: 0, offroad: 0.2, len: 4.85, wid: 1.92, hgt: 1.32, wb: 2.75, track: 1.58,
    cg: 0.55, tyreR: 0.35, wing: 0, col: 0x1b7a3c, eng: { cyl: 8, idle: 750, red: 6400 },
  },
  {
    id: 'taiga', price: 0, name: 'Taiga Rally Evo', maker: 'Taiga', year: 2008, style: 'hatch',
    desc: 'Turbo rally hatch. All-wheel drive, at home on gravel and grass.',
    power: 240, mass: 1260, vmax: 238, mu: 1.04, rearGrip: 0.96, steer: 0.6, brake: 1.0,
    drive: 'AWD', front: 0.45, offroad: 0.8, len: 4.15, wid: 1.82, hgt: 1.44, wb: 2.55, track: 1.56,
    cg: 0.55, tyreR: 0.33, wing: 1, col: 0xe8e8ee, eng: { cyl: 4, idle: 950, red: 7400 },
  },
  {
    id: 'ridgeback', price: 24000, name: 'Ridgeback T1', maker: 'Ridgeback', year: 2021, style: 'truck',
    desc: 'Desert trophy truck. Long-travel suspension, unstoppable off-road.',
    power: 340, mass: 1900, vmax: 205, mu: 0.98, rearGrip: 0.95, steer: 0.58, brake: 0.9,
    drive: 'AWD', front: 0.4, offroad: 1.0, len: 4.9, wid: 2.12, hgt: 1.85, wb: 3.0, track: 1.86,
    cg: 0.8, tyreR: 0.46, wing: 0, col: 0xff6a13, eng: { cyl: 8, idle: 800, red: 6200 },
  },
];

const PAINTS = [0xf2b705, 0x8c1020, 0x1e6bff, 0xf4f4f0, 0x1b7a3c, 0xff6a13, 0x111317, 0xff2d78, 0x6d7a86, 0x00b7c7, 0x6a2fd6, 0xc0c4c8];

// Performance index: a single number that summarises a car, plus a class letter.
function carPI(c) {
  const pw = c.power / c.mass * 1000; // W/kg
  const pi = 100 + pw * 1.25 + (c.vmax - 200) * 1.3 + (c.mu - 0.9) * 600 + (c.brake - 0.8) * 120;
  const v = Math.round(clamp(pi, 100, 999));
  const cls = v >= 900 ? 'X' : v >= 800 ? 'S2' : v >= 700 ? 'S1' : v >= 600 ? 'A' : v >= 500 ? 'B' : v >= 400 ? 'C' : 'D';
  return { v, cls };
}
// Normalised 0..10 stat bars for the garage.
function carStats(c) {
  const pw = c.power / c.mass * 1000;
  return {
    Speed: clamp((c.vmax - 160) / 22, 1, 10),
    Acceleration: clamp(pw / 52 + (c.drive === 'AWD' ? 1.2 : 0), 1, 10),
    Handling: clamp((c.mu - 0.8) * 22 + c.steer * 3, 1, 10),
    Braking: clamp(c.brake * 7.2, 1, 10),
    'Off-road': clamp(c.offroad * 9 + 1, 1, 10),
    Drift: clamp((1.05 - c.rearGrip) * 45 + (c.drive === 'RWD' ? 3 : 0) + 1, 1, 10),
  };
}

/* ---------- surfaces ---------- */
const S_ASPHALT = 0, S_GRAVEL = 1, S_GRASS = 2, S_DIRT = 3, S_MUD = 4, S_SNOW = 5, S_ROCK = 6, S_WATER = 7, S_PAVED = 8;
const SURF = [
  { name: 'Asphalt', mu: 1.0, rr: 0.012, bump: 0.0, dust: null, snd: 0 },
  { name: 'Gravel', mu: 0.74, rr: 0.03, bump: 0.35, dust: 0xb59a74, snd: 1 },
  { name: 'Grass', mu: 0.66, rr: 0.05, bump: 0.45, dust: 0x6f7d3a, snd: 2 },
  { name: 'Dirt', mu: 0.7, rr: 0.04, bump: 0.5, dust: 0x9a7a55, snd: 1 },
  { name: 'Mud', mu: 0.52, rr: 0.11, bump: 0.6, dust: 0x4e3b28, snd: 3 },
  { name: 'Snow', mu: 0.45, rr: 0.04, bump: 0.3, dust: 0xf2f6fa, snd: 2 },
  { name: 'Rock', mu: 0.78, rr: 0.03, bump: 0.8, dust: 0x9a948a, snd: 1 },
  { name: 'Water', mu: 0.4, rr: 0.4, bump: 0.6, dust: 0xbfd6e0, snd: 3 },
  { name: 'Paved', mu: 0.98, rr: 0.013, bump: 0.05, dust: null, snd: 0 },
];

/* ---------- weather / time-of-day presets ---------- */
const WEATHERS = [
  { id: 'sunny', name: 'Sunny afternoon', time: 15.2, clouds: 0.22, rain: 0, fog: 0 },
  { id: 'cloudy', name: 'Overcast', time: 13.5, clouds: 0.86, rain: 0, fog: 0.15 },
  { id: 'rain', name: 'Rain', time: 14.0, clouds: 1, rain: 1, fog: 0.35 },
  { id: 'fog', name: 'Morning fog', time: 8.2, clouds: 0.55, rain: 0, fog: 1 },
  { id: 'sunset', name: 'Golden sunset', time: 19.15, clouds: 0.35, rain: 0, fog: 0.1 },
  { id: 'night', name: 'Night', time: 23.2, clouds: 0.25, rain: 0, fog: 0.08 },
  { id: 'winter', name: 'Winter snow', time: 12.6, clouds: 0.68, rain: 0, fog: 0.28, snow: 1 },
  { id: 'winternight', name: 'Winter night', time: 21.8, clouds: 0.4, rain: 0, fog: 0.15, snow: 1 },
];

/* ---------- graphics presets ---------- */
const QUALITY = {
  low: { name: 'Low', traffic: 5, dpr: 0.75, shadows: 0, post: false, rays: 0, flare: false, msaa: 0, grass: 0, treeFar: 1000, view: 3400, rain: 2500, treeShadows: false, terrainLod: [250, 700] },
  medium: { name: 'Medium', traffic: 8, dpr: 1.0, shadows: 1024, post: true, rays: 12, flare: true, msaa: 2, grass: 14000, treeFar: 1600, view: 3600, rain: 5000, treeShadows: false, terrainLod: [320, 800] },
  high: { name: 'High', traffic: 12, dpr: 1.5, shadows: 2048, post: true, rays: 24, flare: true, msaa: 4, grass: 32000, treeFar: 2400, view: 3800, rain: 9000, treeShadows: true, terrainLod: [420, 1000] },
  ultra: { name: 'Ultra', traffic: 16, dpr: 2.0, shadows: 4096, post: true, rays: 36, flare: true, msaa: 4, grass: 60000, treeFar: 3400, view: 4000, rain: 14000, treeShadows: true, terrainLod: [560, 1300] },
};

const DEFAULT_SETTINGS = {
  quality: 'high', resScale: 1, autoRes: true, weather: 'sunny', dynamicTime: false, timeSpeed: 1,
  master: 0.8, engine: 0.8, sfx: 0.8, ambient: 0.6, muted: false,
  assist: true, shake: true, camera: 0, abs: true, showFps: false, online: true,
};
