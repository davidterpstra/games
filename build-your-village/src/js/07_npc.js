/* =====================================================================
   NPC SERVICE (server) — villagers that actually live in the village.
   Daily schedule: sleep at home, breakfast, work, lunch at the bakery,
   evening shopping / square / tavern / benches, chatting, reacting.
   Movement uses A* over a 2-unit nav grid that prefers roads.
   ===================================================================== */

/* ---------------- navigation grid ---------------- */
const Nav = {
  CS: 2, N: 200, OFF: 200,
  walk: null, bld: null, road: null, area: null,
  g: null, f: null, came: null, stamp: null, closed: null, sid: 1,
  init() {
    const N = this.N, T = N * N;
    this.walk = new Uint8Array(T); this.bld = new Uint16Array(T); this.road = new Uint16Array(T); this.area = new Uint8Array(T);
    this.g = new Float32Array(T); this.came = new Int32Array(T); this.stamp = new Uint32Array(T); this.closed = new Uint32Array(T);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -this.OFF + i * this.CS + 1, z = -this.OFF + j * this.CS + 1, k = j * N + i;
      this.area[k] = areaIdxAt(x, z);
      const onBridge = World.bridgeAt(x, z) != null;
      const gy = World.groundY(x, z);
      if (!onBridge && gy < -0.3) { this.walk[k] = 0; continue; }
      if (World.blockedStatic(x, z, 0.3)) { this.walk[k] = 0; continue; }
      const sl = World.slopeAt(x, z);
      if (!onBridge && sl > 1.15) { this.walk[k] = 0; continue; }
      this.walk[k] = onBridge || World.onRoad(x, z) ? 1 : sl > 0.6 ? 3 : 2;
    }
    for (const c of CAVES) this.stampCircle(c.x, c.z, 11, 0);
  },
  stampCircle(x, z, r, val) {
    for (let j = 0; j < this.N; j++) for (let i = 0; i < this.N; i++) {
      const cx = -this.OFF + i * this.CS + 1, cz = -this.OFF + j * this.CS + 1;
      if (Math.hypot(cx - x, cz - z) < r) { const k = j * this.N + i; if (this.walk[k]) this.walk[k] = 3; }
    }
  },
  cell(x, z) { const i = Math.floor((x + this.OFF) / this.CS), j = Math.floor((z + this.OFF) / this.CS); if (i < 0 || j < 0 || i >= this.N || j >= this.N) return -1; return j * this.N + i; },
  center(k) { return [-this.OFF + (k % this.N) * this.CS + 1, -this.OFF + Math.floor(k / this.N) * this.CS + 1]; },
  stampBuilding(b, d) {
    const cfg = BUILDINGS[b.type];
    const r = BuildingService.rect(b.type, b.x, b.z, b.rot);
    const arr = cfg.road ? this.road : this.bld;
    const pad = cfg.road ? 0.2 : -0.35;
    for (let z = r.z0 - pad; z < r.z1 + pad; z += 1) for (let x = r.x0 - pad; x < r.x1 + pad; x += 1) {
      const k = this.cell(x + 0.5, z + 0.5); if (k < 0) continue;
      arr[k] = Math.max(0, arr[k] + d);
    }
  },
  cost(k) {
    if (this.walk[k] === 0 || this.bld[k] > 0) return 0;
    if (!Village.isUnlockedIdx(this.area[k])) return 0;
    if (this.road[k] > 0 || this.walk[k] === 1) return 1;
    return this.walk[k] === 3 ? 4 : 2.3;
  },
  nearestOpen(k, maxR = 7) {
    if (k < 0) return -1;
    if (this.cost(k) > 0) return k;
    const i0 = k % this.N, j0 = Math.floor(k / this.N);
    for (let r = 1; r <= maxR; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= this.N || j >= this.N) continue;
      const q = j * this.N + i; if (this.cost(q) > 0) return q;
    }
    return -1;
  },
  heap: [],
  find(sx, sz, tx, tz) {
    const N = this.N;
    const s = this.nearestOpen(this.cell(sx, sz), 5), t = this.nearestOpen(this.cell(tx, tz), 8);
    if (s < 0 || t < 0) return null;
    if (s === t) return [[tx, tz]];
    const sid = ++this.sid;
    const ti = t % N, tj = Math.floor(t / N);
    const H = (k) => { const dx = Math.abs(k % N - ti), dz = Math.abs(Math.floor(k / N) - tj); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * 1.0; };
    const heap = this.heap; heap.length = 0;
    const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    this.stamp[s] = sid; this.g[s] = 0; this.came[s] = -1; push(s, H(s));
    let it = 0, found = false;
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length && it++ < 22000) {
      const [, k] = pop();
      if (this.closed[k] === sid) continue;
      this.closed[k] = sid;
      if (k === t) { found = true; break; }
      const i = k % N, j = Math.floor(k / N);
      for (const [di, dj, dc] of D) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const q = nj * N + ni;
        const c = this.cost(q); if (c === 0) continue;
        if (di && dj && (this.cost(j * N + ni) === 0 || this.cost(nj * N + i) === 0)) continue;
        const ng = this.g[k] + c * dc;
        if (this.stamp[q] !== sid || ng < this.g[q]) {
          if (this.closed[q] === sid) continue;
          this.stamp[q] = sid; this.g[q] = ng; this.came[q] = k; push(q, ng + H(q));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = t; k !== -1; k = this.came[k]) cells.push(k);
    cells.reverse();
    // line-of-sight smoothing, only across cheap cells so roads stay preferred
    const out = [];
    let a = 0;
    while (a < cells.length - 1) {
      let b = Math.min(cells.length - 1, a + 10);
      while (b > a + 1 && !this.los(cells[a], cells[b])) b--;
      out.push(this.center(cells[b]));
      a = b;
    }
    const last = out[out.length - 1];
    if (last && Math.hypot(last[0] - tx, last[1] - tz) < 3.5 && this.cost(this.cell(tx, tz)) > 0) out[out.length - 1] = [tx, tz];
    return out;
  },
  los(a, b) {
    const N = this.N;
    let x0 = a % N, y0 = Math.floor(a / N); const x1 = b % N, y1 = Math.floor(b / N);
    const c0 = this.cost(a);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      const c = this.cost(y0 * N + x0);
      if (c === 0 || c > Math.max(c0, 1) + 0.01) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  },
};

