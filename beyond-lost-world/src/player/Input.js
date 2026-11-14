// Input: keyboard, mouse look with pointer lock, and (on touch devices) on-screen controls.
// The controller polls getMove()/consumeLook()/consumeJump(); one-shot actions go out on the bus
// as 'input:action' { action }. Pointer-lock changes go out as 'input:pointerlock' { locked }.
import { TouchControls } from './TouchControls.js';

const ACTION_KEYS = {
  KeyE: 'interact', Tab: 'inventory', KeyI: 'inventory', KeyM: 'map',
  KeyF: 'torch', Escape: 'pause', Space: 'jump',
};
const PREVENT_DEFAULT = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const MAX_LOOK_DELTA = 300; // px; larger single-event deltas are a known Chromium pointer-lock glitch

function isEditable(t) {
  if (!t || !t.tagName) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t.isContentEditable === true;
}

export class Input {
  /**
   * @param {{ domElement: HTMLElement, bus: { emit(name: string, payload?: any): void } }} opts
   */
  constructor({ domElement, bus }) {
    this.domElement = domElement;
    this.bus = bus;
    this.keys = new Set();
    this.wantLock = false;
    this._locked = false;
    this._enabled = false; // main switches this on when play starts
    this._lookX = 0;
    this._lookY = 0;
    this._jumpLatch = false;
    this._move = { x: 0, z: 0 };
    this._look = { dx: 0, dy: 0 };
    // touch state (written by TouchControls)
    this.touchMove = { x: 0, z: 0 };
    this.touchRun = false;
    this.touchSprint = false;
    this.touch = null;

    const mq = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;
    this.isTouch = !!(mq && mq.matches) || (typeof window !== 'undefined' && 'ontouchstart' in window && (navigator.maxTouchPoints || 0) > 0 && !(typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches));

    this._onKeyDown = (e) => this._keyDown(e);
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onBlur = () => { this.keys.clear(); this.touch?.release(); };
    this._onMouseMove = (e) => this._mouseMove(e);
    this._onLockChange = () => this._lockChange();
    this._onClick = () => { if (this.wantLock && !this.isTouch && !this._locked) this._requestLock(); };
    this._onPointerDown = (e) => { if (e.pointerType === 'touch' && !this.isTouch && !this._locked) this._enableTouch(); };
    this._onContext = (e) => { if (this._locked) e.preventDefault(); };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onLockChange);
    domElement.addEventListener('click', this._onClick);
    domElement.addEventListener('contextmenu', this._onContext);
    window.addEventListener('pointerdown', this._onPointerDown, true);

    if (this.isTouch) this._enableTouch();
  }

  _enableTouch() {
    this.isTouch = true;
    if (!this.touch) this.touch = new TouchControls(this);
    this.touch.setVisible(this._enabled);
  }

  // ---- enabled -------------------------------------------------------------------------------
  get enabled() { return this._enabled; }
  set enabled(v) {
    v = !!v;
    if (v === this._enabled) return;
    this._enabled = v;
    this._lookX = this._lookY = 0;
    this._jumpLatch = false;
    if (!v) this.touch?.release();
    this.touch?.setVisible(v);
  }

  // ---- keyboard ------------------------------------------------------------------------------
  _keyDown(e) {
    if (isEditable(e.target)) return;
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    const action = ACTION_KEYS[e.code];
    if (action) this.emitAction(action);
  }

  /** Emits a one-shot action (also used by the touch buttons). */
  emitAction(action) {
    if (action === 'jump' && this._enabled) this._jumpLatch = true;
    this.bus.emit('input:action', { action });
  }

  /** @param {string} code KeyboardEvent.code */
  isDown(code) { return this.keys.has(code); }

  /** True when Shift is held, the touch sprint toggle is on, or the joystick is pushed to the rim. */
  get sprint() {
    if (!this._enabled) return false;
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint || this.touchRun;
  }

  /** Movement intent: x = strafe right, z = forward, each −1..1. Returns a shared object. */
  getMove() {
    const m = this._move;
    m.x = 0; m.z = 0;
    if (!this._enabled) return m;
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let z = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    if (this.touchMove.x !== 0 || this.touchMove.z !== 0) { x = this.touchMove.x; z = this.touchMove.z; }
    m.x = x; m.z = z;
    return m;
  }

  /** Returns true once per jump press (keyboard or touch). */
  consumeJump() {
    const j = this._jumpLatch && this._enabled;
    this._jumpLatch = false;
    return j;
  }

  // ---- mouse look ----------------------------------------------------------------------------
  _mouseMove(e) {
    if (!this._locked) return;
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    if (Math.abs(dx) > MAX_LOOK_DELTA || Math.abs(dy) > MAX_LOOK_DELTA) return;
    this._lookX += dx;
    this._lookY += dy;
  }

  /** Adds look pixels (touch drag). */
  addLook(dx, dy) { this._lookX += dx; this._lookY += dy; }

  /** Accumulated look pixels since the last call, then reset. Returns a shared object. */
  consumeLook() {
    const l = this._look;
    if (this._enabled) { l.dx = this._lookX; l.dy = this._lookY; } else { l.dx = 0; l.dy = 0; }
    this._lookX = 0; this._lookY = 0;
    return l;
  }

  // ---- pointer lock --------------------------------------------------------------------------
  get isLocked() { return this.isTouch ? this.wantLock : this._locked; }

  _requestLock() {
    try {
      const p = this.domElement.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* refused (e.g. right after Esc); the next click retries */ }
  }

  /** Request pointer lock (call from a user gesture). Re-requested on click while wanted but lost. */
  lock() {
    this.wantLock = true;
    if (this.isTouch) { this.bus.emit('input:pointerlock', { locked: true }); return; }
    if (!this._locked) this._requestLock();
  }

  unlock() {
    const was = this.isLocked;
    this.wantLock = false;
    if (this.isTouch) { if (was) this.bus.emit('input:pointerlock', { locked: false }); return; }
    if (document.pointerLockElement === this.domElement) document.exitPointerLock();
  }

  _lockChange() {
    const locked = document.pointerLockElement === this.domElement;
    if (locked === this._locked) return;
    this._locked = locked;
    this._lookX = this._lookY = 0;
    this.bus.emit('input:pointerlock', { locked });
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    this.domElement.removeEventListener('click', this._onClick);
    this.domElement.removeEventListener('contextmenu', this._onContext);
    window.removeEventListener('pointerdown', this._onPointerDown, true);
    this.touch?.dispose();
    this.touch = null;
    if (document.pointerLockElement === this.domElement) document.exitPointerLock();
  }
}
