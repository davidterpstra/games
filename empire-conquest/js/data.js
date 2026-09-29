/* =====================================================================
   EMPIRE CONQUEST — game data (terrain, settlements, buildings, units,
   technologies, kingdoms, rulers, generals, missions)
   All balancing numbers live here. Rates are per game day
   (1 day = 1 second at 1x speed).
   ===================================================================== */
'use strict';

const TERRAIN = {
  plains: {
    name: 'Plains', icon: '🌾', food: 3.0, wood: 0.6, iron: 0.1, gold: 0.6,
    farm: 1.3, lumber: 0.8, mine: 0.6, market: 1.0, defense: 0.0, move: 1.0, cav: 0.15, arch: 0, pop: 1.1,
    desc: 'Fertile open land. Farms thrive and cavalry charges freely.',
  },
  forest: {
    name: 'Forest', icon: '🌳', food: 1.6, wood: 3.0, iron: 0.1, gold: 0.4,
    farm: 0.8, lumber: 1.6, mine: 0.7, market: 0.9, defense: 0.15, move: 1.3, cav: -0.2, arch: 0.15, pop: 0.95,
    desc: 'Dense woods: rich in timber. Defending archers excel, cavalry struggles.',
  },
  mountains: {
    name: 'Mountains', icon: '🏔️', food: 0.6, wood: 0.6, iron: 2.2, gold: 1.0,
    farm: 0.5, lumber: 0.6, mine: 1.8, market: 0.8, defense: 0.4, move: 1.7, cav: -0.35, arch: 0.1, pop: 0.75,
    desc: 'Rugged peaks full of iron and gold. A natural fortress.',
  },
  desert: {
    name: 'Desert', icon: '🏜️', food: 0.5, wood: 0.1, iron: 0.5, gold: 1.8,
    farm: 0.4, lumber: 0.3, mine: 1.1, market: 1.4, defense: 0.05, move: 1.4, cav: 0.1, arch: 0, pop: 0.75,
    desc: 'Harsh sands crossed by caravan routes. Markets earn extra gold.',
  },
  snow: {
    name: 'Snow', icon: '❄️', food: 0.5, wood: 1.4, iron: 0.9, gold: 0.3,
    farm: 0.35, lumber: 1.1, mine: 1.2, market: 0.8, defense: 0.25, move: 1.6, cav: -0.15, arch: 0, pop: 0.75,
    desc: 'The frozen north. Poor harvests, but hard to invade.',
  },
  island: {
    name: 'Islands', icon: '🏝️', food: 2.2, wood: 1.0, iron: 0.2, gold: 1.6,
    farm: 1.0, lumber: 0.9, mine: 0.6, market: 1.4, defense: 0.2, move: 1.0, cav: 0, arch: 0.05, pop: 1.0,
    desc: 'Isolated isles rich in fish and sea trade. Invaders must land by sea.',
  },
};
const TERRAIN_WATER = { name: 'Water', icon: '🌊' };

/* Settlement tiers: Village → Town → City → Major City → Capital */
const TIERS = [
  { name: 'Village', icon: '🛖', popCap: 250, gold: 0.5, mult: 1.00, maxLvl: 1, recruit: 0.7 },
  { name: 'Town', icon: '🏘️', popCap: 600, gold: 1.5, mult: 1.10, maxLvl: 2, recruit: 1.0,
    req: { pop: 200, dev: 1 }, cost: { gold: 250, wood: 150 }, time: 15 },
  { name: 'City', icon: '🏙️', popCap: 1400, gold: 3.0, mult: 1.25, maxLvl: 3, recruit: 1.25,
    req: { pop: 520, dev: 3, castle: 2 }, cost: { gold: 700, wood: 400, iron: 100 }, time: 25 },
  { name: 'Major City', icon: '🌆', popCap: 2800, gold: 5.0, mult: 1.40, maxLvl: 4, recruit: 1.5,
    req: { pop: 1250, dev: 5, tech: 'cities', castle: 3 }, cost: { gold: 1800, wood: 900, iron: 300 }, time: 40 },
  { name: 'Capital', icon: '👑', popCap: 5000, gold: 8.0, mult: 1.60, maxLvl: 5, recruit: 2.0,
    req: { pop: 2500, dev: 7, tech: 'architecture', castle: 4, capitalOnly: true }, cost: { gold: 4000, wood: 2000, iron: 800 }, time: 60 },
];

