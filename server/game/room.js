// Autoritatieve spelsimulatie voor één kamer. De methodes staan per onderwerp in aparte bestanden:
//   fishing.js  vissen in de vijvers, werpen, aanbeet, drillen, vangst en beloningen
//   economy.js  winkel, verkopen, bakken, chat en ruilen
//   events.js   weer, reizende verkoper, reigers, wedstrijden en de reuzenvis
import * as S from '../../public/js/shared.js';
import { CFG } from './rules.js';
import { r1, r2, rnd, isWeekend } from './util.js';
import { ensureSave, houseInfo, applyTalent, resetTalents, levelInfo } from './progress.js';
import { fishing } from './fishing.js';
import { economy } from './economy.js';
import { events } from './events.js';
import { boss } from './boss.js';
const { PONDS, BAIT, BAITS, RODS, UPGRADES, ACHIEVEMENTS, QUEST_KINDS } = S;

const MOUNT_CODE = { walk: 0, bike: 1, scooter: 2, boat: 3 };
const MOUNT_SPEED = { walk: 9, bike: 11, scooter: 16, boat: 7 }; // maximale snelheid voor de anti-valsspeelcontrole
const EMOTES = ['wave', 'laugh', 'thumb', 'fish'];

export class Room {
  /**
   * @param {object} services (allemaal optioneel)
   *   markDirty: opslaan aanvragen · houses: alle huizen (voor nieuwe spelers) · cheats: dev-commando's toestaan
   *   clubTag(user): clubafkorting · onCatch(user, soort, kg) en onRelease(user): tellen mee voor club en dagdoel
   */
  constructor(id, name, max, permanent, services = {}) {
    this.id = id;
    this.name = name;
    this.max = max;
    this.permanent = permanent;
    this.markDirty = services.markDirty || (() => {});
    this.houses = services.houses || (() => []);
    this.cheats = services.cheats ?? process.env.ALLOW_CHEATS === '1';
    this.clubTag = services.clubTag || (() => '');
    this.onCatch = services.onCatch || (() => {});
    this.onRelease = services.onRelease || (() => {});
    this.players = new Map();
    this.nextPid = 1;
    this.reset();
  }
  reset() {
    this.t = 0;
    this.tick = 0;
    this.emptySince = Date.now();
    this.resetFish();
    this.resetEvents();
    this.resetBoss();
    this.offers = new Map();
    this.nextOffer = 1;
  }
  get summary() {
    return {
      id: this.id,
      name: this.name,
      players: this.players.size,
      max: this.max,
      permanent: this.permanent,
      weather: this.weather,
      contest: !!this.contest,
      names: [...this.players.values()].map(p => p.name).slice(0, 8),
    };
  }
  get tc() {
    return S.timeClass(S.dayPhase());
  }

