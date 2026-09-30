// The whole trailer as data on one beat grid (140 bpm), plus the GSAP master
// timeline that animates every continuous value (camera, flashes, shake,
// RGB split, glitch, captions, leaderboard, counters). Video and audio are both
// driven from here, so a cut and its sound can't drift apart.
import gsap from 'gsap';
import { T, BEAT, BAR, S16, W, H, DURATION } from './grid.js';
import { linear, smooth } from './remap.js';

const HALF = BEAT / 2;

// ------------------------------------------------------------------ shots
// A shot shows one thing: a captured game plate (with a camera over it and a
// time remap into the plate), or one of the few scenes the game can't produce.
// cam = [zoom, x, y] start and end, in plate pixels (zoom = screen px per
// game px; 2 = the game at native pixel size, doubled).
const shots = [];
function plate(id, t0, dur, plateName, src, cam, opts = {}) {
  const remap = Array.isArray(src)
    ? linear([[0, src[0]], [dur, src[1]]])
    : src.type === 'smooth' ? smooth(src.pts) : linear(src.pts);
  shots.push({ id, kind: 'plate', t0, t1: t0 + dur, plate: plateName, remap, cam, ...opts });
}
const cam = (z0, x0, y0, z1 = z0, x1 = x0, y1 = y0, ease = 'sine.inOut') => ({ from: { z: z0, x: x0, y: y0 }, to: { z: z1, x: x1, y: y1 }, ease });
const whip = (dx, dy) => ({ type: 'whip', dx, dy });
/** hit-stop remap: play `a`->`hit` for `lead` s, freeze on `hit` for `hold` s, then creep on */
const stop = (a, hit, lead, hold, dur, after = 0.03) => ({ type: 'linear', pts: [[0, a], [lead, hit], [lead + hold, hit], [dur, hit + after]] });

// Bar 1 - red candles crashing (the one scene built for the trailer)
shots.push({ id: 'candles', kind: 'candles', t0: 0, t1: T(2) });

// Bar 2 - smash cut: one slow push-in over the tall grass at dusk
plate('grass', T(2), BAR, 'grass_dusk', [0.12, 0.12 + BAR], cam(2.0, 480, 300, 2.5, 482, 286, 'sine.inOut'));

// Bars 3-4 - one cut per beat: the world, then name / wallet / partner
{
  const b = (i) => T(3) + i * BEAT;
  plate('town', b(0), BEAT, 'town', [0.30, 0.73], cam(2.0, 470, 290, 2.1, 482, 290), { enter: whip(1, 0) });
  plate('road', b(1), BEAT, 'road', [0.33, 0.76], cam(2.2, 480, 300, 2.3, 480, 292), { enter: whip(0, 1) });
  plate('burst', b(2), BEAT, 'encounter', [0.26, 0.69], cam(2.0, 480, 300, 2.35, 480, 296, 'power2.in'));
  plate('pop', b(3), BEAT, 'encounter', [3.64, 4.07], cam(2.3, 640, 300, 2.4, 650, 296));
  plate('name', b(4), BEAT, 'name_entry', [0.34, 0.77], cam(2.7, 480, 322, 2.9, 480, 322), { enter: whip(-1, 0) });
  plate('wallet', b(5), BEAT, 'wallet_paste', [0.34, 0.77], cam(2.4, 480, 300, 2.5, 480, 304), { enter: whip(-1, 0) });
  plate('starter', b(6), BEAT, 'starter_pick', [1.80, 2.23], cam(2.0, 480, 280, 2.2, 330, 280), { enter: whip(1, 0) });
  plate('partner', b(7), BEAT, 'starter_pick', [2.74, 3.17], cam(2.3, 260, 260, 2.6, 230, 250, 'power2.out'));
}

