// Original tracks for the soft synth in systems/audio.js.
// Each step is a 16th note. Tokens: note (C5, F#4, Bb3), chord (C4+E4+G4),
// '.' rest, '-' hold. Drums: k kick, s snare (brushed), h hat, r brush roll.
// Voices: lead (soft | bell | pluck), harm (a quieter counter-line), pad
// (chords), bass. `loop: false` plays once. `vol` scales the whole track;
// `dyn` (optional) scales the voices bar by bar.
const bars = (...b) => b.join(' ');
const hold = (tok, n = 16) => [tok, ...Array(n - 1).fill('-')].join(' ');
// bar builders (16 steps each)
const rest = () => Array(16).fill('.').join(' ');
const funk = (lo, hi) => `${lo} . . ${lo} . ${hi} ${lo} . ${lo} . . ${lo} . ${hi} . ${lo}`;
const march = (lo, hi) => `${lo} . ${hi} . ${lo} . ${hi} . ${lo} . ${hi} . ${lo} . ${hi} .`;
const drive16 = (lo, hi) => `${lo} ${lo} ${hi} ${lo} ${lo} ${lo} ${hi} ${lo} ${lo} ${lo} ${hi} ${lo} ${lo} ${lo} ${hi} ${lo}`;
const prowl = (lo, hi) => `${lo} - - ${lo} . . ${lo} . ${hi} . ${lo} . . ${lo} ${hi} .`;
const stab = (ch) => `. . ${ch} . . . ${ch} . . . ${ch} . . . ${ch} .`;

