/* =====================================================================
   03_services.js — "server" rules: Remote (action dispatcher) + Services.
   No DOM, no Three.js. Reads/writes Game.player, talks via Bus + return values.
   ===================================================================== */

/* ---------- private helpers ---------- */
const _svPlays = {};            // playId -> { worldId, started }
let _svLastRep = -1e9;             // performance.now() of last manual rep
let _svAutoT = 0;               // auto-train accumulator
let _svBoostLive = { luck: false, coins: false };

function _svFail(err) { return { ok: false, err }; }
function _svNow() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
function _svP() { return Game.player; }
function _svSave(reason) { Bus.emit('save:request', { reason }); }
function _svToast(text, kind = 'info') { Bus.emit('toast', { text, kind }); }
function _svCurrency() { const p = _svP(); Bus.emit('currency:changed', { coins: p.coins, gems: p.gems, strength: p.strength }); }
function _svReward(coins, gems, strength, source) { Bus.emit('reward', { coins, gems, strength, source }); }
function _svFloor(n) { return isNum(n) ? Math.max(0, n) : 0; }
function _svWorld(id) { return WORLD_BY_ID[id || _svP().worlds.current]; }
function _svMachine(worldId) {
  const p = _svP();
  let m = p.machines[worldId];
  if (!isObj(m)) m = p.machines[worldId] = { pit: [], plays: 0 };
  if (!Array.isArray(m.pit)) m.pit = [];
  if (!isNum(m.plays)) m.plays = 0;
  return m;
}
function _svPet(uid) { return _svP().pets.find((x) => x.uid === uid) || null; }
function _svRarityOrder(id) { const r = RARITY_BY_ID[id]; return r ? r.order : 0; }
function _svBoostItem(kind) { return GEM_SHOP.find((s) => s.kind === kind) || null; }
function _svEquipSlots() { return ECONOMY.baseEquipSlots + _svP().shop.equipSlots; }
function _svInvSlots() { return ECONOMY.baseInvSlots + _svP().shop.invSlots * ECONOMY.invSlotsPerPurchase; }
function _svHighestOrder() {
  const p = _svP();
  let o = 0;
  for (const id of p.worlds.unlocked) { const w = WORLD_BY_ID[id]; if (w && w.order > o) o = w.order; }
  return o;
}
function _svMultOfPet(pet) {
  const a = ANIMAL_BY_ID[pet.id], v = VARIANTS[pet.variant];
  return (a ? a.mult : 1) * (v ? v.mult : 1);
}
function _svEmitEquip() { Bus.emit('equip:changed', { equipped: _svP().equipped.slice() }); }
function _svPetsChanged() { Bus.emit('pets:changed', {}); }

function _svUsableEquip(eq) {
  const p = _svP();
  return !!eq && p.worlds.unlocked.includes(eq.world) && p.strength >= eq.requires;
}
/** Returns the selected equipment if usable, else switches to the best usable one. */
function _svResolveEquip() {
  const p = _svP();
  let eq = EQUIPMENT_BY_ID[p.training.selected];
  if (_svUsableEquip(eq)) return eq;
  let best = null;
  for (const e of TRAINING_EQUIPMENT) if (_svUsableEquip(e) && (!best || e.power > best.power)) best = e;
  if (best) p.training.selected = best.id;
  return best;
}

function _svPickAnimal(worldId, rarityId, lowOnly) {
  const inWorld = ANIMALS.filter((a) => a.world === worldId);
  let list = inWorld.filter((a) => a.rarity === rarityId);
  if (!list.length || (lowOnly && _svRarityOrder(rarityId) > 1)) list = inWorld.filter((a) => a.rarity === 'common');
  if (!list.length) list = inWorld;
  return list.length ? pick(list) : null;
}

function _svRollVariant(special) {
  const vc = FORMULAS.variantChances(special);
  if (Math.random() < vc.rainbow) return 'rainbow';
  if (Math.random() < vc.golden) return 'golden';
  return 'normal';
}

/* ---------- Remote ---------- */
const Remote = {
  handlers: {},
  invoke(name, args = {}) {
    const h = Remote.handlers[name];
    if (typeof name !== 'string' || typeof h !== 'function' || !Object.prototype.hasOwnProperty.call(Remote.handlers, name)) return { ok: false, err: 'Unknown action' };
    if (!isObj(args)) return { ok: false, err: 'Bad request' };
    if (!Game.player) return { ok: false, err: 'No player data' };
    try {
      const r = h(args);
      return r && typeof r === 'object' ? r : { ok: true };
    } catch (e) {
      console.error('[Remote]', name, e);
      return { ok: false, err: 'Something went wrong' };
    }
  },
};
const _svH = Remote.handlers;