  /* ---------------- spelers */
  /** @param {{ x?: number, z?: number }} opts startplek (bijv. na opnieuw verbinden) */
  addPlayer(conn, opts = {}) {
    const u = conn.user,
      save = ensureSave(u),
      now = Date.now();
    const back = Number.isFinite(opts.x) && Number.isFinite(opts.z) && S.walkable(opts.x, opts.z);
    const x = back ? opts.x : S.SPAWN.x + rnd(-2, 2),
      z = back ? opts.z : S.SPAWN.z + rnd(-2, 2);
    const P = {
      id: this.nextPid++,
      conn,
      user: u,
      save,
      name: u.name,
      x,
      z,
      ry: Math.PI,
      mount: 'walk',
      lastPos: now,
      lastOk: { x, z },
      tpAt: 0,
      fs: 0,
      bx: 0,
      bz: 0,
      pond: -1,
      waitT: 0,
      rollT: 0,
      hintT: 0,
      chase: null,
      biteT: 0,
      fight: null,
      pending: null,
      reel: false,
      lastCatch: null,
      dirty: true,
      dirtyAt: 0,
      dogT: rnd(60, CFG.dogDigEvery),
      chatAt: 0,
      emoteAt: 0,
    };
    this.players.set(P.id, P);
    this.emptySince = null;
    conn.send({
      t: 'joined',
      id: P.id,
      room: this.summary,
      now,
      save: P.save,
      weather: this.weather,
      merchant: this.merchantInfo(),
      players: [...this.players.values()].map(q => this.pinfo(q)),
      contest: this.contestInfo(),
      weekend: isWeekend(),
      featured: S.featuredSpecies().id,
      houses: this.houses(),
      you: { x: r1(x), z: r1(z) },
      boss: this.bossInfo(),
    });
    this.broadcast({ t: 'pinfo', p: this.pinfo(P) }, P);
    this.feed(back ? `${P.name} is terug.` : `${P.name} is komen vissen.`, 'info', P);
    return P;
  }
  removePlayer(P) {
    this.endFish(P, true);
    this.players.delete(P.id);
    this.broadcast({ t: 'pgone', id: P.id });
    this.markDirty();
    if (!this.players.size) this.emptySince = Date.now();
  }
  pinfo(P) {
    return {
      id: P.id,
      name: P.name,
      look: P.save.look,
      rod: P.save.rods.active,
      dog: P.save.dog?.name || null,
      lvl: P.save.lvl,
      mount: P.mount,
      club: this.clubTag(P.user),
    };
  }
  sendPinfo(P) {
    this.broadcast({ t: 'pinfo', p: this.pinfo(P) });
  }
  sendHouse(P) {
    if (P.save.house >= 0) this.broadcast({ t: 'house', h: houseInfo(P.save, P.name) });
  }

  /* ---------------- berichten */
  send(P, o) {
    P.conn.send(o);
  }
  broadcast(o, except) {
    const s = JSON.stringify(o);
    for (const P of this.players.values()) if (P !== except) P.conn.send(s);
  }
  toast(P, msg, kind = 'info') {
    this.send(P, { t: 'toast', msg, kind });
  }
  feed(msg, kind = 'info', except) {
    this.broadcast({ t: 'feed', msg, kind }, except);
  }
  dirty(P) {
    P.dirty = true;
  }

  /* ---------------- voortgang */
  addXp(P, n) {
    const s = P.save,
      before = s.lvl;
    s.xp += n;
    s.lvl = levelInfo(s.xp).level;
    if (s.lvl > before) {
      this.send(P, { t: 'levelup', lvl: s.lvl });
      this.feed(`${P.name} is nu niveau ${s.lvl}!`, 'info', P);
      this.checkAch(P);
    }
    this.dirty(P);
  }
  checkUnlocks(P) {
    const s = P.save;
    for (const p of PONDS) {
      if (!p.req || s.unlocked.includes(p.id)) continue;
      const ps = s.stats.pond[p.req.from];
      if (!ps) continue;
      if (ps.n >= p.req.catches && Object.keys(ps.sp).length >= p.req.species) {
        s.unlocked.push(p.id);
        this.send(P, { t: 'unlocked', pond: p.id });
        this.feed(`${P.name} ontgrendelde de ${p.name}!`, 'rare', P);
        this.checkAch(P);
        this.dirty(P);
      }
    }
  }
  checkAch(P) {
    const s = P.save;
    for (const a of ACHIEVEMENTS)
      if (!s.ach[a.id] && a.test(s)) {
        s.ach[a.id] = Date.now();
        this.send(P, { t: 'ach', id: a.id });
        this.feed(`${P.name} behaalde "${a.name}"`, 'info', P);
        this.dirty(P);
      }
  }
  quest(P, kind, n, ex = {}) {
    for (const q of P.save.daily.q) {
      if (q.done || q.kind !== kind) continue;
      if (kind === 'heavy') {
        if (ex.w >= q.n) q.p = q.n;
        else continue;
      } else if (kind === 'species') {
        if (ex.sp === q.sp) q.p += n;
        else continue;
      } else q.p += n;
      if (q.p >= q.n) {
        q.p = q.n;
        q.done = true;
        P.save.coins += q.coins;
        this.toast(P, `Opdracht klaar: ${QUEST_KINDS[q.kind].text(q.n, q.sp)}! +${q.coins} munten`, 'good');
        this.addXp(P, q.xp);
      }
      this.dirty(P);
    }
  }

