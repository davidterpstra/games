// UI preview with a realistic mock `game`. URL: ?state=menu|playing|paused|inventory|reading|ending|loading
// &tab=items|crafting|missions|journal|map &kind=note|terminal|recording &hint &nosave &empty
import { bus } from '../src/core/EventBus.js';
import { Settings } from '../src/core/Settings.js';
import * as layout from '../src/world/layout.js';
import { createUI } from '../src/ui/UI.js';

const params = new URLSearchParams(location.search);
const state0 = params.get('state') || 'menu';
try { if (params.get('tab')) localStorage.setItem('beyond.tab.v1', params.get('tab')); if (!params.has('hint')) localStorage.setItem('beyond.hint.v1', '1'); } catch {}

// ---- mock world: believable island for the map -------------------------------------------------
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (hash(xi, zi) * (1 - u) + hash(xi + 1, zi) * u) * (1 - v) + (hash(xi, zi + 1) * (1 - u) + hash(xi + 1, zi + 1) * u) * v; };
function getHeightAt(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z)) / 320;
  let hgt = 12 + (vnoise(x / 70, z / 70) - 0.5) * 18 + (vnoise(x / 22, z / 22) - 0.5) * 5;
  hgt += Math.pow(Math.max(0, d - 0.62), 1.6) * 260;                       // mountains at the rim
  hgt += Math.max(0, 1 - Math.hypot(x, z + 188) / 70) * 14;                  // temple hill
  const lk = layout.LAKE; hgt -= Math.max(0, 1 - Math.hypot(x - lk.x, z - lk.z) / lk.radius) * 14;
  const ri = layout.riverInfo(x, z); hgt -= Math.max(0, 1 - ri.dist / (layout.RIVER.width * 0.8)) * 5;
  for (const p of layout.PADS) { const pd = layout.padDistance(p, x, z); if (pd < p.blend) { const t = Math.max(0, pd) / p.blend; hgt = p.y * (1 - t * t * (3 - 2 * t)) + hgt * (t * t * (3 - 2 * t)); } }
  return hgt;
}
function getWaterSurfaceAt(x, z) {
  const lk = layout.LAKE; if (Math.hypot(x - lk.x, z - lk.z) < lk.radius) return lk.waterY;
  const ri = layout.riverInfo(x, z); if (ri.dist < layout.RIVER.width / 2) return ri.waterY;
  return null;
}
const world = { getHeightAt, getWaterSurfaceAt };