// Bar 5 - half-beat cuts: a wild battle, the HUD, level up, evolution
{
  const s = (i) => T(5) + i * HALF;
  plate('menu', s(0), HALF, 'battle_wild', [0.45, 0.66], cam(2.0, 480, 360));
  plate('atk1', s(1), HALF, 'battle_wild', stop(1.40, 1.53, 0.09, 0.10, HALF), cam(2.6, 700, 240, 2.7, 700, 240),
    { dmg: [{ at: 0.09, x: 715, y: 150, text: '-33' }] });
  plate('hpfoe', s(2), HALF, 'battle_wild', [2.23, 3.25], cam(3.6, 221, 78, 3.8, 250, 80));
  plate('atk2', s(3), HALF, 'battle_wild', stop(3.95, 4.06, 0.08, 0.10, HALF), cam(2.6, 250, 390, 2.7, 250, 390),
    { dmg: [{ at: 0.08, x: 250, y: 300, text: '-25' }] });
  plate('atk3', s(4), HALF, 'battle_wild', stop(6.95, 7.06, 0.08, 0.11, HALF), cam(2.7, 710, 240, 2.9, 710, 236),
    { dmg: [{ at: 0.08, x: 715, y: 150, text: '-17', big: true }] });
  plate('xp', s(5), HALF, 'battle_wild', [9.25, 9.95], cam(3.0, 740, 420, 3.1, 750, 424));
  plate('lvl', s(6), HALF, 'battle_wild', [9.95, 10.16], cam(2.1, 600, 260, 2.25, 640, 250));
  plate('evo', s(7), HALF, 'evolution', [5.99, 6.20], cam(2.8, 480, 272, 3.0, 480, 272, 'power2.out'));
}

// Bar 6 - half-beat cuts over the game's own VS intro for the Ansem battle
{
  const s = (i) => T(6) + i * HALF;
  plate('wipe', s(0), HALF, 'ansem_wipe', [0.35, 0.56], cam(2.0, 480, 320, 2.1, 480, 320));
  plate('vs1', s(1), HALF, 'ansem_battle', [0.10, 0.31], cam(2.0, 480, 320));
  plate('vs2', s(2), HALF, 'ansem_battle', [0.60, 0.81], cam(2.0, 480, 320, 2.15, 480, 320, 'power2.out'));
  plate('vs3', s(3), HALF, 'ansem_battle', [0.95, 1.16], cam(3.0, 735, 330, 3.2, 735, 320));
  plate('vs4', s(4), HALF, 'ansem_battle', [1.20, 1.41], cam(3.0, 800, 520, 3.1, 800, 520));
  plate('vs5', s(5), HALF, 'ansem_battle', [1.45, 1.66], cam(2.0, 480, 320));
  plate('vs6', s(6), HALF, 'ansem_battle', [1.70, 1.91], cam(2.8, 230, 380, 2.9, 230, 380));
  plate('vs7', s(7), HALF, 'ansem_battle', [1.95, 2.16], cam(2.0, 480, 320, 2.2, 480, 320, 'power2.out'));
}

// Bars 7-8 - quarter-beat flicker through the real fight, in duotone, riser up.
// One continuous remap through the battle; every slot is a new framing.
export const FLICK0 = T(7);
export const SILENCE0 = T(8, 3, 1);          // black + total silence (3 sixteenths = 0.32 s)
export const DROP = T(9);
{
  const fight = linear([
    [T(7), 3.95], [T(7, 1, 2), 5.00], [T(7, 3), 6.40], [T(8) - 0.04, 7.72],
    [T(8), 7.80], [T(8, 0, 1), 7.80],            // hit-stop on the big hit
    [T(8, 1, 1), 8.95], [T(8, 2), 10.22],
    [T(8, 2), 10.24], [T(8, 2, 1), 10.24],       // hit-stop on the counter-hit
    [SILENCE0, 11.40],
  ]);
  const F = {
    W: [2.0, 480, 300], FO: [3.0, 715, 230], HF: [3.6, 221, 78],
    US: [2.8, 250, 400], HU: [3.4, 742, 381],
  };
  const pattern = [
    'W', 'FO', 'W', 'FO', 'W', 'FO',            // his creature comes out
    'W', 'US', 'W', 'US', 'W', 'US',            // ours
    'FO', 'W', 'FO', 'W',                       // our attack winds up
    'FO',                                       // the big hit (hit-stop)
    'HF', 'FO', 'HF', 'FO',                     // his HP drains
    'W', 'US', 'W',                             // he hits back
    'US',                                       // (hit-stop)
    'HU', 'US', 'HU', 'US',                     // our HP drains
  ];
  pattern.forEach((f, k) => {
    const t0 = T(7) + k * S16;
    const [z, x, y] = F[f];
    shots.push({
      id: `flick${k}`, kind: 'plate', t0, t1: t0 + S16, plate: 'ansem_battle',
      remap: (lt) => fight(t0 + lt), cam: cam(z, x, y, z * 1.03, x, y, 'none'),
      grade: { duo: k % 2 ? 'mint' : 'violet', invert: f === 'FO' && (k === 16) ? 1 : 0 },
      dmg: k === 16 ? [{ at: 0, x: 715, y: 140, text: '-42', big: true }] : k === 24 ? [{ at: 0, x: 250, y: 310, text: '-37' }] : null,
    });
  });
}
shots.push({ id: 'silence', kind: 'black', t0: SILENCE0, t1: DROP });

