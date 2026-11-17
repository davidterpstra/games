# Claw Machine Simulator

A 3D claw-machine collecting game in the style of a Roblox simulator. You have your own arcade room with a claw machine: grab plush animals, collect them, equip them as pets, train your strength, upgrade your claw and unlock new arcades.

**Play:** open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari — desktop or phone). It needs an internet connection once to load Three.js and the fonts from a CDN. Progress is saved automatically in the browser (LocalStorage).

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Walk | `WASD` / arrow keys | joystick (bottom left) |
| Use a station (machine, training, upgrades, pets, portal) | `E` | round action button |
| Move the claw | `WASD` / arrows, or click / drag inside the machine to aim | d-pad, or tap / drag inside the machine |
| Play / drop the claw | `Space` or the PLAY / DROP button | PLAY / DROP button |
| Train (in the training area) | `Space` or TRAIN | TRAIN button |
| Leave the machine / training, close menus | `Esc` | ← Back / ✕ |
| Pets · Upgrades · Worlds · Index · Shop · Settings | `I` · `U` · `G` · `X` · `B` · `O` | side buttons / ⚙ |
| Rotate / zoom the camera | drag · mouse wheel | drag · pinch |

## What is in the game

- **A real claw machine.** The claw moves left/right and forward/back, drops, closes and lifts. The animals lie physically in the machine (sphere physics with stacking), get pushed by the prongs, look nervous when the claw comes down and wriggle when held. A prize only counts when it drops through the chute. Timer of 20 s per play, auto-drop at zero.
- **Skill plus upgrades, not pure luck.** The hover card shows the grip chance on the animal under the claw. The chance depends on how well centred you are, how heavy the animal is (rarer = heavier) and your Claw Strength. Drop Protection decides how often a held animal slips out on the way to the chute — a slip can still land in the chute by luck.
- **40 animals** in 5 worlds (8 per world), each a procedurally built chibi plush with its own shape, colours and features. **7 rarities** — Common, Uncommon, Rare, Epic, Legendary, Mythical, Secret — with their own glow effects (shine, sparkles, aura, light beam, orbiting orbs, void swirl). **Golden** (×3) and **Rainbow** (×8) variants.
- **Capsule opening animation** for new and rare catches, with longer, glowing shakes and a flash for Legendary, Mythical and Secret.
- **Pets.** Inventory with 3D previews, equip/unequip, Equip Best, lock, sell, bulk sell per rarity and **evolve** (5 identical → Golden → Rainbow). Equipped pets follow you around and multiply training strength and coins.
- **Training.** The training area gives Strength per rep; better equipment (10 items) needs more Strength. Strength gates new worlds and adds a coin bonus and a little grip power. Auto Train can be bought with gems.
- **10 upgrades** with many levels and rising costs: Claw Strength, Luck, Movement Speed, Drop Protection, Machine Capacity and Special Chance, plus Coin Magnet (Jungle), Personal Trainer (Frozen), Gem Finder (Desert) and Cosmic Power (Space). Every new world raises the level caps. Upgrades are visible on the machine: prong tiers from steel to rainbow, rubber grip pads, glowing rails, a lucky clover, faster rainbow chase lights and the machine level on the sign.
- **5 worlds:** Starter, Jungle, Frozen, Desert and Space Arcade — each with its own room theme and decoration, machine, animals, play cost, rewards and music. Unlock with Strength and coins through the World Portal.
- **Index** (collection book) with a gem reward per completed world, **Gem Shop** (pet slots, inventory space, Auto Train, Luck and Coin boosts) and a **daily reward** with streak.
- **Effects and sound:** coins and gems fly to the counters, particle bursts, confetti, floating numbers, upgrade rings, camera shake. All sounds and the music per world are synthesised with WebAudio.
- **Settings:** graphics quality Auto / Low / Medium / High (Auto lowers itself when the frame rate drops), sound, music, volume, save now, export / import save code, reset.
- **Saving:** autosave every 15 s and after important actions, a checksum plus a backup slot, and every loaded save is validated and repaired.

## Code structure

`src/js/*.js` are concatenated (in name order) into one ES module by `build.mjs`, so the result is one self-contained `index.html`. `ARCHITECTURE.md` is the contract between the modules (names, data model, actions and events).

| File | Contents |
| --- | --- |
| `00_core.js` | shared helpers, event bus, room layout, machine dimensions |
| `01_config.js` | rarities, variants, 40 animals, worlds, upgrades, training, gem shop, economy, balance formulas |
| `02_data.js` | player data model, validation, LocalStorage save/load with checksum and backup |
| `03_services.js` | game rules ("server"): `Remote.invoke(action)` gateway, economy, claw outcomes, pets, upgrades, training, worlds |
| `04_scene.js` | renderer, quality presets, themed rooms, stations, portal, pet display |
| `05_animals.js` | procedural animal models, rarity effects, thumbnails, 3D pet viewer |
| `06_machine.js` | claw machine model, claw state machine, pit physics, upgrade visuals |
| `07_player.js` | input, avatar, pets that follow you, camera, station interaction |
| `08_fx.js` · `09_audio.js` | particles and reward effects · synthesised sound and music |
| `10_ui.js` · `11_ui_panels.js` | HUD, overlays, capsule reveal · Pets, Upgrades, Worlds, Index, Shop and Settings panels |
| `12_main.js` | boot, modes, world switching, render loop |

**Ready for multiplayer / Roblox.** The interface and 3D code never change the game state directly: they call `Remote.invoke(name, args)`, and the services validate everything (costs, caps, cooldowns, ownership) before changing the player data and announcing changes on the event bus. Player, pet, machine, upgrade and world data are plain JSON. This maps one-to-one onto Roblox RemoteFunctions and DataStores.

**Performance.** One merged mesh set per animal with shared geometry and materials, merged static room geometry (about 25 draw calls per room), one pooled particle system, physics with sleeping bodies, three quality presets plus an automatic downgrade when the frame rate drops.

## Development

```bash
node build.mjs                 # rebuild index.html from src/
node tools/check.mjs           # build + syntax check + top-level name rules
node tools/smoke.mjs --fresh   # headless browser run (needs .cache/three.module.js)
```

Open `index.html?debug` to expose `window.CMS` (all modules and data) for testing.
