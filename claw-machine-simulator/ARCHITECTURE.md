# Claw Machine Simulator — Architecture & Module Contract

This file is the **contract** between all modules. Every builder reads it fully
before writing code. If something here is ambiguous, follow the most literal
reading and mention it in your report. Never rename anything defined here.

## 1. Build model

* `src/js/*.js` are concatenated **in file-name order** into ONE `<script type="module">`
  by `build.mjs`. All files share ONE top-level scope. Only `00_core.js` has an
  `import` (`import * as THREE from 'three'`). No other file may use `import`/`export`.
* `src/css/*.css` are concatenated in name order into one `<style>`.
* `src/shell.html` is the `<body>` skeleton.
* Output: `index.html` (self-contained, opens from `file://`). Three.js r160 comes from
  the jsDelivr CDN via an import map.
* `node build.mjs` builds. `node tools/check.mjs` builds, checks syntax of the bundle and
  reports duplicate top-level names. `node tools/smoke.mjs` opens the game in headless
  Chromium (three.js served from `.cache/`) and reports console errors + a screenshot.

### Top-level name rule (IMPORTANT)
Because every file shares one scope, a file may only declare at top level:
1. the public names listed for it in section 6, and
2. private helpers whose names start with the file prefix below.

| File | Owner (agent) | Prefix for private top-level names |
|---|---|---|
| `00_core.js` | Lead (integrator) | – |
| `01_config.js` | Game Designer | `_cf` |
| `02_data.js` | Save System | `_sd` |
| `03_services.js` | Gameplay – Rules | `_sv` |
| `04_scene.js` | 3D – World | `_sc` |
| `05_animals.js` | 3D – Animals | `_an` |
| `06_machine.js` | Gameplay – Claw | `_cm` |
| `07_player.js` | Gameplay – Player | `_pl` |
| `08_fx.js` | 3D – Effects | `_fx` |
| `09_audio.js` | Audio | `_au` |
| `10_ui.js` + `src/shell.html` + `src/css/00_base.css` | Frontend – HUD | `_ui` |
| `11_ui_panels.js` + `src/css/10_panels.css` | Frontend – Panels | `_up` |
| `12_main.js` | Lead (integrator) | `_mn` |

**No side effects at load time.** Top-level code only defines constants, functions,
classes and objects (exception: `UI.registerPanel(...)` calls in `11_ui_panels.js`).
DOM access, Three.js object creation, event listeners and `Bus.on` subscriptions
happen inside `init()` methods that `12_main.js` calls in the boot order (section 8).

## 2. Shared core (`00_core.js`, already written — read it)
`THREE`, `TAU`, `clamp`, `lerp`, `invLerp`, `smoothstep`, `damp`, `randRange`, `randInt`,
`pick`, `chance`, `weightedPick`, `shuffle`, `isNum`, `isStr`, `isObj`, `uid`, `deepClone`,
`Ease`, `Tweens`, `Bus`, `$`, `$$`, `h`, `esc`, `fmt`, `fmtMult`, `fmtPct`, `fmtDur`,
`U` (shared shader uniforms, `U.uTime.value` = seconds), `Game`, `ROOM`, `MACHINE_DIMS`,
`toLocalMachine`, `toWorldMachine`.

Units are metres, Y is up. The room floor is y = 0. The camera normally looks from +Z
towards −Z. A model's local "front" is +Z; `rotY` rotates it about Y
(`rotY = +π/2` makes the front face +X).

## 3. Data model — PlayerData (owned by `02_data.js`, stored in `Game.player`)