// Bar 9 - THE DROP: full-colour slow-motion knockout with one speed ramp,
// and the game's own HP plate lifted out as a big HUD graphic.
plate('ko', DROP, BAR, 'ansem_ko', {
  type: 'smooth',
  pts: [[0, 0.70], [0.10, 0.70], [0.857, 0.95], [1.214, 1.95], [BAR, 2.42]],
}, cam(2.7, 712, 245, 2.25, 640, 285, 'sine.inOut'), {
  inset: { src: [22, 22, 402, 110], dst: [96, 70, 402 * 2.2, 110 * 2.2], t0: 0.55, t1: BAR },
  dmg: [{ at: 0.02, x: 715, y: 140, text: '-26', big: true, gold: true, dur: 1.2 }],
});

// Bars 10-14 - one long leaderboard shot: shatter in, pool, top 3, countdown
export const BOARD0 = T(10);
export const COUNT0 = T(12);
export const ZERO = T(14);
export const RESET = T(14, 0, 2);
shots.push({ id: 'board', kind: 'board', t0: BOARD0, t1: T(15), enter: { type: 'shatter', from: 'ko' } });

// Bar 15 - the glitch wipe lands on a new map; bosses and creatures in silhouette
export const NEWMAP = T(15);
plate('newmap', NEWMAP, BAR, 'newmap_pond', [0.4, 0.4 + BAR], cam(2.4, 480, 300, 2.05, 480, 318, 'power2.out'),
  { enter: { type: 'glitch', from: 'board' }, silhouettes: true });

// Bars 16-18 - the end card
export const END = T(16);
export const LAST = T(18);
shots.push({ id: 'end', kind: 'end', t0: END, t1: DURATION });

shots.sort((a, b) => a.t0 - b.t0);
export { shots };

// Damage numbers (HUD motion graphics), in plate coordinates, on one global
// clock so a number keeps floating across the flicker's framings.
export const damage = [];
for (const s of shots) for (const d of s.dmg ?? []) damage.push({ ...d, t: s.t0 + d.at, plate: s.plate });
export function shotAt(t) {
  let lo = 0;
  for (let i = 0; i < shots.length; i++) if (shots[i].t0 <= t + 1e-9) lo = i;
  return shots[lo];
}
export const shotById = (id) => shots.find((s) => s.id === id);

