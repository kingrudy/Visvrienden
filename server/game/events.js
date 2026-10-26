// Room-methodes voor wat er in de wereld gebeurt: weer, reigers, de reizende verkoper en viswedstrijden.
import * as S from '../../public/js/shared.js';
import { CFG } from './rules.js';
import { r1, rnd, isWeekend } from './util.js';
const { PONDS, SP } = S;

const AUTO_CONTEST_MS = 30 * 60000; // in het weekend elk halfuur een toernooi

/** @this {import('./room.js').Room} */
export const events = {
  resetEvents() {
    this.weather = 'clear';
    this.weatherUntil = rnd(60, 150);
    this.heron = PONDS.map(p => ({ ang: p.entry + 2.4 + rnd(-0.6, 0.6), until: rnd(30, CFG.heronRelocate) }));
    this.merchant = null;
    this.merchantAt = rnd(120, 300);
    this.contest = null;
    this.contestCdUntil = 0;
    this.autoSlot = -1;
  },
  updateEvents(dt) {
    this.updateWeather(dt);
    this.updateMerchant();
    this.updateHerons(dt);
    if (this.contest && Date.now() > this.contest.end) this.endContest();
    if (!this.contest && isWeekend()) {
      const slot = Math.floor(Date.now() / AUTO_CONTEST_MS);
      if (slot !== this.autoSlot) {
        this.autoSlot = slot;
        this.startContest(null, true);
      }
    }
  },

  /* ---------------- weer */
  updateWeather(dt) {
    if ((this.weatherUntil -= dt) > 0) return;
    const r = Math.random();
    this.weather = r < 0.5 ? 'clear' : r < 0.75 ? 'rain' : r < 0.9 ? 'fog' : 'storm';
    this.weatherUntil = rnd(CFG.weatherMin, CFG.weatherMax);
    this.broadcast({ t: 'wx', w: this.weather });
  },

  /* ---------------- reigers: staan aan de oever en verhuizen af en toe */
  heronPos(pond) {
    const h = this.heron[pond];
    return h ? S.shorePoint(PONDS[pond], h.ang, 1.2) : null;
  },
  updateHerons(dt) {
    for (const h of this.heron)
      if ((h.until -= dt) <= 0) {
        h.ang = Math.random() * Math.PI * 2;
        h.until = rnd(60, CFG.heronRelocate);
      }
  },

  /* ---------------- reizende verkoper */
  merchantInfo() {
    const m = this.merchant;
    return m ? { x: r1(m.x), z: r1(m.z), pond: m.pond, items: m.items, left: Math.round(m.until - this.t) } : null;
  },
  updateMerchant() {
    if (this.merchant && this.t > this.merchant.until) {
      this.merchant = null;
      this.broadcast({ t: 'merchant', m: null });
      this.feed('De reizende verkoper is weer vertrokken.', 'info');
    }
    if (this.merchant || this.t <= this.merchantAt) return;
    const pond = PONDS[Math.floor(Math.random() * 6)],
      pt = S.shorePoint(pond, pond.entry + 1.9, 9);
    const items = [...S.TRAVEL_ITEMS].sort(() => Math.random() - 0.5).slice(0, 4);
    this.merchant = { x: pt.x, z: pt.z, pond: pond.id, until: this.t + CFG.merchantStay, items, sold: {} };
    this.merchantAt = this.t + CFG.merchantEvery + rnd(0, 120);
    this.broadcast({ t: 'merchant', m: this.merchantInfo() });
    this.feed(`🧳 De reizende verkoper staat bij de ${pond.name}! (4 minuten)`, 'rare');
  },

  /* ---------------- wedstrijd: zwaarste vis in 5 minuten */
  contestInfo() {
    const c = this.contest;
    if (!c) return null;
    const top = Object.values(c.best)
      .sort((a, b) => b.w - a.w)
      .slice(0, 5)
      .map(b => ({ name: b.name, w: b.w, sp: b.sp }));
    return { left: Math.max(0, Math.round((c.end - Date.now()) / 1000)), top, weekend: c.weekend };
  },
  startContest(P, auto) {
    if (this.contest) return P && this.toast(P, 'Er loopt al een wedstrijd.', 'warn');
    if (!auto && Date.now() < this.contestCdUntil)
      return this.toast(P, `Wacht nog ${Math.ceil((this.contestCdUntil - Date.now()) / 60000)} minuut voor een nieuwe wedstrijd.`, 'warn');
    const weekend = isWeekend();
    this.contest = { end: Date.now() + S.CONTEST_MS, best: {}, weekend };
    this.contestCdUntil = Date.now() + S.CONTEST_COOLDOWN_MS;
    this.feed(
      `🏆 ${auto ? 'Weekend-toernooi' : 'Wedstrijd'} gestart! Vang in 5 minuten de zwaarste vis.${weekend ? ' (Dubbele prijzen!)' : ''}`,
      'rare',
    );
    this.broadcast({ t: 'contest', c: this.contestInfo() });
  },
  endContest() {
    const c = this.contest;
    this.contest = null;
    const ranks = Object.entries(c.best).sort((a, b) => b[1].w - a[1].w),
      prizes = CFG.contestPrizes,
      mult = c.weekend ? 2 : 1;
    ranks.slice(0, 3).forEach(([pid, b], i) => {
      const P = this.players.get(+pid);
      if (!P) return;
      P.save.coins += prizes[i] * mult;
      P.save.rep += (20 - i * 7) * mult;
      if (i === 0) {
        P.save.stats.contestWins++;
        if (c.weekend) P.save.trophies++;
        this.checkAch(P);
      }
      this.toast(P, `Je werd #${i + 1} in de wedstrijd! +${prizes[i] * mult} munten`, 'good');
      this.dirty(P);
    });
    const win = ranks[0]?.[1];
    this.feed(
      win
        ? `🏆 Wedstrijd afgelopen! Winnaar: ${win.name} met ${SP[win.sp].name} van ${S.fmtKg(win.w)}.`
        : '🏆 Wedstrijd afgelopen. Niemand ving iets!',
      'rare',
    );
    this.broadcast({ t: 'contest', c: null });
  },
};
