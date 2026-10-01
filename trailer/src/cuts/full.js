// The whole trailer as data on one beat grid (140 bpm), plus the GSAP master
// timeline that animates every continuous value (camera, flashes, shake,
// RGB split, glitch, captions, leaderboard, counters). Video and audio are both
// driven from here, so a cut and its sound can't drift apart.
import gsap from 'gsap';
import { T, BEAT, BAR, S16, W, H, DURATION } from '../grid.js';
import { linear, smooth } from '../remap.js';


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

// The teaser: the world -> you -> the bosses -> Ansem, fought to the knockout
// -> what's at stake -> the Hall, and whoever waits at the top -> title.
// Every boss but Ansem stays unnamed (the capture hides their names).

// Bars 1-2 - a drone flyover of the whole route, morning to night (time-lapse)
plate('fly', T(1), 2 * BAR, 'fly_world', [0.10, 4.95], cam(2.0, 480, 320, 2.08, 480, 318, 'none'));

// Bars 3-4 - the places, one per half bar: day, golden hour, dawn, rain at night
plate('market', T(3), 2 * BEAT, 'env_market', [0.15, 1.10], cam(2.0, 480, 300, 2.1, 490, 300));
plate('pond', T(3, 2), 2 * BEAT, 'env_pond', [0.30, 1.25], cam(2.0, 480, 320, 2.1, 480, 316));
plate('windmill', T(4), 2 * BEAT, 'env_windmill', [0.20, 1.15], cam(2.0, 480, 300, 2.1, 470, 296));
plate('rain', T(4, 2), 2 * BEAT, 'env_rain', [0.30, 1.25], cam(2.0, 480, 320, 2.12, 480, 314));

// Bars 5-6 - you: the portrait shrinks into your overworld sprite
plate('shrink', T(5), 6 * BEAT, 'look_shrink', {
  type: 'linear', pts: [[0, 0.35], [BEAT, 1.05], [6 * BEAT - 0.5, 3.35], [6 * BEAT, 3.75]],
}, cam(2.0, 480, 300, 3.1, 480, 392, 'power2.in'));

// Bars 6-7 - the bosses: three route Elites' VS splashes, names hidden
export const LINEUP = T(6, 2);
const vsCam = (x) => cam(2.0, 480, 306, 2.06, x, 310, 'power1.out');
plate('vsA', LINEUP, 2 * BEAT, 'vs_a', [2.30, 3.10], vsCam(520));
plate('vsC', LINEUP + 2 * BEAT, 2 * BEAT, 'vs_c', [2.30, 3.10], vsCam(520));
plate('vsE', LINEUP + 4 * BEAT, 2 * BEAT, 'vs_e', [2.30, 3.10], vsCam(520));

// Bars 8-11 - Ansem (the one boss named, by the game's own VS screen), fought
// to the knockout
export const VS0 = T(8);
plate('vs', VS0, BAR, 'ansem_battle', [0.55, 2.30], cam(2.0, 480, 319));
export const BUILD0 = T(9);
export const SILENCE0 = T(9, 3, 1);          // black + total silence (3 sixteenths = 0.32 s)
export const DROP = T(10);
plate('fight', BUILD0, SILENCE0 - BUILD0, 'ansem_battle', {
  type: 'linear',
  pts: [[0, 7.20], [2 * BEAT, 7.97], [2 * BEAT + S16, 7.97], [SILENCE0 - BUILD0, 8.75]],
}, cam(2.0, 480, 288, 2.1, 505, 284), { dmg: [{ at: 2 * BEAT, x: 715, y: 140, text: '-42', big: true }] });
shots.push({ id: 'silence', kind: 'black', t0: SILENCE0, t1: DROP });
plate('ko', DROP, 6 * BEAT, 'ansem_ko', {
  type: 'smooth',
  pts: [[0, 0.74], [0.12, 0.82], [0.7, 0.95], [1.25, 1.35], [1.95, 2.05], [6 * BEAT, 2.62]],
}, cam(2.5, 690, 215, 2.0, 480, 294, 'power2.out'), {
  dmg: [{ at: 0.04, x: 715, y: 140, text: '-26', big: true, gold: true, dur: 1.3 }],
});

