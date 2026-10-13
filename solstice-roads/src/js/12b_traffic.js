/* =====================================================================
   Ambient traffic for free roam. Traffic cars are kinematic: they follow
   the road network on the left-hand lane (UK), slow for bends, villages
   and the car ahead, turn at junctions, brake-light when slowing and
   stop for a moment when the player hits them. They are recycled when
   they get far from the player, so only a small pool is ever alive.
   ===================================================================== */
const Traffic = { cars: [], adj: {}, timer: 0, size: 0, visible: true };
const TRAFFIC_PAINT = [0xc0c4c8, 0xf4f4f0, 0x111317, 0x1e3f7a, 0x8c1020, 0x2f5a3a, 0x6d7a86, 0xd9c7a0, 0x3b3f47, 0x9a2f2f];
const TRAFFIC_SPEED = { A: 24, B: 16, M: 12, D: 8.5 };
const TRAFFIC_CARS = ['brisa', 'taiga', 'aurelia', 'marauder', 'ridgeback', 'brisa', 'taiga'];

function roadPoint(road, s, out) {
  s = clamp(s, 0, road.len);
  let lo = 0, hi = road.n - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (road.s[m] <= s) lo = m; else hi = m; }
  const seg = road.s[hi] - road.s[lo] || 1, t = clamp((s - road.s[lo]) / seg, 0, 1);
  out.x = lerp(road.x[lo], road.x[hi], t); out.z = lerp(road.z[lo], road.z[hi], t); out.y = lerp(road.y[lo], road.y[hi], t);
  out.tx = lerp(road.tx[lo], road.tx[hi], t); out.tz = lerp(road.tz[lo], road.tz[hi], t);
  out.grade = (road.y[hi] - road.y[lo]) / seg;
  out.flag = road.flag[lo];
  return out;
}

class TrafficCar {
  constructor(spec, paint) {
    this.spec = spec;
    this.model = makeCar(spec, paint, { lite: true });
    Game.scene.add(this.model.root);
    this.m = spec.mass; this.hw = spec.wid / 2 * 0.96; this.hl = spec.len / 2 * 0.97;
    this.speed = 0; this.pause = 0; this.spin = 0; this.braking = false;
    this.x = 0; this.z = 0; this.y = 0; this.h = 0; this.vx = 0; this.vz = 0;
    this.p = {}; this.q = {};
  }
  place(road, s, dir) {
    this.road = road; this.s = s; this.dir = dir;
    this.speed = TRAFFIC_SPEED[road.type] * 0.8;
    this.pause = 0;
    this.pose();
  }
  pose() {
    const p = roadPoint(this.road, this.s, this.p);
    const tx = p.tx * this.dir, tz = p.tz * this.dir;
    const lane = this.road.type === 'D' ? 1.0 : this.road.hw * 0.46;
    this.x = p.x + tz * lane; this.z = p.z - tx * lane; // left of travel = (tz, -tx)
    this.y = p.y + 0.07;
    this.h = Math.atan2(tx, tz);
    this.grade = p.grade * this.dir;
    this.vx = tx * this.speed; this.vz = tz * this.speed;
  }
  targetSpeed(cars) {
    const road = this.road;
    let v = TRAFFIC_SPEED[road.type];
    const pl = placeName(this.x, this.z);
    if (pl && pl.kind === 'village') v = Math.min(v, 13);
    // slow for bends ahead
    const a = roadPoint(road, this.s, this.p), b = roadPoint(road, this.s + this.dir * 28, this.q);
    const turn = Math.abs(wrapAngle(Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz)));
    if (turn > 0.05) v = Math.min(v, Math.sqrt(4.5 / (turn / 28)));
    // and for anything in front of us in our lane (other traffic, the player, rivals)
    const fx = Math.sin(this.h), fz = Math.cos(this.h);
    for (const o of cars) {
      if (o === this) continue;
      const dx = o.x - this.x, dz = o.z - this.z;
      const ahead = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 32 && lat < 2.6) {
        const ov = Math.max(0, (o.vx || 0) * fx + (o.vz || 0) * fz);
        v = Math.min(v, ahead < 9 ? 0 : ov + (ahead - 9) * 0.6);
      }
    }
    return v;
  }
  update(dt, cars) {
    if (this.pause > 0) { this.pause -= dt; this.speed = Math.max(0, this.speed - 12 * dt); }
    else {
      const vt = this.targetSpeed(cars);
      const prev = this.speed;
      this.speed = vt > this.speed ? Math.min(vt, this.speed + 2.6 * dt) : Math.max(vt, this.speed - 7 * dt);
      this.braking = this.speed < prev - 0.5 * dt;
    }
    this.s += this.dir * this.speed * dt;
    if (this.s < 0 || this.s > this.road.len) this.turnAtJunction();
    this.pose();
  }
  turnAtJunction() {
    const node = this.dir > 0 ? this.road.def.b : this.road.def.a;
    const options = (Traffic.adj[node] || []).filter((r) => r !== this.road);
    if (!options.length || Math.hypot(NODES[node][0] - PLAZA.x, NODES[node][1] - PLAZA.z) < PLAZA.r + 5) { this.respawn(); return; }
    const next = options[(Math.random() * options.length) | 0];
    const fromA = next.def.a === node;
    this.road = next; this.dir = fromA ? 1 : -1; this.s = fromA ? 0.5 : next.len - 0.5;
  }
  respawn() {
    const p = Game.player;
    for (let tries = 0; tries < 40; tries++) {
      const road = World.roads[(Math.random() * World.roads.length) | 0];
      if (road.type === 'D' && Math.random() < 0.7) continue;
      const s = 20 + Math.random() * Math.max(1, road.len - 40);
      const pt = roadPoint(road, s, this.p);
      const d = Math.hypot(pt.x - p.x, pt.z - p.z);
      if (d < 160 || d > 620) continue;
      // keep a gap to other traffic
      if (Traffic.cars.some((c) => c !== this && Math.hypot(c.x - pt.x, c.z - pt.z) < 40)) continue;
      this.place(road, s, Math.random() < 0.5 ? 1 : -1);
      return;
    }
    const road = World.roads[0];
    this.place(road, road.len / 2, 1);
  }
  sync(dt) {
    const m = this.model, r = m.root;
    r.position.set(this.x, this.y, this.z);
    r.rotation.set(-Math.atan(this.grade), this.h, 0, 'YXZ');
    this.spin += this.speed / this.spec.tyreR * dt;
    for (const w of m.wheels) w.spin.rotation.x = this.spin;
    m.brake.emissiveIntensity = this.braking || this.speed < 0.5 ? 4 : 0.4 + Sky.night * 0.9;
    m.head.emissiveIntensity = 0.5 + Sky.night * 3;
    for (const lm of m.lampMats) lm.emissiveIntensity = 0.3 + Sky.night * 2.2;
  }
}

