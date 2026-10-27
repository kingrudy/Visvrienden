# Visvrienden 🎣

Een multiplayer sportvis-spel voor vrienden, in de browser (three.js, Node-server zonder dependencies).

## Starten
- Met Docker: `docker compose up -d --build`
- Zonder Docker (Node 22): `npm start` (of `node server.js`)

Open daarna http://localhost:8304 (bij Docker Compose: voeg zelf `ports: ["8304:8304"]` toe als je lokaal wilt testen) — maak een account, maak of join een kamer ("Dorpsvijver", "Vrienden-water") en deel de link met vrienden.

## Spelen
- **WASD / pijltjes**: lopen · **muis**: kijken en richten · **E**: praten, winkel, kampvuur, aquarium
- **Werpen**: kijk naar het water, houd links klikken / spatie ingedrukt en laat los. De krachtbalk bepaalt hoe ver je gooit; loslaten in het gouden vak is een perfecte worp (meer kans op een beet).
- Als je "Aanslaan!" ziet: klikken. Drillen: inhalen als de vis rustig is, loslaten als hij trekt (anders knapt je lijn).
- **Z / N / K / L**: zwaaien, lachen, duim, je laatste vangst tonen. Ook touch- en gamepad-besturing.

## Wat zit erin
- Grote wereld met 6 vijvers + 2 geheime vijvers; nieuwe vijvers ontgrendel je met vangsten en soorten.
- 53 vissoorten met zeldzaamheden; tijd van de dag, weer en aas beïnvloeden de beet.
- **Drie technieken**, afhankelijk van je aas: dobber, grondvissen (belletje, zwaardere vis) en kunstaas (zelf binnendraaien terwijl roofvissen jagen).
- **Visstekken**: plekken met bubbels en springende vissen waar je vaker en zwaardere vis vangt. Ze verhuizen elke paar minuten.
- **Reuzenvis**: verschijnt af en toe en haal je met de hele kamer samen binnen; iedereen die meehelpt krijgt een beloning.
- Winkel voor aas, hengels, voertuigen, een hond en **inrichting voor je huis**; smid voor upgrades; reizende verkoper.
- Elk account heeft een eigen huis in het dorp met aquarium (je gevangen soorten zwemmen er in het klein, met plantjes, treintje, station, kasteel) en een hondenmand. Koop een schatkist, duiker, scheepswrak, bank, lamp, trofeekast, schilderij van je zwaarste vis of een open haard, en **nodig vrienden uit** om langs te komen. Speler **Toon** is Iron Man en heeft een Ironman-hond.
- **Samen spelen**: vriendenlijst met online-status, uitnodigingslink (`?kamer=…`) die vrienden direct in jouw kamer brengt, **visclubs** met wekelijkse ranglijst en een **samen-opdracht** per dag voor alle spelers.
- Server-gestuurd vissen met gevecht, wedstrijden (in het weekend elk halfuur), ruilen, koken, dagelijkse opdrachten, prestaties, talenten, visboek, ranglijsten, fotomodus, sonar en minikaart.
- **Chatfilter** voor scheldwoorden; nette namen voor accounts en clubs.
- Valt de verbinding even weg, dan ga je automatisch verder in dezelfde kamer en op dezelfde plek.
- **Installeer als app** op telefoon of computer (menu of lobby); de spelbestanden komen dan uit de cache. Op tragere apparaten verlaagt het spel zelf de resolutie zodat het soepel blijft.

Data staat in `db.json` (map `DATA_DIR`). Elke dag wordt een back-up gemaakt in `DATA_DIR/backups/` (laatste 7 blijven bewaard).

## Ontwikkelen
- `npm test` draait alle tests (spelregels, een volledige visbeurt op de server, accounts, WebSocket en of alle client-bestanden laden).
- `ALLOW_CHEATS=1 npm start` zet test-commando's aan (alleen voor lokaal testen).
- `LOGIN_LIMIT` (standaard 15): aantal inlog- of registratiepogingen per minuut per adres.
- Elke wijziging in `public/` of `server/game/` geeft een nieuw build-id; spelers met een oude versie krijgen de melding om te herladen.

## Projectstructuur
```
server.js                 startpunt van de server
server/
  config.js               instellingen (PORT, DATA_DIR, ...) en build-id
  db.js                   opslag in db.json + dagelijkse back-ups
  accounts.js             registreren, inloggen, sessies, huizen, ranglijst
  http.js                 statische bestanden en de JSON-API
  websocket.js            WebSocket-protocol (zonder dependencies)
  lobby.js                verbindingen, kamers, opnieuw verbinden en de spellus
  social.js               vrienden, visclubs, samen-opdracht en uitnodigingen
  game/                   spelregels (server is de baas)
    room.js               één kamer: spelers, berichten, bewegen, hoofdlus
    fishing.js            vissen in de vijvers, werpen, beet, drillen, vangst
    economy.js            winkels, verkopen, bakken, chat, ruilen
    events.js             weer, reigers, reizende verkoper, wedstrijden
    boss.js               de reuzenvis die je samen vangt
    filter.js             chatfilter
    progress.js           save controleren, niveaus, talenten, dagopdrachten
    rules.js              afstelling (CFG) en formules (aas, gewicht, xp)
public/
  index.html              schermen en HUD (HTML)
  css/style.css           opmaak
  js/shared.js            gedeeld door server en browser: wereld, vijvers, vissoorten, aas, hengels
  js/game/                de client: main, net, screens, players, fishing, hud, panels, input, ...
  js/world/               terrein, water, lucht, bomen en de shaders
  js/models/              3D-modellen: vissers, honden, vissen, huizen, gebouwen, voertuigen
  js/ui/html.js           HTML van de panelen
  js/audio.js             geluiden (WebAudio)
  sw.js, manifest.webmanifest   installeren als app
  models/                 Blender-modellen (.glb)
tools/                    Blender-scripts voor de vissers en honden
test/                     tests (node --test)
```
