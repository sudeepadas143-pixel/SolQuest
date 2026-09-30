// The trailer cue: 140 bpm, E minor, written in the game's own track notation
// (src/data/music.js: one token per sixteenth, 'E5' note, 'E3+G3+B3' chord,
// '-' hold, '.' rest; drums k s h r t c) and played by the game's voices.
// Sections follow the edit: the flyover (bars 1-2) -> the world (3-4) -> you
// (5-6) -> the bosses (6-8) -> build (9) -> silence -> drop (10-12) -> the
// Hall: a heartbeat (13-14) -> the final Elite (15-16) -> the logo cuts it.
import { T, S16 } from '../grid.js';
import { CUT } from '../cut.js';
import { chord } from './synth.js';

const bars = (...b) => b.join(' ');
const hold = (tok, n = 16) => [tok, ...Array(n - 1).fill('-')].join(' ');
const rest = (n = 16) => Array(n).fill('.').join(' ');
const oct16 = (lo, hi) => `${lo} ${lo} ${hi} ${lo} ${lo} ${lo} ${hi} ${lo} ${lo} ${lo} ${hi} ${lo} ${lo} ${lo} ${hi} ${lo}`;
const oct8 = (lo, hi) => `${lo} . ${hi} . ${lo} . ${hi} . ${lo} . ${hi} . ${lo} . ${hi} .`;
const half = (a, b) => `${a.split(' ').slice(0, 8).join(' ')} ${b.split(' ').slice(8).join(' ')}`;

const ARP = {
  Em: 'E4 G4 B4 E5 G5 E5 B4 G4 E4 G4 B4 E5 G5 E5 B4 G4',
  C: 'C4 E4 G4 C5 E5 C5 G4 E4 C4 E4 G4 C5 E5 C5 G4 E4',
  D: 'D4 F#4 A4 D5 F#5 D5 A4 F#4 D4 F#4 A4 D5 F#5 D5 A4 F#4',
  B: 'B3 D#4 F#4 B4 D#5 B4 F#4 D#4 B3 D#4 F#4 B4 D#5 B4 F#4 D#4',
};
const PAD = { Em: 'E3+G3+B3', C: 'C3+E3+G3', D: 'D3+F#3+A3', B: 'B2+D#3+F#3' };
const ROOT = { Em: ['E2', 'E3'], C: ['C2', 'C3'], D: ['D2', 'D3'], B: ['B1', 'B2'] };

