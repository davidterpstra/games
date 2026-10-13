/* =====================================================================
   World layout: the hand-designed map of "Wendmoor", a fictional corner
   of the English countryside. 2.4 km x 2.4 km. Everything procedural
   (terrain, props, villages) is placed around this layout so the world
   reads as a coherent place instead of random scatter.
   ===================================================================== */
const WORLD = 2400, HALF = WORLD / 2;

const PLACES = [
  { id: 'fest', name: 'Solstice Festival', x: 150, z: 350, r: 120, kind: 'hub' },
  { id: 'ash', name: 'Ashcombe', x: -700, z: 380, r: 150, kind: 'village', houses: 34 },
  { id: 'ket', name: 'Kettlewick', x: 620, z: -560, r: 140, kind: 'village', houses: 30 },
  { id: 'thn', name: 'Thornbury', x: -250, z: -330, r: 95, kind: 'village', houses: 13 },
  { id: 'mere', name: 'Mere Water', x: -560, z: -260, r: 260, kind: 'lake' },
  { id: 'fells', name: 'Grimstone Fells', x: 20, z: -960, r: 380, kind: 'mountain' },
  { id: 'hollin', name: 'Hollin Wood', x: 930, z: 60, r: 320, kind: 'forest' },
  { id: 'harrow', name: 'Harrowfield Farms', x: 40, z: 900, r: 430, kind: 'farm' },
  { id: 'moor', name: 'Brackenmoor', x: 120, z: -260, r: 300, kind: 'moor' },
  { id: 'wend', name: 'River Wend', x: 560, z: 150, r: 120, kind: 'river' },
  { id: 'west', name: 'Westerley Woods', x: -950, z: 750, r: 300, kind: 'forest' },
];

// Festival plaza: a flat paved pad.
const PLAZA = { x: 150, z: 350, r: 80 };

const NODES = {
  FJ: [160, 520], FX: [330, 545], FS: [150, 429], FN: [150, 271], FW: [71, 350], FE: [229, 350],
  NE: [900, 300], KT: [620, -560], K2: [360, -640], PS: [230, -700], PW: [-460, -680],
  AS: [-700, 380], SO: [-120, 800], TH: [-250, -330], MO: [40, -20], ML: [-830, -60],
};

/* Road types: hw = half width of the driving surface. */
const ROAD_TYPES = {
  A: { hw: 5.6, surf: S_ASPHALT, lines: 'center', name: 'A-road', grade: 0.09 },
  B: { hw: 4.3, surf: S_ASPHALT, lines: 'edge', name: 'Lane', grade: 0.11 },
  M: { hw: 4.4, surf: S_ASPHALT, lines: 'center', name: 'Mountain pass', grade: 0.13, rails: true },
  D: { hw: 3.6, surf: S_GRAVEL, lines: 'none', name: 'Track', grade: 0.16 },
};

