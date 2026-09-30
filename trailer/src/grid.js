// The beat grid everything is cut to: 140 bpm, 4/4, one bar = 1.714 s.
import { CUT, CUTS } from './cut.js';

export const BPM = 140;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const S16 = BEAT / 4;
export const FPS = 30;
export const DURATION = CUTS[CUT].duration;
export const FRAMES = DURATION * FPS;
export const W = 1920;
export const H = 1080;

/** Time of a grid position: bar (1-based), beat (0-3), sixteenth (0-3). */
export const T = (bar, beat = 0, s16 = 0) => (bar - 1) * BAR + beat * BEAT + s16 * S16;

/** "bar.beat.16th" label of the nearest sixteenth (1-based, like a DAW). */
export function gridLabel(t) {
  const n = Math.round(t / S16);
  return `${Math.floor(n / 16) + 1}.${Math.floor((n % 16) / 4) + 1}.${(n % 4) + 1}`;
}
/** Distance (s) from t to the nearest sixteenth. */
export const offGrid = (t) => t - Math.round(t / S16) * S16;
/** Frame shown at time t (frame n covers [n/FPS, (n+1)/FPS)). */
export const frameAt = (t) => Math.floor(t * FPS + 1e-6);
/** Frame on which an event at time t first appears (nearest frame boundary). */
export const cutFrame = (t) => Math.round(t * FPS);