```js
{
  version: 1,
  createdAt: 0, lastSaved: 0,                 // ms timestamps
  coins: 0, gems: 0, strength: 0,             // finite numbers >= 0
  pets: [ { uid: 'p_x', id: 'bunny', variant: 'normal', locked: false, t: 0 } ],
  equipped: [ 'p_x' ],                        // uids, subset of pets, length <= equipSlots
  upgrades: { strength: 0, luck: 0, speed: 0, protection: 0, capacity: 0, special: 0,
              coinMagnet: 0, trainer: 0, gemFinder: 0, cosmic: 0 },
  worlds: { unlocked: ['starter'], current: 'starter' },
  machines: { starter: { pit: [ { pid: 'a_x', id: 'bunny', variant: 'normal' } ], plays: 0 } },
  discovered: { bunny: 3 },                   // animalId -> times caught
  indexClaimed: { starter: true },            // worldId -> index reward claimed
  shop: { equipSlots: 0, invSlots: 0, autoTrain: false },   // extra purchases
  boosts: { luck: 0, coins: 0 },              // expiry timestamps (ms), 0 = none
  training: { selected: 'foam_dumbbell', auto: false },
  daily: { last: 0, streak: 0 },
  stats: { plays: 0, wins: 0, slips: 0, misses: 0, reps: 0, coinsEarned: 0,
           bestRarity: null, playTime: 0 },
  settings: { quality: 'auto', sound: true, music: true, volume: 0.8 }
}
```
Variants: `'normal' | 'golden' | 'rainbow'`. A pet's multiplier is
`ANIMAL_BY_ID[id].mult * VARIANTS[variant].mult`.
Equip slots = `ECONOMY.baseEquipSlots + shop.equipSlots`.
Inventory slots = `ECONOMY.baseInvSlots + shop.invSlots * ECONOMY.invSlotsPerPurchase`.

## 4. Config (owned by `01_config.js`, Game Designer)

All of these are top-level `const`s with exactly these names:

```js
RARITIES        // array, ordered common..secret
RARITY_BY_ID    // { id: rarity }
VARIANTS        // { normal:{...}, golden:{...}, rainbow:{...} }
ANIMALS         // array, >= 35 animals (7+ per world)
ANIMAL_BY_ID
WORLDS          // array of 5, ordered
WORLD_BY_ID
UPGRADES        // array of 10
UPGRADE_BY_ID
TRAINING_EQUIPMENT       // array
EQUIPMENT_BY_ID
GEM_SHOP        // array
ECONOMY         // object of constants
FORMULAS        // object of pure functions (balance lives here)
```

**Rarity** `{ id, name, order, color, glow, weight, discoverGems, reveal, fx }`
* ids (fixed, in order 0..6): `common, uncommon, rare, epic, legendary, mythical, secret`
* `color`/`glow`: '#rrggbb'. `weight`: base spawn weight. `discoverGems`: gems for the
  first catch of an animal of this rarity. `reveal`: boolean — show the capsule
  opening animation on every catch of this rarity (first catches always reveal).
* `fx`: one of `'none' | 'shine' | 'sparkle' | 'aura' | 'beam' | 'orbit' | 'void'`.

**Variant** `{ id, name, mult, color, baseChance }` — ids `normal, golden, rainbow`.

**Animal**
```js
{ id: 'bunny', name: 'Bunny', world: 'starter', rarity: 'common',
  mult: 1.2,        // pet multiplier
  value: 5,         // base coins when caught
  weight: 1.0,      // grab difficulty, 0.6 .. 4 (heavier = harder to grip, slips more)
  size: 1.0,        // model scale 0.8 .. 1.35
  body: 'quad',     // 'quad' | 'biped' | 'bird' | 'round' | 'snake' | 'fish' | 'bug'
  colors: { main: '#hex', accent: '#hex', belly: '#hex', eye: '#hex' },  // eye optional
  ears: 'round',    // 'none' | 'round' | 'pointy' | 'long' | 'floppy' | 'small'
  tail: 'puff',     // 'none' | 'puff' | 'long' | 'fluffy' | 'curl' | 'fin' | 'stinger'
  pattern: 'none',  // 'none' | 'spots' | 'stripes' | 'patch'
  extras: [],       // subset of: 'horn','horns','antlers','mane','wings','beak','trunk',
                    // 'tusks','shell','fins','crown','halo','antennae','whiskers','snout',
                    // 'mask','scarf','flame','crystal','star','glasses','hat'
  desc: 'Short flavour text.' }
```
Body meanings: `quad` four-legged chibi plush (big head, egg body, 4 stubby legs);
`biped` upright chibi (2 legs, 2 arms); `bird` round body, 2 wings, beak, 2 legs;
`round` ball/blob creature (no legs or tiny feet); `snake` coiled segmented body;
`fish` fish body with fins; `bug` insect (rounded shell body, 6 tiny legs).