/* ---------- claw ---------- */
_svH['claw:start'] = () => {
  const p = _svP();
  const w = _svWorld();
  if (!w) return _svFail('Unknown world');
  const cost = w.playCost || 0;
  if (p.coins < cost) return _svFail('Not enough coins');
  p.coins -= cost;
  p.stats.plays++;
  _svMachine(w.id).plays++;
  const playId = uid('play');
  _svPlays[playId] = { worldId: w.id, started: Date.now() };
  const keys = Object.keys(_svPlays);
  if (keys.length > 24) for (const k of keys.slice(0, keys.length - 24)) delete _svPlays[k];
  _svCurrency();
  return { ok: true, playId, cost };
};

_svH['claw:grip'] = (a) => {
  const p = _svP();
  const w = _svWorld();
  const entry = _svMachine(w.id).pit.find((e) => e.pid === a.pid);
  if (!entry) return _svFail('That animal is gone');
  const alignment = clamp(isNum(a.alignment) ? a.alignment : 0, 0, 1);
  const st = Services.stats();
  const weight = FORMULAS.animalWeight(entry.id, entry.variant);
  const ch = FORMULAS.gripChance({ power: st.gripPower, weight, alignment });
  const success = Math.random() < ch;
  let slipAfter;
  if (success) {
    const rate = FORMULAS.slipRate({ protection: st.protection, weight });
    if (!(rate > 0)) slipAfter = null;
    else {
      const t = -Math.log(1 - Math.random()) / rate;
      slipAfter = t > ECONOMY.carryTime ? null : Math.max(0.35, t);
    }
  } else slipAfter = randRange(0.15, 0.8);
  return { ok: true, success, chance: ch, slipAfter };
};

_svH['claw:prize'] = (a) => {
  const p = _svP();
  const w = _svWorld();
  const m = _svMachine(w.id);
  const idx = m.pit.findIndex((e) => e.pid === a.pid);
  if (idx < 0) return _svFail('That animal is gone');
  const entry = m.pit.splice(idx, 1)[0];
  Bus.emit('pit:remove', { worldId: w.id, pid: entry.pid });
  const animal = ANIMAL_BY_ID[entry.id];
  const st = Services.stats();
  const pet = { uid: uid('p'), id: entry.id, variant: entry.variant, locked: false, t: Date.now() };
  let soldForCoins = 0, added = false;
  if (p.pets.length >= st.invSlots) {
    soldForCoins = Math.max(0, Math.floor(FORMULAS.sellValue(entry.id, entry.variant)));
    p.coins += soldForCoins;
    _svToast('Inventory full! Sold ' + animal.name + ' for ' + fmt(soldForCoins) + ' coins', 'bad');
  } else { p.pets.push(pet); added = true; }
  const coins = FORMULAS.catchCoins({ animalId: entry.id, variant: entry.variant, coinMult: st.coinMult });
  let gems = 0;
  if (Math.random() < FORMULAS.catchGemChance({ animalId: entry.id, variant: entry.variant, gemFinder: st.gemFinder })) gems = FORMULAS.catchGems(entry.id);
  p.coins += coins;
  p.gems += gems;
  const prev = p.discovered[entry.id] || 0;
  p.discovered[entry.id] = prev + 1;
  const isNew = prev === 0;
  let discoverGems = 0;
  if (isNew) { discoverGems = RARITY_BY_ID[animal.rarity].discoverGems || 0; p.gems += discoverGems; }
  p.stats.wins++;
  p.stats.coinsEarned += coins + soldForCoins;
  if (!p.stats.bestRarity || _svRarityOrder(animal.rarity) > _svRarityOrder(p.stats.bestRarity)) p.stats.bestRarity = animal.rarity;
  if (added) Bus.emit('pet:added', { pet, animal, isNew });
  _svPetsChanged();
  _svReward(coins + soldForCoins, gems, 0, 'catch');
  if (discoverGems > 0) _svReward(0, discoverGems, 0, 'discover');
  _svCurrency();
  if (RARITY_BY_ID[animal.rarity].reveal || entry.variant !== 'normal' || isNew) Bus.emit('reveal', { pet, animal, isNew });
  _svSave('prize');
  Services.ensurePit(w.id);
  return { ok: true, pet, animal, coins, gems: gems + discoverGems, isNew, soldForCoins };
};

