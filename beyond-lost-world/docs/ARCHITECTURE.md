# BEYOND – THE LOST WORLD · Architecture & module contracts

This file is the contract between all modules. If code and this file disagree, fix the code or update this file deliberately.

## Tech
- Plain ES modules in the browser, no bundler. `three` and `three/addons/*` resolve through the import map in `index.html` to `vendor/three/` (Three.js r170). Available addons: `three/addons/utils/BufferGeometryUtils.js`, `three/addons/math/SimplexNoise.js`, `three/addons/math/ImprovedNoise.js`.
- **No network at runtime**: no CDNs, no web fonts, no external textures/models. All textures are generated procedurally (canvas / DataTexture), all audio is synthesised with WebAudio.
- Run: `npm start` (→ `server.mjs`, http://localhost:5173). URL flags: `?debug` exposes `window.BEYOND`, `?autostart` skips the main menu and starts a new game, `?quality=low|medium|high` forces a preset, `?nosave` disables loading/saving.
- Language of all player-facing text: **Dutch**.

## Folder ownership
| Folder | Owner | Contents |
| --- | --- | --- |
| `src/main.js`, `src/core/*`, `src/world/World.js`, `src/world/layout.js` | lead | boot, game loop, state machine, glue |
| `src/world/nature/*` | World agent A (terrain & nature) | terrain, water, river, waterfall, vegetation, rocks, procedural textures |
| `src/world/structures/*` | World agent B (architecture) | research station, village, temple, bunker, cave, bridges, beacons, props, anchors |
| `src/player/*` | Player agent | input, pointer lock, first-person controller, collision, touch controls |
| `src/gameplay/*` | Gameplay agent | items, inventory, crafting, interaction, pickups, missions, puzzles, documents, locations, checkpoints, save |
| `src/environment/*` | Environment agent | lights, shadows, sky, fog, day/night, weather, torch light & view model, audio |
| `src/ui/*` (incl. `src/ui/ui.css`) | UI agent | loading, main menu, pause, settings, HUD, inventory/crafting/missions/documents/map screens, document reader, toasts |
| `src/perf/*` | Optimization agent | adaptive quality, profiler overlay data |
| `tests/*` | QA agent | automated browser tests |
| `dev/*` | everyone (prefix files with your area, e.g. `dev/nature-preview.html`) | manual preview pages |

Never edit a file you do not own. If you need something from another module, use the contract below; if the contract is missing something, report it.

## Shared modules (read-only for agents)
- `src/core/EventBus.js` – `bus.on(event, fn) → unsubscribe`, `bus.once`, `bus.off`, `bus.emit(event, payload)`.
- `src/core/Settings.js` – `Settings.get(key)`, `Settings.set(key, value)`, `Settings.all()`, `Settings.reset()`; keys in `DEFAULT_SETTINGS`. Emits `settings:changed {key, value, settings}`.
- `src/core/quality.js` – `QUALITY_PRESETS[name]` (`pixelRatio, shadowMapSize, shadowDistance, viewDistance, terrainSegments, grassDensity, vegetationDensity, maxPointLights, antialias`), `resolveQuality(setting)`, `isMobileDevice()`.
- `src/world/layout.js` – world layout (pads, river, paths, locations, waterfall, lake), geometry helpers and `mulberry32` PRNG. **All randomness in world generation must be seeded** (deterministic world → multiplayer-ready).

## Coordinate conventions
Metres, Y up, north = −Z. Terrain spans −320..320; the player is confined to `PLAY_BOUNDS` (−268..268). Rotations around Y use `Object3D.rotation.y`. A "forward" vector for rotation.y = θ is `(−sin θ, 0, −cos θ)` (Three.js camera convention).

## Collider format (world → player)
Static colliders are plain objects in one array:
```js
{ id?: string, type: 'circle', x, z, r, yMin, yMax, enabled: true, surface?: 'wood'|'stone'|'metal'|'dirt' }
{ id?: string, type: 'box',    x, z, hx, hz, rot, yMin, yMax, enabled: true, surface?: ... } // oriented box in XZ, rot = rotation.y
```
- A box/circle is a solid volume between `yMin` and `yMax`. The player walks on top of it if its feet are above `yMax − stepHeight` (stepHeight = 0.45 m); otherwise it blocks horizontally. Floors, stair steps and platforms are boxes. Ceilings are boxes the player bumps its head on.
- Toggleable colliders (doors) have an `id`; `world.setColliderEnabled(id, bool)` flips `enabled`.
- Ground height = max(terrain height, top of any box/circle under the player that the player is standing on).
- Deep water: where `world.getWaterSurfaceAt(x,z) − world.getHeightAt(x,z) > 1.1` the player cannot walk (treated like a wall, slides along).

## World API (`src/world/World.js`, composed by the lead)
```js
const world = await createWorld({ scene, renderer, quality: 'low'|'medium'|'high', onProgress(p0to1, label) });
world.getHeightAt(x, z) → number           // terrain height
world.getNormalAt(x, z) → THREE.Vector3     // terrain normal
world.getSurfaceAt(x, z) → 'grass'|'dirt'|'stone'|'sand'|'water'
world.getWaterSurfaceAt(x, z) → number|null // water surface y if (x,z) is in lake/river/pool, else null
world.colliders → Collider[]
world.setColliderEnabled(id, enabled)
world.anchors → Map<string, { id, position: THREE.Vector3, rotationY: number, object?: THREE.Object3D }>
world.resourceSpots → Array<{ id: string, type: 'wood'|'stone'|'fiber'|'resin'|'scrap'|'cloth', position: THREE.Vector3 }>
world.interiorZones → Array<{ id, x, z, hx, hz, rot, yMin, yMax, darkness: 0..1 }>  // oriented boxes
world.locations → LOCATIONS from layout.js (with `y` filled in)
world.bounds → PLAY_BOUNDS
world.setPowered(group: 'bunker', on: boolean)   // turns the bunker's lights/emissives on or off
world.setQuality(name)                          // live change of vegetation density / LOD distances
world.setWind(strength)                         // foliage/grass sway multiplier (main drives it from env.wind)
world.interiorAt(position) → zone|null          // interior zone containing a point
world.update(dt, elapsed, cameraPosition)       // wind, water animation, LOD, culling
world.terrainMaterial                           // shared terrain material (structures may reuse it for earth mounds)
```
`World.js` merges what the two world agents return:
- `src/world/nature/index.js` → `export async function createNature({ scene, renderer, quality, onProgress })` returns
  `{ terrain: { getHeightAt, getNormalAt, getSurfaceAt, getWaterSurfaceAt, material }, colliders, resourceSpots, update(dt, elapsed, camPos), setQuality(name) }`.
  Nature is created **first**; structures receive the terrain API.
- `src/world/structures/index.js` → `export async function createStructures({ scene, renderer, quality, terrain, onProgress })` returns
  `{ colliders, anchors: Map, interiorZones, resourceSpots, setPowered(group, on), update(dt, elapsed, camPos), setQuality(name) }`.

### Required anchors (structures must provide all of them)
Dynamic objects are real meshes/groups the gameplay code animates. Door objects carry `userData.openOffset` (THREE.Vector3, local translation that opens the door) and `userData.colliderId` (id of the collider that blocks the doorway).

| id | object? | meaning |
| --- | --- | --- |
| `player.start` | – | spawn inside the research station (position = feet), rotationY = initial view direction |
| `station.logbook` | – | top of the desk where Dr. Vos's logbook lies |
| `station.cloth` | – | spot for the cloth item (inside the station) |
| `station.beacon`, `village.beacon`, `waterfall.beacon`, `temple.beacon`, `bunker.beacon` | yes | emergency radio beacon prop (checkpoint). Has a child named `lamp` whose material is unique to it (gameplay sets `emissiveIntensity` 0 → 3) |
| `village.elderDoor` | yes | boards nailed across the elder's house doorway. `userData.colliderId` blocks the doorway; gameplay hides the boards when pried open with the crowbar |
| `village.journal` | – | table inside the elder's house (journal note) |
| `village.scrap1`, `village.scrap2` | – | item spots for scrap metal in the village |
| `note.forest_camp`, `note.village_house`, `note.waterfall`, `note.cave` | – | optional lore notes |
| `cave.sundisc` | – | pedestal top deep in the dark crystal cave where the Sun Disc lies |
| `temple.altar` | yes | altar in front of the gate; child named `socket` marks where the sun disc is placed |
| `temple.pillar1`, `temple.pillar2`, `temple.pillar3` | yes | rotatable glyph pillars (see below) |
| `temple.gate` | yes | stone gate slab, door object (openOffset + colliderId) |
| `temple.keycard` | – | inner sanctum, where the keycard lies next to Dr. Vos's recorder |
| `temple.recording` | – | Dr. Vos's last notes, inner sanctum |
| `bunker.door` | yes | blast door, door object |
| `bunker.reader` | yes | keycard reader next to the blast door; child named `led` with its own material (gameplay sets colour red/green) |
| `bunker.generator` | yes | generator; child named `lever` (gameplay rotates `lever.rotation.x` from 0 to −1.2 when pulled) |
| `bunker.innerDoor` | yes | door to the control room, door object (opens when power is on) |
| `bunker.terminal` | yes | terminal; child named `screen` with its own material (gameplay changes emissive colour/intensity) |

**Glyph pillars.** Each pillar shows four glyphs on its four sides: index 0 = Sun (Zon), 1 = Moon (Maan), 2 = Wave (Golf), 3 = Mountain (Berg). With `object.rotation.y = anchor.rotationY + s·(π/2)`, glyph `s` faces the player standing in front of the pillar (in front = the direction the anchor's rotationY faces). Initially every pillar has `s = 0`. The correct combination is decided by gameplay.

## Player API (`src/player/`)
```js
const input = new Input({ domElement: renderer.domElement, bus });   // keyboard, mouse, pointer lock, touch
input.lock(); input.unlock(); input.isLocked
input.enabled = true|false        // when false, movement/look input is ignored (menus)
// emits bus 'input:action' { action: 'interact'|'inventory'|'pause'|'torch'|'map'|'jump' } on key/touch presses
// emits bus 'input:pointerlock' { locked }
const player = new PlayerController({ camera, input, world, bus });
player.update(dt)
player.teleport(position: Vector3 (feet), yaw, pitch = 0)
player.state → { position: Vector3 (feet), velocity: Vector3, yaw, pitch, onGround, sprinting, crouching: false, stamina: 0..1, surface, inWater }
player.enabled = true|false        // false = frozen (no gravity/movement)
player.serialize() → { position: [x,y,z], yaw, pitch }; player.deserialize(data)
player.getEyePosition() → Vector3; player.getForward() → Vector3
```
Keys: WASD/arrows move, mouse looks (pointer lock), Shift sprint (drains stamina), Space jump, E interact, Tab or I inventory, M map, F torch, Esc pause. Player emits `player:step {surface, sprint}`, `player:jump`, `player:land {impact}`. Touch controls appear automatically on touch devices.

## Environment API (`src/environment/`)
```js
const env = createEnvironment({ scene, renderer, camera, world, bus, settings: Settings, quality });
env.update(dt, playerPosition, { simulate: boolean })   // simulate=false → clock frozen (paused/menus), visuals still animate
env.getTimeOfDay() → hours 0..24; env.setTimeOfDay(h); env.day → day counter
env.setWeather('clear'|'cloudy'|'rain'|'fog'|'storm', instant = false); env.weather; env.wind (0..1)
env.darkness (0..1, current interior darkness); env.indoor; env.night; env.interior (current zone)
// shadows are re-rendered on demand (movement, sun angle, interval) — see src/environment/Lighting.js
env.setTorch(on); env.torchOn
env.audio → { unlock(), play(name, { position?: Vector3, volume? }), setListener(camera) }  // also listens to bus 'sfx'
env.setQuality(name)
env.serialize() → { time, day, weather }; env.deserialize(data)
```
SFX names (`bus.emit('sfx', { name, position? })`): `pickup, craft, door_open, stone_grind, metal_door, lever, keycard_ok, keycard_denied, beacon, discover, mission_complete, objective, ui_click, ui_hover, ui_open, ui_close, error, page, step_grass, step_dirt, step_stone, step_wood, step_metal, step_water, jump, land, boards_break, torch_on, torch_off, power_on`.
Interior zones darken ambient light by `darkness` (cave/temple/bunker are near-black without the torch).

## Gameplay API (`src/gameplay/`)
```js
const gameplay = createGameplay({ scene, camera, world, player, environment: env, bus, settings: Settings });
gameplay.update(dt)                         // interaction focus, pickups bobbing, mission checks, location discovery
gameplay.newGame()                          // reset everything, teleport player to player.start, start mission 1
gameplay.save.hasSave() → bool; gameplay.save.getInfo() → { timestamp, missionTitle, playTime } | null
gameplay.save.save() → bool; gameplay.save.load() → bool (applies player/env/inventory/missions/world flags)
gameplay.save.deleteSave()
gameplay.respawnAtCheckpoint()
gameplay.inventory → { slots: Array<{itemId, count}|null> (24), add(id, n) → added, remove(id, n) → bool, count(id), has(id, n=1) }
gameplay.items → ITEMS map { [id]: { id, name, description, category: 'material'|'tool'|'key'|'artifact', stack } }
gameplay.crafting → { recipes: Array<{ id, result: {itemId, count}, ingredients: [{itemId, count}], description }>, canCraft(id), craft(id) → bool }
gameplay.missions → { list() → Mission[], active() → Mission|null }
   Mission = { id, title, description, status: 'locked'|'active'|'done', objectives: [{ id, text, done, progress?: [cur, max] }] }
gameplay.documents → { list() → Array<{ id, title, body }>, get(id) }   // documents the player has read (journal)
gameplay.locations → { list() → Array<{ id, name, x, z, discovered }> }
gameplay.playTime → seconds
```
Item ids: `wood, stone, fiber, resin, cloth, scrap, rope, torch, crowbar, sundisc, keycard`.

### Story (chapter 1, THE GREENLANDS)
1. **Ontwaakt** – read Dr. Vos's logbook in the station, activate the station's radio beacon (checkpoint), leave the station.
2. **Licht in het duister** – collect wood ×2, resin ×1, cloth ×1, craft a torch (`F` toggles it).
3. **Het stille dorp** – discover Valdris, collect scrap ×2 and fiber ×3, craft rope then a crowbar, pry the boards off the elder's door, read the elder's journal (reveals the pillar order Mountain – Sun – Wave and that the Sun Disc is hidden in the crystal cave behind the waterfall).
4. **De Kristalgrot** – find the cave by the waterfall, take the Sun Disc in the dark chamber (torch needed to see).
5. **De Zonnetempel** – place the Sun Disc on the altar, turn the three glyph pillars to Berg (3), Zon (0), Golf (2); the gate sinks; take the keycard and read Dr. Vos's last notes.
6. **Bunker K-7** – use the keycard on the reader, pull the generator lever to restore power, enter the control room and read the terminal → chapter ending (`bus 'chapter:complete'`). Free roam continues afterwards.

## Event bus catalogue
| event | payload | emitted by |
| --- | --- | --- |
| `game:state` | `{ state: 'loading'|'menu'|'playing'|'paused'|'inventory'|'reading'|'ending', previous }` | main |
| `loading:progress` | `{ progress: 0..1, label }` | main |
| `input:action` | `{ action }` | player/Input |
| `input:pointerlock` | `{ locked }` | player/Input |
| `player:step` / `player:jump` / `player:land` | `{ surface, sprint }` / `{}` / `{ impact }` | player |
| `interaction:focus` | `{ id, prompt, key: 'E' }` or `null` | gameplay |
| `inventory:changed` | `{ slots }` | gameplay |
| `item:picked` | `{ itemId, count, name }` | gameplay |
| `craft:done` | `{ recipeId, itemId, name }` | gameplay |
| `mission:started` / `mission:updated` / `mission:completed` | `{ mission }` | gameplay |
| `objective:completed` | `{ mission, objective }` | gameplay |
| `location:discovered` | `{ id, name }` | gameplay |
| `checkpoint:set` | `{ id, name }` | gameplay |
| `document:open` | `{ id, title, body, kind: 'note'|'journal'|'terminal'|'recording' }` | gameplay |
| `document:close` | `{}` | UI (close button) or main (E/Esc) |
| `notify` | `{ text, type: 'info'|'success'|'warning' }` | anyone |
| `sfx` | `{ name, position?, volume? }` | anyone → environment audio |
| `torch:changed` | `{ on }` | environment |
| `game:saved` / `game:loaded` | `{ timestamp }` | gameplay |
| `chapter:complete` | `{ chapter: 1 }` | gameplay |
| `beacon:activated` | `{ id }` | gameplay |
| `settings:changed` | `{ key, value, settings }` | Settings |
| `ui:request` | `{ action: 'newGame'|'continue'|'resume'|'pause'|'save'|'loadCheckpoint'|'quitToMenu'|'openInventory'|'closeInventory'|'openMap' }` | UI → main |

## UI API (`src/ui/`)
```js
const ui = createUI({ root: document.getElementById('ui'), bus, game });
ui.update(dt)   // HUD values that change every frame (stamina, compass, clock, fps)
```
`game` is the facade built in `main.js`:
```js
game = { bus, settings: Settings, get state(), player, gameplay, environment: env, perf, layout (module namespace of layout.js), version }
```
The UI never changes game state directly; it emits `ui:request` (main performs it) or calls `gameplay.crafting.craft(id)`, `Settings.set(...)`.

## Game states (main.js)
`loading → menu → playing ⇄ paused | inventory | reading → ending → playing`. Only in `playing` does the pointer stay locked and the player/gameplay update. Losing pointer lock while playing → `paused`.

## Save data (`localStorage['beyond.save.v1']`)
```js
{ version: 1, timestamp, playTime, player: {...}, environment: {...}, inventory: [...], missions: {...},
  world: { collected: [ids], flags: { ... } }, documents: [ids], discovered: [ids], checkpoint: id }
```

## Multiplayer readiness (not built yet)
- All state that would be synchronised is plain data: `player.serialize()`, inventory slots, mission/flag objects, `env.serialize()`.
- Gameplay mutations go through named functions (`inventory.add`, `craft`, interaction handlers) and are announced on the bus, so a future `src/net/` module can forward them to a Node.js WebSocket server (authoritative for world flags, item pickups and shared missions; up to 8 players) and replay remote events.
- World generation is fully deterministic (`mulberry32(WORLD_SEED)`), so every client builds the identical world from the seed.
- Remote players would be rendered by a `RemotePlayer` view that consumes `player.serialize()` snapshots.

## Collider heights inside builder frames
Structures build in local frames (`b.at(x, y, z, yaw, fn)`). Explicit collider `yMin`/`yMax` passed to `b.box(..., { c: { yMin, yMax } })`
or `b.solid(...)` are **frame-local**, exactly like the x/y/z of the box; the builder adds the frame origin's height.

## Performance (`src/perf/`)
- `Performance.js`: frame stats (`perf.stats()`), adaptive quality ladder (shadow refresh → grass density → render scale; off under WebDriver,
  force with `?adapt`, disable with `?noadapt`), far culling of documents/pickups, outdoor vegetation hidden in pitch-black interiors.
- `shadowHook.js`: shadow-only proxy meshes (merged per site, instanced per tree group) are visible only during the shadow pass.
- `tuning.js`: runtime multipliers written by the adaptive controller and read by grass and lighting.
- Tools: `node dev/perf-profile.mjs`, `node dev/perf-breakdown.mjs`, `node dev/view.mjs` (renders camera spots to JPEG).