**World**
```js
{ id: 'starter', name: 'Starter Arcade', order: 0,
  unlock: { strength: 0, coins: 0 },   // requirement to buy access (coins are spent)
  playCost: 0,                         // coins per claw play
  rewardMult: 1, trainMult: 1,
  rarities: ['common', ...],           // rarities that can appear in this world's machine
  indexReward: 50,                     // gems when every animal of the world is discovered
  machineName: 'Classic Claw',
  newUpgrade: null,                    // upgrade id introduced by this world, or null
  desc: '...',
  theme: { decor: 'arcade',            // 'arcade' | 'jungle' | 'frozen' | 'desert' | 'space'
    floorA, floorB, wall, wallTrim, ceiling, accent, neon, fog, ambient, light,
    machineBody, machineTrim, pitFloor } }   // all '#rrggbb'
```
World ids (fixed, in order): `starter, jungle, frozen, desert, space`.

**Upgrade** `{ id, name, desc, icon, currency, baseCost, growth, maxLevel, world }`
* ids (fixed): `strength` (Claw Strength), `luck` (Luck), `speed` (Movement Speed),
  `protection` (Drop Protection), `capacity` (Machine Capacity), `special` (Special Chance)
  — all `world: 'starter'`; `coinMagnet` (jungle), `trainer` (frozen), `gemFinder` (desert),
  `cosmic` (space). `currency`: `'coins' | 'gems'`. `icon`: one emoji.

**Training equipment** `{ id, name, world, power, requires, model, color }`
* `requires`: strength needed to use it. `model`: `'dumbbell' | 'kettlebell' | 'barbell' |
  'log' | 'iceblock' | 'boulder' | 'anvil' | 'meteor'`. First item id: `foam_dumbbell`.

**Gem shop item** `{ id, kind, name, desc, icon, cost, max, duration, mult }`
* `kind`: `'equipSlot' | 'invSlots' | 'autoTrain' | 'boostLuck' | 'boostCoins'`.
* `cost`: number, or array (cost of the n-th purchase). `max`: max purchases (boosts: none).
  `duration` (seconds) and `mult` only for boosts.

**ECONOMY** (fields used by other modules — designer may add more):
`startCoins, startGems, playTime (s per play, e.g. 20), carryTime (s, slip window),
repCooldown (s), autoTrainInterval (s), autoTrainFactor, baseEquipSlots, maxEquipSlots,
baseInvSlots, invSlotsPerPurchase, evolveCount (5), pitMax (max animals in a machine),
daily: { cooldownHours, gems: [..by streak day..], coins }`.

**FORMULAS** (pure functions — signatures are fixed):
```js
upgradeCost(id, level)            // cost of buying level+1 when currently at `level`
upgradeValue(id, level)           // effect value at a level (see table)
upgradeCap(id, unlockedCount)     // highest level purchasable with N worlds unlocked
formatUpgrade(id, value)          // human text, e.g. '+35% grip', '1.2 m/s', '12 animals'
rarityWeights(worldId, luck, special)  // { rarityId: weight } for WORLD.rarities only
variantChances(special)           // { golden: p, rainbow: p }   (0..1)
animalWeight(animalId, variant)   // effective grip difficulty
gripChance({ power, weight, alignment })  // 0.02..0.98, alignment 0..1 (1 = centred)
slipRate({ protection, weight })  // slip hazard per second while carried (>= 0)
catchCoins({ animalId, variant, coinMult })  // integer >= 1
catchGemChance({ animalId, variant, gemFinder })  // probability 0..1
catchGems(animalId)               // integer gems if the gem roll succeeds
trainGain({ equipmentId, trainMult })   // strength per rep
petMultiplier(mults)              // combined multiplier from equipped pets' multipliers
strengthCoinBonus(strength)       // coin multiplier >= 1
strengthGripBonus(strength)       // additive grip power >= 0
sellValue(animalId, variant)      // coins when selling a pet
```
`upgradeValue` meaning per id (level 0 = base):
`strength` grip power (base 1.0), `luck` multiplier (1.0), `speed` claw speed m/s
(base ~0.6), `protection` slip reduction 0..0.9 (0), `capacity` animals in pit
(base 6, never above ECONOMY.pitMax), `special` multiplier (1.0), `coinMagnet` multiplier
(1.0), `trainer` multiplier (1.0), `gemFinder` additive gem chance (0), `cosmic`
multiplier on coins AND training (1.0).

