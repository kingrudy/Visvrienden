// Visvrienden – geluiden, allemaal zelf gemaakt met WebAudio (geen bestanden).
let ctx = null, master = null, noiseBuf = null, ambient = null, vol = 0.6;
export function setVolume(v) { vol = v; if (master) master.gain.value = v; }
export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mk = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return g; };
    ambient = { water: mk('lowpass', 420), rain: mk('highpass', 2500), wind: mk('bandpass', 700, 0.4) };
  } catch { ctx = null; }
}
const env = (g, t0, a, d, peak) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); };
function tone(freq, dur, type = 'sine', peak = 0.2, slide = 0, delay = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  env(g, t, 0.01, dur, peak); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, freq, type = 'lowpass', peak = 0.3, delay = 0, q = 0.7) {
  if (!ctx) return; const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.3), t + dur); f.Q.value = q; const g = ctx.createGain(); env(g, t, 0.02, dur, peak);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.1);
}
export const sfx = {
  splash: (big, dist = 0) => { const k = Math.max(0, 1 - dist / 60); if (k <= 0) return; noise(big ? 0.45 : 0.25, big ? 1800 : 1200, 'lowpass', (big ? 0.35 : 0.18) * k); tone(big ? 260 : 380, 0.18, 'sine', 0.08 * k, -150); },
  cast: () => { noise(0.25, 3500, 'bandpass', 0.12, 0, 1.5); },
  bite: () => { tone(880, 0.12, 'triangle', 0.25); tone(1320, 0.18, 'triangle', 0.22, 0, 0.1); },
  reel: () => { tone(160 + Math.random() * 30, 0.04, 'square', 0.05); },
  snap: () => { noise(0.2, 5000, 'highpass', 0.3); tone(500, 0.3, 'sawtooth', 0.12, -380); },
  catch: (rar = 0) => { const n = [523, 659, 784, 1047, 1319]; for (let i = 0; i < Math.min(5, 3 + rar); i++) tone(n[i], 0.22, 'triangle', 0.2, 0, i * 0.09); },
  legend: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, 'triangle', 0.2, 0, i * 0.12)); },
  coin: () => { tone(1568, 0.1, 'square', 0.1); tone(2093, 0.18, 'square', 0.1, 0, 0.07); },
  ui: () => tone(660, 0.06, 'triangle', 0.08),
  warn: () => { tone(300, 0.14, 'sawtooth', 0.12); },
  thunder: () => { noise(2.2, 400, 'lowpass', 0.7, 0.3); noise(1.2, 120, 'lowpass', 0.5, 0.9); },
  heron: () => { noise(0.4, 900, 'bandpass', 0.2, 0, 3); tone(300, 0.3, 'sawtooth', 0.1, 200); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.22, 0, i * 0.12)); },
  eat: () => { noise(0.12, 2000, 'bandpass', 0.2, 0, 2); noise(0.12, 2200, 'bandpass', 0.2, 0.18, 2); },
  bird: () => { const f = 2200 + Math.random() * 1500; tone(f, 0.08, 'sine', 0.05, 600); tone(f + 300, 0.07, 'sine', 0.05, 500, 0.1); if (Math.random() < 0.5) tone(f + 100, 0.07, 'sine', 0.04, 400, 0.2); },
  cricket: () => { for (let i = 0; i < 3; i++) tone(4200, 0.03, 'square', 0.015, 0, i * 0.06); },
};
export function ambience(nearWater, rain, windy) { if (!ambient) return; const t = ctx.currentTime; ambient.water.gain.setTargetAtTime(nearWater * 0.07, t, 0.5); ambient.rain.gain.setTargetAtTime(rain * 0.05, t, 0.8); ambient.wind.gain.setTargetAtTime(windy * 0.04, t, 0.8); }