_svH['claw:end'] = (a) => {
  const p = _svP();
  if (!isStr(a.playId) || !_svPlays[a.playId]) return _svFail('Unknown play');
  if (!['miss', 'slip', 'empty', 'win'].includes(a.result)) return _svFail('Bad result');
  if (a.result === 'miss') p.stats.misses++;
  else if (a.result === 'slip') p.stats.slips++;
  delete _svPlays[a.playId];
  return { ok: true };
};

/* ---------- upgrades ---------- */
_svH['upgrade:buy'] = (a) => {
  const p = _svP();
  const up = UPGRADE_BY_ID[a.id];
  if (!up) return _svFail('Unknown upgrade');
  if (!p.worlds.unlocked.includes(up.world)) { const w = WORLD_BY_ID[up.world]; return _svFail('Unlock ' + (w ? w.name : 'the world') + ' first'); }
  const level = p.upgrades[up.id] || 0;
  if (level >= up.maxLevel) return _svFail('Max level');
  if (level >= FORMULAS.upgradeCap(up.id, p.worlds.unlocked.length)) return _svFail('Unlock the next world to upgrade further');
  const cost = FORMULAS.upgradeCost(up.id, level);
  const cur = up.currency === 'gems' ? 'gems' : 'coins';
  if (p[cur] < cost) return _svFail('Not enough ' + cur);
  p[cur] -= cost;
  p.upgrades[up.id] = level + 1;
  Bus.emit('upgrade:bought', { id: up.id, level: level + 1 });
  _svCurrency();
  _svSave('upgrade');
  if (up.id === 'capacity') Services.ensurePit(p.worlds.current);
  return { ok: true, level: level + 1, cost };
};

/* ---------- pets ---------- */
_svH['pet:equip'] = (a) => {
  const p = _svP();
  const pet = _svPet(a.uid);
  if (!pet) return _svFail('Pet not found');
  if (p.equipped.includes(pet.uid)) return _svFail('Already equipped');
  if (p.equipped.length >= _svEquipSlots()) return _svFail('All pet slots are full');
  p.equipped.push(pet.uid);
  _svEmitEquip(); _svPetsChanged(); _svSave('equip');
  return { ok: true };
};
_svH['pet:unequip'] = (a) => {
  const p = _svP();
  const i = p.equipped.indexOf(a.uid);
  if (i < 0) return _svFail('Not equipped');
  p.equipped.splice(i, 1);
  _svEmitEquip(); _svPetsChanged(); _svSave('equip');
  return { ok: true };
};
_svH['pet:equipBest'] = () => {
  const p = _svP();
  p.equipped = Services.petsSorted('mult').slice(0, _svEquipSlots()).map((x) => x.uid);
  _svEmitEquip(); _svPetsChanged(); _svSave('equip');
  return { ok: true };
};
_svH['pet:unequipAll'] = () => {
  const p = _svP();
  p.equipped = [];
  _svEmitEquip(); _svPetsChanged(); _svSave('equip');
  return { ok: true };
};
_svH['pet:lock'] = (a) => {
  const pet = _svPet(a.uid);
  if (!pet) return _svFail('Pet not found');
  pet.locked = !!a.locked;
  _svPetsChanged(); _svSave('lock');
  return { ok: true };
};
_svH['pet:sell'] = (a) => {
  const p = _svP();
  const pet = _svPet(a.uid);
  if (!pet) return _svFail('Pet not found');
  if (pet.locked) return _svFail('Unlock this pet first');
  if (p.equipped.includes(pet.uid)) return _svFail('Unequip this pet first');
  const coins = Math.max(0, Math.floor(FORMULAS.sellValue(pet.id, pet.variant)));
  p.pets.splice(p.pets.indexOf(pet), 1);
  p.coins += coins;
  _svPetsChanged(); _svReward(coins, 0, 0, 'sell'); _svCurrency(); _svSave('sell');
  return { ok: true, coins };
};
_svH['pet:sellBulk'] = (a) => {
  const p = _svP();
  if (!RARITY_BY_ID[a.rarity]) return _svFail('Unknown rarity');
  let coins = 0, count = 0;
  const keep = [];
  for (const pet of p.pets) {
    const an = ANIMAL_BY_ID[pet.id];
    if (an && an.rarity === a.rarity && !pet.locked && !p.equipped.includes(pet.uid)) {
      coins += Math.max(0, Math.floor(FORMULAS.sellValue(pet.id, pet.variant)));
      count++;
    } else keep.push(pet);
  }
  if (!count) return _svFail('Nothing to sell');
  p.pets = keep;
  p.coins += coins;
  _svPetsChanged(); _svReward(coins, 0, 0, 'sell'); _svCurrency(); _svSave('sell');
  return { ok: true, coins, count };
};
_svH['pet:evolve'] = (a) => {
  const p = _svP();
  const pet = _svPet(a.uid);
  if (!pet) return _svFail('Pet not found');
  const info = Services.evolveInfo(a.uid);
  if (!info.next) return _svFail('Already max evolution');
  if (pet.locked) return _svFail('Unlock this pet first');
  if (!info.can) return _svFail('Need ' + info.need + ' of the same pet (have ' + info.have + ')');
  const same = p.pets.filter((x) => x !== pet && x.id === pet.id && x.variant === pet.variant && !x.locked);
  same.sort((x, y) => (p.equipped.includes(x.uid) ? 1 : 0) - (p.equipped.includes(y.uid) ? 1 : 0));
  const used = [pet].concat(same.slice(0, info.need - 1));
  const ids = new Set(used.map((x) => x.uid));
  p.pets = p.pets.filter((x) => !ids.has(x.uid));
  const oldEq = p.equipped.length;
  p.equipped = p.equipped.filter((u) => !ids.has(u));
  const np = { uid: uid('p'), id: pet.id, variant: info.next, locked: false, t: Date.now() };
  p.pets.push(np);
  const animal = ANIMAL_BY_ID[np.id];
  Bus.emit('pet:added', { pet: np, animal, isNew: false });
  Bus.emit('reveal', { pet: np, animal, isNew: false });
  _svPetsChanged();
  if (p.equipped.length !== oldEq) _svEmitEquip();
  _svSave('evolve');
  return { ok: true, pet: np };
};

