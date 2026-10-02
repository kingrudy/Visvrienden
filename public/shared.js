// Visvrienden – gedeelde gegevens en regels (server én browser). Geen DOM, geen Node-specifieke dingen.
export const GAME_NAME = 'Visvrienden';
export const DAY_MS = 20 * 60 * 1000;

/* ------------------------------------------------------------------ tijd */
export const dayPhase = (now = Date.now()) => (now % DAY_MS) / DAY_MS;      // 0 = zonsopkomst (06:00)
export const sunElev = p => Math.sin(p * Math.PI * 2) + 0.25;                // > 0.15 = dag, < -0.1 = nacht
export const clockStr = p => { const h = (p * 24 + 6) % 24; return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0'); };
export function timeClass(p) { const e = sunElev(p); return e > 0.15 ? 'dag' : e < -0.1 ? 'nacht' : 'sch'; }

/* ------------------------------------------------------------------ ruis en terrein */
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
export function vnoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, z, seed = 0) => vnoise(x, z, seed) * 0.55 + vnoise(x * 2.1, z * 2.1, seed + 11) * 0.3 + vnoise(x * 4.3, z * 4.3, seed + 23) * 0.15;
export const rand01 = (a, b = 0, c = 0) => hash2(Math.floor(a), Math.floor(b), c);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export { sm as smoothstep };

export const WORLD = { minX: -540, maxX: 500, minZ: -880, maxZ: 360 };
export const SPAWN = { x: 0, z: 14 };

/* ------------------------------------------------------------------ vijvers */
export const PONDS = [
  { id: 0, name: 'Dorpsvijver', x: 0, z: -45, r: 34, baseY: 0, depth: 4.5, biome: 'meadow', fish: 14 },
  { id: 1, name: 'Bosmeer', x: -190, z: -150, r: 44, baseY: 2, depth: 5, biome: 'forest', fish: 16, req: { from: 0, catches: 12, species: 4 } },
  { id: 2, name: 'Moerasvijver', x: 150, z: -300, r: 42, baseY: -1, depth: 4, biome: 'swamp', fish: 16, req: { from: 1, catches: 16, species: 5 } },
  { id: 3, name: 'Bergmeer', x: -60, z: -470, r: 46, baseY: 18, depth: 5.5, biome: 'mountain', peak: 34, fish: 16, req: { from: 2, catches: 20, species: 5 } },
  { id: 4, name: 'IJsvijver', x: 180, z: -620, r: 40, baseY: 32, depth: 5, biome: 'snow', peak: 24, fish: 16, req: { from: 3, catches: 24, species: 6 } },
  { id: 5, name: 'Tropische Lagune', x: -300, z: -700, r: 64, baseY: 0, depth: 7, biome: 'tropic', fish: 22, req: { from: 4, catches: 30, species: 6 } },
  { id: 6, name: 'Verborgen Bronvijver', x: 260, z: 90, r: 20, baseY: 3, depth: 4, biome: 'spring', secret: true, fish: 8, hint: 'Een oude visser fluistert: "Ten oosten van het dorp, voorbij de heuvels, borrelt een bron die geen kaart kent..."' },
  { id: 7, name: 'Maanvijver', x: -340, z: 170, r: 22, baseY: 1, depth: 4, biome: 'moon', secret: true, fish: 8, hint: 'Een gerucht: "Ver in het zuidwesten ligt een vijver waar \'s nachts de maan in de vissen schijnt..."' },
];
for (const p of PONDS) { p.zr = p.r + 85; p.waterY = p.baseY - 0.9; }
export const ZONE_PONDS = PONDS.filter(p => p.req);

export const shapeAt = (p, dx, dz) => { const th = Math.atan2(dz, dx); return 1 + 0.16 * Math.sin(3 * th + p.id * 1.7) + 0.09 * Math.sin(5 * th + p.id * 2.9); };
const entryAngle = p => { if (!p.req) return Math.PI / 2; const q = PONDS[p.req.from]; return Math.atan2(q.z - p.z, q.x - p.x); };
for (const p of PONDS) p.entry = p.secret ? Math.atan2(SPAWN.z - p.z, SPAWN.x - p.x) : entryAngle(p);