## 5. Derived stats (computed by `Services.stats()`)
```js
{ gripPower   = upgradeValue('strength') + strengthGripBonus(strength),
  protection  = upgradeValue('protection'),
  clawSpeed   = upgradeValue('speed'),
  capacity    = min(upgradeValue('capacity'), ECONOMY.pitMax),
  luck        = upgradeValue('luck') * (luck boost active ? boost mult : 1),
  special     = upgradeValue('special'),
  gemFinder   = upgradeValue('gemFinder'),
  petMult     = petMultiplier(equipped pets' multipliers),
  coinMult    = petMult * coinMagnet * cosmic * strengthCoinBonus * world.rewardMult * coin boost,
  trainMult   = petMult * trainer * cosmic * world.trainMult,
  equipSlots, invSlots }
```

## 6. Public API per module

### 02_data.js — `PlayerData`, `SaveService`
```js
PlayerData.create()            // fresh default PlayerData (startCoins/startGems, starter pit empty)
PlayerData.validate(raw)       // returns a sanitized PlayerData (never throws); fixes/clamps
                               // everything; unknown ids dropped; missing fields defaulted
SaveService.KEY = 'clawsim_save_v1'; SaveService.BACKUP_KEY = 'clawsim_save_v1_bak'
SaveService.load()             // -> PlayerData (checksum check, backup fallback, validate)
SaveService.save(reason)       // writes Game.player (+ rotates backup), sets lastSaved,
                               // emits 'save:done' {time}; returns boolean
SaveService.startAutosave()    // every 15 s + Bus 'save:request' (debounced 1 s)
                               // + visibilitychange(hidden) + pagehide/beforeunload
SaveService.exportCode()       // -> string (base64, UTF-8 safe, includes checksum)
SaveService.importCode(str)    // -> { ok, err }; on ok stores it (caller reloads the page)
SaveService.reset()            // wipes both keys (caller reloads the page)
```
Storage must be wrapped in try/catch (private mode → game still runs, just unsaved).

### 03_services.js — `Remote`, `Services`
All game-state changes go through `Remote.invoke(name, args) -> { ok, err?, ... }`
(synchronous). Handlers validate everything, mutate `Game.player`, emit Bus events and
call `Bus.emit('save:request', {reason})` after important changes. UI never edits
`Game.player` directly. `err` is a short human sentence for a toast.

| name | args | result (besides ok/err) |
|---|---|---|
| `claw:start` | `{}` (current world) | `{ playId, cost }` — charges `WORLD.playCost` |
| `claw:grip` | `{ playId, pid, alignment }` | `{ success, chance, slipAfter }` |
| `claw:prize` | `{ playId, pid }` | `{ pet, animal, coins, gems, isNew, soldForCoins }` |
| `claw:end` | `{ playId, result }` result: `'miss'|'slip'|'empty'|'win'` | `{}` (stats) |
| `upgrade:buy` | `{ id }` | `{ level, cost }` |
| `pet:equip` / `pet:unequip` | `{ uid }` | `{}` |
| `pet:equipBest` / `pet:unequipAll` | `{}` | `{}` |
| `pet:lock` | `{ uid, locked }` | `{}` |
| `pet:sell` | `{ uid }` | `{ coins }` (locked/equipped pets cannot be sold) |
| `pet:sellBulk` | `{ rarity }` (sell all unlocked, unequipped pets of that rarity) | `{ coins, count }` |
| `pet:evolve` | `{ uid }` (needs ECONOMY.evolveCount same id+variant, unlocked) | `{ pet }` |
| `train:select` | `{ id }` | `{}` |
| `train:rep` | `{ auto }` | `{ gain }` (cooldown ECONOMY.repCooldown, uses selected equipment) |
| `train:auto` | `{ on }` | `{}` (needs shop.autoTrain) |
| `world:unlock` | `{ id }` | `{}` (needs strength, spends coins, must unlock in order) |
| `world:travel` | `{ id }` | `{}` (must be unlocked) |
| `shop:buy` | `{ id }` | `{}` |
| `index:claim` | `{ worldId }` | `{ gems }` |
| `daily:claim` | `{}` | `{ gems, coins }` |
| `settings:set` | `{ key, value }` | `{}` |

`claw:grip` details: chance = `gripChance({ power: stats.gripPower, weight:
animalWeight(id, variant), alignment })`. Roll. If success: draw slip time from
`slipRate` (exponential); if it exceeds `ECONOMY.carryTime` → `slipAfter = null` (never
slips) else `slipAfter = max(0.35, t)`. If failure: `success:false`,
`slipAfter = randRange(0.15, 0.8)` (claw lifts it a bit, then it falls).
`claw:prize` accepts any pid that is in the current world's pit (playId optional);
removes it, adds the pet (if inventory is full the pet is auto-sold: `soldForCoins`),
grants coins (`catchCoins` with `stats.coinMult`) and maybe gems, updates `discovered`,
first-discovery gems, emits events, then calls `Services.ensurePit(world)`.

