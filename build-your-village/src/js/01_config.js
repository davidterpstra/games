/* =====================================================================
   CONFIG  (≈ ReplicatedStorage/Modules: ItemConfig, BuildingConfig,
   NPCConfig, QuestConfig, VillageConfig)
   Pure data. Shared by the "server" services and the client.
   ===================================================================== */

/* ---------------- ItemConfig ---------------- */
const ITEMS = {
  coins: { name: 'Coins', icon: '🪙', color: '#f2b33d' },
  wood: { name: 'Wood', icon: '🪵', sell: 1, buy: 4, color: '#a0673a', level: 1 },
  stone: { name: 'Stone', icon: '🪨', sell: 1, buy: 5, color: '#9a9a94', level: 1 },
  wheat: { name: 'Wheat', icon: '🌾', sell: 2, buy: 6, color: '#e2c35a', level: 1 },
  food: { name: 'Food', icon: '🍞', sell: 3, buy: 8, color: '#d8914a', level: 1 },
  iron: { name: 'Iron', icon: '🔩', sell: 6, buy: 18, color: '#8a95a5', level: 5 },
  gold: { name: 'Gold', icon: '🏅', sell: 30, buy: 85, color: '#e8c14a', level: 9 },
  tools: { name: 'Tools', icon: '🛠️', sell: 18, buy: 50, color: '#6d7c8c', level: 8 },
  planks: { name: 'Planks', icon: '🪚', sell: 9, buy: 26, color: '#c99a5b', level: 12 },
};
const RES_KEYS = ['wood', 'stone', 'wheat', 'food', 'iron', 'gold', 'tools', 'planks'];
const BASE_CAP = 250;

/* ---------------- VillageConfig: world layout & areas ---------------- */
const WORLD = { HALF: 240, PLAY: 199, CELL: 80, WATER: 0, GRID: 2.5 };

// Areas are built from 80x80 cells; cell index i spans [i*80-40, i*80+40]
const AREAS = [
  { id: 'start', idx: 0, name: 'Willow Glade', cells: [[0, 0]], level: 1, cost: {}, desc: 'Your first patch of land. Cozy, flat and full of promise.', col: '#86b84a' },
  { id: 'forest', idx: 1, name: 'Whispering Forest', cells: [[0, -1]], level: 2, cost: { coins: 200, stone: 25 }, desc: 'Dense oaks and birches, berry bushes and a quiet pond.', col: '#4f7d34' },
  { id: 'river', idx: 2, name: 'River Bend', cells: [[1, 0], [1, -1]], level: 3, cost: { coins: 400, wood: 80 }, desc: 'A lazy river with fish, wooden bridges and fertile banks.', col: '#4aa3c7' },
  { id: 'farmland', idx: 3, name: 'Sunny Fields', cells: [[0, 1], [-1, 1]], level: 5, cost: { coins: 700, wood: 120, stone: 60 }, desc: 'Flat patchwork fields. Perfect for farms and wild wheat.', col: '#d9b84f' },
  { id: 'hills', idx: 4, name: 'Stone Hills', cells: [[-1, -1], [-2, -1]], level: 5, cost: { coins: 800, wood: 150 }, desc: 'A terraced quarry and an iron cave hidden in the rocks.', col: '#9a9a94' },
  { id: 'meadow', idx: 5, name: 'Flower Meadow', cells: [[-1, 0], [-2, 0]], level: 7, cost: { coins: 1200, stone: 150 }, desc: 'Rolling meadows full of flowers, a small lake and standing stones.', col: '#c4d86a' },
  { id: 'lake', idx: 6, name: 'Mirror Lake', cells: [[1, 1], [1, 2]], level: 9, cost: { coins: 1800, wood: 200, stone: 200 }, desc: 'A great calm lake. Fishermen love it.', col: '#3f8fb8' },
  { id: 'deepwoods', idx: 7, name: 'Deep Woods', cells: [[0, -2], [1, -2]], level: 12, cost: { coins: 3000, stone: 300, food: 100 }, desc: 'Ancient pines and the oldest tree in the land.', col: '#2f5d36' },
  { id: 'peaks', idx: 8, name: 'Crystal Peaks', cells: [[-2, -2], [-1, -2]], level: 14, cost: { coins: 4500, wood: 400, food: 200 }, desc: 'Snowy peaks and a glittering crystal cave with gold.', col: '#b9c7d6' },
  { id: 'harbor', idx: 9, name: 'Harbor Coast', cells: [[2, -1], [2, 0], [2, 1]], level: 16, cost: { coins: 6500, wood: 600, stone: 400, iron: 60 }, desc: 'Sandy beaches and the open sea. Trade with the world.', col: '#e8d9a0' },
  { id: 'southhills', idx: 10, name: 'Old Hills', cells: [[-2, 1], [-2, 2], [-1, 2], [0, 2]], level: 19, cost: { coins: 9000, stone: 800, iron: 120, gold: 10 }, desc: 'Wide green hills around the ruins of an old kingdom.', col: '#9ab85a' },
  { id: 'sea', idx: 11, name: 'Open Sea', cells: [[2, -2], [2, 2]], level: 999, cost: {}, desc: '', col: '#2f7fb0', hidden: true },
];
const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
// 5x5 cell -> area index lookup
const CELL_AREA = (() => {
  const g = new Array(25).fill(11);
  for (const a of AREAS) for (const [cx, cz] of a.cells) g[(cz + 2) * 5 + (cx + 2)] = a.idx;
  return g;
})();
function cellOf(v) { return clamp(Math.floor((v + 40) / 80), -2, 2); }
function areaIdxAt(x, z) { return CELL_AREA[(cellOf(z) + 2) * 5 + (cellOf(x) + 2)]; }

