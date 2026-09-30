// The edit, as data on one beat grid (see src/cuts/): 'full' is the 30 s
// teaser, 'ten' the 10 s one. Everything downstream (compositor, audio,
// checks) reads the chosen cut through this module.
import { CUT } from './cut.js';
import * as full from './cuts/full.js';
import * as ten from './cuts/ten.js';

const C = CUT === 'ten' ? ten : full;

export const {
  shots, damage, shotAt, shotById, captions, HANDLE, impacts, board, cues,
  DEFAULTS, buildMaster, makeEvaluator, SECTIONS, DUCKS,
  SILENCE0, DROP, END, BUILD0, BOARD0, RESET, LAST,
} = C;
