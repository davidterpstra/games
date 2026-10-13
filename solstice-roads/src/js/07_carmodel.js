/* =====================================================================
   Procedural car models.
   The body is a lofted hull: ~90 cross-sections (rounded superellipses)
   along the length whose top follows a per-style side profile and whose
   bottom line rises over each wheel, which cuts real wheel-arch openings.
   A separate lofted glasshouse, roof/pillar panels, lamps, intakes,
   mirrors, wings, interior and fully built wheels complete the car.
   Local frame: +z forward, +x left, y up, origin on the ground.
   ===================================================================== */

// Side profile (top line) per style: [u, height] with u = fraction of length (+0.5 = nose).
// cab: [wsBase, roofFront, roofRear, rearWindowBase] as fractions; tw: roof width factor.
const STYLES = {
  wedge: { fo: 1.06, gc: 0.12, top: [[0.5, 0.36], [0.485, 0.52], [0.42, 0.62], [0.3, 0.7], [0.16, 0.8], [-0.33, 0.93], [-0.43, 0.94], [-0.49, 0.9], [-0.5, 0.58]], low: [0.27, 0.36], cab: [0.16, -0.03, -0.17, -0.33], tw: 0.62, pillar: 'black', intakes: true, exh: 'center' },
  hyper: { fo: 1.08, gc: 0.1, top: [[0.5, 0.3], [0.485, 0.46], [0.42, 0.56], [0.3, 0.66], [0.18, 0.77], [-0.3, 0.9], [-0.43, 0.93], [-0.49, 0.9], [-0.5, 0.55]], low: [0.24, 0.33], cab: [0.18, 0.0, -0.13, -0.3], tw: 0.6, pillar: 'black', intakes: true, exh: 'quad' },
  gt: { fo: 0.92, gc: 0.13, top: [[0.5, 0.42], [0.48, 0.64], [0.4, 0.76], [0.25, 0.83], [0.04, 0.9], [-0.42, 0.97], [-0.47, 0.96], [-0.495, 0.9], [-0.5, 0.6]], low: [0.3, 0.38], cab: [0.04, -0.14, -0.27, -0.43], tw: 0.62, pillar: 'paint', intakes: false, exh: 'quad' },
  coupe: { fo: 0.86, gc: 0.14, top: [[0.5, 0.48], [0.485, 0.68], [0.4, 0.78], [0.3, 0.8], [0.18, 0.86], [-0.33, 0.93], [-0.46, 0.95], [-0.495, 0.9], [-0.5, 0.62]], low: [0.32, 0.4], cab: [0.18, 0.06, -0.2, -0.33], tw: 0.7, pillar: 'paint', intakes: false, exh: 'single' },
  muscle: { fo: 0.98, gc: 0.15, top: [[0.5, 0.52], [0.488, 0.8], [0.43, 0.88], [0.3, 0.9], [0.1, 0.98], [-0.4, 1.0], [-0.47, 1.0], [-0.495, 0.96], [-0.5, 0.66]], low: [0.34, 0.42], cab: [0.1, -0.05, -0.21, -0.4], tw: 0.7, pillar: 'paint', intakes: false, exh: 'dual', scoop: true },
  hatch: { fo: 0.85, gc: 0.16, top: [[0.5, 0.5], [0.485, 0.7], [0.4, 0.82], [0.33, 0.86], [0.2, 0.96], [-0.47, 1.0], [-0.495, 0.94], [-0.5, 0.62]], low: [0.34, 0.42], cab: [0.2, 0.07, -0.43, -0.49], tw: 0.74, pillar: 'paint', intakes: false, exh: 'single', scoop: true },
  truck: { fo: 0.95, gc: 0.42, top: [[0.5, 0.7], [0.48, 1.08], [0.4, 1.2], [0.3, 1.26], [0.15, 1.34], [-0.14, 1.36], [-0.2, 1.28], [-0.48, 1.26], [-0.5, 1.0]], low: [0.62, 0.66], cab: [0.15, 0.04, -0.1, -0.14], tw: 0.8, pillar: 'paint', intakes: false, exh: 'side', bed: true },
};