/* ---------------- Levels ---------------- */
const LEVEL_TITLES = [[30, 'Grand City'], [20, 'City'], [10, 'Town'], [5, 'Village'], [1, 'Small Village']];
function levelTitle(l) { for (const [lv, t] of LEVEL_TITLES) if (l >= lv) return t; return 'Small Village'; }
function xpToNext(l) { return Math.round(50 * Math.pow(l, 1.4) + 30); }
const MAX_LEVEL = 40;

/* ---------------- BuildingConfig ----------------
   cat: housing | production | shops | services | decor | roads
   size: footprint in world units [w, d] before rotation
   house: resident capacity, quality: housing happiness
   jobs: { prof, n } workers; produce/consume per worker per work tick (5s)
   happy: contributions to village happiness factors
   needs: 'water' (near water) | 'coast' (front edge over sea) | 'rocky' (hills/peaks) */
const BUILDINGS = {
  home: { name: 'Your Home', cat: 'housing', level: 1, cost: {}, size: [7, 7], hidden: true, unique: true, desc: 'Your cozy home. Sleep here to skip the night.', happy: { decor: 1 } },
  small_house: { name: 'Small House', cat: 'housing', level: 1, cost: { wood: 50, stone: 20, coins: 100 }, size: [6, 6], house: 2, quality: 1, desc: 'A snug home for 2 residents.' },
  woodcutter: { name: "Woodcutter's Hut", cat: 'production', level: 1, cost: { wood: 40, stone: 10, coins: 60 }, size: [7, 7], jobs: { prof: 'woodcutter', n: 1 }, work: 'outside', produce: { wood: 2 }, desc: 'A woodcutter chops logs for the village.' },
  storage_shed: { name: 'Storage Shed', cat: 'production', level: 1, cost: { wood: 60, stone: 30, coins: 80 }, size: [6, 5], storage: 150, desc: '+150 storage for every resource.' },
  dirt_road: { name: 'Dirt Road', cat: 'roads', level: 1, cost: { wood: 1, coins: 3 }, size: [4, 4], road: true, desc: 'Villagers walk faster on roads. Drag to paint.' },
  flower_bed: { name: 'Flower Bed', cat: 'decor', level: 1, cost: { wood: 5, coins: 15 }, size: [2, 2], happy: { decor: 1 }, desc: 'Colorful flowers. +Decoration.' },
  well: { name: 'Well', cat: 'services', level: 2, cost: { wood: 20, stone: 40, coins: 60 }, size: [3, 3], happy: { service: 4 }, desc: 'Fresh water. +Happiness and helps against fires.' },
  lantern: { name: 'Lantern', cat: 'decor', level: 2, cost: { wood: 4, stone: 4, coins: 20 }, size: [1, 1], happy: { safety: 1, decor: 0.3 }, desc: 'Lights up the night. +Safety.' },
  bench: { name: 'Bench', cat: 'decor', level: 3, cost: { wood: 10, coins: 25 }, size: [2, 1], happy: { decor: 1 }, desc: 'A place to rest. Villagers sit here in the evening.' },
  planted_tree: { name: 'Planted Tree', cat: 'decor', level: 4, cost: { wood: 5, coins: 10 }, size: [2, 2], happy: { decor: 0.6 }, desc: 'A young decorative tree.' },
  stonecutter: { name: "Stonemason's Yard", cat: 'production', level: 4, cost: { wood: 60, stone: 20, coins: 150 }, size: [8, 7], jobs: { prof: 'miner', n: 1 }, work: 'outside', produce: { stone: 2 }, desc: 'A miner cuts stone blocks.' },
  cottage: { name: 'Cottage', cat: 'housing', level: 5, cost: { wood: 100, stone: 60, coins: 250 }, size: [7, 7], house: 4, quality: 2, desc: 'A timber-framed home for 4 residents.' },
  farm: { name: 'Farm', cat: 'production', level: 5, cost: { wood: 80, stone: 40, coins: 150 }, size: [12, 10], jobs: { prof: 'farmer', n: 2 }, work: 'outside', produce: { wheat: 2 }, desc: 'Two farmers grow wheat.' },
  general_store: { name: 'General Store', cat: 'shops', level: 5, cost: { wood: 120, stone: 80, coins: 300 }, size: [8, 7], jobs: { prof: 'merchant', n: 1 }, work: 'counter', shop: 'general', happy: { shops: 3 }, desc: 'Buy and sell basics at better prices. Villagers shop here.' },
  stone_road: { name: 'Stone Road', cat: 'roads', level: 5, cost: { stone: 3, coins: 6 }, size: [4, 4], road: true, happy: { decor: 0.1 }, desc: 'A sturdy cobbled road. +Decoration.' },
  bakery: { name: 'Bakery', cat: 'shops', level: 6, cost: { wood: 100, stone: 80, wheat: 20, coins: 350 }, size: [7, 7], jobs: { prof: 'baker', n: 1 }, work: 'inside', consume: { wheat: 2 }, produce: { food: 4 }, shop: 'bakery', happy: { shops: 3, food: 2 }, desc: 'Turns wheat into bread. Villagers buy lunch here.' },
  market_stall: { name: 'Market Stall', cat: 'shops', level: 6, cost: { wood: 60, stone: 20, coins: 120 }, size: [4, 4], jobs: { prof: 'merchant', n: 1 }, work: 'counter', shop: 'stall', happy: { shops: 2, decor: 1 }, desc: 'A lively stall. Sells food and wheat at good prices.' },
  mine: { name: 'Mine', cat: 'production', level: 7, cost: { wood: 120, stone: 60, coins: 400 }, size: [8, 8], jobs: { prof: 'miner', n: 2 }, work: 'inside', produce: { stone: 1, iron: 0.6 }, needs: 'rocky', desc: 'Miners dig stone and iron. Must be built in the Stone Hills or Crystal Peaks.' },
  fisher_hut: { name: "Fisher's Hut", cat: 'production', level: 7, cost: { wood: 70, stone: 20, coins: 180 }, size: [6, 6], jobs: { prof: 'fisher', n: 1 }, work: 'outside', produce: { food: 2 }, needs: 'water', desc: 'A fisher catches food. Must be near water.' },
  blacksmith: { name: 'Blacksmith', cat: 'shops', level: 8, cost: { wood: 150, stone: 200, iron: 100, coins: 500 }, size: [8, 7], jobs: { prof: 'blacksmith', n: 1 }, work: 'outside', consume: { iron: 2 }, produce: { tools: 1 }, shop: 'blacksmith', happy: { shops: 2, safety: 1 }, desc: 'Forges tools from iron. Upgrade your own tools here.' },
  windmill: { name: 'Windmill', cat: 'production', level: 9, cost: { wood: 120, stone: 80, coins: 400 }, size: [6, 6], farmBoost: 0.25, happy: { decor: 2 }, desc: 'All farms produce +25% wheat.' },
  town_hall: { name: 'Town Hall', cat: 'services', level: 10, cost: { wood: 400, stone: 400, iron: 50, coins: 1500 }, size: [12, 10], unique: true, taxBoost: 0.25, happy: { service: 6 }, desc: 'The heart of a town. +25% taxes and unlocks town buildings.' },
  manor: { name: 'Manor', cat: 'housing', level: 10, cost: { wood: 250, stone: 200, iron: 20, coins: 800 }, size: [10, 9], house: 6, quality: 4, desc: 'A large home for 6 residents.' },
  inn: { name: 'Inn', cat: 'services', level: 11, cost: { wood: 200, stone: 150, coins: 600 }, size: [10, 8], jobs: { prof: 'merchant', n: 1 }, work: 'inside', produce: { coins: 6 }, needs2: 'town_hall', happy: { ent: 3 }, desc: 'Travelers pay to stay. Earns coins.' },
  tavern: { name: 'Tavern', cat: 'services', level: 12, cost: { wood: 180, stone: 120, food: 40, coins: 700 }, size: [9, 8], jobs: { prof: 'merchant', n: 1 }, work: 'inside', consume: { food: 1 }, produce: { coins: 5 }, needs2: 'town_hall', happy: { ent: 6 }, desc: 'Music, stew and laughter. Big +Entertainment.' },
  stable: { name: 'Stable', cat: 'services', level: 13, cost: { wood: 220, stone: 80, wheat: 60, coins: 650 }, size: [10, 7], jobs: { prof: 'farmer', n: 1 }, work: 'outside', speedBoost: 0.2, happy: { ent: 2 }, desc: 'Horses! You run 20% faster.' },
  chapel: { name: 'Chapel', cat: 'services', level: 14, cost: { wood: 150, stone: 350, gold: 10, coins: 1200 }, size: [8, 12], needs2: 'town_hall', happy: { service: 8 }, desc: 'A peaceful chapel with a bell tower. Big +Happiness.' },
  marketplace: { name: 'Marketplace', cat: 'shops', level: 15, cost: { wood: 250, stone: 250, gold: 5, coins: 1500 }, size: [12, 12], unique: true, jobs: { prof: 'merchant', n: 3 }, work: 'counter', produce: { coins: 3 }, shop: 'market', needs2: 'town_hall', happy: { shops: 5, decor: 2 }, desc: 'Great prices for everything, including gold.' },
  fountain: { name: 'Fountain', cat: 'decor', level: 15, cost: { wood: 20, stone: 120, coins: 500 }, size: [5, 5], happy: { decor: 4 }, desc: 'A splashing fountain. Villagers gather here.' },
  large_farm: { name: 'Large Farm', cat: 'production', level: 16, cost: { wood: 200, stone: 120, iron: 20, coins: 900 }, size: [16, 12], jobs: { prof: 'farmer', n: 4 }, work: 'outside', produce: { wheat: 3 }, desc: 'A big barn with wide fields. 4 farmers.' },
  warehouse: { name: 'Warehouse', cat: 'production', level: 17, cost: { wood: 250, stone: 250, iron: 40, coins: 1000 }, size: [12, 9], storage: 600, desc: '+600 storage for every resource.' },
  townhouse: { name: 'Townhouse', cat: 'housing', level: 20, cost: { wood: 200, stone: 250, planks: 40, coins: 1400 }, size: [7, 8], house: 8, quality: 4, desc: 'A tall city home for 8 residents.' },
  town_square: { name: 'Town Square', cat: 'services', level: 20, cost: { wood: 100, stone: 500, gold: 20, coins: 2500 }, size: [16, 16], unique: true, happy: { decor: 6, ent: 6 }, desc: 'A grand paved square. The social heart of your city.' },
  workshop: { name: 'Workshop', cat: 'production', level: 21, cost: { wood: 300, stone: 200, iron: 60, coins: 2000 }, size: [10, 8], jobs: { prof: 'builder', n: 2 }, work: 'outside', consume: { wood: 3, iron: 1 }, produce: { planks: 2 }, desc: 'Builders turn wood and iron into planks.' },
  guard_tower: { name: 'Guard Tower', cat: 'services', level: 22, cost: { wood: 150, stone: 300, iron: 50, coins: 1500 }, size: [5, 5], jobs: { prof: 'guard', n: 2 }, work: 'outside', happy: { safety: 6 }, desc: 'Guards protect the village from wolves.' },
  library: { name: 'Library', cat: 'services', level: 23, cost: { wood: 300, stone: 300, planks: 40, gold: 10, coins: 2500 }, size: [10, 9], xpBoost: 0.1, happy: { service: 6 }, desc: '+10% XP from everything.' },
  harbor: { name: 'Harbor', cat: 'shops', level: 24, cost: { wood: 400, stone: 300, planks: 80, iron: 60, coins: 4000 }, size: [14, 12], unique: true, jobs: { prof: 'fisher', n: 3 }, work: 'outside', produce: { food: 3, coins: 4 }, shop: 'harbor', needs: 'coast', happy: { shops: 4 }, desc: 'Ships bring trade. Sells gold, buys planks and tools. Must touch the sea.' },
  large_market: { name: 'Grand Market', cat: 'shops', level: 25, cost: { wood: 400, stone: 400, planks: 60, gold: 30, coins: 5000 }, size: [16, 12], unique: true, jobs: { prof: 'merchant', n: 4 }, work: 'counter', produce: { coins: 4 }, shop: 'grand', happy: { shops: 8, decor: 2 }, desc: 'The finest market in the land. The best prices.' },
  statue: { name: 'Statue', cat: 'decor', level: 26, cost: { stone: 600, gold: 20, coins: 2500 }, size: [4, 4], happy: { decor: 8 }, desc: 'A statue of the founder. That is you!' },
  clock_tower: { name: 'Clock Tower', cat: 'services', level: 27, cost: { wood: 300, stone: 600, planks: 100, gold: 40, coins: 7000 }, size: [6, 6], unique: true, happy: { service: 6, decor: 6 }, desc: 'A landmark visible from afar.' },
  lighthouse: { name: 'Lighthouse', cat: 'services', level: 28, cost: { wood: 200, stone: 500, planks: 60, coins: 5000 }, size: [5, 5], unique: true, needs: 'water', happy: { safety: 4, decor: 4 }, desc: 'Guides ships home. Must be near water.' },
  palace: { name: 'Grand Hall', cat: 'services', level: 30, cost: { wood: 1000, stone: 1500, planks: 300, gold: 150, coins: 20000 }, size: [20, 16], unique: true, taxBoost: 0.5, happy: { service: 15, decor: 10 }, desc: 'The crown of your Grand City. +50% taxes.' },
};
for (const [id, b] of Object.entries(BUILDINGS)) b.id = id;
const BUILD_CATS = [
  { id: 'housing', name: 'Houses', icon: '🏠' },
  { id: 'production', name: 'Production', icon: '🪓' },
  { id: 'shops', name: 'Shops', icon: '🛒' },
  { id: 'services', name: 'Services', icon: '🏛️' },
  { id: 'decor', name: 'Decor', icon: '🌷' },
  { id: 'roads', name: 'Roads', icon: '🧱' },
];
const HOUSE_TYPES = Object.values(BUILDINGS).filter((b) => b.house).map((b) => b.id);
const isCountedBuilding = (type) => type !== 'home' && !BUILDINGS[type].road;