```js
Services.stats()                   // section 5 (cheap; may cache per frame)
Services.petMultOf(pet)            // number
Services.petsSorted(mode)          // 'mult' | 'rarity' | 'new' -> array of pets (best first)
Services.ensurePit(worldId)        // fill pit up to capacity; emits 'pit:spawn' per new entry
Services.previewGrip(pid, alignment) // chance without rolling (for HUD)
Services.canUnlockWorld(id)        // { ok, needStrength, needCoins, prevUnlocked }
Services.evolveInfo(uid)           // { can, have, need, next: 'golden'|'rainbow'|null }
Services.nextGoal()                // { text, progress (0..1) } e.g. next world requirement
Services.dailyInfo()               // { ready, secondsLeft, streak, gems, coins }
Services.tick(dt)                  // auto-train, playtime stat, boost expiry
Services.debugGrant({ coins, gems, strength })  // only used by QA / ?debug
```

### Bus events (payloads are fixed)
| event | payload | emitted by |
|---|---|---|
| `currency:changed` | `{ coins, gems, strength }` | services |
| `reward` | `{ coins, gems, strength, source }` source: `'catch'|'train'|'sell'|'daily'|'index'|'shop'|'discover'` | services |
| `pet:added` | `{ pet, animal, isNew }` | services |
| `pets:changed` | `{}` (any inventory / equip / lock change) | services |
| `equip:changed` | `{ equipped }` | services |
| `upgrade:bought` | `{ id, level }` | services |
| `world:unlocked` | `{ id }` | services |
| `world:changed` | `{ id }` (data switched; main rebuilds) | services |
| `world:entered` | `{ id }` (3D world rebuilt and ready) | main |
| `pit:spawn` | `{ worldId, entry }` | services |
| `pit:remove` | `{ worldId, pid }` | services |
| `reveal` | `{ pet, animal, isNew }` (rarity.reveal, variant ≠ normal, or isNew) | services |
| `claw:state` | `{ state }` | machine |
| `claw:result` | `{ type, entry }` type `'win'|'miss'|'slip'|'empty'` | machine |
| `train:rep` | `{ gain, auto }` | services |
| `shop:bought` | `{ id }` | services |
| `index:claimed` | `{ worldId, gems }` | services |
| `daily:claimed` | `{ gems, coins }` | services |
| `settings:changed` | `{ key, value }` | services |
| `toast` | `{ text, kind }` kind `'info'|'good'|'bad'|'rare'` | anyone |
| `save:request` | `{ reason }` | anyone |
| `save:done` | `{ time }` | save |
| `mode:changed` | `{ mode }` `'walk'|'machine'|'train'` | main |
| `interact:prompt` | `{ key, label }` (key null = none) | player (Interact) |
| `station:use` | `{ key }` `'machine'|'training'|'upgrades'|'pets'|'portal'` | player (Interact) |
| `input:action` | `{ name }` see Input | input / UI |

### 04_scene.js — `Scene3D`
```js
Scene3D.renderer, Scene3D.scene, Scene3D.camera   // PerspectiveCamera fov 55
Scene3D.init(canvas)              // renderer (antialias unless low), scene, camera, lights, resize
Scene3D.setQuality(q)             // 'auto'|'low'|'medium'|'high'; listens to 'settings:changed'
Scene3D.quality                   // resolved 'low'|'medium'|'high'
Scene3D.preset                    // { pixelRatio, shadows, particles (0..1), decor (0..1) }
Scene3D.buildWorld(worldId)       // dispose previous room, build themed room + stations + decor
Scene3D.refreshPetDisplay()       // shelves at ROOM.stations.pets show the best pets (self-subscribes to 'pets:changed')
Scene3D.colliders                 // [{ type:'circle', x, z, r } | { type:'box', minX, maxX, minZ, maxZ }]
                                  // (stations incl. machine footprint; room walls are implicit: ROOM.halfX/halfZ)
Scene3D.buildEquipmentModel(model, color)  // THREE.Group, ~0.6 m, for training racks and the player's hands
Scene3D.toScreen(vec3)            // { x, y, visible } in CSS pixels
Scene3D.update(dt)                // decor animation, auto-quality watchdog
Scene3D.render()
```
The scene does NOT build the claw machine (06 does) — only the space for it.

