// The whole trailer as data on one beat grid (140 bpm), plus the GSAP master
// timeline that animates every continuous value (camera, flashes, shake,
// RGB split, glitch, captions, leaderboard, counters). Video and audio are both
// driven from here, so a cut and its sound can't drift apart.
import gsap from 'gsap';
import { T, BEAT, BAR, S16, W, H, DURATION } from './grid.js';
import { linear, smooth } from './remap.js';


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
/** hit-stop remap: play `a`->`hit` for `lead` s, freeze on `hit` for `hold` s, then creep on */
const stop = (a, hit, lead, hold, dur, after = 0.03) => ({ type: 'linear', pts: [[0, a], [lead, hit], [lead + hold, hit], [dur, hit + after]] });

// A slow, readable edit: most shots hold 2-8 beats so every beat of the story
// lands (what the game is -> how you start -> battle + level up -> the Ansem
// fight, start to finish -> how the daily pool works -> daily reset -> end card).

// Bars 1-2 - one long push-in over the tall grass at dusk
plate('grass', T(1), 2 * BAR, 'grass_dusk', [0.05, 2.95], cam(2.0, 480, 300, 2.35, 482, 290, 'sine.inOut'));

// Bars 3-4 - how you start: a name, a wallet, one creature
plate('name', T(3), 2 * BEAT, 'name_entry', [0.20, 1.05], cam(2.5, 480, 322, 2.6, 480, 322));
plate('wallet', T(3, 2), 2 * BEAT, 'wallet_paste', [0.30, 1.15], cam(2.55, 480, 226, 2.62, 480, 228));
plate('starter', T(4), BAR, 'starter_pick', [0.85, 2.62], cam(2.0, 480, 286, 2.06, 480, 284));

// Bars 5-6 - a wild battle at real speed (menu, hit, HP drains), then level up
const WILD_LEAD = 2 * BEAT + 2 * S16;          // the hit lands on beat 3.3 of bar 5
plate('wild', T(5), 5 * BEAT, 'battle_wild', stop(0.55, 1.70, WILD_LEAD, S16, 5 * BEAT, 1.30),
  cam(2.0, 480, 296, 2.04, 500, 296), { dmg: [{ at: WILD_LEAD, x: 715, y: 150, text: '-32' }] });
plate('lvl', T(6, 1), 3 * BEAT, 'battle_wild', [10.30, 11.60], cam(2.0, 480, 296, 2.04, 500, 296));

// Bars 7-12 - the Ansem battle, start to finish.
// The game's own VS intro (KAI vs ELITE TRAINER ANSEM), held so it reads.
export const VS0 = T(7);
// (held still: KAI, game rows 53-78, and ELITE TRAINER ANSEM, rows 550-585, both stay in frame)
plate('vs', VS0, 6 * BEAT, 'ansem_battle', [0.0, 2.45], cam(2.0, 480, 319));
// The fight: move menu -> Inferno Roar -> super-effective hit -> his HP drains
export const BUILD0 = T(8, 2);
export const SILENCE0 = T(9, 3, 1);          // black + total silence (3 sixteenths = 0.32 s)
export const DROP = T(10);
plate('fight', BUILD0, SILENCE0 - BUILD0, 'ansem_battle', {
  type: 'linear',
  pts: [[0, 6.95], [T(9) - BUILD0, 7.97], [T(9, 0, 1) - BUILD0, 7.97], [SILENCE0 - BUILD0, 9.20]],
}, cam(2.0, 480, 288, 2.1, 505, 284), { dmg: [{ at: T(9) - BUILD0, x: 715, y: 140, text: '-42', big: true }] });
shots.push({ id: 'silence', kind: 'black', t0: SILENCE0, t1: DROP });
// The knockout: one speed ramp (slow motion through the hit, back up to speed
// as the HP drains to zero and Glowblade faints), ending wide on the game's HUD.
plate('ko', DROP, 2 * BAR, 'ansem_ko', {
  type: 'smooth',
  pts: [[0, 0.74], [0.12, 0.82], [0.7, 0.95], [1.3, 1.35], [2.5, 2.10], [2 * BAR, 2.80]],
}, cam(2.5, 690, 215, 2.0, 480, 294, 'power2.out'), {
  dmg: [{ at: 0.04, x: 715, y: 140, text: '-26', big: true, gold: true, dur: 1.3 }],
});

// Bars 12-14 - one leaderboard shot: shatter in, pool fills, top 3 paid, countdown
export const BOARD0 = T(12);
export const PAY = T(13, 0, 2);
export const COUNT0 = T(14);
export const ZERO = T(14, 3);
export const RESET = T(14, 3, 2);
shots.push({ id: 'board', kind: 'board', t0: BOARD0, t1: T(15), enter: { type: 'shatter', from: 'ko' } });