// --------------------------------------------------------------- captions
// Every hook is lowercase, in the game's pixel font, one line at a time.
// Cut for length (as agreed in the brief): "remember losing whole afternoons to
// pokemon?" and "trading funds the pool. play decides who gets it."
export const captions = [
  { t0: T(1), t1: T(1, 1), text: 'charts.', size: 168, y: 580 },
  { t0: T(1, 1), t1: T(1, 2), text: 'bundles.', size: 168, y: 580 },
  { t0: T(1, 2), t1: T(1, 3), text: 'rugs.', size: 168, y: 580 },
  { t0: T(1, 3), t1: T(2), text: 'repeat.', size: 168, y: 580, cutOut: true },
  { t0: T(2, 0, 2), t1: T(2, 3, 3), text: 'so we made a game.', size: 104 },
  { t0: T(3, 2), t1: T(4), text: 'you start with', size: 104 },
  { t0: T(4), t1: T(4, 1), text: 'a name,', size: 112 },
  { t0: T(4, 1), t1: T(4, 2), text: 'a wallet', size: 112 },
  { t0: T(4, 2), t1: T(5), text: 'and one creature.', size: 112 },
  { t0: T(5, 1), t1: T(6), text: 'level up.', size: 132 },
  { t0: T(6, 0, 2), t1: T(7, 1), text: 'battle your favorite creators.', size: 100 },
  { t0: T(10, 0, 2), t1: T(11) - S16, text: 'every trade fills the pool.', size: 100, gold: true },
  { t0: T(11, 0, 2), t1: T(12) - S16, text: 'top 3 get paid. every day.', size: 100, gold: true },
  { t0: T(12, 0, 2), t1: T(13), text: 'resets every 24 hours.', size: 100 },
  { t0: T(14, 0, 2), t1: T(14, 3, 2), text: 'nothing carries over.', size: 100 },
  { t0: T(15), t1: T(15, 1), text: 'new bosses.', size: 140, y: 300 },
  { t0: T(15, 1), t1: T(15, 2), text: 'new map.', size: 140, y: 300 },
  { t0: T(15, 2), t1: T(15, 3), text: 'new creatures.', size: 140, y: 300 },
  { t0: T(15, 3), t1: T(16), text: 'every day.', size: 140, y: 300, cutOut: true },
  { t0: T(16, 1), t1: T(17), text: 'win creator fees daily.', size: 92, y: 760, gold: true },
  { t0: T(17, 0, 2), t1: DURATION, text: 'coming soon', size: 92, y: 760, noOut: true },
];
export const HANDLE = { t0: T(17, 0, 2), text: '@SolQuestOnSol' };

// ---------------------------------------------------------------- impacts
// flash / shake / RGB split / glitch spikes. Every cut gets a small RGB-split
// spike; hits get hit-stop (in the remaps above) + shake + a white flash.
export const impacts = [];
const hit = (t, o) => impacts.push({ t, flash: 0, shake: 0, rgb: 0, glitch: 0, ...o });
// bar 1: the words land on the beat, glitch stutters in between
for (let i = 0; i < 4; i++) {
  // frame 0 stays readable for muted autoplay: the first slam is clean
  if (i === 0) hit(T(1, 0), { shake: 10, rgb: 0.5 });
  else hit(T(1, i), { flash: 0.3, shake: 14, rgb: 1.0, glitch: 0.45 });
  hit(T(1, i, 2), { rgb: 0.6, glitch: 0.6 });
}
hit(T(2), { rgb: 0.5 });                                       // smash cut
for (let i = 0; i < 8; i++) hit(T(3) + i * BEAT, { rgb: 0.45 }); // beat cuts
hit(T(3, 2), { shake: 12, flash: 0.25, glitch: 0.25 });       // something bursts out of the grass
hit(T(3, 3), { shake: 8 });                                    // wild creature revealed
hit(T(4, 3) + 0.08, { shake: 8 });                             // partner chosen (the game flashes)
for (let i = 0; i < 16; i++) hit(T(5) + i * HALF, { rgb: 0.4 });
hit(T(5) + 1 * HALF + 0.09, { flash: 0.75, shake: 14, rgb: 0.9 });
hit(T(5) + 3 * HALF + 0.08, { flash: 0.5, shake: 10, rgb: 0.6 });
hit(T(5) + 4 * HALF + 0.08, { flash: 1.0, shake: 18, rgb: 1.1, glitch: 0.3 });
hit(T(5) + 6 * HALF + 0.02, { shake: 8 });
hit(T(5) + 7 * HALF, { flash: 0.7, shake: 12, rgb: 0.8 });
hit(T(6) + 2 * HALF + 0.03, { shake: 16, flash: 0.35, rgb: 0.8 });   // VS slam
hit(T(6) + 5 * HALF, { shake: 8 });
hit(T(6) + 7 * HALF, { shake: 8, rgb: 0.6 });
for (let k = 0; k < 29; k++) hit(T(7) + k * S16, { rgb: 0.3 });
hit(T(8), { flash: 1.0, shake: 20, rgb: 1.3, glitch: 0.5 });
hit(T(8, 2), { flash: 0.7, shake: 14, rgb: 0.9 });
hit(DROP, { flash: 1.0, shake: 26, rgb: 1.5, glitch: 0.6, bloom: 1.2 });
hit(DROP + 1.28, { shake: 8 });
hit(BOARD0, { flash: 0.8, shake: 20, rgb: 1.2, glitch: 0.45 });
hit(T(11, 0, 2), { flash: 0.3, bloom: 0.9 });
hit(COUNT0, { flash: 0.5, shake: 16, rgb: 0.9 });
hit(ZERO, { flash: 1.0, shake: 22, rgb: 1.3, glitch: 0.8 });
hit(RESET, { glitch: 0.7, rgb: 0.7 });
hit(NEWMAP, { flash: 0.9, shake: 14, rgb: 1.1 });
for (let i = 1; i < 4; i++) hit(T(15, i), { shake: 8, rgb: 0.5 });
hit(END, { flash: 1.0, shake: 24, rgb: 1.3, bloom: 1.0 });
hit(LAST, { flash: 0.8, shake: 12, rgb: 0.8 });

