// Visvrienden – menu's en panelen (alleen HTML, de acties lopen via data-act attributen).
import * as S from './shared.js';
const { PONDS, SPECIES, SP, RARITY, BAITS, BAIT, RODS, UPGRADES, MOUNTS, TALENTS, BUFFS, ACHIEVEMENTS, QUEST_KINDS } = S;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export { esc };

/* ---- vis tekenen (canvas -> dataURL, onthouden) */
const imgCache = new Map();
export function fishImg(spId, sil = false) {
  const key = spId + (sil ? '!' : ''); if (imgCache.has(key)) return imgCache.get(key);
  const sp = SP[spId], c = document.createElement('canvas'); c.width = 200; c.height = 110; const x = c.getContext('2d');
  const [c1, c2, c3] = sp.c, sh = { slank: [1, .26], rond: [.78, .46], plat: [.72, .58], lang: [1.15, .22], snoek: [1.15, .22], paling: [1.35, .1], kat: [1, .3] }[sp.shape] || [1, .26];
  const L = 70 * sh[0] + 14, H = 44 * sh[1] * 1.6, cx = 100, cy = 56;
  x.translate(cx, cy);
  x.fillStyle = c3; x.beginPath(); x.moveTo(-L * .78, 0); x.lineTo(-L * 1.12, -H * .8); x.quadraticCurveTo(-L * .98, 0, -L * 1.12, H * .8); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(-L * .2, -H * .85); x.quadraticCurveTo(0, -H * 1.5, L * .3, -H * .8); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(-L * .1, H * .8); x.lineTo(-L * .35, H * 1.25); x.lineTo(L * .08, H * .85); x.closePath(); x.fill();
  const g = x.createLinearGradient(0, -H, 0, H); g.addColorStop(0, c1); g.addColorStop(.62, c1); g.addColorStop(.63, c2); g.addColorStop(1, c2);
  x.fillStyle = g; x.beginPath(); x.moveTo(-L * .8, 0); x.quadraticCurveTo(-L * .35, -H * 1.1, L * .45, -H * .5); x.quadraticCurveTo(L * 1.02, -H * .1, L * 1.0, H * .08); x.quadraticCurveTo(L * .5, H * 1.1, -L * .3, H * .95); x.quadraticCurveTo(-L * .65, H * .6, -L * .8, 0); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; x.stroke();
  x.beginPath(); x.moveTo(L * .45, -H * .5); x.quadraticCurveTo(L * .4, 0, L * .5, H * .7); x.strokeStyle = 'rgba(0,0,0,.3)'; x.stroke();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(L * .72, -H * .16, H * .2, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(L * .75, -H * .16, H * .11, 0, 7); x.fill();
  if (sp.shape === 'kat') { x.strokeStyle = '#222'; x.lineWidth = 2; x.beginPath(); x.moveTo(L * .98, H * .1); x.quadraticCurveTo(L * 1.2, H * .3, L * 1.15, H * .7); x.moveTo(L * .98, H * .1); x.quadraticCurveTo(L * 1.2, -H * .1, L * 1.25, H * .2); x.stroke(); }
  if (sp.leg) { x.strokeStyle = 'rgba(255,215,90,.55)'; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 0, L * 1.25, H * 1.9, 0, 0, 7); x.stroke(); }
  const url = c.toDataURL(); imgCache.set(key, url); return url;
}

const kg = S.fmtKg;
const rcol = r => RARITY[r].c;
const pips = (n, max) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const disc = save => 1 - Math.min(0.2, Math.floor(save.rep / 50) * 0.02);
const money = n => `🪙 ${n}`;
const fishRow = (f, extra = '') => { const sp = SP[f.sp]; return `<div class="item"><img src="${fishImg(f.sp)}" style="width:64px;height:36px;object-fit:contain"><div class="mid"><b style="color:${rcol(sp.rar)}">${esc(sp.name)}</b><small>${kg(f.w)} · ${esc(PONDS[sp.pond].name)}</small></div>${extra}</div>`; };

