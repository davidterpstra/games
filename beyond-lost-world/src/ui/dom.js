// Small DOM helpers shared by all UI modules: hyperscript `h`, icon helper, formatting.
import { icons } from './icons.js';

/**
 * Create an element. props: class, text, html, style (object), dataset, on* handlers, any attribute.
 * Children may be nodes, strings, arrays or falsy values.
 */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}

/** Replace all children of `el`. */
export function fill(el, ...kids) { el.replaceChildren(); append(el, kids); return el; }

/** Inline SVG icon element (span.ic). */
export function icon(name, cls = '') {
  const s = document.createElement('span');
  s.className = 'ic ' + cls;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = icons[name] || icons.info;
  return s;
}

/** Text of a button with leading icon. */
export function btn(label, { cls = '', ic, onClick, sub, type = 'button', attrs } = {}) {
  const b = h('button', { class: 'btn ' + cls, type, ...attrs },
    ic && icon(ic, 'btn-ic'),
    h('span', { class: 'btn-txt' }, h('span', { class: 'btn-label', text: label }), sub && h('span', { class: 'btn-sub', text: sub })));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/** Seconds → "2u 05m" / "12m 03s". */
export function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  if (hh > 0) return `${hh}u ${String(mm).padStart(2, '0')}m`;
  return `${mm}m ${String(ss).padStart(2, '0')}s`;
}

/** Hours (0..24) → "07:05". */
export function fmtClock(hours) {
  const t = ((hours % 24) + 24) % 24;
  let hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function fmtDate(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function safeStorage() {
  return {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
}

export const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,[tabindex]:not([tabindex="-1"])';
