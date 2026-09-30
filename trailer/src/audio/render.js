// Offline audio render, on the same timeline as the picture.
//
// Game SFX: the game's real src/systems/audio.js is imported and "unlocked"
// against an OfflineAudioContext (via a proxy that also reroutes its output),
// then sfx(name) is called at each cue by suspending the offline render at
// that exact time - so the trailer plays the game's sound effects, unchanged.
// Music + trailer sound design are scheduled up front. A lookahead limiter
// keeps true peaks under -1 dBTP; the pre-drop gap is exact digital silence.
import { makeSynth } from './synth.js';
import { scheduleTrack } from './track.js';
import { makeFx } from './fx.js';
import { cues, SILENCE0, DROP, END, FLICK0 } from '../timeline.js';
import { DURATION, T } from '../grid.js';
import { prng } from '../remap.js';

export const SR = 48000;
let cached = null;

export async function renderAudio() {
  if (cached) return cached;
  const len = Math.ceil(DURATION * SR);
  const off = new OfflineAudioContext({ numberOfChannels: 2, length: len, sampleRate: SR });
  const realRandom = Math.random;
  const RealAC = window.AudioContext;
  Math.random = prng(20260930);          // the game's noise buffers and offsets, made repeatable

  // ---------------------------------------------------------------- buses
  const master = off.createGain();
  master.connect(off.destination);
  const gated = (gain) => {
    const g = off.createGain();
    g.gain.setValueAtTime(gain, 0);
    g.gain.setValueAtTime(0, SILENCE0);
    g.gain.setValueAtTime(gain, DROP);
    g.connect(master);
    return g;
  };
  const musicOut = gated(1.0);
  musicOut.gain.setValueAtTime(0, END);                    // the music cuts to one beat
  const sfxOut = gated(1.7);
  const fxOut = gated(0.9);

  // music: game voices -> build filter -> dry + room reverb + dotted-8th echo
  const synth = makeSynth(off, 7);
  const music = off.createGain();
  const build = off.createBiquadFilter();
  build.type = 'lowpass';
  build.Q.value = 0.7;
  build.frequency.setValueAtTime(9000, 0);
  build.frequency.setValueAtTime(1500, FLICK0);
  build.frequency.exponentialRampToValueAtTime(9000, SILENCE0);   // the bars 7-8 sweep
  build.frequency.setValueAtTime(9000, DROP);
  // bars 7-8 swell into the cut instead of sagging under the filter
  music.gain.setValueAtTime(1, FLICK0);
  music.gain.linearRampToValueAtTime(1.5, SILENCE0);
  music.gain.setValueAtTime(1, DROP);
  music.connect(build);
  build.connect(musicOut);
  const verb = off.createConvolver();
  verb.buffer = synth.impulse(2.2, 2.8);
  const wet = off.createGain();
  wet.gain.value = 0.2;
  build.connect(verb).connect(wet).connect(musicOut);
  const echo = off.createDelay(1.0);
  echo.delayTime.value = (60 / 140) * 0.75;                // dotted eighth at 140 bpm
  const fb = off.createGain();
  fb.gain.value = 0.28;
  const echoLp = off.createBiquadFilter();
  echoLp.type = 'lowpass';
  echoLp.frequency.value = 2200;
  const echoOut = off.createGain();
  echoOut.gain.value = 0.22;
  echo.connect(echoLp).connect(fb).connect(echo);
  echoLp.connect(echoOut).connect(music);
  // duck the music a little under the big hits
  const duck = off.createGain();
  musicOut.disconnect();
  musicOut.connect(duck).connect(master);
  for (const t of [DROP, T(10), T(12), T(14), T(15)]) {
    duck.gain.setValueAtTime(1, t);
    duck.gain.linearRampToValueAtTime(0.55, t + 0.01);
    duck.gain.linearRampToValueAtTime(1, t + 0.35);
  }

  const fxSynth = makeSynth(off, 99);
  const fxVerb = off.createConvolver();
  fxVerb.buffer = fxSynth.impulse(3.0, 2.2);
  const fxIn = off.createGain();
  fxIn.connect(fxOut);
  const fxWet = off.createGain();
  fxWet.gain.value = 0.25;
  fxIn.connect(fxVerb).connect(fxWet).connect(fxOut);
  const { fx, kit } = makeFx(fxSynth, fxIn);
  const drumKit = makeFx(makeSynth(off, 5), music).kit;

  scheduleTrack(synth, music, echo, drumKit);
  for (const c of cues) if (c.type === 'fx') fx[c.name](c.t, c.opts ?? {});

  // ------------------------------------------------ the game's own SFX
  const gameIn = off.createGain();
  gameIn.connect(sfxOut);
  const proxy = new Proxy(off, {
    get(target, prop) {
      if (prop === 'destination') return gameIn;
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  window.AudioContext = function OfflineAsLive() { return proxy; };
  const game = await import('@game/systems/audio.js');
  game.unlockAudio();
  window.AudioContext = RealAC;
  const q = (t) => Math.round((t * SR) / 128) * 128 / SR;
  const groups = new Map();
  for (const c of cues) {
    if (c.type !== 'sfx') continue;
    const k = q(c.t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const fired = [];
  for (const [k, list] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const fire = () => list.forEach((c) => { game.sfx(c.name, c.opts); fired.push([c.name, +off.currentTime.toFixed(4)]); });
    if (k <= 0) fire();
    else off.suspend(k).then(() => { fire(); off.resume(); });
  }

  const buf = await off.startRendering();
  Math.random = realRandom;

  // ------------------------------------------------------ master + limiter
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const pre = peakDb(L, R);
  limit(L, R, SR, -2.0);
  // exact digital silence before the drop, and a clean tail at the end
  const s0 = Math.floor(SILENCE0 * SR);
  const s1 = Math.floor(DROP * SR);
  L.fill(0, s0, s1);
  R.fill(0, s0, s1);
  const f0 = Math.floor((DURATION - 0.3) * SR);
  for (let i = f0; i < L.length; i++) {
    const g = 0.5 + 0.5 * Math.cos(Math.PI * ((i - f0) / (L.length - f0)));
    L[i] *= g;
    R[i] *= g;
  }
  const report = {
    sampleRate: SR, seconds: L.length / SR, preLimiterPeakDb: pre, postPeakDb: peakDb(L, R),
    silence: { from: SILENCE0, to: DROP, maxAbs: maxAbs(L, R, s0, s1) },
    sfxFired: fired.length, sfxCues: cues.filter((c) => c.type === 'sfx').length,
    sections: sectionLevels(L, R),
  };
  cached = { wav: encodeWav(L, R, SR), report, buffer: buf };
  return cached;
}

function peakDb(L, R) {
  let p = 0;
  for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  return +(20 * Math.log10(p || 1e-9)).toFixed(2);
}
function maxAbs(L, R, a, b) {
  let p = 0;
  for (let i = a; i < b; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  return p;
}
function sectionLevels(L, R) {
  const out = {};
  const secs = [['candles', 0, T(2)], ['grass', T(2), T(3)], ['world', T(3), T(5)], ['battle', T(5), T(7)],
    ['build', T(7), SILENCE0], ['drop', DROP, T(12)], ['countdown', T(12), T(15)], ['newmap', T(15), T(16)], ['end', T(16), 30]];
  for (const [k, a, b] of secs) {
    let s = 0;
    const i0 = Math.floor(a * SR);
    const i1 = Math.floor(b * SR);
    for (let i = i0; i < i1; i++) s += (L[i] * L[i] + R[i] * R[i]) / 2;
    out[k] = +(10 * Math.log10(s / (i1 - i0) || 1e-12)).toFixed(1);
  }
  return out;
}

/** Lookahead brickwall: the gain reaches its target exactly at each peak
 *  (sliding-window minimum + box ramp over the lookahead), then releases
 *  smoothly. Deterministic. */
function limit(L, R, sr, ceilingDb, lookMs = 5, relMs = 90) {
  const ceil = 10 ** (ceilingDb / 20);
  const n = L.length;
  const la = Math.max(1, Math.round((lookMs * sr) / 1000));
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    req[i] = p > ceil ? ceil / p : 1;
  }
  const mn = new Float32Array(n);
  const dq = new Int32Array(n);
  let h = 0;
  let tl = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (tl > h && req[dq[tl - 1]] >= req[i]) tl--;
    dq[tl++] = i;
    while (dq[h] > i + la) h++;
    mn[i] = req[dq[h]];
  }
  const g1 = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += mn[i];
    if (i >= la) acc -= mn[i - la];
    g1[i] = acc / Math.min(i + 1, la);      // box-filtered sliding min: <= the required gain at every sample
  }
  const rel = 1 - Math.exp(-1 / ((relMs / 1000) * sr));
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = g1[i] < g ? g1[i] : g + (g1[i] - g) * rel;
    L[i] *= g;
    R[i] *= g;
  }
}

function encodeWav(L, R, sr) {
  const n = L.length;
  const buf = new ArrayBuffer(44 + n * 8);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 8, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 8, true); v.setUint16(32, 8, true); v.setUint16(34, 32, true);
  w(36, 'data'); v.setUint32(40, n * 8, true);
  let o = 44;
  for (let i = 0; i < n; i++) { v.setFloat32(o, L[i], true); v.setFloat32(o + 4, R[i], true); o += 8; }
  return buf;
}
