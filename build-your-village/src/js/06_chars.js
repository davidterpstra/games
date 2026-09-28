/* =====================================================================
   CHARACTERS — player + every villager drawn with ONE instanced mesh.
   Limb swing, chopping, waving and sitting are done in the vertex
   shader from a per-instance animation vector, so 100 villagers cost
   a single draw call. Name tags and speech bubbles are DOM overlays.
   ===================================================================== */
const Chars = {
  MAX: 112, mesh: null, blobs: null, ents: [], free: [], attrs: {},
  buildGeo() {
    const P = [], I = [];
    const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz));
    const add = (geo, m, part, limb, hat = 0) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.applyMatrix4(m);
      const p = g.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) { P.push(p[i], p[i + 1], p[i + 2]); I.push(part, limb, hat); }
    };
    const B = (w, hh, d) => new THREE.BoxGeometry(w, hh, d);
    const Cy = (rt, rb, hh, seg) => new THREE.CylinderGeometry(rt, rb, hh, seg);
    // legs (limb 3 = left/+x, 4 = right/-x) and shoes
    add(B(0.22, 0.62, 0.26), M(0.13, 0.47, 0), 2, 3); add(B(0.22, 0.62, 0.26), M(-0.13, 0.47, 0), 2, 4);
    add(B(0.24, 0.16, 0.34), M(0.13, 0.08, 0.03), 5, 3); add(B(0.24, 0.16, 0.34), M(-0.13, 0.08, 0.03), 5, 4);
    // torso + belt
    add(B(0.56, 0.62, 0.34), M(0, 1.08, 0), 1, 0); add(B(0.58, 0.09, 0.36), M(0, 0.8, 0), 5, 0);
    // arms (limb 1 = left, 2 = right)
    add(B(0.17, 0.5, 0.2), M(0.37, 1.11, 0), 1, 1); add(B(0.15, 0.14, 0.17), M(0.37, 0.8, 0), 0, 1);
    add(B(0.17, 0.5, 0.2), M(-0.37, 1.11, 0), 1, 2); add(B(0.15, 0.14, 0.17), M(-0.37, 0.8, 0), 0, 2);
    // head, eyes, hair
    add(B(0.44, 0.42, 0.4), M(0, 1.62, 0), 0, 0);
    add(B(0.07, 0.08, 0.03), M(0.1, 1.64, 0.2), 8, 0); add(B(0.07, 0.08, 0.03), M(-0.1, 1.64, 0.2), 8, 0);
    add(B(0.47, 0.13, 0.43), M(0, 1.86, -0.01), 4, 0); add(B(0.47, 0.3, 0.12), M(0, 1.72, -0.18), 4, 0);
    // hats (part 3), each tagged with its hat id
    add(Cy(0.44, 0.44, 0.04, 10), M(0, 1.91, 0), 3, 0, 1); add(Cy(0.22, 0.25, 0.2, 10), M(0, 2.02, 0), 3, 0, 1);
    add(Cy(0.2, 0.2, 0.3, 8), M(0, 2.02, 0), 3, 0, 2); add(new THREE.IcosahedronGeometry(0.26, 0), M(0, 2.24, 0, 0, 0, 0, 1, 0.7, 1), 3, 0, 2);
    add(new THREE.SphereGeometry(0.28, 8, 4, 0, TAU, 0, Math.PI / 2), M(0, 1.8, 0, 0, 0, 0, 1.05, 0.95, 1.05), 3, 0, 3); add(B(0.5, 0.04, 0.14), M(0, 1.83, 0.21), 3, 0, 3);
    add(Cy(0.27, 0.25, 0.1, 10), M(0.03, 1.95, 0, 0, 0, -0.15), 3, 0, 4);
    add(Cy(0.24, 0.28, 0.2, 10), M(0, 1.97, 0), 3, 0, 5); add(Cy(0.36, 0.36, 0.03, 10), M(0, 1.88, 0), 3, 0, 5);
    add(Cy(0.25, 0.25, 0.1, 8), M(0, 1.95, 0), 3, 0, 6);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; add(new THREE.ConeGeometry(0.06, 0.15, 4), M(Math.cos(a) * 0.22, 2.06, Math.sin(a) * 0.22), 3, 0, 6); }
    add(new THREE.ConeGeometry(0.28, 0.62, 8), M(0, 2.2, -0.02, -0.15, 0, 0), 3, 0, 7); add(Cy(0.42, 0.42, 0.03, 10), M(0, 1.9, 0), 3, 0, 7);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; add(new THREE.IcosahedronGeometry(0.075, 0), M(Math.cos(a) * 0.245, 1.9, Math.sin(a) * 0.23), 3, 0, 8); }
    add(Cy(0.21, 0.21, 0.36, 10), M(0, 2.1, 0), 3, 0, 9); add(Cy(0.36, 0.36, 0.03, 10), M(0, 1.91, 0), 3, 0, 9);
    add(new THREE.ConeGeometry(0.17, 0.42, 8), M(0.05, 2.1, 0, 0, 0, -0.2), 3, 0, 10);
    // tool in the right hand (only visible while working)
    add(B(0.06, 0.06, 0.78), M(-0.37, 0.8, 0.3), 6, 2, 99); add(B(0.09, 0.3, 0.13), M(-0.37, 0.8, 0.66), 7, 2, 99);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(I, 3));
    g.computeVertexNormals();
    return g;
  },
  init(scene) {
    const g = this.buildGeo();
    const N = this.MAX;
    const mk = (n) => new THREE.InstancedBufferAttribute(new Float32Array(N * n), n);
    this.attrs = { iAnim: mk(4), iShirt: mk(3), iPants: mk(3), iHat: mk(4), iSkin: mk(3), iHair: mk(3) };
    for (const k in this.attrs) { this.attrs[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, this.attrs[k]); }
    const mat = new THREE.MeshLambertMaterial({ flatShading: true });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = `attribute vec3 aInfo; attribute vec4 iAnim; attribute vec3 iShirt; attribute vec3 iPants; attribute vec4 iHat; attribute vec3 iSkin; attribute vec3 iHair;
varying vec3 vCharCol;
vec3 cRotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 cRotZ(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
` + sh.vertexShader.replace('#include <begin_vertex>', `
vec3 transformed = vec3(position);
float part = aInfo.x; float limb = aInfo.y; float hatId = aInfo.z;
float walk = sin(iAnim.x) * iAnim.y;
float act = iAnim.w; float ap = iAnim.z;
if (hatId > 0.5) {
  if (hatId > 98.5) { if (!(act > 0.5 && act < 1.5) && !(act > 3.5 && act < 4.5)) transformed *= 0.0; }
  else if (abs(hatId - iHat.w) > 0.25) transformed *= 0.0;
}
if (limb > 0.5) {
  vec3 piv = vec3(0.0); float ax = 0.0; float az = 0.0;
  if (limb < 1.5) { piv = vec3(0.37, 1.34, 0.0); ax = walk * 0.9;
    if (act > 1.5 && act < 2.5) ax = 0.0;
    if (act > 4.5 && act < 5.5) ax = -0.35 + sin(ap * 0.7) * 0.2; }
  else if (limb < 2.5) { piv = vec3(-0.37, 1.34, 0.0); ax = -walk * 0.9;
    if (act > 0.5 && act < 1.5) ax = -1.6 + sin(ap) * 1.25;
    else if (act > 1.5 && act < 2.5) az = -2.55 + sin(ap) * 0.35;
    else if (act > 3.5 && act < 4.5) ax = -0.9 + sin(ap) * 0.55;
    else if (act > 4.5 && act < 5.5) ax = -0.5 + sin(ap) * 0.3; }
  else if (limb < 3.5) { piv = vec3(0.13, 0.78, 0.0); ax = -walk * 0.8; }
  else { piv = vec3(-0.13, 0.78, 0.0); ax = walk * 0.8; }
  if (act > 2.5 && act < 3.5) { if (limb > 2.5) ax = -1.5; else ax = -0.5; }
  vec3 lp = transformed - piv;
  lp = cRotX(lp, ax);
  lp = cRotZ(lp, az);
  transformed = lp + piv;
}
transformed.y += abs(sin(iAnim.x)) * iAnim.y * 0.07;
if (act > 2.5 && act < 3.5) transformed.y -= 0.36;
vec3 cc = iSkin;
if (part > 0.5 && part < 1.5) cc = iShirt;
else if (part > 1.5 && part < 2.5) cc = iPants;
else if (part > 2.5 && part < 3.5) cc = iHat.rgb;
else if (part > 3.5 && part < 4.5) cc = iHair;
else if (part > 4.5 && part < 5.5) cc = vec3(0.16, 0.11, 0.08);
else if (part > 5.5 && part < 6.5) cc = vec3(0.42, 0.27, 0.14);
else if (part > 6.5 && part < 7.5) cc = vec3(0.55, 0.58, 0.62);
else if (part > 7.5) cc = vec3(0.05, 0.04, 0.04);
vCharCol = cc;
`);
      sh.fragmentShader = 'varying vec3 vCharCol;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vCharCol;');
    };
    mat.customProgramCacheKey = () => 'chars1';
    this.mesh = new THREE.InstancedMesh(g, mat, N);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    const bg = new THREE.CircleGeometry(0.5, 12); bg.rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0x1b2a1b, transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), N);
    this.blobs.frustumCulled = false; this.blobs.count = 0; this.blobs.renderOrder = 1;
    scene.add(this.blobs);
    for (let i = N - 1; i >= 0; i--) this.free.push(i);
    this.slots = new Array(N).fill(null);
  },
  spawn(look = {}, x = 0, z = 0) {
    const slot = this.free.pop();
    if (slot == null) return null;
    const ent = { slot, x, z, y: World.heightAt(x, z), yaw: 0, hidden: false, scale: 1, anim: { ph: 0, amt: 0, act: 0, aph: 0 }, look: {}, name: '', bubble: null, alert: null, showName: false };
    this.slots[slot] = ent;
    this.ents.push(ent);
    this.setLook(ent, look);
    return ent;
  },
  remove(ent) {
    if (!ent || this.slots[ent.slot] !== ent) return;
    this.slots[ent.slot] = null;
    this.ents = this.ents.filter((e) => e !== ent);
    this.free.push(ent.slot);
    this.mesh.setMatrixAt(ent.slot, _cm.makeScale(0, 0, 0));
    this.blobs.setMatrixAt(ent.slot, _cm);
    this.mesh.instanceMatrix.needsUpdate = true; this.blobs.instanceMatrix.needsUpdate = true;
  },
  setLook(ent, look) {
    ent.look = Object.assign(ent.look || {}, look);
    const L = ent.look, i = ent.slot, c = new THREE.Color(), A = this.attrs;
    const put = (attr, hex, n = 3, w = 0) => { c.set(hex); attr.array[i * n] = c.r; attr.array[i * n + 1] = c.g; attr.array[i * n + 2] = c.b; if (n === 4) attr.array[i * 4 + 3] = w; attr.needsUpdate = true; };
    put(A.iShirt, L.shirt ?? 0x8f9d6a); put(A.iPants, L.pants ?? 0x4a5a6e); put(A.iSkin, L.skin ?? 0xe0ac86); put(A.iHair, L.hair ?? 0x3b2a1e);
    put(A.iHat, L.hatCol ?? 0xffffff, 4, L.hat || 0);
  },
  update(dt) {
    let maxSlot = -1;
    const A = this.attrs.iAnim.array;
    for (const e of this.ents) {
      const i = e.slot;
      if (i > maxSlot) maxSlot = i;
      const s = e.hidden ? 0 : e.scale;
      composeM(e.x, e.y, e.z, e.yaw, s, s);
      this.mesh.setMatrixAt(i, _cm);
      composeM(e.x, World.heightAt(e.x, e.z) + 0.04, e.z, 0, e.hidden ? 0 : 1.1 - Math.min(0.5, (e.y - World.heightAt(e.x, e.z)) * 0.3));
      this.blobs.setMatrixAt(i, _cm);
      A[i * 4] = e.anim.ph; A[i * 4 + 1] = e.anim.amt; A[i * 4 + 2] = e.anim.aph; A[i * 4 + 3] = e.anim.act;
    }
    this.mesh.count = maxSlot + 1; this.blobs.count = maxSlot + 1;
    this.mesh.instanceMatrix.needsUpdate = true; this.blobs.instanceMatrix.needsUpdate = true;
    this.attrs.iAnim.needsUpdate = true;
  },
  /* animate helper: walking speed -> leg swing */
  animate(e, speed, dt) {
    const a = e.anim;
    const target = clamp(speed / 3.2, 0, 1.25);
    a.amt = lerp(a.amt, target, Math.min(1, dt * 10));
    a.ph += dt * (4 + speed * 2.4) * (a.amt > 0.05 ? 1 : 0);
    if (a.act) a.aph += dt * (a.act === 1 ? 9 : a.act === 4 ? 11 : a.act === 2 ? 7 : 4);
  },
};

