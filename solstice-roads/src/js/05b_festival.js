/* =====================================================================
   The Solstice Festival hub: central sun sculpture with string lights,
   main stage with LED wall, marquee tents, garages, a Ferris wheel,
   flag ring, display turntables and the entrance arch.
   ===================================================================== */
const Festival = { group: new THREE.Group(), flags: null, wheel: null, gondolas: [], turntables: [], bulbs: null, ledMat: null, glowMats: [], garageSpot: null, displaySpots: [] };
const FX0 = PLAZA.x, FZ0 = PLAZA.z;
const polar = (a, r) => [FX0 + Math.cos(a) * r, FZ0 + Math.sin(a) * r];

function festLogoTex(w = 1024, h = 512, sub = 'COUNTRYSIDE FESTIVAL') {
  return canvasTex(w, h, (x) => {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2a0b3d'); g.addColorStop(0.55, '#b0124f'); g.addColorStop(1, '#ff8a1e');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // sun
    const cx = w * 0.5, cy = h * 0.47, R = h * 0.26;
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * TAU;
      x.strokeStyle = 'rgba(255,220,150,0.55)'; x.lineWidth = h * 0.018;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12); x.lineTo(cx + Math.cos(a) * R * 1.45, cy + Math.sin(a) * R * 1.45); x.stroke();
    }
    const sg = x.createRadialGradient(cx, cy, 2, cx, cy, R);
    sg.addColorStop(0, '#fff3c4'); sg.addColorStop(1, '#ffb02e');
    x.fillStyle = sg; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `italic 900 ${h * 0.24}px "Saira Condensed", Arial Narrow, sans-serif`;
    x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 20;
    x.fillText('SOLSTICE', cx, cy + h * 0.02);
    x.font = `700 ${h * 0.075}px Saira, Arial, sans-serif`;
    x.fillText(sub, cx, h * 0.86);
  }, { repeat: false });
}

