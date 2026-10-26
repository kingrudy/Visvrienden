import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHARED } from './_paths.js';
const S = await import(SHARED);

test('terrein is deterministisch en vijvers liggen onder water', () => {
  assert.equal(S.heightAt(12.5, -3), S.heightAt(12.5, -3));
  for (const p of S.PONDS) {
    assert.equal(S.pondWater(p.x, p.z), p.id, `midden van ${p.name} is water`);
    assert.ok(S.heightAt(p.x, p.z) < p.waterY, `bodem van ${p.name} ligt onder het wateroppervlak`);
  }
  assert.ok(S.walkable(S.SPAWN.x, S.SPAWN.z), 'startplek is beloopbaar');
});

test('soorten, aas en hengels zijn consistent', () => {
  assert.ok(S.SPECIES.length > 40);
  for (const sp of S.SPECIES) {
    assert.ok(S.PONDS[sp.pond], `${sp.id} hoort bij een bestaande vijver`);
    assert.ok(sp.w[0] > 0 && sp.w[1] >= sp.w[0], `${sp.id} heeft een geldig gewicht`);
    for (const b of sp.likes) assert.ok(S.BAIT[b], `${sp.id} lust bestaand aas ${b}`);
  }
  for (const p of S.PONDS) assert.ok(S.speciesOf(p.id).length > 0, `${p.name} heeft vissen`);
  assert.equal(new Set(S.SPECIES.map(s => s.id)).size, S.SPECIES.length, 'soort-id’s zijn uniek');
});

test('hulpfuncties', () => {
  assert.equal(S.fmtKg(1.234), '1,23 kg');
  assert.equal(S.fmtKg(12.34), '12,3 kg');
  assert.ok(S.fishValue(S.SPECIES[0], 1) >= 2);
  assert.equal(S.clockStr(0), '06:00');
  assert.ok(['dag', 'nacht', 'sch'].includes(S.timeClass(0.3)));
  assert.equal(S.featuredSpecies(0).id, S.featuredSpecies(0).id);
  assert.ok(!S.featuredSpecies().leg, 'vis van de week is geen legende');
  assert.ok(S.levelNeed(2) > S.levelNeed(1));
});

test('huisplekken overlappen niet met vijvers en zijn uniek', () => {
  const keys = new Set();
  for (const h of S.HOUSE_SLOTS) {
    keys.add(h.x + ',' + h.z);
    assert.equal(S.pondWater(h.x, h.z), -1, 'huis staat niet in het water');
  }
  assert.equal(keys.size, S.HOUSE_SLOTS.length);
});