/* ---------------- winkel */
export function shopTabs(shop) { return shop.type === 'main' ? ['Aas', 'Hengels', 'Voertuigen', 'Hond', 'Verkopen'] : shop.type === 'smith' ? ['Upgrades', 'Repareren', 'Verkopen'] : shop.type === 'travel' ? ['Aanbod'] : ['Aas', 'Verkopen']; }
export function shopHTML(save, shop, tab, ctx) {
  const tabs = shopTabs(shop), d = disc(save);
  let h = `<div class="note" style="margin-bottom:8px">${esc(shop.name)} · jij hebt <b class="price">${money(save.coins)}</b>${d < 1 ? ` · reputatiekorting ${Math.round((1 - d) * 100)}%` : ''}</div>`;
  h += `<div class="tabs">${tabs.map(t => `<button class="${t === tab ? 'on' : ''}" data-act="shoptab" data-v="${t}">${t}</button>`).join('')}</div>`;
  if (tab === 'Aas') h += BAITS.map(b => `<div class="item"><div class="ic">${b.icon}</div><div class="mid"><b>${b.name}</b><small>${b.desc}</small></div><div class="note">Je hebt ${save.baits[b.id] | 0}</div><button data-act="buy" data-item="bait:${b.id}" class="price">10 stuks · ${Math.round(b.price * d)}</button></div>`).join('');
  else if (tab === 'Hengels') h += RODS.map(r => { const own = save.rods.owned.includes(r.id), act = save.rods.active === r.id; return `<div class="item"><div class="ic" style="color:${r.color}">🎣</div><div class="mid"><b>${r.name}</b><small>Werpafstand ${r.cast} m · lijnsterkte ${r.line} · inhalen ×${r.reel} · beet ×${r.bite}</small></div>${act ? '<span class="tag">in gebruik</span>' : own ? `<button data-act="equip" data-rod="${r.id}">Pak</button>` : `<button data-act="buy" data-item="rod:${r.id}" class="price">${Math.round(r.price * d)}</button>`}</div>`; }).join('');
  else if (tab === 'Voertuigen') h += Object.entries(MOUNTS).map(([id, m]) => `<div class="item"><div class="ic">${m.icon}</div><div class="mid"><b>${m.name}</b><small>${m.desc}</small></div>${save.mounts[id] ? '<span class="tag">van jou</span>' : `<button data-act="buy" data-item="mount:${id}" class="price">${Math.round(m.price * d)}</button>`}</div>`).join('');
  else if (tab === 'Hond') h += `<div class="item"><div class="ic">🐕</div><div class="mid"><b>Een trouwe hond</b><small>Loopt met je mee, graaft elke paar minuten wormen op en jaagt reigers weg die je vis willen stelen.</small></div>${save.dog ? `<span class="tag">${esc(save.dog.name)}</span>` : `<button data-act="buy" data-item="dog" class="price">${Math.round(S.DOG_PRICE * d)}</button>`}</div>`;
  else if (tab === 'Upgrades') h += Object.entries(UPGRADES).map(([k, U]) => { const l = save.upg[k]; return `<div class="item"><div class="ic">${{ reel: '⚙️', line: '🧵', float: '🔴', sonar: '📡' }[k]}</div><div class="mid"><b>${U.name}</b> ${pips(l, U.max)}<small>${U.desc}</small></div>${l >= U.max ? '<span class="tag">max</span>' : `<button data-act="buy" data-item="upg:${k}" class="price">${Math.round(S.upgradeCost(k, l) * d)}</button>`}</div>`; }).join('');
  else if (tab === 'Repareren') { const dur = save.rods.dur[save.rods.active] ?? 100, rod = RODS[save.rods.active], c = Math.round((100 - dur) * (1 + rod.id) * 1.2 * d); h += `<div class="item"><div class="ic" style="color:${rod.color}">🎣</div><div class="mid"><b>${rod.name}</b><small>Slijtage: ${Math.round(dur)}% heel${dur < 30 ? ' · de lijn is verzwakt!' : ''}</small><div class="pbar"><i style="width:${dur}%"></i></div></div>${dur >= 100 ? '<span class="tag">als nieuw</span>' : `<button data-act="buy" data-item="repair" class="price">Repareer ${c}</button>`}</div><div class="note">Een gebroken lijn maakt je hengel 12% slechter. Onder 30% wordt je lijn zwakker, bij 0% werkt hij niet meer.</div>`; }
  else if (tab === 'Verkopen') {
    const mult = 1 + 0.04 * save.talents.handelaar, tot = save.inv.reduce((a, f) => a + Math.round(S.fishValue(SP[f.sp], f.w) * mult), 0);
    h += save.inv.length ? `<div class="row" style="margin-bottom:8px"><button class="pri" data-act="sellall">Alles verkopen · ${money(tot)}</button></div>` + save.inv.map(f => fishRow(f, `<button data-act="sell" data-id="${f.id}" class="price">${Math.round(S.fishValue(SP[f.sp], f.w) * mult)}</button>`)).join('') : '<div class="note">Je visnet is leeg. Ga vissen!</div>';
  } else if (tab === 'Aanbod') h += (ctx.items || []).map(it => `<div class="item"><div class="ic">${it.icon}</div><div class="mid"><b>${it.name}</b><small>${it.desc}</small></div><button data-act="buy" data-item="travel:${it.id}" class="price">${it.price}</button></div>`).join('') + '<div class="note">Alles is er maar één keer per speler. De verkoper vertrekt snel weer!</div>';
  return h;
}