export function heightAt(x, z) {
  let h = (fbm(x * 0.006, z * 0.006, 1) - 0.5) * 14 + (fbm(x * 0.02, z * 0.02, 2) - 0.5) * 3;
  for (const p of PONDS) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > p.zr * 2.4) continue;
    const w = sm(p.zr * 1.7, p.zr * 0.7, d);
    if (w > 0) h += (p.baseY + (fbm(x * 0.03, z * 0.03, 5 + p.id) - 0.5) * 1.4 - h) * w;
    if (p.peak) {
      const ang = Math.atan2(dz, dx); let da = Math.abs(ang - p.entry); if (da > Math.PI) da = 2 * Math.PI - da;
      const corridor = 1 - 0.92 * Math.exp(-(da * da) / 0.18);
      const ridge = 1 - Math.abs(2 * fbm(x * 0.012, z * 0.012, 40 + p.id) - 1);
      h += p.peak * (0.4 + ridge) * corridor * sm(p.r * 1.8, p.zr * 1.05, d) * sm(p.zr * 2.2, p.zr * 1.4, d);
    }
    const dn = d / (p.r * shapeAt(p, dx, dz));
    if (dn < 1.4) h -= sm(1.35, 0.8, dn) * p.depth;
  }
  return h;
}
const JETTY_H = 0.45;
export function pondWater(x, z) {          // in welke vijver ligt dit punt onder water (los van steigers), of -1
  for (const p of PONDS) {
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz > (p.r * 1.7) ** 2) continue;
    if (heightAt(x, z) < p.waterY) return p.id;
  }
  return -1;
}

/* ------------------------------------------------------------------ vaste objecten in de wereld */
export function shorePoint(p, ang, margin = 4) {      // vanuit het midden naar buiten tot droog land, + marge
  let d = p.r * 0.5;
  for (; d < p.r * 3; d += 0.5) { const x = p.x + Math.cos(ang) * d, z = p.z + Math.sin(ang) * d; if (heightAt(x, z) > p.waterY + 0.35) break; }
  d += margin;
  return { x: p.x + Math.cos(ang) * d, z: p.z + Math.sin(ang) * d, d };
}
export const JETTIES = [], KIOSKS = [], CAMPFIRES = [], HERONS = [], GATES = [];
for (const p of PONDS) {
  // steiger
  const ja = p.entry - 0.55, sp = shorePoint(p, ja, 1.5);
  JETTIES.push({ pond: p.id, x: sp.x, z: sp.z, ang: ja + Math.PI, len: 11, w: 2.4 });
  const ka = p.entry + 0.55, kp = shorePoint(p, ka, 7);
  KIOSKS.push({ id: 'kiosk' + p.id, type: 'kiosk', pond: p.id, x: kp.x, z: kp.z, name: p.id === 0 ? 'Aasverkoper Joop' : 'Aaskiosk ' + p.name });
  const ca = p.entry + 1.15, cp = shorePoint(p, ca, 8);
  CAMPFIRES.push({ id: 'vuur' + p.id, pond: p.id, x: cp.x, z: cp.z });
  const ha = p.entry + 2.4, hp = shorePoint(p, ha, 1.2);
  HERONS.push({ pond: p.id, x: hp.x, z: hp.z });
  if (p.req) {
    const q = PONDS[p.req.from], a = Math.atan2(q.z - p.z, q.x - p.x);
    GATES.push({ pond: p.id, x: p.x + Math.cos(a) * p.zr, z: p.z + Math.sin(a) * p.zr, ang: a });
  }
}
export const SHOPS = [
  { id: 'shop', type: 'main', x: 20, z: 12, name: 'Hengelwinkel van Dirk' },
  { id: 'smid', type: 'smith', x: -20, z: 14, name: 'Hengelsmid Marga' },
  ...KIOSKS.filter(k => k.pond !== 0 || true).map(k => k),
];
export const SHOP_RANGE = 7;
// groenere camping bij de start
CAMPFIRES.push({ id: 'vuurdorp', pond: 0, x: 4, z: 26 });