  /* ---------------- berichten van spelers */
  handle(P, m) {
    switch (m.t) {
      case 'pos':
        return this.onPos(P, m);
      case 'cast':
        return this.cast(P, m);
      case 'hook':
        return this.hook(P);
      case 'reel':
        P.reel = !!m.on;
        return;
      case 'cancel':
        return this.cancel(P);
      case 'keep':
        return this.keepFish(P, m.fid | 0, true);
      case 'release':
        return this.keepFish(P, m.fid | 0, false);
      case 'bait':
        if (BAIT[m.id]) {
          P.save.bait = m.id;
          this.dirty(P);
        }
        return;
      case 'equip': {
        const r = m.rod | 0;
        if (P.save.rods.owned.includes(r) && !P.fs) {
          P.save.rods.active = r;
          this.dirty(P);
          this.sendPinfo(P);
        }
        return;
      }
      case 'buy':
        return this.buy(P, m);
      case 'sell':
        return this.sell(P, m);
      case 'cook':
        return this.cook(P, m);
      case 'mount':
        return this.setMount(P, String(m.m));
      case 'say':
        return this.say(P, m);
      case 'home':
        return this.goHome(P);
      case 'emote':
        return this.emote(P, m);
      case 'offer':
        return this.offer(P, m);
      case 'offerReply':
        return this.offerReply(P, m);
      case 'contest':
        return this.startContest(P);
      case 'look': {
        const l = m.v | 0;
        if (l >= 0 && l <= 3) {
          P.save.look = l;
          this.dirty(P);
          this.sendPinfo(P);
        }
        return;
      }
      case 'talent':
        if (applyTalent(P.save, String(m.id))) this.dirty(P);
        return;
      case 'retalent':
        resetTalents(P.save);
        this.dirty(P);
        return;
      case 'visit':
        return this.visit(P, String(m.name || ''));
      case 'deco':
        return this.setDeco(P, String(m.id), !!m.on);
      case 'dev':
        return this.dev(P, m);
    }
  }
  emote(P, m) {
    if (!EMOTES.includes(m.k) || Date.now() - P.emoteAt < 1500) return;
    P.emoteAt = Date.now();
    const lc = m.k === 'fish' ? P.lastCatch : null;
    this.broadcast({ t: 'emote', id: P.id, k: m.k, sp: lc ? lc.sp : '', w: lc ? lc.w : 0 });
  }
  goHome(P) {
    const h = S.HOUSE_SLOTS[P.save.house];
    if (!h) return this.toast(P, 'Je hebt nog geen huis.', 'warn');
    if (P.fs || P.mount !== 'walk') return this.toast(P, 'Haal eerst je lijn binnen en stap af.', 'warn');
    this.tp(P, h.x, h.z - S.HOUSE_D / 2 - 2.2, 'Je staat voor je huis.');
  }
  /** Naar het huis van een andere speler (bijv. na een uitnodiging). */
  visit(P, name) {
    const h = this.houses().find(x => x.n.toLowerCase() === name.toLowerCase()),
      slot = h && S.HOUSE_SLOTS[h.s];
    if (!slot) return this.toast(P, 'Dat huis bestaat niet.', 'warn');
    if (P.fs || P.mount !== 'walk') return this.toast(P, 'Haal eerst je lijn binnen en stap af.', 'warn');
    this.tp(P, slot.x, slot.z - S.HOUSE_D / 2 - 2.2, `Je staat voor het huis van ${h.n}.`);
  }
  /** Inrichting neerzetten of opbergen. */
  setDeco(P, id, on) {
    if (!(id in P.save.deco)) return;
    P.save.deco[id] = on;
    this.dirty(P);
    this.sendHouse(P);
  }
  /** Alleen voor testen: start de server met ALLOW_CHEATS=1. */
  dev(P, m) {
    if (!this.cheats) return;
    const s = P.save;
    if (m.unlock) {
      s.unlocked = S.ZONE_PONDS.map(p => p.id);
      s.disc = PONDS.filter(p => p.secret).map(p => p.id);
    }
    if (m.coins) s.coins += m.coins | 0;
    if (m.xp) this.addXp(P, m.xp | 0);
    if (m.book) {
      for (const sp of S.SPECIES.slice(0, m.book | 0)) s.book[sp.id] = s.book[sp.id] || { n: 2, best: sp.w[1] * 0.6, first: Date.now() };
      s.dog = s.dog || { name: 'Bobbel' };
      this.sendHouse(P);
    }
    if (m.give) {
      for (const b of BAITS) s.baits[b.id] = 60;
      s.mounts = { bike: true, scooter: true, boat: true };
      s.dog = s.dog || { name: 'Bobbel' };
      s.rods.owned = RODS.map(r => r.id);
      this.sendPinfo(P);
    }
    if (m.rod != null) {
      s.rods.active = m.rod | 0;
      this.sendPinfo(P);
    }
    if (m.weather) {
      this.weather = m.weather;
      this.weatherUntil = 9999;
      this.broadcast({ t: 'wx', w: this.weather });
    }
    if (m.tp) {
      P.mount = m.boat ? 'boat' : 'walk';
      this.tp(P, +m.tp[0], +m.tp[1], null);
      this.send(P, { t: 'mount', m: P.mount });
      this.sendPinfo(P);
    }
    if (m.upg) for (const k of Object.keys(UPGRADES)) s.upg[k] = UPGRADES[k].max;
    if (m.contest) {
      this.contestCdUntil = 0;
      this.startContest(P);
    }
    if (m.boss) this.spawnBoss(m.boss === true ? null : m.boss | 0);
    if (m.deco) for (const d of S.DECOR) s.deco[d.id] = true;
    if (m.deco) this.sendHouse(P);
    this.dirty(P);
  }