// ------------------------------------------------------------ leaderboard
export const board = {
  rows: [
    { name: 'kai', mon: 'emberfox', ms: 18 * 60e3 + 42.3e3 },
    { name: 'mira', mon: 'sharkrex', ms: 19 * 60e3 + 5.8e3 },
    { name: 'juno', mon: 'fernking', ms: 19 * 60e3 + 31.1e3 },
    { name: 'orin', mon: 'sharkjaw', ms: 20 * 60e3 + 12.6e3 },
    { name: 'tess', mon: 'fernbloom', ms: 21 * 60e3 + 48.0e3 },
  ],
  poolStart: 96.214,
  // trades flash by on the grid; each one feeds the pool
  trades: [],
};
{
  const sides = ['buy', 'sell', 'buy', 'buy', 'sell', 'buy', 'sell', 'buy', 'buy', 'sell', 'buy', 'buy', 'sell', 'buy'];
  const amts = [2.40, 1.10, 5.75, 0.82, 3.30, 12.5, 0.64, 4.18, 1.96, 7.20, 2.25, 9.90, 1.45, 3.60];
  let pool = board.poolStart;
  sides.forEach((side, i) => {
    const t = T(10, 1) + i * (S16 * 3);
    pool += amts[i] * 0.6 + 0.9;        // dramatised: the pool visibly climbs
    board.trades.push({ t, side, amt: amts[i], pool, slot: i % 4 });
  });
  board.poolEnd = pool;
  board.payAt = T(11, 0, 2);      // "top 3 get paid": coins fly to the gold rows
}

