// On-screen controls for touch devices: floating joystick (left half), look drag (right half)
// and buttons. Every control tracks its own pointerId so move + look + jump work simultaneously.
// Visible only while input.enabled is true.

const CSS = `
.bl-touch{position:fixed;inset:0;z-index:40;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;}
.bl-touch[hidden]{display:none}
.bl-touch .zone{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
.bl-touch .zone.left{left:0;width:50%}
.bl-touch .zone.right{right:0;width:50%}
.bl-touch .stick{position:absolute;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;border:2px solid rgba(241,233,216,.35);background:radial-gradient(circle,rgba(241,233,216,.08),rgba(241,233,216,.16));opacity:0;transition:opacity .15s;pointer-events:none}
.bl-touch .stick.on{opacity:1}
.bl-touch .stick.run{border-color:rgba(255,196,100,.8)}
.bl-touch .knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(241,233,216,.5);box-shadow:0 2px 8px rgba(0,0,0,.4)}
.bl-touch .btn{position:absolute;pointer-events:auto;touch-action:none;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;border:2px solid rgba(241,233,216,.4);background:rgba(20,26,22,.45);color:rgba(241,233,216,.92);font-weight:600;font-size:12px;line-height:1.1;text-shadow:0 1px 3px rgba(0,0,0,.6);-webkit-tap-highlight-color:transparent;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.bl-touch .btn b{font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1}
.bl-touch .btn svg{display:block}
.bl-touch .btn.down{background:rgba(241,233,216,.35);transform:scale(.94)}
.bl-touch .btn.active{background:rgba(255,196,100,.4);border-color:rgba(255,196,100,.85)}
.bl-touch .jump{width:84px;height:84px;right:calc(env(safe-area-inset-right,0px) + 18px);bottom:calc(env(safe-area-inset-bottom,0px) + 36px)}
.bl-touch .use{width:68px;height:68px;right:calc(env(safe-area-inset-right,0px) + 112px);bottom:calc(env(safe-area-inset-bottom,0px) + 70px)}
.bl-touch .sprint{width:62px;height:62px;right:calc(env(safe-area-inset-right,0px) + 24px);bottom:calc(env(safe-area-inset-bottom,0px) + 136px)}
.bl-touch .torch{width:58px;height:58px;right:calc(env(safe-area-inset-right,0px) + 108px);bottom:calc(env(safe-area-inset-bottom,0px) + 148px)}
.bl-touch .bag{width:58px;height:58px;right:calc(env(safe-area-inset-right,0px) + 14px);top:calc(env(safe-area-inset-top,0px) + 12px)}
.bl-touch .pause{width:58px;height:58px;right:calc(env(safe-area-inset-right,0px) + 80px);top:calc(env(safe-area-inset-top,0px) + 12px)}
`;

const STICK_RADIUS = 58;
const DEADZONE = 0.14;
const RUN_THRESHOLD = 0.93;
const LOOK_SCALE = 2.2; // touch px → equivalent mouse px

export class TouchControls {
  /** @param {import('./Input.js').Input} input */
  constructor(input) {
    this.input = input;
    this.stickId = null;
    this.lookId = null;
    this.origin = { x: 0, y: 0 };
    this.last = { x: 0, y: 0 };

    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);

    const root = this.root = document.createElement('div');
    root.className = 'bl-touch';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');

    this.left = this._el('div', 'zone left', root);
    this.right = this._el('div', 'zone right', root);
    this.stick = this._el('div', 'stick', root);
    this.knob = this._el('div', 'knob', this.stick);