/* ---------------- NPCConfig ---------------- */
const PROFS = {
  villager: { name: 'Villager', icon: '🧑', shirt: 0x8f9d6a, hat: 0 },
  woodcutter: { name: 'Woodcutter', icon: '🪓', shirt: 0xa8432f, hat: 0 },
  farmer: { name: 'Farmer', icon: '🌾', shirt: 0x5b8fb9, hat: 1, hatCol: 0xe2c35a },
  miner: { name: 'Miner', icon: '⛏️', shirt: 0x6b6258, hat: 3, hatCol: 0xd9a82b },
  baker: { name: 'Baker', icon: '🥖', shirt: 0xf1ebe0, hat: 2, hatCol: 0xffffff },
  blacksmith: { name: 'Blacksmith', icon: '⚒️', shirt: 0x4a4038, hat: 0 },
  merchant: { name: 'Merchant', icon: '💰', shirt: 0x7b4f9e, hat: 4, hatCol: 0x8c2f39 },
  builder: { name: 'Builder', icon: '🔨', shirt: 0xd98a2b, hat: 3, hatCol: 0xf0c419 },
  fisher: { name: 'Fisher', icon: '🎣', shirt: 0x2f7f8a, hat: 5, hatCol: 0x5c7a5a },
  guard: { name: 'Guard', icon: '🛡️', shirt: 0x3b5f9e, hat: 3, hatCol: 0xa9b0b8 },
};
const FIRST_NAMES = ['Mila', 'Bram', 'Noor', 'Finn', 'Lotte', 'Sem', 'Tess', 'Jip', 'Lieke', 'Daan', 'Evi', 'Hugo', 'Fleur', 'Ruben', 'Isa', 'Tijn', 'Sanne', 'Milan', 'Roos', 'Luuk', 'Anna', 'Oscar', 'Elin', 'Pim', 'Vera', 'Otis', 'Juno', 'Wes', 'Nora', 'Kai', 'Ivy', 'Mats', 'Zoë', 'Levi', 'Maud', 'Thijs', 'Ada', 'Joep', 'Fenna', 'Stijn', 'Rosa', 'Gijs', 'Lina', 'Bo', 'Nina', 'Olaf', 'Tara', 'Koen', 'Ella', 'Rik', 'Iris', 'Siem', 'Hanna', 'Jens', 'Yara', 'Floris', 'Merel', 'Timo', 'Suus', 'Aron', 'Liv', 'Casper', 'Pien', 'Teun'];
const LAST_NAMES = ['Oakley', 'Millbrook', 'Stone', 'Fernhill', 'Brookside', 'Ashford', 'Honeydew', 'Thistle', 'Meadows', 'Willow', 'Hearth', 'Bramble', 'Clover', 'Riverstone', 'Pebble', 'Larkspur', 'Birch', 'Copperpot', 'Wheaton', 'Foxglove'];
const SKIN_TONES = [0xf1c9a5, 0xe0ac86, 0xc68a63, 0x9c6844, 0x7a4e32];
const HAIR_COLORS = [0x3b2a1e, 0x6b4428, 0xb88a4a, 0xe0c27a, 0x2b2b2b, 0xa0522d, 0xd9d4cc];
const PANTS_COLORS = [0x4a5a6e, 0x5c4a3a, 0x3f4a3a, 0x6b5a48, 0x2f3b52];