function buildFestival() {
  const G = Festival.group, H0 = World.plazaH + 0.08;
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const truss = M(0x30333a, { metalness: 0.7, roughness: 0.35 });
  const coral = M(0xff3d7f, { emissive: 0xff3d7f, emissiveIntensity: 0.25 });
  Festival.glowMats.push(coral);
  const add = (geo, mat, x, y, z, ry = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = true; G.add(m); return m; };
  const face = (x, z) => Math.atan2(FX0 - x, FZ0 - z); // heading so local +z points at the plaza centre

  // central island + sun sculpture + mast
  add(new THREE.CylinderGeometry(13, 13.5, 0.5, 48), M(0x3f6b2a, { roughness: 1 }), FX0, H0 + 0.25, FZ0);
  add(new THREE.CylinderGeometry(13.6, 13.6, 0.32, 48, 1, true), PropMat.concrete, FX0, H0 + 0.16, FZ0);
  add(new THREE.CylinderGeometry(0.35, 0.5, 18, 12), truss, FX0, H0 + 9, FZ0);
  const sun = new THREE.Group();
  sun.add(new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.45, 12, 48), coral));
  for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), M(0xffb02e, { emissive: 0xffb02e, emissiveIntensity: 0.4 })); const a = i / 12 * TAU; r.position.set(Math.cos(a) * 5.9, Math.sin(a) * 5.9, 0); r.rotation.z = a + Math.PI / 2; sun.add(r); Festival.glowMats.push(r.material); }
  sun.position.set(FX0, H0 + 12, FZ0);
  G.add(sun);
  Festival.sun = sun;
  Col.circle(FX0, FZ0, 13.5, 'wall');

  // string lights from the mast to poles around the ring
  const bulbs = [], wires = [];
  const ringR = PLAZA.r + 1.2;
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU + 0.17;
    const [px, pz] = polar(a, ringR);
    const ph = 7.5;
    add(new THREE.CylinderGeometry(0.1, 0.13, ph, 8), truss, px, H0 + ph / 2, pz);
    Col.circle(px, pz, 0.2, 'post');
    for (let k = 1; k < 30; k++) {
      const t = k / 30;
      const x = lerp(FX0, px, t), z = lerp(FZ0, pz, t);
      const y = lerp(H0 + 17, H0 + ph, t) - Math.sin(t * Math.PI) * 3.2;
      bulbs.push([x, y, z, (i + k) % 3]);
    }
    let lx = FX0, ly = H0 + 17, lz = FZ0;
    for (let k = 1; k <= 30; k++) {
      const t = k / 30, x = lerp(FX0, px, t), z = lerp(FZ0, pz, t), y = lerp(H0 + 17, H0 + ph, t) - Math.sin(t * Math.PI) * 3.2 + 0.12;
      wires.push(lx, ly, lz, x, y, z); lx = x; ly = y; lz = z;
    }
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  G.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x222428 })));
  const bulbCols = [0xffd27a, 0xff5a8c, 0x7ad7ff];
  const bulbMats = bulbCols.map((c) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 }); Festival.glowMats.push(m); return m; });
  const o = new THREE.Object3D();
  for (let c = 0; c < 3; c++) {
    const list = bulbs.filter((b) => b[3] === c);
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), bulbMats[c], list.length);
    list.forEach((b, i) => { o.position.set(b[0], b[1], b[2]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    G.add(im);
  }

  // main stage (NE)
  {
    const a = -Math.PI / 4, [x, z] = polar(a, 104), ry = face(x, z);
    const st = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 14), M(0x1c1d22));
    deck.position.y = 1; st.add(deck);
    for (const sx of [-16, 16]) for (const sz of [-6, 6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 15, 0.8), truss); p.position.set(sx, 7.5, sz); st.add(p); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(34, 1, 14), truss); top.position.y = 15; st.add(top);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 36, 24, 1, true, -Math.PI / 2, Math.PI), M(0xf2f2f2, { side: THREE.DoubleSide }));
    roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.9); roof.position.y = 15.5; st.add(roof);
    Festival.ledMat = new THREE.MeshStandardMaterial({ map: festLogoTex(), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.9, roughness: 0.4 });
    Festival.ledMat.emissiveMap = Festival.ledMat.map;
    const led = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), Festival.ledMat); led.position.set(0, 8.5, -5.8); st.add(led);
    const back = new THREE.Mesh(new THREE.BoxGeometry(24, 13, 0.6), M(0x111214)); back.position.set(0, 8.5, -6.3); st.add(back);
    for (let i = 0; i < 8; i++) { // stage spotlights
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.8, 10), M(0x111111, { emissive: 0xffffff, emissiveIntensity: 0.2 }));
      sp.position.set(-14 + i * 4, 14.3, 5.5); sp.rotation.x = 0.8; st.add(sp); Festival.glowMats.push(sp.material);
    }
    for (const sx of [-21, 21]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 4), M(0x15161a)); sk.position.set(sx, 4.5, 2); st.add(sk); }
    st.position.set(x, H0 - 0.1, z); st.rotation.y = ry;
    st.traverse((m) => { m.castShadow = m.receiveShadow = true; });
    G.add(st);
    Col.box(x, z, 23, 7.5, ry, 'building');
  }

  // marquee tents (SE)
  const stripe = (c1, c2) => canvasTex(256, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i & 1 ? c2 : c1; x.fillRect(i * 32, 0, 32, h); } });
  const tentMats = [stripe('#ffffff', '#e8222f'), stripe('#ffffff', '#1e6bff'), stripe('#fff4d6', '#ff8a1e'), stripe('#ffffff', '#16a34a')].map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, side: THREE.DoubleSide }));
  const tents = [[0.52, 98, 9], [0.82, 102, 8], [1.12, 97, 7], [0.36, 118, 7], [0.98, 120, 9]];
  tents.forEach(([a, r, s], i) => {
    const [x, z] = polar(a, r);
    const t = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.CylinderGeometry(s, s, 3, 16, 1, true), tentMats[i % 4]); walls.position.y = 1.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 1.12, s * 0.75, 16, 1, true), tentMats[(i + 1) % 4]); roof.position.y = 3 + s * 0.375;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), truss); pole.position.y = 3 + s * 0.75 + 0.6;
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), coral); pen.position.set(0.6, 3 + s * 0.75 + 1.1, 0);
    t.add(walls, roof, pole, pen);
    t.position.set(x, hAt(x, z), z);
    t.traverse((m) => { m.castShadow = m.receiveShadow = true; });
    G.add(t);
    Col.circle(x, z, s, 'building');
  });

  // garages (SW): open-fronted hangars with display cars inside
  for (const da of [-0.22, 0.22]) {
    const a = Math.PI * 0.75 + da, [x, z] = polar(a, 103), ry = face(x, z);
    const gg = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 16, 28, 1, true, -Math.PI / 2, Math.PI), M(0x8c949e, { metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
    const back = new THREE.Mesh(new THREE.CircleGeometry(9, 28, 0, Math.PI), M(0x2a2d33, { side: THREE.DoubleSide }));
    back.position.z = -8;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 16), M(0x3a3d44, { roughness: 0.3, metalness: 0.2 }));
    floor.position.y = 0.1;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.4), new THREE.MeshStandardMaterial({ map: signTexture(['GARAGE'], { bg: '#ff3d7f', fg: '#fff', w: 512, h: 120, border: false }), emissive: 0xffffff, emissiveIntensity: 0.4 }));
    Festival.glowMats.push(sign.material);
    sign.material.emissiveMap = sign.material.map;
    sign.position.set(0, 7.2, 8.05);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(14, 0.15, 0.3), PropMat.tunnelLamp); strip.position.set(0, 8.2, 0);
    gg.add(shell, back, floor, sign, strip);
    // half-cylinder with its axis along local z, open side down
    shell.geometry.rotateX(-Math.PI / 2);
    gg.position.set(x, H0 - 0.05, z); gg.rotation.y = ry;
    gg.traverse((m) => { m.castShadow = m.receiveShadow = true; });
    G.add(gg);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const sd of [-1, 1]) Col.box(x + c * 9 * sd, z - s * 9 * sd, 0.4, 8, ry, 'building');
    Col.box(x - s * 8, z - c * 8, 9, 0.4, ry, 'building');
    Festival.displaySpots.push({ x, z, y: H0 + 0.2, h: ry, garage: true });
  }
  {
    const a = Math.PI * 0.75, [x, z] = polar(a, 84);
    Festival.garageSpot = { x, z };
    // garage preview turntable in front of the hangars
    const [px, pz] = polar(a, 96);
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.3, 48), M(0x1a1c22, { metalness: 0.6, roughness: 0.25 }));
    tt.position.set(px, H0 + 0.15, pz);
    tt.receiveShadow = true;
    G.add(tt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.65, 0.07, 6, 64).rotateX(Math.PI / 2), coral); ring.position.set(px, H0 + 0.31, pz);
    G.add(ring);
    Festival.previewSpot = { x: px, z: pz, y: H0 + 0.3, a };
  }

  // Ferris wheel (NW, just outside the ring)
  {
    const a = -Math.PI * 0.75, [x, z] = polar(a, 116), ry = face(x, z) + Math.PI / 2;
    const base = new THREE.Group();
    const R = 17, cy = R + 3;
    for (const sd of [-1, 1]) for (const lean of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, cy / Math.cos(0.32), 10), truss);
      leg.position.set(lean * Math.tan(0.32) * cy / 2, cy / 2, sd * 2.4); leg.rotation.z = -lean * 0.32; base.add(leg);
    }
    const wheel = new THREE.Group();
    for (const sd of [-1.6, 1.6]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 8, 72), truss); rim.position.z = sd; wheel.add(rim);
      for (let i = 0; i < 16; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.12, R, 0.12), truss); const t = i / 16 * TAU; sp.position.set(Math.cos(t) * R / 2, Math.sin(t) * R / 2, sd); sp.rotation.z = t - Math.PI / 2; wheel.add(sp); }
    }
    const lights = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.12, 6, 96), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9fe3ff, emissiveIntensity: 0.3 }));
    Festival.glowMats.push(lights.material);
    wheel.add(lights);
    const gm = [M(0xff3d7f), M(0xffb02e), M(0x1e6bff), M(0x16a34a)];
    for (let i = 0; i < 16; i++) {
      const t = i / 16 * TAU;
      const g = new THREE.Group();
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.6, 10), gm[i % 4]); cab.position.y = -1.4;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.7, 10), M(0xf2f2f2)); roof.position.y = -0.3;
      g.add(cab, roof);
      g.position.set(Math.cos(t) * R, Math.sin(t) * R, 0);
      wheel.add(g); Festival.gondolas.push(g);
    }
    wheel.position.y = cy;
    base.add(wheel);
    base.position.set(x, hAt(x, z) - 0.2, z); base.rotation.y = ry;
    base.traverse((m) => { m.castShadow = true; });
    G.add(base);
    Festival.wheel = wheel;
    Col.circle(x, z, 6, 'building');
  }

  // grandstand (N, between the gates)
  {
    const a = -Math.PI * 0.62, [x, z] = polar(a, 100), ry = face(x, z);
    const gs = new THREE.Group();
    for (let i = 0; i < 6; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 1.4), M(i & 1 ? 0x3b3f47 : 0x4a4f58)); step.position.set(0, 0.3 + i * 0.75, -i * 1.3); gs.add(step); }
    const crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.5, 2, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 120);
    const cc = new THREE.Color();
    for (let i = 0; i < 120; i++) { const row = i % 6; o.position.set(-12 + (i / 6 | 0) * 1.25 + (row & 1) * 0.4, 1.1 + row * 0.75, -row * 1.3); o.updateMatrix(); crowd.setMatrixAt(i, o.matrix); crowd.setColorAt(i, cc.setHSL(hash2(i, 2), 0.6, 0.5)); }
    gs.add(crowd);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 9), M(0xf4f4f4)); canopy.position.set(0, 8, -3.5); canopy.rotation.x = -0.12; gs.add(canopy);
    for (const sx of [-13, 13]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 0.4), truss); p.position.set(sx, 4, -7.2); gs.add(p); }
    gs.position.set(x, hAt(x, z) - 0.1, z); gs.rotation.y = ry;
    gs.traverse((m) => { m.castShadow = m.receiveShadow = true; });
    G.add(gs);
    Col.box(x, z - 0, 13.5, 4.5, ry, 'building');
  }

  // display turntables on the plaza
  for (const a of [Math.PI * 0.25, -Math.PI * 0.25, Math.PI * 0.6, -Math.PI * 0.4]) {
    const [x, z] = polar(a, 58);
    const tt = new THREE.Group();
    tt.add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.35, 40), M(0x202228, { metalness: 0.5, roughness: 0.3 })));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.06, 6, 60).rotateX(Math.PI / 2), coral); ring.position.y = 0.17; tt.add(ring);
    tt.position.set(x, H0 + 0.17, z);
    G.add(tt);
    Col.circle(x, z, 3.3, 'wall');
    Festival.turntables.push({ x, z, y: H0 + 0.35, a: rng() * TAU, car: null });
  }

  // flags around the ring
  const flagTex = [festLogoTex(256, 128, ''), stripe('#ff3d7f', '#ffb02e'), stripe('#1e6bff', '#ffffff')];
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTex[1], side: THREE.DoubleSide, roughness: 0.8 });
  flagMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = Props.uTime; sh.uniforms.uWind = Props.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float fx = uv.x; vec2 ph = instanceMatrix[3].xz;