/* Buildings. `per` = output per level. Castle only exists in the capital. */
const BUILDINGS = {
  castle: {
    name: 'Castle', icon: '🏰', capitalOnly: true, maxLevel: 5,
    cost: { gold: 300, wood: 200, iron: 60 }, time: 20,
    desc: 'Heart of the kingdom. Gold, research and strong walls for the capital. Needed to grow the capital.',
    effect: (l) => `+${l * 3} gold, +${l} research, +${l * 50}% capital walls`,
  },
  farm: {
    name: 'Farm', icon: '🌾', cost: { gold: 60, wood: 40 }, time: 6,
    desc: 'Fields and granaries. Produces food for your people and soldiers.',
    effect: (l) => `+${fmt(6 * lvlCurve(l))} food/day (× terrain)`,
  },
  lumber: {
    name: 'Lumber Camp', icon: '🪵', cost: { gold: 50, wood: 20 }, time: 5,
    desc: 'Woodcutters harvest timber for buildings, archers and siege engines.',
    effect: (l) => `+${fmt(4 * lvlCurve(l))} wood/day (× terrain)`,
  },
  mine: {
    name: 'Mine', icon: '⛏️', cost: { gold: 80, wood: 50 }, time: 8,
    desc: 'Digs iron and some gold. Mountains double its output.',
    effect: (l) => `+${fmt(3 * lvlCurve(l))} iron, +${fmt(1.2 * lvlCurve(l))} gold/day (× terrain)`,
  },
  houses: {
    name: 'Houses', icon: '🏠', cost: { gold: 50, wood: 60 }, time: 6,
    desc: 'Homes for your people. Raises the population capacity.',
    effect: (l) => `+${Math.round(150 * lvlCurve(l))} population capacity`,
  },
  market: {
    name: 'Market', icon: '💰', cost: { gold: 100, wood: 60 }, time: 8,
    desc: 'Merchants and stalls bring in gold and make people a little happier.',
    effect: (l) => `+${fmt(4 * lvlCurve(l))} gold/day, +${l * 2} happiness`,
  },
  barracks: {
    name: 'Barracks', icon: '⚔️', cost: { gold: 100, wood: 80, iron: 20 }, time: 10,
    desc: 'Trains soldiers. Higher levels train faster and unlock cavalry (2) and knights (3).',
    effect: (l) => `Training speed ×${(1 + 0.6 * (l - 1)).toFixed(1)}`,
  },
  blacksmith: {
    name: 'Blacksmith', icon: '🔨', cost: { gold: 120, wood: 40, iron: 40 }, time: 10,
    desc: 'Forges better weapons and armour. Your best blacksmith boosts every unit in the kingdom.',
    effect: (l) => `+${l * 4}% attack & defense for all units`,
  },
  academy: {
    name: 'Academy', icon: '📚', cost: { gold: 140, wood: 80 }, time: 10,
    desc: 'Scholars produce research points for new technologies.',
    effect: (l) => `+${fmt(2.5 * lvlCurve(l))} research/day`,
  },
  temple: {
    name: 'Temple', icon: '⛪', cost: { gold: 110, wood: 70 }, time: 8,
    desc: 'Faith and festivals keep the people content.',
    effect: (l) => `+${l * 7} happiness`,
  },
};
const BUILDING_ORDER = ['castle', 'farm', 'lumber', 'mine', 'houses', 'market', 'barracks', 'blacksmith', 'academy', 'temple'];
function lvlCurve(l) { return l <= 0 ? 0 : l * (1 + 0.12 * (l - 1)); }
function buildingCost(id, level) {
  // cost to reach `level`
  return costScale(BUILDINGS[id].cost, Math.pow(1.8, level - 1));
}
function buildingTime(id, level) { return Math.round(BUILDINGS[id].time * (1 + 0.7 * (level - 1))); }