// ---- mock gameplay -------------------------------------------------------------------------------
const items = {
  wood: { id: 'wood', name: 'Hout', description: 'Stevige takken en stukken stam. Bruikbaar als brandstof en als bouwmateriaal.', category: 'material', stack: 20 },
  stone: { id: 'stone', name: 'Steen', description: 'Een gladde, zware rivierkei. Goed voor gereedschap en om mee te gooien.', category: 'material', stack: 20 },
  fiber: { id: 'fiber', name: 'Vezels', description: 'Taaie plantenvezels, gemakkelijk te vlechten tot touw.', category: 'material', stack: 20 },
  resin: { id: 'resin', name: 'Hars', description: 'Kleverige boomhars. Brandt langzaam en helder; het bindmiddel van elke toorts.', category: 'material', stack: 10 },
  cloth: { id: 'cloth', name: 'Stof', description: 'Een lap oud labtextiel, nog droog genoeg om te branden.', category: 'material', stack: 10 },
  scrap: { id: 'scrap', name: 'Schroot', description: 'Verbogen metaal uit het verlaten dorp. Sterk genoeg voor een koevoet.', category: 'material', stack: 10 },
  rope: { id: 'rope', name: 'Touw', description: 'Stevig gevlochten touw van plantenvezels.', category: 'material', stack: 10 },
  torch: { id: 'torch', name: 'Toorts', description: 'Een brandende toorts verlicht zelfs de donkerste grot. Druk op F om hem te gebruiken.', category: 'tool', stack: 1 },
  crowbar: { id: 'crowbar', name: 'Koevoet', description: 'Zwaar metaal met een haak. Perfect om dichtgetimmerde deuren open te wrikken.', category: 'tool', stack: 1 },
  sundisc: { id: 'sundisc', name: 'Zonneschijf', description: 'Een gouden schijf met twaalf stralen, warm aan te raken alsof hij zelf licht afgeeft.', category: 'artifact', stack: 1 },
  keycard: { id: 'keycard', name: 'Sleutelkaart', description: 'Een magnetische kaart met het embleem van Bunker K-7.', category: 'key', stack: 1 },
};
const slots = Array(24).fill(null);
const params0 = params.has('empty') ? [] : [['wood', 3], ['stone', 4], ['fiber', 2], ['resin', 1], ['cloth', 1], ['scrap', 2], ['rope', 1], ['torch', 1]];
params0.forEach(([id, n], i) => { slots[i] = { itemId: id, count: n }; });
const inventory = {
  slots,
  count: (id) => slots.reduce((a, s) => a + (s && s.itemId === id ? s.count : 0), 0),
  has: (id, n = 1) => inventory.count(id) >= n,
  add(id, n) { const s = slots.find((x) => x && x.itemId === id); if (s) s.count += n; else slots[slots.findIndex((x) => !x)] = { itemId: id, count: n }; bus.emit('inventory:changed', { slots }); bus.emit('item:picked', { itemId: id, count: n, name: items[id].name }); return n; },
  remove(id, n) { const i = slots.findIndex((x) => x && x.itemId === id); if (i < 0 || slots[i].count < n) return false; slots[i].count -= n; if (!slots[i].count) slots[i] = null; return true; },
};
const recipes = [
  { id: 'torch', result: { itemId: 'torch', count: 1 }, ingredients: [{ itemId: 'wood', count: 2 }, { itemId: 'resin', count: 1 }, { itemId: 'cloth', count: 1 }], description: 'Wikkel stof om een stuk hout, doordrenk het met hars en je hebt licht.' },
  { id: 'rope', result: { itemId: 'rope', count: 1 }, ingredients: [{ itemId: 'fiber', count: 3 }], description: 'Vlecht drie bundels vezels tot een sterk touw.' },
  { id: 'crowbar', result: { itemId: 'crowbar', count: 1 }, ingredients: [{ itemId: 'scrap', count: 2 }, { itemId: 'rope', count: 1 }], description: 'Buig schroot tot een haak en wikkel er touw omheen voor grip.' },
];
let craftCalls = 0;
const crafting = {
  recipes,
  canCraft: (id) => recipes.find((r) => r.id === id).ingredients.every((i) => inventory.count(i.itemId) >= i.count),
  craft(id) {
    if (!crafting.canCraft(id)) return false;
    craftCalls++; window.__craftCalls = craftCalls;
    const r = recipes.find((x) => x.id === id);
    r.ingredients.forEach((i) => inventory.remove(i.itemId, i.count));
    inventory.add(r.result.itemId, r.result.count);
    bus.emit('craft:done', { recipeId: id, itemId: r.result.itemId, name: items[r.result.itemId].name });
    return true;
  },
};
const missionList = [
  { id: 'm1', title: 'Ontwaakt', description: 'Je ontwaakt in Onderzoeksstation Kestrel. Wat is er met Dr. Vos gebeurd?', status: 'done', objectives: [{ id: 'a', text: 'Lees het logboek', done: true }, { id: 'b', text: 'Activeer het radiobaken', done: true }] },
  { id: 'm2', title: 'Licht in het duister', description: 'Zonder licht kom je niet ver. Verzamel materialen voor een toorts.', status: 'active', objectives: [
    { id: 'c', text: 'Verzamel hout', done: true, progress: [2, 2] }, { id: 'd', text: 'Verzamel hars', done: false, progress: [0, 1] }, { id: 'e', text: 'Vind een stuk stof', done: true }, { id: 'f', text: 'Maak een toorts', done: false }] },
  { id: 'm3', title: 'Het stille dorp', description: '', status: 'locked', objectives: [] }, { id: 'm4', title: 'De Kristalgrot', description: '', status: 'locked', objectives: [] },
];
const documents = [
  { id: 'logbook', title: 'Logboek van Dr. Vos', body: 'Dag 41.\n\nDe metingen kloppen niet. Het signaal onder de heuvel komt elke avond terug, op precies hetzelfde moment als de zonsondergang.\n\nIk heb de anderen gevraagd te blijven. Niemand luistert. Misschien is dat maar goed ook.\n\nAls je dit leest: volg het pad naar het zuiden. Ga niet alleen de grot in.' },
  { id: 'elder', title: 'Dagboek van de oudste', body: 'De zon schonk ons zes zuilen. Wie de berg, de zon en de golf in die volgorde keert, opent de poort.\n\nDe schijf rust in de kristalgrot, achter de zilveren waterval.' },
];
const docKinds = {
  note: { title: 'Notitie bij het kampvuur', kind: 'note', body: 'Wie dit vindt: de brug is weggespoeld, maar de rivier is op te steken bij de oude kruising. Neem hout mee, de nachten zijn koud.\n\n— M.' },
  terminal: { title: 'Bunker K-7 · Terminal', kind: 'terminal', body: '> TOEGANG VERLEEND\n> GEBRUIKER: DR. E. VOS\n\nSTATUS ENERGIE.......... HERSTELD\nSTATUS SIGNAAL.......... ACTIEF\n\nLaatste bericht:\n"Het signaal komt uit het zuidwesten, voorbij de groene heuvels. Waar de aarde droog wordt. Ik ga erheen."\n\n> EINDE VAN BERICHT_' },
  recording: { title: 'Laatste opname van Dr. Vos', kind: 'recording', body: '[00:00] Opname begonnen.\n[00:04] Ik weet niet of iemand dit ooit hoort.\n[00:12] De poort stond open toen ik aankwam. Binnen was het warm, alsof de zon er nog woonde.\n[00:31] Ik laat de sleutelkaart achter. Wie hem vindt, moet de bunker openen. Er is meer dan ik dacht.\n[00:47] Opname beëindigd.' },
};
const locs = layout.LOCATIONS.map((l, i) => ({ id: l.id, name: l.name, x: l.x, z: l.z, discovered: i < 4 || params.has('alllocs') }));
const gameplay = {
  inventory, items, crafting,
  missions: { list: () => missionList, active: () => missionList.find((m) => m.status === 'active') || null },
  documents: { list: () => (params.has('empty') ? [] : documents), get: (id) => documents.find((d) => d.id === id) },
  locations: { list: () => locs },
  save: { hasSave: () => !params.has('nosave'), getInfo: () => ({ timestamp: Date.now() - 3600e3, missionTitle: 'Licht in het duister', playTime: 1534 }), save: () => true },
  playTime: 3725,
};
const player = { state: { position: { x: 14, y: 11, z: 70 }, yaw: 0.45, pitch: 0, stamina: params.has('tired') ? 0.42 : 1 } };
const environment = { getTimeOfDay: () => (params.get('night') ? 22.4 : 14.25), day: 3, weather: params.get('wx') || 'clear', torchOn: params.has('torch') };
const perf = { stats: () => ({ fps: 60, frameMs: 16.6, drawCalls: 210, triangles: 480000 }) };