const ROADS = [
  { id: 'A9', name: 'Festival Approach', t: 'A', a: 'FS', b: 'FJ', pts: [] },
  { id: 'A1a', name: 'Festival Road', t: 'A', a: 'FJ', b: 'FX', pts: [[245, 540]] },
  { id: 'A1b', name: 'Festival Road', t: 'A', a: 'FX', b: 'NE', pts: [[480, 560], [620, 555], [720, 520], [820, 420]] },
  { id: 'A2', name: 'Hollin Way', t: 'A', a: 'NE', b: 'KT', pts: [[960, 140], [975, -60], [930, -260], [800, -440]] },
  { id: 'A3', name: 'Kettlewick Road', t: 'A', a: 'KT', b: 'K2', pts: [[530, -585], [440, -612]] },
  { id: 'A4', name: 'Kettlewick Road', t: 'A', a: 'K2', b: 'PS', pts: [[300, -668]] },
  { id: 'A5', name: 'Fellside Road', t: 'A', a: 'PS', b: 'PW', pts: [[120, -735], [0, -768], [-110, -775], [-230, -755], [-350, -722]], tunnel: [[-45, -772, 70]] },
  { id: 'A6a', name: 'Mere Road', t: 'A', a: 'PW', b: 'ML', pts: [[-600, -612], [-740, -480], [-820, -280]] },
  { id: 'A6b', name: 'Mere Road', t: 'A', a: 'ML', b: 'AS', pts: [[-800, 160]] },
  { id: 'A7', name: 'Harrow Road', t: 'A', a: 'AS', b: 'SO', pts: [[-640, 560], [-500, 690], [-320, 780]] },
  { id: 'A8', name: 'Harrow Road', t: 'A', a: 'SO', b: 'FJ', pts: [[0, 742], [100, 640]] },
  {
    id: 'M1', name: 'Grimstone Pass', t: 'M', a: 'PS', b: 'PW',
    pts: [[270, -742], [312, -790], [338, -813], [350, -834], [338, -853], [308, -860], [240, -863], [182, -869], [156, -882], [149, -901], [163, -919],
      [196, -926], [270, -936], [310, -946], [326, -963], [318, -984], [290, -994], [200, -1006], [110, -1030], [30, -1050], [-60, -1053],
      [-150, -1030], [-240, -1000], [-284, -986], [-304, -966], [-296, -946], [-266, -936], [-190, -929], [-140, -921], [-118, -903],
      [-128, -883], [-160, -873], [-260, -860], [-350, -822], [-420, -762]],
  },
  { id: 'B1', name: 'Moor Road', t: 'B', a: 'FN', b: 'MO', pts: [[142, 180], [96, 80]] },
  { id: 'B2', name: 'Moor Road', t: 'B', a: 'MO', b: 'TH', pts: [[-60, -128], [-160, -238]] },
  { id: 'B3', name: 'Thornbury Lane', t: 'B', a: 'TH', b: 'PW', pts: [[-300, -450], [-372, -580]] },
  { id: 'B4', name: 'Ashcombe Lane', t: 'B', a: 'AS', b: 'FW', pts: [[-560, 330], [-400, 272], [-220, 300], [-60, 342]] },
  { id: 'B5', name: 'Kettle Lane', t: 'B', a: 'FE', b: 'KT', pts: [[320, 300], [430, 200], [545, 100], [640, -40], [700, -250], [690, -420]] },
  { id: 'D1', name: 'Brackenmoor Trail', t: 'D', a: 'MO', b: 'K2', pts: [[160, -130], [262, -262], [318, -420], [338, -545]] },
  { id: 'D2', name: 'Harrowfield Track', t: 'D', a: 'SO', b: 'FX', pts: [[-170, 950], [0, 1045], [220, 1022], [380, 900], [420, 760], [370, 630]] },
  { id: 'D3', name: 'Mere Shore Track', t: 'D', a: 'TH', b: 'ML', pts: [[-320, -205], [-450, -82], [-620, -48], [-760, -48]] },
];

/* River Wend flows north -> south. Control points, half width grows downstream. */
const RIVER = {
  pts: [[250, -1180], [380, -900], [422, -620], [470, -380], [560, -150], [542, 150], [612, 450], [650, 750], [600, 1000], [560, 1195]],
  hw0: 7, hw1: 13,
};
const LAKE = { x: -560, z: -255, rx: 225, rz: 140, rot: 0.25, level: 14 };

/* ---------- events ----------
   route: list of node ids; consecutive nodes are joined by the road between
   them, or by a smooth connector across the festival plaza / open country.
   via: optional explicit polyline (off-road legs). */
