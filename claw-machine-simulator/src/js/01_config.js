/* =====================================================================
   CLAW MACHINE SIMULATOR — config (game design + balance)
   Pure data and pure functions. See ARCHITECTURE.md section 4.
   Private helpers start with _cf.
   ===================================================================== */

/* ---------- rarities ---------- */
const RARITIES = [
  { id: 'common',    name: 'Common',    order: 0, color: '#9fb4cc', glow: '#d3e2f5', weight: 100,  discoverGems: 1,   reveal: false, fx: 'none' },
  { id: 'uncommon',  name: 'Uncommon',  order: 1, color: '#4fd66a', glow: '#a6ffb4', weight: 40,   discoverGems: 2,   reveal: false, fx: 'shine' },
  { id: 'rare',      name: 'Rare',      order: 2, color: '#3b9bff', glow: '#9fd0ff', weight: 16,   discoverGems: 5,   reveal: true,  fx: 'sparkle' },
  { id: 'epic',      name: 'Epic',      order: 3, color: '#a85bff', glow: '#e0b8ff', weight: 6,    discoverGems: 10,  reveal: true,  fx: 'aura' },
  { id: 'legendary', name: 'Legendary', order: 4, color: '#ffb02e', glow: '#ffe08a', weight: 2.2,  discoverGems: 25,  reveal: true,  fx: 'beam' },
  { id: 'mythical',  name: 'Mythical',  order: 5, color: '#ff3fa8', glow: '#ff9ad6', weight: 0.7,  discoverGems: 50,  reveal: true,  fx: 'orbit' },
  { id: 'secret',    name: 'Secret',    order: 6, color: '#1c1636', glow: '#5cf3ff', weight: 0.25, discoverGems: 100, reveal: true,  fx: 'void' },
];
const RARITY_BY_ID = {};
for (const _cfR of RARITIES) RARITY_BY_ID[_cfR.id] = _cfR;

/* ---------- variants ---------- */
const VARIANTS = {
  normal:  { id: 'normal',  name: 'Normal',  mult: 1, color: '#ffffff', baseChance: 0.983 },
  golden:  { id: 'golden',  name: 'Golden',  mult: 3, color: '#ffd23d', baseChance: 0.015 },
  rainbow: { id: 'rainbow', name: 'Rainbow', mult: 8, color: '#ff5ad0', baseChance: 0.002 },
};

/* ---------- private balance tables ---------- */
const _cfWORLD_ORDER = ['starter', 'jungle', 'frozen', 'desert', 'space'];
// per world: value / pet-mult / grip-weight scaling
const _cfWV = { starter: 1, jungle: 3.5, frozen: 12, desert: 42, space: 150 };
const _cfWM = { starter: 1, jungle: 3.2, frozen: 10, desert: 32, space: 100 };
const _cfWW = { starter: 1, jungle: 1.2, frozen: 1.45, desert: 1.75, space: 2.05 };
// per rarity base values (starter world)
const _cfRV = { common: 12, uncommon: 26, rare: 70, epic: 200, legendary: 700, mythical: 1700, secret: 3200 };
const _cfRM = { common: 1.2, uncommon: 1.5, rare: 2.2, epic: 3.5, legendary: 6, mythical: 9, secret: 12 };
const _cfRWT = { common: 0.71, uncommon: 0.86, rare: 1.05, epic: 1.32, legendary: 1.65, mythical: 2.1, secret: 2.3 };
const _cfRS = { common: 0.9, uncommon: 0.98, rare: 1.05, epic: 1.12, legendary: 1.28, mythical: 1.3, secret: 1.2 };
// secret animals / mythicals get explicit weights (capped at 4)
const _cfSECRET_W = { starter: 2.3, jungle: 2.7, frozen: 3.1, desert: 3.6, space: 4.0 };
const _cfMYTH_W = { frozen: 3.0, desert: 3.5, space: 4.0 };
// gem drop tables
const _cfGEMCHANCE = { common: 0.01, uncommon: 0.02, rare: 0.05, epic: 0.1, legendary: 0.2, mythical: 0.3, secret: 0.5 };
const _cfGEMS = { common: 1, uncommon: 1, rare: 2, epic: 4, legendary: 8, mythical: 15, secret: 30 };

function _cfNice(n) {
  if (!(n > 0) || !Number.isFinite(n)) return 0;
  if (n < 100) return Math.round(n * 10) / 10;
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 2);
  return Math.round(n / mag) * mag;
}
function _cfNum(v, d) { return typeof v === 'number' && Number.isFinite(v) ? v : d; }