/* Units. time = days per unit at a level-1 barracks. */
const UNITS = {
  infantry: {
    name: 'Infantry', icon: '⚔️', atk: 10, def: 12, hp: 100, speed: 1.0, pop: 1, time: 0.12,
    cost: { gold: 6, iron: 1 }, upkeep: 0.018, food: 0.010, weight: 1.0,
    vs: { cavalry: 1.3, knights: 1.1, siege: 1.5 },
    desc: 'Spearmen and shields. Cheap, sturdy and strong against cavalry.',
  },
  archers: {
    name: 'Archers', icon: '🏹', atk: 13, def: 6, hp: 70, speed: 1.0, pop: 1, time: 0.15,
    cost: { gold: 8, wood: 3 }, upkeep: 0.022, food: 0.010, weight: 0.6, ranged: true,
    vs: { infantry: 1.25, siege: 1.2, knights: 0.7 },
    desc: 'Open every battle with a deadly volley. Strong against infantry, weak in melee.',
  },
  cavalry: {
    name: 'Cavalry', icon: '🐎', atk: 17, def: 9, hp: 130, speed: 1.7, pop: 1, time: 0.3,
    cost: { gold: 18, food: 6, iron: 3 }, upkeep: 0.05, food: 0.020, weight: 0.9,
    vs: { archers: 1.6, siege: 1.8, knights: 0.8 },
    desc: 'Fast riders that charge in the first round. Crush archers and siege engines.',
    req: { barracks: 2 },
  },
  knights: {
    name: 'Knights', icon: '🛡️', atk: 22, def: 22, hp: 200, speed: 1.2, pop: 1, time: 0.45,
    cost: { gold: 35, iron: 10 }, upkeep: 0.09, food: 0.015, weight: 1.0,
    vs: { infantry: 1.3, archers: 1.3, cavalry: 1.2 },
    desc: 'Armoured elite. Expensive, but a knight is worth several soldiers.',
    req: { barracks: 3, blacksmith: 2 },
  },
  siege: {
    name: 'Siege Engines', icon: '⚙️', atk: 8, def: 4, hp: 150, speed: 0.6, pop: 3, time: 1.2,
    cost: { gold: 60, wood: 40, iron: 15 }, upkeep: 0.14, food: 0.030, weight: 0.4,
    vs: {},
    desc: 'Catapults and rams. Weak in the field, but they tear down walls and forts.',
    req: { barracks: 2, tech: 'siege' },
  },
};
const UNIT_ORDER = ['infantry', 'archers', 'cavalry', 'knights', 'siege'];
const unitPower = (u) => (UNITS[u].atk + UNITS[u].def) * UNITS[u].hp / 100;
const emptyUnits = () => ({ infantry: 0, archers: 0, cavalry: 0, knights: 0, siege: 0 });