    this.sprintBtn = this._button('sprint', 'Sprint', '', () => this.setSprint(!input.touchSprint));
    this._button('jump', 'Springen', `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l7 9h-4v7H9v-7H5z"/></svg>`, () => input.emitAction('jump'));
    this._button('use', 'Gebruik', 'E', () => input.emitAction('interact'));
    this._button('torch', 'Toorts', `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.7 1.5-3.5.2 1.5 1 2.2 1.8 2.5C11 8 11 5.5 12 3z"/><path d="M10 21h4"/></svg>`, () => input.emitAction('torch'));
    this._button('bag', 'Tas', `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M9 6V4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4.5V6"/><path d="M9 13h6"/></svg>`, () => input.emitAction('inventory'));
    this._button('pause', '', `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>`, () => input.emitAction('pause'));
    root.querySelector('.pause').setAttribute('aria-label', 'Pauze');

    this._bindZone(this.left, 'stick');
    this._bindZone(this.right, 'look');
    document.body.appendChild(root);
  }

  _el(tag, cls, parent) {
    const e = document.createElement(tag);
    e.className = cls;
    parent.appendChild(e);
    return e;
  }

  _button(cls, label, glyph, onPress) {
    const b = this._el('div', `btn ${cls}`, this.root);
    b.innerHTML = (glyph ? `<b>${glyph}</b>` : '') + (label ? `<span>${label}</span>` : '');
    let id = null;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (id !== null) return;
      id = e.pointerId;
      try { b.setPointerCapture(id); } catch { /* ignore */ }
      b.classList.add('down');
      onPress();
    });
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      b.classList.remove('down');
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }

  setSprint(on) {
    this.input.touchSprint = on;
    this.sprintBtn.classList.toggle('active', on);
  }

  _bindZone(zone, kind) {
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (kind === 'stick') {
        if (this.stickId !== null) return;
        this.stickId = e.pointerId;
        this.origin.x = e.clientX; this.origin.y = e.clientY;
        this.stick.style.left = e.clientX + 'px';
        this.stick.style.top = e.clientY + 'px';
        this.stick.classList.add('on');
        this._stickMove(e.clientX, e.clientY);
      } else {
        if (this.lookId !== null) return;
        this.lookId = e.pointerId;
        this.last.x = e.clientX; this.last.y = e.clientY;
      }
      try { zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    zone.addEventListener('pointermove', (e) => {
      if (kind === 'stick' && e.pointerId === this.stickId) this._stickMove(e.clientX, e.clientY);
      else if (kind === 'look' && e.pointerId === this.lookId) {
        this.input.addLook((e.clientX - this.last.x) * LOOK_SCALE, (e.clientY - this.last.y) * LOOK_SCALE);
        this.last.x = e.clientX; this.last.y = e.clientY;
      }
    });
    const end = (e) => {
      if (kind === 'stick' && e.pointerId === this.stickId) this._stickEnd();
      else if (kind === 'look' && e.pointerId === this.lookId) this.lookId = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _stickMove(x, y) {
    let dx = x - this.origin.x;
    let dy = y - this.origin.y;
    const len = Math.hypot(dx, dy);
    const mag = Math.min(1, len / STICK_RADIUS);
    if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
    this.knob.style.transform = `translate(${dx}px,${dy}px)`;
    const t = this.input.touchMove;
    if (mag < DEADZONE) { t.x = 0; t.z = 0; this.input.touchRun = false; this.stick.classList.remove('run'); return; }
    const scale = (mag - DEADZONE) / (1 - DEADZONE);
    const cl = Math.hypot(dx, dy) || 1;
    t.x = (dx / cl) * scale;
    t.z = (-dy / cl) * scale;
    const run = mag >= RUN_THRESHOLD;
    this.input.touchRun = run;
    this.stick.classList.toggle('run', run);
  }

  _stickEnd() {
    this.stickId = null;
    this.input.touchMove.x = 0; this.input.touchMove.z = 0;
    this.input.touchRun = false;
    this.stick.classList.remove('on', 'run');
    this.knob.style.transform = '';
  }

  /** Lets go of every active touch (used when input is disabled or the window loses focus). */
  release() {
    this._stickEnd();
    this.lookId = null;
  }

  setVisible(v) { this.root.hidden = !v; }

  dispose() {
    this.release();
    this.input.touchSprint = false;
    this.root.remove();
    this.style.remove();
  }
}
