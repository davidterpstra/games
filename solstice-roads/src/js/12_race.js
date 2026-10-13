/* =====================================================================
   Activities: event routes, race manager, AI drivers, PR stunts
   (speed traps, speed zones, drift zones) and drift skill chains.
   ===================================================================== */

/* ---------- routes ---------- */
function roadBetween(a, b, prefer) {
  const cands = World.roads.filter((r) => (r.def.a === a && r.def.b === b) || (r.def.a === b && r.def.b === a));
  if (!cands.length) return null;
  if (prefer) { const p = cands.find((r) => prefer.includes(r.id)); if (p) return p; }
  return cands.find((r) => r.type !== 'M') || cands[0];
}
function buildRoute(ev) {
  const pts = [];
  const push = (x, z, hw, paved) => {
    const l = pts[pts.length - 1];
    if (l && Math.hypot(l[0] - x, l[1] - z) < 2.5) return;
    pts.push([x, z, hw, paved]);
  };
  const nodes = ev.route;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    const via = ev.via && ev.via[a + '>' + b];
    const road = via ? null : roadBetween(a, b, ev.roads);
    if (road) {
      const fwd = road.def.a === a;
      for (let k = 0; k < road.n; k += 2) {
        const kk = fwd ? k : road.n - 1 - k;
        push(road.x[kk], road.z[kk], road.hw, road.type !== 'D');
      }
      const kl = fwd ? road.n - 1 : 0;
      push(road.x[kl], road.z[kl], road.hw, road.type !== 'D');
    } else if (via) {
      const P = catmull([NODES[a], ...via, NODES[b]], 4);
      for (const p of P) push(p[0], p[1], 7, false);
    } else {
      // connector across the festival plaza: swing around the central island
      const [ax, az] = NODES[a], [bx, bz] = NODES[b];
      const a0 = Math.atan2(az - PLAZA.z, ax - PLAZA.x), a1 = Math.atan2(bz - PLAZA.z, bx - PLAZA.x);
      let da = wrapAngle(a1 - a0);
      if (Math.abs(da) < 0.01) da = TAU;
      const n = Math.max(8, Math.ceil(Math.abs(da) * 45 / 4));
      for (let k = 0; k <= n; k++) {
        const t = k / n, ang = a0 + da * t;
        const r = lerp(PLAZA.r - 2, 34, Math.sin(t * Math.PI) ** 0.6);
        push(PLAZA.x + Math.cos(ang) * r, PLAZA.z + Math.sin(ang) * r, 9, true);
      }
    }
  }
  const closed = nodes[0] === nodes[nodes.length - 1];
  if (closed) { const f = pts[0], l = pts[pts.length - 1]; if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 3) pts.pop(); }
  const N = pts.length;
  const cum = new Float32Array(N + 1), curv = new Float32Array(N), dirs = new Float32Array(N);
  for (let i = 1; i <= N; i++) { const p = pts[i % N], q = pts[i - 1]; if (i === N && !closed) { cum[i] = cum[i - 1]; break; } cum[i] = cum[i - 1] + Math.hypot(p[0] - q[0], p[1] - q[1]); }
  const P = (i) => pts[closed ? ((i % N) + N) % N : clamp(i, 0, N - 1)];
  for (let i = 0; i < N; i++) { const a = P(i - 1), b = P(i + 1); dirs[i] = Math.atan2(b[0] - a[0], b[1] - a[1]); }
  for (let i = 0; i < N; i++) {
    const a = P(i - 3), b = P(i), c = P(i + 3);
    const h1 = Math.atan2(b[0] - a[0], b[1] - a[1]), h2 = Math.atan2(c[0] - b[0], c[1] - b[1]);
    const ds = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    curv[i] = Math.abs(wrapAngle(h2 - h1)) / ds * 2;
  }
  // smooth curvature a little
  const cs = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 0; for (let k = -2; k <= 2; k++) m = Math.max(m, curv[closed ? ((i + k) % N + N) % N : clamp(i + k, 0, N - 1)]); cs[i] = m; }
  return { pts, N, cum, len: closed ? cum[N] : cum[N - 1], curv: cs, dirs, closed, P };
}
function routeAt(route, s) {
  // position at arc length s (wraps on circuits)
  const L = route.len;
  if (route.closed) s = ((s % L) + L) % L; else s = clamp(s, 0, L);
  let lo = 0, hi = route.N - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (route.cum[mid] <= s) lo = mid; else hi = mid - 1; }
  const a = route.pts[lo], b = route.P(lo + 1);
  const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const t = clamp((s - route.cum[lo]) / seg, 0, 1);
  const x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
  return { x, z, i: lo, h: Math.atan2(b[0] - a[0], b[1] - a[1]), hw: a[2] };
}
function nearestRouteIdx(route, x, z, guess, back = 8, fwd = 40) {
  let best = guess, bd = 1e18;
  for (let k = -back; k <= fwd; k++) {
    let i = guess + k;
    if (route.closed) i = ((i % route.N) + route.N) % route.N; else if (i < 0 || i >= route.N) continue;
    const p = route.pts[i], d = (p[0] - x) ** 2 + (p[1] - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return { i: best, d: Math.sqrt(bd) };
}
function nearestRouteIdxGlobal(route, x, z) {
  let best = 0, bd = 1e18;
  for (let i = 0; i < route.N; i++) { const p = route.pts[i], d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}

/* ---------- AI driver ---------- */
class AIDriver {
  constructor(veh, route, skill, lane) {
    this.v = veh; this.route = route; this.skill = skill; this.lane = lane; this.laneT = lane;
    this.idx = nearestRouteIdxGlobal(route, veh.x, veh.z);
    this.stuck = 0; this.off = 0; this.prog = 0;
  }
  update(dt, cars, rubber) {
    const v = this.v, R = this.route, sp = v.spec;
    const nr = nearestRouteIdx(R, v.x, v.z, this.idx, 6, 14);
    this.idx = nr.i;
    this.routeD = nr.d;
    const speed = v.speed;
    // avoid cars ahead by shifting lane
    let block = 0;
    for (const o of cars) {
      if (o === v) continue;
      const dx = o.x - v.x, dz = o.z - v.z;
      const fwd = dx * Math.sin(v.h) + dz * Math.cos(v.h), lat = dx * Math.cos(v.h) - dz * Math.sin(v.h);
      if (fwd > 0 && fwd < 9 + speed * 0.5 && Math.abs(lat) < 2.6 && o.speed < speed + 2) block = lat > 0 ? -1 : 1;
    }
    if (block) this.laneT = clamp(this.laneT + block * dt * 0.9, -0.55, 0.55);
    else this.laneT = lerp(this.laneT, this.lane, dt * 0.15);
    // steering: pure pursuit on a lookahead point with lane offset
    const look = 6 + speed * 0.42;
    const s0 = R.cum[this.idx];
    const tp = routeAt(R, s0 + look);
    const hw = tp.hw;
    const lx = Math.cos(tp.h), lz = -Math.sin(tp.h);
    const tx = tp.x + lx * this.laneT * hw, tz = tp.z + lz * this.laneT * hw;
    const ang = wrapAngle(Math.atan2(tx - v.x, tz - v.z) - v.h);
    const steerMax = sp.steer / (1 + (speed / 26) ** 2) + 0.035;
    let steer = clamp(ang / steerMax * 1.15, -1, 1);
    // counter-steer when sliding
    const beta = speed > 4 ? Math.atan2(v.vLat, Math.abs(v.vLong) + 0.5) : 0;
    steer = clamp(steer + beta * 0.8, -1, 1);
    // speed planning from curvature ahead
    const muE = sp.mu * 0.92;
    const dec = G * muE * 0.8 * Math.min(1.1, sp.brake);
    let target = v.vmax * 1.05;
    const horizon = speed * speed / (2 * dec) + 40;
    for (let s = 0; s < horizon; s += 4) {
      const p = routeAt(R, s0 + s);
      const k = R.curv[p.i] + 1e-4;
      const paved = R.pts[p.i][3];
      const mu = muE * (paved ? 1 - Sky.wet * 0.15 : lerp(0.72, 0.98, sp.offroad));
      const vt = Math.sqrt(mu * G * 1.08 / k) * this.skill * rubber;
      const req = Math.sqrt(vt * vt + 2 * dec * s);
      if (req < target) target = req;
    }
    let throttle = 0, brake = 0;
    if (speed < target - 0.8) throttle = 1;
    else if (speed > target + 1.2) { brake = clamp((speed - target) / 5, 0.25, 1); }
    else throttle = 0.45;
    if (Math.abs(ang) > 1.2 && speed > 8) { throttle = 0; brake = 0.6; }
    v.input.throttle = throttle; v.input.brake = brake; v.input.steer = steer; v.input.handbrake = 0;
    // recovery
    if (speed < 1.5) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt * 2);
    if (nr.d > 26) this.off += dt; else this.off = 0;
    if (this.stuck > 3.5 || this.off > 3 || v.water > 0.8) this.recover();
  }
  recover() {
    const v = this.v, R = this.route;
    const p = routeAt(R, R.cum[this.idx] + 6);
    const lx = Math.cos(p.h), lz = -Math.sin(p.h);
    v.reset(p.x + lx * this.lane * p.hw * 0.25, p.z + lz * this.lane * p.hw * 0.25, p.h);
    v.vx = Math.sin(p.h) * 8; v.vz = Math.cos(p.h) * 8;
    this.stuck = 0; this.off = 0;
  }
}

/* ---------- race manager ---------- */
const TYPE_LABEL = { circuit: 'Circuit', race: 'Road Race', sprint: 'Sprint', offroad: 'Off-road', trap: 'Speed Trap', zone: 'Speed Zone', drift: 'Drift Zone' };
const TYPE_COLOR = { circuit: '#ff3d7f', race: '#ff8a1e', sprint: '#ffc21e', offroad: '#2fbf71', trap: '#27b6ff', zone: '#27b6ff', drift: '#b46bff', garage: '#ffffff' };
const Events = { routes: {}, markers: [], stunts: [] };

function eventStart(ev) {
  const R = Events.routes[ev.id];
  const s = ev.start || 20;
  return { ...routeAt(R, s), s };
}
function prepareEvents() {
  for (const ev of EVENTS) {
    if (ev.route) {
      const R = buildRoute(ev);
      Events.routes[ev.id] = R;
      ev.length = ev.type === 'circuit' || (ev.type === 'offroad' && R.closed) ? R.len * ev.laps : R.len - (ev.start || 0) - 10;
      const st = eventStart(ev);
      // marker beside the start line, on the left verge
      const lx = Math.cos(st.h), lz = -Math.sin(st.h);
      ev.marker = { x: st.x + lx * (st.hw + 3), z: st.z + lz * (st.hw + 3) };
    } else {
      // stunts: gates on the named road
      const road = World.byId[ev.road];
      const gate = (pt) => {
        let best = 0, bd = 1e18;
        for (let k = 0; k < road.n; k++) { const d = (road.x[k] - pt[0]) ** 2 + (road.z[k] - pt[1]) ** 2; if (d < bd) { bd = d; best = k; } }
        const lx = road.tz[best], lz = -road.tx[best], w = road.hw + 3;
        return { k: best, x: road.x[best], z: road.z[best], y: road.y[best], ax: road.x[best] + lx * w, az: road.z[best] + lz * w, bx: road.x[best] - lx * w, bz: road.z[best] - lz * w, h: Math.atan2(road.tx[best], road.tz[best]), hw: road.hw };
      };
      if (ev.type === 'trap') ev.gates = [gate(ev.at)];
      else { ev.gates = [gate(ev.from), gate(ev.to)]; ev.dist = Math.abs(road.s[ev.gates[1].k] - road.s[ev.gates[0].k]); }
      ev.marker = { x: ev.gates[0].ax, z: ev.gates[0].az };
      Events.stunts.push({ ev, active: false, t: 0, pts: 0, from: -1 });
    }
  }
}

/* World markers: light columns + floating icons, stunt gates. */
function iconTexture(type) {
  return canvasTex(128, 128, (x) => {
    const c = TYPE_COLOR[type] || '#fff';
    x.fillStyle = 'rgba(10,12,18,0.85)'; x.beginPath(); x.arc(64, 64, 58, 0, TAU); x.fill();
    x.strokeStyle = c; x.lineWidth = 8; x.beginPath(); x.arc(64, 64, 54, 0, TAU); x.stroke();
    x.fillStyle = c; x.strokeStyle = c; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
    x.save(); x.translate(64, 64);
    if (type === 'circuit') { x.beginPath(); x.ellipse(0, 0, 28, 18, 0, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(-6, -18); x.lineTo(6, -18); x.stroke(); }
    else if (type === 'race' || type === 'sprint') { x.beginPath(); x.moveTo(-28, 20); x.lineTo(-6, -4); x.lineTo(6, 6); x.lineTo(28, -20); x.stroke(); x.beginPath(); x.moveTo(14, -22); x.lineTo(30, -22); x.lineTo(30, -6); x.stroke(); }
    else if (type === 'offroad') { x.beginPath(); x.moveTo(-30, 22); x.lineTo(-10, -12); x.lineTo(2, 6); x.lineTo(12, -6); x.lineTo(30, 22); x.closePath(); x.fill(); }
    else if (type === 'drift') { x.beginPath(); x.arc(0, 4, 22, Math.PI * 1.1, Math.PI * 2.1); x.stroke(); x.beginPath(); x.moveTo(20, 10); x.lineTo(24, -4); x.lineTo(10, 0); x.stroke(); }
    else if (type === 'garage') { x.beginPath(); x.moveTo(-28, 26); x.lineTo(-28, -6); x.lineTo(0, -26); x.lineTo(28, -6); x.lineTo(28, 26); x.stroke(); x.fillRect(-16, 4, 32, 6); x.fillRect(-16, 16, 32, 6); }
    else { x.beginPath(); x.arc(0, 8, 26, Math.PI, TAU); x.stroke(); x.beginPath(); x.moveTo(0, 8); x.lineTo(16, -10); x.stroke(); }
    x.restore();
  }, { repeat: false });
}
function buildMarkers(scene) {
  const colMat = (c) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uCol: { value: new THREE.Color(c) }, uTime: Props.uTime, uOn: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uCol; uniform float uTime, uOn; varying vec2 vUv;
      void main(){ float a = (1.0 - vUv.y) * 0.55 + 0.15 * sin(vUv.y * 40.0 - uTime * 4.0) * (1.0 - vUv.y); a *= smoothstep(0.0, 0.08, vUv.y) * uOn; gl_FragColor = vec4(uCol * a, a); }`,
  });
  const list = EVENTS.map((ev) => ({ ev, x: ev.marker.x, z: ev.marker.z, type: ev.type }));
  if (Festival.garageSpot) list.push({ ev: null, garage: true, x: Festival.garageSpot.x, z: Festival.garageSpot.z, type: 'garage' });
  for (const m of list) {
    const y = groundAt(m.x, m.z, 1e9);
    const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 26, 24, 1, true).translate(0, 13, 0), colMat(TYPE_COLOR[m.type]));
    col.renderOrder = 5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: TYPE_COLOR[m.type], transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16 }));
    ring.position.y = 0.15;
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(m.type), depthWrite: false, fog: false, sizeAttenuation: true }));
    icon.scale.set(3.2, 3.2, 1);
    icon.position.y = 6;
    icon.renderOrder = 6;
    g.add(col, ring, icon);
    g.position.set(m.x, y, m.z);
    scene.add(g);
    Events.markers.push({ ...m, g, icon, col, y });
  }
  // stunt gates: two pylons + banner across the road / speed camera
  for (const st of Events.stunts) {
    const ev = st.ev;
    for (const gt of ev.gates) {
      const grp = new THREE.Group();
      const c = TYPE_COLOR[ev.type];
      const pm = new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.5, roughness: 0.4 });
      const em = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 });
      Festival.glowMats.push(em);
      for (const sd of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), pm); p.position.set(sd * (gt.hw + 2.6), 3, 0); grp.add(p);
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.5, 0.06), em); s.position.set(sd * (gt.hw + 2.6), 3, 0.22); grp.add(s);
        Col.circle(gt.x + Math.cos(gt.h) * sd * (gt.hw + 2.6), gt.z - Math.sin(gt.h) * sd * (gt.hw + 2.6), 0.3, 'post');
      }
      if (ev.type !== 'trap') {
        const ban = canvasTex(1024, 96, (x, w, h) => { x.fillStyle = '#111318'; x.fillRect(0, 0, w, h); x.fillStyle = c; x.fillRect(0, h - 10, w, 10); x.fillStyle = '#fff'; x.font = 'italic 800 60px "Saira Condensed", Arial Narrow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ev.name.toUpperCase(), w / 2, h / 2 - 4); }, { repeat: false });
        const bm = new THREE.MeshStandardMaterial({ map: ban, emissive: 0xffffff, emissiveMap: ban, emissiveIntensity: 0.3 });
        Festival.glowMats.push(bm);
        const b = new THREE.Mesh(new THREE.BoxGeometry((gt.hw + 2.6) * 2, 1.0, 0.2), [pm, pm, pm, pm, bm, bm]); b.position.y = 6.2; grp.add(b);
      } else {
        const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.7), pm); camBox.position.set(gt.hw + 2.6, 6.3, 0); grp.add(camBox);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), em); lens.position.set(gt.hw + 2.6, 6.3, 0.36); grp.add(lens);
      }
      grp.position.set(gt.x, gt.y, gt.z);
      grp.rotation.y = gt.h;
      grp.traverse((o) => { o.castShadow = true; });
      scene.add(grp);
    }
  }
}
function updateMarkers(camPos, inRace) {
  for (const m of Events.markers) {
    const d = Math.hypot(m.x - camPos.x, m.z - camPos.z);
    m.g.visible = !inRace && d < 1400;
    const s = clamp(d / 40, 1, 9);
    m.icon.scale.set(3.2 * s, 3.2 * s, 1);
    m.icon.position.y = 6 + (s - 1) * 1.6;
    m.col.material.uniforms.uOn.value = clamp(d / 30, 0.25, 1);
  }
}

/* Checkpoint gates shown during races. */
const Gates = { list: [], mat: null };
function makeGate(x, z, h, w, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, fog: false });
  const y = groundAt(x, z, 1e9);
  for (const sd of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 10).translate(0, 3.5, 0), m);
    p.position.set(sd * w, 0, 0);
    g.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.6, 0.3), m); beam.position.y = 7; g.add(beam);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, 7).translate(0, 3.5, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  g.add(sheet);
  g.position.set(x, y, z);
  g.rotation.y = h;
  g.userData.m = m;
  return g;
}

const Race = {
  ev: null, route: null, phase: 'none', t: 0, count: 0, cps: [], ncp: 0, laps: 1, cars: [], ai: [], gates: [], results: null,
};
function raceSetup(ev) {
  const R = Events.routes[ev.id];
  Race.ev = ev; Race.route = R; Race.laps = ev.laps || 1;
  Race.phase = 'countdown'; Race.t = 0; Race.count = 3.999; Race.results = null; Race.pIdx = undefined; Race.wrongT = 0;
  const st = eventStart(ev);
  // checkpoints
  const cps = [];
  const span = R.closed ? R.len : R.len - st.s - 10;
  const n = clamp(Math.round(span / 320), 4, 14);
  for (let i = 1; i <= n; i++) {
    const s = R.closed ? st.s + span * i / n : st.s + span * i / n;
    const p = routeAt(R, s);
    const w = p.hw + (ev.type === 'offroad' ? 9 : 4.5);
    const lx = Math.cos(p.h), lz = -Math.sin(p.h);
    cps.push({ x: p.x, z: p.z, h: p.h, w, ax: p.x + lx * w, az: p.z + lz * w, bx: p.x - lx * w, bz: p.z - lz * w, s, last: i === n });
  }
  Race.cps = cps; Race.ncp = n;
  for (const g of Race.gates) { Game.scene.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  Race.gates = cps.map((c) => makeGate(c.x, c.z, c.h, c.w, c.last ? 0xffffff : 0xff3d7f));
  for (const g of Race.gates) Game.scene.add(g);
  // grid
  const slots = [];
  const nAI = ev.ai;
  const total = nAI + 1;
  for (let i = 0; i < total; i++) {
    const p = routeAt(R, st.s - 9 - Math.floor(i / 2) * 9);
    const lx = Math.cos(p.h), lz = -Math.sin(p.h);
    const side = i % 2 ? -1 : 1;
    slots.push({ x: p.x + lx * side * p.hw * 0.42, z: p.z + lz * side * p.hw * 0.42, h: p.h });
  }
  const playerSlot = Math.min(total - 1, 3);
  const ps = slots[playerSlot];
  Game.player.reset(ps.x, ps.z, ps.h);
  Game.clearAI();
  const pPI = carPI(Game.player.spec).v;
  const pool = CARS.filter((c) => Math.abs(carPI(c).v - pPI) < 160 && (ev.type !== 'offroad' || c.offroad > 0.15));
  const off = ev.type === 'offroad' ? CARS.filter((c) => c.offroad >= 0.75) : [];
  const diff = { easy: 0.84, normal: 0.92, hard: 0.99 }[Game.settings.difficulty || 'normal'];
  let ai = 0;
  for (let i = 0; i < total; i++) {
    if (i === playerSlot) continue;
    const src = off.length && ai % 2 === 0 ? off : pool.length ? pool : CARS;
    const spec = src[(ai * 3 + i + (Date.now() & 7)) % src.length];
    const veh = Game.spawnAI(spec, PAINTS[(ai * 5 + 3) % PAINTS.length]);
    veh.reset(slots[i].x, slots[i].z, slots[i].h);
    const drv = new AIDriver(veh, R, diff * (0.95 + 0.06 * ((ai * 7) % 5) / 4), (ai % 3 - 1) * 0.35);
    veh.driver = drv;
    Race.ai.push(drv);
    ai++;
  }
  Race.cars = [Game.player, ...Race.ai.map((d) => d.v)];
  for (const c of Race.cars) { c.race = { cp: 0, lap: 0, done: false, time: 0, px: c.x, pz: c.z, best: Infinity, lapStart: 0 }; c.savePrev(); }
  camReset(Game.player);
  clearSkids();
  Game.mode = 'race';
  hudRace(true);
}
function raceEnd(quit) {
  for (const g of Race.gates) Game.scene.remove(g);
  Race.gates = [];
  Race.phase = 'none'; Race.ev = null;
  Game.clearAI();
  for (const c of [Game.player]) c.race = null;
  Game.mode = 'drive';
  hudRace(false);
  if (quit) notify('Event abandoned', '', 'info');
}
function carProgress(c) {
  const r = c.race;
  if (!r) return 0;
  if (r.done) return 1e9 - r.time;
  const cp = Race.cps[r.cp % Race.ncp];
  return (r.lap * Race.ncp + r.cp) * 1e5 - Math.hypot(cp.x - c.x, cp.z - c.z);
}
function raceUpdate(dt) {
  const ev = Race.ev;
  if (!ev) return;
  if (Race.phase === 'countdown') {
    const before = Math.ceil(Race.count);
    Race.count -= dt;
    const after = Math.ceil(Race.count);
    if (after !== before && after >= 1 && after <= 3) { SFX.count(false); bigCount(String(after)); }
    for (const c of Race.cars) { c.input.throttle = c === Game.player ? c.input.throttle : 0.3; c.vx = c.vz = 0; c.w = 0; }
    if (Race.count <= 0) { Race.phase = 'run'; Race.t = 0; SFX.count(true); bigCount('GO!'); }
    return;
  }
  if (Race.phase !== 'run' && Race.phase !== 'finished') return;
  Race.t += dt;
  // rubber band relative to the player
  const pp = carProgress(Game.player);
  for (const d of Race.ai) {
    const ap = carProgress(d.v);
    const gap = (ap - pp) / 1e5 * (Race.route.len / Race.ncp);
    const rb = clamp(1 - gap / 2500, 0.93, 1.06);
    if (!d.v.race.done) d.update(dt, Race.cars, rb);
    else { d.v.input.throttle = 0; d.v.input.brake = 0.4; d.v.input.steer = 0; }
  }
  for (const c of Race.cars) {
    const r = c.race;
    if (r.done) { r.px = c.x; r.pz = c.z; continue; }
    const cp = Race.cps[r.cp];
    // route tracking for every car (player included): lets a checkpoint count when the car is
    // clearly past it along the route and still on the route (e.g. after a recovery reset)
    const nr = nearestRouteIdx(Race.route, c.x, c.z, r.ri ?? nearestRouteIdxGlobal(Race.route, c.x, c.z), 6, 14);
    r.ri = nr.i;
    let ahead = Race.route.cum[nr.i] - cp.s;
    if (Race.route.closed) ahead = ((ahead % Race.route.len) + Race.route.len * 1.5) % Race.route.len - Race.route.len * 0.5;
    const skipped = nr.d < 22 && ahead > 45 && ahead < 400;
    if (segCross(r.px, r.pz, c.x, c.z, cp.ax, cp.az, cp.bx, cp.bz) || skipped) {
      r.cp++;
      if (r.cp >= Race.ncp) {
        r.cp = 0; r.lap++;
        const lapT = Race.t - r.lapStart; r.best = Math.min(r.best, lapT); r.lapStart = Race.t;
        if (r.lap >= Race.laps || !Race.route.closed) { r.done = true; r.time = Race.t; if (c === Game.player) playerFinished(); }
        else if (c === Game.player) { notify(`Lap ${r.lap + 1} / ${Race.laps}`, `Lap time ${fmtTime(lapT)}`, 'lap'); SFX.checkpoint(); }
      } else if (c === Game.player) SFX.checkpoint();
    }
    r.px = c.x; r.pz = c.z;
  }
  // gates: highlight the player's next two checkpoints
  const pr = Game.player.race;
  Race.gates.forEach((g, i) => {
    const ahead = (i - pr.cp + Race.ncp) % Race.ncp;
    g.visible = !pr.done && ahead < 2;
    g.userData.m.opacity = ahead === 0 ? 0.8 : 0.3;
  });
  if (Race.phase === 'finished') {
    Race.finT -= dt;
    if (Race.finT <= 0 && !Race.results) showResults();
  }
}
function racePositions() {
  return [...Race.cars].sort((a, b) => carProgress(b) - carProgress(a));
}
function playerFinished() {
  Race.phase = 'finished';
  Race.finT = 2.5;
  SFX.finish();
  const pos = racePositions().indexOf(Game.player) + 1;
  bigCount(pos === 1 ? 'WINNER!' : ordinal(pos).toUpperCase());
}
function showResults() {
  const ev = Race.ev;
  const order = racePositions();
  const rows = order.map((c, i) => {
    let t = c.race.done ? c.race.time : null;
    if (!t) { // estimate unfinished cars from their pace
      const prog = (c.race.lap * Race.ncp + c.race.cp) / (Race.laps * Race.ncp);
      t = Race.t / Math.max(0.05, prog) * 1.02;
    }
    return { name: c === Game.player ? 'You' : c.driverName || 'Rival', car: c.spec.name, t, best: c.race.best, me: c === Game.player, pos: i + 1 };
  });
  rows.sort((a, b) => a.t - b.t);
  rows.forEach((r, i) => { r.pos = i + 1; });
  const me = rows.find((r) => r.me);
  const mult = [1, 0.65, 0.45, 0.3, 0.2, 0.15][me.pos - 1] ?? 0.1;
  const credits = Math.round(ev.reward * mult / 50) * 50;
  const xp = Math.round(400 * mult + 100);
  const key = 'ev_' + ev.id;
  const prevBest = Save.data.best[key];
  const newBest = !prevBest || me.t < prevBest;
  if (newBest) Save.data.best[key] = me.t;
  Save.data.credits += credits; Save.data.xp += xp;
  if (me.pos === 1) Save.data.stats.wins++;
  Save.write();
  Race.results = { rows, credits, xp, newBest, ev, pos: me.pos };
  openResults(Race.results);
}

/* ---------- PR stunts + skill chains (free roam) ---------- */
const Skill = { pts: 0, mult: 1, t: 0, gap: 0, chain: false, air: 0, total: 0 };
function updateSkills(dt, car) {
  const v = car.speed;
  const beta = v > 3 ? Math.atan2(Math.abs(car.vLat), Math.max(0.1, car.vLong)) : 0;
  const drifting = !car.air && v > 11 && car.vLong > 2 && beta > 0.24 && beta < 1.45;
  if (drifting) {
    Skill.t += dt; Skill.gap = 0;
    Skill.pts += v * beta * dt * 9;
    const m = 1 + Math.min(7, Math.floor(Skill.t / 1.6));
    if (m > Skill.mult) { Skill.mult = m; SFX.hover(); }
    Skill.chain = true;
  } else if (Skill.chain) {
    Skill.gap += dt;
    if (Skill.gap > 1.1 || beta >= 1.45) {
      const spin = beta >= 1.45 && v > 5;
      if (spin) { notify('Spun out', 'Drift chain lost', 'bad'); }
      else {
        const p = Math.round(Skill.pts * Skill.mult);
        if (p > 150) { notify('DRIFT  +' + p.toLocaleString('en-GB'), Skill.mult > 1 ? `x${Skill.mult} multiplier` : '', 'skill'); Save.data.credits += Math.round(p / 40); Save.data.stats.drift += p; Skill.total += p; }
      }
      Skill.pts = 0; Skill.t = 0; Skill.mult = 1; Skill.chain = false;
    }
  }
  // air time
  if (car.air) Skill.air += dt;
  else if (Skill.air > 0) {
    if (Skill.air > 0.55) { const p = Math.round(Skill.air * 900); notify(`AIR  ${Skill.air.toFixed(1)}s`, '+' + p, 'skill'); Save.data.credits += Math.round(p / 40); }
    Skill.air = 0;
  }
}
function breakChain() {
  if (Skill.chain && Skill.pts > 50) notify('Chain broken', 'Collision', 'bad');
  Skill.pts = 0; Skill.t = 0; Skill.mult = 1; Skill.chain = false;
}
function updateStunts(dt, car) {
  for (const st of Events.stunts) {
    const ev = st.ev;
    const px = car.prevX ?? car.x, pz = car.prevZ ?? car.z;
    const crossed = ev.gates.map((g) => segCross(px, pz, car.x, car.z, g.ax, g.az, g.bx, g.bz));
    if (ev.type === 'trap') {
      if (crossed[0]) {
        const kmh = Math.round(car.speed * 3.6);
        stuntResult(ev, kmh, `${kmh} km/h`);
      }
      continue;
    }
    if (!st.active) {
      const i = crossed.indexOf(true);
      if (i >= 0) { st.active = true; st.from = i; st.t = 0; st.pts = Skill.total + Skill.pts * Skill.mult; st.d = 0; notify(ev.name, ev.type === 'drift' ? 'Drift zone started' : 'Speed zone started', 'zone'); }
    } else {
      st.t += dt; st.d += car.speed * dt;
      const end = crossed[1 - st.from];
      const rq = roadAt(car.x, car.z);
      if ((rq && rq.d > 25) || st.t > 120) { st.active = false; notify(ev.name, 'Left the zone', 'bad'); continue; }
      if (end) {
        st.active = false;
        if (ev.type === 'zone') { const kmh = Math.round(ev.dist / st.t * 3.6); stuntResult(ev, kmh, `${kmh} km/h average`); }
        else { const p = Math.round(Skill.total + Skill.pts * Skill.mult - st.pts); stuntResult(ev, p, `${p.toLocaleString('en-GB')} points`); }
      } else if (crossed[st.from] && st.t > 2) { st.t = 0; st.d = 0; st.pts = Skill.total + Skill.pts * Skill.mult; }
    }
  }
}
function stuntResult(ev, value, label) {
  const stars = ev.stars.filter((s) => value >= s).length;
  const key = 'st_' + ev.id;
  const prev = Save.data.best[key] || 0;
  const pb = value > prev;
  if (pb) Save.data.best[key] = value;
  const reward = stars * 500 + (pb ? 250 : 0);
  Save.data.credits += reward; Save.data.xp += stars * 60;
  Save.write();
  SFX.stunt();
  notify(ev.name, `${label}  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${pb ? '  · NEW RECORD' : ''}${reward ? '  · +' + reward + ' CR' : ''}`, 'stunt', 4200);
}