/* Technology tree: three columns, four tiers each. */
const TECHS = [
  { id: 'weapons', cat: 'military', tier: 1, name: 'Better Weapons', icon: '🗡️', rp: 40, cost: { gold: 120 }, time: 12,
    desc: '+15% attack for all units.' },
  { id: 'armor', cat: 'military', tier: 2, req: 'weapons', name: 'Better Armor', icon: '🛡️', rp: 90, cost: { gold: 250, iron: 60 }, time: 20,
    desc: '+15% defense and +10% health for all units.' },
  { id: 'cavalry', cat: 'military', tier: 3, req: 'armor', name: 'Advanced Cavalry', icon: '🐎', rp: 160, cost: { gold: 450, food: 150 }, time: 28,
    desc: 'Cavalry and knights +25% attack. All armies move 10% faster.' },
  { id: 'siege', cat: 'military', tier: 4, req: 'cavalry', name: 'Siege Engineering', icon: '⚙️', rp: 250, cost: { gold: 650, wood: 250, iron: 120 }, time: 36,
    desc: 'Unlocks Siege Engines (Barracks 2). Siege damage against walls +50%.' },

  { id: 'farming', cat: 'economy', tier: 1, name: 'Better Farming', icon: '🌾', rp: 40, cost: { gold: 100, wood: 50 }, time: 12,
    desc: '+30% food production.' },
  { id: 'mining', cat: 'economy', tier: 2, req: 'farming', name: 'Mining', icon: '⛏️', rp: 90, cost: { gold: 220, wood: 120 }, time: 20,
    desc: '+30% iron production and +30% gold from mines.' },
  { id: 'trade', cat: 'economy', tier: 3, req: 'mining', name: 'Trade', icon: '⚖️', rp: 160, cost: { gold: 400 }, time: 28,
    desc: 'Markets +30% gold. Trade agreements earn 50% more.' },
  { id: 'taxation', cat: 'economy', tier: 4, req: 'trade', name: 'Taxation', icon: '🪙', rp: 250, cost: { gold: 600 }, time: 36,
    desc: '+25% tax income. High taxes cause less unhappiness.' },

  { id: 'cities', cat: 'kingdom', tier: 1, name: 'Bigger Cities', icon: '🏙️', rp: 40, cost: { gold: 120, wood: 80 }, time: 12,
    desc: '+25% population capacity. Settlements can grow into Major Cities.' },
  { id: 'roads', cat: 'kingdom', tier: 2, req: 'cities', name: 'Better Roads', icon: '🛣️', rp: 90, cost: { gold: 250, wood: 200 }, time: 20,
    desc: 'Armies move 25% faster. Distance from the capital hurts output half as much.' },
  { id: 'administration', cat: 'kingdom', tier: 3, req: 'roads', name: 'Administration', icon: '📜', rp: 160, cost: { gold: 450 }, time: 28,
    desc: '+10% income, +1 army slot, conquered lands calm down twice as fast.' },
  { id: 'architecture', cat: 'kingdom', tier: 4, req: 'administration', name: 'Advanced Architecture', icon: '🏛️', rp: 250, cost: { gold: 700, wood: 400, iron: 150 }, time: 36,
    desc: 'Buildings cost 20% less, forts can reach level 6 and your capital can grow into a true Capital.' },
];
const TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t]));
const TECH_CATS = [
  { id: 'military', name: 'Military', icon: '⚔️' },
  { id: 'economy', name: 'Economy', icon: '💰' },
  { id: 'kingdom', name: 'Kingdom', icon: '🏰' },
];

/* AI kingdoms. personality: aggression, expansion, diplomacy (0..1) */
const KINGDOM_DEFS = [
  { name: 'Aurelia', color: '#e3b341', capital: 'Aurum', ruler: 'Queen Seraphine', title: 'Queen',
    p: { aggression: 0.35, expansion: 0.6, diplomacy: 0.75 }, mil: [3, 5, 5, 3] },
  { name: 'Nordhelm', color: '#4a8fdc', capital: 'Helmgard', ruler: 'Jarl Ragnar', title: 'Jarl',
    p: { aggression: 0.8, expansion: 0.7, diplomacy: 0.35 }, mil: [6, 3, 2, 5] },
  { name: 'Valoria', color: '#a55ee6', capital: 'Valcrest', ruler: 'King Aldemar', title: 'King',
    p: { aggression: 0.5, expansion: 0.65, diplomacy: 0.55 }, mil: [4, 4, 4, 4] },
  { name: 'Drakmor', color: '#d64545', capital: 'Drakhold', ruler: 'Warlord Vexar', title: 'Warlord',
    p: { aggression: 0.95, expansion: 0.8, diplomacy: 0.15 }, mil: [7, 2, 1, 5] },
  { name: 'Eldoria', color: '#3fae6a', capital: 'Eldwood', ruler: 'High Elder Lysandra', title: 'High Elder',
    p: { aggression: 0.25, expansion: 0.5, diplomacy: 0.9 }, mil: [2, 5, 6, 3] },
  { name: 'Westreach', color: '#e8833a', capital: 'Westhaven', ruler: 'Duke Harlan', title: 'Duke',
    p: { aggression: 0.6, expansion: 0.75, diplomacy: 0.5 }, mil: [4, 5, 3, 4] },
];
const PLAYER_COLORS = ['#26c6d0', '#ede6d6', '#ec5fa3', '#6d7cff', '#9be15d'];
const NEUTRAL_COLOR = '#8f8778';

