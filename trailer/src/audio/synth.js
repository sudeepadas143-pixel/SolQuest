// The game's synth voices, for the trailer's 140 bpm cue. These mirror the
// instrument table, note voice and drum voices in src/systems/audio.js
// (soft / bell / pluck / pad / bass / brass / drive; k s h r t c drums), with
// one change: they schedule at absolute times into an OfflineAudioContext
// instead of "now + at" in a live context.
import { prng } from '../remap.js';

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const freq = (tok) => {
  const m = /^([A-G][#b]?)(\d)$/.exec(tok);
  if (!m) return null;
  const n = NOTE[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((n - 69) / 12);
};
export const chord = (tok) => (tok && tok.includes('+') ? tok.split('+') : [tok]).map(freq).filter(Boolean);

// ---- src/systems/audio.js INSTR, verbatim
export const INSTR = {
  soft:  { waves: [['triangle', 0], ['sine', 1200]], mix: [1, 0.25], a: 0.02, d: 0.3, s: 0.6, r: 0.18, lp: 2600, vib: 4 },
  bell:  { waves: [['sine', 0], ['sine', 1200], ['triangle', 1902]], mix: [1, 0.35, 0.08], a: 0.004, d: 0.55, s: 0.12, r: 0.35, lp: 4200 },
  pluck: { waves: [['square', -5], ['square', 5]], mix: [0.5, 0.5], a: 0.004, d: 0.16, s: 0.35, r: 0.1, lp: 1700, lpEnv: 2600 },
  pad:   { waves: [['sawtooth', -8], ['sawtooth', 8]], mix: [0.5, 0.5], a: 0.35, d: 0.6, s: 0.8, r: 0.6, lp: 900 },
  bass:  { waves: [['triangle', 0], ['sine', -1200]], mix: [1, 0.4], a: 0.01, d: 0.2, s: 0.7, r: 0.08, lp: 700 },
  brass: { waves: [['sawtooth', -7], ['sawtooth', 7], ['square', -1200]], mix: [0.45, 0.45, 0.2], a: 0.018, d: 0.22, s: 0.7, r: 0.12, lp: 1300, lpEnv: 1500, vib: 3 },
  drive: { waves: [['sawtooth', 0], ['triangle', -1200]], mix: [0.5, 0.7], a: 0.006, d: 0.12, s: 0.6, r: 0.05, lp: 520, lpEnv: 500 },
};

export function makeSynth(ctx, seed = 1) {
  const rnd = prng(seed);
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  // ---- tone / noise: the game's voices with an absolute start time
  function tone(dest, type, f0, dur, { vol = 0.2, f1 = null, at = 0, attack = 0.005, release = 0.04, detune = 0 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0, at);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.setValueAtTime(vol, at + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
    return g;
  }
  function noise(dest, dur, { vol = 0.2, at = 0, filter = 'bandpass', f = 2000, q = 1, f1 = null, curve = 'exp' } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = filter;
    flt.frequency.setValueAtTime(f, at);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, at + dur);
    flt.Q.value = q;
    const g = ctx.createGain();
    if (curve === 'exp') {
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    } else {           // 'rise': swells up to vol and stops dead (risers, reverse swells)
      g.gain.setValueAtTime(0.0008, at);
      g.gain.exponentialRampToValueAtTime(vol, at + dur);
      g.gain.setValueAtTime(0, at + dur);
    }
    src.connect(flt).connect(g).connect(dest);
    src.start(at, rnd() * 1.5);
    src.stop(at + dur + 0.02);
    return g;
  }

  // ---- the game's note voice (play()), absolute time
  function play(dest, instr, f, dur, at, vol, echo = null) {
    const I = INSTR[instr] ?? INSTR.soft;
    const t = at;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.4;
    lp.frequency.setValueAtTime(I.lp + (I.lpEnv ?? 0), t);
    if (I.lpEnv) lp.frequency.exponentialRampToValueAtTime(I.lp, t + I.d);
    const sus = vol * I.s;
    const end = t + Math.max(dur, I.a + 0.02);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + I.a);
    g.gain.setTargetAtTime(sus, t + I.a, I.d / 3);
    g.gain.setTargetAtTime(0.0001, end, I.r / 3);
    lp.connect(g).connect(dest);
    if (echo) g.connect(echo);
    I.waves.forEach(([type, cents], k) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      og.gain.value = I.mix[k] ?? 1;
      o.type = type;
      o.frequency.value = f;
      o.detune.value = cents;
      if (I.vib) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 5.2;
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(I.vib, t + 0.35);
        lfo.connect(lg).connect(o.detune);
        lfo.start(t);
        lfo.stop(end + I.r + 0.1);
      }
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(end + I.r + 0.1);
    });
  }

  // ---- the game's drum tokens (k s h r t c), absolute time
  function drum(dest, D, at, dv = 0.6) {
    if (D === 'k') tone(dest, 'sine', 120, 0.16, { vol: 0.32 * dv, f1: 45, at });
    if (D === 's') noise(dest, 0.16, { vol: 0.07 * dv, f: 1400, q: 0.5, at });
    if (D === 'h') noise(dest, 0.03, { vol: 0.018 * dv, filter: 'highpass', f: 6500, at });
    if (D === 'r') noise(dest, 0.5, { vol: 0.03 * dv, filter: 'bandpass', f: 3500, q: 0.4, at });
    if (D === 't') { tone(dest, 'sine', 98, 0.45, { vol: 0.2 * dv, f1: 62, at }); noise(dest, 0.18, { vol: 0.05 * dv, filter: 'lowpass', f: 600, at }); }
    if (D === 'c') noise(dest, 0.9, { vol: 0.045 * dv, filter: 'highpass', f: 5000, at });
  }

  return { ctx, rnd, noiseBuf, tone, noise, play, drum, impulse };
}