/* ---------- animals ---------- */
// o: { sz, wt } tweaks (size multiplier, grip weight offset)
function _cfAnimal(world, rarity, id, name, body, colors, ears, tail, pattern, extras, desc, o) {
  o = o || {};
  const wi = _cfWORLD_ORDER.indexOf(world);
  let weight;
  if (rarity === 'secret') weight = _cfSECRET_W[world];
  else if (rarity === 'mythical') weight = _cfMYTH_W[world];
  else weight = _cfRWT[rarity] * _cfWW[world];
  weight = Math.round((weight + (o.wt || 0)) * 100) / 100;
  weight = Math.min(4, Math.max(0.6, weight));
  const mult = _cfRM[rarity] * _cfWM[world];
  const value = _cfRV[rarity] * _cfWV[world];
  const size = Math.min(1.35, Math.max(0.8, Math.round(_cfRS[rarity] * (o.sz || 1) * 100) / 100));
  void wi;
  return {
    id, name, world, rarity,
    mult: Math.round(mult * 10) / 10,
    value: _cfNice(value),
    weight, size, body,
    colors, ears, tail, pattern, extras, desc,
  };
}
const _cfS = 'starter', _cfJ = 'jungle', _cfF = 'frozen', _cfD = 'desert', _cfX = 'space';

