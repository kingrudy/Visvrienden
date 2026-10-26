// Spelregels en afstelling die alleen de server nodig heeft.

export const CFG = {
  maxSpeedMul: 1.7, // speling bij de snelheidscontrole
  heronRelocate: 150, // reiger verhuist na max. zoveel seconden
  merchantEvery: 12 * 60,
  merchantStay: 4 * 60,
  weatherMin: 180,
  weatherMax: 360,
  legendRespawn: 8 * 60, // seconden voordat een gevangen legende terugkomt
  dogDigEvery: 240, // hond graaft elke zoveel seconden wormen op
  biteRadius: 18,
  legendBiteRadius: 30,
  catchCardMs: 9000,
  heronCardMs: 4000,
  contestPrizes: [300, 150, 75],
  dogNames: ['Bobbel', 'Snuf', 'Dobber', 'Pluk', 'Max', 'Fikkie', 'Rakker', 'Sproet', 'Knor', 'Bello', 'Wally', 'Tobbe'],
};

/** Hoe goed past het moment van de dag bij de voorkeur van een soort (sp.t: any, dag, nacht of sch = schemering). */
const TIME_FIT = {
  any: { dag: 1, sch: 1, nacht: 1 },
  dag: { dag: 1, sch: 0.6, nacht: 0.2 },
  nacht: { dag: 0.2, sch: 0.5, nacht: 1 },
  sch: { dag: 0.6, sch: 1.5, nacht: 0.6 },
};

/** Hoe aantrekkelijk is dit aas voor deze soort, nu (tijd van de dag en weer)? 0 = hapt nooit. */
export function appeal(sp, bait, tc, weather) {
  let a;
  if (sp.likes.includes(bait)) a = sp.likes[0] === bait ? 1 : 0.85;
  else if (sp.leg) return 0;
  else a = ['worm', 'made', 'brood'].includes(bait) ? 0.12 : 0.04;
  a *= (TIME_FIT[sp.t] || TIME_FIT.sch)[tc];
  if (bait === 'glow' && tc !== 'dag') a *= 1.4;
  if (weather === 'rain' && ['worm', 'made'].includes(bait)) a *= 1.15;
  if (weather === 'clear' && ['vlieg', 'spinner'].includes(bait) && tc === 'dag') a *= 1.1;
  if (weather === 'storm' && ['levend', 'glow'].includes(bait)) a *= 1.2;
  a *= weather === 'rain' ? 1.25 : weather === 'storm' ? 1.1 : weather === 'fog' ? 0.9 : 1;
  return a;
}

/** Is het moment goed voor deze legendarische vis? */
export const legendOk = (sp, tc, weather) =>
  sp.cond === 'storm' ? weather === 'storm' : sp.cond === 'dag' ? tc === 'dag' : sp.cond === 'sch' ? tc === 'sch' : tc === 'nacht';

/** Willekeurig gewicht; zware vissen zijn zeldzaam (legendes iets minder). */
export const weightFor = sp => Math.round((sp.w[0] + (sp.w[1] - sp.w[0]) * Math.pow(Math.random(), sp.leg ? 1.2 : 2.2)) * 100) / 100;

/** XP voor een vangst. */
export const catchXp = (sp, w) => Math.round((12 + Math.min(60, w * 3)) * (0.8 + 0.45 * sp.rar) * (sp.leg ? 3 : 1));