// Bar 15 - the glitch wipe lands on a new map; bosses and creatures in silhouette
export const NEWMAP = T(15);
plate('newmap', NEWMAP, BAR, 'newmap_pond', [0.4, 0.4 + BAR], cam(2.3, 480, 300, 2.05, 480, 318, 'power2.out'),
  { enter: { type: 'glitch', from: 'board' }, silhouettes: true });

// Bars 16-18 - the end card
export const END = T(16);
export const LAST = T(18);
shots.push({ id: 'end', kind: 'end', t0: END, t1: DURATION });

shots.sort((a, b) => a.t0 - b.t0);
export { shots };

/** Trailer time at which a plate shot shows source time `src` (remaps are monotone). */
function when(id, src) {
  const sh = shots.find((x) => x.id === id);
  let lo = 0;
  let hi = sh.t1 - sh.t0;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (sh.remap(m) < src) lo = m; else hi = m; }
  return sh.t0 + hi;
}

// Damage numbers (HUD motion graphics), in plate coordinates.
export const damage = [];
for (const s of shots) for (const d of s.dmg ?? []) damage.push({ ...d, t: s.t0 + d.at, plate: s.plate });
export function shotAt(t) {
  let lo = 0;
  for (let i = 0; i < shots.length; i++) if (shots[i].t0 <= t + 1e-9) lo = i;
  return shots[lo];
}
export const shotById = (id) => shots.find((s) => s.id === id);

// --------------------------------------------------------------- captions
// Lowercase, in the game's pixel font, one line at a time, each held long
// enough to read. ("trading funds the pool. play decides who gets it." is cut.)
export const captions = [
  { t0: T(1), t1: T(2, 1), text: 'remember losing whole afternoons to pokemon?', size: 88, still: true },
  { t0: T(2, 1, 2), t1: T(3), text: 'so we made a game.', size: 104 },
  { t0: T(3), t1: T(3, 2), text: 'pick a name.', size: 104, y: 150 },
  { t0: T(3, 2), t1: T(4), text: 'add your wallet.', size: 104 },
  { t0: T(4), t1: T(5), text: 'choose your first creature.', size: 104 },
  { t0: T(5), t1: T(6, 1), text: 'battle wild creatures.', size: 104 },
  { t0: T(6, 1), t1: T(7), text: 'level up.', size: 116 },
  { t0: T(7, 2), t1: T(8, 2), text: 'battle your favorite creators.', size: 96, y: 140 },
  { t0: T(11), t1: T(12), text: 'beat every boss. fastest run wins.', size: 96 },
  { t0: T(12, 0, 2), t1: T(13), text: 'every trade fills the pool.', size: 100, gold: true },
  { t0: T(13, 0, 2), t1: T(14), text: 'top 3 get paid. every day.', size: 100, gold: true },
  { t0: T(14), t1: T(15), text: 'resets every 24 hours.', size: 100 },
  { t0: T(15), t1: T(16), text: 'new map. new bosses. every day.', size: 112, y: 300, cutOut: true },
  { t0: T(16, 1), t1: T(17), text: 'win creator fees daily.', size: 92, y: 760, gold: true },
  { t0: T(17, 0, 2), t1: DURATION, text: 'coming soon', size: 92, y: 760, noOut: true },
];
export const HANDLE = { t0: T(17, 0, 2), text: '@SolQuestOnSol' };

// ---------------------------------------------------------------- impacts
// Gentle: a little shake on hits, a soft (<= 0.2) white lift only on the few
// big moments, never more than one a second. No strobing, no inverts.
export const impacts = [];
const hit = (t, o) => impacts.push({ t, flash: 0, shake: 0, rgb: 0, glitch: 0, ...o });
const WILD_HIT = T(5) + WILD_LEAD;
hit(WILD_HIT, { shake: 9, flash: 0.1 });
hit(T(7, 2), { shake: 6 });                                    // the VS banner lands
hit(T(9), { shake: 12, flash: 0.12, rgb: 0.2 });               // our hit on his creature
hit(DROP, { shake: 14, flash: 0.18, rgb: 0.25, bloom: 1.0 });  // the knockout blow
hit(BOARD0, { shake: 9, rgb: 0.2 });
hit(PAY, { bloom: 0.8 });
hit(COUNT0, { shake: 6 });
hit(ZERO, { shake: 9, glitch: 0.2 });
hit(RESET, { glitch: 0.25 });
hit(NEWMAP, { shake: 7 });
hit(END, { shake: 10, flash: 0.12, bloom: 1.0 });
hit(LAST, { shake: 5 });

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
  // trades pop in on the grid; each one feeds the pool
  trades: [],
};
{
  const sides = ['buy', 'sell', 'buy', 'buy', 'sell', 'buy', 'buy'];
  const amts = [2.40, 1.10, 5.75, 3.30, 0.64, 12.5, 4.18];
  let pool = board.poolStart;
  sides.forEach((side, i) => {
    const t = T(12, 1) + i * (S16 * 2);
    pool += amts[i] * 0.6 + 0.9;        // dramatised: the pool visibly climbs
    board.trades.push({ t, side, amt: amts[i], pool, slot: i % 4 });
  });
  board.poolEnd = pool;
  board.payAt = PAY;               // "top 3 get paid": coins fly to the gold rows
}

