// Samen spelen in de browser: vrienden, visclub, dagdoel, uitnodigingen en de uitnodigingslink.
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { toast, updateHUD } from './hud.js';
import { renderPanel } from './panels.js';
import { $, G, send } from './state.js';

/** Vraag de actuele vrienden-, club- en dagdoelgegevens op bij de server. */
export const requestSocial = () => send({ t: 'social' });

export function onSocial(m) {
  G.social = m;
  if (m.community) G.community = m.community;
  if (G.panel?.name === 'players' || G.panel?.name === 'quests') renderPanel();
  renderLobbySocial();
}
export function onCommunity(c) {
  // de server stuurt bij een update geen persoonlijke bijdrage mee: die houden we zelf bij
  const mine = G.community?.mine || 0;
  G.community = { ...c, mine: Math.max(mine, c.mine || 0) };
  if (G.social) G.social.community = G.community;
  if (G.panel?.name === 'quests' || (G.panel?.name === 'players' && G.socialTab === 'Samen')) renderPanel();
  if (G.inGame) updateHUD();
  renderLobbySocial();
}

/* ---------------- lobby: vrienden online en het dagdoel */
export function renderLobbySocial() {
  const fr = $('lobFriends'),
    co = $('lobCommunity');
  if (co) co.innerHTML = G.community ? UI.communityHTML(G.community) : 'Laden...';
  if (!fr) return;
  const list = (G.social?.friends || []).filter(f => f.online);
  fr.innerHTML = !G.social
    ? 'Laden...'
    : list.length
      ? list
          .map(
            f =>
              `<div class="lbrow"><span>🟢 ${UI.esc(f.name)} <span class="note">${f.room ? 'in ' + UI.esc(f.room.name) : 'in de lobby'}</span></span>${f.room ? `<button class="pri" data-room="${f.room.id}" style="flex:0;padding:3px 10px">Meedoen</button>` : ''}</div>`,
          )
          .join('')
      : (G.social.friends || []).length
        ? 'Geen vrienden online.'
        : 'Nog geen vrienden. Voeg ze toe via 👥 Vrienden en club.';
  fr.querySelectorAll('[data-room]').forEach(b => (b.onclick = () => joinRoom(+b.dataset.room)));
}

/* ---------------- naar een andere kamer (bijv. die van een vriend) */
export function joinRoom(id, then = null) {
  A.unlock();
  G.afterJoin = then;
  if (G.inGame) {
    if (G.roomId === id) return then && runAfterJoin();
    G.afterLeave = { t: 'join', id }; // eerst de huidige kamer uit, daarna erin (zie net.js 'left')
    send({ t: 'leave' });
  } else send({ t: 'join', id });
}
export function runAfterJoin() {
  const a = G.afterJoin;
  G.afterJoin = null;
  if (a?.visit) setTimeout(() => send({ t: 'visit', name: a.visit }), 400);
}

/* ---------------- uitnodigingen */
export function onInvite(m) {
  const pop = $('invitePop'),
    here = G.inGame && m.room && m.room.id === G.roomId;
  const what = m.kind === 'house' ? 'om langs te komen in zijn huis' : `in de kamer ${UI.esc(m.room?.name || '')}`;
  pop.innerHTML = `📨 <b>${UI.esc(m.from)}</b> nodigt je uit ${what}!<div class="row" style="margin-top:8px"><button class="pri" id="invYes">${here ? 'Ga erheen' : 'Meedoen'}</button><button id="invNo">Later</button></div>`;
  pop.classList.remove('hidden');
  A.sfx.ui();
  const close = () => pop.classList.add('hidden');
  $('invYes').onclick = () => {
    close();
    const then = m.kind === 'house' ? { visit: m.from } : null;
    if (here) then && send({ t: 'visit', name: m.from });
    else if (m.room) joinRoom(m.room.id, then);
  };
  $('invNo').onclick = close;
  clearTimeout(onInvite.t);
  onInvite.t = setTimeout(close, 30000);
}

/** Link naar de huidige kamer: wie hem opent, komt na het inloggen direct binnen. */
export function inviteLink() {
  const u = new URL(location.origin + location.pathname);
  if (G.roomId) u.searchParams.set('kamer', G.roomId);
  return u.href;
}
export async function shareLink() {
  const url = inviteLink(),
    text = 'Kom je mee vissen in Visvrienden?';
  try {
    if (navigator.share) return await navigator.share({ title: 'Visvrienden', text, url });
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('🔗 Uitnodigingslink gekopieerd! Plak hem in een bericht aan je vrienden.', 'good');
  } catch {
    prompt('Kopieer deze link en stuur hem naar je vrienden:', url);
  }
}

/* ---------------- knoppen in het paneel 👥 en bij het aquarium */
export function socialAction(d) {
  switch (d.act) {
    case 'socialtab':
      G.socialTab = d.v;
      requestSocial();
      renderPanel();
      return true;
    case 'friendAdd':
      send({ t: 'friendAdd', name: d.name });
      return true;
    case 'friendAddInput': {
      const n = $('friendName')?.value.trim();
      if (n) send({ t: 'friendAdd', name: n });
      return true;
    }
    case 'friendDel':
      send({ t: 'friendDel', name: d.name });
      return true;
    case 'invite':
      send({ t: 'invite', to: d.name, kind: 'room' });
      return true;
    case 'inviteAll':
      send({ t: 'invite', to: '*', kind: 'room' });
      return true;
    case 'inviteHouse':
      send({ t: 'invite', to: '*', kind: 'house' });
      return true;
    case 'gotoRoom':
      joinRoom(+d.id);
      return true;
    case 'visit':
      send({ t: 'visit', name: d.name });
      return true;
    case 'clubCreate':
      send({ t: 'clubCreate', name: $('clubName')?.value || '', tag: $('clubTag')?.value || '' });
      return true;
    case 'clubJoin':
      send({ t: 'clubJoin', key: d.key });
      return true;
    case 'clubLeave':
      if (confirmLeave()) send({ t: 'clubLeave' });
      return true;
    case 'shareLink':
      shareLink();
      return true;
  }
  return false;
}
// tweede klik bevestigt (geen browser-dialoog, die blokkeert het spel)
let leaveAt = 0;
function confirmLeave() {
  if (Date.now() - leaveAt < 4000) return true;
  leaveAt = Date.now();
  toast('Klik nog een keer op Verlaten om de club te verlaten.', 'warn');
  return false;
}