const DIFFICULTY = {
  easy: { name: 'Easy', aiIncome: 0.8, grace: 260, aiAggro: 0.75, playerBonus: 1.15 },
  normal: { name: 'Normal', aiIncome: 1.0, grace: 160, aiAggro: 1.0, playerBonus: 1.0 },
  hard: { name: 'Hard', aiIncome: 1.3, grace: 80, aiAggro: 1.2, playerBonus: 1.0 },
};

/* Ruler */
const RULER_STATS = [
  { id: 'mil', name: 'Military', icon: '⚔️', desc: '+3% attack for all units per point.' },
  { id: 'eco', name: 'Economy', icon: '💰', desc: '+3% production of every resource per point.' },
  { id: 'dip', name: 'Diplomacy', icon: '🤝', desc: 'Other kingdoms accept your proposals more easily and like your gifts more.' },
  { id: 'lead', name: 'Leadership', icon: '👑', desc: '+2% defense and +3% training speed per point. Every 2 points = +1 army slot.' },
];
function rulerXpFor(level) { return Math.round(100 * Math.pow(level, 1.35)); }

/* Generals */
const GENERAL_TRAITS = {
  tactician: { name: 'Tactician', icon: '🎯', desc: '+12% attack.' },
  ironwall: { name: 'Iron Wall', icon: '🧱', desc: '+15% defense.' },
  horselord: { name: 'Horse Lord', icon: '🐎', desc: 'Cavalry and knights +25% attack.' },
  siegebreaker: { name: 'Siegebreaker', icon: '💥', desc: 'Siege engines are 60% more effective against walls.' },
  swift: { name: 'Swift', icon: '💨', desc: 'The army marches 20% faster.' },
  inspiring: { name: 'Inspiring', icon: '🔥', desc: '+5% attack and troops hold their nerve much longer.' },
};
const GENERAL_FIRST = ['Aldric', 'Bran', 'Cedric', 'Dorian', 'Edric', 'Gareth', 'Hector', 'Ivo', 'Jorah', 'Kael', 'Leofric',
  'Magnus', 'Osric', 'Roland', 'Sigurd', 'Tristan', 'Ulric', 'Wystan', 'Brienne', 'Elsbeth', 'Isolde', 'Maren', 'Rowena', 'Sabine', 'Ysolde'];
const GENERAL_LAST = ['the Bold', 'Ironhand', 'Stormborn', 'of the Vale', 'Blackwood', 'the Wise', 'Swiftblade', 'Redmane',
  'Ashford', 'the Just', 'Grimwald', 'Oakheart', 'Silverspear', 'the Unbroken', 'Thornfield'];