### 05_animals.js — `AnimalFactory`, `PetViewer`
```js
AnimalFactory.build(animalId, variant = 'normal', opts = {})  // -> THREE.Group, origin at the
   // bottom centre, ~2*radius tall at scale 1; opts.fx (default true) adds rarity effects;
   // group.userData = { animalId, variant, radius, height }
AnimalFactory.radiusOf(animalId)    // collision radius in metres at scale 1 (0.17 .. 0.30)
AnimalFactory.animate(group, t, state, dt)  // state 'idle'|'nervous'|'held'|'fall'|'follow'|'happy'
AnimalFactory.thumbnail(animalId, variant)  // -> dataURL (cached), transparent background
AnimalFactory.dispose(group)
PetViewer.mount(el, animalId, variant)  // spinning 3D model in a canvas filling `el`
PetViewer.unmount()                     // only one viewer active at a time
```
Low draw calls: at most 3 meshes per animal (+1 optional FX object), shared materials,
merged vertex-coloured geometry. Golden = metallic gold look, rainbow = animated hue
(use `U.uTime`). Rarity FX per `RARITY.fx`.

### 06_machine.js — `ClawMachine`, `Machines`
```js
Machines.active                       // current ClawMachine or null
Machines.create(worldId)              // disposes previous, builds new at ROOM.stations.machine
machine.state     // 'idle'|'aim'|'drop'|'close'|'lift'|'return'|'release'|'settle'
machine.timeLeft  // seconds left to aim
machine.syncPit() // build bodies for Game.player.machines[worldId].pit (pre-settled pile)
machine.applyUpgradeVisuals()
machine.canStart()                    // { ok, cost, err }
machine.startPlay()                   // Remote 'claw:start' -> state 'aim'
machine.setMoveInput(x, y)            // -1..1, x+ = right, y+ = away from the player (−Z)
machine.aimAtScreen(ndcX, ndcY)       // mouse/touch aiming (raycast with Scene3D.camera)
machine.drop()
machine.isBusy()                      // state !== 'idle'
machine.getHover()                    // { entry, animal, chance, alignment } | null
machine.getCameraView()               // { pos: Vector3, target: Vector3 } world space
machine.getChuteWorldPos()            // Vector3
machine.update(dt)
machine.dispose()
```
Physics, animals reacting, slipping and delivery through the chute are internal.

### 07_player.js — `Input`, `Player`, `CameraRig`, `Interact`
```js
Input.init(canvas)       // keyboard + pointer listeners
Input.getMove()          // { x, y } merged keyboard + Input.virtual; zero while UI.isBlocking()
Input.virtual            // { x: 0, y: 0 } written by the UI joystick / d-pad
// keyboard -> Bus 'input:action' { name }:
//   E -> 'interact'; Space/Enter -> 'primary'; Esc -> 'closePanel' if UI.isBlocking() else 'back';
//   I -> 'panel:pets'; U -> 'panel:upgrades'; G -> 'panel:worlds'; X -> 'panel:index';
//   B -> 'panel:shop'; O -> 'panel:settings'
// pointer: walk mode drag = rotate camera, wheel/pinch = zoom;
//          machine mode press/drag on canvas = Machines.active.aimAtScreen(ndc)
Player.init(), Player.group, Player.pos (Vector3), Player.update(dt, move)
Player.setPosition(x, z, rotY), Player.getWorldPos(out?), Player.getHeadWorldPos(out?)
Player.setTraining(on)   // walk to/face the training spot, hold the selected equipment
Player.playRep()         // one lift animation (also self-subscribes to 'train:rep')
Player.refreshPets()     // rebuild follower pets (self-subscribes to 'equip:changed')
CameraRig.init(), CameraRig.setMode('follow'|'machine'|'train'), CameraRig.update(dt)
Interact.init(), Interact.current, Interact.update(), Interact.use()
```

