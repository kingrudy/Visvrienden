// Room-methodes voor de economie en sociale dingen: winkels, verkopen, bakken bij het kampvuur, chat en ruilen.
import * as S from '../../public/js/shared.js';
import { CFG } from './rules.js';
import { clamp, rnd, pick, strHash } from './util.js';
const { SP, BAIT, BAITS, RODS, UPGRADES, MOUNTS, BUFFS } = S;

const TRADE_RANGE = 18,
  TRADE_ACCEPT_RANGE = 24;

/** @this {import('./room.js').Room} */
export const economy = {
  nearShop(P, types) {
    return S.SHOPS.find(sh => types.includes(sh.type) && Math.hypot(sh.x - P.x, sh.z - P.z) <= S.SHOP_RANGE + 2) || null;
  },
  /** Korting door reputatie: 2% per 50 punten, max. 20%. */
  discount(P) {
    return 1 - Math.min(0.2, Math.floor(P.save.rep / 50) * 0.02);
  },
  pay(P, cost) {
    if (P.save.coins < cost) {
      this.toast(P, 'Te weinig munten.', 'warn');
      return false;
    }
    P.save.coins -= cost;
    return true;
  },
  buy(P, m) {
    const [kind, id] = String(m.item).split(':'),
      shop = BUY[kind];
    if (!shop) return;
    if (shop.at && !this.nearShop(P, shop.at)) return this.toast(P, shop.away, 'warn');
    if (shop.buy.call(this, P, id, m, this.discount(P)) !== false) this.dirty(P);
  },
  sell(P, m) {
    if (!this.nearShop(P, ['main', 'kiosk', 'smith'])) return this.toast(P, 'Verkopen kan bij een winkel of kiosk.', 'warn');
    const s = P.save,
      ids = new Set(m.all ? s.inv.map(f => f.id) : Array.isArray(m.ids) ? m.ids.map(Number) : []);
    const mult = 1 + 0.04 * s.talents.handelaar,
      featured = S.featuredSpecies().id;
    let total = 0,
      n = 0;
    s.inv = s.inv.filter(f => {
      if (!ids.has(f.id)) return true;
      total += Math.round(S.fishValue(SP[f.sp], f.w) * mult * (f.sp === featured ? S.FEATURED_PRICE : 1));
      n++;
      return false;
    });
    if (!n) return;
    s.coins += total;
    s.stats.sold += n;
    this.quest(P, 'sell', n);
    this.toast(P, `${n} vis verkocht voor ${total} munten.`, 'good');
    this.checkAch(P);
    this.dirty(P);
  },
  /** Vis bakken bij een kampvuur geeft een tijdelijke bonus (welke hangt af van de soort). */
  cook(P, m) {
    if (!S.CAMPFIRES.some(c => Math.hypot(c.x - P.x, c.z - P.z) <= S.SHOP_RANGE))
      return this.toast(P, 'Ga bij een kampvuur staan.', 'warn');
    const s = P.save,
      i = s.inv.findIndex(f => f.id === (m.id | 0));
    if (i < 0) return;
    const f = s.inv.splice(i, 1)[0],
      sp = SP[f.sp],
      keys = Object.keys(BUFFS);
    const buff = keys[strHash(sp.id) % keys.length],
      mins = 3 + Math.min(7, f.w * 0.8);
    s.buffs[buff] = Math.max(Date.now(), s.buffs[buff] || 0) + mins * 60000;
    s.stats.cooked++;
    this.addXp(P, 10 + sp.rar * 8);
    this.quest(P, 'cook', 1);
    this.toast(
      P,
      `Je bakt ${sp.name} en eet hem op. ${BUFFS[buff].icon} ${BUFFS[buff].name}-bonus voor ${Math.round(mins)} minuten!`,
      'good',
    );
    this.broadcast({ t: 'ev', k: 'eat', id: P.id });
    this.dirty(P);
  },
  say(P, m) {
    const text = String(m.text || '')
      .replace(/[\u0000-\u001f<>]/g, '')
      .trim()
      .slice(0, 120);
    if (!text) return;
    if (Date.now() - P.chatAt < 500) return;
    P.chatAt = Date.now();
    this.broadcast({ t: 'chat', id: P.id, name: P.name, text });
  },

  /* ---------------- ruilen: speler A biedt een vis aan, speler B accepteert of weigert */
  offer(P, m) {
    const to = this.players.get(m.to | 0),
      s = P.save;
    if (!to || to === P) return;
    const f = s.inv.find(x => x.id === (m.fid | 0));
    if (!f) return;
    if (Math.hypot(to.x - P.x, to.z - P.z) > TRADE_RANGE) return this.toast(P, 'Die speler staat te ver weg.', 'warn');
    const price = clamp(m.price | 0, 0, 100000),
      oid = this.nextOffer++;
    this.offers.set(oid, { from: P.id, to: to.id, fid: f.id, price, at: Date.now() });
    this.send(to, { t: 'offer', oid, from: P.name, fish: f, price });
    this.toast(P, `Aanbod gestuurd aan ${to.name}.`, 'info');
  },
  offerReply(P, m) {
    const o = this.offers.get(m.oid | 0);
    if (!o || o.to !== P.id) return;
    this.offers.delete(m.oid | 0);
    const A = this.players.get(o.from);
    if (!A) return this.toast(P, 'De verkoper is weg.', 'warn');
    if (!m.ok) return this.toast(A, `${P.name} wil niet.`, 'info');
    const i = A.save.inv.findIndex(f => f.id === o.fid);
    if (i < 0) return this.toast(P, 'Die vis is er niet meer.', 'warn');
    if (P.save.coins < o.price) return this.toast(P, 'Te weinig munten.', 'warn');
    if (P.save.inv.length >= S.INV_MAX) return this.toast(P, 'Je visnet is vol.', 'warn');
    if (Math.hypot(A.x - P.x, A.z - P.z) > TRADE_ACCEPT_RANGE) return this.toast(P, 'Jullie staan te ver uit elkaar.', 'warn');
    const f = A.save.inv.splice(i, 1)[0];
    f.id = P.save.nextId++;
    P.save.inv.push(f);
    P.save.coins -= o.price;
    A.save.coins += o.price;
    this.toast(A, `${P.name} kocht je ${SP[f.sp].name}${o.price ? ' voor ' + o.price + ' munten' : ' (cadeau)'}.`, 'good');
    this.toast(P, `Je kreeg een ${SP[f.sp].name} (${S.fmtKg(f.w)}).`, 'good');
    this.dirty(A);
    this.dirty(P);
  },
};