function initTraffic() {
  for (const r of World.roads) { (Traffic.adj[r.def.a] ||= []).push(r); (Traffic.adj[r.def.b] ||= []).push(r); }
}
function setTrafficSize(n) {
  while (Traffic.cars.length > n) { const c = Traffic.cars.pop(); Game.scene.remove(c.model.root); c.model.dispose(); }
  while (Traffic.cars.length < n) {
    const i = Traffic.cars.length;
    const spec = CARS.find((c) => c.id === TRAFFIC_CARS[i % TRAFFIC_CARS.length]);
    const c = new TrafficCar(spec, TRAFFIC_PAINT[(i * 7 + 3) % TRAFFIC_PAINT.length]);
    Traffic.cars.push(c);
    c.respawn();
  }
  Traffic.size = n;
}
function updateTraffic(dt, player, camPos) {
  const on = !Race.ev;
  if (on !== Traffic.visible) { Traffic.visible = on; for (const c of Traffic.cars) c.model.root.visible = on; }
  if (!on) return;
  const others = [player, ...Traffic.cars];
  Traffic.timer -= dt;
  const check = Traffic.timer <= 0;
  if (check) Traffic.timer = 0.5;
  for (const c of Traffic.cars) {
    c.update(dt, others);
    const d = Math.hypot(c.x - camPos.x, c.z - camPos.z);
    if (check && d > 700) c.respawn();
    c.model.root.visible = d < 420;
    if (c.model.root.visible) c.sync(dt);
  }
}
/* Player vs traffic: the player bounces, the traffic car stops briefly. */
function collideTraffic(player) {
  if (Race.ev) return;
  for (const c of Traffic.cars) {
    const dx = c.x - player.x, dz = c.z - player.z;
    if (dx * dx + dz * dz > 49 || Math.abs(c.y - player.y) > 3) continue;
    const r = boxVsCollider(player.x, player.z, player.h, player.hw, player.hl, { t: 1, x: c.x, z: c.z, hx: c.hw, hz: c.hl, c: Math.cos(c.h), s: Math.sin(c.h) });
    if (!r) continue;
    const nx = r.n[0], nz = r.n[1];
    player.x += nx * r.d; player.z += nz * r.d;
    const vrel = (player.vx - c.vx) * nx + (player.vz - c.vz) * nz;
    if (vrel < 0) {
      const k = c.m / (c.m + player.m);
      player.vx -= nx * vrel * (1.25 * k + 0.1); player.vz -= nz * vrel * (1.25 * k + 0.1);
      player.w += (Math.random() - 0.5) * -vrel * 0.25;
      c.pause = 3.5;
      c.speed *= 0.3;
      if (-vrel > 2) Bus.emit('hit', { car: player, v: -vrel });
    }
  }
}
