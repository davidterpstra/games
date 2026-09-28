# 🛒 Mini Supermarket

Een kleurrijke supermarkt-tycoon voor in de browser. Je begint met een kleine buurtsupermarkt, vier schappen en €1.000. Klanten lopen echt door de winkel, pakken producten uit de schappen, staan in de rij en rekenen af. Met de winst koop je upgrades, schappen, personeel en uitbreidingen, tot je een keten van vijf supermarkten hebt.

**Spelen:** open `index.html` in een moderne browser (Chrome, Edge, Firefox of Safari). Je hebt geen server, installatie of internet nodig. Alleen het lettertype komt van Google Fonts; zonder internet valt het spel terug op een systeemlettertype.

Er wordt niets van Roblox gebruikt: het spel is gewoon HTML, CSS en JavaScript.

## De spel-loop

Klanten → producten kopen → geld verdienen → upgrades kopen → winkel uitbreiden → meer klanten → meer geld → nieuwe producten → opnieuw uitbreiden.

In het begin doe je alles zelf door te tikken. Personeel neemt die klusjes één voor één van je over:

| Klus | Zelf doen | Personeel |
| --- | --- | --- |
| Afrekenen | Tik op de kassa (of op de klant bij de kassa). Tik tijdens het scannen om sneller te scannen. | 🧑‍💼 Kassamedewerker |
| Schap bijvullen | Tik op een schap met ⚠️ | 📦 Vakvuller |
| Levering uitladen | Tik op de 🚚 bezorgwagen | 🚚 Magazijnmedewerker |
| Schoonmaken | Tik op een vlek | 🧹 Schoonmaker |
| Voorraad bestellen | 📦 Voorraad → *+1 doos* | 👔 Filiaalmanager (vanaf level 9) |

## Besturing

| Actie | Muis / toetsenbord | Touch |
| --- | --- | --- |
| Iets in de winkel gebruiken of bekijken | klik | tik |
| Rondkijken | slepen | slepen |
| Zoomen | scrollwiel, `+` / `-`, `0` = hele winkel | knijpen, ＋ / － / ⤢ |
| Pauze / snelheid | `spatie`, `1` `2` `3` | ⏸️ 1× 2× 3× |
| Opslaan | `Ctrl+S` of 💾 Save Game | 💾 |
| Sluiten | `Esc` | ✕ |

## Wat zit erin

- **Klanten** met een naam en een boodschappenlijst (bijv. *🛒 Lisa — wil 🥛 Melk, 🍞 Brood, 🍎 Appel*). Ze komen binnen, lopen met A*-padvinding naar de juiste schappen, pakken producten, kiezen de kortste rij, betalen en lopen weer weg. Vijf soorten: 👨 normaal, ⚡ haastig (snel, weinig geduld, geeft fooi), 💰 rijk (koopt dure en zeldzame producten), 🛍️ grote shopper (winkelwagen, veel producten) en 😡 ongeduldig (vertrekt als iets op is of de rij te lang is). Tevreden klanten verhogen je beoordeling en dus het aantal klanten.
- **58 producten** met inkoopprijs, verkoopprijs, voorraad, populariteit, schap (groentekrat, broodrek, koelvak, vriezer, schap, versvitrine) en zeldzaamheid: 🟢 Common, 🔵 Rare, 🟣 Epic en 🟡 Legendary (🍰 Legendary Cake, 💎 Luxury Chocolate, 🥩 Premium Steak, 🍾 Golden Soda). Je begint met 10 producten; de rest komt vrij met je level en met nieuwe winkels.
- **Voorraad** op twee plekken: in het schap (bijv. `7 / 10`) en in het magazijn. Bestellingen kosten geld en worden na een paar seconden gebracht door een bezorgwagen die echt komt aanrijden. Waarschuwingen bij bijna lege schappen en producten die op raken.
- **Geld**: bij elke betaling zie je `+€12,50` boven de kassa. Elk product toont *Verkoop*, *Kosten* en *Winst*.
- **5 winkelgroottes**: Kleine supermarkt → Extra ruimte → Grotere winkel → Nieuwe afdeling (🥩 Vlees & Vis) → Grote supermarkt. De muren schuiven zichtbaar naar buiten, met bouwstof en confetti; er komen schapplekken, kassa's en klantcapaciteit bij.
- **Personeel** (5 rollen) met eigen AI en salaris per minuut. Kun je de lonen niet betalen, dan staakt het personeel tot er weer geld is.
- **7 upgrades** die steeds duurder worden: Kassasnelheid, Klantcapaciteit, Voorraadcapaciteit, Productkwaliteit, Reclame, Looptempo en Snelle levering. Hoe ver je kunt upgraden hangt af van je winkelgrootte.
- **Dagelijkse uitdagingen** (drie per dag, elke dag nieuw) met geld of XP als beloning, plus een dagbonus. Daarnaast een reeks **doelen** die je stap voor stap door het spel leiden.
- **Levels en XP** voor verkopen, klanten helpen, uitdagingen en uitbreidingen. Elk level laat zien wat er is vrijgespeeld.
- **5 winkels**: 🏪 Neighborhood Market, 🏙️ City Market, 🏖️ Beach Market, 🏔️ Mountain Market en 🌆 Downtown Supermarket. Elke winkel heeft een eigen stijl, prijsniveau, klantenmix en specialiteiten. Een winkel met kassamedewerker, vakvuller, magazijnmedewerker én manager verdient de helft van zijn gemiddelde winst door terwijl jij in een andere winkel bent.
- **Opslaan** in `localStorage`: automatisch elke 20 seconden en bij het sluiten, of met 💾 Save Game. 🔄 Reset Game vraagt eerst om bevestiging. Een kapotte of oude save laat het spel niet crashen.
- **Feedback**: geldteksten, muntjes, sparkles, ✨ Upgrade!, 🎉 LEVEL UP!, geluidjes (WebAudio, geen bestanden). Met `prefers-reduced-motion` zijn de animaties rustiger.
- **Responsive** voor desktop, laptop, tablet en telefoon.