/* ---------------- Cosmetics & tools ---------------- */
const COSMETICS = {
  hat_none: { name: 'No Hat', slot: 'hat', hat: 0, col: 0xffffff },
  hat_straw: { name: 'Straw Hat', slot: 'hat', hat: 1, col: 0xe2c35a },
  hat_beret: { name: 'Beret', slot: 'hat', hat: 4, col: 0xc0392b },
  hat_bucket: { name: 'Bucket Hat', slot: 'hat', hat: 5, col: 0x4f7d5a },
  hat_top: { name: 'Top Hat', slot: 'hat', hat: 9, col: 0x2b2b33 },
  hat_flower: { name: 'Flower Crown', slot: 'hat', hat: 8, col: 0xf28bb0 },
  hat_wizard: { name: 'Wizard Hat', slot: 'hat', hat: 7, col: 0x5b4bb7 },
  hat_party: { name: 'Party Hat', slot: 'hat', hat: 10, col: 0xef6f6c },
  hat_crown: { name: 'Royal Crown', slot: 'hat', hat: 6, col: 0xf2c230 },
  shirt_leaf: { name: 'Leaf Tunic', slot: 'shirt', col: 0x3f8f5b },
  shirt_berry: { name: 'Berry Tunic', slot: 'shirt', col: 0xb03a55 },
  shirt_sky: { name: 'Sky Tunic', slot: 'shirt', col: 0x3d7fc4 },
  shirt_sun: { name: 'Sunflower Tunic', slot: 'shirt', col: 0xe8b53a },
  shirt_royal: { name: 'Royal Robe', slot: 'shirt', col: 0x6a3d9a },
};
const TOOL_TIERS = [
  { name: 'Stone Tools', mult: 1, speed: 1 },
  { name: 'Iron Tools', mult: 1.5, speed: 1.15, level: 8, cost: { iron: 25, coins: 300 } },
  { name: 'Steel Tools', mult: 2, speed: 1.3, level: 13, cost: { iron: 60, tools: 10, coins: 1200 } },
  { name: 'Golden Tools', mult: 3, speed: 1.5, level: 20, cost: { gold: 40, tools: 25, planks: 40, coins: 5000 } },
];