/* ---------------- tas */
export function bagHTML(save, ctx) {
  const now = Date.now(); let h = '';
  h += `<div class="sec"><span>🪣 Visnet (${save.inv.length}/${S.INV_MAX})</span><span class="note">verkopen bij een winkel, bakken bij een kampvuur</span></div>`;
  h += save.inv.length ? save.inv.map(f => fishRow(f, `<button data-act="cook" data-id="${f.id}">🔥 Bak</button><button data-act="offerform" data-id="${f.id}">🤝 Aanbieden</button>`)).join('') : '<div class="note">Leeg. Gevangen vis die je behoudt komt hier.</div>';
  h += `<div class="sec"><span>🪱 Aas</span><span class="note">kies met 1-9 of [ ]</span></div><div class="grid">${BAITS.map(b => `<div class="fc ${save.bait === b.id ? '' : ''}" style="border-color:${save.bait === b.id ? 'var(--acc)' : 'var(--line)'};cursor:pointer" data-act="bait" data-id="${b.id}"><span style="font-size:24px">${b.icon}</span><b>${b.name}</b>${save.baits[b.id] | 0} stuks</div>`).join('')}</div>`;
  h += `<div class="sec"><span>🎣 Hengels</span></div>${save.rods.owned.map(id => { const r = RODS[id]; return `<div class="item"><div class="ic" style="color:${r.color}">🎣</div><div class="mid"><b>${r.name}</b><small>Slijtage ${Math.round(save.rods.dur[id] ?? 100)}%</small></div>${save.rods.active === id ? '<span class="tag">in gebruik</span>' : `<button data-act="equip" data-rod="${id}">Pak</button>`}</div>`; }).join('')}`;
  const buffs = Object.keys(BUFFS).filter(k => (save.buffs[k] || 0) > now);
  h += `<div class="sec"><span>✨ Bonussen</span></div>` + (buffs.length ? buffs.map(k => `<div class="item"><div class="ic">${BUFFS[k].icon}</div><div class="mid"><b>${BUFFS[k].name}</b><small>${BUFFS[k].desc}</small></div><span class="tag">${Math.ceil((save.buffs[k] - now) / 60000)} min</span></div>`).join('') : '<div class="note">Geen. Bak een vis op een kampvuur voor een bonus!</div>');
  h += `<div class="sec"><span>🚲 Voertuigen en hond</span></div><div class="note">${Object.entries(MOUNTS).map(([id, m]) => `${m.icon} ${m.name}: ${save.mounts[id] ? 'ja' : 'nee'}`).join(' · ')} · 🐕 ${save.dog ? esc(save.dog.name) : 'geen hond'}</div>`;
  return h;
}

