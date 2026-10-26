import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESS, SHARED } from './_paths.js';
const { ensureSave, levelInfo, applyTalent, resetTalents, houseInfo } = await import(PROGRESS);
const S = await import(SHARED);

test('nieuw account krijgt een geldige save', () => {
  const u = { name: 'Piet', save: {} };
  const s = ensureSave(u);
  assert.equal(s.coins, 80);
  assert.equal(s.lvl, 1);
  assert.equal(s.bait, 'worm');
  assert.equal(s.baits.worm, 20);
  assert.deepEqual(s.rods.owned, [0]);
  assert.equal(s.daily.q.length, 3);
  assert.equal(s.house, -1);
  assert.ok(s.look >= 0 && s.look <= 3);
});

test('kapotte save wordt gerepareerd', () => {
  const u = {
    name: 'Kees',
    save: {
      coins: -5,
      xp: 'x',
      rods: { owned: [3], active: 9 },
      baits: { worm: 500 },
      unlocked: [0, 1, 99],
      talents: { onzin: 3, kracht: 99 },
    },
  };
  const s = ensureSave(u);
  assert.equal(s.coins, 0);
  assert.equal(s.xp, 0);
  assert.ok(s.rods.owned.includes(0));
  assert.equal(s.rods.active, 0);
  assert.equal(s.baits.worm, 99);
  assert.deepEqual(s.unlocked, [1]);
  assert.ok(!('onzin' in s.talents));
});

test('Toon heeft altijd de Ironman-hond', () => {
  assert.equal(ensureSave({ name: 'toon', save: {} }).dog.name, 'Iron Dog');
});

test('niveaus en talenten', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(S.levelNeed(1)).level, 2);
  const s = ensureSave({ name: 'Ans', save: { xp: 5000 } });
  assert.ok(s.lvl > 3);
  assert.ok(applyTalent(s, 'kracht'));
  assert.equal(s.talents.kracht, 1);
  assert.ok(!applyTalent(s, 'bestaatniet'));
  resetTalents(s);
  assert.equal(s.talents.kracht, 0);
});

test('huisinfo toont soorten, zeldzaamste eerst', () => {
  const s = ensureSave({ name: 'Bo', save: {} });
  s.house = 3;
  const common = S.SPECIES.find(x => x.rar === 0),
    rare = S.SPECIES.find(x => x.rar >= 2 && !x.leg);
  s.book[common.id] = { n: 1, best: 1 };
  s.book[rare.id] = { n: 2, best: 2 };
  const h = houseInfo(s, 'Bo');
  assert.equal(h.s, 3);
  assert.equal(h.n, 'Bo');
  assert.equal(h.sp[0][0], rare.id);
});
