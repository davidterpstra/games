// PlayerController: first-person walking, sprinting, jumping, swimming-less wading, collision,
// head bob and camera. Physics runs in small sub-steps so nothing tunnels at low frame rates.
import * as THREE from 'three';
import { Settings } from '../core/Settings.js';
import { CollisionWorld, STEP_HEIGHT, PLAYER_RADIUS, PLAYER_HEIGHT } from './Collision.js';

const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7.2;
const GRAVITY = 22;
const JUMP_HEIGHT = 1.1;
const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
const MAX_FALL = 45;
const COYOTE = 0.12;
const JUMP_BUFFER = 0.12;
const EYE_HEIGHT = 1.62;
const SNAP_DOWN = 0.5;
const MAX_SLOPE_COS = Math.cos(THREE.MathUtils.degToRad(46));
const DEEP_WATER = 1.1;
const WATER_SLOW = 0.6;
const MAX_SUBSTEP = 0.2;          // metres per sub-step
const SPRINT_DRAIN = 1 / 6;       // per second
const STAMINA_REGEN = 1 / 4;      // per second
const REGEN_DELAY = 0.8;
const SPRINT_MIN = 0.15;
const JUMP_STAMINA = 0.06;
const MOUSE_BASE = 0.0022;
const PITCH_LIMIT = THREE.MathUtils.degToRad(88);
const STEP_LEN_WALK = 2.0;        // metres between footfalls
const STEP_LEN_SPRINT = 2.5;
const DEFAULT_BOUNDS = { minX: -268, maxX: 268, minZ: -268, maxZ: 268 };

export class PlayerController {
  /**
   * @param {{ camera: THREE.PerspectiveCamera, input: import('./Input.js').Input, world: object, bus: { emit(n: string, p?: any): void } }} opts
   */
  constructor({ camera, input, world, bus }) {
    this.camera = camera;
    this.input = input;
    this.world = world;
    this.bus = bus;
    this.enabled = true;
    this.collision = new CollisionWorld(world);
    this.bounds = world.bounds || DEFAULT_BOUNDS;

    this.state = {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      yaw: 0, pitch: 0,
      onGround: false, sprinting: false, crouching: false,
      stamina: 1, surface: 'grass', inWater: false,
    };

    this._exhausted = false;
    this._sinceSprint = 10;
    this._airTime = 0;
    this._jumpBuffer = 0;
    this._stepPhase = 0;
    this._bobAmp = 0;
    this._bobY = 0;
    this._bobX = 0;
    this._dip = 0;
    this._stepOffset = 0;
    this._fovKick = 0;
    this._slide = { x: 0, z: 0, on: false };
    this._pos2 = { x: 0, z: 0 };
    this._nrm = { x: 0, z: 0 };
    this._ground = { y: 0, collider: null };
    this._good = new THREE.Vector3();
    this._tmpV = new THREE.Vector3();

    camera.rotation.order = 'YXZ';
    this.teleport(new THREE.Vector3(0, world.getHeightAt(0, 0), 0), 0, 0);
  }

  // ---- public API ----------------------------------------------------------------------------

  /** Feet position `position` (y below ground is lifted onto it). */
  teleport(position, yaw = 0, pitch = 0) {
    const s = this.state;
    s.position.set(position.x, position.y, position.z);
    s.velocity.set(0, 0, 0);
    s.yaw = yaw;
    s.pitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
    this.collision.sync();
    const g = this.collision.groundInfoAt(s.position.x, s.position.z, PLAYER_RADIUS, s.position.y, this._ground);
    if (s.position.y <= g.y + 0.05) { s.position.y = g.y; s.onGround = true; } else s.onGround = false;
    s.sprinting = false;
    this._airTime = s.onGround ? 0 : 1;
    this._jumpBuffer = 0;
    this._bobAmp = 0; this._bobY = 0; this._bobX = 0; this._dip = 0; this._stepOffset = 0; this._fovKick = 0;
    this._good.copy(s.position);
    this._updateSurface(g);
    this.input.consumeLook();
    this.input.consumeJump();
    this._applyCamera();
  }

  /** @returns {{ position: number[], yaw: number, pitch: number }} */
  serialize() {
    const s = this.state;
    return { position: [s.position.x, s.position.y, s.position.z], yaw: s.yaw, pitch: s.pitch };
  }