export function onJetty(x, z) {
  for (const j of JETTIES) {
    const dx = x - j.x, dz = z - j.z, c = Math.cos(j.ang), s = Math.sin(j.ang);
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    if (lx > -1 && lx < j.len && Math.abs(lz) < j.w / 2) return j;
  }
  return null;
}
export function groundY(x, z) { const j = onJetty(x, z); if (j) return PONDS[j.pond].waterY + JETTY_H; return heightAt(x, z); }
export function walkable(x, z, boat = false) {
  const w = pondWater(x, z);
  if (boat) return w >= 0 && !onJetty(x, z);
  return w < 0 || !!onJetty(x, z);
}
export function nearestPond(x, z) { let b = 0, bd = 1e9; for (const p of PONDS) { const d = Math.hypot(x - p.x, z - p.z) - p.r; if (d < bd) { bd = d; b = p.id; } } return b; }
export function zoneOf(x, z) { for (const p of PONDS) if (p.req && Math.hypot(x - p.x, z - p.z) < p.zr) return p.id; return -1; }
export function findNear(x, z, test, maxR = 14) {   // dichtstbijzijnde punt dat 'test' doorstaat
  if (test(x, z)) return { x, z };
  for (let r = 1.5; r <= maxR; r += 1.5) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (test(px, pz)) return { x: px, z: pz }; }
  return null;
}

