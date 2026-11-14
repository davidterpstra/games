// Compass strip drawn on a canvas (crisp, cheap): cardinal letters, ticks and markers for discovered locations.
// Heading follows Three.js: yaw 0 looks towards -Z (north); compass bearing = -yaw.
const CARD = [['N', 0], ['NO', 45], ['O', 90], ['ZO', 135], ['Z', 180], ['ZW', 225], ['W', 270], ['NW', 315]];
const FOV = 150; // degrees visible across the strip

export function createCompass() {
  const canvas = document.createElement('canvas');
  canvas.className = 'compass-canvas';
  const ctx2 = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, last = '';

  function resize() {
    const r = canvas.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
    const nd = Math.min(2, window.devicePixelRatio || 1);
    if (nw === w && nh === h && nd === dpr) return;
    w = nw; h = nh; dpr = nd;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    last = '';
  }

  const wrap = (a) => ((a + 540) % 360) - 180;

  /** @param yaw radians  @param px,pz player position  @param locations [{name,x,z,discovered}] */
  function draw(yaw, px, pz, locations) {
    resize();
    const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const sig = heading.toFixed(1) + '|' + w + '|' + (locations ? locations.map((l) => (l.discovered ? 1 : 0)).join('') : '') + '|' + Math.round(px / 2) + ',' + Math.round(pz / 2);
    if (sig === last) return;
    last = sig;
    const c = ctx2;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const ppd = w / FOV;
    const cx = w / 2;
    // edge fade through a gradient mask
    c.save();
    c.font = '600 12px system-ui, "Segoe UI", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // ticks
    for (let b = 0; b < 360; b += 15) {
      const rel = wrap(b - heading);
      if (Math.abs(rel) > FOV / 2) continue;
      const x = cx + rel * ppd;
      const major = b % 45 === 0;
      c.strokeStyle = major ? 'rgba(241,233,216,0.55)' : 'rgba(241,233,216,0.28)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 0.5, h - 6); c.lineTo(x + 0.5, h - (major ? 14 : 10)); c.stroke();
    }
    for (const [name, b] of CARD) {
      const rel = wrap(b - heading);
      if (Math.abs(rel) > FOV / 2) continue;
      const x = cx + rel * ppd;
      c.fillStyle = name === 'N' ? '#e3b866' : name.length === 1 ? '#f1e9d8' : 'rgba(241,233,216,0.62)';
      c.font = name.length === 1 ? '700 14px system-ui, "Segoe UI", sans-serif' : '600 11px system-ui, "Segoe UI", sans-serif';
      c.fillText(name, x, h - 24);
    }
    // location markers
    let nearest = null, nearestAbs = 999;
    for (const l of locations || []) {
      if (!l.discovered) continue;
      const dx = l.x - px, dz = l.z - pz;
      const bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
      const rel = wrap(bearing - heading);
      if (Math.abs(rel) > FOV / 2 - 2) continue;
      const x = cx + rel * ppd;
      const dist = Math.hypot(dx, dz);
      c.fillStyle = '#e3b866';
      c.beginPath(); c.moveTo(x, 4); c.lineTo(x + 4.5, 9); c.lineTo(x, 14); c.lineTo(x - 4.5, 9); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke();
      if (Math.abs(rel) < nearestAbs) { nearestAbs = Math.abs(rel); nearest = { l, x, dist }; }
    }
    if (nearest && nearestAbs < 11) {
      const label = `${nearest.l.name}  ·  ${Math.round(nearest.dist)} m`;
      c.font = '600 11px system-ui, "Segoe UI", sans-serif';
      const tw = c.measureText(label).width;
      let lx = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, nearest.x));
      c.fillStyle = 'rgba(8,10,9,0.72)';
      c.fillRect(lx - tw / 2 - 6, h - 4 - 0, 0, 0);
      c.fillStyle = '#f3dba5';
      c.globalAlpha = Math.max(0, 1 - nearestAbs / 11);
      c.fillText(label, lx, 24 + 0);
      c.globalAlpha = 1;
    }
    c.restore();
  }
  return { canvas, draw };
}
