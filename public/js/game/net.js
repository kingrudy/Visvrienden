// Verbinding met de server: WebSocket, API-aanroepen en het verdelen van binnenkomende berichten.
import * as S from '../shared.js';
import { PONDS, SP } from '../shared.js';
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { onEvent } from './ambient.js';
import { onCatch, onLost, updateFightUI } from './fishing.js';
import { setHouse } from './houses.js';
import { bigMsg, feed, onSave, toast, updateContest, updateHotbar } from './hud.js';
import { showOffer } from './interact.js';
import { leaveGameUI, startGame } from './main.js';
import { addPlayer, chatBubble, onSnapshot, removePlayer } from './players.js';
import { onFish } from './pondfish.js';
import { onBoss, onBossWin } from './boss.js';
import { onCommunity, onInvite, onSocial, requestSocial, runAfterJoin } from './social.js';
import { renderPanel } from './panels.js';
import { renderRooms, showScreen, toastGlobal } from './screens.js';
import { $, BUILD, G, R, me, send, store } from './state.js';

/* ------------------------------------------------------------------ netwerk */
export function connect() {
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  const ws = new WebSocket(url);
  G.ws = ws;
  ws.onopen = () => {
    if (G.token) send({ t: 'auth', token: G.token, build: BUILD });
    else showScreen('auth');
  };
  ws.onmessage = ev => {
    try {
      onMsg(JSON.parse(ev.data));
    } catch (e) {
      console.error(e);
    }
  };
  ws.onclose = () => {
    if (G.ws !== ws) return;
    G.ws = null;
    if (G.outdated) return;
    // midden in het spel: de wereld blijft staan en we proberen stil opnieuw te verbinden
    if (G.inGame) {
      G.reconnecting = true;
      G.fight = null;
      $('reconnect').classList.remove('hidden');
    } else toastGlobal('Verbinding verbroken. Opnieuw verbinden...');
    retry = Math.min(retry + 1, 5);
    setTimeout(() => G.ws || connect(), 600 * retry);
  };
}
let retry = 0;
export async function api(path, body) {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}
function onMsg(m) {
  switch (m.t) {
    case 'authfail':
      G.token = null;
      store.set('token', null);
      G.reconnecting = false;
      $('reconnect').classList.add('hidden');
      if (G.inGame) leaveGameUI();
      showScreen('auth');
      break;
    case 'authed':
      retry = 0;
      G.name = m.name;
      G.save = m.save;
      G.rooms = m.rooms;
      if (m.community) G.community = m.community;
      requestSocial();
      if (G.reconnecting) {
        // terug naar dezelfde kamer en plek, of anders naar de lobby
        G.reconnecting = false;
        if (m.resume) return send({ t: 'join', id: m.resume, resume: true });
        $('reconnect').classList.add('hidden');
        leaveGameUI();
        toastGlobal('Je kamer bestaat niet meer. Kies een nieuwe.', 'warn');
        return;
      }
      if (G.linkRoom) {
        // via een uitnodigingslink binnengekomen: meteen die kamer in
        send({ t: 'join', id: G.linkRoom, link: true });
        G.linkRoom = 0;
        history.replaceState(null, '', location.pathname);
        return;
      }
      showScreen('lobby');
      break;
    case 'outdated':
      G.outdated = true;
      if (G.reconnecting) location.reload(); // na een update van de server: meteen de nieuwe versie laden
      break;
    case 'kicked':
      toastGlobal('Je bent ergens anders ingelogd.', 'warn');
      break;
    case 'rooms':
      G.rooms = m.rooms;
      if (!$('lobby').classList.contains('hidden')) renderRooms();
      break;
    case 'err':
      toastGlobal(m.msg, 'bad');
      break;
    case 'left':
      G.save = m.save;
      G.rooms = m.rooms;
      if (G.afterLeave) {
        // overstappen naar een andere kamer (bijv. die van een vriend)
        send(G.afterLeave);
        G.afterLeave = null;
        break;
      }
      leaveGameUI();
      break;
    case 'save':
      G.save = m.save;
      onSave();
      break;
    case 'look':
      break;
    case 'joined':
      $('reconnect').classList.add('hidden');
      startGame(m);
      runAfterJoin();
      break;
    case 'social':
      onSocial(m);
      break;
    case 'community':
      onCommunity(m.c);
      break;
    case 'invite':
      onInvite(m);
      break;
    case 'boss':
      onBoss(m.b, m.spawn);
      break;
    case 'bossWin':
      onBossWin(m);
      break;
    case 'hot':
      G.hot.delete(m.pond); // nieuwe stekken komen met het volgende vissenbericht
      break;
    case 's':
      onSnapshot(m.ps);
      break;
    case 'f':
      onFish(m.ponds);
      break;
    case 'pinfo':
      addPlayer(m.p);
      break;
    case 'pgone':
      removePlayer(m.id);
      break;
    case 'ev':
      onEvent(m);
      break;
    case 'house':
      setHouse(m.h);
      if (G.panel?.name === 'aq') renderPanel();
      break;
    case 'emote': {
      const E = G.players.get(m.id);
      if (!E) break;
      const T = { wave: '👋', laugh: '😄', thumb: '👍' };
      const txt = m.k === 'fish' ? (m.sp && SP[m.sp] ? `🐟 ${SP[m.sp].name} ${S.fmtKg(m.w)}` : '🐟 Nog niks gevangen…') : T[m.k];
      if (txt) chatBubble(m.id, txt);
      break;
    }
    case 'toast':
      toast(m.msg, m.kind);
      if (m.kind === 'good') A.sfx.coin();
      break;
    case 'feed':
      feed(m.msg, m.kind);
      break;
    case 'chat':
      feed(`<b>${UI.esc(m.name)}</b>: ${UI.esc(m.text)}`, 'chat', true);
      chatBubble(m.id, m.text);
      break;
    case 'wx':
      G.weather = m.w;
      feed(
        {
          clear: '☀️ Het klaart op.',
          rain: '🌧️ Het begint te regenen. Vissen bijten nu beter!',
          fog: '🌫️ Mist trekt over het water.',
          storm: '⛈️ Onweer! Legendarische vissen laten zich zien...',
        }[m.w],
        'info',
      );
      break;
    case 'merchant':
      G.merchant = m.m;
      R.world.setMerchant(m.m);
      break;
    case 'contest':
      G.contest = m.c;
      updateContest();
      break;
    case 'catch':
      onCatch(m);
      break;
    case 'lost':
      onLost(m);
      break;
    case 'stolen':
      G.catchCard = null;
      $('catchCard').classList.add('hidden');
      A.sfx.heron();
      break;
    case 'fight':
      G.fight = m;
      updateFightUI();
      break;
    case 'unlocked':
      bigMsg(`🔓 ${PONDS[m.pond].name} ontgrendeld!`);
      A.sfx.levelup();
      R.world.setUnlocked(G.save.unlocked);
      break;
    case 'discover':
      bigMsg(`🔮 ${PONDS[m.pond].name} ontdekt!`);
      A.sfx.legend();
      break;
    case 'levelup':
      bigMsg(`⭐ Niveau ${m.lvl}!`);
      A.sfx.levelup();
      break;
    case 'ach':
      toast(`🏅 Prestatie: ${S.ACH[m.id].name}`, 'good');
      A.sfx.catch(2);
      break;
    case 'tp':
      me.x = m.x;
      me.z = m.z;
      if (m.msg) toast(m.msg, 'warn');
      break;
    case 'mount':
      me.mount = m.m;
      updateHotbar();
      break;
    case 'offer':
      showOffer(m);
      break;
  }
}