/* ------------------------------------------------------------------ vissoorten */
export const RARITY = [
  { n: 'Gewoon', c: '#b8c4cc', w: 100, m: 1 }, { n: 'Ongewoon', c: '#6fd36f', w: 40, m: 1.6 }, { n: 'Zeldzaam', c: '#5aa8ff', w: 14, m: 2.6 },
  { n: 'Episch', c: '#c06bff', w: 5, m: 4.5 }, { n: 'Legendarisch', c: '#ffb938', w: 0, m: 10 },
];
// id|naam|vijver|zeldzaamheid|minkg|maxkg|prijs/kg|vorm|kleuren|aas|tijd|kracht|legendarisch-voorwaarde
const RAW = `
voorn|Voorn|0|0|.1|.5|6|slank|#9aa7b0,#e8e4d8,#d9573c|worm,made,brood|any|.6
blankvoorn|Blankvoorn|0|0|.15|.7|6|slank|#b9c3c9,#f1efe6,#c9743f|made,brood|dag|.7
brasem|Brasem|0|0|.4|2.5|5|plat|#a88f5a,#d8c89a,#7b6a45|worm,brood,boilie|any|.9
karper|Karper|0|1|1|6|8|rond|#8b7a3b,#d6bf72,#9a5a2a|boilie,brood,worm|dag|1.4
baars|Baars|0|1|.2|1.2|12|slank|#6b7f3f,#e6e0a8,#d05a2e|worm,spinner,garnaal|sch|1
goudvis|Goudvis|0|2|.2|.8|40|rond|#ff9b2f,#ffd37a,#ff7a1a|brood,vlieg|dag|.8
karel|Koning Karel|0|4|12|18|45|rond|#d9a83a,#fff0b0,#b8452a|boilie|nacht|3.2|nacht
rietvoorn|Rietvoorn|1|0|.1|.6|6|slank|#a9a05a,#f1e6a0,#e0603a|made,worm|dag|.6
bosbaars|Bosbaars|1|0|.2|1.4|8|slank|#4d7a3a,#cfd69a,#c24a2a|worm,garnaal|sch|.9
zeelt|Zeelt|1|1|.5|3|14|rond|#4f7a4a,#b8c47a,#3f5a3a|worm,made|sch|1.2
snoek|Snoek|1|1|1|7|14|snoek|#5d7a3a,#d9d9a0,#8a9a4a|spinner,levend|dag|1.7
regenboogforel|Regenboogforel|1|2|.4|3.5|26|slank|#8fb0a0,#f3c6d0,#e46a8a|vlieg,garnaal|dag|1.3
paling|Paling|1|2|.3|2|30|paling|#3a3a2a,#c8c08a,#2a2a1a|worm,levend|nacht|1.5
woudsnoek|Groene Reus|1|4|16|24|40|snoek|#2f6a2a,#b8d86a,#c8a02a|levend|nacht|3.5|nacht
modderkruiper|Modderkruiper|2|0|.05|.3|5|paling|#8a7a4a,#d8c88a,#6a5a3a|worm,made|any|.5
kroeskarper|Kroeskarper|2|0|.3|1.5|6|rond|#9a8a3a,#e0d08a,#7a6a2a|brood,worm|any|.8
giebel|Giebel|2|1|.5|3|9|rond|#b0a050,#e8d890,#a07030|worm,boilie|dag|1.1
snoekbaars|Snoekbaars|2|1|1|6|16|snoek|#7a8a6a,#d8dcb8,#5a6a4a|spinner,levend|sch|1.5
meerval|Meerval|2|2|3|20|18|kat|#4a4a3a,#b8b090,#2a2a22|levend,worm|nacht|2.2
goudzeelt|Gouden Zeelt|2|3|1|3.5|45|rond|#e8b830,#fff0a0,#c88a20|worm,garnaal|dag|1.3
oerwels|Oerwels|2|4|30|45|25|kat|#2a3a2a,#9aa07a,#161e16|levend|nacht|4|storm
beekforel|Beekforel|3|0|.1|.7|10|slank|#7a8a5a,#f0e0b0,#d0503a|vlieg,made|dag|.8
rivierbaars|Rivierbaars|3|0|.2|1.4|9|slank|#5a7a6a,#e0e8c0,#d05a3a|worm,spinner|any|.9
barbeel|Barbeel|3|1|.5|4|11|lang|#8a7a5a,#d8c8a0,#6a5a3a|worm,garnaal|dag|1.3
vlagzalm|Vlagzalm|3|1|.4|1.8|16|slank|#7a8aa0,#d8e0f0,#9a60c0|vlieg|dag|1
zalm|Zalm|3|2|2|12|22|snoek|#8a9aa8,#e8ecf0,#c0605a|spinner,garnaal,levend|dag|2
meerforel|Meerforel|3|2|1|8|24|slank|#a0a8a8,#f0f2f0,#d08a6a|vlieg,spinner|sch|1.8
bergsteur|Bergsteur|3|3|5|25|40|lang|#5a6a7a,#c8d0d8,#3a4a5a|garnaal,levend|nacht|2.6
goudzalm|Gouden Zalm|3|4|18|28|50|snoek|#e8b838,#fff4b8,#d8782a|spinner|dag|3.6|dag
witvis|Witvis|4|0|.1|.6|8|slank|#c8d0d8,#f4f6f8,#8a9aa8|made,worm|any|.6
navaga|Navaga|4|0|.2|1|9|lang|#9a9a8a,#e8e8d8,#7a7a6a|garnaal,made|any|.8
poolzalm|Poolzalm|4|1|.5|4|18|slank|#6a8aa8,#f0d8c0,#e07a4a|vlieg,garnaal|dag|1.3
koudsnoek|Koudwatersnoek|4|1|1|8|16|snoek|#6a8a8a,#e0ecec,#4a6a8a|spinner,levend|dag|1.7
ijsforel|IJsforel|4|2|.8|5|30|slank|#a8c8e0,#f4fafc,#6aa8d8|vlieg,garnaal|dag|1.5
kristalvis|Kristalvis|4|3|.3|1.2|80|plat|#bff0ff,#ffffff,#7ad8ff|glow,vlieg|nacht|1.2
ijssteur|IJskoning-steur|4|4|40|70|30|kat|#7a96b0,#e8f4fc,#4a6a8a|levend|nacht|4.2|nacht
neonvis|Neonvis|5|0|.02|.08|40|slank|#2a8aff,#ff4a5a,#2affd8|made,vlieg|dag|.3
tilapia|Tilapia|5|0|.3|2|6|rond|#a8a888,#e8e0c8,#8a7a5a|brood,worm|any|.8
regenboogvis|Regenboogvis|5|0|.1|.6|10|slank|#4ac8c8,#f8e84a,#e8506a|made,garnaal|dag|.6
oscar|Oscar|5|1|.5|1.5|16|rond|#4a3a2a,#e86a2a,#2a1a1a|worm,levend|dag|1.1
piranha|Piranha|5|1|.3|2|20|plat|#5a6a7a,#e8503a,#2a3a4a|levend,garnaal|dag|1.6
discusvis|Discusvis|5|2|.4|1.6|50|plat|#d86a2a,#ffe08a,#2a7ad8|garnaal,made|dag|1
pauwbaars|Pauwbaars|5|2|1|5|20|slank|#2a8a4a,#f8e04a,#e8503a|spinner,vlieg|dag|1.4
dorado|Gouden Dorado|5|3|4|15|35|snoek|#e8a82a,#fff0a0,#2a8a6a|spinner,levend|dag|2.3
arapaima|Reus van de Lagune|5|4|60|90|20|kat|#3a6a5a,#e86a4a,#1a3a2a|levend|dag|4.5|dag
bronforel|Bronforel|6|2|.5|3|35|slank|#b8e8d8,#ffffff,#6ad8b0|vlieg,garnaal|dag|1.2
grondel|Kristalgrondel|6|1|.05|.3|20|paling|#d8f4ff,#ffffff,#8ad8f0|made|any|.4
goudkarper|Goudkarper|6|3|2|9|60|rond|#ffcc33,#fff2a8,#e8982a|boilie,brood|dag|1.8
fee|Zilveren Fee|6|4|6|12|90|slank|#e8f0ff,#ffffff,#a8c0ff|maan,vlieg|sch|3|sch
maanvis|Maanvis|7|2|.6|3|40|plat|#c8c8ff,#ffffff,#8a8ae8|glow,maan|nacht|1.3
sterrenbaars|Sterrenbaars|7|2|.4|2.5|45|slank|#2a2a6a,#ffe88a,#8a6ae8|glow,garnaal|nacht|1.2
spookvis|Spookvis|7|3|1|6|70|paling|#a8b8d8,#f0f4ff,#6a7ab8|maan,glow|nacht|1.8
maankoi|Maankoi|7|4|20|34|80|rond|#e8e8ff,#ffffff,#8a9ae8|maan|nacht|3.8|nacht
`;
export const SPECIES = RAW.trim().split('\n').map((ln, i) => {
  const a = ln.split('|');
  return { i, id: a[0], name: a[1], pond: +a[2], rar: +a[3], w: [+a[4], +a[5]], p: +a[6], shape: a[7], c: a[8].split(','), likes: a[9].split(','), t: a[10], str: +a[11], leg: !!a[12], cond: a[12] || null };
});
export const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
for (const s of SPECIES) if (s.leg) s.rar = 4;
export const speciesOf = pond => SPECIES.filter(s => s.pond === pond);
export const fishValue = (sp, w) => Math.max(2, Math.round(sp.p * w * RARITY[sp.rar].m * (sp.leg ? 1 : 1)));
export const fmtKg = w => (w >= 10 ? w.toFixed(1) : w.toFixed(2)).replace('.', ',') + ' kg';

