// Tiny tween runner for gameplay animations (doors, pillars, levers). Updated from Gameplay.update(dt).

export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  outBack: (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
};

export class Tweens {
  constructor() { this.items = []; }

  /**
   * @param {{duration:number, delay?:number, ease?:(t:number)=>number, update?:(e:number)=>void, done?:()=>void}} o
   * `update` receives the eased progress 0..1.
   */
  add(o) {
    const tw = { t: -(o.delay || 0), duration: Math.max(1e-4, o.duration), ease: o.ease || ease.inOut, update: o.update, done: o.done };
    this.items.push(tw);
    return tw;
  }

  update(dt) {
    if (!this.items.length) return;
    const list = this.items;
    this.items = [];
    for (const tw of list) {
      tw.t += dt;
      if (tw.t < 0) { this.items.push(tw); continue; }
      const p = Math.min(1, tw.t / tw.duration);
      tw.update?.(tw.ease(p));
      if (p >= 1) tw.done?.(); else this.items.push(tw);
    }
  }

  /** Jump every running tween to its end state. */
  finishAll() {
    let guard = 0;
    while (this.items.length && guard++ < 8) {
      const list = this.items;
      this.items = [];
      for (const tw of list) { tw.update?.(1); tw.done?.(); }
    }
  }

  clear() { this.items = []; }
  get busy() { return this.items.length > 0; }
}
