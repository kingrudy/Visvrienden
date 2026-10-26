import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, SHARED } from './_paths.js';
const { appeal, legendOk, weightFor, catchXp } = await import(RULES);
const S = await import(SHARED);

test('aas en tijdstip bepalen of een vis hapt', () => {
  const day = S.SPECIES.find(s => s.t === 'dag' && !s.leg),
    fav = day.likes[0];
  assert.equal(appeal(day, fav, 'dag', 'clear') > appeal(day, fav, 'nacht', 'clear'), true, 'dagvis bijt beter overdag');
  assert.ok(Math.abs(appeal(day, fav, 'nacht', 'clear') / appeal(day, fav, 'dag', 'clear') - 0.2) < 1e-9);
  const dusk = S.SPECIES.find(s => s.t === 'sch' && !s.leg);
  assert.ok(Math.abs(appeal(dusk, dusk.likes[0], 'sch', 'clear') / appeal(dusk, dusk.likes[0], 'dag', 'clear') - 2.5) < 1e-9);
  assert.ok(appeal(day, fav, 'dag', 'rain') > appeal(day, fav, 'dag', 'clear'), 'regen helpt');
  const leg = S.SPECIES.find(s => s.leg),
    wrong = S.BAITS.find(b => !leg.likes.includes(b.id)).id;
  assert.equal(appeal(leg, wrong, 'nacht', 'storm'), 0, 'legende hapt alleen op zijn eigen aas');
});

test('legendes, gewicht en xp', () => {
  const storm = S.SPECIES.find(s => s.leg && s.cond === 'storm');
  if (storm) {
    assert.ok(legendOk(storm, 'dag', 'storm'));
    assert.ok(!legendOk(storm, 'dag', 'clear'));
  }
  for (const sp of S.SPECIES.slice(0, 20))
    for (let i = 0; i < 20; i++) {
      const w = weightFor(sp);
      assert.ok(w >= sp.w[0] - 0.01 && w <= sp.w[1] + 0.01);
    }
  const sp = S.SPECIES[0];
  assert.ok(catchXp(sp, 5) > catchXp(sp, 1));
});
