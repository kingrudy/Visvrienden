// Chatfilter: vervangt scheldwoorden door sterretjes. Werkt ook als woorden met cijfers, rare tekens of
// herhaalde letters worden geschreven (bijv. "k4nker", "kuuuut", "f.u.c.k").

const WORDS = [
  // Nederlands
  'kanker',
  'kk',
  'tering',
  'tyfus',
  'tiefus',
  'klote',
  'kut',
  'lul',
  'eikel',
  'hoer',
  'slet',
  'kankerlijer',
  'mongool',
  'mongol',
  'debiel',
  'idioot',
  'sukkel',
  'teef',
  'trut',
  'flikker',
  'neger',
  'kakker',
  'piemel',
  'godverdomme',
  'gvd',
  'godver',
  'klootzak',
  'stomkop',
  'achterlijk',
  'kneus',
  'loser',
  'opflikker',
  'opzouten',
  'oprotten',
  'rot op',
  'pleur op',
  'sterf',
  'doodgaan',
  'kys',
  // Engels
  'fuck',
  'fck',
  'fuk',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'cunt',
  'whore',
  'slut',
  'retard',
  'nigger',
  'nigga',
  'faggot',
  'wtf',
  'stfu',
];
// Woorden die alleen als los woord worden gefilterd (anders te veel onschuldige treffers, zoals "zakken" of "nichtje").
const WHOLE_ONLY = new Set([
  'kk',
  'kut',
  'lul',
  'gvd',
  'kys',
  'wtf',
  'stfu',
  'dick',
  'sterf',
  'loser',
  'debiel',
  'idioot',
  'sukkel',
  'kneus',
]);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'l' };
const normChar = c => LEET[c] ?? c.toLowerCase();
/** Tekst gelijkmaken: kleine letters, leet-tekens vervangen, accenten weg, herhaalde letters samenvoegen. */
function normalize(text) {
  return [...text.normalize('NFD').replace(/[̀-ͯ]/g, '')]
    .map(normChar)
    .join('')
    .replace(/(.)\1+/g, '$1');
}
// Woorden die ook als begin van een samenstelling gefilterd worden (kutvis, kutweer).
const PREFIX = ['kut'];
const squash = w => w.replace(/(.)\1+/g, '$1');
const PATTERNS = WORDS.map(w => ({ w: squash(w.replace(/\s+/g, '')), whole: WHOLE_ONLY.has(w) }));

const CH = '[\\p{L}\\p{N}@$!|]';
// f.u.c.k of f u c k: losse letters met steeds hetzelfde soort teken ertussen
const SPREAD = [
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${CH}[.\\-_*+,~'"]){3,}${CH}(?![\\p{L}\\p{N}])`, 'gu'),
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${CH} ){3,}${CH}(?![\\p{L}\\p{N}])`, 'gu'),
];
const bad = n => n && (PREFIX.some(w => n.startsWith(w)) || PATTERNS.some(p => (p.whole ? n === p.w : n.includes(p.w))));

/** Vervang scheldwoorden in een tekst door sterretjes (zelfde lengte als het origineel). */
export function cleanText(text) {
  const src = String(text),
    mask = new Array(src.length).fill(false);
  // 1) per woord
  let pos = 0;
  for (const word of src.split(/(\s+)/)) {
    if (bad(normalize(word.replace(new RegExp(`[^${CH.slice(1, -1)}]`, 'gu'), ''))))
      for (let k = 0; k < word.length; k++) mask[pos + k] = !/\s/.test(word[k]);
    pos += word.length;
  }
  // 2) gespreid geschreven
  for (const re of SPREAD)
    for (const m of src.matchAll(re)) {
      const n = normalize(m[0].replace(new RegExp(`[^${CH.slice(1, -1)}]`, 'gu'), ''));
      if (PATTERNS.some(p => p.w.length >= 3 && n.includes(p.w))) for (let k = 0; k < m[0].length; k++) mask[m.index + k] = true;
    }
  let out = '';
  for (let i = 0; i < src.length; i++) out += mask[i] && !/\s/.test(src[i]) ? '*' : src[i];
  return out;
}

/** Bevat de tekst een scheldwoord? (voor namen van kamers en clubs) */
export const isRude = text => cleanText(text) !== String(text);