/* ---------------- Shops ---------------- */
// sellMul: what the shop pays you (x item.sell). buyMul: what you pay (x item.buy)
const SHOPS = {
  cart: { name: 'Trading Cart', icon: '🛒', items: ['wood', 'stone', 'wheat', 'food'], sellMul: 1, buyMul: 1.15, desc: 'Old Hendrik buys anything. Prices are fair, not great.' },
  general: { name: 'General Store', icon: '🏪', building: 'general_store', items: ['wood', 'stone', 'wheat', 'food', 'iron'], sellMul: 1.3, buyMul: 0.9, desc: 'Better prices on everyday goods.' },
  stall: { name: 'Market Stall', icon: '🧺', building: 'market_stall', items: ['wheat', 'food'], sellMul: 1.5, buyMul: 0.85, desc: 'Fresh produce sells well here.' },
  bakery: { name: 'Bakery', icon: '🥖', building: 'bakery', items: ['food', 'wheat'], sellMul: 1.4, buyMul: 0.75, desc: 'Cheap bread. Pays extra for wheat.' },
  blacksmith: { name: 'Blacksmith', icon: '⚒️', building: 'blacksmith', items: ['iron', 'tools'], sellMul: 1.3, buyMul: 0.9, tools: true, desc: 'Iron, tools and tool upgrades.' },
  market: { name: 'Marketplace', icon: '🏛️', building: 'marketplace', items: ['wood', 'stone', 'wheat', 'food', 'iron', 'gold', 'tools'], sellMul: 1.6, buyMul: 0.85, desc: 'The busiest trading spot in town.' },
  harbor: { name: 'Harbor', icon: '⚓', building: 'harbor', items: ['gold', 'planks', 'tools', 'iron'], sellMul: 1.8, buyMul: 0.8, desc: 'Ships pay top coin for crafted goods.' },
  grand: { name: 'Grand Market', icon: '👑', building: 'large_market', items: ['wood', 'stone', 'wheat', 'food', 'iron', 'gold', 'tools', 'planks'], sellMul: 2, buyMul: 0.75, desc: 'The very best prices in the land.' },
};

