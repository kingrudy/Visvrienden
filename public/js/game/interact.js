// Interactie in de wereld: winkels, kampvuur, prikbord, hekken, aquarium, voertuigen, aas wisselen en ruilen.
import * as S from '../shared.js';
import { PONDS, SP, RARITY, BAITS } from '../shared.js';
import * as UI from '../ui/html.js';
import * as A from '../audio.js';
import { nearHouseAq } from './houses.js';
import { toast, updateHotbar } from './hud.js';
import { openPanel } from './panels.js';
import { $, G, me, send } from './state.js';

/* ------------------------------------------------------------------ voertuigen en interactie */
export function toggleVehicle() {
  if (me.fs) return toast('Haal eerst je lijn binnen (X).', 'warn');
  const s = G.save;
  const order = ['walk', 'bike', 'scooter'].filter(m => m === 'walk' || s.mounts[m]);
  if (order.length === 1) return toast('Je hebt nog geen fiets of scooter. Die koop je bij de Hengelwinkel.', 'warn');
  if (me.mount === 'boat') return toast('Stap eerst uit de boot (B).', 'warn');
  const i = order.indexOf(me.mount);
  send({ t: 'mount', m: order[(i + 1) % order.length] });
}
export function toggleBoat() {
  if (me.mount === 'boat') send({ t: 'mount', m: 'walk' });
  else send({ t: 'mount', m: 'boat' });
}
export function cycleBait(d) {
  const list = BAITS.filter(b => (G.save.baits[b.id] | 0) > 0 || b.id === G.save.bait);
  const i = list.findIndex(b => b.id === G.save.bait);
  const n = list[(i + d + list.length) % list.length];
  send({ t: 'bait', id: n.id });
  G.save.baits[n.id] |= 0;
  G.save.bait = n.id;
  updateHotbar();
}
export function findInteract() {
  let best = null,
    bd = 1e9;
  const x = me.x,
    z = me.z,
    cons = (kind, o, r, text) => {
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < r && d < bd) {
        bd = d;
        best = { kind, o, text };
      }
    };
  for (const sh of S.SHOPS) cons('shop', sh, S.SHOP_RANGE, '🛒 ' + sh.name);
  for (const c of S.CAMPFIRES) cons('fire', c, 7, '🔥 Kampvuur · vis bakken voor een bonus');
  cons('board', { x: 10, z: 22 }, 6, '📌 Prikbord · wedstrijden en geruchten');
  for (const g of S.GATES) cons('gate', g, 12, `🚧 Hek: ${PONDS[g.pond].name}`);
  if (G.merchant) cons('travel', G.merchant, 9, '🧳 Reizende verkoper');
  const aq = nearHouseAq();
  if (aq && bd > 3) {
    best = { kind: 'aq', o: aq, text: `🐠 Aquarium van ${aq.info.n}${aq.info.d ? ' · 🐕 ' + aq.info.d : ''}` };
  }
  return best;
}
export function interact() {
  const it = G.interact;
  if (!it) return;
  A.sfx.ui();
  if (it.kind === 'shop') openPanel('shop', { shop: it.o, tab: UI.shopTabs(it.o)[0] });
  else if (it.kind === 'fire') openPanel('bag');
  else if (it.kind === 'board') openPanel('board');
  else if (it.kind === 'gate') openPanel('quests');
  else if (it.kind === 'aq') openPanel('aq', { slot: it.o.info.s });
  else if (it.kind === 'travel')
    openPanel('shop', { shop: { type: 'travel', name: 'Reizende verkoper', ...G.merchant }, tab: 'Aanbod', items: G.merchant.items });
}
/* ------------------------------------------------------------------ ruilen */
export function showOffer(m) {
  const o = $('offer'),
    sp = SP[m.fish.sp];
  G.offer = m.oid;
  o.innerHTML = `<b>${UI.esc(m.from)}</b> biedt je een <b style="color:${RARITY[sp.rar].c}">${UI.esc(sp.name)}</b> (${S.fmtKg(m.fish.w)}) aan voor ${m.price ? '<b class="price">🪙 ' + m.price + '</b>' : '<b>niks (cadeau)</b>'}.<div class="row" style="margin-top:8px"><button class="pri" id="ofY">Accepteren</button><button id="ofN">Nee</button></div>`;
  o.classList.remove('hidden');
  const done = ok => {
    send({ t: 'offerReply', oid: m.oid, ok });
    o.classList.add('hidden');
  };
  $('ofY').onclick = () => done(true);
  $('ofN').onclick = () => done(false);
  setTimeout(() => {
    if (G.offer === m.oid) o.classList.add('hidden');
  }, 30000);
}