const ANIMALS = [
  /* ---- Starter Arcade: farm and home pets ---- */
  _cfAnimal(_cfS, 'common', 'bunny', 'Bunny', 'quad',
    { main: '#ffdce8', accent: '#ff8fb3', belly: '#fff7fa', eye: '#3a2a4a' }, 'long', 'puff', 'none', [],
    'Hops around the arcade and nibbles every carrot prize in sight.', { wt: -0.02 }),
  _cfAnimal(_cfS, 'common', 'chick', 'Chick', 'bird',
    { main: '#ffe45c', accent: '#ff9f2e', belly: '#fff5b0', eye: '#2a2438' }, 'none', 'puff', 'none', ['beak'],
    'Peeps loudly whenever the claw gets close.', { sz: 0.92, wt: 0.03 }),
  _cfAnimal(_cfS, 'uncommon', 'puppy', 'Puppy', 'quad',
    { main: '#dca56a', accent: '#8a5a2b', belly: '#fff0d6', eye: '#2a1c14' }, 'floppy', 'long', 'patch', [],
    'Wags its tail so hard the whole machine wobbles.', { wt: -0.02 }),
  _cfAnimal(_cfS, 'uncommon', 'kitten', 'Kitten', 'biped',
    { main: '#ffb46b', accent: '#d9742a', belly: '#fff1dc', eye: '#2a2a10' }, 'pointy', 'long', 'stripes', ['whiskers'],
    'Pretends it is not interested in the claw. It totally is.', { wt: 0.02 }),
  _cfAnimal(_cfS, 'rare', 'piglet', 'Piglet', 'round',
    { main: '#ffb3c7', accent: '#ff7fa3', belly: '#ffd6e2', eye: '#3a1c2a' }, 'floppy', 'curl', 'none', ['snout'],
    'Loves mud, hugs, and shiny coins.'),
  _cfAnimal(_cfS, 'epic', 'fox_cub', 'Fox Cub', 'biped',
    { main: '#ff8a3d', accent: '#3d2a22', belly: '#fff4e6', eye: '#2a1408' }, 'pointy', 'fluffy', 'none', ['scarf', 'star'],
    'A clever cub with a scarf made of sunset.'),
  _cfAnimal(_cfS, 'legendary', 'unicorn', 'Sparkle Unicorn', 'quad',
    { main: '#fdf3ff', accent: '#c27bff', belly: '#ffe3f7', eye: '#7a3fd0' }, 'pointy', 'fluffy', 'none', ['horn', 'mane', 'halo', 'star'],
    'Its horn lights up every time someone believes in magic.'),
  _cfAnimal(_cfS, 'secret', 'glitch_fish', 'Glitch Fish', 'fish',
    { main: '#14102a', accent: '#ff2fd0', belly: '#31ffd8', eye: '#ffffff' }, 'none', 'fin', 'stripes', ['crystal', 'star', 'halo'],
    'Flickers between here and somewhere else. Is it even real?'),

  /* ---- Jungle Arcade ---- */
  _cfAnimal(_cfJ, 'common', 'monkey', 'Monkey', 'biped',
    { main: '#8a5a3a', accent: '#e8b98a', belly: '#e8b98a', eye: '#1c1008' }, 'round', 'long', 'none', [],
    'Swings in from the vines and swipes your snacks.', { wt: -0.02 }),
  _cfAnimal(_cfJ, 'common', 'tree_frog', 'Tree Frog', 'round',
    { main: '#5fd35f', accent: '#ff5a4d', belly: '#e9ffd0', eye: '#ffe14a' }, 'none', 'none', 'spots', [],
    'Ribbit! Its toes stick to everything, even the glass.', { wt: 0.03 }),
  _cfAnimal(_cfJ, 'uncommon', 'toucan', 'Toucan', 'bird',
    { main: '#2c2c3a', accent: '#ff9f1c', belly: '#fff3c9', eye: '#ffffff' }, 'none', 'long', 'patch', ['beak'],
    'Its giant beak is great for sneaking fruit out of the pit.', { wt: -0.02 }),
  _cfAnimal(_cfJ, 'uncommon', 'sloth', 'Sloth', 'biped',
    { main: '#b59a76', accent: '#6b4f36', belly: '#e8d8b8', eye: '#2a1c10' }, 'small', 'none', 'patch', ['mask'],
    'Takes ten minutes to wave hello. Worth it.', { wt: 0.03 }),
  _cfAnimal(_cfJ, 'rare', 'tiger_cub', 'Tiger Cub', 'quad',
    { main: '#ff9a2e', accent: '#2b1d16', belly: '#fff1d8', eye: '#2a2a10' }, 'round', 'long', 'stripes', ['whiskers'],
    'Practising its roar. So far it sounds like a squeaky toy.'),
  _cfAnimal(_cfJ, 'epic', 'chameleon', 'Chameleon', 'snake',
    { main: '#3fd6a3', accent: '#ff5ac8', belly: '#d9ffe9', eye: '#ffe14a' }, 'none', 'curl', 'spots', ['crystal', 'mask'],
    'Changes colour to match its mood. Currently: smug.'),
  _cfAnimal(_cfJ, 'legendary', 'emerald_elephant', 'Emerald Elephant', 'quad',
    { main: '#4fd18b', accent: '#ffd84a', belly: '#c9ffe0', eye: '#183a22' }, 'floppy', 'long', 'none', ['trunk', 'tusks', 'crown'],
    'Royal guardian of the jungle. Its stomp makes coins jump.', { sz: 1.02 }),
  _cfAnimal(_cfJ, 'secret', 'moon_firefly', 'Moonlit Firefly', 'bug',
    { main: '#1b1030', accent: '#c6ff3d', belly: '#fff98a', eye: '#ffffff' }, 'none', 'puff', 'spots', ['antennae', 'halo', 'crystal'],
    'Only appears when the jungle is quiet and the arcade lights flicker.'),

  /* ---- Frozen Arcade ---- */
  _cfAnimal(_cfF, 'common', 'penguin', 'Penguin', 'bird',
    { main: '#2b3a5c', accent: '#ffb12e', belly: '#ffffff', eye: '#ffffff' }, 'none', 'puff', 'patch', ['beak'],
    'Slides in on its belly for every prize.', { wt: -0.02 }),
  _cfAnimal(_cfF, 'common', 'seal_pup', 'Seal Pup', 'round',
    { main: '#cfd9e8', accent: '#8fa3c0', belly: '#ffffff', eye: '#1b2540' }, 'small', 'fin', 'spots', ['whiskers'],
    'Claps its flippers whenever someone wins.', { wt: 0.03 }),
  _cfAnimal(_cfF, 'uncommon', 'arctic_fox', 'Arctic Fox', 'quad',
    { main: '#f4fbff', accent: '#8fd3ff', belly: '#ffffff', eye: '#2a3a6a' }, 'pointy', 'fluffy', 'none', ['whiskers']
    , 'Blends into the snow, except for the sparkly nose.'),
  _cfAnimal(_cfF, 'rare', 'polar_bear', 'Polar Bear', 'biped',
    { main: '#eef6ff', accent: '#6fc2c9', belly: '#ffffff', eye: '#1b2540' }, 'round', 'puff', 'none', ['scarf'],
    'A big marshmallow of a bear. Gives the best hugs.'),
  _cfAnimal(_cfF, 'epic', 'snowy_owl', 'Snowy Owl', 'bird',
    { main: '#f5f8ff', accent: '#6fa8ff', belly: '#ffffff', eye: '#ffd23d' }, 'pointy', 'fluffy', 'spots', ['beak', 'star'],
    'Wise, fluffy and surprisingly good at claw machines.'),
  _cfAnimal(_cfF, 'legendary', 'yeti', 'Friendly Yeti', 'biped',
    { main: '#cfe8ff', accent: '#5aa9ff', belly: '#ffffff', eye: '#16224a' }, 'small', 'none', 'patch', ['horns', 'mane', 'crystal'],
    'The mountain legend is real, and it just wants a high five.', { sz: 1.02 }),
  _cfAnimal(_cfF, 'mythical', 'ice_dragon', 'Ice Dragon', 'snake',
    { main: '#7fe7ff', accent: '#2b6dff', belly: '#e6fbff', eye: '#ffffff' }, 'pointy', 'fin', 'stripes', ['wings', 'horns', 'crystal', 'crown'],
    'Breathes frosty glitter instead of fire.'),
  _cfAnimal(_cfF, 'secret', 'aurora_narwhal', 'Aurora Narwhal', 'fish',
    { main: '#2a1b5e', accent: '#6bffd8', belly: '#ff9cf0', eye: '#ffffff' }, 'none', 'fin', 'spots', ['horn', 'halo', 'star'],
    'Swims through the northern lights. Nobody knows where it lives.'),

  /* ---- Desert Arcade ---- */
  _cfAnimal(_cfD, 'common', 'camel', 'Camel', 'quad',
    { main: '#e2b36e', accent: '#b5793a', belly: '#f7e2b8', eye: '#2a1c0c' }, 'small', 'puff', 'patch', ['snout'],
    'Stores snacks in its hump. Do not ask which snacks.', { wt: -0.02 }),
  _cfAnimal(_cfD, 'common', 'sand_gecko', 'Sand Gecko', 'snake',
    { main: '#f0c04a', accent: '#e0762e', belly: '#fff0b8', eye: '#2a1c0c' }, 'none', 'curl', 'spots', [],
    'Sunbathes on top of the machine all day.', { wt: 0.03 }),
  _cfAnimal(_cfD, 'uncommon', 'fennec_fox', 'Fennec Fox', 'quad',
    { main: '#ffcf8f', accent: '#c97b45', belly: '#fff4e0', eye: '#2a1408' }, 'long', 'fluffy', 'none', ['whiskers'],
    'Those enormous ears can hear a coin drop a mile away.'),
  _cfAnimal(_cfD, 'rare', 'scorpion', 'Cuddly Scorpion', 'bug',
    { main: '#d9533a', accent: '#ffb347', belly: '#ffd9a0', eye: '#2a0c08' }, 'none', 'stinger', 'stripes', ['horns'],
    'Looks scary, but its sting is just a tiny tickle.'),
  _cfAnimal(_cfD, 'epic', 'cobra', 'Sunset Cobra', 'snake',
    { main: '#2fb88f', accent: '#ffd84a', belly: '#fff3b0', eye: '#ff3a2a' }, 'none', 'long', 'stripes', ['mask', 'crown'],
    'Sways to the arcade music like a tiny snake charmer.'),
  _cfAnimal(_cfD, 'legendary', 'sphinx_cat', 'Sphinx Cat', 'quad',
    { main: '#f0d28a', accent: '#2f6fd0', belly: '#fff3cf', eye: '#29c6e0' }, 'pointy', 'long', 'stripes', ['hat', 'wings', 'halo'],
    'Guards a riddle: how many coins fit in one claw? Answer: all.', { sz: 1.02 }),
  _cfAnimal(_cfD, 'mythical', 'phoenix', 'Desert Phoenix', 'bird',
    { main: '#ff5a2a', accent: '#ffd02a', belly: '#fff0a8', eye: '#ffffff' }, 'none', 'fluffy', 'none', ['wings', 'flame', 'crown', 'beak'],
    'Bursts into flames and comes back fluffier every time.'),
  _cfAnimal(_cfD, 'secret', 'pharaoh_scarab', 'Pharaoh Scarab', 'bug',
    { main: '#0f1a3a', accent: '#ffd84a', belly: '#33e0ff', eye: '#ffffff' }, 'none', 'none', 'spots', ['shell', 'halo', 'crystal'],
    'Rolls the sun across the sky, and sometimes across your prize chute.'),

  /* ---- Space Arcade ---- */
  _cfAnimal(_cfX, 'common', 'alien_blob', 'Alien Blob', 'round',
    { main: '#8bff6a', accent: '#c8ff9a', belly: '#e9ffd6', eye: '#1a1a3a' }, 'none', 'none', 'spots', ['antennae'],
    'Wobbles, giggles and glows. Mostly wobbles.', { wt: -0.02 }),
  _cfAnimal(_cfX, 'common', 'space_cat', 'Space Cat', 'quad',
    { main: '#9aa8ff', accent: '#ffe86a', belly: '#e3e8ff', eye: '#1c1c4a' }, 'pointy', 'long', 'patch', ['glasses'],
    'Wears a bubble helmet and still knocks things off shelves.', { wt: 0.03 }),
  _cfAnimal(_cfX, 'uncommon', 'robo_dog', 'Robo-Dog', 'quad',
    { main: '#c9d3e6', accent: '#34e0ff', belly: '#ffffff', eye: '#34e0ff' }, 'floppy', 'curl', 'patch', ['antennae'],
    'Fetches coins with 100 percent accuracy. Bark.exe not found.'),
  _cfAnimal(_cfX, 'rare', 'moon_bunny', 'Moon Bunny', 'biped',
    { main: '#ece8ff', accent: '#b48cff', belly: '#ffffff', eye: '#3a2a6a' }, 'long', 'puff', 'spots', ['star'],
    'Bounces six times higher up here. Never gets tired of it.'),
  _cfAnimal(_cfX, 'epic', 'star_whale', 'Star Whale', 'fish',
    { main: '#3d5cff', accent: '#ffe45c', belly: '#b9c8ff', eye: '#ffffff' }, 'none', 'fin', 'spots', ['fins', 'star'],
    'Sings low songs that make the stars twinkle in time.'),
  _cfAnimal(_cfX, 'legendary', 'cosmic_jelly', 'Cosmic Jellyfish', 'round',
    { main: '#ff7bd5', accent: '#4de3ff', belly: '#ffd6f4', eye: '#ffffff' }, 'none', 'long', 'spots', ['antennae', 'halo', 'crystal'],
    'Drifts between galaxies and leaves a trail of glitter.', { sz: 1.02 }),
  _cfAnimal(_cfX, 'mythical', 'galaxy_dragon', 'Galaxy Dragon', 'biped',
    { main: '#5b2bd9', accent: '#ff4de0', belly: '#33e8ff', eye: '#ffffff' }, 'pointy', 'long', 'spots', ['wings', 'horns', 'flame', 'star'],
    'Its scales hold a whole tiny galaxy. It sneezes comets.'),
  _cfAnimal(_cfX, 'secret', 'void_moth', 'Void Moth', 'bug',
    { main: '#07040f', accent: '#a64dff', belly: '#37ffe3', eye: '#ffffff' }, 'none', 'none', 'stripes', ['wings', 'antennae', 'halo', 'star'],
    'Born inside a black hole. It is not sure what colour it is.'),
];
const ANIMAL_BY_ID = {};
for (const _cfA of ANIMALS) ANIMAL_BY_ID[_cfA.id] = _cfA;