/* Territory name parts */
const NAME_PARTS = {
  pre: ['Ash', 'Black', 'Stone', 'Raven', 'Oak', 'Wolf', 'Iron', 'Silver', 'Gold', 'Storm', 'Red', 'Green', 'Elder', 'High',
    'Mist', 'Thorn', 'Bright', 'Deep', 'Wind', 'Moon', 'Star', 'Hawk', 'Bear', 'Stag', 'Fair', 'Grey', 'Kings', 'Queens',
    'Rose', 'Amber', 'Dragon', 'Lion', 'Eagle', 'Cold', 'Long', 'West', 'East', 'North', 'South', 'Old', 'White', 'Copper',
    'Oaken', 'Crow', 'Falcon', 'Willow', 'Briar', 'Ember', 'Glen', 'Heron'],
  suf: ['ford', 'vale', 'moor', 'wick', 'haven', 'field', 'wood', 'hold', 'gate', 'crest', 'mere', 'fell', 'reach', 'stead',
    'burg', 'march', 'watch', 'shire', 'dale', 'brook', 'cliff', 'hollow', 'ridge', 'mouth', 'port', 'bury', 'ton', 'ham', 'keep', 'fall'],
  forest: ['wood', 'grove', 'glade', 'weald', 'shaw'],
  mountains: ['peak', 'crag', 'spire', 'horn', 'pass', 'tor'],
  desert: ['sand', 'well', 'spring', 'mesa', 'dune'],
  snow: ['gard', 'heim', 'fell', 'watch', 'hold'],
  island: ['isle', 'holm', 'cay', 'reef'],
  snowPre: ['Frost', 'Ice', 'Winter', 'Snow', 'Rime', 'White', 'Cold', 'Frozen'],
  desertPre: ['Sun', 'Sand', 'Dune', 'Scorch', 'Amber', 'Dust', 'Mirage', 'Bronze'],
};