/* ---------------- QuestConfig ---------------- */
// goal types: gather(key) sell earn help welcome build(key) buildAny residents level areas area(key) roads
const MAIN_QUESTS = [
  { id: 'm_wood', title: 'Gather 20 Wood', hint: 'Walk up to a tree and press E (or tap it).', goal: { t: 'gather', k: 'wood', n: 20 }, reward: { coins: 40, xp: 40 }, mark: 'tree' },
  { id: 'm_stone', title: 'Gather 15 Stone', hint: 'Rocks give stone. Look near the edge of the glade.', goal: { t: 'gather', k: 'stone', n: 15 }, reward: { coins: 40, xp: 40 }, mark: 'rock' },
  { id: 'm_house', title: 'Build your first house', hint: 'Open Build (B) and place a Small House.', goal: { t: 'build', k: 'small_house', n: 1 }, reward: { xp: 60, wood: 20 } },
  { id: 'm_welcome', title: 'Welcome your first resident', hint: 'A traveler arrives when there is a free home. Talk to them!', goal: { t: 'welcome', n: 1 }, reward: { xp: 80, coins: 50 }, mark: 'candidate' },
  { id: 'm_woodcutter', title: "Build a Woodcutter's Hut", hint: 'Give your resident a job. Workers produce resources.', goal: { t: 'build', k: 'woodcutter', n: 1 }, reward: { xp: 80, coins: 60 } },
  { id: 'm_coins', title: 'Collect 100 coins', hint: 'Sell resources at the Trading Cart, or collect taxes each morning.', goal: { t: 'earn', n: 100 }, reward: { xp: 60, stone: 20 }, mark: 'cart' },
  { id: 'm_expand', title: 'Expand your village', hint: 'Walk to a For Sale sign at the edge of your land, or use Village > Land.', goal: { t: 'areas', n: 2 }, reward: { xp: 120, coins: 100 }, mark: 'sign' },
  { id: 'm_well', title: 'Build a Well', hint: 'Wells make villagers happier.', goal: { t: 'build', k: 'well', n: 1 }, reward: { xp: 100, coins: 60 } },
  { id: 'm_res3', title: 'Reach 3 residents', hint: 'Build more homes. Happy villages attract people faster.', goal: { t: 'residents', n: 3 }, reward: { xp: 150, coins: 100 } },
  { id: 'm_lvl5', title: 'Grow into a Village', hint: 'Reach level 5. Everything you do gives XP.', goal: { t: 'level', n: 5 }, reward: { coins: 200, cos: 'hat_straw' } },
  { id: 'm_farm', title: 'Build a farm', hint: 'Farms grow wheat.', goal: { t: 'build', k: 'farm', n: 1 }, reward: { xp: 150, coins: 100 } },
  { id: 'm_store', title: 'Build a General Store', hint: 'Shops earn coins when villagers buy things.', goal: { t: 'build', k: 'general_store', n: 1 }, reward: { xp: 150, coins: 120 } },
  { id: 'm_bakery', title: 'Build a bakery', hint: 'Bakers turn wheat into food for everyone.', goal: { t: 'build', k: 'bakery', n: 1 }, reward: { xp: 200, coins: 150 } },
  { id: 'm_res5', title: 'Reach 5 residents', goal: { t: 'residents', n: 5 }, reward: { xp: 200, coins: 150 } },
  { id: 'm_hills', title: 'Unlock the Stone Hills', hint: 'Iron waits in the hills to the north-west.', goal: { t: 'area', k: 'hills', n: 1 }, reward: { xp: 200, food: 30 } },
  { id: 'm_iron', title: 'Gather 20 Iron', hint: 'Iron ore has rusty orange veins.', goal: { t: 'gather', k: 'iron', n: 20 }, reward: { xp: 200, coins: 150 }, mark: 'iron' },
  { id: 'm_smith', title: 'Build a Blacksmith', goal: { t: 'build', k: 'blacksmith', n: 1 }, reward: { xp: 300, coins: 200 } },
  { id: 'm_roads', title: 'Lay 6 Stone Roads', hint: 'Roads make the village prettier. Drag to paint them.', goal: { t: 'roads', k: 'stone_road', n: 6 }, reward: { xp: 150, stone: 40 } },
  { id: 'm_res10', title: 'Reach 10 residents', goal: { t: 'residents', n: 10 }, reward: { xp: 400, coins: 300 } },
  { id: 'm_help', title: 'Help 3 villagers', hint: 'Villagers with a ! above their head need something.', goal: { t: 'help', n: 3 }, reward: { xp: 300, coins: 200 } },
  { id: 'm_lvl10', title: 'Become a Town', hint: 'Reach level 10.', goal: { t: 'level', n: 10 }, reward: { coins: 500, cos: 'hat_top' } },
  { id: 'm_hall', title: 'Build the Town Hall', goal: { t: 'build', k: 'town_hall', n: 1 }, reward: { xp: 600, coins: 400, cos: 'hat_flower' } },
  { id: 'm_inn', title: 'Build an Inn', goal: { t: 'build', k: 'inn', n: 1 }, reward: { xp: 400, coins: 300 } },
  { id: 'm_chapel', title: 'Build a Chapel', goal: { t: 'build', k: 'chapel', n: 1 }, reward: { xp: 500, coins: 400 } },
  { id: 'm_res20', title: 'Reach 20 residents', goal: { t: 'residents', n: 20 }, reward: { xp: 800, coins: 600 } },
  { id: 'm_harborarea', title: 'Unlock the Harbor Coast', goal: { t: 'area', k: 'harbor', n: 1 }, reward: { xp: 800, planks: 40 } },
  { id: 'm_lvl20', title: 'Become a City', hint: 'Reach level 20.', goal: { t: 'level', n: 20 }, reward: { coins: 2000, cos: 'shirt_royal' } },
  { id: 'm_square', title: 'Build the Town Square', goal: { t: 'build', k: 'town_square', n: 1 }, reward: { xp: 1200, coins: 1000 } },
  { id: 'm_harbor', title: 'Build the Harbor', goal: { t: 'build', k: 'harbor', n: 1 }, reward: { xp: 1200, coins: 1000 } },
  { id: 'm_res40', title: 'Reach 40 residents', goal: { t: 'residents', n: 40 }, reward: { xp: 2000, coins: 2000 } },
  { id: 'm_b100', title: 'Build 100 buildings', goal: { t: 'buildAny', n: 100 }, reward: { xp: 3000, gold: 30 } },
  { id: 'm_lvl30', title: 'Become a Grand City', hint: 'Reach level 30.', goal: { t: 'level', n: 30 }, reward: { coins: 10000, cos: 'hat_crown' } },
  { id: 'm_palace', title: 'Build the Grand Hall', goal: { t: 'build', k: 'palace', n: 1 }, reward: { xp: 10000, coins: 10000 } },
];
// side quests are generated from these templates (2 active at a time)
const SIDE_TEMPLATES = [
  { t: 'gather', k: 'wood', title: (n) => `Gather ${n} Wood`, n: (l) => 25 + l * 6, lvl: 1 },
  { t: 'gather', k: 'stone', title: (n) => `Gather ${n} Stone`, n: (l) => 20 + l * 5, lvl: 1 },
  { t: 'gather', k: 'food', title: (n) => `Collect ${n} Food by hand`, n: (l) => 8 + l * 2, lvl: 2 },
  { t: 'gather', k: 'wheat', title: (n) => `Harvest ${n} Wheat`, n: (l) => 12 + l * 3, lvl: 3 },
  { t: 'gather', k: 'iron', title: (n) => `Mine ${n} Iron`, n: (l) => 8 + l, lvl: 6 },
  { t: 'sell', title: (n) => `Earn ${n} coins by trading`, n: (l) => 40 + l * 25, lvl: 1 },
  { t: 'earn', title: (n) => `Collect ${n} coins`, n: (l) => 80 + l * 40, lvl: 2 },
  { t: 'help', title: () => 'Help a villager', n: () => 1, lvl: 3 },
  { t: 'buildCat', k: 'decor', title: (n) => `Place ${n} decorations`, n: (l) => 2 + Math.floor(l / 6), lvl: 2 },
  { t: 'buildCat', k: 'housing', title: () => 'Build a new home', n: () => 1, lvl: 2 },
  { t: 'roadsAny', title: (n) => `Lay ${n} road tiles`, n: (l) => 4 + Math.floor(l / 3), lvl: 1 },
];

