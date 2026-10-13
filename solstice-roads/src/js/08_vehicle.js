/* =====================================================================
   Vehicle physics — an arcade/simulation hybrid.
   - fixed 120 Hz step (see Physics.update), render interpolation
   - two-axle "bicycle" tyre model, saturating slip curve (peak ~9.5 deg,
     ~85% when sliding) so drifts are holdable but not automatic
   - longitudinal weight transfer, aero drag + downforce, friction circle
     on the driven axle (wheelspin -> power oversteer), handbrake
   - automatic gearbox driving rpm (sound, HUD) and the power curve
   - per-wheel surfaces (asphalt, gravel, grass, mud, snow, water), wet grip
   - slope gravity, suspension visuals, jumps/landings, collisions
   Same code drives the player and every AI opponent.
   ===================================================================== */
const G = 9.81;
const PH_DT = 1 / 120;
const WEIGHT_FRONT = { wedge: 0.42, hyper: 0.41, gt: 0.52, coupe: 0.53, muscle: 0.55, hatch: 0.6, truck: 0.5 };

const _n = new THREE.Vector3();
const _colList = [];

class Vehicle {
  constructor(spec, isPlayer = false) {
    this.spec = spec;
    this.isPlayer = isPlayer;
    this.m = spec.mass;
    this.L = spec.wb;
    const wf = WEIGHT_FRONT[spec.style] ?? 0.5;
    this.a = this.L * (1 - wf); // CG -> front axle
    this.b = this.L * wf; // CG -> rear axle
    this.I = this.m * (this.a * this.a + this.b * this.b) * 0.62;
    this.P = spec.power * 1000;
    this.vmax = spec.vmax / 3.6;
    this.kd = Math.max(0.2, (this.P * 0.96 - 0.012 * this.m * G * this.vmax) / this.vmax ** 3);
    this.kdf = this.m * G * (spec.wing ? 0.75 : 0.4) / (this.vmax * this.vmax);
    this.hw = spec.wid / 2 * 0.96; this.hl = spec.len / 2 * 0.97;
    this.gears = spec.style === 'hyper' ? 7 : spec.style === 'truck' ? 5 : 6;
    this.gearTop = [];
    for (let i = 0; i < this.gears; i++) this.gearTop.push(this.vmax * 1.05 * (0.3 + 0.7 * Math.pow(i / (this.gears - 1), 1.22)));
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.wheelSurf = [0, 0, 0, 0];
    this.wheelPos = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    this.wheelSlip = [0, 0, 0, 0];
    this.susp = [0, 0, 0, 0];
    this.reset(0, 0, 0);
  }
  reset(x, z, h) {
    this.x = x; this.z = z; this.h = h;
    this.y = groundAt(x, z, 1e9) + 0.02;
    this.vx = 0; this.vz = 0; this.vy = 0; this.w = 0;
    this.steerAng = 0; this.gear = 0; this.rpm = this.spec.eng.idle; this.shiftT = 0;
    this.air = false; this.airT = 0; this.ax = 0; this.ay = 0;
    this.gPitch = 0; this.gRoll = 0; this.dPitch = 0; this.dRoll = 0; this.dPitchV = 0; this.dRollV = 0;
    this.spin = 0; this.speed = 0; this.vLong = 0; this.vLat = 0; this.slip = 0; this.wheelspin = 0;
    this.water = 0; this.waterT = 0; this.surface = 0; this.reverse = false; this.revT = 0;
    this.hit = 0; this.landing = 0; this.groundY = this.y; this.gvy = 0;
    this.prev = { x, y: this.y, z, h, p: 0, r: 0 };
    this.odo = 0;
  }
  savePrev() { const p = this.prev; p.x = this.x; p.y = this.y; p.z = this.z; p.h = this.h; }

