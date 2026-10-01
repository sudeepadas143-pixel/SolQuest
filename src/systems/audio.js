// Procedural audio: every sound effect is synthesised, and the music is a tiny
// look-ahead step sequencer playing the tracks in data/music.js. No audio files.
import { TRACKS } from '../data/music.js';
import { volume, onSetting } from './settings.js';

// bus levels at full volume (the settings scale them)
const MUSIC_GAIN = 0.55;
const SFX_GAIN = 0.7;

let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let noiseBuf = null;
let rainNode = null;
let rainGain = null;
let reverb = null;
let echo = null;
let muted = false;
try { muted = localStorage.getItem('eliteRoute.muted') === '1'; } catch { /* ignore */ }

let wantTrack = null;
let wantOpts = {};
let current = null; // { name, step, next, timer, gain }

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const freq = (tok) => {
  const m = /^([A-G][#b]?)(\d)$/.exec(tok);
  if (!m) return null;
  const n = NOTE[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((n - 69) / 12);
};

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ctx.destination);
  // music: dry + a soft room reverb, gently low-passed so nothing is shrill
  musicBus = ctx.createGain();
  musicBus.gain.value = MUSIC_GAIN * volume('music');
  const tame = ctx.createBiquadFilter();
  tame.type = 'lowpass';
  tame.frequency.value = 5200;
  musicBus.connect(tame);
  tame.connect(master);
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(2.2, 2.8);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  tame.connect(reverb);
  reverb.connect(wet).connect(master);
  // echo send for lead voices (dotted-eighth-ish, low feedback)
  echo = ctx.createDelay(1.0);
  echo.delayTime.value = 0.33;
  const fb = ctx.createGain();
  fb.gain.value = 0.28;
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.22;
  const echoLp = ctx.createBiquadFilter();
  echoLp.type = 'lowpass';
  echoLp.frequency.value = 2200;
  echo.connect(echoLp).connect(fb).connect(echo);
  echoLp.connect(echoOut).connect(musicBus);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = SFX_GAIN * volume('sfx');
  const sfxLp = ctx.createBiquadFilter();
  sfxLp.type = 'lowpass';
  sfxLp.frequency.value = 6500;
  sfxBus.connect(sfxLp).connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (wantTrack) startTrack(wantTrack, wantOpts);
}

/** Stereo noise impulse with an exponential tail (a small, soft room). */
function impulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

export function isMuted() { return muted; }
// volume changes from the settings menu apply at once
onSetting((k) => {
  if (!ctx) return;
  if (k === 'music') musicBus.gain.setTargetAtTime(MUSIC_GAIN * volume('music'), ctx.currentTime, 0.05);
  if (k === 'sfx') sfxBus.gain.setTargetAtTime(SFX_GAIN * volume('sfx'), ctx.currentTime, 0.05);
});

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('eliteRoute.muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}

// ------------------------------------------------------------------ voices
function tone(type, f0, dur, { vol = 0.2, f1 = null, at = 0, attack = 0.005, bus = sfxBus, release = 0.04 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.2, at = 0, filter = 'bandpass', f = 2000, q = 1, f1 = null, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter();
  flt.type = filter;
  flt.frequency.setValueAtTime(f, t);
  if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  flt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(flt).connect(g).connect(bus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

/** Pushing through tall grass: a soft swish of parting blades under a spray
 *  of short, bright blade-on-blade grains, panned a little either side,
 *  swelling and dying away. Bypasses the SFX low-pass so the top end stays
 *  crisp. run: a shorter, denser, louder brush. */
function grassRustle({ run = false } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.005;
  const dur = run ? 0.3 : 0.46;
  const out = ctx.createGain();
  out.gain.value = run ? 0.95 : 0.8;
  out.connect(master);
  const src = (at, len) => {
    const b = ctx.createBufferSource();
    b.buffer = noiseBuf;
    b.start(at, Math.random() * 1.5);
    b.stop(at + len + 0.03);
    return b;
  };
  // the body: broadband swish, its band sliding down as the blades part and settle
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 450;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.55;
  bp.frequency.setValueAtTime(3200, t0);
  bp.frequency.exponentialRampToValueAtTime(1300, t0 + dur);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t0);
  bg.gain.exponentialRampToValueAtTime(run ? 0.08 : 0.065, t0 + dur * 0.28);
  bg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src(t0, dur).connect(hp).connect(bp).connect(bg).connect(out);
  // the grains: many tiny scrapes, densest mid-stride
  const n = run ? 18 : 24;
  for (let i = 0; i < n; i++) {
    const k = Math.random();
    const at = t0 + dur * 0.92 * (i % 3 === 0 ? k : Math.sin((k * Math.PI) / 2) * 0.8);
    const len = 0.01 + Math.random() * 0.045;
    const swell = Math.sin(Math.PI * Math.min(1, (at - t0) / dur));
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400 + Math.random() * 6200;
    f.Q.value = 0.8 + Math.random() * 2.4;
    const g = ctx.createGain();
    const v = (0.012 + 0.05 * swell * Math.random()) * (run ? 1.2 : 1);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    let node = src(at, len).connect(f).connect(g);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 0.9;
      node = node.connect(pan);
    }
    node.connect(out);
  }
  // a couple of dry stem ticks
  for (let i = 0; i < 2; i++) {
    const at = t0 + dur * (0.15 + Math.random() * 0.55);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 4500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.045, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.008);
    src(at, 0.01).connect(f).connect(g).connect(out);
  }
}

const arp = (type, notes, step, vol = 0.14) => notes.forEach((n, i) => tone(type, freq(n), step * 1.1, { vol, at: i * step }));

const SFX = {
  cursor: () => tone('triangle', 880, 0.04, { vol: 0.07 }),
  tick: () => tone('triangle', 1320, 0.025, { vol: 0.035 }),
  type: () => tone('sine', 1180, 0.018, { vol: 0.012 }),
  confirm: () => { tone('triangle', 660, 0.06, { vol: 0.09 }); tone('triangle', 990, 0.09, { vol: 0.09, at: 0.05 }); },
  cancel: () => { tone('triangle', 440, 0.06, { vol: 0.08 }); tone('triangle', 330, 0.08, { vol: 0.08, at: 0.05 }); },
  open: () => tone('triangle', 520, 0.09, { vol: 0.12, f1: 880 }),
  bump: () => tone('triangle', 110, 0.08, { vol: 0.22, f1: 70 }),
  grass: (o) => grassRustle(o),
  // a soft footstep on stone (Cooker coming down the carpet)
  footstep: () => { noise(0.09, { vol: 0.09, filter: 'lowpass', f: 700, f1: 200 }); tone('sine', 90, 0.08, { vol: 0.07, f1: 60 }); },
  door: () => { noise(0.18, { vol: 0.12, f: 600, f1: 200 }); tone('triangle', 180, 0.12, { vol: 0.1 }); },
  heal: () => arp('triangle', ['C5', 'E5', 'G5', 'C6', 'E6'], 0.08, 0.12),
  item: () => arp('triangle', ['G5', 'C6', 'E6', 'G6'], 0.07, 0.1),
  save: () => arp('triangle', ['E5', 'A5'], 0.08, 0.09),
  levelup: () => arp('triangle', ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'], 0.06, 0.1),
  spotted: () => { tone('triangle', 1100, 0.08, { vol: 0.1 }); tone('triangle', 1650, 0.16, { vol: 0.1, at: 0.08 }); },
  encounter: () => { tone('triangle', 200, 0.45, { vol: 0.09, f1: 1200 }); noise(0.4, { vol: 0.04, f: 800, f1: 3500 }); },
  encounterTrainer: () => { [0, 0.12, 0.24].forEach((at, i) => tone('triangle', [440, 415, 392][i], 0.12, { vol: 0.1, at })); noise(0.5, { vol: 0.05, f: 500, f1: 3000, at: 0.3 }); },
  vs: () => { noise(0.6, { vol: 0.2, filter: 'lowpass', f: 3000, f1: 200 }); tone('sawtooth', 110, 0.5, { vol: 0.12, f1: 55 }); },
  cry: () => { const f = 300 + Math.random() * 500; tone('sawtooth', f, 0.28, { vol: 0.07, f1: f * 1.6 }); tone('square', f * 1.5, 0.2, { vol: 0.04, at: 0.12, f1: f }); },
  sendout: () => noise(0.25, { vol: 0.1, f: 1200, f1: 6000 }),
  attack: () => noise(0.09, { vol: 0.12, f: 2500, q: 0.7 }),
  hit: () => { noise(0.14, { vol: 0.22, filter: 'lowpass', f: 1800, f1: 300 }); tone('triangle', 150, 0.1, { vol: 0.15, f1: 60 }); },
  superHit: () => { noise(0.25, { vol: 0.3, filter: 'lowpass', f: 3000, f1: 200 }); tone('square', 220, 0.18, { vol: 0.1, f1: 50 }); },
  weakHit: () => noise(0.1, { vol: 0.1, filter: 'lowpass', f: 900, f1: 300 }),
  status: () => tone('sine', 500, 0.3, { vol: 0.1, f1: 900 }),
  statUp: () => arp('triangle', ['C5', 'D5', 'E5', 'G5'], 0.05, 0.1),
  statDown: () => arp('triangle', ['G5', 'E5', 'D5', 'C5'], 0.05, 0.1),
  faint: () => tone('sawtooth', 400, 0.6, { vol: 0.08, f1: 60 }),
  xp: () => tone('sine', 700, 0.5, { vol: 0.06, f1: 1400 }),
  lowHp: () => { tone('triangle', 988, 0.07, { vol: 0.05 }); tone('triangle', 988, 0.07, { vol: 0.05, at: 0.14 }); },
  evolve: () => arp('triangle', ['C6', 'E6', 'G6', 'C7'], 0.09, 0.1),
  thunder: () => { noise(2.2, { vol: 0.45, filter: 'lowpass', f: 900, f1: 60, q: 0.5 }); noise(0.3, { vol: 0.2, filter: 'lowpass', f: 3000, f1: 400 }); },
  fanfare: () => arp('triangle', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.08, 0.1),
  evolveBurst: () => {
    noise(1.4, { vol: 0.3, filter: 'lowpass', f: 6000, f1: 300, q: 0.4 });
    tone('sine', 110, 1.2, { vol: 0.25, f1: 40 });
    arp('triangle', ['C6', 'G6', 'C7', 'E7'], 0.05, 0.08);
  },
  // the Elite Hall's doors shutting behind you: a deep, heavy boom
  hallDoors: () => {
    noise(0.9, { vol: 0.28, filter: 'lowpass', f: 900, f1: 80, q: 0.6 });
    tone('sine', 70, 1.1, { vol: 0.3, f1: 38 });
    tone('triangle', 140, 0.25, { vol: 0.12, f1: 60 });
  },
  // an aisle brazier catching: a soft whoosh and a crackle
  ignite: () => {
    noise(0.55, { vol: 0.16, filter: 'bandpass', f: 500, f1: 2400, q: 0.7 });
    noise(0.12, { vol: 0.08, filter: 'highpass', f: 3000, f1: 5000, at: 0.18 });
    tone('sine', 90, 0.4, { vol: 0.08, f1: 60 });
  },
  // ambient: a small bird somewhere nearby (two or three quick rising tweets)
  chirp: () => {
    const n = 2 + Math.floor(Math.random() * 2);
    const f = 2600 + Math.random() * 900;
    for (let i = 0; i < n; i++) tone('sine', f, 0.05, { vol: 0.016, f1: f * 1.35, at: i * 0.09, attack: 0.004, release: 0.03 });
  },
  // ambient: crickets in the night grass (a soft trill)
  cricket: () => {
    const f = 4300 + Math.random() * 500;
    for (let i = 0; i < 6; i++) tone('triangle', f, 0.022, { vol: 0.007, at: i * 0.045, attack: 0.002, release: 0.01 });
  },
  // every flame in the Hall flaring at once
  flare: () => {
    noise(1.2, { vol: 0.26, filter: 'lowpass', f: 400, f1: 4000, q: 0.5 });
    tone('sine', 55, 1.3, { vol: 0.32, f1: 35 });
  },
};

export function sfx(name, opts) {
  if (!ctx || muted) return;
  SFX[name]?.(opts);
}

// -------------------------------------------------------------------- music
// Instruments are deliberately soft: filtered, enveloped, a little detuned.
const INSTR = {
  // warm triangle lead with a hint of vibrato
  soft:  { waves: [['triangle', 0], ['sine', 1200]], mix: [1, 0.25], a: 0.02, d: 0.3, s: 0.6, r: 0.18, lp: 2600, vib: 4 },
  // mallet / music box: fast decay, octave partial
  bell:  { waves: [['sine', 0], ['sine', 1200], ['triangle', 1902]], mix: [1, 0.35, 0.08], a: 0.004, d: 0.55, s: 0.12, r: 0.35, lp: 4200 },
  // plucked pulse for battles: bright attack, closes quickly
  pluck: { waves: [['square', -5], ['square', 5]], mix: [0.5, 0.5], a: 0.004, d: 0.16, s: 0.35, r: 0.1, lp: 1700, lpEnv: 2600 },
  // pad: detuned saws through a low filter, slow swell
  pad:   { waves: [['sawtooth', -8], ['sawtooth', 8]], mix: [0.5, 0.5], a: 0.35, d: 0.6, s: 0.8, r: 0.6, lp: 900 },
  bass:  { waves: [['triangle', 0], ['sine', -1200]], mix: [1, 0.4], a: 0.01, d: 0.2, s: 0.7, r: 0.08, lp: 700 },
  // punchy filtered brass for boss themes: bright bite on the attack, then mellows
  brass: { waves: [['sawtooth', -7], ['sawtooth', 7], ['square', -1200]], mix: [0.45, 0.45, 0.2], a: 0.018, d: 0.22, s: 0.7, r: 0.12, lp: 1300, lpEnv: 1500, vib: 3 },
  // driving bass for battles: a touch of grit
  drive: { waves: [['sawtooth', 0], ['triangle', -1200]], mix: [0.5, 0.7], a: 0.006, d: 0.12, s: 0.6, r: 0.05, lp: 520, lpEnv: 500 },
};

const chord = (tok) => (tok && tok.includes('+') ? tok.split('+') : [tok]).map(freq).filter(Boolean);

function play(instr, f, dur, at, vol, bus, send = false) {
  const I = INSTR[instr] ?? INSTR.soft;
  const t = ctx.currentTime + at;
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(I.lp + (I.lpEnv ?? 0), t);
  if (I.lpEnv) lp.frequency.exponentialRampToValueAtTime(I.lp, t + I.d);
  const peak = vol;
  const sus = vol * I.s;
  const end = t + Math.max(dur, I.a + 0.02);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + I.a);
  g.gain.setTargetAtTime(sus, t + I.a, I.d / 3);
  g.gain.setTargetAtTime(0.0001, end, I.r / 3);
  lp.connect(g).connect(bus);
  if (send && echo) g.connect(echo);
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

function parse(str) { return str ? str.split(/\s+/).filter(Boolean) : []; }

/**
 * opts.sync: () => seconds | null. Keeps the track locked to an external clock
 * that loops with it (the title video): the track starts at that position and
 * re-syncs at the top of every loop (a looping video pauses a little at its
 * wrap, so the two would otherwise drift apart). null = clock not running.
 */
function startTrack(name, opts = {}) {
  stopTrack();
  const tr = TRACKS[name];
  if (!tr || !ctx) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(tr.vol ?? 1, ctx.currentTime + 0.6);
  gain.connect(musicBus);
  const cur = {
    name, tr, gain, step: 0, next: ctx.currentTime + 0.08,
    lead: parse(tr.lead_), bass: parse(tr.bass), drums: parse(tr.drums), pad: parse(tr.pad), harm: parse(tr.harm),
  };
  cur.len = Math.max(cur.lead.length, cur.bass.length, cur.drums.length, cur.pad.length, cur.harm.length);
  const stepDur = 60 / tr.bpm / 4;
  const holdLen = (arr, i) => { let n = 1; while (arr[(i + n) % arr.length] === '-' && n < 64) n++; return n; };
  // resume: when starting mid-track, also sound a note that is being held
  // through this step (struck earlier), for the rest of its length
  const voice = (arr, instr, vol, send, resume = false) => {
    if (!arr.length) return;
    const i = cur.step % arr.length;
    let j = i;
    if (resume) while (arr[j] === '-' && j > 0) j--;
    const fs = chord(arr[j]);
    if (!fs.length) return;
    const dur = stepDur * holdLen(arr, i) * 0.96;
    const at = cur.next - ctx.currentTime;
    for (const f of fs) play(instr, f, dur, at, vol / Math.sqrt(fs.length), gain, send);
  };
  const loopLen = cur.len * stepDur;
  let resume = false;
  // jump to position `pos` (seconds into the loop), at the next step boundary
  const seek = (pos) => {
    const now = ctx.currentTime;
    const p = (((pos + 0.06) % loopLen) + loopLen) % loopLen;
    const k = Math.ceil(p / stepDur - 1e-6);
    cur.next = now + 0.06 + (k * stepDur - p);
    cur.step = k % cur.len;
    resume = true;
  };
  const clock = () => { const v = opts.sync?.(); return Number.isFinite(v) ? v : null; };
  if (clock() !== null) seek(clock());
  const schedule = () => {
    while (cur.next < ctx.currentTime + 0.14) {
      const i = cur.step % cur.len;
      if (i === 0 && cur.step > 0 && tr.loop === false) { stopTrack(); return; }
      if (i === 0 && opts.sync && !resume) {
        // top of the loop: where will the clock be when this step sounds?
        const v = clock();
        if (v !== null) {
          const ahead = cur.next - ctx.currentTime;
          const d = ((((v + ahead + loopLen / 2) % loopLen) + loopLen) % loopLen) - loopLen / 2;
          if (Math.abs(d) > 0.04) { seek(v); continue; }
        }
      }
      const dyn = tr.dyn ? tr.dyn[Math.floor(i / 16) % tr.dyn.length] : 1;   // per-bar dynamics
      voice(cur.lead, tr.lead ?? 'soft', (tr.leadVol ?? 0.09) * dyn, true, resume);
      voice(cur.harm, tr.harmInstr ?? 'bell', (tr.harmVol ?? 0.04) * dyn, false, resume);
      voice(cur.pad, 'pad', (tr.padVol ?? 0.035) * dyn, false, resume);
      voice(cur.bass, tr.bassInstr ?? 'bass', (tr.bassVol ?? 0.13) * dyn, false, resume);
      resume = false;
      const D = cur.drums[i % (cur.drums.length || 1)];
      const dv = tr.drumVol ?? 0.6;
      const at = cur.next - ctx.currentTime;
      if (D === 'k') tone('sine', 120, 0.16, { vol: 0.32 * dv, f1: 45, at, bus: gain });
      if (D === 's') noise(0.16, { vol: 0.07 * dv, f: 1400, q: 0.5, at, bus: gain });
      if (D === 'h') noise(0.03, { vol: 0.018 * dv, filter: 'highpass', f: 6500, at, bus: gain });
      if (D === 'r') noise(0.5, { vol: 0.03 * dv, filter: 'bandpass', f: 3500, q: 0.4, at, bus: gain });  // soft brush roll
      if (D === 't') { tone('sine', 98, 0.45, { vol: 0.2 * dv, f1: 62, at, bus: gain }); noise(0.18, { vol: 0.05 * dv, filter: 'lowpass', f: 600, at, bus: gain }); }  // timpani
      if (D === 'c') noise(0.9, { vol: 0.045 * dv, filter: 'highpass', f: 5000, at, bus: gain });   // soft crash
      cur.step++;
      cur.next += stepDur;
    }
  };
  cur.timer = setInterval(schedule, 25);
  schedule();
  current = cur;
}

function stopTrack() {
  if (!current) return;
  clearInterval(current.timer);
  const g = current.gain;
  if (ctx) {
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => g.disconnect(), 1200);
  }
  current = null;
}

/**
 * Switch music (null = silence). Safe to call before audio is unlocked.
 * opts.sync: lock the track to a looping clock (see startTrack).
 */
export function music(name, opts = {}) {
  wantTrack = name;
  wantOpts = opts;
  if (!ctx) return;
  if (current?.name === name) return;
  if (!name) { stopTrack(); return; }
  startTrack(name, opts);
}

/** Continuous rain bed; level 0..1. */
export function rainAmbience(level) {
  if (!ctx) return;
  if (!rainNode && level > 0.01) {
    rainNode = ctx.createBufferSource();
    rainNode.buffer = noiseBuf;
    rainNode.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 1600;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainNode.connect(flt).connect(rainGain).connect(sfxBus);
    rainNode.start();
  }
  if (rainGain) rainGain.gain.setTargetAtTime(level * 0.12, ctx.currentTime, 0.5);
}

/** Debug builds only: an analyser on the master bus (level / brightness checks). */
export function debugTap() {
  if (!ctx) return null;
  const an = ctx.createAnalyser();
  an.fftSize = 4096;
  master.connect(an);
  return an;
}

/** Name of the track currently wanted (for debug checks). */
export function currentTrack() { return wantTrack; }
/** Seconds into the current track's loop (for tests and debugging). */
export function trackClock() {
  if (!current || !ctx) return null;
  const sd = 60 / current.tr.bpm / 4;
  const len = current.len * sd;
  return ((((current.step % current.len) * sd - (current.next - ctx.currentTime)) % len) + len) % len;
}
