// Chunked, LOD-aware instancing. Every group (e.g. "spruce", "fern") owns a list of items; items are
// binned into 128 m chunks. Each chunk has one InstancedMesh per LOD (and per variant for LOD 0) so
// frustum culling works per chunk. update() re-sorts the items of nearby chunks into LOD buckets.
import * as THREE from 'three';
import { WORLD_SIZE, WORLD_HALF } from '../layout.js';

export const ITEM = 12; // x, y, z, rotY, sx, sy, sz, r, g, b, rank, variant
const CHUNK = 128;
const NC = Math.ceil(WORLD_SIZE / CHUNK);

/** Writes an item into a Float32Array list at index i. */
export function setItem(arr, i, x, y, z, rot, sx, sy, sz, r, g, b, rank, variant) {
  const o = i * ITEM;
  arr[o] = x; arr[o + 1] = y; arr[o + 2] = z; arr[o + 3] = rot; arr[o + 4] = sx; arr[o + 5] = sy; arr[o + 6] = sz;
  arr[o + 7] = r; arr[o + 8] = g; arr[o + 9] = b; arr[o + 10] = rank; arr[o + 11] = variant;
}

export class InstanceSystem {
  constructor(parent) {
    this.root = new THREE.Group(); this.root.name = 'instanced-nature';
    parent.add(this.root);
    this.groups = [];
    this.chunks = [];
    for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
      const cx = -WORLD_HALF + (i + 0.5) * CHUNK, cz = -WORLD_HALF + (j + 0.5) * CHUNK;
      this.chunks.push({ cx, cz, entries: [] });
    }
    this.lastCam = new THREE.Vector3(1e9, 0, 1e9);
    this.stats = { instances: 0, meshes: 0 };
  }

  /**
   * @param {object} def { name, material, lod0: Geometry[], lod1?, lod2?, dist:[d0,d1,dmax], cast:[b,b,b], thin, items: Float32Array, count }
   */
  addGroup(def) {
    const g = { ...def, cast: def.cast || [true, true, false], receive: def.receive !== false };
    this.groups.push(g);
    const nv = g.lod0.length;
    const bins = this.chunks.map(() => []);
    for (let i = 0; i < g.count; i++) {
      const x = g.items[i * ITEM], z = g.items[i * ITEM + 2];
      const ci = Math.min(NC - 1, Math.max(0, Math.floor((x + WORLD_HALF) / CHUNK))), cj = Math.min(NC - 1, Math.max(0, Math.floor((z + WORLD_HALF) / CHUNK)));
      bins[cj * NC + ci].push(i);
    }
    this.chunks.forEach((chunk, ci) => {
      const list = bins[ci];
      if (!list.length) return;
      const sphere = new THREE.Sphere(new THREE.Vector3(chunk.cx, 40, chunk.cz), CHUNK * 0.72 + 40);
      const mk = (geo, cap, castShadow) => {
        const m = new THREE.InstancedMesh(geo, g.material, Math.max(cap, 1));
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(cap, 1) * 3), 3);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
        m.boundingSphere = sphere.clone(); m.count = 0; m.visible = false;
        m.castShadow = castShadow; m.receiveShadow = g.receive; m.matrixAutoUpdate = false; m.name = g.name;
        this.root.add(m);
        return m;
      };
      const varCount = new Array(nv).fill(0);
      for (const i of list) varCount[g.items[i * ITEM + 11] | 0]++;
      const entry = {
        g, idx: Int32Array.from(list),
        l0: g.lod0.map((geo, v) => (varCount[v] ? mk(geo, varCount[v], g.cast[0]) : null)),
        l1: g.lod1 ? mk(g.lod1, list.length, g.cast[1]) : null,
        l2: g.lod2 ? mk(g.lod2, list.length, g.cast[2]) : null,
      };
      entry.all = [...entry.l0, entry.l1, entry.l2];
      chunk.entries.push(entry);
    });
  }

  /** Rebuild instance buffers around the camera. p = { density, lodScale, viewDistance } */
  update(cam, p) {
    this.lastCam.copy(cam);
    let inst = 0, meshes = 0;
    const R = CHUNK * 0.72;
    for (const chunk of this.chunks) {
      const dc = Math.hypot(cam.x - chunk.cx, cam.z - chunk.cz) - R;
      for (const e of chunk.entries) {
        const g = e.g;
        const dmax = Math.min(g.dist[2] * p.lodScale, p.viewDistance + 20);
        const all = e.all;
        if (dc > dmax) { for (const m of all) if (m && m.visible) { m.visible = false; m.count = 0; } continue; }
        const d0 = g.dist[0] * p.lodScale, d1 = g.dist[1] * p.lodScale;
        const d0s = d0 * d0, d1s = d1 * d1, dms = dmax * dmax;
        const rankMax = g.thin ? p.density : 1.01;
        const hasL1 = !!e.l1, hasL2 = !!e.l2;
        const counts = e.counts || (e.counts = new Int32Array(all.length));
        counts.fill(0);
        const nv = e.l0.length;
        const items = g.items;
        for (let k = 0; k < e.idx.length; k++) {
          const i = e.idx[k], o = i * ITEM;
          if (items[o + 10] > rankMax) continue;
          const dx = items[o] - cam.x, dz = items[o + 2] - cam.z, d2 = dx * dx + dz * dz;
          if (d2 > dms) continue;
          let slot;
          if (d2 < d0s || (!hasL1 && !hasL2)) slot = items[o + 11] | 0;
          else if (d2 < d1s) slot = hasL1 ? nv : (items[o + 11] | 0);
          else slot = hasL2 ? nv + 1 : hasL1 ? nv : (items[o + 11] | 0);
          const m = all[slot];
          if (!m) continue;
          const n = counts[slot]++;
          const a = m.instanceMatrix.array, q = n * 16;
          const rot = items[o + 3], c = Math.cos(rot), s = Math.sin(rot), sx = items[o + 4], sy = items[o + 5], sz = items[o + 6];
          a[q] = sx * c; a[q + 1] = 0; a[q + 2] = -sx * s; a[q + 3] = 0;
          a[q + 4] = 0; a[q + 5] = sy; a[q + 6] = 0; a[q + 7] = 0;
          a[q + 8] = sz * s; a[q + 9] = 0; a[q + 10] = sz * c; a[q + 11] = 0;
          a[q + 12] = items[o]; a[q + 13] = items[o + 1]; a[q + 14] = items[o + 2]; a[q + 15] = 1;
          const ca = m.instanceColor.array, cq = n * 3;
          ca[cq] = items[o + 7]; ca[cq + 1] = items[o + 8]; ca[cq + 2] = items[o + 9];
        }
        for (let s = 0; s < all.length; s++) {
          const m = all[s];
          if (!m) continue;
          const n = counts[s];
          m.count = n; m.visible = n > 0;
          if (n > 0) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; inst += n; meshes++; }
        }
      }
    }
    this.stats.instances = inst; this.stats.meshes = meshes;
  }

  dispose() {
    this.root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    this.root.parent?.remove(this.root);
  }
}