// ------------------------------------------------------------ audio cues
// type 'sfx' = the game's own sound effect (src/systems/audio.js), 'fx' = a
// trailer sound (riser / whoosh / impact / glass / glitch), both on this grid.
export const cues = [];
const sfx = (t, name, opts) => cues.push({ t, type: 'sfx', name, opts });
const fx = (t, name, opts) => cues.push({ t, type: 'fx', name, opts });
// bars 1-2 - the grass
for (const t of [0.25, 0.95, 1.7, 2.45]) sfx(t, 'grass');
fx(T(2, 3), 'swell', { dur: BEAT });
// bars 3-4 - name, wallet, creature
sfx(T(3) + 0.12, 'cursor'); sfx(T(3) + 0.34, 'cursor'); sfx(T(3) + 0.58, 'cursor');
sfx(T(3, 2) + 0.2, 'confirm');
for (const src of [1.2, 1.8, 2.3]) sfx(when('starter', src), 'cursor');
sfx(when('starter', 2.6), 'confirm');
// bars 5-6 - wild battle + level up
sfx(T(5) + 0.06, 'confirm');
sfx(when('wild', 1.30), 'attack'); sfx(WILD_HIT, 'superHit');
sfx(T(6, 1) + 0.03, 'levelup');
// bars 7-9 - the Ansem battle
sfx(VS0, 'encounterTrainer'); sfx(when('vs', 0.62), 'vs');
fx(T(7, 2), 'slam', { size: 0.55 });
sfx(when('fight', 7.05), 'confirm');
sfx(when('fight', 7.57), 'attack'); sfx(T(9), 'superHit'); fx(T(9), 'slam', { size: 0.5 });
fx(BUILD0, 'riser', { dur: SILENCE0 - BUILD0 });
// the knockout
fx(DROP, 'drop'); sfx(DROP, 'superHit');
sfx(when('ko', 2.008), 'faint');
// the board
fx(BOARD0, 'glass'); fx(BOARD0, 'slam', { size: 0.8 });
for (let i = 0; i < 5; i++) { fx(BOARD0 + (i + 1) * S16, 'whoosh', { dir: 1, soft: true }); sfx(BOARD0 + (i + 2) * S16, 'cursor'); }
board.trades.forEach((tr, i) => { sfx(tr.t, 'tick'); if (i % 2 === 0) sfx(tr.t + S16 * 3, 'item'); });
sfx(PAY, 'item'); sfx(PAY + S16, 'item'); sfx(PAY + 2 * S16, 'item'); fx(PAY, 'sparkle');
// countdown
fx(COUNT0, 'slam', { size: 0.7 });
{
  // ticks accelerate as the clock races
  let t = T(14, 1);
  let gap = BEAT / 2;
  while (t < ZERO - 0.02) { sfx(t, 'tick'); t += gap; gap = Math.max(S16 / 2, gap * 0.85); }
}
sfx(T(14, 2), 'lowHp');
fx(ZERO, 'slam', { size: 0.8 });
fx(RESET, 'glitch', { len: 0.2 }); sfx(RESET + 0.05, 'cancel');
fx(RESET, 'glitchRise', { dur: NEWMAP - RESET });
// new map
sfx(NEWMAP, 'thunder'); sfx(NEWMAP, 'spotted'); fx(NEWMAP, 'slam', { size: 0.7 });
sfx(T(15, 2) + 0.02, 'cry'); sfx(T(15, 2), 'grass', { run: true });
// end card: the music cuts to one beat, the logo lands, one last hit
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
  // captions: ease in (a small settle, no white flash), hold, fade out
  captions.forEach((c, i) => {
    if (c.still) {                       // the opening line is already up on frame 0
      tl.set(S.cap, { cid: i, scale: 1, alpha: 1, heat: 0 }, c.t0);
    } else {
      tl.set(S.cap, { cid: i, scale: 1.08, alpha: 0, heat: 0 }, c.t0);
      tl.to(S.cap, { alpha: 1, duration: 0.1, ease: 'power1.out' }, c.t0);
      tl.to(S.cap, { scale: 1, duration: 0.22, ease: 'power2.out' }, c.t0);
    }
    if (!c.cutOut && !c.noOut) tl.to(S.cap, { alpha: 0, duration: 0.1 }, c.t1 - 0.1);
    tl.set(S.cap, { cid: c.noOut ? i : -1 }, c.t1 - 0.0001);
  });
  tl.to(S, { handle: 1, duration: 0.3 }, HANDLE.t0);

  // the leaderboard (bars 12-14)
  const B = S.board;
  tl.set(B, { title: 0, poolIn: 0, z: 1.08, x: 960, y: 520 }, BOARD0);
  tl.to(B, { z: 1, duration: 0.4, ease: 'power2.out' }, BOARD0);
  tl.to(B, { title: 1, duration: 0.25, ease: 'back.out(1.6)' }, BOARD0 + 0.02);
  tl.to(B, { poolIn: 1, duration: 0.3, ease: 'back.out(1.6)' }, BOARD0 + 0.1);
  B.rows.forEach((r, i) => {
    tl.set(r, { x: 1600, a: 1 }, BOARD0);
    tl.to(r, { x: 0, duration: 0.4, ease: 'expo.out' }, BOARD0 + 0.12 + i * S16);
  });
  // ease toward the pool while trades pour in, then down onto the top 3
  tl.to(B, { z: 1.06, x: 960, y: 440, duration: BAR - 0.3, ease: 'sine.inOut' }, BOARD0 + 0.3);
  board.trades.forEach((tr) => tl.to(B, { pool: tr.pool, duration: 0.14, ease: 'power2.out' }, tr.t + 0.3));
  tl.to(B, { z: 1.04, x: 945, y: 500, duration: BAR * 0.8, ease: 'sine.inOut' }, T(13));
  tl.set(B, { glint: 0 }, PAY);
  tl.to(B, { glint: 1, duration: 0.7, ease: 'power1.inOut' }, PAY);
  // countdown: 24:00:00 holds a beat so it reads, races to zero, the board resets
  tl.to(B, { z: 1, x: 960, y: 540, dim: 0.72, duration: 0.35, ease: 'power2.out' }, COUNT0);
  tl.set(B, { timer: 86400, timerScale: 1.2, timerAlpha: 1, timerRed: 0 }, COUNT0);
  tl.to(B, { timerScale: 1, duration: 0.25, ease: 'back.out(1.6)' }, COUNT0);
  tl.to(B, { timer: 0, duration: ZERO - T(14, 1), ease: 'expo.in' }, T(14, 1));
  tl.to(B, { timerRed: 1, duration: 0.5 }, ZERO - 0.5);
  tl.set(B, { timerScale: 1.1 }, ZERO);
  tl.to(B, { timerScale: 1, duration: 0.2, ease: 'power2.out' }, ZERO);
  tl.to(B, { reset: 1, duration: 0.4, ease: 'power2.in' }, RESET - 0.2);
  tl.to(B, { pool: 0, duration: 0.3, ease: 'power2.in' }, RESET - 0.1);
  // a light glitch under the reset, then the wipe to the new map
  tl.set(S.fx, { glitch: 0 }, RESET);
  tl.to(S.fx, { glitch: 0.3, duration: NEWMAP - RESET, ease: 'power2.in' }, RESET);
  tl.set(S.fx, { glitch: 0.3 }, NEWMAP);
  tl.to(S.fx, { glitch: 0, duration: 0.25 }, NEWMAP);

  // new map: the bosses, then the creatures, in silhouette
  const Sl = S.sil;
  tl.set(Sl, { boss: 0, creature: 0 }, NEWMAP);
  tl.to(Sl, { boss: 1, duration: 0.3, ease: 'power2.out' }, NEWMAP + 0.1);
  tl.to(Sl, { creature: 1, duration: 0.3, ease: 'power2.out' }, T(15, 2));

  // end card
  const E = S.end;
  tl.set(E, { logo: 1, logoScale: 1.35, glow: 0.9 }, END);
  tl.to(E, { logoScale: 1, duration: 0.2, ease: 'expo.out' }, END);
  tl.to(E, { logoScale: 1.04, duration: LAST - END, ease: 'sine.inOut' }, END + 0.14);
  tl.to(E, { glow: 0.45, duration: 0.6 }, END + 0.1);
  tl.to(E, { glow: 0.75, duration: 0.15 }, LAST);
  tl.to(E, { glow: 0.3, duration: 0.6 }, LAST + 0.15);
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