### 08_fx.js — `FX`
```js
FX.init(); FX.update(dt)
FX.burst(pos, color, count = 24, opts)   // 3D particles (one pooled THREE.Points)
FX.sparkle(pos, color, count = 12)
FX.ring(pos, color)                       // expanding ring (upgrade effect)
FX.confetti(intensity = 1)                // screen confetti
FX.floatText(pos, text, color)            // world-anchored rising DOM text
FX.flyToHud(kind, from, amount)           // kind 'coins'|'gems'|'strength'; from Vector3 or {x,y}
FX.flash(color, strength = 0.6)
FX.shake(amount); FX.shakeOffset          // Vector3 that CameraRig adds every frame
```
FX self-subscribes to `reward`, `claw:result`, `upgrade:bought`, `world:unlocked`,
`train:rep`, `pet:added`.

### 09_audio.js — `Sfx`
```js
Sfx.init()                // unlock AudioContext on first pointer/key gesture
Sfx.play(name)            // names: click open close coin gem strength play move drop grab slip
                          // miss win rare epic legendary mythical secret reveal capsule upgrade
                          // train error unlock travel equip sell evolve tick
Sfx.motor(on)             // claw motor hum loop while the claw moves
Sfx.startMusic(worldId)   // soft generative loop per world
Sfx.setSound(b), Sfx.setMusic(b), Sfx.setVolume(v)
```
All sounds are synthesised with WebAudio (no files). Sfx self-subscribes to Bus events
(and `settings:changed`).

### 10_ui.js — `UI` (HUD, frame, overlays)
```js
UI.init(); UI.update(dt); UI.isBlocking()
UI.registerPanel(id, { title, icon, render(bodyEl), onOpen?, onClose?, wide? })
UI.openPanel(id), UI.closePanel(), UI.refreshPanel(), UI.currentPanel
UI.toast(text, kind = 'info'), UI.showReveal(pet), UI.confirm(text, onYes)
```
Fixed DOM ids: `#game-canvas`, `#ui`, `#loading`, `#hud-coins`, `#hud-gems`,
`#hud-strength` (these three hold the number text; FX flies icons to them).
Panel ids registered by `11_ui_panels.js`: `pets`, `upgrades`, `worlds`, `index`, `shop`,
`settings`.

Shared CSS (defined in `00_base.css`, used by panels): variables
`--c-common … --c-secret`, `--coin`, `--gem`, `--str`, fonts `--font-d`, `--font-b`;
classes `.btn` + `.btn-green|.btn-blue|.btn-yellow|.btn-red|.btn-purple|.btn-gray`,
`.btn-sm`, `.btn-lg`, `.btn[disabled]`, `.card`, `.pill`, `.tag`, `.grid`, `.row`,
`.col`, `.muted`, `.bar` (progress bar container) with child `.bar > i` (fill, width %),
`.r-<rarityId>` (sets `--rc` to that rarity colour).

### 11_ui_panels.js — panel contents only (registers the 6 panels).

## 7. Interaction & modes (implemented by `12_main.js`)
* `walk`: `Player.update(dt, Input.getMove())`, `CameraRig 'follow'`, `Interact.update()`.
* `station:use` → `machine`: mode `machine`, CameraRig `'machine'`; `training`: mode
  `train`, `Player.setTraining(true)`; `upgrades`/`pets`/`portal`: open panel
  `upgrades` / `pets` / `worlds`.
* `primary` in machine mode: idle → `startPlay()`, aim → `drop()`; in train mode →
  `Remote.invoke('train:rep', {})`. `interact` in walk mode → `Interact.use()`.
* `back`: machine (only when not busy) / train → walk.
* In machine mode `Machines.active.setMoveInput(Input.getMove())` every frame.

## 8. Boot order (`12_main.js`)
`SaveService.load()` → `Game.player` → `Scene3D.init` → `Sfx.init` → `FX.init` →
`UI.init` → `Input.init` → `Player.init` → `CameraRig.init` → `Interact.init` →
`enterWorld(current)` (`Scene3D.buildWorld`, `Machines.create`, `Services.ensurePit`,
`machine.syncPit`, player to `ROOM.spawn`, emit `world:entered`) →
`SaveService.startAutosave()` → hide `#loading` → render loop:
`Tweens.update → Services.tick → mode logic → Machines.active.update → Player.update →
CameraRig.update → Scene3D.update → FX.update → UI.update → Scene3D.render`.

`?debug` in the URL exposes `window.CMS` with every module object.

## 9. Style
Colourful, modern 3D cartoon; Roblox-simulator style UI (chunky rounded buttons with dark
outlines and bottom shadow, bold rounded font, big readable numbers, gradients).
Desktop and mobile (touch, ≥ 44 px targets, safe areas, portrait + landscape).
English in-game text.