## Code

Gewone scripts (geen ES-modules), zodat `index.html` ook via `file://` werkt. Alles hangt aan één namespace, `window.MS`.

```
index.html            pagina + volgorde van de scripts
css/style.css         alle opmaak (responsive, reduced motion)
js/util.js            hulpfuncties, geldnotatie, seeded random, event bus
js/data/              alle spelinhoud als data
  products.js         producten, zeldzaamheden, afdelingen en schappen
  customers.js        soorten klanten en namen
  staff.js            personeelsrollen
  upgrades.js         upgrades
  stores.js           winkels (thema, prijzen, klantenmix) en winkelgroottes
  progression.js      XP-curve, doelen en sjablonen voor dagelijkse uitdagingen
js/systems/           spellogica
  layout.js           plattegrond per winkelgrootte, schapplekken, kassa's
  pathfinding.js      A* over het tegelgrid
  product.js          Product (prijzen per winkel)
  inventory.js        Inventory (magazijn, bijvullen, voorraadstatus)
  upgrades.js         Upgrade + UpgradeSystem
  walker.js           gedeelde loop-logica
  customer.js         Customer (klant-AI)
  employee.js         Employee (personeel-AI)
  delivery.js         Truck (bezorgwagen)
  store.js            Store + Register (één winkel en zijn kassa's)
  challenges.js       ChallengeSystem + GoalSystem
  save.js             SaveSystem (localStorage)
  audio.js            Sound (WebAudio-effecten)
js/render/            tekenen op <canvas>
  sprites.js          mensen, schappen, kassa's, wagen, emoji-cache
  effects.js          zwevende teksten en deeltjes
  renderer.js         camera, wereld, overlays, aanklikbare objecten
js/game.js            Game: geld, XP en alle spelersacties (met controles)
js/ui/                DOM-interface
  ui.js               bovenbalk, panelen, meldingen, vensters, vieringen
  panels.js           inhoud van de menu's
  input.js            muis, touch en toetsenbord
js/main.js            opstarten en de game-loop
```

De interface roept alleen `game.action…()`-methodes aan. Die controleren eerst of de speler genoeg geld heeft en aan de voorwaarden voldoet, zodat je niet per ongeluk oneindig geld kunt krijgen.

### Uitbreiden

- **Product toevoegen:** één regel in `js/data/products.js`, bijvoorbeeld
  `P('kiwi', 'Kiwi', '🥝', 'produce', 0.50, 1.40, 6, 'common', 4, 12),`
  (id, naam, emoji, afdeling, inkoop, verkoop, populariteit, zeldzaamheid, level, stuks per doos).
  Het verschijnt vanzelf in de menu's, bij level-ups en in de wensen van klanten.
- **Upgrade toevoegen:** een item in `js/data/upgrades.js` en het effect uitlezen met `store.upgrades.value('<id>')`.
- **Winkel toevoegen:** een item in `js/data/stores.js` (thema, prijsniveau, klantenmix, startproducten) en eventueel producten met `stores: ['<id>']`.
- **Klanttype of personeelsrol:** een item in `customers.js` of `staff.js`; voor een nieuwe rol ook een `update…()` in `employee.js`.

Voor testen staat het spel in de console onder `MS.app` (`MS.app.game`, `MS.app.renderer`, `MS.app.ui`).
