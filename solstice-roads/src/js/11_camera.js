/* =====================================================================
   Camera system: chase, close chase, hood, cockpit, cinematic trackside.
   Speed-sensitive FOV, gentle shake (speed, surface, impacts), terrain
   and tunnel clipping guards. Switching is instant (C).
   ===================================================================== */
const CAM_NAMES = ['Chase', 'Close chase', 'Hood', 'Cockpit', 'Cinematic'];
const Cam = {
  mode: 0, yaw: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 62, trauma: 0, t: 0,
  anchor: null, anchorT: 0, inited: false,
};
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _e1 = new THREE.Euler();

function camReset(car) {
  Cam.yaw = car.h;
  Cam.inited = false;
  Cam.anchor = null;
}
function camSetMode(m, camera) {
  Cam.mode = (m + 5) % 5;
  Cam.inited = false;
  Cam.anchor = null;
  camera.near = Cam.mode === 3 ? 0.05 : Cam.mode === 2 ? 0.1 : 0.25;
  camera.updateProjectionMatrix();
}
function camUpdate(dt, camera, car, model, settings) {
  Cam.t += dt;
  const v = car.speed;
  const kmh = v * 3.6;
  Cam.trauma = Math.max(0, Cam.trauma - dt * 1.6);
  const fs = Math.sin(car.h), fc = Math.cos(car.h);
  // visual position of the car (interpolated root)
  const rp = model.root.position;
  let fovT = 60;
  const shakeOn = settings.shake;
  const rough = SURF[car.surface].bump * (1 - car.spec.offroad * 0.5);
  const shakeAmp = shakeOn ? (Math.min(1, v / 70) * 0.012 + rough * Math.min(1, v / 25) * 0.035 + Cam.trauma * Cam.trauma * 0.25) : 0;
  const sh = (s) => (Math.sin(Cam.t * 31.7 + s) * 0.6 + Math.sin(Cam.t * 17.3 + s * 2.1) * 0.4) * shakeAmp;

  if (Cam.mode === 0 || Cam.mode === 1) {
    const close = Cam.mode === 1;
    // follow a blend of heading and travel direction so drift angle shows
    const vdir = v > 6 && car.vLong > 0 ? Math.atan2(car.vx, car.vz) : car.h;
    const tgt = car.h + wrapAngle(vdir - car.h) * 0.45;
    if (!Cam.inited) Cam.yaw = tgt;
    Cam.yaw += wrapAngle(tgt - Cam.yaw) * (1 - Math.exp(-dt * (close ? 6 : 4.2)));
    const dist = (close ? 4.6 : 6.6) + car.spec.len * 0.35 + Math.min(1.4, v / 45) + (car.spec.style === 'truck' ? 1.2 : 0);
    const height = (close ? 1.45 : 2.05) + car.spec.hgt * 0.35 + (car.spec.style === 'truck' ? 0.6 : 0);
    const sy = Math.sin(Cam.yaw), cy = Math.cos(Cam.yaw);
    _v1.set(rp.x - sy * dist, rp.y + height, rp.z - cy * dist);
    // ground + tunnel guards
    const g = groundAt(_v1.x, _v1.z, rp.y + 2);
    _v1.y = Math.max(_v1.y, g + 0.9);
    const rq = roadAt(_v1.x, _v1.z);
    if (rq && rq.flag === 2 && rq.d < 2) _v1.y = Math.min(_v1.y, rq.y + 5.2);
    if (!Cam.inited) { Cam.pos.copy(_v1); Cam.inited = true; }
    const k = 1 - Math.exp(-dt * 14);
    Cam.pos.lerp(_v1, k);
    Cam.pos.y = Math.max(Cam.pos.y, g + 0.7);
    camera.position.copy(Cam.pos);
    camera.position.x += sh(1); camera.position.y += sh(2) * 0.6;
    _v2.set(rp.x + sy * 4, rp.y + 1.0 + car.spec.hgt * 0.25, rp.z + cy * 4);
    camera.lookAt(_v2);
    fovT = (close ? 64 : 60) + Math.min(18, Math.max(0, kmh - 60) * 0.075);
  } else if (Cam.mode === 2 || Cam.mode === 3) {
    model.root.updateMatrixWorld(true);
    const local = Cam.mode === 2 ? model.hood : model.eye;
    _v1.copy(local);
    model.body.localToWorld(_v1);
    camera.position.copy(_v1);
    model.body.getWorldQuaternion(_q1);
    // forward of the car is +z; three cameras look down -z, so turn 180 deg
    _e1.setFromQuaternion(_q1, 'YXZ');
    _e1.x = -_e1.x * 0.9; _e1.z = -_e1.z * 0.7; _e1.y += Math.PI;
    camera.quaternion.setFromEuler(_e1);
    if (Cam.mode === 3) { camera.rotateY(-car.steerAng * 0.15); }
    camera.position.y += sh(3) * 0.5;
    fovT = (Cam.mode === 3 ? 72 : 66) + Math.min(12, Math.max(0, kmh - 80) * 0.06);
  } else {
    // cinematic trackside camera
    Cam.anchorT -= dt;
    const d = Cam.anchor ? Cam.anchor.distanceTo(rp) : 1e9;
    const behind = Cam.anchor ? ((Cam.anchor.x - rp.x) * car.vx + (Cam.anchor.z - rp.z) * car.vz) < -40 * Math.max(1, v) : true;
    if (!Cam.anchor || d > 85 || behind || Cam.anchorT < -9) {
      const dir = v > 3 ? Math.atan2(car.vx, car.vz) : car.h;
      const ahead = 35 + Math.min(45, v * 1.3);
      const side = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 10);
      const ax = rp.x + Math.sin(dir) * ahead + Math.cos(dir) * side, az = rp.z + Math.cos(dir) * ahead - Math.sin(dir) * side;
      Cam.anchor = new THREE.Vector3(ax, groundAt(ax, az, rp.y + 3) + 1.2 + Math.random() * 3.5, az);
      Cam.anchorT = 0;
    }
    camera.position.copy(Cam.anchor);
    _v2.set(rp.x, rp.y + 0.8, rp.z);
    camera.lookAt(_v2);
    fovT = clamp(55 - (d - 20) * 0.35, 18, 55);
  }
  Cam.fov = damp(Cam.fov, fovT, 4, dt);
  if (Math.abs(camera.fov - Cam.fov) > 0.02) { camera.fov = Cam.fov; camera.updateProjectionMatrix(); }
  model.interior.visible = true;
}
