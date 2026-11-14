// Runtime tuning knobs shared between the adaptive-quality controller (Performance.js) and the modules that
// honour them. All values are multipliers around 1 (1 = what the quality preset asks for).
export const tuning = {
  /** Scales grass density and radius (0.3..1). */
  grass: 1,
  /** Scales how often the shadow map is refreshed (1 = preset interval; larger = rarer). */
  shadowInterval: 1,
};
