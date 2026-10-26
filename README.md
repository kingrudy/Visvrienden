# Visvrienden 🎣

Een multiplayer sportvis-spel voor vrienden, in de browser (three.js, Node-server zonder dependencies).

## Starten
- Met Docker: `docker compose up -d --build`
- Zonder Docker (Node 22): `npm start` (of `node server.js`)

Open daarna http://localhost:8304 (bij Docker Compose: voeg zelf `ports: ["8304:8304"]` toe als je lokaal wilt testen) — maak een account, maak of join een kamer ("Dorpsvijver", "Vrienden-water") en deel de link met vrienden.

## Spelen
- **WASD / pijltjes**: lopen · **muis**: kijken en richten · **links klikken / spatie**: uitwerpen, aanslaan en inhalen
- Als de dobber zakt: aanslaan! Vechten: inhalen als de lijn slap is, loslaten bij spanning (rood = lijn knapt).
- **Z / N / K / L**: zwaaien, lachen, duim, je laatste vangst tonen
- **E**: praten, winkel, kampvuur, bord. Ook touch- en gamepad-besturing.

## Wat zit erin
- Grote wereld met 6 vijvers + 2 geheime vijvers (ontdek ze!); nieuwe vijvers ontgrendel je met vangsten en soorten.
- 53 vissoorten met zeldzaamheden; tijd van de dag, weer en aas beïnvloeden de beet.
- Winkel voor aas en hengels, smid voor upgrades, kiosken bij elke vijver, rondtrekkende handelaar.
- Server-gestuurd vissen met gevecht (spanning, uithouding, lijnbreuk), vangen/houden/vrijlaten, koken, verkopen.
- Reiger die vis steelt (tenzij je een hond hebt), kampvuur-buffs, boot en fiets, wedstrijden, ruilen met vrienden.
- Dagelijkse opdrachten, prestaties, talenten, visboek, ranglijsten, fotomodus, sonar en minikaart.

- Vis van de week (wisselt elke maandag): bijt 2,5× vaker en verkoopt voor 1,5×. Aas en weer werken samen (bijv. wormen bij regen).
- Elk account heeft een eigen huis in het dorp (bord met je naam, tot 42 huizen) met een aquarium waarin je gevangen soorten in het klein zwemmen en een hondenmand (de hond slaapt daar als je offline bent). Thuis gaat je hond zelf in zijn mand liggen. Speler **Toon** is Iron Man en heeft een Ironman-hond (rood en goud met arc reactor). Menu > Naar huis brengt je erheen; E bij het aquarium toont de collectie.
- Camera schuift voor bomen langs; je wereldkaart met voortgang per vijver staat in de lobby.

Data staat in `db.json` (map `DATA_DIR`). Elke dag wordt een back-up gemaakt in `DATA_DIR/backups/` (laatste 7 blijven bewaard).

## Ontwikkelen
- `npm test` draait alle tests (spelregels, een volledige visbeurt op de server, accounts, WebSocket en of alle client-bestanden laden).
- `ALLOW_CHEATS=1 npm start` zet test-commando's aan (alleen voor lokaal testen).
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
  lobby.js                verbindingen, kamers en de spellus
  game/                   spelregels (server is de baas)
    room.js               één kamer: spelers, berichten, bewegen, hoofdlus
    fishing.js            vissen in de vijvers, werpen, beet, drillen, vangst
    economy.js            winkels, verkopen, bakken, chat, ruilen
    events.js             weer, reigers, reizende verkoper, wedstrijden
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
  models/                 Blender-modellen (.glb)
tools/                    Blender-scripts voor de vissers en honden
test/                     tests (node --test)
```