/* ---------- worlds ---------- */
const WORLDS = [
  { id: 'starter', name: 'Starter Arcade', order: 0,
    unlock: { strength: 0, coins: 0 }, playCost: 0, rewardMult: 1, trainMult: 1,
    rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'secret'],
    indexReward: 50, machineName: 'Classic Claw', newUpgrade: null,
    desc: 'A cosy neon arcade full of farm and home pets. Perfect for your first grabs!',
    theme: { decor: 'arcade', floorA: '#3a2a6e', floorB: '#2f2260', wall: '#5b3fa8', wallTrim: '#ff4fd8', ceiling: '#1d1440',
      accent: '#2ee6c8', neon: '#ff4fd8', fog: '#2a1c55', ambient: '#b9a8ff', light: '#fff2e0',
      machineBody: '#ff4f8b', machineTrim: '#ffd23d', pitFloor: '#6a52c9' } },
  { id: 'jungle', name: 'Jungle Arcade', order: 1,
    unlock: { strength: 2000, coins: 500 }, playCost: 100, rewardMult: 1, trainMult: 1.25,
    rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'secret'],
    indexReward: 100, machineName: 'Vine Grabber', newUpgrade: 'coinMagnet',
    desc: 'Vines, drums and wild critters. Heavier animals need a stronger claw!',
    theme: { decor: 'jungle', floorA: '#3f7d3a', floorB: '#35692f', wall: '#6b4a2b', wallTrim: '#3fd16a', ceiling: '#1f4a2a',
      accent: '#ffd23d', neon: '#7dff5a', fog: '#23512f', ambient: '#c9ffc0', light: '#fff7d0',
      machineBody: '#2fa84f', machineTrim: '#8a5a2b', pitFloor: '#a8743a' } },
  { id: 'frozen', name: 'Frozen Arcade', order: 2,
    unlock: { strength: 28000, coins: 12000 }, playCost: 1500, rewardMult: 1, trainMult: 1.5,
    rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'secret'],
    indexReward: 200, machineName: 'Frost Claw', newUpgrade: 'trainer',
    desc: 'Slippery floors and icy friends. Mythical animals show up here!',
    theme: { decor: 'frozen', floorA: '#cfeaff', floorB: '#b6dcff', wall: '#8fc7f5', wallTrim: '#ffffff', ceiling: '#6fa8e0',
      accent: '#3ad0ff', neon: '#7ff0ff', fog: '#a8d8ff', ambient: '#e0f2ff', light: '#f4fbff',
      machineBody: '#4aa8ff', machineTrim: '#e9f8ff', pitFloor: '#dff3ff' } },
  { id: 'desert', name: 'Desert Arcade', order: 3,
    unlock: { strength: 1400000, coins: 250000 }, playCost: 60000, rewardMult: 1, trainMult: 1.75,
    rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'secret'],
    indexReward: 350, machineName: 'Sand Scooper', newUpgrade: 'gemFinder',
    desc: 'Scorching sands and ancient treasure. Gems are easier to find here.',
    theme: { decor: 'desert', floorA: '#e8b878', floorB: '#d9a35f', wall: '#c8693a', wallTrim: '#ffd27a', ceiling: '#8a3f26',
      accent: '#ff8a2a', neon: '#ffb340', fog: '#f0c790', ambient: '#ffe2b8', light: '#fff0cf',
      machineBody: '#e0572e', machineTrim: '#ffd27a', pitFloor: '#f2d39a' } },
  { id: 'space', name: 'Space Arcade', order: 4,
    unlock: { strength: 75000000, coins: 6000000 }, playCost: 1500000, rewardMult: 1, trainMult: 2,
    rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'secret'],
    indexReward: 600, machineName: 'Cosmo Claw', newUpgrade: 'cosmic',
    desc: 'Zero gravity, neon stars and cosmic critters. The ultimate claw challenge!',
    theme: { decor: 'space', floorA: '#1a1d4a', floorB: '#12153a', wall: '#241a5e', wallTrim: '#34e8ff', ceiling: '#080a24',
      accent: '#34e8ff', neon: '#b455ff', fog: '#0c0e32', ambient: '#8f9bff', light: '#d9e4ff',
      machineBody: '#6a3df0', machineTrim: '#34e8ff', pitFloor: '#2a2f7a' } },
];
const WORLD_BY_ID = {};
for (const _cfW of WORLDS) WORLD_BY_ID[_cfW.id] = _cfW;