/* ---------- training ---------- */
_svH['train:select'] = (a) => {
  const p = _svP();
  const eq = EQUIPMENT_BY_ID[a.id];
  if (!eq) return _svFail('Unknown equipment');
  if (!p.worlds.unlocked.includes(eq.world)) return _svFail('Unlock ' + (WORLD_BY_ID[eq.world] ? WORLD_BY_ID[eq.world].name : 'the world') + ' first');
  if (p.strength < eq.requires) return _svFail('Need ' + fmt(eq.requires) + ' strength');
  p.training.selected = eq.id;
  _svSave('train-select');
  return { ok: true };
};
function _svRep(auto) {
  const p = _svP();
  const eq = _svResolveEquip();
  if (!eq) return _svFail('No usable equipment');
  const gain0 = FORMULAS.trainGain({ equipmentId: eq.id, trainMult: Services.stats().trainMult });
  const gain = auto ? gain0 * ECONOMY.autoTrainFactor : gain0;
  p.strength += gain;
  p.stats.reps++;
  Bus.emit('train:rep', { gain, auto: !!auto });
  _svReward(0, 0, gain, 'train');
  _svCurrency();
  return { ok: true, gain };
}
_svH['train:rep'] = (a) => {
  const auto = !!a.auto;
  if (!auto) {
    const now = _svNow();
    if (now - _svLastRep < ECONOMY.repCooldown * 1000) return { ok: false, err: '' };
    _svLastRep = now;
  }
  return _svRep(auto);
};
_svH['train:auto'] = (a) => {
  const p = _svP();
  if (!p.shop.autoTrain) return _svFail('Buy Auto Train in the shop first');
  p.training.auto = !!a.on;
  _svSave('train-auto');
  return { ok: true };
};