  /* ---------------- lopen, varen en voertuigen */
  onPos(P, m) {
    const x = +m.x,
      z = +m.z,
      ry = +m.ry;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const now = Date.now(),
      dt = Math.min(1, (now - P.lastPos) / 1000);
    P.lastPos = now;
    const maxMove = MOUNT_SPEED[P.mount] * CFG.maxSpeedMul * Math.max(dt, 0.05) + 3,
      moved = Math.hypot(x - P.x, z - P.z);
    const W = S.WORLD,
      bad = moved > maxMove || x < W.minX || x > W.maxX || z < W.minZ || z > W.maxZ || !S.walkable(x, z, P.mount === 'boat');
    if (bad) return this.tp(P, P.lastOk.x, P.lastOk.z, null);
    // gesloten gebieden
    for (const p of S.ZONE_PONDS) {
      if (P.save.unlocked.includes(p.id)) continue;
      const dx = x - p.x,
        dz = z - p.z,
        d = Math.hypot(dx, dz);
      if (d < p.zr) {
        const need = `${PONDS[p.req.from].name}: vang ${p.req.catches} vissen (minstens ${p.req.species} soorten)`;
        return this.tp(P, p.x + (dx / d) * (p.zr + 1.5), p.z + (dz / d) * (p.zr + 1.5), `Het hek naar de ${p.name} is dicht. ${need}.`);
      }
    }
    P.x = x;
    P.z = z;
    if (Number.isFinite(ry)) P.ry = ry;
    P.lastOk = { x, z };
    // verborgen vijvers ontdekken
    for (const p of PONDS)
      if (p.secret && !P.save.disc.includes(p.id) && Math.hypot(x - p.x, z - p.z) < 45) {
        P.save.disc.push(p.id);
        this.send(P, { t: 'discover', pond: p.id });
        this.addXp(P, 120);
        this.checkAch(P);
        this.dirty(P);
        this.feed(`${P.name} ontdekte de ${p.name}!`, 'rare', P);
      }
  }
  tp(P, x, z, msg) {
    P.x = x;
    P.z = z;
    P.lastOk = { x, z };
    P.lastPos = Date.now();
    if (Date.now() - P.tpAt > 1500 || !msg) {
      P.tpAt = Date.now();
      this.send(P, { t: 'tp', x: r1(x), z: r1(z), msg });
    }
    if (P.fs) this.endFish(P);
  }
  place(P, pt) {
    P.x = pt.x;
    P.z = pt.z;
    P.lastOk = { x: pt.x, z: pt.z };
    this.send(P, { t: 'tp', x: r1(pt.x), z: r1(pt.z) });
  }
  setMount(P, m) {
    const s = P.save;
    if (P.fs) return this.toast(P, 'Haal eerst je lijn binnen.', 'warn');
    if (m === 'walk') {
      if (P.mount === 'boat') {
        const pt = S.findNear(P.x, P.z, (a, b) => S.walkable(a, b, false), 16);
        if (!pt) return this.toast(P, 'Geen oever in de buurt. Roei dichter naar de kant.', 'warn');
        this.place(P, pt);
      }
    } else if (m === 'bike' || m === 'scooter') {
      if (!s.mounts[m]) return this.toast(P, 'Je hebt dit voertuig niet.', 'warn');
      if (P.mount === 'boat') return this.toast(P, 'Stap eerst uit de boot.', 'warn');
    } else if (m === 'boat') {
      if (!s.mounts.boat) return this.toast(P, 'Je hebt geen roeiboot. Koop er een in de winkel.', 'warn');
      if (P.mount === 'boat') return;
      const pt = S.findNear(P.x, P.z, (a, b) => S.walkable(a, b, true), 9);
      if (!pt) return this.toast(P, 'Ga bij de waterkant staan om in te stappen.', 'warn');
      this.place(P, pt);
    } else return;
    P.mount = m;
    this.sendPinfo(P);
    this.send(P, { t: 'mount', m: P.mount });
  }