// bar number -> voices (strings of 16 tokens). Drums: game tokens, plus the
// trailer's punch kit on 'K' (kick) and 'P' (clap) lanes for the drop.
const SONG = {
  1: {
    pad: hold('E3+B3+D4+F#4'), padVol: 0.08,
    bell: 'B4 . E5 . F#5 . G5 . . . F#5 . E5 . . .', bellVol: 0.085,
    bass: hold('E2'), bassInstr: 'bass', bassVol: 0.14,
  },
  2: {
    pad: hold('E3+B3+D4+F#4'), padVol: 0.08,
    bell: '. . . . B4 . E5 . G5 . . . A5 . B5 .', bellVol: 0.085,
    arp: 'E4 . B4 . E5 . B4 . E4 . B4 . E5 . F#5 .', arpVol: 0.045,
    bass: hold('E2'), bassInstr: 'bass', bassVol: 0.14,
    drums: 'k . . . . . . . k . . . k . . .', dv: 0.6,
  },
  3: {
    arp: half(ARP.Em, ARP.C), arpVol: 0.055,
    bass: `${oct8('E2', 'E3').split(' ').slice(0, 8).join(' ')} ${oct8('C2', 'C3').split(' ').slice(8).join(' ')}`, bassVol: 0.15,
    pad: `${hold(PAD.Em, 8)} ${hold(PAD.C, 8)}`, padVol: 0.035,
    bell: '. . . . B5 . . . . . . . G5 . . .', bellVol: 0.06,
    drums: 'k . h . k . h . k . h . k . h .', dv: 0.95,
  },
  4: {
    arp: half(ARP.D, ARP.B), arpVol: 0.055,
    bass: `${oct8('D2', 'D3').split(' ').slice(0, 8).join(' ')} ${oct8('B1', 'B2').split(' ').slice(8).join(' ')}`, bassVol: 0.15,
    pad: `${hold(PAD.D, 8)} ${hold(PAD.B, 8)}`, padVol: 0.035,
    bell: '. . . . A5 . . . . . . . F#5 . D#5 .', bellVol: 0.06,
    drums: 'k . h . k . h . k . h . k . h h', dv: 0.95,
  },
  5: {
    lead: 'E5 - - - B4 - - - C5 - - - E5 - G5 -', leadVol: 0.075,
    arp: half(ARP.Em, ARP.C), arpVol: 0.04,
    bass: half(oct16('E2', 'E3'), oct16('C2', 'C3')), bassVol: 0.13,
    pad: `${hold(PAD.Em, 8)} ${hold(PAD.C, 8)}`, padVol: 0.035,
    drums: 'k . h h s . h h k . h h s . h h', dv: 0.9,
    punch: 'K . . . . . . . K . . . . . . .',
  },
  6: {
    lead: 'F#5 - - - D5 - A5 - B5 - - - - - D#5 -', leadVol: 0.075,
    arp: half(ARP.D, ARP.B), arpVol: 0.04,
    bass: half(oct16('D2', 'D3'), oct16('B1', 'B2')), bassVol: 0.13,
    pad: `${hold(PAD.D, 8)} ${hold(PAD.B, 8)}`, padVol: 0.035,
    drums: 'k . h h s . h h k . h h s . s s', dv: 0.9,
    punch: 'K . . . . . . . K . . . . . . .',
  },
  7: {       // the boss: the game's VS screen - dark stabs, timpani on the beat
    stab: 'E3+G3+B3 . . . E3+G3+B3 . . . F3+Ab3+C4 . . . E3+G3+B3 . . .', stabVol: 0.09,
    bass: 'E1 - - - E1 - - - F1 - - - E1 - - -', bassVol: 0.14,
    pad: hold('E3+G3+B3'), padVol: 0.035,
    drums: 't . . . t . . . t . . . t . t t', dv: 1.2,
    punch: 'K . . . K . . . K . . . K . . .',
  },
  8: {
    arp: 'E4 G4 B4 E5 E4 G4 B4 E5 G4 B4 E5 G5 G4 B4 E5 G5', arpVol: 0.05,
    bass: oct16('E2', 'E2'), bassVol: 0.12,
    pad: hold('E3+B3+E4'), padVol: 0.04,
    drums: 'k . . . k . . . k . . . k . . .', dv: 0.9,
  },
  9: {
    arp: 'B4 E5 G5 B5 B4 E5 G5 B5 E5 G5 B5 E6 E5 G5 B5 E6', arpVol: 0.055,
    bass: oct16('E2', 'E2'), bassVol: 0.12,
    pad: hold('E3+B3+E4'), padVol: 0.045,
    drums: 'k . . . k . . . k . k . k k k k', dv: 0.9,
  },
  10: {      // the drop lands half-time under the slow-motion knockout
    lead: 'E5 - - - - - - - G5 - - - F#5 - D5 -', leadVol: 0.085,
    stab: hold('E3+B3+E4+G4', 8) + ' ' + rest(8), stabVol: 0.1,
    bass: hold('E1'), bassInstr: 'bass', bassVol: 0.2,
    pad: hold('E3+G3+B3+D4'), padVol: 0.045,
    drums: 'k . . . . . . . s . . . . . k .', dv: 1,
    punch: 'K . . . . . . . P . . . . . K .',
  },
  11: 'Em', 12: 'C',
  13: {      // the Elite Hall: everything drops out but a heartbeat and a drone
    pad: hold('E2+B2+E3'), padVol: 0.06,
    bell: '. . . . . . . . . . . . B4 . . .', bellVol: 0.05,
    bass: hold('E1'), bassInstr: 'bass', bassVol: 0.16,
    drums: 'k . . k . . . . k . . k . . . .', dv: 0.9,
  },
  14: {      // the heart speeds up; on beat 3 every flame flares
    pad: hold('E2+B2+E3', 8) + ' ' + hold('E3+G3+B3', 8), padVol: 0.06,
    stab: rest(8) + ' E3+G3+B3 . . . F3+Ab3+C4 . . .', stabVol: 0.09,
    bass: hold('E1', 8) + ' E1 - - - F1 - - -', bassInstr: 'bass', bassVol: 0.17,
    drums: 'k . k . . . k . t . . . t . t t', dv: 1,
    punch: rest(8) + ' K . . . K . . .',
  },
  15: {      // the build, then the final Elite on beat 3
    stab: 'E3+G3+B3 . . . F3+Ab3+C4 . . . E3+B3+E4+G4 - - - - - - -', stabVol: 0.1,
    bass: 'E1 - - - F1 - - - E1 - - - - - - -', bassInstr: 'bass', bassVol: 0.2,
    pad: hold('E3+G3+B3'), padVol: 0.045,
    lead: rest(8) + ' E5 - - - B5 - - -', leadVol: 0.085,
    drums: 't . t . t t t t c . . . k . . .', dv: 1.2,
    punch: rest(8) + ' K . . . K . . .',
  },
  16: {      // two more beats of the final Elite's theme, then the logo cuts it
    stab: 'E3+G3+B3 . . . F3+Ab3+C4 . . . . . . . . . . .', stabVol: 0.09,
    bass: 'E1 - - - F1 - - - . . . . . . . .', bassInstr: 'bass', bassVol: 0.18,
    lead: 'G5 - - - F#5 - - - . . . . . . . .', leadVol: 0.08,
    drums: 't . . . t . t t . . . . . . . .', dv: 1.2,
    punch: 'K . . . K . . . . . . . . . . .',
  },
};
// The 10 s cut: an open, the groove that turns into boss stabs, a half-time
// hit under the knockout, the heartbeat in the Hall - then the logo on the
// drop, with a pad ringing under it.
const SONG_TEN = {
  1: {
    pad: hold('E3+B3+D4+F#4'), padVol: 0.08,
    lead: 'E4 - - - B4 - - - E5 - - - - - D5 -', leadVol: 0.07,
    bell: '. . . . . . . . B5 . . . E6 . . .', bellVol: 0.06,
    bass: hold('E2'), bassInstr: 'bass', bassVol: 0.15,
    drums: 't . . . . . . . t . . . t . t t', dv: 0.9,
  },
  2: {
    arp: ARP.Em.split(' ').slice(0, 8).join(' ') + ' ' + rest(8), arpVol: 0.05,
    stab: rest(8) + ' E3+G3+B3 . . . E3+G3+B3 . . .', stabVol: 0.1,
    bass: oct16('E2', 'E3').split(' ').slice(0, 8).join(' ') + ' E1 - - - E1 - - -', bassVol: 0.15,
    pad: hold(PAD.Em), padVol: 0.035,
    drums: 'k . h h s . h h t . . . t . . .', dv: 1,
    punch: 'K . . . . . . . K . . . K . . .',
  },
  3: {
    stab: 'F3+Ab3+C4 . . . E3+G3+B3 . . . E3+B3+E4+G4 - - - - - - -', stabVol: 0.075,
    bass: 'F1 - - - E1 - - - E1 - - - - - - -', bassInstr: 'bass', bassVol: 0.13,
    lead: rest(8) + ' E5 - - - G5 - F#5 -', leadVol: 0.075,
    pad: hold('E3+G3+B3+D4'), padVol: 0.045,
    drums: 't . . . t . t t k . . . . . . .', dv: 1,
    punch: 'K . . . K . . . K . . . . . . .',
  },
  4: {
    pad: hold('E2+B2+E3'), padVol: 0.06,
    bass: hold('E1'), bassInstr: 'bass', bassVol: 0.16,
    bell: '. . . . . . . . B4 . . . . . . .', bellVol: 0.05,
    drums: 'k . . k . . . . k . . k . k . k', dv: 0.95,
  },
  5: {
    pad: rest(4) + ' ' + hold('E3+B3+E4+G4', 12), padVol: 0.06,
    bell: '. . . . E5 . B5 . E6 . . . B5 . . .', bellVol: 0.05,
    bass: rest(4) + ' ' + hold('E1', 12), bassInstr: 'bass', bassVol: 0.14,
  },
  6: {
    pad: hold('E3+B3+E4+G4', 12) + ' . . . .', padVol: 0.05,
    bell: '. . . . G5 . . . E5 . . . . . . .', bellVol: 0.04,
    bass: hold('E1', 12) + ' . . . .', bassInstr: 'bass', bassVol: 0.12,
  },
};