/* ---------------- visboek */
export function bookHTML(save) {
  const have = Object.keys(save.book).length;
  let h = `<div class="note">Je hebt <b>${have}</b> van de <b>${SPECIES.length}</b> soorten gevangen. Zwaarste vis ooit: ${save.stats.best ? `${kg(save.stats.best)} (${esc(SP[save.stats.bestSp]?.name || '')})` : '-'}</div><div class="pbar"><i style="width:${have / SPECIES.length * 100}%"></i></div>`;
  for (const p of PONDS) {
    const list = SPECIES.filter(s => s.pond === p.id), got = list.filter(s => save.book[s.id]).length, hidden = p.secret && !save.disc.includes(p.id) && !got;
    h += `<div class="sec"><span>${p.secret ? '🔮' : '🌊'} ${hidden ? '???' : esc(p.name)}</span><span class="note">${got}/${list.length}</span></div><div class="grid">`;
    for (const s of list) { const b = save.book[s.id]; h += `<div class="fc ${b ? '' : 'un'}" style="border-color:${b ? rcol(s.rar) : 'var(--line)'}"><img src="${fishImg(s.id, !b)}"><b>${b ? esc(s.name) : '???'}</b>${b ? `${b.n}× · ${kg(b.best)}` : `<span style="color:${rcol(s.rar)}">${RARITY[s.rar].n}</span>`}</div>`; }
    h += '</div>';
  }
  return h;
}

/* ---------------- opdrachten */
export function questsHTML(save) {
  let h = `<div class="sec"><span>📋 Dagelijkse opdrachten</span><span class="note">elke dag nieuwe</span></div>`;
  h += save.daily.q.map(q => `<div class="item"><div class="ic">${q.done ? '✅' : '🎯'}</div><div class="mid"><b>${esc(QUEST_KINDS[q.kind].text(q.n, q.sp))}</b><div class="pbar"><i style="width:${q.p / q.n * 100}%"></i></div><small>${q.p}/${q.n} · beloning 🪙 ${q.coins} + ${q.xp} xp</small></div></div>`).join('');
  h += `<div class="sec"><span>🔓 Nieuwe vijvers</span></div>`;
  for (const p of S.ZONE_PONDS) {
    const open = save.unlocked.includes(p.id), prev = PONDS[p.req.from], ps = save.stats.pond[p.req.from] || { n: 0, sp: {} }, ns = Object.keys(ps.sp).length;
    h += `<div class="item"><div class="ic">${open ? '🔓' : '🔒'}</div><div class="mid"><b>${esc(p.name)}</b>${open ? '<small>Open!</small>' : `<small>Vang ${p.req.catches} vissen in de ${esc(prev.name)} (nu ${Math.min(ps.n, p.req.catches)}) en minstens ${p.req.species} soorten (nu ${Math.min(ns, p.req.species)}).</small><div class="pbar"><i style="width:${Math.min(1, (Math.min(ps.n, p.req.catches) / p.req.catches + Math.min(ns, p.req.species) / p.req.species) / 2) * 100}%"></i></div>`}</div></div>`;
  }
  const secrets = PONDS.filter(p => p.secret);
  h += `<div class="sec"><span>🔮 Verborgen vijvers</span></div><div class="note">${secrets.map(p => save.disc.includes(p.id) ? `✔ ${esc(p.name)} ontdekt` : '❓ Nog een geheime vijver te vinden. Vraag aan het prikbord naar geruchten.').join('<br>')}</div>`;
  return h;
}