transformed.z += sin(uTime * 5.0 + fx * 6.0 + ph.x) * 0.22 * fx * (0.4 + uWind);
transformed.y -= fx * fx * 0.25 * (1.2 - min(uWind, 1.0));`);
  };
  const flagG = new THREE.PlaneGeometry(2.2, 1.3, 10, 2).translate(1.1, 0, 0);
  const poles = [], flags = [];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * TAU;
    const near = [0, Math.PI / 2, Math.PI, -Math.PI / 2].some((g) => Math.abs(wrapAngle(a - g)) < 0.16);
    if (near) continue;
    const [x, z] = polar(a, PLAZA.r + 4.5);
    poles.push([x, hAt(x, z), z]);
    flags.push([x, hAt(x, z) + 8, z, -a]);
    Col.circle(x, z, 0.15, 'post');
  }
  const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 9, 6).translate(0, 4.5, 0), PropMat.metal, poles.length);
  poles.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, 0, 0); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); });
  const fm = new THREE.InstancedMesh(flagG, flagMat, flags.length);
  flags.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3], 0); o.updateMatrix(); fm.setMatrixAt(i, o.matrix); });
  pm.castShadow = fm.castShadow = true;
  G.add(pm, fm);

  // entrance arch over the approach road
  {
    const r = World.byId.A9, k = Math.min(r.n - 1, 30);
    const x = r.x[k], z = r.z[k], y = r.y[k], ry = Math.atan2(r.tx[k], r.tz[k]);
    const W2 = r.hw + 2.5;
    const arch = new THREE.Group();
    for (const sd of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 10, 1.4), truss); leg.position.set(sd * W2, 5, 0); arch.add(leg);
      Col.circle(x + Math.cos(ry) * sd * W2, z - Math.sin(ry) * sd * W2, 0.9, 'post');
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W2 * 2 + 1.4, 3.2, 1.2), M(0x15161a)); beam.position.y = 10.6; arch.add(beam);
    const tex = festLogoTex(1024, 160, '');
    const banner = canvasTex(1024, 140, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ff3d7f'); g.addColorStop(1, '#ffb02e');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'italic 900 96px "Saira Condensed", Arial Narrow, sans-serif';
      c.fillText('SOLSTICE FESTIVAL', w / 2, h / 2 + 4);
    }, { repeat: false });
    void tex;
    const bm = new THREE.MeshStandardMaterial({ map: banner, emissive: 0xffffff, emissiveMap: banner, emissiveIntensity: 0.35 });
    Festival.glowMats.push(bm);
    for (const sd of [1, -1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2, 2.6), bm); b.position.set(0, 10.6, sd * 0.62); if (sd < 0) b.rotation.y = Math.PI; arch.add(b); }
    arch.position.set(x, y, z); arch.rotation.y = ry;
    arch.traverse((m) => { m.castShadow = true; });
    G.add(arch);
  }
  buildCrowd(G, H0);
  mergeByMaterial(G, [Festival.sun, Festival.wheel]);
}

/* Festival visitors: a dancing crowd at the stage, people browsing the tents and garages. */
function buildCrowd(G, H0) {
  const spots = [];
  const r = mulberry32(31);
  const area = (a0, a1, r0, r1, n, dance) => {
    for (let i = 0; i < n; i++) {
      const a = lerp(a0, a1, r()), rad = lerp(r0, r1, Math.sqrt(r()));
      const [x, z] = polar(a, rad);
      if (spots.some((p) => Math.hypot(p[0] - x, p[1] - z) < 0.75)) continue;
      spots.push([x, z, dance, r()]);
    }
  };
  area(-Math.PI / 4 - 0.2, -Math.PI / 4 + 0.2, 85, 95, 150, 1); // in front of the stage
  area(0.42, 1.12, 84, 90, 45, 0); // tents
  area(Math.PI * 0.75 - 0.35, Math.PI * 0.75 + 0.35, 83, 88, 25, 0); // garages
  area(-Math.PI * 0.9, -Math.PI * 0.55, 84, 90, 25, 0); // wheel + grandstand
  const body = new THREE.CapsuleGeometry(0.2, 0.75, 3, 8).translate(0, 0.6, 0);
  const head = new THREE.SphereGeometry(0.12, 10, 8).translate(0, 1.32, 0);
  const mat = (shirts) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = Props.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vec2 cp = instanceMatrix[3].xz;
float ph = fract(sin(dot(cp, vec2(12.9898, 78.233))) * 43758.5453);
float dance = step(0.5, fract(ph * 7.0)) * step(instanceMatrix[3].y, 1e6);
transformed.y += abs(sin(uTime * (3.2 + ph) + ph * 6.28)) * 0.16 * dance;
transformed.x += sin(uTime * 1.3 + ph * 9.0) * 0.03 * position.y;`);
    };
    void shirts;
    return m;
  };
  const bm = new THREE.InstancedMesh(body, mat(true), spots.length);
  const hm = new THREE.InstancedMesh(head, mat(false), spots.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  const shirts = [0xff3d7f, 0xffb02e, 0x27b6ff, 0xf4f4f0, 0x2fbf71, 0x6a2fd6, 0x222831, 0xe8222f, 0x1e6bff];
  const skin = [0xf1c7a5, 0xd9a07a, 0xa86b45, 0x6e4529, 0xf6d6bd];
  spots.forEach((p, i) => {
    const [x, z, dance, rnd] = p;
    // dancers face the stage, others face a random direction
    const [sx, sz] = polar(-Math.PI / 4, 104);
    const face = dance ? Math.atan2(sx - x, sz - z) : rnd * TAU;
    o.position.set(x, H0 + (dance ? 0 : 0), z); o.rotation.set(0, face, 0); o.scale.setScalar(0.88 + rnd * 0.25); o.updateMatrix();
    bm.setMatrixAt(i, o.matrix); hm.setMatrixAt(i, o.matrix);
    bm.setColorAt(i, col.set(shirts[(i * 5 + (rnd * 9 | 0)) % shirts.length]));
    hm.setColorAt(i, col.set(skin[(i * 3 + (rnd * 5 | 0)) % skin.length]));
    Col.circle(x, z, 0.35, 'post');
  });
  bm.castShadow = hm.castShadow = true;
  G.add(bm, hm);
}

function updateFestival(dt, night) {
  if (Festival.wheel) {
    Festival.wheel.rotation.z += dt * 0.06;
    for (const g of Festival.gondolas) g.rotation.z = -Festival.wheel.rotation.z;
  }
  if (Festival.sun) Festival.sun.rotation.y += dt * 0.25;
  for (const t of Festival.turntables) if (t.car) { t.a += dt * 0.3; t.car.rotation.y = t.a; }
  const glow = 0.25 + night * 2.2;
  for (const m of Festival.glowMats) m.emissiveIntensity = glow;
  if (Festival.ledMat) Festival.ledMat.emissiveIntensity = 0.7 + night * 0.8;
}