let state = 'loading';
const game = { version: '0.1.0', bus, settings: Settings, layout, quality: 'medium', get state() { return state; }, player, gameplay, environment, perf, world };
const ui = createUI({ root: document.getElementById('ui'), bus, game });
const setState = (next) => { const previous = state; state = next; bus.emit('game:state', { state, previous }); };
window.preview = { bus, game, setState, ui, Settings, craftCalls: () => craftCalls, requests: [] };
bus.on('ui:request', (r) => window.preview.requests.push(r.action));
window.__sfx = []; bus.on('sfx', (s) => window.__sfx.push(s.name));

// mock main behaviour so buttons do something visible
bus.on('ui:request', ({ action }) => {
  if (action === 'resume' || action === 'newGame' || action === 'continue' || action === 'closeInventory') setState('playing');
  if (action === 'quitToMenu') setState('menu');
});
bus.on('input:action', ({ action }) => {
  if (action === 'inventory' || action === 'map') setState(state === 'inventory' ? 'playing' : 'inventory');
  if (action === 'pause') setState(state === 'paused' ? 'playing' : 'paused');
});
bus.on('document:close', () => { if (state === 'reading') setState('playing'); });

// ---- initial state ---------------------------------------------------------------------------------
if (state0 === 'loading') { setState('loading'); bus.emit('loading:progress', { progress: 0.62, label: 'Vegetatie planten…' }); }
else {
  setState('loading'); bus.emit('loading:progress', { progress: 1, label: 'Klaar' });
  if (state0 === 'reading') {
    setState('playing');
    const d = docKinds[params.get('kind') || 'note'];
    setState('reading'); bus.emit('document:open', { id: 'x', ...d });
  } else if (state0 === 'playing') {
    setState('playing');
    bus.emit('interaction:focus', { id: 'wood1', prompt: 'Oppakken: Hout', key: 'E' });
    if (params.has('toasts')) {
      bus.emit('item:picked', { itemId: 'wood', count: 1, name: 'Hout' }); bus.emit('item:picked', { itemId: 'resin', count: 1, name: 'Hars' });
      bus.emit('craft:done', { recipeId: 'torch', itemId: 'torch', name: 'Toorts' }); bus.emit('notify', { text: 'Je hebt nog geen toorts.', type: 'warning' });
      bus.emit('checkpoint:set', { id: 'station', name: 'Station' });
    }
    if (params.has('banner')) bus.emit('location:discovered', { id: 'village', name: 'Verlaten dorp Valdris' });
  } else setState(state0);
}
let last = performance.now();
(function loop(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  if (params.has('spin')) player.state.yaw += dt * 0.3;
  ui.update(dt);
  requestAnimationFrame(loop);
})(last);
