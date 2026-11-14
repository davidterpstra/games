// Wooden bridges where the paths cross the river, with walkable ramps onto the banks.
import { RIVER, findPathRiverCrossings, riverInfo } from '../layout.js';
import { rod } from './props.js';

/** Builds one bridge per path/river crossing. */
export function buildBridges(S) {
  const b = S.builder('bridges', 61);
  const R = b.rand;
  const crossings = findPathRiverCrossings();
  crossings.forEach((cr, idx) => {
    const ri = riverInfo(cr.x, cr.z);
    const dx = Math.sin(cr.angle), dz = Math.cos(cr.angle);
    const rl = Math.hypot(ri.dirX, ri.dirZ) || 1;
    const sinSkew = Math.max(0.35, Math.abs(dx * (ri.dirZ / rl) - dz * (ri.dirX / rl)));
    const halfWater = (RIVER.width / 2 + 0.8) / sinSkew;
    const hw = halfWater + 2.6; // deck half length over water + bank margin
    const groundAt = (t) => S.terrain.getHeightAt(cr.x + dx * t, cr.z + dz * t);
    const deckY = Math.max(cr.waterY + 1.0, Math.min(groundAt(-hw), groundAt(hw)) + 0.15);
    // ramp lengths so slope <= ~0.3
    const rampLen = (sgn) => { let len = 2.5; for (let i = 0; i < 4; i++) len = Math.max(2.5, Math.abs(deckY - groundAt(sgn * (hw + len))) * 3.4); return len; };
    const rA = rampLen(-1), rB = rampLen(1);
    const gA = groundAt(-(hw + rA)), gB = groundAt(hw + rB);
    const yAt = (t) => (t < -hw ? deckY + (gA - deckY) * Math.min(1, (-hw - t) / rA) : t > hw ? deckY + (gB - deckY) * Math.min(1, (t - hw) / rB) : deckY);
    const Wd = 1.4; // half width of the deck
    b.at(cr.x, 0, cr.z, cr.angle, () => {
      // sample along the axis (local z). y is absolute world height (frame y=0).
      const T0 = -(hw + rA), T1 = hw + rB, step = 0.8;
      const n = Math.ceil((T1 - T0) / step);
      for (let i = 0; i < n; i++) {
        const t0 = T0 + i * step, t1 = Math.min(T1, t0 + step), tm = (t0 + t1) / 2, y0 = yAt(t0), y1 = yAt(t1), ym = (y0 + y1) / 2;
        const slope = Math.atan2(y1 - y0, t1 - t0), len = (t1 - t0) / Math.cos(slope);
        // planks (visual): two per step, slight random wear
        for (let k = 0; k < 2; k++) {
          const pz = tm + (k - 0.5) * (step / 2), py = yAt(pz);
          b.box('wood', 0, py - 0.04, pz, Wd * 2 + 0.1, 0.08, step / 2 - 0.03, { rx: -slope, tint: [0.75 + R() * 0.3, 0.72 + R() * 0.2, 0.68], tile: 1.2, ry: (R() - 0.5) * 0.02 });
        }
        // collider surface (thin so the player can walk underneath the ramps)
        b.solid(0, ym - 0.2, tm, Wd * 2 + 0.1, 0.4, step + 0.02, { surface: 'wood', yMax: Math.max(y0, y1), yMin: Math.max(y0, y1) - 0.45 });
        // stringers
        for (const sx of [-1, 1]) b.box('woodDark', sx * (Wd - 0.15), ym - 0.3, tm, 0.22, 0.3, len + 0.02, { rx: -slope });
        // railings
        if (i % 2 === 0) for (const sx of [-1, 1]) {
          const py = yAt(tm);
          b.box('woodDark', sx * (Wd + 0.02), py + 0.5, tm, 0.12, 1.1, 0.12, { tint: [0.8, 0.75, 0.7] });
        }
        for (const sx of [-1, 1]) {
          for (const hh of [0.55, 1.05]) b.box('wood', sx * (Wd + 0.02), ym + hh, tm, 0.08, 0.1, len + 0.03, { rx: -slope, tint: [0.8, 0.78, 0.74], tile: 1 });
          b.solid(sx * (Wd + 0.02), ym + 0.6, tm, 0.14, 1.2, step + 0.02, { surface: 'wood', yMin: Math.max(y0, y1) - 0.2, yMax: Math.max(y0, y1) + 1.15 });
        }
      }
      // piers into the river
      for (let t = -halfWater; t <= halfWater + 0.01; t += Math.max(2.6, halfWater * 0.9)) {
        for (const sx of [-1, 1]) {
          const bottom = cr.waterY - 2.2, top = deckY - 0.1;
          b.cyl('woodDark', sx * (Wd - 0.15), (top + bottom) / 2, t, 0.17, 0.2, top - bottom, 8, { tint: [0.7, 0.72, 0.7] });
        }
        b.box('woodDark', 0, deckY - 0.5, t, Wd * 2 - 0.1, 0.2, 0.22);
        rod(b, 'woodDark', [-(Wd - 0.15), deckY - 0.35, t], [Wd - 0.15, cr.waterY - 0.6, t + 0.0], 0.05, 5);
        rod(b, 'woodDark', [(Wd - 0.15), deckY - 0.35, t], [-(Wd - 0.15), cr.waterY - 0.6, t + 0.0], 0.05, 5);
      }
      // lantern posts at the bridge heads
      for (const [t, sx] of [[-hw - 0.5, -1], [hw + 0.5, 1]]) {
        const py = yAt(t);
        b.box('woodDark', sx * (Wd + 0.6) * 1, py + 1.1, t, 0.14, 2.2, 0.14);
        b.box('steel', sx * (Wd + 0.6), py + 2.25, t, 0.3, 0.05, 0.3);
        b.cyl('glass', sx * (Wd + 0.6), py + 2.05, t, 0.09, 0.09, 0.22, 6, { tint: [1, 0.85, 0.5] });
      }
    });
    void idx;
  });
  S.commit(b);
}