const EVENTS = [
  {
    id: 'loop', type: 'circuit', name: 'Solstice Loop', laps: 2, ai: 5, reward: 9000,
    desc: 'The festival’s signature circuit: Festival Road, the woods of Hollin Way and back over Kettle Lane.',
    route: ['FS', 'FJ', 'FX', 'NE', 'KT', 'FE', 'FS'], start: 30,
  },
  {
    id: 'ashring', type: 'circuit', name: 'Ashcombe Ring', laps: 2, ai: 5, reward: 7500,
    desc: 'Narrow hedge-lined lanes through Ashcombe village and the open Harrow Road.',
    route: ['FW', 'AS', 'SO', 'FJ', 'FS', 'FW'], start: 25,
  },
  {
    id: 'westrun', type: 'race', name: 'Westcountry Run', laps: 1, ai: 5, reward: 8000,
    desc: 'Point-to-point road race from Kettlewick, through the Fellside tunnel and along Mere Water to Ashcombe.',
    route: ['KT', 'K2', 'PS', 'PW', 'ML', 'AS'], start: 25,
  },
  {
    id: 'pass', type: 'sprint', name: 'Grimstone Pass Sprint', laps: 1, ai: 4, reward: 8500, roads: ['M1'],
    desc: 'Flat-out sprint over the fells: tight hairpins, guard rails and a long drop on the way down.',
    route: ['PS', 'PW'], start: 20,
  },
  {
    id: 'scramble', type: 'offroad', name: 'Brackenmoor Scramble', laps: 1, ai: 4, reward: 7000,
    desc: 'Off-road: the gravel trail across the moor, then cross-country through the heather back to the start.',
    route: ['MO', 'K2', 'MO'], via: { 'K2>MO': [[300, -600], [210, -470], [120, -360], [70, -220], [56, -110]] }, start: 20,
  },
  {
    id: 'harrow', type: 'offroad', name: 'Harrowfield Rally', laps: 2, ai: 4, reward: 7000,
    desc: 'Mixed-surface rally loop: farm tracks between the fields, then tarmac back past the festival.',
    route: ['SO', 'FX', 'FJ', 'SO'], start: 20,
  },
  {
    id: 'loopR', type: 'circuit', name: 'Solstice Loop Reverse', laps: 2, ai: 5, reward: 9500,
    desc: 'The signature circuit run backwards: Kettle Lane first, then the long sweepers of Hollin Way.',
    route: ['FE', 'KT', 'NE', 'FX', 'FJ', 'FS', 'FE'], start: 35,
  },
  {
    id: 'lakeside', type: 'race', name: 'Lakeside Dash', laps: 1, ai: 5, reward: 7500,
    desc: 'Gravel along the shore of Mere Water, then tarmac through Ashcombe to the festival.',
    route: ['TH', 'ML', 'AS', 'FW'], start: 20,
  },
  {
    id: 'moorsprint', type: 'sprint', name: 'Brackenmoor Sprint', laps: 1, ai: 4, reward: 6500,
    desc: 'Narrow moorland lanes from the festival through Thornbury to the foot of the fells.',
    route: ['FN', 'MO', 'TH', 'PW'], start: 25,
  },
  // PR stunts — always live in free roam, just drive through them.
  { id: 'trap1', type: 'trap', name: 'Hollin Straight Speed Trap', road: 'A2', at: [972, -40], stars: [170, 215, 255], desc: 'Hit the camera as fast as you can.' },
  { id: 'trap2', type: 'trap', name: 'Festival Road Speed Trap', road: 'A1b', at: [560, 560], stars: [150, 190, 230], desc: 'Fly over the Wend bridge.' },
  { id: 'zone1', type: 'zone', name: 'Mere Shore Speed Zone', road: 'A6a', from: [-760, -460], to: [-822, -260], stars: [140, 175, 210], desc: 'Keep your average speed high along the lake.' },
  { id: 'drift1', type: 'drift', name: 'Fells Hairpins Drift Zone', road: 'M1', from: [-150, -1030], to: [-260, -860], stars: [12000, 30000, 60000], desc: 'Link drifts through the western hairpins.' },
  { id: 'drift2', type: 'drift', name: 'Kettle Lane Drift Zone', road: 'B5', from: [430, 200], to: [640, -40], stars: [8000, 20000, 40000], desc: 'Sweeping bends over the Wend bridge.' },
];

const FAST_TRAVEL = [
  { name: 'Solstice Festival', x: 150, z: 470, h: Math.PI },
  { name: 'Ashcombe', x: -690, z: 420, h: Math.PI },
  { name: 'Kettlewick', x: 600, z: -560, h: -Math.PI / 2 },
  { name: 'Thornbury', x: -250, z: -330, h: 0.6 },
  { name: 'Grimstone Pass', x: 240, z: -720, h: Math.PI * 0.8 },
  { name: 'Mere Water', x: -823, z: -150, h: Math.PI },
];