/* ---------------- talenten en prestaties */
export function talentsHTML(save) {
  const spent = Object.values(save.talents).reduce((a, b) => a + b, 0), pts = save.lvl - 1 - spent, xpNeed = save.lvl >= S.MAX_LEVEL ? null : S.levelNeed(save.lvl);
  let h = `<div class="note">Niveau <b>${save.lvl}</b> · ${pts > 0 ? `<b class="price">${pts} talentpunt${pts > 1 ? 'en' : ''} te verdelen</b>` : 'geen punten over'} · elk niveau geeft een punt (tot niveau ${S.MAX_LEVEL}).</div>`;
  h += Object.entries(TALENTS).map(([id, t]) => `<div class="item"><div class="mid"><b>${t.name}</b> ${pips(save.talents[id], S.TALENT_MAX)}<small>${t.desc}</small></div><button data-act="talent" data-id="${id}" ${pts > 0 && save.talents[id] < S.TALENT_MAX ? '' : 'disabled'}>＋</button></div>`).join('');
  h += `<div style="margin-top:10px"><button data-act="retalent">↺ Opnieuw verdelen (gratis)</button></div>`;
  return h;
}
export function achHTML(save) {
  const n = ACHIEVEMENTS.filter(a => save.ach[a.id]).length;
  return `<div class="note">${n}/${ACHIEVEMENTS.length} behaald${save.trophies ? ` · 🏆 ${save.trophies} toernooi-trofee${save.trophies > 1 ? 'ën' : ''}` : ''}</div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));margin-top:8px">${ACHIEVEMENTS.map(a => `<div class="fc" style="text-align:left;opacity:${save.ach[a.id] ? 1 : .5}"><b>${save.ach[a.id] ? '🏅' : '🔒'} ${esc(a.name)}</b>${esc(a.desc)}</div>`).join('')}</div>`;
}

