# Build Your Village

A cozy low-poly village builder that runs in the browser. You start with one small house on a patch of land and grow it into a Grand City: gather resources, place buildings, welcome villagers who live their own daily lives, unlock new land and deal with random events.

**Play:** open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). It needs an internet connection once, to load Three.js and the fonts from a CDN.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Walk / run / jump | `WASD` or arrows · `Shift` · `Space` | joystick · push it far to run · ⤒ |
| Interact (chop, mine, talk, trade, open, sleep) | `E` (hold `E` to keep gathering) | round **E** button |
| Walk to something | click it | tap it |
| Turn / zoom camera | drag · mouse wheel | drag · pinch |
| Build menu | `B` | Build |
| Rotate while placing | `R` / `Q` / `Shift`+wheel | ⟳ |
| Place | click (drag to paint roads) | tap to move the preview, ✓ to build |
| Inventory · Quests · Village · Shop · Land map | `I` · `J` · `V` · `T` · `M` | dock buttons |
| Close / cancel | `Esc` | ✕ |

## What is in the game

- **World** – a 400×400 hand-shaped, faceted low-poly landscape (no default terrain look): central glade, forests, a river with wooden bridges, a big lake, ponds, rolling hills, a terraced quarry, two caves (iron and crystal), patchwork farmland, snowy peaks, a coast with a beach, ruins, standing stones, an ancient tree and ten hidden treasure chests. Wind moves trees, grass, flowers and reeds.
- **11 areas to unlock** – Willow Glade → Whispering Forest → River Bend → Sunny Fields → Stone Hills → Flower Meadow → Mirror Lake → Deep Woods → Crystal Peaks → Harbor Coast → Old Hills. Locked land is desaturated behind a shimmering border with *For Sale* signs; buying it dissolves the border and brings the colour back.
- **42 buildings over 4 tiers** – Hamlet (Small House, Well, Woodcutter, Storage Shed, Dirt Road, …), Village (Cottage, Farm, General Store, Bakery, Blacksmith, Stone Road, Market Stall, Mine, Fisher's Hut, Windmill), Town (Town Hall, Manor, Inn, Tavern, Stable, Chapel, Marketplace, Fountain, Large Farm, Warehouse) and City (Townhouse, Town Square, Workshop, Guard Tower, Library, Harbor, Grand Market, Statue, Clock Tower, Lighthouse, Grand Hall).
- **Building system** – transparent preview that turns green or red with the reason (overlap, outside your land, water, blocking a road, too steep, needs water/sea/rocks), rotation, road painting, grow-in animation with dust and sparkles, move and demolish (50% refund). Clearing trees and rocks under a new building gives you their resources.
- **Villagers** – travelers only arrive when there is a free home and the village is happy enough ("New Resident Available!"). Every resident has a name, profession, home, workplace, hunger, happiness and money. They sleep at home, eat breakfast, walk to work along roads (A* pathfinding), buy lunch at the bakery, go shopping, sit on benches, visit the tavern, meet at the square, chat with each other, help build new buildings, react to new buildings and level-ups, run from wolves and panic at fires. They ask for help (❗) and pay you back.
- **Economy** – Wood, Stone, Wheat, Food, Coins, later Iron, Gold, Tools and Planks. Workers produce while they are at work; the bakery, blacksmith and workshop convert resources; villagers spend their wages in your shops; every morning residents pay taxes. Storage caps, shop-specific prices and a market that dips when you sell a lot at once.
- **Shops** – Trading Cart, General Store, Market Stall, Bakery, Blacksmith (tool upgrades), Marketplace, Harbor, Grand Market and a Traveling Merchant with one-off deals. Shops close at night.
- **Progression** – XP from gathering, building, quests, helping villagers, discovering areas and daily village reports. Level titles: Small Village (1), Village (5), Town (10), City (20), Grand City (30); every level unlocks something.
- **33 story quests + endless daily quests**, **21 achievements**, **14 cosmetics** (hats and tunics).
- **Happiness** from housing, food, shops, decoration, entertainment, safety and services, minus shortages, unemployment and damage. It drives how fast new residents come and how hard people work.
- **Events** – Heavy Rain, Village Festival, Wolves Attack, Traveling Merchant, Harvest Festival, Small Fire, Meteor Shower, Special Visitor (never back to back).
- **Day/night** – sun and moon, stars, sunsets, glowing windows, lanterns with real lights near you, fireflies at night, pollen by day. Sleep in your home to skip the night.
- **Audio** – everything is synthesised with WebAudio (birds, wind, water, crickets, rain, village murmur, footsteps, chopping, building, UI sounds and a soft generative tune), so no sound file can fail to load.
- **Saving** – autosave every 30 s, on new days, important actions and when you leave; a checksum plus a rotating backup slot protect against corrupt saves; offline progress when you come back; save codes to move a village to another browser.

## Code structure

`src/js/*.js` are concatenated (in name order) into one ES module by `build.mjs`, so the result is a single self-contained `index.html`. The split mirrors the Roblox layout from the design brief:

| File | Roblox equivalent | Contents |
| --- | --- | --- |
| `00_core.js` | shared utilities | math, noise, tweens, event bus, low-poly geometry builder, shader patches |
| `01_config.js` | `ReplicatedStorage/Modules/*Config` | ItemConfig, BuildingConfig, NPCConfig, QuestConfig, VillageConfig (areas, levels), achievements, events, shops |
| `02_world.js`, `03_nodes.js`, `04_models.js` | Workspace | terrain, water, roads, props, decor, barriers, chests, resource nodes, building models |
| `05_server.js` | `ServerScriptService/Services` | `Remote` gateway, DataService, EconomyService, VillageService, BuildingService, ResourceService, ShopService, QuestService, AchievementService |
| `07_npc.js` | `NPCService` | navigation grid + A*, villager schedules, production, requests |
| `13_events.js` | `EventService` | random events |
| `06_chars.js`, `08_player.js`, `09_build.js`, `10_interact.js`, `11_fx.js`, `12_audio.js`, `14_ui.js` | `StarterPlayerScripts` | characters, input/camera, BuildingController, InteractionController, effects + day/night, audio, UI |
| `15_main.js` | – | boot, render loop, picking, quality settings |

**Server/client split.** The client never edits the game state directly: it calls `Remote.invoke(name, args)`, and each handler validates types, distances, cooldowns, level requirements, costs and placement rules before changing anything. Services report back through events on `Bus`. In a single-player browser game there is no real trust boundary (anyone can edit their own browser storage), so this protects game logic rather than preventing cheating; the structure maps one-to-one onto Roblox RemoteFunctions if you port it.

**Performance.** All villagers and the player are one instanced mesh with limb animation in the vertex shader. Trees, rocks and decorations are instanced per 80×80 chunk so frustum culling and distance LOD work. Buildings are instanced per type. NPC decisions run a few times per second, shadows only re-render when something moved, point lights are pooled, and three quality presets (plus a slow-frame watchdog) cover weak devices.

## Development

```bash
node build.mjs          # rebuilds index.html from src/
```

Open `index.html?debug` to expose `window.BYV` (game state and services) for automated testing.
