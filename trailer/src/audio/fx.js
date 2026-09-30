// Trailer sound design (risers, whooshes, impacts, glass, glitches), built
// from the same oscillator + filtered-noise voices as the game's SFX.
export function makeFx(S, dest) {
  const { ctx, tone, noise, rnd } = S;
  const pan = (p, at, p1 = null, dur = 0) => {
    const n = ctx.createStereoPanner();
    n.pan.setValueAtTime(p, at);
    if (p1 !== null) n.pan.linearRampToValueAtTime(p1, at + dur);
    n.connect(dest);
    return n;
  };

  const kit = {
    kick(at, v = 1) {
      tone(dest, 'sine', 150, 0.28, { vol: 0.5 * v, f1: 42, at, attack: 0.001, release: 0.12 });
      tone(dest, 'square', 1900, 0.012, { vol: 0.05 * v, f1: 250, at, attack: 0.001, release: 0.006 });
    },
    clap(at, v = 1) {
      for (const d of [0, 0.011, 0.023]) noise(dest, 0.03, { vol: 0.13 * v, f: 1500, q: 0.9, at: at + d });
      noise(dest, 0.18, { vol: 0.07 * v, f: 1200, q: 0.6, at: at + 0.03 });
    },
  };

  const fx = {
    slam(at, { size = 1 } = {}) {
      tone(dest, 'sine', 95, 0.6, { vol: 0.55 * size, f1: 30, at, attack: 0.002, release: 0.35 });
      noise(dest, 0.24, { vol: 0.45 * size, filter: 'lowpass', f: 2800, f1: 170, at });
      tone(dest, 'square', 1800, 0.02, { vol: 0.08 * size, f1: 300, at, attack: 0.001, release: 0.01 });
      noise(dest, 0.7, { vol: 0.05 * size, filter: 'highpass', f: 3500, at });
    },
    glitch(at, { len = 0.1 } = {}) {
      const n = Math.max(4, Math.round(len / 0.014));
      for (let i = 0; i < n; i++) {
        const t = at + (i / n) * len;
        if (rnd() < 0.55) tone(dest, 'square', 180 + rnd() * 2200, 0.012 + rnd() * 0.018, { vol: 0.05, at: t, attack: 0.001, release: 0.004 });
        else noise(dest, 0.012 + rnd() * 0.02, { vol: 0.12, f: 600 + rnd() * 5000, q: 2, at: t });
      }
    },
    crash(at, { dur }) {            // bar 1: price crash - detuned saws falling through a closing filter
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, at);
      lp.frequency.exponentialRampToValueAtTime(260, at + dur);
      lp.connect(dest);
      for (const d of [-14, 0, 14]) tone(lp, 'sawtooth', 330, dur, { vol: 0.045, f1: 52, at, detune: d, attack: 0.01, release: 0.05 });
      const trem = ctx.createGain();
      trem.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 17.5;
      const lg = ctx.createGain();
      lg.gain.value = 0.025;
      lfo.connect(lg).connect(trem.gain);
      trem.connect(dest);
      tone(trem, 'square', 110, dur, { vol: 1, f1: 55, at, attack: 0.01 });
      lfo.start(at);
      lfo.stop(at + dur);
    },
    swell(at, { dur }) {            // reverse cymbal into the next section
      noise(dest, dur, { vol: 0.12, filter: 'highpass', f: 1400, f1: 5000, at, curve: 'rise' });
    },
    whoosh(at, { dir = 1, soft = false } = {}) {
      const p = pan(-0.7 * dir, at, 0.7 * dir, 0.32);
      const src = ctx.createBufferSource();
      src.buffer = S.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(350, at);
      bp.frequency.exponentialRampToValueAtTime(3200, at + 0.14);
      bp.frequency.exponentialRampToValueAtTime(700, at + 0.34);
      const g = ctx.createGain();
      const v = soft ? 0.09 : 0.2;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(v, at + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
      src.connect(bp).connect(g).connect(p);
      src.start(at, rnd());
      src.stop(at + 0.36);
    },
    riser(at, { dur }) {            // bars 7-8: noise sweep + climbing saws + a snare roll that tightens
      noise(dest, dur, { vol: 0.32, f: 380, f1: 9500, q: 0.8, at, curve: 'rise' });
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(700, at);
      lp.frequency.exponentialRampToValueAtTime(9000, at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(1, at + dur);
      g.gain.setValueAtTime(0, at + dur);
      lp.connect(g).connect(dest);
      for (const d of [-10, 10]) tone(lp, 'sawtooth', 110, dur, { vol: 0.08, f1: 880, at, detune: d, attack: 0.02, release: 0.001 });
      const bar = dur / 1.82;
      let t = at;
      while (t < at + dur - 0.01) {
        const k = (t - at) / dur;
        noise(dest, 0.06, { vol: 0.05 + 0.2 * k, f: 1900, q: 0.7, at: t });
        t += k < 0.5 ? bar / 8 : k < 0.78 ? bar / 16 : bar / 32;
      }
    },
    drop(at) {
      tone(dest, 'sine', 72, 1.7, { vol: 0.7, f1: 27, at, attack: 0.002, release: 1.0 });
      kit.kick(at, 1.4);
      noise(dest, 1.9, { vol: 0.16, filter: 'highpass', f: 4200, at });
      noise(dest, 0.45, { vol: 0.45, filter: 'lowpass', f: 3200, f1: 180, at });
      for (const n of ['E2', 'B2', 'E3', 'G3']) S.play(dest, 'brass', freqOf(n), 0.55, at, 0.08);
    },
    glass(at) {                    // the screen shatters
      noise(dest, 0.14, { vol: 0.4, filter: 'highpass', f: 2600, at });
      tone(dest, 'sine', 120, 0.25, { vol: 0.3, f1: 50, at });
      for (let i = 0; i < 30; i++) {
        const t = at + (rnd() ** 1.8) * 0.75;
        const p = pan(rnd() * 1.6 - 0.8, t);
        tone(p, rnd() < 0.5 ? 'sine' : 'triangle', 2500 + rnd() * 5200, 0.05 + rnd() * 0.16, { vol: 0.02 + rnd() * 0.045, at: t, attack: 0.001, release: 0.08 });
      }
    },
    sparkle(at) {
      [2093, 2637, 3136, 4186, 5274].forEach((f, i) => tone(dest, 'triangle', f, 0.18, { vol: 0.04, at: at + i * 0.04 }));
      noise(dest, 0.5, { vol: 0.03, filter: 'highpass', f: 7000, at });
    },
    glitchRise(at, { dur }) {
      noise(dest, dur, { vol: 0.12, f: 900, f1: 8000, q: 1.2, at, curve: 'rise' });
      const n = 18;
      for (let i = 0; i < n; i++) {
        const t = at + dur * (1 - (1 - i / n) ** 1.7);
        tone(dest, 'square', 300 + i * 140 + rnd() * 200, 0.02, { vol: 0.045, at: t, attack: 0.001, release: 0.006 });
      }
    },
    logo(at) {                      // the music cuts to one beat: this is it
      fx.slam(at, { size: 1.25 });
      tone(dest, 'sine', 62, 2.2, { vol: 0.55, f1: 30, at, attack: 0.002, release: 1.6 });
      noise(dest, 2.2, { vol: 0.1, filter: 'highpass', f: 4200, at });
      for (const n of ['E3', 'B3', 'E4', 'G4', 'B4']) S.play(dest, 'brass', freqOf(n), 1.5, at, 0.06);
      for (const n of ['E5', 'B5', 'E6']) S.play(dest, 'bell', freqOf(n), 2.4, at + 0.02, 0.05);
    },
    last(at) {
      fx.slam(at, { size: 0.9 });
      for (const n of ['E2', 'E3', 'B3']) S.play(dest, 'brass', freqOf(n), 0.8, at, 0.06);
      S.play(dest, 'bell', freqOf('E5'), 0.8, at, 0.05);
    },
  };
  return { fx, kit };
}

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function freqOf(tok) {
  const m = /^([A-G]#?)(\d)$/.exec(tok);
  return 440 * 2 ** ((NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
}
