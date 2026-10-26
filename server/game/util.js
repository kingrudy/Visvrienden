// Kleine hulpfuncties voor de spelregels op de server.
export const r1 = v => Math.round(v * 10) / 10,
  r2 = v => Math.round(v * 100) / 100;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];

const NL = { timeZone: 'Europe/Amsterdam' };
/** Datum in Nederland als 'JJJJ-MM-DD'. */
export const today = () => new Intl.DateTimeFormat('sv-SE', NL).format(new Date());
export const isWeekend = () => {
  const d = new Intl.DateTimeFormat('en-US', { ...NL, weekday: 'short' }).format(new Date());
  return d === 'Sat' || d === 'Sun';
};

/** Voorspelbare random-generator op basis van een tekst. */
export function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  };
}
/** Simpele, stabiele hash van een tekst. */
export function strHash(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