/* ---------- worlds ---------- */
_svH['world:unlock'] = (a) => {
  const p = _svP();
  const w = WORLD_BY_ID[a.id];
  if (!w) return _svFail('Unknown world');
  if (p.worlds.unlocked.includes(w.id)) return _svFail('Already unlocked');
  const c = Services.canUnlockWorld(w.id);
  if (!c.prevUnlocked) return _svFail('Unlock the previous world first');
  if (p.strength < c.needStrength) return _svFail('Need ' + fmt(c.needStrength) + ' strength');
  if (p.coins < c.needCoins) return _svFail('Not enough coins');
  p.coins -= c.needCoins;
  p.worlds.unlocked.push(w.id);
  _svMachine(w.id);
  Bus.emit('world:unlocked', { id: w.id });
  _svToast('Unlocked ' + w.name + '!', 'good');
  _svCurrency(); _svSave('world-unlock');
  return { ok: true };
};
_svH['world:travel'] = (a) => {
  const p = _svP();
  const w = WORLD_BY_ID[a.id];
  if (!w) return _svFail('Unknown world');
  if (!p.worlds.unlocked.includes(w.id)) return _svFail('World is locked');
  p.worlds.current = w.id;
  _svMachine(w.id);
  _svResolveEquip();
  Bus.emit('world:changed', { id: w.id });
  _svSave('world-travel');
  return { ok: true };
};

/* ---------- shop ---------- */
_svH['shop:buy'] = (a) => {
  const p = _svP();
  const item = GEM_SHOP.find((s) => s.id === a.id);
  if (!item) return _svFail('Unknown item');
  const now = Date.now();
  let n = 0, max = Infinity;
  if (item.kind === 'equipSlot') { n = p.shop.equipSlots; max = Math.min(isNum(item.max) ? item.max : Infinity, ECONOMY.maxEquipSlots - ECONOMY.baseEquipSlots); }
  else if (item.kind === 'invSlots') { n = p.shop.invSlots; if (isNum(item.max)) max = item.max; }
  else if (item.kind === 'autoTrain') { n = p.shop.autoTrain ? 1 : 0; max = 1; }
  else if (item.kind !== 'boostLuck' && item.kind !== 'boostCoins') return _svFail('Unknown item');
  if (n >= max) return _svFail('Sold out');
  const cost = Array.isArray(item.cost) ? item.cost[Math.min(n, item.cost.length - 1)] : item.cost;
  if (!isNum(cost)) return _svFail('Unavailable');
  if (p.gems < cost) return _svFail('Not enough gems');
  p.gems -= cost;
  if (item.kind === 'equipSlot') p.shop.equipSlots++;
  else if (item.kind === 'invSlots') p.shop.invSlots++;
  else if (item.kind === 'autoTrain') p.shop.autoTrain = true;
  else {
    const key = item.kind === 'boostLuck' ? 'luck' : 'coins';
    p.boosts[key] = Math.max(now, p.boosts[key] || 0) + (item.duration || 0) * 1000;
    _svBoostLive[key] = true;
  }
  Bus.emit('shop:bought', { id: item.id });
  _svCurrency();
  if (item.kind === 'equipSlot' || item.kind === 'invSlots') _svPetsChanged();
  _svSave('shop');
  return { ok: true };
};

/* ---------- rewards ---------- */
_svH['index:claim'] = (a) => {
  const p = _svP();
  const w = WORLD_BY_ID[a.worldId];
  if (!w) return _svFail('Unknown world');
  if (p.indexClaimed[w.id]) return _svFail('Already claimed');
  const all = ANIMALS.filter((x) => x.world === w.id);
  if (!all.length || !all.every((x) => (p.discovered[x.id] || 0) > 0)) return _svFail('Discover every animal first');
  p.indexClaimed[w.id] = true;
  const gems = w.indexReward || 0;
  p.gems += gems;
  Bus.emit('index:claimed', { worldId: w.id, gems });
  _svReward(0, gems, 0, 'index');
  _svCurrency(); _svSave('index');
  return { ok: true, gems };
};
_svH['daily:claim'] = () => {
  const p = _svP();
  const d = Services.dailyInfo();
  if (!d.ready) return _svFail('Come back in ' + fmtDur(d.secondsLeft));
  p.daily.streak = d.streak;
  p.daily.last = Date.now();
  p.gems += d.gems;
  p.coins += d.coins;
  Bus.emit('daily:claimed', { gems: d.gems, coins: d.coins });
  _svReward(d.coins, d.gems, 0, 'daily');
  _svCurrency(); _svSave('daily');
  return { ok: true, gems: d.gems, coins: d.coins };
};
_svH['settings:set'] = (a) => {
  const p = _svP();
  let v = a.value;
  if (a.key === 'quality') { if (!['auto', 'low', 'medium', 'high'].includes(v)) return _svFail('Bad value'); }
  else if (a.key === 'sound' || a.key === 'music') { if (typeof v !== 'boolean') return _svFail('Bad value'); }
  else if (a.key === 'volume') { if (!isNum(v)) return _svFail('Bad value'); v = clamp(v, 0, 1); }
  else return _svFail('Unknown setting');
  p.settings[a.key] = v;
  Bus.emit('settings:changed', { key: a.key, value: v });
  _svSave('settings');
  return { ok: true };
};