/* ------------------------------------------------------------------ aas, hengels, upgrades, vervoer */
export const BAITS = [
  { id: 'worm', name: 'Wormen', price: 12, icon: '🪱', desc: 'Het klassieke aas. Werkt op bijna alle vissen.' },
  { id: 'made', name: 'Maden', price: 10, icon: '🐛', desc: 'Goed voor voorn, baars en kleine vissen.' },
  { id: 'brood', name: 'Brood', price: 8, icon: '🍞', desc: 'Karper, brasem en goudvis zijn er dol op.' },
  { id: 'garnaal', name: 'Garnalen', price: 25, icon: '🦐', desc: 'Lekker voor forel, zalm en tropische vissen.' },
  { id: 'vlieg', name: 'Kunstvlieg', price: 40, icon: '🪰', desc: 'Voor forel en zalm en andere kieskeurige vissen.' },
  { id: 'spinner', name: 'Spinner', price: 45, icon: '🥄', desc: 'Roofvissen: snoek, zalm, snoekbaars.' },
  { id: 'boilie', name: 'Boilies', price: 35, icon: '🟤', desc: 'Voor grote karpers.' },
  { id: 'levend', name: 'Levend aas', price: 60, icon: '🐟', desc: 'Voor de grote roofvissen en reuzen.' },
  { id: 'glow', name: 'Gloedaas', price: 90, icon: '✨', desc: 'Licht op in het donker. Nachtvissen houden ervan.' },
  { id: 'maan', name: 'Maanaas', price: 150, icon: '🌙', desc: 'Zeldzaam aas voor verborgen vijvers en legendes.' },
];
export const BAIT = Object.fromEntries(BAITS.map(b => [b.id, b]));
export const BAIT_PACK = 10;
export const RODS = [
  { id: 0, name: 'Bamboehengel', price: 0, cast: 14, line: 55, reel: 1.0, bite: 1.0, color: '#c8a458' },
  { id: 1, name: 'Glasvezelhengel', price: 150, cast: 18, line: 72, reel: 1.05, bite: 1.05, color: '#4ab0c8' },
  { id: 2, name: 'Karperhengel', price: 450, cast: 22, line: 95, reel: 1.1, bite: 1.0, color: '#3a5a3a' },
  { id: 3, name: 'Vlieghengel', price: 1100, cast: 26, line: 88, reel: 1.2, bite: 1.25, color: '#c85a2a' },
  { id: 4, name: 'Zeehengel', price: 2400, cast: 31, line: 135, reel: 1.3, bite: 1.1, color: '#2a3a6a' },
  { id: 5, name: 'Meesterhengel', price: 6000, cast: 38, line: 165, reel: 1.55, bite: 1.35, color: '#e8b838' },
];
export const UPGRADES = {
  reel: { name: 'Molen', desc: '+8% inhaalsnelheid per niveau', max: 5, base: 120 },
  line: { name: 'Lijn', desc: '+8 lijnsterkte per niveau', max: 5, base: 100 },
  float: { name: 'Dobber', desc: '+0,25 s om aan te slaan per niveau', max: 5, base: 90 },
  sonar: { name: 'Echolood', desc: '1: zie vissen in de buurt · 2: zie zeldzaamheid · 3: zie ook het gewicht', max: 3, base: 400 },
};
export const upgradeCost = (k, lvl) => Math.round(UPGRADES[k].base * Math.pow(1.9, lvl));
export const MOUNTS = {
  bike: { name: 'Fiets', price: 220, speed: 2.0, icon: '🚲', desc: 'Twee keer zo snel onderweg.' },
  scooter: { name: 'Scooter', price: 1400, speed: 3.0, icon: '🛵', desc: 'Drie keer zo snel. Zo kom je overal.' },
  boat: { name: 'Roeiboot', price: 480, speed: 1.0, icon: '🛶', desc: 'Roei het water op en vis midden op de vijver. Stap in en uit bij de oever (B).' },
};
export const DOG_PRICE = 120;
export const TALENTS = {
  geduld: { name: 'Geduld', desc: 'Vissen bijten sneller' },
  kracht: { name: 'Kracht', desc: 'Sneller inhalen' },
  gevoel: { name: 'Gevoel', desc: 'Meer tijd om aan te slaan' },
  geluk: { name: 'Geluk', desc: 'Grotere kans op zeldzame vissen' },
  handelaar: { name: 'Handelaar', desc: 'Vis levert meer geld op' },
  zuinig: { name: 'Zuinig', desc: 'Kans dat je aas niet opraakt' },
};
export const TALENT_MAX = 5;
export const MAX_LEVEL = 30;
export const levelNeed = l => Math.round(30 * Math.pow(l, 1.4));
export const BUFFS = {
  geduld: { name: 'Geduld', icon: '⏳', desc: 'Vissen bijten veel sneller' },
  kracht: { name: 'Kracht', icon: '💪', desc: 'Sneller inhalen, sterkere lijn' },
  geluk: { name: 'Geluk', icon: '🍀', desc: 'Meer zeldzame vissen' },
  gevoel: { name: 'Gevoel', icon: '👁️', desc: 'Meer tijd om aan te slaan' },
};
export const INV_MAX = 30;
export const TRAVEL_ITEMS = [
  { id: 't_geluk', name: 'Gelukskoekje', price: 250, buff: 'geluk', min: 8, icon: '🍀', desc: 'Geluk-bonus, 8 minuten' },
  { id: 't_geduld', name: 'Geduldthee', price: 200, buff: 'geduld', min: 8, icon: '🍵', desc: 'Geduld-bonus, 8 minuten' },
  { id: 't_kracht', name: 'Krachtdrank', price: 200, buff: 'kracht', min: 8, icon: '🥤', desc: 'Kracht-bonus, 8 minuten' },
  { id: 't_glow', name: 'Gloedaas x20', price: 120, bait: 'glow', qty: 20, icon: '✨', desc: 'Twintig stuks gloedaas' },
  { id: 't_maan', name: 'Maanaas x10', price: 190, bait: 'maan', qty: 10, icon: '🌙', desc: 'Tien stuks maanaas' },
  { id: 't_kist', name: 'Mysterieuze kist', price: 300, icon: '🎁', desc: 'Drie soorten aas en wat geld, of meer...' },
];