/* ---------- upgrades ---------- */
const UPGRADES = [
  { id: 'strength',   name: 'Claw Strength',    desc: 'A stronger claw grips heavy animals more often.', icon: '💪', currency: 'coins', baseCost: 35,   growth: 1.5, maxLevel: 50, world: 'starter' },
  { id: 'luck',       name: 'Luck',             desc: 'Rare animals show up more often in the machine.', icon: '🍀', currency: 'coins', baseCost: 50,   growth: 1.5, maxLevel: 50, world: 'starter' },
  { id: 'speed',      name: 'Movement Speed',   desc: 'The claw glides faster across the machine.',      icon: '⚡', currency: 'coins', baseCost: 30,   growth: 1.45,  maxLevel: 50, world: 'starter' },
  { id: 'protection', name: 'Drop Protection',  desc: 'Held animals slip out of the claw less often.',   icon: '🛡️', currency: 'coins', baseCost: 45,   growth: 1.5, maxLevel: 50, world: 'starter' },
  { id: 'capacity',   name: 'Machine Capacity', desc: 'More animals fit in the machine to pick from.',   icon: '📦', currency: 'coins', baseCost: 80,   growth: 1.55, maxLevel: 12, world: 'starter' },
  { id: 'special',    name: 'Special Chance',   desc: 'Boosts golden and rainbow animals and secrets.',  icon: '🎲', currency: 'coins', baseCost: 90,  growth: 1.5,  maxLevel: 50, world: 'starter' },
  { id: 'coinMagnet', name: 'Coin Magnet',      desc: 'Every catch drops more coins.',                   icon: '🧲', currency: 'coins', baseCost: 3000,  growth: 1.5, maxLevel: 30, world: 'jungle' },
  { id: 'trainer',    name: 'Personal Trainer', desc: 'Every rep builds more strength.',                 icon: '🏋️', currency: 'coins', baseCost: 150000, growth: 1.5, maxLevel: 30, world: 'frozen' },
  { id: 'gemFinder',  name: 'Gem Finder',       desc: 'Catches have a bigger chance to drop gems.',      icon: '💎', currency: 'coins', baseCost: 5000000, growth: 1.5, maxLevel: 30, world: 'desert' },
  { id: 'cosmic',     name: 'Cosmic Power',     desc: 'Multiplies coins AND training strength.',         icon: '🌌', currency: 'gems',  baseCost: 15,   growth: 1.25, maxLevel: 10, world: 'space' },
];
const UPGRADE_BY_ID = {};
for (const _cfU of UPGRADES) UPGRADE_BY_ID[_cfU.id] = _cfU;