// Bars 11-12 - what's at stake: the daily pool and the top 3
export const BOARD0 = T(11, 2);
export const PAY = T(12, 1, 2);
export const RESET = DURATION + 1;          // (no reset in the teaser)
shots.push({ id: 'board', kind: 'board', t0: BOARD0, t1: T(13), enter: { type: 'shatter', from: 'ko' } });

// Bars 13-16 - the Elite Hall at night; inside, the braziers catch one by one;
// on the dais, a silhouette - every flame flares - the final Elite (unnamed)
export const HALL0 = T(13);
plate('hallExt', HALL0, 2 * BEAT, 'hall_ext', [0.9, 2.3], cam(2.0, 480, 320, 2.12, 480, 300));
plate('hallWalk', T(13, 2), BAR, 'hall_walk', [0.45, 3.25], cam(2.0, 480, 320, 2.1, 480, 318, 'none'));
export const REVEAL0 = T(14, 2);
plate('dais', REVEAL0, BAR, 'hall_walk', {
  type: 'linear', pts: [[0, 3.95], [2 * BEAT + S16, 5.40], [BAR, 6.30]],
}, cam(2.0, 480, 320, 2.25, 480, 290, 'power1.in'));
export const BOSS0 = T(15, 2);
plate('vsCooker', BOSS0, BAR, 'vs_cooker', {
  type: 'linear', pts: [[0, 0.45], [2 * BEAT + 2 * S16, 1.95], [BAR, 3.40]],
}, cam(2.0, 480, 306, 2.08, 530, 306, 'power1.out'), { bloomScale: 0.15 });

// Bars 16-18 - the end card
export const END = T(16, 2);
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
// Lowercase, in the game's pixel font, one line at a time.
export const captions = [
  { t0: T(1), t1: T(2, 1), text: 'remember losing whole afternoons to pokemon?', size: 88, still: true },
  { t0: T(2, 1, 2), t1: T(3), text: 'so we built a whole world.', size: 104 },
  { t0: T(3, 0, 2), t1: T(5), text: 'explore it. day and night.', size: 104 },
  { t0: T(5, 1), t1: T(6, 2), text: 'step inside.', size: 116 },
  { t0: LINEUP, t1: T(8), text: 'battle your favorite creators.', size: 96, y: 140 },
  { t0: T(10, 2), t1: BOARD0, text: 'beat every boss. fastest run wins.', size: 96 },
  { t0: BOARD0 + S16 * 2, t1: T(12, 1), text: 'every trade fills the pool.', size: 100, gold: true },
  { t0: T(12, 1, 2), t1: T(13), text: 'top 3 get paid. every day.', size: 100, gold: true },
  { t0: HALL0 + S16 * 2, t1: REVEAL0, text: 'one waits at the top.', size: 104 },
  { t0: T(16, 3), t1: T(17, 2), text: 'win creator fees daily.', size: 92, y: 760, gold: true },
  { t0: T(17, 2), t1: DURATION, text: 'now live', size: 92, y: 760, noOut: true },
];
export const HANDLE = { t0: T(17, 2), text: '@SolQuestOnSol' };

