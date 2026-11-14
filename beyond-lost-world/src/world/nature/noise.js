// Small deterministic noise helpers shared by all nature modules (seeded, allocation free).
import { mulberry32, WORLD_SEED } from '../layout.js';

const PERM = new Uint8Array(512);
{
  const rand = mulberry32(WORLD_SEED + 101);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const GX = new Float32Array(256), GZ = new Float32Array(256);
{
  const rand = mulberry32(WORLD_SEED + 102);
  for (let i = 0; i < 256; i++) { const a = rand() * Math.PI * 2; GX[i] = Math.cos(a); GZ[i] = Math.sin(a); }
}

/** 2D gradient (Perlin) noise, roughly in [-1, 1]. */
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const X = xi & 255, Z = zi & 255;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
  const a = PERM[PERM[X] + Z], b = PERM[PERM[X + 1] + Z], c = PERM[PERM[X] + Z + 1], d = PERM[PERM[X + 1] + Z + 1];
  const n00 = GX[a] * xf + GZ[a] * zf;
  const n10 = GX[b] * (xf - 1) + GZ[b] * zf;
  const n01 = GX[c] * xf + GZ[c] * (zf - 1);
  const n11 = GX[d] * (xf - 1) + GZ[d] * (zf - 1);
  const nx0 = n00 + u * (n10 - n00), nx1 = n01 + u * (n11 - n01);
  return (nx0 + v * (nx1 - nx0)) * 1.41;
}

/** Fractal noise in [-1, 1]. */
export function fbm2(x, z, octaves = 4, lacunarity = 2.03, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq + i * 17.3, z * freq - i * 9.1) * amp;
    norm += amp; amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
/** smoothstep that also works for reversed edges (a > b). */
export function sstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Integer hash → [0,1). */
export function hash2(ix, iz, seed = 0) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