/* ---------- training equipment ---------- */
const TRAINING_EQUIPMENT = [
  { id: 'foam_dumbbell',    name: 'Foam Dumbbell',    world: 'starter', power: 1,     requires: 0,      model: 'dumbbell',  color: '#ff7ac8' },
  { id: 'iron_kettlebell',  name: 'Iron Kettlebell',  world: 'starter', power: 3,     requires: 100,     model: 'kettlebell', color: '#5a6a8a' },
  { id: 'bamboo_barbell',   name: 'Bamboo Barbell',   world: 'jungle',  power: 7,    requires: 2000,    model: 'barbell',   color: '#9bd04a' },
  { id: 'jungle_log',       name: 'Mighty Log',       world: 'jungle',  power: 16,    requires: 7500,   model: 'log',       color: '#a8743a' },
  { id: 'ice_block',        name: 'Ice Block',        world: 'frozen',  power: 38,   requires: 28000,   model: 'iceblock',  color: '#8fe3ff' },
  { id: 'frost_dumbbell',   name: 'Frost Dumbbell',   world: 'frozen',  power: 90,   requires: 200000,  model: 'dumbbell',  color: '#5aa9ff' },
  { id: 'sandstone_boulder', name: 'Sandstone Boulder', world: 'desert', power: 200, requires: 1400000,  model: 'boulder',   color: '#e0a860' },
  { id: 'pharaoh_anvil',    name: 'Pharaoh Anvil',    world: 'desert',  power: 480,  requires: 10000000, model: 'anvil',     color: '#ffd23d' },
  { id: 'star_kettlebell',  name: 'Star Kettlebell',  world: 'space',   power: 1100, requires: 75000000, model: 'kettlebell', color: '#b455ff' },
  { id: 'meteor_chunk',     name: 'Meteor Chunk',     world: 'space',   power: 2600, requires: 300000000, model: 'meteor',   color: '#ff6a3a' },
];
const EQUIPMENT_BY_ID = {};
for (const _cfE of TRAINING_EQUIPMENT) EQUIPMENT_BY_ID[_cfE.id] = _cfE;

