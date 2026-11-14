# BEYOND – THE LOST WORLD

A 3D first-person exploration adventure in the browser, built with Three.js.
You wake up in an abandoned research station on a mysterious island. An ancient civilisation has vanished — and so has the scientist who found its traces.

## Play

```bash
cd beyond-lost-world
npm start            # → http://localhost:5173
```
No `npm install` needed: Three.js (r170) is vendored in `vendor/` and the server has no dependencies. The game makes no network requests — all textures, models and sounds are generated in the browser.

URL options: `?quality=low|medium|high` (default: automatic), `?debug` (exposes `window.BEYOND`), `?autostart` (skip the menu), `?nosave`, `?noadapt` (disable adaptive resolution).

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Walk | W A S D | left joystick |
| Look | mouse (pointer lock) | drag on the right half |
| Sprint | Shift | sprint button |
| Jump | Space | jump button |
| Interact / pick up | E | hand button |
| Inventory, crafting, missions, map | Tab (or M for the map) | bag button |
| Torch on/off | F | torch button |
| Pause | Esc | pause button |

## Chapter 1 – The Greenlands

1. **Ontwaakt** – read Dr. Vos' logbook, activate the station beacon, leave the station.
2. **Licht in het duister** – gather wood, resin and cloth; craft a torch.
3. **Het stille dorp** – reach Valdris, craft rope and a crowbar, break into the elder's house, read his journal.
4. **De Kristalgrot** – find the crystal cave behind the waterfall and take the Sun Disc.
5. **De Zonnetempel** – place the disc on the altar, turn the glyph pillars in the right order, take keycard K-7.
6. **Bunker K-7** – open the blast door, restore power with the generator, reach the control room and learn the truth.

Progress is autosaved every minute, at checkpoints and when the tab is hidden (`localStorage`, key `beyond.save.v1`).

## Project structure

```
index.html            shell + import map
server.mjs            zero-dependency static server
src/main.js           boot, game loop, state machine (loading → menu → playing ⇄ paused/inventory/reading → ending)
src/core/             EventBus, Settings, quality presets
src/world/            layout.js (single source of truth for the map), World.js (composition)
  nature/             terrain, water, waterfall, instanced vegetation with LOD, grass, rocks, procedural textures
  structures/         research station, village Valdris, Sun Temple, Bunker K-7, crystal cave, bridges
src/player/           input (keyboard/mouse/touch), first-person controller, collision
src/environment/      sky, day/night, lighting & shadows, fog, weather, rain, torch, synthesised audio
src/gameplay/         items, inventory, crafting, pickups, interaction, documents, missions, locations, checkpoints, saving
src/ui/               HUD, menus, inventory/crafting/missions/map/journal, settings, touch overlay (DOM + CSS)
src/perf/             frame stats, adaptive quality, culling, shadow scheduling
dev/                  per-module preview pages and profiling tools (dev/perf-profile.mjs)
tests/                automated Playwright browser tests
```

## Tests

```bash
npm test                         # all browser tests (needs Playwright + Chromium)
node tests/run-all.mjs boot      # only files whose name contains "boot"
node dev/perf-profile.mjs        # draw calls / triangles / timings per location and preset
```
The tests boot the real game in headless Chromium (software WebGL), play through chapter 1 via the debug API, check that every location is reachable and that saving, crafting and interaction work, and take screenshots.

## Documentation
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) – module contracts, events, save format, multiplayer notes
- [`TODO.md`](TODO.md) – progress
