// Room-methodes voor de reuzenvis: een baasvis die je met de hele kamer samen binnenhaalt.
// Iedereen die hem aan de haak heeft, haalt zijn kracht omlaag door in te halen als hij niet trekt.
// Is zijn kracht op, dan krijgt iedereen die meehielp de beloning. Na 5 minuten zwemt hij weg.
import * as S from '../../public/js/shared.js';
import { CFG } from './rules.js';
import { r1, rnd } from './util.js';
const { PONDS, SPECIES } = S;

/** @this {import('./room.js').Room} */
export const boss = {
  resetBoss() {
    this.boss = null;
    this.bossAt = rnd(...CFG.bossFirst);
  },
  /** De vijver waar de meeste spelers zijn (en die voor hen open is). */
  bossPond() {
    const count = PONDS.map(() => 0);
    for (const P of this.players.values()) {
      const p = S.nearestPond(P.x, P.z);
      if (!this.pondLocked(P, p)) count[p]++;
    }
    const best = count.indexOf(Math.max(...count));
    return count[best] > 0 ? best : 0;
  },
  spawnBoss(pond = null) {
    const p = PONDS[pond ?? this.bossPond()],
      pt = this.randWater(p);
    // de reus is een extra grote versie van de zwaarste gewone soort in deze vijver
    const sp = SPECIES.filter(s => s.pond === p.id && !s.leg).sort((a, b) => b.w[1] - a.w[1])[0];
    const hp = CFG.bossHp[0] + CFG.bossHp[1] * Math.max(1, this.players.size);
    this.boss = { pond: p.id, x: pt.x, z: pt.z, h: 0, sp, hp, max: hp, until: this.t + CFG.bossStay, fighters: new Map(), str: 4.5 };
    this.feed(`🐋 Een REUZENVIS is gezien in de ${p.name}! Vang hem samen binnen 5 minuten.`, 'legend');
    this.broadcast({ t: 'boss', b: this.bossInfo(), spawn: true });
  },
  bossInfo() {
    const b = this.boss;
    if (!b) return null;
    return {
      pond: b.pond,
      x: r1(b.x),
      z: r1(b.z),
      h: Math.round(b.h * 100) / 100,
      sp: b.sp.i,
      hp: Math.round(b.hp),
      max: b.max,
      left: Math.max(0, Math.round(b.until - this.t)),
      n: this.bossFighting(),
    };
  },
  bossFighting() {
    let n = 0;
    for (const P of this.players.values()) if (P.fight?.boss) n++;
    return n;
  },
  updateBoss(dt) {
    const b = this.boss;
    if (!b) {
      if (this.t > this.bossAt && this.players.size) this.spawnBoss();
      return;
    }
    // zwemt langzaam rond; aan de haak blijft hij op zijn plek trekken
    if (!this.bossFighting()) {
      b.h += rnd(-0.6, 0.6) * dt;
      const nx = b.x + Math.cos(b.h) * 0.8 * dt,
        nz = b.z + Math.sin(b.h) * 0.8 * dt;
      if (S.pondWater(nx, nz) === b.pond && Math.hypot(nx - PONDS[b.pond].x, nz - PONDS[b.pond].z) < PONDS[b.pond].r * 0.8) {
        b.x = nx;
        b.z = nz;
      } else b.h += Math.PI * 0.7;
    }
    if (this.t > b.until) return this.bossEscape();
    if (this.tick % 10 === 0) this.broadcast({ t: 'boss', b: this.bossInfo() });
  },
  /** Kans dat de reus op het aas van speler P afkomt. */
  bossBite(P, rs) {
    const b = this.boss;
    if (!b || b.pond !== P.pond || Math.hypot(b.x - P.bx, b.z - P.bz) > CFG.bossBiteR) return false;
    if (Math.random() > 0.3 * (P.perfect ? CFG.perfectBite : 1)) return false;
    P.chase = 'boss';
    P.fs = 2;
    P.biteT = rs.window * 1.3;
    this.broadcast({ t: 'ev', k: 'splash', x: r1(P.bx), z: r1(P.bz), id: P.id, big: 1 });
    return true;
  },
  bossHook(P) {
    const b = this.boss;
    if (!b) {
      P.fs = 0;
      P.chase = null;
      return;
    }
    P.fs = 3;
    P.reel = false;
    P.fight = { boss: true, T: 30, D: 70, phase: 'rest', pt: rnd(1, 2), stam: 100, snap: 0, send: 0 };
    if (!b.fighters.has(P.id)) b.fighters.set(P.id, 0);
    this.feed(`${P.name} heeft de reuzenvis aan de haak! Help mee!`, 'rare');
  },
  updateBossFight(P, dt) {
    const b = this.boss,
      F = P.fight;
    if (!b) return this.loseFish(P, 'De reuzenvis is weg.');
    const rs = S.rodStats(P.save);
    this.fightStep(F, dt, b.str, rs, P.reel);
    if (P.reel && F.phase !== 'run') {
      const dmg = 8 * rs.reel * (1 + (1 - F.stam / 100) * 0.5) * dt;
      b.hp -= dmg;
      b.fighters.set(P.id, (b.fighters.get(P.id) || 0) + dmg);
    }
    // de reus trekt de dobber heen en weer
    P.bx += (b.x - P.bx) * Math.min(1, dt * 2);
    P.bz += (b.z - P.bz) * Math.min(1, dt * 2);
    if (F.snap > 0.55) return this.loseFish(P, 'De lijn knapte! De reuzenvis is nog los. Werp opnieuw uit en help mee.', true);
    if (b.hp <= 0) return this.bossWin();
    if ((F.send -= dt) <= 0) {
      F.send = 0.1;
      this.send(P, {
        t: 'fight',
        T: r1(F.T),
        D: r1(100 - (b.hp / b.max) * 100),
        ph: F.phase,
        st: Math.round(F.stam),
        fid: b.sp.i,
        boss: { hp: Math.round(b.hp), max: b.max, n: this.bossFighting() },
      });
    }
  },
  bossWin() {
    const b = this.boss,
      w = Math.round(b.sp.w[1] * rnd(2.2, 3.2) * 10) / 10,
      R = CFG.bossReward,
      names = [];
    this.boss = null;
    this.bossAt = this.t + rnd(...CFG.bossEvery);
    for (const [pid, dmg] of b.fighters) {
      const P = this.players.get(pid);
      if (!P || dmg < 2) continue;
      names.push(P.name);
      if (P.fight?.boss) Object.assign(P, { fs: 0, fight: null, chase: null, reel: false });
      P.save.coins += R.coins;
      P.save.rep += R.rep;
      P.save.stats.bossWins++;
      this.addXp(P, R.xp);
      this.checkAch(P);
      this.dirty(P);
    }
    // wie nog vastzat maar niet meetelde, laat los
    for (const P of this.players.values()) if (P.fight?.boss) Object.assign(P, { fs: 0, fight: null, chase: null, reel: false });
    this.broadcast({ t: 'bossWin', names, sp: b.sp.id, w, reward: R });
    this.feed(
      `🐋 ${names.join(', ')} ving${names.length > 1 ? 'en' : ''} samen de reuzen${b.sp.name.toLowerCase()} van ${S.fmtKg(w)}!`,
      'legend',
    );
    this.broadcast({ t: 'boss', b: null });
  },
  bossEscape() {
    this.boss = null;
    this.bossAt = this.t + rnd(...CFG.bossEvery);
    for (const P of this.players.values()) if (P.fight?.boss || P.chase === 'boss') this.loseFish(P, 'De reuzenvis is ontsnapt!');
    this.feed('🐋 De reuzenvis is weer de diepte in gezwommen...', 'info');
    this.broadcast({ t: 'boss', b: null });
  },
};
