# Empire Conquest

A browser strategy game that combines **world conquest**, **army command** and **kingdom management**. Start with one small town and grow it into a world empire while six AI kingdoms try to do the same.

**Play:** open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). No installation, build step, server or backend is needed — it runs straight from the file. (An internet connection only adds the Cinzel/Inter web fonts; without it the game uses system fonts.)

## How to play

1. **Build** — open *Kingdom* (or select your capital → *Build*) and build a Farm and a Mine. Resources arrive every day.
2. **Train** — select a territory with Barracks → *Military* and train soldiers. They join the territory's garrison.
3. **Raise armies** — form an army from a garrison (*Army* → *Raise new army*, or the *Raise army* button).
4. **Conquer** — select your army, click a territory to see the route, the defenders and your **win chance**, then press **ATTACK** (or right-click to march at once). Grey lands are independent and can be attacked any time; kingdoms need a declaration of war first.
5. **Develop** — conquered lands become yours: develop them, fortify them, build, recruit and set taxes. Settlements grow Village → Town → City → Major City → Capital.
6. **Rule** — research technology, spend your ruler's skill points, trade, make alliances or wars, and follow the missions. Control 60% of the world to become *Emperor of the World*.

## Controls

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Move the map | drag, `W A S D` / arrow keys | drag |
| Zoom | mouse wheel, `+` / `-`, double-click | pinch |
| Select territory / army | click | tap |
| Plan a march or attack | select army, click a territory | select army, tap a territory |
| March immediately | right-click | — |
| Pause · speed 1× 2× 4× | `Space` · `1` `2` `3` | buttons in the top bar |
| Kingdom · Army · War · Diplomacy · Technology · Missions · Map | `K` `R` `X` `P` `T` `O` `M` | sidebar |
| Go to capital | `H` | 🏰 button |
| Close · deselect · menu | `Esc` | ✕ / ⚙️ |
| Save | `Ctrl` + `S` | ⚙️ → Save game |
| Cheat menu (∞ keeps a cheat on) | type `cheats` or `Ctrl` + `Shift` + `C` | ⚙️ → Cheats |

## What is in the game

- **World map** — a procedurally generated world (the same seed always gives the same world): ~120 territories on 4–7 landmasses with plains, forests, mountains, deserts, snow, lakes, rivers and islands connected by sea routes. Drawn on a canvas with cached terrain tiles per zoom level, a political overlay, crisp vector borders, kingdom names, towns that grow visibly, armies with marching routes, clouds, fog of war and a minimap. Political and terrain map modes.
- **Kingdom** — castle, farm, lumber camp, mine, houses, market, barracks, blacksmith, academy and temple, each with 5 levels. Five settlement tiers with more population, gold, production, recruiting speed and building levels. Develop (+output), fortify (walls), taxes (gold vs. happiness), storage limits.
- **Economy** — gold, food, wood, iron, population, happiness and research points change every day. Output depends on terrain, rivers, buildings, settlement size, development, happiness, distance to the capital, technology and the ruler. Soldiers cost upkeep and food; famine and an empty treasury have consequences.
- **Army** — infantry, archers, cavalry, knights and siege engines, each with attack, defense, health, speed, cost, upkeep and training time. Garrisons, armies (raise, reinforce, station, split, merge, disband, rename), generals with traits who level up in battle.
- **Battles** — up to 8 rounds. Unit counts and types (counters), attack/defense, blacksmith and technology upgrades, terrain, walls, siege engines, sea landings, generals and the ruler's skills all matter; randomness is only ±10% per round. The game predicts your win chance and losses before you attack. Animated battle reports.
- **Conquest** — captured lands become fully usable territories with unrest that fades over time. Capturing a capital moves the enemy capital; losing every territory destroys a kingdom.
- **AI kingdoms** — Aurelia, Nordhelm, Valoria, Drakmor, Eldoria and Westreach, each with its own colour, capital, ruler, personality, economy, research and armies. They build, expand into independent lands, attack, defend, declare war, make peace, trade and form alliances with each other and with you.
- **Diplomacy** — declare war, propose peace, trade agreements (gold every day), alliances (allies join defensive wars and share maps), gifts. Relations change over time; every proposal shows how the other ruler weighs it. Truces after peace.
- **Ruler** — Military, Economy, Diplomacy and Leadership; the ruler levels up and earns skill points.
- **Technology** — Military (Better Weapons, Better Armor, Advanced Cavalry, Siege Engineering), Economy (Better Farming, Mining, Trade, Taxation) and Kingdom (Bigger Cities, Better Roads, Administration, Advanced Architecture).
- **Missions** — 22 objectives from *First Steps* to *Empire*, *World Power* and *Emperor of the World*, with rewards.
- **Saving** — autosave every 30 seconds and when you leave, three manual slots, load, new game and reset progress (with confirmation). Saves live in `localStorage`.
- **Audio** — an original generative soundtrack and all sound effects are synthesised with the Web Audio API (no audio files, nothing copyrighted). Off by default; toggle and volumes in the top bar / menu.
- **Difficulty** — Easy, Normal and Hard (AI income, aggression and how long they leave you alone at the start).

## Code structure

Plain scripts (no modules, no bundler) so the game also runs from `file://`. Every file adds one global object.

| File | Contents |
| --- | --- |
| `index.html` | page shell, loads the scripts in order |
| `css/style.css` | the whole interface: layout, panels, animations, responsive rules |
| `js/util.js` | math, seeded random numbers, noise, heap, formatting, event bus |
| `js/data.js` | all balancing data: terrain, settlements, buildings, units, technologies, kingdoms, missions |
| `js/mapgen.js` | world generator: Voronoi cells, continents, terrain, rivers, territories, sea routes, organic borders |
| `js/game.js` | game state, new-game setup, ownership changes, caches, the simulation step |
| `js/economy.js` | production, upkeep, population growth, happiness, storage limits |
| `js/kingdom.js` | buildings, develop / fortify / settlement growth, taxes, scouting, ruler skills |
| `js/army.js` | recruiting, armies, generals, path finding, movement, conquest |
| `js/battle.js` | battle simulation, predictions, battle reports |
| `js/diplomacy.js` | relations, war, peace, trade, alliances, proposals and offers |
| `js/technology.js` | research |
| `js/ai.js` | AI kingdoms: economy, research, recruiting, army targeting and defense, diplomacy |
| `js/missions.js` | objectives, rewards, victory and defeat |
| `js/save.js` | save slots, validation, settings |
| `js/audio.js` | synthesised music and sound effects |
| `js/map.js` | map renderer (tiles, overlay, borders, cities, armies, effects, minimap) and map input |
| `js/ui.js` | top bar, tooltips, toasts, modals, banners, chronicle, shortcuts, action dispatch |
| `js/panels.js` | Kingdom, Army, War, Diplomacy, Technology and Missions panels |
| `js/context.js` | the right-hand panel for the selected territory or army |
| `js/cheats.js` | cheat menu (resources, reveal map, army, technology, …) |
| `js/screens.js` | title screen, new game, menu, save/load, army composer, battle report, victory/defeat, help |
| `js/main.js` | boot, game loop, autosave |
| `assets/images/icon.svg` | logo / favicon |

The simulation (everything up to `missions.js`) does not touch the DOM, so it can also be run headless (for example in Node with `vm`) to test balance. One game day is one second at 1× speed; the simulation advances in fixed steps of 0.1 day and AI kingdoms think every few days, staggered.
