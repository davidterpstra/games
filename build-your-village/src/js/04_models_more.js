/* =====================================================================
   MORE BUILDINGS — the expansion pack. Config + low-poly model for
   every extra building, built from the same parts and palette.
   ===================================================================== */
const MORE_BUILDINGS = {
  /* ---- housing ---- */
  log_cabin: { name: 'Log Cabin', cat: 'housing', level: 2, cost: { wood: 60, coins: 60 }, size: [6, 5], house: 2, quality: 1, desc: 'A rustic home of logs for 2 residents. Needs almost no stone.' },
  farmhouse: { name: 'Farmhouse', cat: 'housing', level: 6, cost: { wood: 110, stone: 50, coins: 260 }, size: [8, 7], house: 3, quality: 2, desc: 'A roomy farmhouse with a porch for 3 residents.' },
  lake_cabin: { name: 'Lakeside Cabin', cat: 'housing', level: 9, cost: { wood: 140, stone: 40, coins: 380 }, size: [6, 6], house: 3, quality: 3, needs: 'water', desc: 'A cabin on stilts by the water for 3 residents. Must be near water.' },
  row_houses: { name: 'Row Houses', cat: 'housing', level: 12, cost: { wood: 200, stone: 220, coins: 900 }, size: [12, 6], house: 6, quality: 3, desc: 'Three colorful terraced homes for 6 residents.' },
  tower_house: { name: 'Tower House', cat: 'housing', level: 15, cost: { wood: 150, stone: 320, iron: 20, coins: 1100 }, size: [5, 5], house: 4, quality: 4, desc: 'A tall stone tower home for 4 residents on a small plot.' },
  villa: { name: 'Villa', cat: 'housing', level: 18, cost: { wood: 300, stone: 400, gold: 5, coins: 2200 }, size: [12, 10], house: 5, quality: 6, happy: { decor: 2 }, desc: 'A luxurious villa with a garden for 5 residents. Very happy residents.' },
  apartments: { name: 'Apartment Block', cat: 'housing', level: 24, cost: { wood: 300, stone: 600, planks: 80, iron: 40, coins: 3200 }, size: [10, 8], house: 14, quality: 3, desc: 'A big city block with homes for 14 residents.' },
  /* ---- production ---- */
  chicken_coop: { name: 'Chicken Coop', cat: 'production', level: 3, cost: { wood: 45, stone: 10, coins: 90 }, size: [5, 5], jobs: { prof: 'farmer', n: 1 }, work: 'outside', produce: { food: 1 }, desc: 'Eggs every day. A farmer produces food.' },
  beehives: { name: 'Beehive Garden', cat: 'production', level: 4, cost: { wood: 40, coins: 120 }, size: [5, 5], jobs: { prof: 'farmer', n: 1 }, work: 'outside', produce: { food: 1, coins: 1 }, happy: { decor: 1 }, desc: 'Honey to eat and to sell, among the flowers.' },
  lumber_camp: { name: 'Lumber Camp', cat: 'production', level: 6, cost: { wood: 120, stone: 40, coins: 300 }, size: [9, 8], jobs: { prof: 'woodcutter', n: 3 }, work: 'outside', produce: { wood: 2 }, desc: 'A big camp for 3 woodcutters.' },
  orchard: { name: 'Orchard', cat: 'production', level: 7, cost: { wood: 90, stone: 20, coins: 280 }, size: [10, 10], jobs: { prof: 'farmer', n: 2 }, work: 'outside', produce: { food: 1.5 }, happy: { decor: 1 }, desc: 'Rows of fruit trees tended by 2 farmers.' },
  granary: { name: 'Granary', cat: 'production', level: 7, cost: { wood: 140, stone: 90, coins: 320 }, size: [6, 6], storage: 300, desc: '+300 storage for every resource.' },
  sheep_pasture: { name: 'Sheep Pasture', cat: 'production', level: 8, cost: { wood: 100, stone: 20, coins: 300 }, size: [12, 10], jobs: { prof: 'farmer', n: 1 }, work: 'outside', produce: { coins: 3 }, happy: { decor: 1 }, desc: 'Fluffy sheep. Their wool sells well.' },
  dairy_farm: { name: 'Dairy Farm', cat: 'production', level: 10, cost: { wood: 180, stone: 100, wheat: 40, coins: 650 }, size: [12, 10], jobs: { prof: 'farmer', n: 2 }, work: 'outside', produce: { food: 2 }, desc: 'Cows in a meadow. Milk and cheese for everyone.' },
  smelter: { name: 'Smelter', cat: 'production', level: 10, cost: { wood: 120, stone: 250, coins: 700 }, size: [7, 7], jobs: { prof: 'miner', n: 1 }, work: 'outside', consume: { stone: 3 }, produce: { iron: 1 }, desc: 'Melts iron out of stone.' },
  sawmill: { name: 'Sawmill', cat: 'production', level: 12, cost: { wood: 250, stone: 120, iron: 20, coins: 900 }, size: [10, 7], jobs: { prof: 'builder', n: 2 }, work: 'outside', consume: { wood: 2 }, produce: { planks: 1 }, desc: 'A water-driven saw that turns logs into planks.' },
  quarry_works: { name: 'Quarry Works', cat: 'production', level: 12, cost: { wood: 200, stone: 100, iron: 20, coins: 900 }, size: [10, 9], jobs: { prof: 'miner', n: 3 }, work: 'outside', produce: { stone: 2 }, desc: 'A large yard for 3 miners with a crane.' },
  brewery: { name: 'Brewery', cat: 'production', level: 13, cost: { wood: 200, stone: 180, coins: 1000 }, size: [9, 7], jobs: { prof: 'baker', n: 1 }, work: 'inside', consume: { wheat: 2 }, produce: { coins: 7 }, happy: { ent: 2 }, desc: 'Brews cider and ale from wheat. Sells for good coin.' },
  fishery: { name: 'Fishery Dock', cat: 'production', level: 13, cost: { wood: 260, stone: 80, coins: 900 }, size: [8, 8], jobs: { prof: 'fisher', n: 3 }, work: 'outside', produce: { food: 2.5 }, needs: 'water', desc: 'A big dock for 3 fishers. Must be near water.' },
  vineyard: { name: 'Vineyard', cat: 'production', level: 14, cost: { wood: 180, stone: 80, coins: 1200 }, size: [12, 10], jobs: { prof: 'farmer', n: 2 }, work: 'outside', produce: { coins: 4 }, happy: { decor: 2 }, desc: 'Grapes on the hillside. Wine brings in coins.' },
  toolmaker: { name: 'Toolmaker', cat: 'production', level: 15, cost: { wood: 200, stone: 200, iron: 60, coins: 1500 }, size: [8, 7], jobs: { prof: 'blacksmith', n: 1 }, work: 'inside', consume: { iron: 1, wood: 1 }, produce: { tools: 1 }, desc: 'A workshop that turns iron and wood into tools.' },
  gold_mine: { name: 'Gold Mine', cat: 'production', level: 16, cost: { wood: 300, stone: 300, iron: 80, coins: 2500 }, size: [9, 9], jobs: { prof: 'miner', n: 2 }, work: 'inside', produce: { gold: 0.15, stone: 1 }, needs: 'rocky', desc: 'Miners dig for gold. Must be in the Stone Hills or Crystal Peaks.' },
  greenhouse: { name: 'Greenhouse', cat: 'production', level: 17, cost: { wood: 200, stone: 150, planks: 40, coins: 1600 }, size: [10, 7], jobs: { prof: 'farmer', n: 2 }, work: 'inside', produce: { food: 3 }, desc: 'Grows vegetables in any weather. Lots of food.' },
  /* ---- shops ---- */
  butcher: { name: 'Butcher', cat: 'shops', level: 9, cost: { wood: 120, stone: 120, coins: 500 }, size: [7, 6], jobs: { prof: 'merchant', n: 1 }, work: 'inside', produce: { coins: 3 }, happy: { shops: 2, food: 1 }, desc: 'Sausages and roasts. Villagers shop here.' },
  pottery: { name: 'Pottery', cat: 'shops', level: 8, cost: { wood: 100, stone: 140, coins: 450 }, size: [7, 6], jobs: { prof: 'builder', n: 1 }, work: 'outside', produce: { coins: 3 }, happy: { shops: 1, decor: 1 }, desc: 'Pots and vases. A potter earns coins.' },
  tailor: { name: 'Tailor', cat: 'shops', level: 11, cost: { wood: 150, stone: 120, coins: 700 }, size: [7, 7], jobs: { prof: 'merchant', n: 1 }, work: 'inside', produce: { coins: 4 }, happy: { shops: 2 }, desc: 'Fine clothes for fine villagers.' },
  post_office: { name: 'Post Office', cat: 'shops', level: 13, cost: { wood: 160, stone: 160, coins: 800 }, size: [8, 7], jobs: { prof: 'merchant', n: 1 }, work: 'inside', produce: { coins: 2 }, happy: { service: 3 }, desc: 'Letters and parcels. +Services.' },
  apothecary: { name: 'Apothecary', cat: 'shops', level: 16, cost: { wood: 180, stone: 200, gold: 3, coins: 1300 }, size: [7, 7], jobs: { prof: 'merchant', n: 1 }, work: 'inside', produce: { coins: 3 }, happy: { service: 4, shops: 1 }, desc: 'Herbs and remedies. Keeps villagers healthy.' },
  bank: { name: 'Bank', cat: 'shops', level: 26, cost: { stone: 800, iron: 80, gold: 50, coins: 8000 }, size: [10, 9], unique: true, jobs: { prof: 'merchant', n: 2 }, work: 'inside', produce: { coins: 6 }, taxBoost: 0.2, happy: { service: 3 }, desc: 'Keeps the treasury safe. +20% taxes.' },
  /* ---- services ---- */
  school: { name: 'School', cat: 'services', level: 12, cost: { wood: 250, stone: 200, coins: 1000 }, size: [10, 8], xpBoost: 0.05, happy: { service: 6 }, desc: 'Children learn their letters. +5% XP, +Services.' },
  fire_station: { name: 'Fire Station', cat: 'services', level: 14, cost: { wood: 200, stone: 250, iron: 30, coins: 1100 }, size: [8, 8], jobs: { prof: 'guard', n: 2 }, work: 'outside', firefight: true, happy: { safety: 4 }, desc: 'Fires are put out much faster. +Safety.' },
  clinic: { name: 'Clinic', cat: 'services', level: 18, cost: { wood: 200, stone: 350, planks: 30, coins: 2000 }, size: [10, 8], happy: { service: 8 }, desc: 'A doctor for the whole village. Big +Services.' },
  bathhouse: { name: 'Bathhouse', cat: 'services', level: 19, cost: { wood: 250, stone: 400, coins: 2200 }, size: [10, 9], happy: { ent: 5, service: 3 }, desc: 'Warm baths and steam. Relaxing.' },
  theater: { name: 'Theater', cat: 'services', level: 22, cost: { wood: 400, stone: 500, planks: 60, gold: 10, coins: 3500 }, size: [12, 10], jobs: { prof: 'merchant', n: 1 }, work: 'inside', produce: { coins: 5 }, happy: { ent: 8 }, desc: 'Plays every evening. Huge +Entertainment.' },
  barracks: { name: 'Barracks', cat: 'services', level: 25, cost: { wood: 400, stone: 600, iron: 100, coins: 3500 }, size: [12, 9], jobs: { prof: 'guard', n: 4 }, work: 'outside', defends: true, happy: { safety: 8 }, desc: 'Home of the town guard. Guards chase off wolves.' },
  observatory: { name: 'Observatory', cat: 'services', level: 28, cost: { stone: 700, planks: 120, gold: 60, coins: 9000 }, size: [8, 8], unique: true, xpBoost: 0.1, happy: { service: 6, decor: 4 }, desc: 'Watch the stars. +10% XP.' },
  arena: { name: 'Arena', cat: 'services', level: 29, cost: { wood: 800, stone: 1400, planks: 200, gold: 80, coins: 14000 }, size: [18, 16], unique: true, happy: { ent: 15 }, desc: 'Tournaments and games. The biggest show in the land.' },
  /* ---- decor ---- */
  picket_fence: { name: 'Picket Fence', cat: 'decor', level: 1, cost: { wood: 3, coins: 5 }, size: [4, 1], happy: { decor: 0.2 }, desc: 'A neat white fence.' },
  signpost: { name: 'Signpost', cat: 'decor', level: 1, cost: { wood: 3, coins: 8 }, size: [1, 1], happy: { decor: 0.3 }, desc: 'Points the way.' },
  hedge: { name: 'Hedge', cat: 'decor', level: 2, cost: { wood: 4, coins: 12 }, size: [4, 1], happy: { decor: 0.5 }, desc: 'A trimmed green hedge.' },
  scarecrow: { name: 'Scarecrow', cat: 'decor', level: 3, cost: { wood: 6, wheat: 5, coins: 10 }, size: [2, 2], happy: { decor: 0.5 }, desc: 'Keeps the crows away. Mostly.' },
  market_cart: { name: 'Flower Cart', cat: 'decor', level: 5, cost: { wood: 20, coins: 60 }, size: [3, 2], happy: { decor: 1 }, desc: 'A cart full of flowers.' },
  flag_pole: { name: 'Flag Pole', cat: 'decor', level: 6, cost: { wood: 10, iron: 2, coins: 40 }, size: [2, 2], happy: { decor: 1 }, desc: 'The village banner, waving in the wind.' },
  bonfire: { name: 'Bonfire', cat: 'decor', level: 7, cost: { wood: 30, stone: 10, coins: 50 }, size: [3, 3], happy: { ent: 2 }, desc: 'Villagers gather around the fire. +Entertainment.' },
  garden_pond: { name: 'Garden Pond', cat: 'decor', level: 8, cost: { stone: 60, coins: 180 }, size: [5, 4], happy: { decor: 3 }, desc: 'A little pond with lily pads.' },
  gazebo: { name: 'Gazebo', cat: 'decor', level: 10, cost: { wood: 80, stone: 40, coins: 300 }, size: [5, 5], happy: { decor: 3, ent: 1 }, desc: 'A shady pavilion for picnics.' },
  rose_arch: { name: 'Rose Arch', cat: 'decor', level: 12, cost: { wood: 40, coins: 220 }, size: [3, 2], happy: { decor: 2 }, desc: 'Climbing roses over a wooden arch.' },
  topiary: { name: 'Topiary', cat: 'decor', level: 16, cost: { stone: 30, coins: 400 }, size: [2, 2], happy: { decor: 2 }, desc: 'A hedge trimmed into a perfect shape.' },
  obelisk: { name: 'Obelisk', cat: 'decor', level: 20, cost: { stone: 300, gold: 5, coins: 1500 }, size: [3, 3], happy: { decor: 4 }, desc: 'A tall stone monument.' },
  /* ---- roads ---- */
  gravel_path: { name: 'Gravel Path', cat: 'roads', level: 2, cost: { stone: 1, coins: 2 }, size: [4, 4], road: true, desc: 'A cheap gravel path. Drag to paint.' },
  plaza_tile: { name: 'Plaza Tile', cat: 'roads', level: 15, cost: { stone: 6, coins: 15 }, size: [4, 4], road: true, happy: { decor: 0.15 }, desc: 'Smooth checkered paving for squares.' },
};
for (const [id, b] of Object.entries(MORE_BUILDINGS)) { b.id = id; BUILDINGS[id] = b; }