  deserialize(data) {
    const p = data && data.position;
    if (!Array.isArray(p) || p.length < 3 || !p.every(Number.isFinite)) return;
    this.teleport(this._tmpV.set(p[0], p[1], p[2]), Number.isFinite(data.yaw) ? data.yaw : 0, Number.isFinite(data.pitch) ? data.pitch : 0);
  }

  /** Eye position (feet + 1.62 m, without head bob). */
  getEyePosition(out = new THREE.Vector3()) {
    const p = this.state.position;
    return out.set(p.x, p.y + EYE_HEIGHT, p.z);
  }

  /** Unit view direction (includes pitch). */
  getForward(out = new THREE.Vector3()) {
    const { yaw, pitch } = this.state;
    const c = Math.cos(pitch);
    return out.set(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c);
  }

  // ---- update --------------------------------------------------------------------------------

  /** @param {number} dt seconds */
  update(dt) {
    if (!this.enabled) return;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.25);
    const s = this.state;
    const input = this.input;
    this.collision.sync();

    // Look: applied immediately, no smoothing.
    const look = input.consumeLook();
    if (look.dx !== 0 || look.dy !== 0) {
      const sens = MOUSE_BASE * (Settings.get('mouseSensitivity') || 1);
      s.yaw -= look.dx * sens;
      s.pitch -= look.dy * sens * (Settings.get('invertY') ? -1 : 1);
      s.pitch = THREE.MathUtils.clamp(s.pitch, -PITCH_LIMIT, PITCH_LIMIT);
      if (s.yaw > Math.PI * 4 || s.yaw < -Math.PI * 4) s.yaw %= Math.PI * 2;
    }

    // Movement intent
    const mv = input.getMove();
    const mag = Math.min(1, Math.hypot(mv.x, mv.z));
    const sinY = Math.sin(s.yaw), cosY = Math.cos(s.yaw);
    let wx = 0, wz = 0;
    if (mag > 0.001) {
      wx = cosY * mv.x - sinY * mv.z;
      wz = -sinY * mv.x - cosY * mv.z;
      const l = Math.hypot(wx, wz) || 1;
      wx /= l; wz /= l;
    }

    // Stamina / sprint
    let sprinting = input.sprint && mag > 0.1 && mv.z > 0.1;
    if (this._exhausted && s.stamina >= SPRINT_MIN) this._exhausted = false;
    if (sprinting && !s.sprinting && (this._exhausted || s.stamina < SPRINT_MIN)) sprinting = false;
    if (sprinting) {
      s.stamina -= SPRINT_DRAIN * dt;
      this._sinceSprint = 0;
      if (s.stamina <= 0) { s.stamina = 0; this._exhausted = true; sprinting = false; }
    } else {
      this._sinceSprint += dt;
      if (this._sinceSprint > REGEN_DELAY) s.stamina = Math.min(1, s.stamina + STAMINA_REGEN * dt);
    }
    s.sprinting = sprinting;

    // Jump (buffered, with coyote time)
    if (input.consumeJump()) this._jumpBuffer = JUMP_BUFFER; else this._jumpBuffer = Math.max(0, this._jumpBuffer - dt);
    if (this._jumpBuffer > 0 && (s.onGround || this._airTime < COYOTE)) {
      s.velocity.y = JUMP_VELOCITY;
      s.onGround = false;
      this._airTime = 1;
      this._jumpBuffer = 0;
      s.stamina = Math.max(0, s.stamina - JUMP_STAMINA);
      this._sinceSprint = Math.min(this._sinceSprint, 0);
      this.bus.emit('player:jump', {});
    }

    // Steep ground slides the player down (terrain only)
    this._slide.on = false;
    if (s.onGround && !this._ground.collider) {
      const n = this.world.getNormalAt(s.position.x, s.position.z);
      if (n.y < MAX_SLOPE_COS) {
        const l = Math.hypot(n.x, n.z) || 1;
        this._slide.x = n.x / l; this._slide.z = n.z / l; this._slide.on = true;
      }
    }

    const speed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * mag * (s.inWater ? WATER_SLOW : 1);
    const tvx = wx * speed, tvz = wz * speed;

