# TODO – BEYOND: THE LOST WORLD

Status: `[ ]` open · `[~]` in progress · `[x]` done

## Fase 1 – Fundament
- [x] Projectstructuur, lokale Three.js (r170) in `vendor/`, zero-dependency server
- [x] Architectuur- en moduleafspraken (`docs/ARCHITECTURE.md`), wereldindeling (`src/world/layout.js`)
- [x] Game loop, toestandsmachine, settings, quality presets (`src/main.js`, `src/core/`)
- [x] First-person controller, input, pointer lock, collision, touch (Player agent)
- [x] Eerste speelbare wereld (World agents)

## Fase 2 – Wereld
- [x] Terrein met paden, rivier, meer, waterval, bergen (World agent A)
- [x] Bomen, struiken, gras, varens, rotsen – instanced + LOD (World agent A)
- [x] Onderzoeksstation, dorp Valdris, Zonnetempel, Bunker K-7, Kristalgrot, bruggen (World agent B)
- [x] Belichting, schaduwen, lucht, mist, dag/nacht, weer (Environment agent)

## Fase 3 – Gameplay
- [x] Items, inventory, crafting, oppakken, interacties (Gameplay agent)
- [x] Missies, ontdekbare locaties, checkpoints, opslaan (Gameplay agent)
- [x] HUD, hoofdmenu, pauzemenu, inventory/crafting/missies/kaart, instellingen (UI agent)

## Fase 4 – Verhaal en puzzels
- [x] Hoofdstuk 1: zes missies, pilaarpuzzel, sleutelkaart, bunker, eindscène (Gameplay agent)

## Fase 5 – Afwerking
- [x] Gesynthetiseerde omgevingsgeluiden en effecten (Environment agent)
- [x] Optimalisatie: schaduwplanning, shadow proxies, adaptieve kwaliteit, culling, gechunkte pickups (Optimization agent + lead)
- [x] QA: geautomatiseerde browsertests van alle systemen (`npm test`, 523 checks) en bugfixes (QA agent + lead)

## Bekende verbeterpunten
- [ ] Documenten (≈40 losse meshes) samenvoegen tot minder draw calls
- [ ] Bomen: minder chunks × LOD-varianten (≈44 draw calls op medium)
- [ ] Schaduwshaders vooraf compileren (kleine hapering bij de eerste schaduwrender)
- [ ] Bos op klaarlichte dag wat lichter onder het bladerdak

## Later
- [ ] THE WASTELANDS (woestijn, zandstormen, bunkers, laboratoria)
- [ ] THE FROZEN PEAKS (sneeuwbergen, bevroren grotten, onderzoeksstations)
- [ ] Multiplayer (Node.js + WebSockets, tot 8 spelers) – zie "Multiplayer readiness" in docs/ARCHITECTURE.md