/* ---------------- Labels: names, speech bubbles, alerts ---------------- */
const Labels = {
  layer: null, pool: [], used: 0, v: new THREE.Vector3(),
  init() { this.layer = $('#labels'); },
  get(i) {
    while (this.pool.length <= i) { const d = h('div', 'lbl'); d.innerHTML = '<div class="lbl-b"></div><div class="lbl-n"></div>'; this.layer.appendChild(d); this.pool.push({ el: d, b: d.firstChild, n: d.lastChild, bt: '', nt: '', cls: '' }); }
    return this.pool[i];
  },
  update(camera) {
    let k = 0;
    const w = innerWidth, hgt = innerHeight;
    const cx = camera.position.x, cz = camera.position.z;
    const showNames = S.settings.names;
    for (const e of Chars.ents) {
      if (e.hidden && !e.alertOnHidden) continue;
      const d = Math.hypot(e.x - Player.x, e.z - Player.z);
      const hasB = e.bubble && e.bubble.t > 0;
      const hasA = !!e.alert;
      const nameOn = showNames && e.name && d < 14 && e !== Player.ent;
      if (!hasB && !hasA && !nameOn) continue;
      if (Math.hypot(e.x - cx, e.z - cz) > 70) continue;
      this.v.set(e.x, e.y + (e.hidden ? 2.6 : 2.35), e.z).project(camera);
      if (this.v.z > 1 || this.v.x < -1.1 || this.v.x > 1.1 || this.v.y < -1.1 || this.v.y > 1.1) continue;
      const L = this.get(k++);
      const bt = hasB ? e.bubble.text : hasA ? e.alert : '';
      const cls = hasB ? 'lbl talk' + (e.bubble.big ? ' big' : '') : hasA ? 'lbl alert' : 'lbl';
      if (L.bt !== bt) { L.b.textContent = bt; L.bt = bt; }
      const nt = nameOn ? e.name : '';
      if (L.nt !== nt) { L.n.textContent = nt; L.nt = nt; }
      if (L.cls !== cls) { L.el.className = cls; L.cls = cls; }
      L.b.style.display = bt ? '' : 'none';
      L.n.style.display = nt ? '' : 'none';
      L.el.style.display = '';
      L.el.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * hgt}px) translate(-50%, -100%)`;
    }
    for (let i = k; i < this.used; i++) this.pool[i].el.style.display = 'none';
    this.used = k;
  },
};
