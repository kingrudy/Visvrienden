// Visvrienden multiplayer-server. Geen npm-dependencies: eigen WebSocket, accounts, lobby en statische bestanden.
//   server/config.js     instellingen en build-id
//   server/db.js         opslag (db.json + back-ups)
//   server/accounts.js   registreren, inloggen, sessies, huizen, ranglijst
//   server/http.js       statische bestanden en de JSON-API
//   server/websocket.js  WebSocket-protocol
//   server/lobby.js      verbindingen, kamers en de spellus
//   server/game/         de spelregels (gedeeld met de client via public/js/shared.js)
import http from 'node:http';
import { PORT, EXTRA_PORTS, VERSION, BUILD, DATA_DIR } from './server/config.js';
import { startPersistence } from './server/db.js';
import { createRequestHandler } from './server/http.js';
import { acceptUpgrade } from './server/websocket.js';
import { startLobby } from './server/lobby.js';

startPersistence();
const lobby = startLobby();
const onRequest = createRequestHandler(lobby);

function listen(port, main) {
  const srv = http.createServer(onRequest);
  srv.on('upgrade', (req, socket) => {
    const ws = acceptUpgrade(req, socket);
    if (ws) lobby.connect(ws);
  });
  srv.on('error', e => {
    if (main) {
      console.error('Kan niet luisteren op poort ' + port + ': ' + e.message);
      process.exit(1);
    }
  });
  srv.listen(port, () =>
    console.log(`Visvrienden ${VERSION} (build ${BUILD}) luistert op poort ${port}` + (main ? ` (data: ${DATA_DIR})` : ' (extra)')),
  );
}
listen(PORT, true);
for (const p of EXTRA_PORTS) listen(p, false);