const DROP_LEAD = {
  Em: 'E5 - - - B4 - - - E5 - F#5 - G5 - - -',
  C: 'G5 - - - E5 - - - C5 - - - E5 - G5 -',
  D: 'A5 - - - F#5 - - - D5 - - - F#5 - A5 -',
  B: 'B5 - - - - - - - A5 - G5 - F#5 - D#5 -',
};
const DROP_BELL = {
  Em: '. . . . . . . . B5 . . . E6 . . .', C: '. . . . . . . . C6 . . . G5 . . .',
  D: '. . . . . . . . D6 . . . A5 . . .', B: '. . . . . . . . D#6 . . . B5 . . .',
};
/** Silence every lane from sixteenth `n` on (the countdown hits zero there). */
function cut(bar, n) {
  const out = { ...bar };
  for (const [k, v] of Object.entries(bar)) {
    if (typeof v !== 'string' || !/\s/.test(v)) continue;
    out[k] = parse(v).map((tok, i) => (i < n ? tok : '.')).join(' ');
  }
  return out;
}
function dropBar(ch, first) {
  return {
    lead: DROP_LEAD[ch], leadVol: 0.08,
    bell: DROP_BELL[ch], bellVol: 0.04,
    arp: ARP[ch], arpVol: 0.038,
    bass: oct16(...ROOT[ch]), bassVol: 0.14,
    pad: hold(PAD[ch]), padVol: 0.04,
    drums: `${first ? 'c' : 'k'} . h h s . h h k . h h s . h h`, dv: 1,
    punch: 'K . . . K . . . K . . . K . . .',
    clap: '. . . . P . . . . . . . P . . .',
  };
}