/* ---------- gem shop ---------- */
const GEM_SHOP = [
  { id: 'equipSlot', kind: 'equipSlot', name: 'Pet Slot',        desc: 'Equip one more pet at the same time.',       icon: '🐾', cost: [50, 100, 200, 400, 800], max: 5 },
  { id: 'invSlots',  kind: 'invSlots',  name: 'Inventory Space', desc: 'Adds 25 more places to store pets.',          icon: '🎒', cost: 30, max: 10 },
  { id: 'autoTrain', kind: 'autoTrain', name: 'Auto Trainer',    desc: 'Your hero keeps training automatically.',     icon: '🤖', cost: 150, max: 1 },
  { id: 'boostLuck', kind: 'boostLuck', name: 'Luck Boost',      desc: 'Double luck for 15 minutes.',                 icon: '🍀', cost: 40, duration: 900, mult: 2 },
  { id: 'boostCoins', kind: 'boostCoins', name: 'Coin Boost',    desc: 'Double coins for 15 minutes.',                icon: '🪙', cost: 40, duration: 900, mult: 2 },
];

/* ---------- economy constants ---------- */
const ECONOMY = {
  startCoins: 10, startGems: 10,
  playTime: 20, carryTime: 5,
  repCooldown: 0.3, autoTrainInterval: 0.6, autoTrainFactor: 0.6,
  baseEquipSlots: 3, maxEquipSlots: 8,
  baseInvSlots: 50, invSlotsPerPurchase: 25,
  evolveCount: 5, pitMax: 18,
  sellFactor: 1.2,
  // coins is the base amount; Services multiplies it by (highest unlocked world order + 1)
  daily: { cooldownHours: 20, gems: [5, 8, 12, 15, 20, 25, 40], coins: 250 },
};

/* ---------- formulas ---------- */
const _cfGRIP_EXP = 4;          // steepness of the weight/power curve
const _cfSLIP_K = 0.0582;       // base slip hazard
const _cfSLIP_EXP = 1.7;
function _cfLevel(level) { return Math.max(0, Math.min(500, Math.floor(_cfNum(level, 0)))); }