/* ---------------- spelers, handel, prikbord, ranglijst, instellingen, hulp */
export function playersHTML(save, ctx) {
  const list = ctx.others;
  let h = `<div class="note">Spelers in deze kamer. Binnen 18 meter kun je vis ruilen of verkopen.</div>`;
  h += list.length ? list.map(p => `<div class="item"><div class="mid"><b>${esc(p.name)}</b><small>niveau ${p.lvl} · ${Math.round(p.dist)} m weg${p.dog ? ' · 🐕 ' + esc(p.dog) : ''}</small></div></div>`).join('') : '<div class="note" style="margin:10px 0">Je bent alleen. Nodig je vrienden uit: ze kiezen in de lobby dezelfde kamer.</div>';
  if (list.length && save.inv.length) {
    h += `<div class="sec"><span>🤝 Vis aanbieden</span></div><div class="row"><select id="tradeTo">${list.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><select id="tradeFish">${save.inv.map(f => `<option value="${f.id}" ${ctx.fid === f.id ? 'selected' : ''}>${esc(SP[f.sp].name)} ${kg(f.w)} (waarde ${S.fishValue(SP[f.sp], f.w)})</option>`).join('')}</select></div><div class="row" style="margin-top:8px"><input id="tradePrice" type="number" min="0" max="100000" value="0" placeholder="Prijs (0 = cadeau)"><button class="pri" data-act="offer">Aanbod sturen</button></div>`;
  }
  return h;
}
export function boardHTML(save, ctx) {
  const c = ctx.contest;
  let h = `<div class="sec"><span>🏆 Wedstrijd</span></div>`;
  h += c ? `<div class="item"><div class="mid"><b>Wedstrijd bezig! Nog ${Math.floor(c.left / 60)}:${String(c.left % 60).padStart(2, '0')}</b><small>${c.top.length ? c.top.map((t, i) => `${i + 1}. ${esc(t.name)} ${kg(t.w)}`).join(' · ') : 'Nog geen vangsten.'}</small></div></div>` :
    `<div class="item"><div class="mid"><b>Wie vangt de zwaarste vis in 5 minuten?</b><small>Prijzen: 🪙 300 / 150 / 75 + reputatie. ${ctx.weekend ? '<b style="color:var(--acc)">Het is weekend: elk halfuur een toernooi met dubbele prijzen en een trofee!</b>' : 'In het weekend start elk halfuur automatisch een toernooi met dubbele prijzen.'}</small></div><button class="pri" data-act="contest">Start wedstrijd</button></div>`;
  h += `<div class="sec"><span>🗣️ Geruchten</span></div>`;
  const rum = PONDS.filter(p => p.secret && !save.disc.includes(p.id));
  h += rum.length ? rum.map(p => `<div class="item"><div class="ic">🔮</div><div class="mid"><small style="color:var(--txt)">${esc(p.hint)}</small></div></div>`).join('') : '<div class="note">Je kent alle geheimen van deze streek. Goed gedaan!</div>';
  h += `<div class="sec"><span>📈 Ranglijst</span></div><div id="lbBoard" class="note">Laden...</div>`;
  return h;
}
export function lbHTML(lb) {
  const col = (t, arr, f) => `<div style="flex:1;min-width:200px"><b>${t}</b>${arr.length ? arr.map((x, i) => `<div class="lbrow"><span>${i + 1}. ${esc(x.name)}</span><span>${f(x)}</span></div>`).join('') : '<div class="note">-</div>'}</div>`;
  return `<div style="display:flex;gap:16px;flex-wrap:wrap">${col('Zwaarste vis', lb.heaviest, x => `${kg(x.v)} ${esc(SP[x.sp]?.name || '')}`)}${col('Meeste vissen', lb.catches, x => x.v)}${col('Visboek', lb.species, x => x.v + '/' + SPECIES.length)}${col('Niveau', lb.level, x => x.v)}</div>`;
}
export function settingsHTML(st) {
  return `<div class="item"><div class="mid"><b>Graphics</b><small>Herlaad de pagina na het wisselen. Telefoons staan op Laag.</small></div><select id="setQ">${['Laag', 'Middel', 'Hoog'].map((n, i) => `<option value="${i}" ${st.q === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  <div class="item"><div class="mid"><b>Geluid</b></div><input id="setVol" type="range" min="0" max="100" value="${st.vol}"></div>
  <div class="item"><div class="mid"><b>Muisgevoeligheid</b></div><input id="setSens" type="range" min="20" max="200" value="${st.sens}"></div>
  <div class="row" style="margin:12px 0"><button data-act="help">❓ Besturing</button><button data-act="photo">📸 Fotomodus</button></div>
  <div class="row"><button data-act="leave">🚪 Naar de lobby</button><button data-act="close">Verder spelen</button></div>`;
}
export function helpHTML() {
  const k = (a, b) => `<div class="item" style="padding:6px 10px"><b style="min-width:150px;color:var(--acc)">${a}</b><span>${b}</span></div>`;
  return `<div class="sec"><span>⌨️ Toetsenbord en muis</span></div>${k('W A S D / pijltjes', 'lopen (Shift = rennen)')}${k('Muis', 'rondkijken (klik op het spel om de muis vast te zetten)')}${k('Linkermuisknop of spatie', 'werpen · aanslaan als de dobber zakt · ingedrukt houden = inhalen')}${k('E', 'praten, winkel, kampvuur, hek, kar')}${k('X', 'lijn binnenhalen / loslaten')}${k('B', 'in of uit de roeiboot')}${k('V', 'fiets of scooter pakken of wegzetten')}${k('1 - 9, [ en ]', 'ander aas kiezen')}${k('F', 'vis behouden · G = terugzetten (bij de vangstkaart)')}${k('I J O M T H', 'tas · visboek · opdrachten · kaart · talenten · spelers')}${k('Enter', 'chatten')}${k('P', 'fotomodus')}${k('Esc', 'menu')}
  <div class="sec"><span>🎣 Zo vang je een vis</span></div><div class="note">1. Richt op het water en gooi uit. 2. Wacht tot een vis het aas pakt: de dobber zakt en je ziet "Aanslaan!". 3. Klik snel. 4. <b>Houd inhalen ingedrukt terwijl de vis rustig is</b>, en <b>laat los zodra hij gaat trekken</b> (rode waarschuwing). Blijft de spanning te lang op rood, dan knapt je lijn. 5. Behoud of zet terug: terugzetten geeft reputatie en dus korting.<br><br>Vissen zwemmen echt rond: je ziet ze als schaduwen in het water. Elke soort heeft eigen voorkeuren voor aas, dag of nacht en weer. Let op reigers: die stelen je vis als je niet snel kiest, tenzij je een hond hebt.</div>`;
}