  step(dt, settings) {
    const sp = this.spec, inp = this.input;
    const fs = Math.sin(this.h), fc = Math.cos(this.h); // forward (fs, fc), left (fc, -fs)
    let vLong = this.vx * fs + this.vz * fc, vLat = this.vx * fc - this.vz * fs;
    const v = Math.hypot(this.vx, this.vz);

    // ---- wheel contacts & surfaces ----
    let muF = 0, muR = 0, rr = 0;
    const off = sp.offroad, wet = Math.min(1, Sky.wet + (Sky.snowCover || 0) * 1.4);
    for (let i = 0; i < 4; i++) {
      const lx = (i & 1 ? -1 : 1) * sp.track / 2, lz = i < 2 ? this.a : -this.b;
      const wx = this.x + fc * lx + fs * lz, wz = this.z - fs * lx + fc * lz;
      const s = surfAt(wx, wz);
      this.wheelSurf[i] = s;
      const wp = this.wheelPos[i];
      wp[0] = wx; wp[2] = wz; wp[1] = groundAt(wx, wz, this.y + 0.3);
      const S = SURF[s];
      let mu = s === S_ASPHALT || s === S_PAVED ? S.mu * (1 - 0.12 * off) * (1 - 0.17 * wet) : lerp(S.mu, 0.95, off * 0.65) * (1 - 0.1 * wet);
      if (s === S_SNOW) mu = lerp(S.mu, 0.8, off * 0.5);
      if (i < 2) muF += mu * 0.5; else muR += mu * 0.5;
      rr += (s === S_ASPHALT || s === S_PAVED ? S.rr : S.rr * (1 - off * 0.6)) * 0.25;
    }
    this.surface = this.wheelSurf[2];
    muF *= sp.mu; muR *= sp.mu * sp.rearGrip;

    // ---- vertical: follow the ground, or fly ----
    const gy = (this.wheelPos[0][1] + this.wheelPos[1][1] + this.wheelPos[2][1] + this.wheelPos[3][1]) / 4;
    // the ground can only rise/fall as fast as the slope allows at this speed (filters grid seams)
    const gvLim = v * 0.45 + 1.5;
    const gvy = clamp((gy - this.groundY) / dt, -gvLim, gvLim);
    this.groundY = gy;
    if (!this.air) {
      const prevVy = this.gvy;
      // suspension keeps the tyres planted unless the ground falls away much faster than gravity + downforce
      const downA = G + this.kdf * v * v / this.m;
      const groundAcc = (gvy - prevVy) / dt;
      if (v > 9 && groundAcc < -downA * 2.6 && this.y > gy + 0.05) { this.air = true; this.vy = prevVy * 0.6; this.airT = 0; }
      else { this.y = gy; this.gvy = lerp(this.gvy, gvy, 0.5); this.vy = this.gvy; }
    }
    if (this.air) {
      this.airT += dt;
      this.vy -= G * dt;
      this.y += this.vy * dt;
      if (this.y <= gy) {
        this.landing = Math.max(0, -(this.vy - gvy));
        this.y = gy; this.air = false; this.gvy = gvy; this.vy = gvy;
        if (this.landing > 4) Bus.emit('land', { car: this, v: this.landing });
      }
    }
    // ground orientation
    groundNormal(this.x, this.z, this.y + 1, _n);
    const hF = (this.wheelPos[0][1] + this.wheelPos[1][1]) / 2, hR = (this.wheelPos[2][1] + this.wheelPos[3][1]) / 2;
    const hL = (this.wheelPos[0][1] + this.wheelPos[2][1]) / 2, hRt = (this.wheelPos[1][1] + this.wheelPos[3][1]) / 2;
    if (!this.air) {
      this.gPitch = -Math.atan2(hF - hR, this.L);
      this.gRoll = Math.atan2(hL - hRt, sp.track);
    }

    // rotation rate of the velocity vector (used by the drift controller)
    const velAng = Math.atan2(this.vx, this.vz);
    this.wVel = v > 3 && this.velAng !== undefined ? lerp(this.wVel || 0, wrapAngle(velAng - this.velAng) / dt, 0.25) : 0;
    this.velAng = velAng;
    // ---- steering ----
    const beta = v > 3 ? Math.atan2(vLat, Math.abs(vLong) + 0.5) : 0;
    // drift intent: a handbrake flick, or holding a slide with opposite lock and throttle
    if (inp.handbrake > 0 && v > 8) this.driftT = 1.2;
    else if (this.driftT > 0 && Math.abs(beta) > 0.15 && inp.throttle > 0.3 && v > 7) this.driftT = Math.max(this.driftT, 0.5);
    else if (Math.abs(beta) > 0.3 && inp.throttle > 0.5 && inp.steer * this.w < 0 && v > 8) this.driftT = Math.max(this.driftT || 0, 0.5);
    this.driftT = Math.max(0, (this.driftT || 0) - dt);
    let steerMax = sp.steer / (1 + (v / 22) ** 2) + 0.03;
    if (settings.assist && v > 6 && !this.driftT) steerMax = Math.min(steerMax, this.L * muF * G / (v * v) + 0.2);
    let target = inp.steer * steerMax;
    if (settings.assist && v > 7 && vLong > 0) target += clamp(beta * 0.55, -0.4, 0.4) * smoothstep(0.06, 0.25, Math.abs(beta));
    const rate = Math.abs(target) < Math.abs(this.steerAng) ? 7 : 5;
    this.steerAng += clamp(target - this.steerAng, -rate * dt, rate * dt);
    const d = this.steerAng;

    // ---- engine, gearbox ----
    const eng = sp.eng;
    if (this.shiftT > 0) this.shiftT -= dt;
    let throttle = inp.throttle, brake = inp.brake;
    // brake-to-reverse
    if (!this.reverse && brake > 0.5 && vLong < 0.8 && throttle < 0.1) { this.revT += dt; if (this.revT > 0.3) this.reverse = true; }
    else if (this.reverse && (throttle > 0.1 || vLong > 1)) { this.reverse = false; this.revT = 0; }
    else if (brake < 0.5) this.revT = 0;
    if (this.reverse) { throttle = brake; brake = inp.throttle; }
    const gTop = this.gearTop[this.gear];
    const absV = Math.abs(vLong);
    let rpmT = eng.idle + (eng.red - eng.idle) * clamp(absV / gTop, 0, 1.04);
    const slipRev = (this.wheelspin * 0.6 + (this.air ? 0.4 : 0)) * throttle;
    rpmT = Math.max(rpmT, eng.idle + throttle * (eng.red * 0.62 - eng.idle) * (1 - smoothstep(2, 9, absV)));
    rpmT = Math.min(eng.red * 1.02, rpmT + slipRev * eng.red * 0.35);
    this.rpm = damp(this.rpm, rpmT, this.shiftT > 0 ? 10 : 18, dt);
    if (!this.reverse && this.shiftT <= 0 && !this.air) {
      if (this.rpm > eng.red * 0.95 && this.gear < this.gears - 1 && absV > gTop * 0.9) { this.gear++; this.shiftT = 0.16; Bus.emit('shift', { car: this, up: true }); }
      else if (this.gear > 0 && absV < this.gearTop[this.gear - 1] * 0.62) { this.gear--; this.shiftT = 0.1; Bus.emit('shift', { car: this, up: false }); }
    }
    if (this.reverse) this.gear = 0;
    const r = clamp(this.rpm / eng.red, 0.05, 1.05);
    const pc = Math.pow(Math.sin(Math.min(1, r * 1.06) * Math.PI / 2), 0.75) * (r > 1 ? 0.6 : 1);
    let drive = 0;
    if (this.shiftT <= 0 || this.reverse) {
      const launch = clamp(this.P / this.m / 260, 0.5, 1.25); // power-to-weight limits low-speed thrust
      drive = throttle * Math.min(this.P * pc / Math.max(absV, 4.5), this.m * G * launch);
      if (this.reverse) drive = -throttle * this.m * G * 0.45 * (1 - smoothstep(10, 15, absV));
    }

    // ---- loads ----
    const down = this.kdf * v * v;
    const Nt = this.m * G * _n.y + down;
    const hcg = sp.cg;
    let Nf = Nt * this.b / this.L - this.m * this.ax * hcg / this.L;
    let Nr = Nt * this.a / this.L + this.m * this.ax * hcg / this.L;
    Nf = Math.max(Nf, Nt * 0.12); Nr = Math.max(Nr, Nt * 0.12);

    // ---- longitudinal forces, split to axles ----
    const fShare = sp.drive === 'AWD' ? sp.front : sp.drive === 'FWD' ? 1 : 0;
    let FxF = drive * fShare, FxR = drive * (1 - fShare);
    // traction limit (wheelspin); tyres hold a little more longitudinally than laterally
    const capR = muR * Nr, capF = muF * Nf;
    const capRL = capR * 1.12, capFL = capF * 1.12;
    this.wheelspin = 0;
    if (Math.abs(FxR) > capRL) { this.wheelspin = Math.min(1, Math.abs(FxR) / capRL - 1); FxR = Math.sign(FxR) * capRL; }
    if (Math.abs(FxF) > capFL) { this.wheelspin = Math.max(this.wheelspin, Math.min(1, Math.abs(FxF) / capFL - 1)); FxF = Math.sign(FxF) * capFL; }
    // traction control on the steered axle: keep grip in reserve so the car still turns under power
    if (settings.assist && Math.abs(FxF) > capF * 0.6) {
      const spare = Math.abs(FxF) - capF * 0.6;
      FxF = Math.sign(FxF) * capF * 0.6;
      FxR = Math.sign(FxR || FxF) * Math.min(capRL, Math.abs(FxR) + spare);
    }
    // brakes (with ABS-like limiting)
    if (brake > 0 && absV > 0.05) {
      const bF = brake * sp.brake * this.m * G * 1.05;
      const sg = Math.sign(vLong);
      FxF -= sg * Math.min(bF * 0.64, capF * 0.97);
      FxR -= sg * Math.min(bF * 0.36, capR * 0.97);
    }
    let hbLock = 0;
    if (inp.handbrake > 0 && absV > 0.3) { FxR -= Math.sign(vLong) * capR * 0.55 * inp.handbrake; hbLock = inp.handbrake; }

    // ---- lateral tyre forces ----
    let Fyf = 0, Fyr = 0;
    if (!this.air) {
      const vx_ = Math.max(Math.abs(vLong), 2.5);
      const af = Math.atan2(vLat + this.w * this.a, vx_) - d * Math.sign(vLong || 1);
      const ar = Math.atan2(vLat - this.w * this.b, vx_);
      const curve = (al) => Math.sin(1.45 * Math.atan(11 * al));
      Fyf = -capF * curve(af);
      const useR = clamp(Math.abs(FxR) / Math.max(1, capR), 0, 0.97);
      const latR = Math.sqrt(1 - useR * useR) * (1 - 0.5 * hbLock);
      // drift sustain: while drifting, throttle keeps the rear loose; lift and it grips up
      const sustain = this.driftT > 0 && Math.abs(beta) > 0.12 ? 1 - 0.35 * throttle : 1;
      Fyr = -capR * curve(ar) * Math.max(0.12, latR) * sustain;
      const useF = clamp(Math.abs(FxF) / Math.max(1, capF), 0, 0.97);
      Fyf *= Math.max(settings.assist ? 0.55 : 0.2, Math.sqrt(1 - useF * useF));
      this.slip = ar;
      this.slipF = af;
    } else { FxF = FxR = 0; }

    // ---- resistances ----
    const drag = this.kd * v * v + rr * this.m * G * (this.air ? 0 : 1);
    const dragX = v > 0.01 ? drag * vLong / v : 0, dragY = v > 0.01 ? drag * vLat / v : 0;
    let Fx = FxF * Math.cos(d) + FxR - Fyf * Math.sin(d) - dragX;
    let Fy = Fyf * Math.cos(d) + Fyr + FxF * Math.sin(d) - dragY;
    // slope gravity (pulls downhill)
    const gx = G * _n.y * _n.x, gz = G * _n.y * _n.z;
    let ax = (fs * Fx + fc * Fy) / this.m + (this.air ? 0 : gx);
    let az = (fc * Fx - fs * Fy) / this.m + (this.air ? 0 : gz);
    // hold still on slopes when braking / idle at a standstill
    if (!this.air && v < 0.6 && throttle < 0.05 && (brake > 0.1 || inp.handbrake > 0.1 || v < 0.15)) { ax = -this.vx / dt * 0.5; az = -this.vz / dt * 0.5; }
    this.vx += ax * dt; this.vz += az * dt;
    // yaw
    const torque = this.a * Fyf * Math.cos(d) - this.b * Fyr;
    if (!this.air) {
      this.w += torque / this.I * dt;
      this.w *= 1 - dt * (0.6 + v * 0.012); // yaw damping (stability)
      if (settings.assist && v > 6) {
        if (!this.driftT) {
          // stability control: steering alone never spins the car
          const exc = Math.max(0, Math.abs(beta) - 0.1);
          this.w += Math.sign(beta) * exc * 9 * dt;
          // steering response: pull the yaw rate towards what the front wheels ask for,
          // limited by the grip available, so the car turns whether or not you're on the gas
          if (Math.abs(beta) < 0.35 && vLong > 0) {
            const wMax = muF * G * 0.95 / Math.max(v, 1);
            const wT = clamp(vLong * Math.tan(d) / this.L, -wMax, wMax);
            this.w = lerp(this.w, wT, 1 - Math.exp(-3.2 * dt));
          }
        } else if (Math.abs(beta) > 0.12 && throttle > 0.3 && !inp.handbrake) {
          // drift steering: with throttle held, steering sets the slide angle
          const dir = Math.sign(beta);
          const into = clamp(-inp.steer * dir, -1, 1); // +1 = steering into the turn
          const bt = dir * clamp(0.45 + 0.28 * into, 0.12, 0.8);
          // beta = velocityAngle - heading, so d(beta)/dt = wVel - w; drive beta towards bt
          const wDes = this.wVel + 3.0 * (beta - bt);
          this.w = lerp(this.w, wDes, 1 - Math.exp(-7 * dt));
        } else {
          const exc = Math.max(0, Math.abs(beta) - 0.9);
          this.w += Math.sign(beta) * exc * 12 * dt;
        }
      }
      // low speed: blend to a kinematic model so parking speeds are clean
      const k = smoothstep(1.5, 6, v);
      const wKin = vLong * Math.tan(d) / this.L;
      this.w = lerp(wKin, this.w, k);
      if (k < 1) {
        const vl2 = vLat * k;
        vLong = this.vx * fs + this.vz * fc;
        this.vx = fs * vLong + fc * vl2; this.vz = fc * vLong - fs * vl2;
      }
    } else this.w *= 1 - dt * 0.3;
    this.h += this.w * dt;
    // longitudinal accel for weight transfer + visuals
    const nfs = Math.sin(this.h), nfc = Math.cos(this.h);
    const nvl = this.vx * nfs + this.vz * nfc, nvt = this.vx * nfc - this.vz * nfs;
    this.ax = lerp(this.ax, (nvl - vLong) / dt, 0.2);
    this.ay = lerp(this.ay, this.w * nvl, 0.2);
    // water: heavy drag
    const wl = waterAt(this.x, this.z);
    this.water = Math.max(0, wl - this.y);
    if (this.water > 0.15) {
      const k = Math.exp(-dt * (0.6 + this.water * 2.5));
      this.vx *= k; this.vz *= k;
    }

    // ---- move ----
    const ox = this.x, oz = this.z;
    this.x += this.vx * dt; this.z += this.vz * dt;
    // terrain too steep to climb (cliffs, cutting walls, river banks) acts as a wall
    if (!this.air) {
      const nh = groundAt(this.x, this.z, this.y + 0.3);
      const mv = Math.hypot(this.x - ox, this.z - oz);
      const rise = nh - this.y;
      if (rise > 0.04 && rise > mv * (this.spec.offroad > 0.7 ? 1.25 : 1.0)) { // steeper than ~45-50 degrees
        this.x = ox; this.z = oz;
        groundNormal(this.x, this.z, this.y + 0.3, _n);
        const hl = Math.hypot(_n.x, _n.z) || 1, nx = _n.x / hl, nz = _n.z / hl; // points downhill
        const into = -(this.vx * nx + this.vz * nz);
        if (into > 0) {
          this.vx += nx * into * 1.25; this.vz += nz * into * 1.25;
          if (into > 3) Bus.emit('hit', { car: this, v: into });
        }
      }
    }
    this.odo += Math.hypot(this.vx, this.vz) * dt;
    // world bounds
    const lim = HALF - 12;
    if (Math.abs(this.x) > lim) { this.x = Math.sign(this.x) * lim; this.vx *= -0.3; }
    if (Math.abs(this.z) > lim) { this.z = Math.sign(this.z) * lim; this.vz *= -0.3; }
    this.collideStatic();

    // ---- telemetry + visuals ----
    this.speed = Math.hypot(this.vx, this.vz);
    this.vLong = nvl; this.vLat = nvt;
    this.spin += nvl / sp.tyreR * dt * (1 + this.wheelspin * 2.5);
    // dynamic body pitch/roll (spring-damper)
    const tp = clamp(-this.ax * 0.0065, -0.06, 0.06), tr = clamp(this.ay * 0.0055, -0.07, 0.07) * (sp.style === 'truck' ? 1.6 : 1);
    this.dPitchV += ((tp - this.dPitch) * 160 - this.dPitchV * 14) * dt; this.dPitch += this.dPitchV * dt;
    this.dRollV += ((tr - this.dRoll) * 140 - this.dRollV * 12) * dt; this.dRoll += this.dRollV * dt;
    if (this.landing > 0) { this.dPitchV += this.landing * 0.02; this.landing = 0; }
    // per-wheel suspension: deviation from the plane through the 4 contacts + droop in the air
    const bump = SURF[this.surface].bump * Math.min(1, v / 20) * (1 - sp.offroad * 0.5);
    for (let i = 0; i < 4; i++) {
      const plane = this.y + (i < 2 ? 1 : -1) * (hF - hR) / 2 + (i & 1 ? -1 : 1) * (hL - hRt) / 2;
      const tgt = this.air ? -0.09 : clamp(this.wheelPos[i][1] - plane, -0.12, 0.12) + (Math.random() - 0.5) * 0.03 * bump;
      this.susp[i] = damp(this.susp[i], tgt, 30, dt);
      this.wheelSlip[i] = i >= 2 ? Math.abs(this.slip) + this.wheelspin * 0.5 + hbLock * 0.3 : Math.abs(this.slipF || 0) * 0.6;
    }
    this.brakeOn = inp.brake > 0.05 && !this.reverse;
  }