// ------------------------------------------------------------ audio cues
// type 'sfx' = the game's own sound effect (src/systems/audio.js), 'fx' = a
// trailer sound (riser / whoosh / impact / glass / glitch), both on this grid.
export const cues = [];
const sfx = (t, name, opts) => cues.push({ t, type: 'sfx', name, opts });
const fx = (t, name, opts) => cues.push({ t, type: 'fx', name, opts });
// bar 1
for (let i = 0; i < 4; i++) { fx(T(1, i), 'slam', { size: 0.8 }); fx(T(1, i, 2), 'glitch', { len: 0.09 }); }
sfx(T(1), 'lowHp'); sfx(T(1, 2), 'lowHp');
sfx(T(1, 0, 1), 'faint'); sfx(T(1, 2, 1), 'faint');
fx(0, 'crash', { dur: BAR });
// bar 2 - the grass
sfx(T(2) + 0.15, 'grass'); sfx(T(2) + 0.62, 'grass');
fx(T(2, 3), 'swell', { dur: BEAT });
// bars 3-4
fx(T(3), 'whoosh', { dir: 1 }); sfx(T(3) + 0.05, 'footstep'); sfx(T(3) + 0.23, 'footstep');
fx(T(3, 1), 'whoosh', { dir: -1 }); sfx(T(3, 1) + 0.03, 'grass', { run: true });
sfx(T(3, 2), 'grass', { run: true }); sfx(T(3, 2) + 0.02, 'encounter');
sfx(T(3, 3) + 0.03, 'cry');
fx(T(4), 'whoosh', { dir: -1 }); sfx(T(4) + 0.13, 'cursor'); sfx(T(4) + 0.33, 'cursor');
fx(T(4, 1), 'whoosh', { dir: -1 }); sfx(T(4, 1) + 0.13, 'confirm');
fx(T(4, 2), 'whoosh', { dir: 1 }); sfx(T(4, 2) + 0.20, 'cursor');
sfx(T(4, 3) + 0.06, 'levelup');
// bar 5
sfx(T(5) + 0.04, 'confirm');
sfx(T(5) + HALF, 'attack'); sfx(T(5) + HALF + 0.09, 'superHit');
sfx(T(5) + 3 * HALF, 'attack'); sfx(T(5) + 3 * HALF + 0.08, 'weakHit');
sfx(T(5) + 4 * HALF, 'attack'); sfx(T(5) + 4 * HALF + 0.08, 'superHit');
sfx(T(5) + 5 * HALF, 'xp');
sfx(T(5) + 6 * HALF + 0.02, 'levelup');
sfx(T(5) + 7 * HALF, 'evolveBurst');
// bar 6
sfx(T(6), 'encounterTrainer'); sfx(T(6) + HALF, 'vs');
fx(T(6) + 2 * HALF + 0.03, 'slam', { size: 0.7 });
fx(T(6) + 5 * HALF, 'whoosh', { dir: 1 }); fx(T(6) + 7 * HALF, 'whoosh', { dir: -1 });
// bars 7-8
fx(FLICK0, 'riser', { dur: SILENCE0 - FLICK0 });
sfx(T(7) + 0.07, 'sendout'); sfx(T(7) + 0.28, 'cry');
sfx(T(7, 1, 3), 'sendout');
sfx(T(8) - 0.09, 'attack'); sfx(T(8), 'superHit'); fx(T(8), 'slam', { size: 0.6 });
sfx(T(8, 2) - 0.05, 'attack'); sfx(T(8, 2), 'hit');
// the drop
fx(DROP, 'drop'); sfx(DROP, 'superHit');
sfx(DROP + 1.28, 'faint');
// the board
fx(BOARD0, 'glass'); fx(BOARD0, 'slam', { size: 1 });
for (let i = 0; i < 5; i++) { fx(BOARD0 + 0.1 + i * S16, 'whoosh', { dir: 1, soft: true }); sfx(BOARD0 + 0.2 + i * S16, 'cursor'); }
board.trades.forEach((tr, i) => { sfx(tr.t, 'tick'); if (i % 2 === 0) sfx(tr.t + 0.3, 'item'); });
sfx(T(11, 0, 2), 'item'); sfx(T(11, 0, 3), 'item'); sfx(T(11, 1), 'item'); fx(T(11, 0, 2), 'sparkle');
// countdown
fx(COUNT0, 'slam', { size: 0.9 });
{
  // ticks accelerate as the clock races
  let t = T(12, 1);
  let gap = BEAT / 2;
  while (t < ZERO - 0.02) { sfx(t, 'tick'); t += gap; gap = Math.max(S16 / 2, gap * 0.9); }
}
sfx(T(13, 2), 'lowHp'); sfx(T(13, 3), 'lowHp');
fx(ZERO, 'slam', { size: 1 }); fx(ZERO, 'glitch', { len: 0.2 });
fx(RESET, 'glitch', { len: 0.3 }); sfx(RESET + 0.05, 'cancel');
fx(T(14, 3), 'glitchRise', { dur: BEAT });
// new map
sfx(NEWMAP, 'thunder'); sfx(NEWMAP, 'spotted'); fx(NEWMAP, 'slam', { size: 0.8 });
for (let i = 1; i < 4; i++) fx(T(15, i), 'slam', { size: 0.5 });
sfx(T(15, 2) + 0.02, 'cry'); sfx(T(15, 2), 'grass', { run: true });
// end card: the music cuts to one beat, the logo slams, one last hit
fx(END, 'logo'); sfx(END, 'evolveBurst');
sfx(T(16, 1), 'item');
sfx(T(17, 0, 2), 'confirm');
fx(LAST, 'last');
cues.sort((a, b) => a.t - b.t);

