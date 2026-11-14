// All readable texts of chapter 1 (Dutch) plus where the documents lie in the world.
// `anchor` = world anchor id; `model` = procedural model type (see DocumentModels.js).

export const DOCUMENTS = [
  {
    id: 'logbook', anchor: 'station.logbook', model: 'notebook', kind: 'journal',
    prompt: 'Lezen: Logboek van Dr. Vos',
    title: 'Logboek van Dr. Elena Vos',
    body: `EXPEDITIE KESTREL – LOGBOEK VAN DR. ELENA VOS, GEOLOOG EN HOOFD ONDERZOEK

3 maart
We zijn geland op het plateau. Zes wetenschappers, twee technici, en een kaart die volgens iedereen in Genève onzin is. Het dal onder ons is groen. Veel te groen voor een gebied dat al veertig jaar als dode zone op de satellietbeelden staat. Station Kestrel staat. De generator draait. Morgen beginnen we.

19 maart
De eerste glyfen gevonden op een rotswand ten noorden van het meer: een zon, een maan, een golf, een berg. Telkens in dezelfde volgorde, telkens met dezelfde zorg uitgehouwen. Dit is geen decoratie. Dit is taal, of anders een slot.

2 april
Marek en Ilse zijn niet teruggekomen van het bosveld. Hun rugzakken lagen bij de oude kruising, de tent was netjes dichtgeritst. Er is geen spoor van een worsteling. We hebben drie dagen gezocht.

9 april
Nog twee mensen weg. Ik slaap niet meer. De anderen willen het station verlaten, maar de radio geeft alleen ruis. Ik heb besloten te blijven. Er is iets in die tempelruïne in het noorden dat antwoorden heeft, en ik denk dat de glyfen de sleutel zijn.

14 april
Ik ben de laatste in het station. Ik laat dit logboek op het bureau achter, voor wie mij ook volgt. Bij de uitgang staat een noodbaken. Activeer hem: dan weet je altijd waar je terug kunt keren.

Als je het dorp Valdris bereikt, zoek dan het huis van de ouderling. En maak vuur. De ruïnes, de grot en de tempel zijn pikdonker. Zonder toorts zie je er niets. Hout, hars en een lap stof is alles wat je nodig hebt.

Ik ga naar de tempel. Als ik niet terugkom, ga dan niet naar mij op zoek. Ga verder dan ik gekomen ben.

– E. Vos`,
  },
  {
    id: 'forest_camp', anchor: 'note.forest_camp', model: 'paper', kind: 'note',
    prompt: 'Lezen: Verregend briefje',
    title: 'Briefje bij het kamp',
    body: `Door regen vervaagd, de inkt is uitgelopen.

Marek, als je dit leest: de tent is leeg gelaten. Ik ben naar het dorp gegaan, langs de oude kruising naar het oosten. Ik hoorde gisteravond weer die lage toon uit de grond, net onder de bomen. Ilse zegt dat het de wind is. Het is niet de wind.

Neem niets mee dat je niet kunt dragen en blijf op het pad.

– I.`,
  },
  {
    id: 'village_house', anchor: 'note.village_house', model: 'paper', kind: 'note',
    prompt: 'Lezen: Vergeeld papier',
    title: 'Vergeeld papier in het dorpshuis',
    body: `Het papier is broos als herfstblad. De letters zijn in een oude, ronde hand geschreven.

Het huis van de ouderling blijft dicht tot de zon terugkeert. Zo is het besloten. Wie de planken losbreekt, neemt de last op zich.

Wij hebben het licht gedragen. Wij dragen het niet langer.

Onderaan, in een andere hand, met kolen: "Ze zijn niet dood. Ze zijn weggegaan."`,
  },
  {
    id: 'elder_journal', anchor: 'village.journal', model: 'journal', kind: 'journal',
    prompt: 'Lezen: Dagboek van de ouderling',
    title: 'Dagboek van ouderling Taren',
    body: `ZO SCHRIJF IK, TAREN VAN VALDRIS, OUDERLING VAN HET LAATSTE JAAR

Wij zijn de Aethari, de mensen van de zon. Zo noemden onze grootouders zich, en hun grootouders. Valdris was ooit een stad vol licht. Nu ben ik de laatste die de pen nog kan vasthouden.

De zon liet ons iets na. Een schijf van goud, gesmeed in een tijd waar niemand zich nog van herinnert. Hij opent de tempel in het noorden, waar de oude poort de weg naar de diepte bewaakt. Uit angst voor wat er kan gebeuren als de verkeerde handen hem vinden, hebben wij de Zonneschijf verborgen in de Kristalgrot, achter de Zilveren Waterval. Het pad is kort maar donker. Neem een vlam mee.

In de tempel staan drie pilaren. Elke zijde draagt een teken: de Zon, de Maan, de Golf, de Berg. Zo luidt de oude volgorde, doorgegeven van ouderling op ouderling en nooit opgeschreven, tot nu:

EERST DE BERG, DAN DE ZON, ALS LAATSTE DE GOLF.

Draai de pilaren totdat het juiste teken je aankijkt, en de poort zal zakken.

Ik hoor de mensen niet meer zingen. Een voor een zijn ze naar de grote rust gegaan. Ik blijf, voor het geval dat iemand komt.

Als jij dit leest, vreemdeling: je bent welkom. Wees voorzichtig in het donker.`,
  },
  {
    id: 'waterfall', anchor: 'note.waterfall', model: 'paper', kind: 'note',
    prompt: 'Lezen: Natte aantekening',
    title: 'Aantekening bij de waterval',
    body: `Notitie van Vos, met potlood, onder een platte steen gelegd.

Dag 31. Achter het watergordijn is een gang. De stenen daar zijn gladgeslepen, zoals het in de rest van het dal nergens voorkomt. Kristallen in de wand, zwak lichtgevend. Mijn zaklamp doet het niet meer sinds de storm, dus ik durfde niet verder.

Ik kom terug met een toorts. Ik heb het gevoel dat wat Taren de Zonneschijf noemt, daar ligt.`,
  },
  {
    id: 'cave', anchor: 'note.cave', model: 'tablet', kind: 'note',
    prompt: 'Bestuderen: Inscriptie',
    title: 'Inscriptie in de Kristalgrot',
    body: `In de steen gehouwen, met dezelfde zorgvuldige hand als de glyfen op de pilaren:

"Wie het licht zoekt in het donker, zal het vinden waar niemand kijkt.
Wie het licht neemt, draagt het terug naar waar het begon.
De zon wacht op de tempel. De tempel wacht op de zon."

Daaronder een kleine afbeelding: een schijf met stralen, en drie pilaren die in een rij staan.`,
  },
  {
    id: 'recording', anchor: 'temple.recording', model: 'recorder', kind: 'recording',
    prompt: 'Afspelen: Bandrecorder',
    title: 'Opname van Dr. Vos',
    body: `[Ruis. Een klik. Een vermoeide stem, zacht en dichtbij.]

Dit is Elena Vos, laatste opname, de tempel, dag tweeënzestig. Als iemand dit hoort, dan is de poort opengegaan. Dan ben je het raadsel van de pilaren te slim af geweest.

Ik heb in de binnenste kamer iets gevonden dat hier niet thuishoort: de sleutelkaart van de oude bunker K-7. Een militaire installatie, ouder dan het station, ouder dan de kaart die ons hierheen bracht. Iemand heeft hem hier achtergelaten, bij een altaar voor een zon. Waarom? Ik denk dat de bunker en de tempel met elkaar verbonden zijn.

Mijn theorie, voor wat het waard is: de Aethari zijn niet gestorven. Er is geen enkel graf in het dorp, geen botten, geen as. Ze zijn weggegaan. Ze zijn, hoe zeg je dat, verdergegaan. Beyond. Dat woord blijft terugkomen in de bunkerdocumenten die ik heb kunnen lezen.

De bunker ligt ten westen van de kruising. Ik ga erheen. Als jij dit hoort: volg me, maar vertrouw de generator niet. Hij is ouder dan hij lijkt.

[Een lange stilte.]

Ik ben bang, en ik ben nog nooit zo nieuwsgierig geweest.

[Klik.]`,
  },
  {
    id: 'terminal', anchor: null, model: null, kind: 'terminal',
    prompt: 'Gebruiken: Terminal',
    title: 'Terminal K-7 · Project BEYOND',
    body: `> K-7 CONTROLEKAMER · NOODSTROOM ACTIEF
> GEBRUIKER: ONBEKEND · TOEGANG: NIVEAU 3 (KAART)

> LOG 0114 / PROJECT BEYOND
Het eerste experiment slaagde. De poort in het dal reageert op de zonneschijf. Een deel van de testgroep verdween zonder spoor. Instrumenten registreren geen schade en geen verval, alleen leegte. Eén van hen stuurde nog een bericht: "Het is niet donker. Het is open."

> LOG 0131
De bevolking van Valdris wil niet meewerken. Ze noemen zichzelf de Aethari en zeggen dat ze de poort al lang kennen. Ze zeggen dat zij hem hebben gebouwd. We hebben besloten het dal te sluiten.

> LOG 0152
Directie heeft Project BEYOND beëindigd. De bunker wordt verzegeld. De tempel moet verborgen blijven. Niemand mag weten wat er achter de poort ligt.

> LOG 0153 [RECENT, AUTOMATISCH]
Een signaal is ontvangen. Bron: zuidoost, woestijngebied, ongeveer 400 km. Herhalend patroon, zelfde glyfenreeks als in de tempel. Iemand of iets antwoordt.

> EINDE VAN DE LOGS.
> VOLGENDE LOCATIE: THE WASTELANDS`,
  },
];

export const DOC_BY_ID = Object.fromEntries(DOCUMENTS.map((d) => [d.id, d]));