const FORMULAS = {
  upgradeCost(id, level) {
    const u = UPGRADE_BY_ID[id];
    if (!u) return 1e15;
    const L = _cfLevel(level);
    return Math.max(1, _cfNice(Math.ceil(u.baseCost * Math.pow(u.growth, Math.min(L, 200)))));
  },
  upgradeValue(id, level) {
    const L = _cfLevel(level);
    switch (id) {
      case 'strength':   return Math.round((1 + 0.085 * L) * 1000) / 1000;
      case 'luck':       return Math.round((1 + 0.1 * L) * 100) / 100;
      case 'speed':      return Math.round((0.6 + 1.05 * (1 - Math.exp(-L / 20))) * 100) / 100;
      case 'protection': return Math.round(clamp(0.9 * (1 - Math.exp(-L / 16)), 0, 0.9) * 1000) / 1000;
      case 'capacity':   return Math.min(6 + L, ECONOMY.pitMax);
      case 'special':    return Math.round((1 + 0.12 * L) * 100) / 100;
      case 'coinMagnet': return Math.round((1 + 0.2 * L) * 100) / 100;
      case 'trainer':    return Math.round((1 + 0.2 * L) * 100) / 100;
      case 'gemFinder':  return Math.round(0.005 * L * 1000) / 1000;
      case 'cosmic':     return Math.round((1 + 0.25 * L) * 100) / 100;
      default:           return 1;
    }
  },
  upgradeCap(id, unlockedCount) {
    const u = UPGRADE_BY_ID[id];
    if (!u) return 0;
    const n = Math.floor(_cfNum(unlockedCount, 1));
    const order = _cfWORLD_ORDER.indexOf(u.world);
    return clamp(10 * (n - Math.max(0, order)), 0, u.maxLevel);
  },
  formatUpgrade(id, value) {
    const v = _cfNum(value, 0);
    switch (id) {
      case 'strength':   return '+' + Math.round((v - 1) * 100) + '% grip';
      case 'luck':       return fmtMult(v) + ' luck';
      case 'speed':      return (Math.round(v * 100) / 100) + ' m/s';
      case 'protection': return Math.round(v * 100) + '% fewer slips';
      case 'capacity':   return Math.round(v) + ' animals';
      case 'special':    return fmtMult(v) + ' special';
      case 'coinMagnet': return fmtMult(v) + ' coins';
      case 'trainer':    return fmtMult(v) + ' training';
      case 'gemFinder':  return '+' + (Math.round(v * 1000) / 10) + '% gems';
      case 'cosmic':     return fmtMult(v) + ' coins & training';
      default:           return String(Math.round(v * 100) / 100);
    }
  },
  rarityWeights(worldId, luck, special) {
    const w = WORLD_BY_ID[worldId] || WORLDS[0];
    const lk = clamp(_cfNum(luck, 1), 0.1, 1000);
    const sp = clamp(_cfNum(special, 1), 0.1, 1000);
    const out = {};
    for (const rid of w.rarities) {
      const r = RARITY_BY_ID[rid];
      if (!r) continue;
      let x = r.weight;
      if (r.order >= 2) x *= lk;
      if (rid === 'secret') x *= sp;
      out[rid] = x;
    }
    return out;
  },
  variantChances(special) {
    const sp = clamp(_cfNum(special, 1), 0.1, 1000);
    return {
      golden: clamp(VARIANTS.golden.baseChance * sp, 0, 0.3),
      rainbow: clamp(VARIANTS.rainbow.baseChance * sp, 0, 0.1),
    };
  },
  animalWeight(animalId, variant) {
    const a = ANIMAL_BY_ID[animalId];
    const base = a ? a.weight : 1;
    const k = variant === 'rainbow' ? 1.25 : variant === 'golden' ? 1.1 : 1;
    return base * k;
  },
  gripChance(o) {
    o = o || {};
    const power = Math.max(0.05, _cfNum(o.power, 1));
    const weight = Math.max(0.05, _cfNum(o.weight, 1));
    const al = clamp(_cfNum(o.alignment, 1), 0, 1);
    const base = 1 / (1 + Math.pow(weight / power, _cfGRIP_EXP));
    return clamp(base * (0.2 + 0.8 * al), 0.02, 0.98);
  },
  slipRate(o) {
    o = o || {};
    const prot = clamp(_cfNum(o.protection, 0), 0, 0.95);
    const weight = Math.max(0.05, _cfNum(o.weight, 1));
    return clamp(_cfSLIP_K * Math.pow(weight, _cfSLIP_EXP) * (1 - prot), 0, 3);
  },
  catchCoins(o) {
    o = o || {};
    const a = ANIMAL_BY_ID[o.animalId];
    const v = VARIANTS[o.variant] || VARIANTS.normal;
    const cm = Math.max(0, _cfNum(o.coinMult, 1));
    const n = Math.round((a ? a.value : 1) * v.mult * cm);
    return Math.max(1, Number.isFinite(n) ? n : 1);
  },
  catchGemChance(o) {
    o = o || {};
    const a = ANIMAL_BY_ID[o.animalId];
    const base = a ? _cfGEMCHANCE[a.rarity] || 0 : 0;
    const vk = o.variant === 'rainbow' ? 2 : o.variant === 'golden' ? 1.5 : 1;
    return clamp(base * vk + Math.max(0, _cfNum(o.gemFinder, 0)), 0, 0.95);
  },
  catchGems(animalId) {
    const a = ANIMAL_BY_ID[animalId];
    if (!a) return 1;
    const wi = Math.max(0, _cfWORLD_ORDER.indexOf(a.world));
    return Math.max(1, Math.round((_cfGEMS[a.rarity] || 1) * (1 + 0.5 * wi)));
  },
  trainGain(o) {
    o = o || {};
    const e = EQUIPMENT_BY_ID[o.equipmentId] || EQUIPMENT_BY_ID.foam_dumbbell;
    const tm = Math.max(0, _cfNum(o.trainMult, 1));
    return Math.max(0.01, Math.round(e.power * Math.pow(tm, 0.5) * 100) / 100);
  },
  petMultiplier(mults) {
    let s = 1;
    if (Array.isArray(mults)) for (const m of mults) { if (typeof m === 'number' && Number.isFinite(m) && m > 1) s += m - 1; }
    return s;
  },
  strengthCoinBonus(strength) {
    const s = Math.max(0, _cfNum(strength, 0));
    return 1 + 0.4 * Math.log10(1 + s / 30);
  },
  strengthGripBonus(strength) {
    const s = Math.max(0, _cfNum(strength, 0));
    return clamp(0.12 * Math.log10(1 + s / 100), 0, 0.8);
  },
  sellValue(animalId, variant) {
    const a = ANIMAL_BY_ID[animalId];
    const v = VARIANTS[variant] || VARIANTS.normal;
    return Math.max(1, Math.round((a ? a.value : 1) * v.mult * ECONOMY.sellFactor));
  },
};
