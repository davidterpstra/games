/* =====================================================================
   Photo mode: the world keeps animating, the car freezes, and a free
   orbit camera frames it. Enter saves a PNG of the current view.
   ===================================================================== */
const Photo = { on: false, yaw: 0.6, pitch: 0.18, dist: 7, fov: 40, lift: 0.6, drag: null, resume: null };

function photoEnter() {
  if (Photo.on) return;
  const p = Game.player;
  Photo.on = true;
  Photo.resume = Race.ev ? 'race' : 'drive';
  Photo.yaw = p.h + Math.PI + 0.6; Photo.pitch = 0.16; Photo.dist = 7 + p.spec.len * 0.3; Photo.fov = 40; Photo.lift = 0.6;
  Game.paused = true;
  showScreen(null);
  document.body.classList.add('photo');
  $('photoUi').hidden = false;
  notify('Photo mode', 'Drag or arrows to orbit · wheel to zoom · Enter to save', 'info', 3200);
}
function photoExit() {
  if (!Photo.on) return;
  Photo.on = false;
  document.body.classList.remove('photo');
  $('photoUi').hidden = true;
  Game.camera.fov = 60; Game.camera.updateProjectionMatrix();
  camReset(Game.player);
  resumeGame();
}
function photoKey(code) {
  if (code === 'Escape' || code === 'KeyP') { photoExit(); return true; }
  if (code === 'Enter' || code === 'NumpadEnter') { photoSave(); return true; }
  return false;
}
function photoUpdate(dt, cam) {
  const K = Input.K, p = Game.playerModel.root.position;
  const r = dt * 1.4;
  if (K.ArrowLeft || K.KeyA) Photo.yaw -= r;
  if (K.ArrowRight || K.KeyD) Photo.yaw += r;
  if (K.ArrowUp || K.KeyW) Photo.pitch = clamp(Photo.pitch + r * 0.6, -0.05, 1.35);
  if (K.ArrowDown || K.KeyS) Photo.pitch = clamp(Photo.pitch - r * 0.6, -0.05, 1.35);
  if (K.KeyQ) Photo.lift = clamp(Photo.lift + dt * 1.5, 0, 4);
  if (K.KeyE) Photo.lift = clamp(Photo.lift - dt * 1.5, 0, 4);
  if (K.Equal || K.NumpadAdd) Photo.dist = clamp(Photo.dist - dt * 6, 2.5, 40);
  if (K.Minus || K.NumpadSubtract) Photo.dist = clamp(Photo.dist + dt * 6, 2.5, 40);
  const cx = p.x, cy = p.y + Photo.lift, cz = p.z;
  const cp = Math.cos(Photo.pitch);
  let x = cx + Math.sin(Photo.yaw) * cp * Photo.dist, z = cz + Math.cos(Photo.yaw) * cp * Photo.dist;
  let y = cy + Math.sin(Photo.pitch) * Photo.dist;
  y = Math.max(y, groundAt(x, z, y) + 0.25);
  cam.position.set(x, y, z);
  cam.lookAt(cx, cy, cz);
  if (Math.abs(cam.fov - Photo.fov) > 0.01) { cam.fov = Photo.fov; cam.updateProjectionMatrix(); }
  $('photoFov').value = Photo.fov;
}
function photoSave() {
  // render now and read the canvas in the same task, before the browser composites it
  if (Game.composer) Game.composer.render(); else Game.renderer.render(Game.scene, Game.camera);
  Game.renderer.domElement.toBlob((blob) => {
    if (!blob) { notify('Photo failed', 'The browser blocked the capture', 'bad'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    a.download = `solstice-roads-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    SFX.stunt();
    notify('Photo saved', a.download, 'skill');
  }, 'image/png');
}
function initPhoto() {
  const c = Game.renderer.domElement;
  c.addEventListener('pointerdown', (e) => { if (Photo.on) { Photo.drag = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); } });
  c.addEventListener('pointermove', (e) => {
    if (!Photo.on || !Photo.drag) return;
    Photo.yaw -= (e.clientX - Photo.drag[0]) * 0.006;
    Photo.pitch = clamp(Photo.pitch + (e.clientY - Photo.drag[1]) * 0.004, -0.05, 1.35);
    Photo.drag = [e.clientX, e.clientY];
  });
  c.addEventListener('pointerup', () => { Photo.drag = null; });
  addEventListener('wheel', (e) => { if (Photo.on) Photo.dist = clamp(Photo.dist * (e.deltaY > 0 ? 1.08 : 0.93), 2.5, 40); }, { passive: true });
  $('photoFov').oninput = (e) => { Photo.fov = +e.target.value; };
  $('photoSave').onclick = () => photoSave();
  $('photoExit').onclick = () => photoExit();
  $('pPhoto').onclick = () => photoEnter();
}
