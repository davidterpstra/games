// Graphics quality presets. The world, environment and renderer read these numbers.
export const QUALITY_PRESETS = Object.freeze({
  low: {
    name: 'low', pixelRatio: 1.0, shadowMapSize: 1024, shadowDistance: 45, viewDistance: 260,
    terrainSegments: 160, grassDensity: 0.25, vegetationDensity: 0.55, maxPointLights: 2, antialias: false,
  },
  medium: {
    name: 'medium', pixelRatio: 1.5, shadowMapSize: 2048, shadowDistance: 70, viewDistance: 380,
    terrainSegments: 256, grassDensity: 0.6, vegetationDensity: 0.8, maxPointLights: 4, antialias: true,
  },
  high: {
    name: 'high', pixelRatio: 2.0, shadowMapSize: 4096, shadowDistance: 100, viewDistance: 520,
    terrainSegments: 384, grassDensity: 1.0, vegetationDensity: 1.0, maxPointLights: 6, antialias: true,
  },
});

export function isMobileDevice() {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

/** Resolve the 'auto' setting to a concrete preset name. */
export function resolveQuality(setting) {
  if (setting === 'low' || setting === 'medium' || setting === 'high') return setting;
  if (isMobileDevice()) return 'low';
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  return cores >= 8 ? 'high' : 'medium';
}