const parse = (s) => (s ? s.split(/\s+/).filter(Boolean) : []);
const holdLen = (arr, i) => { let n = 1; while (arr[i + n] === '-') n++; return n; };

/** Schedule the whole cue. `kit` provides the punch kick / clap. */
export function scheduleTrack(synth, bus, echo, kit) {
  const voice = (str, instr, vol, t0, useEcho) => {
    const a = parse(str);
    a.forEach((tok, i) => {
      if (tok === '.' || tok === '-') return;
      const fs = chord(tok);
      if (!fs.length) return;
      const dur = S16 * holdLen(a, i) * 0.96;
      for (const f of fs) synth.play(bus, instr, f, dur, t0 + i * S16, vol / Math.sqrt(fs.length), useEcho ? echo : null);
    });
  };
  const song = CUT === 'ten' ? SONG_TEN : SONG;
  const last = Math.max(...Object.keys(song).map(Number));
  for (let bar = 1; bar <= last; bar++) {
    let v = song[bar];
    if (typeof v === 'string') v = dropBar(v, bar === 11);
    if (!v) continue;
    const t0 = T(bar);
    if (v.lead) voice(v.lead, 'brass', v.leadVol, t0, true);
    if (v.bell) voice(v.bell, 'bell', v.bellVol, t0, true);
    if (v.arp) voice(v.arp, 'pluck', v.arpVol, t0, false);
    if (v.pad) voice(v.pad, 'pad', v.padVol, t0, false);
    if (v.stab) voice(v.stab, 'brass', v.stabVol, t0, false);
    if (v.bass) voice(v.bass, v.bassInstr ?? 'drive', v.bassVol, t0, false);
    parse(v.drums).forEach((d, i) => { if (d !== '.') synth.drum(bus, d, t0 + i * S16, v.dv ?? 0.7); });
    parse(v.punch).forEach((d, i) => { if (d === 'K') kit.kick(t0 + i * S16); if (d === 'P') kit.clap(t0 + i * S16); });
    parse(v.clap).forEach((d, i) => { if (d === 'P') kit.clap(t0 + i * S16); });
  }
}