  /* ---------------- hoofdlus (20× per seconde) */
  update(dt) {
    this.t += dt;
    this.tick++;
    this.updateEvents(dt);
    this.updateBoss(dt);
    this.updateFish(dt);
    this.maintainFish(dt);
    for (const P of this.players.values()) {
      this.updateFishing(P, dt);
      this.updatePending(P);
      if (P.save.dog && (P.dogT -= dt) <= 0) {
        P.dogT = CFG.dogDigEvery;
        P.save.baits.worm = Math.min(99, P.save.baits.worm + 3);
        this.toast(P, `${P.save.dog.name} heeft 3 wormen opgegraven!`, 'good');
        this.dirty(P);
      }
    }
    if (this.tick % 2 === 0)
      this.broadcast({
        t: 's',
        ps: [...this.players.values()].map(P => [
          P.id,
          r1(P.x),
          r1(P.z),
          r2(P.ry),
          MOUNT_CODE[P.mount],
          P.fs,
          r1(P.bx),
          r1(P.bz),
          P.fight ? Math.round(P.fight.D) : 0,
        ]),
      });
    if (this.tick % 4 === 0) for (const P of this.players.values()) this.send(P, { t: 'f', ponds: this.fishNear(P) });
    if (this.tick % 20 === 0) {
      const ci = this.contestInfo();
      if (ci) this.broadcast({ t: 'contest', c: ci });
      for (const [id, o] of this.offers) if (Date.now() - o.at > 30000) this.offers.delete(id);
    }
    const now = Date.now();
    for (const P of this.players.values())
      if (P.dirty && now - P.dirtyAt > 400) {
        P.dirty = false;
        P.dirtyAt = now;
        this.send(P, { t: 'save', save: P.save });
        this.markDirty();
      }
  }
}
Object.assign(Room.prototype, fishing, economy, events, boss);
