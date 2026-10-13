# Solstice Roads

An open-world countryside racing game that runs in the browser. Drive, drift and race around **Wendmoor**, a fictional corner of the English countryside, during the Solstice Festival. It was inspired by the mood of festival-style open-world racers. All code, cars, places and branding are original.

This game was rebuilt from the earlier single-file drift game `Drift_Offroad_v8.html`, which is kept unchanged in [`legacy/`](legacy/). Several of its ideas carried over and were reworked: lofted car bodies, the drift score with a multiplier, tyre marks and dust, the cockpit camera, and procedural terrain.

**Play:** open `index.html` in a modern desktop or mobile browser (Chrome, Edge, Firefox or Safari). Three.js and the fonts load from a CDN, so you need an internet connection the first time.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Accelerate / brake / reverse | `W` `S` or `↑` `↓` | RT / LT | ▲ / ▼ |
| Steer | `A` `D` or `←` `→` | left stick | ◀ ▶ |
| Handbrake (start a drift) | `Space` | A | HB |
| Change camera (chase, close, hood, cockpit, cinematic) | `C` | Y | CAM |
| Reset car to the road | `R` | Back | R |
| Start event / enter garage | `E` | X | E |
| Mute / radio on-off | `M` / `N` | – | – |
| Horn | `H` | – | – |
| Photo mode | `P` | – | – |
| Pause | `Esc` | Start | II |

## What's in the game

- **Open world (2.4 × 2.4 km):** a continuous landscape with no loading screens. It includes:
  - the Solstice Festival hub (stage with an LED wall, Ferris wheel, garages, tents, grandstand, flag ring, string lights and display cars on turntables)
  - two villages, Ashcombe and Kettlewick, plus the hamlet of Thornbury, with stone cottages, thatched cottages, terraces, barns, churches and street lights
  - Mere Water (a lake) and the River Wend with three stone bridges
  - the Fellside tunnel, and the Grimstone Fells mountain pass with hairpins, guard rails and chevron signs
  - Hollin Wood and Westerley Woods, the open Brackenmoor, and the Harrowfield farmland with patchwork fields (wheat, ploughed earth, yellow rapeseed), hedgerows and dry-stone walls
- **Road network:** 20 roads (A-roads, country lanes, a mountain pass and gravel tracks) connect 16 junctions. Each road has its own markings and texture. Road heights are planned so that grades stay within limits for each road type, and junctions meet at the same height. The terrain is then carved to fit the roads, so they never float or sink.
- **Cars:** seven fictional cars, each with its own physical stats, a performance class (D to X) and paint choices:
  - Kestrel RS (mid-engine wedge)
  - Aurelia Strada GT (V12 grand tourer)
  - Halcyon Furia (hypercar)
  - Brisa 86 (light rear-drive coupé)
  - Marauder 69 (muscle car)
  - Taiga Rally Evo (rally hatchback)
  - Ridgeback T1 (trophy truck)

  Each car is built procedurally: a lofted body with real wheel-arch openings, a glass cabin, pillars, an interior, headlights and taillights that work, brake and reverse lights, mirrors, wings, exhausts, and wheels with spoked rims, discs and calipers. Wheels spin and steer, suspension moves, and the body rolls and pitches.
- **Driving physics:** a fixed 120 Hz simulation with render interpolation. Each axle uses a tyre model where grip peaks and then falls off when sliding, with load transfer and a friction circle (so too much throttle causes wheelspin and oversteer). Other features:
  - automatic gearbox, aerodynamic drag and downforce
  - grip that depends on the surface (asphalt, gravel, grass, dirt, mud, snow, rock, water) and on rain
  - slopes, jumps, and collisions with trees, buildings, walls, rails and other cars

  With *steering & drift assist* on (the default), stability control stops the car spinning from steering alone. A handbrake flick starts a drift. While you hold the throttle, steering sets the drift angle; lift off to grip up again.
- **Events:** a light column marks each event in the world. Drive into one and press `E`.
  - Circuits: Solstice Loop, Solstice Loop Reverse and Ashcombe Ring
  - Road races (point-to-point): Westcountry Run and Lakeside Dash
  - Sprints: Grimstone Pass Sprint and Brackenmoor Sprint
  - Off-road: Brackenmoor Scramble (gravel trail plus cross-country) and Harrowfield Rally

  Races have a countdown, checkpoint gates, laps, a timer, live positions, a wrong-way warning, AI opponents, a results table, credits and XP. Personal bests are saved.
- **Free-roam life:**
  - traffic on the roads: it keeps left, slows for bends, villages and the car ahead, turns at junctions and stops when you hit it
  - a dancing crowd at the festival stage, plus visitors around the tents and garages