/* ---------------- winkelaanbod: per soort artikel waar je het koopt en wat er gebeurt.
   buy() geeft false terug als er niets veranderd is. 'this' is de Room. */
const BUY = {
  bait: {
    at: ['main', 'kiosk'],
    away: 'Ga naar een winkel of kiosk.',
    buy(P, id, m, disc) {
      const s = P.save,
        b = BAIT[id];
      if (!b) return false;
      const packs = clamp(m.qty | 0 || 1, 1, 9);
      if ((s.baits[id] | 0) + packs * S.BAIT_PACK > 99) {
        this.toast(P, 'Zoveel aas kun je niet dragen (max. 99).', 'warn');
        return false;
      }
      if (!this.pay(P, Math.round(b.price * packs * disc))) return false;
      s.baits[id] += packs * S.BAIT_PACK;
      this.toast(P, `${packs * S.BAIT_PACK}x ${b.name} gekocht.`, 'good');
    },
  },
  rod: {
    at: ['main'],
    away: 'Hengels koop je bij de Hengelwinkel in het dorp.',
    buy(P, id, m, disc) {
      const s = P.save,
        r = RODS[id | 0];
      if (!r || s.rods.owned.includes(r.id)) return false;
      if (!this.pay(P, Math.round(r.price * disc))) return false;
      s.rods.owned.push(r.id);
      s.rods.active = r.id;
      s.rods.dur[r.id] = 100;
      this.toast(P, `${r.name} gekocht!`, 'good');
      this.sendPinfo(P);
    },
  },
  mount: {
    at: ['main'],
    away: 'Voertuigen koop je bij de Hengelwinkel in het dorp.',
    buy(P, id, m, disc) {
      const s = P.save,
        mt = MOUNTS[id];
      if (!mt || s.mounts[id]) return false;
      if (!this.pay(P, Math.round(mt.price * disc))) return false;
      s.mounts[id] = true;
      this.toast(P, `${mt.name} gekocht!`, 'good');
    },
  },
  dog: {
    at: ['main'],
    away: 'Een hond adopteer je bij de Hengelwinkel.',
    buy(P, id, m, disc) {
      const s = P.save;
      if (s.dog) return false;
      if (!this.pay(P, Math.round(S.DOG_PRICE * disc))) return false;
      s.dog = { name: pick(CFG.dogNames) };
      this.sendHouse(P);
      this.toast(P, `Je hebt ${s.dog.name} geadopteerd! Hij graaft wormen op en jaagt reigers weg.`, 'good');
      this.sendPinfo(P);
    },
  },
  upg: {
    at: ['smith'],
    away: 'Upgrades doet Hengelsmid Marga.',
    buy(P, id, m, disc) {
      const s = P.save,
        U = UPGRADES[id];
      if (!U || s.upg[id] >= U.max) return false;
      if (!this.pay(P, Math.round(S.upgradeCost(id, s.upg[id]) * disc))) return false;
      s.upg[id]++;
      this.toast(P, `${U.name} verbeterd naar niveau ${s.upg[id]}.`, 'good');
    },
  },
  repair: {
    at: ['smith'],
    away: 'Repareren doet Hengelsmid Marga.',
    buy(P, id, m, disc) {
      const s = P.save,
        dur = s.rods.dur[s.rods.active] ?? 100;
      if (dur >= 100) return false;
      if (!this.pay(P, Math.round((100 - dur) * (1 + s.rods.active) * 1.2 * disc))) return false;
      s.rods.dur[s.rods.active] = 100;
      this.toast(P, 'Hengel gerepareerd.', 'good');
    },
  },
  travel: {
    // reizende verkoper: geen vaste winkel, zelf de afstand controleren
    buy(P, id) {
      const s = P.save,
        mer = this.merchant;
      if (!mer || Math.hypot(mer.x - P.x, mer.z - P.z) > S.SHOP_RANGE + 3) {
        this.toast(P, 'Ga naar de reizende verkoper.', 'warn');
        return false;
      }
      const it = mer.items.find(i => i.id === id);
      if (!it || mer.sold[P.id + id]) return false;
      if (!this.pay(P, it.price)) return false;
      if (it.buff) s.buffs[it.buff] = Math.max(Date.now(), s.buffs[it.buff] || 0) + it.min * 60000;
      else if (it.bait) s.baits[it.bait] = Math.min(99, (s.baits[it.bait] | 0) + it.qty);
      else if (it.id === 't_kist') {
        const got = [];
        for (let i = 0; i < 3; i++) {
          const b = pick(BAITS);
          s.baits[b.id] = Math.min(99, s.baits[b.id] + 10);
          got.push(b.name);
        }
        const c = Math.round(rnd(80, 600));
        s.coins += c;
        this.toast(P, `In de kist: 10x ${got.join(', 10x ')} en ${c} munten!`, 'good');
      }
      mer.sold[P.id + id] = 1;
      if (!it.id.includes('kist')) this.toast(P, `${it.name} gekocht.`, 'good');
    },
  },
};