// ------------------------------------------------------ the master timeline
export const DEFAULTS = () => ({
  cam: { z: 2, x: 480, y: 320, wx: 0, wy: 0, blur: 0 },
  fx: { flash: 0, shake: 0, rgb: 0, glitch: 0, bloom: 0, fade: 0 },
  cap: { cid: -1, scale: 1, alpha: 0, heat: 0 },   // (not 'id': GSAP reserves it)
  handle: 0,
  board: {
    z: 1, x: 960, y: 540, pool: board.poolStart, glint: -1, dim: 0,
    timer: 86400, timerScale: 0, timerAlpha: 0, timerRed: 0, reset: 0,
    rows: board.rows.map(() => ({ x: 1600, a: 0 })), title: 0, poolIn: 0,
  },
  end: { logo: 0, logoScale: 1.6, glow: 0 },
  sil: { boss: 0, creature: 0 },
});

export function buildMaster(S) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  // camera: every plate shot eases from its start to its end framing;
  // whip-pan entries throw the new shot in from off-screen with motion blur
  for (const s of shots) {
    if (s.kind !== 'plate') continue;
    tl.set(S.cam, { ...s.cam.from, wx: 0, wy: 0, blur: 0 }, s.t0);
    tl.to(S.cam, { ...s.cam.to, duration: s.t1 - s.t0, ease: s.cam.ease }, s.t0);
    if (s.enter?.type === 'whip') {
      tl.set(S.cam, { wx: s.enter.dx * W * 0.55, wy: s.enter.dy * H * 0.55, blur: 1 }, s.t0);
      tl.to(S.cam, { wx: 0, wy: 0, blur: 0, duration: 0.17, ease: 'expo.out' }, s.t0);
    }
  }
  // impacts
  for (const im of impacts) {
    for (const [k, dur, ease] of [['flash', 0.16, 'power2.out'], ['shake', 0.38, 'power2.out'], ['rgb', 0.2, 'power3.out'], ['glitch', 0.16, 'power2.out'], ['bloom', 0.5, 'power2.out']]) {
      if (!im[k]) continue;
      tl.set(S.fx, { [k]: im[k] }, im.t);
      tl.to(S.fx, { [k]: 0, duration: dur, ease }, im.t);
    }
  }
  // captions: slam in (scale + white-hot flash), hold, snap out
  captions.forEach((c, i) => {
    tl.set(S.cap, { cid: i, scale: c.size > 130 ? 1.45 : 1.3, alpha: 1, heat: 1 }, c.t0);
    tl.to(S.cap, { scale: 1, duration: 0.13, ease: 'back.out(2.2)' }, c.t0);
    tl.to(S.cap, { heat: 0, duration: 0.12 }, c.t0);
    if (!c.cutOut && !c.noOut) tl.to(S.cap, { alpha: 0, duration: 0.07 }, c.t1 - 0.07);
    tl.set(S.cap, { cid: c.noOut ? i : -1 }, c.t1 - 0.0001);
  });
  tl.to(S, { handle: 1, duration: 0.2 }, HANDLE.t0);

  // the leaderboard (bars 10-14)
  const B = S.board;
  tl.set(B, { title: 0, poolIn: 0, z: 1.12, x: 960, y: 520 }, BOARD0);
  tl.to(B, { z: 1, duration: 0.3, ease: 'expo.out' }, BOARD0);
  tl.to(B, { title: 1, duration: 0.25, ease: 'back.out(2)' }, BOARD0 + 0.02);
  tl.to(B, { poolIn: 1, duration: 0.3, ease: 'back.out(2)' }, BOARD0 + 0.1);
  B.rows.forEach((r, i) => {
    tl.set(r, { x: 1600, a: 1 }, BOARD0);
    tl.to(r, { x: 0, duration: 0.34, ease: 'expo.out' }, BOARD0 + 0.12 + i * S16);
  });
  // push toward the pool while trades pour in, then down onto the top 3
  tl.to(B, { z: 1.14, x: 960, y: 330, duration: BAR - 0.3, ease: 'sine.inOut' }, BOARD0 + 0.3);
  board.trades.forEach((tr) => tl.to(B, { pool: tr.pool, duration: 0.14, ease: 'power2.out' }, tr.t + 0.3));
  tl.to(B, { z: 1.22, x: 900, y: 560, duration: BAR * 0.8, ease: 'sine.inOut' }, T(11));
  tl.set(B, { glint: 0 }, T(11, 0, 2));
  tl.to(B, { glint: 1, duration: 0.6, ease: 'power1.inOut' }, T(11, 0, 2));
  // countdown: slam, hold a beat, race to zero, reset
  tl.to(B, { z: 1, x: 960, y: 540, dim: 0.72, duration: 0.3, ease: 'expo.out' }, COUNT0);
  tl.set(B, { timer: 86400, timerScale: 1.5, timerAlpha: 1, timerRed: 0 }, COUNT0);
  tl.to(B, { timerScale: 1, duration: 0.18, ease: 'back.out(2)' }, COUNT0);
  tl.to(B, { timer: 0, duration: ZERO - T(12, 1), ease: 'expo.in' }, T(12, 1));
  tl.to(B, { timerRed: 1, duration: 0.8 }, ZERO - 0.8);
  tl.set(B, { timerScale: 1.25 }, ZERO);
  tl.to(B, { timerScale: 1, duration: 0.2, ease: 'back.out(2)' }, ZERO);
  tl.to(B, { reset: 1, duration: 0.45, ease: 'power2.in' }, RESET);
  tl.to(B, { pool: 0, duration: 0.35, ease: 'power2.in' }, RESET);
  tl.set(B, { timer: 86400, timerRed: 0 }, T(14, 1));
  // the glitch builds under the last beat, then wipes to the new map
  tl.set(S.fx, { glitch: 0 }, T(14, 3));
  tl.to(S.fx, { glitch: 1, duration: BEAT, ease: 'power2.in' }, T(14, 3));
  tl.set(S.fx, { glitch: 0.6 }, NEWMAP);
  tl.to(S.fx, { glitch: 0, duration: 0.2 }, NEWMAP);

  // new map: bosses (beat 1), map (beat 2), creatures (beat 3), all (beat 4)
  const Sl = S.sil;
  tl.set(Sl, { boss: 0, creature: 0 }, NEWMAP);
  tl.to(Sl, { boss: 1, duration: 0.14, ease: 'expo.out' }, NEWMAP);
  tl.to(Sl, { boss: 0.35, duration: 0.2 }, T(15, 1));
  tl.to(Sl, { creature: 1, duration: 0.14, ease: 'expo.out' }, T(15, 2));
  tl.to(Sl, { boss: 1, duration: 0.1 }, T(15, 3));

  // end card
  const E = S.end;
  tl.set(E, { logo: 1, logoScale: 1.7, glow: 1 }, END);
  tl.to(E, { logoScale: 1, duration: 0.14, ease: 'expo.out' }, END);
  tl.to(E, { logoScale: 1.04, duration: LAST - END, ease: 'sine.inOut' }, END + 0.14);
  tl.to(E, { glow: 0.45, duration: 0.6 }, END + 0.1);
  tl.set(E, { glow: 1 }, LAST);
  tl.to(E, { glow: 0.3, duration: 0.5 }, LAST);
  tl.set(S.fx, { fade: 0 }, LAST);
  tl.to(S.fx, { fade: 1, duration: DURATION - LAST - 0.02, ease: 'power2.in' }, LAST);
  // silence before the drop is black
  tl.set(S.fx, { fade: 1 }, SILENCE0);
  tl.set(S.fx, { fade: 0 }, DROP);

  tl.duration();       // (forces the end time to be computed)
  return tl;
}

/** Evaluate the master timeline at t. Forward seeks are incremental; any
 *  backward seek rebuilds from scratch so scrubbing is always exact. */
export function makeEvaluator() {
  let S = DEFAULTS();
  let tl = buildMaster(S);
  let last = -1;
  return (t) => {
    if (t < last) { S = DEFAULTS(); tl.kill(); tl = buildMaster(S); }
    tl.time(Math.max(t, 1e-6), true);     // (a timeline won't render if its playhead doesn't move)
    last = t;
    return S;
  };
}
