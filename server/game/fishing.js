// Room-methodes voor het vissen: de vissen in de vijvers, werpen, aanbeet, drillen, vangen en behouden/terugzetten.
// Visstatus van een speler (P.fs): 0 = niks, 1 = dobber in het water, 2 = beet (aanslaan!), 3 = drillen.
import * as S from '../../public/js/shared.js';
import { CFG, appeal, legendOk, weightFor, catchXp } from './rules.js';
import { r1, r2, rnd, clamp } from './util.js';
const { PONDS, SPECIES, SP, RARITY, BAIT } = S;

/** @this {import('./room.js').Room} */
export const fishing = {
  /* ---------------- vissen in de vijver */
  resetFish() {
    this.nextFid = 1;
    this.fish = PONDS.map(() => []);
    this.legCd = {};
    this.legT = 0;
    for (const p of PONDS) while (this.fish[p.id].length < p.fish) this.spawnFish(p, null);
  },
  randWater(p) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2,
        d = Math.sqrt(Math.random()) * p.r * 1.1,
        x = p.x + Math.cos(a) * d,
        z = p.z + Math.sin(a) * d;
      if (S.pondWater(x, z) === p.id) return { x, z };
    }
    return { x: p.x, z: p.z };
  },
  /** Nieuwe vis; zonder soort wordt er een gekozen naar zeldzaamheid. */
  spawnFish(p, sp) {
    if (!sp) {
      const list = SPECIES.filter(s => s.pond === p.id && !s.leg);
      let tot = 0;
      for (const s of list) tot += RARITY[s.rar].w;
      let r = Math.random() * tot;
      sp = list[0];
      for (const s of list) {
        r -= RARITY[s.rar].w;
        if (r <= 0) {
          sp = s;
          break;
        }
      }
    }
    const pos = this.randWater(p),
      w = weightFor(sp);
    const f = {
      id: this.nextFid++,
      sp,
      x: pos.x,
      z: pos.z,
      h: Math.random() * 6.28,
      spd: rnd(0.5, 1.1),
      w,
      busy: 0,
      state: 'wander',
      scared: 0,
      tTurn: rnd(1, 4),
      pond: p.id,
    };
    f.str = sp.str * (0.85 + 0.3 * (sp.w[1] > sp.w[0] ? (w - sp.w[0]) / (sp.w[1] - sp.w[0]) : 0.5)); // zwaardere vis = sterker
    this.fish[p.id].push(f);
    return f;
  },
  findFish(id) {
    for (const l of this.fish) for (const f of l) if (f.id === id) return f;
    return null;
  },
  removeFish(f) {
    const l = this.fish[f.pond],
      i = l.indexOf(f);
    if (i >= 0) l.splice(i, 1);
  },
  freeFish(f, scared) {
    if (f) {
      f.busy = 0;
      f.state = 'wander';
      f.scared = scared;
    }
  },
  updateFish(dt) {
    for (const p of PONDS)
      for (const f of this.fish[p.id]) {
        if (f.busy) {
          const P = this.players.get(f.busy);
          if (!P) {
            f.busy = 0;
            f.state = 'wander';
          } else if (f.state === 'chase') {
            const dx = P.bx - f.x,
              dz = P.bz - f.z,
              d = Math.hypot(dx, dz);
            f.h = Math.atan2(dz, dx);
            const s = Math.min(d, 3 * dt);
            f.x += Math.cos(f.h) * s;
            f.z += Math.sin(f.h) * s;
          } else {
            f.x += (P.bx - f.x) * Math.min(1, 6 * dt);
            f.z += (P.bz - f.z) * Math.min(1, 6 * dt);
          }
          continue;
        }
        if (f.scared > 0) f.scared -= dt;
        if ((f.tTurn -= dt) <= 0) {
          f.h += rnd(-1.2, 1.2);
          f.spd = rnd(0.4, 1.2);
          f.tTurn = rnd(1.5, 5);
        }
        const nx = f.x + Math.cos(f.h) * f.spd * dt,
          nz = f.z + Math.sin(f.h) * f.spd * dt;
        if (S.pondWater(nx, nz) === p.id && !S.onJetty(nx, nz)) {
          f.x = nx;
          f.z = nz;
        } else {
          f.h = Math.atan2(p.z - f.z, p.x - f.x) + rnd(-0.8, 0.8);
          f.tTurn = rnd(1, 3);
        }
      }
  },
  /** Elke 4 s: vijvers bijvullen en legendes laten komen/gaan. */
  maintainFish(dt) {
    if ((this.legT -= dt) > 0) return;
    this.legT = 4;
    const tc = this.tc,
      now = Date.now();
    for (const p of PONDS) {
      const list = this.fish[p.id];
      let normal = list.filter(f => !f.sp.leg).length;
      while (normal < p.fish) {
        this.spawnFish(p, null);
        normal++;
      }
      for (const sp of SPECIES) {
        if (!sp.leg || sp.pond !== p.id) continue;
        const idx = list.findIndex(f => f.sp === sp),
          ok = legendOk(sp, tc, this.weather) && now > (this.legCd[sp.id] || 0);
        if (ok && idx < 0) this.spawnFish(p, sp).spd = 0.5;
        else if (!ok && idx >= 0 && !list[idx].busy) list.splice(idx, 1);
      }
    }
  },
  /** Compacte vissenlijst van de vijvers in de buurt van speler P (voor de client). */
  fishNear(P) {
    const ponds = [];
    for (const p of PONDS) {
      if (Math.hypot(P.x - p.x, P.z - p.z) > p.zr + 70) continue;
      const h = this.heronPos(p.id);
      ponds.push([
        p.id,
        r1(h.x),
        r1(h.z),
        this.fish[p.id].map(f => [f.id, f.sp.i, r1(f.x), r1(f.z), r2(f.h), r2(f.w), f.state === 'chase' || f.state === 'bite' ? 1 : 0]),
      ]);
    }
    return ponds;
  },

  /* ---------------- hengelen */
  endFish(P) {
    if (P.chase) {
      const f = this.findFish(P.chase);
      if (f && f.busy === P.id) this.freeFish(f, 30);
    }
    if (P.pending) this.keepFish(P, P.pending.id, true);
    P.fs = 0;
    P.chase = null;
    P.fight = null;
    P.reel = false;
  },
  pondLocked(P, pond) {
    const p = PONDS[pond];
    return !!(p.req && !P.save.unlocked.includes(pond));
  },
  cast(P, m) {
    if (P.fs) return;
    if (P.mount === 'bike' || P.mount === 'scooter') return this.toast(P, 'Stap eerst van je voertuig af om te vissen.', 'warn');
    const rs = S.rodStats(P.save);
    if (rs.broken) return this.toast(P, 'Je hengel is kapot. Laat hem repareren bij Hengelsmid Marga.', 'warn');
    if ((P.save.baits[P.save.bait] | 0) <= 0)
      return this.toast(P, `Je hebt geen ${BAIT[P.save.bait].name.toLowerCase()} meer. Kies ander aas of koop nieuw.`, 'warn');
    const x = +m.x,
      z = +m.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const d = Math.hypot(x - P.x, z - P.z);
    if (d > rs.cast + 3 || d < 1.5) return this.toast(P, d < 1.5 ? 'Te dichtbij.' : 'Te ver weg voor deze hengel.', 'warn');
    const pond = S.pondWater(x, z);
    if (pond < 0) return this.toast(P, 'Richt op het water.', 'warn');
    if (this.pondLocked(P, pond)) return;
    if (P.pending) this.keepFish(P, P.pending.id, true);
    Object.assign(P, { fs: 1, bx: x, bz: z, pond, waitT: 0, rollT: 0.5, chase: null, hintT: 0 });
    this.splash(P, 0);
  },
  splash(P, big) {
    this.broadcast({ t: 'ev', k: 'splash', x: r1(P.bx), z: r1(P.bz), id: P.id, big });
  },
  hook(P) {
    if (P.fs === 2) {
      const f = this.findFish(P.chase);
      if (!f) {
        P.fs = 0;
        return;
      }
      P.fs = 3;
      P.reel = false;
      P.fight = { fid: f.id, T: 28, D: 26 + f.str * 13 + rnd(0, 8), phase: 'rest', pt: rnd(1.2, 2.2), stam: 100, snap: 0, send: 0 };
      f.state = 'fight';
      this.splash(P, 1);
    } else if (P.fs === 1) {
      this.toast(P, 'Te vroeg! Wacht tot de dobber onder gaat.', 'warn');
      this.endFish(P);
    }
  },
  cancel(P) {
    if (P.fs === 3) this.loseFish(P, 'Je hebt de lijn laten schieten.');
    else if (P.fs) this.endFish(P);
  },
  loseFish(P, msg, snap) {
    const F = P.fight;
    if (F) this.freeFish(this.findFish(F.fid), 40);
    if (snap) {
      const rod = P.save.rods.active;
      P.save.rods.dur[rod] = Math.max(0, (P.save.rods.dur[rod] ?? 100) - 12);
      this.dirty(P);
    }
    P.fs = 0;
    P.fight = null;
    P.chase = null;
    P.reel = false;
    this.send(P, { t: 'lost', msg, snap: !!snap });
  },
  updateFishing(P, dt) {
    if (!P.fs) return;
    const rs = S.rodStats(P.save);
    if (Math.hypot(P.x - P.bx, P.z - P.bz) > rs.cast + 6) {
      this.toast(P, 'Je lijn is te ver gespannen. Dobber binnengehaald.', 'warn');
      return P.fs === 3 ? this.loseFish(P, 'De lijn knapte doordat je te ver wegliep.', true) : this.endFish(P);
    }
    if (P.fs === 1) this.updateWaiting(P, dt, rs);
    else if (P.fs === 2) {
      if ((P.biteT -= dt) <= 0) {
        this.freeFish(this.findFish(P.chase), 40);
        P.fs = 0;
        P.chase = null;
        this.send(P, { t: 'lost', msg: 'Te laat! De vis nam het aas mee.' });
      }
    } else if (P.fs === 3) this.updateFight(P, dt);
  },
  /** Dobber ligt in het water: elke seconde kans dat een vis in de buurt komt kijken. */
  updateWaiting(P, dt, rs) {
    P.waitT += dt;
    P.rollT -= dt;
    P.hintT += dt;
    if (P.chase) {
      const f = this.findFish(P.chase);
      if (!f || f.busy !== P.id) P.chase = null;
      else if (Math.hypot(f.x - P.bx, f.z - P.bz) < 0.9) {
        if (Math.random() >= P.save.talents.zuinig * 0.08) P.save.baits[P.save.bait]--; // aas op (Zuinig kan helpen)
        f.state = 'bite';
        P.fs = 2;
        P.biteT = rs.window;
        this.dirty(P);
        return this.splash(P, 0);
      }
    } else if (P.rollT <= 0) {
      P.rollT = 1;
      const tc = this.tc,
        bait = P.save.bait,
        featured = S.featuredSpecies().id;
      for (const f of this.fish[P.pond]) {
        if (f.busy || f.scared > 0) continue;
        if (Math.hypot(f.x - P.bx, f.z - P.bz) > (f.sp.leg ? CFG.legendBiteRadius : CFG.biteRadius)) continue;
        const a = appeal(f.sp, bait, tc, this.weather);
        if (a <= 0) continue;
        const prob = clamp(a * 0.75 * rs.bite * (1 + rs.luck * 0.07 * f.sp.rar) * (f.sp.id === featured ? S.FEATURED_BITE : 1), 0, 0.9);
        if (Math.random() < prob) {
          f.busy = P.id;
          f.state = 'chase';
          P.chase = f.id;
          break;
        }
      }
    }
    if (P.hintT > 40 && !P.chase) {
      P.hintT = -1e9;
      this.toast(P, 'Het blijft stil... Probeer ander aas, een andere plek of een ander moment van de dag.', 'info');
    }
  },
  /** Drillen: de vis wisselt rusten, waarschuwen en trekken af. Inhalen terwijl hij trekt laat de lijn knappen. */
  updateFight(P, dt) {
    const F = P.fight,
      f = this.findFish(F.fid);
    if (!f) return this.loseFish(P, 'De vis is weg.');
    const rs = S.rodStats(P.save),
      sf = F.stam / 100,
      pullF = f.str * 20 * (60 / rs.line);
    if ((F.pt -= dt) <= 0) {
      if (F.phase === 'rest') {
        F.phase = 'warn';
        F.pt = 0.5;
      } else if (F.phase === 'warn') {
        F.phase = 'run';
        F.pt = (1 + Math.random() * 1.2) * (0.5 + 0.5 * sf);
      } else {
        F.phase = 'rest';
        F.pt = (1.2 + Math.random() * 1.6) * (1.1 - Math.min(0.4, f.str * 0.1));
      }
    }
    const reeling = P.reel;
    const target =
      F.phase === 'run'
        ? reeling
          ? 80 + pullF * (0.6 + 0.4 * sf)
          : 38 + pullF * 0.25 * sf
        : F.phase === 'warn'
          ? reeling
            ? 62
            : 12
          : reeling
            ? 52 + pullF * 0.15
            : 8;
    F.T += (target - F.T) * (1 - Math.exp(-4 * dt)); // spanning op de lijn
    if (F.phase === 'run') {
      F.D += (reeling ? 1.5 : 4 + pullF * 0.2 * (0.5 + 0.5 * sf)) * dt; // afstand tot de vis
      F.stam = Math.max(10, F.stam - 9 * (f.str / 3 + 0.6) * dt);
    } else {
      if (reeling) F.D -= 9 * rs.reel * (1 + (1 - sf) * 0.7) * dt;
      F.stam = Math.min(100, F.stam + 1.5 * dt);
    }
    if (F.T >= 100) F.snap += dt;
    else F.snap = Math.max(0, F.snap - dt * 0.8);
    if (F.snap > 0.55) return this.loseFish(P, 'De lijn knapte! Laat de lijn vieren als de vis trekt.', true);
    if (F.D >= 100) return this.loseFish(P, 'De vis rukte zich los en is weg.');
    if (F.D <= 0) return this.landFish(P, f);
    if ((F.send -= dt) <= 0) {
      F.send = 0.1;
      this.send(P, { t: 'fight', T: r1(F.T), D: r1(F.D), ph: F.phase, st: Math.round(F.stam), fid: f.sp.i, w: f.w });
    }
  },

  /* ---------------- vangst */
  landFish(P, f) {
    const sp = f.sp,
      s = P.save,
      tc = this.tc;
    this.removeFish(f);
    if (sp.leg) this.legCd[sp.id] = Date.now() + CFG.legendRespawn * 1000;
    P.fs = 0;
    P.fight = null;
    P.chase = null;
    P.reel = false;
    const fish = { sp: sp.id, w: f.w, pond: sp.pond, t: Date.now() };
    P.lastCatch = { sp: sp.id, w: f.w };
    const newSp = !s.book[sp.id],
      rec = newSp || s.book[sp.id].best < f.w;
    this.recordCatch(P, sp, f.w, tc);
    if (newSp) this.sendHouse(P);
    const xp = catchXp(sp, f.w);
    this.addXp(P, xp);
    this.quest(P, 'catch', 1);
    this.quest(P, 'heavy', 1, { w: f.w });
    this.quest(P, 'species', 1, { sp: sp.id });
    if (tc === 'nacht') this.quest(P, 'night', 1);
    if (sp.rar >= 2) this.quest(P, 'rare', 1);
    if (this.contest) {
      const b = this.contest.best[P.id];
      if (!b || f.w > b.w) this.contest.best[P.id] = { w: f.w, sp: sp.id, name: P.name };
    }
    // zonder hond kan een reiger in de buurt de vis stelen als je te lang twijfelt
    const h = !s.dog && this.heronPos(sp.pond),
      heron = !!h && Math.hypot(h.x - P.x, h.z - P.z) < 38;
    P.pending = { fish, id: s.nextId++, at: Date.now(), heron, xp };
    this.send(P, { t: 'catch', fish, fid: P.pending.id, xp, rec, heron, rarity: sp.rar, ms: heron ? CFG.heronCardMs : CFG.catchCardMs });
    this.splash(P, 1);
    if (sp.rar >= 3 || f.w >= 10)
      this.feed(`${P.name} ving ${sp.leg ? 'de legendarische ' : 'een '}${sp.name} van ${S.fmtKg(f.w)}!`, sp.leg ? 'legend' : 'rare', P);
    this.checkUnlocks(P);
    this.checkAch(P);
    this.dirty(P);
  },
  /** Visboek en statistieken bijwerken. */
  recordCatch(P, sp, w, tc) {
    const s = P.save,
      B = s.book[sp.id] || (s.book[sp.id] = { n: 0, best: 0, first: Date.now() });
    B.n++;
    if (w > B.best) B.best = w;
    const st = s.stats;
    st.catches++;
    st.totalKg = r2(st.totalKg + w);
    if (w > st.best) {
      st.best = w;
      st.bestSp = sp.id;
    }
    if (sp.rar >= 2) st.rareCatches++;
    if (sp.rar >= 3) st.epicCatches++;
    if (sp.leg) st.legCatches++;
    if (tc === 'nacht') st.nightCatches++;
    if (this.weather === 'storm') st.stormCatches++;
    const ps = st.pond[sp.pond] || (st.pond[sp.pond] = { n: 0, sp: {} });
    ps.n++;
    ps.sp[sp.id] = 1;
  },
  keepFish(P, fid, keep) {
    const pd = P.pending;
    if (!pd || pd.id !== fid) return;
    const s = P.save,
      sp = SP[pd.fish.sp];
    P.pending = null;
    if (keep && s.inv.length >= S.INV_MAX) {
      this.toast(P, 'Je visnet is vol! Verkoop vis bij een kiosk of winkel. Deze vis is teruggezet.', 'warn');
      keep = false;
    }
    if (keep) {
      s.inv.push({ id: pd.id, sp: pd.fish.sp, w: pd.fish.w, pond: pd.fish.pond, t: pd.fish.t });
      this.toast(P, `${sp.name} (${S.fmtKg(pd.fish.w)}) zit in je visnet.`, 'good');
    } else {
      const rp = 1 + sp.rar * 2 + (sp.leg ? 10 : 0);
      s.stats.released++;
      s.rep += rp;
      this.addXp(P, Math.round(pd.xp * 0.4));
      this.quest(P, 'release', 1);
      this.toast(P, `${sp.name} teruggezet. +${rp} reputatie.`, 'good');
      this.checkAch(P);
    }
    this.dirty(P);
  },
  /** Vangstkaart verloopt: reiger steelt de vis, of hij gaat automatisch in het visnet. */
  updatePending(P) {
    const pd = P.pending;
    if (!pd) return;
    const age = Date.now() - pd.at;
    if (pd.heron && age > CFG.heronCardMs) {
      P.pending = null;
      this.send(P, { t: 'stolen' });
      this.toast(P, `Een reiger griste je ${SP[pd.fish.sp].name} weg! Een hond zou hem hebben verjaagd.`, 'bad');
      this.broadcast({ t: 'ev', k: 'heron', pond: pd.fish.pond, id: P.id });
      return;
    }
    if (age > CFG.catchCardMs) this.keepFish(P, pd.id, true);
  },
};