/* ---------- Services ---------- */
const Services = {
  stats() {
    const p = _svP();
    const F = FORMULAS;
    const lv = (id) => p.upgrades[id] || 0;
    const uv = (id) => F.upgradeValue(id, lv(id));
    const now = Date.now();
    const w = _svWorld() || WORLDS[0];
    const eqPets = [];
    for (const u of p.equipped) { const pet = _svPet(u); if (pet) eqPets.push(_svMultOfPet(pet)); }
    const petMult = F.petMultiplier(eqPets);
    const lb = _svBoostItem('boostLuck'), cb = _svBoostItem('boostCoins');
    const luckBoost = p.boosts.luck > now && lb ? (lb.mult || 1) : 1;
    const coinBoost = p.boosts.coins > now && cb ? (cb.mult || 1) : 1;
    return {
      gripPower: uv('strength') + F.strengthGripBonus(p.strength),
      protection: uv('protection'),
      clawSpeed: uv('speed'),
      capacity: Math.min(uv('capacity'), ECONOMY.pitMax),
      luck: uv('luck') * luckBoost,
      special: uv('special'),
      gemFinder: uv('gemFinder'),
      petMult,
      coinMult: petMult * uv('coinMagnet') * uv('cosmic') * F.strengthCoinBonus(p.strength) * w.rewardMult * coinBoost,
      trainMult: petMult * uv('trainer') * uv('cosmic') * w.trainMult,
      equipSlots: _svEquipSlots(),
      invSlots: _svInvSlots(),
    };
  },
  petMultOf(pet) { return pet ? _svMultOfPet(pet) : 1; },
  petsSorted(mode) {
    const arr = _svP().pets.slice();
    const m = (x) => _svMultOfPet(x);
    const ro = (x) => { const a = ANIMAL_BY_ID[x.id]; return a ? _svRarityOrder(a.rarity) : 0; };
    if (mode === 'rarity') arr.sort((a, b) => ro(b) - ro(a) || m(b) - m(a));
    else if (mode === 'new') arr.sort((a, b) => b.t - a.t);
    else arr.sort((a, b) => m(b) - m(a) || b.t - a.t);
    return arr;
  },
  ensurePit(worldId) {
    const p = _svP();
    const w = WORLD_BY_ID[worldId];
    const out = [];
    if (!w) return out;
    const st = Services.stats();
    const cap = Math.min(Math.floor(st.capacity), ECONOMY.pitMax);
    const m = _svMachine(w.id);
    const isLow = (e) => { const a = ANIMAL_BY_ID[e.id]; return a && _svRarityOrder(a.rarity) <= 1; };
    while (m.pit.length < cap) {
      const remaining = cap - m.pit.length;
      const lowNow = m.pit.filter(isLow).length;
      const forceLow = cap >= 6 && lowNow + remaining <= 2;
      let rid = weightedPick(FORMULAS.rarityWeights(w.id, st.luck, st.special)) || 'common';
      if (forceLow && _svRarityOrder(rid) > 1) rid = Math.random() < 0.7 ? 'common' : 'uncommon';
      const animal = _svPickAnimal(w.id, rid, forceLow);
      if (!animal) break;
      const entry = { pid: uid('a'), id: animal.id, variant: _svRollVariant(st.special) };
      m.pit.push(entry);
      out.push(entry);
      Bus.emit('pit:spawn', { worldId: w.id, entry });
    }
    return out;
  },
  previewGrip(pid, alignment) {
    const p = _svP();
    const m = p.machines[p.worlds.current];
    const entry = m && m.pit.find((e) => e.pid === pid);
    if (!entry) return 0;
    return FORMULAS.gripChance({ power: Services.stats().gripPower, weight: FORMULAS.animalWeight(entry.id, entry.variant), alignment: clamp(isNum(alignment) ? alignment : 0, 0, 1) });
  },
  canUnlockWorld(id) {
    const p = _svP();
    const w = WORLD_BY_ID[id];
    if (!w) return { ok: false, needStrength: 0, needCoins: 0, prevUnlocked: false };
    const idx = WORLDS.indexOf(w);
    const prevUnlocked = idx <= 0 || p.worlds.unlocked.includes(WORLDS[idx - 1].id);
    const needStrength = w.unlock.strength || 0, needCoins = w.unlock.coins || 0;
    const already = p.worlds.unlocked.includes(w.id);
    return { ok: !already && prevUnlocked && p.strength >= needStrength && p.coins >= needCoins, needStrength, needCoins, prevUnlocked, unlocked: already };
  },
  evolveInfo(uid) {
    const p = _svP();
    const need = ECONOMY.evolveCount;
    const pet = _svPet(uid);
    if (!pet) return { can: false, have: 0, need, next: null };
    const next = pet.variant === 'normal' ? 'golden' : pet.variant === 'golden' ? 'rainbow' : null;
    const have = p.pets.filter((x) => x.id === pet.id && x.variant === pet.variant && !x.locked).length;
    return { can: !!next && !pet.locked && have >= need, have, need, next };
  },
  nextGoal() {
    const p = _svP();
    const next = WORLDS.find((w) => !p.worlds.unlocked.includes(w.id));
    if (next) {
      const s = next.unlock.strength || 0, c = next.unlock.coins || 0;
      const parts = [], ratios = [];
      if (s > 0) { parts.push('💪 ' + fmt(p.strength) + ' / ' + fmt(s)); ratios.push(Math.min(1, p.strength / s)); }
      if (c > 0) { parts.push('🪙 ' + fmt(p.coins) + ' / ' + fmt(c)); ratios.push(Math.min(1, p.coins / c)); }
      const progress = ratios.length ? ratios.reduce((x, y) => x + y, 0) / ratios.length : 1;
      return { text: 'Unlock ' + next.name + (parts.length ? ': ' + parts.join(' · ') : ''), progress: clamp(progress, 0, 1) };
    }
    const total = ANIMALS.length;
    const got = ANIMALS.filter((a) => (p.discovered[a.id] || 0) > 0).length;
    return { text: 'Complete the Animal Index: ' + got + ' / ' + total, progress: total ? got / total : 1 };
  },
  dailyInfo() {
    const p = _svP();
    const D = ECONOMY.daily;
    const cd = D.cooldownHours * 3600 * 1000;
    const now = Date.now();
    const since = now - p.daily.last;
    const ready = p.daily.last <= 0 || since >= cd;
    const secondsLeft = ready ? 0 : Math.ceil((cd - since) / 1000);
    let streak = p.daily.streak || 0;
    if (ready) streak = p.daily.last > 0 && since <= cd * 2 ? streak + 1 : 1;
    const day = Math.max(0, Math.min(streak - 1, D.gems.length - 1));
    return { ready, secondsLeft, streak, gems: D.gems[day], coins: D.coins * (_svHighestOrder() + 1) };
  },
  tick(dt) {
    const p = _svP();
    if (!p || !isNum(dt) || dt <= 0) return;
    p.stats.playTime += dt;
    if (p.training.auto && p.shop.autoTrain) {
      _svAutoT += dt;
      let guard = 0;
      while (_svAutoT >= ECONOMY.autoTrainInterval && guard++ < 5) { _svAutoT -= ECONOMY.autoTrainInterval; _svRep(true); }
      if (_svAutoT > ECONOMY.autoTrainInterval) _svAutoT = 0;
    } else _svAutoT = 0;
    const now = Date.now();
    for (const [key, label] of [['luck', 'Luck boost ended'], ['coins', 'Coin boost ended']]) {
      const exp = p.boosts[key] || 0;
      if (exp > now) _svBoostLive[key] = true;
      else if (_svBoostLive[key] || exp > 0) {
        _svBoostLive[key] = false;
        if (exp > 0) p.boosts[key] = 0;
        _svToast(label, 'info');
      }
    }
  },
  debugGrant(g) {
    const p = _svP();
    g = isObj(g) ? g : {};
    if (isNum(g.coins)) p.coins = _svFloor(p.coins + g.coins);
    if (isNum(g.gems)) p.gems = _svFloor(p.gems + g.gems);
    if (isNum(g.strength)) p.strength = _svFloor(p.strength + g.strength);
    _svCurrency();
  },
};