/* ---------------- Achievements ---------------- */
const ACHIEVEMENTS = [
  { id: 'first_house', name: 'First House', desc: 'Build your first house.', icon: '🏠', reward: { coins: 50 } },
  { id: 'first_resident', name: 'First Resident', desc: 'Welcome your first villager.', icon: '👋', reward: { coins: 50 } },
  { id: 'village_founder', name: 'Village Founder', desc: 'Reach level 5.', icon: '🌱', reward: { coins: 150 } },
  { id: 'first_shop', name: 'First Shop', desc: 'Build your first shop.', icon: '🏪', reward: { coins: 100 } },
  { id: 'res10', name: '10 Residents', desc: 'Have 10 residents.', icon: '👨‍👩‍👧', reward: { coins: 250 } },
  { id: 'coins1000', name: '1000 Coins', desc: 'Hold 1,000 coins at once.', icon: '🪙', reward: { xp: 150 } },
  { id: 'growing_town', name: 'Growing Town', desc: 'Reach level 10.', icon: '🏘️', reward: { coins: 400 } },
  { id: 'lumberjack', name: 'Lumberjack', desc: 'Gather 500 wood by hand.', icon: '🪓', reward: { coins: 200 } },
  { id: 'stonemason', name: 'Stonemason', desc: 'Gather 500 stone by hand.', icon: '⛏️', reward: { coins: 200 } },
  { id: 'explorer', name: 'Explorer', desc: 'Discover 6 areas.', icon: '🧭', reward: { coins: 300 } },
  { id: 'treasure', name: 'Treasure Hunter', desc: 'Open 3 treasure chests.', icon: '💎', reward: { coins: 300 } },
  { id: 'night_owl', name: 'Sweet Dreams', desc: 'Sleep through a night.', icon: '🌙', reward: { coins: 40 } },
  { id: 'wolf_hunter', name: 'Wolf Chaser', desc: 'Chase away 5 wolves.', icon: '🐺', reward: { coins: 250 } },
  { id: 'firefighter', name: 'Firefighter', desc: 'Put out a fire.', icon: '🧯', reward: { coins: 150 } },
  { id: 'helper', name: 'Good Neighbor', desc: 'Help 10 villagers.', icon: '🤝', reward: { coins: 300 } },
  { id: 'happy', name: 'Joyful Village', desc: 'Reach 85% happiness with 10+ residents.', icon: '😊', reward: { coins: 500 } },
  { id: 'master_builder', name: 'Master Builder', desc: 'Build 50 buildings.', icon: '🏗️', reward: { coins: 800 } },
  { id: 'metropolis', name: 'City Lights', desc: 'Reach level 20.', icon: '🌆', reward: { coins: 1500 } },
  { id: 'rich', name: 'Treasury', desc: 'Hold 10,000 coins at once.', icon: '💰', reward: { xp: 1000 } },
  { id: 'b100', name: '100 Buildings', desc: 'Build 100 buildings.', icon: '🏙️', reward: { gold: 20 } },
  { id: 'grand_city', name: 'Grand City', desc: 'Reach level 30.', icon: '👑', reward: { coins: 5000, cos: 'hat_wizard' } },
];