export const WEATHERS = { clear: 'Helder', rain: 'Regen', fog: 'Mist', storm: 'Onweer' };

/* ------------------------------------------------------------------ prestaties en opdrachten */
export const ACHIEVEMENTS = [
  { id: 'first', name: 'Eerste vis', desc: 'Vang je eerste vis.', test: s => s.stats.catches >= 1 },
  { id: 'c25', name: 'Hengelaar', desc: 'Vang 25 vissen.', test: s => s.stats.catches >= 25 },
  { id: 'c100', name: 'Visser', desc: 'Vang 100 vissen.', test: s => s.stats.catches >= 100 },
  { id: 'c500', name: 'Visserskoning', desc: 'Vang 500 vissen.', test: s => s.stats.catches >= 500 },
  { id: 'rel20', name: 'Vriend van de vis', desc: 'Laat 20 vissen vrij.', test: s => s.stats.released >= 20 },
  { id: 'big5', name: 'Zware jongen', desc: 'Vang een vis van 5 kg of meer.', test: s => s.stats.best >= 5 },
  { id: 'big20', name: 'Monstervangst', desc: 'Vang een vis van 20 kg of meer.', test: s => s.stats.best >= 20 },
  { id: 'rare', name: 'Zeldzame vondst', desc: 'Vang een zeldzame vis.', test: s => s.stats.rareCatches >= 1 },
  { id: 'epic', name: 'Epische vangst', desc: 'Vang een epische vis.', test: s => s.stats.epicCatches >= 1 },
  { id: 'leg1', name: 'Legende', desc: 'Vang een legendarische vis.', test: s => s.stats.legCatches >= 1 },
  { id: 'leg4', name: 'Legendenjager', desc: 'Vang vier legendarische vissen.', test: s => s.stats.legCatches >= 4 },
  { id: 'book10', name: 'Verzamelaar', desc: 'Zet 10 soorten in je visboek.', test: s => Object.keys(s.book).length >= 10 },
  { id: 'book25', name: 'Vissenkenner', desc: 'Zet 25 soorten in je visboek.', test: s => Object.keys(s.book).length >= 25 },
  { id: 'bookall', name: 'Complete collectie', desc: 'Vang alle soorten.', test: s => Object.keys(s.book).length >= SPECIES.length },
  { id: 'pond2', name: 'Op reis', desc: 'Ontgrendel de tweede vijver.', test: s => s.unlocked.length >= 1 },
  { id: 'pond5', name: 'Wereldreiziger', desc: 'Ontgrendel alle vijvers.', test: s => s.unlocked.length >= 5 },
  { id: 'secret', name: 'Ontdekkingsreiziger', desc: 'Vind een verborgen vijver.', test: s => s.disc.length >= 1 },
  { id: 'rich', name: 'Rijk', desc: 'Bezit 5000 munten tegelijk.', test: s => s.coins >= 5000 },
  { id: 'night', name: 'Nachtbraker', desc: 'Vang 10 vissen in het donker.', test: s => s.stats.nightCatches >= 10 },
  { id: 'storm', name: 'Stormvisser', desc: 'Vang een vis tijdens onweer.', test: s => s.stats.stormCatches >= 1 },
  { id: 'contest', name: 'Wedstrijdvisser', desc: 'Win een wedstrijd.', test: s => s.stats.contestWins >= 1 },
  { id: 'lvl10', name: 'Ervaren', desc: 'Bereik niveau 10.', test: s => s.lvl >= 10 },
  { id: 'lvl30', name: 'Meester', desc: 'Bereik niveau 30.', test: s => s.lvl >= 30 },
];
export const ACH = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const QUEST_KINDS = {
  catch: { text: n => `Vang ${n} vissen`, n: [5, 8, 12], coins: 8, xp: 8 },
  night: { text: n => `Vang ${n} vissen in het donker`, n: [2, 3, 5], coins: 14, xp: 12 },
  heavy: { text: n => `Vang een vis van ${n} kg of meer`, n: [2, 3, 5], coins: 40, xp: 30, one: true },
  release: { text: n => `Laat ${n} vissen vrij`, n: [2, 3, 5], coins: 12, xp: 14 },
  sell: { text: n => `Verkoop ${n} vissen`, n: [3, 5, 8], coins: 10, xp: 6 },
  rare: { text: n => `Vang ${n} zeldzame vis (blauw of beter)`, n: [1, 1, 2], coins: 90, xp: 60 },
  species: { text: (n, sp) => `Vang ${n}x ${SP[sp]?.name || '?'}`, n: [1, 2, 3], coins: 25, xp: 20 },
  cook: { text: n => `Bak ${n} vis op een kampvuur`, n: [1, 2, 2], coins: 20, xp: 20 },
};

export const CONTEST_MS = 5 * 60 * 1000;
export const CONTEST_COOLDOWN_MS = 8 * 60 * 1000;
export const rodStats = save => {
  const rod = RODS[save.rods.active] || RODS[0];
  const dur = save.rods.dur[rod.id] ?? 100;
  const up = save.upg, t = save.talents, now = Date.now(), b = k => (save.buffs[k] || 0) > now;
  const lineBase = rod.line + up.line * 8 + (b('kracht') ? 10 : 0);
  return {
    rod, dur, broken: dur <= 0,
    cast: rod.cast,
    line: dur < 30 ? lineBase * 0.7 : lineBase,
    reel: rod.reel * (1 + up.reel * 0.08 + t.kracht * 0.05 + (b('kracht') ? 0.2 : 0)),
    window: 1.8 + up.float * 0.25 + t.gevoel * 0.15 + (b('gevoel') ? 0.6 : 0),
    bite: rod.bite * (1 + t.geduld * 0.06 + (b('geduld') ? 0.4 : 0)),
    luck: t.geluk + (b('geluk') ? 2 : 0),
  };
};