- **Smashables:** wooden fences along the farm tracks, hay bales in the fields and cones on the festival lanes. They break into tumbling debris and come back after a while.
- **Progression:** you start with three cars and earn credits from races, stunts and skills (drifts, jumps, near misses with traffic, smashes) to buy the other four in the garage.
- **Photo mode** (`P`): orbit and zoom the camera freely, change the lens, then save a PNG with `Enter`.
- **Stunts in free roam:** speed traps, a speed zone and drift zones are always active (just drive through them), with star ratings and records. Drift chains (with a multiplier) and jumps earn credits.
- **AI opponents:** they use the same physics as you. They steer along the racing line, brake for corners based on how tight the road ahead is, overtake when blocked, have slight catch-up, and recover themselves if they get stuck.
- **Weather and time of day:**
  - eight presets: sunny afternoon, overcast, rain, morning fog, golden sunset, night, winter snow and winter night
  - winter covers the terrain, roofs, trees, walls and road verges with snow, adds snowfall and lowers grip
  - an optional day/night cycle
  - a sky with moving clouds, sun, moon and stars, which also supplies the reflections
  - fog and haze
  - rain streaks, wet darkened roads with reflective puddles, and spray from the wheels
  - at night: headlights, streetlights and lit windows
- **Cameras:** chase, close chase, hood, cockpit (with the interior and a turning steering wheel) and trackside cinematic. They react to speed with field of view and a gentle shake.
- **Audio:**
  - synthesised sounds: engine (follows rpm), backfire pops when lifting off, tyre squeal, gravel and grass rumble, wind, impacts, menu sounds, race cues, and birds, crickets and rain
  - the festival radio, which plays `audio/chasing_the_edge.mp3`
  - separate volume sliders, mute (`M`) and radio on/off (`N`)
- **Menus and HUD:**
  - main menu with a cinematic background, garage with a turntable preview, an events and map screen with fast travel, settings, pause and results
  - HUD: tachometer, speed and gear, a minimap that rotates with your heading and shows the race route, location name, race panel, drift counter and notifications
- **Graphics presets:** Low, Medium, High and Ultra change:
  - resolution and dynamic resolution
  - shadow map size
  - bloom, colour grading and MSAA
  - grass density
  - tree and view distance

## Code structure

The files in `src/js/*.js` are joined in name order into one ES module by `build.mjs`, so the finished `index.html` works on its own, even opened straight from disk.

| File | Contents |
| --- | --- |
| `00_core.js` | imports, maths, noise, splines, event bus, saving, canvas textures |
| `01_config.js` | cars, paints, surfaces, weather presets, quality presets, default settings |
| `02_layout.js` | the map design: places, junctions, roads, river, lake, events, fast travel |
| `03_terrain.js` | heightfield, river and lake carving, road profiles, distance fields, surfaces, world queries, LOD terrain chunks and the splat terrain shader |
| `03b_collide.js` | static collision world (spatial hash, circles and rotated boxes) |
| `04_roads.js` | road meshes and markings, junctions, plaza, bridges, tunnel, guard rails, stone walls, signs |
| `05_props.js` | instanced trees (2 LODs, wind), GPU grass, rocks, hedgerows, villages, street lights, water |
| `05b_festival.js` | the festival hub |
| `06_sky.js` | sky shader, sun and moon, fog, environment reflections, weather, rain, pooled lights |
| `06b_snow.js` | winter snow layer on every material |
| `07_carmodel.js` | procedural car models |
| `08_vehicle.js` | vehicle physics |
| `09_fx.js` | particles and tyre marks |
| `10_audio.js` | audio engine and radio |
| `11_camera.js` | camera modes |
| `12_race.js` | routes, race manager, AI drivers, checkpoints, stunts, skill scoring |
| `12b_traffic.js` | ambient traffic |
| `12c_smash.js` | smashable fences, hay bales and cones, with debris |
| `13_hud.js` | HUD and minimap |
| `14_menu.js` | menus, garage and car buying |
| `14b_photo.js` | photo mode |
| `15_input.js` | keyboard, gamepad and touch input |
| `16_main.js` | boot, main loop, quality settings, dynamic resolution |

Conventions: units are metres, seconds and radians. Y points up and north is −Z. A heading `h` means the car faces `(sin h, cos h)`.

**Performance:**
- Vegetation is instanced in 200 m chunks with near and far versions.
- Terrain is split into 200 m chunks, each with three LOD levels and skirts to hide gaps.
- Grass is a single GPU-placed instanced mesh that follows the camera.
- Static props, festival parts and car parts are merged into one mesh per material.
- Particles share one pooled draw call, and tyre marks use one ring-buffer mesh.
- A fixed pool of point lights avoids shader recompiles.
- Shadows follow the player.

## Development

```bash
node build.mjs     # rebuilds index.html from src/
```

The page exposes `window.SR` (game state and a few functions) for automated testing.

## Credits

All code, models and textures are procedural and original. The festival radio track `audio/chasing_the_edge.mp3` was supplied by the project owner.