Object.assign(MODEL_FNS, {
  log_cabin(g) {
    g.push(0, 0, -0.3);
    pFoundation(g, 5.2, 4.2, P.stoneD, 0.25);
    for (let i = 0; i < 5; i++) {
      const y = 0.5 + i * 0.44, c = i % 2 ? P.log : P.logL;
      g.cylC(0.23, 0.23, 5.1, 6, c, 0, y, 1.9, 0, 0, Math.PI / 2).cylC(0.23, 0.23, 5.1, 6, c, 0, y, -1.9, 0, 0, Math.PI / 2);
      g.cylC(0.23, 0.23, 4.1, 6, c, 2.35, y + 0.22, 0, Math.PI / 2, 0, 0).cylC(0.23, 0.23, 4.1, 6, c, -2.35, y + 0.22, 0, Math.PI / 2, 0, 0);
    }
    g.boxB(4.5, 2.3, 3.6, P.woodD, 0, 0.25, 0);
    g.roof(5.2, 6.0, 1.7, P.roofR2, 0, 2.55, 0, Math.PI / 2, P.logL);
    pDoor(g, 0.9, 0.3, 2.12); pWindow(g, -1.1, 1.5, 2.12, 0, { shutter: P.shutter, flowers: true });
    pChimney(g, -1.6, 2.4, -0.8, 2.0);
    g.pop();
    g.cyl(0.4, 0.45, 0.5, 8, P.log, 2.4, 0, 2.1);
  },
  farmhouse(g) {
    pBody(g, { z: -0.8, w: 6.4, d: 4.6, h: 3.0, wall: P.warm, roof: P.roofR, roofH: 2.2, winFront: 2, winSide: 1, flowers: true, braces: true, doorX: 0.8 });
    g.shed(6.4, 1.6, 0.45, 0.1, P.roofBr, 0, 2.6, 2.3);
    for (const x of [-3, -1, 1.2, 3]) g.boxB(0.14, 2.3, 0.14, P.beam, x, 0.3, 3.0);
    g.boxB(6.4, 0.14, 1.6, P.woodL, 0, 0.25, 2.3);
    pBarrel(g, -2.6, 0.4, 2.4); g.boxB(1.0, 0.5, 0.7, P.hay, 3.3, 0, 2.9);
  },
  lake_cabin(g) {
    for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.4], [1.8, 1.4]]) g.cyl(0.14, 0.16, 3, 5, P.woodD, x, -1.6, z);
    g.boxB(4.2, 0.2, 4.0, P.wood, 0, 1.2, -0.2);
    g.boxB(3.6, 2.4, 3.0, 0x6f8fa8, 0, 1.4, -0.5).roof(3.9, 4.4, 1.5, P.roofB, 0, 3.8, -0.5, Math.PI / 2, 0x6f8fa8);
    pDoor(g, 0, 1.4, 1.02); pWindow(g, 1.8, 2.5, -0.5, Math.PI / 2, { shutter: P.shutterB }); pWindow(g, -1.8, 2.5, -0.5, -Math.PI / 2, { shutter: P.shutterB });
    for (let i = 0; i < 4; i++) g.boxB(1.2, 0.12, 0.5, i % 2 ? P.wood : P.woodL, 0, 1.2, 1.9 + i * 0.5);
    for (let i = 0; i < 4; i++) g.boxB(1.0, 0.14, 0.45, P.woodL, 0, 1.0 - i * 0.35, 3.9 + i * 0.4);
    pLamp(g, 1.7, 2.8, 1.6);
  },
  row_houses(g) {
    const cols = [P.rose, P.sky, P.sage], roofs = [P.roofR, P.roofB, P.roofG];
    for (let i = 0; i < 3; i++) pBody(g, { x: -4 + i * 4, z: -0.3, w: 3.9, d: 5.2, h: 5.4, floors: 2, wall: cols[i], roof: roofs[i], axis: 'z', roofH: 2.2, winFront: 1, winSide: 0, winBack: 1, timber: false, chimX: 0.9, chimZ: -1.4, flowers: true, shutter: [P.shutterR, P.shutterB, P.shutter][i], foundation: true });
    for (let i = 0; i < 3; i++) g.boxB(0.12, 5.4, 5.3, P.stoneL, -6 + i * 4, 0.4, -0.3);
    g.boxB(0.12, 5.4, 5.3, P.stoneL, 6, 0.4, -0.3);
  },
  tower_house(g) {
    pFoundation(g, 4.4, 4.4, P.stoneD);
    g.cyl(1.9, 2.1, 7.6, 8, P.stoneL, 0, 0.4, 0);
    for (let y = 2; y < 8; y += 2) g.cyl(2.12, 2.12, 0.18, 8, P.stone, 0, y, 0);
    g.cone(2.5, 3.2, 8, P.roofT, 0, 8.0, 0).box(0.08, 1, 0.08, P.gold, 0, 11.6, 0);
    pDoor(g, 0, 0.4, 2.0);
    for (let k = 0; k < 3; k++) pWindow(g, 0, 3 + k * 1.8, 1.93, 0, { w: 0.5, h: 0.7, shutter: P.shutter });
    pWindow(g, 1.93, 4.5, 0, Math.PI / 2, { w: 0.5, h: 0.7, shutters: false }); pWindow(g, -1.93, 6.3, 0, -Math.PI / 2, { w: 0.5, h: 0.7, shutters: false });
    g.ico(0.5, P.leaf, 1.6, 0.4, 1.6, 1, 0.8, 1, 0, 0.3);
  },
  villa(g) {
    pBody(g, { z: -1.8, w: 8.4, d: 5.0, h: 5.2, floors: 2, wall: P.white, roof: P.roofR, roofH: 1.8, hip: true, timber: false, winFront: 4, winSide: 2, winBack: 3, door: false, chimney: false, shutter: P.shutter, base: P.stoneL });
    pDoor(g, 0, 0.4, 0.74, 0, { w: 1.3, h: 2.2, col: 0x6b3f22 });
    for (const x of [-1.8, 1.8]) g.cyl(0.2, 0.24, 3.0, 8, P.white, x, 0.4, 1.3);
    g.boxB(4.4, 0.3, 1.8, P.stoneL, 0, 3.4, 1.1).boxB(4.4, 0.1, 1.8, P.stone, 0, 0.3, 1.1);
    g.boxB(3.6, 0.3, 2.4, P.stone, 2.5, 0, 3.2).boxB(3.2, 0.06, 2.0, P.water, 2.5, 0.3, 3.2);
    for (const [x, z] of [[-3.8, 2.4], [-3.8, 4.2], [-2.2, 4.2]]) pTree(g, x, z, 0.9);
    for (let i = 0; i < 6; i++) g.ico(0.3, [P.fR, P.fP, P.fY][i % 3], -4.6 + i * 0.4, 0.3, 3.2 + (i % 2) * 0.5, 1, 0.8, 1, 0, 0.3);
    pFence(g, -5.8, 4.8, 5.8, 4.8, P.white);
  },
  apartments(g) {
    pBody(g, { z: -0.4, w: 9.4, d: 6.6, h: 10, floors: 4, wall: P.warm, ground: P.stoneL, groundH: 2.5, roof: P.slate, roofH: 1.6, hip: true, timber: false, winFront: 4, winSide: 3, winBack: 4, shutter: P.shutterB, chimney: false, doorO: { w: 1.4, h: 2.1 } });
    for (let f = 1; f < 4; f++) g.boxB(9.6, 0.14, 0.6, P.stone, 0, 0.4 + f * 2.5, 3.1);
    for (const x of [-3, 3]) pChimney(g, x, 10.2, -1.6, 2.2);
  },
  chicken_coop(g) {
    g.boxB(2.4, 1.4, 1.8, P.woodL, -0.6, 0.5, -0.8).roof(2.2, 2.8, 0.8, P.roofR2, -0.6, 1.9, -0.8, Math.PI / 2, P.woodL);
    for (const [x, z] of [[-1.6, -1.6], [0.4, -1.6], [-1.6, 0], [0.4, 0]]) g.boxB(0.12, 0.5, 0.12, P.woodD, x, 0, z);
    g.box(0.3, 0.06, 1.2, P.woodD, 0.8, 0.35, 0.3, 0, 0.4, 0);
    pFence(g, -2.3, 2.3, 2.3, 2.3); pFence(g, 2.3, -2.3, 2.3, 2.3); pFence(g, -2.3, 0.6, -2.3, 2.3);
    for (let i = 0; i < 5; i++) { const x = -1 + (i % 3) * 1.1, z = 1 + Math.floor(i / 3) * 0.8; g.ico(0.2, i % 2 ? P.white : 0xc98a45, x, 0.22, z, 1.2, 1, 1, 0, 0.1).box(0.06, 0.1, 0.06, P.red, x + 0.18, 0.4, z); }
  },
  beehives(g) {
    for (let i = 0; i < 4; i++) { const x = -1.4 + (i % 2) * 2.8, z = -1.2 + Math.floor(i / 2) * 2.2; g.boxB(0.9, 0.3, 0.9, P.woodD, x, 0, z); for (let k = 0; k < 3; k++) g.boxB(0.8 - k * 0.05, 0.3, 0.8 - k * 0.05, k % 2 ? 0xf2c230 : 0xe8b53a, x, 0.3 + k * 0.3, z); g.pyr(1.0, 1.0, 0.3, P.woodL, x, 1.2, z); }
    for (let i = 0; i < 14; i++) g.ico(0.2, [P.fP, P.fY, P.fB, P.fW][i % 4], Math.cos(i * 1.7) * 2.1, 0.2, Math.sin(i * 1.7) * 2.1, 1, 0.8, 1, 0, 0.3);
  },
  lumber_camp(g) {
    pBody(g, { x: -2.4, z: -2.3, w: 3.6, d: 3.0, h: 2.3, wall: P.woodL, roof: P.roofG, roofH: 1.5, winFront: 1, winSide: 0, winBack: 0, doorX: 0.8, chimX: -0.8 });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5 - r; i++) g.cylC(0.28, 0.28, 3.2, 7, i % 2 ? P.log : P.logL, 2.4, 0.3 + r * 0.5, -3 + i * 0.58 + r * 0.29, 0, 0, Math.PI / 2 + Math.PI / 2);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3 - r; i++) g.cylC(0.28, 0.28, 3.2, 7, i % 2 ? P.log : P.logL, 1.2 + i * 0.58 + r * 0.29, 0.3 + r * 0.5, -0.6, Math.PI / 2, 0, 0);
    for (const x of [-2.6, -0.6, 1.4]) g.cyl(0.45, 0.5, 0.6, 8, P.log, x, 0, 2.6).cyl(0.42, 0.42, 0.02, 8, 0xc49a66, x, 0.6, 2.6);
    g.boxB(2.2, 0.6, 0.8, P.woodD, -1.5, 0, 0.8).cylC(0.05, 0.05, 1.8, 4, P.metal, -1.5, 0.75, 0.8, 0, 0, Math.PI / 2);
  },
  orchard(g) {
    for (let i = 0; i < 9; i++) { const x = -3.2 + (i % 3) * 3.2, z = -3.2 + Math.floor(i / 3) * 3.2; pTree(g, x, z, 1.1); for (let k = 0; k < 4; k++) g.ico(0.12, i % 2 ? P.red : 0xf29e3d, x + Math.cos(k * 1.6) * 0.8, 1.6 + (k % 2) * 0.5, z + Math.sin(k * 1.6) * 0.7, 1, 1, 1, 0, 0); }
    pFence(g, -4.9, 4.9, -1.2, 4.9); pFence(g, 1.2, 4.9, 4.9, 4.9); pFence(g, -4.9, -4.9, 4.9, -4.9); pFence(g, -4.9, -4.9, -4.9, 4.9); pFence(g, 4.9, -4.9, 4.9, 4.9);
    g.boxB(0.8, 0.5, 0.6, P.woodL, 1.4, 0, 4.2); for (let k = 0; k < 4; k++) g.ico(0.13, P.red, 1.2 + (k % 2) * 0.3, 0.6, 4.1 + Math.floor(k / 2) * 0.2, 1, 1, 1, 0, 0);
  },
  granary(g) {
    for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) g.boxB(0.4, 0.8, 0.4, P.stone, x, 0, z).cone(0.4, 0.25, 6, P.stoneL, x, 0.8, z);
    g.boxB(4.4, 3.2, 4.4, P.woodL, 0, 1.0, 0);
    for (let i = 0; i < 5; i++) g.box(4.45, 0.08, 4.45, P.woodD, 0, 1.3 + i * 0.65, 0);
    g.pyr(5.2, 5.2, 2.2, P.thatch, 0, 4.2, 0);
    g.boxB(1.2, 1.6, 0.1, P.door, 0, 1.2, 2.22);
    g.box(0.3, 0.12, 1.4, P.woodD, 0, 0.6, 2.8, 0, 0.5, 0);
  },
  sheep_pasture(g) {
    pFence(g, -5.8, -4.8, 5.8, -4.8); pFence(g, -5.8, 4.8, -1.2, 4.8); pFence(g, 1.2, 4.8, 5.8, 4.8); pFence(g, -5.8, -4.8, -5.8, 4.8); pFence(g, 5.8, -4.8, 5.8, 4.8);
    g.boxB(3, 2.0, 2.2, P.wood, -3.6, 0, -3.2).shed(3.4, 2.6, 0.6, 0.1, P.roofR2, -3.6, 2.0, -3.2);
    const sheep = (x, z, ry) => { g.push(x, 0, z, ry); g.ico(0.6, P.white, 0, 0.75, 0, 1.3, 0.8, 1, 0, 0.3).box(0.34, 0.34, 0.4, 0x3a3a3a, 0, 0.9, 0.75); for (const [a, b] of [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]]) g.boxB(0.1, 0.45, 0.1, 0x3a3a3a, a, 0, b); g.pop(); };
    [[1, 1, 0.3], [3, -1, 2], [-1, 2.5, 4], [2.4, 3, 1], [-2.2, 0.2, 5.5]].forEach(([x, z, r]) => sheep(x, z, r));
    g.cyl(0.8, 0.8, 0.3, 10, P.stone, 3.6, 0, -3.2).cyl(0.7, 0.7, 0.05, 10, P.water, 3.6, 0.28, -3.2);
  },
  dairy_farm(g) {
    pBody(g, { x: -3.2, z: -2.6, w: 5.2, d: 4, h: 3.2, wall: P.white, roof: P.roofR2, roofH: 2.0, winFront: 1, winSide: 1, doorX: 1, timber: true });
    g.cyl(0.9, 0.9, 5, 10, P.stoneL, 3.6, 0, -3.2)._add(new THREE.SphereGeometry(0.95, 10, 5, 0, TAU, 0, Math.PI / 2), P.roofR2, g._m(3.6, 5, -3.2));
    pFence(g, -5.8, 4.8, 5.8, 4.8); pFence(g, 5.8, -0.6, 5.8, 4.8); pFence(g, -5.8, -0.6, -5.8, 4.8);
    const cow = (x, z, ry) => { g.push(x, 0, z, ry); g.boxB(0.8, 0.75, 1.6, P.white, 0, 0.7, 0).boxB(0.4, 0.4, 0.4, 0x2d2d2d, -0.2, 1.0, 0.3).boxB(0.45, 0.45, 0.55, P.white, 0, 1.1, 0.95).box(0.3, 0.14, 0.1, 0xf0b0b0, 0, 1.0, 1.24); for (const [a, b] of [[-0.28, -0.6], [0.28, -0.6], [-0.28, 0.6], [0.28, 0.6]]) g.boxB(0.16, 0.7, 0.16, 0x2d2d2d, a, 0, b); g.pop(); };
    [[-2, 2.5, 0.4], [1.5, 1.6, 2.6], [3.4, 3.2, -1]].forEach(([x, z, r]) => cow(x, z, r));
    g.boxB(1.2, 0.6, 0.8, P.hay, 0.5, 0, -1).boxB(1.2, 0.6, 0.8, P.hay, 0.5, 0.6, -1);
  },
  smelter(g) {
    g.boxB(3.4, 2.4, 3.2, P.stoneD, -1, 0, -1).cyl(1.0, 1.4, 4.6, 8, 0x8a5a44, 1.8, 0, -1.6).cyl(0.6, 0.8, 1.6, 8, P.stoneD, 1.8, 4.6, -1.6);
    g.smoke(1.8, 6.4, -1.6);
    g.glowBox(0.8, 0.6, 0.2, 0xff7b2e, 1.8, 1.0, -0.4); g.fire(1.8, 1.0, -0.3);
    g.shed(4.6, 2.6, 0.4, 0.1, P.slate, -0.6, 2.6, 1.0);
    for (const x of [-2.8, 1.6]) g.boxB(0.2, 2.6, 0.2, P.beam, x, 0, 2.2);
    for (let i = 0; i < 4; i++) g.boxB(0.6, 0.25, 0.3, 0x8a95a5, -1.6 + i * 0.7, 0, 2.6);
    for (let i = 0; i < 5; i++) g.dodec(0.3, P.stone, -2.8 + i * 0.3, 0.2, 0.8 + (i % 2) * 0.4, 1, 0.7, 1, 0.3);
  },
  sawmill(g) {
    pBody(g, { z: -1.2, w: 7.0, d: 4.2, h: 3.4, wall: P.woodL, roof: P.roofBr, roofH: 2.0, winFront: 0, winSide: 1, door: false, chimney: false, braces: true });
    g.boxB(3.0, 2.6, 0.1, 0x2d241c, 0, 0.4, 0.92);
    g.cylC(1.6, 1.6, 0.5, 12, P.wood, -4.0, 1.8, -1.2, 0, 0, Math.PI / 2).cylC(0.2, 0.2, 1.2, 6, P.woodD, -4.0, 1.8, -1.2, 0, 0, Math.PI / 2);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.box(0.5, 0.1, 0.5, P.woodD, -4.0, 1.8 + Math.sin(a) * 1.6, -1.2 + Math.cos(a) * 1.6, 0, a, 0); }
    g.boxB(3.0, 0.8, 1.0, P.woodD, 0, 0, 2.2).cylC(0.45, 0.45, 0.04, 12, P.metal, 0, 1.0, 2.2, 0, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) g.boxB(3.0, 0.14, 0.34, P.woodL, 2.8, i * 0.15, 2.4);
    for (let i = 0; i < 3; i++) g.cylC(0.3, 0.3, 3, 7, P.log, -1.8, 0.3 + i * 0.1, 2.9 - i * 0.6, 0, 0, Math.PI / 2);
  },
  quarry_works(g) {
    g.boxB(3.4, 2.2, 3, P.stoneL, -2.8, 0.2, -2.8).roof(3.4, 3.8, 1.3, P.roofR2, -2.8, 2.4, -2.8, 0, P.stoneL);
    pDoor(g, -2.8, 0.2, -1.28);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) g.boxB(1.0, 0.7, 0.9, i % 2 ? P.stone : P.stoneL, 1.0 + i * 1.05 + r * 0.5, r * 0.7, -3.2);
    for (let i = 0; i < 6; i++) g.dodec(0.5, P.stoneD, -3 + i * 1.2, 0.3, 2.6 + (i % 2) * 0.8, 1, 0.7, 1, 0.3);
    g.boxB(0.3, 6, 0.3, P.beam, 4.2, 0, 0.6).box(4.4, 0.3, 0.3, P.beam, 2.2, 6, 0.6, 0, 0, 0).box(0.04, 2.5, 0.04, 0x333333, 0.4, 4.75, 0.6).boxB(0.9, 0.7, 0.9, P.stone, 0.4, 2.8, 0.6);
    g.boxB(1.6, 0.8, 1.0, P.woodD, -0.8, 0, 1.0);
  },
  brewery(g) {
    pBody(g, { z: -0.8, w: 7.2, d: 4.8, h: 3.6, wall: 0xd9b48a, roof: P.roofR2, roofH: 2.2, winFront: 2, winSide: 1, braces: true, chimX: 2.2 });
    for (let i = 0; i < 3; i++) g.cylC(0.6, 0.6, 1.3, 10, P.woodL, -3.0 + i * 1.3, 0.6, 2.6, Math.PI / 2, 0, 0).cylC(0.62, 0.62, 0.08, 10, P.metalD, -3.0 + i * 1.3, 0.6, 3.1, Math.PI / 2, 0, 0);
    pBarrel(g, 2.6, 0, 2.4); pBarrel(g, 3.3, 0, 2.6);
    g.box(1.2, 0.8, 0.1, P.woodL, 1.6, 3.2, 1.72).cyl(0.2, 0.18, 0.4, 7, P.hay, 1.6, 3.0, 1.8);
  },
  fishery(g) {
    for (let i = 0; i < 8; i++) g.boxB(7.4, 0.2, 0.9, i % 2 ? P.wood : P.woodL, 0, 1.0, -3.2 + i * 0.95);
    for (let i = 0; i < 4; i++) for (const z of [-3.2, 0, 3.2]) g.cyl(0.16, 0.18, 3.5, 5, P.woodD, -3.4 + i * 2.26, -2.4, z);
    g.boxB(3.2, 2.2, 2.4, P.wood, -1.8, 1.2, -2.2).roof(2.8, 3.6, 1.2, P.thatch, -1.8, 3.4, -2.2, Math.PI / 2, P.wood);
    pDoor(g, -1.8, 1.2, -0.98);
    for (let i = 0; i < 3; i++) g.boxB(0.08, 1.6, 0.08, P.woodD, 1.2 + i * 1.1, 1.2, 0.5);
    g.box(2.3, 0.05, 0.05, P.woodD, 2.3, 2.7, 0.5); for (let i = 0; i < 5; i++) g.box(0.14, 0.45, 0.05, 0x7fa6b8, 1.4 + i * 0.45, 2.4, 0.5);
    for (let i = 0; i < 4; i++) g.boxB(0.6, 0.3, 0.45, P.woodL, 2.8, 1.2 + (i % 2) * 0.3, 2.2 + Math.floor(i / 2) * 0.6);
    g.push(0, -0.1, 4.8, Math.PI / 2); g.boxB(1.4, 0.5, 3.4, P.woodD, 0, 0, 0).boxB(1.2, 0.1, 3.0, P.woodL, 0, 0.42, 0); g.pop();
  },
  vineyard(g) {
    for (let r = 0; r < 5; r++) {
      const z = -3.8 + r * 1.8;
      for (const x of [-5, 0, 5]) g.boxB(0.12, 1.5, 0.12, P.woodD, x, 0, z);
      g.box(10, 0.05, 0.05, P.woodD, 0, 1.3, z);
      for (let i = 0; i < 12; i++) { const x = -4.6 + i * 0.84; g.ico(0.35, P.leaf, x, 1.1, z, 1, 0.9, 0.7, 0, 0.3); if (i % 2) g.ico(0.14, 0x6b2f6e, x, 0.8, z + 0.15, 1, 1.3, 1, 0, 0); }
    }
    g.boxB(2.2, 1.6, 1.8, P.stoneL, 4.6, 0, 4.2).roof(2, 2.6, 0.9, P.roofR, 4.6, 1.6, 4.2, Math.PI / 2, P.stoneL);
    pBarrel(g, 3, 0, 4.4);
  },
  toolmaker(g) {
    pBody(g, { z: -0.6, w: 6.4, d: 4.8, h: 3.4, wall: P.stoneL, roof: P.slate, roofH: 2.0, winFront: 2, winSide: 1, timber: false, shutter: P.shutterB, chimX: -2 });
    g.box(1.6, 0.9, 0.1, P.woodL, 0, 3.2, 1.82).box(0.8, 0.12, 0.04, P.metal, -0.2, 3.25, 1.9, 0, 0, 0.5).box(0.12, 0.6, 0.04, P.woodD, 0.3, 3.1, 1.9, 0, 0, -0.4);
    g.boxB(1.4, 0.9, 0.7, P.woodD, 2.4, 0, 2.3); for (let i = 0; i < 3; i++) g.box(0.5, 0.06, 0.1, P.metal, 2.0 + i * 0.4, 0.95, 2.2);
  },
  gold_mine(g) {
    MODEL_FNS.mine(g);
    for (let i = 0; i < 6; i++) g.dodec(0.22, P.gold, -0.4 + (i % 3) * 0.4, 0.95, 2.9 + Math.floor(i / 3) * 0.4, 1, 0.8, 1, 0.3);
    for (let i = 0; i < 5; i++) g._add(new THREE.OctahedronGeometry(0.3, 0), P.gold, g._m(-2.6 + i * 1.3, 1.8 + (i % 2) * 0.6, -2.2, i, 0.3, 0, 1, 1.4, 1));
  },
  greenhouse(g) {
    pFoundation(g, 9.6, 6.6, P.stoneL, 0.3);
    g.boxB(9.2, 2.2, 6.2, 0x9fd6c9, 0, 0.3, 0);
    for (let i = 0; i <= 6; i++) g.boxB(0.12, 2.2, 6.3, P.white, -4.6 + i * 1.53, 0.3, 0);
    g.roof(6.4, 9.4, 1.6, 0xb8e4da, 0, 2.5, 0, Math.PI / 2, 0x9fd6c9);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) g.ico(0.3, [P.leaf, P.red, 0xf29e3d][i], -3.8 + k * 1.1, 0.8, -2 + i * 2, 1, 0.8, 1, 0, 0.3);
    g.boxB(1.2, 1.9, 0.1, P.white, 0, 0.3, 3.12);
  },
  butcher(g) {
    pBody(g, { z: -0.5, w: 5.8, d: 4.4, h: 3.2, wall: P.white, roof: P.roofR, roofH: 2.0, winFront: 2, winSide: 1, shutter: P.shutterR, timber: true, chimX: 1.8 });
    for (let i = 0; i < 7; i++) g.shed(0.8, 1.1, 0.45, 0.1, i % 2 ? P.white : P.red, -2.4 + i * 0.8, 2.3, 2.3);
    g.box(1.2, 0.7, 0.1, P.woodL, 0, 3.0, 1.75).ico(0.22, 0xc0503b, 0, 3.0, 1.83, 1.4, 0.8, 0.5, 0, 0.1);
  },
  pottery(g) {
    pBody(g, { x: -1, z: -1.2, w: 4.4, d: 3.4, h: 2.6, wall: 0xe6c9a3, roof: P.roofR2, roofH: 1.6, winFront: 1, winSide: 1, doorX: 0.9, chimney: false });
    g._add(new THREE.SphereGeometry(1.1, 8, 5, 0, TAU, 0, Math.PI / 2), 0xb5653f, g._m(2.4, 0, -1.2)); g.glowBox(0.5, 0.4, 0.2, 0xff9a3c, 2.4, 0.3, -0.1); g.smoke(2.4, 1.2, -1.2);
    g.boxB(2.6, 0.7, 0.8, P.woodL, -0.6, 0, 2.2);
    const pot = (x, z, s, c) => g.cyl(0.18 * s, 0.26 * s, 0.4 * s, 8, c, x, 0.7, z).cyl(0.14 * s, 0.18 * s, 0.14 * s, 8, c, x, 0.7 + 0.4 * s, z);
    pot(-1.6, 2.2, 1, 0xb5653f); pot(-0.9, 2.2, 1.2, 0x4f6d8a); pot(-0.2, 2.2, 0.9, 0xe8b53a); pot(0.4, 2.2, 1.1, 0xb5653f);
    for (let i = 0; i < 3; i++) g.cyl(0.3, 0.4, 0.8, 8, [0xb5653f, 0x4f6d8a, 0x5f8f4e][i], 2 + i * 0.8, 0, 2.4);
  },
  tailor(g) {
    pBody(g, { z: -0.5, w: 5.6, d: 4.6, h: 4.4, floors: 2, wall: 0xd9c8e8, roof: P.roofB, roofH: 2.0, winFront: 2, winSide: 1, shutter: 0x7b4f9e, flowers: true, chimX: 1.6 });
    g.box(1.3, 0.8, 0.1, P.woodL, 0, 2.4, 1.85);
    g.boxB(0.1, 1.5, 0.1, P.woodD, -3.2, 0, 2.2).box(0.6, 0.8, 0.3, 0x7b4f9e, -3.2, 1.4, 2.2).ico(0.15, P.woodL, -3.2, 1.95, 2.2, 1, 1, 1, 0, 0);
  },
  post_office(g) {
    pBody(g, { z: -0.6, w: 6.4, d: 4.6, h: 3.4, wall: 0xf2e1b6, roof: P.roofR, roofH: 2.2, winFront: 2, winSide: 1, shutter: P.shutterR, timber: false, base: P.stoneL });
    g.box(2.0, 0.5, 0.1, P.red, 0, 3.4, 1.72);
    g.boxB(0.5, 1.0, 0.4, P.red, 2.9, 0, 2.4).cyl(0.25, 0.25, 0.4, 8, P.red, 2.9, 1.0, 2.4).box(0.3, 0.05, 0.02, 0x222222, 2.9, 0.8, 2.61);
    g.boxB(0.08, 3.2, 0.08, P.metalD, -3.4, 0, 2.2).box(1.0, 0.6, 0.03, 0x4f6d8a, -2.88, 2.9, 2.2);
  },
  apothecary(g) {
    pBody(g, { z: -0.5, w: 5.6, d: 4.6, h: 3.6, wall: 0xcfe0c4, roof: P.roofT, roofH: 2.4, winFront: 2, winSide: 1, shutter: P.shutter, braces: true, flowers: true, chimX: -1.6 });
    g.box(1.0, 1.0, 0.1, P.woodL, 0, 3.0, 1.85).box(0.18, 0.6, 0.04, P.leafD, 0, 3.0, 1.92).box(0.6, 0.18, 0.04, P.leafD, 0, 3.0, 1.92);
    for (let i = 0; i < 6; i++) g.cyl(0.14, 0.16, 0.3, 6, [0x6fc3df, 0x9b7fe6, 0x7fd17a][i % 3], -2.2 + (i % 3) * 0.3, 0.9, 2.2 + Math.floor(i / 3) * 0.3);
    g.boxB(1.2, 0.9, 0.8, P.woodL, -1.9, 0, 2.3);
  },
  bank(g) {
    pBody(g, { z: -1.0, w: 9.0, d: 6.0, h: 5.2, wall: P.stoneL, roof: P.slate, roofH: 1.4, hip: true, timber: false, winFront: 4, winSide: 2, winBack: 3, door: false, chimney: false, shutters: false, base: P.stoneD, winH: 1.3 });
    pDoor(g, 0, 0.4, 2.04, 0, { w: 1.6, h: 2.6, col: 0x3b3530 });
    for (const x of [-3.2, -1.8, 1.8, 3.2]) g.cyl(0.3, 0.34, 4.8, 8, P.white, x, 0.4, 2.8);
    g.boxB(8.2, 0.5, 1.9, P.white, 0, 5.2, 2.8).roof(8.4, 2.2, 1.3, P.slate, 0, 5.7, 2.8, Math.PI / 2, P.white);
    g.boxB(8.4, 0.3, 2.4, P.stone, 0, 0.1, 2.8).boxB(8.8, 0.25, 0.9, P.stoneL, 0, -0.1, 4.2);
    g.cylC(0.5, 0.5, 0.1, 12, P.gold, 0, 6.3, 3.95, Math.PI / 2, 0, 0);
  },
  school(g) {
    pBody(g, { z: -0.8, w: 8.6, d: 5.6, h: 3.8, wall: 0xf1d3a8, roof: P.roofR, roofH: 2.6, winFront: 4, winSide: 2, winBack: 3, shutter: P.shutter, timber: true, chimX: 2.8 });
    g.boxB(1.4, 1.4, 1.4, 0xf1d3a8, 0, 6.3, -0.8).pyr(1.8, 1.8, 1.2, P.roofR, 0, 7.7, -0.8).cone(0.3, 0.4, 6, P.gold, 0, 6.6, -0.1);
    pFence(g, -4.2, 4.2, -1.2, 4.2); pFence(g, 1.2, 4.2, 4.2, 4.2);
    g.boxB(0.1, 1.8, 0.1, P.woodD, 3.0, 0, 3.0).boxB(0.1, 1.8, 0.1, P.woodD, 3.8, 0, 3.0).box(1.0, 0.1, 0.1, P.woodD, 3.4, 1.8, 3.0).box(0.03, 1.2, 0.03, 0x333333, 3.4, 1.2, 3.0).box(0.5, 0.08, 0.2, P.woodL, 3.4, 0.6, 3.0);
  },
  fire_station(g) {
    pBody(g, { z: -1.0, w: 7.0, d: 5.6, h: 4.4, floors: 2, wall: 0xb5413a, roof: P.slate, roofH: 1.8, winFront: 2, winSide: 2, timber: false, door: false, shutters: false, chimney: false, base: P.stoneD });
    for (const x of [-1.8, 1.8]) g.boxB(2.4, 2.4, 0.12, 0x8e2f2a, x, 0.4, 1.84).box(2.4, 0.1, 0.13, P.white, x, 1.6, 1.86);
    g.boxB(2.0, 7.0, 2.0, 0xb5413a, 3.8, 0.4, -2.2).pyr(2.4, 2.4, 1.4, P.slate, 3.8, 7.4, -2.2);
    g.box(1.8, 0.6, 0.05, P.white, 0, 3.7, 1.86);
    g.cyl(0.4, 0.4, 0.4, 8, P.gold, 3.8, 6.2, -1.1);
  },
  clinic(g) {
    pBody(g, { z: -0.8, w: 8.8, d: 6.0, h: 5.0, floors: 2, wall: P.white, roof: P.slate, roofH: 1.8, hip: true, timber: false, winFront: 4, winSide: 2, winBack: 4, shutter: P.shutterB, chimney: false, base: P.stoneL });
    g.box(1.2, 0.34, 0.08, P.red, 0, 4.4, 2.24).box(0.34, 1.2, 0.08, P.red, 0, 4.4, 2.24);
    g.shed(3.2, 1.6, 0.4, 0.1, P.shutterB, 0, 2.4, 2.9);
    for (const x of [-1.5, 1.5]) g.boxB(0.14, 2.3, 0.14, P.white, x, 0.2, 3.6);
    for (let i = 0; i < 4; i++) g.ico(0.4, P.leaf, -3.8 + i * 2.5 + (i > 1 ? 0.5 : 0), 0.3, 3.6, 1, 0.8, 1, 0, 0.3);
  },
  bathhouse(g) {
    pBody(g, { z: -2.0, w: 8.6, d: 4.4, h: 3.4, wall: P.stoneL, roof: P.roofT, roofH: 1.6, hip: true, timber: false, winFront: 3, winSide: 1, shutters: false, chimX: 2.8, base: P.stoneD });
    g._add(new THREE.SphereGeometry(1.8, 10, 5, 0, TAU, 0, Math.PI / 2), P.roofT, g._m(0, 5.0, -2.0));
    g.boxB(7.0, 0.5, 3.2, P.stone, 0, 0, 2.4).boxB(6.4, 0.08, 2.6, 0x7fd0ec, 0, 0.45, 2.4);
    for (const x of [-3.6, 3.6]) for (const z of [1.0, 3.8]) g.cyl(0.2, 0.22, 2.4, 8, P.white, x, 0, z);
    g.smoke(-1, 0.8, 2.4); g.smoke(1.5, 0.8, 2.8);
  },
  theater(g) {
    pBody(g, { z: -1.4, w: 10.4, d: 6.4, h: 6.0, wall: 0x9b2f3a, roof: P.slate, roofH: 2.6, timber: false, winFront: 0, winSide: 2, winBack: 0, door: false, chimney: false, shutters: false, base: P.stoneD });
    g.boxB(10.6, 1.2, 0.3, P.gold, 0, 6.0, 1.9).roof(10.8, 2.0, 1.8, P.slate, 0, 6.4, 2.2, 0, P.gold);
    for (const x of [-3.5, -1.2, 1.2, 3.5]) g.cyl(0.3, 0.34, 5.4, 8, P.white, x, 0.4, 3.0);
    g.boxB(4.2, 3.0, 0.12, 0x5a1f28, 0, 0.4, 1.84).box(4.4, 0.4, 0.14, P.gold, 0, 3.4, 1.9);
    g.boxB(9.6, 0.3, 2.4, P.stone, 0, 0.1, 3.0);
    for (const x of [-4.6, 4.6]) { g.box(0.8, 1.6, 0.06, P.fY, x, 3, 2.0); pLamp(g, x, 2.2, 3.4); }
  },
  barracks(g) {
    pBody(g, { z: -1.2, w: 10.0, d: 5.4, h: 3.6, wall: P.stone, roof: P.roofR2, roofH: 2.0, winFront: 4, winSide: 1, timber: false, shutters: false, chimX: 3, base: P.stoneD });
    for (let i = 0; i < 10; i++) g.boxB(0.5, 0.6, 0.5, P.stone, -4.6 + i * 1.02, 0.4 + 3.6, 1.5);
    g.boxB(10.4, 0.2, 3.2, P.cobble, 0, -0.05, 3.2);
    for (let i = 0; i < 3; i++) { const x = -3 + i * 3; g.boxB(0.1, 1.8, 0.1, P.woodD, x, 0, 3.8).cyl(0.35, 0.35, 0.12, 10, P.hay, x, 1.2, 3.8).cyl(0.2, 0.2, 0.13, 10, P.red, x, 1.2, 3.8); }
    g.box(0.07, 3.0, 0.07, P.metalD, 4.6, 5.5, 3.6).box(1.2, 0.7, 0.04, 0x3b5f9e, 5.24, 6.6, 3.6);
  },
  observatory(g) {
    pFoundation(g, 7, 7, P.stoneD);
    g.cyl(3.0, 3.3, 4.2, 12, P.stoneL, 0, 0.4, 0);
    g._add(new THREE.SphereGeometry(3.0, 12, 6, 0, TAU, 0, Math.PI / 2), 0x4f6d8a, g._m(0, 4.6, 0));
    g.box(0.8, 3.2, 0.2, 0x2a2622, 0, 6.2, 2.3, 0, -0.5, 0).cylC(0.35, 0.45, 3.4, 8, P.metal, 0, 7.3, 1.6, -0.9, 0, 0);
    pDoor(g, 0, 0.4, 3.2, 0, { w: 1.2, h: 2.2 });
    for (let i = 0; i < 6; i++) g.win(0.5, 0.8, 0.1, Math.sin(i + 0.5) * 3.18, 2.4, Math.cos(i + 0.5) * 3.18, i + 0.5);
  },
  arena(g) {
    const R = 7.4;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU, x = Math.cos(a) * R, z = Math.sin(a) * R * 0.86;
      if (Math.abs(a - Math.PI / 2) < 0.2) continue;
      g.boxB(2.1, 4.4, 1.2, i % 2 ? P.stoneL : P.stone, x, 0, z, -a + Math.PI / 2);
      g.boxB(2.1, 0.6, 1.2, P.stoneD, x, 4.4, z, -a + Math.PI / 2);
      if (i % 3 === 0) g.box(0.8, 1.2, 0.04, [P.red, 0x3b5f9e, P.fY][i % 3 === 0 ? (i / 3) % 3 : 0], x * 1.02, 3.2, z * 1.02, -a + Math.PI / 2);
    }
    for (let k = 0; k < 3; k++) for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, r = R - 1.6 - k * 1.1; if (Math.abs(a - Math.PI / 2) < 0.35) continue; g.boxB(1.9, 0.5, 1.0, P.woodL, Math.cos(a) * r, 2.6 - k * 0.9, Math.sin(a) * r * 0.86, -a + Math.PI / 2); }
    g.cyl(3.4, 3.4, 0.1, 16, 0xd9c08a, 0, 0, 0);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; g.box(0.08, 2.4, 0.08, P.metalD, Math.cos(a) * R, 5.8, Math.sin(a) * R * 0.86).box(1, 0.6, 0.04, [P.red, 0x3b5f9e, P.fY, 0x3f8f5b][i], Math.cos(a) * R + 0.52, 6.6, Math.sin(a) * R * 0.86); }
  },
  picket_fence(g) { pFence(g, -1.9, 0, 1.9, 0, P.white); },
  signpost(g) { g.boxB(0.14, 2.0, 0.14, P.woodD, 0, 0, 0).box(0.9, 0.24, 0.06, P.woodL, 0.3, 1.7, 0, 0, 0, 0.05).box(0.8, 0.22, 0.06, P.woodL, -0.25, 1.35, 0.02, 0.6, 0, -0.05); },
  hedge(g) { for (let i = 0; i < 4; i++) g.ico(0.62, i % 2 ? P.leaf : P.leafD, -1.5 + i, 0.55, 0, 1, 0.95, 0.85, 0, 0.2); g.boxB(3.8, 0.7, 0.8, P.leafD, 0, 0, 0); },
  scarecrow(g) { g.boxB(0.1, 1.9, 0.1, P.woodD, 0, 0, 0).box(1.4, 0.1, 0.1, P.woodD, 0, 1.45, 0).boxB(0.5, 0.7, 0.34, P.shutterB, 0, 0.95, 0).boxB(0.36, 0.36, 0.36, 0xe9c98f, 0, 1.7, 0).cyl(0.52, 0.52, 0.05, 8, P.hay, 0, 2.05, 0).cone(0.28, 0.28, 8, P.hay, 0, 2.08, 0); for (let i = 0; i < 5; i++) g.ico(0.2, P.hay, Math.cos(i) * 0.6, 0.15, Math.sin(i) * 0.6, 1, 0.6, 1, 0, 0.3); },
  market_cart(g) {
    g.boxB(2.2, 0.6, 1.2, P.woodL, 0, 0.55, 0).boxB(2.3, 0.1, 1.3, P.woodD, 0, 0.5, 0);
    for (const s of [-1, 1]) g.cylC(0.45, 0.45, 0.14, 10, P.woodD, -0.4, 0.45, s * 0.7, Math.PI / 2);
    g.box(0.08, 0.08, 1.6, P.woodD, 1.6, 0.6, 0.3, 0.2).box(0.08, 0.08, 1.6, P.woodD, 1.6, 0.6, -0.3, -0.2);
    for (let i = 0; i < 12; i++) g.ico(0.2, [P.fR, P.fY, P.fP, P.fW, P.fB][i % 5], -0.9 + (i % 6) * 0.36, 1.25 + Math.floor(i / 6) * 0.1, -0.25 + Math.floor(i / 6) * 0.5, 1, 0.8, 1, 0, 0.2);
  },
  flag_pole(g) { g.boxB(0.5, 0.3, 0.5, P.stone, 0, 0, 0).cyl(0.06, 0.08, 6, 6, P.metal, 0, 0.3, 0).ico(0.12, P.gold, 0, 6.4, 0, 1, 1, 1, 0, 0).box(0.04, 0.9, 1.5, P.red, 0, 5.6, 0.78).box(0.045, 0.3, 1.5, P.fY, 0, 5.6, 0.78); },
  bonfire(g) {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.dodec(0.3, P.stoneD, Math.cos(a) * 0.9, 0.1, Math.sin(a) * 0.9, 1, 0.7, 1, 0.2); }
    for (let i = 0; i < 4; i++) g.cylC(0.1, 0.12, 1.4, 5, P.woodD, 0, 0.35, 0, 0, i * 0.8, Math.PI / 2.6);
    g.glowBox(0.45, 0.6, 0.45, 0xff9a3c, 0, 0.5, 0, 0.5); g.fire(0, 0.6, 0); g.light(0, 1.0, 0);
    for (const a of [0.3, 2.4, 4.4]) g.cylC(0.25, 0.25, 1.5, 7, P.log, Math.cos(a) * 1.3, 0.25, Math.sin(a) * 1.3, 0, -a, Math.PI / 2);
  },
  garden_pond(g) {
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; g.dodec(0.32, i % 2 ? P.stone : P.stoneL, Math.cos(a) * 2.1, 0.1, Math.sin(a) * 1.6, 1.2, 0.6, 1, 0.2); }
    g._add(new THREE.CylinderGeometry(1, 1, 0.06, 14), P.water, g._m(0, 0.12, 0, 0, 0, 0, 1.95, 1, 1.45));
    for (let i = 0; i < 3; i++) g.cyl(0.3, 0.3, 0.02, 8, P.leaf, -0.8 + i * 0.7, 0.16, (i % 2) * 0.5 - 0.2).ico(0.08, 0xf7c6d9, -0.7 + i * 0.7, 0.2, (i % 2) * 0.5 - 0.15, 1, 0.7, 1, 0, 0);
    for (let i = 0; i < 5; i++) g.cyl(0.03, 0.04, 0.9, 4, 0x6f9a45, 1.6 + (i % 2) * 0.2, 0, -0.8 + i * 0.15);
  },
  gazebo(g) {
    g.cyl(2.3, 2.4, 0.4, 8, P.woodL, 0, 0, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; g.boxB(0.14, 2.4, 0.14, P.white, Math.cos(a) * 2.0, 0.4, Math.sin(a) * 2.0); }
    g.cone(2.7, 1.6, 8, P.roofG, 0, 2.8, 0).ico(0.15, P.gold, 0, 4.5, 0, 1, 1, 1, 0, 0);
    g.boxB(1.4, 0.1, 0.5, P.woodL, 0, 0.8, -1.2).boxB(1.4, 0.1, 0.5, P.woodL, 0, 0.8, 1.2);
    for (let i = 0; i < 6; i++) g.ico(0.25, [P.fP, P.leaf][i % 2], Math.cos(i) * 2.2, 0.5, Math.sin(i) * 2.2, 1, 0.8, 1, 0, 0.3);
  },
  rose_arch(g) {
    for (const x of [-1.1, 1.1]) g.boxB(0.14, 2.4, 0.14, P.white, x, 0, -0.4).boxB(0.14, 2.4, 0.14, P.white, x, 0, 0.4);
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; g.box(0.12, 0.12, 0.9, P.white, Math.cos(a) * 1.1, 2.4 + Math.sin(a) * 0.8, 0); g.ico(0.22, i % 2 ? P.fR : P.leafD, Math.cos(a) * 1.1, 2.5 + Math.sin(a) * 0.8, (i % 3 - 1) * 0.3, 1, 1, 1, 0, 0.3); }
    for (const x of [-1.1, 1.1]) for (let k = 0; k < 3; k++) g.ico(0.2, k % 2 ? P.fR : P.leaf, x, 0.6 + k * 0.6, 0.45, 1, 1, 1, 0, 0.3);
  },
  topiary(g) { g.boxB(0.9, 0.5, 0.9, 0xb5653f, 0, 0, 0).cyl(0.1, 0.12, 0.8, 5, P.woodD, 0, 0.5, 0).ico(0.5, P.leafD, 0, 1.5, 0, 1, 1, 1, 1, 0.05).ico(0.35, P.leaf, 0, 2.2, 0, 1, 1, 1, 1, 0.05).cone(0.15, 0.3, 5, P.leafD, 0, 2.5, 0); },
  obelisk(g) { g.boxB(2.2, 0.5, 2.2, P.stoneD, 0, 0, 0).boxB(1.6, 0.5, 1.6, P.stone, 0, 0.5, 0).cyl(0.4, 0.62, 6.5, 4, P.stoneL, 0, 1.0, 0, Math.PI / 4).pyr(0.8, 0.8, 0.9, P.gold, 0, 7.5, 0); },
  gravel_path(g) { g.box(4.0, 1.4, 4.0, 0x9d978b, 0, -0.64, 0); for (let i = 0; i < 12; i++) g.dodec(0.12, [0x8f8c84, 0xb8b2a3, 0x77746d][i % 3], -1.6 + (i % 4) * 1.05, 0.08, -1.4 + Math.floor(i / 4) * 1.3 + (i % 2) * 0.3, 1, 0.5, 1, 0.2); },
  plaza_tile(g) { g.box(4.0, 1.4, 4.0, P.stoneD, 0, -0.64, 0); for (let i = 0; i < 4; i++) g.boxB(1.95, 0.1, 1.95, i % 3 === 0 ? P.stoneL : P.cobble, -1 + (i % 2) * 2, 0.02, -1 + Math.floor(i / 2) * 2); },
});