    // Sub-stepping
    const horiz = Math.max(Math.hypot(s.velocity.x, s.velocity.z), speed);
    const n = Math.min(40, Math.max(1, Math.ceil(Math.max(horiz, Math.abs(s.velocity.y)) * dt / MAX_SUBSTEP)));
    const h = dt / n;
    const startY = s.position.y, wasGround = s.onGround;
    const sx = s.position.x, sz = s.position.z;
    let impact = 0;
    const hasInput = mag > 0.001;
    for (let i = 0; i < n; i++) {
      const imp = this._substep(h, tvx, tvz, hasInput);
      if (imp > impact) impact = imp;
    }

    if (s.onGround) this._airTime = 0; else this._airTime += dt;

    // Surface, water
    const g = this._ground;
    this._updateSurface(g);

    if (impact > 3) {
      this._dip = -Math.min(0.22, impact * 0.016);
      this.bus.emit('player:land', { impact });
    }

    // Camera-only smoothing of stair/slope steps
    if (wasGround && s.onGround) {
      const dy = s.position.y - startY;
      if (Math.abs(dy) > 0.02 && Math.abs(dy) <= SNAP_DOWN + 0.05) this._stepOffset = THREE.MathUtils.clamp(this._stepOffset - dy, -0.6, 0.6);
    }
    this._stepOffset *= Math.exp(-12 * dt);
    this._dip *= Math.exp(-9 * dt);

    // Footsteps + head bob
    const dist = Math.hypot(s.position.x - sx, s.position.z - sz);
    const spd = dist / dt;
    if (s.onGround && spd > 0.5) {
      const prev = this._stepPhase;
      this._stepPhase += dist / (sprinting ? STEP_LEN_SPRINT : STEP_LEN_WALK);
      if (Math.floor(this._stepPhase) !== Math.floor(prev)) this.bus.emit('player:step', { surface: s.surface, sprint: sprinting });
    }
    const bobOn = Settings.get('headBob') !== false;
    const targetAmp = bobOn && s.onGround && spd > 0.5 ? (sprinting ? 0.05 : 0.03) * Math.min(1, spd / WALK_SPEED) : 0;
    this._bobAmp += (targetAmp - this._bobAmp) * (1 - Math.exp(-10 * dt));
    this._bobY = -this._bobAmp * Math.cos(this._stepPhase * Math.PI * 2);
    this._bobX = this._bobAmp * 0.6 * Math.sin(this._stepPhase * Math.PI);

    this._fovKick += ((sprinting && spd > 3 ? 1 : 0) - this._fovKick) * (1 - Math.exp(-6 * dt));

