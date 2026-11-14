// Onderzoeksstation Kestrel: abandoned modern research outpost (pad 'station').
import * as THREE from 'three';
import { getPad } from '../layout.js';
import { roomWalls, wall, floorSlab } from './arch.js';
import * as P from './props.js';
import { placeBeacon } from './beacons.js';

const TAU = Math.PI * 2;
const signRect = (i) => [0, 1 - (i + 1) / 8, 1, 1 - i / 8];

export function buildStation(S) {
  const pad = getPad('station');
  const b = S.builder('station', 11);
  const oy = pad.y, ox = pad.x, oz = pad.z;
  const W = 16, D = 10, H = 3.0, T = 0.25;
  let broken = null;

  b.at(ox, oy, oz, 0, () => {
    // ---------------------------------------------------------------- building shell (B frame: centre (0,2), floor top y 0.05)
    b.at(0, 0.05, 2, 0, () => {
      const steel = { frame: 'steel' };
      roomWalls(b, {
        w: W, d: D, h: H, t: T, y: -0.05,
        layers: [{ to: 0.45, mat: 'concrete', tint: [0.85, 0.85, 0.82] }, { mat: 'panel' }],
        sides: {
          n: [
            { at: 0, w: 1.7, h: 2.35, kind: 'door', frame: 'steel' },
            { at: -5.4, w: 1.4, h: 1.2, sill: 1.0, kind: 'window', glass: true, ...steel },
            { at: -3.0, w: 1.4, h: 1.2, sill: 1.0, kind: 'window', glass: true, broken: true, ...steel },
            { at: 5.8, w: 1.4, h: 1.2, sill: 1.0, kind: 'window', glass: true, ...steel },
          ],
          s: [
            { at: -2.6, w: 1.4, h: 1.2, sill: 1.0, kind: 'window', glass: true, ...steel },
            { at: 0.6, w: 1.6, h: 1.2, sill: 1.1, kind: 'window', glass: true, ...steel },
            { at: 5.8, w: 1.4, h: 1.2, sill: 1.0, kind: 'window', glass: true, ...steel },
          ],
          e: [{ at: -1.5, w: 1.6, h: 1.2, sill: 1.1, kind: 'window', glass: true, ...steel }],
          w: [{ at: 0, w: 1.6, h: 1.2, sill: 1.1, kind: 'window', glass: true, ...steel }],
        },
      });
      // partition between main room and lab (door at z=0)
      wall(b, 3.5, -4.875, 3.5, 4.875, { h: H, t: 0.25, y: -0.05, layers: [{ to: 0.15, mat: 'concrete' }, { mat: 'panel', tint: [0.95, 0.97, 0.95] }], openings: [{ at: 0, w: 1.5, h: 2.3, kind: 'door', frame: 'steel' }] });
      // floors
      floorSlab(b, -2.1875, 0, 11.375, 9.75, 0, 'wood', 'wood', { tint: [0.62, 0.66, 0.68], tile: 2 });
      floorSlab(b, 5.6875, 0, 4.375, 9.75, 0, 'concrete', 'metal', { tint: [0.95, 0.97, 0.98], tile: 3 });
      // ceiling + roof slab + parapet
      b.box('concrete', 0, 3.15, 0, W + 0.9, 0.45, D + 0.9, { tint: [0.8, 0.8, 0.82] });
      for (const [px, pz, w, d] of [[0, -(D + 0.9) / 2 + 0.1, W + 0.9, 0.2], [0, (D + 0.9) / 2 - 0.1, W + 0.9, 0.2], [-(W + 0.9) / 2 + 0.1, 0, 0.2, D + 0.9], [(W + 0.9) / 2 - 0.1, 0, 0.2, D + 0.9]]) {
        b.box('panel', px, 3.55, pz, w, 0.35, d, { tint: [0.8, 0.82, 0.82] });
      }
      // roof equipment
      b.box('steel', -4.5, 3.95, 1.5, 1.6, 0.8, 1.1, { tint: [0.9, 0.95, 0.9] });
      for (let i = 0; i < 3; i++) b.cyl('black', -4.9 + i * 0.5, 4.38, 1.5, 0.18, 0.18, 0.05, 10);
      b.cyl('steel', 2.5, 4.1, -1.5, 0.12, 0.12, 1.2, 8); b.cyl('steel', 2.5, 4.8, -1.5, 0.2, 0.12, 0.25, 8);
      b.cyl('steel', 5.5, 4.0, 2.2, 0.1, 0.1, 1.0, 8);
      b.box('rust', 6.5, 3.95, -2.5, 1.0, 0.7, 0.8, { tint: [0.9, 0.9, 0.9] });
      // name sign above the entrance (outside, facing north)
      b.quad('signs', 0, 2.78, -T / 2 - 0.0 - 5.03 + 0.0, 3.2, 0.4, { ry: Math.PI, uvRect: signRect(0), j: 0 });
      // base trim and corner posts
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('steel', sx * (W / 2 + 0.02), H / 2 - 0.05, sz * (D / 2 + 0.02), 0.2, H + 0.05, 0.2, { tint: [0.7, 0.75, 0.72] });

      // ---- door leaf hanging open outside (hinge on the left jamb)
      b.at(-0.85, 0, -5.1, 1.75, () => {
        b.box('panel', 0.75, 1.15, 0, 1.5, 2.3, 0.06, { tint: [0.85, 0.85, 0.8] });
        b.box('steel', 1.35, 1.0, 0.05, 0.12, 0.05, 0.05); b.box('black', 0.75, 1.5, 0.035, 0.5, 0.35, 0.02);
        b.solid(0.75, 1.15, 0, 1.5, 2.3, 0.08, { surface: 'metal' });
      });

      // ---------------------------------------------------------------- lights, cables, posters
      for (const [lx, lz, rot] of [[-5.5, -2.5, 0], [-5.5, 2.5, 0], [0.8, -2.8, 0], [0.8, 2.2, 0], [5.7, -2, Math.PI / 2], [5.7, 2.4, Math.PI / 2]]) P.lampStrip(b, lx, 2.9, lz, 1.3, rot);
      b.quad('map', -5.2, 1.75, -4.85, 1.3, 1.0, { uv: [1, 1], j: 0.05 });
      b.quad('paper', -4.2, 1.5, -4.85, 0.5, 0.7, { uv: [1, 1], rz: 0.05 });
      b.quad('paper', 2.4, 1.6, -4.85, 0.4, 0.55, { uv: [1, 1], rz: -0.08 });
      b.quad('signs', 6.0, 1.9, 4.86, 1.6, 0.2, { ry: Math.PI, uvRect: signRect(7), j: 0, rz: 0 });
      P.cable(b, [[-1.3, 2.9, 4.8], [-1.25, 2.0, 4.82], [-1.1, 1.0, 4.8], [-1.0, 0.82, 4.55]]);
      P.cable(b, [[-0.2, 2.9, 4.8], [-0.1, 1.6, 4.82], [0.1, 0.9, 4.85], [0.6, 0.05, 4.7], [1.4, 0.04, 4.2]]);
      P.cable(b, [[3.3, 2.9, 4.0], [3.2, 1.4, 4.3], [3.0, 0.05, 4.5], [2.2, 0.04, 3.4], [1.0, 0.04, 3.0]], 0.03);

      // ---------------------------------------------------------------- main room furnishings
      P.bunk(b, -7.2, 3.7, 0, { onTop: (p) => S.anchor('station.cloth', p) });
      P.bunk(b, -7.2, 1.45, 0, { tint: [0.5, 0.55, 0.62] });
      S.resource('cloth_s1', 'cloth', b.wp(-7.2, 0.62, 1.2));
      P.crate(b, -7.2, -0.6, 0.1, { w: 0.9, d: 0.6, h: 0.5 });
      P.shelf(b, -7.65, -3.2, Math.PI / 2, { w: 1.8, n: 4 });
      P.desk(b, -0.5, 4.35, 0, { tint: [0.65, 0.7, 0.72] });
      P.chair(b, -0.3, 3.25, 0.35);
      P.monitor(b, -1.1, 0.79, 4.5, Math.PI); P.monitor(b, -0.15, 0.79, 4.52, Math.PI - 0.25, 0.9);
      b.box('black', -0.55, 0.81, 4.0, 0.42, 0.025, 0.14); b.cyl('rust', -1.55, 0.83, 4.0, 0.04, 0.04, 0.09, 8, { tint: [0.9, 0.9, 0.9] });
      P.papers(b, 0.9, 4.35, 0.79, 6, 0.5);
      // Dr. Vos's logbook
      b.box('woodDark', 0.55, 0.805, 4.1, 0.24, 0.035, 0.32, { ry: 0.3, tint: [0.8, 0.25, 0.22], tile: 0.5 });
      b.box('paper', 0.55, 0.8, 4.1, 0.22, 0.04, 0.3, { ry: 0.3, tile: 0.3 });
      b.box('woodDark', 0.55, 0.826, 4.1, 0.24, 0.012, 0.32, { ry: 0.3, tint: [0.8, 0.25, 0.22], tile: 0.5 });
      S.anchor('station.logbook', b.wp(0.55, 0.85, 4.1));
      // mess table
      P.table(b, -3.2, -2.3, 0.1, { w: 1.7, d: 0.9 });
      P.chair(b, -3.7, -1.4, Math.PI - 0.2); P.chair(b, -2.4, -3.3, 0.5); P.chair(b, -1.5, -1.0, 1.2, { tint: [0.8, 0.7, 0.6] });
      b.clutter = true;
      b.cyl('rust', -3.6, 0.84, -2.2, 0.05, 0.04, 0.1, 8, { tint: [0.8, 0.9, 1] }); b.cyl('rust', -2.8, 0.84, -2.5, 0.05, 0.04, 0.1, 8, { tint: [1, 0.8, 0.7] });
      b.cyl('woodDark', -3.2, 0.82, -2.3, 0.12, 0.12, 0.02, 10, { tint: [1, 1, 1] });
      b.clutter = false;
      P.papers(b, -4.5, 0.0, 0.05, 9, 3.5);
      P.papers(b, -1.0, -0.5, 0.05, 6, 2.5);
      b.box('woodDark', -5.2, 0.05, 2.9, 0.6, 0.07, 0.4, { ry: 0.4, tint: [0.4, 0.45, 0.4] });
      // lockers along the partition, main side
      P.locker(b, 3.12, -2.6, -Math.PI / 2, { n: 4, ajar: 2 });
      P.locker(b, 3.12, 3.1, -Math.PI / 2, { n: 3, tint: [0.62, 0.62, 0.66] });
      // first aid + fire extinguisher on the wall
      b.box('panel', 2.95, 1.5, -0.5, 0.06, 0.4, 0.3, { tint: [0.9, 0.2, 0.2] }); b.box('lampOff', 2.915, 1.5, -0.5, 0.01, 0.2, 0.06, { tint: [0.9, 0.9, 0.9] });
      b.cyl('rust', 3.05, 0.9, 0.95, 0.08, 0.08, 0.5, 8, { tint: [1.0, 0.25, 0.2] });
      // waste bin + bucket under broken lamp
      P.bucket(b, -2.4, 1.6);

      // ---------------------------------------------------------------- lab room
      P.labBench(b, 7.4, -1.0, -Math.PI / 2, { w: 5.0 });
      P.labBench(b, 5.4, -4.45, 0, { w: 2.8 });
      P.shelf(b, 3.85, 3.3, Math.PI / 2, { w: 1.6, n: 5, mat: 'steel' });
      P.shelf(b, 3.85, -3.4, Math.PI / 2, { w: 1.4, n: 4, mat: 'steel' });
      b.box('panel', 6.2, 1.1, 4.4, 1.4, 2.2, 0.8, { tint: [0.9, 0.95, 0.95], c: { surface: 'metal' } });
      b.box('glass', 6.2, 1.5, 3.99, 1.2, 0.8, 0.02, { tint: [0.6, 0.9, 0.8] });
      P.crate(b, 7.2, 3.6, 0.2, { w: 0.8, d: 0.8, h: 0.6 }); P.crate(b, 7.2, 3.6, 0.5, { w: 0.7, d: 0.7, h: 0.5, y: 0.6 });
      P.papers(b, 5.6, 1.0, 0.05, 6, 2.2);
      b.box('steel', 5.0, 0.3, 2.4, 0.6, 0.6, 0.6, { tint: [0.7, 0.75, 0.7], c: { surface: 'metal' }, ry: 0.4 });
    });

    // ------------------------------------------------------------------ outside (pad frame)
    // entrance step and walkway
    b.box('concrete', 0, -0.05, -4.2, 2.8, 0.2, 2.1, { c: { surface: 'stone', yMin: -0.4, yMax: 0.05 }, tint: [0.9, 0.9, 0.88] });
    b.box('concrete', 0, -0.07, -12.5, 2.4, 0.2, 15.0, { tint: [0.85, 0.85, 0.82], tile: 3 });
    // radio mast with dish
    b.at(18, 0, 12, 0, () => {
      b.box('concrete', 0, 0.2, 0, 2.4, 0.5, 2.4, { c: { surface: 'stone' }, tint: [0.8, 0.8, 0.8] });
      const legs = (r, y) => [0, 1, 2].map((i) => [Math.cos(Math.PI / 2 + i * TAU / 3) * r, y, Math.sin(Math.PI / 2 + i * TAU / 3) * r]);
      for (let k = 0; k < 7; k++) {
        const a = legs(0.95 - 0.08 * k, 0.4 + 2 * k), c = legs(0.95 - 0.08 * (k + 1), 0.4 + 2 * (k + 1));
        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3;
          P.rod(b, 'steel', a[i], c[i], 0.045, 5, { tint: [0.85, 0.5, 0.45] });
          P.rod(b, 'steel', c[i], c[j], 0.022, 4, { tint: [0.85, 0.5, 0.45] });
          P.rod(b, 'steel', a[i], c[j], 0.018, 4, { tint: [0.85, 0.5, 0.45] });
        }
      }
      b.cyl('steel', 0, 16, 0, 0.04, 0.05, 3.4, 6);
      b.cyl('lampOff', 0, 17.8, 0, 0.07, 0.07, 0.12, 6, { tint: [1, 0.2, 0.2] });
      b.geo('dish', new THREE.SphereGeometry(1.45, 28, 8, 0, TAU, 0, 0.85), 0.55, 12.0, 0, { rz: Math.PI / 2 + 0.3, sy: 1, tint: [0.95, 0.97, 0.97], uv: [1, 1] });
      P.rod(b, 'steel', [0.5, 12, 0], [1.9, 12.9, 0], 0.025, 4); b.cyl('black', 1.95, 12.95, 0, 0.07, 0.04, 0.14, 6, { rz: Math.PI / 2 + 0.3 });
      b.cyl('steel', -0.3, 11, 0.2, 0.012, 0.012, 3.2, 4);
      P.cable(b, [[0.2, 0.7, 0.5], [0.4, 0.05, 1.5], [-1.5, 0.05, 3.5], [-5, 0.05, 5.2]], 0.03);
      b.circleCollider(0, 1, 0, 1.2, 2, { surface: 'stone' });
    });
    // solar panels
    b.at(-18, 0, 11, 0, () => {
      for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
        const px = (i - 1) * 1.85, pz = r * 2.2 - 0.5;
        b.box('black', px, 0.9 + (r === 0 ? 0 : 0.05), pz, 1.75, 0.05, 1.05, { rx: 0.55, tint: [0.18, 0.3, 0.55], j: 0.04, tile: 0.6 });
        for (const gx of [-0.58, 0, 0.58]) b.box('steel', px + gx, 0.93, pz - 0.0, 0.025, 0.06, 1.1, { rx: 0.55, tint: [0.9, 0.95, 1] });
        b.box('steel', px, 0.9, pz + 0.0, 1.8, 0.06, 0.04, { rx: 0.55 });
        for (const sx of [-0.8, 0.8]) { b.box('steel', px + sx, 0.4, pz + 0.3, 0.05, 0.8, 0.05); b.box('steel', px + sx, 0.2, pz - 0.35, 0.05, 0.4, 0.05, { rx: 0.3 }); }
      }
      b.solid(0, 0.6, 0.6, 5.6, 1.2, 4.3, { surface: 'metal' });
      P.cable(b, [[2.5, 0.2, 0.0], [3.5, 0.04, 0.5], [8, 0.04, 2.5], [14, 0.04, -2.0]], 0.03);
      b.box('panel', 3.4, 0.5, -0.3, 0.5, 1.0, 0.35, { tint: [0.8, 0.9, 0.8], c: { surface: 'metal' } });
    });
    // generator shed
    b.at(14, 0, -9, 0.15, () => {
      b.box('corrugated', 0, 1.2, 0, 4.2, 2.4, 3.0, { c: { surface: 'metal' }, tint: [0.85, 0.9, 0.85], tile: 2 });
      b.box('corrugated', 0, 2.55, 0, 4.7, 0.12, 3.5, { rx: 0.1, tint: [0.7, 0.75, 0.72] });
      b.box('woodDark', 0, 1.0, 1.52, 1.4, 2.0, 0.08, { tint: [0.55, 0.5, 0.45] }); b.box('steel', 0.5, 1.0, 1.58, 0.1, 0.06, 0.06);
      for (let i = 0; i < 5; i++) b.box('black', 1.6, 1.8 + i * 0.07, 1.52, 0.5, 0.03, 0.03);
      b.cyl('steel', -1.5, 3.3, -0.8, 0.1, 0.1, 1.6, 8);
      b.cyl('steel', -1.5, 4.15, -0.8, 0.16, 0.1, 0.12, 8);
      for (let i = 0; i < 4; i++) P.drum(b, 3.0 + (i % 2) * 0.65, 1.2 + (i >> 1) * 0.65, { tint: [[1, 0.7, 0.6], [0.5, 0.65, 1], [0.7, 0.9, 0.6], [1, 0.8, 0.5]][i] });
      b.box('wood', 3.35, 0.06, 1.55, 1.6, 0.12, 1.5, { tint: [0.7, 0.62, 0.55] });
    });
    // crate stack and tarp
    P.crate(b, -13, -7, 0.15); P.crate(b, -11.8, -7.3, -0.1, { w: 0.8, d: 0.8, h: 0.7 }); P.crate(b, -12.5, -7.1, 0.3, { w: 0.7, d: 0.7, h: 0.6, y: 0.8 });
    P.crate(b, -10.7, -6.0, 0.6, { w: 1.1, d: 0.7, h: 0.6 }); P.barrel(b, -14.6, -6.2);
    b.box('cloth', -12.2, 0.7, -9.0, 2.2, 0.03, 1.4, { rx: 0.7, tint: [0.25, 0.4, 0.6], tile: 1.5 });
    // fence section
    P.fence(b, -25, -13, -12, -13, { kind: 'wire', h: 1.6, holeAt: 3 });
    P.fence(b, -12, -13, -12, -9.5, { kind: 'wire', h: 1.6, decay: 0.1 });
    // weather station
    b.at(-6, 0, 13.5, 0, () => {
      b.cyl('steel', 0, 1.5, 0, 0.04, 0.05, 3.0, 6);
      b.box('steel', 0, 3.0, 0, 0.5, 0.03, 0.03);
      b.box('concrete', 1.4, 0.95, 0, 0.75, 0.6, 0.55, { tint: [1.0, 1.0, 1.0], c: { surface: 'stone' } });
      for (let i = 0; i < 6; i++) b.box('concrete', 1.4, 0.7 + i * 0.1, 0.285, 0.7, 0.02, 0.02, { tint: [0.5, 0.5, 0.5] });
      for (const sx of [-0.3, 0.3]) for (const sz of [-0.2, 0.2]) b.box('steel', 1.4 + sx, 0.33, sz, 0.04, 0.66, 0.04);
      b.circleCollider(0, 1, 0, 0.2, 2, { surface: 'metal' });
    });
    // spinning cups (animated)
    const cupsMat = S.M.steel;
    const cups = new THREE.Group();
    cups.position.set(pad.x - 6, oy + 3.12, oz + 13.5);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU, arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), cupsMat);
      arm.rotation.z = Math.PI / 2; arm.rotation.y = -a; arm.position.set(Math.cos(a) * 0.15, 0, -Math.sin(a) * 0.15);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6, 0, TAU, 0, Math.PI * 0.6), S.M.rust);
      cup.position.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); cup.rotation.x = Math.PI / 2; cup.rotation.z = a;
      cups.add(arm, cup);
    }
    const vane = new THREE.Group(); // wind vane
    const vaneBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), S.M.steel); vaneBody.position.set(0, 0.4, 0);
    const vaneTail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.12), S.M.rust); vaneTail.position.set(-0.22, 0.4, 0);
    vane.add(vaneBody, vaneTail); vane.position.set(pad.x - 6, oy + 3.0, oz + 13.5);
    S.root.add(cups, vane);
    S.anim.push((dt, t) => { cups.rotation.y += dt * (1.2 + Math.sin(t * 0.4)); vane.rotation.y = 0.6 + Math.sin(t * 0.3) * 0.35; });
    cups.children.forEach((c) => { c.castShadow = true; });
    // scrap pile and loose junk near crates
    b.clutter = true;
    for (let i = 0; i < 6; i++) b.box('rust', -9.5 + R3(i, 1) * 1.2, 0.05 + i * 0.01, -4.3 + R3(i, 2) * 1.0, 0.5 + R3(i, 3) * 0.4, 0.04, 0.3 + R3(i, 4) * 0.3, { ry: i * 1.3, rz: R3(i, 5) * 0.2 - 0.1, tile: 1 });
    b.clutter = false;
    S.resource('scrap_s1', 'scrap', [pad.x - 9.2, oy + 0.1, pad.z - 4.1]);
    // service path to shed
    b.box('concrete', 7.5, -0.07, -8.5, 7.0, 0.2, 1.4, { tint: [0.8, 0.8, 0.78], tile: 3 });
  });

  // ---- broken hanging lamp (own object + material: flickers)
  {
    const mat = new THREE.MeshStandardMaterial({ color: 0xddd8c0, emissive: 0xfff0c0, emissiveIntensity: 0.0, roughness: 0.4 });
    const g = new THREE.Group();
    g.position.set(ox - 2.4, oy + 3.0, oz + 2.4);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.12), mat); tube.position.x = 0.65; tube.position.y = -0.02;
    const casing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.2), S.M.steel); casing.position.set(0.65, 0.03, 0);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 4), S.M.black); cord.position.set(1.28, 0.2, 0);
    g.add(tube, casing, cord);
    g.rotation.z = -0.5; g.rotation.y = 0.25;
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    S.root.add(g);
    broken = { mat, g };
    S.anim.push((dt, t) => {
      const n = Math.sin(t * 23) * Math.sin(t * 7.3) + Math.sin(t * 3.1);
      mat.emissiveIntensity = n > 1.1 ? 1.4 : (n > 0.7 ? 0.35 : 0.0);
      g.rotation.z = -0.5 + Math.sin(t * 0.9) * 0.025;
    });
  }

  // ---- player start, beacon, interior zone
  const startL = [-4.6, 0.05, 2.1 + 2]; // B frame offset z=2 → pad frame
  const sx = ox + startL[0], sz = oz + startL[2];
  const dx = (ox - 0.5 + 0.2) - sx, dz = (oz + 2 + 4.35) - sz;
  S.anchor('player.start', [sx, oy + 0.05, sz], Math.atan2(-dx, -dz));
  placeBeacon(S, 'station.beacon', ox + 3.8, oy, oz - 6.8, -0.35, -1, 1);
  S.zone('station.interior', ox, oz + 2, 8.1, 5.1, 0, oy - 1, oy + 3.4, 0.35);
  S.commit(b);
  return { broken };
}

// deterministic pseudo-random helper for clutter placement (independent of builder rand)
function R3(i, k) { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }
