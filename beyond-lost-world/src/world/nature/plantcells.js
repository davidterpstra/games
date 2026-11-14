// Small plants (bushes, ferns, flowers, grass tufts, mushrooms, stumps, logs) are baked into static
// geometry per 64 m cell – one draw call per cell instead of one per plant type. Plants inside a cell
// are sorted by rank so density changes only move the geometry's draw range.
import * as THREE from 'three';

const CELL = 64;

/**
 * @param {THREE.Object3D} parent
 * @param {THREE.Material} material
 * @param {Array<{ geo: THREE.BufferGeometry, list: Array }>} sources items: { x,y,z,rot,scale,color,rank }
 */
export function createPlantCells(parent, material, sources) {
  const root = new THREE.Group(); root.name = 'plant-cells';
  parent.add(root);
  const cells = new Map();
  for (const { geo, list } of sources) {
    const src = {
      p: geo.attributes.position.array, n: geo.attributes.normal.array, uv: geo.attributes.uv.array, c: geo.attributes.color.array,
      w: geo.attributes.aWind.array, t: geo.attributes.aTint.array, idx: geo.index.array, vc: geo.attributes.position.count,
    };
    for (const it of list) {
      const key = `${Math.floor((it.x + 320) / CELL)},${Math.floor((it.z + 320) / CELL)}`;
      (cells.get(key) || cells.set(key, []).get(key)).push({ src, it });
    }
  }
  const meshes = [];
  for (const [key, arr] of cells) {
    arr.sort((a, b) => (a.it.rank ?? 0) - (b.it.rank ?? 0));
    let nv = 0, ni = 0;
    for (const { src } of arr) { nv += src.vc; ni += src.idx.length; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), C = new Float32Array(nv * 3), W = new Float32Array(nv), T = new Float32Array(nv);
    const I = new Uint32Array(ni);
    const ranks = new Float32Array(arr.length), idxEnd = new Uint32Array(arr.length);
    let vo = 0, io = 0, k = 0;
    for (const { src, it } of arr) {
      const rot = it.rot, c = Math.cos(rot), s = Math.sin(rot), sc = it.scale, col = it.color;
      for (let v = 0; v < src.vc; v++) {
        const px = src.p[v * 3], py = src.p[v * 3 + 1], pz = src.p[v * 3 + 2];
        const o = (vo + v) * 3;
        P[o] = it.x + (c * px + s * pz) * sc; P[o + 1] = it.y + py * sc; P[o + 2] = it.z + (-s * px + c * pz) * sc;
        const nx = src.n[v * 3], ny = src.n[v * 3 + 1], nz = src.n[v * 3 + 2];
        N[o] = c * nx + s * nz; N[o + 1] = ny; N[o + 2] = -s * nx + c * nz;
        const tn = src.t[v];
        C[o] = src.c[v * 3] * (1 + (col[0] - 1) * tn); C[o + 1] = src.c[v * 3 + 1] * (1 + (col[1] - 1) * tn); C[o + 2] = src.c[v * 3 + 2] * (1 + (col[2] - 1) * tn);
        UV[(vo + v) * 2] = src.uv[v * 2]; UV[(vo + v) * 2 + 1] = src.uv[v * 2 + 1];
        W[vo + v] = src.w[v]; T[vo + v] = tn;
      }
      for (let i = 0; i < src.idx.length; i++) I[io + i] = src.idx[i] + vo;
      vo += src.vc; io += src.idx.length;
      ranks[k] = it.rank ?? 0; idxEnd[k] = io; k++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('aWind', new THREE.BufferAttribute(W, 1)); g.setAttribute('aTint', new THREE.BufferAttribute(T, 1));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = `plants_${key}`; mesh.matrixAutoUpdate = false;
    root.add(mesh);
    meshes.push({ mesh, ranks, idxEnd, center: g.boundingSphere.center.clone(), radius: g.boundingSphere.radius });
  }
  let drawn = 0;
  return {
    root,
    /** Apply density (0..1) and distance culling around the camera. */
    update(cam, density, maxDist) {
      drawn = 0;
      for (const m of meshes) {
        const d = Math.hypot(cam.x - m.center.x, cam.z - m.center.z) - m.radius;
        if (d > maxDist) { m.mesh.visible = false; continue; }
        // last plant with rank <= density
        let lo = 0, hi = m.ranks.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (m.ranks[mid] <= density) lo = mid + 1; else hi = mid; }
        const cnt = lo ? m.idxEnd[lo - 1] : 0;
        m.mesh.geometry.setDrawRange(0, cnt);
        m.mesh.visible = cnt > 0; if (cnt) drawn++;
      }
    },
    get drawn() { return drawn; },
  };
}