    // NaN guard
    const p = s.position, v = s.velocity;
    if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z)) {
      p.copy(this._good); v.set(0, 0, 0);
    } else this._good.copy(p);

    this._applyCamera();
  }

  // ---- internals -----------------------------------------------------------------------------

  /** One physics sub-step. Returns the fall impact speed if it landed during this step. */
  _substep(h, tvx, tvz, hasInput) {
    const s = this.state, p = s.position, v = s.velocity;
    const R = PLAYER_RADIUS;
    const wasGround = s.onGround;

    // Horizontal velocity
    const k = wasGround ? (hasInput ? 14 : 11) : (hasInput ? 2.6 : 0.35);
    const a = 1 - Math.exp(-k * h);
    v.x += (tvx - v.x) * a;
    v.z += (tvz - v.z) * a;
    if (this._slide.on && wasGround) { v.x += this._slide.x * 16 * h; v.z += this._slide.z * 16 * h; }

    // Horizontal move with terrain gating (cliffs, steep slopes, deep water)
    let nx = p.x + v.x * h, nz = p.z + v.z * h;
    if (this._terrainBlocked(p.x, p.z, nx, nz, p.y)) {
      if (!this._terrainBlocked(p.x, p.z, nx, p.z, p.y)) { nz = p.z; v.z = 0; }
      else if (!this._terrainBlocked(p.x, p.z, p.x, nz, p.y)) { nx = p.x; v.x = 0; }
      else { nx = p.x; nz = p.z; v.x = 0; v.z = 0; }
    }
    const b = this.bounds;
    if (nx < b.minX) { nx = b.minX; v.x = Math.max(0, v.x); } else if (nx > b.maxX) { nx = b.maxX; v.x = Math.min(0, v.x); }
    if (nz < b.minZ) { nz = b.minZ; v.z = Math.max(0, v.z); } else if (nz > b.maxZ) { nz = b.maxZ; v.z = Math.min(0, v.z); }

    // Colliders
    const pos = this._pos2, nrm = this._nrm;
    pos.x = nx; pos.z = nz;
    if (this.collision.resolve(pos, p.y, R, PLAYER_HEIGHT, nrm)) {
      const nl = Math.hypot(nrm.x, nrm.z);
      if (nl > 1e-6) {
        const ux = nrm.x / nl, uz = nrm.z / nl;
        const vn = v.x * ux + v.z * uz;
        if (vn < 0) { v.x -= vn * ux; v.z -= vn * uz; }
      }
      if (this._terrainBlocked(p.x, p.z, pos.x, pos.z, p.y) && !this._terrainBlocked(p.x, p.z, p.x, p.z, p.y)) { pos.x = p.x; pos.z = p.z; }
      nx = pos.x; nz = pos.z;
    }
    p.x = nx; p.z = nz;

    // Vertical
    const prevFeet = p.y;
    if (wasGround && v.y < 0) v.y = 0;
    const vy0 = v.y;
    let dy = vy0 * h - 0.5 * GRAVITY * h * h;
    v.y = Math.max(-MAX_FALL, vy0 - GRAVITY * h);
    let feet = prevFeet + dy;
    if (dy > 0) {
      const ceil = this.collision.ceilingAt(p.x, p.z, R, prevFeet + PLAYER_HEIGHT);
      if (feet + PLAYER_HEIGHT > ceil) { feet = ceil - PLAYER_HEIGHT; if (v.y > 0) v.y = 0; }
    }
    const g = this.collision.groundInfoAt(p.x, p.z, R, prevFeet, this._ground);
    let impact = 0;
    if (feet <= g.y + 1e-5) {
      if (v.y <= 0) { if (!wasGround) impact = -v.y; v.y = 0; s.onGround = true; } else s.onGround = false;
      feet = g.y;
    } else if (wasGround && v.y <= 0 && feet - g.y <= SNAP_DOWN) {
      feet = g.y; v.y = 0; s.onGround = true;
    } else s.onGround = false;
    p.y = feet;
    return impact;
  }

  /** True if moving from (ox,oz) to (nx,nz) at feet height `feet` is stopped by terrain rules. */
  _terrainBlocked(ox, oz, nx, nz, feet) {
    if (nx === ox && nz === oz) return false;
    const w = this.world;
    const th = w.getHeightAt(nx, nz);
    if (th - feet > STEP_HEIGHT) return true;
    const ws = w.getWaterSurfaceAt(nx, nz);
    if (ws !== null && ws !== undefined && ws - th > DEEP_WATER && feet < ws + 0.05) {
      const wo = w.getWaterSurfaceAt(ox, oz);
      const oldDeep = wo !== null && wo !== undefined && wo - w.getHeightAt(ox, oz) > DEEP_WATER;
      if (!oldDeep) return true;
    }
    if (th > feet + 0.01) {
      const n = w.getNormalAt(nx, nz);
      if (n.y < MAX_SLOPE_COS) return true;
    }
    return false;
  }

  _updateSurface(g) {
    const s = this.state, w = this.world, p = s.position;
    const ws = w.getWaterSurfaceAt(p.x, p.z);
    s.inWater = !g.collider && ws !== null && ws !== undefined && p.y < ws - 0.1;
    if (s.inWater) s.surface = 'water';
    else if (g.collider && g.collider.surface) s.surface = g.collider.surface;
    else s.surface = g.collider ? 'stone' : w.getSurfaceAt(p.x, p.z);
  }

  _applyCamera() {
    const s = this.state, cam = this.camera, p = s.position;
    cam.position.set(
      p.x + Math.cos(s.yaw) * this._bobX,
      p.y + EYE_HEIGHT + this._stepOffset + this._bobY + this._dip,
      p.z - Math.sin(s.yaw) * this._bobX,
    );
    cam.rotation.order = 'YXZ';
    cam.rotation.set(s.pitch, s.yaw, 0);
    const fov = (Settings.get('fov') || 75) + 4 * this._fovKick;
    if (Math.abs(cam.fov - fov) > 0.005) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }
}