/* Missions / objectives */
const MISSIONS = [
  { id: 'farm', name: 'First Steps', icon: '🌾', desc: 'Build your first Farm.',
    goal: (P) => [P.territories.some((t) => t.b.farm > 0) ? 1 : 0, 1], reward: { gold: 120, wood: 60 }, xp: 25 },
  { id: 'mine', name: 'Iron Age', icon: '⛏️', desc: 'Build a Mine to dig up iron.',
    goal: (P) => [P.territories.some((t) => t.b.mine > 0) ? 1 : 0, 1], reward: { gold: 100, food: 80 }, xp: 25 },
  { id: 'recruit', name: 'Call to Arms', icon: '🪖', desc: 'Train 50 soldiers.',
    goal: (P) => [P.k.trained, 50], reward: { food: 120, iron: 50 }, xp: 30 },
  { id: 'conquer1', name: 'First Conquest', icon: '🚩', desc: 'Capture your first territory.',
    goal: (P) => [P.k.captured, 1], reward: { gold: 250, iron: 80 }, xp: 50 },
  { id: 'explore', name: 'Explorer', icon: '🧭', desc: 'Explore 25 territories.',
    goal: (P) => [P.explored, 25], reward: { gold: 150 }, xp: 30 },
  { id: 'pop500', name: 'Growing Kingdom', icon: '👥', desc: 'Reach 500 population.',
    goal: (P) => [Math.floor(P.pop), 500], reward: { gold: 200, food: 100 }, xp: 40 },
  { id: 'tech1', name: 'Age of Learning', icon: '🔬', desc: 'Research your first technology.',
    goal: (P) => [Object.keys(P.k.techs).length, 1], reward: { gold: 150, rp: 20 }, xp: 30 },
  { id: 'town', name: 'Town Charter', icon: '🏘️', desc: 'Grow a village into a Town.',
    goal: (P) => [P.territories.some((t) => t.tier >= 1 && t.id !== P.k.capital) ? 1 : 0, 1], reward: { gold: 250, wood: 120 }, xp: 40 },
  { id: 'trade', name: 'Merchant Prince', icon: '⚖️', desc: 'Sign a trade agreement with another kingdom.',
    goal: (P) => [P.trades, 1], reward: { gold: 250 }, xp: 40 },
  { id: 'terr5', name: 'Rising Power', icon: '🗺️', desc: 'Control 5 territories.',
    goal: (P) => [P.territories.length, 5], reward: { gold: 350, iron: 120 }, xp: 60 },
  { id: 'army500', name: 'Military Power', icon: '⚔️', desc: 'Train 500 soldiers.',
    goal: (P) => [P.k.trained, 500], reward: { gold: 500, iron: 200 }, xp: 80 },
  { id: 'battles', name: 'Battle Hardened', icon: '🏆', desc: 'Win 10 battles.',
    goal: (P) => [P.k.battlesWon, 10], reward: { gold: 400, food: 200 }, xp: 60 },
  { id: 'city', name: 'Great City', icon: '🏙️', desc: 'Grow any settlement into a City.',
    goal: (P) => [P.territories.some((t) => t.tier >= 2) ? 1 : 0, 1], reward: { gold: 600, wood: 300 }, xp: 80 },
  { id: 'terr10', name: 'Regional Power', icon: '🏳️', desc: 'Control 10 territories.',
    goal: (P) => [P.territories.length, 10], reward: { gold: 800, iron: 250 }, xp: 100 },
  { id: 'alliance', name: 'Brothers in Arms', icon: '🤝', desc: 'Form an alliance.',
    goal: (P) => [P.alliances, 1], reward: { gold: 500 }, xp: 80 },
  { id: 'pop3000', name: 'Thriving Realm', icon: '🌆', desc: 'Reach 3,000 population.',
    goal: (P) => [Math.floor(P.pop), 3000], reward: { gold: 900, food: 400 }, xp: 100 },
  { id: 'capital', name: 'Kingslayer', icon: '👑', desc: "Capture another kingdom's capital.",
    goal: (P) => [P.k.capitalsTaken, 1], reward: { gold: 1200, iron: 300 }, xp: 150 },
  { id: 'techs6', name: 'Enlightenment', icon: '📚', desc: 'Research 6 technologies.',
    goal: (P) => [Object.keys(P.k.techs).length, 6], reward: { gold: 800, rp: 100 }, xp: 120 },
  { id: 'terr25', name: 'Empire', icon: '🏰', desc: 'Control 25 territories.',
    goal: (P) => [P.territories.length, 25], reward: { gold: 2500, iron: 600, wood: 600 }, xp: 250 },
  { id: 'eliminate', name: 'Fall of a Kingdom', icon: '💀', desc: 'Destroy a rival kingdom completely.',
    goal: (P) => [P.k.kingdomsDestroyed, 1], reward: { gold: 2000 }, xp: 200 },
  { id: 'strongest', name: 'World Power', icon: '🌍', desc: 'Become the strongest kingdom in the world (highest power score) while ruling at least 20 territories.',
    goal: (P) => [P.rank === 1 && P.territories.length >= 20 ? 1 : 0, 1], reward: { gold: 3000, iron: 800 }, xp: 300 },
  { id: 'emperor', name: 'Emperor of the World', icon: '🌟', desc: 'Control 60% of all territories.',
    goal: (P) => [P.territories.length, P.victoryTarget], reward: { gold: 10000 }, xp: 500 },
];

const TAX_LEVELS = [
  { name: 'Low', icon: '🙂', gold: 0.6, happy: 12 },
  { name: 'Normal', icon: '😐', gold: 1.0, happy: 0 },
  { name: 'High', icon: '😠', gold: 1.5, happy: -15 },
];

/* Territory project costs */
function developCost(dev) { return { gold: Math.round(90 * Math.pow(1.42, dev)), wood: Math.round(50 * Math.pow(1.38, dev)) }; }
function developTime(dev) { return 6 + dev * 3; }
function fortifyCost(f) { return { gold: Math.round(120 * Math.pow(1.6, f)), wood: Math.round(80 * Math.pow(1.5, f)), iron: Math.round(30 * Math.pow(1.6, f)) }; }
function fortifyTime(f) { return 8 + f * 4; }
const SCOUT_COST = { gold: 25 };
const GENERAL_COST = 150;
const GIFT_AMOUNT = 150;
