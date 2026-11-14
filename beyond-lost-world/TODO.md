# TODO – BEYOND: THE LOST WORLD

Status: `[ ]` open · `[~]` in progress · `[x]` done

## Fase 1 – Fundament
- [x] Projectstructuur, lokale Three.js (r170) in `vendor/`, zero-dependency server
- [x] Architectuur- en moduleafspraken (`docs/ARCHITECTURE.md`), wereldindeling (`src/world/layout.js`)
- [x] Game loop, toestandsmachine, settings, quality presets (`src/main.js`, `src/core/`)
- [~] First-person controller, input, pointer lock, collision, touch (Player agent)
- [~] Eerste speelbare wereld (World agents)

## Fase 2 – Wereld
- [~] Terrein met paden, rivier, meer, waterval, bergen (World agent A)
- [~] Bomen, struiken, gras, varens, rotsen – instanced + LOD (World agent A)
- [~] Onderzoeksstation, dorp Valdris, Zonnetempel, Bunker K-7, Kristalgrot, bruggen (World agent B)
- [~] Belichting, schaduwen, lucht, mist, dag/nacht, weer (Environment agent)

## Fase 3 – Gameplay
- [~] Items, inventory, crafting, oppakken, interacties (Gameplay agent)
- [~] Missies, ontdekbare locaties, checkpoints, opslaan (Gameplay agent)
- [~] HUD, hoofdmenu, pauzemenu, inventory/crafting/missies/kaart, instellingen (UI agent)

## Fase 4 – Verhaal en puzzels
- [~] Hoofdstuk 1: zes missies, pilaarpuzzel, sleutelkaart, bunker, eindscène (Gameplay agent)

## Fase 5 – Afwerking
- [~] Gesynthetiseerde omgevingsgeluiden en effecten (Environment agent)
- [ ] Optimalisatie: draw calls, geheugen, mobiel (Optimization agent)
- [ ] QA: geautomatiseerde browsertests van alle systemen (QA agent)

## Later
- [ ] THE WASTELANDS (woestijn, zandstormen, bunkers, laboratoria)
- [ ] THE FROZEN PEAKS (sneeuwbergen, bevroren grotten, onderzoeksstations)
- [ ] Multiplayer (Node.js + WebSockets, tot 8 spelers) – zie "Multiplayer readiness" in docs/ARCHITECTURE.md