export const TRACKS = {
  // Main menu theme, "First Light": calm with a serious undertow, in D minor.
  // 14 bars at 75 bpm = 44.8 s, exactly one loop of the title footage, and the
  // title screen keeps the two in sync, so the music follows the day on
  // screen: a quiet dawn (1-2), the theme through the day (3-7), a lift over
  // the overview (8-9), golden hour at the Elite Hall (10-11), dusk turning
  // to A major (12), a sparse night (13-14) whose A resolves into the dawn of
  // the next loop.
  title: {
    bpm: 75, lead: 'soft', leadVol: 0.075, vol: 0.95,
    lead_: bars(
      '. . . . . . . . A4 - - - D5 - E5 -', 'F5 - - - - - - - E5 - D5 - - - - -',
      'C5 - - - F5 - - - A5 - - - G5 - F5 -', 'E5 - - - - - - - G5 - - - - - - -',
      'F5 - - - E5 - D5 - A5 - - - - - - -', 'D5 - - - - - - - F5 - - - Bb5 - A5 -',
      'G5 - - - - - - - F5 - - - D5 - - -', 'C5 - - - - - - - F5 - - - A5 - - -',
      'Bb5 - - - - - - - A5 - - - F5 - G5 -', 'C6 - - - - - - - - - - - G5 - - -',
      'A5 - - - - - - - G5 - F5 - D5 - - -', 'E5 - - - - - - - C#5 - - - - - - -',
      'D5 - - - - - - - . . . . A4 - - -', 'F4 - - - - - - - E4 - - - - - - -'),
    harm: bars(
      rest(), '. . . . . . . . . . . . A5 . . .',
      '. . A5 . . . C6 . . . F6 . . . C6 .', '. . G5 . . . C6 . . . E6 . . . C6 .',
      '. . A5 . . . D6 . . . F6 . . . D6 .', '. . F5 . . . Bb5 . . . D6 . . . Bb5 .',
      '. . G5 . . . Bb5 . . . D6 . . . F6 .', '. . A5 . . . C6 . . . F6 . . . A6 .',
      '. . D6 . . . F6 . . . Bb6 . . . F6 .', '. . E6 . . . G6 . . . C7 . . . G6 .',
      '. . D6 . . . F6 . . . . . . . . .', '. . . . . . . . . . . . E6 . . .',
      '. . . . . . . . . . . . F5 . . .', rest()),
    harmInstr: 'bell', harmVol: 0.028,
    pad: bars(hold('D3+A3+E4+F4'), hold('Bb2+D3+F3+A3'),
      hold('F3+A3+C4'), hold('C3+E3+G3'), hold('D3+F3+A3'), hold('Bb2+D3+F3'), hold('G2+Bb2+D3+F3'),
      hold('A2+C3+F3'), hold('Bb2+D3+F3+C4'),
      hold('C3+E3+G3'), hold('Bb2+D3+F3+A3', 8) + ' ' + hold('G2+Bb2+D3', 8), hold('A2+D3+E3', 8) + ' ' + hold('A2+C#3+E3', 8),
      hold('D3+F3+A3'), hold('Bb2+D3+F3+A3', 8) + ' ' + hold('A2+C#3+E3+G3', 8)),
    padVol: 0.042,
    bass: bars(hold('D2'), hold('Bb1'),
      hold('F2'), hold('C2'), hold('D2'), hold('Bb1'), hold('G1'),
      hold('A1'), hold('Bb1'),
      hold('C2'), hold('Bb1', 8) + ' ' + hold('G1', 8), hold('A1'),
      hold('D2'), hold('Bb1', 8) + ' ' + hold('A1', 8)),
    bassVol: 0.1,
    drums: bars(rest(), '. . . . . . . . . . . . r . . .',
      ...Array(6).fill('k . . . . . . . . . . . . . . .'),
      'k . . . . . . . . . . . r . . .',
      'c . . . . . . . t . . . . . . .', 'k . . . . . . . t . . . . . . .',
      't . . . . . . . t . . . t . t .',
      rest(), '. . . . . . . . r . . . . . . .'),
    drumVol: 0.35,
    // hushed dawn, the day, swelling to golden hour, settling into the night
    dyn: [0.7, 0.8, 0.9, 0.9, 0.95, 0.95, 1, 1.05, 1.12, 1.25, 1.15, 1, 0.78, 0.72],
  },

  // Daytime route: easy-going walking tempo, warm lead, light brushes.
  day: {
    bpm: 104, lead: 'soft', leadVol: 0.085,
    lead_: bars(
      'A4 - C5 - F5 - - - E5 - D5 - C5 - - -', 'D5 - - - C5 - A4 - G4 - - - - - . .',
      'Bb4 - D5 - F5 - - - G5 - F5 - D5 - - -', 'C5 - - - - - - - . . A4 - C5 - . .',
      'A4 - C5 - F5 - - - A5 - G5 - F5 - - -', 'E5 - - - D5 - C5 - D5 - - - E5 - . .',
      'F5 - - - C5 - - - D5 - - - Bb4 - - -', 'A4 - - - G4 - - - F4 - - - - - . .'),
    harm: bars(
      '. . . . . . . . C6 . . . A5 . . .', '. . . . . . . . Bb5 . . . A5 . . .',
      '. . . . . . . . D6 . . . Bb5 . . .', '. . . . . . . . G5 . . . E5 . . .',
      '. . . . . . . . C6 . . . A5 . . .', '. . . . . . . . G5 . . . C6 . . .',
      '. . . . . . . . F5 . . . D5 . . .', '. . . . . . . . C5 . . . . . . .'),
    pad: bars(hold('F3+A3+C4'), hold('D3+F3+A3'), hold('Bb2+D3+F3'), hold('C3+E3+G3'),
      hold('F3+A3+C4'), hold('C3+E3+G3'), hold('Bb2+D3+F3'), hold('F3+A3+C4')),
    bass: bars('F2 . . . C3 . . . F2 . . . C3 . . .', 'D2 . . . A2 . . . D2 . . . A2 . . .',
      'Bb1 . . . F2 . . . Bb1 . . . F2 . . .', 'C2 . . . G2 . . . C2 . . . E2 . . .',
      'F2 . . . C3 . . . F2 . . . C3 . . .', 'C2 . . . G2 . . . C2 . . . G2 . . .',
      'Bb1 . . . F2 . . . Bb1 . . . C2 . . .', 'F2 . . . C3 . . . F2 . . . . . . .'),
    drums: 'k . . . h . . . s . . . h . . . '.repeat(8).trim(), drumVol: 0.45,
  },

  // Night: slow, sparse bells in A minor, no drums.
  night: {
    bpm: 72, lead: 'bell', leadVol: 0.09,
    lead_: bars(
      'E5 - - - - - - - A4 - - - C5 - - -', 'B4 - - - - - - - G4 - - - - - - -',
      'C5 - - - - - - - E5 - - - D5 - - -', 'B4 - - - - - - - - - - - . . . .',
      'A5 - - - - - - - E5 - - - G5 - - -', 'F5 - - - - - - - E5 - - - D5 - - -',
      'C5 - - - - - - - D5 - - - B4 - - -', 'A4 - - - - - - - - - - - . . . .'),
    pad: bars(hold('A3+C4+E4'), hold('G3+B3+D4'), hold('F3+A3+C4'), hold('E3+G#3+B3'),
      hold('A3+C4+E4'), hold('D3+F3+A3'), hold('F3+A3+C4', 8) + ' ' + hold('E3+G#3+B3', 8), hold('A3+C4+E4')),
    padVol: 0.03,
    bass: bars(hold('A2'), hold('G2'), hold('F2'), hold('E2'), hold('A2'), hold('D2'), hold('F2', 8) + ' ' + hold('E2', 8), hold('A2')),
    bassVol: 0.1,
    drums: '',
  },

  // Wild battle: driving but rounded - plucked lead, brushed snare, quiet hats.
  battle: {
    bpm: 138, lead: 'pluck', leadVol: 0.075,
    lead_: bars(
      'E5 . E5 . G5 . E5 . B5 - A5 - G5 - F#5 -', 'E5 . E5 . D5 . E5 . F#5 - G5 - A5 - B5 -',
      'C6 - B5 - A5 - G5 - A5 - G5 - F#5 - D5 -', 'E5 - - - B4 - - - E5 . E5 . E5 - - -'),
    pad: bars(hold('E3+G3+B3'), hold('C3+E3+G3', 8) + ' ' + hold('D3+F#3+A3', 8), hold('A2+C3+E3', 8) + ' ' + hold('B2+D#3+F#3', 8), hold('E3+G3+B3')),
    padVol: 0.025,
    bass: bars(
      'E2 . E2 . E3 . E2 . E2 . E2 . D2 . D3 .', 'C2 . C2 . C3 . C2 . D2 . D2 . D3 . D2 .',
      'A1 . A1 . A2 . A1 . B1 . B1 . B2 . B1 .', 'E2 . E2 . E3 . E2 . E2 . B1 . B2 . B1 .'),
    bassVol: 0.12,
    drums: bars('k . h . s . h . k k h . s . h .', 'k . h . s . h . k . h . s . h h', 'k . h . s . h . k k h . s . h .', 'k . h . s . h . k . s . s . r .'),
    drumVol: 0.6,
  },

  // "Eyes meet": an Elite spots you. Menacing minor riff with a swing to it -
  // loops under the pre-battle dialogue.
  eliteEncounter: {
    bpm: 138, lead: 'brass', leadVol: 0.07,
    lead_: bars(
      'A4 . A4 . C5 . A4 . D#5 - E5 - . . A4 .', 'G5 - F5 - E5 - D5 - C5 - D5 - E5 - . .',
      'A4 . A4 . C5 . A4 . D#5 - E5 - . . C6 .', 'B5 - A5 - G#5 - E5 - F5 - E5 - D#5 - E5 -'),
    harm: bars(
      '. . A3+C4+E4 . . . A3+C4+E4 . . . A3+C4+E4 . . . A3+C4+E4 .', '. . F3+A3+C4 . . . F3+A3+C4 . . . E3+G#3+B3 . . . E3+G#3+B3 .',
      '. . A3+C4+E4 . . . A3+C4+E4 . . . A3+C4+E4 . . . A3+C4+E4 .', '. . D3+F3+A3 . . . D3+F3+A3 . . . E3+G#3+D4 . . . E3+G#3+D4 .'),
    harmInstr: 'pluck', harmVol: 0.05,
    bass: bars(
      'A1 . A1 A2 A1 . A1 A2 A1 . A1 A2 G1 . G#1 .', 'F1 . F1 F2 F1 . F1 F2 E1 . E1 E2 E1 . E1 E2',
      'A1 . A1 A2 A1 . A1 A2 A1 . A1 A2 G1 . G#1 .', 'D1 . D1 D2 D1 . D1 D2 E1 . E1 E2 E1 E2 E1 E2'),
    bassInstr: 'drive', bassVol: 0.14,
    drums: bars('k . h . s . h k k . h . s . h h', 'k . h . s . h k k . h . s . r .', 'k . h . s . h k k . h . s . h h', 'k . h . s . h k k . s . s s s s'),
    drumVol: 0.6,
  },

  // Cooker's Hall: slower, heavier, ominous - timpani and low brass, but a
  // melody you can hum.
  cookerEncounter: {
    bpm: 112, lead: 'brass', leadVol: 0.075, vol: 0.8,
    lead_: bars(
      'D4 - - - D4 . F4 . A4 - - - G#4 - A4 -', 'Bb4 - - - A4 - G4 - F4 - E4 - F4 - - -',
      'D4 - - - D4 . F4 . A4 - - - D5 - C#5 -', 'D5 - - - C5 - Bb4 - A4 - - - - - . .'),
    harm: bars('. . . . . . . . . . . . A5 . . .', '. . . . . . . . . . . . F5 . . .', '. . . . . . . . . . . . F5 . . .', '. . . . . . . . C#6 . . . . . . .'),
    harmInstr: 'bell', harmVol: 0.05,
    pad: bars(hold('D3+F3+A3'), hold('Bb2+D3+F3'), hold('D3+F3+A3'), hold('A2+C#3+E3')),
    padVol: 0.035,
    bass: bars('D2 - - - D2 . D2 . D2 - - - D2 . D2 .', 'Bb1 - - - Bb1 . Bb1 . Bb1 - - - C2 . C2 .',
      'D2 - - - D2 . D2 . D2 - - - D2 . D2 .', 'A1 - - - A1 . A1 . A1 - - - A1 . C#2 .'),
    bassInstr: 'drive', bassVol: 0.15,
    drums: bars('t . . . s . . . t . t . s . . .', 't . . . s . . . t . t . s . r .', 't . . . s . . . t . t . s . . .', 't . . . s . . . t t t t c . . .'),
    drumVol: 0.7,
  },

  // The walk up the Elite Hall's carpet, in two stages. hallWalk: a slow
  // heartbeat under a tolling bell and a D minor drone that keeps slipping a
  // semitone. hallWalk2 (from halfway up the aisle): the heart speeds up, low
  // brass creeps up chromatically, and timpani roll at the end of each phrase.
  hallWalk: {
    bpm: 80, lead: 'bell', leadVol: 0.07, vol: 0.85,
    lead_: bars(
      'D5 - - - - - - - - - - - - - - -', rest(),
      'F5 - - - - - - - E5 - - - - - - -', rest(),
      'D5 - - - - - - - - - - - - - - -', rest(),
      'Ab5 - - - - - - - G5 - - - - - - -', rest()),
    harm: bars(rest(), '. . . . . . . . A4 - - - - - - -', rest(), '. . . . . . . . C#5 - - - - - - -',
      rest(), '. . . . . . . . Ab4 - - - - - - -', rest(), '. . . . . . . . A4 - - - - - - -'),
    harmInstr: 'soft', harmVol: 0.035,
    pad: bars(hold('D3+F3+A3'), hold('D3+F3+A3'), hold('Bb2+D3+F3'), hold('A2+C#3+E3'),
      hold('D3+F3+Ab3'), hold('D3+F3+Ab3'), hold('Bb2+Db3+F3'), hold('A2+C#3+E3')),
    padVol: 0.035,
    bass: bars(hold('D2'), hold('D2'), hold('Bb1'), hold('A1'), hold('D2'), hold('Eb2'), hold('Bb1'), hold('A1')),
    bassVol: 0.12,
    drums: bars(...Array(7).fill('k k . . . . . . k k . . . . . .'), 'k k . . . . . . k k . . r . . .'),
    drumVol: 0.55,
  },
  hallWalk2: {
    bpm: 88, lead: 'brass', leadVol: 0.05, vol: 0.85,
    lead_: bars(
      'D4 - - - - - - - - - - - - - - -', 'Eb4 - - - - - - - - - - - - - - -',
      'E4 - - - - - - - - - - - - - - -', 'F4 - - - - - - - E4 - - - Eb4 - - -',
      'D4 - - - - - - - - - - - - - - -', 'Eb4 - - - - - - - - - - - - - - -',
      'F4 - - - - - - - F#4 - - - - - - -', 'G4 - - - - - - - A4 - - - - - - -'),
    harm: bars('. . . . . . . . . . . . D6 . . .', '. . . . . . . . . . . . Eb6 . . .',
      '. . . . . . . . . . . . E6 . . .', '. . . . . . . . . . . . F6 . . .',
      '. . . . . . . . . . . . D6 . . .', '. . . . . . . . . . . . Eb6 . . .',
      '. . . . . . . . . . . . F#6 . . .', '. . . . . . . . A6 . . . . . . .'),
    harmInstr: 'bell', harmVol: 0.045,
    pad: bars(hold('D3+F3+A3'), hold('Eb3+G3+Bb3'), hold('D3+F3+A3'), hold('D3+F3+Ab3'),
      hold('D3+F3+A3'), hold('Eb3+G3+Bb3'), hold('D3+F#3+A3'), hold('A2+C#3+E3')),
    padVol: 0.04,
    bass: bars(...Array(2).fill(bars('D2 . . . D2 . . . D2 . . . D2 . . .', 'Eb2 . . . Eb2 . . . Eb2 . . . Eb2 . . .',
      'D2 . . . D2 . . . D2 . . . D2 . . .', 'D2 . . . D2 . . . C2 . . . A1 . . .'))),
    bassInstr: 'drive', bassVol: 0.11,
    drums: bars(...Array(3).fill('k k . . k k . . k k . . k k . .'), 'k k . . k k . . t . t . t t t t',
      ...Array(3).fill('k k . . k k . . k k . . k k . .'), 'k k . . k k . . t t t t t t c .'),
    drumVol: 0.6,
  },

  // Route Elite battles: their own theme (wild battles keep 'battle').
  // C minor, driving octave bass, brass lead, offbeat stabs.
  eliteBattle: {
    bpm: 152, lead: 'brass', leadVol: 0.065,
    lead_: bars(
      'C5 . C5 . Eb5 . G5 . F5 - Eb5 - D5 - Bb4 -', 'C5 - - - G4 - - - Ab4 - Bb4 - C5 - D5 -',
      'Eb5 . Eb5 . G5 . C6 . Bb5 - Ab5 - G5 - F5 -', 'G5 - - - - - D5 - G5 - - - B5 - - -',
      'C6 - Bb5 - G5 - Eb5 - F5 - G5 - Ab5 - G5 -', 'F5 - Eb5 - D5 - C5 - D5 - Eb5 - F5 - - -',
      'Eb5 - D5 - C5 - Bb4 - Ab4 - G4 - F4 - Eb4 -', 'D4 - G4 - B4 - D5 - G5 - - - . . . .'),
    harm: bars(
      '. . C4+Eb4+G4 . . . C4+Eb4+G4 . . . C4+Eb4+G4 . . . C4+Eb4+G4 .', '. . Ab3+C4+Eb4 . . . Ab3+C4+Eb4 . . . Bb3+D4+F4 . . . Bb3+D4+F4 .',
      '. . C4+Eb4+G4 . . . C4+Eb4+G4 . . . C4+Eb4+G4 . . . C4+Eb4+G4 .', '. . G3+B3+D4 . . . G3+B3+D4 . . . G3+B3+D4 . . . G3+B3+D4 .',
      '. . Ab3+C4+Eb4 . . . Ab3+C4+Eb4 . . . Ab3+C4+Eb4 . . . Ab3+C4+Eb4 .', '. . Bb3+D4+F4 . . . Bb3+D4+F4 . . . Bb3+D4+F4 . . . Bb3+D4+F4 .',
      '. . Ab3+C4+Eb4 . . . Ab3+C4+Eb4 . . . F3+Ab3+C4 . . . F3+Ab3+C4 .', '. . G3+B3+D4 . . . G3+B3+D4 . . . G3+B3+D4 . . . G3+B3+D4 .'),
    harmInstr: 'pluck', harmVol: 0.045,
    bass: bars(
      'C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 Bb1 Bb2 Bb1 Bb2', 'Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2',
      'C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3', 'G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2',
      'Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2', 'Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2',
      'Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 F1 F2 F1 F2 F1 F2 F1 F2', 'G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2'),
    bassInstr: 'drive', bassVol: 0.12,
    drums: bars('k . h k s . h . k . h k s . h h', 'k . h k s . h . k . h k s . r .', 'k . h k s . h . k . h k s . h h', 'k . h k s . h . k k s . s s s s',
      'k . h k s . h . k . h k s . h h', 'k . h k s . h . k . h k s . r .', 'k . h k s . h . k . h k s . h h', 'k k s . k k s . k k s s c . . .'),
    drumVol: 0.65,
  },

  // Cooker: the final battle. Biggest theme in the game - brass lead, bell
  // counter-line, pads, driving bass and timpani.
  boss: {
    bpm: 158, lead: 'brass', leadVol: 0.065, vol: 0.8,
    lead_: bars(
      'D5 - A4 - D5 - F5 - E5 - D5 - C#5 - A4 -', 'D5 - F5 - A5 - G5 - F5 - E5 - D5 - E5 -',
      'F5 - - - G5 - - - A5 - - - Bb5 - A5 -', 'G5 - F5 - E5 - C#5 - D5 - - - - - - -',
      'A5 . A5 . A5 - G5 - F5 . F5 . F5 - E5 -', 'D5 - E5 - F5 - G5 - A5 - - - C6 - Bb5 -',
      'A5 - G5 - F5 - E5 - F5 - G5 - A5 - Bb5 -', 'C#6 - - - A5 - - - E5 - - - C#5 - E5 -'),
    harm: bars('. . . . . . . . . . . . A5 . . .', '. . . . . . . . . . . . F5 . . .', '. . . . . . . . . . . . D6 . . .', '. . . . . . . . . . . . A5 . . .',
      '. . . . . . . . C6 . . . . . . .', '. . . . . . . . F6 . . . . . . .', '. . . . . . . . D6 . . . . . . .', '. . . . . . . . . . . . A5 . . .'),
    harmInstr: 'bell', harmVol: 0.05,
    pad: bars(hold('D3+F3+A3', 8) + ' ' + hold('Bb2+D3+F3', 8), hold('D3+F3+A3', 8) + ' ' + hold('G2+Bb2+D3', 8),
      hold('Bb2+D3+F3', 8) + ' ' + hold('C3+E3+G3', 8), hold('A2+C#3+E3', 8) + ' ' + hold('D3+F3+A3', 8),
      hold('F3+A3+C4'), hold('Bb2+D3+F3'), hold('G2+Bb2+D3', 8) + ' ' + hold('A2+C#3+E3', 8), hold('A2+C#3+E3')),
    padVol: 0.03,
    bass: bars(
      'D2 D3 D2 D3 D2 D3 D2 D3 Bb1 Bb2 Bb1 Bb2 A1 A2 A1 A2', 'D2 D3 D2 D3 F2 F3 F2 F3 G2 G3 G2 G3 A1 A2 A1 A2',
      'Bb1 Bb2 Bb1 Bb2 C2 C3 C2 C3 D2 D3 D2 D3 G2 G3 G2 G3', 'A1 A2 A1 A2 A1 A2 A1 A2 D2 D3 D2 D3 D2 D3 D2 D3',
      'F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2', 'Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2',
      'G1 G2 G1 G2 G1 G2 G1 G2 A1 A2 A1 A2 A1 A2 A1 A2', 'A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 C#2 C#3 E2 E3'),
    bassInstr: 'drive', bassVol: 0.13,
    drums: bars('t . h k s . h k k . h . s . t t', 'k . h k s . h k k . h . s . h .', 'k . h k s . h k k . h . s . t t', 'k k s . k k s . t . t . t t c .',
      'k . h k s . h k k . h . s . h h', 'k . h k s . h k k . h . s . r .', 'k . h k s . h k k . h . s . h h', 't . t . t . t . t t t t c . . .'),
    drumVol: 0.7,
  },

  // ---------------------------------------------------------------------
  // Per-Elite themes. Each character has a battle theme and an "eyes meet"
  // theme built on the same motif (tied to the character, not the route
  // slot, because the Elite order is seeded per player). Cooker keeps
  // cookerEncounter / boss.

  // TJR - laid-back swagger: G minor, funky syncopated bass, brass with attitude.
  encounter_A: {
    bpm: 132, lead: 'brass', leadVol: 0.07,
    lead_: bars('G4 . Bb4 . D5 - C5 . Bb4 . G4 - F4 . G4 -', 'Bb4 . D5 . F5 - Eb5 . D5 . Bb4 - A4 - - -',
      'G4 . Bb4 . D5 - C5 . Bb4 . G4 - F4 . G4 -', 'D5 - C5 - Bb4 - A4 - F#4 - - - D4 - - -'),
    harm: bars(stab('G3+Bb3+D4'), stab('Bb3+D4+F4'), stab('G3+Bb3+D4'), stab('D3+F#3+A3')),
    harmInstr: 'pluck', harmVol: 0.045,
    bass: bars(funk('G1', 'G2'), funk('Bb1', 'Bb2'), funk('G1', 'G2'), funk('D1', 'D2')),
    bassInstr: 'drive', bassVol: 0.14,
    drums: bars('k . h k s . h . k . h k s . h h', 'k . h k s . h . k . h k s . r .', 'k . h k s . h . k . h k s . h h', 'k . h k s . s . k k s . s s s s'),
    drumVol: 0.6,
  },
  battle_A: {
    bpm: 144, lead: 'brass', leadVol: 0.065,
    lead_: bars(
      'G4 . Bb4 . D5 - C5 . Bb4 . G4 - F4 . G4 -', 'A4 - - - F4 - - - A4 . C5 . F5 - E5 -',
      'Eb5 - D5 - C5 - Bb4 - C5 - D5 - Eb5 - G5 -', 'F#5 - - - D5 - - - A4 - - - F#5 - - -',
      'G5 . G5 . F5 . D5 . F5 - G5 - Bb5 - G5 -', 'A5 - F5 - C5 - F5 - A5 - C6 - A5 - F5 -',
      'G5 - Eb5 - Bb4 - Eb5 - G5 - Bb5 - G5 - Eb5 -', 'F#5 - A5 - C6 - A5 - F#5 - D5 - C5 - A4 -'),
    harm: bars(stab('G3+Bb3+D4'), stab('F3+A3+C4'), stab('Eb3+G3+Bb3'), stab('D3+F#3+A3'),
      stab('G3+Bb3+D4'), stab('F3+A3+C4'), stab('Eb3+G3+Bb3'), stab('D3+F#3+C4')),
    harmInstr: 'pluck', harmVol: 0.045,
    bass: bars(funk('G1', 'G2'), funk('F1', 'F2'), funk('Eb1', 'Eb2'), funk('D1', 'D2'),
      funk('G1', 'G2'), funk('F1', 'F2'), funk('Eb1', 'Eb2'), funk('D1', 'D2')),
    bassInstr: 'drive', bassVol: 0.13,
    drums: bars('k . h k s . h . k . h k s . h h', 'k . h k s . h . k . h k s . r .', 'k . h k s . h . k . h k s . h h', 'k . h k s . h . k k s . s s s s',
      'k . h k s . h . k . h k s . h h', 'k . h k s . h . k . h k s . r .', 'k . h k s . h . k . h k s . h h', 'k k s . k k s . k k s s c . . .'),
    drumVol: 0.62,
  },

  // Ansem - heroic villain: F minor fanfare over a march, pads, snare rolls.
  encounter_B: {
    bpm: 124, lead: 'brass', leadVol: 0.072,
    lead_: bars('F4 . F4 . F4 . C5 - - - Ab4 - C5 - F5 -', 'Eb5 - Db5 - C5 - Ab4 - Bb4 - C5 - Db5 - - -',
      'F4 . F4 . F4 . C5 - - - Ab4 - C5 - F5 -', 'E5 - - - G5 - - - C6 - - - - - - -'),
    pad: bars(hold('F3+Ab3+C4'), hold('Db3+F3+Ab3'), hold('F3+Ab3+C4'), hold('C3+E3+G3')),
    padVol: 0.035,
    bass: bars(march('F1', 'F2'), march('Db2', 'Db3'), march('F1', 'F2'), march('C2', 'C3')),
    bassInstr: 'drive', bassVol: 0.13,
    drums: bars('k . s s k . s . k . s s k s r .', 'k . s s k . s . k . s s k s r .', 'k . s s k . s . k . s s k s r .', 't . t . t . t . t t t t c . . .'),
    drumVol: 0.6,
  },
  battle_B: {
    bpm: 156, lead: 'brass', leadVol: 0.065,
    lead_: bars(
      'F4 . F4 . F4 . C5 - - - Ab4 - C5 - F5 -', 'Eb5 - Db5 - C5 - Ab4 - Bb4 - C5 - Db5 - F5 -',
      'F5 . F5 . Eb5 . Db5 . Bb4 - - - Db5 - F5 -', 'E5 - - - G5 - - - C6 - Bb5 - G5 - E5 -',
      'F5 - - - C5 - Ab4 - F4 - Ab4 - C5 - F5 -', 'Ab5 - - - F5 - Db5 - Ab4 - Db5 - F5 - Ab5 -',
      'G5 - Eb5 - Bb4 - Eb5 - G5 - Bb5 - Eb6 - Db6 -', 'C6 - - - Bb5 - G5 - E5 - G5 - Bb5 - C6 -'),
    harm: bars(rest(), rest(), '. . . . . . . . F5 . . . . . . .', '. . . . . . . . E6 . . . . . . .',
      rest(), rest(), '. . . . . . . . Eb6 . . . . . . .', '. . . . . . . . G6 . . . . . . .'),
    harmInstr: 'bell', harmVol: 0.05,
    pad: bars(hold('F3+Ab3+C4'), hold('Db3+F3+Ab3'), hold('Bb2+Db3+F3'), hold('C3+E3+G3'),
      hold('F3+Ab3+C4'), hold('Db3+F3+Ab3'), hold('Eb3+G3+Bb3'), hold('C3+E3+G3')),
    padVol: 0.032,
    bass: bars(march('F1', 'F2'), march('Db2', 'Db3'), march('Bb1', 'Bb2'), march('C2', 'C3'),
      march('F1', 'F2'), march('Db2', 'Db3'), march('Eb2', 'Eb3'), march('C2', 'C3')),
    bassInstr: 'drive', bassVol: 0.13,
    drums: bars('k . s s k . s . k . s s k s r .', 'k . s s k . s . k . s s k s r .', 'k . s s k . s . k . s s k s r .', 't . s s t . s . t t s s r . r .',
      'k . s s k . s . k . s s k s r .', 'k . s s k . s . k . s s k s r .', 'k . s s k . s . k . s s k s r .', 't . t . t . t . t t t t c . . .'),
    drumVol: 0.62,
  },

  // Orangie - quick and relentless: E minor 16th-note arpeggios, brass hook on top.
  encounter_C: {
    bpm: 150, lead: 'pluck', leadVol: 0.055,
    lead_: bars('E5 B4 G4 B4 E5 B4 G4 B4 E5 B4 G4 B4 F#5 B4 G4 B4', 'C5 A4 E4 A4 C5 A4 E4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4',
      'E5 B4 G4 B4 E5 B4 G4 B4 E5 B4 G4 B4 F#5 B4 G4 B4', 'F#5 D#5 B4 D#5 F#5 D#5 B4 D#5 A5 F#5 D#5 F#5 B5 A5 F#5 D#5'),
    harm: bars('G5 - - - - - - - B5 - - - A5 - G5 -', 'E5 - - - - - - - F#5 - - - - - - -',
      'G5 - - - - - - - B5 - - - E6 - D6 -', 'D#6 - - - - - - - B5 - - - - - - -'),
    harmInstr: 'brass', harmVol: 0.05,
    bass: bars(drive16('E1', 'E2'), 'C2 C2 C3 C2 C2 C2 C3 C2 D2 D2 D3 D2 D2 D2 D3 D2', drive16('E1', 'E2'), drive16('B1', 'B2')),
    bassInstr: 'drive', bassVol: 0.12,
    drums: bars('k . h . s . h k k . h . s . h h', 'k . h . s . h k k . h . s . h h', 'k . h . s . h k k . h . s . h h', 'k . h . s . h k k k s . s s s s'),
    drumVol: 0.58,
  },
  battle_C: {
    bpm: 166, lead: 'pluck', leadVol: 0.052,
    lead_: bars(
      'E5 B4 G4 B4 E5 B4 G4 B4 E5 B4 G4 B4 F#5 B4 G4 B4', 'C5 A4 E4 A4 C5 A4 E4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4',
      'E5 B4 G4 B4 G5 B4 G4 B4 B5 B4 G4 B4 A5 B4 G4 B4', 'F#5 D#5 B4 D#5 F#5 D#5 B4 D#5 A5 F#5 D#5 F#5 B5 A5 F#5 D#5',
      'E5 B4 G4 B4 E5 B4 G4 B4 E5 B4 G4 B4 F#5 B4 G4 B4', 'C5 A4 E4 A4 C5 A4 E4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4',
      'E5 B4 G4 B4 G5 B4 G4 B4 B5 B4 G4 B4 A5 B4 G4 B4', 'F#5 D#5 B4 D#5 F#5 D#5 B4 D#5 A5 F#5 D#5 F#5 B5 A5 F#5 D#5'),
    harm: bars(rest(), rest(), rest(), rest(),
      'G5 - - - F#5 - E5 - B5 - - - A5 - G5 -', 'E5 - - - - - D5 - F#5 - - - A5 - - -',
      'B5 - - - C6 - B5 - A5 - G5 - F#5 - E5 -', 'D#5 - - - F#5 - - - B5 - - - A5 - F#5 -'),
    harmInstr: 'brass', harmVol: 0.06,
    bass: bars(drive16('E1', 'E2'), 'C2 C2 C3 C2 C2 C2 C3 C2 D2 D2 D3 D2 D2 D2 D3 D2', drive16('E1', 'E2'), drive16('B1', 'B2'),
      drive16('E1', 'E2'), 'C2 C2 C3 C2 C2 C2 C3 C2 D2 D2 D3 D2 D2 D2 D3 D2', drive16('E1', 'E2'), drive16('B1', 'B2')),
    bassInstr: 'drive', bassVol: 0.115,
    drums: bars('k . h . s . h k k . h . s . h h', 'k . h . s . h k k . h . s . h h', 'k . h . s . h k k . h . s . h h', 'k . h . s . h k k k s . s s s s',
      'k . h k s . h k k . h k s . h h', 'k . h k s . h k k . h k s . h h', 'k . h k s . h k k . h k s . h h', 'k k s . k k s . k k s s c . . .'),
    drumVol: 0.6,
  },

  // Cented - dark and stealthy: B minor, chromatic creeping lead, prowling bass.
  encounter_E: {
    bpm: 128, lead: 'brass', leadVol: 0.07,
    lead_: bars('B4 - - - C5 - B4 - A#4 - B4 - - - F#4 -', 'B4 - - - D5 - C#5 - D5 - E5 - F5 - F#5 -',
      'B4 - - - C5 - B4 - A#4 - B4 - - - F#4 -', 'C#5 - - - A#4 - - - F#4 - - - A#4 - C#5 -'),
    pad: bars(hold('B2+D3+F#3'), hold('B2+D3+F#3'), hold('B2+D3+F#3'), hold('F#2+A#2+C#3')),
    padVol: 0.035,
    bass: bars(prowl('B1', 'B2'), prowl('B1', 'B2'), prowl('B1', 'B2'), prowl('F#1', 'F#2')),
    bassInstr: 'drive', bassVol: 0.15,
    drums: bars('k . . h s . . h k . k h s . . h', 'k . . h s . . h k . k h s . r .', 'k . . h s . . h k . k h s . . h', 't . . . t . . . t . t . c . . .'),
    drumVol: 0.62,
  },
  battle_E: {
    bpm: 148, lead: 'brass', leadVol: 0.066,
    lead_: bars(
      'B4 - - - C5 - B4 - A#4 - B4 - - - F#4 -', 'B4 - - - D5 - C#5 - D5 - E5 - F5 - F#5 -',
      'G5 - - - F#5 - E5 - D5 - - - B4 - D5 -', 'C#5 - - - A#4 - - - F#4 - - - A#4 - C#5 -',
      'F#5 . F#5 . G5 - F#5 - F5 - F#5 - - - B4 -', 'E5 - - - G5 - F#5 - E5 - D5 - B4 - G4 -',
      'D5 - - - E5 - - - G5 - - - B5 - A5 -', 'A#5 - - - F#5 - - - C#6 - - - A#5 - F#5 -'),
    harm: bars('. . . . . . . . F#5 . . . . . . .', rest(), '. . . . . . . . B5 . . . . . . .', '. . . . . . . . F#5 . . . . . . .',
      '. . . . . . . . D6 . . . . . . .', '. . . . . . . . B5 . . . . . . .', '. . . . . . . . D6 . . . . . . .', '. . . . . . . . C#6 . . . . . . .'),
    harmInstr: 'bell', harmVol: 0.05,
    pad: bars(hold('B2+D3+F#3'), hold('B2+D3+F#3'), hold('G2+B2+D3'), hold('F#2+A#2+C#3'),
      hold('B2+D3+F#3'), hold('E2+G2+B2'), hold('G2+B2+D3'), hold('F#2+A#2+C#3')),
    padVol: 0.032,
    bass: bars(prowl('B1', 'B2'), prowl('B1', 'B2'), prowl('G1', 'G2'), prowl('F#1', 'F#2'),
      prowl('B1', 'B2'), prowl('E1', 'E2'), prowl('G1', 'G2'), prowl('F#1', 'F#2')),
    bassInstr: 'drive', bassVol: 0.14,
    drums: bars('k . . h s . . h k . k h s . . h', 'k . . h s . . h k . k h s . r .', 'k . . h s . . h k . k h s . . h', 't . . h s . . h t . t h s s s s',
      'k . h h s . . h k . k h s . . h', 'k . h h s . . h k . k h s . r .', 'k . h h s . . h k . k h s . . h', 't . t . t . t . t t t t c . . .'),
    drumVol: 0.62,
  },

  victory: {
    bpm: 120, lead: 'soft', leadVol: 0.09,
    lead_: bars('G5 - G5 - G5 - E5 - C6 - - - - - - -', 'A5 - G5 - F5 - E5 - D5 - E5 - C5 - - -'),
    pad: bars(hold('C4+E4+G4'), hold('F3+A3+C4', 8) + ' ' + hold('G3+B3+D4', 8)),
    bass: bars('C3 . G2 . C3 . G2 . F2 . C3 . F2 . C3 .', 'F2 . C3 . G2 . D3 . C3 . G2 . C3 . . .'),
    drums: 'k . h . s . h . k . h . s . h . '.repeat(2).trim(), drumVol: 0.45,
  },
  victoryShort: {
    bpm: 132, lead: 'soft', leadVol: 0.09, loop: false,
    lead_: 'G5 - G5 - G5 - E5 - C6 - - - - - - -',
    pad: hold('C4+E4+G4'),
    bass: 'C3 . G2 . C3 . G2 . C3 . . . . . . .',
    drums: 'k . h . s . h . k . . . . . . .', drumVol: 0.45,
  },

  // Losing a battle: a short, gentle lament (plays once).
  lose: {
    bpm: 64, lead: 'bell', leadVol: 0.1, loop: false,
    lead_: bars('E5 - - - D5 - - - C5 - - - B4 - - -', 'C5 - - - A4 - - - G#4 - - - A4 - - -', hold('A4')),
    pad: bars(hold('A3+C4+E4', 8) + ' ' + hold('F3+A3+C4', 8), hold('D3+F3+A3', 8) + ' ' + hold('E3+G#3+B3', 8), hold('A3+C4+E4')),
    padVol: 0.04,
    bass: bars('A2 - - - - - - - F2 - - - - - - -', 'D2 - - - - - - - E2 - - - - - - -', hold('A1')),
    drums: '',
  },

  // Evolution: a rising, mysterious build (loops until the burst), then its
  // own fanfare. Chromatic sequence climbing over a heartbeat.
  evolve: {
    bpm: 96, lead: 'bell', leadVol: 0.085,
    lead_: bars(
      'C5 E5 G5 C6 C5 E5 G5 C6 D5 F5 A5 D6 D5 F5 A5 D6', 'E5 G#5 B5 E6 E5 G#5 B5 E6 F5 A5 C6 F6 F5 A5 C6 F6',
      'F#5 A#5 C#6 F#6 F#5 A#5 C#6 F#6 G5 B5 D6 G6 G5 B5 D6 G6', 'G#5 C6 D#6 G#6 A5 C#6 E6 A6 A#5 D6 F6 A#6 B5 D#6 F#6 B6'),
    pad: bars(hold('C4+E4+G4', 8) + ' ' + hold('D4+F4+A4', 8), hold('E4+G#4+B4', 8) + ' ' + hold('F4+A4+C5', 8),
      hold('F#4+A#4+C#5', 8) + ' ' + hold('G4+B4+D5', 8), hold('G#4+C5+D#5', 4) + ' ' + hold('A4+C#5+E5', 4) + ' ' + hold('A#4+D5+F5', 4) + ' ' + hold('B4+D#5+F#5', 4)),
    padVol: 0.04,
    bass: bars('C2 . . . C2 . . . D2 . . . D2 . . .', 'E2 . . . E2 . . . F2 . . . F2 . . .',
      'F#2 . . . F#2 . . . G2 . . . G2 . . .', 'G#2 . A2 . A#2 . B2 . G#2 . A2 . A#2 . B2 .'),
    drums: bars('k . . . . . . . k . k . . . . .', 'k . . . . . . . k . k . . . . .', 'k . . . . . . . k . k . . . . .', 'k . k . k . k . k k k k r . r .'),
    drumVol: 0.5,
  },
  evolved: {
    bpm: 124, lead: 'brass', leadVol: 0.075, loop: false,
    lead_: bars('G4 - C5 - E5 - G5 - C6 - - - B5 - C6 -', 'D6 - - - C6 - B5 - C6 - - - G5 - - -', hold('C6')),
    harm: bars('. . . . . . . . E6 . . . . . . .', '. . . . . . . . G6 . . . . . . .', 'C7 . . . . . . . . . . . . . . .'),
    harmInstr: 'bell', harmVol: 0.06,
    pad: bars(hold('C4+E4+G4'), hold('G3+B3+D4', 8) + ' ' + hold('C4+E4+G4', 8), hold('C4+E4+G4')),
    padVol: 0.04,
    bass: bars('C3 . G2 . C3 . G2 . C3 . G2 . C3 . E3 .', 'G2 . D3 . G2 . D3 . C3 . G2 . C3 . . .', hold('C2')),
    drums: bars('k . . . s . . . k . k . s . . .', 'k . . . s . . . k . k . s . r .', 'c . . . . . . . . . . . . . . .'),
    drumVol: 0.55,
  },

  hof: {
    bpm: 84, lead: 'soft', leadVol: 0.09,
    lead_: bars(
      'C5 - - - E5 - G5 - C6 - - - B5 - A5 -', 'G5 - - - E5 - C5 - D5 - - - - - - -',
      'F5 - - - A5 - C6 - E6 - - - D6 - C6 -', 'B5 - - - G5 - D6 - C6 - - - - - - -'),
    harm: bars('. . . . . . . . E6 . . . . . . .', '. . . . . . . . B5 . . . . . . .', '. . . . . . . . G6 . . . . . . .', '. . . . . . . . E6 . . . . . . .'),
    pad: bars(hold('C4+E4+G4', 8) + ' ' + hold('A3+C4+E4', 8), hold('F3+A3+C4', 8) + ' ' + hold('G3+B3+D4', 8),
      hold('F3+A3+C4', 8) + ' ' + hold('A3+C4+E4', 8), hold('G3+B3+D4', 8) + ' ' + hold('C4+E4+G4', 8)),
    bass: bars('C3 - - - - - - - A2 - - - - - - -', 'F2 - - - - - - - G2 - - - - - - -',
      'F2 - - - - - - - A2 - - - - - - -', 'G2 - - - - - - - C3 - - - - - - -'),
    drums: 'k . . . r . . . k . k . r . . . '.repeat(4).trim(), drumVol: 0.4,
  },
};