  collideStatic() {
    const R = this.hl + 1.5;
    Col.query(this.x, this.z, R, _colList);
    let maxImp = 0;
    for (let it = 0; it < 2; it++) for (const c of _colList) {
      const r = boxVsCollider(this.x, this.z, this.h, this.hw, this.hl, c);
      if (!r) continue;
      // hedgerows give way at speed: plough through and lose some pace
      if (c.kind === 'hedge' && this.vx * this.vx + this.vz * this.vz > 36) {
        if (it === 0) { this.vx *= 0.985; this.vz *= 0.985; if (!this.hedgeT) Bus.emit('hit', { car: this, v: 3, hedge: true }); this.hedgeT = 0.4; }
        continue;
      }
      const nx = r.n[0], nz = r.n[1];
      this.x += nx * r.d; this.z += nz * r.d;
      const vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        const e = c.kind === 'rail' ? 0.12 : 0.25;
        const J = -(1 + e) * vn;
        this.vx += nx * J; this.vz += nz * J;
        // friction along the surface, stronger for trees/buildings
        const tx = -nz, tz = nx, vt = this.vx * tx + this.vz * tz;
        const fr = c.kind === 'rail' ? 0.05 : c.kind === 'hedge' ? 0.25 : 0.15;
        this.vx -= tx * vt * fr; this.vz -= tz * vt * fr;
        // yaw kick from off-centre hits
        const rx = r.px - this.x, rz = r.pz - this.z;
        this.w += (rz * nx - rx * nz) * J * this.m / this.I * 0.5;
        maxImp = Math.max(maxImp, J);
      }
    }
    if (maxImp > 2.5) Bus.emit('hit', { car: this, v: maxImp });
    if (this.hedgeT) this.hedgeT = Math.max(0, this.hedgeT - 1 / 120);
  }

  sync(model, alpha, camMode) {
    const p = this.prev;
    const x = lerp(p.x, this.x, alpha), y = lerp(p.y, this.y, alpha), z = lerp(p.z, this.z, alpha);
    const h = p.h + wrapAngle(this.h - p.h) * alpha;
    const r = model.root;
    r.position.set(x, y, z);
    r.rotation.set(this.gPitch, h, this.gRoll, 'YXZ');
    // body roll/pitch around the centre of gravity
    const b = model.body, cg = this.spec.cg;
    b.rotation.set(this.dPitch, 0, this.dRoll, 'YXZ');
    b.position.set(-Math.sin(this.dRoll) * cg * 0.9, cg * (1 - Math.cos(this.dRoll)) - Math.abs(this.dPitch) * 0.2, Math.sin(this.dPitch) * cg * 0.5);
    for (let i = 0; i < 4; i++) {
      const w = model.wheels[i];
      w.pivot.position.y = w.baseY + this.susp[i];
      w.spin.rotation.x = this.spin;
      w.pivot.rotation.y = w.front ? this.steerAng : 0;
    }
    if (model.steer) model.steer.rotation.z = -this.steerAng * 6;
    model.brake.emissiveIntensity = this.brakeOn ? 4.5 : 0.5 + Sky.night * 0.9;
    model.rev.emissiveIntensity = this.reverse ? 3 : 0;
    model.head.emissiveIntensity = 0.6 + Sky.night * 3;
    if (model.lampMats) for (const m of model.lampMats) m.emissiveIntensity = 0.35 + Sky.night * 2.2;
    for (const s of model.beams) s.intensity = Sky.night > 0.3 || Sky.cur.fog > 0.5 ? 220 * Math.max(Sky.night, Sky.cur.fog * 0.6) : 0;
    model.blob.visible = camMode !== 3;
  }
}