/* ---------------- Random events ---------------- */
const EVENTS_CFG = {
  rain: { name: 'Heavy Rain', icon: '🌧️', dur: 110, desc: 'Farms grow 50% faster. Villagers hurry indoors.' },
  festival: { name: 'Village Festival', icon: '🎉', dur: 100, desc: 'Everyone gathers to celebrate. +Happiness, shops earn double.' },
  wolves: { name: 'Wolves Attack!', icon: '🐺', dur: 100, desc: 'Wolves are coming for the food! Chase them away (E).' },
  merchant: { name: 'Traveling Merchant', icon: '🧳', dur: 150, desc: 'A merchant has rare goods near the Trading Cart.' },
  harvest: { name: 'Harvest Festival', icon: '🌾', dur: 110, desc: 'Wheat production doubled. Wheat sells for more.' },
  fire: { name: 'Small Fire!', icon: '🔥', dur: 60, desc: 'A building is on fire! Hold E next to it to put it out.' },
  meteor: { name: 'Meteor Shower', icon: '☄️', dur: 90, desc: 'Shooting stars! Some fell nearby. Find the glowing fragments.' },
  visitor: { name: 'Special Visitor', icon: '🎁', dur: 120, desc: 'A noble traveler is touring your village. Go say hello!' },
};