Object.assign(MODEL_META, {
  chicken_coop: { work: [[0.8, 1.2, 0, 4]] },
  beehives: { work: [[0, 0, 0, 4]] },
  lumber_camp: { work: [[-2.6, 3.3, Math.PI, 1], [-0.6, 3.3, Math.PI, 1], [1.4, 3.3, Math.PI, 1]] },
  orchard: { work: [[-1.6, -1.6, 0, 4], [1.6, 1.6, 0, 4]] },
  sheep_pasture: { work: [[0, 0, 0, 5]] },
  dairy_farm: { work: [[-1, 2, 0, 4], [2.5, 2.4, 0, 4]] },
  smelter: { work: [[1.8, 0.6, Math.PI, 4]] },
  sawmill: { work: [[0, 3.0, Math.PI, 4], [2.8, 3.2, Math.PI, 4]] },
  quarry_works: { work: [[1.6, -2.2, Math.PI, 1], [-1.5, 3.4, 0, 1], [0.4, 1.8, 0, 4]] },
  fishery: { work: [[1.5, 3.8, 0, 5], [-1, 3.8, 0, 5], [3, 1.5, 0, 4]], doorBack: true },
  vineyard: { work: [[-2, -2.9, 0, 4], [2, 0.7, 0, 4]] },
  pottery: { work: [[-0.6, 3.0, Math.PI, 4]] },
  fire_station: { work: [[-1.8, 3.0, 0, 0], [1.8, 3.0, 0, 0]] },
  barracks: { work: [[-3, 3.2, 0, 1], [0, 3.2, 0, 1], [3, 3.2, 0, 1], [0, 2.2, 0, 0]] },
  lake_cabin: { doorBack: true },
});
