// Gedeelde toestand van de client: spelgegevens (G), mijn speler (me), three.js-objecten (R) en kleine hulpjes.
import * as S from '../shared.js';
import * as A from '../audio.js';

export const $ = id => document.getElementById(id);
export const BUILD = window.__BUILD;
export const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('vv_' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('vv_' + k, JSON.stringify(v));
    } catch {}
  },
};
export const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const MOUNT_N = ['walk', 'bike', 'scooter', 'boat'];

/* ------------------------------------------------------------------ toestand */
export const G = {
  ws: null,
  token: store.get('token', null),
  name: '',
  save: null,
  id: 0,
  inGame: false,
  rooms: [],
  panel: null,
  players: new Map(),
  houses: new Map(),
  fish: new Map(),
  herons: [],
  ducks: [],
  timeOff: 0,
  weather: 'clear',
  merchant: null,
  contest: null,
  weekend: false,
  settings: { q: store.get('q', isTouch ? 0 : 1), vol: store.get('vol', 60), sens: store.get('sens', 100) },
  keys: new Set(),
  actHeld: false,
  reelSent: false,
  lastPosSent: 0,
  lastSentX: 1e9,
  lastSentZ: 1e9,
  fight: null,
  catchCard: null,
  interact: null,
  photo: false,
  chatOpen: false,
  offer: null,
  aim: null,
  statusUntil: 0,
  fps: 60,
  hudT: 0,
  shake: 0,
  outdated: false,
  quality: 1,
  // nieuw: werpen, technieken, stekken, reuzenvis, samen spelen, verbinding
  charge: null, // krachtbalk: { t0 } zolang je de werpknop ingedrukt houdt
  tech: 'dobber', // techniek van je huidige worp
  hot: new Map(), // vijver -> [[x, z], ...] visstekken
  boss: null, // reuzenvis (info van de server) of null
  social: null, // vrienden, club, clubs en dagdoel (van de server)
  community: null, // het gezamenlijke dagdoel
  socialTab: 'Kamer',
  roomId: 0,
  afterLeave: null, // bericht om te sturen zodra je een kamer uit bent (overstappen naar een andere kamer)
  afterJoin: null, // actie na het binnenkomen van een kamer (bijv. een huis bezoeken)
  reconnecting: false,
  linkRoom: +new URLSearchParams(location.search).get('kamer') || 0, // uitnodigingslink ?kamer=…
  canInstall: false,
};
export const me = {
  x: S.SPAWN.x,
  z: S.SPAWN.z,
  y: 0,
  ry: Math.PI,
  mount: 'walk',
  speed: 0,
  fs: 0,
  yaw: Math.PI,
  pitch: -0.18,
  dist: 5.2,
  run: false,
};
export const R = { renderer: null, scene: null, camera: null, world: null, clock: null, minimapImg: null, meE: null }; // three.js-objecten en mijn eigen speler
export const fx = []; // rimpelingen
export const send = o => {
  if (G.ws && G.ws.readyState === 1) G.ws.send(JSON.stringify(o));
};
A.setVolume(G.settings.vol / 100);

export const phase = () => S.dayPhase(Date.now() + G.timeOff);
export const nearPond = () => S.nearestPond(me.x, me.z);