/* Reset a vehicle to the nearest road, facing along it (keeping its direction of travel). */
function nearestRoadSample(x, z) {
  let best = -1, bd = 1e18;
  const SX = World.SX, SZ = World.SZ;
  for (let k = 0; k < SX.length; k += 2) { const d = (SX[k] - x) ** 2 + (SZ[k] - z) ** 2; if (d < bd) { bd = d; best = k; } }
  return best;
}
function resetToRoad(car) {
  const k = nearestRoadSample(car.x, car.z);
  const road = World.roads[World.SROAD[k]];
  const i = k - road.i0;
  let h = Math.atan2(road.tx[i], road.tz[i]);
  if (Math.cos(wrapAngle(h - car.h)) < 0) h += Math.PI;
  const lx = road.tz[i], lz = -road.tx[i];
  const side = Math.cos(h - Math.atan2(road.tx[i], road.tz[i])) > 0 ? -1 : 1; // keep left (UK)
  car.reset(road.x[i] + lx * side * road.hw * 0.45, road.z[i] + lz * side * road.hw * 0.45, h);
}

/* Car-to-car contacts (OBB vs OBB, impulse exchange). */
function collideCars(cars) {
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const A = cars[i], B = cars[j];
    const dx = A.x - B.x, dz = A.z - B.z;
    if (dx * dx + dz * dz > 49) continue;
    if (Math.abs(A.y - B.y) > 3) continue;
    const box = { t: 1, x: B.x, z: B.z, hx: B.hw, hz: B.hl, c: Math.cos(B.h), s: Math.sin(B.h) };
    const r = boxVsCollider(A.x, A.z, A.h, A.hw, A.hl, box);
    if (!r) continue;
    const nx = r.n[0], nz = r.n[1];
    const ma = A.m, mb = B.m, tot = ma + mb;
    A.x += nx * r.d * mb / tot; A.z += nz * r.d * mb / tot;
    B.x -= nx * r.d * ma / tot; B.z -= nz * r.d * ma / tot;
    const vrel = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz;
    if (vrel < 0) {
      const j2 = -(1.2) * vrel / (1 / ma + 1 / mb);
      A.vx += nx * j2 / ma; A.vz += nz * j2 / ma;
      B.vx -= nx * j2 / mb; B.vz -= nz * j2 / mb;
      A.w += (Math.random() - 0.5) * j2 / A.I * 0.8; B.w += (Math.random() - 0.5) * j2 / B.I * 0.8;
      if (-vrel > 2) Bus.emit('hit', { car: A, other: B, v: -vrel });
    }
  }
}
