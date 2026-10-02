# Visvrienden 🎣

Een multiplayer sportvis-spel voor vrienden, in de browser (three.js, Node-server zonder dependencies).

## Starten
- Met Docker: `docker compose up -d --build`
- Zonder Docker (Node 22): `node server.js`

Open daarna http://localhost:8304 (bij Docker Compose: voeg zelf `ports: ["8304:8304"]` toe als je lokaal wilt testen) — maak een account, maak of join een kamer ("Dorpsvijver", "Vrienden-water") en deel de link met vrienden.

## Spelen
- **WASD / pijltjes**: lopen · **muis**: kijken en richten · **links klikken / spatie**: uitwerpen, aanslaan en inhalen
- Als de dobber zakt: aanslaan! Vechten: inhalen als de lijn slap is, loslaten bij spanning (rood = lijn knapt).
- **E**: praten, winkel, kampvuur, bord. Ook touch- en gamepad-besturing.

## Wat zit erin
- Grote wereld met 6 vijvers + 2 geheime vijvers (ontdek ze!); nieuwe vijvers ontgrendel je met vangsten en soorten.
- 53 vissoorten met zeldzaamheden, dag/nacht, weer en seizoenen die de beet beïnvloeden.
- Winkel voor aas en hengels, smid voor upgrades, kiosken bij elke vijver, rondtrekkende handelaar.
- Server-gestuurd vissen met gevecht (spanning, uithouding, lijnbreuk), vangen/houden/vrijlaten, koken, verkopen.
- Reiger die vis steelt (tenzij je een hond hebt), kampvuur-buffs, boot en fiets, wedstrijden, ruilen met vrienden.
- Dagelijkse opdrachten, prestaties, talenten, visboek, ranglijsten, fotomodus, sonar en minikaart.

Data staat in `db.json` (map `DATA_DIR`).