// ---------------------------------------------------------------- impacts
// Gentle: shake on the hits, a soft (<= 0.2) white lift only on the few big
// moments, never more than one a second. No strobing, no inverts.
export const impacts = [];
const hit = (t, o) => impacts.push({ t, flash: 0, shake: 0, rgb: 0, glitch: 0, ...o });
for (let i = 0; i < 3; i++) hit(LINEUP + i * 2 * BEAT, { shake: 8, rgb: 0.15 });   // each boss slams in
hit(VS0, { shake: 8, rgb: 0.15 });
hit(T(9, 2), { shake: 12, flash: 0.12, rgb: 0.2 });            // our hit on his creature
hit(DROP, { shake: 14, flash: 0.18, rgb: 0.25, bloom: 1.0 });  // the knockout blow
hit(BOARD0, { shake: 9, rgb: 0.2 });
hit(PAY, { bloom: 0.3 });
hit(when('dais', 5.40), { shake: 12, bloom: 1.1 });            // every flame flares
hit(BOSS0, { shake: 12, rgb: 0.2 });                           // the final Elite
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
  trades: [],
};
{
  const sides = ['buy', 'sell', 'buy', 'buy', 'buy'];
  const amts = [2.40, 1.10, 5.75, 12.5, 4.18];
  let pool = board.poolStart;
  sides.forEach((side, i) => {
    const t = BOARD0 + BEAT + i * (S16 * 2);
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
// the flyover
fx(T(2, 2), 'swell', { dur: 2 * BEAT });
// the places
for (let i = 0; i < 4; i++) fx(T(3) + i * 2 * BEAT, 'whoosh', { dir: i % 2 ? -1 : 1, soft: true });
sfx(T(3) + 0.1, 'footstep'); sfx(T(3) + 0.35, 'footstep');
sfx(T(3, 2) + 0.1, 'footstep'); sfx(T(3, 2) + 0.35, 'footstep');
sfx(T(4, 2) + 0.05, 'footstep'); sfx(T(4, 2) + 0.32, 'footstep');
// you
sfx(when('shrink', 1.15), 'status');
sfx(when('shrink', 2.10), 'sendout');
for (let k = 0; k < 8; k++) sfx(when('shrink', 2.45 + k * 0.09), 'tick');
sfx(when('shrink', 3.30), 'confirm');
// the bosses
for (let i = 0; i < 3; i++) { fx(LINEUP + i * 2 * BEAT, 'slam', { size: 0.55 }); sfx(LINEUP + i * 2 * BEAT, 'vs'); }
sfx(VS0, 'encounterTrainer'); fx(VS0, 'slam', { size: 0.6 });
// the fight and the knockout
sfx(when('fight', 7.57), 'attack'); sfx(T(9, 2), 'superHit'); fx(T(9, 2), 'slam', { size: 0.5 });
fx(BUILD0, 'riser', { dur: SILENCE0 - BUILD0 });
fx(DROP, 'drop'); sfx(DROP, 'superHit');
sfx(when('ko', 2.008), 'faint');
// the board
fx(BOARD0, 'glass'); fx(BOARD0, 'slam', { size: 0.8 });
for (let i = 0; i < 4; i++) fx(BOARD0 + (i + 1) * S16, 'whoosh', { dir: 1, soft: true });
board.trades.forEach((tr, i) => { sfx(tr.t, 'tick'); if (i % 2 === 0) sfx(tr.t + S16 * 3, 'item'); });
sfx(PAY, 'item'); sfx(PAY + S16, 'item'); sfx(PAY + 2 * S16, 'item'); fx(PAY, 'sparkle');
// the Hall
sfx(T(13, 2), 'hallDoors');
for (const src of [0.8, 1.6, 2.4]) sfx(when('hallWalk', src), 'ignite');
sfx(when('dais', 5.40), 'flare');
sfx(when('dais', 5.95), 'spotted');
fx(T(15), 'riser', { dur: 2 * BEAT });
fx(BOSS0, 'slam', { size: 1 }); sfx(BOSS0, 'vs');
// end card: the music cuts to one beat, the logo lands, one last hit
fx(END, 'logo'); sfx(END, 'evolveBurst');
sfx(T(16, 3), 'item');
sfx(T(17, 2), 'confirm');
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

  // the leaderboard (bars 11-12)
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
  tl.to(B, { z: 1.06, x: 960, y: 440, duration: PAY - BOARD0 - 0.3, ease: 'sine.inOut' }, BOARD0 + 0.3);
  board.trades.forEach((tr) => tl.to(B, { pool: tr.pool, duration: 0.14, ease: 'power2.out' }, tr.t + 0.3));
  tl.to(B, { z: 1.04, x: 945, y: 500, duration: T(13) - PAY, ease: 'sine.inOut' }, PAY);
  tl.set(B, { glint: 0 }, PAY);
  tl.to(B, { glint: 1, duration: 0.7, ease: 'power1.inOut' }, PAY);

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

// For the audio render: where to measure section levels, and where to duck the music.
export const SECTIONS = [['fly', 0, T(3)], ['world', T(3), T(5)], ['you', T(5), LINEUP], ['bosses', LINEUP, BUILD0],
  ['fight', BUILD0, SILENCE0], ['ko', DROP, BOARD0], ['board', BOARD0, HALL0], ['hall', HALL0, REVEAL0], ['reveal', REVEAL0, END], ['end', END, DURATION]];
export const DUCKS = [DROP, BOARD0, BOSS0];