const CarMats = {
  tyre: null, chrome: null, gun: null, black: null, dark: null, interior: null, glassTemplate: null, grille: null, plate: null, disc: null,
};
function initCarMaterials() {
  CarMats.tyre = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92, metalness: 0 });
  CarMats.chrome = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.12, metalness: 1 });
  CarMats.gun = new THREE.MeshStandardMaterial({ color: 0x40444b, roughness: 0.3, metalness: 0.9 });
  CarMats.black = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.45, metalness: 0.2 });
  CarMats.dark = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.8 });
  CarMats.interior = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.85, side: THREE.DoubleSide });
  CarMats.disc = new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.4, metalness: 0.9 });
  CarMats.grille = new THREE.MeshStandardMaterial({
    roughness: 0.6, metalness: 0.3,
    map: canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#050506'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2a2c30'; x.lineWidth = 2; for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) { x.beginPath(); const cx = i * 11 + (j & 1) * 5.5, cy = j * 8 + 4; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; x.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5); } x.closePath(); x.stroke(); } }),
  });
  CarMats.plate = (txt) => new THREE.MeshStandardMaterial({ roughness: 0.5, map: canvasTex(256, 56, (x, w, h) => { x.fillStyle = '#f5d33a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#111'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4); x.fillStyle = '#111'; x.font = '700 40px Saira, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2); }, { repeat: false }) });
}

function profileY(pts, u) {
  if (u >= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (u <= a[0] && u >= b[0]) {
      const t = (a[0] - u) / (a[0] - b[0] || 1);
      const s = t * t * (3 - 2 * t);
      return lerp(a[1], b[1], lerp(t, s, 0.5));
    }
  }
  return pts[pts.length - 1][1];
}

/* Loft a list of rings into a mesh. rings[i] = array of [x,y,z]. capStart/capEnd fan to the ring centre. */
function loftRings(rings, closedRing, capStart, capEnd) {
  const n = rings[0].length;
  const pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
  const m = closedRing ? n : n - 1;
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < m; j++) {
    const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n;
    idx.push(a, b, c, b, d, c);
  }
  const fan = (ri, flip) => {
    const r = rings[ri];
    let cx = 0, cy = 0, cz = 0;
    for (const p of r) { cx += p[0]; cy += p[1]; cz += p[2]; }
    const ci = pos.length / 3;
    pos.push(cx / n, cy / n, cz / n);
    for (let j = 0; j < n; j++) { const a = ri * n + j, b = ri * n + (j + 1) % n; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  if (capStart) fan(0, false);
  if (capEnd) fan(rings.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeCar(spec, color, opts = {}) {
  const S = STYLES[spec.style];
  const L = spec.len, W = spec.wid / 2, H = spec.hgt, R = spec.tyreR;
  const uF = L / 2 - S.fo, uR = uF - spec.wb;
  const archR = R + (spec.style === 'truck' ? 0.14 : 0.06);
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0f14, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.62, envMapIntensity: 1.6, clearcoat: 1 });
  const head = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, emissive: 0xfff2d8, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.4 });
  const brake = new THREE.MeshStandardMaterial({ color: 0x5a0508, emissive: 0xff1020, emissiveIntensity: 0.5, roughness: 0.3 });
  const rev = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
  const pillarMat = S.pillar === 'black' ? CarMats.black : paint;
  const add = (geo, mat, parent = body, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };

  /* ---------- hull ---------- */
  const topY = (z) => profileY(S.top, z / L);
  const archAt = (z) => {
    for (const uw of [uF, uR]) {
      const dz = z - uw;
      if (Math.abs(dz) < archR) return R + Math.sqrt(archR * archR - dz * dz);
    }
    return 0;
  };
  const bottomAt = (z) => {
    let b = S.gc;
    b = lerp(b, S.low[0], smoothstep(uF + archR * 0.6, L / 2, z));
    b = lerp(b, S.low[1], smoothstep(uR - archR * 0.6, -L / 2, z));
    return Math.max(b, archAt(z));
  };
  const widthAt = (z) => {
    let w = W - 0.015;
    w *= 1 - 0.13 * Math.pow(smoothstep(uF + 0.25, L / 2, z), 2) - 0.08 * Math.pow(smoothstep(uR - 0.25, -L / 2, z), 2);
    const e = Math.min(smoothstep(L / 2, L / 2 - 0.16, z), smoothstep(-L / 2, -L / 2 + 0.12, z));
    w *= lerp(0.72, 1, e);
    // fender flares
    w *= 1 + 0.02 * Math.exp(-(((z - uF) / 0.55) ** 2)) + 0.035 * Math.exp(-(((z - uR) / 0.6) ** 2));
    return w;
  };
  const RING = 36, P = 3.2;
  const rings = [];
  const steps = Math.ceil(L / 0.045);
  const hullTop = [];
  for (let i = 0; i <= steps; i++) {
    const z = -L / 2 + (i / steps) * L;
    let t = topY(z);
    const b = bottomAt(z);
    if (t < b + 0.1) t = b + 0.1; // fenders always cover the wheel
    const w = widthAt(z);
    hullTop.push(t);
    const mid = (t + b) / 2, hh = (t - b) / 2;
    const ring = [];
    for (let j = 0; j < RING; j++) {
      const a = (j / RING) * TAU;
      const c = Math.cos(a), s = Math.sin(a);
      const sx = Math.sign(c) * Math.abs(c) ** (2 / P), sy = Math.sign(s) * Math.abs(s) ** (2 / P);
      const tw = s > 0 ? lerp(1, 0.82, s ** 2) : lerp(1, 0.93, s * s);
      ring.push([sx * w * tw, mid + sy * hh, z]);
    }
    rings.push(ring);
  }
  const hull = add(loftRings(rings, true, true, true), paint);
  hull.name = 'hull';
  const hullTopAt = (z) => hullTop[clamp(Math.round((z + L / 2) / L * steps), 0, steps)];

  // underbody + wheel-well liners
  add(new THREE.BoxGeometry(W * 1.6, 0.06, (uF - uR) - archR * 2 + 0.1).translate(0, S.gc + 0.03, (uF + uR) / 2), CarMats.dark, body, false);
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 1, side: THREE.DoubleSide });
  for (const uw of [uF, uR]) for (const sd of [-1, 1]) {
    const liner = new THREE.CylinderGeometry(archR - 0.01, archR - 0.01, 0.42, 20, 1, true, 0, Math.PI);
    liner.rotateZ(Math.PI / 2); // axis along x
    liner.rotateX(-Math.PI / 2);
    const m = add(liner, linerMat, body, false);
    m.position.set(sd * (spec.track / 2 - 0.08), R, uw);
  }

  /* ---------- glasshouse ---------- */
  const [cW, cRF, cRR, cRW] = S.cab.map((f) => f * L);
  const roofH = H;
  const cabRings = [];
  const CR = 14;
  const cabSteps = Math.ceil((cW - cRW) / 0.05);
  const cabFrame = []; // per station: {z, yb, yt, wb, wt}
  for (let i = 0; i <= cabSteps; i++) {
    const z = cW - (i / cabSteps) * (cW - cRW);
    const yb = hullTopAt(z) - 0.03;
    let yt;
    if (z > cRF) { const t = (cW - z) / (cW - cRF); yt = lerp(yb, roofH, Math.sin(t * Math.PI / 2) ** 0.8); }
    else if (z > cRR) { const t = (cRF - z) / (cRF - cRR); yt = roofH - 0.02 * t * t; }
    else { const t = (cRR - z) / (cRR - cRW); yt = lerp(roofH - 0.02, yb, Math.pow(t, spec.style === 'hatch' || spec.style === 'truck' ? 1.6 : 1.15)); }
    const wb = widthAt(z) * 0.86, wt = widthAt(z) * S.tw;
    cabFrame.push({ z, yb, yt, wb, wt });
    const ring = [];
    const hgt = Math.max(0.001, yt - yb);
    for (let j = 0; j <= CR; j++) {
      const f = j / CR; // 0: right base -> 1: left base
      let x, y;
      if (f < 0.3) { const t = f / 0.3; x = -lerp(wb, wt, t); y = yb + hgt * t * 0.92; }
      else if (f > 0.7) { const t = (1 - f) / 0.3; x = lerp(wb, wt, t); y = yb + hgt * t * 0.92; }
      else { const t = (f - 0.3) / 0.4; x = lerp(-wt, wt, t); y = yb + hgt * (0.92 + 0.08 * Math.sin(t * Math.PI)); }
      ring.push([x, y, z]);
    }
    cabRings.push(ring);
  }
  add(loftRings(cabRings, false, false, false), glass);
  // roof panel and pillars cut from the same frame
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9, side: THREE.BackSide });
  const band = (i0, i1, j0, j1, mat, inset = 0.006) => {
    const rs = [];
    for (let i = i0; i <= i1; i++) {
      const r = cabRings[i], fr = cabFrame[i];
      rs.push(r.slice(j0, j1 + 1).map(([x, y, z]) => [x * (1 + inset), y + inset * 2, z]));
      void fr;
    }
    const g = loftRings(rs, false, false, false);
    const m = add(g, mat);
    const inner = add(g, innerMat);
    inner.scale.set(0.995, 0.998, 1);
    return m;
  };
  const iRF = cabFrame.findIndex((f) => f.z <= cRF), iRR = cabFrame.findIndex((f) => f.z <= cRR);
  band(Math.max(0, iRF - 1), iRR, 4, CR - 4, spec.style === 'truck' ? paint : (S.pillar === 'black' ? CarMats.black : paint));
  band(0, iRF, 3, 5, pillarMat); band(0, iRF, CR - 5, CR - 3, pillarMat); // A pillars
  if (S.pillar === 'paint') { // C pillars / rear quarter
    const iC = Math.max(iRR - 6, 0);
    band(iC, cabFrame.length - 1, 0, 4, paint); band(iC, cabFrame.length - 1, CR - 4, CR, paint);
  } else {
    band(iRR, cabFrame.length - 1, 0, 3, CarMats.black); band(iRR, cabFrame.length - 1, CR - 3, CR, CarMats.black);
  }
  // window trim line along the belt
  for (const sd of [-1, 1]) {
    const pts = cabFrame.filter((f, i) => i % 3 === 0).map((f) => new THREE.Vector3(sd * f.wb * 1.01, f.yb + 0.02, f.z));
    if (pts.length > 2) add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.012, 4, false), CarMats.chrome, body, false);
  }

  /* ---------- interior (visible through the glass and in cockpit view) ---------- */
  const seatZ = lerp(cRF, cRR, 0.35) - 0.05, beltY = hullTopAt(seatZ);
  const interior = new THREE.Group();
  body.add(interior);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W * 1.5, 0.02, Math.abs(cW - cRW) * 0.95).translate(0, beltY - 0.01, (cW + cRW) / 2), CarMats.interior);
  interior.add(floor);
  const seatX = spec.track * 0.24;
  const headTop = Math.min(beltY + 0.48, roofH - 0.12); // seats always stay under the roof
  for (const sd of [-1, 1]) {
    const bh = Math.max(0.3, headTop - 0.22 - (beltY - 0.32));
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, bh, 0.14).translate(0, bh / 2, 0), CarMats.interior);
    back.position.set(sd * seatX, beltY - 0.32, seatZ - 0.3); back.rotation.x = -0.22;
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.11), CarMats.interior);
    headrest.position.set(sd * seatX, headTop - 0.1, seatZ - 0.42);
    interior.add(back, headrest);
  }
  const dashZ = cW - 0.12;
  const dash = new THREE.Mesh(new THREE.BoxGeometry(W * 1.6, 0.16, 0.5).translate(0, 0, -0.25), CarMats.interior);
  dash.position.set(0, hullTopAt(dashZ) + 0.02, dashZ);
  interior.add(dash);
  const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xffb02e, emissiveIntensity: 0.6 }));
  gauge.position.set(seatX, hullTopAt(dashZ) + 0.12, dashZ - 0.36); gauge.rotation.x = -0.3; gauge.rotation.y = Math.PI;
  interior.add(gauge);
  const steer = new THREE.Group();
  steer.position.set(seatX, hullTopAt(dashZ) + 0.02, dashZ - 0.55);
  steer.rotation.x = -0.35;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 8, 28), CarMats.interior);
  const spokeA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.02), CarMats.interior);
  const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), CarMats.interior); spokeB.position.y = -0.08;
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0xff3d7f, emissive: 0xff3d7f, emissiveIntensity: 0.5 })); mark.position.y = 0.18;
  const steerSpin = new THREE.Group();
  steerSpin.add(rim, spokeA, spokeB, mark);
  steer.add(steerSpin);
  interior.add(steer);

  /* ---------- lamps, grille, intakes ---------- */
  const noseZ = L / 2;
  for (const sd of [-1, 1]) {
    // headlight units sit in the bonnet surface: dark housing, bright projector + LED brow
    const hz = noseZ - 0.3, hx = sd * widthAt(hz) * 0.64;
    const yS = topY(hz) - 0.035;
    const slope = Math.atan2(topY(hz - 0.15) - topY(hz + 0.15), 0.3);
    const housing = add(new THREE.BoxGeometry(0.44, 0.05, 0.3), CarMats.black, body, false);
    housing.position.set(hx, yS, hz); housing.rotation.set(slope, sd * 0.16, 0);
    for (const k of [-1, 1]) {
      const proj = add(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 16), head, body, false);
      proj.position.set(hx + k * 0.1 * sd, yS + 0.026, hz + 0.02); proj.rotation.set(slope, 0, 0);
    }
    const brow = add(new THREE.BoxGeometry(0.4, 0.014, 0.03), head, body, false);
    brow.position.set(hx, yS + 0.03, hz + 0.13); brow.rotation.set(slope, sd * 0.16, 0);
    const drl = add(new THREE.BoxGeometry(0.3, 0.016, 0.04), head, body, false);
    drl.position.set(sd * widthAt(noseZ - 0.1) * 0.6, topY(noseZ - 0.1) - 0.12, noseZ - 0.1); drl.rotation.y = sd * 0.4;
  }
  const nY = topY(noseZ - 0.32);
  const tailZ = -L / 2, tY = topY(tailZ + 0.06);
  const tailW = widthAt(tailZ + 0.05);
  // light bar across the tail
  const bar = add(new THREE.BoxGeometry(tailW * 1.75, 0.06, 0.05), brake);
  bar.position.set(0, tY - 0.1, tailZ + 0.02);
  for (const sd of [-1, 1]) {
    const tl = add(new THREE.BoxGeometry(0.34, 0.12, 0.06), brake);
    tl.position.set(sd * tailW * 0.72, tY - 0.12, tailZ + 0.04);
    const rv = add(new THREE.BoxGeometry(0.12, 0.06, 0.04), rev, body, false);
    rv.position.set(sd * tailW * 0.4, tY - 0.22, tailZ + 0.04);
  }
  // grille / front intake
  const lowF = S.low[0];
  const gr = add(new THREE.BoxGeometry(widthAt(noseZ - 0.1) * 1.3, Math.max(0.1, nY - lowF - 0.2) * 0.6, 0.06), CarMats.grille, body, false);
  gr.position.set(0, lowF + 0.1 + Math.max(0.1, nY - lowF - 0.2) * 0.3, noseZ - 0.03);
  // splitter + diffuser
  add(new THREE.BoxGeometry(widthAt(noseZ - 0.2) * 1.85, 0.03, 0.22), CarMats.black, body, false).position.set(0, lowF - 0.01, noseZ - 0.14);
  const dif = add(new THREE.BoxGeometry(tailW * 1.6, 0.12, 0.3), CarMats.black, body, false);
  dif.position.set(0, S.low[1] + 0.03, tailZ + 0.18);
  for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.02, 0.12, 0.3), CarMats.black, body, false).position.set(i * tailW * 0.3, S.low[1] - 0.03, tailZ + 0.16);
  // plates
  const plateTxt = spec.id.slice(0, 3).toUpperCase() + ' ' + (spec.year % 100);
  const pf = add(new THREE.PlaneGeometry(0.46, 0.11), CarMats.plate(plateTxt), body, false);
  pf.position.set(0, lowF + 0.1, noseZ + 0.005);
  const pr = add(new THREE.PlaneGeometry(0.46, 0.11), CarMats.plate(plateTxt), body, false);
  pr.position.set(0, S.low[1] + 0.22, tailZ - 0.01); pr.rotation.y = Math.PI;
  // side intakes / skirts
  for (const sd of [-1, 1]) {
    const skirt = add(new THREE.BoxGeometry(0.05, 0.08, (uF - uR) - archR * 2 - 0.1), CarMats.black, body, false);
    skirt.position.set(sd * (widthAt((uF + uR) / 2) - 0.01), S.gc + 0.06, (uF + uR) / 2);
    if (S.intakes) {
      const zi = uR + archR + 0.35;
      const it = add(new THREE.BoxGeometry(0.06, 0.2, 0.55), CarMats.grille, body, false);
      it.position.set(sd * (widthAt(zi) - 0.005), lerp(S.gc, hullTopAt(zi), 0.55), zi);
      it.rotation.y = sd * -0.12;
    }
    // mirrors
    const mz = cW - 0.12, my = hullTopAt(mz) + 0.12;
    const stalk = add(new THREE.BoxGeometry(0.16, 0.025, 0.05), CarMats.black, body, false);
    stalk.position.set(sd * (widthAt(mz) * 0.86 + 0.06), my - 0.03, mz);
    const mirror = add(new THREE.BoxGeometry(0.1, 0.11, 0.18), paint);
    mirror.position.set(sd * (widthAt(mz) * 0.86 + 0.16), my, mz - 0.02);
    // door seam + handle
    const dz = lerp(cW, cRR, 0.62), dy = lerp(S.gc, hullTopAt(dz), 0.72);
    add(new THREE.BoxGeometry(0.02, 0.025, 0.16), CarMats.chrome, body, false).position.set(sd * (widthAt(dz) * 0.985), dy, dz);
  }
  // exhausts
  const ex = (x) => { const e = add(new THREE.CylinderGeometry(0.055, 0.06, 0.22, 16, 1, true).rotateX(Math.PI / 2), CarMats.chrome, body, false); e.position.set(x, S.low[1] + 0.06, tailZ + 0.02); const i = add(new THREE.CircleGeometry(0.05, 16), CarMats.black, body, false); i.position.set(x, S.low[1] + 0.06, tailZ - 0.005); i.rotation.y = Math.PI; };
  if (S.exh === 'center') { ex(-0.07); ex(0.07); }
  else if (S.exh === 'quad') { for (const x of [-0.62, -0.48, 0.48, 0.62]) ex(x * tailW / 0.95); }
  else if (S.exh === 'dual') { ex(-0.55 * tailW); ex(0.55 * tailW); }
  else if (S.exh === 'single') ex(-0.55 * tailW);
  // bonnet scoop
  if (S.scoop) {
    const sz = lerp(uF, cW, 0.35);
    const sc = add(new THREE.BoxGeometry(0.5, 0.08, 0.6), spec.style === 'muscle' ? CarMats.black : paint);
    sc.position.set(0, hullTopAt(sz) + 0.02, sz);
    add(new THREE.BoxGeometry(0.42, 0.05, 0.02), CarMats.grille, body, false).position.set(0, hullTopAt(sz) + 0.04, sz + 0.3);
  }
  // rear wing
  if (spec.wing) {
    const wz = tailZ + (spec.style === 'hatch' ? 0.18 : 0.32);
    const wy = (spec.style === 'hatch' ? roofH + 0.04 : hullTopAt(wz) + 0.32);
    const foil = new THREE.CylinderGeometry(0.16, 0.16, tailW * 1.8, 20); foil.rotateZ(Math.PI / 2); foil.scale(1, 0.18, 1);
    const wm = add(foil, spec.style === 'hatch' ? paint : CarMats.black);
    wm.position.set(0, wy, wz); wm.rotation.x = 0.08;
    for (const sd of [-1, 1]) {
      const ep = add(new THREE.BoxGeometry(0.02, 0.18, 0.42), CarMats.black, body, false); ep.position.set(sd * tailW * 0.9, wy, wz);
      if (spec.style !== 'hatch') { const st = add(new THREE.BoxGeometry(0.03, wy - hullTopAt(wz), 0.12), CarMats.black, body, false); st.position.set(sd * tailW * 0.45, (wy + hullTopAt(wz)) / 2, wz + 0.02); }
    }
  } else if (spec.style === 'gt' || spec.style === 'coupe' || spec.style === 'muscle') {
    const lip = add(new THREE.BoxGeometry(tailW * 1.6, 0.03, 0.12), spec.style === 'gt' ? paint : CarMats.black, body, false);
    lip.position.set(0, topY(tailZ + 0.1) + 0.02, tailZ + 0.1); lip.rotation.x = -0.25;
  }
  // trophy truck extras: bed, roll cage, spare tyre, light bar
  if (S.bed) {
    const bz0 = cRW - 0.05, bz1 = tailZ + 0.05;
    const bedY = topY(-0.3 * L);
    add(new THREE.BoxGeometry(W * 1.8, 0.04, bz0 - bz1).translate(0, bedY - 0.02, (bz0 + bz1) / 2), CarMats.dark, body, false);
    const cage = new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.8, roughness: 0.4 });
    for (const sd of [-1, 1]) {
      const pts = [new THREE.Vector3(sd * W * 0.7, bedY, bz0 - 0.1), new THREE.Vector3(sd * W * 0.6, bedY + 0.55, bz0 - 0.5), new THREE.Vector3(sd * W * 0.6, bedY + 0.55, bz1 + 0.5), new THREE.Vector3(sd * W * 0.75, bedY, bz1 + 0.15)];
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 6), cage, body, false);
    }
    const sp = add(new THREE.TorusGeometry(R * 0.78, R * 0.2, 10, 24).rotateX(Math.PI / 2), CarMats.tyre);
    sp.position.set(0, bedY + 0.25, (bz0 + bz1) / 2);
    const lb = add(new THREE.BoxGeometry(W * 1.3, 0.1, 0.12), CarMats.black, body, false);
    lb.position.set(0, roofH + 0.08, cRF + 0.05);
    for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(0.16, 0.07, 0.02), head, body, false).position.set(i * W * 0.17, roofH + 0.08, cRF + 0.115);
  }

  /* ---------- wheels ---------- */
  const tw = spec.style === 'truck' ? 0.36 : spec.style === 'hyper' ? 0.33 : 0.29;
  const tyreProf = [];
  const rr = R * (spec.style === 'truck' ? 0.6 : 0.74);
  tyreProf.push(new THREE.Vector2(rr * 0.98, -tw / 2 + 0.01));
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI / 2; tyreProf.push(new THREE.Vector2(R - 0.04 + Math.cos(a) * 0.04, -tw / 2 + 0.04 + Math.sin(a) * 0.04)); }
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; tyreProf.push(new THREE.Vector2(R - 0.04 + Math.cos(a) * 0.04, tw / 2 - 0.04 + Math.sin(a) * 0.04)); }
  tyreProf.push(new THREE.Vector2(rr * 0.98, tw / 2 - 0.01));
  const tyreG = new THREE.LatheGeometry(tyreProf, 40).rotateZ(Math.PI / 2);
  if (spec.style === 'truck' || spec.style === 'hatch') { // knobbly tread
    const p = tyreG.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i), r = Math.hypot(y, z); if (r > R - 0.02) { const a = Math.atan2(z, y); const f = 1 + (Math.sin(a * 20) > 0.3 ? 0.012 : -0.004) * (spec.style === 'truck' ? 2 : 0.6); p.setY(i, y * f); p.setZ(i, z * f); } }
    tyreG.computeVertexNormals();
  }
  const rimMat = spec.style === 'truck' ? CarMats.black : spec.style === 'coupe' || spec.style === 'muscle' ? CarMats.chrome : spec.id === 'kestrel' ? new THREE.MeshStandardMaterial({ color: 0xb08d3a, metalness: 1, roughness: 0.25 }) : CarMats.gun;
  const spokes = spec.style === 'muscle' ? 5 : spec.style === 'hyper' ? 10 : spec.style === 'truck' ? 8 : spec.style === 'coupe' ? 6 : 5;
  const rimG = (() => {
    const parts = [];
    const barrel = new THREE.CylinderGeometry(rr, rr, tw * 0.9, 28, 1, true).rotateZ(Math.PI / 2);
    parts.push(barrel);
    const lip = new THREE.TorusGeometry(rr, 0.018, 6, 36).rotateY(Math.PI / 2).translate(tw * 0.42, 0, 0);
    parts.push(lip);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU;
      for (const off of spec.style === 'hyper' ? [0] : [-0.09, 0.09]) {
        const sp = new THREE.BoxGeometry(0.035, rr * 0.92, spec.style === 'hyper' ? 0.04 : 0.05);
        sp.translate(0, rr * 0.48, 0);
        sp.rotateX(a + off);
        sp.translate(tw * 0.36, 0, 0);
        parts.push(sp);
      }
    }
    const hub = new THREE.CylinderGeometry(rr * 0.22, rr * 0.25, 0.06, 16).rotateZ(Math.PI / 2).translate(tw * 0.38, 0, 0);
    parts.push(hub);
    return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
  })();
  const discG = new THREE.CylinderGeometry(rr * 0.82, rr * 0.82, 0.03, 28).rotateZ(Math.PI / 2);
  const calG = new THREE.BoxGeometry(0.08, rr * 0.5, rr * 0.4);
  const calMat = new THREE.MeshStandardMaterial({ color: spec.id === 'furia' ? 0xffd200 : spec.id === 'ridgeback' ? 0x1e6bff : 0xd01010, roughness: 0.4 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xff3d7f, roughness: 0.4, metalness: 0.4 });
  const wheels = [];
  for (const [fx, fz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pivot = new THREE.Group(), spin = new THREE.Group();
    const x = fx * spec.track / 2, z = fz > 0 ? uF : uR;
    pivot.position.set(x, R, z);
    const side = new THREE.Group(); side.scale.x = fx; // mirror so the rim face points outward
    const tyre = new THREE.Mesh(tyreG, CarMats.tyre); tyre.castShadow = true;
    const rim = new THREE.Mesh(rimG, rimMat); rim.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(rr * 0.12, 12).rotateY(Math.PI / 2), capMat); cap.position.x = tw * 0.42;
    const disc = new THREE.Mesh(discG, CarMats.disc); disc.position.x = -0.02;
    side.add(tyre, rim, cap, disc);
    spin.add(side);
    const cal = new THREE.Mesh(calG, calMat); cal.position.set(fx * 0.02, rr * 0.45, fz * -0.08 * 0);
    cal.position.set(fx * 0.01, 0, -rr * 0.55);
    pivot.add(spin, cal);
    root.add(pivot);
    wheels.push({ pivot, spin, x, z, front: fz > 0, baseY: R });
  }

  // contact shadow (soft blob, always on: grounds the car even without shadow maps)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(spec.wid * 1.25, L * 1.12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: Car3D.blobTex(), transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16, toneMapped: false }));
  blob.position.y = 0.03;
  blob.renderOrder = 1;
  root.add(blob);

  // headlight beams (player only)
  const beams = [];
  if (opts.lights) {
    for (const sd of [-1, 1]) {
      const sl = new THREE.SpotLight(0xfff1dc, 0, 120, 0.46, 0.55, 1.4);
      sl.position.set(sd * W * 0.62, nY - 0.05, noseZ - 0.25);
      sl.target.position.set(sd * W * 0.4, 0, noseZ + 30);
      root.add(sl, sl.target);
      beams.push(sl);
    }
  }

  // collapse static parts into one mesh per material (draw calls: ~90 -> ~25 per car)
  mergeByMaterial(body, [steer, gauge]);
  for (const w of wheels) mergeByMaterial(w.spin.children[0], []);
  return {
    root, body, wheels, paint, brake, head, rev, steer: steerSpin, interior, beams, blob,
    eye: new THREE.Vector3(seatX * 0.98, beltY + 0.4, seatZ - 0.15),
    hood: new THREE.Vector3(0, hullTopAt(cW + 0.2) + 0.32, cW + 0.25),
    tyreR: R, len: L, wid: spec.wid,
    dispose() {
      root.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) if (!Object.values(CarMats).includes(m)) { if (m.map && m !== CarMats.grille) m.map.dispose(); m.dispose(); }
        }
      });
    },
  };
}
/* Merge every static mesh below `group` (except the `keep` subtrees) into one mesh per material. */
function mergeByMaterial(group, keep) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  const skip = new Set();
  for (const k of keep) k.traverse((o) => skip.add(o));
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || skip.has(o) || Array.isArray(o.material) || o.material.isShaderMaterial || o.material.userData.u || o.material.transparent && !o.material.isMeshPhysicalMaterial) return;
    const mapped = !!o.material.map;
    if (mapped && !o.geometry.attributes.uv) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && !(mapped && a === 'uv')) g.deleteAttribute(a);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], cast: false });
    const b = buckets.get(key);
    b.geos.push(g); b.cast = b.cast || o.castShadow;
    victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  // textured materials need uvs: keep those meshes as they were
  for (const [, b] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
    m.castShadow = b.cast; m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
const Car3D = {
  _blob: null,
  blobTex() {
    if (this._blob) return this._blob;
    this._blob = canvasTex(128, 256, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, h / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.setTransform(1, 0, 0, 1, 0, 0); x.scale(1, 1);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }, { repeat: false, srgb: false });
    return this._blob;
  },
};
