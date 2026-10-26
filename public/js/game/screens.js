// Schermen buiten het spel: laden, inloggen/registreren en de lobby met kamers.
import * as S from '../shared.js';
import { PONDS, SP, SPECIES } from '../shared.js';
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { api, connect } from './net.js';
import { openPanel } from './panels.js';
import { $, BUILD, G, send, store } from './state.js';

export function showScreen(name) {
  for (const s of ['auth', 'lobby', 'game']) $(s).classList.toggle('hidden', s !== name);
  $('boot').classList.add('hidden');
  if (name === 'lobby') refreshLobby();
}
export function toastGlobal(msg, kind = 'info') {
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.textContent = msg;
  $('toasts').appendChild(d);
  setTimeout(() => d.remove(), 4500);
  if ($('game').classList.contains('hidden')) {
    const m = $('authMsg');
    if (m && !$('auth').classList.contains('hidden')) m.textContent = msg;
  }
}
/* ------------------------------------------------------------------ inloggen en lobby */
async function doAuth(kind) {
  const username = $('user').value.trim(),
    password = $('pass').value;
  $('authMsg').textContent = '';
  try {
    const r = await api('/api/' + kind, { username, password });
    if (r.err) {
      $('authMsg').textContent = r.err;
      return;
    }
    G.token = r.token;
    store.set('token', r.token);
    send({ t: 'auth', token: r.token, build: BUILD });
  } catch {
    $('authMsg').textContent = 'Geen verbinding met de server.';
  }
}
$('btnLogin').onclick = () => doAuth('login');
$('btnReg').onclick = () => doAuth('register');
$('pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doAuth('login');
});
$('btnOut').onclick = () => {
  G.token = null;
  store.set('token', null);
  try {
    G.ws.close();
  } catch {}
  G.ws = null;
  showScreen('auth');
  setTimeout(connect, 100);
};
$('btnQuick').onclick = () => {
  A.unlock();
  send({ t: 'quick' });
};
$('btnCreate').onclick = () => {
  A.unlock();
  send({ t: 'create', name: $('newName').value, max: +$('newMax').value });
};
export function renderRooms() {
  $('rooms').innerHTML = G.rooms.length
    ? G.rooms
        .map(
          r =>
            `<div class="rm"><div style="flex:1"><b>${UI.esc(r.name)}</b> ${r.permanent ? '' : '<span class="tag">eigen</span>'}<br><small>${r.players}/${r.max} spelers${r.names?.length ? ' · ' + r.names.map(UI.esc).join(', ') : ''} · ${S.WEATHERS[r.weather] || ''}${r.contest ? ' · 🏆 wedstrijd' : ''}</small></div><button class="pri" data-room="${r.id}" style="flex:0">Meedoen</button></div>`,
        )
        .join('')
    : '<div class="note">Geen kamers.</div>';
  $('rooms')
    .querySelectorAll('[data-room]')
    .forEach(
      b =>
        (b.onclick = () => {
          A.unlock();
          send({ t: 'join', id: +b.dataset.room });
        }),
    );
}
export function refreshLobby() {
  const s = G.save;
  $('lobName').textContent = `Hoi ${G.name}!`;
  $('lobInfo').textContent = `Niveau ${s.lvl} · 🪙 ${s.coins} · ${Object.keys(s.book).length}/${SPECIES.length} soorten gevangen`;
  $('looks').innerHTML = ['🧢', '🎩', '👒', '🧥']
    .map((e, i) => `<button class="${s.look === i ? 'on' : ''}" data-look="${i}">${e}</button>`)
    .join('');
  $('looks')
    .querySelectorAll('button')
    .forEach(
      b =>
        (b.onclick = () => {
          send({ t: 'look', v: +b.dataset.look });
          G.save.look = +b.dataset.look;
          refreshLobby();
        }),
    );
  const fs = S.featuredSpecies();
  $('lobMap').innerHTML =
    `<div class="note" style="margin-bottom:6px">⭐ Vis van de week: <b>${UI.esc(fs.name)}</b> (${UI.esc(PONDS[fs.pond].name)}), extra kans en 1,5× waarde</div>` +
    PONDS.map(p => {
      const list = S.speciesOf(p.id),
        got = list.filter(x => s.book[x.id]).length,
        open = !p.req || s.unlocked.includes(p.id),
        hid = p.secret && !s.disc.includes(p.id) && !got;
      return `<div class="lbrow" style="opacity:${open || got ? 1 : 0.5}"><span>${hid ? '🔮 ???' : (open ? '🌊 ' : '🔒 ') + UI.esc(p.name)}</span><span>${got}/${list.length}</span></div>`;
    }).join('');
  renderRooms();
  api('/api/leaderboard')
    .then(lb => {
      $('lb').innerHTML = lb.heaviest.length
        ? lb.heaviest
            .slice(0, 6)
            .map(
              (x, i) =>
                `<div class="lbrow"><span>${i + 1}. ${UI.esc(x.name)}</span><span>${S.fmtKg(x.v)} ${UI.esc(SP[x.sp]?.name || '')}</span></div>`,
            )
            .join('')
        : 'Nog niemand heeft gevangen. Wees de eerste!';
    })
    .catch(() => {});
}
document.querySelectorAll('[data-pn]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.pn)));