/* ---------------- NPC service ---------------- */
const THOUGHTS = {
  hungry: ['My tummy is rumbling...', 'We really need more food.', 'Is there any bread left?'],
  jobless: ['I wish I had a job.', 'Maybe a new workshop will open soon?'],
  happy: ['What a lovely village!', 'I love living here.', 'Such a beautiful day.', 'Our village keeps growing!'],
  meh: ['It could use a few more flowers.', 'Some shops would be nice.', 'A tavern would cheer us up!'],
  night: ['Time for bed soon.', 'The lanterns look so cozy.'],
  newB: (n) => [`Have you seen the new ${n}?`, `A ${n}! How exciting!`, `The ${n} looks wonderful.`],
};
const CHAT_EMOTES = ['😊', '💬', '😄', '☀️', '🌻', '🍞', '👋', '😂', '🏡', '🎶'];

function scheduleBlock(h) {
  if (h >= 22 || h < 6) return 'sleep';
  if (h < 7.5) return 'morning';
  if (h < 12) return 'work';
  if (h < 13) return 'lunch';
  if (h < 17.5) return 'work';
  return 'evening';
}

const NPCService = {
  rt: new Map(), // npc id -> runtime
  cand: null, chatT: 0, newBuilding: null,
  lookFor(npc) {
    const P = PROFS[npc.prof] || PROFS.villager;
    const L = npc.look || {};
    const fest = EventService.is('festival');
    return {
      shirt: P.shirt, pants: PANTS_COLORS[(L.pants | 0) % PANTS_COLORS.length], skin: SKIN_TONES[(L.skin | 0) % SKIN_TONES.length], hair: HAIR_COLORS[(L.hair | 0) % HAIR_COLORS.length],
      hat: fest ? 10 : P.hat, hatCol: fest ? [0xef6f6c, 0xffd166, 0x6fc3df, 0x9b7fe6][npc.id % 4] : (P.hatCol || 0xffffff),
    };
  },
  randomLook() { return { skin: randInt(0, SKIN_TONES.length - 1), hair: randInt(0, HAIR_COLORS.length - 1), pants: randInt(0, PANTS_COLORS.length - 1) }; },
  uniqueName() {
    const firsts = new Set(S.npcs.map((n) => n.name.split(' ')[0]));
    const free = FIRST_NAMES.filter((f) => !firsts.has(f));
    for (let i = 0; i < 40; i++) {
      const n = pick(free.length ? free : FIRST_NAMES) + ' ' + pick(LAST_NAMES);
      if (!S.usedNames.includes(n)) { S.usedNames.push(n); if (S.usedNames.length > 180) S.usedNames.shift(); return n; }
    }
    return pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES);
  },
  init() {
    Nav.init();
    for (const b of S.buildings) Nav.stampBuilding(b, 1);
    for (const n of S.npcs) this.spawnRuntime(n);
    if (S.candidate) this.spawnCandidate(S.candidate);
  },
  spawnRuntime(n, at) {
    const home = BuildingService.byId(n.home);
    let x, z;
    if (at) { x = at.x; z = at.z; } else if (home) { const d = BuildingService.door(home); x = d.x + randRange(-1, 1); z = d.z + randRange(-1, 1); } else { x = START.board[0] + randRange(-3, 3); z = START.board[1] + randRange(-3, 3); }
    const ent = Chars.spawn(this.lookFor(n), x, z);
    if (!ent) return null;
    ent.name = n.name.split(' ')[0];
    const r = { n, ent, state: 'idle', path: null, pi: 0, goal: null, until: 0, thinkT: Math.random(), inB: null, speed: 2.9 + Math.random() * 0.5, stuck: 0 };
    this.rt.set(n.id, r);
    if (home && Clock.isNight() && !at) { r.state = 'inside'; r.inB = home.id; ent.hidden = true; }
    return r;
  },
  refreshLooks() { for (const r of this.rt.values()) Chars.setLook(r.ent, this.lookFor(r.n)); },
  writeBack() { /* NPC data lives in S.npcs; runtime is rebuilt from homes on load */ },

  /* ----- arrivals ----- */
  entryPoint() {
    const road = World.roads[1].pts; // the north-south road
    let best = [START.sign[0] - 2, START.sign[1] + 5];
    for (const p of road) if (p[1] > 20 && p[1] < 150 && Village.isUnlockedAt(p[0], p[1] + 4)) best = [p[0] + 1.2, p[1]];
    return best;
  },
  spawnCandidate(saved) {
    const c = saved || { id: S.nextNpc++, name: this.uniqueName(), look: this.randomLook() };
    S.candidate = c;
    const n = { id: c.id, name: c.name, prof: 'villager', look: c.look, candidate: true, hunger: 10, happy: 80, money: 30 };
    const [x, z] = this.entryPoint();
    const r = this.spawnRuntime(n, { x, z });
    if (!r) return;
    r.cand = true; r.waitT = 0;
    this.cand = r;
    this.goTo(r, START.board[0] + 2.5, START.board[1] + 2.5, 'arrive');
    r.ent.bubble = { text: '👋', t: 4 };
    if (!saved) Bus.emit('candidate', { name: c.name });
  },
  welcome() {
    const c = S.candidate, r = this.cand;
    if (!c || !r) return fail('Nobody is waiting to move in');
    const home = BuildingService.freeHome();
    if (!home) return fail('There is no free home. Build a house first!');
    const n = { id: c.id, name: c.name, prof: 'villager', home: home.id, work: null, hunger: 15, happy: 75, money: 30, look: c.look, joined: S.time.day, req: null };
    S.npcs.push(n);
    S.candidate = null; this.cand = null;
    this.rt.delete(c.id);
    r.n = n; r.cand = false; r.ent.alert = null;
    this.rt.set(n.id, r);
    S.stats.welcomed++;
    BuildingService.assignJobs();
    Chars.setLook(r.ent, this.lookFor(n));
    r.ent.bubble = { text: '😊 Thank you!', t: 3.5, big: true };
    r.state = 'idle'; r.until = S.playTime + 3.5; r.ent.anim.act = 2; r.ent.anim.aph = 0;
    Village.addXP(40, 'welcome', new THREE.Vector3(r.ent.x, r.ent.y + 2.5, r.ent.z));
    Bus.emit('npc:welcomed', { npc: n, home });
    Village.arriveT = lerp(75, 18, Village.happiness() / 100);
    QuestService.check();
    DataService.save('welcome');
    return { ok: true };
  },

  /* ----- movement ----- */
  goTo(r, x, z, goal, data = null) {
    const p = Nav.find(r.ent.x, r.ent.z, x, z);
    r.path = p && p.length ? p : [[x, z]];
    // final approach: spots behind counters / on benches sit inside a footprint the grid treats as solid
    const last = r.path[r.path.length - 1];
    if (Math.hypot(last[0] - x, last[1] - z) > 0.3 && Math.hypot(last[0] - x, last[1] - z) < 6) r.path.push([x, z]);
    r.pi = 0; r.goal = goal; r.data = data; r.state = 'walk'; r.stuck = 0;
    r.ent.hidden = false; r.inB = null; r.ent.anim.act = 0;
    r.target = [x, z];
  },
  move(r, dt) {
    const e = r.ent;
    const p = r.path[r.pi];
    if (!p) { this.arrive(r); return; }
    const dx = p[0] - e.x, dz = p[1] - e.z, d = Math.hypot(dx, dz);
    const onRoad = Nav.cost(Nav.cell(e.x, e.z)) === 1;
    const sp = r.speed * (onRoad ? 1.25 : 1) * (r.run ? 1.9 : 1) * (EventService.is('rain') ? 1.2 : 1);
    if (d < 0.35) { r.pi++; if (r.pi >= r.path.length) this.arrive(r); return; }
    const st = Math.min(d, sp * dt);
    e.x += (dx / d) * st; e.z += (dz / d) * st;
    const ty = Math.atan2(dx, dz);
    let dy = ty - e.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
    e.yaw += dy * Math.min(1, dt * 8);
    e.y = World.heightAt(e.x, e.z);
    Chars.animate(e, sp, dt);
  },
  arrive(r) {
    const e = r.ent, t = S.playTime, g = r.goal;
    r.state = 'idle'; r.path = null; r.goal = null; r.run = false;
    e.anim.amt = 0;
    switch (g) {
      case 'arrive': r.state = 'wait'; e.alert = '👋 New resident!'; e.yaw = Math.atan2(Player.x - e.x, Player.z - e.z); break;
      case 'home': {
        const b = BuildingService.byId(r.n.home);
        if (b) this.enter(r, b, t + 8);
        if (r.n.hunger > 35) this.eat(r);
        break;
      }
      case 'work': {
        const b = BuildingService.byId(r.n.work);
        if (!b) break;
        const cfg = BUILDINGS[b.type];
        if (cfg.work === 'inside') this.enter(r, b, t + 25);
        else { r.state = 'work'; r.workB = b.id; e.yaw = r.data ? r.data.yaw : e.yaw; e.anim.act = r.data ? r.data.act : 4; e.anim.aph = Math.random() * 6; r.until = t + 20; }
        break;
      }
      case 'shop': case 'eat': case 'tavern': {
        const b = BuildingService.byId(r.data && r.data.b);
        if (b) { this.enter(r, b, t + randRange(6, 11)); r.after = g; } break;
      }
      case 'square': r.until = t + randRange(12, 26); e.yaw = Math.random() * TAU; break;
      case 'sit': { r.state = 'sit'; e.anim.act = 3; if (r.data) { e.x = r.data.x; e.z = r.data.z; e.yaw = r.data.yaw; } r.until = t + randRange(14, 26); break; }
      case 'build': r.state = 'work'; r.workB = null; e.anim.act = 4; if (r.data) e.yaw = Math.atan2(r.data.x - e.x, r.data.z - e.z); r.until = t + 9; break;
      case 'visitor': break;
      case 'leave': r.gone = true; break;
      default: r.until = t + randRange(3, 8);
    }
  },
  enter(r, b, until) { r.state = 'inside'; r.inB = b.id; r.ent.hidden = true; r.until = until; const d = BuildingService.door(b); r.ent.x = d.x; r.ent.z = d.z; },
  exit(r) {
    const b = BuildingService.byId(r.inB);
    r.ent.hidden = false; r.state = 'idle';
    if (b) {
      const d = BuildingService.door(b); r.ent.x = d.x + randRange(-0.6, 0.6); r.ent.z = d.z + randRange(-0.6, 0.6); r.ent.y = World.heightAt(r.ent.x, r.ent.z);
      if (r.after === 'shop' || r.after === 'eat' || r.after === 'tavern') this.purchase(r, b, r.after);
    }
    r.after = null; r.inB = null;
  },
  eat(r) {
    if (S.res.food >= 1) { S.res.food -= 1; r.n.hunger = Math.max(0, r.n.hunger - 45); Bus.emit('res', {}); return true; }
    r.ent.bubble = { text: '🍞❓', t: 3 }; r.n.happy = Math.max(0, r.n.happy - 5);
    return false;
  },
  purchase(r, b, kind) {
    const fest = EventService.is('festival') ? 2 : 1;
    const pos = new THREE.Vector3(b.x, (b.y || 0) + Models.get(b.type).height + 0.6, b.z);
    let spend = Math.min(r.n.money, randInt(4, 11)) * fest;
    if (kind === 'eat' || (kind === 'shop' && ['bakery', 'market_stall', 'marketplace', 'large_market', 'tavern'].includes(b.type))) {
      if (!this.eat(r)) spend = Math.floor(spend / 3);
    }
    if (kind === 'tavern') { spend += 4; r.n.happy = Math.min(100, r.n.happy + 6); }
    if (spend > 0) { r.n.money -= Math.min(r.n.money, spend / fest); Economy.add('coins', Math.round(spend), 'shop', pos); }
    r.ent.bubble = { text: pick(['😋', '🛍️', '😊', '👍']), t: 2.2 };
  },

  /* ----- decision making ----- */
  plazaSpot() {
    const order = ['town_square', 'marketplace', 'fountain', 'large_market', 'well'];
    for (const t of order) {
      const bs = S.buildings.filter((b) => b.type === t);
      if (bs.length) { const b = pick(bs); const [W, D] = BuildingService.dims(b.type, b.rot); const a = Math.random() * TAU, rr = Math.max(W, D) / 2 + (t === 'town_square' || t === 'marketplace' ? -3 : 1.6); return [b.x + Math.cos(a) * rr, b.z + Math.sin(a) * rr]; }
    }
    const a = Math.random() * TAU; return [START.board[0] + Math.cos(a) * 5, START.board[1] + Math.sin(a) * 5];
  },
  shopBuildings() { return S.buildings.filter((b) => isActive(b) && (BUILDINGS[b.type].shop || b.type === 'tavern' || b.type === 'inn')); },
  foodShop(r) {
    const list = S.buildings.filter((b) => isActive(b) && ['bakery', 'market_stall', 'marketplace', 'large_market', 'tavern'].includes(b.type));
    let best = null, bd = 1e9; for (const b of list) { const d = Math.hypot(b.x - r.ent.x, b.z - r.ent.z); if (d < bd) { bd = d; best = b; } }
    return best;
  },
  goHome(r) { const b = BuildingService.byId(r.n.home); if (!b) return this.wander(r); const d = BuildingService.door(b); this.goTo(r, d.x, d.z, 'home'); },
  goWork(r) {
    const b = BuildingService.byId(r.n.work); if (!b) return this.leisure(r, 'work');
    const cfg = BUILDINGS[b.type];
    const meta = MODEL_META[b.type] || {};
    if ((cfg.work === 'outside' || cfg.work === 'counter') && meta.work && meta.work.length) {
      const idx = Village.workersOf(b.id).indexOf(r.n) % meta.work.length;
      const w = meta.work[Math.max(0, idx)];
      const [x, z] = BuildingService.toWorld(b, w[0], w[1]);
      return this.goTo(r, x, z, 'work', { yaw: w[2] + b.rot * Math.PI / 2, act: w[3] });
    }
    const d = BuildingService.door(b); this.goTo(r, d.x, d.z, 'work', { yaw: 0, act: 4 });
  },
  visit(r, b, kind) { const d = BuildingService.door(b); this.goTo(r, d.x, d.z, kind, { b: b.id }); },
  wander(r) {
    const home = BuildingService.byId(r.n.home);
    const cx = home ? home.x : 0, cz = home ? home.z : 0;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU, d = randRange(6, 22), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Village.isUnlockedAt(x, z) && Nav.cost(Nav.cell(x, z)) > 0) return this.goTo(r, x, z, 'wander');
    }
    r.until = S.playTime + 4;
  },
  leisure(r, blk) {
    const opts = [];
    const fest = EventService.is('festival');
    const shops = this.shopBuildings();
    if (shops.length && r.n.money > 6 && Clock.shopsOpen()) opts.push(['shop', 3]);
    opts.push(['square', fest ? 14 : 3]);
    const tav = S.buildings.filter((b) => b.type === 'tavern');
    if (tav.length && blk === 'evening') opts.push(['tavern', 3]);
    const benches = S.buildings.filter((b) => b.type === 'bench' || b.type === 'town_square');
    if (benches.length) opts.push(['sit', 2]);
    opts.push(['wander', 3]);
    if (blk === 'evening' && S.time.hour > 19.5) opts.push(['home', 5]);
    let tot = opts.reduce((s, o) => s + o[1], 0), k = Math.random() * tot, choice = 'wander';
    for (const [o, w] of opts) { k -= w; if (k <= 0) { choice = o; break; } }
    switch (choice) {
      case 'shop': return this.visit(r, pick(shops), 'shop');
      case 'tavern': return this.visit(r, pick(tav), 'tavern');
      case 'square': { const [x, z] = this.plazaSpot(); return this.goTo(r, x, z, 'square'); }
      case 'sit': {
        const b = pick(benches);
        if (b.type === 'bench') { const [x, z] = BuildingService.toWorld(b, 0, 0.15); return this.goTo(r, x, z, 'sit', { x, z, yaw: b.rot * Math.PI / 2 }); }
        const [x, z] = BuildingService.toWorld(b, pick([-4.6, 4.6]), 0); return this.goTo(r, x, z, 'square');
      }
      case 'home': return this.goHome(r);
      default: return this.wander(r);
    }
  },
  think(r) {
    const t = S.playTime, e = r.ent;
    if (r.cand) {
      if (r.state === 'wait') { r.waitT += 0.6; e.yaw = Math.atan2(Player.x - e.x, Player.z - e.z); if (r.waitT > 150 && BuildingService.freeHome()) this.welcome(); }
      return;
    }
    if (r.state === 'walk' || r.state === 'chat' || r.leaving) return;
    const blk = scheduleBlock(S.time.hour);
    // danger: run home
    if (r.flee) { r.flee = false; r.run = true; e.bubble = { text: '😱', t: 2 }; r.site = null; return this.goHome(r); }
    // helping on a construction site in a build zone
    if (r.site) {
      const sb = BuildingService.byId(r.site);
      const busy = r.n.work && r.n.prof !== 'builder' && (blk === 'work' || blk === 'lunch');
      if (!sb || !(sb.build > 0) || blk === 'sleep' || busy) r.site = null;
      else if (r.state === 'work') { r.until = t + 6; e.anim.act = 4; e.yaw = Math.atan2(sb.x - e.x, sb.z - e.z); return; }
      else r.site = null;
    }
    if (blk === 'sleep' || (EventService.is('rain') && blk === 'evening')) {
      if (!(r.state === 'inside' && r.inB === r.n.home)) { if (r.state === 'inside') this.exit(r); return this.goHome(r); }
      if (blk === 'sleep' && Math.random() < 0.15) { const b = BuildingService.byId(r.n.home); if (b) { e.bubble = { text: '💤', t: 3 }; } }
      return;
    }
    if (r.until > t) return;
    if (r.state === 'inside') {
      if (r.inB === r.n.work && (blk === 'work' || blk === 'lunch' && r.n.hunger < 45)) { r.until = t + 12; return; }
      this.exit(r);
    }
    if (r.state === 'sit' || r.state === 'work') e.anim.act = 0;
    if (blk === 'morning' && r.breakfast !== S.time.day) { r.breakfast = S.time.day; this.eat(r); }
    if ((blk === 'work' || blk === 'lunch') && r.n.work) {
      if (blk === 'lunch' && r.n.hunger > 45 && r.lunch !== S.time.day) { r.lunch = S.time.day; const s = this.foodShop(r); if (s) return this.visit(r, s, 'eat'); }
      if (r.state === 'work' && r.workB === r.n.work) { r.until = t + 15; e.anim.act = this.workAct(r); return; }
      return this.goWork(r);
    }
    this.leisure(r, blk);
  },
  workAct(r) { const b = BuildingService.byId(r.n.work); const m = b && MODEL_META[b.type]; const w = m && m.work && m.work[0]; return w ? w[3] : 4; },

  /* ----- reactions & social ----- */
  onBuildingsChanged(b) {
    if (b) {
      const name = BUILDINGS[b.type].name;
      if (!BUILDINGS[b.type].road) {
        let helpers = 0;
        for (const r of this.rt.values()) {
          if (r.cand) continue;
          const e = r.ent, d = Math.hypot(e.x - b.x, e.z - b.z);
          if (d < 32 && !e.hidden) { e.bubble = { text: pick(['😮', '✨', '🤩', '👏']), t: 2.5 }; r.n.happy = Math.min(100, r.n.happy + 3); r.thought = pick(THOUGHTS.newB(name)); }
          if (helpers < 2 && d < 60 && !e.hidden && r.state !== 'walk' && r.state !== 'work' && scheduleBlock(S.time.hour) !== 'sleep') {
            helpers++;
            const a = Math.random() * TAU, [W, D] = BuildingService.dims(b.type, b.rot), rr = Math.max(W, D) / 2 + 1.2;
            this.goTo(r, b.x + Math.cos(a) * rr, b.z + Math.sin(a) * rr, 'build', { x: b.x, z: b.z });
          }
        }
        this.newBuilding = { name, day: S.time.day };
      }
    }
    this.rebuildNav();
  },
  rebuildNav() {
    Nav.bld.fill(0); Nav.road.fill(0);
    for (const q of S.buildings) Nav.stampBuilding(q, 1);
  },
  onBuildingRemoved(b) {
    for (const n of S.npcs) {
      if (n.work === b.id) { n.work = null; n.prof = 'villager'; const r = this.rt.get(n.id); if (r) { Chars.setLook(r.ent, this.lookFor(n)); if (r.inB === b.id) this.exit(r); r.state = 'idle'; r.until = 0; } }
      if (n.home === b.id) {
        const nh = BuildingService.freeHome();
        const r = this.rt.get(n.id);
        if (r && r.inB === b.id) this.exit(r);
        if (nh) n.home = nh.id;
        else { this.leave(n, 'had no home'); }
      }
    }
  },
  leave(n, why) {
    S.npcs = S.npcs.filter((q) => q !== n);
    const r = this.rt.get(n.id);
    if (r) { r.leaving = true; r.cand = false; const [x, z] = this.entryPoint(); this.goTo(r, x, z + 8, 'leave'); r.ent.bubble = { text: '😢', t: 4 }; }
    Bus.emit('toast', { icon: '😢', title: n.name + ' left the village', text: 'They ' + why + '.' });
  },
  onLandChanged() { /* nav cost reads area unlock state live */ },
  onSleep() {
    for (const r of this.rt.values()) {
      if (r.cand) continue;
      const b = BuildingService.byId(r.n.home);
      if (b) { this.enter(r, b, S.playTime + randRange(2, 12)); r.path = null; }
      r.n.hunger = Math.min(100, r.n.hunger + 10);
    }
  },
  onNewDay() {
    // villagers sometimes ask for help
    const active = S.npcs.filter((n) => n.req).length;
    for (const n of S.npcs) if (n.req && n.req.until < S.time.day) { n.req = null; const r = this.rt.get(n.id); if (r) r.ent.alert = null; }
    if (S.npcs.length >= 2 && active < 2 && Math.random() < 0.65) {
      const cands = S.npcs.filter((n) => !n.req);
      if (cands.length) {
        const n = pick(cands);
        const keys = ['wood', 'stone', 'food'].concat(S.level >= 5 ? ['wheat'] : []).concat(S.level >= 8 ? ['iron'] : []);
        const k = pick(keys);
        n.req = { k, n: Math.round((k === 'iron' ? 4 : 10) + S.level * (k === 'iron' ? 1 : 2.5)), until: S.time.day + 2 };
        Bus.emit('npc:request', { npc: n });
      }
    }
  },
  help(id) {
    const n = S.npcs.find((q) => q.id === id);
    if (!n || !n.req) return fail('They don\'t need anything right now');
    const r = this.rt.get(n.id);
    if (r && Math.hypot(r.ent.x - Player.x, r.ent.z - Player.z) > 8) return fail('Walk up to them first');
    const cost = { [n.req.k]: n.req.n };
    if (!Economy.spend(cost)) return fail('You need ' + n.req.n + ' ' + ITEMS[n.req.k].name.toLowerCase());
    const coins = Math.round(n.req.n * (ITEMS[n.req.k].buy || 4) * 0.9 + 10);
    const pos = r ? new THREE.Vector3(r.ent.x, r.ent.y + 2.4, r.ent.z) : null;
    Economy.add('coins', coins, 'help', pos);
    Village.addXP(30 + S.level * 3, 'help', pos);
    n.req = null; n.happy = Math.min(100, n.happy + 20);
    S.stats.helped++;
    if (r) { r.ent.alert = null; r.ent.bubble = { text: '💖 Thank you!', t: 3, big: true }; r.ent.anim.act = 2; r.until = S.playTime + 3; r.state = 'idle'; }
    QuestService.check();
    return { ok: true, coins };
  },
  thoughtOf(n) {
    const r = this.rt.get(n.id);
    if (n.req) return `Could you spare ${n.req.n} ${ITEMS[n.req.k].name.toLowerCase()}? I'd pay you back!`;
    if (n.hunger > 70) return pick(THOUGHTS.hungry);
    if (!n.work) return pick(THOUGHTS.jobless);
    if (r && r.thought && Math.random() < 0.6) return r.thought;
    if (Clock.isNight()) return pick(THOUGHTS.night);
    return Village.happiness() > 65 ? pick(THOUGHTS.happy) : pick(THOUGHTS.meh);
  },
  activityOf(n) {
    const r = this.rt.get(n.id); if (!r) return '';
    const b = BuildingService.byId(r.inB);
    if (r.state === 'inside') return b ? (b.id === n.home ? (scheduleBlock(S.time.hour) === 'sleep' ? 'Sleeping' : 'At home') : b.id === n.work ? 'Working' : 'Visiting the ' + BUILDINGS[b.type].name) : 'Indoors';
    if (r.state === 'work') return r.goal === 'build' || !r.workB ? 'Helping with construction' : 'Working';
    if (r.state === 'walk') return { home: 'Going home', work: 'Going to work', shop: 'Going shopping', eat: 'Getting food', tavern: 'Off to the tavern', square: 'Heading to the square', sit: 'Looking for a bench', build: 'Going to help build', wander: 'Taking a walk' }[r.goal] || 'Walking';
    if (r.state === 'chat') return 'Chatting';
    if (r.state === 'sit') return 'Resting on a bench';
    return 'Relaxing';
  },
  /* chatting: two idle villagers close together stop for a chat */
  chats() {
    const idle = [];
    for (const r of this.rt.values()) if (!r.cand && !r.ent.hidden && (r.state === 'idle' || (r.state === 'walk' && ['wander', 'square'].includes(r.goal)))) idle.push(r);
    for (let i = 0; i < idle.length; i++) for (let j = i + 1; j < idle.length; j++) {
      const a = idle[i], b = idle[j];
      if (a.state === 'chat' || b.state === 'chat') continue;
      if (Math.hypot(a.ent.x - b.ent.x, a.ent.z - b.ent.z) > 3.2 || Math.random() > 0.35) continue;
      const dur = randRange(4, 7);
      for (const [p, q] of [[a, b], [b, a]]) {
        p.state = 'chat'; p.path = null; p.chatEnd = S.playTime + dur; p.ent.anim.amt = 0; p.ent.anim.act = 5;
        p.ent.yaw = Math.atan2(q.ent.x - p.ent.x, q.ent.z - p.ent.z);
      }
      const topic = this.chatTopic();
      a.ent.bubble = { text: topic[0], t: 2.2 }; b.ent.bubble = { text: topic[1], t: 2.2, delay: 2.3 };
      b.pendingBubble = { text: topic[1], at: S.playTime + 2.3 };
    }
  },
  chatTopic() {
    if (EventService.is('festival')) return ['🎉', '🥳'];
    if (EventService.is('rain')) return ['🌧️', '☔'];
    if (EventService.is('wolves')) return ['🐺!', '😨'];
    if (this.newBuilding && this.newBuilding.day >= S.time.day - 1) return ['🏠✨', '😍'];
    if (S.res.food < Village.population()) return ['🍞?', '😟'];
    return [pick(CHAT_EMOTES), pick(CHAT_EMOTES)];
  },

  /* ----- production (every 5 seconds) ----- */
  productionTick() {
    const blk = scheduleBlock(S.time.hour);
    const hap = Village.happiness();
    const hf = 0.7 + 0.6 * (hap / 100);
    const mills = Math.min(2, BuildingService.count('windmill'));
    const acc = this.acc || (this.acc = new Map());
    for (const r of this.rt.values()) {
      const n = r.n;
      if (r.cand || r.leaving) continue;
      n.hunger = Math.min(100, n.hunger + (blk === 'sleep' ? 0.4 : 1.1));
      const target = clamp(hap + (n.work ? 5 : -10 + 10 * PolicyService.relief()) - (n.hunger > 70 ? 15 : 0), 0, 100);
      n.happy += (target - n.happy) * 0.05;
      const working = n.work && ((r.state === 'work' && r.workB === n.work) || (r.state === 'inside' && r.inB === n.work));
      if (!working) continue;
      const b = BuildingService.byId(n.work);
      if (!b || !isActive(b)) continue;
      const cfg = BUILDINGS[b.type];
      n.money += 1.5;
      if (!cfg.produce) continue;
      if (cfg.consume) { const reserve = (k) => (k === 'wood' || k === 'stone' ? Economy.cap(k) * 0.25 : 0); if (Object.entries(cfg.consume).some(([k, v]) => S.res[k] - v < reserve(k))) { r.ent.bubble = { text: '❓' + ITEMS[Object.keys(cfg.consume)[0]].icon, t: 2.5 }; continue; } Economy.spend(cfg.consume); }
      let mult = hf;
      if (cfg.produce.wheat) { mult *= 1 + 0.25 * mills; if (EventService.is('rain')) mult *= 1.5; if (EventService.is('harvest')) mult *= 2; }
      if (EventService.is('festival') && cfg.produce.coins) mult *= 2;
      const a = acc.get(b.id) || {};
      const out = {};
      for (const k in cfg.produce) { a[k] = (a[k] || 0) + cfg.produce[k] * mult; const whole = Math.floor(a[k]); if (whole > 0) { a[k] -= whole; out[k] = whole; } }
      acc.set(b.id, a);
      const pos = new THREE.Vector3(b.x, (b.y || 0) + Models.get(b.type).height + 0.4, b.z);
      for (const k in out) Economy.add(k, out[k], 'produce', pos);
      if (Object.keys(out).length) Bus.emit('produce', { b, out, pos });
    }
  },

  /* ----- per-frame update ----- */
  tick(dt) {
    const t = S.playTime;
    for (const r of this.rt.values()) {
      const e = r.ent;
      if (r.state === 'walk') this.move(r, dt);
      if (r.gone) { Chars.remove(e); this.rt.delete(r.n.id); continue; }
      else if (r.state === 'chat') { if (t > r.chatEnd) { r.state = 'idle'; r.until = t + 1; e.anim.act = 0; } Chars.animate(e, 0, dt); }
      else Chars.animate(e, 0, dt);
      if (r.pendingBubble && t >= r.pendingBubble.at) { e.bubble = { text: r.pendingBubble.text, t: 2.2 }; r.pendingBubble = null; }
      if (e.bubble && e.bubble.t > 0) e.bubble.t -= dt;
      if (!r.cand && !r.leaving) e.alert = r.n.req ? '❗' : null;
      r.thinkT -= dt;
      if (r.thinkT <= 0) { r.thinkT = 0.5 + Math.random() * 0.4; this.think(r); }
    }
    this.chatT -= dt;
    if (this.chatT <= 0) { this.chatT = 1; this.chats(); }
  },
};
